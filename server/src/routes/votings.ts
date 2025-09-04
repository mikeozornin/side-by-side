import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { uploadImages } from '../utils/images.js';
import { NotificationService } from '../notifications/index.js';
import { 
  createVoting, 
  getVoting, 
  getAllVotings, 
  createVotingImages, 
  getVotingImages, 
  createVote, 
  getVotesForVoting,
  getVoteCountForVoting 
} from '../db/queries.js';

export const votingRoutes = new Hono();

// Инициализируем сервис уведомлений
const notificationService = new NotificationService();

// GET /api/votings - список голосований
votingRoutes.get('/votings', async (c) => {
  try {
    const votings = await getAllVotings();
    
    const votingsWithImages = await Promise.all(
      votings.map(async (voting) => {
        const images = await getVotingImages(voting.id);
        const voteCount = await getVoteCountForVoting(voting.id);
        
        const image1 = images.find(img => img.sort_order === 0);
        const image2 = images.find(img => img.sort_order === 1);
        
        return {
          ...voting,
          image1_path: image1?.file_path || '',
          image1_pixel_ratio: image1?.pixel_ratio ?? 1,
          image1_width: image1?.width ?? 0,
          image1_height: image1?.height ?? 0,
          image1_media_type: image1?.media_type ?? 'image',
          image2_path: image2?.file_path || '',
          image2_pixel_ratio: image2?.pixel_ratio ?? 1,
          image2_width: image2?.width ?? 0,
          image2_height: image2?.height ?? 0,
          image2_media_type: image2?.media_type ?? 'image',
          vote_count: voteCount
        };
      })
    );

    return c.json({ votings: votingsWithImages });
  } catch (error) {
    logger.error('Ошибка получения списка голосований:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// GET /api/votings/:id - детали голосования
votingRoutes.get('/votings/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const voting = await getVoting(id);
    
    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    const images = await getVotingImages(id);
    const image1 = images.find(img => img.sort_order === 0);
    const image2 = images.find(img => img.sort_order === 1);

    return c.json({ 
      voting: {
        ...voting,
        image1_path: image1?.file_path || '',
        image1_pixel_ratio: image1?.pixel_ratio ?? 1,
        image1_width: image1?.width ?? 0,
        image1_height: image1?.height ?? 0,
        image1_media_type: image1?.media_type ?? 'image',
        image2_path: image2?.file_path || '',
        image2_pixel_ratio: image2?.pixel_ratio ?? 1,
        image2_width: image2?.width ?? 0,
        image2_height: image2?.height ?? 0,
        image2_media_type: image2?.media_type ?? 'image'
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
    const durationHours = parseFloat(formData.get('duration') as string) || 24;

    if (!title || !image1 || !image2) {
      return c.json({ error: 'Необходимо указать название и загрузить два медиафайла' }, 400);
    }

    // Проверка размера файлов (20MB)
    const maxSize = 20 * 1024 * 1024;
    if (image1.size > maxSize || image2.size > maxSize) {
      return c.json({ error: 'Размер файла не должен превышать 20 МБ' }, 400);
    }

    const endAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    // Создание голосования
    const votingId = await createVoting({
      title,
      created_at: new Date().toISOString(),
      end_at: endAt.toISOString(),
      duration_hours: durationHours
    });

    // Загрузка и оптимизация изображений
    const uploaded = await uploadImages(votingId, [image1, image2]);

    // Сохранение путей и метаданных к медиафайлам
    await createVotingImages([
      { voting_id: votingId, file_path: uploaded[0].filePath, sort_order: 0, pixel_ratio: uploaded[0].pixelRatio, width: uploaded[0].width, height: uploaded[0].height, media_type: uploaded[0].mediaType },
      { voting_id: votingId, file_path: uploaded[1].filePath, sort_order: 1, pixel_ratio: uploaded[1].pixelRatio, width: uploaded[1].width, height: uploaded[1].height, media_type: uploaded[1].mediaType }
    ]);

    // Отправляем уведомление асинхронно (не блокируем ответ)
    notificationService.sendVotingCreatedNotification(votingId, title).catch(error => {
      logger.error('Error sending notification:', error);
    });

    return c.json({ 
      voting: { 
        id: votingId, 
        title, 
        end_at: endAt.toISOString(),
        duration_hours: durationHours
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

    // Проверяем, не закончилось ли голосование
    const voting = await getVoting(id);

    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    if (new Date(voting.end_at) <= new Date()) {
      return c.json({ error: 'Голосование завершено' }, 400);
    }

    // Сохраняем голос
    await createVote({
      voting_id: id,
      choice,
      created_at: new Date().toISOString()
    });

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
    
    const voting = await getVoting(id);

    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    // Проверяем, закончилось ли голосование
    const isFinished = new Date(voting.end_at) <= new Date();
    
    if (!isFinished) {
      return c.json({ error: 'Голосование еще не завершено' }, 400);
    }

    const votes = await getVotesForVoting(id);
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
