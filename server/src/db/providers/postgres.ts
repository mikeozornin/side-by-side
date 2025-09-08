import { Pool, PoolClient } from 'pg';
import { DbClient } from '../db-client';
import { logger } from '../../utils/logger';

export class PostgresClient implements DbClient {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
  }

  async exec(sql: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid?: number | bigint; changes?: number }> {
    const client = await this.pool.connect();
    try {
      // Postgres doesn't have a direct equivalent of lastInsertRowid.
      // We often use RETURNING id for this. This implementation is a placeholder
      // and might need to be adjusted based on how it's used.
      // For now, we assume INSERTs might return the id.
      const res = await client.query(sql, params);
      const id = res.rows[0]?.id;
      return { 
        lastInsertRowid: id !== undefined ? BigInt(id) : undefined,
        changes: res.rowCount ?? 0
      };
    } finally {
      client.release();
    }
  }

  close(): void {
    this.pool.end().catch(err => {
      logger.error('Error closing Postgres pool', err);
    });
  }
}
