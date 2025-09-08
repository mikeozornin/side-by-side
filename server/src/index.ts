// Загружаем .env файлы ПЕРВЫМ ДЕЛОМ
import './load-env.js';

import { router } from './routes/index.js';
import { initDatabase, closeDatabase } from './db/init.js';
import { ensureDirectories } from './utils/files.js';
import { logger } from './utils/logger.js';
import { cleanupExpiredAuthData } from './db/auth-queries.js';
import { startCleanupScheduler, stopCleanupScheduler } from './utils/cleanup-scheduler.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PORT = parseInt(process.env.PORT || '3000');
const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_DIR = process.env.LOG_DIR || './logs';

async function startServer() {
  try {
    // Инициализация директорий
    await ensureDirectories(DATA_DIR, LOG_DIR);

    // Инициализация базы данных
    await initDatabase();

    // Комплексная очистка истекших данных аутентификации при запуске
    logger.info('🧹 Выполняем начальную очистку истекших данных аутентификации...');
    const cleanupResult = await cleanupExpiredAuthData();
    if (cleanupResult.total > 0) {
      logger.info(`🗑️  Очищено при запуске: ${cleanupResult.total} записей`);
    }

    // Запуск планировщика автоматической очистки
    startCleanupScheduler();

    logger.info(`Сервер запускается на порту ${PORT}`);

    // Используем Bun.serve
    Bun.serve({
      port: PORT,
      fetch: router.fetch,
    });

    logger.info(`🚀 Сервер запущен на http://localhost:${PORT}`);
    logger.info(`🔄 Планировщик очистки активен (каждые 24 часа)`);
  } catch (error) {
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, завершение работы...');
  stopCleanupScheduler();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, завершение работы...');
  stopCleanupScheduler();
  closeDatabase();
  process.exit(0);
});

startServer();
