import { useQuery } from '@tanstack/react-query'
import { fetchFxHistory } from '../../services/api'

// The AUD's 30-day move against each major, fetched once and shared.
//
// Two panels want this — the strength bars and the TWI card, which uses it as
// the change figure the TWI itself cannot supply. Both call this hook; React
// Query dedupes on the key, so it is one set of requests, not two.
export const STRENGTH_MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'NZD']

// One row per major from the settled fetches. A fetch that failed is marked
// `failed`; one that answered without two usable rates has pct null and is
// not a failure. If every fetch failed this throws, so the query reports an
// error and React Query keeps the last good rows (shown as STALE) instead of
// replacing them with dashes.
export function strengthRows(ccys, settled) {
  const rows = ccys.map((ccy, i) => {
    const r = settled[i]
    if (r?.status !== 'fulfilled' || !r.value?.rates) return { ccy, pct: null, failed: true }
    const entries = Object.entries(r.value.rates)
      .map(([date, rates]) => ({ date, rate: rates[ccy] }))
      .filter((e) => e.rate != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (entries.length < 2) return { ccy, pct: null, failed: false }
    const first = entries[0].rate
    const last = entries[entries.length - 1].rate
    // AUD strengthening vs ccy means 1 AUD buys MORE of ccy over the period.
    return { ccy, pct: ((last - first) / first) * 100, failed: false, from: entries[0].date, to: entries[entries.length - 1].date }
  })
  if (rows.every((r) => r.failed)) throw new Error('Frankfurter returned no history for any major')
  return rows
}

// What a panel reading this query should show:
//   loading  first fetch still running
//   failed   no usable rows because the feed failed: the shared failure state
//   stale    the last fetch failed, older good rows are on screen: STALE badge
//   empty    the feed answered, with nothing usable: "No rates"
//   ok       rows to draw (some may be "—")
// A failed fetch is never "empty".
export function strengthState({ data, isError, isPending }) {
  const usable = (data ?? []).some((r) => typeof r.pct === 'number')
  if (isError) return usable ? 'stale' : 'failed'
  if (!data) return isPending ? 'loading' : 'failed'
  if (usable) return 'ok'
  return data.some((r) => r.failed) ? 'failed' : 'empty'
}

// The ECB date of the newest rate any row was computed from.
export const lastRateDate = (rows) => (rows ?? []).map((r) => r.to).filter(Boolean).sort().at(-1) ?? null

export function useAudStrength() {
  return useQuery({
    queryKey: ['fxStrength30d', STRENGTH_MAJORS],
    queryFn: async () => strengthRows(STRENGTH_MAJORS, await Promise.allSettled(
      STRENGTH_MAJORS.map((ccy) => fetchFxHistory('AUD', ccy, 30)),
    )),
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
