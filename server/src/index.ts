// Загружаем .env файлы ПЕРВЫМ ДЕЛОМ
import './load-env.js';

import { router } from './routes/index.js';
import { initDatabase, closeDatabase } from './db/init.js';
import { ensureDirectories } from './utils/files.js';
import { logger } from './utils/logger.js';
import { cleanupFigmaCodes } from './db/auth-queries.js';

const PORT = parseInt(process.env.PORT || '3000');
const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_DIR = process.env.LOG_DIR || './logs';

async function startServer() {
  try {
    // Инициализация директорий
    await ensureDirectories(DATA_DIR, LOG_DIR);
    
    // Инициализация базы данных
    await initDatabase();
    
    // Очищаем старые коды Figma при запуске
    const cleanedCodes = cleanupFigmaCodes();
    if (cleanedCodes > 0) {
      logger.info(`Очищено ${cleanedCodes} старых кодов Figma при запуске`);
    }
    
    logger.info(`Сервер запускается на порту ${PORT}`);
    
    // Используем Bun.serve вместо @hono/node-server
    Bun.serve({
      port: PORT,
      fetch: router.fetch,
    });
    
    logger.info(`Сервер запущен на http://localhost:${PORT}`);
  } catch (error) {
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, завершение работы...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, завершение работы...');
  closeDatabase();
  process.exit(0);
});

startServer();
