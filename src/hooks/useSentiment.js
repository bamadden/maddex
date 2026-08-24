import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../services/api'
import { calculateSentiment } from '../services/sentimentService'

// Shared across TopBar/News/MorningBrief — each mounts this independently
// and reads/writes the same hourly localStorage cache key in
// sentimentService, so only the first one to load in a given hour actually
// hits the API; the rest read the cached result.
export function useSentiment() {
  const { data: newsData } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    staleTime: 3 * 60_000,
  })

  const [sentiment, setSentiment] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!newsData?.articles?.length || status !== 'idle') return
    const t = setTimeout(async () => {
      setStatus('loading')
      setError(null)
      try {
        const result = await calculateSentiment(newsData.articles)
        setSentiment(result)
        setStatus('ready')
      } catch (e) {
        setError(e.message)
        setStatus('error')
      }
    }, 0)
    return () => clearTimeout(t)
  }, [newsData, status])

  return { sentiment, status, error }
}
