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
    const contentType = c.req.header('Content-Type') || '';

    let title: string;
    let image1: string | File;
    let image2: string | File;
    let durationHours: number;

    if (contentType.includes('application/json')) {
      // Handle JSON request with base64 images
      const jsonData = await c.req.json();
      title = jsonData.title;
      image1 = jsonData.image1; // base64 string
      image2 = jsonData.image2; // base64 string
      durationHours = parseFloat(jsonData.duration) || 24;
    } else {
      // Handle FormData request
      const formData = await c.req.formData();
      title = formData.get('title') as string;
      image1 = formData.get('image1') as File;
      image2 = formData.get('image2') as File;
      durationHours = parseFloat(formData.get('duration') as string) || 24;
    }

    if (!title || !image1 || !image2) {
      return c.json({ error: 'Необходимо указать название и загрузить два медиафайла' }, 400);
    }

    const endAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    // Создание голосования
    const votingId = await createVoting({
      title,
      created_at: new Date().toISOString(),
      end_at: endAt.toISOString(),
      duration_hours: durationHours
    });

    let uploaded: any[] = [];

    if (contentType.includes('application/json')) {
      // Handle JSON uploads that may contain base64, data URLs, or hex strings
      const decodeImage = (input: string, fallbackName: string) => {
        try {
          let data = input.trim();
          let mime = 'image/png';
          let extension = '.png';
          // data URL handling
          const dataUrlMatch = data.match(/^data:(.*?);base64,(.*)$/i);
          if (dataUrlMatch) {
            mime = dataUrlMatch[1] || 'image/png';
            data = dataUrlMatch[2] || '';
            if (mime.includes('jpeg')) extension = '.jpg';
            else if (mime.includes('webp')) extension = '.webp';
            else if (mime.includes('avif')) extension = '.avif';
            else if (mime.includes('png')) extension = '.png';
          }

          let buffer: Buffer | null = null;
          // Try base64 first
          try {
            buffer = Buffer.from(data, 'base64');
            // Heuristic: if base64 decoding fails it often results in empty or very small buffer
            if (!buffer || buffer.length < 10) buffer = null;
          } catch {
            buffer = null;
          }

          // If not base64, try hex
          if (!buffer) {
            const isHex = /^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0;
            if (isHex) {
              buffer = Buffer.from(data, 'hex');
            }
          }

          if (!buffer) {
            throw new Error('Unsupported image encoding');
          }

          // Best-effort content-based extension
          if (buffer.length >= 12) {
            const sig = buffer.subarray(0, 12);
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47) {
              extension = '.png';
              mime = 'image/png';
            } else if (sig[0] === 0xFF && sig[1] === 0xD8) {
              extension = '.jpg';
              mime = 'image/jpeg';
            } else if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 && buffer.subarray(8, 12).toString() === 'WEBP') {
              extension = '.webp';
              mime = 'image/webp';
            } else if (sig.toString('ascii', 4, 8) === 'ftyp') {
              // Could be MP4 or other ISO base media format. Leave mime as-is unless misdetected.
            }
          }

          const fileName = `${fallbackName}@2x${extension}`;
          const u8 = new Uint8Array(buffer);
          // In Node >= 18, File is available (undici); use it to integrate with uploadImages
          const blob = new Blob([u8], { type: mime });
          const file = new File([blob], fileName, { type: mime });
          return file;
        } catch (error) {
          throw new Error('Failed to decode image payload');
        }
      };

      const image1File = decodeImage(image1 as string, 'image1');
      const image2File = decodeImage(image2 as string, 'image2');

      uploaded = await uploadImages(votingId, [image1File, image2File]);
    } else {
      // Handle file uploads
      const maxSize = 20 * 1024 * 1024;
      const image1File = image1 as File;
      const image2File = image2 as File;

      if (image1File.size > maxSize || image2File.size > maxSize) {
        return c.json({ error: 'Размер файла не должен превышать 20 МБ' }, 400);
      }

      uploaded = await uploadImages(votingId, [image1File, image2File]);
    }

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
