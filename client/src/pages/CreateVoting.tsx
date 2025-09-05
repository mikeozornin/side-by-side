import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'
import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'
import { getMediaType, getMediaDimensions, parsePixelRatioFromName } from '@/lib/mediaUtils'
import { useTranslation } from 'react-i18next'

export function CreateVoting() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => {
    const defaultQuestions = t('createVoting.defaultQuestions', { returnObjects: true }) as string[]
    const randomQuestion = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)]
    return randomQuestion
  })
  const [media1, setMedia1] = useState<File[] | undefined>()
  const [media2, setMedia2] = useState<File[] | undefined>()
  const [media1Dimensions, setMedia1Dimensions] = useState<{width: number, height: number} | null>(null)
  const [media2Dimensions, setMedia2Dimensions] = useState<{width: number, height: number} | null>(null)
  const [duration, setDuration] = useState<number>(24) // По умолчанию 1 сутки (24 часа)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const titleInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        // Cmd+Enter на Mac или Ctrl+Enter на Windows/Linux
        if (title.trim() && media1 && media2 && media1.length > 0 && media2.length > 0 && !loading) {
          handleSubmit(event as any)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, media1, media2, loading])

  // Глобальный обработчик вставки для автоматического выбора dropzone
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile()
          if (!file) continue

          // Проверяем размер файла (20MB)
          if (file.size > 20 * 1024 * 1024) {
            setError(t('createVoting.fileSizeError'))
            return
          }
          
          // Проверяем тип файла
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            setError(t('createVoting.fileTypeError'))
            return
          }

          setError('')
          
          // Автоматически выбираем первый пустой dropzone
          if (!media1 || media1.length === 0) {
            setMedia1([file])
            try {
              const dimensions = await getMediaDimensions(file)
              setMedia1Dimensions(dimensions)
            } catch (error) {
              console.error('Failed to get dimensions:', error)
              setMedia1Dimensions(null)
            }
          } else if (!media2 || media2.length === 0) {
            setMedia2([file])
            try {
              const dimensions = await getMediaDimensions(file)
              setMedia2Dimensions(dimensions)
            } catch (error) {
              console.error('Failed to get dimensions:', error)
              setMedia2Dimensions(null)
            }
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [media1, media2, t])



  const handleDrop = (setter: (files: File[] | undefined) => void, dimensionSetter: (dimensions: {width: number, height: number} | null) => void) => async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0]
      // Проверка размера файла (20MB)
      if (file.size > 20 * 1024 * 1024) {
        setError(t('createVoting.fileSizeError'))
        return
      }
      
      // Проверка типа файла
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError(t('createVoting.fileTypeError'))
        return
      }
      
      setError('')
      setter(files)
      
      // Получаем размеры медиафайла
      try {
        const dimensions = await getMediaDimensions(file)
        console.log(`[CreateVoting] Media dimensions for ${file.name}:`, dimensions)
        dimensionSetter(dimensions)
      } catch (error) {
        console.error(`[CreateVoting] Failed to get dimensions for ${file.name}:`, error)
        dimensionSetter(null)
      }
    }
  }

  const handleError = (error: Error) => {
    setError(error.message)
  }

  const removeMedia = (setter: (files: File[] | undefined) => void, dimensionSetter: (dimensions: {width: number, height: number} | null) => void) => () => {
    setter(undefined)
    dimensionSetter(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError(t('createVoting.titleRequired'))
      return
    }
    
    if (!media1 || !media2 || media1.length === 0 || media2.length === 0) {
      setError(t('createVoting.imagesRequired'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('image1', media1[0])
      formData.append('image2', media2[0])
      formData.append('duration', duration.toString())

      const response = await fetch('/api/votings', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка создания голосования')
      }

      const data = await response.json()
      navigate(`/v/${data.voting.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка создания голосования')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="max-w-none mx-auto p-4 w-full flex-shrink-0">
        <div className="flex items-center mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <Input
            ref={titleInputRef}
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl h-16"
            required
          />
          
          <div className="space-y-2">
            <div className="flex flex-wrap">
              {durationOptions.map((option, index) => (
                <Toggle
                  key={option.value}
                  pressed={duration === option.value}
                  onPressedChange={() => setDuration(option.value)}
                  variant="outline"
                  className={`px-4 py-2 ${index === 0 ? 'rounded-l-md rounded-r-none' : ''} ${index === durationOptions.length - 1 ? 'rounded-r-md rounded-l-none' : ''} ${index > 0 && index < durationOptions.length - 1 ? 'rounded-none' : ''} ${index > 0 ? '-ml-px' : ''}`}
                >
                  {option.label}
                </Toggle>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-none mx-auto px-4 w-full">
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Dropzone
                  accept={{ 
                    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
                    'video/*': ['.mp4', '.webm', '.mov', '.avi']
                  }}
                  maxFiles={1}
                  maxSize={20 * 1024 * 1024} // 20MB
                  onDrop={handleDrop(setMedia1, setMedia1Dimensions)}
                  onError={handleError}
                  src={media1}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {media1 && media1.length > 0 && (
                      <div className="flex flex-col items-center space-y-2 w-full min-w-0">
                        {getMediaType(media1[0]) === 'image' ? (
                          <HiDPIImage
                            src={URL.createObjectURL(media1[0])}
                            width={media1Dimensions?.width || 0}
                            height={media1Dimensions?.height || 0}
                            pixelRatio={parsePixelRatioFromName(media1[0].name)}
                            fit="contain"
                            alt={t('createVoting.option1')}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        ) : (
                          <VideoPlayer
                            src={URL.createObjectURL(media1[0])}
                            width={media1Dimensions?.width || 0}
                            height={media1Dimensions?.height || 0}
                            fit="contain"
                            className="max-w-full max-h-full rounded"
                          />
                        )}
                        <p className="text-sm text-muted-foreground text-center truncate w-full" title={media1[0].name}>{media1[0].name}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeMedia(setMedia1, setMedia1Dimensions)()
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('createVoting.remove')}
                        </Button>
                      </div>
                    )}
                  </DropzoneContent>
                </Dropzone>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Dropzone
                  accept={{ 
                    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
                    'video/*': ['.mp4', '.webm', '.mov', '.avi']
                  }}
                  maxFiles={1}
                  maxSize={20 * 1024 * 1024} // 20MB
                  onDrop={handleDrop(setMedia2, setMedia2Dimensions)}
                  onError={handleError}
                  src={media2}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {media2 && media2.length > 0 && (
                      <div className="flex flex-col items-center space-y-2 w-full min-w-0">
                        {getMediaType(media2[0]) === 'image' ? (
                          <HiDPIImage
                            src={URL.createObjectURL(media2[0])}
                            width={media2Dimensions?.width || 0}
                            height={media2Dimensions?.height || 0}
                            pixelRatio={parsePixelRatioFromName(media2[0].name)}
                            fit="contain"
                            alt={t('createVoting.option2')}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        ) : (
                          <VideoPlayer
                            src={URL.createObjectURL(media2[0])}
                            width={media2Dimensions?.width || 0}
                            height={media2Dimensions?.height || 0}
                            fit="contain"
                            className="max-w-full max-h-full rounded"
                          />
                        )}
                        <p className="text-sm text-muted-foreground text-center truncate w-full" title={media2[0].name}>{media2[0].name}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeMedia(setMedia2, setMedia2Dimensions)()
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('createVoting.remove')}
                        </Button>
                      </div>
                    )}
                  </DropzoneContent>
                </Dropzone>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm mb-4">{error}</div>
          )}

          <div className="flex-shrink-0 pb-4">
            <Button
              type="submit"
              disabled={loading || !title.trim() || !media1 || !media2 || media1.length === 0 || media2.length === 0}
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

