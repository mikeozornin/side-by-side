# Docker Compose Deployment

Этот каталог содержит конфигурацию для развертывания Side-by-Side приложения с помощью Docker Compose.

## Структура

- `docker-compose.yml` - основной файл конфигурации Docker Compose
- `nginx.conf` - конфигурация nginx для проксирования и статических файлов
- `env.example` - пример файла переменных окружения
- `README.md` - данная документация

## Требования

- **Bun версия**: 1.2.21 (зафиксирована в `.bunversion` и Dockerfile)
- **Docker**: 20.10+
- **Docker Compose**: v2.0+
- **Платформа**: linux/amd64 (автоматически используется при сборке)

## Кросс-платформенная сборка

Образы собираются для `linux/amd64` независимо от вашей локальной платформы (Mac M1/M2, Intel, Linux).
Docker автоматически эмулирует нужную архитектуру, поэтому нативные модули (`sharp`, `bcrypt`, `pg`) 
будут скомпилированы правильно для Linux сервера.

## Быстрый старт

### Вариант A: Использование готовых образов (рекомендуется)

#### 1. Сборка и публикация образов (локально)

```bash
# Залогиньтесь в registry
docker login ghcr.io  # или docker login для Docker Hub

# Соберите и запушьте образы
cd deploy/compose
./build-and-push.sh --registry ghcr.io/your-username --tag latest

# Или для Docker Hub
./build-and-push.sh --registry your-dockerhub-username --tag latest
```

#### 2. Деплой на VPS

```bash
# На VPS
ssh root@your-vps-ip

# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install docker-compose-plugin -y

# Создайте директорию
mkdir -p /opt/side-by-side/compose
cd /opt/side-by-side/compose

# Скопируйте конфигурационные файлы
# - docker-compose.yml
# - nginx.conf
# - env.example (переименуйте в .env)

# Настройте переменные окружения
cp env.example .env
nano .env
# Укажите IMAGE_REGISTRY и IMAGE_TAG

# Запустите
docker compose pull
docker compose up -d
```

### Вариант B: Локальная сборка на VPS

#### 1. Подготовка сервера

```bash
# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose (если не установлен)
sudo apt-get install docker-compose-plugin
```

#### 2. Клонирование репозитория

```bash
git clone <your-repo-url>
cd side-by-side
```

#### 3. Настройка переменных окружения

```bash
cd deploy/compose
cp env.example .env
# Отредактируйте .env файл с вашими настройками
nano .env
```

#### 4. Раскомментируйте build в docker-compose.yml

```yaml
services:
  server:
    # image: ${IMAGE_REGISTRY}/side-by-side-server:${IMAGE_TAG}
    build: ../../server  # Раскомментируйте эту строку
    
  client:
    # image: ${IMAGE_REGISTRY}/side-by-side-client:${IMAGE_TAG}
    build: ../../client  # Раскомментируйте эту строку
```

#### 5. Запуск приложения

```bash
# Запуск с SQLite (по умолчанию)
docker compose up -d

# Запуск с PostgreSQL
docker compose --profile postgres up -d
```

### 5. Проверка работы

```bash
# Проверка статуса контейнеров
docker compose ps

# Просмотр логов
docker compose logs -f

# Проверка health check
curl http://localhost/health
```

## Конфигурация

### Переменные окружения

Основные переменные в файле `.env`:

- `BASE_URL` - базовый URL приложения
- `CLIENT_URL` - URL клиентской части
- `JWT_SECRET` - секретный ключ для JWT (обязательно изменить!)
- `DB_PROVIDER` - тип БД: `sqlite` или `postgres`
- `STORAGE_DRIVER` - драйвер хранилища: `local` или `s3`
- `AUTH_MODE` - режим аутентификации: `anonymous` или `magic-links`

### Профили

- **По умолчанию**: SQLite + локальное хранилище
- **postgres**: PostgreSQL + локальное хранилище

### Хранилище

#### Локальное хранилище (по умолчанию)
- Файлы сохраняются в Docker volume `app_data`
- Для bind mount установите `compose_bind_mounts=true` в Ansible

#### S3 хранилище
```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=false
```

### База данных

#### SQLite (по умолчанию)
```env
DB_PROVIDER=sqlite
DB_PATH=/var/app/state/app.db
```

#### PostgreSQL
```env
DB_PROVIDER=postgres
DATABASE_URL=postgres://sideuser:sidepass@postgres:5432/sidebyside
```

## Ansible деплой

### Bootstrap сервера

```bash
ansible-playbook -i inventory.ini ansible/bootstrap-compose.yml
```

### Деплой приложения

```bash
# С SQLite
ansible-playbook -i inventory.ini ansible/deploy-compose.yml

# С PostgreSQL
ansible-playbook -i inventory.ini ansible/deploy-compose.yml -e compose_use_postgres=true

# С bind mounts
ansible-playbook -i inventory.ini ansible/deploy-compose.yml -e compose_bind_mounts=true
```

## Управление

### Основные команды

```bash
# Запуск
docker compose up -d

# Остановка
docker compose down

# Перезапуск
docker compose restart

# Просмотр логов
docker compose logs -f

# Обновление
docker compose pull
docker compose up -d --remove-orphans
```

### Бэкапы

#### SQLite
```bash
# Копирование файла БД
docker compose cp server:/var/app/state/app.db ./backup-$(date +%Y%m%d).db
```

#### PostgreSQL
```bash
# Создание дампа
docker compose exec postgres pg_dump -U sideuser sidebyside > backup-$(date +%Y%m%d).sql
```

#### Файлы
```bash
# Копирование файлов
docker compose cp server:/var/app/data ./backup-data-$(date +%Y%m%d)
```

## Мониторинг

### Health checks

- **Server**: `http://localhost/health`
- **Client**: `http://localhost/`
- **Nginx**: автоматическая проверка

### Логи

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f server
docker compose logs -f client
docker compose logs -f edge
```

## Безопасность

### Рекомендации для продакшена

1. **Измените JWT_SECRET** - обязательно сгенерируйте сильный ключ
2. **Настройте HTTPS** - добавьте SSL сертификаты в nginx
3. **Используйте сильные пароли** для PostgreSQL
4. **Настройте firewall** - откройте только необходимые порты
5. **Регулярно обновляйте** Docker образы
6. **Настройте мониторинг** и алерты

### SSL/TLS

Для настройки HTTPS добавьте SSL сертификаты и обновите nginx.conf:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ... остальная конфигурация
}
```

## Troubleshooting

### Проблемы с запуском

1. **Проверьте логи**:
   ```bash
   docker compose logs
   ```

2. **Проверьте переменные окружения**:
   ```bash
   docker compose config
   ```

3. **Проверьте порты**:
   ```bash
   netstat -tlnp | grep :80
   ```

### Проблемы с БД

1. **SQLite**: проверьте права на файл БД
2. **PostgreSQL**: проверьте подключение и права пользователя

### Проблемы с хранилищем

1. **Локальное**: проверьте права на директории
2. **S3**: проверьте credentials и доступность endpoint

## Поддержка

При возникновении проблем:

1. Проверьте логи контейнеров
2. Убедитесь в правильности переменных окружения
3. Проверьте доступность портов и сетевых ресурсов
4. Создайте issue в репозитории с подробным описанием проблемы

