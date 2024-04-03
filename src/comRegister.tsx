import { Bot, Context, Logger, Schema, Session, h } from "koishi"
import { Notifier } from "@koishijs/plugin-notifier";
import { } from '@koishijs/plugin-help'
// 导入qrcode
import QRCode from 'qrcode'

enum LiveType {
    NotLiveBroadcast,
    StartBroadcasting,
    LiveBroadcast
}

class ComRegister {
    static inject = ['biliAPI', 'gimg', 'wbi', 'database', 'sm'];
    logger: Logger;
    config: ComRegister.Config
    loginTimer: Function
    num: number = 0
    subNotifier: Notifier
    subManager: {
        id: number,
        uid: string,
        roomId: string,
        targetId: string,
        platform: string,
        live: boolean,
        dynamic: boolean,
        liveDispose: Function,
        dynamicDispose: Function
    }[] = []

    // QQ群机器人
    qqBot: Bot<Context>
    // QQ频道机器人
    qqguildBot: Bot<Context>
    // OneBot机器人
    oneBot: Bot<Context>
    // Red机器人
    redBot: Bot<Context>
    // Telegram机器人
    telegramBot: Bot<Context>
    // Satori机器人
    satoriBot: Bot<Context>
    // Chronocat机器人
    chronocatBot: Bot<Context>

    constructor(ctx: Context, config: ComRegister.Config) {
        this.logger = ctx.logger('commandRegister')
        this.config = config
        // 拿到各类机器人
        ctx.bots.forEach(bot => {
            switch (bot.platform) {
                case 'qq': this.qqBot = bot; break
                case 'qqguild': this.qqguildBot = bot; break
                case 'onebot': this.oneBot = bot; break
                case 'red': this.redBot = bot; break
                case 'telegram': this.telegramBot = bot; break
                case 'satori': this.satoriBot = bot; break
                case 'chronocat': this.chronocatBot = bot; break
            }
        })

        // 从数据库获取订阅
        this.getSubFromDatabase(ctx)

        /* const testCom = ctx.command('test', { hidden: true, permissions: ['authority:5'] })

        testCom.subcommand('.cookies')
            .usage('测试指令，用于测试从数据库读取cookies')
            .action(async () => {
                this.logger.info('调用test cookies指令')
                // await ctx.biliAPI.loadCookiesFromDatabase()
                console.log(JSON.parse(ctx.biliAPI.getCookies()));
            })

        testCom
            .subcommand('.my')
            .usage('测试指令，用于测试获取自己信息')
            .example('test.my')
            .action(async () => {
                const content = await ctx.biliAPI.getMyselfInfo()
                console.log(content);
            })

        testCom
            .subcommand('.user <mid:string>')
            .usage('测试指令，用于测试获取用户信息')
            .example('test.user 用户UID')
            .action(async (_, mid) => {
                const content = await ctx.biliAPI.getUserInfo(mid)
                console.log(content);
            })

        testCom
            .subcommand('.time')
            .usage('测试时间接口')
            .example('test.time')
            .action(async ({ session }) => {
                session.send(await ctx.biliAPI.getTimeNow())
            })

        testCom
            .subcommand('.exist')
            .usage('测试写法')
            .example('test.exist')
            .action(async () => {
                let num = 1;
                console.log(num && `Hello World`);
            })

        testCom
            .subcommand('.gimg <uid:string> <index:number>')
            .usage('测试图片生成')
            .example('test.gimg')
            .action(async ({ session }, uid, index) => {
                // 获取用户空间动态数据
                const { data } = await ctx.biliAPI.getUserSpaceDynamic(uid)
                // 获取动态推送图片
                const { pic, buffer } = await ctx.gimg.generateDynamicImg(data.items[index])
                // 如果pic存在，则直接返回pic
                if (pic) return pic
                // pic不存在，说明使用的是page模式
                await session.send(h.image(buffer, 'image/png'))
            })

        testCom
            .subcommand('.group')
            .usage('查看session groupId')
            .example('test group')
            .action(({ session }) => {
                console.log(session.event.channel);
            })

        testCom
            .subcommand('.session')
            .usage('查看seesion')
            .example('test session')
            .action(({ session }) => {
                console.log(session);
            })

        testCom
            .subcommand('.utc')
            .usage('获取当前UTC+8 Unix时间戳')
            .example('test utc')
            .action(async ({ session }) => {
                session.send((await ctx.biliAPI.getServerUTCTime()).toString())
            })

        testCom
            .subcommand('.livestop', '发送下播提示语测试')
            .usage('发送下播提示语测试')
            .example('test livestop')
            .action(async ({ session }) => {
                const { data } = await ctx.biliAPI.getMasterInfo('194484313')
                console.log(data);
                await session.send(
                    <>
                        <img width="10px" height="10px" src="https://koishi.chat/logo.png" />
                    </>
                )
            })

        testCom
            .subcommand('.sendmsg', '测试发送消息方法')
            .usage('测试发送消息方法')
            .example('test sendmsg')
            .action(async ({ session }) => {
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                this.sendMsg(['all'], bot, 'Hello World')
            }) */

        const biliCom = ctx.command('bili', 'bili-notify插件相关指令', { permissions: ['authority:3'] })

        biliCom.subcommand('.login', '登录B站之后才可以进行之后的操作')
            .usage('使用二维码登录，登录B站之后才可以进行之后的操作')
            .example('bili login')
            .action(async ({ session }) => {
                this.logger.info('调用bili login指令')
                // 获取二维码
                let content: any
                try {
                    content = await ctx.biliAPI.getLoginQRCode()
                } catch (e) {
                    return 'bili login getLoginQRCode() 本次网络请求失败'
                }
                // 判断是否出问题
                if (content.code !== 0) return await session.send('出问题咯，请联系管理员解决')
                // 生成二维码
                QRCode.toBuffer(content.data.url,
                    {
                        errorCorrectionLevel: 'H', // 错误更正水平
                        type: 'png',         // 输出类型
                        margin: 1,                 // 边距大小
                        color: {
                            dark: '#000000',         // 二维码颜色
                            light: '#FFFFFF'         // 背景颜色
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
                            loginContent = await ctx.biliAPI.getLoginStatus(content.data.qrcode_key)
                        } catch (e) {
                            this.logger.error(e)
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
                            const encryptedCookies = ctx.wbi.encrypt(ctx.biliAPI.getCookies())
                            const encryptedRefreshToken = ctx.wbi.encrypt(loginContent.data.refresh_token)
                            await ctx.database.upsert('loginBili', [{
                                id: 1,
                                bili_cookies: encryptedCookies,
                                bili_refresh_token: encryptedRefreshToken
                            }])
                            // 销毁定时器
                            this.loginTimer()
                            // 订阅之前的订阅
                            await this.getSubFromDatabase(ctx)
                            // 清除控制台通知
                            ctx.biliAPI.disposeNotifier()
                            // 发送成功登录推送
                            await session.send('登录成功')
                            // bili show
                            await session.execute('bili show')
                            // 开启cookies刷新检测
                            ctx.biliAPI.enableRefreshCookiesDetect()
                            return
                        }
                    } finally {
                        flag = true
                    }
                }, 1000)
            })

        biliCom
            .subcommand('.unsub <uid:string>', '取消订阅UP主动态、直播或全部')
            .usage('取消订阅，加-l为取消直播订阅，加-d为取消动态订阅，什么都不加则为全部取消')
            .option('live', '-l')
            .option('dynamic', '-d')
            .example('bili unsub 用户UID -ld')
            .action(async ({ session, options }, uid) => {
                this.logger.info('调用bili.unsub指令')
                // 若用户UID为空则直接返回
                if (!uid) return '用户UID不能为空'
                // -d -l两个选项不能同时存在
                if (options.dynamic && options.live) return '需要取消订阅该UP主请直接使用指令bili unsub 用户UID'
                // 定义是否存在
                let exist: boolean
                await Promise.all(this.subManager.map(async (sub, i) => {
                    if (sub.uid === uid) {
                        // 取消单个订阅
                        if (options.live || options.dynamic) {
                            if (options.live) await session.send(this.unsubSingle(ctx, sub.roomId, 0)) /* 0为取消订阅Live */
                            if (options.dynamic) await session.send(this.unsubSingle(ctx, sub.uid, 1)) /* 1为取消订阅Dynamic */
                            // 将存在flag设置为true
                            exist = true
                            return
                        }
                        // 取消全部订阅 执行dispose方法，销毁定时器
                        if (sub.dynamic) this.subManager[i].dynamicDispose()
                        if (sub.live) this.subManager[i].liveDispose()
                        // 从数据库中删除订阅
                        await ctx.database.remove('bilibili', { uid: this.subManager[i].uid })
                        // 将该订阅对象从订阅管理对象中移除
                        this.subManager.splice(i, 1)
                        // id--
                        this.num--
                        // 发送成功通知
                        session.send('已取消订阅该用户')
                        // 更新控制台提示
                        this.updateSubNotifier(ctx)
                        // 将存在flag设置为true
                        exist = true
                    }
                }))
                // 未订阅该用户，无需取消订阅
                !exist && session.send('未订阅该用户，无需取消订阅')
            })

        biliCom
            .subcommand('.show', '展示订阅对象')
            .usage('展示订阅对象')
            .example('bili show')
            .action(() => {
                const subTable = this.subShow()
                return subTable
            })

        biliCom
            .subcommand('.sub <mid:string> [...guildId:string]', '订阅用户动态和直播通知')
            .option('live', '-l')
            .option('dynamic', '-d')
            .usage('订阅用户动态和直播通知，若需要订阅直播请加上-l，需要订阅动态则加上-d。若没有加任何参数，之后会向你单独询问，尖括号中为必选参数，中括号为可选参数，目标群号若不填，则默认为当前群聊')
            .example('bili sub 1194210119 目标QQ群号(实验性) -l -d 订阅UID为1194210119的UP主的动态和直播')
            .action(async ({ session, options }, mid, ...guildId) => {
                this.logger.info('调用bili.sub指令')
                // 检查是否是不支持的平台
                switch (session.event.platform) {
                    case 'red':
                    case 'onebot':
                    case 'telegram':
                    case 'satori':
                    case 'chronocat':
                    case 'qq':
                    case 'qqguild': break
                    default: return '暂不支持该平台'
                }
                // 检查是否登录
                if (!(await this.checkIfIsLogin(ctx))) {
                    // 未登录直接返回
                    return '请使用指令bili login登录后再进行订阅操作'
                }
                // 如果订阅人数超过三个则直接返回
                if (!config.unlockSubLimits && this.num >= 3) return '目前最多只能订阅三个人'
                // 检查必选参数是否有值
                if (!mid) return '请输入用户uid'
                // 判断要订阅的用户是否已经存在于订阅管理对象中
                if (this.subManager && this.subManager.some(sub => sub.uid === mid)) {
                    return '已订阅该用户，请勿重复订阅'
                }
                // 定义是否需要直播通知，动态订阅，视频推送
                let liveMsg: boolean, dynamicMsg: boolean
                // 获取用户信息
                let content: any
                try {
                    content = await ctx.biliAPI.getUserInfo(mid)
                } catch (e) {
                    return 'bili sub getUserInfo() 本次网络请求失败，请重试'
                }
                // 判断是否有其他问题
                if (content.code !== 0) {
                    let msg: string
                    switch (content.code) {
                        case -400: msg = '请求错误'; break;
                        case -403: msg = '访问权限不足，请尝试重新登录'; break;
                        case -404: msg = '用户不存在'; break;
                        case -352: msg = '请登录后再尝试订阅'; break;
                        default: msg = '未知错误，请联系管理员'
                    }
                    return msg
                }
                // 设置目标ID
                let targetId: string
                // 判断是否输入了QQ群号
                if (guildId.length > 0) { // 输入了QQ群号
                    // 定义方法
                    const checkIfGuildHasJoined = async (bot: Bot<Context>): Promise<Array<string>> => {
                        // 获取机器人加入的群组
                        const guildList = await bot.getGuildList()
                        // 定义满足条件的群组数组
                        const targetArr = []
                        // 判断群号是否符合条件
                        for (let guild of guildId) {
                            if (guildList.data.some(cv => cv.id === guild)) { // 机器人加入了该群
                                // 保存到数组
                                targetArr.push(guild)
                                // 继续下一个循环
                                continue
                            }
                            // 不满足条件发送错误提示
                            session.send(`您的机器未加入${guild}，无法对该群进行推送`)
                        }
                        // 返回数组
                        return targetArr
                    }
                    // 定义可用的群组数组
                    let okGuild: Array<string>
                    // 判断是否需要加入的群全部推送
                    if (guildId[0] === 'all') {
                        okGuild.push('all')
                    } else {
                        // 判断是否有群机器人相关Bot
                        switch (session.event.platform) {
                            case 'qq': {
                                okGuild = await checkIfGuildHasJoined(this.qqBot)
                                break
                            }
                            case 'onebot': {
                                okGuild = await checkIfGuildHasJoined(this.oneBot)
                                break
                            }
                            case 'red': {
                                okGuild = await checkIfGuildHasJoined(this.redBot)
                                break
                            }
                            case 'satori': {
                                okGuild = await checkIfGuildHasJoined(this.satoriBot)
                                break
                            }
                            case 'chronocat': {
                                okGuild = await checkIfGuildHasJoined(this.chronocatBot)
                                break
                            }
                            default: {
                                // 发送错误提示并返回
                                session.send('您尚未配置任何QQ群相关机器人，不能对QQ群进行操作')
                                // 直接返回
                                return
                            }
                        }
                    }
                    // 将群号用,进行分割
                    targetId = okGuild.join(' ')
                } else { // 没有输入QQ群号
                    // 为当前群聊环境进行推送
                    targetId = session.event.channel.id
                }
                // 获取data
                const { data } = content
                // 判断是否需要订阅直播
                liveMsg = await this.checkIfNeedSub(options.live, '直播', session, data)
                // 判断是否需要订阅动态
                dynamicMsg = await this.checkIfNeedSub(options.dynamic, '动态', session)
                // 判断是否未订阅任何消息
                if (!liveMsg && !dynamicMsg) {
                    return '您未订阅该UP的任何消息'
                }
                // 获取直播房间号
                let roomId = data.live_room?.roomid.toString()
                // 保存到数据库中
                const sub = await ctx.database.create('bilibili', {
                    uid: mid,
                    room_id: roomId,
                    dynamic: dynamicMsg ? 1 : 0,
                    video: 1,
                    live: liveMsg ? 1 : 0,
                    targetId,
                    platform: session.event.platform,
                    time: new Date()
                })
                // 订阅数+1
                this.num++
                // 开始订阅
                // 保存新订阅对象
                this.subManager.push({
                    id: sub.id,
                    uid: mid,
                    targetId,
                    roomId,
                    platform: session.event.platform,
                    live: liveMsg,
                    dynamic: dynamicMsg,
                    liveDispose: null,
                    dynamicDispose: null
                })
                // 获取用户信息
                let userData: any
                try {
                    const { data } = await ctx.biliAPI.getMasterInfo(sub.uid)
                    userData = data
                } catch (e) {
                    this.logger.error('bili sub指令 getMasterInfo() 网络请求失败，原因：' + e.toString())
                    return '订阅出错啦，请重试'
                }
                // 需要订阅直播
                if (liveMsg) {
                    await session.execute(`bili live ${roomId} ${targetId.split(',').join(' ')}`)
                    // 发送订阅消息通知
                    await session.send(`订阅${userData.info.uname}直播通知`)
                }
                // 需要订阅动态
                if (dynamicMsg) {
                    await session.execute(`bili dynamic ${mid} ${targetId.split(',').join(' ')}`)
                    // 发送订阅消息通知
                    await session.send(`订阅${userData.info.uname}动态通知`)
                }
                // 新增订阅展示到控制台
                this.updateSubNotifier(ctx)
            })

        biliCom
            .subcommand('.dynamic <uid:string> <...guildId:string>', '订阅用户动态推送', { hidden: true })
            .usage('订阅用户动态推送')
            .example('bili dynamic 1194210119 订阅UID为1194210119的动态')
            .action(async ({ session }, uid, ...guildId) => {
                this.logger.info('调用bili.dynamic指令')
                // 如果uid为空则返回
                if (!uid) return `${uid}非法调用 dynamic 指令` // 用户uid不能为空
                if (!guildId) return `${uid}非法调用 dynamic 指令` // 目标群组或频道不能为空
                // 寻找对应订阅管理对象
                const index = this.subManager.findIndex(sub => sub.uid === uid)
                // 不存在则直接返回
                if (index === -1) return '请勿直接调用该指令'
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 开始循环检测
                const dispose = ctx.setInterval(this.dynamicDetect(ctx, bot, uid, guildId), config.dynamicLoopTime * 1000)
                // 将销毁函数保存到订阅管理对象
                this.subManager[index].dynamicDispose = dispose
            })

        biliCom
            .subcommand('.live <roomId:string> <...guildId:string>', '订阅主播开播通知', { hidden: true })
            .usage('订阅主播开播通知')
            .example('bili live 26316137 订阅房间号为26316137的直播间')
            .action(async ({ session }, roomId, ...guildId) => {
                this.logger.info('调用bili.live指令')
                // 如果room_id为空则返回
                if (!roomId) return `${roomId}非法调用 dynamic 指令` // 订阅主播房间号不能为空
                if (!guildId) return `${roomId}非法调用 dynamic 指令` // 目标群组或频道不能为空
                // 要订阅的对象不在订阅管理对象中，直接返回
                const index = this.subManager.findIndex(sub => sub.roomId === roomId)
                if (index === -1) return '请勿直接调用该指令'
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 开始循环检测
                const dispose = ctx.setInterval(this.liveDetect(ctx, bot, roomId, guildId), config.liveLoopTime * 1000)
                // 保存销毁函数
                this.subManager[index].liveDispose = dispose
            })

        biliCom
            .subcommand('.status <roomId:string>', '查询主播当前直播状态', { hidden: true })
            .usage('查询主播当前直播状态')
            .example('bili status 732')
            .action(async ({ session }, roomId) => {
                this.logger.info('调用bili.status指令')
                if (!roomId) return session.send('请输入房间号!')
                let content: any
                try {
                    content = await ctx.biliAPI.getLiveRoomInfo(roomId)
                } catch (e) {
                    return 'bili status指令 getLiveRoomInfo() 本次网络请求失败'
                }
                const { data } = content
                let userData: any
                try {
                    const { data: userInfo } = await ctx.biliAPI.getMasterInfo(data.uid)
                    userData = userInfo
                } catch (e) {
                    return 'bili status指令 getMasterInfo() 网络请求失败'
                }
                // B站出问题了
                if (content.code !== 0) {
                    if (content.msg === '未找到该房间') {
                        session.send('未找到该房间')
                    } else {
                        session.send('未知错误')
                    }
                    return
                }

                const { pic, buffer } = await ctx.gimg.generateLiveImg(
                    data,
                    userData,
                    data.live_status !== 1 ?
                        LiveType.NotLiveBroadcast :
                        LiveType.LiveBroadcast
                )
                // pic 存在，使用的是render模式
                if (pic) return pic
                // pic不存在，说明使用的是page模式
                await session.send(h.image(buffer, 'image/png'))
            })

        biliCom
            .subcommand('.bot', '查询当前拥有的机器人信息', { hidden: true })
            .usage('查询当前拥有的机器人信息')
            .example('bili bot 查询当前拥有的机器人信息')
            .action(() => {
                this.logger.info('开始输出BOT信息')
                ctx.bots.forEach(bot => {
                    this.logger.info('--------------------------------')
                    this.logger.info('平台：' + bot.platform)
                    this.logger.info('名称：' + bot.user.name)
                    this.logger.info('--------------------------------')
                })
            })

        biliCom
            .subcommand('.private', '向主人账号发送一条测试消息', { hidden: true })
            .usage('向主人账号发送一条测试消息')
            .example('bili private 向主人账号发送一条测试消息')
            .action(async ({ session }) => {
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 发送消息
                await this.sendPrivateMsg(bot, 'Hello World')
                // 发送提示
                await session.send('已发送消息，如未收到则说明您的机器人不支持发送私聊消息或您的信息填写有误')
            })

        biliCom
            .subcommand('.reboot', '测试插件自动重启功能', { hidden: true })
            .usage('测试插件自动重启功能')
            .example('bili reboot 测试插件自动重启功能')
            .action(async ({ session }) => {
                // 发送提示消息
                await session.send('测试biliAPI等服务自动重启功能')
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 发送提示消息，重启服务
                await this.sendPrivateMsgAndRebootService(ctx, bot, '测试biliAPI等服务自动重启功能')
            })

        biliCom
            .subcommand('.sendall', '测试给机器人加入的所有群发送消息', { hidden: true })
            .usage('测试给机器人加入的所有群发送消息')
            .example('bili sendall 测试给机器人加入的所有群发送消息')
            .action(async ({ session }) => {
                // 获得对应bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 发送消息
                await this.sendMsg(ctx, ['all'], bot, 'Hello World')
                // 发送提示
                await session.send('已向机器人加入的所有群发送了消息')
            })

        biliCom
            .subcommand('.list', '获取机器人加入的所有群组', { hidden: true })
            .usage('获取当前机器人加入的所有群聊')
            .example('bili list 获取当前机器人加入的所有群聊')
            .action(async ({ session }) => {
                // 获取对应Bot
                const bot = this.getTheCorrespondingBotBasedOnTheSession(session)
                // 获取群列表
                const guildList = (await bot.getGuildList()).data
                // 遍历群列表
                guildList.map(item => this.logger.info(`已加入${item.id}`))
            })
    }

    getTheCorrespondingBotBasedOnTheSession(session: Session) {
        // 获取对应Bot
        let bot: Bot<Context>
        switch (session.event.platform) {
            case 'qq': bot = this.qqBot; break
            case 'qqguild': bot = this.qqguildBot; break
            case 'onebot': bot = this.oneBot; break
            case 'red': bot = this.redBot; break
            case 'telegram': bot = this.telegramBot; break
            case 'satori': bot = this.satoriBot; break
            case 'chronocat': bot = this.chronocatBot; break
            default: {
                session.send('暂不支持该平台！')
            }
        }
        return bot
    }

    async sendPrivateMsg(bot: Bot<Context>, content: string) {
        if (this.config.master.enable) {
            if (this.config.master.masterAccountGuildId) {
                // 向机器人主人发送消息
                await bot.sendPrivateMessage(
                    this.config.master.masterAccount,
                    content,
                    this.config.master.masterAccountGuildId
                )
            } else {
                // 向机器人主人发送消息
                await bot.sendPrivateMessage(
                    this.config.master.masterAccount,
                    content
                )
            }
        }
    }

    async sendPrivateMsgAndRebootService(ctx: Context, bot: Bot<Context>, content: string) {
        await this.sendPrivateMsg(bot, content)
        // 停用插件
        ctx.sm.disposePlugin()
        // 隔一秒启动插件
        ctx.setTimeout(() => {
            ctx.sm.registerPlugin()
        }, 1000)
    }

    dynamicDetect(
        ctx: Context,
        bot: Bot<Context>,
        uid: string,
        guildId: Array<string>
    ) {
        let firstSubscription: boolean = true
        let timePoint: number

        return async () => {
            // 第一次订阅判断
            if (firstSubscription) {
                // 设置第一次的时间点
                timePoint = ctx.biliAPI.getTimeOfUTC8()
                // 设置第一次为false
                firstSubscription = false
                return
            }
            // 获取用户空间动态数据
            let content: any
            try {
                content = await ctx.biliAPI.getUserSpaceDynamic(uid)
            } catch (e) {
                return this.logger.error('dynamicDetect getUserSpaceDynamic() 网络请求失败')
            }
            // 判断是否出现其他问题
            if (content.code !== 0) {
                switch (content.code) {
                    case -101: { // 账号未登录
                        await this.sendPrivateMsg(bot, '账号未登录，请登录后重新订阅动态')
                        break
                    }
                    default: await this.sendPrivateMsg(bot, '未知错误，请重新订阅动态') // 未知错误
                }
                // 取消订阅
                this.unsubSingle(ctx, uid, 1) /* 1为取消动态订阅 */
                return
            }
            // 获取数据内容
            const items = content.data.items
            // 发送请求 默认只查看配置文件规定数量的数据
            for (let num = this.config.dynamicCheckNumber - 1; num >= 0; num--) {
                // 没有动态内容则直接跳过
                if (!items[num]) continue
                // 寻找发布时间比时间点更晚的动态
                if (items[num].modules.module_author.pub_ts > timePoint) {
                    // 推送该条动态
                    let attempts = 3;
                    for (let i = 0; i < attempts; i++) {
                        try {
                            // 定义变量
                            let pic: string
                            let buffer: Buffer
                            // 从动态数据中取出UP主名称和动态ID
                            const upName = content.data.items[num].modules.module_author.name
                            const dynamicId = content.data.items[num].id_str
                            // 判断是否需要发送URL
                            const dUrl = this.config.dynamicUrl ? `${upName}发布了一条动态：https://t.bilibili.com/${dynamicId}` : ''
                            // 获取动态推送图片
                            try {
                                // 渲染图片
                                const { pic: gimgPic, buffer: gimgBuffer } = await ctx.gimg.generateDynamicImg(items[num])
                                pic = gimgPic
                                buffer = gimgBuffer
                            } catch (e) {
                                // 直播开播动态，不做处理
                                if (e.message === '直播开播动态，不做处理') break
                                if (e.message === '出现关键词，屏蔽该动态') {
                                    // 如果需要发送才发送
                                    this.config.filter.notify && await this.sendMsg(
                                        ctx,
                                        guildId,
                                        bot,
                                        `${upName}发布了一条含有屏蔽关键字的动态`,
                                    )
                                    break
                                }
                                if (e.message === '已屏蔽转发动态') {
                                    this.config.filter.notify && await this.sendMsg(
                                        ctx,
                                        guildId,
                                        bot,
                                        `${upName}发布了一条转发动态，已屏蔽`
                                    )
                                    break
                                }
                            }
                            // 如果pic存在，则直接返回pic
                            if (pic) {
                                // pic存在，使用的是render模式
                                await this.sendMsg(ctx, guildId, bot, pic + dUrl)
                            } else {
                                // pic不存在，说明使用的是page模式
                                await this.sendMsg(ctx, guildId, bot, h.image(buffer, 'image/png' + dUrl))
                            }
                            // 如果成功，那么跳出循环
                            break
                        } catch (e) {
                            this.logger.error('dynamicDetect generateDynamicImg() 推送卡片发送失败，原因：' + e.toString())
                            if (i === attempts - 1) {  // 如果已经尝试了三次，那么抛出错误
                                return await this.sendPrivateMsgAndRebootService(
                                    ctx,
                                    bot,
                                    '插件可能出现某些未知错误，请尝试重启插件，如果仍然发生该错误，请带着日志向作者反馈',
                                )
                            }
                        }
                    }
                    // 更新时间点为最新发布动态的发布时间
                    switch (num) {
                        case 1: {
                            if (items[0].modules.module_tag) { // 存在置顶动态
                                timePoint = items[num].modules.module_author.pub_ts
                            }
                            break
                        }
                        case 0: timePoint = items[num].modules.module_author.pub_ts
                    }
                }
            }
        }
    }

    async sendMsg(ctx: Context, targets: Array<string>, bot: Bot<Context>, content: any) {
        // 定义需要发送的数组
        let sendArr = []
        // 判断是否需要推送所有机器人加入的群
        if (targets[0] === 'all') {
            // 获取所有guild
            for (let guild of (await bot.getGuildList()).data) {
                sendArr.push(guild.id)
            }
        } else {
            sendArr = targets
        }
        // 循环给每个群组发送
        for (let guildId of sendArr) {
            // 多次尝试发送消息
            let attempts = 3
            for (let i = 0; i < attempts; i++) {
                try {
                    return await bot.sendMessage(guildId, content)
                } catch (e) {
                    if (i === attempts - 1) { // 已尝试三次
                        throw new Error(`发送群组ID:${guildId}消息失败！原因: ` + e.toString())
                    }
                }
            }
            // 防止消息发送速度过快被忽略
            await ctx.sleep(500)
        }
    }

    liveDetect(
        ctx: Context,
        bot: Bot<Context>,
        roomId: string,
        guildId: Array<string>
    ) {
        let firstSubscription: boolean = true;
        let timer: number = 0;
        let open: boolean = false;
        let liveTime: string;
        let uData: any;
        // 相当于锁的作用，防止上一个循环没处理完
        let flag: boolean = true

        const sendLiveNotifyCard = async (data: any, uData: any, liveType: LiveType, liveStartMsg?: string, atAll?: boolean) => {
            let attempts = 3
            for (let i = 0; i < attempts; i++) {
                try {
                    // 获取直播通知卡片
                    const { pic, buffer } = await ctx.gimg.generateLiveImg(data, uData, liveType)
                    // 推送直播信息
                    if (!liveStartMsg) {
                        // pic 存在，使用的是render模式
                        if (pic) return await this.sendMsg(ctx, guildId, bot, pic)
                        // pic不存在，说明使用的是page模式
                        await this.sendMsg(ctx, guildId, bot, h.image(buffer, 'image/png'))
                    } else if (liveStartMsg && atAll) {
                        // pic 存在，使用的是render模式
                        if (pic) return await this.sendMsg(ctx, guildId, bot, pic + <><at type="all" /> {liveStartMsg} </>)
                        // pic不存在，说明使用的是page模式
                        await this.sendMsg(ctx, guildId, bot, h.image(buffer, 'image/png' + <><at type="all" /> {liveStartMsg}</>))
                    } else {
                        // pic 存在，使用的是render模式
                        if (pic) return await this.sendMsg(ctx, guildId, bot, pic + liveStartMsg)
                        // pic不存在，说明使用的是page模式
                        await this.sendMsg(ctx, guildId, bot, h.image(buffer, 'image/png' + liveStartMsg))
                    }
                    // 成功则跳出循环
                    break
                } catch (e) {
                    this.logger.error('liveDetect generateLiveImg() 推送卡片发送失败，原因：' + e.toString())
                    if (i === attempts - 1) { // 已尝试三次
                        return await this.sendPrivateMsgAndRebootService(
                            ctx,
                            bot,
                            '插件可能出现某些未知错误，请尝试重启插件，如果仍然发生该错误，请带着日志向作者反馈',
                        )
                    }
                }
            }
        }

        return async () => {
            try {
                // 如果flag为false则说明前面的代码还未执行完，则直接返回
                if (!flag) return
                flag && (flag = false)
                // 发送请求检测直播状态
                let content: any
                let attempts = 3
                for (let i = 0; i < attempts; i++) {
                    try {
                        // 发送请求获取room信息
                        content = await ctx.biliAPI.getLiveRoomInfo(roomId)
                        // 成功则跳出循环
                        break
                    } catch (e) {
                        this.logger.error('liveDetect getLiveRoomInfo 网络请求失败')
                        if (i === attempts - 1) { // 已尝试三次
                            return await this.sendPrivateMsgAndRebootService(
                                ctx,
                                bot,
                                '插件可能出现某些未知错误，请尝试重启插件，如果仍然发生该错误，请带着日志向作者反馈',
                            )
                        }
                    }
                }
                const { data } = content
                // 判断是否是第一次订阅
                if (firstSubscription) {
                    firstSubscription = false
                    // 获取主播信息
                    let userData: any
                    let attempts = 3
                    for (let i = 0; i < attempts; i++) {
                        try {
                            // 发送请求获取主播信息
                            const { data: userInfo } = await ctx.biliAPI.getMasterInfo(data.uid)
                            userData = userInfo
                            // 成功则跳出循环
                            break
                        } catch (e) {
                            this.logger.error('liveDetect getMasterInfo() 本次网络请求失败')
                            if (i === attempts - 1) { // 已尝试三次
                                return await this.sendPrivateMsgAndRebootService(
                                    ctx,
                                    bot,
                                    '插件可能出现某些未知错误，请尝试重启插件，如果仍然发生该错误，请带着日志向作者反馈',
                                )
                            }
                        }
                    }
                    // 主播信息不会变，请求一次即可
                    uData = userData
                    // 判断直播状态
                    if (data.live_status === 1) { // 当前正在直播
                        // 设置开播时间
                        liveTime = data.live_time
                        // 发送直播通知卡片
                        sendLiveNotifyCard(data, uData, LiveType.LiveBroadcast)
                        // 改变开播状态
                        open = true
                    } // 未开播，直接返回
                    return
                }
                // 检查直播状态
                switch (data.live_status) {
                    case 0:
                    case 2: { // 状态 0 和 2 说明未开播
                        if (open) { // 之前开播，现在下播了
                            // 更改直播状态
                            open = false
                            // 下播了将定时器清零
                            timer = 0
                            // 定义下播通知消息
                            let liveEndMsg = this.config.customLiveEnd
                                .replace('-name', uData.info.uname)
                                .replace('-time', await ctx.gimg.getTimeDifference(liveTime))
                            // 发送下播通知
                            await this.sendMsg(
                                ctx,
                                guildId,
                                bot,
                                liveEndMsg
                            )
                        }
                        // 未进循环，还未开播，继续循环
                        break
                    }
                    case 1: {
                        if (!open) { // 之前未开播，现在开播了
                            // 更改直播状态
                            open = true
                            // 设置开播时间
                            liveTime = data.live_time
                            // 获取主播信息
                            let userData: any
                            let attempts = 3
                            for (let i = 0; i < attempts; i++) {
                                try {
                                    // 获取主播信息
                                    const { data: userInfo } = await ctx.biliAPI.getMasterInfo(data.uid)
                                    userData = userInfo
                                    // 成功则跳出循环
                                    break
                                } catch (e) {
                                    this.logger.error('liveDetect open getMasterInfo() 网络请求错误')
                                    if (i === attempts - 1) { // 已尝试三次
                                        return await this.sendPrivateMsgAndRebootService(
                                            ctx,
                                            bot,
                                            '插件可能出现某些未知错误，请尝试重启插件，如果仍然发生该错误，请带着日志向作者反馈',
                                        )
                                    }
                                }
                            }
                            // 主播信息不会变，开播时刷新一次即可
                            uData = userData
                            // 定义开播通知语
                            let liveStartMsg = this.config.customLiveStart
                                .replace('-name', uData.info.uname)
                                .replace('-time', await ctx.gimg.getTimeDifference(liveTime))
                                .replace('-link', `https://live.bilibili.com/${data.short_id === 0 ? data.room_id : data.short_id}`)
                            // 判断是否需要@全体成员
                            if (this.config.liveStartAtAll) {
                                // 发送@全体成员通知
                                await sendLiveNotifyCard(data, uData, LiveType.StartBroadcasting, liveStartMsg, true)
                            } else {
                                // 发送直播通知卡片
                                await sendLiveNotifyCard(data, uData, LiveType.StartBroadcasting, liveStartMsg)
                            }
                        } else { // 还在直播
                            if (this.config.pushTime > 0) {
                                timer++
                                // 开始记录时间
                                if (timer >= (6 * 60 * this.config.pushTime)) { // 到时间推送直播消息
                                    // 到时间重新计时
                                    timer = 0
                                    // 发送直播通知卡片
                                    sendLiveNotifyCard(data, uData, LiveType.LiveBroadcast)
                                }
                            }
                            // 否则继续循环
                        }
                    }
                }
            } finally {
                // 执行完方法体不论如何都把flag设置为true
                flag = true
            }
        }
    }

    subShow() {
        // 在控制台中显示订阅对象
        let table: string = ``
        this.subManager.forEach(sub => {
            table += `UID:${sub.uid}  ${sub.dynamic ? '已订阅动态' : ''}  ${sub.live ? '已订阅直播' : ''}` + '\n'
        })
        return table ? table : '没有订阅任何UP'
    }

    async checkIfNeedSub(comNeed: boolean, subType: string, session: Session, data?: any): Promise<boolean> {
        if (comNeed) {
            if (subType === '直播' && !data.live_room) {
                await session.send('该用户未开通直播间，无法订阅直播')
                return false
            }
            return true
        }
        let input: string // 用户输入
        // 询问用户是否需要订阅直播
        while (1) {
            session.send(`是否需要订阅${subType}？需要输入 y 不需要输入 n `)
            input = await session.prompt()
            if (!input) {
                await session.send('输入超时请重新订阅')
                continue
            }
            switch (input) {
                case 'y': { // 需要订阅直播
                    // 如果用户没有开通直播间则无法订阅
                    if (subType === '直播' && !data.live_room) {
                        await session.send('该用户未开通直播间，无法订阅直播')
                        return false
                    }
                    // 开启直播订阅
                    return true
                }
                // 不需要
                case 'n': return false
                default: { // 输入了其他的内容
                    session.send('输入有误，请输入 y 或 n')
                }
            }
        }
    }

    updateSubNotifier(ctx: Context) {
        // 更新控制台提示
        this.subNotifier && this.subNotifier.dispose()
        // 获取订阅信息
        const subInfo = this.subShow()
        // 定义table
        let table = ''
        if (subInfo === '没有订阅任何UP') {
            table = subInfo
        } else {
            // 获取subTable
            let subTableArray = subInfo.split('\n')
            subTableArray.splice(subTableArray.length - 1, 1)
            // 定义Table
            table = <>
                <ul>
                    {
                        subTableArray.map(str => (
                            <li>{str}</li>
                        ))
                    }
                </ul>
            </>
        }
        // 设置更新后的提示
        this.subNotifier = ctx.notifier.create(table)
    }

    async checkIfLoginInfoIsLoaded(ctx: Context) {
        return new Promise(resolve => {
            const check = () => {
                if (!ctx.biliAPI.getLoginInfoIsLoaded()) {
                    ctx.setTimeout(check, 500)
                } else {
                    resolve('success')
                }
            }
            check()
        })
    }

    async getSubFromDatabase(ctx: Context) {
        // 判断登录信息是否已加载完毕
        await this.checkIfLoginInfoIsLoaded(ctx)
        // 如果未登录，则直接返回
        if (!(await this.checkIfIsLogin(ctx))) {
            // log
            this.logger.info(`账号未登录，请登录`)
            return
        }
        // 已存在订阅管理对象，不再进行订阅操作
        if (this.subManager.length !== 0) return
        // 从数据库中获取数据
        const subData = await ctx.database.get('bilibili', { id: { $gt: 0 } })
        // 设定订阅数量
        this.num = subData.length
        // 如果订阅数量超过三个则数据库被非法修改
        if (!this.config.unlockSubLimits && this.num > 3) {
            // 在控制台提示重新订阅
            ctx.notifier.create({
                type: 'danger',
                content: '您未解锁订阅限制，且订阅数大于3人，请您手动删除bilibili表中多余的数据后重启本插件'
            })
            return
        }
        // 循环遍历
        for (const sub of subData) {
            // 定义Bot
            let bot: Bot<Context>
            // 判断是否存在没有任何订阅的数据
            if (!sub.dynamic && !sub.live) { // 存在未订阅任何项目的数据
                // 删除该条数据
                ctx.database.remove('bilibili', { id: sub.id })
                // log
                this.logger.warn(`UID:${sub.uid} 该条数据没有任何订阅数据，自动取消订阅`)
                // 跳过下面的步骤
                continue
            }
            // 获取推送目标数组
            const targetArr = sub.targetId.split(' ')
            // 拿到对应bot
            switch (sub.platform) {
                case 'qq': bot = this.qqBot; break
                case 'qqguild': bot = this.qqguildBot; break
                case 'onebot': bot = this.oneBot; break
                case 'red': bot = this.redBot; break
                case 'telegram': bot = this.telegramBot; break
                case 'satori': bot = this.satoriBot; break
                case 'chronocat': bot = this.chronocatBot; break
                default: {
                    // 本条数据被篡改，删除该条订阅
                    ctx.database.remove('bilibili', { id: sub.id })
                    // 不支持的协议
                    this.logger.info(`UID:${sub.uid} 出现不支持的协议，该条数据被篡改，自动取消订阅`)
                    // 发送消息
                    await this.sendPrivateMsg(bot, `UID:${sub.uid} 出现不支持的协议，该条数据被篡改，自动取消订阅`)
                    // 继续下个循环
                    continue
                }
            }
            // 判断数据库是否被篡改
            // 获取用户信息
            let content: any
            let attempts = 3
            for (let i = 0; i < attempts; i++) {
                try {
                    // 获取用户信息
                    content = await ctx.biliAPI.getUserInfo(sub.uid)
                    // 成功则跳出循环
                    break
                } catch (e) {
                    this.logger.error('getSubFromDatabase() getUserInfo() 本次网络请求失败')
                    if (i === attempts - 1) { // 已尝试三次
                        return await this.sendPrivateMsgAndRebootService(
                            ctx,
                            bot,
                            '你的网络可能出现了某些问题，请检查后重启插件',
                        )
                    }
                }
            }
            // 获取data
            const { data } = content
            // 定义函数删除数据和发送提示
            const deleteSub = async () => {
                // 从数据库删除该条数据
                await ctx.database.remove('bilibili', { id: sub.id })
                // 给用户发送提示
                await this.sendPrivateMsg(bot, `UID:${sub.uid} 数据库内容被篡改，已取消对该UP主的订阅`)
            }
            // 判断是否有其他问题
            if (content.code !== 0) {
                switch (content.code) {
                    case -352:
                    case -403: {
                        await this.sendPrivateMsg(bot, '你的登录信息已过期，请重新登录Bilibili')
                        return
                    }
                    case -400:
                    case -404:
                    default: {
                        await deleteSub()
                        // PrivateMsg
                        await this.sendPrivateMsg(bot, `UID:${sub.uid} 数据出现问题，自动取消订阅`)
                        // log
                        this.logger.info(`UID:${sub.uid} 数据出现问题，自动取消订阅`)
                        return
                    }
                }
            }
            // 检测房间号是否被篡改
            if (sub.live && (!data.live_room || data.live_room.roomid.toString() !== sub.room_id)) {
                // 房间号被篡改，删除该订阅
                await deleteSub()
                // log
                this.logger.info(`UID:${sub.uid} 房间号被篡改，自动取消订阅`)
                // Send msg
                await this.sendPrivateMsg(bot, `UID:${sub.uid} 房间号被篡改，自动取消订阅`)
                return
            }
            // 构建订阅对象
            let subManagerItem = {
                id: sub.id,
                uid: sub.uid,
                roomId: sub.room_id,
                targetId: sub.targetId,
                platform: sub.platform,
                live: +sub.live === 1 ? true : false,
                dynamic: +sub.dynamic === 1 ? true : false,
                liveDispose: null,
                dynamicDispose: null
            }
            // 判断需要订阅的服务
            if (sub.dynamic) { // 需要订阅动态
                // 开始循环检测
                const dispose = ctx.setInterval(
                    this.dynamicDetect(ctx, bot, sub.uid, targetArr),
                    this.config.dynamicLoopTime * 1000
                )
                // 保存销毁函数
                subManagerItem.dynamicDispose = dispose
            }

            if (sub.live) { // 需要订阅直播
                // 开始循环检测
                const dispose = ctx.setInterval(
                    this.liveDetect(ctx, bot, sub.room_id, targetArr),
                    this.config.liveLoopTime * 1000
                )
                // 保存销毁函数
                subManagerItem.liveDispose = dispose
            }
            // 保存新订阅对象
            this.subManager.push(subManagerItem)
        }
        // 在控制台中显示订阅对象
        this.updateSubNotifier(ctx)
    }

    unsubSingle(ctx: Context, id: string /* UID或RoomId */, type: number /* 0取消Live订阅，1取消Dynamic订阅 */): string {
        let index: number

        const checkIfNoSubExist = (index: number) => {
            if (!this.subManager[index].dynamic && !this.subManager[index].live) {
                // 获取要删除行的id
                const id = this.subManager[index].id
                // 从管理对象中移除
                this.subManager.splice(index, 1)
                // 从数据库中删除
                ctx.database.remove('bilibili', [id])
                // num--
                this.num--
                return '已取消订阅该用户'
            }
            return null
        }

        try {
            switch (type) {
                case 0: { // 取消Live订阅
                    index = this.subManager.findIndex(sub => sub.roomId === id)
                    if (index === -1) return '未订阅该用户，无需取消订阅'
                    // 取消订阅
                    this.subManager[index].live && this.subManager[index].liveDispose()
                    this.subManager[index].liveDispose = null
                    this.subManager[index].live = false
                    // 如果没有对这个UP的任何订阅，则移除
                    const info = checkIfNoSubExist(index)
                    if (info) return info
                    // 更新数据库
                    ctx.database.upsert('bilibili', [{
                        id: +`${this.subManager[index].id}`,
                        live: 0
                    }])
                    return '已取消订阅Live'
                }
                case 1: { // 取消Dynamic订阅
                    index = this.subManager.findIndex(sub => sub.uid === id)
                    if (index === -1) return '未订阅该用户，无需取消订阅'
                    // 取消订阅
                    this.subManager[index].dynamic && this.subManager[index].dynamicDispose()
                    this.subManager[index].dynamicDispose = null
                    this.subManager[index].dynamic = false
                    // 如果没有对这个UP的任何订阅，则移除
                    const info = checkIfNoSubExist(index)
                    if (info) return info
                    // 更新数据库
                    ctx.database.upsert('bilibili', [{
                        id: +`${this.subManager[index].id}`,
                        dynamic: 0
                    }])
                    return '已取消订阅Dynamic'
                }
            }
        } finally {
            // 执行完该方法后，保证执行一次updateSubNotifier()
            this.updateSubNotifier(ctx)
        }
    }

    async checkIfIsLogin(ctx: Context) {
        if ((await ctx.database.get('loginBili', 1)).length !== 0) { // 数据库中有数据
            // 检查cookie中是否有值
            if (ctx.biliAPI.getCookies() !== '[]') { // 有值说明已登录
                return true
            }
        }
        return false
    }
}

namespace ComRegister {
    export interface Config {
        master: {
            enable: boolean
            masterAccount: string,
            masterAccountGuildId: string
        },
        unlockSubLimits: boolean,
        liveStartAtAll: boolean,
        pushTime: number,
        liveLoopTime: number,
        customLiveStart: string,
        customLiveEnd: string,
        dynamicUrl: boolean,
        dynamicLoopTime: number,
        dynamicCheckNumber: number,
        filter: {
            enable: boolean,
            notify: boolean
            regex: string,
            keywords: Array<string>,
        }
    }

    export const Config: Schema<Config> = Schema.object({
        master: Schema.object({
            enable: Schema.boolean(),
            masterAccount: Schema.string(),
            masterAccountGuildId: Schema.string()
        }),
        unlockSubLimits: Schema.boolean().required(),
        liveStartAtAll: Schema.boolean().required(),
        pushTime: Schema.number().required(),
        liveLoopTime: Schema.number().default(10),
        customLiveStart: Schema.string().required(),
        customLiveEnd: Schema.string().required(),
        dynamicUrl: Schema.boolean().required(),
        dynamicLoopTime: Schema.number().default(60),
        dynamicCheckNumber: Schema.number().required(),
        filter: Schema.object({
            enable: Schema.boolean(),
            notify: Schema.boolean(),
            regex: Schema.string(),
            keywords: Schema.array(String),
        }),
    })
}

export default ComRegister