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
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif', '.mp4', '.webm', '.mov', '.avi'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
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

    // Проверка MIME типа (более гибкая для HEIC файлов)
    const isHeicFile = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !isHeicFile) {
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
    if (!detectedFileType && !isHeicFile) {
      throw new Error(`Файл "${file.name}" не является допустимым изображением или видео. Файл поврежден или имеет неизвестный формат. Разрешены только: JPG, PNG, GIF, WebP, AVIF, HEIC, HEIF, MP4, WebM, MOV, AVI.`);
    }
    if (detectedFileType && !ALLOWED_MIME_TYPES.includes(detectedFileType.mime) && !isHeicFile) {
      throw new Error(`Файл "${file.name}" не является допустимым изображением или видео. Обнаружен тип: ${detectedFileType.mime}. Разрешены только: JPG, PNG, GIF, WebP, AVIF, HEIC, HEIF, MP4, WebM, MOV, AVI.`);
    }

    // Создаем хэш для имени файла
    const hash = createHash('sha256').update(buffer).digest('hex');
    
    // Если это HEIC/HEIF, конвертируем в JPG
    let finalExtension = extension;
    let finalBuffer = buffer;
    let finalMimeType = detectedFileType?.mime || 'image/heic'; // Fallback для HEIC файлов
    
    // Определяем тип медиафайла на основе финального MIME типа (после конвертации)
    const mediaType = finalMimeType.startsWith('video/') ? 'video' : 'image';
    
    if (isHeicFile || detectedFileType?.mime === 'image/heic' || detectedFileType?.mime === 'image/heif') {
      try {
        logger.info(`Converting HEIC/HEIF file ${file.name} to JPG`);
        const sharpInstance = sharp(buffer);
        finalBuffer = await sharpInstance.jpeg({ quality: 90 }).toBuffer();
        finalExtension = '.jpg';
        finalMimeType = 'image/jpeg';
        logger.info(`Successfully converted ${file.name} to JPG`);
      } catch (error) {
        logger.error(`Failed to convert HEIC/HEIF file ${file.name}:`, error);
        throw new Error(`Не удалось конвертировать HEIC файл "${file.name}" в JPG. Возможно, файл поврежден.`);
      }
    }
    
    const fileName = `${hash}${finalExtension}`;
    const filePath = join(votingDir, fileName);

    // Сохраняем файл (конвертированный или оригинальный)
    await writeFile(filePath, finalBuffer);

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
      case '.gif':
        // gifsicle для оптимизации GIF
        await execAsync(`gifsicle --optimize=3 --colors=256 "${filePath}" -o "${filePath}"`);
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
