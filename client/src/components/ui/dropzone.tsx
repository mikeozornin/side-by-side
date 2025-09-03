'use client'

import { UploadIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useRef } from 'react'
import type { DropEvent, DropzoneOptions, FileRejection } from 'react-dropzone'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DropzoneContextType = {
  src?: File[]
  accept?: DropzoneOptions['accept']
  maxSize?: DropzoneOptions['maxSize']
  minSize?: DropzoneOptions['minSize']
  maxFiles?: DropzoneOptions['maxFiles']
}



const DropzoneContext = createContext<DropzoneContextType | undefined>(undefined)

export type DropzoneProps = Omit<DropzoneOptions, 'onDrop'> & {
  src?: File[]
  className?: string
  onDrop?: (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
    event: DropEvent
  ) => void
  children?: ReactNode
}

export const Dropzone = ({
  accept,
  maxFiles = 1,
  maxSize,
  minSize,
  onDrop,
  onError,
  disabled,
  src,
  className,
  children,
  ...props
}: DropzoneProps) => {
  const dropzoneRef = useRef<HTMLDivElement>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    onError,
    disabled,
    onDrop: (acceptedFiles, fileRejections, event) => {
      if (fileRejections.length > 0) {
        const message = fileRejections[0]?.errors[0]?.message
        onError?.(new Error(message))
        return
      }
      onDrop?.(acceptedFiles, fileRejections, event)
    },
    ...props,
  })

  // Обработчик вставки из буфера
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (disabled || !dropzoneRef.current?.contains(document.activeElement)) {
        return
      }

      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          event.preventDefault()
          
          const file = item.getAsFile()
          if (!file) continue

          // Проверяем размер файла
          if (maxSize && file.size > maxSize) {
            onError?.(new Error('Размер файла превышает допустимый лимит'))
            return
          }

          // Проверяем тип файла
          const acceptedTypes = accept ? Object.keys(accept) : ['image/*', 'video/*']
          const isAccepted = acceptedTypes.some(type => {
            if (type === 'image/*') return file.type.startsWith('image/')
            if (type === 'video/*') return file.type.startsWith('video/')
            return file.type === type
          })

          if (!isAccepted) {
            onError?.(new Error('Неподдерживаемый тип файла'))
            return
          }

          // Создаем FileList-like объект
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(file)
          
          // Вызываем onDrop с файлом из буфера
          onDrop?.([file], [], { dataTransfer } as any)
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled, maxSize, accept, onDrop, onError])

  return (
    <DropzoneContext.Provider
      key={JSON.stringify(src)}
      value={{ src, accept, maxSize, minSize, maxFiles }}
    >
      <Button
        ref={dropzoneRef}
        className={cn(
          'relative h-auto w-full flex-col overflow-hidden p-8',
          isDragActive && 'outline-none ring-1 ring-ring',
          className
        )}
        disabled={disabled}
        type="button"
        variant="outline"
        tabIndex={-1}
        {...getRootProps()}
      >
        <input {...getInputProps()} disabled={disabled} />
        {children}
      </Button>
    </DropzoneContext.Provider>
  )
}

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext)
  if (!context) {
    throw new Error('useDropzoneContext must be used within a Dropzone')
  }
  return context
}

export type DropzoneContentProps = {
  children?: ReactNode
  className?: string
}

const maxLabelItems = 3

export const DropzoneContent = ({
  children,
  className,
}: DropzoneContentProps) => {
  const { src } = useDropzoneContext()
  if (!src) {
    return null
  }
  if (children) {
    return children
  }
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UploadIcon size={16} strokeWidth={3}/>
      </div>
      <p className="my-2 w-full truncate font-medium text-sm">
        {src.length > maxLabelItems
          ? `${src.slice(0, maxLabelItems).map((file) => file.name).join(', ')} and ${src.length - maxLabelItems} more`
          : src.map((file) => file.name).join(', ')}
      </p>
    </div>
  )
}

export type DropzoneEmptyStateProps = {
  children?: ReactNode
  className?: string
}

export const DropzoneEmptyState = ({
  children,
  className,
}: DropzoneEmptyStateProps) => {
  const { src } = useDropzoneContext()
  const { t } = useTranslation()
  
  if (src) {
    return null
  }
  if (children) {
    return children
  }
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UploadIcon size={16} strokeWidth={3} />
      </div>
      <p className="my-2 w-full truncate text-wrap font-medium text-sm">
        {t('dropzone.uploadFile')}
      </p>
      <p className="w-full truncate text-wrap text-muted-foreground text-xs">
        {t('dropzone.dragAndDrop')}
      </p>
      <p className="text-wrap text-muted-foreground text-xs">{t('dropzone.mediaSizeLimit')}</p>
    </div>
  )
}
