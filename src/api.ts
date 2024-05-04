import { Context, Logger, Schema, Service } from "koishi"
import axios, { AxiosInstance } from 'axios'
import { CookieJar, Cookie } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import { JSDOM } from 'jsdom'
import { Notifier } from "@koishijs/plugin-notifier"
import { DateTime } from "luxon"

declare module 'koishi' {
    interface Context {
        biliApi: BiliAPI
    }
}

// 在getUserInfo中检测到番剧出差的UID时，要传回的数据：
const bangumiTripData = { "code": 0, "data": { "live_room": { "roomid": 931774 } } }

const GET_DYNAMIC_LIST = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?timezone_offset=-480&platform=web&features=itemOpusStyle'
const DYNAMIC_DETAIL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?timezone_offset=-480&platform=web&features=itemOpusStyle&id='

const GET_USER_SPACE_DYNAMIC_LIST = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?timezone_offset=-480&platform=web&features=itemOpusStyle&host_mid='
const GET_COOKIES_INFO = 'https://passport.bilibili.com/x/passport-login/web/cookie/info'
const GET_USER_INFO = 'https://api.bilibili.com/x/space/wbi/acc/info'
const GET_MYSELF_INFO = 'https://api.bilibili.com/x/member/web/account'
const GET_LOGIN_QRCODE = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
const GET_LOGIN_STATUS = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll'
const GET_LIVE_ROOM_INFO = 'https://api.live.bilibili.com/room/v1/Room/get_info'
const GET_MASTER_INFO = 'https://api.live.bilibili.com/live_user/v1/Master/info'
const GET_TIME_NOW = 'https://api.bilibili.com/x/report/click/now'
const GET_SERVER_UTC_TIME = 'https://interface.bilibili.com/serverdate.js'

const GET_LIVE_ROOM_INFO_LIST = 'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids'

// Follow
const IS_FOLLOW = "https://api.bilibili.com/x/relation"
const FOLLOW = "https://api.bilibili.com/x/relation/modify"

// Group 分组
const GROUP_LIST = "https://api.bilibili.com/x/relation/tags"
const CREATE_GROUP = "https://api.bilibili.com/x/relation/tag/create"
const COPY_TO_GROUP = "https://api.bilibili.com/x/relation/tags/copyUsers"
const ADD_TO_GROUP = "https://api.bilibili.com/x/relation/tags/addUsers"

class BiliAPI extends Service {
    static inject = ['database', 'wbi', 'notifier']

    jar: CookieJar
    client: AxiosInstance
    apiConfig: BiliAPI.Config
    loginData: any
    loginNotifier: Notifier
    refreshCookieTimer: Function
    loginInfoIsLoaded: boolean = false
    log: Logger

    constructor(ctx: Context, config: BiliAPI.Config) {
        super(ctx, 'biliApi')
        this.log = ctx.logger('BiliAPI')
        this.apiConfig = config
        this.log.info('已加载')
    }

    protected start(): void | Promise<void> {
        // 创建新的http客户端(axios)
        this.createNewClient()
        // 从数据库加载cookies
        this.loadCookiesFromDatabase()
    }

    protected async get(url: string) {
        this.log.debug(`>>>>>>>>>> Sending GET to: ${url}`)
        try {
            const {data} = await this.client.get(url)
            this.log.debug(`<<<<<<<<<< Received response:\n`, data)
            return data
        } catch (e) {
            this.log.error(`<<<<<<<<<< Received error:\n`, e)
            throw new Error('网络异常，本次请求失败！')
        }
    }
    /* protected stop(): void | Promise<void> {
        this.logger.info('已停止工作')
    } */

    async getServerUTCTime() {
        try {
            const data  = await this.get(GET_SERVER_UTC_TIME)
            const regex = /Date\.UTC\((.*?)\)/;
            const match = data.match(regex);
            if (match) {
                const timestamp = new Function(`return Date.UTC(${match[1]})`)();
                return timestamp / 1000;
            } else {
                throw new Error('解析服务器时间失败！');
            }
        } catch (e) {
            throw new Error('网络异常，本次请求失败！');
        }
    }

    async checkFollow(uid: number){
        return await this.get(`${IS_FOLLOW}?fid=${uid}`) as BiliResp<IsFollow>
    }

    private async setFollowRelation(uid: number, act: number) {
        const { cookies } = await this.getLoginInfoFromDB()
        let jct = cookies.find(cookie => {
            return cookie.key === "bili_jct"
        }).value
        let payload = {
            fid: uid,
            act,
            re_src: 11,
            csrf: jct
        }
        this.log.debug(`>>>>>>>>>> Sending POST request to: ${FOLLOW}\n`, payload)
        const {data} = await this.client.post(FOLLOW, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        this.log.debug(`<<<<<<<<<< Received response:\n`, data)
        return data
    }

    async getDynamicDetail(did: string){
        return await this.get(`${DYNAMIC_DETAIL}${did}`) as BiliResp<DynamicDetail>
    }

    async followUser(uid: number) {
        return await this.setFollowRelation(uid, 1)
    }

    async unfollowUser(uid: number) {
        return await this.setFollowRelation(uid, 2)
    }

    async getFollowGroups() {
        return await this.get(GROUP_LIST) as BiliResp<FollowGroup[]>
    }

    async checkLivesByUids(uids: number[]) {
        const { cookies } = await this.getLoginInfoFromDB()
        let jct = cookies.find(cookie => {
            return cookie.key === "bili_jct"
        }).value
        let payload = {
            uids
        }
        this.log.debug(`>>>>>>>>>> Sending POST request to: ${GET_LIVE_ROOM_INFO_LIST}\n`, payload)
        const {data} = await this.client.post(GET_LIVE_ROOM_INFO_LIST, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        this.log.debug(`<<<<<<<<<< Received response:\n`, data)
        return data as BiliResp<LiveRoomMap>
    }

    async createFollowGroup(name: string) {
        const { cookies } = await this.getLoginInfoFromDB()
        let jct = cookies.find(cookie => {
            return cookie.key === "bili_jct"
        }).value
        let payload = {
            tag: name,
            csrf: jct
        }
        this.log.debug(`>>>>>>>>>> Sending POST request to: ${CREATE_GROUP}\n`, payload)
        const {data} = await this.client.post(CREATE_GROUP, payload,{
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        this.log.debug(`<<<<<<<<<< Received response:\n`, data)
        return data as BiliResp<FollowGroup>
    }

    async cpToGroup(uid: number[], gid: number[]) {
        const { cookies } = await this.getLoginInfoFromDB()
        let jct = cookies.find(cookie => {
            return cookie.key === "bili_jct"
        }).value
        let payload = {
            fids: uid.join(','),
            tagids: gid.join(','),
            csrf: jct
        }
        this.log.debug(`>>>>>>>>>> Sending POST request to: ${COPY_TO_GROUP}\n`, payload)
        const {data} = await this.client.post(COPY_TO_GROUP, payload,{
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        this.log.debug(`<<<<<<<<<< Received response:\n`, data)
        return data
    }

    private async addToGroup(uid: number[], gid: number[]) {
        const { cookies } = await this.getLoginInfoFromDB()
        let jct = cookies.find(cookie => {
            return cookie.key === "bili_jct"
        }).value
        let payload = {
            fids: uid.join(','),
            tagids: gid.join(','),
            csrf: jct
        }
        this.log.debug(`>>>>>>>>>> Sending POST request to: ${ADD_TO_GROUP}\n`, payload)
        const {data} = await this.client.post(ADD_TO_GROUP, payload,{
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
        }})
        this.log.debug(`<<<<<<<<<< Received response:\n`, data)
        return data
    }

    async delFromGroup(uid: number[]) {
        this.addToGroup(uid, [0])
    }

    async getDynamicList() {
        return await this.get(GET_DYNAMIC_LIST) as BiliResp<Pagination<DynamicItem>>
    }

    async getTimeNow() {
        return await this.get(GET_TIME_NOW)
    }

    async getUserSpaceDynamic(mid: string) {
        return await this.get(`${GET_USER_SPACE_DYNAMIC_LIST}${mid}`)
    }

    // Check if Token need refresh
    async getCookieInfo(refreshToken: string) {
        return await this.get(`${GET_COOKIES_INFO}?csrf=${refreshToken}`)
    }

    async getUserInfo(mid: number) {
        //如果为番剧出差的UID，则不从远程接口拉取数据，直接传回一段精简过的有效数据
        if (mid === 11783021) {
            this.log.debug("检测到番剧出差UID，跳过远程用户接口访问")
            return bangumiTripData
        }
        const wbi = await this.ctx.wbi.getWbi({ mid })
        return await this.get(`${GET_USER_INFO}?${wbi}`)
    }

    async getMyselfInfo() {
        return await this.get(GET_MYSELF_INFO)
    }

    async getLoginQRCode() {
        return await this.get(GET_LOGIN_QRCODE)
    }

    async getLoginStatus(qrcodeKey: string) {
        return await this.get(`${GET_LOGIN_STATUS}?qrcode_key=${qrcodeKey}`)
    }

    async getLiveRoomInfo(roomId: string) {
        return await this.get(`${GET_LIVE_ROOM_INFO}?room_id=${roomId}`)
    }

    async getMasterInfo(mid: number) {
        return await this.get(`${GET_MASTER_INFO}?uid=${mid}`)
    }

    disposeNotifier() { this.loginNotifier && this.loginNotifier.dispose() }

    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        ];

        const index = Math.floor(Math.random() * userAgents.length);
        return userAgents[index];
    }

    createNewClient() {
        this.jar = new CookieJar()
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':
                    this.apiConfig.userAgent !== 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' ?
                    this.apiConfig.userAgent : this.getRandomUserAgent(),
                'Origin': 'https://www.bilibili.com',
                'Referer': 'https://www.bilibili.com/'
            }
        }))
    }

    getTimeOfUTC8() {
        return Math.floor(DateTime.now().setZone('UTC+8').toSeconds())
    }

    getCookies() {
        let cookies: string
        cookies = JSON.stringify(this.jar.serializeSync().cookies)
        return cookies
    }

    getLoginInfoIsLoaded() {
        return this.loginInfoIsLoaded
    }

    async getLoginInfoFromDB() {
        // 读取数据库获取cookies
        const data = (await this.ctx.database.get('loginBili', 1))[0]
        // 判断是否登录
        if (data === undefined) {  // 没有数据则直接返回
            // 未登录，在控制台提示
            this.loginNotifier = this.ctx.notifier.create({
                type: 'warning',
                content: '您尚未登录，将无法使用插件提供的指令'
            })
            // 返回空值
            return {
                cookies: null,
                refresh_token: null
            }
        }
        // 定义解密信息
        let decryptedCookies: string
        let decryptedRefreshToken: string
        try {
            // 解密数据
            decryptedCookies = this.ctx.wbi.decrypt(data.bili_cookies)
            // 解密refresh_token
            decryptedRefreshToken = this.ctx.wbi.decrypt(data.bili_refresh_token)
        } catch (e) {
            // 解密失败，删除数据库登录信息
            await this.ctx.database.remove('loginBili', [1])
            // 直接返回
            return
        }
        // 解析从数据库读到的cookies
        const cookies = JSON.parse(decryptedCookies)
        // 返回值
        return {
            cookies,
            refresh_token: decryptedRefreshToken
        }
    }

    async loadCookiesFromDatabase() {
        // Get login info from db
        const { cookies, refresh_token } = await this.getLoginInfoFromDB()
        // 判断是否有值
        if (!cookies || !refresh_token) {
            // Login info is loaded
            this.loginInfoIsLoaded = true
            return
        }
        // 定义CSRF Token
        let csrf: string
        cookies.forEach(cookieData => {
            // 获取key为bili_jct的值
            if (cookieData.key === 'bili_jct') csrf = cookieData.value
            // 创建一个完整的 Cookie 实例
            const cookie = new Cookie({
                key: cookieData.key,
                value: cookieData.value,
                expires: new Date(cookieData.expires),
                domain: cookieData.domain,
                path: cookieData.path,
                secure: cookieData.secure,
                httpOnly: cookieData.httpOnly,
                sameSite: cookieData.sameSite
            });
            this.jar.setCookieSync(cookie, `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`, {});
        })
        // Login info is loaded
        this.loginInfoIsLoaded = true
        // restart plugin check
        this.checkIfTokenNeedRefresh(refresh_token, csrf)
        // enable refresh cookies detect
        this.enableRefreshCookiesDetect()
    }

    enableRefreshCookiesDetect() {
        // 判断之前是否启动检测
        this.refreshCookieTimer && this.refreshCookieTimer()
        // Open scheduled tasks and check if token need refresh
        this.refreshCookieTimer = this.ctx.setInterval(async () => { // 每12小时检测一次
            // 从数据库获取登录信息
            const { cookies, refresh_token } = await this.getLoginInfoFromDB()
            // 判断是否有值
            if (!cookies || !refresh_token) return
            // 获取csrf
            const csrf = cookies.find(cookie => {
                // 判断key是否为bili_jct
                if (cookie.key === 'bili_jct') return true
            }).value
            // 检查是否需要更新
            this.checkIfTokenNeedRefresh(refresh_token, csrf)
        }, 3600000)
    }

    async checkIfTokenNeedRefresh(refreshToken: string, csrf: string, times: number = 3) {
        // 定义方法
        const notifyAndError = (info: string) => {
            // 设置控制台通知
            this.loginNotifier = this.ctx.notifier.create({
                type: 'warning',
                content: info
            })
            // 重置为未登录状态
            this.createNewClient()
            // 关闭定时器
            this.refreshCookieTimer()
            // 抛出错误
            throw new Error(info);
        }
        // 尝试获取Cookieinfo
        try {
            const { data } = await this.getCookieInfo(refreshToken)
            // 不需要刷新，直接返回
            if (!data.refresh) return
        } catch (e) {
            // 发送三次仍网络错误则直接刷新cookie
            if (times >= 1) {
                // 等待3秒再次尝试
                this.ctx.setTimeout(() => {
                    this.checkIfTokenNeedRefresh(refreshToken, csrf, times - 1)
                }, 3000)
            }
            // 如果请求失败，有可能是404，直接刷新cookie
        }
        // 定义Key
        const publicKey = await crypto.subtle.importKey(
            "jwk",
            {
                kty: "RSA",
                n: "y4HdjgJHBlbaBN04VERG4qNBIFHP6a3GozCl75AihQloSWCXC5HDNgyinEnhaQ_4-gaMud_GF50elYXLlCToR9se9Z8z433U3KjM-3Yx7ptKkmQNAMggQwAVKgq3zYAoidNEWuxpkY_mAitTSRLnsJW-NCTa0bqBFF6Wm1MxgfE",
                e: "AQAB",
            },
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"],
        )
        // 定义获取CorrespondPath方法
        async function getCorrespondPath(timestamp) {
            const data = new TextEncoder().encode(`refresh_${timestamp}`);
            const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data))
            return encrypted.reduce((str, c) => str + c.toString(16).padStart(2, "0"), "")
        }
        // 获取CorrespondPath
        const ts = Date.now()
        const correspondPath = await getCorrespondPath(ts)
        // 获取refresh_csrf
        const refreshCsrfHtml = await this.get(`https://www.bilibili.com/correspond/1/${correspondPath}`)
        // 创建一个虚拟的DOM元素
        const { document } = new JSDOM(refreshCsrfHtml).window;
        // 提取标签name为1-name的内容
        const targetElement = document.getElementById('1-name');
        const refresh_csrf = targetElement ? targetElement.textContent : null;
        // 发送刷新请求
        this.log.debug(`>>>>>>>>>> Sending POST to: https://passport.bilibili.com/x/passport-login/web/cookie/refresh`)
        const { data: refreshData } = await this.client.post(
            'https://passport.bilibili.com/x/passport-login/web/cookie/refresh',
            {
                csrf,
                refresh_csrf,
                source: 'main_web',
                refresh_token: refreshToken
            },
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            }
        )
        this.log.debug(`>>>>>>>>>> Received data: \n`, refreshData)
        // 检查是否有其他问题
        switch (refreshData.code) {
            // 账号未登录
            case -101: return this.createNewClient();
            case -111: {
                await this.ctx.database.remove('loginBili', [1])
                notifyAndError('csrf 校验错误，请重新登录')
            }
            case 86095: {
                await this.ctx.database.remove('loginBili', [1])
                notifyAndError('refresh_csrf 错误或 refresh_token 与 cookie 不匹配，请重新登录')
            }
        }
        // 更新 新的cookies和refresh_token
        const encryptedCookies = this.ctx.wbi.encrypt(this.getCookies())
        const encryptedRefreshToken = this.ctx.wbi.encrypt(refreshData.data.refresh_token)
        await this.ctx.database.upsert('loginBili', [{
            id: 1,
            bili_cookies: encryptedCookies,
            bili_refresh_token: encryptedRefreshToken
        }])
        // Get new csrf from cookies
        let newCsrf: string = this.jar.serializeSync().cookies.find(cookie => {
            if (cookie.key === 'bili_jct') return true
        }).value
        // Accept update
        this.log.debug(`>>>>>>>>>> Sending POST to: https://passport.bilibili.com/x/passport-login/web/confirm/refresh`)
        const { data: aceeptData } = await this.client.post(
            'https://passport.bilibili.com/x/passport-login/web/confirm/refresh',
            {
                csrf: newCsrf,
                refresh_token: refreshToken
            }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        this.log.debug(`>>>>>>>>>> Received data: \n`, aceeptData)
        // 检查是否有其他问题
        switch (aceeptData.code) {
            case -111: {
                await this.ctx.database.remove('loginBili', [1])
                notifyAndError('csrf 校验失败，请重新登录')
            }
            case -400: throw new Error('请求错误')
        }
        // 没有问题，cookies已更新完成
    }
}

namespace BiliAPI {
    export interface Config {
        userAgent: string
    }

    export const Config: Schema<Config> = Schema.object({
        userAgent: Schema.string()
            .default('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36')
            .description('设置请求头User-Agen，请求出现-352时可以尝试修改'),
    })
}

export default BiliAPI