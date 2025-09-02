import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './init';

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
}

export interface VotingImage {
  id: number;
  voting_id: string;
  file_path: string;
  sort_order: number;
}

export interface Vote {
  id: number;
  voting_id: string;
  choice: number;
  created_at: string;
}

// Функции для работы с голосованиями
export async function createVoting(voting: Omit<Voting, 'id'>): Promise<string> {
  const id = uuidv4();
  await runQuery(
    'INSERT INTO votings (id, title, created_at, end_at) VALUES (?, ?, ?, ?)',
    [id, voting.title, voting.created_at, voting.end_at]
  );
  return id;
}

export async function getVoting(id: string): Promise<Voting | undefined> {
  return getQuery<Voting>('SELECT * FROM votings WHERE id = ?', [id]);
}

export async function getAllVotings(): Promise<Voting[]> {
  return allQuery<Voting>('SELECT * FROM votings ORDER BY created_at DESC');
}

// Функции для работы с изображениями
export async function createVotingImages(images: Omit<VotingImage, 'id'>[]): Promise<void> {
  for (const image of images) {
    await runQuery(
      'INSERT INTO voting_images (voting_id, file_path, sort_order) VALUES (?, ?, ?)',
      [image.voting_id, image.file_path, image.sort_order]
    );
  }
}

export async function getVotingImages(votingId: string): Promise<VotingImage[]> {
  return allQuery<VotingImage>(
    'SELECT * FROM voting_images WHERE voting_id = ? ORDER BY sort_order',
    [votingId]
  );
}

// Функции для работы с голосами
export async function createVote(vote: Omit<Vote, 'id'>): Promise<number> {
  const result = await runQuery<{ lastID: number }>(
    'INSERT INTO votes (voting_id, choice, created_at) VALUES (?, ?, ?)',
    [vote.voting_id, vote.choice, vote.created_at]
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
