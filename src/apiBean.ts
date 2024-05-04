interface BiliResp<T>{
    code: number
    message: string
    data: T
}

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
            official_verify: any
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
    type: string
    orig: DynamicItem
}

interface DynamicItemDynamicWrapper{
    topic?: {
        name: string
    }
    desc: {
        rich_text_nodes: DynamicItemRichTextNode[]
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
    }
    additional: AdditionalModuleWrapper
}

interface AdditionalModuleWrapper {
    type: string
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

interface DynamicItemRichTextNode{
    emoji: {
        icon_url: string
    }
    text: string
}

interface DynamicItemDrawItem{
    src: string
}

interface DynamicDetail{
    item: DynamicItem
}