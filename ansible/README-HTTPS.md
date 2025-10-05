# HTTPS Deployment with Ansible

Это руководство описывает, как развернуть приложение с HTTPS используя Ansible.

## Требования

1. **Домен** указывающий на ваш VPS
2. **Порты 80 и 443** открыты в файрволе
3. **Ansible** установлен локально
4. **SSH доступ** к серверу настроен

## Быстрая настройка

### 1. Настройте инвентори

Отредактируйте `inventory.ini`:

```ini
[production]
your-server ansible_host=your-server-ip ansible_user=root
```

### 2. Создайте файл с переменными для HTTPS

```bash
cp group_vars/https.yml.example group_vars/https.yml
nano group_vars/https.yml
```

Обновите:
```yaml
enable_https: true
ssl_domain: "your-actual-domain.com"
ssl_email: "your-email@example.com"
base_url: "https://your-actual-domain.com"
client_url: "https://your-actual-domain.com"
```

### 3. Запустите деплой

```bash
# Первый деплой (установка всего)
ansible-playbook -i inventory.ini bootstrap-compose.yml
ansible-playbook -i inventory.ini deploy-compose.yml -e @group_vars/https.yml

# Последующие деплои (только обновление приложения)
ansible-playbook -i inventory.ini deploy-compose.yml -e @group_vars/https.yml
```

## Что делает плейбук

1. ✅ Копирует все файлы конфигурации (включая HTTPS)
2. ✅ Обновляет nginx конфиг с вашим доменом
3. ✅ Запускает контейнеры с поддержкой HTTPS
4. ✅ Получает SSL сертификат от Let's Encrypt
5. ✅ Настраивает автоматическое обновление сертификата
6. ✅ Перезапускает nginx с HTTPS

## Переменные

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `enable_https` | Включить HTTPS | `false` |
| `ssl_domain` | Ваш домен | `""` |
| `ssl_email` | Email для Let's Encrypt | `""` |
| `base_url` | URL приложения | `http://localhost` |
| `client_url` | URL клиента | `http://localhost` |
| `compose_pull_images` | Скачивать образы из registry | `false` |
| `compose_use_postgres` | Использовать PostgreSQL | `false` |

## Примеры использования

### Деплой с HTTPS и PostgreSQL

```bash
ansible-playbook -i inventory.ini deploy-compose.yml \
  -e enable_https=true \
  -e ssl_domain=example.com \
  -e ssl_email=admin@example.com \
  -e compose_use_postgres=true
```

### Деплой только HTTP (без HTTPS)

```bash
ansible-playbook -i inventory.ini deploy-compose.yml \
  -e enable_https=false \
  -e compose_pull_images=true
```

### Обновление приложения с существующим SSL

```bash
# SSL сертификат уже получен, просто обновляем образы
ansible-playbook -i inventory.ini deploy-compose.yml \
  -e enable_https=true \
  -e ssl_domain=example.com \
  -e compose_pull_images=true
```

## Проверка SSL сертификата

После деплоя проверьте:

```bash
# Проверьте статус контейнеров
ssh root@your-server "cd /opt/side-by-side/compose && docker compose ps"

# Проверьте сертификат
ssh root@your-server "cd /opt/side-by-side/compose && docker compose run --rm certbot certificates"

# Проверьте логи
ssh root@your-server "cd /opt/side-by-side/compose && docker compose logs certbot"
ssh root@your-server "cd /opt/side-by-side/compose && docker compose logs edge"
```

## Обновление сертификата вручную

Certbot автоматически обновляет сертификаты каждые 12 часов. Для ручного обновления:

```bash
ssh root@your-server
cd /opt/side-by-side/compose
docker compose run --rm certbot renew
docker compose restart edge
```

## Troubleshooting

### Сертификат не получен

1. Проверьте DNS:
```bash
dig +short your-domain.com
```

2. Убедитесь, что порт 80 открыт:
```bash
curl http://your-domain.com/.well-known/acme-challenge/test
```

3. Проверьте логи Certbot:
```bash
ssh root@your-server "cd /opt/side-by-side/compose && docker compose logs certbot"
```

### Nginx не запускается

1. Проверьте конфигурацию:
```bash
ssh root@your-server "cd /opt/side-by-side/compose && docker compose exec edge nginx -t"
```

2. Проверьте пути к сертификатам:
```bash
ssh root@your-server "cd /opt/side-by-side/compose && docker compose exec edge ls -la /etc/letsencrypt/live/"
```

### Переключение с HTTP на HTTPS

Если приложение уже работает на HTTP:

1. Обновите переменные для HTTPS
2. Запустите плейбук с `enable_https=true`
3. Ansible автоматически настроит HTTPS и получит сертификат

## Отключение HTTPS

Для отключения HTTPS и возврата к HTTP:

```bash
ansible-playbook -i inventory.ini deploy-compose.yml \
  -e enable_https=false
```

## Дополнительные настройки

### Custom nginx конфигурация

Если нужна кастомная конфигурация nginx:

1. Отредактируйте `deploy/compose/nginx-ssl.conf`
2. Запустите плейбук повторно

### Несколько доменов

Для добавления дополнительных доменов к сертификату:

```bash
ssh root@your-server
cd /opt/side-by-side/compose
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com \
  -d www.your-domain.com
```

Затем обновите `nginx-ssl.conf`:
```nginx
server_name your-domain.com www.your-domain.com;
```

