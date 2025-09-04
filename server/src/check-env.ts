import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Загружаем .env файл
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

console.log('🔍 Checking notification environment variables...\n');

// Ищем различные варианты .env файлов
const envFiles = [
  '.env.development',
  '.env.local',
  '.env',
  '.env.production'
];

let envLoaded = false;
let loadedFile = '';

for (const envFile of envFiles) {
  const envPath = join(projectRoot, envFile);
  console.log(`Looking for ${envFile} at: ${envPath}`);
  
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`✅ ${envFile} loaded successfully\n`);
      envLoaded = true;
      loadedFile = envFile;
      break;
    }
  } catch (error) {
    console.log(`❌ Could not load ${envFile}\n`);
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env files found, using system environment\n');
}

// Проверяем переменные
const envVars = [
  'MATTERMOST_ENABLED',
  'MATTERMOST_WEBHOOK_URL',
  'TELEGRAM_ENABLED',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'NOTIFICATIONS_LOCALE',
  'VOTING_BASE_URL'
];

console.log('📋 Environment Variables:');
console.log('========================');
if (envLoaded) {
  console.log(`(Loaded from: ${loadedFile})\n`);
} else {
  console.log('(Using system environment)\n');
}

envVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? (varName.includes('TOKEN') || varName.includes('URL') ? '***set***' : value) : 'not set';
  
  console.log(`${status} ${varName}: ${displayValue}`);
});

console.log('\n🔧 Parsed Values:');
console.log('================\n');

console.log(`MATTERMOST_ENABLED === 'true': ${process.env.MATTERMOST_ENABLED === 'true'}`);
console.log(`TELEGRAM_ENABLED === 'true': ${process.env.TELEGRAM_ENABLED === 'true'}`);
console.log(`NOTIFICATIONS_LOCALE: ${process.env.NOTIFICATIONS_LOCALE || 'not set (default: ru)'}`);

console.log('\n💡 Tips:');
console.log('========');
console.log('1. Make sure .env file exists in the project root');
console.log('2. Set MATTERMOST_ENABLED=true to enable Mattermost');
console.log('3. Set MATTERMOST_WEBHOOK_URL to your webhook URL');
console.log('4. Run: npm run test:notifications to test the system');
