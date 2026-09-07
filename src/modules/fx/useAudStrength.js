import { useQuery } from '@tanstack/react-query'
import { fetchFxHistory } from '../../services/api'

// The AUD's 30-day move against each major, fetched once and shared.
//
// Two panels want this — the strength bars and the TWI card, which uses it as
// the change figure the TWI itself cannot supply. Both call this hook; React
// Query dedupes on the key, so it is one set of requests, not two.
export const STRENGTH_MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'NZD']

export function useAudStrength() {
  return useQuery({
    queryKey: ['fxStrength30d', STRENGTH_MAJORS],
    queryFn: async () => {
      const settled = await Promise.allSettled(
        STRENGTH_MAJORS.map((ccy) => fetchFxHistory('AUD', ccy, 30)),
      )
      return STRENGTH_MAJORS.map((ccy, i) => {
        const r = settled[i]
        if (r.status !== 'fulfilled' || !r.value?.rates) return { ccy, pct: null }
        const entries = Object.entries(r.value.rates)
          .map(([date, rates]) => ({ date, rate: rates[ccy] }))
          .filter((e) => e.rate != null)
          .sort((a, b) => a.date.localeCompare(b.date))
        if (entries.length < 2) return { ccy, pct: null }
        const first = entries[0].rate
        const last = entries[entries.length - 1].rate
        // AUD strengthening vs ccy means 1 AUD buys MORE of ccy over the period.
        return { ccy, pct: ((last - first) / first) * 100 }
      })
    },
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

// The unweighted mean of the moves that came back.
//
// EXPLICITLY NOT A TWI. The RBA's trade-weighted index weights each currency
// by its share of Australian trade; this weights six majors equally and omits
// everything else. It is a different measure of the same thing and the card
// that shows it says so — calling it "the TWI change" would be a fabricated
// figure with a real number's confidence.
export function meanMove(rows) {
  const vals = (rows ?? []).map((r) => r.pct).filter((v) => typeof v === 'number')
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
