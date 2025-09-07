import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import VotingCardPreview from '@/components/ui/VotingCardPreview'
import { AuthButton } from '@/components/AuthButton'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { configManager } from '@/lib/config'

interface VotingOption {
  id: number;
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
  options: VotingOption[]
  vote_count: number
  user_email?: string | null
}

export function VotingList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAnonymous, user, accessToken } = useAuth()
  const [votings, setVotings] = useState<Voting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAuthModal, setShowAuthModal] = useState(false)


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
      const response = await fetch(`${configManager.getApiUrl()}/votings`)
      
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
      return t('voting.timeRemaining.days', { days, hours, minutes })
    } else if (hours > 0) {
      return t('voting.timeRemaining.hours', { hours, minutes, seconds })
    } else if (minutes > 0) {
      return t('voting.timeRemaining.minutes', { minutes, seconds })
    } else {
      return t('voting.timeRemaining.seconds', { seconds })
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

  const handleCreateClick = () => {
    if (isAnonymous || (user && accessToken)) {
      // В анонимном режиме или если пользователь залогинен - сразу переходим на страницу создания
      navigate('/new')
    } else {
      // Если пользователь не залогинен - открываем модальное окно аутентификации
      setShowAuthModal(true)
    }
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
            <Button 
              size="sm"
              onClick={handleCreateClick}
            >
              <Plus className="h-4 w-4 mr-2 stroke-[3]" />
              {t('voting.create')}
            </Button>
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
          <Button 
            size="sm"
            onClick={handleCreateClick}
          >
            <Plus className="h-4 w-4 mr-2 stroke-[3]" />
            {t('voting.create')}
          </Button>
          <AuthButton />
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
                        hasVoted(voting.id) ? 'opacity-60 grayscale bg-muted/30' : ''
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
                              {voting.user_email && ` · ${voting.user_email}`}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative w-full h-64">
                          <VotingCardPreview options={voting.options} />
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
                        hasVoted(voting.id) ? 'opacity-60 grayscale bg-muted/30' : 'opacity-60 grayscale bg-muted/30'
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
                              {voting.user_email && ` · ${voting.user_email}`}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative w-full h-64">
                          <VotingCardPreview options={voting.options} />
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
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnTo="/new"
      />
    </div>
  )
}
