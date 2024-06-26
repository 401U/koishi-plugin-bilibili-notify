import { $, Bot, Context, Logger, Schema, h } from "koishi"
import { Notifier } from "@koishijs/plugin-notifier";
import { } from '@koishijs/plugin-help'
// 导入qrcode
import QRCode from 'qrcode'
import {} from 'koishi-plugin-cron'

declare module 'koishi' {
    interface Context {
        broadcast?: (channel: string[], content: h.Fragment) => Promise<string[]>;
    }
}

class BiliCmd {
    static inject = ['biliApi', 'wbi', 'database', 'biliDaemon', 'cron', 'biliRender'];
    log: Logger;
    conf: BiliCmd.Config
    loginTimer: Function
    subNotifier: Notifier
    /**
     * 关注分组
     */
    followGroup: number

    constructor(ctx: Context, config: BiliCmd.Config) {
        this.log = ctx.logger('BiliCmd')
        this.conf = config
        // 从数据库获取订阅
        this.checkIfLoginInfoIsLoaded(ctx).then(() => {
            // 初始化关注分组信息
            this.setupFollowGroup(ctx)
        })

        this.log.debug('数据库与分组加载完毕')
        this.initBiliCmd(ctx)
        this.log.debug('bili指令加载完毕')
        if(this.conf.commandDebug) this.registerDebugCommand(ctx)
        ctx.cron(this.conf.dynamicCheckCron, () => {
            this.log.debug('动态监测开始')
            this.checkDynamic(ctx)
        })
        ctx.cron(this.conf.liveCheckCron, () => {
            this.log.debug('直播监测开始')
            this.checkLive(ctx)
        })
        this.log.debug('cron任务加载完毕')
        this.log.info('已加载')
    }

    /**
     * 检查动态并推送
     * @param ctx 上下文
     */
    private async checkDynamic(ctx: Context) {
        try{
            const startTime = new Date()
            let prevStart = await ctx.database.select('bili_check', {checkType: 'dynamic'}).execute(row=>$.max(row.startTime))
            let prevMaxTime = await ctx.database.select('bili_check', {checkType: 'dynamic'}).execute(row=>$.max(row.maxTime))
            if(!prevStart) prevStart = startTime
            if(!prevMaxTime) prevMaxTime = startTime
            const {id: checkId} = await ctx.database.create('bili_check', {
                startTime,
                checkType: 'dynamic'
            })
            const resp = await ctx.biliApi.getDynamicList()
            const num_total = resp.data.items.length
            const itemsNew = resp.data.items.filter(
                item=>item.modules.module_author.pub_ts > Math.floor(prevStart.getTime()/1000)
                && item.modules.module_author.pub_ts > Math.floor(prevMaxTime.getTime()/1000)
            )
            let currMaxTime = resp.data.items.map(item=>item.modules.module_author.pub_ts).reduce((a, b)=>Math.max(a, b), 0)
            if(currMaxTime === 0) currMaxTime = Math.floor(startTime.getTime()/1000)
            await ctx.database.set('bili_check', {id: checkId}, {maxTime: new Date(currMaxTime*1000)})
            const num_new = itemsNew.length

            const mids = [...new Set(itemsNew.map(item=>item.modules.module_author.mid))]
            let followedUids = (await ctx.database.get('bili_user', {
                uid: {
                    $in: mids
                }
            })).map(row=>row.uid)
            followedUids = [...new Set(followedUids)]
            const followedDynamics = itemsNew.filter(item=>followedUids.includes(item.modules.module_author.mid))
            const num_followed = followedDynamics.length
            let num_sent = 0
            followedUids.forEach(async uid => {
                const targets = (await ctx.database.get('bili_sub', {uid, dynamic: {$eq:1}})).map(row=>row.channel)
                if(targets.length===0) return
                // 为每个动态生成消息
                const msgs = itemsNew.filter(item=>item.modules.module_author.mid === uid).map(async item => 
                    // 生成消息
                    await ctx.biliRender.renderDynamic(item)
                ).forEach(async msg => {
                    await this.broadcast(ctx, targets, await msg)
                    num_sent++
                })
            })

            this.log.debug(`动态总数：${num_total} 新动态数：${num_new} 关注用户动态数：${num_followed} 发送动态数：${num_sent}`)
            await ctx.database.set('bili_check', {
                id: checkId
            }, {
                num_total, num_followed, num_sent, num_filtered: num_new
            })
        } catch(e){
            this.log.error(e)
        }
    }

    /**
     * 检查直播并推送
     * @param ctx 上下文
     */
    private async checkLive(ctx: Context) {
        try{
            const startTime = new Date()
            let prevStart = await ctx.database.select('bili_check', {checkType: 'live'}).execute(row=>$.max(row.startTime))
            if(!prevStart) prevStart = startTime
            let prevMaxTime = await ctx.database.select('bili_check', {checkType: 'live'}).execute(row=>$.max(row.maxTime))
            if(!prevMaxTime) prevMaxTime = startTime
            const {id: checkId} = await ctx.database.create('bili_check', {
                startTime,
                checkType: 'live'
            })
            let followedUids = (await ctx.database.get('bili_sub', {
                live: {
                    $eq: 1
                }
            })).map(row=>row.uid)
            followedUids = [...new Set(followedUids)] // 去重
            // 将这些uid每10个一组聚合
            const uidGroups: number[][] = []
            for(let i=0;i<followedUids.length;i+=10){
                uidGroups.push(followedUids.slice(i, i+10))
            }

            let maxTime = 0
            uidGroups.forEach(async uidGroup => {
                const resp = await ctx.biliApi.checkLivesByUids(uidGroup)
                const liveInfos: LiveRoomInfo[] = []
                Object.keys(resp.data).forEach(key => {
                    const value = resp.data[key]
                    liveInfos.push(value)
                })
                const currMaxTime = liveInfos.map(item=>item.live_time).reduce((a, b)=>Math.max(a, b), 0)
                if(currMaxTime > maxTime) {
                    maxTime = currMaxTime
                    await ctx.database.set('bili_check', {id: checkId}, {maxTime: new Date(maxTime*1000)})
                }
                liveInfos
                    .filter(item=>item.live_status === 1)
                    .map(item => {
                        this.log.debug(`检测到进行中直播${item.title}@${item.room_id}, 直播开始：${new Date(item.live_time*1000)}`)
                        return item
                    })
                    .filter(item =>{
                        // 过滤直播开始时间早于前一次检查 和 直播开始时间早于前一次推送的最大时间
                        return item.live_time > Math.floor(prevStart.getTime()/1000)
                            && item.live_time > Math.floor(prevMaxTime.getTime()/1000)
                    })
                    .forEach(async item => {
                        this.log.debug(`应推送直播${item.title}@${item.room_id}`)
                        const msg = await ctx.biliRender.renderLive(item)
                        // 查询该roomid对应的订阅channel
                        const targets = (await ctx.database.get('bili_sub', {uid: item.uid, live: {$eq:1}})).map(row=>row.channel)
                        if(targets.length===0) return
                        await this.broadcast(ctx, targets, msg)
                    })
            })
        } catch(e){
            this.log.error(e)
        }
    }

    private async initBiliCmd(ctx: Context) {
        const biliCom = ctx.command('bili', 'bili-notify插件相关指令', { permissions: ['authority:3'] })
        
        biliCom.subcommand('.login', '使用二维码登录B站', { permissions: ['authority:4'] } )
            .alias('.auth')
            .action(async ({ session }) => {
                // 获取二维码
                let content: any
                try {
                    content = await ctx.biliApi.getLoginQRCode()
                } catch (e) {
                    return 'bili login getLoginQRCode() 本次网络请求失败'
                }
                // 判断是否出问题
                if (content.code !== 0) return await session.send('登录出现问题，请联系管理员解决')
                // 生成二维码
                QRCode.toBuffer(content.data.url,
                    {
                        errorCorrectionLevel: 'H',  // 错误更正水平
                        type: 'png',                // 输出类型
                        margin: 1,                  // 边距大小
                        color: {
                            dark: '#000000',        // 二维码颜色
                            light: '#FFFFFF'        // 背景颜色
                        }
                    }, async (err, buffer) => {
                        if (err) return await session.send('二维码生成出错，请重新尝试')
                        await session.send(h.image(buffer, 'image/png'))
                    })
                // 检查之前是否存在登录定时器
                this.loginTimer && this.loginTimer()
                // 设置flag
                let flag = true
                // 发起登录请求检查登录状态
                this.loginTimer = ctx.setInterval(async () => {
                    try {
                        // 判断上一个循环是否完成
                        if (!flag) return
                        flag = false
                        // 获取登录信息
                        let loginContent: any
                        try {
                            loginContent = await ctx.biliApi.getLoginStatus(content.data.qrcode_key)
                        } catch (e) {
                            this.log.error(e)
                            return
                        }
                        if (loginContent.code !== 0) {
                            this.loginTimer()
                            return await session.send('登录失败请重试')
                        }
                        if (loginContent.data.code === 86038) {
                            this.loginTimer()
                            return await session.send('二维码已失效，请重新登录')
                        }
                        if (loginContent.data.code === 0) { // 登录成功
                            const encryptedCookies = ctx.wbi.encrypt(ctx.biliApi.getCookies())
                            const encryptedRefreshToken = ctx.wbi.encrypt(loginContent.data.refresh_token)
                            await ctx.database.upsert('loginBili', [{
                                id: 1,
                                bili_cookies: encryptedCookies,
                                bili_refresh_token: encryptedRefreshToken
                            }])
                            // 销毁定时器
                            this.loginTimer()
                            // 清除控制台通知
                            ctx.biliApi.disposeNotifier()
                            // 发送成功登录推送
                            await session.send('登录成功')
                            // 开启cookies刷新检测
                            ctx.biliApi.enableRefreshCookiesDetect()
                            // 重置关注分组
                            await this.setupFollowGroup(ctx)
                            return
                        }
                    } finally {
                        flag = true
                    }
                }, 1000)
            })

        biliCom.subcommand('.unsub <uid:number>', '取消订阅UP主')
            .alias('.del', '.delete', '.rm', '.remove', '.unsubscribe')
            .usage('取消订阅，不指定类型时将取消全部订阅')
            .option('live', '-l 取消直播订阅')
            .option('dynamic', '-d 取消动态订阅')
            .option('target', '-t <target:string> 需要取消订阅的频道, 多个频道用英文逗号分隔，不指定则仅限当前频道', {permissions: ['authority:4']})
            .action(async ({ session, options }, uid) => {
                const noSpec = options.live === undefined && options.dynamic === undefined
                const unsubLive = noSpec ? true : options.live===true // 是否应该取消订阅直播
                const unsubDynamic = noSpec ? true : options.dynamic===true // 是否应该取消订阅动态

                // 查数据库获取当前订阅状态
                const currChannel = `${session.event.platform}:${session.event.channel.id}`
                const channels: string[] = []
                if(options.target){
                    if(options.target.length === 0) return '指定取消订阅的频道无效'
                    options.target.split(',').filter(item=>item.length>0).forEach(item => {
                        channels.push(item)
                    })
                }
                if(channels.length === 0) channels.push(currChannel)
                
                const unsubState = []
                if(unsubLive) unsubState.push('直播')
                if(unsubDynamic) unsubState.push('动态')
                const unsubText = '已取消订阅'+unsubState.join('和')+'通知'
                channels.map(async channel => {
                    const prefix = (currChannel === channel ? '当前频道' : '频道' + channel)
                    const subInfo = await ctx.database.get('bili_sub', { uid, channel })
                    if (subInfo.length === 0) return prefix+'未订阅该UP主'
                    const subdata = subInfo[0]
                    subdata.live = (subdata.live && !unsubLive) ? 1 : 0
                    subdata.dynamic = (subdata.dynamic && !unsubDynamic) ? 1 : 0
                    if (!subdata.live && !subdata.dynamic) { // 如果两者均未订阅，删除数据库中的该条信息
                        ctx.database.remove('bili_sub', {
                            uid,
                            channel
                        })
                    } else {
                        await ctx.database.set('bili_sub', {
                            uid, channel
                        }, {
                            live: subdata.live,
                            dynamic: subdata.dynamic,
                            time: new Date()
                        })
                    }
                    return prefix + unsubText
                }).forEach(async text => await session.send(await text))
                await this.checkUnsubUser(ctx, uid) // 同时检查该用户是否也应从订阅表中删除
            })

        biliCom.subcommand('.list', '列出订阅目标')
            .option('target', '-t <target:string> 需要列出订阅的频道, 不指定则为当前频道', {permissions: ['authority:4']})
            .alias('.ls')
            .action(async ({ session, options }) => {
                const channel = options.target || `${session.event.platform}:${session.event.channel.id}`
                let reply = options.target? '频道'+channel : '当前频道'
                ctx.database.join(['bili_sub', 'bili_user'], (bili_sub, bili_user) => 
                     $.and(
                        $.eq(bili_sub.uid, bili_user.uid),
                        $.eq(bili_sub.channel, channel)
                    )
                ).execute().then(async data => {
                    if (data.length === 0) reply += '还没有订阅哦'
                    else reply += `共有${data.length}个订阅：\n` + data.map(item => 
                        `- ${item.bili_user.uname}@${item.bili_user.uid} ${item.bili_sub.live ? '直播' : ''} ${item.bili_sub.dynamic ? '动态' : ''}`
                    ).join('\n')
                    await session.send(reply)
                }).catch(err => {
                    this.log.error(err)
                })
            })

        biliCom
            .subcommand('.sub <uid:number>', '订阅B站用户')
            .alias('.add', '.subscribe')
            .usage('不指定类型时，将订阅全部通知\n在目标频道已有订阅时，再次订阅将覆盖原有设置')
            .option('live', '-l 订阅直播通知')
            .option('dynamic', '-d 订阅动态通知')
            .option('target', '-t <target:string> 订阅到的目标频道，多个频道需用英文逗号隔开，不指定则默认为当前频道', { permissions: ['authority:4'] })
            .action(async ({ session, options }, uid) => {
                if(options.dynamic===false && options.live===false) {
                    return '请至少启用一个订阅类型; 取消订阅请参考bili.unsub指令'
                }
                const noSpec = options.live ===undefined && options.dynamic === undefined
                const subLive = noSpec ? true : options.live===true // 是否应该订阅直播
                const subDynamic = noSpec ? true : options.dynamic===true // 是否应该订阅动态

                const targets = (options.target ? options.target : '').split(',').filter(item=>item.length>0)
                // 检查是否登录
                if (!(await this.checkIfIsLogin(ctx))) {
                    // 未登录直接返回
                    return '请使用指令bili login登录后再进行订阅操作'
                }
                // 检查必选参数是否有值
                if (!uid) return '请输入用户uid'
                // 获取用户信息
                let content: any
                try {
                    content = await ctx.biliApi.getUserInfo(uid)
                } catch (e) {
                    return '未能获取用户信息：' + e.message
                }
                // 判断是否有其他问题
                if (content.code !== 0) {
                    let msg: string
                    switch (content.code) {
                        case -400: msg = '请求错误'; break;
                        case -403: msg = '访问权限不足，请尝试重新登录'; break;
                        case -404: msg = '用户不存在'; break;
                        case -352: msg = '请登录后再尝试订阅'; break;
                        default: msg = '未知错误，错误信息：' + content.message; break;
                    }
                    return msg
                }
                let currPlatform = session.platform


                // 为未填写platform的部分填充当前平台的platform
                let targetChannels = targets.map(guildStr => {
                    if(!guildStr.includes(':')){
                        return `${currPlatform}:${guildStr}`
                    } else {
                        return guildStr
                    }
                })
                if (targetChannels.length === 0) {
                    targetChannels = [`${currPlatform}:${session.channelId}`]
                }
                // 获取data
                const { data } = content
                // 将该用户移动到关注分组
                ctx.biliApi.checkFollow(uid).then(async (data) => {
                    const followed = [2,6].includes(data.data.attribute)
                    if (!followed) {
                        await ctx.biliApi.followUser(uid)
                    }
                    await ctx.biliApi.cpToGroup([uid], [this.followGroup])
                })
                // 获取直播房间号
                const roomId = data.live_room?.roomid.toString()
                // 保存到数据库中
                await ctx.database.upsert('bili_user', [{
                    uid: uid,
                    room_id: roomId,
                }], 'uid')
                const subRows = targetChannels.map((channel: string) => {return {
                    uid: uid,
                    channel,
                    live: subLive ? 1 : 0,
                    dynamic: subDynamic ? 1 : 0,
                    time: new Date(),
                }})
                await ctx.database.upsert('bili_sub', subRows, ['uid', 'channel'])
                // 获取用户信息
                let userData: any
                try {
                    const { data } = await ctx.biliApi.getMasterInfo(uid)
                    userData = data
                } catch (e) {
                    this.log.error('bili sub指令 getMasterInfo() 发生了错误，错误为：' + e.message)
                    return '订阅出错啦，请重试'
                }
                await ctx.database.set('bili_user', {
                    uid: uid
                }, {
                    uname: userData.info.uname
                })
                // 需要订阅直播
                let subType = []
                if (subLive) {
                    subType.push('直播')
                }
                // 需要订阅动态
                if (subDynamic) {
                    subType.push('动态')
                }
                await session.send(`订阅了${userData.info.uname} ${subType.join('和')}通知`)
            })
        biliCom.subcommand('.notify', '确认当前频道是否支持通知')
            .action(async ({session}) => {
                const channel = `${session.platform}:${session.channelId}`
                await session.send(`当前频道：${channel}`)
                const missed = await this.broadcast(ctx, [channel], '这是通知消息')
                await session.send(`当前频道${missed.length>0 ? '' : '不'}支持发送通知`)
            })
    }

    /**
     * 初始化关注分组：获取对应名称关注分组的id；若无，则创建关注分组
     * @param ctx 上下文
     */
    private async setupFollowGroup(ctx: Context) {
        try {
            let gname = this.conf.followGroup
            if (gname.length === 0) return
            let egroup = (await ctx.biliApi.getFollowGroups()).data.find(group => 
                group.name === gname
            )
            if(egroup){
                this.followGroup = egroup.tagid
            } else {
                this.log.error('未找到关注分组：' + gname)
                const resp = await ctx.biliApi.createFollowGroup(gname)
                if (resp.code === 0) {
                    this.followGroup = resp.data.tagid
                } else {
                    this.log.error('创建关注分组失败，错误为：' + resp.message)
                }
            }
        } catch (e) {
            this.log.error(e.message)
        } finally {
            this.log.debug('初始化关注分组id为' + this.followGroup)
        }
    }

    private async checkUnsubUser(ctx: Context, uid: number) {
        // 检查该用户是否仍被订阅
        let subNum = await ctx.database.select('bili_sub', {uid})
            .execute(row => $.count(row.channel))
        if(subNum===0){
            await ctx.database.remove('bili_user', { uid })
            if(this.conf.followGroup.length > 0)
                await ctx.biliApi.delFromGroup([uid])
        }
    }

    private registerDebugCommand(ctx: Context) {
        
        const testCom = ctx.command('btest', { hidden: true })

        testCom.subcommand('.cookies', '从数据库读取cookies')
            .action(async () => {
                console.log(JSON.parse(ctx.biliApi.getCookies()));
            })

        testCom.subcommand('.mvg <uid:number>', '将该用户移动到配置好的关注分组中')
            .action(async ({}, uid) => {
                const resp = await ctx.biliApi.cpToGroup([uid], [this.followGroup])
                return JSON.stringify(resp)
            })
        testCom.subcommand('.delg <uid:number>')
            .action(async ({}, uid) => {
                const resp = await ctx.biliApi.delFromGroup([uid])
                return JSON.stringify(resp)
            })
        
        testCom.subcommand('.checkSub <uid:number>', '检查该用户订阅状态')
            .action(async ({}, uid) => {
                const resp = await ctx.biliApi.checkFollow(uid)
                switch(resp.data.attribute){
                    case 0: return '未订阅'
                    case 2: return '已订阅'
                    case 6: return '已互粉'
                    case 128: return '被拉黑'
                    default: return '未知'
                }
            })
        
        testCom.subcommand('.sub <uid:number>', '直接关注B站用户')
            .action(async ({}, uid) => {
                const resp = await ctx.biliApi.followUser(uid)
                return JSON.stringify(resp)
            })

        testCom.subcommand('.unsub <uid:number>', '取消关注B站用户')
            .action(async ({session}, uid) => {
                const resp = await ctx.biliApi.unfollowUser(uid)
                return JSON.stringify(resp)
            })
        testCom.subcommand('.followGroups', '获取关注分组列表')
            .action(async () => {
                const resp = await ctx.biliApi.getFollowGroups()
                return resp.data.map(g=>`${g.tagid}：${g.name}`).join('\n')
            })

        testCom
            .subcommand('.my', '获取自己B站信息')
            .action(async () => {
                const content = await ctx.biliApi.getMyselfInfo()
                return JSON.stringify(content)
            })

        testCom
            .subcommand('.user <uid:number>', '获取用户B站信息')
            .action(async (_, uid) => {
                const content = await ctx.biliApi.getUserInfo(uid)
                return JSON.stringify(content)
            })

        testCom.subcommand('.live <uid:number>', '获取用户直播信息')
            .action(async ({}, uid) => {
                const content = await ctx.biliApi.checkLivesByUids([uid])
                return await ctx.biliRender.renderLive(content.data[uid])
            })

        testCom
            .subcommand('.space <uid:string> <index:number>', '获取特定B站用户空间动态的特定条目')
            .action(async ({ session }, uid, index) => {
                // 获取用户空间动态数据
                const { data } = await ctx.biliApi.getUserSpaceDynamic(uid)
                this.log.info('获取到动态数据\n' + JSON.stringify(data.items[index], null, '  '))
                // 获取动态推送图片
                const msg = await ctx.biliRender.renderDynamic(data.items[index])
                await session.send(msg)
            })
        
        testCom.subcommand('.detail <did:string>', '获取指定动态的信息')
            .action(async ({ session }, did) => {
                const { data } = await ctx.biliApi.getDynamicDetail(did)
                await session.send("动态类型：" + data.item.type)
                this.log.info("获取到动态数据\n" + JSON.stringify(data.item, null, '  '))
                const msg = await ctx.biliRender.renderDynamic(data.item)
                await session.send(msg)
            })

        testCom.subcommand('.subs', '获取动态页面最新一页')
            .action(async ({ session }) => {
                const { data } = await ctx.biliApi.getDynamicList()
                data.items.forEach(async (item, index) => {
                    try {
                        const msg = await ctx.biliRender.renderDynamic(item)
                        await session.send(msg)
                    } catch (e) {
                        console.log('无法处理第' + index + '个动态:', item, e)
                    }
                })
            })

        testCom
            .subcommand('.send <content:string>', '向主人账号发送消息')
            .usage('测试发送消息方法')
            .example('test sendmsg')
            .action(async ({ session }, content) => {
                // 获得对应bot
                this.sendToMaster(ctx, content)
            })
    }

    private async broadcast(ctx: Context, channel: string[], content: h.Fragment) {
        if (ctx.broadcast){
            return await ctx.broadcast(channel, content)
        } else if(ctx.database.broadcast){
            return await ctx.database.broadcast(channel, content)
        } else {
            this.log.error('无法发送广播')
            return channel
        }
    }

    private async sendToMaster(ctx: Context, content: h.Fragment){
        let master = this.conf.master
                if (master.enable && master.masterAccount.trim() !== '') {
                    await this.broadcast(ctx, [master.masterAccount], content)
                }
    }

    async sendPrivateMsgAndRebootService(ctx: Context, bot: Bot<Context>, content: string) {
        await this.sendToMaster(ctx, content)
        // 重启插件
        const flag = await ctx.biliDaemon.restartPlugin(true /* 非人为重启，需要计数 */)
        // 判断是否重启成功
        if (flag) {
            this.log.info('重启插件成功')
        } else {
            // logger
            this.log.error('已重启插件三次，请检查机器人状态后手动重启')
            // 重启失败，发送消息
            await this.sendToMaster(ctx, '已重启插件三次，请检查机器人状态后手动重启')
            // 关闭插件
            await ctx.biliDaemon.disposePlugin()
        }
    }

    async checkIfLoginInfoIsLoaded(ctx: Context) {
        return new Promise(resolve => {
            const check = () => {
                if (!ctx.biliApi.getLoginInfoIsLoaded()) {
                    ctx.setTimeout(check, 500)
                } else {
                    resolve('success')
                }
            }
            check()
        })
    }

    async checkIfIsLogin(ctx: Context) {
        if ((await ctx.database.get('loginBili', 1)).length !== 0) { // 数据库中有数据
            // 检查cookie中是否有值
            if (ctx.biliApi.getCookies() !== '[]') { // 有值说明已登录
                return true
            }
        }
        return false
    }
}

namespace BiliCmd {
    export interface Config {
        master: {
            enable: boolean
            masterAccount: string
        },
        liveStartAtAll: boolean,
        liveCheckCron: string,
        followGroup: string,
        customLiveStart: string,
        customLiveEnd: string,
        dynamicUrl: boolean,
        dynamicCheckCron: string,
        filter: {
            enable: boolean,
            notify: boolean
            regex: string,
            keywords: Array<string>,
        },
        dynamicDebugMode: boolean,
        commandDebug: boolean,
        dynamicSection: {},
        liveSection: {},
        debugSection: {},
    }

    export const Config: Schema<Config> = Schema.object({
        
        master: Schema.intersect([
            Schema.object({
                enable: Schema.boolean()
                    .default(false)
                    .description('是否开启主人账号功能，如果您的机器人没有私聊权限请不要开启此功能。开启后如果机器人运行错误会向您进行报告')
                    .experimental()
            }).description('主人账号'),
            Schema.union([
                Schema.object({
                    masterAccount: Schema.string()
                        .role('secret')
                        .default('')
                        .description('主人账号，请使用inspect插件获取，填入格式为 平台:频道'),
                })
            ])
        ]),
        followGroup: Schema.string().description('机器人关注UP后的分组, 为空代表不移动到特定分组').default('Bot关注'),

        dynamicSection: Schema.object({}).description('动态通知设置'),
        dynamicUrl: Schema.boolean()
            .default(false)
            .description('发送动态时是否同时发送链接。注意：如果使用的是QQ官方机器人不能开启此项！'),
        dynamicCheckCron: Schema.string().default('*/2 * * * *').description('动态检查间隔, 使用cron表达式, 可参考 https://cron.qqe2.com 生成')
            .pattern(/(((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7}/),
        filter: Schema.intersect([
            Schema.object({
                enable: Schema.boolean()
                    .default(false)
                    .description('是否开启动态屏蔽功能')
            }).description('屏蔽设置'),
            Schema.object({
                notify: Schema.boolean()
                    .default(false)
                    .description('动态被屏蔽是否发送提示'),
                regex: Schema.string()
                    .description('正则表达式屏蔽'),
                keywords: Schema.array(String)
                    .description('关键字屏蔽，一个关键字为一项'),
                forward: Schema.boolean()
                    .default(false)
                    .description("是否屏蔽转发动态"),
            }),
        ]),

        liveSection: Schema.object({}).description('直播通知设置'),
        liveCheckCron: Schema.string().default('*/2 * * * *').description('直播检查间隔, 使用cron表达式, 可参考 https://cron.qqe2.com 生成')
            .pattern(/(((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7}/),
        liveStartAtAll: Schema.boolean()
            .default(false)
            .description('直播开始时艾特全体成员，默认关闭'),
        customLiveStart: Schema.string()
            .default('-name开播啦 -link')
            .description('自定义开播提示语，-name代表UP昵称，-link代表直播间链接（如果使用的是QQ官方机器人，请不要使用）。例如-name开播啦，会发送为xxxUP开播啦'),
        
        customLiveEnd: Schema.string()
            .default('-name下播啦，本次直播了-time')
            .description('自定义下播提示语，-name代表UP昵称，-time代表开播时长。例如-name下播啦，本次直播了-time，会发送为xxxUP下播啦，直播时长为xx小时xx分钟xx秒'),

        debugSection: Schema.object({}).description('调试设置'),
        dynamicDebugMode: Schema.boolean()
            .default(false)
            .description('动态调试模式，开启后会在控制台输出动态推送的详细信息')
            .experimental(),
        commandDebug: Schema.boolean().default(false).description('调试指令开关，开启后将添加系列调试命令').experimental(),
    })
}

export default BiliCmd