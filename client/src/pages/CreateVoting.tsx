import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/dropzone'

const defaultQuestions = [
  'Какой вариант лучше?',
  'Левый или правый?',
  'Какой дизайн вам больше нравится?',
  'Какой вариант лучше?',
  'Что бы вы выбрали?',
  'Что предпочтете?'
]

export function CreateVoting() {
  const [title, setTitle] = useState(() => {
    const randomQuestion = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)]
    return randomQuestion
  })
  const [image1, setImage1] = useState<File[] | undefined>()
  const [image2, setImage2] = useState<File[] | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  const handleDrop = (setter: (files: File[] | undefined) => void) => (files: File[]) => {
    if (files.length > 0) {
      const file = files[0]
      // Проверка размера файла (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10 МБ')
        return
      }
      
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        setError('Выберите файл изображения')
        return
      }
      
      setError('')
      setter(files)
    }
  }

  const handleError = (error: Error) => {
    setError(error.message)
  }

  const removeImage = (setter: (files: File[] | undefined) => void) => () => {
    setter(undefined)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Введите название голосования')
      return
    }
    
    if (!image1 || !image2 || image1.length === 0 || image2.length === 0) {
      setError('Загрузите оба изображения')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('image1', image1[0])
      formData.append('image2', image2[0])

      const response = await fetch('/api/votings', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка создания голосования')
      }

      const data = await response.json()
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

        <div>
          <Input
            ref={titleInputRef}
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl h-16"
            required
          />
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
                  onDrop={handleDrop(setImage1)}
                  onError={handleError}
                  src={image1}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {image1 && image1.length > 0 && (
                      <div className="space-y-2 h-full flex flex-col w-full min-w-0">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={URL.createObjectURL(image1[0])}
                            alt="Вариант 1"
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                        <div className="space-y-2 w-full min-w-0">
                          <p className="text-sm text-muted-foreground text-center truncate w-full" title={image1[0].name}>{image1[0].name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage(setImage1)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Удалить
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
                  onDrop={handleDrop(setImage2)}
                  onError={handleError}
                  src={image2}
                  className="h-full"
                >
                  <DropzoneEmptyState />
                  <DropzoneContent>
                    {image2 && image2.length > 0 && (
                      <div className="space-y-2 h-full flex flex-col w-full min-w-0">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={URL.createObjectURL(image2[0])}
                            alt="Вариант 2"
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                        <div className="space-y-2 w-full min-w-0">
                          <p className="text-sm text-muted-foreground text-center truncate w-full" title={image2[0].name}>{image2[0].name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage(setImage2)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Удалить
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
              {loading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

