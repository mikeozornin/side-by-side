import { Context, Next } from 'hono';
import { verifyAccessToken } from '../utils/auth.js';
import { getUserById } from '../db/auth-queries.js';

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

// Middleware для проверки владельца голосования
export async function requireVotingOwner(c: AuthContext, next: Next) {
  try {
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
