import { readFile } from 'fs/promises';
import { initDatabase, closeDatabase } from './init.js';
import { createVoting, createVotingImages, createVote } from './queries.js';
import { logger } from '../utils/logger.js';

interface JsonDatabase {
  votings: Array<{
    id: string;
    title: string;
    created_at: string;
    end_at: string;
  }>;
  voting_images: Array<{
    id: number;
    voting_id: string;
    file_path: string;
    sort_order: number;
  }>;
  votes: Array<{
    id: number;
    voting_id: string;
    choice: number;
    created_at: string;
  }>;
}

async function migrateData() {
  try {
    logger.info('Начинаем миграцию данных из JSON в SQLite...');
    
    // Инициализируем SQLite базу данных
    await initDatabase();
    
    // Читаем JSON файл
    const jsonData = await readFile('./data.json', 'utf-8');
    const data: JsonDatabase = JSON.parse(jsonData);
    
    logger.info(`Найдено голосований: ${data.votings.length}`);
    logger.info(`Найдено изображений: ${data.voting_images.length}`);
    logger.info(`Найдено голосов: ${data.votes.length}`);
    
    // Создаем маппинг старых ID на новые
    const idMapping: Record<string, string> = {};
    
    // Мигрируем голосования
    for (const voting of data.votings) {
      const { id: oldId, ...votingData } = voting;
      const newId = await createVoting(votingData);
      idMapping[oldId] = newId;
      logger.info(`Мигрировано голосование: ${voting.title} (${oldId} -> ${newId})`);
    }
    
    // Мигрируем изображения
    for (const image of data.voting_images) {
      const newVotingId = idMapping[image.voting_id];
      if (newVotingId) {
        await createVotingImages([{
          voting_id: newVotingId,
          file_path: image.file_path,
          sort_order: image.sort_order
        }]);
      }
    }
    logger.info('Мигрированы все изображения');
    
    // Мигрируем голоса
    for (const vote of data.votes) {
      const newVotingId = idMapping[vote.voting_id];
      if (newVotingId) {
        await createVote({
          voting_id: newVotingId,
          choice: vote.choice,
          created_at: vote.created_at
        });
      }
    }
    logger.info('Мигрированы все голоса');
    
    logger.info('Миграция завершена успешно!');
    
  } catch (error) {
    logger.error('Ошибка миграции:', error);
    throw error;
  } finally {
    closeDatabase();
  }
}

// Запускаем миграцию, если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData()
    .then(() => {
      logger.info('Миграция завершена');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Ошибка миграции:', error);
      process.exit(1);
    });
}

export { migrateData };
