import { useEffect, useState } from 'react'
import { getDigest, digestSeenToday, markDigestSeen } from '../../services/personalDigest'

function Section({ title, rows }) {
  return rows?.length ? (
    <div className="mt-2">
      <div className="font-mono text-terminal-gold/80 tracking-widest" style={{ fontSize: 8 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="text-terminal-text leading-snug mt-0.5" style={{ fontSize: 11 }}>
          {typeof r === 'string' ? r : <><span className="font-mono font-bold text-terminal-text-bright">{r.label}:</span> {r.text}</>}
        </div>
      ))}
    </div>
  ) : null
}

// YOUR INTELLIGENCE DIGEST in the MaddenAI panel (services/personalDigest).
// Open on the first visit of the day, a one-line header after that.
export default function DigestCard({ watchlist = [], onAsk }) {
  const [digest, setDigest] = useState(null)
  const [open, setOpen] = useState(() => !digestSeenToday())
  useEffect(() => {
    let holdings = []
    try { holdings = JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]') } catch { /* none */ }
    let alive = true
    getDigest({ holdings, watchlist }).then((d) => { if (alive) setDigest(d) }).catch(() => {})
    return () => { alive = false }
  }, [watchlist])
  useEffect(() => { if (open) markDigestSeen() }, [open])
  if (!digest) return null


  return (
    <div className="w-full mt-5 border border-terminal-gold/40" style={{ background: 'rgba(201,168,76,0.04)' }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
        <span className="font-mono font-bold text-terminal-gold tracking-widest" style={{ fontSize: 9 }}>
          {Number(new Date().toLocaleString('en-AU', { hour: 'numeric', hour12: false, timeZone: 'Australia/Sydney' })) < 12 ? 'GOOD MORNING — ' : ''}YOUR INTELLIGENCE DIGEST
        </span>
        <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>{digest.dateLabel}</span>
        <span className="ml-auto text-terminal-text-dim" style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          <Section title="YOUR PORTFOLIO TODAY" rows={digest.portfolio} />
          <Section title="YOUR WATCHLIST" rows={digest.watch} />
          <Section title="WATCH TODAY" rows={digest.watchToday} />
          <div className="mt-2 pt-2 border-t border-terminal-border/40">
            <span className="font-mono tracking-widest" style={{ fontSize: 8, color: '#8BA3C4' }}>MACRO REGIME </span>
            <span className="font-mono font-bold" style={{ fontSize: 10, color: digest.regime.colour }}>{digest.regime.label}</span>
            <div className="text-terminal-text-dim leading-snug mt-0.5" style={{ fontSize: 11 }}>{digest.regime.implication}</div>
          </div>
          {!digest.portfolio.length && !digest.watch.length && (
            <div className="text-terminal-text-dim/70 mt-2" style={{ fontSize: 11 }}>Add holdings or watchlist stocks and this digest is written around them.</div>
          )}
          <div className="flex items-center mt-2">
            <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 8 }}>From verified figures, the calendar, your holdings and today&apos;s headlines</span>
            <button
              onClick={() => onAsk?.('Using my portfolio holdings, watchlist and the market regime in your context, what are the two or three things I should focus on today, and why?')}
              className="ml-auto font-mono font-bold text-terminal-gold hover:underline" style={{ fontSize: 9 }}>ASK MADDENAI ▶</button>
          </div>
        </div>
      )}
    </div>
  )
}
