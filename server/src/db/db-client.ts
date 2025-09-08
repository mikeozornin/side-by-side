export interface DbClient {
  exec(sql: string): Promise<void>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  get<T>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ lastInsertRowid?: number | bigint; changes?: number }>;
  close(): void;
}
