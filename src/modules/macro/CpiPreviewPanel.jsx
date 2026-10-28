import { useEffect, useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { sydneyOffset } from '../../utils/dateUtils'
import { askMaddenAI } from '../../utils/askAI'

// The September quarter CPI result, the last major print before the 3 Nov RBA
// decision. Shown from the release until that decision (or three days, if no
// decision is pending).
//
// Until 28 Oct this panel was the preview: per-bank forecasts and an outcome
// framework. The forecasts were retired with it; what remains is the one-line
// summary of them in au.cpiQuarterForecasts, which is what the result was
// measured against. Every figure is from verifiedConstants.au, as published
// by the ABS.

const SHOW_AFTER_MS = 72 * 3600_000
const pct = (v) => `${v.toFixed(1)}%`

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

export default function CpiPreviewPanel() {
  const a = VERIFIED_CONSTANTS.au
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  const now = useNow()
  if (a.cpiQuarterTrimmedQoQ == null) return null

  const released = new Date(`${a.cpiLastRelease}T11:30:00${sydneyOffset(a.cpiLastRelease)}`).getTime()
  const decision = nd ? new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime() : null
  const until = decision && decision > released ? decision : released + SHOW_AFTER_MS
  if (now < released || now >= until) return null

  const pq = a.cpiQuarterPrevious
  const rows = [
    ['Trimmed mean q/q', a.cpiQuarterTrimmedQoQ, pq?.trimmedQoQ, true],
    ['Trimmed mean y/y', a.cpiQuarterTrimmedYoY, pq?.trimmedYoY],
    ['Headline q/q', a.cpiQuarterQoQ, pq?.qoq],
    ['Headline y/y', a.cpiQuarterYoY, null],
  ]

  return (
    <div className="border-b border-terminal-border" style={{ background: 'rgba(201,168,76,0.04)' }}>
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span className="text-terminal-gold">SEP QUARTER (Q3) CPI — RESULT</span>
        <span className="text-2xs font-bold px-1.5" style={{ color: '#2D8A50', border: '1px solid #2D8A5066' }}>RELEASED {a.cpiLastRelease}</span>
        <VerifiedBadge dataKey="au" alwaysShow />
        <span className="ml-auto flex items-center gap-2">
          <a href={a.cpiQuarterUrl} target="_blank" rel="noopener noreferrer" className="text-2xs text-terminal-gold hover:underline">ABS.GOV.AU ↗</a>
          <button
            onClick={() => askMaddenAI('Using only the September quarter CPI figures and market pricing in your context, what does the result mean for the RBA on 3 November, the AUD and ASX sectors?')}
            className="text-2xs font-bold border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 py-0.5 transition-colors"
          >ASK MADDENAI ▶</button>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-0">
        <div className="p-3 border-r border-terminal-border/40">
          <table className="terminal-table w-full text-2xs">
            <thead>
              <tr><th className="text-left">MEASURE</th><th className="text-right">{a.cpiQuarterPeriod.toUpperCase()}</th><th className="text-right">{pq?.period.toUpperCase() ?? 'PREVIOUS'}</th></tr>
            </thead>
            <tbody>
              {rows.map(([label, v, prev, key]) => (
                <tr key={label}>
                  <td className={key ? 'text-terminal-text-bright font-bold' : 'text-terminal-text-dim'}>{label}</td>
                  <td className={`text-right tabular-nums font-bold ${key ? 'text-terminal-gold' : 'text-terminal-text-bright'}`}>{pct(v)}</td>
                  <td className="text-right tabular-nums text-terminal-text-dim">{prev != null ? pct(prev) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-2xs text-terminal-text-dim/70 mt-1.5 leading-snug">
            Forecasts: {a.cpiQuarterForecasts} Monthly: September {pct(a.cpi)} y/y ({a.cpiMoM >= 0 ? '+' : ''}{pct(a.cpiMoM)} m/m), trimmed mean {pct(a.cpiTrimmedMean)}.
            {a.cpiDrivers && <> Drivers: {a.cpiDrivers}</>}
          </div>
        </div>

        <div className="p-3">
          {nd && (
            <div className="text-2xs leading-snug">
              <div className="text-terminal-text-dim tracking-widest mb-1">MARKET PRICING, 3 NOV</div>
              <b className="text-terminal-text-bright">~{nd.marketHikePct}% hike</b>
              <span className="text-terminal-text-dim"> to {nd.hikeRate.toFixed(2)}% — {nd.marketSource}, as at {nd.marketAsOf}. A dated reading, not a live feed. {nd.marketContext}</span>
            </div>
          )}
          <div className="text-2xs text-terminal-text-dim/60 mt-2 leading-snug">
            The quarterly trimmed mean is seasonally adjusted, on the ABS&apos;s pre-October 2025 basis (Appendix 1a). Headline y/y is computed from the Table 17 index.
          </div>
        </div>
      </div>
    </div>
  )
}
