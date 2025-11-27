import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Middleware для обработки CORS preflight запросов
// Используем configureServer с return функцией для раннего выполнения
function corsMiddleware() {
  return {
    name: 'cors-preflight',
    configureServer(server) {
      // Возвращаем функцию, которая выполнится после настройки всех middleware
      return () => {
        // Получаем все middleware и добавляем наш в начало
        const stack = server.middlewares.stack;
        if (Array.isArray(stack)) {
          // Добавляем наш middleware в начало стека
          stack.unshift({
            route: '',
            handle: (req, res, next) => {
              // Обрабатываем только OPTIONS запросы к /api
              if (req.method === 'OPTIONS' && req.url?.startsWith('/api')) {
                const origin = req.headers.origin;
                
                // Разрешаем preflight для origin 'null' (Figma plugin)
                if (origin === 'null' || origin === '' || !origin) {
                  res.writeHead(204, {
                    'Access-Control-Allow-Origin': 'null',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Figma-Plugin',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Max-Age': '86400',
                    'Vary': 'Origin',
                  });
                  res.end();
                  return;
                }
              }
              next();
            }
          });
        }
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), corsMiddleware()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Используем HTTPS только если явно указано в переменной окружения
    ...(process.env.VITE_USE_HTTPS === 'true' ? {
      https: {
        key: '../ssl/key.pem',
        cert: '../ssl/cert.pem',
      },
    } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false, // Не меняем Origin, чтобы бэкенд видел оригинальный 'null'
        configure: (proxy, _options) => {
          // Обработка входящих запросов
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Сохраняем оригинальный Origin заголовок
            const origin = req.headers.origin;
            if (origin !== undefined) {
              proxyReq.setHeader('Origin', origin);
            }
            // Явно передаем заголовок X-Figma-Plugin, если он есть
            const figmaPluginHeader = req.headers['x-figma-plugin'];
            if (figmaPluginHeader) {
              proxyReq.setHeader('X-Figma-Plugin', figmaPluginHeader);
            }
            // Сохраняем заголовки для preflight запросов
            if (req.method === 'OPTIONS') {
              const acrm = req.headers['access-control-request-method'];
              if (acrm) {
                proxyReq.setHeader('Access-Control-Request-Method', acrm);
              }
              const acrh = req.headers['access-control-request-headers'];
              if (acrh) {
                proxyReq.setHeader('Access-Control-Request-Headers', acrh);
              }
            }
          });
          
          // Обработка ответов от бэкенда - гарантируем передачу CORS заголовков
          // (запасной вариант, если OPTIONS доходит до proxy)
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const origin = req.headers.origin;
            
            // Для OPTIONS запросов с origin 'null' гарантируем правильные заголовки
            if (req.method === 'OPTIONS' && (origin === 'null' || origin === '' || !origin)) {
              // Всегда устанавливаем правильные заголовки для origin 'null'
              proxyRes.headers['access-control-allow-origin'] = 'null';
              proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
              proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Figma-Plugin';
              proxyRes.headers['access-control-allow-credentials'] = 'true';
              proxyRes.headers['access-control-max-age'] = '86400';
              proxyRes.headers['vary'] = 'Origin';
            }
          });
        },
      },
    },
  },
  define: {
    // Передаем переменные окружения в клиент
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || '/api'),
    __CLIENT_URL__: JSON.stringify(
      process.env.VITE_CLIENT_URL || 
      (process.env.VITE_USE_HTTPS === 'true' ? 'https://localhost:5173' : 'http://localhost:5173')
    ),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Vite 7 uses 'baseline-widely-available' as default target
    // which targets Chrome 107+, Edge 107+, Firefox 104+, Safari 16.0+
    target: 'baseline-widely-available',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
