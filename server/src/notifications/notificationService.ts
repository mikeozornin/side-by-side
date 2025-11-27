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
    const mattermostSendMethod = (process.env.MATTERMOST_SEND_METHOD || 'api') as 'webhook' | 'api';
    const mattermostWebhookUrl = process.env.MATTERMOST_WEBHOOK_URL;
    const mattermostServerUrl = process.env.MATTERMOST_SERVER_URL;
    const mattermostApiToken = process.env.MATTERMOST_API_TOKEN;
    const mattermostChannelId = process.env.MATTERMOST_CHANNEL_ID;
    
    logger.info(`MATTERMOST_ENABLED: ${process.env.MATTERMOST_ENABLED} (parsed: ${mattermostEnabled})`);
    logger.info(`MATTERMOST_SEND_METHOD: ${mattermostSendMethod}`);
    
    if (mattermostSendMethod === 'webhook') {
      logger.info(`MATTERMOST_WEBHOOK_URL: ${mattermostWebhookUrl ? 'set' : 'not set'}`);
    } else {
      logger.info(`MATTERMOST_SERVER_URL: ${mattermostServerUrl ? 'set' : 'not set'}`);
      logger.info(`MATTERMOST_API_TOKEN: ${mattermostApiToken ? 'set' : 'not set'}`);
      logger.info(`MATTERMOST_CHANNEL_ID: ${mattermostChannelId ? 'set' : 'not set'}`);
    }

    const mattermostTeamSlug = process.env.MATTERMOST_TEAM_SLUG;
    
    const mattermostConfig: NotificationConfig = {
      enabled: mattermostEnabled,
      sendMethod: mattermostSendMethod,
      webhookUrl: mattermostWebhookUrl,
      serverUrl: mattermostServerUrl,
      apiToken: mattermostApiToken,
      channelId: mattermostChannelId,
      teamSlug: mattermostTeamSlug
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

  async sendVotingCreatedNotification(votingId: string, title: string, expiresAt?: string, isPublic: boolean = true, authorUserId?: string, options?: NotificationData['options'], previewPath?: string): Promise<void> {
    // Не отправляем уведомления для приватных голосований
    if (!isPublic) {
      logger.info(`Skipping notification for private voting: ${votingId}`);
      return;
    }

    const { getVoting } = await import('../db/queries.js');
    const voting = await getVoting(votingId);
    const votingUrl = configManager.getVotingUrl(voting || votingId);
    
    const notificationData: NotificationData = {
      title,
      votingId,
      votingUrl,
      createdAt: new Date().toISOString(),
      expiresAt,
      authorUserId,
      options,
      previewPath
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
        
        // Сохранить post_id для Mattermost провайдера
        if (result.provider === 'Mattermost' && result.postId) {
          try {
            const { updateVotingMattermostPostId } = await import('../db/queries.js');
            await updateVotingMattermostPostId(data.votingId, result.postId);
            logger.info(`Saved Mattermost post_id ${result.postId} for voting ${data.votingId}`);
          } catch (error) {
            logger.error(`Error saving Mattermost post_id for voting ${data.votingId}:`, error);
          }
        }
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

  // Отправка уведомления о завершении голосования
  async sendVotingCompletedNotification(votingId: string, title: string, ownerUserId?: string | null): Promise<void> {
    try {
      // Получить данные голосования и результаты
      const { getVoting, getVotingOptions, getVoteCounts } = await import('../db/queries.js');
      const { generateVotingPreviewWithResults, saveVotingResultsPreview } = await import('../utils/previewGenerator.js');
      
      const voting = await getVoting(votingId);
      if (!voting) {
        logger.warn(`Voting ${votingId} not found for completion notification`);
        return;
      }

      // Получить опции и результаты голосования
      const options = await getVotingOptions(votingId);
      const voteCounts = await getVoteCounts(votingId);
      const totalVotes = voteCounts.reduce((sum, r) => sum + r.count, 0);

      const results = options.map(option => {
        const voteInfo = voteCounts.find(vc => vc.option_id === option.id);
        return {
          option_id: option.id,
          count: voteInfo?.count || 0,
          percentage: totalVotes > 0 ? Math.round(((voteInfo?.count || 0) / totalVotes) * 100) : 0
        };
      });

      // Коррекция процентов, чтобы в сумме было 100%
      let percentageSum = results.reduce((sum, r) => sum + r.percentage, 0);
      if (totalVotes > 0 && percentageSum < 100) {
        const diff = 100 - percentageSum;
        const maxPercentageItem = results.reduce((max, item) => (item.percentage > max.percentage ? item : max), results[0]);
        maxPercentageItem.percentage += diff;
      }

      // Определение победителя
      let winner: number | 'tie' | null = null;
      if (totalVotes > 0) {
        const maxVotes = Math.max(...results.map(r => r.count));
        const winners = results.filter(r => r.count === maxVotes);
        if (winners.length === 1) {
          winner = winners[0].option_id;
        } else {
          winner = 'tie';
        }
      } else {
        winner = 'tie';
      }

      let resultsPreviewPath: string | undefined;
      try {
        logger.info(`Generating results preview for voting ${votingId} with ${options.length} options`);
        const previewBuffer = await generateVotingPreviewWithResults(options, results, winner);
        if (previewBuffer) {
          resultsPreviewPath = await saveVotingResultsPreview(votingId, previewBuffer);
          logger.info(`Results preview generated and saved: ${resultsPreviewPath}`);
        } else {
          logger.warn(`Results preview generation returned null for voting ${votingId}`);
        }
      } catch (error) {
        logger.error(`Error generating results preview for voting ${votingId}:`, error);
      }

      // Отправить уведомление в Mattermost, если включен и есть post_id
      const mattermostProvider = this.providers.find(p => p.name === 'Mattermost') as MattermostProvider | undefined;
      if (mattermostProvider && voting.mattermost_post_id) {
        try {
          const votingUrl = configManager.getVotingUrl(voting);
          if (resultsPreviewPath) {
            await mattermostProvider.sendVotingCompletedNotification(
              votingId,
              title,
              votingUrl,
              voting.mattermost_post_id,
              resultsPreviewPath
            );
            logger.info(`Mattermost completion notification sent for voting ${votingId}`);
          } else {
            logger.warn(`Skipping Mattermost completion notification: no results preview generated for voting ${votingId}`);
          }
        } catch (error) {
          logger.error(`Error sending Mattermost completion notification for voting ${votingId}:`, error);
        }
      }

      // Отправить Web Push уведомление владельцу (если он указан)
      if (ownerUserId) {
        const webPushProvider = this.providers.find(p => p.name === 'Web Push') as WebPushProvider | undefined;
        if (webPushProvider) {
          try {
            const votingUrl = configManager.getVotingUrl(voting);
            await webPushProvider.sendVotingCompleteNotification(title, votingUrl, ownerUserId);
          } catch (error) {
            logger.error('Error sending Web Push voting completed notification:', error);
          }
        }
      }
    } catch (error) {
      logger.error('Error in sendVotingCompletedNotification:', error);
    }
  }
}
