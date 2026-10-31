import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import VERIFIED_CONSTANTS, { pendingRbaDecision } from '../../../data/verifiedConstants'
import { liveDataService } from '../../../services/liveDataService'
import { fetchIndexQuotesUnified } from '../../../services/dataService'
import { USING_MOCK_DATA } from '../../../services/api'
import { sydneyOffset } from '../../../utils/dateUtils'
import { WidgetBody } from './_shared'
import { goModule } from './navigate'

// MARKET PULSE — the five numbers that matter right now, one line each.
//
// Two kinds of figure, and the line says which:
//   RBA and CPI are verified constants (dated, sourced) — they change on
//   decision and release days, not by the second.
//   AUD, BTC and the ASX 200 come from the same feeds their own widgets use
//   (Frankfurter, CoinGecko, the index path — DEMO until an equity feed is
//   connected), refetched every minute.
// The clock ticks every 3 seconds so "upd 42s" counts honestly; the values
// change only when a feed returns something new — a number that wobbled on a
// timer without new data would be decoration pretending to be a price.

const REFRESH_MS = 60_000

function useTick(ms) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

function Line({ label, children, change, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="flex items-baseline gap-2 w-full min-w-0 text-left hover:opacity-80 transition-opacity font-mono" style={{ fontSize: 10 }}>
      <span className="font-bold flex-shrink-0" style={{ color: '#C9A84C', width: 30, letterSpacing: '0.06em' }}>{label}</span>
      <span className="truncate min-w-0 tabular-nums" style={{ color: '#E8EDF5' }}>{children}</span>
      {change != null && (
        <span className="ml-auto flex-shrink-0 tabular-nums" style={{ color: change >= 0 ? '#2D8A50' : '#A83232' }}>
          {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
        </span>
      )}
    </button>
  )
}

export default function MarketPulseWidget() {
  const now = useTick(3000)
  const { rba, au } = VERIFIED_CONSTANTS
  const nd = pendingRbaDecision(now)

  const [fx, setFx] = useState(null)
  const [btc, setBtc] = useState(null)
  const [stamp, setStamp] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => Promise.allSettled([liveDataService.getFXRates(), liveDataService.getCryptoPrices()]).then(([f, c]) => {
      if (!alive) return
      if (f.value?.data?.AUDUSD != null) setFx({ rate: f.value.data.AUDUSD, live: f.value.source === 'live' })
      if (c.value?.data?.bitcoin) setBtc(c.value.data.bitcoin)
      setStamp(Date.now())
    })
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const { data: idx, dataUpdatedAt } = useQuery({
    queryKey: ['pulse', 'axjo'],
    queryFn: () => fetchIndexQuotesUnified(['^AXJO']),
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    retry: 1,
  })
  const asx = idx?.data?.['^AXJO']

  // RBA: rate, pending hike pricing, days to the meeting.
  const meetingAt = rba?.nextMeeting ? new Date(`${rba.nextMeeting}T14:30:00${sydneyOffset(rba.nextMeeting)}`).getTime() : null
  const days = meetingAt ? Math.max(0, Math.ceil((meetingAt - now) / 86400000)) : null
  const pricing = nd && nd.date === rba.nextMeeting && meetingAt > now ? nd.marketHikePct : null
  const updated = Math.max(stamp ?? 0, dataUpdatedAt ?? 0)
  const ago = updated ? Math.max(0, Math.round((now - updated) / 1000)) : null

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col justify-start gap-[7px]">
        <Line label="RBA" onClick={() => goModule('fx')} title={`Cash rate (rba.gov.au). ${pricing != null ? `Hike pricing: ${nd.marketSource}, ${nd.marketAsOf}.` : ''}`}>
          {rba.cashRate.toFixed(2)}%
          {pricing != null && <span style={{ color: '#E8A33D' }}> · HIKE {pricing}%</span>}
          {days != null && <span style={{ color: '#8BA3C4' }}> · {days}D</span>}
        </Line>
        <Line label="CPI" onClick={() => goModule('macro')} title={`ABS, released ${au.cpiLastRelease}`}>
          {au.cpi.toFixed(1)}% {au.cpiPeriod.replace(/ \d{4}$/, '')}
          {au.cpiQuarterTrimmedQoQ != null && <span style={{ color: '#8BA3C4' }}> · {au.cpiQuarterPeriod.slice(0, 3).toUpperCase()} Q TM {au.cpiQuarterTrimmedQoQ.toFixed(1)}%</span>}
        </Line>
        <Line label="AUD" onClick={() => goModule('fx')} title={fx?.live ? 'Frankfurter (ECB reference rate)' : 'Cached / delayed rate'}>
          {fx ? <>{fx.rate.toFixed(4)} <span style={{ color: '#4A6080' }}>USD{fx.live ? '' : ' · delayed'}</span></> : '—'}
        </Line>
        <Line label="BTC" onClick={() => goModule('crypto')} change={btc?.aud_24h_change ?? null} title="CoinGecko · 24h change">
          {btc?.aud != null ? `A$${Math.round(btc.aud).toLocaleString('en-AU')}` : '—'}
        </Line>
        <Line label="ASX" onClick={() => goModule('markets')} change={asx?.pct ?? null} title={USING_MOCK_DATA ? 'DEMO — simulated index level' : 'S&P/ASX 200'}>
          {asx?.last != null ? asx.last.toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
          {USING_MOCK_DATA && <span style={{ color: '#4A6080' }}> demo</span>}
        </Line>
      </div>
      <div className="flex items-center gap-1.5 font-mono flex-shrink-0" style={{ fontSize: 8, color: '#4A6080' }}>
        <span className="rounded-full" style={{ width: 4, height: 4, background: ago != null && ago < 90 ? '#2D8A50' : '#4A6080' }} />
        {ago == null ? 'loading feeds…' : `feeds updated ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`} ago · RBA/CPI verified`}
      </div>
    </WidgetBody>
  )
}
