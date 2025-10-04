import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, EyeOff, Image, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Textarea } from '@/components/ui/textarea'
import { Dropzone, DropzoneEmptyState } from '@/components/ui/dropzone'
import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'
import { getMediaType, getMediaDimensions, parsePixelRatioFromName, isHeicFile, isSafari } from '@/lib/mediaUtils'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { configManager } from '@/lib/config'

interface MediaFile {
  file: File;
  dimensions: { width: number; height: number } | null;
}

export function CreateVoting() {
  const { t } = useTranslation()
  const { accessToken, user, isLoading: authLoading } = useAuth()
  const [title, setTitle] = useState(() => {
    const defaultQuestions = t('createVoting.defaultQuestions', { returnObjects: true }) as string[]
    const randomQuestion = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)]
    return randomQuestion
  })
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [duration, setDuration] = useState<number>(24) // По умолчанию 1 сутки (24 часа)
  const [isPublic, setIsPublic] = useState<boolean>(true) // По умолчанию публичное
  const [comment, setComment] = useState<string>('')
  const [showComment, setShowComment] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Периоды голосования в часах
  const durationOptions = [
    { value: 0.167, label: t('createVoting.durationOptions.10m') },
    { value: 1, label: t('createVoting.durationOptions.1h') },
    { value: 2, label: t('createVoting.durationOptions.2h') },
    { value: 3, label: t('createVoting.durationOptions.3h') },
    { value: 5, label: t('createVoting.durationOptions.5h') },
    { value: 8, label: t('createVoting.durationOptions.8h') },
    { value: 24, label: t('createVoting.durationOptions.1d') },
    { value: 168, label: t('createVoting.durationOptions.7d') }
  ]

  // Опции видимости
  const privacyOptions = [
    { value: true, label: t('createVoting.privacyOptions.public') },
    { value: false, label: t('createVoting.privacyOptions.private'), icon: EyeOff }
  ]

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (title.trim() && mediaFiles.length >= 2 && !loading) {
          handleSubmit(event as any)
        }
      }
    }

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
      if (imageItems.length === 0) return

      event.preventDefault()
      handleClipboardImages(imageItems)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
    }
  }, [title, mediaFiles, loading])

  const handleDrop = async (acceptedFiles: File[]) => {
    setError('')
    setSuccess(false)
    const newMediaFiles: MediaFile[] = [...mediaFiles]

    for (const file of acceptedFiles) {
      if (newMediaFiles.length >= 10) {
        setError(t('createVoting.maxFilesError'))
        break
      }
      
      if (file.size > 20 * 1024 * 1024) {
        setError(t('createVoting.fileSizeError'))
        continue
      }
      
      // Проверяем тип файла, включая HEIC файлы которые могут иметь пустой MIME тип
      const isHeicFile = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !isHeicFile) {
        setError(t('createVoting.fileTypeError'))
        continue
      }
      
      try {
        const dimensions = await getMediaDimensions(file)
        newMediaFiles.push({ file, dimensions })
      } catch (error) {
        console.error(`[CreateVoting] Failed to get dimensions for ${file.name}:`, error)
        newMediaFiles.push({ file, dimensions: null })
      }
    }
    setMediaFiles(newMediaFiles.slice(0, 10))
  }

  const handleError = (error: Error) => {
    setError(error.message)
  }

  const handleClipboardImages = async (imageItems: DataTransferItem[]) => {
    setError('')
    setSuccess(false)
    const newMediaFiles: MediaFile[] = [...mediaFiles]

    for (const item of imageItems) {
      if (newMediaFiles.length >= 10) {
        setError(t('createVoting.maxFilesError'))
        break
      }

      const file = item.getAsFile()
      if (!file) continue

      if (file.size > 20 * 1024 * 1024) {
        setError(t('createVoting.fileSizeError'))
        continue
      }

      try {
        // Создаем временное имя файла с указанием источника (clipboard)
        const timestamp = Date.now()
        const extension = file.type.split('/')[1] || 'png'
        const clipboardFile = new File([file], `clipboard-${timestamp}.${extension}`, {
          type: file.type,
          lastModified: file.lastModified
        })

        const dimensions = await getMediaDimensions(clipboardFile)
        newMediaFiles.push({ file: clipboardFile, dimensions })
      } catch (error) {
        console.error(`[CreateVoting] Failed to process clipboard image:`, error)
        // Создаем файл без анализа размеров, если не удалось их получить
        const timestamp = Date.now()
        const extension = file.type.split('/')[1] || 'png'
        const clipboardFile = new File([file], `clipboard-${timestamp}.${extension}`, {
          type: file.type,
          lastModified: file.lastModified
        })
        newMediaFiles.push({ file: clipboardFile, dimensions: null })
      }
    }
    setMediaFiles(newMediaFiles.slice(0, 10))
  }

  const removeMedia = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
    setSuccess(false)
  }

  const handleAddComment = () => {
    setShowComment(true)
    // Фокусируемся на textarea после рендера
    setTimeout(() => {
      commentTextareaRef.current?.focus()
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError(t('createVoting.titleRequired'))
      return
    }
    
    if (mediaFiles.length < 2) {
      setError(t('createVoting.minFilesError'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('duration', duration.toString())
      formData.append('isPublic', isPublic.toString())
      if (comment.trim()) {
        formData.append('comment', comment.trim())
      }
      mediaFiles.forEach(mediaFile => {
        formData.append('images', mediaFile.file)
      })

      const headers: HeadersInit = {}
      if (user && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(`${configManager.getApiUrl()}/votings`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle rate limiting errors with localized messages
        let errorMessage = errorData.error || 'Ошибка создания голосования'
        
        if (errorData.error === 'RATE_LIMIT_MINUTE_EXCEEDED') {
          errorMessage = t('createVoting.rateLimitMinuteExceeded')
        } else if (errorData.error === 'RATE_LIMIT_HOUR_EXCEEDED') {
          errorMessage = t('createVoting.rateLimitHourExceeded')
        } else if (errorData.error === 'RATE_LIMIT_EXCEEDED') {
          errorMessage = t('createVoting.rateLimitExceeded')
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (user && !authLoading) {
        // Если пользователь авторизован, переходим на страницу голосования
        navigate(`/v/${data.voting.id}`, { 
          state: { isPrivate: !isPublic } 
        })
      } else {
        // Если пользователь не авторизован, показываем сообщение с кнопкой входа
        setError('') // Очищаем ошибки
        setSuccess(true)
        // Очищаем форму после успешного создания
        setTitle('')
        setMediaFiles([])
        setComment('')
        setShowComment(false)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка создания голосования')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="max-w-none mx-auto p-4 w-full flex-shrink-0">
        <div className="flex justify-between items-center h-16 mb-4">
          <Input
            ref={titleInputRef}
            id="title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSuccess(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim() && mediaFiles.length >= 2 && !loading) {
                handleSubmit(e as any)
              }
            }}
            className="text-3xl h-16 flex-1 mr-1"
            required
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-16 w-16"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap">
              {durationOptions.map((option, index) => (
                <Toggle
                  key={option.value}
                  pressed={duration === option.value}
                  onPressedChange={() => {
                    setDuration(option.value)
                    setSuccess(false)
                  }}
                  variant="outline"
                  className={`px-4 py-2 ${index === 0 ? 'rounded-l-md rounded-r-none' : ''} ${index === durationOptions.length - 1 ? 'rounded-r-md rounded-l-none' : ''} ${index > 0 && index < durationOptions.length - 1 ? 'rounded-none' : ''} ${index > 0 ? '-ml-px' : ''}`}
                >
                  {option.label}
                </Toggle>
              ))}
            </div>
            
            <div className="w-6"></div>
            
            <div className="flex flex-wrap">
              {privacyOptions.map((option, index) => {
                const IconComponent = option.icon
                return (
                  <Toggle
                    key={option.value.toString()}
                    pressed={isPublic === option.value}
                    onPressedChange={() => {
                      setIsPublic(option.value)
                      setSuccess(false)
                    }}
                    variant="outline"
                    className={`px-4 py-2 ${index === 0 ? 'rounded-l-md rounded-r-none' : ''} ${index === privacyOptions.length - 1 ? 'rounded-r-md rounded-l-none' : ''} ${index > 0 && index < privacyOptions.length - 1 ? 'rounded-none' : ''} ${index > 0 ? '-ml-px' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {IconComponent && <IconComponent className="h-4 w-4" />}
                      {option.label}
                    </div>
                  </Toggle>
                )
              })}
            </div>

            <div className="w-6"></div>

            {!showComment && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddComment}
                className="gap-2 px-4 py-2 h-10"
              >
                <NotebookPen className="h-4 w-4" />
                {t('createVoting.addComment')}
              </Button>
            )}
          </div>

          {showComment && (
            <div>
              <Textarea
                ref={commentTextareaRef}
                placeholder={t('createVoting.commentPlaceholder')}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value)
                  setSuccess(false)
                }}
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-none mx-auto px-4 w-full flex flex-col">
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          <div className="flex-1 mb-4 flex flex-col">
            <div className="flex-1 relative">
              <Dropzone
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif'],
                  'video/*': ['.mp4', '.webm', '.mov', '.avi']
                }}
                maxFiles={10}
                maxSize={20 * 1024 * 1024} // 20MB
                onDrop={handleDrop}
                onError={handleError}
                className="absolute inset-0"
              >
                <DropzoneEmptyState />
              </Dropzone>
            </div>

            {mediaFiles.length > 0 && (
              <div className="overflow-x-auto bg-background/80 backdrop-blur-sm mt-4 scrollbar-adaptive">
                <div className="flex gap-4 py-2">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative group flex-shrink-0 w-auto max-h-60 max-w-80 flex items-center justify-center">
                      {getMediaType(media.file) === 'image' ? (
                        isHeicFile(media.file) && !isSafari() ? (
                          // Для HEIC файлов в не-Safari браузерах показываем только название
                          <div className="max-h-60 h-full w-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center p-8">
                            <div className="text-center">
                              <Image className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" strokeWidth={1} />
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {media.file.name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <HiDPIImage
                            src={URL.createObjectURL(media.file)}
                            width={media.dimensions?.width || 0}
                            height={media.dimensions?.height || 0}
                            pixelRatio={parsePixelRatioFromName(media.file.name)}
                            fit="contain"
                            alt={`${t('createVoting.option')} ${index + 1}`}
                            className="max-h-60 w-auto object-contain rounded"
                          />
                        )
                      ) : (
                        <VideoPlayer
                          src={URL.createObjectURL(media.file)}
                          width={media.dimensions?.width || 0}
                          height={media.dimensions?.height || 0}
                          fit="contain"
                          className="max-h-60 w-auto rounded"
                        />
                      )}
                      <div className="absolute top-1 right-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeMedia(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-destructive text-sm mb-4">{error}</div>
          )}

          {success && (
            <div className="text-green-600 text-sm mb-4">
              {t('createVoting.successMessage')}
            </div>
          )}

          <div className="flex-shrink-0 pb-4">
            <Button
              type="submit"
              disabled={loading || !title.trim() || mediaFiles.length < 2}
              className="w-full h-40 text-xl font-semibold"
            >
              {loading ? t('createVoting.creating') : t('createVoting.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

