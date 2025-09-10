import webpush from 'web-push';
import { NotificationProvider } from './base.js';
import { NotificationData, NotificationResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../i18n.js';
import { 
  getAllWebPushSubscriptions,
  getUsersSubscribedToNewVotings,
  getUsersSubscribedToMyVotingsComplete,
  getUserSubscriptionsForVotingComplete,
  deleteWebPushSubscriptionByEndpointOnly
} from '../../db/web-push-queries.js';

export interface WebPushConfig extends Record<string, any> {
  enabled: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidEmail: string;
}

export class WebPushProvider extends NotificationProvider {
  private vapidKeys: { publicKey: string; privateKey: string; email: string } | null = null;

  constructor(config: WebPushConfig) {
    super(config);
    this.initializeVapidKeys();
  }

  get name(): string {
    return i18n.t('webPush.providerName');
  }

  validate(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const { vapidPublicKey, vapidPrivateKey, vapidEmail } = this.config;
    
    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      logger.warn('Web Push VAPID keys not configured');
      return false;
    }

    return true;
  }

  private initializeVapidKeys(): void {
    if (this.validate()) {
      this.vapidKeys = {
        publicKey: this.config.vapidPublicKey,
        privateKey: this.config.vapidPrivateKey,
        email: this.config.vapidEmail,
      };

      // Настраиваем web-push с VAPID ключами
      webpush.setVapidDetails(
        this.vapidKeys.email,
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );

      logger.info('Web Push VAPID keys initialized');
    }
  }

  async send(data: NotificationData): Promise<NotificationResult> {
    if (!this.vapidKeys) {
      return {
        success: false,
        error: i18n.t('webPush.notConfigured'),
        provider: this.name,
      };
    }

    try {
      // Отправляем уведомление о новом голосовании всем пользователям,
      // которые подписались на уведомления о новых голосованиях
      const notificationPayload = {
        title: i18n.t('webPush.newVotingTitle'),
        body: data.title,
        icon: '/icon.svg',
        badge: '/icon.svg',
        url: data.votingUrl,
        data: { type: 'new_voting', votingId: data.votingId }
      };

      let subscriptions = await getUsersSubscribedToNewVotings();

      // Исключаем автора (не отправляем уведомление на его подписки)
      if (data.authorUserId) {
        subscriptions = subscriptions.filter((s: any) => (s.userId || s.user_id) !== data.authorUserId);
      }
      const { success, failed } = await this.sendToSubscriptions(subscriptions, notificationPayload);

      logger.info(`Web Push: new voting notification sent. Success: ${success}, Failed: ${failed}`);

      return {
        success: failed === 0,
        error: failed > 0 ? `Failed to send to ${failed} subscriptions` : undefined,
        provider: this.name,
      };
    } catch (error) {
      logger.error('Error sending Web Push notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  // Метод для отправки уведомления конкретному пользователю
  async sendToUser(userId: number, notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    data?: Record<string, any>;
  }): Promise<boolean> {
    if (!this.vapidKeys) {
      logger.error(i18n.t('webPush.notConfigured'));
      return false;
    }

    try {
      // TODO: Получить подписку пользователя из БД
      // const subscription = await getWebPushSubscription(userId);
      // if (!subscription) return false;

      // const pushSubscription = {
      //   endpoint: subscription.endpoint,
      //   keys: {
      //     p256dh: subscription.p256dh,
      //     auth: subscription.auth,
      //   },
      // };

      // const payload = JSON.stringify(notification);
      // await webpush.sendNotification(pushSubscription, payload);

      logger.info(`Web Push notification sent to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending Web Push to user ${userId}:`, error);
      return false;
    }
  }

  // Метод для отправки уведомления всем подписанным пользователям
  async sendToAll(notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    data?: Record<string, any>;
  }): Promise<{ success: number; failed: number }> {
    if (!this.vapidKeys) {
      logger.error(i18n.t('webPush.notConfigured'));
      return { success: 0, failed: 0 };
    }

    try {
      const subscriptions = await getAllWebPushSubscriptions();
      return await this.sendToSubscriptions(subscriptions, notification);
    } catch (error) {
      logger.error('Error sending Web Push to all:', error);
      return { success: 0, failed: 0 };
    }
  }

  // Метод для отправки уведомления о новых голосованиях
  async sendNewVotingNotification(votingTitle: string, votingUrl: string): Promise<{ success: number; failed: number }> {
    const notification = {
      title: i18n.t('webPush.newVotingTitle'),
      body: votingTitle,
      icon: '/icon.svg',
      badge: '/icon.svg',
      url: votingUrl,
      data: { type: 'new_voting' }
    };

    const subscriptions = await getUsersSubscribedToNewVotings();
    return await this.sendToSubscriptions(subscriptions, notification);
  }

  // Метод для отправки уведомления о завершении голосования
  async sendVotingCompleteNotification(votingTitle: string, votingUrl: string, userId: string): Promise<{ success: number; failed: number }> {
    const notification = {
      title: i18n.t('webPush.votingCompleteTitle'),
      body: i18n.t('webPush.votingCompleteBody', { title: votingTitle }),
      icon: '/icon.svg',
      badge: '/icon.svg',
      url: votingUrl,
      data: { type: 'voting_complete' }
    };

    const subscriptions = await getUserSubscriptionsForVotingComplete(userId);
    return await this.sendToSubscriptions(subscriptions, notification);
  }

  // Вспомогательный метод для отправки уведомлений списку подписок
  private async sendToSubscriptions(subscriptions: any[], notification: any): Promise<{ success: number; failed: number }> {
    if (!this.vapidKeys) {
      logger.error(i18n.t('webPush.notConfigured'));
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        // Safari (web.push.apple.com) иногда показывает тело payload как сырую строку,
        // если событие push не обрабатывается SW. Чтобы уведомление выглядело корректно
        // даже в fallback-режиме, шлём для Safari простой текст вместо JSON,
        // используя фактический заголовок уведомления (new voting / finished).
        const isSafari = typeof subscription.endpoint === 'string' && subscription.endpoint.includes('web.push.apple.com');
        const textTitle = notification.title || i18n.t('webPush.newVotingTitle');
        const payload = isSafari
          ? `${textTitle}\n${notification.body}`
          : JSON.stringify(notification);
        await webpush.sendNotification(pushSubscription, payload);
        success++;
      } catch (error) {
        const shouldRemoveSubscription = this.handleWebPushError(error, subscription);
        if (shouldRemoveSubscription) {
          try {
            await deleteWebPushSubscriptionByEndpointOnly(subscription.endpoint);
            logger.info(`Removed invalid subscription ${subscription.id} from database`);
          } catch (deleteError) {
            logger.error(`Failed to remove invalid subscription ${subscription.id}:`, deleteError);
          }
        }
        failed++;
      }
    }

    return { success, failed };
  }

  // Обработка ошибок web-push и определение, нужно ли удалить подписку
  private handleWebPushError(error: any, subscription: any): boolean {
    // Проверяем, является ли это ошибкой web-push
    if (error.name === 'WebPushError') {
      const statusCode = error.statusCode;
      
      // 400 - VapidPkHashMismatch или другие проблемы с VAPID
      // 410 - подписка истекла или была отписана
      // 404 - подписка не найдена
      if (statusCode === 400 || statusCode === 410 || statusCode === 404) {
        logger.warn(`Web Push error ${statusCode} for subscription ${subscription.id}: ${error.message}`);
        return true; // Удаляем подписку
      }
      
      // 413 - payload слишком большой
      // 429 - слишком много запросов
      if (statusCode === 413 || statusCode === 429) {
        logger.warn(`Web Push error ${statusCode} for subscription ${subscription.id}: ${error.message}`);
        return false; // Не удаляем подписку, это временная проблема
      }
    }
    
    // Для других ошибок логируем и не удаляем подписку
    logger.error(`Web Push error for subscription ${subscription.id}:`, error);
    return false;
  }

  // Получить публичный VAPID ключ для клиента
  getPublicKey(): string | null {
    return this.vapidKeys?.publicKey || null;
  }
}
