# Быстрый деплой на VPS

## Локально (у вас на машине)

### 1. Залогиньтесь в Docker registry

```bash
# GitHub Container Registry
docker login ghcr.io
# Username: ваш GitHub username
# Password: GitHub Personal Access Token (с правами write:packages)

# Или Docker Hub
docker login
# Username: ваш Docker Hub username
# Password: ваш пароль или access token
```

### 2. Соберите и запушьте образы

```bash
cd deploy/compose

# Для GHCR (по умолчанию)
./build-and-push.sh --tag latest

# Или явно указать registry
./build-and-push.sh --registry ghcr.io/mikeozornin --tag latest

# Для Docker Hub
./build-and-push.sh --registry mikeozornin --tag latest
```

## На VPS (root@45.131.43.101)

### 1. Установите Docker

```bash
ssh root@45.131.43.101

# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install docker-compose-plugin -y

# Проверка
docker --version
docker compose version
```

### 2. Создайте директорию и конфигурацию

```bash
# Создайте директорию
mkdir -p /opt/side-by-side/compose
cd /opt/side-by-side/compose

# Создайте docker-compose.yml
nano docker-compose.yml
```

Вставьте содержимое из `deploy/compose/docker-compose.yml`

```bash
# Создайте nginx.conf
nano nginx.conf
```

Вставьте содержимое из `deploy/compose/nginx.conf`

### 3. Настройте переменные окружения

```bash
nano .env
```

Минимальная конфигурация:

```env
# Docker images
IMAGE_REGISTRY=ghcr.io/mikeozornin
IMAGE_TAG=latest

# Application
BASE_URL=http://45.131.43.101
CLIENT_URL=http://45.131.43.101
JWT_SECRET=измените-на-длинный-случайный-ключ-минимум-32-символа

# Database (SQLite by default)
DB_PROVIDER=sqlite
DB_PATH=/var/app/state/app.db

# Storage (local by default)
STORAGE_DRIVER=local
DATA_DIR=/var/app/data

# Auth
AUTH_MODE=anonymous
AUTO_APPROVE_SESSIONS=true
```

### 4. Запустите приложение

```bash
# Залогиньтесь в registry (если образы приватные)
docker login ghcr.io

# Скачайте образы
docker compose pull

# Запустите
docker compose up -d

# Проверьте статус
docker compose ps

# Посмотрите логи
docker compose logs -f
```

### 5. Проверьте работу

```bash
# Health check
curl http://45.131.43.101/health

# Главная страница
curl http://45.131.43.101/

# В браузере
# http://45.131.43.101
```

## Troubleshooting

### Образы не скачиваются

```bash
# Проверьте логин
docker login ghcr.io

# Проверьте имя образа
docker compose config | grep image
```

### Контейнеры не запускаются

```bash
# Посмотрите логи
docker compose logs

# Проверьте статус
docker compose ps -a
```

### Порт 80 занят

```bash
# Проверьте что использует порт
netstat -tlnp | grep :80

# Остановите nginx или другой сервис
systemctl stop nginx
```

## Полезные команды

```bash
# Остановить
docker compose down

# Перезапустить
docker compose restart

# Обновить образы
docker compose pull
docker compose up -d

# Посмотреть логи
docker compose logs -f server
docker compose logs -f client
docker compose logs -f edge

# Зайти в контейнер
docker compose exec server sh
```

## Автозапуск при перезагрузке

```bash
# Создайте systemd service
cat > /etc/systemd/system/side-by-side.service << 'EOF'
[Unit]
Description=Side-by-Side Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/side-by-side/compose
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Включите автозапуск
systemctl daemon-reload
systemctl enable side-by-side.service
systemctl start side-by-side.service
```
