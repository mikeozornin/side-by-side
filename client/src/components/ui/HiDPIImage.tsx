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

  return (
    <img
      src={src}
      style={{
        objectFit,
        ...style,
      }}
      {...imgProps}
    />
  )
}

export default HiDPIImage


