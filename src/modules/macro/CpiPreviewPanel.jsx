import { useEffect, useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import VerifiedBadge from '../../components/ui/VerifiedBadge'
import { getOfficialCheck, subscribeOfficialCheck } from '../../services/officialStats'
import { sydneyOffset, sydneyTzAbbr } from '../../utils/dateUtils'
import { askMaddenAI } from '../../utils/askAI'

// The September quarter CPI, the last major print before the 3 Nov RBA
// decision. Shown from a week before the release to three days after.
//
// Every figure is from verifiedConstants (bank forecasts, the RBA's own
// forecast, the dated market pricing) or, after the release, from the ABS Data
// API. The outcome table attaches no probabilities: nothing has measured how
// likely a hike is GIVEN each print, and a "75%" in that cell would be the
// most persuasive number on the page and the only invented one.

const SHOW_BEFORE_MS = 7 * 86400_000
const SHOW_AFTER_MS = 72 * 3600_000

const pct = (v) => `${v.toFixed(1)}%`
const span = (vals) => {
  const lo = Math.min(...vals), hi = Math.max(...vals)
  return lo === hi ? pct(lo) : `${lo.toFixed(1)}–${hi.toFixed(1)}%`
}

const OUTCOMES = [
  { band: 'Above 1.0%', reads: 'Hotter than all four banks', lean: 'Hike case strengthens', aud: 'Firmer on higher rate expectations', tone: '#A83232' },
  { band: '0.9–1.0%', reads: "In line with the banks; above the RBA's 0.8%", lean: 'Live meeting — close to what was priced', aud: 'Little changed', tone: '#C9A84C' },
  { band: '0.8% or below', reads: "At or below the RBA's own forecast", lean: 'Hold case strengthens', aud: 'Softer as hike pricing unwinds', tone: '#2D8A50' },
]

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

function useOfficial() {
  const [check, setCheck] = useState(getOfficialCheck)
  useEffect(() => subscribeOfficialCheck(setCheck), [])
  return check
}

export default function CpiPreviewPanel() {
  const p = VERIFIED_CONSTANTS.cpiPreview
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  const now = useNow()
  const check = useOfficial()
  if (!p) return null

  const at = new Date(`${p.releaseDate}T${p.releaseTime}:00${sydneyOffset(p.releaseDate)}`).getTime()
  if (now < at - SHOW_BEFORE_MS || now > at + SHOW_AFTER_MS) return null
  const released = now >= at

  // The new quarter, once the API has it. Until then a released panel says so
  // rather than showing June's figure under a September heading.
  const q = check?.live?.cpi?.quarterlyQoQ
  const actualQ = released && q && q.period !== p.previousPeriod ? q : null
  const monthly = check?.live?.cpi
  const actualMonthly = released && monthly?.cpi && monthly.cpi.period !== VERIFIED_CONSTANTS.au.cpiPeriod ? monthly : null
  const headlineRange = p.banks.map((b) => b.headlineQoQ)
  const vsBanks = actualQ
    ? actualQ.value > Math.max(...headlineRange) ? 'ABOVE every bank forecast'
      : actualQ.value < Math.min(...headlineRange) ? 'BELOW every bank forecast'
      : 'WITHIN the bank forecast range'
    : null

  const hours = Math.max(0, Math.round((at - now) / 3600_000))
  const when = released
    ? `RELEASED ${p.releaseTime} ${sydneyTzAbbr(p.releaseDate)}`
    : hours < 24 ? `IN ${hours}H · ${p.releaseTime} ${sydneyTzAbbr(p.releaseDate)}` : `${new Date(`${p.releaseDate}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} · ${p.releaseTime} ${sydneyTzAbbr(p.releaseDate)}`

  return (
    <div className="border-b border-terminal-border" style={{ background: 'rgba(201,168,76,0.04)' }}>
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span className="text-terminal-gold">SEP QUARTER (Q3) CPI — {released ? 'RELEASE' : 'MARKET PREVIEW'}</span>
        <span className="text-2xs font-bold px-1.5" style={{ color: released ? '#2D8A50' : '#C9A84C', border: `1px solid ${released ? '#2D8A50' : '#C9A84C'}66` }}>{when}</span>
        <VerifiedBadge dataKey="cpiPreview" alwaysShow />
        <span className="ml-auto flex items-center gap-2">
          <a href={p.absUrl} target="_blank" rel="noopener noreferrer" className="text-2xs text-terminal-gold hover:underline">ABS.GOV.AU ↗</a>
          {(
            <button
              onClick={() => askMaddenAI(released
                ? 'The September quarter CPI has just been released. Using only the figures in your context, what does it mean for the RBA on 3 November, the AUD and ASX sectors?'
                : "What should I watch for in tomorrow's September quarter CPI, and what would each outcome mean for the RBA on 3 November?")}
              className="text-2xs font-bold border border-terminal-gold/40 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 py-0.5 transition-colors"
            >ASK MADDENAI ▶</button>
          )}
        </span>
      </div>

      {released && (
        <div className="px-3 py-2 border-b border-terminal-border/40 font-mono">
          {actualQ ? (
            <div className="text-xs text-terminal-text-bright">
              Headline CPI <b className="text-terminal-gold">{pct(actualQ.value)} q/q</b> ({actualQ.period}) — {vsBanks} ({span(headlineRange)}).
              {actualMonthly && <> Annual: <b>{pct(actualMonthly.cpi.value)}</b>, trimmed mean <b>{pct(actualMonthly.trimmedMean.value)}</b> ({actualMonthly.cpi.period}).</>}
            </div>
          ) : (
            <div className="text-2xs text-terminal-text-dim">Waiting for the ABS Data API to publish the September quarter — checked every ten minutes.</div>
          )}
          <div className="text-2xs text-terminal-text-dim/70 mt-1">
            Trimmed mean q/q, the RBA&apos;s focus, is not on the ABS Data API — read it in tables 17–18 of the release.
            Forecast for it: banks {span(p.banks.map((b) => b.trimmedQoQ))}, RBA {pct(p.rbaTrimmedQoQ)}.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-0">
        <div className="p-3 border-r border-terminal-border/40">
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">BANK FORECASTS · {p.source}</div>
          <table className="terminal-table w-full text-2xs">
            <thead>
              <tr>
                <th className="text-left">BANK</th><th className="text-right">HEADLINE Q/Q</th><th className="text-right">Y/Y</th>
                <th className="text-right">TRIMMED Q/Q</th><th className="text-right">Y/Y</th><th className="text-right">3 NOV CALL</th>
              </tr>
            </thead>
            <tbody>
              {p.banks.map((b) => (
                <tr key={b.bank}>
                  <td className="text-terminal-text-bright font-bold">{b.bank}</td>
                  <td className="text-right tabular-nums">{pct(b.headlineQoQ)}</td>
                  <td className="text-right tabular-nums text-terminal-text-dim">{pct(b.headlineYoY)}</td>
                  <td className="text-right tabular-nums text-terminal-gold font-bold">{pct(b.trimmedQoQ)}</td>
                  <td className="text-right tabular-nums text-terminal-text-dim">{pct(b.trimmedYoY)}</td>
                  <td className="text-right font-bold" style={{ color: b.rbaCall === 'HIKE' ? '#A83232' : '#8BA3C4' }}>{b.rbaCall}</td>
                </tr>
              ))}
              <tr>
                <td className="text-terminal-text-bright font-bold">RBA (Aug)</td>
                <td /><td />
                <td className="text-right tabular-nums text-terminal-gold font-bold">{pct(p.rbaTrimmedQoQ)}</td>
                <td /><td />
              </tr>
            </tbody>
          </table>
          <div className="text-2xs text-terminal-text-dim/70 mt-1.5 leading-snug">
            Previous: headline {pct(p.previousHeadlineQoQ)} q/q ({p.previousPeriod}). {p.driverNote}
          </div>
          {nd && (
            <div className="text-2xs mt-2 leading-snug">
              <span className="text-terminal-text-dim">MARKET PRICING, 3 NOV · </span>
              <b className="text-terminal-text-bright">{nd.marketHikePct}% hike</b>
              <span className="text-terminal-text-dim"> (implied {nd.marketImpliedRate.toFixed(2)}%) — {nd.marketSource}, as at {nd.marketAsOf}. Not a live feed. {nd.marketContext}</span>
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1.5">IF TRIMMED MEAN Q/Q IS…</div>
          <table className="terminal-table w-full text-2xs">
            <thead>
              <tr><th className="text-left">RESULT</th><th className="text-left">READS AS</th><th className="text-left">RBA 3 NOV</th><th className="text-left">AUD</th></tr>
            </thead>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o.band}>
                  <td className="font-bold whitespace-nowrap" style={{ color: o.tone }}>{o.band}</td>
                  <td className="text-terminal-text-dim">{o.reads}</td>
                  <td className="text-terminal-text-bright">{o.lean}</td>
                  <td className="text-terminal-text-dim">{o.aud}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-2xs text-terminal-text-dim/60 mt-1.5 leading-snug">
            How each outcome reads against the forecasts — a framework, not a forecast. No probability is attached to
            each row because none has been measured; the only market probability shown is the dated reading at left.
          </div>
        </div>
      </div>
    </div>
  )
}
