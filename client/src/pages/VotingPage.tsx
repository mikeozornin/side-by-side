import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Medal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import HiDPIImage from '@/components/ui/HiDPIImage'

interface Voting {
  id: string
  title: string
  created_at: string
  end_at: string
  image1_path: string
  image1_pixel_ratio: number
  image1_width: number
  image1_height: number
  image2_path: string
  image2_pixel_ratio: number
  image2_width: number
  image2_height: number
}

interface Results {
  totalVotes: number
  percentages: [number, number]
  winner: number | 'tie' | null
  results: Array<{ choice: number; count: number }>
}

export function VotingPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [voting, setVoting] = useState<Voting | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [votingLoading, setVotingLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasVoted, setHasVoted] = useState(false)

  useEffect(() => {
    if (id) {
      fetchVoting()
      checkVotedStatus()
    }
  }, [id])

  const fetchVoting = async () => {
    try {
      const response = await fetch(`/api/votings/${id}`)
      if (!response.ok) {
        throw new Error(t('voting.notFound'))
      }
      const data = await response.json()
      setVoting(data.voting)
      
      // Если голосование завершено, загружаем результаты
      if (isFinished(data.voting.end_at)) {
        fetchResults()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('voting.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/votings/${id}/results`)
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки результатов:', error)
    }
  }

  const checkVotedStatus = () => {
    const voted = localStorage.getItem(`voted_${id}`) !== null
    setHasVoted(voted)
    
    if (voted) {
      const voteData = JSON.parse(localStorage.getItem(`voted_${id}`) || '{}')
      setSelectedChoice(voteData.choice)
    }
  }

  const isFinished = (endAt: string) => {
    return new Date(endAt) <= new Date()
  }

  const handleVote = async () => {
    if (selectedChoice === null || !id) return

    setVotingLoading(true)
    try {
      const response = await fetch(`/api/votings/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ choice: selectedChoice }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('voting.errorVoting'))
      }

      // Сохраняем в IndexedDB (используем localStorage как fallback)
      localStorage.setItem(`voted_${id}`, JSON.stringify({
        choice: selectedChoice,
        at: new Date().toISOString()
      }))

      setHasVoted(true)
      
      // Если голосование завершено, загружаем результаты
      if (voting && isFinished(voting.end_at)) {
        fetchResults()
      }
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

  const finished = isFinished(voting.end_at)

  return (
    <div className="h-screen flex flex-col">
      <div className="max-w-none mx-auto pt-6 px-6 w-full flex-shrink-0">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold h-16 flex items-center">{voting.title}</h1>
        </div>
      </div>

      <div className="flex-1 max-w-none mx-auto px-6 w-full">
        <div className="h-full flex flex-col">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Вариант 1 */}
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Card className={`h-full transition-all ${
                  !finished ? 'cursor-pointer' : ''
                } ${selectedChoice === 0 ? 'ring-2 ring-primary' : ''
                } ${selectedChoice !== null && selectedChoice !== 0 && results?.winner !== 'tie' ? 'opacity-50 grayscale' : ''}`}>
                  <CardContent className="p-0 h-full">
                    <div className="relative h-full">
                      <div className="w-full h-full flex items-center justify-center">
                        <HiDPIImage
                          src={getImageUrl(voting.image1_path)}
                          width={voting.image1_width}
                          height={voting.image1_height}
                          pixelRatio={voting.image1_pixel_ratio}
                          fit="contain"
                          alt="Вариант 1"
                          className={`max-w-full max-h-full object-contain rounded-lg ${
                            !finished && !hasVoted && selectedChoice === null ? 'cursor-pointer' : 'cursor-default'
                          }`}
                          onClick={() => !finished && !hasVoted && setSelectedChoice(0)}
                        />
                      </div>
                      {selectedChoice === 0 && !finished && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-60 w-60 text-primary stroke-[0.5]" />
                        </div>
                      )}
                      {selectedChoice === 0 && finished && (
                        <div className="absolute top-4 left-4">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      {results && results.winner === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-green-500 rounded-full p-8">
                            <Medal className="h-40 w-40 text-white stroke-[0.5]" />
                          </div>
                        </div>
                      )}
                      {results && results.winner === 'tie' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-green-500 rounded-full p-8">
                            <Medal className="h-40 w-40 text-white stroke-[0.5]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {results && (
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold">{results.percentages[0]}%</div>
                  <div className="text-sm text-muted-foreground">
                    {t('votes', { count: results.results.find(r => r.choice === 0)?.count || 0 })}
                  </div>
                </div>
              )}
            </div>

            {/* Вариант 2 */}
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <Card className={`h-full transition-all ${
                  !finished ? 'cursor-pointer' : ''
                } ${selectedChoice === 1 ? 'ring-2 ring-primary' : ''
                } ${selectedChoice !== null && selectedChoice !== 1 && results?.winner !== 'tie' ? 'opacity-50 grayscale' : ''}`}>
                  <CardContent className="p-0 h-full">
                    <div className="relative h-full">
                      <div className="w-full h-full flex items-center justify-center">
                        <HiDPIImage
                          src={getImageUrl(voting.image2_path)}
                          width={voting.image2_width}
                          height={voting.image2_height}
                          pixelRatio={voting.image2_pixel_ratio}
                          fit="contain"
                          alt="Вариант 2"
                          className={`max-w-full max-h-full object-contain rounded-lg ${
                            !finished && !hasVoted && selectedChoice === null ? 'cursor-pointer' : 'cursor-default'
                          }`}
                          onClick={() => !finished && !hasVoted && setSelectedChoice(1)}
                        />
                      </div>
                      {selectedChoice === 1 && !finished && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-60 w-60 text-primary stroke-[0.5]" />
                        </div>
                      )}
                      {selectedChoice === 1 && finished && (
                        <div className="absolute top-4 left-4">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      {results && results.winner === 1 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-green-500 rounded-full p-8">
                            <Medal className="h-40 w-40 text-white stroke-[0.5]" />
                          </div>
                        </div>
                      )}
                      {results && results.winner === 'tie' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-green-500 rounded-full p-8">
                            <Medal className="h-40 w-40 text-white stroke-[0.5]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {results && (
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold">{results.percentages[1]}%</div>
                  <div className="text-sm text-muted-foreground">
                    {t('votes', { count: results.results.find(r => r.choice === 1)?.count || 0 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm mb-6">{error}</div>
          )}

          <div className="flex-shrink-0 pb-6">
            {!finished && !hasVoted && (
              <Button
                onClick={handleVote}
                disabled={selectedChoice === null || votingLoading}
                className="w-full h-40 text-xl font-semibold"
              >
                {votingLoading ? t('voting.votingInProgress') : t('voting.confirmChoice')}
              </Button>
            )}

            {hasVoted && !finished && (
              <div className="w-full h-40 flex items-center justify-center">
                <p className="text-foreground text-center">{t('voting.voteCounted')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
