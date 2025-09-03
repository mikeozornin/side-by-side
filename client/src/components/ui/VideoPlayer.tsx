import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  width?: number
  height?: number
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  alt?: string
  className?: string
  controls?: boolean
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
}

export default function VideoPlayer({
  src,
  width,
  height,
  fit = 'contain',
  alt,
  className,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Устанавливаем размеры видео
    if (width && height) {
      video.style.width = `${width}px`
      video.style.height = `${height}px`
    }

    // Устанавливаем object-fit
    video.style.objectFit = fit
  }, [width, height, fit])

  return (
    <video
      ref={videoRef}
      src={src}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      className={cn('max-w-full max-h-full', className)}
      style={{
        objectFit: fit,
      }}
      aria-label={alt}
    />
  )
}
