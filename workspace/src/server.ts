import express from 'express';
import path from 'path';
import { initDb, closeDb, getConfig, setConfig, getDb } from './db/index';
import { seedExamplePlugins } from './db/seed';
import { EventBus } from './core/event-bus';
import { createBot, getBot } from './core/bot';
import { WebhookManager } from './core/webhook';
import { PluginEngine } from './plugin/engine';
import { setPluginEngine, getPluginEngine } from './api/index';
import { authMiddleware } from './middleware/auth';
import authRoutes from './api/auth';
import botRoutes from './api/bot';
import pluginRoutes from './api/plugin';
import logRoutes from './api/log';
import authCodesRoutes from './api/auth-codes';
import timeOffsetRoutes from './api/time-offset';
import filesRoutes from './api/files';
import groupsRoutes, { recordGroupActivity } from './api/groups';

import * as fs from 'fs';
import { createLogger } from './utils/logger';

const logger = createLogger('server'); // 服务器日志记录器

// 全局核心组件实例
let pluginEngine: PluginEngine;
let webhookManager: WebhookManager;
let eventBus: EventBus;

/**
 * 获取 Webhook 管理器实例（懒加载）
 */
export function getWebhookManager(): WebhookManager {
  return webhookManager;
}

/**
 * 重置 Webhook 管理器（用于配置变更后重新初始化）
 */
export function resetWebhookManager(): void {
  webhookManager = undefined as any;
  logger.info('WebhookManager reset, will reinitialize on next webhook');
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ---------- QQ 机器人 Webhook 回调（必须放在 express.json() 之前，使用原始 body 做 Ed25519 验签） ----------
app.post('/qq/webhook', express.raw({ type: '*/*' }), (req, res) => {
  try {
    // 若尚未初始化，则创建 WebhookManager（依赖 eventBus）
    let whManager = getWebhookManager();
    if (!whManager) {
      try {
        whManager = new WebhookManager(eventBus);
        webhookManager = whManager;
        logger.info('WebhookManager lazily initialized');
      } catch (err: any) {
        logger.warn(`Webhook not available: ${err.message}`);
        res.status(503).json({ error: 'Webhook not configured' });
        return;
      }
    }

    // 获取签名头
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const signature = req.headers['x-signature-ed25519'] as string;

    // 将原始 body 转换为字符串（Buffer 或字符串）
    const rawBody = req.body instanceof Buffer
      ? req.body.toString('utf8')
      : String(req.body || '');

    // 如果提供了签名头，则进行验证
    if (timestamp && signature) {
      const valid = whManager.verifySignature(timestamp, rawBody, signature);
      if (!valid) {
        logger.warn('Webhook signature verification failed');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
      logger.info(`Webhook signature verified OK, body ${rawBody.length} bytes`);
    }

    // 解析 JSON 载荷
    const payload = JSON.parse(rawBody);
    const result = whManager.handleEvent(payload);

    // 对于 op=0 的事件（业务事件），异步分发给插件，不阻塞 HTTP 响应
    if (payload.op === 0) {
      logger.info(`Webhook op=0 received, type=${payload.t}, dispatching async`);
      whManager.dispatchEvent(payload).catch((err: any) => {
        logger.error(`Event dispatch error: ${err.message}`);
      });
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`Webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ---------- 通用中间件 ----------
app.use(express.json({ limit: '10mb' }));      // JSON 解析，限制大小 10MB
app.use(express.urlencoded({ extended: true })); // URL 编码解析

// API 认证中间件（保护所有 /api 路由）
app.use(authMiddleware);

// ---------- API 路由挂载 ----------
app.use('/api', authRoutes);          // 认证相关（登录、密码修改等）
app.use('/api', botRoutes);           // 机器人控制（启动、停止、状态等）
app.use('/api', pluginRoutes);        // 插件管理（加载、卸载、列表等）
app.use('/api', logRoutes);           // 日志查看
app.use('/api', authCodesRoutes);     // 授权码管理
app.use('/api', timeOffsetRoutes);    // 时间偏移配置
app.use('/api', filesRoutes);         // 文件管理
app.use('/api', groupsRoutes);        // 群组管理（记录活动等）

// ---------- 前端静态文件托管 ----------
const webDist = path.resolve(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist)); // 提供静态资源

// 所有未匹配的路由返回前端入口页面（SPA 支持）
app.get('*', (_req, res) => {
  const indexPath = path.join(webDist, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('QQ Bot Platform - Web frontend not built. Run: npm run build:web');
  }
});

// ---------- 主启动函数 ----------
async function main() {
  logger.info('Starting QQ Bot Platform...');

  // 1. 初始化 SQLite 数据库
  initDb();
  logger.info('Database initialized');

  // 2. 首次启动时植入示例插件（若表为空）
  seedExamplePlugins();

  // 3. 确保管理员密码存在（若无则设置默认密码）
  let adminPassword = getConfig('admin.password');
  if (!adminPassword) {
    adminPassword = 'YZQ5201314..';
    setConfig('admin.password', adminPassword as string);
  }
  logger.info(`Admin password configured`);

  // 4. 创建事件总线（核心消息分发）
  eventBus = new EventBus();
  const bot = createBot(eventBus); // 创建机器人实例

  // 5. 创建 Webhook 管理器（用于接收 QQ 平台推送）
  try {
    webhookManager = new WebhookManager(eventBus);
  } catch (err: any) {
    logger.warn(`Webhook not available: ${err.message}`);
  }

  // 6. 创建插件引擎，并注入机器人操作函数
  pluginEngine = new PluginEngine(eventBus, {
    sendMessage: (channelId, content, msgId) => bot.sendMessage(channelId, content, msgId),
    sendImageMessage: (channelId, imageUrl, msgId) => bot.sendImageMessage(channelId, imageUrl, msgId),
    sendPrivateMessage: (openid, content, msgId) => bot.sendPrivateMessage(openid, content, msgId),
    sendGroupMessage: (groupOpenid, content, msgId) => bot.sendGroupMessage(groupOpenid, content, msgId),
    sendKeyboardPrivate: (openid, keyboard, msgId) => bot.sendKeyboardC2C(openid, keyboard, msgId),
    sendKeyboardGroup: (groupOpenid, keyboard, msgId) => bot.sendKeyboardGroup(groupOpenid, keyboard, msgId),
    sendMarkdownPrivate: (openid, markdown, templateId, params, msgId) => bot.sendMarkdownC2C(openid, markdown, templateId, params, msgId),
    sendMarkdownGroup: (groupOpenid, markdown, templateId, params, msgId) => bot.sendMarkdownGroup(groupOpenid, markdown, templateId, params, msgId),
    muteMember: (groupOpenid, memberOpenid, durationSecs) => bot.muteMember(groupOpenid, memberOpenid, durationSecs),
    unmuteMember: (groupOpenid, memberOpenid) => bot.unmuteMember(groupOpenid, memberOpenid),
    kickMember: (groupOpenid, memberOpenid) => bot.kickMember(groupOpenid, memberOpenid),
    setAnnouncement: (groupOpenid, content) => bot.setAnnouncement(groupOpenid, content),
    getStatus: () => bot.getStatus(),
  });
  setPluginEngine(pluginEngine); // 将插件引擎注册到全局

  // 7. 从 plugins/ 文件夹加载所有插件（DB 只存元数据，代码源文件在磁盘）
  await pluginEngine.loadAllFromDb();

  // 8. 如果已配置机器人凭证，则自动启动机器人
  const existingAppId = getConfig('bot.app_id');
  if (existingAppId) {
    try {
      await bot.start();
      logger.info('Bot auto-started with existing credentials');
    } catch (err: any) {
      logger.warn(`Bot auto-start failed: ${err.message}, start via /api/bot/start`);
    }
  }

  // 10. 启动 HTTP 服务器
  app.listen(PORT, () => {
    logger.info(`Server running at http://localhost:${PORT}`);
    logger.info(`Admin password: ${adminPassword}`);
  });

  // 11. 优雅关闭（SIGINT / SIGTERM）
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await bot.stop();
    await pluginEngine.shutdown();
    closeDb();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await bot.stop();
    await pluginEngine.shutdown();
    closeDb();
    process.exit(0);
  });
}

// 启动程序，捕获并处理启动失败异常
main().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  closeDb();
  process.exit(1);
});