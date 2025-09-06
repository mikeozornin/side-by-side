import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './init.js';

// Вспомогательная функция для выполнения запросов с промисами
export function runQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this as any);
      }
    });
  });
}

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T);
      }
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

// Интерфейсы для типизации
export interface Voting {
  id: string;
  title: string;
  created_at: string;
  end_at: string;
  duration_hours: number;
  is_public: boolean;
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
}

// Функции для работы с голосованиями
export async function createVoting(voting: Omit<Voting, 'id'>): Promise<string> {
  const id = uuidv4();
  await runQuery(
    'INSERT INTO votings (id, title, created_at, end_at, duration_hours, is_public) VALUES (?, ?, ?, ?, ?, ?)',
    [id, voting.title, voting.created_at, voting.end_at, voting.duration_hours, voting.is_public]
  );
  return id;
}

export async function getVoting(id: string): Promise<Voting | undefined> {
  return getQuery<Voting>('SELECT * FROM votings WHERE id = ?', [id]);
}

export async function getAllVotings(): Promise<Voting[]> {
  return allQuery<Voting>('SELECT * FROM votings ORDER BY created_at DESC');
}

export async function getPublicVotings(): Promise<Voting[]> {
  return allQuery<Voting>('SELECT * FROM votings WHERE is_public = 1 ORDER BY created_at DESC');
}

// Функции для работы с вариантами голосования
export async function createVotingOptions(options: Omit<VotingOption, 'id'>[]): Promise<void> {
  for (const option of options) {
    await runQuery(
      'INSERT INTO voting_options (voting_id, file_path, sort_order, pixel_ratio, width, height, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [option.voting_id, option.file_path, option.sort_order, option.pixel_ratio, option.width, option.height, option.media_type]
    );
  }
}

export async function getVotingOptions(votingId: string): Promise<VotingOption[]> {
  return allQuery<VotingOption>(
    'SELECT * FROM voting_options WHERE voting_id = ? ORDER BY sort_order',
    [votingId]
  );
}

// Функции для работы с голосами
export async function createVote(vote: Omit<Vote, 'id'>): Promise<number> {
  const result = await runQuery<{ lastID: number }>(
    'INSERT INTO votes (voting_id, option_id, created_at) VALUES (?, ?, ?)',
    [vote.voting_id, vote.option_id, vote.created_at]
  );
  return result.lastID;
}

export async function getVotesForVoting(votingId: string): Promise<Vote[]> {
  return allQuery<Vote>('SELECT * FROM votes WHERE voting_id = ?', [votingId]);
}

export async function getVoteCountForVoting(votingId: string): Promise<number> {
  const result = await getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM votes WHERE voting_id = ?',
    [votingId]
  );
  return result?.count || 0;
}

export async function getVoteCounts(votingId: string): Promise<{ option_id: number; count: number }[]> {
  return allQuery<{ option_id: number; count: number }>(
    'SELECT option_id, COUNT(*) as count FROM votes WHERE voting_id = ? GROUP BY option_id',
    [votingId]
  );
}
