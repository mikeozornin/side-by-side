import { readFile } from 'fs/promises';
import { initDatabase, closeDatabase, getDatabase } from './init.js';
import { createVoting, createVotingOptions, createVote } from './queries.js';
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
      const newId = createVoting({
        ...votingData,
        duration_hours: 24, // Значение по умолчанию для старых данных
        is_public: true // Значение по умолчанию для старых данных
      });
      idMapping[oldId] = newId;
      logger.info(`Мигрировано голосование: ${voting.title} (${oldId} -> ${newId})`);
    }
    
    // Мигрируем изображения
    for (const image of data.voting_images) {
      const newVotingId = idMapping[image.voting_id];
      if (newVotingId) {
        createVotingOptions([{
          voting_id: newVotingId,
          file_path: image.file_path,
          sort_order: image.sort_order,
          pixel_ratio: 1, // Значение по умолчанию
          width: 0, // Значение по умолчанию
          height: 0, // Значение по умолчанию
          media_type: 'image' // Значение по умолчанию
        }]);
      }
    }
    logger.info('Мигрированы все изображения');
    
    // Мигрируем голоса
    for (const vote of data.votes) {
      const newVotingId = idMapping[vote.voting_id];
      if (newVotingId) {
        createVote({
          voting_id: newVotingId,
          option_id: vote.choice,
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

function addIsPublicColumn() {
  try {
    logger.info('Добавляем поле is_public в таблицу votings...');
    
    const db = getDatabase();
    
    // Проверяем, существует ли уже поле is_public
    const tableInfo = db.prepare("PRAGMA table_info(votings)").all() as any[];
    
    const hasIsPublic = tableInfo.some(col => col.name === 'is_public');
    
    if (!hasIsPublic) {
      // Добавляем поле is_public со значением по умолчанию true
      db.exec(`
        ALTER TABLE votings ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 1;
      `);
      
      logger.info('Поле is_public успешно добавлено в таблицу votings');
    } else {
      logger.info('Поле is_public уже существует в таблице votings');
    }
    
  } catch (error) {
    logger.error('Ошибка при добавлении поля is_public:', error);
    throw error;
  }
}

// Запускаем миграцию, если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'add-is-public') {
    addIsPublicColumn()
      .then(() => {
        logger.info('Миграция поля is_public завершена');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Ошибка миграции поля is_public:', error);
        process.exit(1);
      });
  } else {
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
}

export { migrateData, addIsPublicColumn };
