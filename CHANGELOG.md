# Changelog

所有变更应记录到此文档

## [2.0.2](https://github.com/401U/koishi-plugin-bilibili-notify/compare/v2.0.1...v2.0.2) (2024-05-05)


### Bug Fixes

* 修复了错误的指令别名 ([97a8204](https://github.com/401U/koishi-plugin-bilibili-notify/commit/97a82046279063336a50c472a2584566f0780d0f))

## [2.0.1](https://github.com/401U/koishi-plugin-bilibili-notify/compare/v2.0.0...v2.0.1) (2024-05-05)


### Miscellaneous Chores

* release 2.0.1 ([3875ffe](https://github.com/401U/koishi-plugin-bilibili-notify/commit/3875ffeadea6f42fdfc8a52d5ab9ae25c715f3c2))

## [2.0.0](https://github.com/401U/koishi-plugin-bilibili-notify/compare/v2.0.0-beta.1...v2.0.0) (2024-05-05)


### Features

* bili.list 支持列出其他频道的订阅目标，同时调整了列出的项目展示样式 ([afa0608](https://github.com/401U/koishi-plugin-bilibili-notify/commit/afa0608f0620572faebf785e3935b865c9913812))
* bili.unsub命令支持取消其他频道的订阅 ([8916970](https://github.com/401U/koishi-plugin-bilibili-notify/commit/89169708f4f94c6017fa36cdaa12b6db654d89cf))
* 为现有指令添加了更多别名 ([2d9fcdc](https://github.com/401U/koishi-plugin-bilibili-notify/commit/2d9fcdcce9ba28394bf1e49fe132e80315e7ea8d))
* 加入bili.notify指令来检查当前频道能否接收通知 ([5b06651](https://github.com/401U/koishi-plugin-bilibili-notify/commit/5b066512fdcb626d4313962721e9dba996bc65e9))


### Bug Fixes

* update docs ([b1ad58c](https://github.com/401U/koishi-plugin-bilibili-notify/commit/b1ad58cf0d0f46293acf657b156f711144a859b7))
* 修复了bili.sub与bili.unsub命令在不指定订阅类型时的行为 ([050c4d7](https://github.com/401U/koishi-plugin-bilibili-notify/commit/050c4d7e243beb9e34bf3646ff3d43527316cbfb))


### Miscellaneous Chores

* release 2.0.0 ([b34aebd](https://github.com/401U/koishi-plugin-bilibili-notify/commit/b34aebddf1ee6eec90289ef0456998b7c8c95902))

## v2.0.0-beat.1
### Refactor
- 大幅重构了代码结构
- 大幅调整了配置项目
- 重构了指令结构
- 大幅调整了配置项目
### Features
- 取消了订阅数量限制
- 可使用cron自定义检查任务执行时间
- 在订阅用户时机器人将尝试关注用户并移动至关注分组，在订阅全部取消时移出关注分组，方便后续维护关注列表

[v1变更](https://github.com/401U/koishi-plugin-bilibili-notify/tree/c02846633e8b18ba6f16956835e62b84252f27b1)
