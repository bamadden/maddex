import { useMemo, useState } from 'react'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { getMockFMPHistory } from '../../services/mockData'

// Two Calendar sections:
//
// PREDICTED — recurring ABS releases not yet in the calendar, dated by the
// ABS's usual pattern (monthly CPI on the last Wednesday of the following
// month, Labour Force on the third Thursday, national accounts on the first
// Wednesday of the quarter's third month). Every one says PREDICTED; the ABS
// release calendar is the authority.
//
// EVENT IMPACT HISTORY — the last six results for CPI, jobs and the RBA, from
// the verified series, with the ASX 200's move on the day. That move comes
// from the demo index history and says so; past consensus forecasts are not
// recorded, so that column is blank rather than reconstructed.

const DAY = 86_400_000
const ymd = (d) => d.toISOString().slice(0, 10)
const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function lastWeekday(y, m, dow) { // m 0-based
  const d = new Date(Date.UTC(y, m + 1, 0))
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() - 1)
  return d
}
function nthWeekday(y, m, dow, n) {
  const d = new Date(Date.UTC(y, m, 1))
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCDate(d.getUTCDate() + 7 * (n - 1))
  return d
}

// Release dates by pattern for the months ahead.
function predicted(fromIso, months = 4) {
  const out = []
  const from = new Date(`${fromIso}T00:00:00Z`)
  for (let i = 0; i <= months; i++) {
    const y = from.getUTCFullYear() + Math.floor((from.getUTCMonth() + i) / 12)
    const m = (from.getUTCMonth() + i) % 12
    const ref = (m + 11) % 12 // the month the release reports on
    const quarterly = ref % 3 === 2
    // December's release moves into early January around the holidays, so
    // no last-Wednesday date is claimed for it.
    if (m === 11) out.push({ date: ymd(nthWeekday(y + 1, 0, 3, 2)), event: `AU CPI (${MONTH[ref]})`, key: 'CPI', rule: 'holiday timing varies — usually early January', loose: true })
    else out.push({ date: ymd(lastWeekday(y, m, 3)), event: `AU CPI (${MONTH[ref]}${quarterly ? ', incl. quarter' : ''})`, key: 'CPI', rule: 'last Wednesday of the month' })
    out.push({ date: ymd(nthWeekday(y, m, 4, 3)), event: `AU Labour Force (${MONTH[ref]})`, key: 'Labour Force', rule: 'third Thursday' })
    if ([2, 5, 8, 11].includes(m)) out.push({ date: ymd(nthWeekday(y, m, 3, 1)), event: `AU GDP (${MONTH[(m + 9) % 12]} quarter)`, key: 'GDP', rule: 'first Wednesday of the quarter\'s third month' })
  }
  return out
}

export function PredictedEvents({ events = [] }) {
  const [today] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
  const rows = useMemo(() => {
    const horizon = ymd(new Date(Date.parse(`${today}T00:00:00Z`) + 120 * DAY))
    return predicted(today).filter((p) => p.date > today && p.date <= horizon)
      // Not already scheduled: no calendar event of the same kind within a week.
      .filter((p) => !events.some((e) => (e.event ?? e.label ?? '').includes(p.key) && Math.abs(Date.parse(e.date) - Date.parse(p.date)) <= 7 * DAY))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
  }, [events, today])
  if (!rows.length) return null
  return (
    <div className="border border-terminal-border mt-4">
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center gap-2 flex-wrap">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">PREDICTED</span>
        <span className="text-2xs font-bold px-1.5" style={{ color: '#8BA3C4', border: '1px dashed rgba(139,163,196,0.5)' }}>NOT YET CONFIRMED</span>
        <span className="text-2xs text-terminal-text-dim/60">from the ABS&apos;s usual release pattern — check the ABS release calendar</span>
      </div>
      {rows.map((p) => (
        <div key={`${p.event}-${p.date}`} className="flex items-baseline gap-3 px-3 py-1 text-2xs border-b border-terminal-border/30 last:border-0" style={{ opacity: 0.85 }}>
          <span className="font-mono text-terminal-text-dim w-24 flex-shrink-0">{p.loose ? `early ${new Date(`${p.date}T12:00:00`).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}` : `~${fmt(p.date)}`}</span>
          <span className="text-terminal-text flex-1">{p.event}</span>
          <span className="text-terminal-text-dim/50 italic">{p.rule}</span>
        </div>
      ))}
    </div>
  )
}

// ASX 200 day move on a date, from the demo index history.
function asxMove(hist, iso) {
  const i = hist.findIndex((b) => b.date.slice(0, 10) === iso)
  if (i <= 0) return null
  return (hist[i].close / hist[i - 1].close - 1) * 100
}

export function EventImpactHistory() {
  const [tab, setTab] = useState('cpi')
  const hist = useMemo(() => getMockFMPHistory('^AXJO', 260), [])
  const a = VERIFIED_CONSTANTS.au
  const tables = useMemo(() => {
    const cpi = (a.cpiHistory ?? []).filter((p) => p.type === 'monthly').slice(-6).reverse().map((p) => {
      const [y, m] = p.period.split('-').map(Number)
      const rel = ymd(lastWeekday(m === 12 ? y + 1 : y, m % 12, 3)) // following month
      return { label: `${MONTH[m - 1]} ${y}`, result: `${p.value.toFixed(1)}%`, extra: p.trimmed != null ? `TM ${p.trimmed.toFixed(1)}%` : '', date: rel, approx: rel !== a.cpiLastRelease }
    })
    const jobs = (a.unemploymentHistory ?? []).slice(-6).reverse().map((p) => {
      const [y, m] = p.period.split('-').map(Number)
      const rel = ymd(nthWeekday(m === 12 ? y + 1 : y, m % 12, 4, 3))
      return { label: `${MONTH[m - 1]} ${y}`, result: `${p.value.toFixed(1)}%`, extra: '', date: rel, approx: true }
    })
    const rba = (VERIFIED_CONSTANTS.rba.decisions ?? []).slice(-6).reverse().map((d) => ({
      label: fmt(d.date), result: `${d.decision}${d.change ? ` ${d.change > 0 ? '+' : ''}${d.change}bp` : ''}`, extra: `${d.rate.toFixed(2)}%${d.vote ? ` · ${d.vote}` : ''}`, date: d.date, approx: false,
    }))
    return { cpi, jobs, rba }
  }, [a])
  const rows = tables[tab]
  return (
    <div className="border border-terminal-border mt-4">
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center gap-2 flex-wrap">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">EVENT IMPACT HISTORY</span>
        <div className="flex gap-1 ml-auto">
          {[['cpi', 'AU CPI'], ['jobs', 'UNEMPLOYMENT'], ['rba', 'RBA']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`text-2xs px-2 py-0.5 border ${tab === k ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold'}`}>{l}</button>
          ))}
        </div>
      </div>
      <table className="w-full text-2xs">
        <thead>
          <tr className="text-terminal-text-dim/70">
            <th className="text-left px-3 py-1 font-normal">{tab === 'rba' ? 'DATE' : 'PERIOD'}</th>
            <th className="text-right px-2 font-normal">RESULT</th>
            <th className="text-right px-2 font-normal">VS FORECAST</th>
            <th className="text-right px-3 font-normal">ASX 200 ON THE DAY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mv = asxMove(hist, r.date)
            return (
              <tr key={r.label} className="border-t border-terminal-border/30">
                <td className="px-3 py-1 text-terminal-text">{r.label}{tab !== 'rba' && <span className="text-terminal-text-dim/50"> · {r.approx ? '≈' : ''}{fmt(r.date)}</span>}</td>
                <td className="px-2 text-right font-mono text-terminal-text-bright">{r.result}{r.extra && <span className="text-terminal-text-dim"> {r.extra}</span>}</td>
                <td className="px-2 text-right text-terminal-text-dim/50">—</td>
                <td className="px-3 text-right font-mono" style={{ color: mv == null ? undefined : mv >= 0 ? '#2D8A50' : '#CC4444' }}>
                  {mv == null ? <span className="text-terminal-text-dim/50">—</span> : <>{mv >= 0 ? '+' : ''}{mv.toFixed(2)}% <span className="text-terminal-text-dim/50">(demo)</span></>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 9 }}>
        Results from the verified ABS and RBA series. ≈ marks a release date estimated from the ABS pattern. Past consensus forecasts are not recorded, so
        that column is blank. The ASX 200 move is from the demo index history — illustrative, not the real market reaction.
      </div>
    </div>
  )
}
