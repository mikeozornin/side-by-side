import { NotificationProvider } from './base.js';
import { NotificationData, NotificationResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../i18n.js';

export class MattermostProvider extends NotificationProvider {
  get name(): string {
    return i18n.t('mattermost.providerName');
  }

  validate(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.config.webhookUrl) {
      logger.warn(i18n.t('mattermost.webhookNotConfigured'));
      return false;
    }

    try {
      new URL(this.config.webhookUrl);
      return true;
    } catch {
      logger.warn(i18n.t('mattermost.webhookInvalidFormat'));
      return false;
    }
  }

  async send(data: NotificationData): Promise<NotificationResult> {
    if (!this.validate()) {
      return {
        success: false,
        error: i18n.t('mattermost.providerNotConfigured'),
        provider: this.name
      };
    }

    try {
      const message = this.formatMessage(data);
      
      const response = await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.info(i18n.t('mattermost.notificationSent', { votingId: data.votingId }));
      
      return {
        success: true,
        provider: this.name
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(i18n.t('mattermost.sendError', { error: errorMessage }));
      
      return {
        success: false,
        error: errorMessage,
        provider: this.name
      };
    }
  }

  private formatMessage(data: NotificationData): string {
    return i18n.t('mattermost.messageFormat', { 
      title: data.title, 
      votingUrl: data.votingUrl 
    });
  }
}
