import { Hono } from 'hono';
import { sendMagicLink } from '../utils/mailer.js';
import {
  generateMagicToken,
  generateFigmaCode,
  hashToken,
  verifyToken,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateId
} from '../utils/auth.js';
import {
  createOrGetUser,
  saveMagicToken,
  verifyAndUseMagicToken,
  createSession,
  getSession,
  deleteSession,
  createFigmaCode,
  verifyAndUseFigmaCode,
  getUserById,
  cleanupExpiredAuthData,
  cleanupExpiredSessions,
  cleanupExpiredMagicTokens,
  cleanupFigmaCodes
} from '../db/auth-queries.js';
import { runManualCleanup, getCleanupStatus } from '../utils/cleanup-scheduler.js';
import { env } from '../load-env.js';
import {
  magicLinkLimiter,
  verifyTokenLimiter
} from '../utils/rateLimit.js';

export const authRoutes = new Hono();

// Middleware для проверки Figma плагина
const figmaPluginMiddleware = async (c: any, next: any) => {
  const figmaHeader = c.req.header('X-Figma-Plugin');
  const userAgent = c.req.header('User-Agent');

  if (!figmaHeader || figmaHeader !== 'SideBySide/1.0' || !userAgent?.includes('Figma')) {
    return c.text('Unauthorized', 401);
  }

  await next();
};

// GET /api/auth/mode - получение режима аутентификации
authRoutes.get('/mode', async (c) => {
  return c.json({
    authMode: env.AUTH_MODE,
    isAnonymous: env.AUTH_MODE === 'anonymous'
  });
});

// POST /api/auth/magic-link - Запрос magic link
authRoutes.post('/magic-link', magicLinkLimiter, async (c) => {
  try {
    const { email, returnTo } = await c.req.json();

    if (!email || typeof email !== 'string') {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Создаем или получаем пользователя
    const user = await createOrGetUser(email);

    // Логируем переменную окружения для отладки
    console.log('NODE_ENV:', env.NODE_ENV);
    console.log('BUN_ENV:', env.BUN_ENV);
    console.log('AUTO_APPROVE_SESSIONS:', env.AUTO_APPROVE_SESSIONS);

    // Автоматически авторизуем пользователя если включен автоапрув
    if (env.AUTO_APPROVE_SESSIONS) {
      const accessToken = createAccessToken({ userId: user.id, email: user.email });
      const sessionId = generateId();
      const refreshToken = createRefreshToken({ sessionId, userId: user.id });

      // Создаем сессию
      await createSession(
        sessionId,
        user.id,
        await hashToken(refreshToken),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 дней
      );

      // Устанавливаем refresh token в HttpOnly cookie
      c.header('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; ${env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=${env.NODE_ENV === 'production' ? 'Strict' : 'Lax'}; Max-Age=${30 * 24 * 60 * 60}; Path=/`);

      return c.json({
        message: 'Auto-login enabled',
        accessToken,
        user,
        returnTo: returnTo || '/'
      });
    }

    // В продакшене отправляем magic link
    const token = generateMagicToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 часа

    // Сохраняем токен в БД
    await saveMagicToken(tokenHash, email, expiresAt);

    // Формируем URL для входа (используем CLIENT_URL для фронтенда)
    const magicLinkUrl = `${env.CLIENT_URL}/#/auth/callback?token=${token}&returnTo=${encodeURIComponent(returnTo || '/')}`;

    // Отправляем письмо
    await sendMagicLink({ email, url: magicLinkUrl });

    return c.json({
      message: 'Magic link sent to your email',
      expiresAt
    });

  } catch (error) {
    console.error('Error sending magic link:', error);
    return c.json({ error: 'Failed to send magic link' }, 500);
  }
});

// POST /api/auth/verify-token - Верификация magic token
authRoutes.post('/verify-token', verifyTokenLimiter, async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token || typeof token !== 'string') {
      return c.json({ error: 'Token is required' }, 400);
    }

    const result = await verifyAndUseMagicToken(token);

    if (!result || !result.success || !result.user) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }

    const { user, success } = result;

    // Создаем сессию
    const sessionId = generateId();
    const refreshToken = createRefreshToken({ sessionId, userId: user.id });
    const refreshTokenHash = await hashToken(refreshToken);
    const sessionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 год

    createSession(sessionId, user.id, refreshTokenHash, sessionExpiresAt);

    // Создаем access token
    const accessToken = createAccessToken({ userId: user.id, email: user.email });

    // Устанавливаем refresh token в HttpOnly cookie
    if (env.NODE_ENV === 'production') {
      // В production используем строгие настройки безопасности
      c.header('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${365 * 24 * 60 * 60}; Path=/`);
    } else {
      // В development заранее очищаем возможную Secure-куку, затем ставим Lax
      c.header('Set-Cookie', `refreshToken=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`);
      c.header('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}; Path=/`);
    }

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Error verifying token:', error);
    return c.json({ error: 'Failed to verify token' }, 500);
  }
});

// POST /api/auth/refresh - Обновление access token
authRoutes.post('/refresh', async (c) => {
  try {
    // Try to get refresh token from cookie first, then from body
    const cookieHeader = c.req.header('Cookie');
    
    // Берем ПОСЛЕДНИЙ refreshToken, т.к. браузер может присылать и старую, и новую версии (например, с разными атрибутами Secure)
    let refreshToken = undefined as string | undefined;
    if (cookieHeader) {
      const parts = cookieHeader.split(';').map((c) => c.trim());
      const matches = parts.filter((c) => c.startsWith('refreshToken='));
      const last = matches[matches.length - 1];
      refreshToken = last ? last.split('=')[1] : undefined;
    }

    // Do not log token values in production
    if (env.NODE_ENV !== 'production') {
      console.log('🔑 Extracted refresh token from cookie:', refreshToken ? `${refreshToken.substring(0, 8)}…` : 'null');
    }

    if (!refreshToken) {
      try {
        const body = await c.req.json();
        refreshToken = body.refreshToken;
        if (env.NODE_ENV !== 'production') {
          console.log('🔑 Refresh token from body:', refreshToken ? `${refreshToken.substring(0, 8)}…` : 'null');
        }
      } catch (e) {
        console.log('❌ Failed to parse request body:', e);
        // Ignore parsing errors
      }
    }

    if (!refreshToken) {
      console.log('❌ No refresh token provided');
      return c.json({ error: 'No refresh token provided' }, 401);
    }

    // Верифицируем refresh token
    if (env.NODE_ENV !== 'production') {
      console.log('🔍 JWT_SECRET is set:', Boolean(env.JWT_SECRET));
    }
    const payload = verifyRefreshToken(refreshToken);
    if (env.NODE_ENV !== 'production') {
      console.log('🔍 Refresh token payload present:', Boolean(payload));
    }
    if (!payload) {
      console.log('❌ Invalid refresh token - JWT verification failed');
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    // Получаем сессию из БД
    const session = await getSession(payload.sessionId);
    console.log('🔍 Session from DB:', session ? 'found' : 'not found');
    if (!session) {
      console.log('❌ Session not found in database');
      return c.json({ error: 'Session not found' }, 401);
    }

    // Проверяем, не истекла ли сессия
    if (new Date() > new Date(session.expires_at)) {
      return c.json({ error: 'Session expired' }, 401);
    }

    // Проверяем хеш refresh token
    if (env.NODE_ENV !== 'production') {
      console.log('🔍 Verifying token hash...');
    }
    const isValidToken = await verifyToken(refreshToken, session.refresh_token_hash);
    if (env.NODE_ENV !== 'production') {
      console.log('🔍 Token hash verification result:', isValidToken);
    }
    if (!isValidToken) {
      console.log('❌ Token hash verification failed');
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    // Получаем пользователя
    const user = await getUserById(session.user_id);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Создаем новую пару токенов (ротация)
    const newSessionId = generateId();
    const newRefreshToken = createRefreshToken({ sessionId: newSessionId, userId: user.id });
    const newRefreshTokenHash = await hashToken(newRefreshToken);
    const sessionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // Удаляем старую сессию и создаем новую
    await deleteSession(payload.sessionId);
    await createSession(newSessionId, user.id, newRefreshTokenHash, sessionExpiresAt);

    // Создаем новый access token
    const accessToken = createAccessToken({ userId: user.id, email: user.email });

    // Устанавливаем новый refresh token в cookie
    // Для dev предварительно очищаем возможную старую Secure-куку, чтобы не было дублей
    if (env.NODE_ENV !== 'production') {
      c.header('Set-Cookie', `refreshToken=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`);
    }
    c.header('Set-Cookie', `refreshToken=${newRefreshToken}; HttpOnly; ${env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=${env.NODE_ENV === 'production' ? 'Strict' : 'Lax'}; Max-Age=${365 * 24 * 60 * 60}; Path=/`);

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    return c.json({ error: 'Failed to refresh token' }, 500);
  }
});

// POST /api/auth/logout - Выход из системы
authRoutes.post('/logout', async (c) => {
  try {
    // Получаем refresh token из cookie используя парсинг заголовка
    const cookieHeader = c.req.header('Cookie');
    const refreshToken = cookieHeader?.split(';')
      .find(cookie => cookie.trim().startsWith('refreshToken='))
      ?.split('=')[1];

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload) {
        deleteSession(payload.sessionId);
      }
    }

    // Очищаем cookie через заголовок Set-Cookie
    c.header('Set-Cookie', `refreshToken=; HttpOnly; ${env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=${env.NODE_ENV === 'production' ? 'Strict' : 'Lax'}; Max-Age=0; Path=/`);

    return c.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Error logging out:', error);
    return c.json({ error: 'Failed to logout' }, 500);
  }
});

// GET /api/auth/figma-code - Генерация кода для Figma (требует авторизации)
authRoutes.get('/figma-code', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);

    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    // Генерируем код для Figma
    const code = generateFigmaCode();
    const codeHash = await hashToken(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 минут

    // Сохраняем код в БД
    if (!payload.userId) {
      return c.json({ error: 'User not found' }, 401);
    }
    await createFigmaCode(payload.userId, codeHash, expiresAt);

    return c.json({
      code,
      expiresAt
    });

  } catch (error) {
    console.error('Error generating Figma code:', error);
    return c.json({ error: 'Failed to generate code' }, 500);
  }
});

// POST /api/auth/figma-verify - Верификация кода от Figma плагина
authRoutes.post('/figma-verify', figmaPluginMiddleware, async (c) => {
  try {
    // В анонимном режиме возвращаем успешный ответ без проверки кода
    if (env.AUTH_MODE === 'anonymous') {
      return c.json({
        accessToken: 'anonymous-token',
        refreshToken: 'anonymous-refresh-token',
        user: {
          id: 'anonymous',
          email: 'anonymous@side-by-side.com',
          created_at: new Date().toISOString()
        },
        isAnonymous: true
      });
    }

    const { code } = await c.req.json();

    if (!code || typeof code !== 'string') {
      return c.json({ error: 'Code is required' }, 400);
    }

    const result = await verifyAndUseFigmaCode(code);

    if (!result || !result.success || !result.user) {
      return c.json({ error: 'Invalid or expired code' }, 400);
    }

    const { user, success } = result!;

    // Создаем сессию для Figma
    const sessionId = generateId();
    const refreshToken = createRefreshToken({ sessionId, userId: user.id });
    const refreshTokenHash = await hashToken(refreshToken);
    const sessionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    createSession(sessionId, user.id, refreshTokenHash, sessionExpiresAt);

    // Создаем access token
    const accessToken = createAccessToken({ userId: user.id, email: user.email });

    // Устанавливаем refresh token в HttpOnly cookie
    c.header('Set-Cookie', `refreshToken=${refreshToken}; HttpOnly; ${env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=${env.NODE_ENV === 'production' ? 'Strict' : 'Lax'}; Max-Age=${365 * 24 * 60 * 60}; Path=/`);

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      isAnonymous: false
    });

  } catch (error) {
    console.error('Error verifying Figma code:', error);
    return c.json({ error: 'Failed to verify code' }, 500);
  }
});

// POST /api/auth/cleanup-figma-codes - Очистка истекших кодов Figma (требует авторизации)
authRoutes.post('/cleanup-figma-codes', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);

    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    // Очищаем коды
    const deletedCount = cleanupFigmaCodes();

    return c.json({
      message: 'Cleanup completed',
      deletedCodes: deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up Figma codes:', error);
    return c.json({ error: 'Failed to cleanup codes' }, 500);
  }
});

// POST /api/auth/cleanup - Комплексная очистка всех истекших данных (требует авторизации)
authRoutes.post('/cleanup', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);

    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    // Ручной запуск комплексной очистки
    const result = await runManualCleanup();

    return c.json({
      message: 'Manual cleanup completed',
      ...result
    });

  } catch (error) {
    console.error('Error running manual cleanup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to run cleanup: ${errorMessage}` }, 500);
  }
});

// GET /api/auth/cleanup/status - Статус планировщика очистки
authRoutes.get('/cleanup/status', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);

    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    const status = getCleanupStatus();

    return c.json({
      cleanupScheduler: status,
      lastCleanup: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting cleanup status:', error);
    return c.json({ error: 'Failed to get cleanup status' }, 500);
  }
});
