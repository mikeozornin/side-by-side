import { NotificationProvider } from './providers/base.js';
import { MattermostProvider } from './providers/mattermost.js';
import { TelegramProvider } from './providers/telegram.js';
import { WebPushProvider } from './providers/webPush.js';
import { NotificationData, NotificationResult, NotificationConfig } from './types.js';
import { logger } from '../utils/logger.js';
import { i18n } from './i18n.js';
import { configManager } from '../utils/config.js';

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

    // Web Push провайдер
    const webPushConfig = configManager.getWebPushConfig();
    if (configManager.isWebPushEnabled()) {
      const webPushProvider = new WebPushProvider(webPushConfig);
      this.providers.push(webPushProvider);
      logger.info(`Web Push provider added. Valid: ${webPushProvider.validate()}`);
    } else {
      logger.info('Web Push provider not enabled or not configured');
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

  async sendVotingCreatedNotification(votingId: string, title: string, expiresAt?: string, isPublic: boolean = true, authorUserId?: string): Promise<void> {
    // Не отправляем уведомления для приватных голосований
    if (!isPublic) {
      logger.info(`Skipping notification for private voting: ${votingId}`);
      return;
    }

    const votingUrl = `${process.env.VOTING_BASE_URL || 'http://localhost:5173'}/#/v/${votingId}`;
    
    const notificationData: NotificationData = {
      title,
      votingId,
      votingUrl,
      createdAt: new Date().toISOString(),
      expiresAt,
      authorUserId
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
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // +7 дней
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

  // Отправка уведомления о завершении голосования владельцу (если он подписан на этот тип)
  async sendVotingCompletedNotification(votingId: string, title: string, ownerUserId?: string | null): Promise<void> {
    if (!ownerUserId) {
      logger.info('Skipping voting completed notification: owner is null');
      return;
    }

    const webPushProvider = this.providers.find(p => p.name === 'Web Push') as WebPushProvider | undefined;
    if (!webPushProvider) {
      logger.info('Web Push provider not available, skipping voting completed notification');
      return;
    }

    const votingUrl = configManager.getVotingUrl(votingId);
    try {
      await webPushProvider.sendVotingCompleteNotification(title, votingUrl, ownerUserId);
    } catch (error) {
      logger.error('Error sending voting completed notification:', error);
    }
  }
}
