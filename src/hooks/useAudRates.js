import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchFxRatesUnified } from '../services/dataService'

// Shared queryKey with TickerTape (fetch) / FXModule (fetch) / AIPanel
// (passive read) — all now expect dataService's { data, stale, source }
// envelope (see fetchFxRatesUnified in dataService.js).
export function useAudRates() {
  const { data: fxResult } = useQuery({
    queryKey: ['fxRates'],
    queryFn:  () => fetchFxRatesUnified('AUD'),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const rates = fxResult?.data

  // rates.USD = how many USD per 1 AUD (e.g. 0.6450 means 1 AUD = 0.6450 USD).
  // Null until a rate has loaded: there is no fixed fallback, so a US price
  // is shown as "—" rather than converted at a made-up rate.
  const audUsd = rates?.USD > 0 ? rates.USD : null

  useEffect(() => {
    if (rates?.USD) {
      const tag = fxResult?.stale ? ' [DELAYED — cached]' : ''
      console.log(`[MADDEX] AUD/USD rate: 1 AUD = ${rates.USD.toFixed(4)} USD  |  USD→AUD: ÷${rates.USD.toFixed(4)} (≈ A$${(1 / rates.USD).toFixed(4)} per US$1)${tag}`)
    }
  }, [rates?.USD, fxResult?.stale])

  return {
    rates,
    audUsd,
    isDelayed: fxResult?.stale === true,
    haveRate: audUsd != null,
    // → null when the value or the rate is missing.
    usdToAud: (usd) => (usd == null || audUsd == null ? null : usd / audUsd),
    audToUsd: (aud) => (aud == null || audUsd == null ? null : aud * audUsd),
  }
}
