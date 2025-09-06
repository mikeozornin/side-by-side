import { getDatabase } from './init.js';
import { User } from '../utils/auth.js';

// Создание или получение пользователя по email
export function createOrGetUser(email: string): User {
  const db = getDatabase();
  
  // Сначала пытаемся найти существующего пользователя
  const existingUser = db.prepare(`
    SELECT id, email, created_at FROM users WHERE email = ?
  `).get(email) as User | undefined;
  
  if (existingUser) {
    return existingUser;
  }
  
  // Если пользователя нет, создаем нового
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
  `).run(id, email, now);
  
  return { id, email, created_at: now };
}

// Сохранение magic token
export function saveMagicToken(tokenHash: string, email: string, expiresAt: string): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO magic_tokens (token_hash, user_email, expires_at) VALUES (?, ?, ?)
  `).run(tokenHash, email, expiresAt);
}

// Проверка и использование magic token
export function verifyAndUseMagicToken(tokenHash: string): { user: User; success: boolean } {
  const db = getDatabase();
  
  const token = db.prepare(`
    SELECT user_email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?
  `).get(tokenHash) as { user_email: string; expires_at: string; used_at: string | null } | undefined;
  
  if (!token) {
    return { user: null as any, success: false };
  }
  
  // Проверяем, не истек ли токен
  if (new Date() > new Date(token.expires_at)) {
    return { user: null as any, success: false };
  }
  
  // Проверяем, не использован ли уже токен
  if (token.used_at) {
    return { user: null as any, success: false };
  }
  
  // Помечаем токен как использованный
  db.prepare(`
    UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?
  `).run(new Date().toISOString(), tokenHash);
  
  // Получаем пользователя
  const user = createOrGetUser(token.user_email);
  
  return { user, success: true };
}

// Создание сессии
export function createSession(
  sessionId: string,
  userId: string,
  refreshTokenHash: string,
  expiresAt: string
): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, refreshTokenHash, expiresAt, new Date().toISOString());
}

// Получение сессии по ID
export function getSession(sessionId: string): {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
} | null {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT id, user_id, refresh_token_hash, expires_at FROM sessions WHERE id = ?
  `).get(sessionId) as any || null;
}

// Удаление сессии
export function deleteSession(sessionId: string): void {
  const db = getDatabase();
  
  db.prepare(`
    DELETE FROM sessions WHERE id = ?
  `).run(sessionId);
}

// Создание кода для Figma
export function createFigmaCode(userId: string, codeHash: string, expiresAt: string): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO figma_auth_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)
  `).run(codeHash, userId, expiresAt);
}

// Проверка и использование кода для Figma
export function verifyAndUseFigmaCode(codeHash: string): { user: User; success: boolean } {
  const db = getDatabase();
  
  const code = db.prepare(`
    SELECT user_id, expires_at, used_at FROM figma_auth_codes WHERE code_hash = ?
  `).get(codeHash) as { user_id: string; expires_at: string; used_at: string | null } | undefined;
  
  if (!code) {
    return { user: null as any, success: false };
  }
  
  // Проверяем, не истек ли код
  if (new Date() > new Date(code.expires_at)) {
    return { user: null as any, success: false };
  }
  
  // Проверяем, не использован ли уже код
  if (code.used_at) {
    return { user: null as any, success: false };
  }
  
  // Помечаем код как использованный
  db.prepare(`
    UPDATE figma_auth_codes SET used_at = ? WHERE code_hash = ?
  `).run(new Date().toISOString(), codeHash);
  
  // Получаем пользователя
  const user = db.prepare(`
    SELECT id, email, created_at FROM users WHERE id = ?
  `).get(code.user_id) as User;
  
  return { user, success: true };
}

// Получение пользователя по ID
export function getUserById(userId: string): User | null {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT id, email, created_at FROM users WHERE id = ?
  `).get(userId) as User | null;
}
