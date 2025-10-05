# HTTPS Setup with Let's Encrypt

Это руководство поможет настроить HTTPS для вашего приложения с автоматическими бесплатными SSL сертификатами от Let's Encrypt.

## Требования

1. **Домен** указывающий на ваш VPS (например: `example.com` → `your-server-ip`)
2. **Порты 80 и 443** открыты в файрволе
3. **Приложение уже работает** на HTTP

## Быстрая настройка

### 1. Убедитесь, что домен указывает на сервер

```bash
# Проверьте DNS
dig +short your-domain.com
# Должен вернуть: your-server-ip
```

### 2. Запустите скрипт настройки SSL

```bash
cd /opt/side-by-side/compose
./setup-ssl.sh your-domain.com your-email@example.com
```

Скрипт автоматически:
- ✅ Обновит конфигурацию nginx
- ✅ Получит SSL сертификат от Let's Encrypt
- ✅ Настроит автоматическое обновление сертификата
- ✅ Настроит редирект с HTTP на HTTPS

### 3. Готово!

Ваш сайт теперь доступен по HTTPS:
- 🔒 `https://your-domain.com`
- ↪️  `http://your-domain.com` → редирект на HTTPS

## Ручная настройка

Если вы хотите настроить SSL вручную:

### 1. Подготовьте конфигурацию

```bash
# Отредактируйте nginx-ssl.conf
nano nginx-ssl.conf
# Замените YOUR_DOMAIN на ваш домен
# Замените server_name _; на server_name your-domain.com;
```

### 2. Создайте директории для сертификатов

```bash
mkdir -p certbot-conf certbot-www
```

### 3. Запустите Certbot для получения сертификата

```bash
# Убедитесь, что базовый стек работает
docker compose up -d

# Получите сертификат
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d your-domain.com
```

### 4. Включите HTTPS конфигурацию

```bash
# Запустите с HTTPS
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

## Управление сертификатами

### Обновление сертификата вручную

```bash
docker compose run --rm certbot renew
docker compose restart edge
```

### Проверка статуса сертификата

```bash
docker compose run --rm certbot certificates
```

### Добавление дополнительных доменов

```bash
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d your-domain.com \
    -d www.your-domain.com
```

## Проверка HTTPS

### 1. Проверьте сертификат в браузере

Откройте `https://your-domain.com` и кликните на замок в адресной строке.

### 2. Проверьте SSL рейтинг

Зайдите на https://www.ssllabs.com/ssltest/ и проверьте ваш домен.

## Настройка для Web Push

Web Push уведомления **требуют HTTPS** для работы в браузере. После настройки HTTPS:

1. Обновите `.env`:
```env
BASE_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
WEB_PUSH_ENABLED=true
```

2. Перезапустите сервисы:
```bash
docker compose restart server
```

## Troubleshooting

### Certbot не может получить сертификат

1. Убедитесь, что порт 80 открыт:
```bash
curl http://your-domain.com/.well-known/acme-challenge/test
```

2. Проверьте логи:
```bash
docker compose logs certbot
docker compose logs edge
```

### Сертификат не обновляется автоматически

Certbot контейнер пытается обновить сертификат каждые 12 часов. Проверьте:

```bash
docker compose ps certbot
docker compose logs certbot
```

### Nginx не запускается после включения SSL

1. Проверьте пути к сертификатам в `nginx-ssl.conf`
2. Убедитесь, что сертификаты получены:
```bash
docker compose exec edge ls -la /etc/letsencrypt/live/
```

## Альтернатива: Self-signed сертификат (для тестирования)

Если у вас нет домена, можно создать self-signed сертификат для тестирования:

```bash
# Создайте директорию для сертификатов
mkdir -p ssl

# Генерируйте self-signed сертификат
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/privkey.pem \
    -out ssl/fullchain.pem \
    -subj "/CN=your-server-ip"

# Обновите nginx-ssl.conf:
# ssl_certificate /etc/nginx/ssl/fullchain.pem;
# ssl_certificate_key /etc/nginx/ssl/privkey.pem;

# Добавьте volume в docker-compose:
# - ./ssl:/etc/nginx/ssl:ro
```

⚠️ **Внимание:** Self-signed сертификаты НЕ работают для Web Push в браузерах!

## Дополнительная безопасность

### 1. Настройте HSTS preload

В `nginx-ssl.conf` обновите заголовок:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

Затем зарегистрируйте домен на https://hstspreload.org/

### 2. Включите OCSP stapling

Добавьте в `nginx-ssl.conf`:
```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/YOUR_DOMAIN/chain.pem;
```

### 3. Настройте Content Security Policy

Добавьте в заголовки:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

## Полезные ссылки

- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

