#!/bin/bash
# Ручная установка Bun на сервере
# Используйте этот скрипт, если Ansible не смог установить Bun

set -e

echo "🚀 Установка Bun вручную..."

# Удаляем старые версии Node.js
echo "🗑️ Удаление Node.js..."
apt-get remove -y nodejs npm || true
apt-get autoremove -y || true

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
apt-get update
apt-get install -y curl wget unzip ca-certificates build-essential git

# Устанавливаем Bun
echo "⬇️ Скачивание и установка Bun..."
curl -fsSL https://bun.sh/install | bash

# Добавляем в PATH
echo "🔧 Настройка PATH..."
export PATH="$HOME/.bun/bin:$PATH"
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc

# Создаем симлинк
echo "🔗 Создание симлинка..."
ln -sf /root/.bun/bin/bun /usr/local/bin/bun
chmod +x /usr/local/bin/bun

# Проверяем установку
echo "✅ Проверка установки..."
/usr/local/bin/bun --version

echo "🎉 Bun успешно установлен!"
echo "Версия: $(/usr/local/bin/bun --version)"
echo "Путь: /usr/local/bin/bun"
