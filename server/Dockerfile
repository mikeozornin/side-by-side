# Multi-stage build для Bun server
# Build stage - с build зависимостями
FROM oven/bun:1.2.21-debian AS builder

# Установка build зависимостей
RUN apt-get update && apt-get install -y \
    # Для sharp (обработка изображений)
    libvips-dev \
    libfftw3-dev \
    build-essential \
    python3 \
    # Для bcrypt
    gcc \
    g++ \
    make \
    # Для PostgreSQL client
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копирование package.json и bun.lock для кэширования зависимостей
COPY package.json bun.lock ./

# Установка зависимостей (включая dev для сборки)
RUN bun install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN bun run build

# Production stage - минимальный образ
FROM oven/bun:1.2.21-debian AS production

# Установка только runtime зависимостей
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    # Runtime библиотеки для sharp
    libvips42 \
    # Runtime библиотеки для PostgreSQL
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Создание пользователя для безопасности
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home bunuser

# Создание директорий для данных и логов
RUN mkdir -p /var/app/data /var/app/logs /var/app/state && \
    chown -R bunuser:nodejs /var/app

# Копирование только необходимых файлов из builder
COPY --from=builder --chown=bunuser:nodejs /app/dist ./dist
COPY --from=builder --chown=bunuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bunuser:nodejs /app/package.json ./

# Переключение на непривилегированного пользователя
USER bunuser

# Открытие порта
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Запуск приложения
CMD ["bun", "run", "start"]

