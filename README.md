# koishi-plugin-bilibili-notify

[![npm](https://img.shields.io/npm/v/@401u/koishi-plugin-bilibili-notify?style=flat-square)](https://www.npmjs.com/package/@401u/koishi-plugin-bilibili-notify)

基于 [koishi](https://koishi.chat) 框架的B站推送插件


## 功能

订阅B站UP主动态与直播, 在不影响及时推送的基础上，支持更多订阅数量

## 安装使用

1. 搭建koishi平台
2. 搜索关键词`@401u` `bili`即可看到此插件, 点击安装并按提示进行配置后运行插件
3. 使用指令 `bili login` 获取登录二维码，使用B站扫码登录
4. 本插件提供指令包括 `bili` `bilisys` `btest (调试用,默认关闭)`，可直接输入指令查看使用说明

## 注意事项

1. 此插件依赖于 `database`，`cron` 和 `puppeteer` 服务，同时受权限控制，需要具备 `authority:3` 及以上的权限才能使用本插件提供的指令，你可以参考下方配置登录插件中的方法得到一个超级管理员账号（具有 `authority:5` 的最高权限） 

   [配置登录插件](https://koishi.chat/zh-CN/manual/usage/platform.html#%E9%85%8D%E7%BD%AE%E7%99%BB%E5%BD%95%E6%8F%92%E4%BB%B6)

2. 您还可以安装 `admin` 插件，给其他用户授予权限，操作方法请参考下方的权限管理

   [权限管理](https://koishi.chat/zh-CN/manual/usage/customize.html)

3. 指令使用方法请参考 `help bili`，子命令使用方法请加 `-h` ，例如 `bili login -h`
4. 登录方式为二维码，输入命令 `bili login` 之后扫码登录，您的登录凭证将存储在您的本地数据库，并由您自己填写的密钥加密，所以请保管好你的密钥
5. 直播和动态的推送间隔使用cron表达，可自行搜索相关使用说明来定制

## 更新日志

见 [Changlelog](./CHANGELOG.md)

## 感谢

- [koishijs](https://github.com/koishijs/koishi) 官方提供的插件开发框架 及技术指导
- [Akokk0/koishi-plugin-bilibili-notify](https://github.com/Akokk0/koishi-plugin-bilibili-notify) 上游仓库
- [Colter23/bilibili-dynamic-mirai-plugin](https://github.com/Colter23) 灵感来源
- 所有赞助的用户
  ![Sponsors](https://cdn.jsdelivr.net/gh/401U/static/sponsors/cn.svg)
