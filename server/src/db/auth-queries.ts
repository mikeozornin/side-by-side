import { getDatabase } from './init.js';
import { User, verifyToken } from '../utils/auth.js';
import { prepareQuery } from './utils.js';

// Создание или получение пользователя по email
export async function createOrGetUser(email: string): Promise<User> {
  const db = getDatabase();
  
  // Сначала пытаемся найти существующего пользователя
  const existingUser = await db.get<User>(prepareQuery('SELECT id, email, created_at FROM users WHERE email = ?'), [email]);
  
  if (existingUser) {
    return existingUser;
  }
  
  // Если пользователя нет, создаем нового
  const id = crypto.randomUUID();
  const now = new Date();
  
  await db.run(prepareQuery('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)'), [id, email, now.toISOString()]);
  
  return { id, email, created_at: now.toISOString() };
}

// Сохранение magic token
export async function saveMagicToken(tokenHash: string, email: string, expiresAt: string): Promise<void> {
  const db = getDatabase();
  const sql = prepareQuery('INSERT INTO magic_tokens (token_hash, user_email, expires_at) VALUES (?, ?, ?)');
  await db.run(sql, [tokenHash, email, expiresAt]);
}

// Проверка и использование magic token
export async function verifyAndUseMagicToken(plainToken: string): Promise<{ user: User; success: boolean } | null> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';

  // Ищем все валидные (неиспользованные и не истекшие) токены
  const candidates = await db.query<{ token_hash: string; user_email: string; expires_at: string; used_at: string | null }>(
    prepareQuery(`SELECT token_hash, user_email, expires_at, used_at FROM magic_tokens WHERE used_at IS NULL AND expires_at > ${nowFn}`)
  );

  for (const record of candidates) {
    const isMatch = await verifyToken(plainToken, record.token_hash);
    if (!isMatch) continue;

    // Найден подходящий токен — помечаем как использованный
    await db.run(prepareQuery('UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?'), [new Date().toISOString(), record.token_hash]);

    const user = await createOrGetUser(record.user_email);
    return { user, success: true };
  }

  return null;
}

// Создание сессии
export async function createSession(
  sessionId: string,
  userId: string,
  refreshTokenHash: string,
  expiresAt: string
): Promise<void> {
  const db = getDatabase();

  const sql = prepareQuery(`
    INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  await db.run(sql, [sessionId, userId, refreshTokenHash, expiresAt, new Date().toISOString()]);

  // Очистка старых сессий пользователя (оставляем только последние 5)
  await cleanupOldUserSessions(userId, 5);
}

// Получение сессии по ID
export async function getSession(sessionId: string): Promise<{
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
} | null> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT id, user_id, refresh_token_hash, expires_at FROM sessions WHERE id = ?');
  return await db.get(sql, [sessionId]);
}

// Удаление сессии
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDatabase();
  const sql = prepareQuery('DELETE FROM sessions WHERE id = ?');
  await db.run(sql, [sessionId]);
}

// Создание кода для Figma
export async function createFigmaCode(userId: string, codeHash: string, expiresAt: string): Promise<void> {
  const db = getDatabase();
  
  // Удаляем ВСЕ существующие коды этого пользователя (включая активные)
  const deleteResult = await db.run(prepareQuery(`
    DELETE FROM figma_auth_codes 
    WHERE user_id = ?
  `), [userId]);
  
  if (deleteResult.changes && deleteResult.changes > 0) {
    console.log(`Удалено ${deleteResult.changes} существующих кодов для пользователя ${userId}`);
  }
  
  // Создаем новый код
  await db.run(prepareQuery('INSERT INTO figma_auth_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)'), [codeHash, userId, expiresAt]);
}

// Проверка и использование кода для Figma
export async function verifyAndUseFigmaCode(code: string): Promise<{ user: User; success: boolean } | null> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';
  
  // Получаем все неиспользованные коды
  const codes = await db.query<{ code_hash: string; user_id: string; expires_at: string; used_at: string | null }>(
    prepareQuery(`SELECT code_hash, user_id, expires_at, used_at FROM figma_auth_codes WHERE used_at IS NULL AND expires_at > ${nowFn}`)
  );
  
  // Проверяем каждый код
  for (const codeRecord of codes) {
    const isValid = await verifyToken(code, codeRecord.code_hash);
    if (isValid) {
      // Помечаем код как использованный
      await db.run(prepareQuery('UPDATE figma_auth_codes SET used_at = ? WHERE code_hash = ?'), [new Date().toISOString(), codeRecord.code_hash]);
      
      // Получаем пользователя
      const user = await db.get<User>(prepareQuery('SELECT id, email, created_at FROM users WHERE id = ?'), [codeRecord.user_id]);
      
      if (user) {
        return { user, success: true };
      }
    }
  }
  
  return null;
}

// Получение пользователя по ID
export async function getUserById(userId: string): Promise<User | null> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT id, email, created_at FROM users WHERE id = ?');
  return await db.get<User>(sql, [userId]);
}

// Очистка истекших сессий
export async function cleanupExpiredSessions(): Promise<number> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';

  const result = await db.run(prepareQuery(`DELETE FROM sessions WHERE expires_at <= ${nowFn}`));

  if (result.changes && result.changes > 0) {
    console.log(`Очищено истекших сессий: ${result.changes}`);
  }

  return result.changes ?? 0;
}

// Очистка истекших и использованных magic tokens
export async function cleanupExpiredMagicTokens(): Promise<number> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';
  const hourAgoFn = DB_PROVIDER === 'postgres' ? 'NOW() - INTERVAL \'1 hour\'' : 'datetime(\'now\', \'-1 hour\')';

  // Удаляем истекшие токены (независимо от того, использованы они или нет)
  const expiredResult = await db.run(prepareQuery(`DELETE FROM magic_tokens WHERE expires_at <= ${nowFn}`));

  // Удаляем использованные токены старше 1 часа (для безопасности)
  const usedResult = await db.run(prepareQuery(`DELETE FROM magic_tokens WHERE used_at IS NOT NULL AND used_at <= ${hourAgoFn}`));

  const totalDeleted = (expiredResult.changes ?? 0) + (usedResult.changes ?? 0);

  if (totalDeleted > 0) {
    console.log(`Очищено magic tokens: ${totalDeleted} (истекших: ${expiredResult.changes}, использованных: ${usedResult.changes})`);
  }

  return totalDeleted;
}

// Очистка истекших и использованных кодов Figma
export async function cleanupFigmaCodes(): Promise<number> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';
  const hourAgoFn = DB_PROVIDER === 'postgres' ? 'NOW() - INTERVAL \'1 hour\'' : 'datetime(\'now\', \'-1 hour\')';

  // Удаляем истекшие коды (независимо от того, использованы они или нет)
  const expiredResult = await db.run(prepareQuery(`DELETE FROM figma_auth_codes WHERE expires_at <= ${nowFn}`));

  // Удаляем использованные коды старше 1 часа
  const usedResult = await db.run(prepareQuery(`DELETE FROM figma_auth_codes WHERE used_at IS NOT NULL AND used_at <= ${hourAgoFn}`));

  const totalDeleted = (expiredResult.changes ?? 0) + (usedResult.changes ?? 0);

  if (totalDeleted > 0) {
    console.log(`Очищено кодов Figma: ${totalDeleted} (истекших: ${expiredResult.changes}, использованных: ${usedResult.changes})`);
  }

  return totalDeleted;
}

// Комплексная очистка всех истекших данных аутентификации
export async function cleanupExpiredAuthData(): Promise<{ sessions: number; magicTokens: number; figmaCodes: number; total: number }> {
  console.log('Запуск комплексной очистки истекших данных аутентификации...');

  const sessions = await cleanupExpiredSessions();
  const magicTokens = await cleanupExpiredMagicTokens();
  const figmaCodes = await cleanupFigmaCodes();

  const total = sessions + magicTokens + figmaCodes;

  if (total > 0) {
    console.log(`Комплексная очистка завершена. Всего удалено записей: ${total}`);
  } else {
    console.log('Комплексная очистка завершена. Нечего удалять.');
  }

  return { sessions, magicTokens, figmaCodes, total };
}

// Очистка старых сессий пользователя (оставляем только последние N)
export async function cleanupOldUserSessions(userId: string, keepLast: number = 5): Promise<number> {
  const db = getDatabase();

  // Находим сессии пользователя, отсортированные по дате создания (старые сначала)
  const sessions = await db.query<{ id: string }>(prepareQuery('SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at ASC'), [userId]);

  if (sessions.length <= keepLast) {
    return 0; // Нечего удалять
  }

  // Удаляем все сессии кроме последних keepLast
  const sessionsToDelete = sessions.slice(0, sessions.length - keepLast);
  const placeholders = sessionsToDelete.map(() => '?').join(',');
  const sql = prepareQuery(`DELETE FROM sessions WHERE id IN (${placeholders})`);
  const ids = sessionsToDelete.map(s => s.id);

  const result = await db.run(sql, ids);

  if (result.changes && result.changes > 0) {
    console.log(`Очищено старых сессий пользователя ${userId}: ${result.changes} (оставлено ${keepLast})`);
  }

  return result.changes ?? 0;
}
