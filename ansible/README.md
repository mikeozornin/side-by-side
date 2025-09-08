# Ansible Deployment для Side-by-Side Voting

Этот каталог содержит Ansible playbooks для деплоя веб-приложения Side-by-Side Voting на Ubuntu сервер.

## Структура

- `bootstrap.yml` - первоначальная настройка сервера (системные зависимости, systemd, nginx)
- `deploy.yml` - деплой новых версий приложения
- `inventory.ini` - список серверов для деплоя
- `group_vars/all.yml` - переменные конфигурации

## Требования

### На сервере
- Ubuntu 20.04+ 
- Root доступ
- Nginx установлен
- Bun 1.0+ (устанавливается автоматически)

### На машине разработчика
- Ansible 2.9+
- SSH доступ к серверу
- Собранные артефакты (frontend и backend)

## Конфигурация

### 1. Настройка inventory

Отредактируйте `inventory.ini`:

```ini
[web]
target ansible_host=your-server-ip ansible_user=root
```

### 2. Настройка переменных

Отредактируйте `group_vars/all.yml`:

```yaml
# Замените на ваш домен
domain: side-by-side.your-domain.com

# Режим аутентификации (anonymous или magic-links)
auth_mode: anonymous

# Остальные настройки можно оставить по умолчанию
```

### 3. Настройка окружения

Создайте файл `server/.env.production` с продакшен настройками:

```env
# Конфигурация приложения
DATA_DIR=/opt/side-by-side/current/data
LOG_DIR=/opt/side-by-side/current/logs
DB_PATH=/opt/side-by-side/current/app.db
PORT=3000
BASE_URL=https://side-by-side.your-domain.com
NODE_ENV=production

# Настройки базы данных
# Провайдер: "sqlite" или "postgres"
DB_PROVIDER=sqlite
# Путь для SQLite (используется, если DB_PROVIDER="sqlite")
DB_PATH=/opt/side-by-side/current/app.db
# URL для PostgreSQL (используется, если DB_PROVIDER="postgres")
# DATABASE_URL=postgresql://user:password@host:port/dbname

# URL для ссылок на голосования (клиентская часть)
VOTING_BASE_URL=https://side-by-side.your-domain.com

# URL клиентской части (для magic links)
CLIENT_URL=https://side-by-side.your-domain.com

# Режим работы сервера
SERVER_MODE=production

# Уведомления в чаты
NOTIFICATIONS_LOCALE=ru

# Mattermost интеграция
MATTERMOST_ENABLED=false
# MATTERMOST_WEBHOOK_URL=https://your-mattermost-server.com/hooks/your-webhook-id

# Telegram интеграция (для будущего)
TELEGRAM_ENABLED=false
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_CHAT_ID=your-chat-id

# Web Push уведомления
WEB_PUSH_ENABLED=false
# Сгенерируйте ключи командой: npx web-push generate-vapid-keys
# VAPID_PUBLIC_KEY=your_vapid_public_key_here
# VAPID_PRIVATE_KEY=your_vapid_private_key_here
# VAPID_EMAIL=mailto:admin@your-domain.com

# Rate Limiting
RATE_LIMIT_VOTING_PER_MINUTE=6
RATE_LIMIT_VOTING_PER_HOUR=60
RATE_LIMIT_AUTH_MAGIC_LINK_PER_MINUTE=5
RATE_LIMIT_AUTH_VERIFY_TOKEN_PER_MINUTE=5

# Режим аутентификации
AUTH_MODE=anonymous

# Автоапрув сессий в dev режиме (без отправки письма). Не используйте в продакшене!
AUTO_APPROVE_SESSIONS=false

# SMTP настройки для отправки magic link'ов
# SMTP_HOST=your-smtp-server.com
# SMTP_PORT=587
# SMTP_USER=your-smtp-username
# SMTP_PASS=your-smtp-password
# SMTP_FROM_EMAIL=noreply@your-domain.com
```

## Первоначальная установка

### 1. Сборка проекта

```bash
# В корне проекта
bun run build
```

**⚠️ ВАЖНО:** Убедитесь, что в директории `server/` нет локальных файлов базы данных (`app.db`, `*.db`, `*.sqlite`), так как они могут перезаписать продакшен данные при деплое.

### 2. Bootstrap сервера

```bash
ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
```

Это установит:
- Bun 1.0+
- Системные зависимости для оптимизации изображений (ImageMagick, jpegoptim, pngquant, webp)
- Nginx конфигурацию
- Systemd сервис
- Базовую структуру каталогов
- Placeholder env файл

### 3. Настройка окружения

После bootstrap обновите `/etc/side-by-side/server.env` на сервере с реальными настройками.

### 4. Первый деплой

```bash
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e restart_service=true
```

## Обновление приложения

### 1. Сборка новой версии

```bash
# В корне проекта
bun run build
```

### 2. Деплой

```bash
# Обычный деплой (без перезапуска сервиса)
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml

# Деплой с перезапуском сервиса
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e restart_service=true

# Деплой с обновлением env файла
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e update_env=true -e restart_service=true
```

## Структура на сервере

```
/opt/side-by-side/
├── releases/                    # Релизы с timestamp
│   └── 20241201_143022/        # Пример релиза
│       ├── frontend/           # Собранный React фронтенд
│       ├── server/             # Собранный Bun бэкенд
│       ├── data/               # Загруженные изображения
│       ├── logs/               # Логи приложения
│       └── manifest.json       # Информация о релизе
├── current -> releases/20241201_143022/  # Симлинк на текущий релиз
└── data/                       # Данные (симлинк на current/data)

/etc/side-by-side/
└── server.env                  # Конфигурация приложения

/usr/share/nginx/side-by-side -> /opt/side-by-side/current/frontend/  # Nginx web root
```

## Nginx конфигурация

Nginx настроен для:
- Обслуживания статических файлов фронтенда
- Проксирования API запросов на Bun сервер (включая `/api/images/`)
- Кеширования статических ресурсов (1 год для hashed файлов, исключая `/api/` пути)
- SPA fallback для React Router
- HTTP/2 поддержки для улучшенной производительности

**Важно:** Статические файлы фронтенда кешируются, но файлы из `/api/images/` проксируются к Bun серверу для обработки.

**HTTP/2:** После настройки SSL сертификата nginx автоматически включает HTTP/2 поддержку.

## Systemd сервис

Сервис `side-by-side`:
- Автоматически запускается при загрузке системы
- Перезапускается при сбоях
- Работает от пользователя `www-data`
- Читает конфигурацию из `/etc/side-by-side/server.env`

## Управление релизами

- Хранится последние 10 релизов (настраивается в `releases_to_keep`)
- Старые релизы автоматически удаляются при деплое
- **База данных (`app.db`) автоматически копируется** из текущего релиза в новый при деплое, если используется `DB_PROVIDER=sqlite`. При использовании PostgreSQL база данных является внешней и не затрагивается при деплое.
- **Данные (`data/`) и логи (`logs/`) также сохраняются** между деплоями.
- Откат: переключить симлинк `current` на предыдущий релиз и перезапустить сервис.

## Мониторинг

### Логи сервиса
```bash
journalctl -u side-by-side -f
```

### Логи приложения
```bash
tail -f /opt/side-by-side/current/logs/server.log
```

### Health check
```bash
curl https://side-by-side.your-domain.com/health
```

## SSL сертификаты

Для продакшена рекомендуется настроить SSL через Let's Encrypt:

```bash
# Установка certbot
apt install certbot python3-certbot-nginx

# Получение сертификата
certbot --nginx -d side-by-side.your-domain.com

# Автоматическое обновление
crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Включение HTTP/2

После настройки SSL автоматически включается HTTP/2. Если нужно включить вручную:

```bash
# Добавить http2 к listen директиве
sed -i 's/listen 443 ssl;/listen 443 ssl http2;/' /etc/nginx/sites-available/side-by-side.your-domain.com

# Проверить и перезагрузить
nginx -t && systemctl reload nginx
```

## Режимы аутентификации

Приложение поддерживает два режима аутентификации:

### AUTH_MODE=anonymous
- Анонимный доступ - пользователи могут создавать и голосовать без регистрации
- Кнопка "Войти" скрыта в интерфейсе
- Голоса сохраняются с `user_id = NULL`
- Защита от повторного голосования через localStorage

### AUTH_MODE=magic-links  
- Авторизация через magic links
- Пользователи должны входить через email
- Кнопка "Войти" отображается в интерфейсе
- Голоса привязываются к пользователю
- **Требует настройки SMTP** для отправки magic links

**Важно:** Режим аутентификации настраивается в `/etc/side-by-side/server.env` и применяется после перезапуска сервиса.

### Быстрое переключение режимов

```bash
# Переключить на анонимный режим
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e auth_mode=anonymous -e restart_service=true

# Переключить на режим magic-links
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e auth_mode=magic-links -e restart_service=true
```

### Настройка SMTP для magic-links режима

Для работы в режиме `magic-links` необходимо настроить SMTP сервер:

```bash
# Отредактировать env файл на сервере
ssh root@your-server "nano /etc/side-by-side/server.env"

# Добавить SMTP настройки:
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com

# Перезапустить сервис
ssh root@your-server "systemctl restart side-by-side"
```

**Популярные SMTP провайдеры:**
- **Gmail**: `smtp.gmail.com:587` (требует App Password)
- **Yandex**: `smtp.yandex.ru:587`
- **Mail.ru**: `smtp.mail.ru:587`
- **SendGrid**: `smtp.sendgrid.net:587`

## Безопасность деплоя

### Защита от перезаписи продакшен данных

**Проблема:** Локальные файлы базы данных могут случайно попасть на продакшен при деплое.

**Решение:** Ansible автоматически исключает следующие файлы при синхронизации:
- `app.db`, `*.db`, `*.sqlite`, `*.sqlite3` - файлы базы данных
- `data/` - директория с данными
- `logs/` - директория с логами  
- `.env*` - файлы окружения

**Проверка перед деплоем:**
```bash
# Убедитесь, что в server/ нет локальных файлов БД
ls -la server/*.db server/*.sqlite server/*.sqlite3 2>/dev/null || echo "OK: No local database files"

# Удалите локальные файлы БД если они есть
rm -f server/*.db server/*.sqlite server/*.sqlite3
```

## Troubleshooting

### Проблемы с правами доступа
```bash
# Исправить права на данные
chown -R www-data:www-data /opt/side-by-side/current/data
chown -R www-data:www-data /opt/side-by-side/current/logs
```

### Проблемы с Nginx
```bash
# Проверить конфигурацию
nginx -t

# Перезагрузить
systemctl reload nginx
```

### Проблемы с сервисом
```bash
# Статус сервиса
systemctl status side-by-side

# Перезапуск
systemctl restart side-by-side

# Логи
journalctl -u side-by-side --since "1 hour ago"
```

### Проблемы с установкой Bun
Если Bun не установился через Ansible:

```bash
# Ручная установка Bun на сервере
scp ansible/install-bun-manual.sh root@your-server:/tmp/
ssh root@your-server "chmod +x /tmp/install-bun-manual.sh && /tmp/install-bun-manual.sh"

# Или установка вручную
ssh root@your-server
curl -fsSL https://bun.sh/install | bash
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
chmod +x /usr/local/bin/bun
bun --version
```

### Проблемы с изображениями (404 ошибки)
Если изображения возвращают 404 ошибку, проверьте nginx конфигурацию:

```bash
# Проверить, что правило для статических файлов исключает /api/ пути
grep -A 3 "location ~\*" /etc/nginx/sites-available/side-by-side.mikeozornin.ru

# Должно быть:
# location ~* ^(?!\/api\/).*\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {

# Если неправильно, перезапустить bootstrap:
ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
```

### Проблемы с нативными модулями (bcrypt и др.)
Если сервис не запускается с ошибкой "No native build was found", это означает, что нативные модули были скомпилированы на другой платформе (macOS/Windows) и не работают на Linux.

**Решение:**
1. Убедитесь, что установлены системные зависимости для компиляции:
   ```bash
   apt install -y build-essential python3-dev libc6-dev
   ```

2. Пересоберите зависимости на сервере:
   ```bash
   cd /opt/side-by-side/current/server
   bun install --production
   ```

3. Или используйте bcryptjs вместо bcrypt (рекомендуется):
   ```bash
   # Локально
   bun remove bcrypt && bun add bcryptjs
   # Обновить импорт в коде: import bcrypt from 'bcryptjs'
   # Пересобрать и задеплоить
   ```

### Проблемы с правами доступа к bun
Если сервис не может запустить bun из-за прав доступа:

```bash
# Проверить права
ls -la /usr/local/bin/bun

# Если это симлинк на /root/.bun/bin/bun, скопировать файл:
rm /usr/local/bin/bun
cp /root/.bun/bin/bun /usr/local/bin/bun
chmod +x /usr/local/bin/bun
chown root:root /usr/local/bin/bun
```

### Восстановление базы данных
Если данные пропали после деплоя, их можно восстановить из предыдущего релиза:

```bash
# Найти предыдущий релиз с данными
ls -la /opt/side-by-side/releases/

# Проверить, есть ли данные в предыдущем релизе
cd /opt/side-by-side/releases/YYYYMMDD_HHMMSS/server
bun -e "import Database from 'bun:sqlite'; const db = new Database('app.db'); console.log('Votings:', db.prepare('SELECT COUNT(*) FROM votings').get());"

# Восстановить базу данных
cp /opt/side-by-side/releases/YYYYMMDD_HHMMSS/app.db /opt/side-by-side/current/app.db
chown www-data:www-data /opt/side-by-side/current/app.db
chmod 644 /opt/side-by-side/current/app.db

# Перезапустить сервис
systemctl restart side-by-side
```
