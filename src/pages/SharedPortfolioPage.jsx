import { useSharedRecord } from '../services/sharingService'

// Public, read-only portfolio snapshot — percentages only (see
// PortfolioSnapshot's sharePayload). Routed by App.jsx before the app mounts,
// so no sign-in is needed.

const PALETTE = ['#C9A84C', '#3DAD65', '#8BA3C4', '#C93E3E', '#637899', '#8A6E2A', '#B07CC6', '#5B9BD5']

function Donut({ slices }) {
  const r = 70, c = 2 * Math.PI * r
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.pct / 100) * c, 0))
  return (
    <svg viewBox="0 0 200 200" className="w-44 h-44 flex-shrink-0" role="img" aria-label="Asset allocation">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#0F1E35" strokeWidth="34" />
      {slices.map((s, i) => {
        const len = (s.pct / 100) * c
        return (
          <circle key={s.label} cx="100" cy="100" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="34"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-starts[i]} transform="rotate(-90 100 100)" />
        )
      })}
    </svg>
  )
}

export default function SharedPortfolioPage({ id }) {
  const record = useSharedRecord('portfolio', id)
  const p = record?.payload

  return (
    <div className="h-screen overflow-y-auto bg-terminal-bg text-terminal-text font-mono flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-terminal-gold text-xl">▲</span>
          <span className="text-terminal-gold font-bold tracking-widest">MADDEX</span>
          <span className="text-2xs text-terminal-text-dim ml-2 tracking-widest">PORTFOLIO SNAPSHOT</span>
        </div>

        {record === undefined ? (
          <div className="text-2xs text-terminal-text-dim">Loading…</div>
        ) : !p ? (
          <div className="border border-terminal-border p-6 text-center">
            <div className="text-terminal-text-bright font-bold mb-2">This link isn't available</div>
            <div className="text-2xs text-terminal-text-dim">It may have been removed, or it was shared from a browser that could not save it to Maddex — ask the sender for a new link.</div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-terminal-text-bright mb-1">{p.ownerName}&apos;s portfolio</div>
            <div className="text-2xs text-terminal-text-dim mb-6">
              Shared {new Date(record.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · read-only · percentages only
            </div>

            <div className="border border-terminal-border p-5 mb-4">
              <div className="text-2xs text-terminal-text-dim tracking-widest">TOTAL RETURN SINCE PURCHASE</div>
              <div className="text-4xl font-bold mt-1" style={{ color: p.returnPct >= 0 ? '#3DAD65' : '#C93E3E' }}>
                {p.returnPct >= 0 ? '+' : ''}{p.returnPct.toFixed(1)}%
              </div>
              <div className="text-xs text-terminal-text-dim mt-1">Portfolio {p.returnPct >= 0 ? 'up' : 'down'} {Math.abs(p.returnPct).toFixed(1)}% since purchase</div>
              {p.demoPrices && (
                <div className="text-2xs text-terminal-gold mt-2">Equity prices in Maddex are currently demonstration data, so this return is illustrative.</div>
              )}
            </div>

            <div className="border border-terminal-border p-5 mb-4">
              <div className="text-2xs text-terminal-text-dim tracking-widest mb-3">ASSET ALLOCATION</div>
              <div className="flex items-center gap-6 flex-wrap">
                <Donut slices={p.assetClasses} />
                <div className="space-y-1.5">
                  {p.assetClasses.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 inline-block" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-terminal-text">{s.label}</span>
                      <span className="text-terminal-text-dim tabular-nums">{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-terminal-border p-5">
              <div className="text-2xs text-terminal-text-dim tracking-widest mb-3">SECTOR BREAKDOWN</div>
              <div className="space-y-1.5">
                {p.sectors.map((s) => (
                  <div key={s.label} className="grid items-center gap-3 text-xs" style={{ gridTemplateColumns: '140px 1fr 52px' }}>
                    <span className="text-terminal-text truncate">{s.label}</span>
                    <div className="h-2 bg-terminal-border/40"><div className="h-full bg-terminal-gold/70" style={{ width: `${s.pct}%` }} /></div>
                    <span className="text-right tabular-nums text-terminal-text-dim">{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-2xs text-terminal-text-dim/70">
          Generated by Maddex · maddex.com.au · General information only — not advice.
        </div>
        <a href="/" className="block mt-4 text-center text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">
          SIGN UP TO CREATE YOUR OWN →
        </a>
      </div>
    </div>
  )
}
