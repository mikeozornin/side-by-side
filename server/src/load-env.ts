// Загружаем переменные окружения в зависимости от режима
import { config } from 'dotenv';
import { resolve } from 'path';

// Определяем режим и загружаем соответствующий .env файл
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env' : '.env.development';

// Загружаем .env файл из корня проекта
config({ path: resolve(process.cwd(), '..', envFile) });

export const env = {
  PORT: process.env.PORT || '3000',
  DATA_DIR: process.env.DATA_DIR || './data',
  LOG_DIR: process.env.LOG_DIR || './logs',
  DB_PATH: process.env.DB_PATH || './app.db',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BUN_ENV: process.env.BUN_ENV || 'development',
  
  // Режим аутентификации: 'anonymous' или 'magic-links'
  AUTH_MODE: process.env.AUTH_MODE || 'magic-links',
  
  // Автоапрув сессий (без отправки письма)
  AUTO_APPROVE_SESSIONS: process.env.AUTO_APPROVE_SESSIONS === 'true',
  
  // SMTP настройки
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@side-by-side.com',
} as const;
