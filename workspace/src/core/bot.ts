// QQ Bot API 封装核心模块
// 负责：消息发送、群管理、成员操作、Token管理
import { EventBus, BotEvent } from './event-bus';
import { createLogger } from '../utils/logger';
import { getConfig } from '../db/index';
import https from 'https';

const logger = createLogger('bot');

export type BotStatus = 'stopped' | 'connecting' | 'connected' | 'error';

export interface BotConfig {
  appId: string;
  appSecret: string;
}

export interface KeyboardConfig {
  content?: string;
  rows: { buttons: { id?: string; render_data?: { label: string; visited_label: string; style: number }; action?: { type: number; permission?: { type: number }; data: string; enter?: boolean; unsupport_tips?: string } }[] }[];
}

export const MSG_TYPE = {
  TEXT: 0,
  MARKDOWN: 2,
  ARK: 3,
  EMBED: 4,
  KEYBOARD: 2,
};

const QQ_API_BASE = 'api.sgroup.qq.com';

let msgSeqCounter = 0;

// 生成唯一消息ID：时间戳+随机数+计数器，避免重复消息被QQ平台拒绝
function generateMsgId(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 100000);
  msgSeqCounter++;
  return `${ts}_${rand}_${msgSeqCounter}`;
}
const QQ_AUTH_BASE = 'bots.qq.com';

export class BotCore {
  private status: BotStatus = 'stopped';
  private eventBus: EventBus;
  private config: BotConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  getStatus(): BotStatus {
    return this.status;
  }

  getConfig(): BotConfig | null {
    return this.config;
  }

  async start(config?: BotConfig): Promise<void> {
    if (config) this.config = config;
    if (!this.config) {
      const appId = getConfig('bot.app_id');
      const appSecret = getConfig('bot.app_secret');
      if (!appId || !appSecret) throw new Error('BotAppID or BotSecret not configured');
      this.config = { appId, appSecret };
    }

    this.status = 'connecting';
    logger.info('Bot initializing...');

    try {
      await this.refreshAccessToken();
      this.status = 'connected';
      logger.info('Bot ready (webhook mode)');
      this.eventBus.emit('bot.connected', { appId: this.config.appId });
    } catch (err: any) {
      this.status = 'error';
      logger.error(`Bot init failed: ${err.message}`);
      throw err;
    }
  }

  // 刷新 AccessToken（Token 过期前5分钟自动续期）
  private async refreshAccessToken(): Promise<void> {
    const { appId, appSecret } = this.config!;
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return;

    const body = JSON.stringify({ appId, clientSecret: appSecret });
    const result = await this.rawHttp(QQ_AUTH_BASE, 'POST', '/app/getAppAccessToken', body);
    const data = JSON.parse(result);

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    logger.info('Access token refreshed');
  }

  private async ensureToken(): Promise<string> {
    await this.refreshAccessToken();
    return this.accessToken!;
  }

  private rawHttp(
    hostname: string,
    method: string,
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
      if (body) headers['Content-Length'] = String(Buffer.byteLength(body));

      const req = https.request({ hostname, port: 443, path, method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
          } else {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  private async apiCall(method: string, path: string, body?: string): Promise<any> {
    const token = await this.ensureToken();
    const result = await this.rawHttp(QQ_API_BASE, method, path, body, {
      'Authorization': `QQBot ${token}`,
    });
    return JSON.parse(result);
  }

  async stop(): Promise<void> {
    this.accessToken = null;
    this.status = 'stopped';
    logger.info('Bot stopped');
  }

  async sendMessage(channelId: string, content: string, msgId?: string): Promise<any> {
    const body: any = { content, msg_type: 0 };
    if (msgId) body.msg_id = msgId;
    try {
      return await this.apiCall('POST', `/channels/${channelId}/messages`, JSON.stringify(body));
    } catch (err: any) {
      logger.error(`Send message failed: ${err.message}`);
      return null;
    }
  }

  async sendImageMessage(channelId: string, imageUrl: string, _msgId?: string): Promise<any> {
    try {
      return await this.apiCall('POST', `/channels/${channelId}/messages`, JSON.stringify({ image: imageUrl, msg_type: 3 }));
    } catch (err: any) {
      logger.error(`Send image failed: ${err.message}`);
      return null;
    }
  }

  async sendPrivateMessage(openid: string, content: string, msgId?: string): Promise<any> {
    try {
      const body: any = { content, msg_type: 0 };
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/users/${openid}/messages`, JSON.stringify(body));
      logger.info(`Private message sent to ${openid}`);
      return result;
    } catch (err: any) {
      logger.error(`Send private msg failed: ${err.message}`);
      return null;
    }
  }

  // 发送群聊消息
  async sendGroupMessage(groupOpenid: string, content: string, msgId?: string): Promise<any> {
    try {
      const body: any = { content, msg_type: 0 };
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/groups/${groupOpenid}/messages`, JSON.stringify(body));
      logger.info(`GROUP SEND OK: ${JSON.stringify(result).substring(0, 300)}`);
      return result;
    } catch (err: any) {
      logger.error(`Send group msg failed: ${err.message}`);
      return null;
    }
  }

  onEvent(event: BotEvent, handler: (data: any) => void): string {
    return this.eventBus.on(event, handler);
  }

  async sendKeyboardC2C(openid: string, keyboard: KeyboardConfig, msgId?: string): Promise<any> {
    logger.info(`SENDING KEYBOARD C2C: user=${openid}`);
    try {
      const mdContent = keyboard.content || '\u200B';
      const kbRows = keyboard.rows || [];
      const body: any = {
        keyboard: { content: { rows: kbRows } },
        markdown: { content: mdContent },
        msg_type: MSG_TYPE.MARKDOWN,
      };
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/users/${openid}/messages`, JSON.stringify(body));
      logger.info(`Keyboard C2C OK: ${JSON.stringify(result).substring(0, 200)}`);
      return result;
    } catch (err: any) {
      logger.error(`Send keyboard c2c failed: ${err.message}`);
      return null;
    }
  }

  async sendKeyboardGroup(groupOpenid: string, keyboard: KeyboardConfig, msgId?: string): Promise<any> {
    logger.info(`SENDING KEYBOARD GROUP: group=${groupOpenid}`);
    try {
      const mdContent = keyboard.content || '\u200B';
      const kbRows = keyboard.rows || [];
      const body: any = {
        keyboard: { content: { rows: kbRows } },
        markdown: { content: mdContent },
        msg_type: MSG_TYPE.MARKDOWN,
      };
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/groups/${groupOpenid}/messages`, JSON.stringify(body));
      logger.info(`Keyboard GROUP OK: ${JSON.stringify(result).substring(0, 300)}`);
      return result;
    } catch (err: any) {
      logger.error(`Send keyboard group failed: ${err.message}`);
      return null;
    }
  }

  async sendMarkdownC2C(openid: string, markdown: string, templateId?: number, params?: any[], msgId?: string): Promise<any> {
    try {
      const body: any = { msg_type: MSG_TYPE.MARKDOWN, markdown: { content: markdown } };
      if (templateId) body.markdown.custom_template_id = templateId;
      if (params) body.markdown.params = params;
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/users/${openid}/messages`, JSON.stringify(body));
      logger.info(`Markdown C2C OK`);
      return result;
    } catch (err: any) {
      logger.error(`Send markdown c2c failed: ${err.message}`);
      return null;
    }
  }

  async sendMarkdownGroup(groupOpenid: string, markdown: string, templateId?: number, params?: any[], msgId?: string): Promise<any> {
    logger.info(`SENDING MARKDOWN GROUP: group=${groupOpenid}`);
    try {
      const body: any = { msg_type: MSG_TYPE.MARKDOWN, markdown: { content: markdown } };
      if (templateId) body.markdown.custom_template_id = templateId;
      if (params) body.markdown.params = params;
      if (msgId) body.msg_id = msgId;
      const result = await this.apiCall('POST', `/v2/groups/${groupOpenid}/messages`, JSON.stringify(body));
      logger.info(`Markdown GROUP OK`);
      return result;
    } catch (err: any) {
      logger.error(`Send markdown group failed: ${err.message}`);
      return null;
    }
  }

  async muteMember(groupOpenid: string, memberOpenid: string, durationSecs: number): Promise<any> {
    logger.info(`MUTING member=${memberOpenid} group=${groupOpenid} for ${durationSecs}s`);
    try {
      const body: any = { mute_seconds: String(durationSecs) };
      const result = await this.apiCall('PATCH', `/v2/groups/${groupOpenid}/members/${memberOpenid}/mute`, JSON.stringify(body));
      logger.info(`Mute OK`);
      return result;
    } catch (err: any) {
      logger.error(`Mute member failed: ${err.message}`);
      return null;
    }
  }

  async unmuteMember(groupOpenid: string, memberOpenid: string): Promise<any> {
    return this.muteMember(groupOpenid, memberOpenid, 0);
  }

  async kickMember(groupOpenid: string, memberOpenid: string): Promise<any> {
    logger.info(`KICKING member=${memberOpenid} from group=${groupOpenid}`);
    try {
      const result = await this.apiCall('DELETE', `/v2/groups/${groupOpenid}/members/${memberOpenid}`);
      logger.info(`Kick OK`);
      return result;
    } catch (err: any) {
      logger.error(`Kick member failed: ${err.message}`);
      return null;
    }
  }

  async setAnnouncement(groupOpenid: string, content: string): Promise<any> {
    logger.info(`SETTING ANNOUNCEMENT group=${groupOpenid}`);
    try {
      const body = JSON.stringify({ content, msg_type: MSG_TYPE.MARKDOWN, markdown: { content: '# 群公告\n\n' + content } });
      const result = await this.apiCall('POST', `/v2/groups/${groupOpenid}/messages`, body);
      logger.info(`Announcement sent OK`);
      return result;
    } catch (err: any) {
      logger.error(`Set announcement failed: ${err.message}`);
      return null;
    }
  }

  async getGroupMembers(groupOpenid: string): Promise<any[]> {
    try {
      const result = await this.apiCall('GET', `/v2/groups/${groupOpenid}/members`);
      return result.members || [];
    } catch (err: any) {
      logger.error(`Get group members failed: ${err.message}`);
      return [];
    }
  }
}

let botInstance: BotCore | null = null;

export function getBot(): BotCore {
  if (!botInstance) throw new Error('BotCore not initialized');
  return botInstance;
}

export function createBot(eventBus: EventBus): BotCore {
  botInstance = new BotCore(eventBus);
  return botInstance;
}
