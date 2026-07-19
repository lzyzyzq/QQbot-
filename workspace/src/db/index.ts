import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('db');

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'bot.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  logger.info(`Database initialized at ${dbPath}`);

  return db;
}

function createTables() {
  const database = db!;

  database.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      code TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}',
      version INTEGER DEFAULT 1,
      type TEXT DEFAULT 'code',
      source_path TEXT DEFAULT '',
      has_webui INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL,
      expires_at DATETIME,
      is_permanent INTEGER DEFAULT 0,
      used_by TEXT,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

  migrateSchema();

  logger.info('Database tables created/verified');
}

function migrateSchema() {
  const database = db!;
  const cols = database.prepare("PRAGMA table_info('plugins')").all() as any[];
  const names = new Set(cols.map((c: any) => c.name));
  if (!names.has('type')) database.exec("ALTER TABLE plugins ADD COLUMN type TEXT DEFAULT 'code'");
  if (!names.has('source_path')) database.exec("ALTER TABLE plugins ADD COLUMN source_path TEXT DEFAULT ''");
  if (!names.has('has_webui')) database.exec("ALTER TABLE plugins ADD COLUMN has_webui INTEGER DEFAULT 0");
}

export function getConfig(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setConfig(key: string, value: string) {
  getDb().prepare(
    'INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
  ).run(key, value);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}
