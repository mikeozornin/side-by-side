import { DbClient } from './db-client.js';
import { Migration } from './migrations.js';

// Определяем все миграции
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db: DbClient) => {
      // Создаем базовые таблицы
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS votings (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_at DATETIME NOT NULL,
          duration_hours INTEGER NOT NULL DEFAULT 24,
          is_public BOOLEAN NOT NULL DEFAULT 1,
          user_id TEXT REFERENCES users(id)
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS voting_options (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voting_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          pixel_ratio REAL NOT NULL DEFAULT 1,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          media_type TEXT NOT NULL DEFAULT 'image',
          FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voting_id TEXT NOT NULL,
          option_id INTEGER NOT NULL,
          user_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE,
          FOREIGN KEY (option_id) REFERENCES voting_options(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Создаем индексы
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_created_at ON votings(created_at)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_end_at ON votings(end_at)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_user_id ON votings(user_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_voting_options_voting_id ON voting_options(voting_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    }
  },
  {
    version: 2,
    name: 'add_magic_tokens',
    up: async (db: DbClient) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS magic_tokens (
          token_hash TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME
        )
      `);
      
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires_at ON magic_tokens(expires_at)`);
    }
  },
  {
    version: 3,
    name: 'add_sessions',
    up: async (db: DbClient) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          refresh_token_hash TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
    }
  },
  {
    version: 4,
    name: 'add_figma_auth_codes',
    up: async (db: DbClient) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS figma_auth_codes (
          code_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_figma_auth_codes_expires_at ON figma_auth_codes(expires_at)`);
    }
  },
  {
    version: 5,
    name: 'add_web_push_tables',
    up: async (db: DbClient) => {
      // Таблица для хранения подписок на push-уведомления
      await db.exec(`
        CREATE TABLE IF NOT EXISTS web_push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      // Таблица для настроек уведомлений пользователей
      await db.exec(`
        CREATE TABLE IF NOT EXISTS notification_settings (
          user_id TEXT PRIMARY KEY,
          new_votings BOOLEAN NOT NULL DEFAULT 0,
          my_votings_complete BOOLEAN NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      // Создаем индексы
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON web_push_subscriptions(user_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_endpoint ON web_push_subscriptions(endpoint)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id)`);
    }
  },
  {
    version: 6,
    name: 'webpush_unique_endpoint',
    up: async (db: DbClient) => {
      // Обеспечиваем уникальность endpoint, чтобы корректно делать upsert
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_web_push_subscriptions_endpoint ON web_push_subscriptions(endpoint)`);
    }
  },
  {
    version: 7,
    name: 'add_completed_notified_flag',
    up: async (db: DbClient) => {
      // Безопасно добавляем колонку только если её нет (поддержка старых SQLite)
      const cols = await db.query<{ name: string }>(`PRAGMA table_info(votings)`);
      const hasColumn = cols.some(c => c.name === 'complete_notified');
      if (!hasColumn) {
        await db.exec(`ALTER TABLE votings ADD COLUMN complete_notified BOOLEAN NOT NULL DEFAULT 0`);
      }

      // Индекс по времени завершения для быстрых выборок
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_end_at_notified ON votings(end_at, complete_notified)`);
    }
  }
  ,
  {
    version: 8,
    name: 'votings_duration_hours_real',
    up: async (db: DbClient) => {
      // SQLite is typeless enough; ensure column exists and keep REAL semantics
      // Try to add column if missing (no-op if exists)
      const cols = await db.query<{ name: string; type?: string }>(`PRAGMA table_info(votings)`);
      const hasDuration = cols.some(c => c.name === 'duration_hours');
      if (!hasDuration) {
        await db.exec(`ALTER TABLE votings ADD COLUMN duration_hours REAL NOT NULL DEFAULT 24`);
      } else {
        // Nothing to do; keep semantics as REAL
      }
    }
  }
];
