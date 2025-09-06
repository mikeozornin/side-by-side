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
  } else if (command === 'add-user-id') {
    try {
      addUserIdColumn();
      removeUserAgentColumn();
      logger.info('Миграция поля user_id завершена');
      process.exit(0);
    } catch (error) {
      logger.error('Ошибка миграции поля user_id:', error);
      process.exit(1);
    }
  } else if (command === 'add-user-id-to-votes') {
    try {
      addUserIdToVotesColumn();
      logger.info('Миграция поля user_id в votes завершена');
      process.exit(0);
    } catch (error) {
      logger.error('Ошибка миграции поля user_id в votes:', error);
      process.exit(1);
    }
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

function addUserIdColumn() {
  try {
    logger.info('Добавляем поле user_id в таблицу votings...');
    
    const db = getDatabase();
    
    // Проверяем, существует ли уже поле user_id
    const tableInfo = db.prepare("PRAGMA table_info(votings)").all() as any[];
    
    const hasUserId = tableInfo.some(col => col.name === 'user_id');
    
    if (!hasUserId) {
      // Добавляем поле user_id как nullable
      db.exec(`
        ALTER TABLE votings ADD COLUMN user_id TEXT REFERENCES users(id);
      `);
      
      logger.info('Поле user_id успешно добавлено в таблицу votings');
    } else {
      logger.info('Поле user_id уже существует в таблице votings');
    }
    
  } catch (error) {
    logger.error('Ошибка при добавлении поля user_id:', error);
    throw error;
  }
}

function removeUserAgentColumn() {
  try {
    logger.info('Удаляем поле user_agent из таблицы sessions...');
    
    const db = getDatabase();
    
    // Проверяем, существует ли поле user_agent
    const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as any[];
    
    const hasUserAgent = tableInfo.some(col => col.name === 'user_agent');
    
    if (hasUserAgent) {
      // SQLite не поддерживает DROP COLUMN напрямую, поэтому пересоздаем таблицу
      db.exec(`
        CREATE TABLE sessions_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          refresh_token_hash TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        INSERT INTO sessions_new (id, user_id, refresh_token_hash, expires_at, created_at)
        SELECT id, user_id, refresh_token_hash, expires_at, created_at FROM sessions;
        
        DROP TABLE sessions;
        
        ALTER TABLE sessions_new RENAME TO sessions;
      `);
      
      logger.info('Поле user_agent успешно удалено из таблицы sessions');
    } else {
      logger.info('Поле user_agent уже отсутствует в таблице sessions');
    }
  } catch (error) {
    logger.error('Ошибка при удалении поля user_agent:', error);
    throw error;
  }
}

function addUserIdToVotesColumn() {
  try {
    logger.info('Добавляем поле user_id в таблицу votes...');
    
    const db = getDatabase();
    
    // Проверяем, существует ли уже поле user_id
    const tableInfo = db.prepare("PRAGMA table_info(votes)").all() as any[];
    
    const hasUserId = tableInfo.some(col => col.name === 'user_id');
    
    if (!hasUserId) {
      // Добавляем поле user_id как nullable
      db.exec(`
        ALTER TABLE votes ADD COLUMN user_id TEXT REFERENCES users(id);
      `);
      
      logger.info('Поле user_id успешно добавлено в таблицу votes');
    } else {
      logger.info('Поле user_id уже существует в таблице votes');
    }
    
  } catch (error) {
    logger.error('Ошибка при добавлении поля user_id в votes:', error);
    throw error;
  }
}

export { migrateData, addIsPublicColumn, addUserIdColumn, removeUserAgentColumn, addUserIdToVotesColumn };
