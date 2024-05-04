import { Context, ForkScope, Schema, Service } from 'koishi'
import { } from '@koishijs/plugin-notifier'
import BiliCmd from './BiliCmd'
import * as Database from './database'
// import Service
import Wbi from './wbi'
import BiliAPI from './biliAPI'
import Render from './render'

export const inject = ['puppeteer', 'database', 'notifier', 'cron']

export const name = 'bilibili-notify'

let conf: Config

declare module 'koishi' {
    interface Context {
        sm: ServerManager
    }
}

export interface Config {
    api: BiliAPI.Config,
    wbi: Wbi.Config,
    render: Render.Config,
    main: BiliCmd.Config
}

export const Config: Schema<Config> = Schema.object({
    require: Schema.object({}).description('必填设置'),
    wbi: Wbi.Config,

    basicSettings: Schema.object({}).description('基本设置'),
    api: BiliAPI.Config,

    dynamic: Schema.object({}).description('推送设置'),
    main: BiliCmd.Config,

    style: Schema.object({}).description('样式设置'),
    render: Render.Config,
})

class ServerManager extends Service {
    // 服务
    servers: ForkScope[] = []
    // 重启次数
    restartCount = 0

    constructor(ctx: Context) {
        super(ctx, 'sm')

        // 插件运行相关指令
        const sysCom = ctx.command('bilisys', 'bili-notify插件运行相关指令', { permissions: ['authority:5'] })

        sysCom
            .subcommand('.restart', '重启插件')
            .action(async () => {
                ctx.logger.info('调用sys restart指令')
                if (await this.restartPlugin()) {
                    return '插件重启成功'
                }
                return '插件重启失败'
            })

        sysCom
            .subcommand('.stop', '停止插件')
            .action(async () => {
                ctx.logger.info('调用sys stop指令')
                if (await this.disposePlugin()) {
                    return '插件已停止'
                }
                return '停止插件失败'
            })

        sysCom
            .subcommand('.start', '启动插件')
            .action(async () => {
                ctx.logger.info('调用sys start指令')
                if (await this.registerPlugin()) {
                    return '插件启动成功'
                }
                return '插件启动失败'
            })
    }

    protected start(): void | Promise<void> {
        // 注册插件
        this.registerPlugin()
    }

    async registerPlugin() {
        // 如果已经有服务则返回false
        if (this.servers.length !== 0) return false
        await new Promise(resolve => {
            // 注册插件
            const biliApi = this.ctx.plugin(BiliAPI, conf.api)
            this.ctx.logger.info('biliApi已加载')
            const biliRender = this.ctx.plugin(Render, conf.render)
            this.ctx.logger.info('biliRender已加载')
            const wbi = this.ctx.plugin(Wbi, conf.wbi)
            this.ctx.logger.info('wbi已加载')
            const biliCmd = this.ctx.plugin(BiliCmd, conf.main)
            this.ctx.logger.info('biliCmd已加载')
            // 添加服务
            this.servers.push(biliApi)
            this.servers.push(biliRender)
            this.servers.push(wbi)
            this.servers.push(biliCmd)
            // 成功
            resolve('ok')
        })
        // 成功返回true 
        return true
    }

    async disposePlugin() {
        // 如果没有服务则返回false
        if (this.servers.length === 0) return false
        // 遍历服务
        await new Promise(resolve => {
            this.servers.forEach(fork => {
                fork.dispose()
            })
            // 清空服务
            this.servers = []
            resolve('ok')
        })
        // 成功返回true
        return true
    }

    async restartPlugin (count?: boolean /* 是否需要计数 */){
        // 如果没有服务则返回false
        if (this.servers.length === 0) return false
        // 如果需要计数
        if (count) {
            // 重启次数大于等于3次
            if (this.restartCount >= 3) return false
            // 重启次数+1
            this.restartCount++
        }
        // 停用插件
        await this.disposePlugin()
        // 隔一秒启动插件
        await new Promise(resolve => {
            this.ctx.setTimeout(async () => {
                await this.registerPlugin()
                resolve('ok')
            }, 1000)
        })
        // 成功返回true
        return true
    }
}

export function apply(ctx: Context, config: Config) {
    // 设置config
    conf = config
    ctx.plugin(Database)
    // Register ServerManager
    ctx.plugin(ServerManager)
}
