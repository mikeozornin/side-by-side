import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загружаем .env файлы
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Ищем различные варианты .env файлов
const envFiles = ['.env.development', '.env.local', '.env', '.env.production'];

for (const envFile of envFiles) {
  const envPath = join(projectRoot, envFile);
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`✅ Loaded environment from ${envFile}`);
      break;
    }
  } catch (error) {
    // Игнорируем ошибки загрузки файлов
  }
}
