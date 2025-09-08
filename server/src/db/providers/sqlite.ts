import { Database } from 'bun:sqlite';
import { DbClient } from '../db-client';

export class SqliteClient implements DbClient {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return this.db.query(sql).all(...params) as T[];
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    return this.db.query(sql).get(...params) as T | null;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number | bigint, changes: number }> {
    return this.db.query(sql).run(...params);
  }

  close(): void {
    this.db.close();
  }
}
