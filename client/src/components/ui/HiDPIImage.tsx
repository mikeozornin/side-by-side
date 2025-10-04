import React from 'react'

type ObjectFit = 'contain' | 'cover'

interface HiDPIImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  width: number
  height: number
  pixelRatio: number
  fit?: ObjectFit
}

export function HiDPIImage({ src, width, height, pixelRatio, fit = 'contain', style, ...imgProps }: HiDPIImageProps) {
  const objectFit = fit

  // Масштабируем размеры с учетом pixelRatio
  // Если pixelRatio > 1, то физические размеры должны быть меньше
  const displayWidth = width / pixelRatio
  const displayHeight = height / pixelRatio

  return (
    <img
      src={src}
      style={{
        objectFit,
        maxWidth: `${displayWidth}px`,
        maxHeight: `${displayHeight}px`,
        height: '100%',
        width: '100%',
        aspectRatio: `${displayWidth} / ${displayHeight}`,
        ...style,
      }}
      {...imgProps}
    />
  )
}

export default HiDPIImage


