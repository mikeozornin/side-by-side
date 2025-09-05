import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { uploadImages } from '../utils/images.js';
import { NotificationService } from '../notifications/index.js';
import { createVotingLimiter, createVotingHourlyLimiter } from '../utils/rateLimit.js';
import { 
  createVoting, 
  getVoting, 
  getAllVotings,
  getPublicVotings, 
  createVotingOptions, 
  getVotingOptions, 
  createVote,
  getVoteCounts,
  getVoteCountForVoting,
  VotingOption
} from '../db/queries.js';

export const votingRoutes = new Hono();

// Инициализируем сервис уведомлений
const notificationService = new NotificationService();

// GET /api/votings - список публичных голосований
votingRoutes.get('/votings', async (c) => {
  try {
    const votings = await getPublicVotings();
    
    const votingsWithOptions = await Promise.all(
      votings.map(async (voting) => {
        const options = await getVotingOptions(voting.id);
        const voteCount = await getVoteCountForVoting(voting.id);
        
        return {
          ...voting,
          options,
          vote_count: voteCount
        };
      })
    );

    return c.json({ votings: votingsWithOptions });
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

    const options = await getVotingOptions(id);

    return c.json({ 
      voting: {
        ...voting,
        options
      }
    });
  } catch (error) {
    logger.error('Ошибка получения голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// POST /api/votings - создание голосования
votingRoutes.post('/votings', createVotingLimiter, createVotingHourlyLimiter, async (c) => {
  try {
    const contentType = c.req.header('Content-Type') || '';

    let title: string;
    let images: (string | File)[] = [];
    let durationHours: number;
    let pixelRatios: number[] = [];
    let isPublic: boolean = true; // Default to public

    if (contentType.includes('application/json')) {
      const jsonData = await c.req.json();
      title = jsonData.title;
      images = jsonData.images || []; // Expect an array of base64 strings
      durationHours = parseFloat(jsonData.duration) || 24;
      pixelRatios = jsonData.pixelRatios || []; // Expect an array of pixel ratios
      isPublic = jsonData.isPublic !== false; // Default to true if not specified
    } else {
      const formData = await c.req.formData();
      title = formData.get('title') as string;
      images = formData.getAll('images') as File[];
      durationHours = parseFloat(formData.get('duration') as string) || 24;
      const isPublicStr = formData.get('isPublic') as string;
      isPublic = isPublicStr !== 'false'; // Default to true if not specified
    }

    if (!title || !images || images.length < 2) {
      return c.json({ error: 'Необходимо указать название и загрузить от 2 до 10 медиафайлов' }, 400);
    }

    if (images.length > 10) {
      return c.json({ error: 'Можно загрузить не более 10 медиафайлов' }, 400);
    }

    const endAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const votingId = await createVoting({
      title,
      created_at: new Date().toISOString(),
      end_at: endAt.toISOString(),
      duration_hours: durationHours,
      is_public: isPublic
    });

    let uploaded: any[] = [];
    let filesToUpload: File[] = [];

    if (contentType.includes('application/json')) {
      // Handle JSON uploads that may contain base64, data URLs, or hex strings
      const decodeImage = (input: string, fallbackName: string, pixelRatio: number = 2) => {
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

          const fileName = `${fallbackName}@${pixelRatio}x${extension}`;
          const u8 = new Uint8Array(buffer);
          // In Node >= 18, File is available (undici); use it to integrate with uploadImages
          const blob = new Blob([u8], { type: mime });
          const file = new File([blob], fileName, { type: mime });
          return file;
        } catch (error) {
          throw new Error('Failed to decode image payload');
        }
      };
      
      filesToUpload = images.map((img, index) => 
        decodeImage(img as string, `image${index}`, pixelRatios[index] || 2)
      );
      
    } else {
      filesToUpload = images as File[];
    }

    const maxSize = 20 * 1024 * 1024; // 20 MB
    for (const file of filesToUpload) {
      if (file.size > maxSize) {
        return c.json({ error: `Размер файла ${file.name} не должен превышать 20 МБ` }, 400);
      }
    }

    try {
      uploaded = await uploadImages(votingId, filesToUpload);
    } catch (error) {
      logger.error('Ошибка загрузки изображений:', error);

      // Определяем тип ошибки и возвращаем понятное сообщение
      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('не является допустимым медиафайлом')) {
          return c.json({
            error: 'Один или несколько файлов не являются допустимыми изображениями или видео. ' +
                   'Пожалуйста, загрузите только файлы в форматах: JPG, PNG, WebP, AVIF, MP4, WebM, MOV, AVI.'
          }, 400);
        }

        if (message.includes('неподдерживаемый формат файла')) {
          return c.json({
            error: 'Формат одного из файлов не поддерживается. ' +
                   'Разрешены только: JPG, PNG, WebP, AVIF, MP4, WebM, MOV, AVI.'
          }, 400);
        }

        if (message.includes('неподдерживаемое расширение файла')) {
          return c.json({
            error: 'Расширение файла не поддерживается. ' +
                   'Используйте файлы с расширениями: .jpg, .png, .webp, .avif, .mp4, .webm, .mov, .avi.'
          }, 400);
        }
      }

      return c.json({ error: 'Ошибка при обработке файлов. Проверьте, что все файлы являются корректными изображениями или видео.' }, 400);
    }

    const optionsToCreate: Omit<VotingOption, 'id'>[] = uploaded.map((upload, index) => ({
      voting_id: votingId,
      file_path: upload.filePath,
      sort_order: index,
      pixel_ratio: upload.pixelRatio,
      width: upload.width,
      height: upload.height,
      media_type: upload.mediaType
    }));

    await createVotingOptions(optionsToCreate);
    
    // Отправляем уведомление асинхронно (только для публичных голосований)
    notificationService.sendVotingCreatedNotification(votingId, title, endAt.toISOString(), isPublic).catch(error => {
      logger.error('Error sending notification:', error);
    });

    return c.json({
      voting: {
        id: votingId,
        title,
        end_at: endAt.toISOString(),
        duration_hours: durationHours,
        is_public: isPublic
      }
    });
  } catch (error) {
    logger.error('Ошибка создания голосования:', error);

    // Для отладки в development режиме показываем детали ошибки
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      return c.json({
        error: 'Ошибка при создании голосования',
        details: error.message
      }, 500);
    }

    return c.json({ error: 'Произошла ошибка при создании голосования. Попробуйте еще раз.' }, 500);
  }
});

// POST /api/votings/:id/vote - голосование
votingRoutes.post('/votings/:id/vote', async (c) => {
  try {
    const id = c.req.param('id');
    const { optionId } = await c.req.json();

    if (typeof optionId !== 'number') {
      return c.json({ error: 'Неверный выбор' }, 400);
    }

    const voting = await getVoting(id);
    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    if (new Date(voting.end_at) <= new Date()) {
      return c.json({ error: 'Голосование завершено' }, 400);
    }

    const options = await getVotingOptions(id);
    if (!options.some(o => o.id === optionId)) {
      return c.json({ error: 'Выбранный вариант не существует' }, 400);
    }

    await createVote({
      voting_id: id,
      option_id: optionId,
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

    const voteCounts = await getVoteCounts(id);
    const options = await getVotingOptions(id);
    const totalVotes = voteCounts.reduce((sum, r) => sum + r.count, 0);

    const results = options.map(option => {
      const voteInfo = voteCounts.find(vc => vc.option_id === option.id);
      return {
        option_id: option.id,
        file_path: option.file_path,
        count: voteInfo?.count || 0,
        percentage: totalVotes > 0 ? Math.round(((voteInfo?.count || 0) / totalVotes) * 100) : 0
      };
    });

    // Коррекция процентов, чтобы в сумме было 100%
    let percentageSum = results.reduce((sum, r) => sum + r.percentage, 0);
    if (totalVotes > 0 && percentageSum < 100) {
      const diff = 100 - percentageSum;
      const maxPercentageItem = results.reduce((max, item) => (item.percentage > max.percentage ? item : max), results[0]);
      maxPercentageItem.percentage += diff;
    }

    // Определение победителя
    let winner: number | 'tie' | null = null;
    if (totalVotes > 0) {
      const maxVotes = Math.max(...results.map(r => r.count));
      const winners = results.filter(r => r.count === maxVotes);
      if (winners.length === 1) {
        winner = winners[0].option_id;
      } else {
        winner = 'tie';
      }
    }
    
    return c.json({
      totalVotes,
      results,
      winner
    });
  } catch (error) {
    logger.error('Ошибка получения результатов:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});
