# QQ Bot Platform 更新日志

## 2026-07-19

### 修复
- **纯文本消息发送失败**: `sendGroupMessage`/`sendPrivateMessage` 不再强制生成 `msg_id`，QQ API v2 不接受自定义格式的 msg_id（错误码 40034024）
- **超级主人识别失败**: `getSuper()` 改为 `JSON.parse()` 解析存储的 JSON 对象，兼容纯字符串回退
- **插件 API 增强**: `PluginContext` 新增 `pluginId` 字段，引擎新增 `isAllOthersEnabled`/`isAllOthersDisabled` 方法
- **开机/关机响应**: 修复插件调用不存在的 `ctx.db`/`ctx.engine.getAllPlugins()` 导致的 `onEnable` 崩溃
- **已开机/已关机状态反馈**: 重复开机/关机时返回状态提示而非无响应

### 新增
- **主人列表动态显示**: 电源插件新增「主人列表」命令，从存储读取真实 QQ 号动态生成响应
- **一键部署脚本**: `deploy.sh` 支持宝塔面板一键部署

---

## 2026-07-18

### 新增
- **ZIP 插件支持**: 支持上传 ZIP 格式插件包（含 `package.json`、`index.mjs`、`webui/`）
- **插件 WebUI 设置页**: ZIP 插件可包含 `webui/index.html` 设置页面，网页端直接点击「设置」按钮打开
- **插件互调系统**: `ctx.engine.callPlugin(name, method, ...args)` 实现插件间方法调用
- **模块化插件体系**: 主菜单/签到系统/娱乐中心/群管理工具/授权码系统按功能模块拆分
- **群成员本地追踪**: 通过 `GROUP_MEMBER_ADD`/`GROUP_MEMBER_REMOVE` 事件 + 消息发件人记录成员
- **回收站系统**: 文件删除支持软删除（移入回收站保留2天自动清理）

### 修复
- **群成员列表 HTTP 405**: QQ API 无获取群成员接口，改为本地数据库追踪
- **消息去重错误**: 每次发送自动生成唯一 `msg_id`，避免重复消息被 QQ 平台拒绝
- **种子数据编译错误**: 修复 `seed.ts` 反引号字符导致的 TypeScript 编译问题

### 优化
- 群成员管理页面显示 QQ 号、昵称信息
- 插件列表显示类型（代码/ZIP）和 WebUI 入口
- 文件管理器新增删除按钮（永久删除/移入回收站）

---

## 2026-07-17

### 新增
- 文件浏览器 API（上传/下载/重命名/删除/目录浏览）
- 群聊管理页面（成员禁言/解禁/踢出）
- 文件上传支持 ZIP 自动解压
- 插件代码编辑器保存后自动导出到 `plugins/` 目录
- 启动时从 `plugins/*.js` 加载文件系统插件（按名称去重）

### 修复
- 超级主人 ID 配置修正
- 键盘消息格式修正（`rows: [{buttons: [btn]}]`）
- 权限拒绝提示优化
- 插件引擎中文名加载支持
- Vue 3 模板引用修复（`$refs` -> `const x = ref(null)`）
