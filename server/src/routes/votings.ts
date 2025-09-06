import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { uploadImages } from '../utils/images.js';
import { NotificationService } from '../notifications/index.js';
import { createVotingLimiter, createVotingHourlyLimiter } from '../utils/rateLimit.js';
import { requireAuth, requireVotingOwner, requireVotingAuth, optionalVotingAuth, AuthContext } from '../middleware/auth.js';
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
  deleteVoting,
  runQuery,
  hasUserVoted,
  getUserSelectedOption,
  VotingOption
} from '../db/queries.js';

export const votingRoutes = new Hono();

// Инициализируем сервис уведомлений
const notificationService = new NotificationService();

// GET /api/votings - список публичных голосований
votingRoutes.get('/votings', async (c) => {
  try {
    const votings = getPublicVotings();
    
    const votingsWithOptions = votings.map((voting) => {
      const options = getVotingOptions(voting.id);
      const voteCount = getVoteCountForVoting(voting.id);
      
      return {
        ...voting,
        options,
        vote_count: voteCount
      };
    });

    return c.json({ votings: votingsWithOptions });
  } catch (error) {
    logger.error('Ошибка получения списка голосований:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// GET /api/votings/:id - детали голосования
votingRoutes.get('/votings/:id', optionalVotingAuth, async (c: AuthContext) => {
  try {
    const id = c.req.param('id');
    
    const voting = getVoting(id);
    
    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    const options = getVotingOptions(id);
    const isFinished = new Date(voting.end_at) <= new Date();
    
    // Проверяем, голосовал ли пользователь (только в неанонимном режиме)
    let userVoted = false;
    let selectedOption: number | null = null;
    if (c.user && c.user.id !== 'anonymous') {
      userVoted = hasUserVoted(id, c.user.id);
      if (userVoted) {
        selectedOption = getUserSelectedOption(id, c.user.id) as number | null;
      }
    }
    
    let results = null;
    if (isFinished) {
      // Если голосование завершено, загружаем результаты
      const voteCounts = getVoteCounts(id);
      const totalVotes = voteCounts.reduce((sum, r) => sum + r.count, 0);

      const resultsData = options.map(option => {
        const voteInfo = voteCounts.find(vc => vc.option_id === option.id);
        return {
          option_id: option.id,
          file_path: option.file_path,
          count: voteInfo?.count || 0,
          percentage: totalVotes > 0 ? Math.round(((voteInfo?.count || 0) / totalVotes) * 100) : 0
        };
      });

      // Коррекция процентов, чтобы в сумме было 100%
      let percentageSum = resultsData.reduce((sum, r) => sum + r.percentage, 0);
      if (totalVotes > 0 && percentageSum < 100) {
        const diff = 100 - percentageSum;
        const maxPercentageItem = resultsData.reduce((max, item) => (item.percentage > max.percentage ? item : max), resultsData[0]);
        maxPercentageItem.percentage += diff;
      }

      // Определение победителя
      let winner: number | 'tie' | null = null;
      if (totalVotes > 0) {
        const maxVotes = Math.max(...resultsData.map(r => r.count));
        const winners = resultsData.filter(r => r.count === maxVotes);
        if (winners.length === 1) {
          winner = winners[0].option_id;
        } else {
          winner = 'tie';
        }
      } else {
        // Если нет голосов, все варианты считаются ничьей
        winner = 'tie';
      }
      
      results = {
        totalVotes,
        results: resultsData,
        winner
      };
    }

    return c.json({ 
      voting: {
        ...voting,
        options
      },
      results,
      hasVoted: userVoted,
      selectedOption
    });
  } catch (error) {
    logger.error('Ошибка получения голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// POST /api/votings - создание голосования (требует авторизацию)
votingRoutes.post('/votings', createVotingLimiter, createVotingHourlyLimiter, requireAuth, async (c: AuthContext) => {
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

    const votingId = createVoting({
      title,
      created_at: new Date().toISOString(),
      end_at: endAt.toISOString(),
      duration_hours: durationHours,
      is_public: isPublic,
      user_id: c.user?.id || null // В анонимном режиме user_id будет null
    });

    let uploaded: any[] = [];
    let filesToUpload: File[] = [];

    if (contentType.includes('application/json')) {
      // Handle JSON uploads that may contain base64, data URLs, or hex strings
      const decodeImage = (input: string, fallbackName: string, pixelRatio: number = 2) => {
        try {
          logger.info('Decoding image:', { input: input.substring(0, 100) + '...', fallbackName, pixelRatio });
          let data = input.trim();
          let mime = 'image/png';
          let extension = '.png';
          // data URL handling
          const dataUrlMatch = data.match(/^data:(.*?);base64,(.*)$/i);
          if (dataUrlMatch) {
            mime = dataUrlMatch[1] || 'image/png';
            data = dataUrlMatch[2] || '';
            logger.info('Data URL parsed:', { mime, dataLength: data.length });
            if (mime.includes('jpeg')) extension = '.jpg';
            else if (mime.includes('webp')) extension = '.webp';
            else if (mime.includes('avif')) extension = '.avif';
            else if (mime.includes('png')) extension = '.png';
          }

          let buffer: Buffer | null = null;
          // Try base64 first
          try {
            buffer = Buffer.from(data, 'base64');
            logger.info('Base64 decoded:', { bufferLength: buffer.length });
            // Heuristic: if base64 decoding fails it often results in empty buffer
            if (!buffer || buffer.length === 0) {
              logger.warn('Empty buffer after base64 decode');
              buffer = null;
            }
          } catch (error) {
            logger.warn('Base64 decode failed:', error);
            buffer = null;
          }

          // If not base64, try hex
          if (!buffer) {
            const isHex = /^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0;
            logger.info('Trying hex decode:', { isHex, dataLength: data.length });
            if (isHex) {
              buffer = Buffer.from(data, 'hex');
              logger.info('Hex decoded:', { bufferLength: buffer.length });
            }
          }

          if (!buffer) {
            logger.error('Failed to decode image data:', { data: data.substring(0, 50) + '...' });
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
          logger.info('Creating File object:', { fileName, mime, bufferLength: buffer.length });
          
          // Create File object using Blob (available in Node.js 20+)
          const u8Array = new Uint8Array(buffer);
          const blob = new Blob([u8Array], { type: mime });
          const file = new File([blob], fileName, { type: mime });
          logger.info('File created:', { fileName: file.name, fileSize: file.size, fileType: file.type });
          return file;
        } catch (error) {
          logger.error('Error in decodeImage:', error);
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

    createVotingOptions(optionsToCreate);
    
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
    logger.error('Тип ошибки:', typeof error);
    logger.error('Стек ошибки:', error instanceof Error ? error.stack : 'Не Error объект');

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
votingRoutes.post('/votings/:id/vote', requireVotingAuth, async (c: AuthContext) => {
  try {
    const id = c.req.param('id');
    const { optionId } = await c.req.json();

    if (typeof optionId !== 'number') {
      return c.json({ error: 'Неверный выбор' }, 400);
    }

    const voting = getVoting(id);
    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    if (new Date(voting.end_at) <= new Date()) {
      return c.json({ error: 'Голосование завершено' }, 400);
    }

    const options = getVotingOptions(id);
    if (!options.some(o => o.id === optionId)) {
      return c.json({ error: 'Выбранный вариант не существует' }, 400);
    }

    // Запрещаем повторное голосование для авторизованных пользователей
    if (c.user && c.user.id && c.user.id !== 'anonymous') {
      if (hasUserVoted(id, c.user.id)) {
        return c.json({ error: 'Вы уже голосовали' }, 400);
      }
    }

    createVote({
      voting_id: id,
      option_id: optionId,
      created_at: new Date().toISOString(),
      user_id: c.user?.id || null
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
    
    const voting = getVoting(id);

    if (!voting) {
      return c.json({ error: 'Голосование не найдено' }, 404);
    }

    // Проверяем, закончилось ли голосование
    const isFinished = new Date(voting.end_at) <= new Date();
    
    if (!isFinished) {
      return c.json({ error: 'Голосование еще не завершено' }, 400);
    }

    const voteCounts = getVoteCounts(id);
    const options = getVotingOptions(id);
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

// POST /api/votings/:id/end-early - завершение голосования досрочно (требует авторизацию и владение)
votingRoutes.post('/votings/:id/end-early', requireAuth, requireVotingOwner, async (c: AuthContext) => {
  try {
    const id = c.req.param('id');
    
    const voting = getVoting(id);
    if (!voting) {
      return c.json({ error: 'Voting not found' }, 404);
    }

    // Проверяем, что голосование еще не завершено
    if (new Date(voting.end_at) <= new Date()) {
      return c.json({ error: 'Voting already finished' }, 400);
    }

    // Обновляем время окончания на текущее время
    const success = runQuery(
      'UPDATE votings SET end_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    
    if (!success) {
      return c.json({ error: 'Failed to end voting early' }, 500);
    }
    
    return c.json({ message: 'Voting ended early successfully' });
  } catch (error) {
    logger.error('Ошибка завершения голосования досрочно:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// DELETE /api/votings/:id - удаление голосования (требует авторизацию и владение)
votingRoutes.delete('/votings/:id', requireAuth, requireVotingOwner, async (c: AuthContext) => {
  try {
    const id = c.req.param('id');
    
    const success = deleteVoting(id);
    
    if (!success) {
      return c.json({ error: 'Failed to delete voting' }, 500);
    }
    
    return c.json({ message: 'Voting deleted successfully' });
  } catch (error) {
    logger.error('Ошибка удаления голосования:', error);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  }
});
