// Webhook 接收模块
// 接收 QQ Bot 消息回调 → 验证签名 → 解析事件 → 分发到 EventBus
// 同时追踪群成员加入/退出，记录到本地 group_members 表
import { EventBus } from './event-bus';
import { createLogger } from '../utils/logger';
import { getConfig, getDb } from '../db/index';
import { recordGroupActivity } from '../api/groups';
import nacl from 'tweetnacl';

const logger = createLogger('webhook');

function ensureGroupMembersTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      member_openid TEXT NOT NULL,
      qq_id TEXT DEFAULT '',
      nickname TEXT DEFAULT '',
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, member_openid)
    );
  `);
}

function recordMember(groupId: string, memberOpenid: string, qqId?: string, nickname?: string) {
  try {
    ensureGroupMembersTable();
    getDb().prepare(`
      INSERT INTO group_members (group_id, member_openid, qq_id, nickname, last_seen)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(group_id, member_openid) DO UPDATE SET
        qq_id = CASE WHEN excluded.qq_id != '' THEN excluded.qq_id ELSE qq_id END,
        nickname = CASE WHEN excluded.nickname != '' THEN excluded.nickname ELSE nickname END,
        last_seen = CURRENT_TIMESTAMP
    `).run(groupId, memberOpenid, qqId || '', nickname || '');
  } catch {}
}

function removeMember(groupId: string, memberOpenid: string) {
  try {
    ensureGroupMembersTable();
    getDb().prepare('DELETE FROM group_members WHERE group_id = ? AND member_openid = ?').run(groupId, memberOpenid);
  } catch {}
}

export class WebhookManager {
  private eventBus: EventBus;
  private publicKey: Uint8Array;
  private privateKey: Uint8Array;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    const secret = getConfig('bot.app_secret');
    if (!secret) throw new Error('BotSecret not configured');

    const keys = WebhookManager.deriveKeys(secret);
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;

    logger.info('WebhookManager initialized');
  }

  static deriveKeys(botSecret: string): { publicKey: Uint8Array; privateKey: Uint8Array } {
    let seed = botSecret;
    while (seed.length < 32) {
      seed = seed.repeat(2);
    }
    seed = seed.substring(0, 32);
    const seedBytes = Buffer.from(seed, 'utf8');
    const keyPair = nacl.sign.keyPair.fromSeed(seedBytes);
    return { publicKey: keyPair.publicKey, privateKey: keyPair.secretKey };
  }

  handleValidation(payload: any): { plain_token: string; signature: string } {
    const { plain_token, event_ts } = payload.d;
    const msg = Buffer.from(`${event_ts}${plain_token}`, 'utf8');
    const signature = nacl.sign.detached(msg, this.privateKey);
    const sigHex = Buffer.from(signature).toString('hex');
    logger.debug(`URL validation: token=${plain_token}`);
    return { plain_token, signature: sigHex };
  }

  verifySignature(timestamp: string, body: string, signatureHex: string): boolean {
    const signature = Buffer.from(signatureHex, 'hex');
    const msg = Buffer.from(`${timestamp}${body}`, 'utf8');
    return nacl.sign.detached.verify(msg, signature, this.publicKey);
  }

  handleEvent(payload: any): any {
    const { op } = payload;

    if (op === 13) {
      return this.handleValidation(payload);
    }

    if (op === 0) {
      return { op: 12 };
    }

    return {};
  }

  async dispatchEvent(payload: any): Promise<void> {
    const { d, t } = payload;
    const eventType = t || 'UNKNOWN';
    logger.info(`Webhook dispatch: type=${eventType} content="${(d.content || '').substring(0, 80)}" group_openid=${d.group_openid || 'N/A'} authorId=${d.author?.user_openid || d.author?.member_openid || d.author?.id || 'N/A'}`);

    const authorId = d.author?.user_openid || d.author?.member_openid || d.author?.id;
    const qqId = d.author?.id || '';
    const authorData = {
      id: authorId,
      openid: d.author?.user_openid || d.author?.member_openid || authorId,
      qqId: qqId,
      member_openid: d.author?.member_openid || '',
      username: d.author?.username || '',
    };

    switch (eventType) {
      case 'C2C_MESSAGE_CREATE':
        await this.eventBus.emit('message.c2c', {
          id: d.id,
          content: d.content,
          author: authorData,
          timestamp: d.timestamp,
        });
        logger.info(`C2C event dispatched: content="${(d.content || '').substring(0, 40)}"`);
        break;
      case 'GROUP_AT_MESSAGE_CREATE':
      case 'GROUP_MESSAGE_CREATE':
        logger.info(`Group event: groupId=${d.group_openid} authorId=${authorId} content="${(d.content || '').substring(0, 40)}"`);
        recordGroupActivity(d.group_openid || d.group_id);
        recordMember(d.group_openid || d.group_id, authorId, qqId, d.author?.username || '');
        await this.eventBus.emit('message.group', {
          id: d.id,
          content: d.content,
          author: authorData,
          groupId: d.group_openid || d.group_id,
          timestamp: d.timestamp,
        });
        break;
      case 'AT_MESSAGE_CREATE':
      case 'MESSAGE_CREATE':
        await this.eventBus.emit('message.guild', {
          id: d.id,
          content: d.content,
          author: authorData,
          channelId: d.channel_id,
          guildId: d.guild_id,
          timestamp: d.timestamp,
        });
        break;
      case 'DIRECT_MESSAGE_CREATE':
        await this.eventBus.emit('message.c2c', {
          id: d.id,
          content: d.content,
          author: authorData,
          guildId: d.guild_id,
          timestamp: d.timestamp,
        });
        break;
      case 'FRIEND_ADD':
        await this.eventBus.emit('friend.add', d);
        break;
      case 'GROUP_ADD_ROBOT':
        await this.eventBus.emit('group.add', d);
        break;
      case 'GROUP_MEMBER_ADD': {
        const gid = d.group_openid;
        const mid = d.member_openid || d.op_member_openid;
        if (gid && mid) {
          recordMember(gid, mid);
          recordGroupActivity(gid);
          logger.info(`Group member added: group=${gid} member=${mid}`);
        }
        break;
      }
      case 'GROUP_MEMBER_REMOVE': {
        const gid = d.group_openid;
        const mid = d.member_openid || d.op_member_openid;
        if (gid && mid) {
          removeMember(gid, mid);
          recordGroupActivity(gid);
          logger.info(`Group member removed: group=${gid} member=${mid}`);
        }
        break;
      }
      default:
        logger.debug(`Unhandled event: ${eventType}`);
    }
  }
}
