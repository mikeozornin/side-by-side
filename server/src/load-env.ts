// Bun автоматически загружает .env файлы
// Экспортируем переменные окружения для удобства

export const env = {
  PORT: process.env.PORT || '3000',
  DATA_DIR: process.env.DATA_DIR || './data',
  LOG_DIR: process.env.LOG_DIR || './logs',
  DB_PATH: process.env.DB_PATH || './app.db',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BUN_ENV: process.env.BUN_ENV || 'development',
  
  // SMTP настройки
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@side-by-side.com',
} as const;
