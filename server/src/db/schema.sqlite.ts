import { DbClient } from './db-client';

export async function createTables(db: DbClient): Promise<void> {
  // Таблица пользователей
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица голосований
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

  // Таблица вариантов голосований
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

  // Таблица голосов
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

  // Таблица одноразовых токенов для magic link
  await db.exec(`
    CREATE TABLE IF NOT EXISTS magic_tokens (
      token_hash TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME
    )
  `);

  // Таблица сессий для refresh токенов
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

  // Таблица кодов для авторизации Figma-плагина
  await db.exec(`
    CREATE TABLE IF NOT EXISTS figma_auth_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Индексы для производительности
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_created_at ON votings(created_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_end_at ON votings(end_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votings_user_id ON votings(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_voting_options_voting_id ON voting_options(voting_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires_at ON magic_tokens(expires_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_figma_auth_codes_expires_at ON figma_auth_codes(expires_at)`);
}
