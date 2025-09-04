import { NotificationProvider } from './base.js';
import { NotificationData, NotificationResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../i18n.js';

export class TelegramProvider extends NotificationProvider {
  get name(): string {
    return i18n.t('telegram.providerName');
  }

  validate(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // TODO: Implement Telegram validation
    logger.warn(i18n.t('telegram.notImplemented'));
    return false;
  }

  async send(data: NotificationData): Promise<NotificationResult> {
    // TODO: Implement Telegram sending
    logger.warn(i18n.t('telegram.notImplemented'));
    
    return {
      success: false,
      error: i18n.t('telegram.notImplemented'),
      provider: this.name
    };
  }
}
