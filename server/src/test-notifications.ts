// Загружаем .env файлы
import './load-env.js';

import { NotificationService } from './notifications/index.js';
import { logger } from './utils/logger.js';
import { i18n } from './notifications/i18n.js';

async function testNotifications() {
  console.log(`🧪 ${i18n.t('test.title')}\n`);

  try {
    const notificationService = new NotificationService();
    const results = await notificationService.testNotifications();

    console.log(`📊 ${i18n.t('test.results')}`);
    console.log('========================\n');

    if (results.length === 0) {
      console.log(`❌ ${i18n.t('test.noProviders')}`);
      console.log(`💡 ${i18n.t('test.checkEnv')}`);
      console.log(`   ${i18n.t('test.mattermostEnabled')}`);
      console.log(`   ${i18n.t('test.mattermostWebhook')}`);
      console.log(`   ${i18n.t('test.telegramEnabled')}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const provider = result.provider;
      
      console.log(`${index + 1}. ${status} ${provider}`);
      
      if (result.success) {
        console.log(`   ✅ ${i18n.t('test.success')}`);
        successCount++;
      } else {
        console.log(`   ❌ ${i18n.t('test.error', { error: result.error })}`);
        failCount++;
      }
      console.log('');
    });

    console.log(`📈 ${i18n.t('test.summary')}`);
    console.log(`   ✅ ${i18n.t('test.successful', { count: successCount })}`);
    console.log(`   ❌ ${i18n.t('test.errors', { count: failCount })}`);
    console.log(`   📊 ${i18n.t('test.total', { count: results.length })}`);

    if (successCount > 0) {
      console.log(`\n🎉 ${i18n.t('test.testCompleted')}`);
    } else {
      console.log(`\n⚠️  ${i18n.t('test.allProvidersFailed')}`);
    }

  } catch (error) {
    console.error(`💥 ${i18n.t('test.criticalError', { error })}`);
    process.exit(1);
  }
}

// Запускаем тест
testNotifications().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(`💥 ${i18n.t('test.unexpectedError', { error })}`);
  process.exit(1);
});
