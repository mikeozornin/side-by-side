import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'
import HiDPIImage from '@/components/ui/HiDPIImage'
import { useTranslation } from 'react-i18next'

export function CreateVoting() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => {
    const defaultQuestions = t('createVoting.defaultQuestions', { returnObjects: true }) as string[]
    const randomQuestion = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)]
    return randomQuestion
  })
  const [image1, setImage1] = useState<File[] | undefined>()
  const [image2, setImage2] = useState<File[] | undefined>()
  const [image1Dimensions, setImage1Dimensions] = useState<{width: number, height: number} | null>(null)
  const [image2Dimensions, setImage2Dimensions] = useState<{width: number, height: number} | null>(null)
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
        if (title.trim() && image1 && image2 && image1.length > 0 && image2.length > 0 && !loading) {
          handleSubmit(event as any)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, image1, image2, loading])

  const parsePixelRatioFromName = (fileName: string): number => {
    const match = fileName.match(/@(\d+(?:\.\d+)?)x\./i)
    if (match) {
      const parsed = Number(match[1])
      if (!Number.isNaN(parsed) && parsed > 0) {
        console.log(`[CreateVoting] Parsed pixelRatio from ${fileName}: ${parsed}`)
        return parsed
      }
    }
    console.log(`[CreateVoting] No pixelRatio found in ${fileName}, using 1`)
    return 1
  }

  const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  const handleDrop = (setter: (files: File[] | undefined) => void, dimensionSetter: (dimensions: {width: number, height: number} | null) => void) => async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0]
      // Проверка размера файла (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('createVoting.fileSizeError'))
        return
      }
      
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        setError(t('createVoting.fileTypeError'))
        return
      }
      
      setError('')
      setter(files)
      
      // Получаем размеры изображения
      try {
        const dimensions = await getImageDimensions(file)
        console.log(`[CreateVoting] Image dimensions for ${file.name}:`, dimensions)
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

  const removeImage = (setter: (files: File[] | undefined) => void, dimensionSetter: (dimensions: {width: number, height: number} | null) => void) => () => {
    setter(undefined)
    dimensionSetter(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError(t('createVoting.titleRequired'))
      return
    }
    
    if (!image1 || !image2 || image1.length === 0 || image2.length === 0) {
      setError(t('createVoting.imagesRequired'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('image1', image1[0])
      formData.append('image2', image2[0])
      formData.append('duration', duration.toString())

      const response = await fetch('/api/votings', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка создания голосования')
      }

      await response.json()
      navigate('/')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка создания голосования')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="max-w-none mx-auto p-6 w-full flex-shrink-0">
        <div className="flex items-center mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <Input
            ref={titleInputRef}
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl h-16"
            required
          />
          
          <div className="space-y-3">
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

      <div className="flex-1 max-w-none mx-auto px-6 w-full">
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Dropzone
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
                  maxFiles={1}
                  maxSize={10 * 1024 * 1024} // 10MB
                  onDrop={handleDrop(setImage1, setImage1Dimensions)}
                  onError={handleError}
                  src={image1}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {image1 && image1.length > 0 && (
                      <div className="space-y-2 h-full flex flex-col w-full min-w-0">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <HiDPIImage
                            src={URL.createObjectURL(image1[0])}
                            width={image1Dimensions?.width || 0}
                            height={image1Dimensions?.height || 0}
                            pixelRatio={parsePixelRatioFromName(image1[0].name)}
                            fit="contain"
                            alt={t('createVoting.option1')}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                        <div className="space-y-2 w-full min-w-0">
                          <p className="text-sm text-muted-foreground text-center truncate w-full" title={image1[0].name}>{image1[0].name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage(setImage1, setImage1Dimensions)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {t('createVoting.remove')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </DropzoneContent>
                </Dropzone>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Dropzone
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
                  maxFiles={1}
                  maxSize={10 * 1024 * 1024} // 10MB
                  onDrop={handleDrop(setImage2, setImage2Dimensions)}
                  onError={handleError}
                  src={image2}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {image2 && image2.length > 0 && (
                      <div className="space-y-2 h-full flex flex-col w-full min-w-0">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <HiDPIImage
                            src={URL.createObjectURL(image2[0])}
                            width={image2Dimensions?.width || 0}
                            height={image2Dimensions?.height || 0}
                            pixelRatio={parsePixelRatioFromName(image2[0].name)}
                            fit="contain"
                            alt={t('createVoting.option2')}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                        <div className="space-y-2 w-full min-w-0">
                          <p className="text-sm text-muted-foreground text-center truncate w-full" title={image2[0].name}>{image2[0].name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage(setImage2, setImage2Dimensions)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {t('createVoting.remove')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </DropzoneContent>
                </Dropzone>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm mb-6">{error}</div>
          )}

          <div className="flex-shrink-0 pb-6">
            <Button
              type="submit"
              disabled={loading || !title.trim() || !image1 || !image2 || image1.length === 0 || image2.length === 0}
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

