// Bun автоматически загружает .env файлы
console.log('🔍 Checking notification environment variables...\n');
console.log('✅ Bun automatically loads .env files\n');

// Проверяем переменные
const envVars = [
  'MATTERMOST_ENABLED',
  'MATTERMOST_WEBHOOK_URL',
  'TELEGRAM_ENABLED',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'NOTIFICATIONS_LOCALE',
  'VOTING_BASE_URL',
  'STORAGE_DRIVER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE'
];

console.log('📋 Environment Variables:');
console.log('========================');
console.log('(Loaded by Bun automatically)\n');

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
console.log(`STORAGE_DRIVER: ${process.env.STORAGE_DRIVER || 'not set (default: local)'}`);
console.log(`S3_FORCE_PATH_STYLE === 'true': ${process.env.S3_FORCE_PATH_STYLE === 'true'}`);

console.log('\n💡 Tips:');
console.log('========');
console.log('1. Make sure .env file exists in the project root');
console.log('2. Set MATTERMOST_ENABLED=true to enable Mattermost');
console.log('3. Set MATTERMOST_WEBHOOK_URL to your webhook URL');
console.log('4. Set STORAGE_DRIVER=s3 to use S3 storage');
console.log('5. For S3, set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY');
console.log('6. Run: npm run test:notifications to test the system');
