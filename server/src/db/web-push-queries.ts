import { getDatabase } from './init.js';
import { logger } from '../utils/logger.js';
import { prepareQuery } from './utils.js';

export interface WebPushSubscription {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface NotificationSettings {
  user_id: string;
  new_votings: boolean;
  my_votings_complete: boolean;
  updated_at: string;
}

// Сохранить подписку на Web Push
export async function saveWebPushSubscription(data: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';

  try {
    const sql = DB_PROVIDER === 'postgres'
      ? `
      INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth
    `
      : `
      INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth
    `;

    await db.run(sql, [data.userId, data.endpoint, data.p256dh, data.auth]);
    
    logger.info(`Web Push subscription saved for user ${data.userId}`);
  } catch (error) {
    logger.error('Error saving Web Push subscription:', error);
    throw error;
  }
}

// Удалить подписку на Web Push
export async function deleteWebPushSubscription(userId: string): Promise<void> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery('DELETE FROM web_push_subscriptions WHERE user_id = ?');
    const result = await db.run(sql, [userId]);
    
    if (result.changes && result.changes > 0) {
      logger.info(`Web Push subscription deleted for user ${userId}`);
    }
  } catch (error) {
    logger.error('Error deleting Web Push subscription:', error);
    throw error;
  }
}

// Удалить подписку по endpoint (для отписки конкретного устройства/браузера)
export async function deleteWebPushSubscriptionByEndpoint(userId: string, endpoint: string): Promise<void> {
  const db = getDatabase();

  try {
    const sql = prepareQuery('DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?');
    const result = await db.run(sql, [userId, endpoint]);

    if (result.changes && result.changes > 0) {
      logger.info(`Web Push subscription deleted for user ${userId} by endpoint`);
    }
  } catch (error) {
    logger.error('Error deleting Web Push subscription by endpoint:', error);
    throw error;
  }
}

// Получить подписку пользователя
export async function getWebPushSubscription(userId: string): Promise<WebPushSubscription | null> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery('SELECT * FROM web_push_subscriptions WHERE user_id = ?');
    return await db.get<WebPushSubscription>(sql, [userId]);
  } catch (error) {
    logger.error('Error getting Web Push subscription:', error);
    throw error;
  }
}

// Получить все активные подписки
export async function getAllWebPushSubscriptions(): Promise<WebPushSubscription[]> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery('SELECT * FROM web_push_subscriptions ORDER BY created_at DESC');
    return await db.query<WebPushSubscription>(sql);
  } catch (error) {
    logger.error('Error getting all Web Push subscriptions:', error);
    throw error;
  }
}

// Получить настройки уведомлений пользователя
export async function getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery('SELECT user_id, new_votings, my_votings_complete, updated_at FROM notification_settings WHERE user_id = ?');
    const result = await db.get<NotificationSettings>(sql, [userId]);
    
    if (!result) {
      return null;
    }
    
    return {
      ...result,
      new_votings: Boolean(result.new_votings),
      my_votings_complete: Boolean(result.my_votings_complete),
    };
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    throw error;
  }
}

// Обновить настройки уведомлений
export async function updateNotificationSettings(
  userId: string, 
  settings: { newVotings: boolean; myVotingsComplete: boolean }
): Promise<void> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  
  try {
    const sql = DB_PROVIDER === 'postgres'
      ? `
      INSERT INTO notification_settings (user_id, new_votings, my_votings_complete, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT(user_id) DO UPDATE SET
        new_votings = EXCLUDED.new_votings,
        my_votings_complete = EXCLUDED.my_votings_complete,
        updated_at = NOW()
    `
      : `
      INSERT OR REPLACE INTO notification_settings (user_id, new_votings, my_votings_complete, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await db.run(sql, [userId, settings.newVotings, settings.myVotingsComplete]);
    
    logger.info(`Notification settings updated for user ${userId}`);
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    throw error;
  }
}

// Получить пользователей, подписанных на новые голосования
export async function getUsersSubscribedToNewVotings(): Promise<WebPushSubscription[]> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery(`
      SELECT wps.* FROM web_push_subscriptions wps
      INNER JOIN notification_settings ns ON wps.user_id = ns.user_id
      WHERE ns.new_votings = TRUE
    `);
    
    return await db.query<WebPushSubscription>(sql);
  } catch (error) {
    logger.error('Error getting users subscribed to new votings:', error);
    throw error;
  }
}

// Получить пользователей, подписанных на завершение своих голосований
export async function getUsersSubscribedToMyVotingsComplete(): Promise<WebPushSubscription[]> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery(`
      SELECT wps.* FROM web_push_subscriptions wps
      INNER JOIN notification_settings ns ON wps.user_id = ns.user_id
      WHERE ns.my_votings_complete = TRUE
    `);
    
    return await db.query<WebPushSubscription>(sql);
  } catch (error) {
    logger.error('Error getting users subscribed to my votings complete:', error);
    throw error;
  }
}

// Получить подписки конкретного пользователя для завершения его голосований
export async function getUserSubscriptionsForVotingComplete(userId: string): Promise<WebPushSubscription[]> {
  const db = getDatabase();
  
  try {
    const sql = prepareQuery(`
      SELECT wps.* FROM web_push_subscriptions wps
      INNER JOIN notification_settings ns ON wps.user_id = ns.user_id
      WHERE wps.user_id = ? AND ns.my_votings_complete = TRUE
    `);
    
    return await db.query<WebPushSubscription>(sql, [userId]);
  } catch (error) {
    logger.error('Error getting user subscriptions for voting complete:', error);
    throw error;
  }
}
