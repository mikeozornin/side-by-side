import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { ensureVotingDirectory } from './files.js';
import { logger } from './logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execAsync = promisify(exec);
const DATA_DIR = process.env.DATA_DIR || './data';

// Разрешенные форматы медиафайлов
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.mp4', '.webm', '.mov', '.avi'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo'
];

export interface UploadedImageMeta {
  filePath: string;
  width: number;
  height: number;
  pixelRatio: number;
  mediaType: 'image' | 'video';
}

function parsePixelRatioFromName(fileName: string): number {
  const name = basename(fileName);
  const match = name.match(/@(\d+(?:\.\d+)?)x(\.[a-zA-Z0-9]+)?$/i);
  if (match) {
    const parsed = Number(match[1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

export async function uploadImages(votingId: string, files: File[]): Promise<UploadedImageMeta[]> {
  const votingDir = await ensureVotingDirectory(votingId, DATA_DIR);
  const uploaded: UploadedImageMeta[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Проверка MIME типа
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Неподдерживаемый формат файла: ${file.type}`);
    }

    // Получаем расширение файла
    const extension = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(`Неподдерживаемое расширение файла: ${extension}`);
    }

    // Определяем тип медиафайла
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    // Читаем содержимое файла
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Создаем хэш для имени файла
    const hash = createHash('sha256').update(buffer).digest('hex');
    const fileName = `${hash}${extension}`;
    const filePath = join(votingDir, fileName);

    // Сохраняем файл
    await writeFile(filePath, buffer);
    
    // Пытаемся оптимизировать только изображения
    if (mediaType === 'image') {
      try {
        await optimizeImage(filePath, extension);
      } catch (error) {
        logger.warn(`Не удалось оптимизировать изображение ${fileName}, используем оригинал:`, error);
      }
    }

    // Получаем метаданные
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    
    if (mediaType === 'image') {
      try {
        const metadata = await sharp(filePath).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
        // Приоритет: density/metadata > имя > 1
        // 72 DPI = pixelRatio 1, 144 DPI = pixelRatio 2, и т.д.
        if (metadata.density && metadata.density > 72) {
          pixelRatio = Number(metadata.density) / 72;
        } else {
          pixelRatio = parsePixelRatioFromName(file.name);
        }
      } catch (error) {
        logger.warn(`Не удалось прочитать метаданные изображения ${fileName}:`, error);
        width = 0;
        height = 0;
        pixelRatio = parsePixelRatioFromName(file.name);
      }
    } else {
      // Для видео пока используем pixelRatio из имени файла
      pixelRatio = parsePixelRatioFromName(file.name);
      // TODO: Добавить получение размеров видео через ffprobe
    }

    uploaded.push({ filePath, width, height, pixelRatio, mediaType });
  }

  return uploaded;
}

async function optimizeImage(filePath: string, extension: string): Promise<void> {
  const extension_lower = extension.toLowerCase();
  
  try {
    switch (extension_lower) {
      case '.jpg':
      case '.jpeg':
        // jpegoptim оптимизирует на месте, сохраняя формат
        await execAsync(`jpegoptim --max=85 --strip-all "${filePath}"`);
        break;
      case '.png':
        // pngquant с явным указанием выходного файла для сохранения формата
        await execAsync(`pngquant --force --output "${filePath}" --quality=65-80 "${filePath}"`);
        break;
      case '.webp':
        // cwebp с явным указанием выходного файла
        await execAsync(`cwebp -q 80 "${filePath}" -o "${filePath}"`);
        break;
      case '.avif':
        // avifenc с явным указанием выходного файла
        await execAsync(`avifenc --min 0 --max 63 --speed 4 "${filePath}" "${filePath}"`);
        break;
      default:
        logger.warn(`Оптимизация для ${extension} не поддерживается`);
    }
  } catch (error) {
    // Если оптимизация не удалась, используем оригинал
    throw error;
  }
}
