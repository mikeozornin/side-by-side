import { migrations as sqliteMigrations } from './migrations.sqlite';
import { migrations as postgresMigrations } from './migrations.postgres';
import { DbClient } from './db-client';
import { logger } from '../utils/logger';

export interface Migration {
  version: number;
  name: string;
  up: (db: DbClient) => Promise<void>;
  down?: (db: DbClient) => Promise<void>;
}

async function createMigrationsTable(db: DbClient): Promise<void> {
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const sql = DB_PROVIDER === 'postgres' 
    ? `CREATE TABLE IF NOT EXISTS schema_migrations (
        version BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`;
  await db.exec(sql);
}

async function getAppliedMigrations(db: DbClient): Promise<number[]> {
  try {
    const result = await db.query<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
    return result.map((row: { version: number }) => Number(row.version));
  } catch (error) {
    return [];
  }
}

async function markMigrationAsApplied(db: DbClient, version: number, name: string): Promise<void> {
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  const sql = DB_PROVIDER === 'postgres'
    ? 'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)'
    : 'INSERT INTO schema_migrations (version, name) VALUES (?, ?)';
  await db.run(sql, [version, name]);
}

async function loadMigrations(): Promise<Migration[]> {
  const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
  if (DB_PROVIDER === 'postgres') {
    return postgresMigrations;
  }
  return sqliteMigrations;
}

export async function runMigrations(db: DbClient): Promise<void> {
  try {
    logger.info('Проверяем и применяем миграции...');
    
    await createMigrationsTable(db);
    
    const appliedMigrations = await getAppliedMigrations(db);
    logger.info(`Применённые миграции: ${appliedMigrations.join(', ')}`);
    
    const migrations = await loadMigrations();

    const pendingMigrations = migrations.filter(migration => 
      !appliedMigrations.includes(migration.version)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('Все миграции уже применены');
      return;
    }
    
    logger.info(`Найдено ${pendingMigrations.length} миграций для применения`);
    
    for (const migration of pendingMigrations) {
      logger.info(`Применяем миграцию ${migration.version}: ${migration.name}`);
      
      try {
        await migration.up(db);
        await markMigrationAsApplied(db, migration.version, migration.name);
        logger.info(`Миграция ${migration.version} успешно применена`);
      } catch (error) {
        logger.error(`Ошибка применения миграции ${migration.version}:`, error);
        throw error;
      }
    }
    
    logger.info('Все миграции успешно применены');
    
  } catch (error) {
    logger.error('Ошибка при применении миграций:', error);
    throw error;
  }
}

export async function getCurrentSchemaVersion(db: DbClient): Promise<number> {
  try {
    const result = await db.get<{ version: number | null }>('SELECT MAX(version) as version FROM schema_migrations');
    return result?.version || 0;
  } catch (error) {
    return 0;
  }
}

export async function needsMigration(db: DbClient): Promise<boolean> {
  const currentVersion = await getCurrentSchemaVersion(db);
  const migrations = await loadMigrations();
  const latestVersion = Math.max(...migrations.map(m => m.version));
  return currentVersion < latestVersion;
}
