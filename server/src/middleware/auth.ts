import { Context, Next } from 'hono';
import { verifyAccessToken } from '../utils/auth.js';
import { getUserById } from '../db/auth-queries.js';
import { env } from '../load-env.js';

// Middleware для проверки аутентификации Figma плагина
export async function requireFigmaAuth(c: AuthContext, next: Next) {
  try {
    // В анонимном режиме пропускаем проверку авторизации
    if (env.AUTH_MODE === 'anonymous') {
      // Устанавливаем анонимного пользователя
      c.user = {
        id: 'anonymous',
        email: 'anonymous@side-by-side.com',
        created_at: new Date().toISOString()
      };
      await next();
      return;
    }
    
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }
    
    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);
    
    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }
    
    // Получаем пользователя из БД
    const user = getUserById(payload.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    // Добавляем пользователя в контекст
    c.user = user;
    
    await next();
  } catch (error) {
    console.error('Figma auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export interface AuthContext extends Context {
  user?: {
    id: string;
    email: string;
    created_at: string;
  };
}

// Middleware для проверки авторизации
export async function requireAuth(c: AuthContext, next: Next) {
  try {
    // В анонимном режиме пропускаем проверку авторизации
    if (env.AUTH_MODE === 'anonymous') {
      await next();
      return;
    }
    
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required' }, 401);
    }
    
    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);
    
    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }
    
    // Получаем пользователя из БД
    const user = getUserById(payload.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    // Добавляем пользователя в контекст
    c.user = user;
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

// Middleware для голосования - требует авторизацию только в неанонимном режиме
export async function requireVotingAuth(c: AuthContext, next: Next) {
  try {
    // В анонимном режиме пропускаем проверку авторизации
    if (env.AUTH_MODE === 'anonymous') {
      await next();
      return;
    }
    
    // В режиме magic-links требуем авторизацию
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization required for voting' }, 401);
    }
    
    const accessToken = authHeader.substring(7);
    const payload = verifyAccessToken(accessToken);
    
    if (!payload) {
      return c.json({ error: 'Invalid access token' }, 401);
    }
    
    // Получаем пользователя из БД
    const user = getUserById(payload.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }
    
    // Добавляем пользователя в контекст
    c.user = user;
    
    await next();
  } catch (error) {
    console.error('Voting auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

// Middleware для проверки владельца голосования
export async function requireVotingOwner(c: AuthContext, next: Next) {
  try {
    // В анонимном режиме запрещаем удаление голосований
    if (env.AUTH_MODE === 'anonymous') {
      return c.json({ error: 'Voting deletion is not allowed in anonymous mode' }, 403);
    }
    
    if (!c.user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const votingId = c.req.param('id');
    if (!votingId) {
      return c.json({ error: 'Voting ID required' }, 400);
    }
    
    // Получаем голосование из БД
    const { getVoting } = await import('../db/queries.js');
    const voting = getVoting(votingId);
    
    if (!voting) {
      return c.json({ error: 'Voting not found' }, 404);
    }
    
    // Проверяем, что пользователь является владельцем
    if (voting.user_id !== c.user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    await next();
  } catch (error) {
    console.error('Voting owner middleware error:', error);
    return c.json({ error: 'Authorization failed' }, 500);
  }
}

// Middleware для проверки голосования пользователя (опциональная авторизация)
export async function optionalVotingAuth(c: AuthContext, next: Next) {
  try {
    // В анонимном режиме пропускаем проверку авторизации
    if (env.AUTH_MODE === 'anonymous') {
      await next();
      return;
    }
    
    // В режиме magic-links проверяем токен, но не требуем его
    const authHeader = c.req.header('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      const payload = verifyAccessToken(accessToken);
      
      if (payload) {
        // Получаем пользователя из БД
        const user = getUserById(payload.userId);
        if (user) {
          c.user = user;
        }
      }
    }
    
    await next();
  } catch (error) {
    console.error('Optional voting auth middleware error:', error);
    // В случае ошибки продолжаем без авторизации
    await next();
  }
}
