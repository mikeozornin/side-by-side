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
    const mattermostEnabled = process.env.MATTERMOST_ENABLED === 'true';
    const mattermostWebhookUrl = process.env.MATTERMOST_WEBHOOK_URL;
    
    logger.info(`MATTERMOST_ENABLED: ${process.env.MATTERMOST_ENABLED} (parsed: ${mattermostEnabled})`);
    logger.info(`MATTERMOST_WEBHOOK_URL: ${mattermostWebhookUrl ? 'set' : 'not set'}`);

    const mattermostConfig: NotificationConfig = {
      enabled: mattermostEnabled,
      webhookUrl: mattermostWebhookUrl
    };

    if (mattermostConfig.enabled) {
      const mattermostProvider = new MattermostProvider(mattermostConfig);
      this.providers.push(mattermostProvider);
      logger.info(`Mattermost provider added. Valid: ${mattermostProvider.validate()}`);
    }

    // Telegram провайдер (заготовка)
    const telegramEnabled = process.env.TELEGRAM_ENABLED === 'true';
    const telegramConfig: NotificationConfig = {
      enabled: telegramEnabled,
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
    
    logger.info(`Total providers: ${this.providers.length}, enabled: ${enabledProviders.length}`);
    
    if (enabledProviders.length === 0) {
      logger.info(i18n.t('service.noActiveProviders'));
      // Показываем детали о каждом провайдере
      this.providers.forEach((provider, index) => {
        logger.info(`Provider ${index + 1}: ${provider.name}, enabled: ${provider.isEnabled}, valid: ${provider.validate()}`);
      });
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
