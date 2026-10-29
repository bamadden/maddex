import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../services/dataService'
import { USING_MOCK_DATA } from '../../services/api'
import { scoreColour } from '../../utils/briefScore'

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
        <span className="font-mono text-terminal-gold font-bold tracking-widest" style={{ fontSize: 10 }}>YOUR WATCHLIST TODAY</span>
        {USING_MOCK_DATA && <span className="font-mono text-terminal-text-dim/60 border border-terminal-border px-1" style={{ fontSize: 8 }}>DEMO PRICES</span>}
      </div>
      {rows.length ? (
        <div className="font-mono leading-relaxed" style={{ fontSize: 12 }}>
          {rows.map((r, i) => (
            <span key={r.s}>
              <span className="text-terminal-text-bright font-bold">{r.s.replace(/\.AX$/i, '')}</span>{' '}
              <span style={{ color: r.pct >= 0 ? '#2D8A50' : '#CC4444' }}>{r.pct >= 0 ? '+' : ''}{r.pct.toFixed(2)}%</span>
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

// The score's three parts, written by MaddenAI with the brief. Collapsed by
// default under the gauge; briefs generated before the breakdown existed
// simply have none.
export function ScoreBreakdown({ brief }) {
  const [open, setOpen] = useState(false)
  const parts = Array.isArray(brief.scoreBreakdown) ? brief.scoreBreakdown.filter((p) => Number.isFinite(Number(p?.score))) : []
  if (!parts.length) return null
  return (
    <div className="mt-3 w-full max-w-md">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="font-mono text-terminal-gold/80 hover:text-terminal-gold tracking-widest" style={{ fontSize: 9 }}>
        {open ? '▾ HIDE SCORE BREAKDOWN' : '▸ SCORE BREAKDOWN'}
      </button>
      {open && (
        <div className="mt-2 text-left border border-terminal-border divide-y divide-terminal-border/50">
          {parts.map((p) => {
            const v = Math.round(Number(p.score))
            return (
              <div key={p.name} className="px-3 py-2">
                <div className="flex items-baseline justify-between font-mono" style={{ fontSize: 10 }}>
                  <span className="text-terminal-text-dim tracking-wider">{p.name}</span>
                  <span className="font-bold tabular-nums" style={{ color: scoreColour(v) }}>{v}/100</span>
                </div>
                <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: 'rgba(99,120,153,0.2)' }}>
                  <div className="h-full" style={{ width: `${v}%`, background: scoreColour(v) }} />
                </div>
                {p.note && <div className="text-terminal-text-dim mt-1" style={{ fontSize: 11 }}>{p.note}</div>}
              </div>
            )
          })}
          <div className="px-3 py-2 flex items-baseline justify-between font-mono" style={{ fontSize: 10 }}>
            <span className="text-terminal-text-bright tracking-wider font-bold">COMBINED</span>
            <span className="font-bold" style={{ color: scoreColour(brief.maddenAIScore ?? 50) }}>{brief.maddenAIScore}/100 — {brief.scoreLabel}</span>
          </div>
          <div className="px-3 py-1.5 text-terminal-text-dim/50 font-mono" style={{ fontSize: 8 }}>MaddenAI&apos;s judgement from the figures it was given — not a model or index.</div>
        </div>
      )}
    </div>
  )
}
