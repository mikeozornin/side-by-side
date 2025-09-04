import { NotificationProvider } from './providers/base.js';
import { MattermostProvider } from './providers/mattermost.js';
import { TelegramProvider } from './providers/telegram.js';
import { NotificationData, NotificationResult, NotificationConfig } from './types.js';
import { logger } from '../utils/logger.js';
import { i18n } from './i18n.js';

export class NotificationService {
  private providers: NotificationProvider[] = [];

  constructor() {
    this.initializeProviders();
    this.logLocaleInfo();
  }

  private initializeProviders(): void {
    // Mattermost провайдер
    const mattermostConfig: NotificationConfig = {
      enabled: process.env.MATTERMOST_ENABLED === 'true',
      webhookUrl: process.env.MATTERMOST_WEBHOOK_URL
    };

    if (mattermostConfig.enabled) {
      this.providers.push(new MattermostProvider(mattermostConfig));
    }

    // Telegram провайдер (заготовка)
    const telegramConfig: NotificationConfig = {
      enabled: process.env.TELEGRAM_ENABLED === 'true',
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID
    };

    if (telegramConfig.enabled) {
      this.providers.push(new TelegramProvider(telegramConfig));
    }

    logger.info(i18n.t('service.providersInitialized', { count: this.providers.length }));
  }

  private logLocaleInfo(): void {
    const currentLocale = i18n.getLocale();
    const envLocale = process.env.NOTIFICATIONS_LOCALE;
    
    if (envLocale && envLocale !== currentLocale) {
      logger.warn(`Invalid NOTIFICATIONS_LOCALE="${envLocale}", using fallback: ${currentLocale}`);
    } else {
      logger.info(`Notifications locale: ${currentLocale}`);
    }
  }

  async sendVotingCreatedNotification(votingId: string, title: string): Promise<void> {
    const votingUrl = `${process.env.VOTING_BASE_URL || 'http://localhost:5173'}/#/v/${votingId}`;
    
    const notificationData: NotificationData = {
      title,
      votingId,
      votingUrl,
      createdAt: new Date().toISOString()
    };

    // Отправляем уведомления асинхронно
    this.sendNotificationsAsync(notificationData);
  }

  private async sendNotificationsAsync(data: NotificationData): Promise<void> {
    const enabledProviders = this.providers.filter(provider => provider.isEnabled);
    
    if (enabledProviders.length === 0) {
      logger.info(i18n.t('service.noActiveProviders'));
      return;
    }

    // Отправляем уведомления параллельно
    const promises = enabledProviders.map(provider => 
      this.sendToProvider(provider, data)
    );

    await Promise.allSettled(promises);
  }

  private async sendToProvider(provider: NotificationProvider, data: NotificationData): Promise<void> {
    try {
      const result = await provider.send(data);
      
      if (result.success) {
        logger.info(i18n.t('service.notificationSent', { provider: result.provider }));
      } else {
        logger.error(i18n.t('service.sendError', { provider: result.provider, error: result.error }));
      }
    } catch (error) {
      logger.error(i18n.t('service.unexpectedError', { provider: provider.name, error: error }));
    }
  }

  async testNotifications(): Promise<NotificationResult[]> {
    const testData: NotificationData = {
      title: 'Тестовое голосование',
      votingId: 'test-123',
      votingUrl: 'http://localhost:5173/#/v/test-123',
      createdAt: new Date().toISOString()
    };

    const enabledProviders = this.providers.filter(provider => provider.isEnabled);
    const results: NotificationResult[] = [];

    for (const provider of enabledProviders) {
      try {
        const result = await provider.send(testData);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          provider: provider.name
        });
      }
    }

    return results;
  }
}
