import { useEffect, useRef, useState } from 'react'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { searchLocation, zoomFor, readJson, writeJson } from '../../services/geocodeService'

// Location search for the intel map. Geocoding (and the Nominatim usage
// policy that shapes it) lives in services/geocodeService.js.
const HISTORY_KEY = 'maddex_map_searches'

// Places with a financial story. Matched on the query and on the geocoder's
// answer, so "cupertino" and "Apple Park" both land here.
const FINANCIAL_PLACES = [
  { test: /\bapple\b|cupertino/i, title: 'APPLE INC HQ', context: 'NASDAQ: AAPL · Cupertino, California' },
  { test: /\basx\b|sydney exchange|martin place|bridge street,? sydney/i, title: 'ASX', context: 'Australian Securities Exchange · Sydney' },
  { test: /wall street|\bnyse\b|new york stock exchange/i, title: 'NYSE', context: 'New York Stock Exchange · Wall Street' },
  { test: /london stock exchange|paternoster|canary wharf/i, title: 'LSE', context: 'London Stock Exchange · City of London' },
  { test: /tokyo stock exchange|kabutocho|nihonbashi/i, title: 'TSE', context: 'Tokyo Stock Exchange · Nihonbashi, Tokyo' },
  { test: /iron ore|pilbara|port hedland|newman/i, title: 'PILBARA IRON ORE REGION', context: 'BHP, Rio Tinto and Fortescue operations · Western Australia' },
]
const financialFor = (query, result) =>
  FINANCIAL_PLACES.find((p) => p.test.test(query) || p.test.test(result?.display_name ?? '')) ?? null

export default function MapLocationSearch({ onSelect, onClear, hasPin, mapHovered }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState('idle') // idle | searching | empty | error
  const [card, setCard] = useState(null)
  const [history, setHistory] = useState(() => readJson(localStorage, HISTORY_KEY, []))
  const inputRef = useRef(null)

  // F focuses the search — but only while the pointer is over the map. Plain
  // F is the app-wide shortcut for Rates; captured here first, and only in
  // that one context, so it does not steal the key anywhere else.
  useEffect(() => {
    const onKey = (e) => {
      if (!mapHovered || e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      e.preventDefault()
      e.stopPropagation()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [mapHovered])

  const run = async (q = query) => {
    if (!q.trim()) return
    setStatus('searching'); setOpen(true); setActive(0)
    try {
      const rows = await searchLocation(q)
      setResults(rows)
      setStatus(rows.length ? 'idle' : 'empty')
    } catch {
      setResults([]); setStatus('error')
    }
  }

  const choose = (r) => {
    if (!r) return
    setOpen(false)
    setQuery(r.name || r.display_name.split(',')[0])
    const next = [query.trim(), ...history.filter((h) => h.toLowerCase() !== query.trim().toLowerCase())].filter(Boolean).slice(0, 5)
    setHistory(next); writeJson(localStorage, HISTORY_KEY, next)
    setCard(financialFor(query, r) ? { ...financialFor(query, r), place: r.display_name } : null)
    onSelect?.({ longitude: r.lon, latitude: r.lat, zoom: zoomFor(r), label: r.display_name })
    inputRef.current?.blur()
  }

  const clear = () => { setQuery(''); setResults([]); setCard(null); setStatus('idle'); onClear?.() }

  const showHistory = open && !query.trim() && history.length > 0
  const list = showHistory ? history.map((h) => ({ history: h })) : results

  return (
    <div data-tip="global-search" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, width: 320 }} className="font-mono">
      <div className="flex items-center gap-2 px-2.5"
        style={{ height: 36, background: 'rgba(6,13,26,0.92)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3, backdropFilter: 'blur(8px)' }}>
        <span className="text-terminal-gold/70" style={{ fontSize: 12 }}>⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setStatus('idle'); setResults([]) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur() }
            else if (e.key === 'Enter') {
              const item = list[active]
              if (item?.history) { setQuery(item.history); run(item.history) }
              else if (results.length && open) choose(results[active])
              else run()
            }
          }}
          placeholder="Search location or coordinates…"
          className="flex-1 bg-transparent outline-none text-white placeholder:text-terminal-text-dim/50"
          style={{ fontSize: 11 }}
          aria-label="Search the map"
        />
        {status === 'searching' && <span className="text-terminal-gold animate-pulse" style={{ fontSize: 9 }}>…</span>}
        {(hasPin || query) && (
          <button onMouseDown={(e) => e.preventDefault()} onClick={clear} className="text-terminal-text-dim hover:text-terminal-gold" style={{ fontSize: 9 }}>✕ CLEAR</button>
        )}
      </div>

      {open && (list.length > 0 || status === 'empty' || status === 'error' || (query.trim() && status === 'idle' && !results.length)) && (
        <div className="mt-1 overflow-hidden" style={{ background: 'rgba(6,13,26,0.96)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3 }}>
          {showHistory && <div className="px-2.5 pt-1.5 text-terminal-text-dim/60" style={{ fontSize: 8, letterSpacing: '0.14em' }}>RECENT</div>}
          {list.map((item, i) => (
            <button
              key={item.history ?? `${item.lat},${item.lon},${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => (item.history ? (setQuery(item.history), run(item.history)) : choose(item))}
              className="block w-full text-left px-2.5 py-1.5 truncate"
              style={{ fontSize: 10, color: i === active ? '#C9A84C' : '#B8CCE4', background: i === active ? 'rgba(201,168,76,0.08)' : 'transparent' }}
            >
              {item.history ? `↺ ${item.history}` : item.display_name}
              {!item.history && <span className="ml-1.5 text-terminal-text-dim/50" style={{ fontSize: 8 }}>{(item.addresstype ?? item.type ?? '').toUpperCase()}</span>}
            </button>
          ))}
          {status === 'empty' && <div className="px-2.5 py-2 text-terminal-text-dim" style={{ fontSize: 10 }}>No places found.</div>}
          {status === 'error' && <div className="px-2.5 py-2 text-terminal-red" style={{ fontSize: 10 }}>Geocoder unavailable — try again shortly.</div>}
          {query.trim() && status === 'idle' && !results.length && !showHistory && (
            <div className="px-2.5 py-2 text-terminal-text-dim/70" style={{ fontSize: 9 }}>Press Enter to search · or type coordinates like −33.86, 151.21</div>
          )}
        </div>
      )}

      {card && (
        <div className="mt-2 px-3 py-2.5" style={{ background: 'rgba(6,13,26,0.94)', border: '1px solid rgba(201,168,76,0.35)', borderLeft: '3px solid #C9A84C', borderRadius: 3 }}>
          <div className="text-terminal-gold font-bold tracking-widest" style={{ fontSize: 10 }}>{card.title}</div>
          <div className="text-terminal-text mt-0.5" style={{ fontSize: 10 }}>{card.context}</div>
          <div className="text-terminal-text-dim/60 truncate mt-0.5" style={{ fontSize: 8 }}>{card.place}</div>
          <button
            onClick={() => dispatchAskAI({
              name: card.title, sector: 'Location intelligence', date: todayAEST(),
              instruction: `What is the financial significance of ${card.title} (${card.context}) for an Australian investor? Describe it in words; do not state prices or figures you have not been given.`,
            })}
            className="mt-1.5 text-terminal-gold/80 hover:text-terminal-gold" style={{ fontSize: 9, letterSpacing: '0.12em' }}
          >ASK MADDENAI ▶</button>
        </div>
      )}
    </div>
  )
}
