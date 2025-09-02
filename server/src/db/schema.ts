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

  // Таблица изображений голосований
  db.exec(`
    CREATE TABLE IF NOT EXISTS voting_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      pixel_ratio REAL NOT NULL DEFAULT 1,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
    )
  `);

  // Обновляем существующую таблицу voting_images, если она создана ранее без новых столбцов
  const ensureColumn = (table: string, column: string, definition: string) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
      if (err) {
        // Пропускаем в случае ошибки метаданных
        return;
      }
      const hasColumn = rows?.some((r: any) => r.name === column);
      if (!hasColumn) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
      }
    });
  };

  ensureColumn('voting_images', 'pixel_ratio', 'pixel_ratio REAL NOT NULL DEFAULT 1');
  ensureColumn('voting_images', 'width', 'width INTEGER NOT NULL DEFAULT 0');
  ensureColumn('voting_images', 'height', 'height INTEGER NOT NULL DEFAULT 0');
  ensureColumn('votings', 'duration_hours', 'duration_hours INTEGER NOT NULL DEFAULT 24');

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
