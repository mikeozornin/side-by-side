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
- Node.js 20+ (устанавливается автоматически)

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

# Остальные настройки можно оставить по умолчанию
```

### 3. Настройка окружения

Создайте файл `server/.env.production` с продакшен настройками:

```env
DATA_DIR=/opt/side-by-side/current/data
LOG_DIR=/opt/side-by-side/current/logs
DB_PATH=/opt/side-by-side/current/app.db
PORT=3000
BASE_URL=https://side-by-side.your-domain.com
NODE_ENV=production
VOTING_BASE_URL=https://side-by-side.your-domain.com
SERVER_MODE=production
NOTIFICATIONS_LOCALE=ru
MATTERMOST_ENABLED=false
TELEGRAM_ENABLED=false
RATE_LIMIT_VOTING_PER_MINUTE=6
RATE_LIMIT_VOTING_PER_HOUR=60
```

## Первоначальная установка

### 1. Сборка проекта

```bash
# В корне проекта
npm run build
```

### 2. Bootstrap сервера

```bash
ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
```

Это установит:
- Node.js 20+
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
npm run build
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
│       ├── server/             # Собранный Node.js бэкенд
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
- Проксирования API запросов на Node.js сервер
- Кеширования статических ресурсов (1 год для hashed файлов)
- SPA fallback для React Router

## Systemd сервис

Сервис `side-by-side`:
- Автоматически запускается при загрузке системы
- Перезапускается при сбоях
- Работает от пользователя `www-data`
- Читает конфигурацию из `/etc/side-by-side/server.env`

## Управление релизами

- Хранится последние 10 релизов (настраивается в `releases_to_keep`)
- Старые релизы автоматически удаляются при деплое
- Откат: переключить симлинк `current` на предыдущий релиз и перезапустить сервис

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
