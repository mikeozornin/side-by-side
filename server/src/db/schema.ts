import sqlite3 from 'sqlite3';

export function createTables(db: sqlite3.Database): void {
  // Таблица голосований
  db.exec(`
    CREATE TABLE IF NOT EXISTS votings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_at DATETIME NOT NULL
    )
  `);

  // Таблица изображений голосований
  db.exec(`
    CREATE TABLE IF NOT EXISTS voting_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
    )
  `);

  // Таблица голосов
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id TEXT NOT NULL,
      choice INTEGER NOT NULL CHECK (choice IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
    )
  `);

  // Индексы для производительности
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votings_created_at ON votings(created_at);
    CREATE INDEX IF NOT EXISTS idx_votings_end_at ON votings(end_at);
    CREATE INDEX IF NOT EXISTS idx_voting_images_voting_id ON voting_images(voting_id);
    CREATE INDEX IF NOT EXISTS idx_votes_voting_id ON votes(voting_id);
    CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
  `);
}
