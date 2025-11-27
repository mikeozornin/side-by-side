import type { VotingOption } from '../db/queries.js';

export interface NotificationConfig {
  enabled: boolean;
  sendMethod?: 'webhook' | 'api'; // метод отправки
  webhookUrl?: string; // для webhook
  serverUrl?: string; // для API
  apiToken?: string; // для API
  channelId?: string; // для API
  teamSlug?: string; // slug команды Mattermost (для формирования ссылок на посты)
  [key: string]: any;
}

export interface NotificationData {
  title: string;
  votingId: string;
  votingUrl: string;
  createdAt: string;
  expiresAt?: string;
  authorUserId?: string;
  options?: VotingOption[];
  previewPath?: string; // путь к файлу превьюшки (для API, удаляется после успешной отправки)
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  provider: string;
  postId?: string; // для Mattermost post_id
}
