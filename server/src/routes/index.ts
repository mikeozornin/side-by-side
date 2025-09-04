import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { votingRoutes } from './votings.js';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readdirSync, statSync } from 'fs';
import { extname } from 'path';
import { configManager } from '../utils/config.js';

export const router = new Hono();

// Middleware
router.use('*', logger());
router.use('*', cors({
  origin: configManager.getCorsOrigins(),
  credentials: true,
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
  // Serve static files from client dist
  router.get('*', serveStatic({ root: staticConfig.staticPath }));
  // Fallback to index.html for SPA routing
  router.get('*', serveStatic({ path: staticConfig.fallbackPath }));
}
