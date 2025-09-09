// Настройка переменных окружения для тестов
process.env.NODE_ENV = 'test';
process.env.DB_PROVIDER = 'sqlite';
process.env.DATABASE_URL = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.AUTH_MODE = 'magic-links';
process.env.AUTO_APPROVE_SESSIONS = 'false';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.SERVER_URL = 'http://localhost:3001';

// Отключаем отправку email в тестах
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'test';
