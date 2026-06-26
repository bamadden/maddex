import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts'

// Proxy stock per sector (ASX)
const SECTOR_PROXIES = {
  Materials:        'BHP.AX',
  Financials:       'CBA.AX',
  Healthcare:       'CSL.AX',
  'Con. Staples':   'WOW.AX',
  Energy:           'WDS.AX',
  Industrials:      'WES.AX',
  'Real Estate':    'GMG.AX',
  Technology:       'XRO.AX',
  Communication:    'TLS.AX',
  Utilities:        'AGL.AX',
  'Con. Disc.':     'ALL.AX',
}

const SECTOR_KEYS = Object.keys(SECTOR_PROXIES)
const PROXY_SYMS  = Object.values(SECTOR_PROXIES)

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function scoreStock(q) {
  if (!q) return null

  const dayChangePct = q.regularMarketChangePercent ?? q.changePct ?? null
  const volume       = q.regularMarketVolume ?? q.volume ?? null
  const avgVol       = q.averageDailyVolume3Month ?? q.avgVolume ?? null
  const high52       = q.fiftyTwoWeekHigh  ?? q.week52High  ?? null
  const low52        = q.fiftyTwoWeekLow   ?? q.week52Low   ?? null
  const price        = q.regularMarketPrice ?? q.price ?? null

  // Momentum component: centre 0 at 50; ±5% → ±50 points
  const momentumScore = dayChangePct != null
    ? clamp(50 + dayChangePct * 10, 0, 100)
    : 50

  // Volume conviction: ratio vs avg, capped at 2×
  const volumeScore = (volume != null && avgVol != null && avgVol > 0)
    ? clamp((volume / avgVol) * 50, 0, 100)
    : 50

  // 52W range position: where in the range is the current price?
  const rangeScore = (price != null && high52 != null && low52 != null && high52 > low52)
    ? clamp(((price - low52) / (high52 - low52)) * 100, 0, 100)
    : 50

  return Math.round(0.4 * momentumScore + 0.3 * volumeScore + 0.3 * rangeScore)
}

const LEGEND = [
  { range: '0 – 33',  label: 'WEAK',    color: '#ef4444' },
  { range: '34 – 66', label: 'NEUTRAL', color: '#fbbf24' },
  { range: '67 – 100',label: 'STRONG',  color: '#22c55e' },
]

function scoreColor(s) {
  if (s == null) return '#6b7280'
  if (s >= 67)  return '#22c55e'
  if (s >= 34)  return '#fbbf24'
  return '#ef4444'
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { sector, score, proxy, dayPct } = payload[0].payload
  return (
    <div className="bg-terminal-bg border border-terminal-border p-2 text-2xs shadow-lg">
      <div className="text-terminal-gold font-bold mb-0.5">{sector}</div>
      <div className="text-terminal-text-bright">Score: <span style={{ color: scoreColor(score) }}>{score ?? '—'}</span></div>
      {proxy && <div className="text-terminal-text-dim">Proxy: {proxy}</div>}
      {dayPct != null && <div className={dayPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>{dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}% today</div>}
    </div>
  )
}

export default function SectorStrengthRadar() {
  const queryClient = useQueryClient()
  const [refreshKey, setRefreshKey] = useState(0)

  // Pull the same cached batch that TopMovers uses
  const { data: moversData, dataUpdatedAt } = useQuery({
    queryKey: ['yahooMoversBatch', 'asx'],
    enabled: false, // read-only from cache; TopMovers fetches it
  })

  // Fallback: if cache is empty, independently fetch proxy stocks
  const { data: proxyData } = useQuery({
    queryKey: ['sectorProxies', refreshKey],
    queryFn: async () => {
      const syms = PROXY_SYMS.join(',')
      const res = await fetch(
        `/api/yahoo/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume,averageDailyVolume3Month,fiftyTwoWeekHigh,fiftyTwoWeekLow`,
        { headers: { 'Cache-Control': 'no-cache' } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return json?.quoteResponse?.result ?? []
    },
    enabled: !moversData || moversData.length === 0,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const chartData = useMemo(() => {
    // Prefer TopMovers cache; fall back to proxyData
    const pool = moversData?.length ? moversData : (proxyData ?? [])

    return SECTOR_KEYS.map((sector) => {
      const proxySym = SECTOR_PROXIES[sector]
      const q = pool.find((s) =>
        (s.symbol ?? '').toUpperCase() === proxySym.toUpperCase() ||
        (s.symbol ?? '').toUpperCase() === proxySym.replace('.AX', '').toUpperCase()
      )
      const score  = scoreStock(q)
      const dayPct = q?.regularMarketChangePercent ?? q?.changePct ?? null
      return { sector, score: score ?? 50, proxy: proxySym, dayPct, raw: q }
    })
  }, [moversData, proxyData])

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span>SECTOR STRENGTH</span>
        <span className="text-terminal-text-dim font-normal text-2xs normal-case">— MADDEX ANALYSIS</span>
        <button
          onClick={() => { queryClient.invalidateQueries({ queryKey: ['yahooMoversBatch', 'asx'] }); setRefreshKey(k => k + 1) }}
          className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors"
          title="Refresh sector data"
        >
          ↻ REFRESH
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="rgba(30,70,140,0.3)" />
              <PolarAngleAxis
                dataKey="sector"
                tick={{ fill: '#c9a84c', fontSize: 10, fontFamily: 'monospace' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#4a5568', fontSize: 8 }}
                tickCount={4}
              />
              <Radar
                name="Strength"
                dataKey="score"
                stroke="#4a90d9"
                strokeWidth={1.5}
                fill="rgba(201,168,76,0.15)"
                dot={{ r: 3, fill: '#c9a84c', strokeWidth: 0 }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Subtitle */}
        <div className="text-2xs text-terminal-text-dim/50 text-center pb-1 flex-shrink-0">
          Composite score: price momentum · volume conviction · 52W range position
        </div>

        {/* Scores table */}
        <div className="grid grid-cols-2 gap-x-4 px-3 pb-2 flex-shrink-0 border-t border-terminal-border pt-2">
          {chartData.map(({ sector, score, dayPct }) => (
            <div key={sector} className="flex items-center justify-between py-0.5">
              <span className="text-2xs text-terminal-text-dim">{sector}</span>
              <div className="flex items-center gap-2">
                {dayPct != null && (
                  <span className={`text-2xs ${dayPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                  </span>
                )}
                <span className="text-2xs font-bold w-6 text-right" style={{ color: scoreColor(score) }}>{score}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend + timestamp */}
        <div className="flex items-center justify-between px-3 pb-2 flex-shrink-0">
          <div className="flex gap-3">
            {LEGEND.map(({ range, label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-2xs text-terminal-text-dim">{label}</span>
              </div>
            ))}
          </div>
          {lastUpdate && (
            <span className="text-2xs text-terminal-text-dim/50">Updated {lastUpdate}</span>
          )}
        </div>
      </div>
    </div>
  )
}
