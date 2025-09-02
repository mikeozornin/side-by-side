import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { ensureVotingDirectory } from './files';
import { logger } from './logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DATA_DIR = process.env.DATA_DIR || './data';

// Разрешенные форматы изображений
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/avif'
];

export async function uploadImages(votingId: string, files: File[]): Promise<string[]> {
  const votingDir = await ensureVotingDirectory(votingId, DATA_DIR);
  const imagePaths: string[] = [];

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
    
    // Создаем хэш для имени файла
    const hash = createHash('sha256').update(buffer).digest('hex');
    const fileName = `${hash}${extension}`;
    const filePath = join(votingDir, fileName);

    // Сохраняем файл
    await writeFile(filePath, buffer);
    
    // Пытаемся оптимизировать
    try {
      await optimizeImage(filePath, extension);
      logger.info(`Изображение оптимизировано: ${fileName}`);
    } catch (error) {
      logger.warn(`Не удалось оптимизировать изображение ${fileName}, используем оригинал:`, error);
    }

    imagePaths.push(filePath);
  }

  return imagePaths;
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
