import { useState, useMemo, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import {
  CORRELATION_UNIVERSE, DEFAULT_ASSET_IDS, PERIODS,
  assetInfo, correlationFor, strengthLabel, whatThisMeans, cellColor, generateScatterPoints, diversificationScore, suggestDiversifier,
} from '../../services/correlationService'

const CELL = 44

function ScatterMini({ idA, idB, period }) {
  const points = useMemo(() => generateScatterPoints(idA, idB, period, 36), [idA, idB, period])
  const size = 80
  const toPx = (v) => size / 2 + (v / 3.2) * (size / 2) // normal() range roughly ±3
  return (
    <svg width={size} height={size} className="bg-terminal-bg border border-terminal-border flex-shrink-0">
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="var(--t-border)" strokeWidth={1} />
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="var(--t-border)" strokeWidth={1} />
      {points.map((p, i) => (
        <circle key={i} cx={toPx(p.x)} cy={size - toPx(p.y)} r={1.6} fill="#C9A84C" opacity={0.8} />
      ))}
    </svg>
  )
}

function AssetPicker({ excludeIds, onAdd, onClose }) {
  const { watchlist } = useStore()
  const [q, setQ] = useState('')
  const candidates = useMemo(() => {
    const fromUniverse = CORRELATION_UNIVERSE.map((a) => a.id)
    const fromWatchlist = (watchlist ?? []).map((s) => s.replace(/\.AX$/i, ''))
    const all = [...new Set([...fromUniverse, ...fromWatchlist])].filter((id) => !excludeIds.includes(id))
    const lc = q.trim().toUpperCase()
    return all
      .map((id) => assetInfo(id))
      .filter((a) => !lc || a.id.includes(lc) || a.label.includes(lc) || a.name.toUpperCase().includes(lc))
      .slice(0, 30)
  }, [q, excludeIds, watchlist])

  return (
    <div className="absolute top-full left-0 mt-1 z-20 bg-terminal-panel border border-terminal-border shadow-2xl w-64" onMouseLeave={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search symbol..."
        className="w-full bg-terminal-bg border-b border-terminal-border text-2xs text-terminal-text px-2 py-1.5"
      />
      <div className="max-h-64 overflow-y-auto">
        {candidates.map((a) => (
          <button
            key={a.id}
            onClick={() => { onAdd(a.id); onClose() }}
            className="w-full text-left px-2 py-1.5 text-2xs hover:bg-terminal-accent/20 flex items-center justify-between"
          >
            <span className="font-bold text-terminal-text-bright">{a.label}</span>
            <span className="text-terminal-text-dim truncate ml-2">{a.name}</span>
          </button>
        ))}
        {candidates.length === 0 && <div className="px-2 py-3 text-2xs text-terminal-text-dim text-center">No matches</div>}
      </div>
    </div>
  )
}

export default function CorrelationExplorer({ initialAssets, onClose }) {
  const [assetIds, setAssetIds] = useState(() => {
    const seed = (initialAssets ?? []).map((s) => s.replace(/\.AX$/i, '').toUpperCase())
    const merged = [...new Set([...seed, ...DEFAULT_ASSET_IDS])]
    return merged.slice(0, 12)
  })
  const [period, setPeriod] = useState('6M')
  const [hovered, setHovered] = useState(null) // { a, b, r, x, y }
  const [sortBy, setSortBy] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const containerRef = useRef(null)

  const orderedIds = useMemo(() => {
    if (!sortBy || !assetIds.includes(sortBy)) return assetIds
    const rest = assetIds.filter((id) => id !== sortBy)
    rest.sort((a, b) => correlationFor(sortBy, b, period) - correlationFor(sortBy, a, period))
    return [sortBy, ...rest]
  }, [assetIds, sortBy, period])

  const removeAsset = (id) => {
    setAssetIds((prev) => prev.filter((x) => x !== id))
    if (sortBy === id) setSortBy(null)
  }
  const addAsset = (id) => {
    if (!assetIds.includes(id)) setAssetIds((prev) => [...prev, id])
  }

  // Portfolio diversification score — from the real portfolio tracker's
  // holdings, independent of whatever's currently loaded into the matrix.
  const portfolioIds = useMemo(() => {
    try {
      const holdings = JSON.parse(localStorage.getItem('madden_portfolio_v2') ?? '[]')
      return holdings.filter((h) => h.type === 'asx').map((h) => h.symbol)
    } catch { return [] }
  }, [])
  const diversification = useMemo(() => diversificationScore(portfolioIds, period), [portfolioIds, period])
  const suggestion = useMemo(() => (portfolioIds.length >= 2 ? suggestDiversifier(portfolioIds, period) : null), [portfolioIds, period])

  const handleCellHover = (e, a, b) => {
    const rect = containerRef.current.getBoundingClientRect()
    const cellRect = e.currentTarget.getBoundingClientRect()
    setHovered({ a, b, r: correlationFor(a, b, period), x: cellRect.left - rect.left + CELL / 2, y: cellRect.bottom - rect.top })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-terminal-bg flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold text-terminal-gold">CORRELATION EXPLORER</span>
          <span className="text-2xs text-terminal-text-dim">{assetIds.length} assets · {period}</span>
        </div>
        <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-lg leading-none">✕</button>
      </div>

      {/* Diversification score */}
      <div className="px-5 py-2.5 border-b border-terminal-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <span className="text-2xs text-terminal-text-dim">PORTFOLIO DIVERSIFICATION:</span>
        {portfolioIds.length >= 2 ? (
          <span className={`text-sm font-bold ${diversification.score >= 70 ? 'text-terminal-green' : diversification.score >= 45 ? 'text-terminal-gold' : 'text-terminal-red'}`}>
            {diversification.score}/100 — {diversification.label}
          </span>
        ) : (
          <span className="text-2xs text-terminal-text-dim/60">— (add 2+ ASX holdings to your portfolio to see this)</span>
        )}
        {suggestion && (
          <span className="text-2xs text-terminal-text-dim">
            Adding <span className="text-terminal-gold font-bold">{suggestion.label}</span> would reduce correlation with your current holdings.
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="px-5 py-2.5 border-b border-terminal-border flex-shrink-0 flex items-center gap-3 flex-wrap relative">
        <div className="flex gap-0 border border-terminal-border">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-2xs font-bold ${period === p ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
            >{p}</button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >+ ADD ASSET</button>
          {pickerOpen && <AssetPicker excludeIds={assetIds} onAdd={addAsset} onClose={() => setPickerOpen(false)} />}
        </div>
        <span className="text-2xs text-terminal-text-dim/60">Click a row/column header to sort by correlation with that asset. Hover any cell for detail.</span>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-5 relative" ref={containerRef}>
        <div className="inline-block relative">
          <div className="flex">
            <div style={{ width: 70 }} />
            {orderedIds.map((id) => (
              <div key={id} style={{ width: CELL }} className="text-2xs text-terminal-gold text-center font-bold relative group">
                <button onClick={() => setSortBy(id)} className={`hover:text-terminal-gold-bright ${sortBy === id ? 'text-terminal-gold-bright underline' : ''}`}>{assetInfo(id).label}</button>
                <button
                  onClick={() => removeAsset(id)}
                  className="absolute -top-1 right-0 text-terminal-text-dim/40 hover:text-terminal-red opacity-0 group-hover:opacity-100 text-2xs"
                  title={`Remove ${assetInfo(id).label}`}
                >×</button>
              </div>
            ))}
          </div>
          {orderedIds.map((rowId) => (
            <div key={rowId} className="flex items-center">
              <div style={{ width: 70 }} className="text-2xs text-terminal-gold font-bold text-right pr-2 truncate">
                <button onClick={() => setSortBy(rowId)} className={`hover:text-terminal-gold-bright ${sortBy === rowId ? 'text-terminal-gold-bright underline' : ''}`}>{assetInfo(rowId).label}</button>
              </div>
              {orderedIds.map((colId) => {
                const r = correlationFor(rowId, colId, period)
                return (
                  <div
                    key={colId}
                    onMouseEnter={(e) => handleCellHover(e, rowId, colId)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ width: CELL, height: 36, background: rowId === colId ? '#c9a84c' : cellColor(r) }}
                    className="flex items-center justify-center text-2xs font-mono font-bold cursor-pointer border border-terminal-bg/40 hover:outline hover:outline-1 hover:outline-terminal-gold"
                  >
                    <span style={{ color: rowId === colId ? '#0a1220' : Math.abs(r) > 0.55 ? '#fff' : '#0a1220' }}>{r.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Hover popup */}
          {hovered && hovered.a !== hovered.b && (
            <div
              className="absolute z-30 bg-terminal-panel border border-terminal-gold shadow-2xl p-3"
              style={{ left: Math.min(hovered.x, 500), top: hovered.y + 6, width: 260 }}
            >
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">
                {assetInfo(hovered.a).label} · {assetInfo(hovered.b).label}
              </div>
              <div className="flex items-start gap-3">
                <ScatterMini idA={hovered.a} idB={hovered.b} period={period} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-terminal-text-bright">r = {hovered.r.toFixed(2)}</div>
                  <div className="text-2xs text-terminal-text-dim mb-1.5">{strengthLabel(hovered.r)}</div>
                  <div className="text-2xs text-terminal-text leading-snug">{whatThisMeans(hovered.a, hovered.b, hovered.r)}</div>
                </div>
              </div>
              <button
                onClick={() => dispatchAskAI({
                  instruction: `Explain the correlation between ${assetInfo(hovered.a).label} and ${assetInfo(hovered.b).label} (r=${hovered.r.toFixed(2)}, ${period} lookback). Why might they move together (or apart) like this, and what should an Australian investor take from it?`,
                }, { rawPrompt: true })}
                className="mt-2 w-full text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >MADDENAI INSIGHT →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
