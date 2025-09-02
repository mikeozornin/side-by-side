import sqlite3 from 'sqlite3';
import { createTables } from './schema.js';
import { logger } from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH || './app.db';

let db: sqlite3.Database | null = null;

export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(DB_PATH, (err: Error | null) => {
        if (err) {
          logger.error('Ошибка подключения к базе данных:', err);
          reject(err);
          return;
        }
        
        logger.info(`Подключение к SQLite базе данных: ${DB_PATH}`);
        
        // Создаем таблицы
        createTables(db!);
        
        logger.info('База данных инициализирована');
        resolve();
      });
    });
  } catch (error) {
    logger.error('Ошибка инициализации базы данных:', error);
    throw error;
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close((err: Error | null) => {
      if (err) {
        logger.error('Ошибка закрытия базы данных:', err);
      } else {
        logger.info('База данных закрыта');
      }
    });
    db = null;
  }
}