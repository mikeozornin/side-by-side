import { NotificationProvider } from './base.js';
import { NotificationData, NotificationResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../i18n.js';
import { formatExpirationDate } from '../utils/dateFormatter.js';
import { readFile, unlink } from 'fs/promises';
import { basename, resolve } from 'path';

export class MattermostProvider extends NotificationProvider {
  get name(): string {
    return i18n.t('mattermost.providerName');
  }

  validate(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const sendMethod = this.config.sendMethod || 'api';

    if (sendMethod === 'webhook') {
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
    } else if (sendMethod === 'api') {
      if (!this.config.serverUrl || !this.config.apiToken || !this.config.channelId) {
        logger.warn('Mattermost API not configured: missing serverUrl, apiToken, or channelId');
        return false;
      }

      try {
        new URL(this.config.serverUrl);
        return true;
      } catch {
        logger.warn('Mattermost serverUrl has invalid format');
        return false;
      }
    }

    return false;
  }

  async send(data: NotificationData): Promise<NotificationResult> {
    if (!this.validate()) {
      return {
        success: false,
        error: i18n.t('mattermost.providerNotConfigured'),
        provider: this.name
      };
    }

    const sendMethod = this.config.sendMethod || 'api';

    if (sendMethod === 'webhook') {
      return this.sendViaWebhook(data);
    } else {
      return this.sendViaApi(data);
    }
  }

  private async sendViaWebhook(data: NotificationData): Promise<NotificationResult> {
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

  private async sendViaApi(data: NotificationData): Promise<NotificationResult> {
    try {
      const message = this.formatMessage(data);
      let fileId: string | null = null;

      if (data.previewPath) {
        try {
          fileId = await this.uploadFile(data.previewPath);
          if (fileId) {
            logger.info(`Preview file uploaded successfully, file_id: ${fileId}`);
          }
        } catch (error) {
          logger.warn(`Failed to upload preview file, sending message without attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      const response = await this.sendPostWithFile(message, fileId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // Получить post_id из ответа
      const responseData = await response.json();
      const postId = responseData.id || null;

      // Удаляем preview-файл после успешной отправки
      if (data.previewPath && fileId) {
        try {
          await unlink(data.previewPath);
          logger.info(`Preview file deleted after successful upload: ${data.previewPath}`);
        } catch (error) {
          // Логируем, но не блокируем успешный результат
          logger.warn(`Failed to delete preview file ${data.previewPath}:`, error);
        }
      }

      logger.info(i18n.t('mattermost.notificationSent', { votingId: data.votingId }));
      
      return {
        success: true,
        provider: this.name,
        postId: postId || undefined
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

  private async uploadFile(filePath: string): Promise<string | null> {
    try {
      // Security: Validate file path is within expected data directory
      const dataDir = process.env.DATA_DIR || './data';
      const resolvedDataDir = resolve(dataDir);
      const resolvedFilePath = resolve(filePath);

      if (!resolvedFilePath.startsWith(resolvedDataDir)) {
        throw new Error('File path is outside of allowed data directory');
      }

      const fileBuffer = await readFile(filePath);

      // Security: Use path.basename() for safe filename extraction
      let fileName = basename(filePath);

      // Security: Check for path traversal attempts
      if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        throw new Error('Invalid filename: contains path traversal sequences');
      }

      // Fallback to safe default if filename is empty or invalid
      if (!fileName || fileName.length === 0) {
        fileName = 'preview.png';
      }

      const formData = new FormData();
      const file = new File([fileBuffer], fileName, { type: 'image/png' });
      formData.append('files', file);
      formData.append('channel_id', this.config.channelId!);

      const serverUrl = this.config.serverUrl!.replace(/\/$/, ''); // убираем trailing slash
      const uploadUrl = `${serverUrl}/api/v4/files`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to upload file: HTTP ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Mattermost API возвращает { file_infos: [{ id: "..." }] }
      if (result.file_infos && result.file_infos.length > 0) {
        return result.file_infos[0].id;
      }

      throw new Error('No file_id in response');
    } catch (error) {
      logger.error(`Error uploading file to Mattermost: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async sendPostWithFile(message: string, fileId: string | null): Promise<Response> {
    const serverUrl = this.config.serverUrl!.replace(/\/$/, '');
    const postUrl = `${serverUrl}/api/v4/posts`;

    const body: { channel_id: string; message: string; file_ids?: string[] } = {
      channel_id: this.config.channelId!,
      message: message
    };

    if (fileId) {
      body.file_ids = [fileId];
    }

    return fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiToken}`
      },
      body: JSON.stringify(body)
    });
  }

  private formatMessage(data: NotificationData): string {
    const expirationDate = data.expiresAt ? `\n\n${formatExpirationDate(data.expiresAt)}` : '';
    
    return i18n.t('mattermost.messageFormat', { 
      title: data.title, 
      votingUrl: data.votingUrl,
      expirationDate: expirationDate
    });
  }

  /**
   * Формирует ссылку на пост Mattermost
   * Если указан teamSlug, использует его, иначе использует /team/pl/
   */
  private formatPostUrl(postId: string): string {
    const rawServerUrl = this.config.serverUrl || 'https://mattermost.example.com';
    const serverUrl = rawServerUrl.replace(/\/$/, ''); // убираем trailing slash
    const teamSlug = this.config.teamSlug;
    
    if (teamSlug) {
      return `${serverUrl}/${teamSlug}/pl/${postId}`;
    }
    
    // Fallback на /team/pl/ если teamSlug не указан
    return `${serverUrl}/team/pl/${postId}`;
  }

  /**
   * Отправить уведомление о завершении голосования с результатами
   */
  async sendVotingCompletedNotification(
    votingId: string,
    title: string,
    votingUrl: string,
    originalPostId: string,
    resultsPreviewPath: string
  ): Promise<NotificationResult> {
    if (!this.validate()) {
      return {
        success: false,
        error: i18n.t('mattermost.providerNotConfigured'),
        provider: this.name
      };
    }

    const sendMethod = this.config.sendMethod || 'api';
    if (sendMethod === 'webhook') {
      // Webhook не поддерживает файлы, отправляем только текст
      const originalPostUrl = this.formatPostUrl(originalPostId);
      const message = i18n.t('mattermost.completionMessageFormat', {
        title,
        originalPostUrl
      });

      try {
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

        logger.info(`Voting completion notification sent for ${votingId}`);
        return {
          success: true,
          provider: this.name
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error sending voting completion notification: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
          provider: this.name
        };
      }
    }

    // API метод - отправляем с превьюшкой
    try {
      const originalPostUrl = this.formatPostUrl(originalPostId);
      const message = i18n.t('mattermost.completionMessageFormat', {
        title,
        originalPostUrl
      });

      let fileId: string | null = null;

      try {
        fileId = await this.uploadFile(resultsPreviewPath);
        if (fileId) {
          logger.info(`Results preview file uploaded successfully, file_id: ${fileId}`);
        }
      } catch (error) {
        logger.warn(`Failed to upload results preview file, sending message without attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      const response = await this.sendPostWithFile(message, fileId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // Удаляем preview-файл после успешной отправки
      if (fileId) {
        try {
          await unlink(resultsPreviewPath);
          logger.info(`Results preview file deleted after successful upload: ${resultsPreviewPath}`);
        } catch (error) {
          // Логируем, но не блокируем успешный результат
          logger.warn(`Failed to delete results preview file ${resultsPreviewPath}:`, error);
        }
      }

      logger.info(`Voting completion notification sent for ${votingId}`);
      
      return {
        success: true,
        provider: this.name
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending voting completion notification: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        provider: this.name
      };
    }
  }
}
