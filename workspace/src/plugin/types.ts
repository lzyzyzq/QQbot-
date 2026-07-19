import { EventBus } from '../core/event-bus';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

export interface PluginStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export interface PluginLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface BotAPI {
  sendMessage(channelId: string, content: string, msgId?: string): Promise<any>;
  sendImageMessage(channelId: string, imageUrl: string, msgId?: string): Promise<any>;
  sendPrivateMessage(openid: string, content: string, msgId?: string): Promise<any>;
  sendGroupMessage(groupOpenid: string, content: string, msgId?: string): Promise<any>;
  sendKeyboardPrivate(openid: string, keyboard: any, msgId?: string): Promise<any>;
  sendKeyboardGroup(groupOpenid: string, keyboard: any, msgId?: string): Promise<any>;
  sendMarkdownPrivate(openid: string, markdown: string, templateId?: number, params?: any[], msgId?: string): Promise<any>;
  sendMarkdownGroup(groupOpenid: string, markdown: string, templateId?: number, params?: any[], msgId?: string): Promise<any>;
  muteMember(groupOpenid: string, memberOpenid: string, durationSecs: number): Promise<any>;
  unmuteMember(groupOpenid: string, memberOpenid: string): Promise<any>;
  kickMember(groupOpenid: string, memberOpenid: string): Promise<any>;
  setAnnouncement(groupOpenid: string, content: string): Promise<any>;
  getStatus(): string;
}

export interface PluginConfig {
  [key: string]: any;
}

export interface PluginEngineAPI {
  enableAllExcept(exceptId: string): Promise<void>;
  disableAllExcept(exceptId: string): Promise<void>;
  isAllOthersEnabled(exceptId: string): boolean;
  isAllOthersDisabled(exceptId: string): boolean;
  callPlugin(name: string, method: string, ...args: any[]): Promise<any>;
}

export interface PluginContext {
  pluginId: string;
  bot: BotAPI;
  eventBus: EventBus;
  logger: PluginLogger;
  storage: PluginStorage;
  config: PluginConfig;
  engine: PluginEngineAPI;
}

export interface Plugin {
  manifest: PluginManifest;
  onLoad?: (ctx: PluginContext) => void | Promise<void>;
  onUnload?: (ctx: PluginContext) => void | Promise<void>;
  onEnable?: (ctx: PluginContext) => void | Promise<void>;
  onDisable?: (ctx: PluginContext) => void | Promise<void>;
  methods?: Record<string, (...args: any[]) => any>;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  loaded: boolean;
  hasError: boolean;
  errorMessage?: string;
  type: string;
  has_webui: boolean;
}
