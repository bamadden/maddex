import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews, aggregateNewsSentiment } from '../services/api'
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
        // Fall back to the keyword aggregate rather than showing nothing.
        //
        // The gauge previously went blank whenever the AI call failed — no
        // key, no credit, rate limited — which is exactly when a reader most
        // wants some read on the feed. The keyword score is cruder and is
        // labelled as such by `source`, but it is derived from the same
        // headlines and is available offline.
        const fallback = aggregateNewsSentiment(newsData.articles)
        if (fallback.sampled > 0) {
          setSentiment({
            score: fallback.score,
            label: fallback.label,
            summary: `Keyword read across ${fallback.sampled} headlines — MaddenAI unavailable.`,
            source: 'keyword',
          })
          setStatus('ready')
        } else {
          setStatus('error')
        }
        setError(e.message)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [newsData, status])

  return { sentiment, status, error }
}
