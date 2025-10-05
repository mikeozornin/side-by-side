# GitHub Actions - Быстрый старт

## Шаг 1: Запушьте код в GitHub

```bash
git add .
git commit -m "Add Docker Compose and GitHub Actions"
git push origin master
```

## Шаг 2: Включите GitHub Actions

1. Зайдите на https://github.com/mikeozornin/side-by-side
2. Перейдите в **Settings** → **Actions** → **General**
3. В разделе "Workflow permissions" выберите:
   - ✅ **Read and write permissions**
4. Нажмите **Save**

## Шаг 3: Запустите workflow вручную

1. Перейдите во вкладку **Actions**
2. Выберите **Build and Push Docker Images** в левом меню
3. Нажмите **Run workflow** (справа)
4. Выберите ветку: **master**
5. Нажмите **Run workflow**

## Шаг 4: Дождитесь завершения

- Сборка займет **5-10 минут**
- Следите за прогрессом в реальном времени
- Если все OK - увидите зеленую галочку ✅

## Шаг 5: Проверьте образы

1. Перейдите на главную страницу репозитория
2. Справа увидите раздел **Packages**
3. Должны появиться:
   - `side-by-side-server`
   - `side-by-side-client`

## Шаг 6: Настройте видимость (если нужно)

Если образы приватные, но вы хотите их сделать публичными:

1. Нажмите на пакет (например, `side-by-side-server`)
2. Справа → **Package settings**
3. Внизу → **Change visibility** → **Public**
4. Подтвердите

## Шаг 7: Используйте образы на VPS

```bash
ssh root@45.131.43.101

# Установите Docker (если еще не установлен)
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# Создайте директорию
mkdir -p /opt/side-by-side/compose
cd /opt/side-by-side/compose

# Создайте docker-compose.yml
nano docker-compose.yml
# Вставьте содержимое из deploy/compose/docker-compose.yml

# Создайте nginx.conf
nano nginx.conf
# Вставьте содержимое из deploy/compose/nginx.conf

# Создайте .env
nano .env
# Минимальная конфигурация:
IMAGE_REGISTRY=ghcr.io/mikeozornin
IMAGE_TAG=latest
BASE_URL=http://45.131.43.101
CLIENT_URL=http://45.131.43.101
JWT_SECRET=измените-на-длинный-случайный-ключ
DB_PROVIDER=sqlite
STORAGE_DRIVER=local
AUTH_MODE=anonymous
AUTO_APPROVE_SESSIONS=true

# Запустите
docker compose pull
docker compose up -d

# Проверьте
docker compose ps
docker compose logs -f
```

## Проверка работы

```bash
# Health check
curl http://45.131.43.101/health

# В браузере
http://45.131.43.101
```

## Автоматические обновления

Теперь при каждом `git push` в master:
1. ✅ GitHub Actions автоматически соберет новые образы
2. ✅ Опубликует их с тегом `latest`
3. ✅ На VPS просто запустите:
   ```bash
   docker compose pull
   docker compose up -d
   ```

## Версионирование

Для создания релиза:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Это создаст образы с тегами:
- `v1.0.0`, `v1.0`, `v1`, `latest`

## Troubleshooting

### Ошибка: "Resource not accessible by integration"
→ Проверьте права в Settings → Actions → General → Workflow permissions

### Образы не появляются в Packages
→ Дождитесь завершения workflow в Actions

### Образы приватные
→ Измените видимость в Package settings → Change visibility → Public

### Не могу pull образы на VPS
→ Залогиньтесь: `docker login ghcr.io -u mikeozornin`
→ Используйте Personal Access Token с правами `read:packages`
