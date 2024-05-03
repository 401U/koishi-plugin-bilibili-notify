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