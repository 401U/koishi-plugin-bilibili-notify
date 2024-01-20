import { Context, Service } from "koishi"
import axios from 'axios'
import { CookieJar, Cookie } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import { JSDOM } from 'jsdom'
import { Notifier } from "@koishijs/plugin-notifier"

declare module 'koishi' {
    interface Context {
        biliAPI: BiliAPI
    }
}

// const GET_DYNAMIC_LIST = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all'
const GET_USER_SPACE_DYNAMIC_LIST = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space'
const GET_COOKIES_INFO = 'https://passport.bilibili.com/x/passport-login/web/cookie/info'
const GET_USER_INFO = 'https://api.bilibili.com/x/space/wbi/acc/info'
const GET_MYSELF_INFO = 'https://api.bilibili.com/x/member/web/account'
const GET_LOGIN_QRCODE = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
const GET_LOGIN_STATUS = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll'
const GET_LIVE_ROOM_INFO = 'https://api.live.bilibili.com/room/v1/Room/get_info'
const GET_MASTER_INFO = 'https://api.live.bilibili.com/live_user/v1/Master/info'
const GET_TIME_NOW = 'https://api.bilibili.com/x/report/click/now'
const GET_SERVER_UTC_TIME = 'https://interface.bilibili.com/serverdate.js'

class BiliAPI extends Service {
    static inject = ['database', 'wbi', 'notifier']

    jar: CookieJar
    client: any
    loginData: any
    loginNotifier: Notifier

    constructor(ctx: Context) {
        super(ctx, 'biliAPI')
    }

    protected start(): void | Promise<void> {
        /* this.client = this.ctx.http.extend({
            endpoint: 'https://api.live.bilibili.com',
        }) */

        this.createNewClient()
        this.loadCookiesFromDatabase()

        this.logger.info('BiliAPI已被注册到Context中')
    }

    async getServerUTCTime() {
        try {
            const { data } = await this.client.get(GET_SERVER_UTC_TIME);
            const regex = /Date\.UTC\((.*?)\)/;
            const match = data.match(regex);
            if (match) {
                const timestamp = new Function(`return Date.UTC(${match[1]})`)();
                return timestamp / 1000;
            } else {
                throw new Error('Failed to parse server time');
            }
        } catch (e) {
            throw new Error('网络异常，本次请求失败！');
        }
    }

    async getTimeNow() {
        try {
            const { data } = await this.client.get(GET_TIME_NOW)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getUserSpaceDynamic(mid: string) {
        try {
            const { data } = await this.client.get(`${GET_USER_SPACE_DYNAMIC_LIST}?host_mid=${mid}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    // Check if Token need refresh
    async getCookieInfo(refreshToken: string) {
        try {
            const { data } = await this.client.get(`${GET_COOKIES_INFO}?csrf=${refreshToken}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getUserInfo(mid: string) {
        try {
            const wbi = await this.ctx.wbi.getWbi({ mid })
            const { data } = await this.client.get(`${GET_USER_INFO}?${wbi}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getMyselfInfo() {
        try {
            const { data } = await this.client.get(GET_MYSELF_INFO)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getLoginQRCode() {
        try {
            const { data } = await this.client.get(GET_LOGIN_QRCODE)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getLoginStatus(qrcodeKey: string) {
        try {
            const { data } = await this.client.get(`${GET_LOGIN_STATUS}?qrcode_key=${qrcodeKey}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getLiveRoomInfo(roomId: string) {
        try {
            const { data } = await this.client.get(`${GET_LIVE_ROOM_INFO}?room_id=${roomId}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    async getMasterInfo(mid: string) {
        try {
            const { data } = await this.client.get(`${GET_MASTER_INFO}?uid=${mid}`)
            return data
        } catch (e) {
            throw new Error('网络异常，本次请求失败！')
        }
    }

    disposeNotifier() { this.loginNotifier && this.loginNotifier.dispose() }

    createNewClient() {
        this.jar = new CookieJar()
        this.client = wrapper(axios.create({ jar: this.jar, headers: { 'Content-Type': 'application/json' } }))
    }

    getCookies() {
        let cookies: string;
        this.jar.store.getAllCookies((err, c) => {
            if (err) throw err;
            cookies = JSON.stringify(c, null, 2)
        })
        return cookies
    }

    async loadCookiesFromDatabase() {
        // 读取数据库获取cookies
        const data = (await this.ctx.database.get('loginBili', 1))[0]
        // 判断是否登录
        if (data === undefined) {  // 没有数据则直接返回
            // 未登录，在控制台提示
            this.loginNotifier = this.ctx.notifier.create({
                type: 'warning',
                content: '您尚未登录，将无法使用插件提供的指令'
            })
            return
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
        // 定义CSRF Token
        let csrf: string
        cookies.forEach(cookieData => {
            // console.log(cookieData);
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
        // Open scheduled tasks and check if token need refresh
        this.ctx.setInterval(() => { // 每12小时检测一次
            this.checkIfTokenNeedRefresh(decryptedRefreshToken, csrf)
        }, 43200000)
    }

    async checkIfTokenNeedRefresh(refreshToken: string, csrf: string, times: number = 0) {
        let data: any
        try {
            const { data: cookieData } = await this.getCookieInfo(refreshToken)
            data = cookieData
        } catch (e) {
            // 发送三次仍网络错误则给管理员发送错误信息
            if (times > 3) return
            // 等待3秒再次尝试
            this.ctx.setTimeout(() => {
                this.checkIfTokenNeedRefresh(refreshToken, csrf, times + 1)
            }, 3000)
            return
        }

        // 不需要刷新，直接返回
        if (!data.refresh) return

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

        async function getCorrespondPath(timestamp) {
            const data = new TextEncoder().encode(`refresh_${timestamp}`);
            const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data))
            return encrypted.reduce((str, c) => str + c.toString(16).padStart(2, "0"), "")
        }

        const correspondPath = await getCorrespondPath(data.timestamp)
        // 获取refresh_csrf
        const { data: refreshCsrfHtml } = await this.client.get(`https://www.bilibili.com/correspond/1/${correspondPath}`)
        // 创建一个虚拟的DOM元素
        const { document } = new JSDOM(refreshCsrfHtml).window;
        // 提取标签name为1-name的内容
        const targetElement = document.getElementById('1-name');
        const refresh_csrf = targetElement ? targetElement.textContent : null;
        // 发送刷新请求
        const { data: refreshData } = await this.client.post('https://passport.bilibili.com/x/passport-login/web/cookie/refresh', {
            csrf: csrf.trim(),
            refresh_csrf,
            source: 'main_web',
            refresh_token: refreshToken
        })
        const notifyAndError = (info: string) => {
            // 设置控制台通知
            this.loginNotifier = this.ctx.notifier.create({
                type: 'warning',
                content: info
            })
            throw new Error(info);
        }
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
        const encryptedCookies = this.ctx.wbi.encrypt(this.ctx.biliAPI.getCookies())
        const encryptedRefreshToken = this.ctx.wbi.encrypt(refreshData.data.refresh_token)
        await this.ctx.database.upsert('loginBili', [{
            id: 1,
            bili_cookies: encryptedCookies,
            bili_refresh_token: encryptedRefreshToken
        }])
        // Get new csrf from cookies
        let newCsrf: string;
        this.jar.store.getAllCookies((err, c) => {
            if (err) throw err;
            c.forEach(cookie => {
                if (cookie.key === 'bili_jct') newCsrf = cookie.value
            });
        })
        // Accept update
        const { data: aceeptData } = await this.client.post('https://passport.bilibili.com/x/passport-login/web/confirm/refresh', {
            csrf: newCsrf,
            refresh_token: refreshToken
        })
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

/* namespace LiveAPI {
    export interface Config {
        roomId: string
    }

    export const Config: Schema<Config> = Schema.object({
        roomId: Schema.string().required()
    })
} */

export default BiliAPI