# Side-by-Side Voting

Веб-приложение для быстрого тестирования дизайн-макетов.

## Описание

Side by Side позволяет дизайнерам загружать варианты дизайна и легко получать обратную связь от команды через голосование без писем, подсчетов эмодзи в чатах. Голосование длится указанное время, после чего показываются результаты.

Публичная версия плагина для загрузки: https://www.figma.com/community/plugin/1545946464465075859/side-by-side-voting

## Технический стек

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Bun + TypeScript + Hono + SQLite (bun:sqlite)
- **Оптимизация изображений**: ImageMagick, jpegoptim, pngquant, cwebp, avifenc
- **Figma плагин**: Vanilla JavaScript для интеграции с Figma Desktop App

## Установка и запуск

Есть готовый скрипт ансибла, попробуйте его. Если нет, то читайте ниже.

### Требования

- Bun 1.0+ (вместо Node.js)
- Утилиты для оптимизации изображений (Ubuntu):
  ```bash
  sudo apt update
  sudo apt install imagemagick jpegoptim pngquant webp avif-tools
  ```

### Установка Bun

```bash
# Установка Bun
curl -fsSL https://bun.sh/install | bash

# Перезагрузите терминал или выполните:
source ~/.bashrc
```

### Установка зависимостей

```bash
# Установка всех зависимостей
bun install
```

### Настройка окружения

Скопируйте файл конфигурации:
```bash
cp env.example .env
```

Отредактируйте `.env` при необходимости:
```env
DATA_DIR=./data
LOG_DIR=./logs
DB_PATH=./app.db
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development
```

### Запуск в режиме разработки

```bash
# Запуск сервера и клиента одновременно
bun run dev
```

Или по отдельности:
```bash
# Только сервер (порт 3000)
bun run dev:server

# Только клиент (порт 5173)
bun run dev:client
```

### Сборка для продакшена

```bash
# Сборка клиента и сервера
bun run build

# Запуск продакшен сервера
bun run start
```

## Структура проекта

```
side-by-side/
├── client/                # React фронтенд
│   ├── src/
│   │   ├── components/    # UI компоненты
│   │   ├── pages/         # Страницы приложения
│   │   └── lib/           # Утилиты
│   └── package.json
├── server/                # Bun бэкенд
│   ├── src/
│   │   ├── db/            # База данных и схемы (bun:sqlite)
│   │   ├── routes/        # API маршруты (Hono)
│   │   └── utils/         # Утилиты сервера
│   └── package.json
├── figma-plugin/          # Figma плагин
│   ├── code.js            # Основная логика плагина
│   ├── ui.html            # HTML интерфейса
│   └── manifest.json      # Манифест плагина
├── data/                  # Загруженные изображения
├── logs/                  # Логи сервера
└── package.json           # Корневой package.json
```

## API

### Голосования

- `GET /api/votings` - список всех голосований
- `GET /api/votings/:id` - детали голосования
- `POST /api/votings` - создание голосования
- `POST /api/votings/:id/vote` - голосование
- `GET /api/votings/:id/results` - результаты голосования

### Изображения

- `GET /api/images/:filename` - получение изображения

## Особенности

- **Антинакрутка**: Использует IndexedDB для предотвращения повторного голосования в одном браузере
- **Оптимизация изображений**: Автоматическая оптимизация загруженных изображений
- **Темный режим**: Поддержка светлого и темного режимов
- **Responsive**: Адаптивный дизайн для десктопа
- **Hash routing**: SPA с hash-based роутингом

## Деплой

### Ubuntu + Nginx

1. Соберите проект: `bun run build`
2. Настройте Nginx для раздачи статики и проксирования API
3. Запустите сервер: `bun run start`
4. Настройте systemd сервис для автозапуска

### Переменные окружения для продакшена

```env
DATA_DIR=/var/app/side-by-side/data
LOG_DIR=/var/app/side-by-side/logs
DB_PATH=/var/app/side-by-side/app.db
PORT=3000
BASE_URL=https://yourdomain.com
NODE_ENV=production
```

## Figma плагин

Приложение включает в себя плагин для Figma, который позволяет создавать голосования прямо из интерфейса дизайна.

### Разработка плагина (developer-версия)

1. Откройте Figma Desktop App
2. Перейдите в настройки плагинов: Меню → Plugins → Development → Import plugin from manifest...
3. Выберите файл `figma-plugin/manifest.json`

### Использование

1. Выберите два или более элемента на canvas (фреймы, группы или компоненты)
2. Запустите плагин «Side-by-Side Voting»
3. Заполните название голосования и выберите длительность
4. Нажмите «Создать голосование»
5. Ссылка на голосование будет скопирована в буфер обмена

Подробная документация плагина доступна в [figma-plugin/README.md](figma-plugin/README.md).

## Разработка

### Структура базы данных

- `votings` - голосования
- `voting_images` - изображения голосований
- `votes` - голоса пользователей

### Логирование

Логи сохраняются в `LOG_DIR/server.log` с ротацией через logrotate.
