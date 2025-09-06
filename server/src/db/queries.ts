import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './init.js';

// Вспомогательные функции для выполнения запросов с Bun SQLite
export function runQuery<T = any>(sql: string, params: any[] = []): T {
  const db = getDatabase();
  return db.prepare(sql).run(...params) as T;
}

export function getQuery<T = any>(sql: string, params: any[] = []): T | undefined {
  const db = getDatabase();
  return db.prepare(sql).get(...params) as T | undefined;
}

export function allQuery<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDatabase();
  return db.prepare(sql).all(...params) as T[];
}

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
export function createVoting(voting: Omit<Voting, 'id'>): string {
  const id = uuidv4();
  runQuery(
    'INSERT INTO votings (id, title, created_at, end_at, duration_hours, is_public, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, voting.title, voting.created_at, voting.end_at, voting.duration_hours, voting.is_public, voting.user_id]
  );
  return id;
}

export function getVoting(id: string): Voting | undefined {
  return getQuery<Voting>(`
    SELECT v.*, u.email as user_email 
    FROM votings v 
    LEFT JOIN users u ON v.user_id = u.id 
    WHERE v.id = ?
  `, [id]);
}

export function getAllVotings(): Voting[] {
  return allQuery<Voting>('SELECT * FROM votings ORDER BY created_at DESC');
}

export function getPublicVotings(): Voting[] {
  return allQuery<Voting>(`
    SELECT v.*, u.email as user_email 
    FROM votings v 
    LEFT JOIN users u ON v.user_id = u.id 
    WHERE v.is_public = 1 
    ORDER BY v.created_at DESC
  `);
}

export function deleteVoting(id: string): boolean {
  const result = runQuery('DELETE FROM votings WHERE id = ?', [id]);
  return result.changes > 0;
}

// Функции для работы с вариантами голосования
export function createVotingOptions(options: Omit<VotingOption, 'id'>[]): void {
  for (const option of options) {
    runQuery(
      'INSERT INTO voting_options (voting_id, file_path, sort_order, pixel_ratio, width, height, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [option.voting_id, option.file_path, option.sort_order, option.pixel_ratio, option.width, option.height, option.media_type]
    );
  }
}

export function getVotingOptions(votingId: string): VotingOption[] {
  return allQuery<VotingOption>(
    'SELECT * FROM voting_options WHERE voting_id = ? ORDER BY sort_order',
    [votingId]
  );
}

// Функции для работы с голосами
export function createVote(vote: Omit<Vote, 'id'>): number {
  const result = runQuery<{ lastInsertRowid: number }>(
    'INSERT INTO votes (voting_id, option_id, created_at, user_id) VALUES (?, ?, ?, ?)',
    [vote.voting_id, vote.option_id, vote.created_at, vote.user_id || null]
  );
  return result.lastInsertRowid;
}

export function getVotesForVoting(votingId: string): Vote[] {
  return allQuery<Vote>('SELECT * FROM votes WHERE voting_id = ?', [votingId]);
}

export function getVoteCountForVoting(votingId: string): number {
  const result = getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM votes WHERE voting_id = ?',
    [votingId]
  );
  return result?.count || 0;
}

export function getVoteCounts(votingId: string): { option_id: number; count: number }[] {
  return allQuery<{ option_id: number; count: number }>(
    'SELECT option_id, COUNT(*) as count FROM votes WHERE voting_id = ? GROUP BY option_id',
    [votingId]
  );
}
