# Multi-stage build для React/Vite client
# Build stage
FROM oven/bun:1.2.21-debian AS builder

WORKDIR /app

# Копирование package.json и bun.lock для кэширования зависимостей
COPY package.json bun.lock ./

# Установка зависимостей
RUN bun install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN bun run build

# Production stage с nginx
FROM nginx:alpine

# Установка wget для health check
RUN apk add --no-cache wget

# Копирование собранного приложения
COPY --from=builder /app/dist /usr/share/nginx/html

# Создаем простую nginx конфигурацию для SPA
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    gzip on; \
    gzip_vary on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml; \
}' > /etc/nginx/conf.d/default.conf

# Открытие порта
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Запуск nginx (nginx автоматически работает от непривилегированного пользователя в alpine)
CMD ["nginx", "-g", "daemon off;"]

