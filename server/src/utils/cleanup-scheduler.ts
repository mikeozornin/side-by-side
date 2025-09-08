import { cleanupExpiredAuthData, cleanupOldUserSessions } from '../db/auth-queries.js';
import { logger } from './logger.js';
import { env } from '../load-env.js';

// Настройки
const CLEANUP_INTERVAL_HOURS = 24; // Запускать очистку каждые 24 часа
const COMPLETION_CHECK_INTERVAL_MS = 60 * 1000; // Проверять завершения каждую минуту
const USER_SESSION_CLEANUP_LIMIT = 10; // Оставлять максимум 5 сессий на пользователя

// Флаг для предотвращения одновременного выполнения очистки
let isCleanupRunning = false;

// Планировщик очистки
export class CleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private completionIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Запуск планировщика
  start(): void {
    if (this.isRunning) {
      logger.info('Cleanup scheduler уже запущен');
      return;
    }

    this.isRunning = true;
    logger.info(`Запуск планировщика очистки (интервал: ${CLEANUP_INTERVAL_HOURS} часов)`);

    // Запуск немедленной очистки при старте
    this.runCleanup().catch(error => {
      logger.error('Ошибка при начальной очистке:', error);
    });

    // Установка периодической очистки
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(error => {
        logger.error('Ошибка при периодической очистке:', error);
      });
    }, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);

    // Запуск проверки завершённых голосований
    this.startCompletionWatcher();
  }

  // Остановка планировщика
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.completionIntervalId) {
      clearInterval(this.completionIntervalId);
      this.completionIntervalId = null;
    }
    this.isRunning = false;
    logger.info('Cleanup scheduler остановлен');
  }

  // Ручной запуск очистки
  async runCleanup(): Promise<{ sessions: number; magicTokens: number; figmaCodes: number; total: number }> {
    if (isCleanupRunning) {
      logger.warn('Очистка уже выполняется, пропускаем');
      throw new Error('Cleanup already running');
    }

    isCleanupRunning = true;

    try {
      logger.info('🔄 Начинаем автоматическую очистку истекших данных...');

      const result = cleanupExpiredAuthData();

      // Дополнительная очистка: удаляем старые сессии пользователей
      await this.cleanupOldUserSessions();

      logger.info(`✅ Автоматическая очистка завершена успешно. Удалено записей: ${result.total}`);

      return result;
    } catch (error) {
      logger.error('❌ Ошибка при автоматической очистке:', error);
      throw error;
    } finally {
      isCleanupRunning = false;
    }
  }

  // Очистка старых сессий пользователей
  private async cleanupOldUserSessions(): Promise<void> {
    try {
      // Получаем всех пользователей с активными сессиями
      const { getDatabase } = await import('../db/init.js');
      const db = getDatabase();

      const users = db.prepare(`
        SELECT DISTINCT user_id FROM sessions
      `).all() as { user_id: string }[];

      let totalCleaned = 0;

      for (const { user_id } of users) {
        const cleaned = cleanupOldUserSessions(user_id, USER_SESSION_CLEANUP_LIMIT);
        totalCleaned += cleaned;
      }

      if (totalCleaned > 0) {
        logger.info(`🧹 Очищено старых сессий пользователей: ${totalCleaned}`);
      }
    } catch (error) {
      logger.error('Ошибка при очистке старых сессий пользователей:', error);
    }
  }

  // Получение статуса планировщика
  getStatus(): { isRunning: boolean; nextCleanup?: Date } {
    return {
      isRunning: this.isRunning,
      nextCleanup: this.intervalId ? new Date(Date.now() + CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000) : undefined
    };
  }

  private startCompletionWatcher(): void {
    if (this.completionIntervalId) return;
    this.completionIntervalId = setInterval(() => {
      this.checkCompletedVotings().catch((e) => {
        logger.error('Ошибка проверки завершённых голосований:', e);
      });
    }, COMPLETION_CHECK_INTERVAL_MS);
  }

  private async checkCompletedVotings(): Promise<void> {
    try {
      const { getDueCompletedVotings, markVotingCompleteNotified } = await import('../db/queries.js');
      const { NotificationService } = await import('../notifications/index.js');
      const service = new NotificationService();

      const due = getDueCompletedVotings(50);
      if (due.length === 0) return;

      for (const v of due) {
        try {
          await service.sendVotingCompletedNotification(v.id, v.title, v.user_id || undefined);
          markVotingCompleteNotified(v.id);
          logger.info(`Отправлено уведомление о завершении голосования ${v.id}`);
        } catch (err) {
          logger.error(`Ошибка отправки уведомления о завершении голосования ${v.id}:`, err);
        }
      }
    } catch (error) {
      logger.error('Критическая ошибка в checkCompletedVotings:', error);
    }
  }
}

// Глобальный экземпляр планировщика
export const cleanupScheduler = new CleanupScheduler();

// Функции для ручного управления
export async function runManualCleanup(): Promise<{ sessions: number; magicTokens: number; figmaCodes: number; total: number }> {
  return cleanupScheduler.runCleanup();
}

export function startCleanupScheduler(): void {
  cleanupScheduler.start();
}

export function stopCleanupScheduler(): void {
  cleanupScheduler.stop();
}

export function getCleanupStatus() {
  return cleanupScheduler.getStatus();
}
