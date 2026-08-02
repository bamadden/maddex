import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchFxRates } from '../services/api'

const FALLBACK_AUD_USD = 0.6520

export function useAudRates() {
  const { data: rates } = useQuery({
    queryKey: ['fxRates'],
    queryFn:  () => fetchFxRates('AUD'),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // rates.USD = how many USD per 1 AUD (e.g. 0.6450 means 1 AUD = 0.6450 USD)
  const audUsd = rates?.USD ?? FALLBACK_AUD_USD

  useEffect(() => {
    if (rates?.USD) {
      console.log(`[MADDEX] AUD/USD rate: 1 AUD = ${rates.USD.toFixed(4)} USD  |  USD→AUD: ÷${rates.USD.toFixed(4)} (≈ A$${(1 / rates.USD).toFixed(4)} per US$1)`)
    }
  }, [rates?.USD])

  return {
    rates,
    audUsd,
    usdToAud: (usd) => (usd ?? 0) / audUsd,
    audToUsd: (aud) => (aud ?? 0) * audUsd,
  }
}
