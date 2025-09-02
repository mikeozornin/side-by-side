import { Hono } from 'hono';
import { getDatabase, saveDatabase } from '../db/init';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { uploadImages } from '../utils/images';

export const votingRoutes = new Hono();

// GET /api/votings - список голосований
votingRoutes.get('/votings', async (c) => {
  try {
    const db = getDatabase();
    
    const votings = db.votings.map(voting => {
      const image1 = db.voting_images.find(img => img.voting_id === voting.id && img.sort_order === 0);
      const image2 = db.voting_images.find(img => img.voting_id === voting.id && img.sort_order === 1);
      const voteCount = db.votes.filter(vote => vote.voting_id === voting.id).length;
      
      return {
        ...voting,
        image1_path: image1?.file_path || '',
        image2_path: image2?.file_path || '',
        vote_count: voteCount
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ votings });
  } catch (error) {
    logger.error('Ошибка получения списка голосований:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// GET /api/votings/:id - детали голосования
votingRoutes.get('/votings/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();
    
    const voting = db.votings.find(v => v.id === id);
    
    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    const image1 = db.voting_images.find(img => img.voting_id === id && img.sort_order === 0);
    const image2 = db.voting_images.find(img => img.voting_id === id && img.sort_order === 1);

    return c.json({ 
      voting: {
        ...voting,
        image1_path: image1?.file_path || '',
        image2_path: image2?.file_path || ''
      }
    });
  } catch (error) {
    logger.error('Ошибка получения голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// POST /api/votings - создание голосования
votingRoutes.post('/votings', async (c) => {
  try {
    const formData = await c.req.formData();
    const title = formData.get('title') as string;
    const image1 = formData.get('image1') as File;
    const image2 = formData.get('image2') as File;

    if (!title || !image1 || !image2) {
      return c.json({ error: 'Необходимо указать название и загрузить два изображения' }, 400);
    }

    // Проверка размера файлов (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (image1.size > maxSize || image2.size > maxSize) {
      return c.json({ error: 'Размер файла не должен превышать 10 МБ' }, 400);
    }

    const votingId = uuidv4();
    const endAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 часа

    // Загрузка и оптимизация изображений
    const imagePaths = await uploadImages(votingId, [image1, image2]);
    
    const db = getDatabase();
    
    // Создание голосования
    db.votings.push({
      id: votingId,
      title,
      created_at: new Date().toISOString(),
      end_at: endAt.toISOString()
    });

    // Сохранение путей к изображениям
    const maxImageId = Math.max(0, ...db.voting_images.map(img => img.id));
    db.voting_images.push(
      { id: maxImageId + 1, voting_id: votingId, file_path: imagePaths[0], sort_order: 0 },
      { id: maxImageId + 2, voting_id: votingId, file_path: imagePaths[1], sort_order: 1 }
    );
    
    await saveDatabase();

    return c.json({ 
      voting: { 
        id: votingId, 
        title, 
        end_at: endAt.toISOString() 
      } 
    });
  } catch (error) {
    logger.error('Ошибка создания голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// POST /api/votings/:id/vote - голосование
votingRoutes.post('/votings/:id/vote', async (c) => {
  try {
    const id = c.req.param('id');
    const { choice } = await c.req.json();

    if (choice !== 0 && choice !== 1) {
      return c.json({ error: 'Неверный выбор' }, 400);
    }

    const db = getDatabase();
    
    // Проверяем, не закончилось ли голосование
    const voting = db.votings.find(v => v.id === id);

    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    if (new Date(voting.end_at) <= new Date()) {
      return c.json({ error: 'Голосование завершено' }, 400);
    }

    // Сохраняем голос
    const maxVoteId = Math.max(0, ...db.votes.map(vote => vote.id));
    db.votes.push({
      id: maxVoteId + 1,
      voting_id: id,
      choice,
      created_at: new Date().toISOString()
    });
    
    await saveDatabase();

    return c.json({ success: true });
  } catch (error) {
    logger.error('Ошибка голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// GET /api/votings/:id/results - результаты голосования
votingRoutes.get('/votings/:id/results', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();
    
    const voting = db.votings.find(v => v.id === id);

    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    // Проверяем, закончилось ли голосование
    const isFinished = new Date(voting.end_at) <= new Date();
    
    if (!isFinished) {
      return c.json({ error: 'Голосование еще не завершено' }, 400);
    }

    const votes = db.votes.filter(vote => vote.voting_id === id);
    const results = [
      { choice: 0, count: votes.filter(v => v.choice === 0).length },
      { choice: 1, count: votes.filter(v => v.choice === 1).length }
    ];

    const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
    
    // Вычисляем проценты
    const percentages = [0, 0];
    if (totalVotes > 0) {
      percentages[0] = Math.round((results.find(r => r.choice === 0)?.count || 0) / totalVotes * 100);
      percentages[1] = Math.round((results.find(r => r.choice === 1)?.count || 0) / totalVotes * 100);
      
      // Добиваем до 100%
      const sum = percentages[0] + percentages[1];
      if (sum < 100) {
        percentages[1] += (100 - sum);
      }
    }

    // Определяем победителя
    const winner = totalVotes === 0 ? null : 
      percentages[0] > percentages[1] ? 0 :
      percentages[1] > percentages[0] ? 1 : 
      'tie'; // ничья

    return c.json({
      totalVotes,
      percentages,
      winner,
      results: results.map(r => ({ choice: r.choice, count: r.count }))
    });
  } catch (error) {
    logger.error('Ошибка получения результатов:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});
