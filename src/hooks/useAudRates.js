import { useQuery } from '@tanstack/react-query'
import { fetchFxRates } from '../services/api'

const FALLBACK_AUD_USD = 0.6488

export function useAudRates() {
  const { data: rates } = useQuery({
    queryKey: ['fxRates'],
    queryFn:  () => fetchFxRates('AUD'),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // rates.USD = how many USD per 1 AUD
  const audUsd = rates?.USD ?? FALLBACK_AUD_USD

  return {
    rates,
    audUsd,
    usdToAud: (usd) => (usd ?? 0) / audUsd,
    audToUsd: (aud) => (aud ?? 0) * audUsd,
  }
}
