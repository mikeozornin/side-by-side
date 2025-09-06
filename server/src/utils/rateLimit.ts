import { MiddlewareHandler } from 'hono';
import { configManager } from './config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number; // Время окна в миллисекундах
  maxRequests: number; // Максимальное количество запросов в окне
  message?: string; // Сообщение об ошибке
}

class RateLimiter {
  private storage = new Map<string, RateLimitEntry>();

  limit(options: RateLimitOptions): MiddlewareHandler {
    return async (c, next) => {
      const ip = this.getClientIP(c);
      const key = `${options.windowMs}-${ip}`;
      const now = Date.now();

      let entry = this.storage.get(key);

      if (!entry || now > entry.resetTime) {
        // Создаем новую запись или сбрасываем существующую
        entry = {
          count: 1,
          resetTime: now + options.windowMs
        };
        this.storage.set(key, entry);
      } else {
        // Проверяем лимит
        if (entry.count >= options.maxRequests) {
          const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);
          return c.json({
            error: options.message || 'RATE_LIMIT_EXCEEDED',
            retryAfter: resetInSeconds
          }, 429);
        }
        entry.count++;
      }

      await next();

      // Очистка устаревших записей (опционально, для предотвращения утечек памяти)
      this.cleanup();
    };
  }

  private getClientIP(c: any): string {
    // Пытаемся получить реальный IP адрес клиента
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    const clientIP = c.req.header('x-client-ip');

    if (forwarded) {
      // Берем первый IP из списка (если за прокси)
      return forwarded.split(',')[0].trim();
    }

    return realIP || clientIP || '127.0.0.1'; // fallback для localhost
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}

// Создаем глобальный экземпляр rate limiter'а
export const rateLimiter = new RateLimiter();

// Готовые middleware для конкретных ограничений
export const createVotingLimiter = (() => {
  const config = configManager.getConfig();
  return rateLimiter.limit({
    windowMs: 60 * 1000, // 1 минута
    maxRequests: config.rateLimit.votingPerMinute,
    message: 'RATE_LIMIT_MINUTE_EXCEEDED'
  });
})();

export const createVotingHourlyLimiter = (() => {
  const config = configManager.getConfig();
  return rateLimiter.limit({
    windowMs: 60 * 60 * 1000, // 1 час
    maxRequests: config.rateLimit.votingPerHour,
    message: 'RATE_LIMIT_HOUR_EXCEEDED'
  });
})();

// Комбинированный middleware для минутного и часового ограничений
export const votingRateLimit: MiddlewareHandler = async (c, next) => {
  const config = configManager.getConfig();
  
  // Сначала проверяем минутный лимит
  const minuteLimiter = rateLimiter.limit({
    windowMs: 60 * 1000,
    maxRequests: config.rateLimit.votingPerMinute,
    message: 'RATE_LIMIT_MINUTE_EXCEEDED'
  });

  // Затем проверяем часовой лимит
  const hourLimiter = rateLimiter.limit({
    windowMs: 60 * 60 * 1000,
    maxRequests: config.rateLimit.votingPerHour,
    message: 'RATE_LIMIT_HOUR_EXCEEDED'
  });

  // Применяем оба лимитера последовательно
  await minuteLimiter(c, async () => {
    await hourLimiter(c, next);
  });
};
