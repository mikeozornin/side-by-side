import { readFile, writeFile, access } from 'fs/promises';
import { logger } from '../utils/logger';

const DB_PATH = process.env.DB_PATH || './data.json';

interface Database {
  votings: Array<{
    id: string;
    title: string;
    created_at: string;
    end_at: string;
  }>;
  voting_images: Array<{
    id: number;
    voting_id: string;
    file_path: string;
    sort_order: number;
  }>;
  votes: Array<{
    id: number;
    voting_id: string;
    choice: number;
    created_at: string;
  }>;
}

let db: Database = {
  votings: [],
  voting_images: [],
  votes: []
};

export function getDatabase(): Database {
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    // Проверяем, существует ли файл базы данных
    try {
      await access(DB_PATH);
      const data = await readFile(DB_PATH, 'utf-8');
      db = JSON.parse(data);
      logger.info('База данных загружена из файла');
    } catch {
      // Файл не существует, создаем пустую базу данных
      await saveDatabase();
      logger.info('Создана новая база данных');
    }
  } catch (error) {
    logger.error('Ошибка инициализации базы данных:', error);
    throw error;
  }
}

export async function saveDatabase(): Promise<void> {
  try {
    await writeFile(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    logger.error('Ошибка сохранения базы данных:', error);
    throw error;
  }
}

export function closeDatabase(): void {
  // Для JSON базы данных ничего не нужно закрывать
}