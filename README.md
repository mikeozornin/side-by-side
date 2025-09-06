# Side by Side

Веб-приложение для быстрого тестирования дизайн-макетов.

## Описание

Side by Side позволяет дизайнерам загружать два варианта дизайна и получать обратную связь от команды через голосование. Голосование длится 24 часа, после чего показываются результаты.

## Технический стек

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Nodejs, SQLite
- **Оптимизация изображений**: ImageMagick, jpegoptim, pngquant, cwebp, avifenc
- **Figma плагин**: Vanilla JavaScript для интеграции с Figma Desktop App

## Установка и запуск

### Требования

- Node.js 20+ (для поддержки File API)
- npm или yarn
- Утилиты для оптимизации изображений (Ubuntu):
  ```bash
  sudo apt update
  sudo apt install imagemagick jpegoptim pngquant webp avif-tools
  ```

### Установка зависимостей

```bash
# Установка всех зависимостей
npm run install:all
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
npm run dev
```

Или по отдельности:
```bash
# Только сервер (порт 3000)
npm run dev:server

# Только клиент (порт 5173)
npm run dev:client
```

### Сборка для продакшена

```bash
# Сборка клиента и сервера
npm run build

# Запуск продакшен сервера
npm run start
```

## Структура проекта

```
side-by-side/
├── client/                 # React фронтенд
│   ├── src/
│   │   ├── components/     # UI компоненты
│   │   ├── pages/         # Страницы приложения
│   │   └── lib/           # Утилиты
│   └── package.json
├── server/                # Node.js бэкенд
│   ├── src/
│   │   ├── db/           # База данных и схемы
│   │   ├── routes/       # API маршруты
│   │   └── utils/        # Утилиты сервера
│   └── package.json
├── figma-plugin/          # Figma плагин
│   ├── code.js           # Основная логика плагина
│   ├── ui.html           # HTML интерфейса
│   └── manifest.json     # Манифест плагина
├── data/                  # Загруженные изображения
├── logs/                  # Логи сервера
└── package.json          # Корневой package.json
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
- **Темная тема**: Поддержка светлой и темной темы
- **Responsive**: Адаптивный дизайн для десктопа
- **Hash routing**: SPA с hash-based роутингом

## Деплой

### Ubuntu + Nginx

1. Соберите проект: `npm run build`
2. Настройте Nginx для раздачи статики и проксирования API
3. Запустите сервер: `npm run start`
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

### Установка плагина

1. Откройте Figma Desktop App
2. Перейдите в настройки плагинов: Меню → Plugins → Development → Import plugin from manifest...
3. Выберите файл `figma-plugin/manifest.json`

### Использование

1. Выберите два или более элемента на canvas (фреймы, группы или компоненты)
2. Запустите плагин "Side by Side Voting"
3. Заполните название голосования и выберите длительность
4. Нажмите "Создать голосование"
5. Ссылка на голосование будет скопирована в буфер обмена

Подробная документация плагина доступна в [figma-plugin/README.md](figma-plugin/README.md).

## Разработка

### Добавление новых компонентов

Компоненты shadcn/ui можно добавить через:
```bash
cd client
npx shadcn-ui@latest add [component-name]
```

### Структура базы данных

- `votings` - голосования
- `voting_images` - изображения голосований
- `votes` - голоса пользователей

### Логирование

Логи сохраняются в `LOG_DIR/server.log` с ротацией через logrotate.
