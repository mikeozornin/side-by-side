// Загружаем .env файлы
import './load-env.js';

import { i18n } from './notifications/i18n.js';

function testLocale() {
  console.log('🌐 Testing notification locale system...\n');

  // Показываем текущую локаль
  console.log(`Current locale: ${i18n.getLocale()}`);
  console.log(`ENV NOTIFICATIONS_LOCALE: ${process.env.NOTIFICATIONS_LOCALE || 'not set'}\n`);

  // Тестируем переводы
  console.log('📝 Testing translations:');
  console.log('======================\n');

  const testKeys = [
    'mattermost.providerName',
    'mattermost.webhookNotConfigured',
    'service.providersInitialized',
    'test.title',
    'test.testCompleted'
  ];

  testKeys.forEach(key => {
    const translation = i18n.t(key, { count: 5, error: 'test error', votingId: 'test-123' });
    console.log(`${key}: ${translation}`);
  });

  console.log('\n🔄 Switching to English...');
  i18n.setLocale('en');
  console.log(`New locale: ${i18n.getLocale()}\n`);

  console.log('📝 English translations:');
  console.log('========================\n');

  testKeys.forEach(key => {
    const translation = i18n.t(key, { count: 5, error: 'test error', votingId: 'test-123' });
    console.log(`${key}: ${translation}`);
  });

  console.log('\n✅ Locale test completed!');
}

testLocale();
