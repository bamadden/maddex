import { useMemo, useState, useCallback } from 'react'
import { InlineLoading } from '../../components/ui/ModuleStates'
import DataBadge from '../../components/ui/DataBadge'
import { sydneyTzNow, formatDate, sydneyClock } from '../../utils/dateUtils'
import { useQuery } from '@tanstack/react-query'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts'
import { fetchBatch, USING_MOCK_DATA, EQUITY_SOURCE } from '../../services/api'
import { GICS_SECTORS, SECTOR_ABBR, INDEX_SECTORS } from '../../data/sectorTaxonomy'
import { DemoBadge } from '../../components/ui/ModuleStates'
import SafeChart from '../../components/ui/SafeChart'
import { PAL } from '../../styles/palette.js'
import ScoreNote from '../../components/ui/ScoreNote'
import { sectorStrength } from '../../services/sectorStrength'

// Recharts renders these into SVG, where a bare 'monospace' resolves to the
// browser default — Courier on some systems — which is a visibly different
// typeface sitting inside a chart surrounded by IBM Plex Mono.
const MONO = "'IBM Plex Mono', Menlo, Monaco, Consolas, monospace"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s) {
  if (s == null) return '#4a5568'
  if (s >= 67)   return PAL.up
  if (s >= 34)   return PAL.gold
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
      fill={PAL.gold}
      fontSize={11}
      fontFamily="monospace"
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSectorClick(payload.value)}
    >
      {payload.value}
    </text>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-terminal-bg border border-terminal-border p-2 text-2xs shadow-lg min-w-[140px]">
      <div className="text-terminal-gold font-bold mb-1">{d.sector}</div>
      <div className="flex justify-between gap-4">
        <span className="text-terminal-text-dim">Score</span>
        <span className="font-bold" style={{ color: d.score == null ? undefined : scoreColor(d.score) }}>{d.score ?? '—'}</span>
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
        <div className="text-terminal-text-dim/40 mt-1">{d.proxy.replace(/\.(AX|L)$/i,'')} proxy</div>
      )}
      <div className="text-terminal-gold/50 mt-1 text-2xs">Click to view sector detail →</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SectorStrengthRadar({ selectedIndex = '^AXJO' }) {
  const [refreshKey, setRefreshKey] = useState(0)

  const sectorConfig = INDEX_SECTORS[selectedIndex] ?? INDEX_SECTORS['^AXJO']

  // Only include sectors with valid proxy stocks for this index
  const validSectors = useMemo(
    () => GICS_SECTORS.filter(s => sectorConfig[s]?.sym),
    [sectorConfig]
  )
  const proxySectors = useMemo(
    () => validSectors.map(s => ({ sector: s, sym: sectorConfig[s].sym })),
    [validSectors, sectorConfig]
  )
  const proxySyms = useMemo(() => proxySectors.map(p => p.sym), [proxySectors])

  const { data: quotes, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['sectorRadarProxies', selectedIndex, refreshKey],
    queryFn:  () => fetchBatch(proxySyms),
    staleTime: 5 * 60_000,
    retry: 2,
    enabled: proxySyms.length > 0,
  })

  const chartData = useMemo(() => {
    return proxySectors.map(({ sector, sym }) => {
      const q = quotes?.[sym] ?? null
      return {
        sector: SECTOR_ABBR[sector] ?? sector,
        fullSector: sector,
        score:     sectorStrength(q),
        proxy:     sym,
        dayPct:    q?.dayChangePct ?? null,
        price:     q?.price        ?? null,
        week52High: q?.week52High  ?? null,
        week52Low:  q?.week52Low   ?? null,
      }
    })
  }, [quotes, proxySectors])

  const handleSectorClick = useCallback((abbr) => {
    // abbr is the SECTOR_ABBR display value — map back to full GICS name
    const entry = proxySectors.find(p => SECTOR_ABBR[p.sector] === abbr)
    if (!entry) return
    window.dispatchEvent(
      new CustomEvent('madden:sector-select', { detail: { sectorName: entry.sector } })
    )
    document.getElementById('markets-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [proxySectors])

  const handleChartClick = useCallback((data) => {
    const abbr = data?.activePayload?.[0]?.payload?.sector
    if (abbr) handleSectorClick(abbr)
  }, [handleSectorClick])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    : null

  const indexLabels = {
    '^AXJO':'ASX 200','^AORD':'ALL ORDS','^GSPC':'S&P 500','^IXIC':'NASDAQ 100',
    '^DJI':'DOW JONES','^FTSE':'FTSE 100','^GDAXI':'DAX 40',
    '^N225':'NIKKEI 225','^HSI':'HANG SENG','^NZ50':'NZX 50','000001.SS':'SHANGHAI',
  }
  const indexLabel = indexLabels[selectedIndex] ?? selectedIndex.replace('^','')

  const sorted = [...chartData].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  return (
    <div className="flex flex-col bg-terminal-bg" style={{ height: 'auto' }}>
      {/* Header */}
      <div className="panel-header flex items-center gap-2 flex-shrink-0">
        <span className="text-terminal-gold font-bold tracking-widest text-xs">
          SECTOR STRENGTH — {indexLabel}
        </span>
        <span className="text-terminal-text-dim font-normal text-2xs normal-case ml-1">
          — composite scores · {validSectors.length} sectors
        </span>
        {isLoading && <InlineLoading label="Loading" className="ml-auto" />}
        {isError && !isLoading && <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>}
        {!isLoading && !isError && (USING_MOCK_DATA
          ? <span className="ml-auto"><DemoBadge /></span>
          : <span className="ml-auto"><DataBadge cls="LIVE" source={EQUITY_SOURCE} /></span>)}
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors px-1"
          title="Refresh sector data"
        >
          ↻
        </button>
      </div>

      <div className="px-2 pb-1 text-2xs text-terminal-text-dim/50 flex-shrink-0">
        Day move (4/7) · 52-week range position (3/7) · one representative stock per sector · Click sector to drill down
      </div>

      {/* Radar chart */}
      <div style={{ height: 500 }} className="flex-shrink-0 w-full">
        <SafeChart width="100%" height="100%">
          <RadarChart
            cx="50%" cy="50%"
            outerRadius="75%"
            data={chartData.filter((d) => d.score != null)}
            margin={{ top: 20, right: 50, bottom: 20, left: 50 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <PolarGrid stroke="rgba(30,70,140,0.35)" />
            <PolarAngleAxis
              dataKey="sector"
              tick={<ClickableTick onSectorClick={handleSectorClick} />}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#374151', fontSize: 11, fontFamily: MONO }}
              tickCount={5}
              stroke="rgba(30,70,140,0.2)"
            />
            <Radar
              name="Current session"
              dataKey="score"
              stroke={PAL.gold}
              strokeWidth={1.8}
              fill="rgba(201,168,76,0.18)"
              dot={{ r: 4, fill: PAL.gold, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: PAL.gold, stroke: '#fff', strokeWidth: 1 }}
              isAnimationActive
            />
            <Tooltip content={<RadarTooltip />} />
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 11, fontFamily: MONO, color: '#6b7280', paddingTop: 4 }}
            />
          </RadarChart>
        </SafeChart>
      </div>

      {/* Score table */}
      <div className="border-t border-terminal-border flex-shrink-0 px-3 py-2">
        <div className="flex items-center gap-2 mb-2 flex-wrap" data-sector-scores-label>
          <span className="text-2xs text-terminal-gold/70 font-bold tracking-widest">SECTOR SCORES</span>
          {USING_MOCK_DATA ? <DemoBadge /> : <DataBadge cls="LIVE" source={EQUITY_SOURCE} at={dataUpdatedAt || null} />}
        </div>
        <ScoreNote method="sector-strength" asOf={dataUpdatedAt ? `${formatDate(dataUpdatedAt, { year: false })} ${sydneyClock(dataUpdatedAt).text}` : null} className="mb-1.5" />
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
                  style={{ width: `${score ?? 0}%`, backgroundColor: score == null ? 'transparent' : scoreColor(score), opacity: 0.7 }}
                />
              </div>
              <span className="text-2xs font-bold w-6 text-right" style={{ color: score == null ? undefined : scoreColor(score) }}>{score ?? '—'}</span>
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
          {[['0–33','WEAK','#ef4444'],['34–66','NEUTRAL',PAL.gold],['67–100','STRONG',PAL.up]].map(([range, label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
              <span className="text-2xs text-terminal-text-dim">{label} <span className="text-terminal-text-dim/40">{range}</span></span>
            </div>
          ))}
        </div>
        {lastUpdate && <span className="text-2xs text-terminal-text-dim/40">Updated {lastUpdate} {sydneyTzNow()}</span>}
      </div>
    </div>
  )
}
