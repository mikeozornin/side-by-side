# Миграция с JSON на SQLite

## Выполненные изменения

### 1. Добавлены зависимости
- `sqlite3` - для работы с SQLite базой данных
- `@types/sqlite3` - типы TypeScript для sqlite3

### 2. Переписана система базы данных
- **Файл**: `src/db/init.ts` - переписан для работы с SQLite
- **Файл**: `src/db/schema.ts` - схема таблиц SQLite (уже существовала)
- **Новый файл**: `src/db/queries.ts` - функции для работы с базой данных

### 3. Обновлены API endpoints
- **Файл**: `src/routes/votings.ts` - все endpoints переписаны для работы с SQLite
- Убраны зависимости от JSON файла
- Добавлены асинхронные запросы к базе данных

### 4. Создан скрипт миграции
- **Файл**: `src/db/migrate.ts` - мигрирует данные из `data.json` в SQLite
- Сохраняет соответствие старых и новых ID голосований
- Мигрирует голосования, изображения и голоса

### 5. Обновлен главный файл сервера
- **Файл**: `src/index.ts` - добавлена корректная обработка закрытия базы данных

## Структура базы данных

### Таблица `votings`
```sql
CREATE TABLE votings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_at DATETIME NOT NULL
);
```

### Таблица `voting_images`
```sql
CREATE TABLE voting_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voting_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
);
```

### Таблица `votes`
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voting_id TEXT NOT NULL,
  choice INTEGER NOT NULL CHECK (choice IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE
);
```

## Команды для работы

### Установка зависимостей
```bash
npm install
```

### Запуск миграции
```bash
npm run db:migrate
```

### Проверка данных
```bash
npx tsx src/db/check.ts
```

### Запуск сервера
```bash
npm run dev
```

## Переменные окружения

- `DB_PATH` - путь к файлу SQLite базы данных (по умолчанию: `./app.db`)
- `DATA_DIR` - папка для хранения изображений (по умолчанию: `./data`)
- `LOG_DIR` - папка для логов (по умолчанию: `./logs`)
- `PORT` - порт сервера (по умолчанию: `3000`)

## Результаты миграции

✅ Успешно мигрировано:
- 3 голосования
- 6 изображений
- 4 голоса

✅ Протестировано:
- Получение списка голосований
- Создание нового голосования
- Голосование
- Все API endpoints работают корректно

## Файлы базы данных

- `app.db` - SQLite база данных (создается автоматически)
- `data.json` - старый JSON файл (можно удалить после проверки)

## Преимущества SQLite

1. **Производительность** - быстрые запросы и индексы
2. **Надежность** - ACID транзакции
3. **Масштабируемость** - поддержка больших объемов данных
4. **Стандартность** - SQL запросы
5. **Безопасность** - защита от повреждения данных
