import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../services/dataService'
import { USING_MOCK_DATA } from '../../services/api'
import { PAL } from '../../styles/palette.js'

// YOUR WATCHLIST TODAY — one line of day moves, from the same quote layer as
// the rest of the terminal (demo in this build, labelled). Hidden with no
// watchlist.
export function WatchlistToday({ watchlist = [] }) {
  const syms = watchlist.slice(0, 12)
  const { data } = useQuery({
    queryKey: ['briefWatchlist', ...syms],
    queryFn: () => fetchEquityQuotes(syms),
    enabled: syms.length > 0,
    staleTime: 60_000,
  })
  if (!syms.length) return null
  const rows = syms.map((s) => ({ s, pct: data?.data?.[s]?.pct })).filter((r) => Number.isFinite(r.pct))
  return (
    <section className="border border-terminal-border px-4 py-3" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-terminal-gold font-bold tracking-widest" style={{ fontSize: 11 }}>YOUR WATCHLIST TODAY</span>
        {USING_MOCK_DATA && <span className="font-mono text-terminal-text-dim/60 border border-terminal-border px-1" style={{ fontSize: 11 }}>DEMO PRICES</span>}
      </div>
      {rows.length ? (
        <div className="font-mono leading-relaxed" style={{ fontSize: 12 }}>
          {rows.map((r, i) => (
            <span key={r.s}>
              <span className="text-terminal-text-bright font-bold">{r.s.replace(/\.AX$/i, '')}</span>{' '}
              <span style={{ color: r.pct >= 0 ? PAL.up : PAL.down }}>{r.pct >= 0 ? '+' : ''}{r.pct.toFixed(2)}%</span>
              {i < rows.length - 1 && <span className="text-terminal-text-dim/40">, </span>}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-2xs text-terminal-text-dim animate-pulse">Loading prices…</div>
      )}
    </section>
  )
}

// The outlook's three parts, written by MaddenAI with the brief — notes in
// words. Scores that older cached briefs carry are not shown: the model does
// not originate numbers.
export function ScoreBreakdown({ brief }) {
  const [open, setOpen] = useState(false)
  const parts = Array.isArray(brief.scoreBreakdown) ? brief.scoreBreakdown.filter((p) => p?.name && p?.note) : []
  if (!parts.length) return null
  return (
    <div className="mt-3 w-full max-w-md">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="font-mono text-terminal-gold/80 hover:text-terminal-gold tracking-widest" style={{ fontSize: 11 }}>
        {open ? '▾ HIDE OUTLOOK BREAKDOWN' : '▸ OUTLOOK BREAKDOWN'}
      </button>
      {open && (
        <div className="mt-2 text-left border border-terminal-border divide-y divide-terminal-border/50">
          {parts.map((p) => (
            <div key={p.name} className="px-3 py-2">
              <div className="font-mono text-terminal-text-dim tracking-wider" style={{ fontSize: 11 }}>{p.name}</div>
              <div className="text-terminal-text mt-1" style={{ fontSize: 12 }}>{p.note}</div>
            </div>
          ))}
          <div className="px-3 py-1.5 text-terminal-text-dim font-mono" style={{ fontSize: 11 }}>MaddenAI&apos;s judgement from the figures it was given — not a model or index.</div>
        </div>
      )}
    </div>
  )
}
