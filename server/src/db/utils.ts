const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';

export function prepareQuery(sql: string): string {
  if (DB_PROVIDER === 'postgres') {
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }
  return sql;
}
