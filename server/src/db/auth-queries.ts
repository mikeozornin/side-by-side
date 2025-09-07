import { getDatabase } from './init.js';
import { User, verifyToken } from '../utils/auth.js';

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
export async function verifyAndUseMagicToken(plainToken: string): Promise<{ user: User; success: boolean }> {
  const db = getDatabase();

  // Ищем все валидные (неиспользованные и не истекшие) токены
  const candidates = db.prepare(`
    SELECT token_hash, user_email, expires_at, used_at 
    FROM magic_tokens 
    WHERE used_at IS NULL AND expires_at > datetime('now')
  `).all() as { token_hash: string; user_email: string; expires_at: string; used_at: string | null }[];

  for (const record of candidates) {
    const isMatch = await verifyToken(plainToken, record.token_hash);
    if (!isMatch) continue;

    // Найден подходящий токен — помечаем как использованный
    db.prepare(`
      UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?
    `).run(new Date().toISOString(), record.token_hash);

    const user = createOrGetUser(record.user_email);
    return { user, success: true };
  }

  return { user: null as any, success: false };
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

  // Очистка старых сессий пользователя (оставляем только последние 5)
  cleanupOldUserSessions(userId, 5);
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
  
  // Сначала очищаем старые коды этого пользователя
  const expiredResult = db.prepare(`
    DELETE FROM figma_auth_codes 
    WHERE user_id = ? AND (expires_at <= datetime('now') OR used_at IS NOT NULL)
  `).run(userId);
  
  if (expiredResult.changes > 0) {
    console.log(`Очищено ${expiredResult.changes} старых кодов для пользователя ${userId}`);
  }
  
  // Создаем новый код
  db.prepare(`
    INSERT INTO figma_auth_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)
  `).run(codeHash, userId, expiresAt);
}

// Проверка и использование кода для Figma
export async function verifyAndUseFigmaCode(code: string): Promise<{ user: User; success: boolean }> {
  const db = getDatabase();
  
  // Получаем все неиспользованные коды
  const codes = db.prepare(`
    SELECT code_hash, user_id, expires_at, used_at FROM figma_auth_codes 
    WHERE used_at IS NULL AND expires_at > datetime('now')
  `).all() as { code_hash: string; user_id: string; expires_at: string; used_at: string | null }[];
  
  // Проверяем каждый код
  for (const codeRecord of codes) {
    const isValid = await verifyToken(code, codeRecord.code_hash);
    if (isValid) {
      // Помечаем код как использованный
      db.prepare(`
        UPDATE figma_auth_codes SET used_at = ? WHERE code_hash = ?
      `).run(new Date().toISOString(), codeRecord.code_hash);
      
      // Получаем пользователя
      const user = db.prepare(`
        SELECT id, email, created_at FROM users WHERE id = ?
      `).get(codeRecord.user_id) as User;
      
      return { user, success: true };
    }
  }
  
  return { user: null as any, success: false };
}

// Получение пользователя по ID
export function getUserById(userId: string): User | null {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT id, email, created_at FROM users WHERE id = ?
  `).get(userId) as User | null;
}

// Очистка истекших сессий
export function cleanupExpiredSessions(): number {
  const db = getDatabase();

  const result = db.prepare(`
    DELETE FROM sessions
    WHERE expires_at <= datetime('now')
  `).run();

  if (result.changes > 0) {
    console.log(`Очищено истекших сессий: ${result.changes}`);
  }

  return result.changes;
}

// Очистка истекших и использованных magic tokens
export function cleanupExpiredMagicTokens(): number {
  const db = getDatabase();

  // Удаляем истекшие токены (независимо от того, использованы они или нет)
  const expiredResult = db.prepare(`
    DELETE FROM magic_tokens
    WHERE expires_at <= datetime('now')
  `).run();

  // Удаляем использованные токены старше 1 часа (для безопасности)
  const usedResult = db.prepare(`
    DELETE FROM magic_tokens
    WHERE used_at IS NOT NULL
    AND used_at <= datetime('now', '-1 hour')
  `).run();

  const totalDeleted = expiredResult.changes + usedResult.changes;

  if (totalDeleted > 0) {
    console.log(`Очищено magic tokens: ${totalDeleted} (истекших: ${expiredResult.changes}, использованных: ${usedResult.changes})`);
  }

  return totalDeleted;
}

// Очистка истекших и использованных кодов Figma
export function cleanupFigmaCodes(): number {
  const db = getDatabase();

  // Удаляем истекшие коды (независимо от того, использованы они или нет)
  const expiredResult = db.prepare(`
    DELETE FROM figma_auth_codes
    WHERE expires_at <= datetime('now')
  `).run();

  // Удаляем использованные коды старше 1 часа
  const usedResult = db.prepare(`
    DELETE FROM figma_auth_codes
    WHERE used_at IS NOT NULL
    AND used_at <= datetime('now', '-1 hour')
  `).run();

  const totalDeleted = expiredResult.changes + usedResult.changes;

  if (totalDeleted > 0) {
    console.log(`Очищено кодов Figma: ${totalDeleted} (истекших: ${expiredResult.changes}, использованных: ${usedResult.changes})`);
  }

  return totalDeleted;
}

// Комплексная очистка всех истекших данных аутентификации
export function cleanupExpiredAuthData(): { sessions: number; magicTokens: number; figmaCodes: number; total: number } {
  console.log('Запуск комплексной очистки истекших данных аутентификации...');

  const sessions = cleanupExpiredSessions();
  const magicTokens = cleanupExpiredMagicTokens();
  const figmaCodes = cleanupFigmaCodes();

  const total = sessions + magicTokens + figmaCodes;

  if (total > 0) {
    console.log(`Комплексная очистка завершена. Всего удалено записей: ${total}`);
  } else {
    console.log('Комплексная очистка завершена. Нечего удалять.');
  }

  return { sessions, magicTokens, figmaCodes, total };
}

// Очистка старых сессий пользователя (оставляем только последние N)
export function cleanupOldUserSessions(userId: string, keepLast: number = 5): number {
  const db = getDatabase();

  // Находим сессии пользователя, отсортированные по дате создания (старые сначала)
  const sessions = db.prepare(`
    SELECT id FROM sessions
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId) as { id: string }[];

  if (sessions.length <= keepLast) {
    return 0; // Нечего удалять
  }

  // Удаляем все сессии кроме последних keepLast
  const sessionsToDelete = sessions.slice(0, sessions.length - keepLast);
  const placeholders = sessionsToDelete.map(() => '?').join(',');
  const ids = sessionsToDelete.map(s => s.id);

  const result = db.prepare(`
    DELETE FROM sessions
    WHERE id IN (${placeholders})
  `).run(...ids);

  if (result.changes > 0) {
    console.log(`Очищено старых сессий пользователя ${userId}: ${result.changes} (оставлено ${keepLast})`);
  }

  return result.changes;
}
