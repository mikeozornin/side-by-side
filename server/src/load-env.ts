// Загружаем переменные окружения в зависимости от режима
import { config } from 'dotenv';
import { resolve } from 'path';

// Сохраняем исходное значение NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

// Сначала загружаем .env файл для development режима
// override: true позволяет перезаписать переменные, уже установленные в process.env
config({ path: resolve(process.cwd(), '..', '.env.development'), override: true });

// Определяем режим после загрузки .env файла
const nodeEnv = process.env.NODE_ENV || 'development';

// Если режим production, загружаем .env файл для production
if (nodeEnv === 'production') {
  config({ path: resolve(process.cwd(), '..', '.env'), override: true });
}

// Восстанавливаем исходное значение NODE_ENV, если оно было установлено извне
if (originalNodeEnv && originalNodeEnv !== process.env.NODE_ENV) {
  process.env.NODE_ENV = originalNodeEnv;
}

export const env = {
  PORT: process.env.PORT || '3000',
  DATA_DIR: process.env.DATA_DIR || './data',
  LOG_DIR: process.env.LOG_DIR || './logs',
  DB_PATH: process.env.DB_PATH || './app.db',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  CLIENT_URL: process.env.CLIENT_URL || process.env.VOTING_BASE_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BUN_ENV: process.env.BUN_ENV || 'development',
  
  // Режим аутентификации: 'anonymous' или 'magic-links'
  AUTH_MODE: process.env.AUTH_MODE || 'magic-links',
  
  // Автоапрув сессий (без отправки письма)
  AUTO_APPROVE_SESSIONS: process.env.AUTO_APPROVE_SESSIONS === 'true',
  
  // JWT секретный ключ
  JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret-for-development-only',
  
  // SMTP настройки
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@side-by-side.com',
} as const;

// Проверка безопасности для продакшн-режима
if (env.NODE_ENV === 'production' && env.AUTO_APPROVE_SESSIONS) {
  console.error('FATAL ERROR: AUTO_APPROVE_SESSIONS cannot be true in production environment.');
  process.exit(1); // Завершаем работу с ошибкой
}

// Проверка JWT_SECRET
if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || env.JWT_SECRET === 'default-jwt-secret-for-development-only') {
    console.error('FATAL ERROR: JWT_SECRET must be set to a strong value in production.');
    process.exit(1);
  }
} else {
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set in environment variables. Using default value for development only.');
    console.warn('Please set JWT_SECRET in your .env.development file for security.');
  }
}
