import { DbClient } from './db-client.js';
import { SqliteClient } from './providers/sqlite.js';
import { PostgresClient } from './providers/postgres.js';
import { createTables } from './schema.js';
import { runMigrations } from './migrations.js';
import { logger } from '../utils/logger.js';

const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
const DB_PATH = process.env.DB_PATH || './app.db';
const DATABASE_URL = process.env.DATABASE_URL;

let db: DbClient | null = null;

export function getDatabase(): DbClient {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    if (DB_PROVIDER === 'sqlite') {
      db = new SqliteClient(DB_PATH);
      logger.info(`Подключение к SQLite базе данных: ${DB_PATH}`);
    } else if (DB_PROVIDER === 'postgres') {
      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL must be set for postgres provider');
      }
      db = new PostgresClient(DATABASE_URL);
      logger.info(`Подключение к PostgreSQL базе данных`);
    } else {
      throw new Error(`Unsupported DB_PROVIDER: ${DB_PROVIDER}`);
    }

    // Применяем миграции (включая создание таблиц)
    await runMigrations(db);
    
    // Для обратной совместимости также вызываем createTables
    // (это безопасно, так как все таблицы создаются с IF NOT EXISTS)
    await createTables(db);
    
    logger.info('База данных инициализирована');
  } catch (error) {
    logger.error('Ошибка инициализации базы данных:', error);
    throw error;
  }
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      logger.info('База данных закрыта');
    } catch (error) {
      logger.error('Ошибка закрытия базы данных:', error);
    }
    db = null;
  }
}