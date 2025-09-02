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
  const logicalWidth = width > 0 && pixelRatio > 0 ? width / pixelRatio : undefined
  const logicalHeight = height > 0 && pixelRatio > 0 ? height / pixelRatio : undefined

  const maxWidth = logicalWidth ? `${logicalWidth}px` : undefined
  const maxHeight = logicalHeight ? `${logicalHeight}px` : undefined

  const objectFit = fit

  console.log(`[HiDPIImage] src: ${src}, width: ${width}, height: ${height}, pixelRatio: ${pixelRatio}`)
  console.log(`[HiDPIImage] logicalWidth: ${logicalWidth}, logicalHeight: ${logicalHeight}`)
  console.log(`[HiDPIImage] maxWidth: ${maxWidth}, maxHeight: ${maxHeight}`)

  return (
    <img
      src={src}
      style={{
        maxWidth,
        maxHeight,
        width: '100%',
        height: '100%',
        objectFit,
        ...style,
      }}
      {...imgProps}
    />
  )
}

export default HiDPIImage


