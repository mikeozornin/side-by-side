/**
 * Определяет тип медиафайла
 */
export function getMediaType(file: File): 'image' | 'video' | 'unknown' {
  if (file.type.startsWith('image/')) {
    return 'image'
  }
  if (file.type.startsWith('video/')) {
    return 'video'
  }
  return 'unknown'
}

/**
 * Проверяет, является ли файл изображением
 */
export function isImage(file: File): boolean {
  return getMediaType(file) === 'image'
}

/**
 * Проверяет, является ли файл видео
 */
export function isVideo(file: File): boolean {
  return getMediaType(file) === 'video'
}

/**
 * Получает размеры изображения
 */
export function getImageDimensions(file: File): Promise<{width: number, height: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Получает размеры видео
 */
export function getVideoDimensions(file: File): Promise<{width: number, height: number}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = reject
    video.src = URL.createObjectURL(file)
  })
}

/**
 * Получает размеры медиафайла (изображения или видео)
 */
export async function getMediaDimensions(file: File): Promise<{width: number, height: number} | null> {
  try {
    if (isImage(file)) {
      return await getImageDimensions(file)
    } else if (isVideo(file)) {
      return await getVideoDimensions(file)
    }
    return null
  } catch (error) {
    console.error('Failed to get media dimensions:', error)
    return null
  }
}

/**
 * Парсит pixel ratio из имени файла
 */
export function parsePixelRatioFromName(fileName: string): number {
  const match = fileName.match(/@(\d+(?:\.\d+)?)x\./i)
  if (match) {
    const parsed = Number(match[1])
    if (!Number.isNaN(parsed) && parsed > 0) {
      console.log(`[MediaUtils] Parsed pixelRatio from ${fileName}: ${parsed}`)
      return parsed
    }
  }
  console.log(`[MediaUtils] No pixelRatio found in ${fileName}, using 1`)
  return 1
}
