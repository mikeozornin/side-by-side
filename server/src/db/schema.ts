import sqlite3 from 'sqlite3';

export function createTables(db: sqlite3.Database): void {
  // Таблица голосований
  db.exec(`
    CREATE TABLE IF NOT EXISTS votings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_at DATETIME NOT NULL,
      duration_hours INTEGER NOT NULL DEFAULT 24
    )
  `);

  // Таблица вариантов голосований
  db.exec(`
    CREATE TABLE IF NOT EXISTS voting_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      pixel_ratio REAL NOT NULL DEFAULT 1,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'image',
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
    )
  `);

  // Таблица голосов
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id TEXT NOT NULL,
      option_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES voting_options(id) ON DELETE CASCADE
    )
  `);

  // Индексы для производительности
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votings_created_at ON votings(created_at);
    CREATE INDEX IF NOT EXISTS idx_votings_end_at ON votings(end_at);
    CREATE INDEX IF NOT EXISTS idx_voting_options_voting_id ON voting_options(voting_id);
    CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id);
    CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
  `);
}
