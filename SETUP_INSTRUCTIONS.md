# Настройка для развертывания

Перед развертыванием приложения необходимо настроить следующие файлы с вашими данными:

## 1. Ansible конфигурация

### Создайте файл `ansible/inventory.ini`:
```ini
[web]
target ansible_host=your-server-ip ansible_user=root
```

### Создайте файл `ansible/group_vars/https.yml`:
```yaml
# Example variables for HTTPS deployment
# Copy this file to https.yml and customize for your domain

# Enable HTTPS
enable_https: true

# Your domain name
ssl_domain: "your-domain.com"

# Email for Let's Encrypt notifications
ssl_email: "your@email.com"

# Application URLs (update to use HTTPS)
base_url: "https://your-domain.com"
client_url: "https://your-domain.com"

# Docker Compose settings
compose_pull_images: true
compose_bind_mounts: false

# Image settings (if using Docker Hub)
image_registry: "docker.io/your-dockerhub-username"
image_tag: "latest"
```

## 2. Docker конфигурация

### Создайте файл `deploy/compose/nginx-https.conf`:
Скопируйте содержимое из `deploy/compose/nginx-https.conf.example` и замените:
- `your-domain.com` на ваш домен
- Пути к SSL сертификатам

### Настройте переменные окружения в `.env`:
```bash
# Docker deployment
DEPLOY_MODE=docker
DOCKER_HUB_USERNAME=your-dockerhub-username
DOMAIN=your-domain.com

# SMTP for magic links
SMTP_HOST=your-smtp-server.com
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com
```

## 3. GitHub Actions (опционально)

Если используете GitHub Actions для сборки образов:

1. **Настройте секреты** в GitHub:
   - `DOCKER_HUB_USERNAME` - ваш Docker Hub username
   - `DOCKER_HUB_TOKEN` - ваш Docker Hub token

2. **Обновите workflow файлы**:
   - Замените `your-github-username` в `.github/workflows/docker-build.yml`

## 4. Развертывание

### Ansible развертывание:
```bash
./deploy.sh --bootstrap  # Первоначальная настройка
./deploy.sh              # Обычный деплой
```

### Docker развертывание:
```bash
./deploy.sh --docker     # Docker деплой
```

## 5. Получение SSL сертификата (Docker)

После Docker развертывания получите SSL сертификат:

```bash
ssh root@your-server 'cd /opt/side-by-side/compose && docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d your-domain.com'
```

Затем включите HTTPS:
```bash
ssh root@your-server 'cd /opt/side-by-side/compose && docker compose down && docker compose up -d'
```

## Важные замечания

- ✅ Все чувствительные файлы добавлены в `.gitignore`
- ✅ Созданы шаблоны (`.example`) для всех конфигурационных файлов
- ✅ Хардкодные IP адреса и домены заменены на плейсхолдеры
- ✅ Docker Hub и GitHub usernames заменены на плейсхолдеры

## Файлы в .gitignore

Следующие файлы не попадут в репозиторий:
- `ansible/inventory.ini`
- `ansible/group_vars/https.yml`
- `deploy/compose/nginx-https.conf`
- `.env*` файлы
