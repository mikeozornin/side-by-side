import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { ensureVotingDirectory } from './files.js';
import { logger } from './logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

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
  const uploaded = await uploadImagesSync(votingId, files);

  // Запускаем оптимизацию в фоне (fire-and-forget)
  optimizeImagesAsync(votingId, uploaded).catch(error => {
    logger.error(`Ошибка фоновой оптимизации для голосования ${votingId}:`, error);
  });

  return uploaded;
}

async function uploadImagesSync(votingId: string, files: File[]): Promise<UploadedImageMeta[]> {
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

    // Читаем содержимое файла
    const buffer = Buffer.from(await file.arrayBuffer());

    // Проверяем реальный MIME тип файла по содержимому
    const detectedFileType = await fileTypeFromBuffer(buffer);
    if (!detectedFileType) {
      throw new Error(`Файл "${file.name}" не является допустимым изображением или видео. Файл поврежден или имеет неизвестный формат. Разрешены только: JPG, PNG, WebP, AVIF, MP4, WebM, MOV, AVI.`);
    }
    if (!ALLOWED_MIME_TYPES.includes(detectedFileType.mime)) {
      throw new Error(`Файл "${file.name}" не является допустимым изображением или видео. Обнаружен тип: ${detectedFileType.mime}. Разрешены только: JPG, PNG, WebP, AVIF, MP4, WebM, MOV, AVI.`);
    }

    // Определяем тип медиафайла на основе реального MIME типа
    const mediaType = detectedFileType.mime.startsWith('video/') ? 'video' : 'image';

    // Создаем хэш для имени файла
    const hash = createHash('sha256').update(buffer).digest('hex');
    const fileName = `${hash}${extension}`;
    const filePath = join(votingDir, fileName);

    // Сохраняем файл
    await writeFile(filePath, buffer);

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

async function optimizeImagesAsync(votingId: string, uploadedImages: UploadedImageMeta[]): Promise<void> {
  logger.info(`Запуск фоновой оптимизации для голосования ${votingId}, изображений: ${uploadedImages.length}`);

  const imageFiles = uploadedImages.filter(img => img.mediaType === 'image');

  if (imageFiles.length === 0) {
    logger.info(`Нет изображений для оптимизации в голосовании ${votingId}`);
    return;
  }

  // Оптимизируем изображения параллельно
  const optimizationPromises = imageFiles.map(async (imageMeta) => {
    const extension = extname(imageMeta.filePath).toLowerCase();
    try {
      logger.info(`Оптимизация изображения: ${imageMeta.filePath}`);
      await optimizeImage(imageMeta.filePath, extension);
      logger.info(`Успешно оптимизировано: ${imageMeta.filePath}`);
    } catch (error) {
      logger.warn(`Не удалось оптимизировать изображение ${imageMeta.filePath}, используем оригинал:`, error);
    }
  });

  await Promise.all(optimizationPromises);
  logger.info(`Завершена фоновая оптимизация для голосования ${votingId}`);
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
