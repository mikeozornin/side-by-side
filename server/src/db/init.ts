import { Database } from 'bun:sqlite';
import { createTables } from './schema.js';
import { logger } from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH || './app.db';

let db: Database | null = null;

export function getDatabase(): Database {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    db = new Database(DB_PATH);
    
    logger.info(`Подключение к SQLite базе данных: ${DB_PATH}`);
    
    // Создаем таблицы
    createTables(db);
    
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