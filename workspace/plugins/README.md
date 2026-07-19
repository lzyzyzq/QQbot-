# plugins/ - 插件目录

存放 QQ Bot Platform 插件代码。启动时自动扫描 `.js` 文件，数据库无同名插件时自动加载。

## 插件格式

插件是 Node.js 模块，通过 `module.exports` 导出：

```javascript
module.exports = {
  manifest: { id, name, version, description, author },

  // 公开方法（可被其他插件通过 callPlugin() 调用）
  methods: {
    handleCommand: function(ctx, data) { ... },
  },

  // 生命周期钩子
  onLoad:    function(ctx) { ... },   // 首次加载
  onEnable:  function(ctx) { ... },   // 启用（注册事件监听）
  onDisable: function(ctx) { ... },   // 禁用（清理资源）
  onUnload:  function(ctx) { ... },   // 完全卸载
};
```

## ctx 对象

插件通过 `ctx` 访问平台能力：

| 属性 | 说明 |
|------|------|
| `ctx.bot` | 机器人 API（发送消息/群管理） |
| `ctx.eventBus` | 事件总线（监听消息/群事件） |
| `ctx.logger` | 日志（info/warn/error/debug） |
| `ctx.storage` | KV 持久化存储（get/set/delete） |
| `ctx.engine` | 引擎 API（enableAllExcept/disableAllExcept/callPlugin） |

## 插件互调

```javascript
// 调用其他插件的公开方法
await ctx.engine.callPlugin('签到系统', 'handleCommand', data);
```

## 模块化插件列表

| 插件 | 功能 |
|------|------|
| 主菜单.js | 导航中枢，系统命令（开机/关机/全景） |
| 签到系统.js | 每日签到 + 积分 + 个人信息 |
| 娱乐中心.js | 笑话/运势/骰子/猜数字 |
| 群管理工具.js | 禁言/解禁/踢人/全部解禁 |
| 开关机控制.js | 原版一体化插件（向后兼容） |
