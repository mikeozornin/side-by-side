import { DbClient } from './db-client.js';
import { Migration } from './migrations.js';

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db: DbClient) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS votings (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          end_at TIMESTAMPTZ NOT NULL,
          duration_hours INTEGER NOT NULL DEFAULT 24,
          is_public BOOLEAN NOT NULL DEFAULT TRUE,
          user_id TEXT REFERENCES users(id)
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS voting_options (
          id SERIAL PRIMARY KEY,
          voting_id TEXT NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          pixel_ratio REAL NOT NULL DEFAULT 1,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          media_type TEXT NOT NULL DEFAULT 'image'
        )
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          voting_id TEXT NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
          option_id INTEGER NOT NULL REFERENCES voting_options(id) ON DELETE CASCADE,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

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
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          refresh_token_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
        )
      `);
      
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_figma_auth_codes_expires_at ON figma_auth_codes(expires_at)`);
    }
  },
  {
    version: 5,
    name: 'add_web_push_tables',
    up: async (db: DbClient) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS web_push_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.exec(`
        CREATE TABLE IF NOT EXISTS notification_settings (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          new_votings BOOLEAN NOT NULL DEFAULT FALSE,
          my_votings_complete BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON web_push_subscriptions(user_id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_endpoint ON web_push_subscriptions(endpoint)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id)`);
    }
  },
  {
    version: 6,
    name: 'webpush_unique_endpoint',
    up: async (db: DbClient) => {
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_web_push_subscriptions_endpoint ON web_push_subscriptions(endpoint)`);
    }
  },
  {
    version: 7,
    name: 'add_completed_notified_flag',
    up: async (db: DbClient) => {
      const existsRow = await db.get<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'votings' AND column_name = 'complete_notified'
        ) as exists
      `);
      
      if (!existsRow?.exists) {
        await db.exec(`ALTER TABLE votings ADD COLUMN complete_notified BOOLEAN NOT NULL DEFAULT FALSE`);
      }

      await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_end_at_notified ON votings(end_at, complete_notified)`);
    }
  }
  ,
  {
    version: 8,
    name: 'votings_duration_hours_real',
    up: async (db: DbClient) => {
      // Change duration_hours from INTEGER to REAL to support fractional hours (e.g., 0.167 for 10 minutes)
      // Safe no-op if already REAL
      const col = await db.get<{ data_type: string }>(
        `SELECT data_type FROM information_schema.columns WHERE table_name = 'votings' AND column_name = 'duration_hours'`
      );
      if (col && col.data_type.toLowerCase() !== 'real' && col.data_type.toLowerCase() !== 'double precision' && col.data_type.toLowerCase() !== 'numeric') {
        await db.exec(`ALTER TABLE votings ALTER COLUMN duration_hours TYPE REAL USING (duration_hours::REAL)`);
        await db.exec(`ALTER TABLE votings ALTER COLUMN duration_hours SET DEFAULT 24`);
        await db.exec(`ALTER TABLE votings ALTER COLUMN duration_hours SET NOT NULL`);
      }
    }
  }
];
