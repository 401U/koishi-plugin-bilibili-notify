import { Context } from "koishi"

declare module 'koishi' {
    interface Tables {
        bili_user: BiliUser,
        loginBili: LoginBili,
        bili_sub: BiliSub
        bili_check: BiliCheck
    }
}

export interface BiliUser {
    uid: number,
    uname: string,
    room_id: string,
}

export interface BiliSub{
    uid: number,
    channel: string,
    live: number,
    dynamic: number,
    filter: string,
    time: Date,
}

export interface BiliCheck{
    id: number
    checkType: 'live' | 'dynamic'
    startTime: Date     // 该检测开始时间
    maxTime: Date       // 该检测获得的数据中最新的时间
    num_total: number
    num_followed: number
    num_filtered: number
    num_sent: number
}


export interface LoginBili {
    id: number,
    bili_cookies: string,
    bili_refresh_token: string
}

export const name = 'Database'

export function apply(ctx: Context) {
    let logger = ctx.logger('BiliDB')
    // 新增LoginBili表
    ctx.model.extend('loginBili', {
        id: 'unsigned',
        bili_cookies: 'text',
        bili_refresh_token: 'text'
    })
    logger.info('扩展LoginBili表成功')

    // 新增BiliUser表
    ctx.model.extend('bili_user', {
        uid: 'unsigned',
        uname: 'string',
        room_id: 'string'
    }, {unique: ['uid'], primary: 'uid'})
    logger.info('扩展BiliUser表成功')
    // 新增BiliSub表
    ctx.model.extend('bili_sub', {
        uid: 'unsigned',
        channel: 'string',
        live: 'unsigned',
        dynamic: 'unsigned',
        filter: 'string',
        time: 'timestamp'
    }, {primary: ["uid", "channel"]})
    logger.info('扩展BiliSub表成功')
    ctx.model.extend('bili_check', {
        id: 'unsigned',
        checkType: 'string',
        startTime: 'timestamp',
        maxTime: 'timestamp',
        num_total: 'unsigned',
        num_followed: 'unsigned',
        num_filtered: 'unsigned',
        num_sent: 'unsigned'
    }, {autoInc: true})
    logger.info('扩展BiliCheck表成功')
}