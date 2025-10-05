import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { votingRoutes } from './votings.js';
import { authRoutes } from './auth.js';
import { webPushRoutes } from './webPush.js';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { readdirSync, statSync } from 'fs';
import { extname } from 'path';
import { configManager } from '../utils/config.js';

export const router = new Hono();

// Health check endpoint (before any middleware to avoid CORS issues)
router.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware
router.use('*', logger());

// Explicit OPTIONS handler BEFORE cors to ensure preflight gets correct headers
router.options('*', async (c) => {
  const origin = c.req.header('Origin');
  const method = c.req.method;
  const acrh = c.req.header('Access-Control-Request-Headers') || '';
  const acrhLower = acrh.toLowerCase();
  const userAgent = c.req.header('User-Agent') || '';

  // Handle null/empty origin preflight
  if (origin === 'null' || origin === '') {
    const hasFigmaUserAgent = userAgent.includes('Figma');
    const requestsFigmaHeader = acrhLower.split(',').map((s) => s.trim()).includes('x-figma-plugin');
    
    // Разрешаем для Figma плагина
    if (hasFigmaUserAgent && requestsFigmaHeader) {
      return c.body(null, 204, {
        'Access-Control-Allow-Origin': 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Figma-Plugin',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      });
    }
    // Иначе запрещаем пустой/null origin
    return c.text('Forbidden', 403);
  }

  // Fallback: allow known origins
  if (origin) {
    const allowedOrigins = configManager.getCorsOrigins();
    if (allowedOrigins.includes(origin)) {
      return c.body(null, 204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Figma-Plugin',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      });
    }
  }

  return c.text('Forbidden', 403);
});

router.use('*', cors({
  origin: (origin, c) => {
    // Skip CORS check for health endpoint
    const pathname = new URL(c.req.url).pathname;
    if (pathname === '/health') {
      return origin || '*';
    }
    
    // console.log(`CORS Origin check: origin="${origin}", method="${c?.req?.method}"`);
    
    // Специальная обработка для null/empty origin
    if (origin === 'null' || origin === '') {
      // Проверяем специальный заголовок Figma плагина
      const figmaPluginHeader = c?.req?.header('X-Figma-Plugin');
      const userAgent = c?.req?.header('User-Agent');
      const accessControlRequestHeaders = c?.req?.header('Access-Control-Request-Headers');
      
      // console.log(`Null/empty origin request details:`, {
      //   method: c?.req?.method,
      //   origin: origin,
      //   userAgent: userAgent,
      //   figmaPluginHeader: figmaPluginHeader,
      //   accessControlRequestHeaders: accessControlRequestHeaders,
      //   allHeaders: Object.fromEntries(c?.req?.raw?.headers?.entries() || [])
      // });
      
      // Для preflight запросов проверяем заголовки в Access-Control-Request-Headers
      const isPreflight = c?.req?.method === 'OPTIONS';
      const hasFigmaHeader = figmaPluginHeader === 'SideBySide/1.0' || 
        (isPreflight && accessControlRequestHeaders?.includes('X-Figma-Plugin'));
      const hasFigmaUserAgent = userAgent && userAgent.includes('Figma');
      
      // Разрешаем null/empty origin для Figma плагина
      if (hasFigmaHeader && hasFigmaUserAgent) {
        console.log(`✅ Valid Figma plugin CORS request - UA: "${userAgent}", Header: "${figmaPluginHeader}", Preflight: ${isPreflight}`);
        return 'null';
      }
      // Иначе запрещаем пустой/null origin
      console.warn(`Blocked CORS request with ${origin === 'null' ? 'null' : 'empty'} origin:`, {
        userAgent: userAgent,
        figmaPluginHeader: figmaPluginHeader,
        isPreflight: isPreflight,
        accessControlRequestHeaders: accessControlRequestHeaders
      });
      return undefined;
    }
    
    // Используем стандартную функцию проверки для остальных origins
    return configManager.getCorsOriginFunction()(origin, c);
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Figma-Plugin'],
}));

// API routes
router.route('/api', votingRoutes);
router.route('/api/auth', authRoutes);
router.route('/api/web-push', webPushRoutes);

// Serve images
router.get('/api/images/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');

    // 🛡️ ЗАЩИТА ОТ PATH TRAVERSAL
    // 1. Декодируем URL
    const decodedFilename = decodeURIComponent(filename);

    // 2. Проверяем на path traversal паттерны
    if (decodedFilename.includes('..') || decodedFilename.includes('/') || decodedFilename.includes('\\')) {
      console.warn(`[SECURITY] Path traversal attempt detected: ${filename}`);
      return c.text('Invalid filename', 400);
    }

    // 3. Проверяем, что имя файла содержит только безопасные символы
    const safeFilenameRegex = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
    if (!safeFilenameRegex.test(decodedFilename)) {
      console.warn(`[SECURITY] Invalid filename format: ${decodedFilename}`);
      return c.text('Invalid filename format', 400);
    }

    // 4. Проверяем расширение файла - изображения и видео
    const ext = extname(decodedFilename).toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mov', '.avi'];
    if (!allowedExtensions.includes(ext)) {
      console.warn(`[SECURITY] Non-media file access attempt: ${decodedFilename}`);
      return c.text('Only image and video files are allowed', 403);
    }

    // 5. Используем storage driver для получения файла
    const { createStorageFromEnv } = await import('../storage/index.js');
    const storage = createStorageFromEnv();

    try {
      const stream = await storage.getObjectStream(decodedFilename);
      const headers = await storage.getObjectHeaders(decodedFilename);

      // Определяем Content-Type из метаданных или по расширению
      let contentType = headers['Content-Type'];
      if (!contentType) {
        contentType = 'image/jpeg'; // default
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.avif') contentType = 'image/avif';
        else if (ext === '.mp4') contentType = 'video/mp4';
        else if (ext === '.webm') contentType = 'video/webm';
        else if (ext === '.mov') contentType = 'video/quicktime';
        else if (ext === '.avi') contentType = 'video/x-msvideo';
      }

      const responseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': headers['Cache-Control'] || 'public, max-age=31536000',
      };

      // Добавляем дополнительные заголовки если есть
      if (headers['Content-Length']) responseHeaders['Content-Length'] = headers['Content-Length'];
      if (headers['Last-Modified']) responseHeaders['Last-Modified'] = headers['Last-Modified'];
      if (headers['ETag']) responseHeaders['ETag'] = headers['ETag'];

      return new Response(stream, {
        headers: responseHeaders,
      });
    } catch (storageError) {
      console.warn(`File not found in storage: ${decodedFilename}`, storageError);
      return c.text('File not found', 404);
    }
  } catch (error) {
    console.error('Error serving image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.text(`Error serving image: ${errorMessage}`, 500);
  }
});

// Serve static files in production
const staticConfig = configManager.getStaticConfig();
if (staticConfig.serveStatic) {
  // Serve static files using Bun's built-in file serving
  router.get('*', async (c) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    
    // Try to serve static file
    try {
      const filePath = join(staticConfig.staticPath, pathname);
      const file = Bun.file(filePath);
      
      if (await file.exists()) {
        return new Response(file);
      }
    } catch (error) {
      // File not found, continue to fallback
    }
    
    // Fallback to index.html for SPA routing
    try {
      const fallbackFile = Bun.file(staticConfig.fallbackPath);
      if (await fallbackFile.exists()) {
        return new Response(fallbackFile);
      }
    } catch (error) {
      // Fallback not found
    }
    
    return c.text('Not Found', 404);
  });
}
