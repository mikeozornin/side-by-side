import { initDatabase, closeDatabase } from './init.js';
import { getAllVotings, getVotingOptions, getVotesForVoting } from './queries.js';
import { logger } from '../utils/logger.js';

function checkData() {
  try {
    logger.info('Проверяем данные в SQLite базе...');
    
    initDatabase();
    
    const votings = getAllVotings();
    logger.info(`Найдено голосований: ${votings.length}`);
    
    for (const voting of votings) {
      logger.info(`- ${voting.title} (${voting.id})`);
      
      const images = getVotingOptions(voting.id);
      logger.info(`  Вариантов: ${images.length}`);
      
      const votes = getVotesForVoting(voting.id);
      logger.info(`  Голосов: ${votes.length}`);
    }
    
    logger.info('Проверка завершена');
    
  } catch (error) {
    logger.error('Ошибка проверки:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

try {
  checkData();
  logger.info('Проверка завершена успешно');
  process.exit(0);
} catch (error) {
  logger.error('Ошибка проверки:', error);
  process.exit(1);
}
