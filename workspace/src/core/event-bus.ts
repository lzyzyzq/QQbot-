import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('event-bus');

type EventHandler = (data: any) => void | Promise<void>;

interface Listener {
  id: string;
  event: string;
  handler: EventHandler;
}

const BUILT_IN_EVENTS = [
  'message.group',
  'message.c2c',
  'message.guild',
  'guild.member.add',
  'guild.member.remove',
  'bot.connected',
  'bot.disconnected',
  'plugin.loaded',
  'plugin.unloaded',
  'plugin.enabled',
  'plugin.disabled',
  'plugin.error',
] as const;

export type BotEvent = (typeof BUILT_IN_EVENTS)[number] | string;

export class EventBus {
  private listeners: Listener[] = [];

  on(event: BotEvent, handler: EventHandler): string {
    const id = uuidv4();
    this.listeners.push({ id, event, handler });
    logger.debug(`Listener ${id} registered for event: ${event}`);
    return id;
  }

  off(listenerId: string): void {
    const before = this.listeners.length;
    this.listeners = this.listeners.filter((l) => l.id !== listenerId);
    if (this.listeners.length < before) {
      logger.debug(`Listener ${listenerId} removed`);
    }
  }

  async emit(event: BotEvent, data: any): Promise<void> {
    const matched = this.listeners.filter((l) => l.event === event);
    if (matched.length === 0) {
      logger.info(`No listeners for event: ${event}`);
      return;
    }

    logger.info(`Emitting event: ${event} to ${matched.length} listeners`);

    for (const listener of matched) {
      try {
        await listener.handler(data);
      } catch (err) {
        logger.error(`Error in listener ${listener.id} for event ${event}: ${String(err)}`);
      }
    }
  }

  removeAll(): void {
    this.listeners = [];
  }

  getListenerCount(event?: BotEvent): number {
    if (event) {
      return this.listeners.filter((l) => l.event === event).length;
    }
    return this.listeners.length;
  }
}

export const eventBus = new EventBus();
export { BUILT_IN_EVENTS };
