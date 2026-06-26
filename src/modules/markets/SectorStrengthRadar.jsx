import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { fetchBatch } from '../../services/api'
import { fmt } from '../../utils/format'
import { useAudRates } from '../../hooks/useAudRates'

// ─── Sector definitions ───────────────────────────────────────────────────────

const SECTOR_PROXIES = {
  Materials:      { sym: 'BHP.AX', asxTicker: 'XMJ' },
  Financials:     { sym: 'CBA.AX', asxTicker: 'XFJ' },
  Healthcare:     { sym: 'CSL.AX', asxTicker: 'XHJ' },
  'Con. Staples': { sym: 'WOW.AX', asxTicker: 'XSJ' },
  Energy:         { sym: 'WDS.AX', asxTicker: 'XEJ' },
  Industrials:    { sym: 'WES.AX', asxTicker: 'XIJ' },
  'Real Estate':  { sym: 'GMG.AX', asxTicker: 'XPJ' },
  Technology:     { sym: 'XRO.AX', asxTicker: 'XIT' },
  Communication:  { sym: 'TLS.AX', asxTicker: 'XTJ' },
  Utilities:      { sym: 'AGL.AX', asxTicker: 'XUJ' },
  'Con. Disc.':   { sym: 'ALL.AX', asxTicker: 'XDJ' },
}

const PROXY_SYMS  = Object.values(SECTOR_PROXIES).map(v => v.sym)
const SECTOR_KEYS = Object.keys(SECTOR_PROXIES)

// ─── Score calculation ────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function scoreStock(q) {
  // q comes from fetchBatch → fetchYahooQuote (v8 chart API)
  // Field names: dayChangePct, volume, week52High, week52Low, price, prevClose
  const dayChangePct = q?.dayChangePct ?? null
  const price        = q?.price        ?? null
  const prevClose    = q?.prevClose    ?? null
  const high52       = q?.week52High   ?? null
  const low52        = q?.week52Low    ?? null

  // Day momentum: +/-5% → ±50 pts around neutral 50
  const dayScore  = dayChangePct != null ? clamp(50 + dayChangePct * 10, 0, 100) : 50
  // Volume: avgVol not available from v8 endpoint — neutral 50
  const volScore  = 50
  // 52W range position: where is current price within the annual range?
  const rangeScore = price != null && high52 != null && low52 != null && high52 > low52
    ? clamp(((price - low52) / (high52 - low52)) * 100, 0, 100)
    : 50

  const current = Math.round(0.4 * dayScore + 0.3 * volScore + 0.3 * rangeScore)

  // Previous close position in 52W range (neutral momentum/volume → score 35–65)
  const prevRangeScore = prevClose != null && high52 != null && low52 != null && high52 > low52
    ? clamp(((prevClose - low52) / (high52 - low52)) * 100, 0, 100)
    : 50
  const prev = Math.round(0.4 * 50 + 0.3 * 50 + 0.3 * prevRangeScore)

  console.log(
    `[SECTOR RADAR] ${q?.symbol}: dayChg=${dayChangePct?.toFixed(2) ?? '?'}%` +
    ` dayScore=${dayScore.toFixed(0)} rangeScore=${rangeScore.toFixed(0)}` +
    ` CURRENT=${current} PREV=${prev}` +
    ` [price=${price} 52W ${low52}–${high52}]`
  )

  return { current, prev }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s) {
  if (s == null) return '#4a5568'
  if (s >= 67)   return '#22c55e'
  if (s >= 34)   return '#fbbf24'
  return '#ef4444'
}

// ─── Custom axis tick (clickable) ─────────────────────────────────────────────

function ClickableTick({ payload, x, y, textAnchor, onSectorClick }) {
  if (!payload?.value) return null
  return (
    <text
      x={x} y={y}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fill="#c9a84c"
      fontSize={11}
      fontFamily="monospace"
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSectorClick(payload.value)}
    >
      {payload.value}
    </text>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-terminal-bg border border-terminal-border p-2 text-2xs shadow-lg min-w-[140px]">
      <div className="text-terminal-gold font-bold mb-1">{d.sector}</div>
      <div className="flex justify-between gap-4">
        <span className="text-terminal-text-dim">Score</span>
        <span className="font-bold" style={{ color: scoreColor(d.score) }}>{d.score}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-terminal-text-dim">Prev</span>
        <span className="text-terminal-text-dim/60">{d.prevScore}</span>
      </div>
      {d.dayPct != null && (
        <div className="flex justify-between gap-4 mt-1 border-t border-terminal-border pt-1">
          <span className="text-terminal-text-dim">Today</span>
          <span className={d.dayPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
            {d.dayPct >= 0 ? '+' : ''}{d.dayPct.toFixed(2)}%
          </span>
        </div>
      )}
      {d.proxy && (
        <div className="text-terminal-text-dim/40 mt-1">{d.proxy.replace('.AX', '')} proxy</div>
      )}
      <div className="text-terminal-gold/50 mt-1 text-2xs">Click to view sector detail →</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SectorStrengthRadar() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { audUsd } = useAudRates()

  const { data: quotes, isLoading, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['sectorRadarProxies', refreshKey],
    queryFn:  () => fetchBatch(PROXY_SYMS),
    staleTime: 5 * 60_000,
    retry: 2,
  })

  const chartData = useMemo(() => {
    return SECTOR_KEYS.map((sector) => {
      const { sym, asxTicker } = SECTOR_PROXIES[sector]
      const q = quotes?.[sym] ?? null
      const { current, prev } = q ? scoreStock(q) : { current: null, prev: null }
      return {
        sector,
        score:     current ?? 50,
        prevScore: prev ?? 50,
        proxy:     sym,
        asxTicker,
        dayPct:    q?.dayChangePct ?? null,
        price:     q?.price        ?? null,
        week52High: q?.week52High  ?? null,
        week52Low:  q?.week52Low   ?? null,
        raw:        q,
      }
    })
  }, [quotes])

  const handleSectorClick = useCallback((sectorName) => {
    const entry = SECTOR_PROXIES[sectorName]
    if (!entry) return
    window.dispatchEvent(
      new CustomEvent('madden:sector-select', { detail: { ticker: entry.asxTicker, sectorName } })
    )
    // Scroll Markets module to the top so the user can see SectorHeatmap
    document.getElementById('markets-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleChartClick = useCallback((data) => {
    const sectorName = data?.activePayload?.[0]?.payload?.sector
    if (sectorName) handleSectorClick(sectorName)
  }, [handleSectorClick])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    : null

  const sorted = [...chartData].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col h-full bg-terminal-bg">
      {/* Header */}
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span className="text-terminal-gold font-bold tracking-widest text-xs">SECTOR STRENGTH RADAR</span>
        <span className="text-terminal-text-dim font-normal text-2xs normal-case ml-1">— ASX composite scores</span>
        {isLoading && <span className="text-terminal-text-dim text-2xs font-normal ml-auto animate-pulse">LOADING...</span>}
        {isError && !isLoading && <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>}
        {!isLoading && !isError && <span className="text-terminal-green text-2xs font-normal ml-auto normal-case">● LIVE</span>}
        <button
          onClick={() => { setRefreshKey(k => k + 1) }}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors px-1"
          title="Refresh sector data"
        >
          ↻
        </button>
      </div>

      <div className="px-2 pb-1 text-2xs text-terminal-text-dim/50 flex-shrink-0">
        Composite score: price momentum (40%) · 52W range position (30%) · volume conviction (30%) · Click sector to drill down
      </div>

      {/* Radar chart */}
      <div style={{ height: 500 }} className="flex-shrink-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            cx="50%" cy="50%"
            outerRadius="75%"
            data={chartData}
            margin={{ top: 20, right: 50, bottom: 20, left: 50 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <PolarGrid
              stroke="rgba(30,70,140,0.35)"
              strokeDasharray=""
            />
            <PolarAngleAxis
              dataKey="sector"
              tick={<ClickableTick onSectorClick={handleSectorClick} />}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#374151', fontSize: 8, fontFamily: 'monospace' }}
              tickCount={5}
              stroke="rgba(30,70,140,0.2)"
            />
            {/* Previous session (dim blue) */}
            <Radar
              name="Previous close"
              dataKey="prevScore"
              stroke="rgba(74,144,217,0.45)"
              strokeWidth={1}
              fill="rgba(74,144,217,0.07)"
              dot={false}
              isAnimationActive={false}
            />
            {/* Current session (gold) */}
            <Radar
              name="Current session"
              dataKey="score"
              stroke="#c9a84c"
              strokeWidth={1.8}
              fill="rgba(201,168,76,0.18)"
              dot={{ r: 4, fill: '#c9a84c', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#c9a84c', stroke: '#fff', strokeWidth: 1 }}
              isAnimationActive
            />
            <Tooltip content={<RadarTooltip />} />
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280', paddingTop: 4 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score table */}
      <div className="border-t border-terminal-border flex-shrink-0 px-3 py-2">
        <div className="text-2xs text-terminal-gold/70 font-bold tracking-widest mb-2">SECTOR SCORES</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          {sorted.map(({ sector, score, dayPct }) => (
            <div
              key={sector}
              className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-terminal-accent/10 rounded px-1 -mx-1"
              onClick={() => handleSectorClick(sector)}
            >
              <span className="text-2xs text-terminal-text-dim w-24 flex-shrink-0 truncate">{sector}</span>
              <div className="flex-1 h-1.5 bg-terminal-border/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: scoreColor(score), opacity: 0.7 }}
                />
              </div>
              <span className="text-2xs font-bold w-6 text-right" style={{ color: scoreColor(score) }}>{score}</span>
              {dayPct != null && (
                <span className={`text-2xs w-14 text-right ${dayPct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + footer */}
      <div className="border-t border-terminal-border px-3 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-4">
          {[['0–33','WEAK','#ef4444'],['34–66','NEUTRAL','#fbbf24'],['67–100','STRONG','#22c55e']].map(([range, label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
              <span className="text-2xs text-terminal-text-dim">{label} <span className="text-terminal-text-dim/40">{range}</span></span>
            </div>
          ))}
        </div>
        {lastUpdate && <span className="text-2xs text-terminal-text-dim/40">Updated {lastUpdate} AEST</span>}
      </div>
    </div>
  )
}
