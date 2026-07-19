import { EventBus } from '../core/event-bus';
import { Plugin, PluginInfo, PluginContext, BotAPI, PluginStorage, PluginEngineAPI } from './types';
import { PluginSandbox } from './sandbox';
import { getDb } from '../db/index';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const logger = createLogger('plugin-engine');

export class PluginEngine {
  private plugins: Map<string, { plugin: Plugin; ctx: PluginContext; loaded: boolean; error?: string }> = new Map();
  private eventBus: EventBus;
  private botApi: BotAPI;
  private pluginsDir: string;

  constructor(eventBus: EventBus, botApi: BotAPI, pluginsDir?: string) {
    this.eventBus = eventBus;
    this.botApi = botApi;
    this.pluginsDir = pluginsDir || path.resolve(process.cwd(), 'plugins');

    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  list(): PluginInfo[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM plugins ORDER BY created_at DESC').all() as any[];

    return rows.map((row) => {
      const loaded = this.plugins.has(row.id);
      const pluginEntry = this.plugins.get(row.id);
      return {
        id: row.id,
        name: row.name,
        version: String(row.version),
        description: row.description || '',
        author: 'user',
        enabled: row.enabled === 1,
        loaded,
        hasError: pluginEntry ? !!pluginEntry.error : false,
        errorMessage: pluginEntry?.error,
        type: row.type || 'code',
        has_webui: (row.has_webui === 1),
      };
    });
  }

  // 从 ZIP 包创建插件：解压 → 解析 package.json → 找到入口文件 → 写入数据库
  async createFromZip(id: string, zipPath: string): Promise<PluginInfo> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    const pluginDir = path.join(this.pluginsDir, id);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }
    zip.extractAllTo(pluginDir, true);

    let pkg: any = {};
    const pkgPath = path.join(pluginDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
    }

    const name = pkg.name || path.basename(pluginDir);
    const description = pkg.description || '';
    const entryFile = fs.existsSync(path.join(pluginDir, 'index.mjs'))
      ? 'index.mjs' : 'index.js';
    const entryPath = path.join(pluginDir, entryFile);
    if (!fs.existsSync(entryPath)) {
      throw new Error('Plugin entry point not found: index.mjs or index.js');
    }

    const code = fs.readFileSync(entryPath, 'utf-8');
    const hasWebui = fs.existsSync(path.join(pluginDir, 'webui'))
      && fs.existsSync(path.join(pluginDir, 'webui', 'index.html'));

    const db = getDb();
    const existing = db.prepare('SELECT id FROM plugins WHERE id = ?').get(id);
    if (existing) {
      db.prepare(
        'UPDATE plugins SET name=?, description=?, code=?, type=?, source_path=?, has_webui=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).run(name, description, code, 'zip', pluginDir, hasWebui ? 1 : 0, id);
    } else {
      db.prepare(
        'INSERT INTO plugins (id, name, description, code, enabled, version, type, source_path, has_webui) VALUES (?,?,?,?,0,1,?,?,?)'
      ).run(id, name, description, code, 'zip', pluginDir, hasWebui ? 1 : 0);
    }

    return {
      id, name, version: pkg.version || '1.0.0',
      description, author: pkg.author || 'user',
      enabled: false, loaded: false, hasError: false,
      type: 'zip', has_webui: hasWebui,
    };
  }

  async loadFromCode(id: string, name: string, code: string, description?: string, pluginType?: string, sourcePath?: string, hasWebui?: boolean): Promise<PluginInfo> {
    const pluginContext = this.createPluginContext(id);

    const plugin = PluginSandbox.loadPlugin(code, pluginContext);
    if (!plugin) {
      throw new Error('Failed to load plugin: invalid plugin code');
    }

    plugin.manifest.id = id;

    const db = getDb();
    const existing = db.prepare('SELECT id FROM plugins WHERE id = ?').get(id);

    if (existing) {
      db.prepare(
        'UPDATE plugins SET name = ?, description = ?, code = ?, type = COALESCE(?, type), source_path = COALESCE(?, source_path), has_webui = COALESCE(?, has_webui), version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(plugin.manifest.name, description || '', code, pluginType || null, sourcePath || null, hasWebui !== undefined ? (hasWebui ? 1 : 0) : null, id);
    } else {
      db.prepare(
        'INSERT INTO plugins (id, name, description, code, enabled, version, type, source_path, has_webui) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?)'
      ).run(id, plugin.manifest.name, description || '', code, pluginType || 'code', sourcePath || '', hasWebui ? 1 : 0);
    }

    // 代码写入 plugins/ 文件夹作为权威来源
    if (pluginType !== 'zip') {
      const pluginFile = path.join(this.pluginsDir, plugin.manifest.name + '.js');
      fs.writeFileSync(pluginFile, code, 'utf-8');
      logger.info(`Plugin code written to: ${pluginFile}`);
    }

    try {
      if (plugin.onLoad) {
        await plugin.onLoad(pluginContext);
      }
    } catch (err: any) {
      logger.error(`Plugin ${id} onLoad failed: ${err.message}`);
      this.plugins.set(id, { plugin, ctx: pluginContext, loaded: false, error: err.message });
      this.eventBus.emit('plugin.error', { pluginId: id, error: err.message });
      throw err;
    }

    this.plugins.set(id, { plugin, ctx: pluginContext, loaded: false });
    logger.info(`Plugin loaded: ${plugin.manifest.name} (${id})`);

    return {
      id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      description: plugin.manifest.description || '',
      author: plugin.manifest.author || 'user',
      enabled: false,
      loaded: true,
      hasError: false,
      type: pluginType || 'code',
      has_webui: !!hasWebui,
    };
  }

  // 动态加载 ZIP 插件（import() 无需沙箱，ZIP 由管理员上传，视为可信）
  private async loadZipPlugin(id: string): Promise<void> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;
    if (!row || row.type !== 'zip') throw new Error(`Plugin ${id} is not a ZIP plugin`);

    const sourcePath = row.source_path;
    const entryFile = fs.existsSync(path.join(sourcePath, 'index.mjs')) ? 'index.mjs' : 'index.js';
    const entryPath = path.join(sourcePath, entryFile);

    const ctx = this.createPluginContext(id);
    const mod = await import(entryPath);
    const pluginExport = mod.default || mod;

    if (!pluginExport || !pluginExport.manifest) {
      throw new Error('Plugin must export default { manifest, ... }');
    }
    pluginExport.manifest.id = id;

    const plugin: Plugin = {
      manifest: pluginExport.manifest,
      onLoad: pluginExport.onLoad,
      onUnload: pluginExport.onUnload,
      onEnable: pluginExport.onEnable,
      onDisable: pluginExport.onDisable,
      methods: pluginExport.methods,
    };

    if (plugin.onLoad) {
      await plugin.onLoad(ctx);
    }

    this.plugins.set(id, { plugin, ctx, loaded: false });
    logger.info(`ZIP plugin loaded: ${plugin.manifest.name} (${id})`);

    if (plugin.onEnable) {
      await plugin.onEnable(ctx);
    }
    const entry = this.plugins.get(id);
    if (entry) entry.loaded = true;

    db.prepare('UPDATE plugins SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    this.eventBus.emit('plugin.enabled', { pluginId: id });
    logger.info(`Plugin enabled: ${id}`);
  }

  async enable(id: string): Promise<void> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;
    if (!row) throw new Error(`Plugin ${id} not found`);

    if (row.type === 'zip') {
      const existing = this.plugins.get(id);
      if (existing?.loaded && !existing.error) return;
      await this.loadZipPlugin(id);
      return;
    }

    let entry = this.plugins.get(id);
    if (!entry) {
      await this.loadFromCode(id, row.name, row.code, row.description);
      entry = this.plugins.get(id);
      if (!entry) throw new Error(`Plugin ${id} failed to load`);
    }

    if (entry.loaded && entry.error === undefined) return;

    try {
      if (entry.plugin.onEnable) {
        await entry.plugin.onEnable(entry.ctx);
      }
      entry.loaded = true;
      entry.error = undefined;

      db.prepare('UPDATE plugins SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

      this.eventBus.emit('plugin.enabled', { pluginId: id });
      logger.info(`Plugin enabled: ${id}`);
    } catch (err: any) {
      entry.error = err.message;
      this.eventBus.emit('plugin.error', { pluginId: id, error: err.message });
      throw err;
    }
  }

  async disable(id: string): Promise<void> {
    const entry = this.plugins.get(id);
    if (!entry) {
      throw new Error(`Plugin ${id} not loaded`);
    }

    try {
      if (entry.plugin.onDisable) {
        await entry.plugin.onDisable(entry.ctx);
      }
    } catch (err: any) {
      logger.error(`Plugin ${id} onDisable failed: ${err.message}`);
    }

    entry.loaded = false;
    entry.error = undefined;

    const db = getDb();
    db.prepare('UPDATE plugins SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    this.eventBus.emit('plugin.disabled', { pluginId: id });
    logger.info(`Plugin disabled: ${id}`);
  }

  async reload(id: string): Promise<PluginInfo> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;

    if (!row) {
      throw new Error(`Plugin ${id} not found in database`);
    }

    await this.unload(id);
    if (row.type === 'zip') {
      await this.loadZipPlugin(id);
      const entry = this.plugins.get(id);
      const plugin = entry?.plugin;
      return {
        id, name: plugin?.manifest.name || row.name,
        version: plugin?.manifest.version || String(row.version),
        description: plugin?.manifest.description || row.description || '',
        author: plugin?.manifest.author || 'user',
        enabled: true, loaded: true, hasError: false,
        type: 'zip', has_webui: (row.has_webui === 1),
      };
    }
    return this.loadFromCode(id, row.name, row.code, row.description);
  }

  async unload(id: string): Promise<void> {
    const entry = this.plugins.get(id);
    if (!entry) return;

    try {
      if (entry.plugin.onDisable) {
        await entry.plugin.onDisable(entry.ctx);
      }
    } catch (err: any) {
      logger.error(`Plugin ${id} onDisable during unload failed: ${err.message}`);
    }

    try {
      if (entry.plugin.onUnload) {
        await entry.plugin.onUnload(entry.ctx);
      }
    } catch (err: any) {
      logger.error(`Plugin ${id} onUnload failed: ${err.message}`);
    }

    this.plugins.delete(id);
    this.eventBus.emit('plugin.unloaded', { pluginId: id });
    logger.info(`Plugin unloaded: ${id}`);
  }

  async deletePlugin(id: string): Promise<void> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;

    if (row && row.type === 'zip' && row.source_path) {
      try {
        if (fs.existsSync(row.source_path)) {
          fs.rmSync(row.source_path, { recursive: true, force: true });
        }
      } catch (e: any) { logger.warn(`Failed to delete plugin dir: ${e.message}`); }
    }

    await this.unload(id);
    db.prepare('DELETE FROM plugins WHERE id = ?').run(id);
    logger.info(`Plugin deleted: ${id}`);
  }

  async toggleEnabled(id: string): Promise<boolean> {
    const db = getDb();
    const row = db.prepare('SELECT enabled FROM plugins WHERE id = ?').get(id) as any;

    if (!row) {
      throw new Error(`Plugin ${id} not found`);
    }

    if (row.enabled === 1) {
      await this.disable(id);
      return false;
    } else {
      await this.enable(id);
      return true;
    }
  }

  getPluginCode(id: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT code FROM plugins WHERE id = ?').get(id) as any;
    return row ? row.code : null;
  }

  getPluginConfig(id: string): Record<string, string> {
    const db = getDb();
    const rows = db.prepare(
      "SELECT key, value FROM config WHERE key LIKE ?"
    ).all(`plugin.${id}.%`) as any[];
    const config: Record<string, string> = {};
    const prefix = `plugin.${id}.`;
    for (const row of rows) {
      config[row.key.substring(prefix.length)] = row.value;
    }
    return config;
  }

  setPluginConfig(id: string, key: string, value: string): void {
    const db = getDb();
    const fullKey = `plugin.${id}.${key}`;
    db.prepare(
      'INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    ).run(fullKey, value);
  }

  isEnabled(id: string): boolean {
    const entry = this.plugins.get(id);
    return entry ? entry.loaded : false;
  }

  findPluginByName(name: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT id FROM plugins WHERE name = ?').get(name) as any;
    return row ? row.id : null;
  }

  getPluginSourcePath(id: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT source_path FROM plugins WHERE id = ?').get(id) as any;
    return row ? row.source_path : null;
  }

  private createPluginContext(pluginId: string): PluginContext {
    const storage: PluginStorage = {
      get: (key: string) => {
        const db = getDb();
        const row = db.prepare(
          'SELECT value FROM config WHERE key = ?'
        ).get(`plugin.${pluginId}.${key}`) as any;
        return row ? row.value : null;
      },
      set: (key: string, value: string) => {
        const db = getDb();
        db.prepare(
          'INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
        ).run(`plugin.${pluginId}.${key}`, value);
      },
      delete: (key: string) => {
        const db = getDb();
        db.prepare('DELETE FROM config WHERE key = ?').run(`plugin.${pluginId}.${key}`);
      },
    };

    const engineApi: PluginEngineAPI = {
      enableAllExcept: async (exceptId: string) => {
        const db = getDb();
        const rows = db.prepare('SELECT id FROM plugins WHERE id != ? AND enabled != 1').all(exceptId) as any[];
        for (const row of rows) {
          try {
            await this.enable(row.id);
          } catch (err: any) {
            logger.warn(`Failed to enable ${row.id}: ${err.message}`);
          }
        }
      },
      disableAllExcept: async (exceptId: string) => {
        const db = getDb();
        const rows = db.prepare('SELECT id FROM plugins WHERE id != ? AND enabled = 1').all(exceptId) as any[];
        for (const row of rows) {
          try {
            await this.disable(row.id);
          } catch (err: any) {
            logger.warn(`Failed to disable ${row.id}: ${err.message}`);
          }
        }
      },
      isAllOthersEnabled: (exceptId: string) => {
        const db = getDb();
        const rows = db.prepare('SELECT id, enabled FROM plugins WHERE id != ?').all(exceptId) as any[];
        if (rows.length === 0) return true;
        for (const row of rows) {
          if (row.enabled !== 1) return false;
        }
        return true;
      },
      isAllOthersDisabled: (exceptId: string) => {
        const db = getDb();
        const rows = db.prepare('SELECT id, enabled FROM plugins WHERE id != ?').all(exceptId) as any[];
        for (const row of rows) {
          if (row.enabled === 1) return false;
        }
        return true;
      },
      // 插件互调：按 name 或 id 查找 → 调用 methods[method] → 传入 ctx 作为第一个参数
      callPlugin: async (name: string, method: string, ...args: any[]) => {
        for (const [id, entry] of this.plugins) {
          if (!entry.loaded) continue;
          if (entry.plugin.manifest.name === name || entry.plugin.manifest.id === name) {
            if (entry.plugin.methods && entry.plugin.methods[method]) {
              return entry.plugin.methods[method](entry.ctx, ...args);
            }
            throw new Error(`Plugin "${name}" has no method "${method}"`);
          }
        }
        throw new Error(`Plugin "${name}" not found or not loaded`);
      },
    };

    return {
      pluginId,
      bot: this.botApi,
      eventBus: this.eventBus,
      logger: createLogger(`plugin:${pluginId}`),
      storage,
      config: {},
      engine: engineApi,
    };
  }

  async loadAllFromDb(): Promise<void> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM plugins').all() as any[];

    for (const row of rows) {
      try {
        if (row.type === 'zip') {
          await this.loadZipPlugin(row.id);
          if (row.enabled !== 1) {
            const entry = this.plugins.get(row.id);
            if (entry && entry.plugin.onDisable) {
              try { await entry.plugin.onDisable(entry.ctx); } catch {}
            }
            if (entry) entry.loaded = false;
            db.prepare('UPDATE plugins SET enabled = 0 WHERE id = ?').run(row.id);
          }
          continue;
        }

        // 代码插件：从 plugins/ 文件夹加载源代码
        const pluginFile = path.join(this.pluginsDir, row.name + '.js');
        let code: string;

        if (fs.existsSync(pluginFile)) {
          code = fs.readFileSync(pluginFile, 'utf-8');
        } else {
          // 文件不存在但 DB 有代码，从 DB 恢复文件
          code = row.code || '';
          if (code) {
            fs.writeFileSync(pluginFile, code, 'utf-8');
            logger.info(`Restored plugin file from DB: ${row.name}.js`);
          } else {
            logger.warn(`Plugin ${row.name}: no file or DB code, skipping`);
            continue;
          }
        }

        const ctx = this.createPluginContext(row.id);
        const plugin = PluginSandbox.loadPlugin(code, ctx);

        if (plugin) {
          plugin.manifest.id = row.id;
          this.plugins.set(row.id, { plugin, ctx, loaded: false });

          if (plugin.onLoad) {
            await plugin.onLoad(ctx);
          }

          if (row.enabled === 1) {
            try {
              if (plugin.onEnable) {
                await plugin.onEnable(ctx);
              }
              const entry = this.plugins.get(row.id);
              if (entry) entry.loaded = true;
            } catch (err: any) {
              logger.error(`Plugin ${row.id} auto-enable failed: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        logger.error(`Failed to load plugin ${row.id}: ${err.message}`);
      }
    }

    // 扫描 plugins/ 中未被 DB 记录的新 .js 文件
    const dbNames = (db.prepare('SELECT name FROM plugins').all() as any[]).map((r: any) => r.name);
    if (fs.existsSync(this.pluginsDir)) {
      const files = fs.readdirSync(this.pluginsDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const pluginName = file.replace(/\.js$/, '');
        if (dbNames.includes(pluginName)) continue;

        try {
          const code = fs.readFileSync(path.join(this.pluginsDir, file), 'utf-8');
          const plugin = PluginSandbox.loadPlugin(code, this.createPluginContext('_temp'));
          if (!plugin) { logger.warn(`Invalid plugin file: ${file}`); continue; }

          const id = 'file-' + pluginName;
          db.prepare(
            'INSERT OR IGNORE INTO plugins (id, name, description, code, enabled, version, type) VALUES (?, ?, ?, ?, 0, 1, ?)'
          ).run(id, pluginName, plugin.manifest.description || '', code, 'code');

          const ctx = this.createPluginContext(id);
          const reloaded = PluginSandbox.loadPlugin(code, ctx);
          if (reloaded) {
            reloaded.manifest.id = id;
            this.plugins.set(id, { plugin: reloaded, ctx, loaded: false });
            if (reloaded.onLoad) await reloaded.onLoad(ctx);
            logger.info(`Auto-discovered plugin: ${file} -> ${id}`);
          }
        } catch (err: any) {
          logger.warn(`Failed to auto-load ${file}: ${err.message}`);
        }
      }
    }

    logger.info(`Loaded ${this.plugins.size} plugins from database`);
  }

  async shutdown(): Promise<void> {
    for (const [id] of this.plugins) {
      await this.unload(id);
    }
    this.plugins.clear();
  }
}
