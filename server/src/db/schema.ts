import { DbClient } from './db-client';

const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';

export async function createTables(db: DbClient): Promise<void> {
  if (DB_PROVIDER === 'sqlite') {
    const { createTables: createSqliteTables } = await import('./schema.sqlite.js');
    return createSqliteTables(db);
  } else if (DB_PROVIDER === 'postgres') {
    const { createTables: createPostgresTables } = await import('./schema.postgres.js');
    return createPostgresTables(db);
  } else {
    throw new Error(`Unsupported DB_PROVIDER: ${DB_PROVIDER}`);
  }
}
