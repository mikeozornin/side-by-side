import { Hono } from 'hono';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/config.js';
import { requireAuth, AuthContext } from '../middleware/auth.js';
import { 
  saveWebPushSubscription,
  deleteWebPushSubscription,
  deleteWebPushSubscriptionByEndpoint,
  getWebPushSubscription,
  getNotificationSettings,
  updateNotificationSettings
} from '../db/web-push-queries.js';

export const webPushRoutes = new Hono();

// GET /api/web-push/vapid-public-key - получение публичного VAPID ключа
webPushRoutes.get('/vapid-public-key', async (c) => {
  try {
    if (!configManager.isWebPushEnabled()) {
      return c.json({ error: 'Web Push notifications are not enabled' }, 503);
    }

    const webPushConfig = configManager.getWebPushConfig();
    return c.json({ 
      publicKey: webPushConfig.vapidPublicKey 
    });
  } catch (error) {
    logger.error('Error getting VAPID public key:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/web-push/subscribe - подписка на уведомления (требует авторизацию)
webPushRoutes.post('/subscribe', requireAuth, async (c: AuthContext) => {
  try {
    if (!configManager.isWebPushEnabled()) {
      return c.json({ error: 'Web Push notifications are not enabled' }, 503);
    }

    const subscription = await c.req.json();
    const userId = c.user?.id;
    
    if (!userId) {
      return c.json({ error: 'User not found' }, 401);
    }

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return c.json({ error: 'Invalid subscription data' }, 400);
    }

    // Сохраняем подписку в БД
    await saveWebPushSubscription({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    });

    logger.info(`Web Push subscription saved for user ${userId}`);
    return c.json({ success: true });
  } catch (error) {
    logger.error('Error subscribing to web push:', error);
    return c.json({ error: 'Failed to subscribe to notifications' }, 500);
  }
});

// POST /api/web-push/unsubscribe - отписка от уведомлений (требует авторизацию)
webPushRoutes.post('/unsubscribe', requireAuth, async (c: AuthContext) => {
  try {
    const userId = c.user?.id;
    
    if (!userId) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    // Если пришёл endpoint — удаляем конкретную подписку, иначе все подписки пользователя
    let body: any = {};
    try { body = await c.req.json(); } catch {}
    const endpoint = body?.endpoint as string | undefined;
    
    if (endpoint) {
      await deleteWebPushSubscriptionByEndpoint(userId, endpoint);
    } else {
      await deleteWebPushSubscription(userId);
    }
    
    logger.info(`Web Push subscription removed for user ${userId}`);
    return c.json({ success: true });
  } catch (error) {
    logger.error('Error unsubscribing from web push:', error);
    return c.json({ error: 'Failed to unsubscribe from notifications' }, 500);
  }
});

// GET /api/web-push/settings - получение настроек уведомлений (требует авторизацию)
webPushRoutes.get('/settings', requireAuth, async (c: AuthContext) => {
  try {
    const userId = c.user?.id;
    
    if (!userId) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    const settings = await getNotificationSettings(userId);
    const subscription = await getWebPushSubscription(userId);
    
    logger.info(`Loading settings for user ${userId}:`, settings);
    
    return c.json({
      settings: settings || {
        newVotings: false,
        myVotingsComplete: false
      },
      isSubscribed: !!subscription
    });
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    return c.json({ error: 'Failed to get notification settings' }, 500);
  }
});


// POST /api/web-push/settings - обновление настроек уведомлений (требует авторизацию)
webPushRoutes.post('/settings', requireAuth, async (c: AuthContext) => {
  try {
    const userId = c.user?.id;
    
    if (!userId) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    const body = await c.req.json();
    logger.info(`Received settings update for user ${userId}:`, body);
    
    const { newVotings, myVotingsComplete } = body;
    
    // Проверяем, что хотя бы одно поле передано и имеет правильный тип
    if (newVotings !== undefined && typeof newVotings !== 'boolean') {
      logger.error(`Invalid newVotings data: ${typeof newVotings}`);
      return c.json({ error: 'Invalid newVotings data' }, 400);
    }
    
    if (myVotingsComplete !== undefined && typeof myVotingsComplete !== 'boolean') {
      logger.error(`Invalid myVotingsComplete data: ${typeof myVotingsComplete}`);
      return c.json({ error: 'Invalid myVotingsComplete data' }, 400);
    }
    
    // Получаем текущие настройки
    const currentSettings = await getNotificationSettings(userId);
    
    // Обновляем только переданные поля
    const updatedSettings = {
      newVotings: newVotings !== undefined ? newVotings : (currentSettings?.newVotings || false),
      myVotingsComplete: myVotingsComplete !== undefined ? myVotingsComplete : (currentSettings?.myVotingsComplete || false)
    };
    
    await updateNotificationSettings(userId, updatedSettings);
    
    logger.info(`Notification settings updated for user ${userId}`);
    return c.json({ success: true });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    return c.json({ error: 'Failed to update notification settings' }, 500);
  }
});

// GET /api/web-push/status - проверка статуса Web Push (требует авторизацию)
webPushRoutes.get('/status', requireAuth, async (c: AuthContext) => {
  try {
    const userId = c.user?.id;
    
    if (!userId) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    const subscription = await getWebPushSubscription(userId);
    
    return c.json({
      enabled: configManager.isWebPushEnabled(),
      subscribed: !!subscription,
      hasSubscription: !!subscription
    });
  } catch (error) {
    logger.error('Error checking web push status:', error);
    return c.json({ error: 'Failed to check web push status' }, 500);
  }
});
