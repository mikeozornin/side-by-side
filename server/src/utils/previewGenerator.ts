import Jimp from 'jimp';
import { logger } from './logger.js';
import { createStorageFromEnv } from '../storage/index.js';
import type { VotingOption } from '../db/queries.js';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { ensureDir } from 'fs-extra';

const DATA_DIR = process.env.DATA_DIR || './data';
// 16:9 aspect ratio for Mattermost preview (reduced size for testing)
const PREVIEW_WIDTH = 900; // 16:9 width (reduced from 1280)
const PREVIEW_HEIGHT = 506; // 16:9 height (900 * 9/16 = 506.25, rounded down)

// Кэш для base64 шрифта
let fontBase64Cache: string | null = null;

/**
 * Load custom font and convert to base64 for embedding in SVG
 */
async function loadFontBase64(): Promise<string> {
  if (fontBase64Cache) {
    return fontBase64Cache;
  }

  try {
    // Путь к шрифту в папке server/fonts
    const fontPath = join(process.cwd(), 'server', 'fonts', 'Inter-Bold.otf');
    const fontBuffer = await readFile(fontPath);
    fontBase64Cache = fontBuffer.toString('base64');
    logger.info(`[Preview] Custom font loaded: ${fontPath}`);
    return fontBase64Cache;
  } catch (error) {
    logger.warn(`[Preview] Failed to load custom font, falling back to system fonts:`, error);
    // Возвращаем пустую строку, чтобы использовать fallback шрифты
    return '';
  }
}

/**
 * Convert ReadableStream to Buffer
 */
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/**
 * Resize image to fill dimensions using Jimp
 * Jimp automatically stretches images to exact dimensions (fill behavior)
 */
async function resizeToFill(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  try {
    // Jimp resize stretches to exact dimensions by default (fill behavior)
    const image = await Jimp.read(buffer);
    image.resize(width, height);
    return image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    logger.error(`[Preview] Jimp resize failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get polygon coordinates for diagonal split (similar to VotingCardPreview)
 * Returns array of [x, y] points
 */
function getPolygonPoints(i: number, n: number, width: number, height: number): Array<[number, number]> {
  if (n <= 1) {
    return [[0, 0], [width, 0], [width, height], [0, height]];
  }

  const slant = 10; // Slant amount for the diagonal effect (in percentage)
  const gap = 1; // Gap between images (in percentage)

  // Handle two images separately for a simple diagonal split
  if (n === 2) {
    const correctionFactor = 2.5;
    const g = (gap * correctionFactor);

    if (i === 0) {
      // Left triangle: 0,0 -> (100-g)%,0 -> 0,100%
      const p2_x = Math.round((width * (100 - g)) / 100);
      return [[0, 0], [p2_x, 0], [0, height]];
    } else {
      // Right triangle: 100% 0%, 100% 100%, g% 100%
      // Points in clockwise order: top-right -> bottom-right -> bottom-left
      const p3_x = Math.round((width * g) / 100);
      return [[width, 0], [width, height], [p3_x, height]];
    }
  }

  // Equal distribution for n > 2 (same logic as VotingCardPreview.tsx)
  const totalGap = (n - 1) * gap;
  const totalShapeWidth = 100 - totalGap;
  const avgWidth = totalShapeWidth / n;

  // Calculate the positions of the dividers on the top edge (in percentages)
  const T: number[] = [0];
  T[1] = avgWidth + slant / 2;
  for (let j = 2; j < n; j++) {
    T[j] = T[j - 1] + avgWidth;
  }

  // Define polygon points (calculate in percentages first, then convert to pixels)
  // Ensure points are within bounds [0, width] and [0, height]
  let p1_x: number, p2_x: number, p3_x: number, p4_x: number;

  if (i === 0) {
    // First shape (left trapezoid/triangle)
    p1_x = 0;
    p2_x = Math.round((width * T[1]) / 100);
    p4_x = 0;
    p3_x = Math.round((width * (T[1] - slant)) / 100);
    // Ensure p3_x doesn't go negative
    p3_x = Math.max(0, p3_x);
  } else {
    // Middle or last shape - calculate start_x in percentages first
    const start_x_percent = T[i] + i * gap;

    if (i === n - 1) {
      // Last shape (right trapezoid/triangle)
      p1_x = Math.max(0, Math.round((width * start_x_percent) / 100));
      p2_x = width;
      p4_x = Math.max(0, Math.round((width * (start_x_percent - slant)) / 100));
      p3_x = width;
    } else {
      // Middle shape (parallelogram)
      // Note: end_x uses i * gap (same as start_x) to match UI logic
      // This creates overlap between adjacent shapes for proper coverage
      const end_x_percent = T[i + 1] + i * gap;
      p1_x = Math.max(0, Math.round((width * start_x_percent) / 100));
      p2_x = Math.min(width, Math.round((width * end_x_percent) / 100));
      p4_x = Math.max(0, Math.round((width * (start_x_percent - slant)) / 100));
      p3_x = Math.min(width, Math.round((width * (end_x_percent - slant)) / 100));
    }
  }

  // Ensure all points are within bounds
  p1_x = Math.max(0, Math.min(width, p1_x));
  p2_x = Math.max(0, Math.min(width, p2_x));
  p3_x = Math.max(0, Math.min(width, p3_x));
  p4_x = Math.max(0, Math.min(width, p4_x));

  return [[p1_x, 0], [p2_x, 0], [p3_x, height], [p4_x, height]];
}

/**
 * Generate preview image from voting options
 */
export async function generateVotingPreview(options: VotingOption[]): Promise<Buffer | null> {
  if (!options || options.length === 0) {
    logger.warn('No options provided for preview generation');
    return null;
  }

  // Filter out video options for now (can be extended later with ffmpeg)
  const imageOptions = options.filter(opt => opt.media_type === 'image');

  logger.info(`[Preview] Starting preview generation for ${options.length} options (${imageOptions.length} images)`);
  options.forEach((opt, idx) => {
    logger.info(`[Preview]   Option ${idx}: sort_order=${opt.sort_order}, file_path="${opt.file_path}", media_type=${opt.media_type}`);
  });

  if (imageOptions.length === 0) {
    logger.warn('[Preview] No image options found for preview generation');
    return null;
  }

  imageOptions.sort((a, b) => a.sort_order - b.sort_order);
  logger.info(`[Preview] Processing ${imageOptions.length} images in order: ${imageOptions.map((o, i) => `[${i}] sort_order=${o.sort_order}`).join(', ')}`);

  // Log Jimp version for debugging
  logger.info(`[Preview] Using Jimp for image processing`);

  try {
    const storage = createStorageFromEnv();
    const width = PREVIEW_WIDTH;
    const height = PREVIEW_HEIGHT;

    // Process each option and prepare composite inputs
    const compositeInputs: Array<{ input: Buffer; left: number; top: number }> = [];

    for (let i = 0; i < imageOptions.length; i++) {
      const option = imageOptions[i];

      try {
        // Extract filename from file_path
        // file_path can be either:
        // 1. Full path: "votingId/hash.ext" or "data/votingId/hash.ext"
        // 2. Just filename: "hash.ext"
        // Storage.getObjectStream expects just the filename (hash.ext)
        // LocalStorageDriver.findFilePath will search in subdirectories if needed
        let filename = option.file_path;

        // If file_path contains path separators, extract just the filename
        if (filename.includes('/') || filename.includes('\\')) {
          filename = filename.split('/').pop() || filename.split('\\').pop() || filename;
        }

        logger.info(`[Preview] Processing option ${i} (sort_order: ${option.sort_order})`);
        logger.info(`[Preview]   file_path: "${option.file_path}"`);
        logger.info(`[Preview]   extracted filename: "${filename}"`);
        logger.info(`[Preview]   media_type: ${option.media_type}, size: ${option.width}x${option.height}`);

        // Get image from storage
        // LocalStorageDriver will search in subdirectories if file not found in root
        const stream = await storage.getObjectStream(filename);
        let imageBuffer = await streamToBuffer(stream);
        logger.info(`[Preview]   Image loaded successfully, buffer size: ${imageBuffer.length} bytes`);

        // Check if image has alpha channel, if not convert to PNG with alpha
        const image = await Jimp.read(imageBuffer);
        const hasAlpha = image.hasAlpha();
        if (!hasAlpha) {
          logger.info(`[Preview]   Image has no alpha channel, converting to PNG with alpha`);
          // Jimp automatically handles alpha when saving as PNG
          imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
          logger.info(`[Preview]   Converted to PNG, new buffer size: ${imageBuffer.length} bytes`);
        } else {
          logger.info(`[Preview]   Image has alpha channel, no conversion needed`);
        }

        // Get polygon points for this option
        const polygonPoints = getPolygonPoints(i, imageOptions.length, width, height);
        logger.info(`[Preview]   Polygon points: ${JSON.stringify(polygonPoints)}`);

        const pointsStr = polygonPoints.map(p => `${p[0]},${p[1]}`).join(' ');
        logger.info(`[Preview]   Points string: "${pointsStr}"`);

        logger.info(`[Preview]   Step 1: Resizing image to ${width}x${height}...`);
        const resizedImage = await resizeToFill(imageBuffer, width, height);
        logger.info(`[Preview]   Step 1 complete: Image ${i + 1} resized to ${width}x${height}, size: ${resizedImage.length} bytes`);

        logger.info(`[Preview]   Step 2: Creating SVG mask...`);
        // Ensure SVG is properly formatted with viewBox for better compatibility
        const svgMask = Buffer.from(
          `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <polygon points="${pointsStr}" fill="white" opacity="1"/>
          </svg>`
        );
        logger.info(`[Preview]   Step 2: SVG mask created, size: ${svgMask.length} bytes, points: ${pointsStr}`);

        logger.info(`[Preview]   Step 3: Converting SVG mask to image buffer...`);
        const maskImage = await Jimp.read(svgMask);
        maskImage.resize(width, height);
        const maskBuffer = await maskImage.getBufferAsync(Jimp.MIME_PNG);

        // Verify mask dimensions
        logger.info(`[Preview]   Step 3 complete: Mask ${i + 1} created, size: ${maskBuffer.length} bytes, dimensions: ${maskImage.bitmap.width}x${maskImage.bitmap.height}`);

        logger.info(`[Preview]   Step 4: Applying mask to image...`);
        // Read resized image
        const resizedJimpImage = await Jimp.read(resizedImage);
        logger.info(`[Preview]   Resized image dimensions: ${resizedJimpImage.bitmap.width}x${resizedJimpImage.bitmap.height}`);

        // Ensure mask and image have same dimensions
        if (maskImage.bitmap.width !== resizedJimpImage.bitmap.width || maskImage.bitmap.height !== resizedJimpImage.bitmap.height) {
          logger.warn(`[Preview]   Dimension mismatch: mask ${maskImage.bitmap.width}x${maskImage.bitmap.height} vs image ${resizedJimpImage.bitmap.width}x${resizedJimpImage.bitmap.height}, resizing mask...`);
          maskImage.resize(resizedJimpImage.bitmap.width, resizedJimpImage.bitmap.height);
        }

        // Apply mask using Jimp composite (mask as alpha channel)
        resizedJimpImage.mask(maskImage, 0, 0);
        const maskedImage = await resizedJimpImage.getBufferAsync(Jimp.MIME_PNG);
        logger.info(`[Preview]   Step 4 complete: Image ${i + 1} masked, size: ${maskedImage.length} bytes`);

        // Add to composite inputs
        compositeInputs.push({
          input: maskedImage,
          left: 0,
          top: 0
        });
        logger.info(`[Preview] Image ${i + 1} added to composite inputs (total: ${compositeInputs.length})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`[Preview] Error processing option ${i} (file_path: ${option.file_path}): ${errorMessage}`);
        if (errorStack) {
          logger.error(`[Preview] Error stack: ${errorStack}`);
        }
        if (error && typeof error === 'object') {
          logger.error(`[Preview] Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        }
      }
    }

    if (compositeInputs.length === 0) {
      logger.warn('[Preview] No images processed for preview');
      return null;
    }

    logger.info(`[Preview] Compositing ${compositeInputs.length} images...`);

    // In VotingCardPreview, zIndex is n - i, meaning:
    // - First image (i=0) has zIndex = n (highest, on top) 
    // - Last image (i=n-1) has zIndex = 1 (lowest, on bottom)
    // In Sharp composite, images are composited in order: first = bottom layer, last = top layer
    // So to match VotingCardPreview: we want first image (i=0) on top, last image (i=n-1) on bottom
    // This means: last image first in array (bottom), first image last in array (top)
    // So we need to reverse the array
    compositeInputs.reverse();
    logger.info(`[Preview] Composite order: ${compositeInputs.map((_, idx) => `layer ${idx}`).join(' -> ')} (first image will be on top)`);

    // Create base image with transparent background
    const baseImage = new Jimp(width, height, 0x00000000); // Transparent background

    // Composite all masked images (they are already in correct z-order after reverse)
    for (const input of compositeInputs) {
      const layerImage = await Jimp.read(input.input);
      baseImage.composite(layerImage, input.left, input.top);
    }

    const previewBuffer = await baseImage.getBufferAsync(Jimp.MIME_PNG);

    logger.info(`[Preview] Preview generated, size: ${previewBuffer.length} bytes`);
    return previewBuffer;
  } catch (error) {
    logger.error('Error generating voting preview:', error);
    return null;
  }
}

/**
 * Save preview image to filesystem
 */
export async function saveVotingPreview(votingId: string, previewBuffer: Buffer): Promise<string> {
  try {
    // Save in voting directory
    const votingDir = join(DATA_DIR, votingId);
    await ensureDir(votingDir);

    const filename = `preview-${votingId}.png`;
    const filePath = join(votingDir, filename);

    try {
      const { unlink } = await import('fs/promises');
      await unlink(filePath).catch(() => { });
    } catch { }

    await writeFile(filePath, previewBuffer);

    const absolutePath = require('path').resolve(filePath);
    logger.info(`Preview saved: ${absolutePath} (size: ${previewBuffer.length} bytes)`);
    return filePath;
  } catch (error) {
    logger.error(`Error saving preview for voting ${votingId}:`, error);
    throw error;
  }
}

/**
 * Generate preview image with voting results
 * - Winner stays colored, losers are grayscale
 * - Percentages drawn on each image
 * - Winner icon drawn on winner
 */
export async function generateVotingPreviewWithResults(
  options: VotingOption[],
  results: { option_id: number; count: number; percentage: number }[],
  winner: number | 'tie' | null
): Promise<Buffer | null> {
  if (!options || options.length === 0) {
    logger.warn('No options provided for results preview generation');
    return null;
  }

  // Filter out video options for now
  const imageOptions = options.filter(opt => opt.media_type === 'image');

  logger.info(`[Results Preview] Starting results preview generation for ${options.length} options (${imageOptions.length} images)`);

  if (imageOptions.length === 0) {
    logger.warn('[Results Preview] No image options found for results preview generation');
    return null;
  }

  // Ensure options are sorted by sort_order
  imageOptions.sort((a, b) => a.sort_order - b.sort_order);
  logger.info(`[Results Preview] Processing ${imageOptions.length} images in order: ${imageOptions.map((o, i) => `[${i}] sort_order=${o.sort_order}`).join(', ')}`);

  try {
    const storage = createStorageFromEnv();
    const width = PREVIEW_WIDTH;
    const height = PREVIEW_HEIGHT;

    // Load custom font for embedding in SVG
    const fontBase64 = await loadFontBase64();
    const fontFaceStyle = fontBase64
      ? `<style>
          @font-face {
            font-family: 'Inter';
            src: url(data:font/otf;charset=utf-8;base64,${fontBase64}) format('opentype');
            font-weight: 700;
            font-style: normal;
          }
        </style>`
      : '';
    const fontFamily = fontBase64 ? "'Inter', sans-serif" : "Arial, sans-serif";

    // Process each option and prepare composite inputs
    const compositeInputs: Array<{ input: Buffer; left: number; top: number }> = [];

    for (let i = 0; i < imageOptions.length; i++) {
      const option = imageOptions[i];
      const result = results.find(r => r.option_id === option.id);
      const percentage = result?.percentage || 0;
      const isWinner = winner !== 'tie' && winner !== null && winner === option.id;

      try {
        // Extract filename from file_path
        let filename = option.file_path;
        if (filename.includes('/') || filename.includes('\\')) {
          filename = filename.split('/').pop() || filename.split('\\').pop() || filename;
        }

        logger.info(`[Results Preview] Processing option ${i} (sort_order: ${option.sort_order}), isWinner: ${isWinner}, percentage: ${percentage}%`);

        // Get image from storage
        const stream = await storage.getObjectStream(filename);
        let imageBuffer = await streamToBuffer(stream);
        logger.info(`[Results Preview]   Image loaded successfully, buffer size: ${imageBuffer.length} bytes`);

        // Check if image has alpha channel
        const metadata = await sharp(imageBuffer).metadata();
        if (!metadata.hasAlpha) {
          logger.info(`[Results Preview]   Converting to PNG with alpha channel`);
          imageBuffer = await sharp(imageBuffer)
            .ensureAlpha(1)
            .png()
            .toBuffer();
        }

        // Get polygon points for this option
        const polygonPoints = getPolygonPoints(i, imageOptions.length, width, height);
        logger.info(`[Results Preview]   Polygon points: ${JSON.stringify(polygonPoints)}`);

        // Resize source image to fill exact dimensions
        let processedImage = await resizeToFill(imageBuffer, width, height);

        // Apply grayscale to losers (not winner)
        if (!isWinner) {
          const jimpImage = await Jimp.read(processedImage);
          jimpImage.greyscale();
          processedImage = await jimpImage.getBufferAsync(Jimp.MIME_PNG);
          logger.info(`[Results Preview]   Applied grayscale to option ${i}`);
        }

        // Create SVG mask for polygon
        const pointsStr = polygonPoints.map(p => `${p[0]},${p[1]}`).join(' ');
        const svgMask = Buffer.from(`
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <polygon points="${pointsStr}" fill="white" opacity="1"/>
          </svg>
        `);

        const maskImage = await Jimp.read(svgMask);
        maskImage.resize(width, height);
        const maskBuffer = await maskImage.getBufferAsync(Jimp.MIME_PNG);

        // Apply mask
        const processedJimpImage = await Jimp.read(processedImage);
        processedJimpImage.mask(maskImage, 0, 0);
        const maskedImage = await processedJimpImage.getBufferAsync(Jimp.MIME_PNG);

        // Calculate center of polygon for positioning
        const centerX = polygonPoints.reduce((sum, p) => sum + p[0], 0) / polygonPoints.length;
        const centerY = polygonPoints.reduce((sum, p) => sum + p[1], 0) / polygonPoints.length;

        // Create SVG with percentage text (white text with black stroke for readability)
        // Проценты размещаем чуть ниже центра
        // Обводка наружу - рисуем текст дважды: сначала обводка (больше), потом основной текст
        const fontSize = 50;
        const textY = centerY + 40; // Смещаем вниз от центра
        const percentageText = `${percentage}%`;
        const strokeWidth = 3; // Толщина обводки

        const textSvg = Buffer.from(`
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            ${fontFaceStyle}
            <!-- Обводка (черная, рисуется первой, как фон) -->
            <text 
              x="${centerX}" 
              y="${textY}" 
              font-family="${fontFamily}" 
              font-size="${fontSize}" 
              font-weight="700"
              fill="none" 
              stroke="white" 
              stroke-width="${strokeWidth}"
              stroke-linejoin="round"
              stroke-linecap="round"
              text-anchor="middle"
              dominant-baseline="middle"
              paint-order="stroke fill"
            >${percentageText}</text>
            <!-- Основной текст (белый, рисуется поверх) -->
            <text 
              x="${centerX}" 
              y="${textY}" 
              font-family="${fontFamily}" 
              font-size="${fontSize}" 
              font-weight="700"
              fill="black" 
              stroke="none"
              text-anchor="middle"
              dominant-baseline="middle"
            >${percentageText}</text>
          </svg>
        `);

        // Composite text onto masked image
        const maskedJimpImage = await Jimp.read(maskedImage);
        const textImage = await Jimp.read(textSvg);
        maskedJimpImage.composite(textImage, 0, 0);
        let finalImage = maskedJimpImage;

        logger.info(`[Results Preview]   Added percentage text "${percentageText}" at (${centerX}, ${textY})`);

        // Add winner icon if this is the winner
        if (isWinner) {
          const iconSize = 80;
          const iconX = centerX - iconSize / 2;
          // Иконку размещаем чуть выше центра, чтобы не перекрывалась с процентами
          const iconY = centerY - iconSize / 2 - 40; // Смещаем вверх от центра

          // Create green medal icon SVG using exact lucide-react Medal icon
          // Используем viewBox для автоматического масштабирования
          const strokeWidth = 1.2; // Масштабируем stroke-width пропорционально

          const winnerIconSvg = Buffer.from(`
            <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <!-- Зеленый круглый фон - правильный круг, заполняющий viewBox -->
              <circle cx="12" cy="12" r="12" fill="#22c55e"/>
              <!-- Иконка медали из lucide-react - только белая обводка (stroke), без заливки -->
              <!-- Уменьшаем иконку до 70% от размера круга для лучших пропорций -->
              <g fill="transparent" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="translate(12, 12) scale(0.7) translate(-12, -12)">
                <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/>
                <path d="M11 12 5.12 2.2"/>
                <path d="m13 12 5.88-9.8"/>
                <path d="M8 7h8"/>
                <circle cx="12" cy="17" r="5"/>
                <path d="M12 18v-2h-.5"/>
              </g>
            </svg>
          `);

          const iconImage = await Jimp.read(winnerIconSvg);
          finalImage.composite(iconImage, Math.round(iconX), Math.round(iconY));

          logger.info(`[Results Preview]   Added winner medal icon at (${iconX}, ${iconY})`);
        }

        const finalBuffer = await finalImage.getBufferAsync(Jimp.MIME_PNG);
        compositeInputs.push({
          input: finalBuffer,
          left: 0,
          top: 0
        });

        logger.info(`[Results Preview] Image ${i + 1} processed and added to composite inputs`);
      } catch (error) {
        logger.error(`[Results Preview] Error processing option ${i} (file_path: ${option.file_path}):`, error);
      }
    }

    if (compositeInputs.length === 0) {
      logger.warn('[Results Preview] No images processed for results preview');
      return null;
    }

    logger.info(`[Results Preview] Compositing ${compositeInputs.length} images...`);

    // Reverse array to match z-index order (first image on top)
    compositeInputs.reverse();
    logger.info(`[Results Preview] Composite order: ${compositeInputs.map((_, idx) => `layer ${idx}`).join(' -> ')} (first image will be on top)`);

    // Create base image with transparent background
    const baseImage = new Jimp(width, height, 0x00000000); // Transparent background

    // Composite all processed images (they are already in correct z-order after reverse)
    for (const input of compositeInputs) {
      const layerImage = await Jimp.read(input.input);
      baseImage.composite(layerImage, input.left, input.top);
    }

    const previewBuffer = await baseImage.getBufferAsync(Jimp.MIME_PNG);

    logger.info(`[Results Preview] Results preview generated, size: ${previewBuffer.length} bytes`);
    return previewBuffer;
  } catch (error) {
    logger.error('Error generating voting results preview:', error);
    return null;
  }
}

/**
 * Save results preview image to filesystem
 */
export async function saveVotingResultsPreview(votingId: string, previewBuffer: Buffer): Promise<string> {
  try {
    // Save in voting directory
    const votingDir = join(DATA_DIR, votingId);
    await ensureDir(votingDir);

    const filename = `results-preview-${votingId}.png`;
    const filePath = join(votingDir, filename);

    try {
      const { unlink } = await import('fs/promises');
      await unlink(filePath).catch(() => { });
    } catch { }

    await writeFile(filePath, previewBuffer);

    const absolutePath = require('path').resolve(filePath);
    logger.info(`Results preview saved: ${absolutePath} (size: ${previewBuffer.length} bytes)`);
    return filePath;
  } catch (error) {
    logger.error(`Error saving results preview for voting ${votingId}:`, error);
    throw error;
  }
}

