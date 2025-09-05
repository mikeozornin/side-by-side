import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Dropzone, DropzoneEmptyState } from '@/components/ui/dropzone'
import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'
import { getMediaType, getMediaDimensions, parsePixelRatioFromName } from '@/lib/mediaUtils'
import { useTranslation } from 'react-i18next'

interface MediaFile {
  file: File;
  dimensions: { width: number; height: number } | null;
}

export function CreateVoting() {
  const { t } = useTranslation()
  const [title, setTitle] = useState(() => {
    const defaultQuestions = t('createVoting.defaultQuestions', { returnObjects: true }) as string[]
    const randomQuestion = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)]
    return randomQuestion
  })
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [duration, setDuration] = useState<number>(24) // По умолчанию 1 сутки (24 часа)
  const [isPublic, setIsPublic] = useState<boolean>(true) // По умолчанию публичное
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, mediaFiles, loading])

  const handleDrop = async (acceptedFiles: File[]) => {
    setError('')
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
      
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
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

  const removeMedia = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
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
      mediaFiles.forEach(mediaFile => {
        formData.append('images', mediaFile.file)
      })

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
        <div className="flex justify-between items-center h-16 mb-4">
          <Input
            ref={titleInputRef}
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim() && mediaFiles.length >= 2 && !loading) {
                handleSubmit(e as any)
              }
            }}
            className="text-3xl h-16 flex-1 mr-4"
            required
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
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
            
            <div className="w-6"></div>
            
            {privacyOptions.map((option, index) => {
              const IconComponent = option.icon
              return (
                <Toggle
                  key={option.value.toString()}
                  pressed={isPublic === option.value}
                  onPressedChange={() => setIsPublic(option.value)}
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
        </div>
      </div>

      <div className="flex-1 max-w-none mx-auto px-4 w-full flex flex-col">
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          <div className="flex-1 mb-4 flex flex-col">
            <div className="flex-1 relative">
              <Dropzone
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
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
                    <div key={index} className="relative group flex-shrink-0 max-h-60">
                      {getMediaType(media.file) === 'image' ? (
                        <HiDPIImage
                          src={URL.createObjectURL(media.file)}
                          width={media.dimensions?.width || 0}
                          height={media.dimensions?.height || 0}
                          pixelRatio={parsePixelRatioFromName(media.file.name)}
                          fit="contain"
                          alt={`${t('createVoting.option')} ${index + 1}`}
                          className="max-h-60 w-auto object-contain rounded"
                        />
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

