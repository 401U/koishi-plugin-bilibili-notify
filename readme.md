# Bilibili-Notify

基于 [koishi](../../../../koishijs/koishi) 框架的B站推送插件

---

- koishi-plugin-bilibili-notify [![npm](https://img.shields.io/npm/v/koishi-plugin-bilibili-notify?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-bilibili-notify)
  - [功能](#功能)
  - [安装](#安装)
  - [使用方法](#使用方法)
  - [注意事项](#注意事项)
  - [更新日志](#更新日志)
  - [交流群](#交流群)
  - [感谢](#感谢)
  - [License](#License)

## 功能

订阅B站UP主动态

订阅B站UP主直播

## 安装

1. 下载插件运行平台 [Koishi](https://koishi.chat/)
2. 在插件平台的 **`插件市场`** 中搜索 **`bilibili-notify`** 并安装

## 使用方法

登录B站：进行任何操作前，请先登录B站

- 使用指令 `bili login` 获取登录二维码，使用B站扫码登录

订阅UP主：订阅你想要推送的UP主

- 使用指令 `bili sub <uid> [Q群号]` 订阅需要订阅的UP主
- 参数说明：
  - `uid` 为必填参数，为 `up主` 的  `uid` 
  - `Q群号` 为可选参数，可以添加多个，如果Q群号为 `all` 则会向机器人加入的所有群聊推送
- 选项说明：`bili sub <uid>` 有两个选项：-l 和 -d
  - `-l` 为订阅UP主直播间，包括直播开播通知，定时推送直播内容，下播通知
  - `-d` 为订阅UP主动态推送，目前实现推送的动态类型有：普通图文动态，转发动态，直播预约动态

- 例如：
  - `bili sub 1194210119 ` 订阅UID为1194210119的UP主
  - `bili sub 1194210119 -d` 订阅UID为1194210119的UP主动态推送
  - `bili sub 1194210119 -ld` 订阅UID为1194210119的UP主动态推送和直播间
  - `bili sub 1194210119 1234567 2345678` 订阅UID为1194210119的UP主，向Q群号为1234567和2345678两个群进行推送
  - `bili sub 1194210119 all` 订阅UID为1194210119的UP主，向机器人加入的所有群聊进行推送
- Tips:
  - 除非使用指令 `bili sub 1194210119 -ld` ，没有加选项或只加了一个选项的指令都会再次询问是否需要订阅另一项。例如：使用指令 `bili sub 1194210119 -d` 机器人会询问是否需要订阅直播间
  - `[Q群号]` 这个可选参数仅支持Q群

取消订阅UP主：取消订阅不需要推送的UP主

- 使用指令 `bili unsub <uid>` 取消订阅不需要订阅的UP主
- 参数说明：`uid` 为必填参数，为 `up主` 的 `uid`
- 选项说明：`bili unsub <uid>` 有两个选项：-l 和 -d
  - `-l` 为取消订阅UP主直播间
  - `-d` 为取消订阅UP主动态
- 例如：
  - `bili unsub 123456` 取消订阅UID为123456的UP主动态推送和直播间
  - `bili unsub 123456 -d` 取消订阅UID为123456的UP主动态推送
  - `bili unsub 123456 -dl` 取消订阅UID为123456的UP主动态推送和直播间

查看目前已订阅的UP主：

- 使用指令 `bili show`

## 注意事项

1. 此插件依赖于 `database` 和 `puppeteer` 服务，同时受权限控制，需要具备 `authority:3` 及以上的权限才能使用本插件提供的指令，你可以参考下方配置登录插件中的方法得到一个超级管理员账号（具有 `authority:5` 的最高权限） 

   [配置登录插件](https://koishi.chat/zh-CN/manual/usage/platform.html#%E9%85%8D%E7%BD%AE%E7%99%BB%E5%BD%95%E6%8F%92%E4%BB%B6)

2. 您还可以安装 `admin` 插件，给其他用户授予权限，操作方法请参考下方的权限管理

   [权限管理](https://koishi.chat/zh-CN/manual/usage/customize.html)

3. 指令使用方法请参考 `help bili`，子命令使用方法请加 `-h` ，例如 `bili login -h`
4. 登录方式为二维码，输入命令 `bili login` 之后扫码登录，您的登录凭证将存储在您的本地数据库，并由您自己填写的密钥加密，所以请保管好你的密钥

## 更新日志

- ver 1.0.1 修复了一些bug，提供用户自己选择动态检测时间的选项
- ver 1.0.2 修复时间bug和字体乱码问题
- ver 1.0.3 修复了一些bug，提供用户自己选择推送卡片字体样式的选项
- ver 1.0.4 修复了重复推送的bug，提供用户选择推送卡片渲染方式的选项
- ver 1.0.5 修复了用户非法篡改数据库内容可能导致程序异常运行的bug，修复了UP主开播动态推送空白卡片的bug
- ver 1.0.6 修复了转发动态转发信息出现`undefined`的bug，修复了再次登录订阅显示错误的bug，优化了动态推送的逻辑
- ver 1.0.7 修复了在已登录情况下，再次登录会导致重复订阅和提示用户未订阅任何UP主的提示（实际上已订阅）的bug，新增了订阅对象在控制台的显示，优化了`bili show`指令的逻辑
- ver 1.0.8 修复了取消订阅的bug
- ver 1.0.9 更新请求客户端header信息。优化了动态推送卡片的页面布局，增加了字体大小。提供用户开放订阅数量限制的选项，提供用户移除推送卡片边框的选项。在控制台页面增加订阅信息提示
- ver 1.0.10 增加对`onebot`的支持，添加动态关键字屏蔽功能
- ver 1.0.11 修复了`render`渲染模式下，动态重复推送的问题，修复了没有订阅时，控制台空白提示的问题。优化了视频动态缩略图显示不全的问题，优化了部分逻辑。增强容错和增加错误提示
- ver 1.0.12 提供用户选择动态推送卡片字体增大的选项
- ver 1.0.13 修复了直播通知卡片连续发三次的bug，修复了多次调用指令 `bili login` 产生的bug
- ver 1.0.14 修复了获取二维码，二维码失效后会多次发送提示的bug，新增对`red`的支持，新增开播艾特全体成员功能，优化了部分逻辑
- ver 1.1.0-alpha.0 修复了直播订阅一段时间过后提示房间不存在的bug，修复了自动登录刷新错误的bug
- ver 1.1.0-beta.0 修复了一个bug(如果本身已经存在乱码问题的情况下，使用page模式仍然会乱码)，修复了日志bug
- ver 1.1.0-rc.0 修复了订阅用户直播一段时间后提示用户直播间不存在并自动取消订阅的bug
- ver 1.1.0 移除了直播艾特全体成员选项实验性的标志，优化了直播房间号的获取逻辑，移除了部分测试代码
- ver 1.1.1 新增依赖axios
- ver 1.1.2 修复了对red协议支持的一个bug
- ver 1.2.0-alpha.0 对自动更新登录信息的功能做了提升，修复了一些bug
- ver 1.2.0-alpha.1 对推送进行了改进：在开启直播开播艾特全体成员的情况下，发送图片后才会艾特全体成员
- ver 1.2.0-alpha.2 支持QQ群多群推送(实验性)，修复了一些bug
- ver 1.2.0-alpha.3 修复了指定QQ群订阅时的一个bug
- ver 1.2.0-alpha.4 对时间获取进行了优化，能够适应不同环境下的时间获取，修复了一些bug
- ver 1.2.0-alpha.5 修复了与PostgreSQL不兼容的问题，优化了图片推送，增强了推送容错
- ver 1.2.0-rc.0 现已支持自定义开播和下播提示语(实验性)
- ver 1.2.0-rc.1 现已支持Telegram平台(实验性)
- ver 1.2.0-rc.2 添加更多日志输出
- ver 1.2.0-rc.3 针对Telegram的bug测试版本
- ver 1.2.0-rc.4 修复了订阅指令的一个bug
- ver 1.2.0-rc.5 屏蔽动态设置新增是否发送动态被屏蔽消息的选项
- ver 1.2.0 添加屏蔽转发动态功能，添加发送动态卡片时附带文本信息和动态链接功能，支持订阅哔哩哔哩番剧出差
- ver 1.2.1 现已支持Satori平台(实验性)
- ver 1.2.2-alpha.0 bug测试
- ver 1.2.2-beta.0 修复重启koishi后，提示没有任何订阅的bug，新增对chronocat的支持(实验性)
- ver 1.2.2-beta.1 现已支持直播开播发送链接(实验性)
- ver 1.2.2-beta.2 修复了动态推送时图片下方出现空行的情况
- ver 1.2.3-alpha.0 新增主人账号功能，开启后，会将插件的错误消息向主人账号发送(实验性)。修复订阅消息推送失败刷屏的bug
- ver 1.2.3-beta.0 优化错误推送逻辑，现在只有设置主人账号后才会推送错误消息
- ver 1.2.3-beta.1 新增指令 `bili private` 方便测试主人账号功能
- ver 1.2.3-beta.2 功能测试版本，请跳过该版本
- ver 1.2.3-rc.0 现已支持向机器人加入的所有群发送推送消息(仅支持Q群，实验性)，修复预约动态无法正常推送的bug
- ver 1.2.3-rc.1 修复 `1.2.3-rc.0` 出现的重复推送bug
- ver 1.2.3-rc.2 bug测试版本，请跳过
- ver 1.2.3-rc.3 bug测试版本，请跳过
- ver 1.2.3-rc.4 bug测试版本，请跳过
- ver 1.2.3-rc.5 修复了第一次使用插件时，扫码登录后没有任何反应，并且仍提示没有登录的bug
- ver 1.2.3-rc.6 bug测试版本，请跳过
- ver 1.2.3-rc.7 尝试修复多群推送时部分群未推送的bug
- ver 1.2.3-rc.8 修复在 `1.2.3-rc.7` 版本引入的连续推送三次的bug
- ver 1.2.3-rc.9 完善了插件出错时的日志输出
- ver 1.2.3-rc.10 修复不能移除边框的bug，对图片布局进行了调整，新增下播消息发送主播头像
- ver 1.2.3-rc.11 测试版本，请跳过
- ver 1.2.3 完善主播下播消息发送头像功能，优化控制台订阅信息显示
- ver 1.2.4 优化了下播消息发送头像图片的质量和插件重启提示
- ver 1.2.5 修复了在多群订阅的情况下，其中一个群推送失败会导致其余的群全部重新推送的bug。更换图片处理依赖以解决在插件市场中被标记为不安全插件的问题
- ver 1.2.6 现在可以随机生成UA，并更新了UA
- ver 1.2.7 修复不论选择什么渲染模式都是render模式的bug，优化直播卡片推送逻辑
- ver 1.2.8 修复例如像UP主籽岷使用webp格式的头像，下播通知无法发出的bug

## 交流群

801338523 使用问题或bug都可以在群里提出

## 感谢

感谢 [koishijs](https://github.com/koishijs/koishi) 官方提供的插件开发框架, 以及技术指导

## License

MIT