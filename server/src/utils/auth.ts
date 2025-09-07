import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { env } from '../load-env';

// Секретный ключ для подписи JWT (в продакшене должен быть в переменных окружения)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sessionId: string;
  userId: string;
  type: 'refresh';
}

// Генерация случайного токена для magic link
export function generateMagicToken(): string {
  return randomBytes(32).toString('hex');
}

// Генерация случайного кода для Figma
export function generateFigmaCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'FGM-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Хеширование токенов для безопасного хранения в БД
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

// Проверка токена против хеша
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

// Создание access token
export function createAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Создание refresh token
export function createRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '1y' }
  );
}

// Верификация access token
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
}

// Верификация refresh token
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded as RefreshTokenPayload;
  } catch {
    return null;
  }
}

// Генерация UUID для пользователей и сессий
export function generateId(): string {
  return randomBytes(16).toString('hex');
}
