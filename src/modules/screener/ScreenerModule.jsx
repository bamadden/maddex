import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import { useStore } from '../../store/useStore'
import { dispatchAskAI } from '../../utils/askAI'
import ModuleHeader from '../../components/ui/ModuleHeader'
import { fmt } from '../../utils/format'
import ResearchNoteGenerator from '../../components/researchNote/ResearchNoteGenerator'

const ALL_STOCKS = [
  ...Object.entries(MOCK_ASX_STOCKS).map(([symbol, s]) => ({ symbol, exchange: 'ASX', ...s })),
  ...Object.entries(MOCK_US_STOCKS).map(([symbol, s]) => ({ symbol, exchange: 'US', ...s })),
]
const SECTORS = [...new Set(ALL_STOCKS.map((s) => s.sector))].sort()
const MAX_PE  = Math.max(...ALL_STOCKS.map((s) => s.pe))
const MAX_DIV = Math.max(...ALL_STOCKS.map((s) => s.divYield))

// `criteria` names the numeric thresholds a preset constrains, so results can
// be graded on the thing that was actually screened for. Presets with no
// numeric threshold (ASX CORE, SMALL CAPS) declare none and are shown
// unranked, which is honest — there is no "better" within a sector filter.
const PRESETS = [
  { key: 'dividend',   label: 'DIVIDEND KINGS', filter: (s) => s.divYield >= 4,                   criteria: { divMin: 4 } },
  { key: 'value',      label: 'VALUE PLAYS',    filter: (s) => s.pe > 0 && s.pe < 15,             criteria: { peMax: 15 } },
  { key: 'momentum',   label: 'MOMENTUM',       filter: (s) => s.changePct >= 2,                  criteria: { changeMin: 2 } },
  { key: 'asx200',     label: 'ASX CORE',       filter: (s) => s.exchange === 'ASX',              criteria: {} },
  { key: 'smallcap',   label: 'SMALL CAPS',     filter: (s) => s.marketCap < 10_000_000_000,      criteria: {} },
  { key: 'techgrowth', label: 'TECH GROWTH',    filter: (s) => /^(IT|Tech|Technology)$/i.test(s.sector) && s.changePct > 0, criteria: { changeMin: 0 } },
]

// Lightweight local NL parser — handles the common patterns without needing
// a live AI call: "PE under 15", "dividend yield over 4%", a sector name,
// "materials sector", "small cap(s)". Returns { filters, notes, understood }.
function parseQuery(q) {
  const criteria = {}
  const text = q.toLowerCase()
  const filters = []
  const notes = []

  const peMatch = text.match(/p\/?e\s*(under|below|less than|<)\s*(\d+(\.\d+)?)/)
  if (peMatch) { const n = parseFloat(peMatch[2]); filters.push((s) => s.pe > 0 && s.pe < n); notes.push(`PE < ${n}`); criteria.peMax = n }
  const peOverMatch = text.match(/p\/?e\s*(over|above|greater than|>)\s*(\d+(\.\d+)?)/)
  if (peOverMatch) { const n = parseFloat(peOverMatch[2]); filters.push((s) => s.pe > n); notes.push(`PE > ${n}`) }

  const divMatch = text.match(/div(idend)?\s*(yield)?\s*(over|above|greater than|>)\s*(\d+(\.\d+)?)/)
  if (divMatch) { const n = parseFloat(divMatch[4]); filters.push((s) => s.divYield >= n); notes.push(`Div yield >= ${n}%`); criteria.divMin = n }
  const divUnderMatch = text.match(/div(idend)?\s*(yield)?\s*(under|below|less than|<)\s*(\d+(\.\d+)?)/)
  if (divUnderMatch) { const n = parseFloat(divUnderMatch[4]); filters.push((s) => s.divYield < n); notes.push(`Div yield < ${n}%`) }

  const upMatch = text.match(/up\s*(more than|over|>)?\s*(\d+(\.\d+)?)\s*%/)
  if (upMatch) { const n = parseFloat(upMatch[2]); filters.push((s) => s.changePct >= n); notes.push(`Up >= ${n}%`); criteria.changeMin = n }
  const downMatch = text.match(/down\s*(more than|over|>)?\s*(\d+(\.\d+)?)\s*%/)
  if (downMatch) { const n = parseFloat(downMatch[2]); filters.push((s) => s.changePct <= -n); notes.push(`Down >= ${n}%`) }

  const sectorHit = SECTORS.find((sec) => text.includes(sec.toLowerCase()))
  if (sectorHit) { filters.push((s) => s.sector === sectorHit); notes.push(`Sector: ${sectorHit}`) }

  if (/small\s*cap/.test(text)) { filters.push((s) => s.marketCap < 10_000_000_000); notes.push('Small cap') }
  if (/large\s*cap|blue\s*chip/.test(text)) { filters.push((s) => s.marketCap >= 50_000_000_000); notes.push('Large cap') }
  if (/\basx\b/.test(text) && !/\bus\b/.test(text)) { filters.push((s) => s.exchange === 'ASX'); notes.push('ASX only') }
  if (/\bus\b|american|nasdaq|nyse/.test(text)) { filters.push((s) => s.exchange === 'US'); notes.push('US only') }

  // criteria is the subset of the above that is numeric and rankable — a
  // sector or exchange match narrows the field but says nothing about which
  // result is a better fit, so it contributes no score.
  return { filters, notes, criteria, understood: filters.length > 0 }
}

// Composite "match strength" — every row shown already passed every active
// filter (a hard boolean pass/fail), so to avoid a flat, meaningless 100%
// on every row this scores each match by the same quality composite the
// results are sorted by (yield + inverse PE), scaled into a 60-100% band —
// a below-60 stock wouldn't read as a sensible "match" once it's already
// cleared the filter, but there's still real spread worth showing above that.
// ─── Match scoring ─────────────────────────────────────────────────────────
//
// Grades each result against the criteria ACTUALLY IN PLAY, not against a
// fixed formula.
//
// The previous version scored every stock as divYield + (100 - PE), whatever
// the user had screened for, then normalised the range into 60-100%. Two
// consequences, both bad: screening for tech growth ranked results by
// dividend yield, and every row scored at least 60% so the column always
// looked reassuring. On "ASX CORE" — a screen with no numeric criteria at all
// — results still came back 96-100% matched. The number was decoration.
//
// Now: each numeric criterion contributes how far past its threshold the
// stock sits, and the score is the mean across criteria. Screen for PE under
// 15 and yield over 4%, and PE 9 / yield 7% outranks PE 14.5 / yield 4.1%,
// which is the ranking a person doing that screen actually wants.
//
// Where a screen has no numeric criteria (a sector or exchange filter alone),
// there is nothing to grade and scoreCriteria returns null — the column then
// hides rather than inventing a number. That is the important half: a
// screener that cannot rank should say so.

// Each entry reports how well a stock satisfies one threshold, 0..1, where 0
// is "only just qualifies" and 1 is "comfortably past it".
const CRITERION_SCORERS = {
  // Lower is better, and the headroom is measured against the threshold.
  peMax: (s, limit) => (s.pe > 0 && limit > 0 ? clamp01((limit - s.pe) / limit) : null),
  divMin: (s, floor) => (floor > 0 ? clamp01((s.divYield - floor) / Math.max(floor, 1)) : null),
  pos52Min: (s, floor) => (floor > 0 && s.pos52 != null ? clamp01((s.pos52 - floor) / Math.max(100 - floor, 1)) : null),
  changeMin: (s, floor) => clamp01((s.changePct - floor) / 5),
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))

// criteria: { peMax?, divMin?, pos52Min?, changeMin? } — only the ones the
// active screen actually constrains.
function scoreCriteria(stocks, criteria) {
  const active = Object.entries(criteria).filter(([, v]) => v != null)
  if (!active.length) return null

  return stocks.map((s) => {
    const parts = active
      .map(([key, threshold]) => CRITERION_SCORERS[key]?.(s, threshold))
      .filter((v) => v != null)
    if (!parts.length) return { ...s, matchPct: null }
    const mean = parts.reduce((a, b) => a + b, 0) / parts.length
    // 50-100 rather than 0-100: everything here already passed the screen, so
    // the floor is "qualifies" and the range above it is headroom.
    return { ...s, matchPct: Math.round(50 + 50 * mean) }
  })
}

const MKT_CAP_BANDS = [
  { key: 'all',   label: 'All',   test: () => true },
  { key: 'large', label: 'Large (>A$50B)',  test: (s) => s.marketCap >= 50_000_000_000 },
  { key: 'mid',   label: 'Mid (A$10-50B)',  test: (s) => s.marketCap >= 10_000_000_000 && s.marketCap < 50_000_000_000 },
  { key: 'small', label: 'Small (<A$10B)',  test: (s) => s.marketCap < 10_000_000_000 },
]

const SORT_VALUE = {
  symbol:   (s) => s.symbol,
  price:    (s) => s.price,
  pe:       (s) => s.pe,
  divYield: (s) => s.divYield,
  marketCap:(s) => s.marketCap,
  matchPct: (s) => s.matchPct,
}

function MatchBar({ pct }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-14 h-1.5 bg-terminal-border/40 rounded-sm overflow-hidden">
        <div className="h-full bg-terminal-green" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-terminal-green font-bold w-8 text-right">{pct}%</span>
    </div>
  )
}

function FiltersSidebar({ open, filters, setFilters, onReset }) {
  if (!open) return null
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  return (
    <div className="w-56 flex-shrink-0 border-r border-terminal-border overflow-y-auto p-3 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">MANUAL FILTERS</span>
        <button onClick={onReset} className="text-2xs text-terminal-text-dim hover:text-terminal-red">RESET</button>
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim">EXCHANGE</div>
        <div className="flex border border-terminal-border">
          {['ASX', 'US', 'ALL'].map((ex) => (
            <button
              key={ex}
              onClick={() => set('exchange', ex)}
              className={`flex-1 py-1 text-2xs font-bold transition-colors border-r border-terminal-border last:border-r-0 ${
                filters.exchange === ex ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
            >{ex}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim">SECTOR</div>
        <select
          value={filters.sector}
          onChange={(e) => set('sector', e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          <option value="ALL">All sectors</option>
          {SECTORS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim flex justify-between">
          <span>PE RATIO</span><span className="text-terminal-text-bright">≤ {filters.peMax.toFixed(0)}</span>
        </div>
        <input
          type="range" min="0" max={Math.ceil(MAX_PE)} value={filters.peMax}
          onChange={(e) => set('peMax', Number(e.target.value))}
          className="w-full accent-terminal-gold"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim">MARKET CAP</div>
        <select
          value={filters.mktCap}
          onChange={(e) => set('mktCap', e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
        >
          {MKT_CAP_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim flex justify-between">
          <span>DIVIDEND YIELD</span><span className="text-terminal-text-bright">≥ {filters.divMin.toFixed(1)}%</span>
        </div>
        <input
          type="range" min="0" max={Math.ceil(MAX_DIV)} step="0.5" value={filters.divMin}
          onChange={(e) => set('divMin', Number(e.target.value))}
          className="w-full accent-terminal-gold"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-2xs text-terminal-text-dim flex justify-between">
          <span>52W POSITION</span><span className="text-terminal-text-bright">≥ {filters.pos52Min}%</span>
        </div>
        <input
          type="range" min="0" max="100" step="5" value={filters.pos52Min}
          onChange={(e) => set('pos52Min', Number(e.target.value))}
          className="w-full accent-terminal-gold"
        />
        <div className="text-2xs text-terminal-text-dim/50">% of the way from 52W low to high</div>
      </div>
    </div>
  )
}

// The sidebar's numeric constraints, as criteria. Only values the user has
// actually moved off the default count — a PE slider still at its maximum is
// not a constraint and grading against it would score every stock the same.
function manualCriteria(f) {
  const out = {}
  if (f.peMax != null && f.peMax < Math.ceil(MAX_PE)) out.peMax = f.peMax
  if (f.divMin > 0) out.divMin = f.divMin
  if (f.pos52Min > 0) out.pos52Min = f.pos52Min
  return out
}

const DEFAULT_FILTERS = { exchange: 'ALL', sector: 'ALL', peMax: Math.ceil(MAX_PE), mktCap: 'all', divMin: 0, pos52Min: 0 }

const SAVED_SCREENS_KEY = 'maddex_saved_screens'
function loadSavedScreens() {
  try {
    const raw = localStorage.getItem(SAVED_SCREENS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
function persistSavedScreens(list) {
  try { localStorage.setItem(SAVED_SCREENS_KEY, JSON.stringify(list)) } catch { /* best-effort */ }
}

export default function ScreenerModule() {
  const { openModal } = useStore()
  const [query, setQuery] = useState('')
  const [activePreset, setActivePreset] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState('matchPct')
  const [sortDir, setSortDir] = useState('desc')
  const [researchNoteAsset, setResearchNoteAsset] = useState(null)
  const [savedScreens, setSavedScreens] = useState(() => loadSavedScreens())
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')
  const [showSavedList, setShowSavedList] = useState(false)

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  const saveCurrentScreen = () => {
    const name = saveNameInput.trim() || query.trim() || 'Untitled screen'
    const entry = { id: `screen_${Date.now()}`, name, createdAt: new Date().toISOString(), query, activePreset, filters }
    const next = [entry, ...savedScreens].slice(0, 30)
    setSavedScreens(next)
    persistSavedScreens(next)
    setShowSavePrompt(false)
    setSaveNameInput('')
  }

  const loadSavedScreen = (screen) => {
    setFilters(screen.filters ?? DEFAULT_FILTERS)
    setQuery(screen.query ?? '')
    if (screen.activePreset) {
      setActivePreset(screen.activePreset)
      setParsed(null)
    } else if (screen.query) {
      setActivePreset(null)
      setParsed(parseQuery(screen.query))
    } else {
      setActivePreset(null)
      setParsed(null)
    }
    setShowSavedList(false)
  }

  const deleteSavedScreen = (id) => {
    const next = savedScreens.filter((s) => s.id !== id)
    setSavedScreens(next)
    persistSavedScreens(next)
  }

  const runQuery = (text = query) => {
    setActivePreset(null)
    if (!text.trim()) { setParsed(null); return }
    setParsed(parseQuery(text))
  }

  const runPreset = (key) => {
    const preset = PRESETS.find((p) => p.key === key)
    setActivePreset(key)
    setParsed(null)
    setQuery(preset.label)
  }

  const askAIToInterpret = () => {
    dispatchAskAI({
      instruction:
        `You are MaddenAI's stock screener. A user typed this natural-language screen: "${query}"\n\n` +
        'Interpret it and describe, in plain terms, which ASX/US stocks would match and why — ' +
        'covering PE, dividend yield, sector, market cap or momentum criteria as relevant. ' +
        'This is a demo dataset, so speak in general terms about the type of stock rather than pulling live prices. ' +
        'General information only, not advice.',
    }, { rawPrompt: true })
  }

  const manualFiltered = useMemo(() => {
    if (!filtersActive) return ALL_STOCKS
    const band = MKT_CAP_BANDS.find((b) => b.key === filters.mktCap)
    return ALL_STOCKS.filter((s) => {
      if (filters.exchange !== 'ALL' && s.exchange !== filters.exchange) return false
      if (filters.sector !== 'ALL' && s.sector !== filters.sector) return false
      if (s.pe > 0 && s.pe > filters.peMax) return false
      if (!band.test(s)) return false
      if (s.divYield < filters.divMin) return false
      const pos52 = s.week52High > s.week52Low ? ((s.price - s.week52Low) / (s.week52High - s.week52Low)) * 100 : 50
      if (pos52 < filters.pos52Min) return false
      return true
    })
  }, [filters, filtersActive])

  const results = useMemo(() => {
    let base = manualFiltered
    let queryFilters = []
    if (activePreset) queryFilters = [PRESETS.find((p) => p.key === activePreset).filter]
    else if (parsed?.filters?.length) queryFilters = parsed.filters
    else if (!filtersActive) return []

    const matched = base.filter((s) => queryFilters.every((f) => f(s)))

    // Criteria come from every active source: the preset, the parsed natural
    // language query, and the manual sidebar. A screen combining "PE under
    // 15" typed in the box with a dividend floor from the sidebar is graded
    // on both.
    const criteria = {
      ...(activePreset ? PRESETS.find((p) => p.key === activePreset).criteria : {}),
      ...(parsed?.criteria ?? {}),
      ...(filtersActive ? manualCriteria(filters) : {}),
    }

    const scored = scoreCriteria(matched, criteria) ?? matched.map((s) => ({ ...s, matchPct: null }))
    // Falls back to market cap when the screen is unrankable, so an
    // unranked list still arrives in a sensible order rather than whatever
    // the source array happened to be in.
    const unranked = scored.length > 0 && scored[0].matchPct == null
    const getVal = (unranked && sortKey === 'matchPct')
      ? SORT_VALUE.marketCap
      : (SORT_VALUE[sortKey] ?? SORT_VALUE.matchPct)
    return [...scored].sort((a, b) => {
      const av = getVal(a), bv = getVal(b)
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [activePreset, parsed, manualFiltered, filtersActive, filters, sortKey, sortDir])

  // Whether the active screen produced anything rankable. When it did not
  // — a sector or exchange filter alone — the MATCH column is hidden rather
  // than filled with a number that means nothing.
  const rankable = results.length > 0 && results[0].matchPct != null

  const hasSearched = activePreset != null || parsed != null || filtersActive
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }
  const sortArrow = (key) => sortKey === key ? <span className="text-terminal-gold ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span> : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader title="STOCK SCREENER" subtitle="Natural language or preset filters" moduleId="screener" />

      <div className="p-3 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title="Manual filters"
            className={`flex-shrink-0 text-2xs px-2.5 py-2 border transition-colors font-bold ${
              sidebarOpen || filtersActive
                ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10'
                : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
            }`}
          >☰ FILTERS{filtersActive ? ' •' : ''}</button>

          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-text-dim pointer-events-none">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runQuery() }}
              placeholder='e.g. ASX stocks with PE under 15 and dividend yield over 4%'
              className="w-full bg-terminal-bg border border-terminal-border focus:border-terminal-gold outline-none transition-colors text-xs pl-9 pr-9 py-2 text-terminal-text-bright font-mono"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setParsed(null); setActivePreset(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-text-dim hover:text-terminal-red"
              >✕</button>
            )}
          </div>
          <button
            onClick={() => runQuery()}
            className="flex-shrink-0 text-xs px-4 py-2 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
          >SCREEN ▶</button>

          {hasSearched && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowSavePrompt((v) => !v); setShowSavedList(false) }}
                title="Save this screen"
                className="text-2xs px-2.5 py-2 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors font-bold"
              >★ SAVE</button>
              {showSavePrompt && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-terminal-header border border-terminal-gold z-20 p-2 space-y-2">
                  <div className="text-2xs text-terminal-gold font-bold tracking-widest">SAVE THIS SCREEN</div>
                  <input
                    autoFocus
                    value={saveNameInput}
                    onChange={(e) => setSaveNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentScreen(); if (e.key === 'Escape') setShowSavePrompt(false) }}
                    placeholder={query.trim() || 'Screen name'}
                    className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={saveCurrentScreen} className="flex-1 btn-primary btn-sm">SAVE</button>
                    <button onClick={() => setShowSavePrompt(false)} className="flex-1 btn-secondary btn-sm">CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowSavedList((v) => !v); setShowSavePrompt(false) }}
              title="Saved screens"
              className={`text-2xs px-2.5 py-2 border transition-colors font-bold ${
                showSavedList ? 'border-terminal-gold text-terminal-gold bg-terminal-gold/10' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
              }`}
            >SAVED ({savedScreens.length})</button>
            {showSavedList && (
              <div className="absolute right-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-terminal-header border border-terminal-border z-20">
                {savedScreens.length === 0 ? (
                  <div className="p-3 text-2xs text-terminal-text-dim text-center">No saved screens yet</div>
                ) : savedScreens.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-terminal-border/50 last:border-b-0 hover:bg-terminal-accent/10 group">
                    <button onClick={() => loadSavedScreen(s)} className="min-w-0 text-left flex-1">
                      <div className="text-2xs text-terminal-text-bright font-semibold truncate">{s.name}</div>
                      <div className="text-2xs text-terminal-text-dim/60">{new Date(s.createdAt).toLocaleDateString('en-AU')}</div>
                    </button>
                    <button
                      onClick={() => deleteSavedScreen(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-2xs text-terminal-text-dim hover:text-terminal-red transition-opacity flex-shrink-0"
                    >🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => runPreset(p.key)}
              className={`text-2xs px-2.5 py-0.5 rounded-full border transition-colors ${
                activePreset === p.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold font-bold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {parsed && (
          <div className="mt-2 text-2xs text-terminal-text-dim">
            {parsed.understood ? (
              <>Understood: {parsed.notes.join(' · ')}</>
            ) : (
              <span className="text-terminal-red">
                Couldn't parse that locally.{' '}
                <button onClick={askAIToInterpret} className="underline text-terminal-gold hover:text-terminal-gold/70">Ask MaddenAI to interpret →</button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <FiltersSidebar open={sidebarOpen} filters={filters} setFilters={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} />

        <div className="flex-1 overflow-auto">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-terminal-text-dim text-2xs px-8 text-center">
              <div className="text-3xl mb-2">▲</div>
              <div>Type a natural-language screen, pick a preset, or open manual filters.</div>
              <div className="text-terminal-text-dim/60">Demo dataset — {ALL_STOCKS.length} tracked ASX + US stocks.</div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-12 h-12 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center">
                <Search size={20} strokeWidth={1.75} />
              </div>
              <div className="text-terminal-text-bright text-xs font-semibold tracking-wide">NO MATCHING STOCKS</div>
              <div className="text-terminal-text-dim text-2xs max-w-sm">
                Try different criteria or ask MaddenAI
              </div>
              <button
                onClick={askAIToInterpret}
                className="mt-1 text-2xs font-bold text-terminal-gold border border-terminal-gold/40 rounded-full px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >ASK MADDENAI</button>
            </div>
          ) : (
            <table className="w-full text-2xs">
              <thead className="sticky top-0 bg-terminal-header z-10">
                <tr className="text-terminal-text-dim select-none">
                  <th onClick={() => toggleSort('symbol')} className="text-left px-3 py-1.5 cursor-pointer hover:text-terminal-gold">TICKER{sortArrow('symbol')}</th>
                  <th className="text-left px-3 py-1.5">COMPANY</th>
                  <th onClick={() => toggleSort('price')} className="text-right px-3 py-1.5 cursor-pointer hover:text-terminal-gold">PRICE{sortArrow('price')}</th>
                  <th className="text-right px-3 py-1.5">CHANGE</th>
                  <th onClick={() => toggleSort('pe')} className="text-right px-3 py-1.5 cursor-pointer hover:text-terminal-gold">PE{sortArrow('pe')}</th>
                  <th onClick={() => toggleSort('divYield')} className="text-right px-3 py-1.5 cursor-pointer hover:text-terminal-gold">DIV YIELD{sortArrow('divYield')}</th>
                  <th onClick={() => toggleSort('marketCap')} className="text-right px-3 py-1.5 cursor-pointer hover:text-terminal-gold">MKT CAP{sortArrow('marketCap')}</th>
                  <th className="text-left px-3 py-1.5">SECTOR</th>
                  {rankable && (
                    <th
                      onClick={() => toggleSort('matchPct')}
                      title="How far past the screen's thresholds each result sits — 50% only just qualifies, 100% is comfortably clear"
                      className="text-right px-3 py-1.5 cursor-pointer hover:text-terminal-gold"
                    >MATCH %{sortArrow('matchPct')}</th>
                  )}
                  <th className="px-3 py-1.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {results.map((s) => (
                  <tr
                    key={s.symbol}
                    className="group border-t border-terminal-border/50 hover:bg-terminal-accent/20 cursor-pointer"
                    onClick={() => openModal?.({
                      symbol: s.symbol, name: s.name, price: s.price, pct: s.changePct,
                      change: s.price * (s.changePct / 100), type: s.exchange === 'ASX' ? 'asx' : 'us',
                    })}
                  >
                    <td className="px-3 py-1.5 font-bold text-terminal-gold">{s.symbol}</td>
                    <td className="px-3 py-1.5 text-terminal-text-bright truncate max-w-[200px]">{s.name}</td>
                    <td className="px-3 py-1.5 text-right">{s.exchange === 'ASX' ? 'A$' : 'US$'}{s.price.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${s.changePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                      {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5 text-right">{s.pe > 0 ? s.pe.toFixed(1) : '—'}</td>
                    <td className="px-3 py-1.5 text-right">{s.divYield.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right text-terminal-text-dim">{fmt.large(s.marketCap)}</td>
                    <td className="px-3 py-1.5">{s.sector}</td>
                    {rankable && <td className="px-3 py-1.5"><MatchBar pct={s.matchPct} /></td>}
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setResearchNoteAsset({ symbol: s.symbol, name: s.name, type: s.exchange === 'ASX' ? 'asx' : 'us' })
                        }}
                        title="Generate research note"
                        className="opacity-0 group-hover:opacity-100 text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold px-1.5 py-0.5 rounded transition-opacity mr-1"
                      >📄</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatchAskAI({ name: s.name, ticker: s.symbol, price: `${s.exchange === 'ASX' ? 'A$' : 'US$'}${s.price.toFixed(2)}`, change: fmt.pct(s.changePct), sector: s.sector })
                        }}
                        className="opacity-0 group-hover:opacity-100 text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border hover:border-terminal-gold px-1.5 py-0.5 rounded transition-opacity"
                      >Ask MaddenAI</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {researchNoteAsset && (
        <ResearchNoteGenerator asset={researchNoteAsset} onClose={() => setResearchNoteAsset(null)} />
      )}
    </div>
  )
}
