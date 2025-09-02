import { serve } from '@hono/node-server';
import { router } from './routes';
import { initDatabase } from './db/init';
import { ensureDirectories } from './utils/files';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3000');
const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_DIR = process.env.LOG_DIR || './logs';

async function startServer() {
  try {
    // Инициализация директорий
    await ensureDirectories(DATA_DIR, LOG_DIR);
    
    // Инициализация базы данных
    await initDatabase();
    
    logger.info(`Сервер запускается на порту ${PORT}`);
    
    serve({
      fetch: router.fetch,
      port: PORT,
    });
    
    logger.info(`Сервер запущен на http://localhost:${PORT}`);
  } catch (error) {
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();
