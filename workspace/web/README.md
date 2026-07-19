# web/ - 前端源码

QQ Bot Platform Web 管理面板，Vue 3 + Element Plus + Monaco Editor。

## 目录结构

```
web/src/
  views/          页面组件
    Dashboard.vue     仪表盘（Bot 状态/系统状态）
    Plugins.vue       插件列表（创建/ZIP上传/启用/编辑/设置/删除）
    PluginEditor.vue  插件代码编辑器（Monaco Editor）
    FileExplorer.vue  文件管理器（浏览/上传/编辑/重命名/删除/下载）
    Groups.vue        群聊管理（成员列表/禁言/踢出/设置名称）
    Trash.vue         回收站（恢复/永久删除/清空）
    Logs.vue          系统日志查看
    Settings.vue      系统设置
    Login.vue         登录页

  components/      公共组件
    SidebarContent.vue 侧边栏菜单

  router/          路由配置
    index.ts          所有页面路由（含认证守卫）

  api/             API 客户端
    index.ts          Axios 封装（自动 Bearer Token）
```

## 开发

```bash
npm run dev        # 启动 Vite 开发服务器（端口 5173）
npm run build      # 生产构建
```

## 技术栈

- Vue 3 + `<script setup>` + TypeScript
- Element Plus UI 组件
- Monaco Editor 代码编辑器
- Axios HTTP 客户端
- Vite 构建工具
- PWA 支持（离线缓存）
