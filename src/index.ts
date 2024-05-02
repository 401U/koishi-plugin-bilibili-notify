import { Context, ForkScope, Schema, Service } from 'koishi'
import { } from '@koishijs/plugin-notifier'
import ComRegister from './comRegister'
import * as Database from './database'
// import Service
import Wbi from './wbi'
import GenerateImg from './generateImg'
import BiliAPI from './biliAPI'

export const inject = ['puppeteer', 'database', 'notifier']

export const name = 'bilibili-notify'

let globalConfig: Config

declare module 'koishi' {
    interface Context {
        sm: ServerManager
    }
}

export interface Config {
    api: BiliAPI.Config,
    wbi: Wbi.Config,
    generateImage: GenerateImg.Config,
    main: ComRegister.Config
}

export const Config: Schema<Config> = Schema.object({
    require: Schema.object({}).description('必填设置'),
    wbi: Wbi.Config,

    basicSettings: Schema.object({}).description('基本设置'),
    api: BiliAPI.Config,

    dynamic: Schema.object({}).description('推送设置'),
    main: ComRegister.Config,

    style: Schema.object({}).description('样式设置'),
    generateImage: GenerateImg.Config,
})

class ServerManager extends Service {
    // 服务
    servers: ForkScope[] = []
    // 重启次数
    restartCount = 0

    constructor(ctx: Context) {
        super(ctx, 'sm')

        // 插件运行相关指令
        const sysCom = ctx.command('sys', 'bili-notify插件运行相关指令', { permissions: ['authority:5'] })

        sysCom
            .subcommand('.restart', '重启插件')
            .usage('重启插件')
            .example('sys restart')
            .action(async () => {
                this.logger.info('调用sys restart指令')
                if (await this.restartPlugin()) {
                    return '插件重启成功'
                }
                return '插件重启失败'
            })

        sysCom
            .subcommand('.stop', '停止插件')
            .usage('停止插件')
            .example('sys stop')
            .action(async () => {
                this.logger.info('调用sys stop指令')
                if (await this.disposePlugin()) {
                    return '插件已停止'
                }
                return '停止插件失败'
            })

        sysCom
            .subcommand('.start', '启动插件')
            .usage('启动插件')
            .example('sys start')
            .action(async () => {
                this.logger.info('调用sys start指令')
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

    registerPlugin = async () => {
        // 如果已经有服务则返回false
        if (this.servers.length !== 0) return false
        await new Promise(resolve => {
            // 注册插件
            const ba = this.ctx.plugin(BiliAPI, globalConfig.api)
            const gi = this.ctx.plugin(GenerateImg, globalConfig.generateImage)
            const wbi = this.ctx.plugin(Wbi, globalConfig.wbi)
            const cr = this.ctx.plugin(ComRegister, globalConfig.main)
            // 添加服务
            this.servers.push(ba)
            this.servers.push(gi)
            this.servers.push(wbi)
            this.servers.push(cr)
            // 成功
            resolve('ok')
        })
        // 成功返回true 
        return true
    }

    disposePlugin = async () => {
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

    restartPlugin = async (count?: boolean /* 是否需要计数 */) => {
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
    globalConfig = config
    // 设置提示
    ctx.notifier.create({
        content: '请记得使用Auth插件创建超级管理员账号，没有权限将无法使用该插件提供的指令。'
    })
    // load database
    ctx.plugin(Database)
    // Register ServerManager
    ctx.plugin(ServerManager)
    // 当用户输入“恶魔兔，启动！”时，执行 help 指令
    ctx.middleware((session, next) => {
        if (session.content === '恶魔兔，启动！') {
            return session.send('启动不了一点')
        } else {
            return next()
        }
    })
}
