import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, X, Check, Medal, Clock, Share, Trash2, Clock12, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/AuthModal'
import { isSafari } from '@/lib/mediaUtils'

// Функция для проверки, является ли файл HEIC по расширению
function isHeicFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.heic') || filePath.toLowerCase().endsWith('.heif')
}

interface VotingOption {
  id: number;
  voting_id: string;
  file_path: string;
  pixel_ratio: number;
  width: number;
  height: number;
  media_type: 'image' | 'video';
}

interface Voting {
  id: string
  title: string
  created_at: string
  end_at: string
  isPublic: boolean
  user_id: string | null
  user_email?: string | null
  comment?: string | null
  options: VotingOption[]
}

interface Result {
  option_id: number;
  file_path: string;
  count: number;
  percentage: number;
}

interface Results {
  totalVotes: number
  results: Result[]
  winner: number | 'tie' | null
}

interface VotingResponse {
  voting: Voting
  results: Results | null
  hasVoted: boolean
  selectedOption?: number | null
}

export function VotingPage() {
  const { t } = useTranslation()
  const { user, accessToken, isAnonymous, authMode } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [voting, setVoting] = useState<Voting | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [votingLoading, setVotingLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [notificationShown, setNotificationShown] = useState(false)
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false)
  const [endEarlyPopoverOpen, setEndEarlyPopoverOpen] = useState(false)
  const [endEarlyLoading, setEndEarlyLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftShadow, setShowLeftShadow] = useState(false)
  const [showRightShadow, setShowRightShadow] = useState(false)
  const [maxImageHeight, setMaxImageHeight] = useState<number>(0)

  const shuffledOptions = useMemo(() => {
    if (!voting) return []
    
    // Если есть результаты, сортируем по количеству голосов (убывание)
    if (results && results.results.length > 0) {
      return [...voting.options].sort((a, b) => {
        const resultA = results.results.find(r => r.option_id === a.id)
        const resultB = results.results.find(r => r.option_id === b.id)
        const countA = resultA?.count || 0
        const countB = resultB?.count || 0
        return countB - countA // Сортируем по убыванию
      })
    }
    
    // Если результатов нет, перемешиваем массив опций
    return [...voting.options].sort(() => Math.random() - 0.5)
  }, [voting, results])

  // Проверяем, является ли пользователь владельцем голосования
  const isOwner = user && voting && voting.user_id === user.id

  const isFinished = (endAt: string) => {
    return new Date(endAt) <= new Date()
  }

  const getTimeRemaining = (endAt: string) => {
    const endTime = new Date(endAt)
    const timeDiff = endTime.getTime() - currentTime.getTime()
    
    if (timeDiff <= 0) return t('voting.finished')
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
    
    if (days > 0) {
      return t('voting.timeRemaining.days', { days, hours, minutes })
    } else if (hours > 0) {
      return t('voting.timeRemaining.hours', { hours, minutes, seconds })
    } else if (minutes > 0) {
      return t('voting.timeRemaining.minutes', { minutes, seconds })
    } else {
      return t('voting.timeRemaining.seconds', { seconds })
    }
  }

  useEffect(() => {
    if (id) {
      fetchVoting()
      checkVotedStatus()
    }
  }, [id])

  // Показываем уведомление для приватных голосований
  useEffect(() => {
    // Проверяем, пришли ли мы с CreateVoting с информацией о приватности
    const isPrivateFromNavigation = location.state?.isPrivate
    if (isPrivateFromNavigation && !notificationShown) {
      toast.info(t('createVoting.privateVotingNotification'), {
        duration: 10000 // 10 секунд вместо стандартных 4
      })
      setNotificationShown(true)
    }
  }, [location.state, t, notificationShown])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Вычисляем максимальную высоту картинок с учетом ретиновости
  useEffect(() => {
    if (!voting?.options) return

    const calculateMaxHeight = () => {
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
      const maxViewportHeight = viewportHeight * 0.8 // 80% от viewport
      
      let maxHeight = 0
      
      voting.options.forEach(option => {
        // Учитываем ретиновость (pixel_ratio) - берем реальный размер в пикселях
        const realHeight = option.height / option.pixel_ratio
        maxHeight = Math.max(maxHeight, realHeight)
      })
      
      // Ограничиваем максимальной высотой viewport, но не растягиваем маленькие картинки
      const finalHeight = Math.min(maxHeight, maxViewportHeight)
      setMaxImageHeight(finalHeight)
    }

    calculateMaxHeight()
    
    // Пересчитываем при изменении размера окна
    window.addEventListener('resize', calculateMaxHeight)
    return () => window.removeEventListener('resize', calculateMaxHeight)
  }, [voting?.options])

  // Вычисляем finished здесь, чтобы использовать в useEffect
  const finished = voting ? isFinished(voting.end_at) : false

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (finished || hasVoted) return
      
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (selectedChoice !== null) {
          handleVote()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [finished, hasVoted, selectedChoice])

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      const tolerance = 1
      setShowLeftShadow(scrollLeft > tolerance)
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - tolerance)
    }
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      // Use a timeout to ensure layout is stable after options render
      const timer = setTimeout(() => {
        checkScroll()
      }, 100)

      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)

      return () => {
        clearTimeout(timer)
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [shuffledOptions])

  // Синхронизация статуса голосования между вкладками
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!id) return
      if (e.key === `voted_${id}`) {
        const voted = localStorage.getItem(`voted_${id}`) !== null
        setHasVoted(voted)
        if (voted) {
          const voteData = JSON.parse(localStorage.getItem(`voted_${id}`) || '{}')
          if (voteData?.optionId) setSelectedChoice(voteData.optionId)
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id])

  const fetchVoting = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Добавляем токен авторизации если пользователь авторизован
      if (accessToken && !isAnonymous) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(`/api/votings/${id}`, { headers })
      if (!response.ok) {
        throw new Error(t('voting.notFound'))
      }
      const data: VotingResponse = await response.json()
      setVoting(data.voting)
      
      // Результаты приходят вместе с данными голосования, если оно завершено
      if (data.results) {
        setResults(data.results)
      }

      // В неанонимном режиме используем флаг с сервера, в анонимном - localStorage
      if (authMode === 'magic-links' && !isAnonymous) {
        setHasVoted(data.hasVoted)
        if (data.hasVoted) {
          // Если сервер прислал выбранный вариант — используем его
          if (typeof data.selectedOption === 'number') {
            setSelectedChoice(data.selectedOption)
          } else {
            // Иначе пробуем из localStorage (на случай старых голосов)
            const voteData = JSON.parse(localStorage.getItem(`voted_${id}`) || '{}')
            if (voteData?.optionId) setSelectedChoice(voteData.optionId)
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('voting.errorLoading'))
    } finally {
      setLoading(false)
    }
  }


  const checkVotedStatus = () => {
    // В анонимном режиме проверяем localStorage
    if (authMode === 'anonymous') {
      const voted = localStorage.getItem(`voted_${id}`) !== null
      setHasVoted(voted)
      
      if (voted) {
        const voteData = JSON.parse(localStorage.getItem(`voted_${id}`) || '{}')
        setSelectedChoice(voteData.optionId)
      }
    }
    // В неанонимном режиме статус голосования приходит с сервера в fetchVoting
  }

  const handleVote = async () => {
    if (selectedChoice === null || !id) return

    // Проверяем авторизацию в неанонимном режиме
    if (authMode === 'magic-links' && !isAnonymous && !user) {
      setAuthModalOpen(true)
      return
    }

    setVotingLoading(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Добавляем токен авторизации если пользователь авторизован
      if (accessToken && !isAnonymous) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(`/api/votings/${id}/vote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ optionId: selectedChoice }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errMsg: string = errorData?.error || ''
        const isAlreadyVoted = typeof errMsg === 'string' && (errMsg.includes('Уже') || errMsg.includes('голосовали') || errMsg.toLowerCase().includes('already'))
        if (isAlreadyVoted) {
          setHasVoted(true)
          // Пытаемся отобразить выбор
          const voteData = JSON.parse(localStorage.getItem(`voted_${id}`) || '{}')
          if (voteData?.optionId) setSelectedChoice(voteData.optionId)
          // Показываем информ-модалку вместо перехода на отдельную страницу
          setInfoMessage(t('voting.alreadyVoted'))
          setInfoModalOpen(true)
          return
        }
        throw new Error(errMsg || t('voting.errorVoting'))
      }

      // Сохраняем в IndexedDB (используем localStorage как fallback)
      localStorage.setItem(`voted_${id}`, JSON.stringify({
        optionId: selectedChoice,
        at: new Date().toISOString()
      }))

      setHasVoted(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('voting.errorVoting'))
    } finally {
      setVotingLoading(false)
    }
  }

  const getImageUrl = (imagePath: string) => {
    const fileName = imagePath.split('/').pop()
    return `/api/images/${fileName}`
  }

  const handleShare = async () => {
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      toast.success(t('voting.linkCopied'))
    } catch (error) {
      console.error('Failed to copy link:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = window.location.href
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success(t('voting.linkCopied'))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!id || !accessToken) return

    setDeleteLoading(true)
    setDeletePopoverOpen(false)
    
    try {
      const response = await fetch(`/api/votings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('voting.deleteError'))
      }

      navigate('/')
    } catch (error) {
      console.error('Error deleting voting:', error)
      toast.error(error instanceof Error ? error.message : t('voting.deleteError'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleEndEarlyConfirm = async () => {
    if (!id || !accessToken) return

    setEndEarlyLoading(true)
    setEndEarlyPopoverOpen(false)
    
    try {
      const response = await fetch(`/api/votings/${id}/end-early`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('voting.endEarlyError'))
      }

      // Обновляем данные голосования
      await fetchVoting()
    } catch (error) {
      console.error('Error ending voting early:', error)
      toast.error(error instanceof Error ? error.message : t('voting.endEarlyError'))
    } finally {
      setEndEarlyLoading(false)
    }
  }

  const handleAuthModalClose = () => {
    setAuthModalOpen(false)
  }

  const handleAuthSuccess = () => {
    setAuthModalOpen(false)
    // После успешной авторизации повторно пытаемся проголосовать
    if (selectedChoice !== null) {
      handleVote()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('voting.loading')}</div>
        </div>
      </div>
    )
  }

  if (error || !voting) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">{t('voting.error')}</h1>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-destructive mb-4">{error || t('voting.notFound')}</p>
              <Button onClick={() => navigate('/')}>{t('voting.backToHome')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }



  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-none mx-auto pt-6 px-6 w-full flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h1 className="text-3xl font-bold" title={voting.title}>{voting.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && !finished && (
              <Popover open={endEarlyPopoverOpen} onOpenChange={setEndEarlyPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={endEarlyPopoverOpen ? "default" : "ghost"}
                    size="sm"
                    disabled={endEarlyLoading}
                    className="gap-2"
                  >
                    <Clock12 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('voting.endEarly')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-snug">{t('voting.endEarlyQuestion')}</h4>
                    </div>
                    <div className="flex justify-start">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleEndEarlyConfirm}
                        disabled={endEarlyLoading}
                      >
                        {t('voting.endEarlyConfirmButton')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isOwner && (
              <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={deletePopoverOpen ? "default" : "ghost"}
                    size="sm"
                    disabled={deleteLoading}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('voting.delete')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-snug">{t('voting.deleteQuestion')}</h4>
                    </div>
                    <div className="flex justify-start">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleDeleteConfirm}
                        disabled={deleteLoading}
                      >
                        {t('voting.deleteConfirmButton')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share className="h-4 w-4" />
              <span className="hidden sm:inline">{t('voting.share')}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
        
        {/* Выносим комментарий и время из блока с заголовком */}
        {voting.comment && voting.comment.trim() && (
          <div className="mt-3 mb-3">
            <p className="text-sm max-w-none whitespace-pre-wrap">{voting.comment}</p>
          </div>
        )}
        
        {!finished && (
          <div className="flex items-center gap-2 mt-2 mb-3 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono">
              {getTimeRemaining(voting.end_at)}
              {voting.user_email && ` · ${voting.user_email}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 max-w-none mx-auto px-6 w-full">
        <div className="flex flex-col">
          <div className="relative mb-6">
            {showLeftShadow && <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-10" />}
            <div ref={scrollContainerRef} className="flex items-center overflow-x-auto overflow-y-hidden scrollbar-adaptive" style={{ height: `${Math.min(maxImageHeight, typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600)}px` }}>
              {shuffledOptions.map((option, index) => {
                const result = results?.results.find(r => r.option_id === option.id)
                
                return (
                  <div key={option.id} className="flex flex-col h-full flex-shrink-0 w-full md:w-1/2 lg:w-1/3" style={{ marginRight: index < shuffledOptions.length - 1 ? '24px' : '0' }}>
                    <div className="flex-1">
                      <Card 
                        className={`h-full transition-all duration-300 ${
                          !finished ? 'cursor-pointer' : ''
                        } ${selectedChoice === option.id ? 'ring-2 ring-inset ring-primary relative z-10' : ''
                        } ${finished && results && (results.winner === 'tie' || (typeof results.winner === 'number' && results.winner !== option.id)) ? 'opacity-50 grayscale' : ''}`}
                        onClick={() => !finished && !hasVoted && setSelectedChoice(option.id)}
                      >
                        <CardContent className="p-0 h-full">
                          <div className="relative h-full">
                            <div className="w-full flex items-center justify-center p-1" style={{ height: `${maxImageHeight}px`, maxHeight: `${maxImageHeight}px` }}>
                              {option.media_type === 'image' ? (
                                isHeicFile(option.file_path) && !isSafari() ? (
                                  // Для HEIC файлов в не-Safari браузерах показываем только название
                                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center p-8">
                                    <div className="text-center">
                                      <Image className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" strokeWidth={1} />
                                      <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        HEIC
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {option.file_path.split('/').pop()}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <HiDPIImage
                                    src={getImageUrl(option.file_path)}
                                    width={option.width}
                                    height={option.height}
                                    pixelRatio={option.pixel_ratio}
                                    fit="contain"
                                    alt={`Вариант ${option.id}`}
                                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                                  />
                                )
                              ) : (
                                <VideoPlayer
                                  src={getImageUrl(option.file_path)}
                                  width={option.width}
                                  height={option.height}
                                  fit="contain"
                                  autoPlay={true}
                                  loop={true}
                                  muted={true}
                                  className="w-full h-full"
                                />
                              )}
                            </div>
                            {selectedChoice === option.id && !finished && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Check 
                                  className="text-primary stroke-[0.5]" 
                                  style={{ 
                                    width: `${Math.min(maxImageHeight * 0.8, 240)}px`, 
                                    height: `${Math.min(maxImageHeight * 0.8, 240)}px` 
                                  }} 
                                />
                              </div>
                            )}
                            {selectedChoice === option.id && finished && (
                              <div className="absolute top-4 left-4">
                                <Check className="h-6 w-6 text-primary" />
                              </div>
                            )}
                            {results && results.winner === option.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-green-500 rounded-full p-8">
                                  <Medal 
                                    className="text-white stroke-[0.5]" 
                                    style={{ 
                                      width: `${Math.min(maxImageHeight * 0.6, 160)}px`, 
                                      height: `${Math.min(maxImageHeight * 0.6, 160)}px` 
                                    }} 
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {results && result && (
                      <div className="mt-4 text-center">
                        <div className="text-2xl font-bold">{result.percentage}%</div>
                        <div className="text-sm text-muted-foreground">
                          {t('votes', { count: result.count })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {showRightShadow && <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-black/20 to-transparent pointer-events-none z-10" />}
          </div>

          {error && (
            <div className="text-destructive text-sm mb-6">{error}</div>
          )}

          <div className="flex-shrink-0 pb-6">
            {!finished && !hasVoted && (
              <Button
                onClick={handleVote}
                disabled={selectedChoice === null || votingLoading}
                className="w-full h-20 sm:h-40 text-xl font-semibold"
              >
                {votingLoading ? t('voting.votingInProgress') : t('voting.confirmChoice')}
              </Button>
            )}

            {hasVoted && !finished && (
              <div className="w-full h-20 sm:h-40 flex items-center justify-center">
                <p className="text-foreground text-center">{t('voting.voteCounted')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модалка авторизации */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={handleAuthModalClose}
        returnTo={window.location.hash}
        onSuccess={handleAuthSuccess}
      />

      {/* Информационная модалка */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setInfoModalOpen(false)}>
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('voting.title')}</h3>
                <p className="text-sm text-foreground">{infoMessage || t('voting.alreadyVoted')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
