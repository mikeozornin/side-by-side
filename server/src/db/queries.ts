import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './init.js';
import { prepareQuery } from './utils.js';

// Интерфейсы для типизации
export interface Voting {
  id: string;
  title: string;
  created_at: string;
  end_at: string;
  duration_hours: number;
  is_public: boolean;
  user_id: string | null;
  user_email?: string | null;
  complete_notified?: number;
}

export interface VotingOption {
  id: number;
  voting_id: string;
  file_path: string;
  sort_order: number;
  pixel_ratio: number;
  width: number;
  height: number;
  media_type: 'image' | 'video';
}

export interface Vote {
  id: number;
  voting_id: string;
  option_id: number;
  created_at: string;
  user_id?: string | null;
}

// Функции для работы с голосованиями
export async function createVoting(voting: Omit<Voting, 'id' | 'created_at' | 'end_at'> & { created_at: Date, end_at: Date }): Promise<string> {
  const id = uuidv4();
  const db = getDatabase();
  const sql = prepareQuery('INSERT INTO votings (id, title, created_at, end_at, duration_hours, is_public, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  await db.run(sql, [id, voting.title, voting.created_at.toISOString(), voting.end_at.toISOString(), voting.duration_hours, voting.is_public, voting.user_id]);
  return id;
}

export async function getVoting(id: string): Promise<Voting | null> {
  const db = getDatabase();
  const sql = prepareQuery(`
    SELECT v.*, u.email as user_email 
    FROM votings v 
    LEFT JOIN users u ON v.user_id = u.id 
    WHERE v.id = ?
  `);
  return await db.get<Voting>(sql, [id]);
}

export async function getAllVotings(): Promise<Voting[]> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT * FROM votings ORDER BY created_at DESC');
  return await db.query<Voting>(sql);
}

export async function getPublicVotings(): Promise<Voting[]> {
  const db = getDatabase();
  const sql = prepareQuery(`
    SELECT v.*, u.email as user_email 
    FROM votings v 
    LEFT JOIN users u ON v.user_id = u.id 
    WHERE v.is_public = TRUE
    ORDER BY v.created_at DESC
  `);
  return await db.query<Voting>(sql);
}

// Возвращает публичные голосования, которые завершились и по которым ещё не отправляли уведомление
export async function getDueCompletedVotings(limit: number = 50): Promise<Voting[]> {
  const db = getDatabase();
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const nowFn = DB_PROVIDER === 'postgres' ? 'NOW()' : 'datetime(\'now\')';
  
  const sql = prepareQuery(`
    SELECT v.* FROM votings v
    WHERE v.is_public = TRUE
      AND v.end_at <= ${nowFn}
      AND (v.complete_notified IS NULL OR v.complete_notified = FALSE)
    ORDER BY v.end_at ASC
    LIMIT ?
  `);
  return await db.query<Voting>(sql, [limit]);
}

// Пометить голосование как уведомлённое о завершении
export async function markVotingCompleteNotified(id: string): Promise<void> {
  const db = getDatabase();
  const sql = prepareQuery('UPDATE votings SET complete_notified = TRUE WHERE id = ?');
  await db.run(sql, [id]);
}

export async function deleteVoting(id: string): Promise<boolean> {
  const db = getDatabase();
  const sql = prepareQuery('DELETE FROM votings WHERE id = ?');
  const result = await db.run(sql, [id]);
  return (result.changes ?? 0) > 0;
}

// Функции для работы с вариантами голосования
export async function createVotingOptions(options: Omit<VotingOption, 'id'>[]): Promise<void> {
  const db = getDatabase();
  const sql = prepareQuery('INSERT INTO voting_options (voting_id, file_path, sort_order, pixel_ratio, width, height, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const option of options) {
    await db.run(sql, [option.voting_id, option.file_path, option.sort_order, option.pixel_ratio, option.width, option.height, option.media_type]);
  }
}

export async function getVotingOptions(votingId: string): Promise<VotingOption[]> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT * FROM voting_options WHERE voting_id = ? ORDER BY sort_order');
  return await db.query<VotingOption>(sql, [votingId]);
}

// Функции для работы с голосами
export async function createVote(vote: Omit<Vote, 'id' | 'created_at'> & { created_at: Date }): Promise<number | bigint | undefined> {
  const db = getDatabase();
  const sql = prepareQuery('INSERT INTO votes (voting_id, option_id, created_at, user_id) VALUES (?, ?, ?, ?)');
  const result = await db.run(sql, [vote.voting_id, vote.option_id, vote.created_at.toISOString(), vote.user_id || null]);
  return result.lastInsertRowid;
}

export async function getVotesForVoting(votingId: string): Promise<Vote[]> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT * FROM votes WHERE voting_id = ?');
  return await db.query<Vote>(sql, [votingId]);
}

export async function getVoteCountForVoting(votingId: string): Promise<number> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT COUNT(*) as count FROM votes WHERE voting_id = ?');
  const result = await db.get<{ count: number }>(sql, [votingId]);
  return Number(result?.count || 0);
}

export async function getVoteCounts(votingId: string): Promise<{ option_id: number; count: number }[]> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT option_id, COUNT(*) as count FROM votes WHERE voting_id = ? GROUP BY option_id');
  const results = await db.query<{ option_id: number; count: any }>(sql, [votingId]);
  return results.map(r => ({ ...r, count: Number(r.count) }));
}

export async function hasUserVoted(votingId: string, userId: string | null): Promise<boolean> {
  if (!userId) {
    return false; // В анонимном режиме не проверяем по серверу
  }
  
  const db = getDatabase();
  const sql = prepareQuery('SELECT COUNT(*) as count FROM votes WHERE voting_id = ? AND user_id = ?');
  const result = await db.get<{ count: number }>(sql, [votingId, userId]);
  return (Number(result?.count) || 0) > 0;
}

export async function getUserSelectedOption(votingId: string, userId: string): Promise<number | null> {
  const db = getDatabase();
  const sql = prepareQuery('SELECT option_id FROM votes WHERE voting_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1');
  const result = await db.get<{ option_id: number }>(sql, [votingId, userId]);
  return result ? result.option_id : null;
}

// Функция для выполнения SQL запросов (для обратной совместимости)
export async function runQuery(sql: string, params: any[] = []): Promise<boolean> {
  try {
    const db = getDatabase();
    const preparedSql = prepareQuery(sql);
    await db.run(preparedSql, params);
    return true;
  } catch (error) {
    console.error('Error executing query:', error);
    return false;
  }
}
