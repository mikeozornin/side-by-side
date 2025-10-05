#!/bin/bash

# Скрипт для быстрого деплоя Side-by-Side Voting

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Side-by-Side Voting Deployment Script${NC}"
echo "=================================="

# Проверяем, что мы в корне проекта
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Запустите скрипт из корня проекта${NC}"
    exit 1
fi

# Проверяем наличие Ansible
if ! command -v ansible-playbook &> /dev/null; then
    echo -e "${RED}❌ Ansible не установлен. Установите: pip install ansible${NC}"
    exit 1
fi

# Сборка проекта
echo -e "${YELLOW}📦 Сборка проекта...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка сборки проекта${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Проект собран успешно${NC}"

# Параметры для Ansible
ANSIBLE_ARGS=""
DEPLOY_MODE="ansible"

# Проверяем аргументы
while [[ $# -gt 0 ]]; do
    case $1 in
        --bootstrap)
            echo -e "${YELLOW}🔧 Запуск bootstrap...${NC}"
            ansible-playbook -i ansible/inventory.ini ansible/bootstrap.yml
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Bootstrap завершен успешно${NC}"
                echo -e "${YELLOW}⚠️  Не забудьте настроить /etc/side-by-side/server.env на сервере${NC}"
            else
                echo -e "${RED}❌ Ошибка bootstrap${NC}"
                exit 1
            fi
            shift
            ;;
        --docker)
            DEPLOY_MODE="docker"
            echo -e "${BLUE}🐳 Режим Docker развертывания${NC}"
            shift
            ;;
        --restart)
            ANSIBLE_ARGS="$ANSIBLE_ARGS -e restart_service=true"
            shift
            ;;
        --update-env)
            ANSIBLE_ARGS="$ANSIBLE_ARGS -e update_env=true"
            shift
            ;;
        --help)
            echo "Использование: $0 [опции]"
            echo ""
            echo "Опции:"
            echo "  --bootstrap     Запустить первоначальную настройку сервера"
            echo "  --docker        Использовать Docker развертывание"
            echo "  --restart       Перезапустить сервис после деплоя"
            echo "  --update-env    Обновить env файл с локального .env.production"
            echo "  --help          Показать эту справку"
            echo ""
            echo "Примеры:"
            echo "  $0 --bootstrap                    # Первоначальная настройка"
            echo "  $0 --docker                       # Docker развертывание"
            echo "  $0 --restart                      # Деплой с перезапуском"
            echo "  $0 --restart --update-env         # Деплой с обновлением env и перезапуском"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Неизвестный параметр: $1${NC}"
            echo "Используйте --help для справки"
            exit 1
            ;;
    esac
done

# Если не был запущен bootstrap, делаем деплой
if [[ "$ANSIBLE_ARGS" != *"--bootstrap"* ]]; then
    if [ "$DEPLOY_MODE" = "docker" ]; then
        echo -e "${BLUE}🐳 Docker развертывание...${NC}"
        ansible-playbook -i ansible/inventory.ini ansible/deploy-docker.yml $ANSIBLE_ARGS
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Docker деплой завершен успешно${NC}"
            echo -e "${YELLOW}📝 Для получения SSL сертификата выполните:${NC}"
            echo -e "${YELLOW}   ssh root@your-server 'cd /opt/side-by-side/compose && docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d your-domain.com'${NC}"
        else
            echo -e "${RED}❌ Ошибка Docker деплоя${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}🚀 Ansible развертывание...${NC}"
        ansible-playbook -i ansible/inventory.ini ansible/deploy.yml $ANSIBLE_ARGS
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Ansible деплой завершен успешно${NC}"
        else
            echo -e "${RED}❌ Ошибка Ansible деплоя${NC}"
            exit 1
        fi
    fi
fi

echo -e "${GREEN}🎉 Готово!${NC}"
