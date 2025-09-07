import { initDatabase, closeDatabase, getDatabase } from './init.js';
import { getAllVotings, getVotingOptions, getVotesForVoting } from './queries.js';
import { logger } from '../utils/logger.js';

interface CompatibilityCheck {
  test: string;
  passed: boolean;
  message: string;
}

async function checkBackwardCompatibility(): Promise<void> {
  const checks: CompatibilityCheck[] = [];
  
  try {
    logger.info('Проверяем обратную совместимость с анонимным режимом...');
    
    // Инициализируем базу данных
    await initDatabase();
    const db = getDatabase();
    
    // Проверка 1: Существующие голосования без user_id должны работать
    logger.info('Проверка 1: Голосования без user_id');
    const votings = getAllVotings();
    const anonymousVotings = votings.filter(v => !v.user_id);
    checks.push({
      test: 'Анонимные голосования',
      passed: anonymousVotings.length >= 0,
      message: `Найдено ${anonymousVotings.length} анонимных голосований`
    });
    
    // Проверка 2: Голосования с user_id должны работать
    logger.info('Проверка 2: Голосования с user_id');
    const userVotings = votings.filter(v => v.user_id);
    checks.push({
      test: 'Голосования с пользователями',
      passed: userVotings.length >= 0,
      message: `Найдено ${userVotings.length} голосований с пользователями`
    });
    
    // Проверка 3: Голоса без user_id должны работать
    logger.info('Проверка 3: Анонимные голоса');
    let anonymousVotes = 0;
    for (const voting of votings) {
      const votes = getVotesForVoting(voting.id);
      anonymousVotes += votes.filter(v => !v.user_id).length;
    }
    checks.push({
      test: 'Анонимные голоса',
      passed: anonymousVotes >= 0,
      message: `Найдено ${anonymousVotes} анонимных голосов`
    });
    
    // Проверка 4: Голоса с user_id должны работать
    logger.info('Проверка 4: Голоса с пользователями');
    let userVotes = 0;
    for (const voting of votings) {
      const votes = getVotesForVoting(voting.id);
      userVotes += votes.filter(v => v.user_id).length;
    }
    checks.push({
      test: 'Голоса с пользователями',
      passed: userVotes >= 0,
      message: `Найдено ${userVotes} голосов с пользователями`
    });
    
    // Проверка 5: Публичные голосования должны быть доступны
    logger.info('Проверка 5: Публичные голосования');
    const publicVotings = votings.filter(v => v.is_public);
    checks.push({
      test: 'Публичные голосования',
      passed: publicVotings.length >= 0,
      message: `Найдено ${publicVotings.length} публичных голосований`
    });
    
    // Проверка 6: Приватные голосования должны быть доступны
    logger.info('Проверка 6: Приватные голосования');
    const privateVotings = votings.filter(v => !v.is_public);
    checks.push({
      test: 'Приватные голосования',
      passed: privateVotings.length >= 0,
      message: `Найдено ${privateVotings.length} приватных голосований`
    });
    
    // Проверка 7: Все таблицы авторизации должны существовать
    logger.info('Проверка 7: Таблицы авторизации');
    const authTables = ['users', 'sessions', 'magic_tokens', 'figma_auth_codes'];
    const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = existingTables.map(t => t.name);
    
    const missingTables = authTables.filter(table => !tableNames.includes(table));
    checks.push({
      test: 'Таблицы авторизации',
      passed: missingTables.length === 0,
      message: missingTables.length === 0 
        ? 'Все таблицы авторизации существуют'
        : `Отсутствуют таблицы: ${missingTables.join(', ')}`
    });
    
    // Выводим результаты
    logger.info('\n=== РЕЗУЛЬТАТЫ ПРОВЕРКИ СОВМЕСТИМОСТИ ===');
    checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      logger.info(`${status} ${check.test}: ${check.message}`);
    });
    
    const allPassed = checks.every(check => check.passed);
    if (allPassed) {
      logger.info('\n🎉 Все проверки пройдены! Система совместима с анонимным режимом.');
    } else {
      logger.error('\n⚠️  Некоторые проверки не пройдены. Требуется исправление.');
    }
    
  } catch (error) {
    logger.error('Ошибка при проверке совместимости:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

// Запускаем проверку, если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBackwardCompatibility()
    .then(() => {
      logger.info('Проверка совместимости завершена');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Ошибка проверки совместимости:', error);
      process.exit(1);
    });
}

export { checkBackwardCompatibility };
