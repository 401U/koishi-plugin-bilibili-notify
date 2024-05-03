import { Context } from "koishi"

declare module 'koishi' {
    interface Tables {
        bili_user: BiliUser,
        loginBili: LoginBili,
        bili_sub: BiliSub
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


export interface LoginBili {
    id: number,
    bili_cookies: string,
    bili_refresh_token: string
}

export const name = 'Database'

export function apply(ctx: Context) {
    // 新增LoginBili表
    ctx.model.extend('loginBili', {
        id: 'unsigned',
        bili_cookies: 'text',
        bili_refresh_token: 'text'
    })
    ctx.logger.info('扩展LoginBili表成功')

    // 新增BiliUser表
    ctx.model.extend('bili_user', {
        uid: 'unsigned',
        uname: 'string',
        room_id: 'string'
    }, {unique: ['uid'], primary: 'uid'})
    ctx.logger.info('扩展BiliUser表成功')
    // 新增BiliSub表
    ctx.model.extend('bili_sub', {
        uid: 'unsigned',
        channel: 'string',
        live: 'unsigned',
        dynamic: 'unsigned',
        filter: 'string',
        time: 'timestamp'
    }, {primary: ["uid", "channel"]})
    ctx.logger.info('扩展BiliSub表成功')
}