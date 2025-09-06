import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { votingRoutes } from './votings.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { extname } from 'path';
import { configManager } from '../utils/config.js';

export const router = new Hono();

// Middleware
router.use('*', logger());

// Explicit OPTIONS handler BEFORE cors to ensure preflight gets correct headers
router.options('*', async (c) => {
  const origin = c.req.header('Origin');
  const method = c.req.method;
  const acrh = c.req.header('Access-Control-Request-Headers') || '';
  const acrhLower = acrh.toLowerCase();
  const userAgent = c.req.header('User-Agent') || '';

  // Handle Figma null origin preflight
  if (origin === 'null') {
    const hasFigmaUserAgent = userAgent.includes('Figma');
    const requestsFigmaHeader = acrhLower.split(',').map((s) => s.trim()).includes('x-figma-plugin');
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
    console.log(`CORS Origin check: origin="${origin}", method="${c?.req?.method}"`);
    
    // Специальная обработка для null origin (Figma плагин)
    if (origin === 'null') {
      // Проверяем специальный заголовок Figma плагина
      const figmaPluginHeader = c?.req?.header('X-Figma-Plugin');
      const userAgent = c?.req?.header('User-Agent');
      const accessControlRequestHeaders = c?.req?.header('Access-Control-Request-Headers');
      
      console.log(`Null origin request details:`, {
        method: c?.req?.method,
        userAgent: userAgent,
        figmaPluginHeader: figmaPluginHeader,
        accessControlRequestHeaders: accessControlRequestHeaders,
        allHeaders: Object.fromEntries(c?.req?.raw?.headers?.entries() || [])
      });
      
      // Для preflight запросов проверяем заголовки в Access-Control-Request-Headers
      const isPreflight = c?.req?.method === 'OPTIONS';
      const hasFigmaHeader = figmaPluginHeader === 'SideBySide/1.0' || 
        (isPreflight && accessControlRequestHeaders?.includes('X-Figma-Plugin'));
      const hasFigmaUserAgent = userAgent && userAgent.includes('Figma');
      
      if (hasFigmaHeader && hasFigmaUserAgent) {
        console.log(`✅ Valid Figma plugin CORS request - UA: "${userAgent}", Header: "${figmaPluginHeader}", Preflight: ${isPreflight}`);
        return 'null';
      }
      
      console.warn(`Blocked CORS request with null origin:`, {
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

// Serve images
router.get('/api/images/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const dataDir = process.env.DATA_DIR || './data';
    
    // Ищем файл во всех подпапках data/
    const findFile = (dir: string, targetFile: string): string | null => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            const found = findFile(fullPath, targetFile);
            if (found) return found;
          } else if (item === targetFile) {
            return fullPath;
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
      return null;
    };
    
    const filePath = findFile(dataDir, filename);
    
    if (!filePath) {
      return c.text('File not found', 404);
    }
    
    const fileBuffer = await readFile(filePath);
    const ext = extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.avif') contentType = 'image/avif';
    
    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
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
