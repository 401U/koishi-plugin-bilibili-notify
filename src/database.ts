import { Context } from "koishi"

declare module 'koishi' {
    interface Tables {
        bili_user: BiliUser,
        loginBili: LoginBili,
        bili_sub: BiliSub
    }
}

export interface BiliUser {
    uid: string,
    room_id: string,
    time: Date
}

export interface BiliSub{
    uid: string,
    live: number,
    dynamic: number,
    filter: string,
    channel: string
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

    // 新增BiliUser表
    ctx.model.extend('bili_user', {
        uid: 'string',
        room_id: 'string',
        time: 'timestamp'
    }, {unique: ['uid']})
    // 新增BiliSub表
    ctx.model.extend('bili_sub', {
        uid: 'string',
        channel: 'string',
        live: 'unsigned',
        dynamic: 'unsigned',
        filter: 'string'
    }, {primary: ['uid', 'channel']})
}