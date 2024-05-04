interface BiliResp<T>{
    code: number
    message: string
    data: T
}

// 动态类型
type DYNAMIC_TYPES = 'DYNAMIC_TYPE_NONE' | 'DYNAMIC_TYPE_FORWARD' |
    'DYNAMIC_TYPE_AV' | 'DYNAMIC_TYPE_PGC' | 'DYNAMIC_TYPE_COURSES' |
    'DYNAMIC_TYPE_WORD' | 'DYNAMIC_TYPE_DRAW' | 'DYNAMIC_TYPE_ARTICLE' |
    'DYNAMIC_TYPE_MUSIC' | 'DYNAMIC_TYPE_COMMON_SQUARE' | 'DYNAMIC_TYPE_COMMON_VERTICAL' | 'DYNAMIC_TYPE_LIVE' |
    'DYNAMIC_TYPE_MEDIALIST' | 'DYNAMIC_TYPE_COURSES_SEASON' | 'DYNAMIC_TYPE_COURSES_BATCH' | 'DYNAMIC_TYPE_AD' |
    'DYNAMIC_TYPE_APPLET' | 'DYNAMIC_TYPE_SUBSCRIPTION' | 'DYNAMIC_TYPE_LIVE_RCMD' | 'DYNAMIC_TYPE_BANNER' |
    'DYNAMIC_TYPE_UGC_SEASON' | 'DYNAMIC_TYPE_SUBSCRIPTION_NEW'
// 内容卡片类型
type ADDITIONAL_TYPES = 'ADDITIONAL_TYPE_NONE' | 'ADDITIONAL_TYPE_PGC' |
     'ADDITIONAL_TYPE_GOODS' | 'ADDITIONAL_TYPE_VOTE' | 
     'ADDITIONAL_TYPE_COMMON' | 'ADDITIONAL_TYPE_MATCH' | 
     'ADDITIONAL_TYPE_UP_RCMD' | 'ADDITIONAL_TYPE_UGC' | 
     'ADDITIONAL_TYPE_RESERVE'

// 主模块类型
type MAJOR_TYPES = 'MAJOR_TYPE_OPUS' | 'MAJOR_TYPE_ARCHIVE'

type RICH_TEXT_NODE_TYPES = 'RICH_TEXT_NODE_TYPE_TEXT' | 'RICH_TEXT_NODE_TYPE_EMOJI' |
    'RICH_TEXT_NODE_TYPE_TOPIC' | 'RICH_TEXT_NODE_TYPE_AT' | 'RICH_TEXT_NODE_TYPE_LOTTERY' |
    'RICH_TEXT_NODE_TYPE_BV'

interface IsFollow{
    attribute: 0 | 2 | 6 | 128
}

interface FollowGroup{
    tagid: number
    name: string
    count: number
    tip: string
}

interface Pagination<T>{
    items: T[]
}

interface TextHolder{
    text: string
}

interface DynamicItem{
    basic: any
    id_str: string
    modules: {
        module_author: {
            mid: number
            name: string
            avatar: string
            official_verify: {
                type: number // 1 机构认证
            }
            pub_time: string
            pub_ts: number
            face: string
            decorate?: {
                card_url: string
                fan: {
                    num_str: number
                    color: string
                }
            }
            vip: {
                type: number
            }
        }
        module_dynamic: DynamicItemDynamicWrapper
        module_stat: {
            comment: {
                count: number
            }
            forward: {
                count: number
            }
            like: {
                count: number
            }
        }
    }
    type: DYNAMIC_TYPES
    orig: DynamicItem
}

interface DynamicItemDynamicWrapper{
    topic?: {
        name: string
    }
    desc: {
        rich_text_nodes: RichTextNode[]
    }
    major: {
        draw:{
            items: DynamicItemDrawItem[]
        }
        archive: {
            badge: TextHolder
            cover: string
            duration_text: string
            title: string
            desc: string
            stat: {
                play: string
                danmaku: string
            }
            bvid: string
        }
        opus: {
            jump_url: string
            summary: {
                rich_text_nodes: RichTextNode[]
            }
            pics: OpusPicture[]
            title: string
        }
        type: MAJOR_TYPES
    }
    additional: AdditionalModuleWrapper
}

interface AdditionalModuleWrapper {
    type: ADDITIONAL_TYPES
    reserve: AdditionalModuleReserve
}

interface AdditionalModuleReserve {
    button: {
        uncheck: TextHolder
    }
    title: string
    desc1: TextHolder
    desc2: TextHolder
    desc3: TextHolder
}

interface RichTextNode{
    emoji: {
        icon_url: string
    }
    text: string
    type: RICH_TEXT_NODE_TYPES
}

interface DynamicItemDrawItem{
    src: string
}

interface DynamicDetail{
    item: DynamicItem
}

interface OpusPicture{
    url: string
}

interface LiveRoomInfo {
    title: string
    room_id: number
    online: number
    live_time: number
    live_status: 0 | 1 | 2 // 0: 未开播 1: 直播中 2: 轮播中
    short_id: number
    area_v2_name: string

    uid: number
    uname: string
    face: string
    cover_from_user: string
    keyframe: string
}

interface LiveRoomMap{
    [key: string]: LiveRoomInfo
}