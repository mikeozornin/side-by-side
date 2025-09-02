import { initDatabase, closeDatabase } from './init';
import { getAllVotings, getVotingImages, getVotesForVoting } from './queries';
import { logger } from '../utils/logger';

async function checkData() {
  try {
    logger.info('Проверяем данные в SQLite базе...');
    
    await initDatabase();
    
    const votings = await getAllVotings();
    logger.info(`Найдено голосований: ${votings.length}`);
    
    for (const voting of votings) {
      logger.info(`- ${voting.title} (${voting.id})`);
      
      const images = await getVotingImages(voting.id);
      logger.info(`  Изображений: ${images.length}`);
      
      const votes = await getVotesForVoting(voting.id);
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

checkData()
  .then(() => {
    logger.info('Проверка завершена успешно');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Ошибка проверки:', error);
    process.exit(1);
  });
