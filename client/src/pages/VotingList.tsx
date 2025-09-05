import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import HiDPIImage from '@/components/ui/HiDPIImage'
import VideoPlayer from '@/components/ui/VideoPlayer'


interface Voting {
  id: string
  title: string
  created_at: string
  end_at: string
  image1_path: string
  image1_pixel_ratio: number
  image1_width: number
  image1_height: number
  image1_media_type: 'image' | 'video'
  image2_path: string
  image2_pixel_ratio: number
  image2_width: number
  image2_height: number
  image2_media_type: 'image' | 'video'
  vote_count: number
}

export function VotingList() {
  const { t } = useTranslation()
  const [votings, setVotings] = useState<Voting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())


  useEffect(() => {
    fetchVotings()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const fetchVotings = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await fetch('/api/votings')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setVotings(data.votings || [])
    } catch (error) {
      console.error(t('voting.errorLoadingVotings'), error)
      setError(t('voting.errorLoadingSideBySides'))
    } finally {
      setLoading(false)
    }
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
      return `${days}д ${hours}ч ${minutes}м`
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м ${seconds}с`
    } else if (minutes > 0) {
      return `${minutes}м ${seconds}с`
    } else {
      return `${seconds}с`
    }
  }



  const hasVoted = (votingId: string) => {
    // Проверяем IndexedDB
    return localStorage.getItem(`voted_${votingId}`) !== null
  }

  const isVotingActive = (endAt: string) => {
    const endTime = new Date(endAt)
    return endTime.getTime() > currentTime.getTime()
  }

  const activeVotings = votings.filter(voting => isVotingActive(voting.end_at))
  const finishedVotings = votings.filter(voting => !isVotingActive(voting.end_at))

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('voting.loading')}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('voting.active')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/new">
              <Button>
                <Plus className="h-4 w-4 mr-2 stroke-[3]" />
                {t('voting.create')}
              </Button>
            </Link>
          </div>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchVotings} variant="outline">
                {t('voting.tryAgain')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            {votings.length === 0 ? t('voting.sideBySides') : t('voting.active')}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/new">
            <Button>
              <Plus className="h-4 w-4 mr-2 stroke-[3]" />
              {t('voting.create')}
            </Button>
          </Link>
        </div>
      </div>

      {votings.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t('voting.noVotings')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Активные голосования */}
          {activeVotings.length > 0 ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeVotings.map((voting) => (
                  <Link key={voting.id} to={`/v/${voting.id}`} className="block">
                    <Card 
                      className={`transition-all hover:bg-muted cursor-pointer ${
                        hasVoted(voting.id) ? 'opacity-60' : ''
                      }`}
                    >
                      <CardHeader>
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{voting.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            {hasVoted(voting.id) && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {t('votes', { count: voting.vote_count })} · <Clock className="h-4 w-4" /> {getTimeRemaining(voting.end_at)}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative w-full h-64 rounded overflow-hidden bg-muted">
                          {/* Левая картинка (вариант 1) */}
                          <div 
                            className="absolute inset-0"
                            style={{
                              clipPath: 'polygon(0% 0%, 98% 0%, 0% 98%)'
                            }}
                          >
                            {voting.image1_media_type === 'image' ? (
                              <HiDPIImage
                                src={`/api/images/${voting.image1_path.split('/').pop()}`}
                                width={voting.image1_width}
                                height={voting.image1_height}
                                pixelRatio={voting.image1_pixel_ratio}
                                fit="contain"
                                alt={t('voting.option1') as string}
                                style={{ width: '100%', height: '100%', objectPosition: 'left top' }}
                              />
                            ) : (
                              <VideoPlayer
                                src={`/api/images/${voting.image1_path.split('/').pop()}`}
                                width={voting.image1_width}
                                height={voting.image1_height}
                                fit="contain"
                                controls={false}
                                muted={true}
                                className="w-full h-full object-left-top"
                              />
                            )}
                          </div>
                          {/* Правая картинка (вариант 2) */}
                          <div 
                            className="absolute inset-0"
                            style={{
                              clipPath: 'polygon(100% 0%, 100% 100%, 2% 100%)'
                            }}
                          >
                            {voting.image2_media_type === 'image' ? (
                              <HiDPIImage
                                src={`/api/images/${voting.image2_path.split('/').pop()}`}
                                width={voting.image2_width}
                                height={voting.image2_height}
                                pixelRatio={voting.image2_pixel_ratio}
                                fit="contain"
                                alt={t('voting.option2') as string}
                                style={{ width: '100%', height: '100%', objectPosition: 'right bottom' }}
                              />
                            ) : (
                              <VideoPlayer
                                src={`/api/images/${voting.image2_path.split('/').pop()}`}
                                width={voting.image2_width}
                                height={voting.image2_height}
                                fit="contain"
                                controls={false}
                                muted={true}
                                className="w-full h-full object-right-bottom"
                              />
                            )}
                          </div>
                          {/* Диагональная линия */}
                          <svg
                            className="absolute inset-0 pointer-events-none z-10"
                            width="100%"
                            height="100%"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <line
                              x1="0"
                              y1="100"
                              x2="100"
                              y2="0"
                              stroke="hsl(var(--muted))"
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
                          </div>
          ) : (
            <div>
              <p className="text-muted-foreground">{t('voting.noActiveVotings')}</p>
            </div>
          )}

          {/* Завершенные голосования */}
          {finishedVotings.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold mb-4">{t('voting.completed')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {finishedVotings.map((voting) => (
                  <Link key={voting.id} to={`/v/${voting.id}`} className="block">
                    <Card 
                      className={`transition-all hover:bg-muted cursor-pointer ${
                        hasVoted(voting.id) ? 'opacity-60 grayscale' : 'opacity-60 grayscale'
                      }`}
                    >
                      <CardHeader>
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{voting.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            {hasVoted(voting.id) && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {t('votes', { count: voting.vote_count })} · <Clock className="h-4 w-4" /> {getTimeRemaining(voting.end_at)}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative w-full h-64 rounded overflow-hidden bg-muted">
                          {/* Левая картинка (вариант 1) */}
                          <div 
                            className="absolute inset-0"
                            style={{
                              clipPath: 'polygon(0% 0%, 98% 0%, 0% 98%)'
                            }}
                          >
                            {voting.image1_media_type === 'image' ? (
                              <HiDPIImage
                                src={`/api/images/${voting.image1_path.split('/').pop()}`}
                                width={voting.image1_width}
                                height={voting.image1_height}
                                pixelRatio={voting.image1_pixel_ratio}
                                fit="contain"
                                alt={t('voting.option1') as string}
                                style={{ width: '100%', height: '100%', objectPosition: 'left top' }}
                              />
                            ) : (
                              <VideoPlayer
                                src={`/api/images/${voting.image1_path.split('/').pop()}`}
                                width={voting.image1_width}
                                height={voting.image1_height}
                                fit="contain"
                                controls={false}
                                muted={true}
                                className="w-full h-full object-left-top"
                              />
                            )}
                          </div>
                          {/* Правая картинка (вариант 2) */}
                          <div 
                            className="absolute inset-0"
                            style={{
                              clipPath: 'polygon(100% 0%, 100% 100%, 2% 100%)'
                            }}
                          >
                            {voting.image2_media_type === 'image' ? (
                              <HiDPIImage
                                src={`/api/images/${voting.image2_path.split('/').pop()}`}
                                width={voting.image2_width}
                                height={voting.image2_height}
                                pixelRatio={voting.image2_pixel_ratio}
                                fit="contain"
                                alt={t('voting.option2') as string}
                                style={{ width: '100%', height: '100%', objectPosition: 'right bottom' }}
                              />
                            ) : (
                              <VideoPlayer
                                src={`/api/images/${voting.image2_path.split('/').pop()}`}
                                width={voting.image2_width}
                                height={voting.image2_height}
                                fit="contain"
                                controls={false}
                                muted={true}
                                className="w-full h-full object-right-bottom"
                              />
                            )}
                          </div>
                          {/* Диагональная линия */}
                          <svg
                            className="absolute inset-0 pointer-events-none z-10"
                            width="100%"
                            height="100%"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <line
                              x1="0"
                              y1="100"
                              x2="100"
                              y2="0"
                              stroke="hsl(var(--muted))"
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
