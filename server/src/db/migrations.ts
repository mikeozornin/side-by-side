import { Database } from 'bun:sqlite';
import { logger } from '../utils/logger.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
  down?: (db: Database) => void;
}

// Создаем таблицу для отслеживания миграций
function createMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Получаем список применённых миграций
function getAppliedMigrations(db: Database): number[] {
  try {
    const result = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[];
    return result.map(row => row.version);
  } catch (error) {
    // Если таблица не существует, возвращаем пустой массив
    return [];
  }
}

// Отмечаем миграцию как применённую
function markMigrationAsApplied(db: Database, version: number, name: string): void {
  db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
    .run(version, name);
}

// Определяем все миграции
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db: Database) => {
      // Создаем базовые таблицы
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.exec(`
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

      db.exec(`
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

      db.exec(`
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
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_votings_created_at ON votings(created_at);
        CREATE INDEX IF NOT EXISTS idx_votings_end_at ON votings(end_at);
        CREATE INDEX IF NOT EXISTS idx_votings_user_id ON votings(user_id);
        CREATE INDEX IF NOT EXISTS idx_voting_options_voting_id ON voting_options(voting_id);
        CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id);
        CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
        CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
    }
  },
  {
    version: 2,
    name: 'add_magic_tokens',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS magic_tokens (
          token_hash TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME
        )
      `);
      
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires_at ON magic_tokens(expires_at);
      `);
    }
  },
  {
    version: 3,
    name: 'add_sessions',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          refresh_token_hash TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      `);
    }
  },
  {
    version: 4,
    name: 'add_figma_auth_codes',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS figma_auth_codes (
          code_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_figma_auth_codes_expires_at ON figma_auth_codes(expires_at);
      `);
    }
  }
];

// Применяем все миграции
export function runMigrations(db: Database): void {
  try {
    logger.info('Проверяем и применяем миграции...');
    
    // Создаем таблицу для отслеживания миграций
    createMigrationsTable(db);
    
    // Получаем список применённых миграций
    const appliedMigrations = getAppliedMigrations(db);
    logger.info(`Применённые миграции: ${appliedMigrations.join(', ')}`);
    
    // Находим миграции, которые нужно применить
    const pendingMigrations = migrations.filter(migration => 
      !appliedMigrations.includes(migration.version)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('Все миграции уже применены');
      return;
    }
    
    logger.info(`Найдено ${pendingMigrations.length} миграций для применения`);
    
    // Применяем каждую миграцию
    for (const migration of pendingMigrations) {
      logger.info(`Применяем миграцию ${migration.version}: ${migration.name}`);
      
      try {
        migration.up(db);
        markMigrationAsApplied(db, migration.version, migration.name);
        logger.info(`Миграция ${migration.version} успешно применена`);
      } catch (error) {
        logger.error(`Ошибка применения миграции ${migration.version}:`, error);
        throw error;
      }
    }
    
    logger.info('Все миграции успешно применены');
    
  } catch (error) {
    logger.error('Ошибка при применении миграций:', error);
    throw error;
  }
}

// Получаем текущую версию схемы
export function getCurrentSchemaVersion(db: Database): number {
  try {
    const result = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
    return result.version || 0;
  } catch (error) {
    return 0;
  }
}

// Проверяем, нужно ли применять миграции
export function needsMigration(db: Database): boolean {
  const currentVersion = getCurrentSchemaVersion(db);
  const latestVersion = Math.max(...migrations.map(m => m.version));
  return currentVersion < latestVersion;
}
