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

// {
//     basic: {
//       comment_id_str: '315310664',
//       comment_type: 11,
//       like_icon: { action_url: '', end_url: '', id: 0, start_url: '' },
//       rid_str: '315310664'
//     },
//     id_str: '927156355473604674',
//     modules: {
//       module_author: {
//         avatar: [Object],
//         decorate: [Object],
//         face: 'https://i2.hdslb.com/bfs/face/37ae7362f75cff540259b23413aec6803d2d8dcd.jpg',
//         face_nft: false,
//         following: true,
//         jump_url: '//space.bilibili.com/401742377/dynamic',
//         label: '',
//         mid: 401742377,
//         name: '原神',
//         official_verify: [Object],
//         pendant: [Object],
//         pub_action: '',
//         pub_location_text: '',
//         pub_time: '7小时前',
//         pub_ts: 1714708811,
//         type: 'AUTHOR_TYPE_NORMAL',
//         vip: [Object]
//       },
//       module_dynamic: {
//         additional: [Object],
//         desc: [Object],
//         major: [Object],
//         topic: null
//       },
//       module_more: { three_point_items: [Array] },
//       module_stat: { comment: [Object], forward: [Object], like: [Object] }
//     },
//     type: 'DYNAMIC_TYPE_DRAW',
//     visible: true
//   }

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
        }
        module_dynamic: {}
    }
    type: string
}