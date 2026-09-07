import { useMemo, useState } from 'react'
import {
  RBA_MEETINGS_2026, FOMC_MEETINGS_2026, ECB_MEETINGS_2026, BOE_MEETINGS_2026,
  BOJ_MEETINGS_2026, PBOC_MEETINGS_2026, RBNZ_MEETINGS_2026, BOC_MEETINGS_2026,
  SNB_MEETINGS_2026, RIKSBANK_MEETINGS_2026,
} from '../../services/centralBankSchedule'
import { CENTRAL_BANK_RATES } from '../../data/placeholders'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'

// ─── Upcoming decisions, next 90 days ───────────────────────────────────────
//
// Every tracked bank's scheduled meetings merged into one chronological list.
// The value of this over ten separate "next meeting" lines is that it answers
// the question people actually have — what is coming, in what order — instead
// of asking the reader to sort ten dates by eye.
//
// ON THE "EXPECTED" COLUMN, WHICH IS THE DELICATE PART.
//
// It is a stance judgement carried in placeholders.js, not a market-implied
// probability: no rate-futures feed is connected to this terminal, and the
// fabricated "82% HOLD" bars that used to sit in this module were removed for
// exactly that reason. The column header says EXPECTED and the footnote says
// whose expectation it is.
//
// It appears ONLY on each bank's FIRST meeting in the window. A stance is a
// view about the next decision; carrying the same pill down to a bank's second
// and third meetings would be stating a view about November that nobody holds.
// Those rows show a dash, which is the honest mark for "no view recorded".

// The stance is READ from placeholders rather than restated here. It is
// already recorded once, next to the rates it belongs with; a second copy in
// this file would be a second thing to update and a second thing to disagree
// with the first.
const EXPECTED = Object.fromEntries(
  CENTRAL_BANK_RATES.map((cb) => [cb.vkey, (cb.expectation ?? 'hold').toUpperCase()]),
)

const BANKS = [
  { key: 'rba',      label: 'RBA',      flag: '🇦🇺', dates: RBA_MEETINGS_2026,      official: true  },
  { key: 'fed',      label: 'Fed',      flag: '🇺🇸', dates: FOMC_MEETINGS_2026,     official: true  },
  { key: 'ecb',      label: 'ECB',      flag: '🇪🇺', dates: ECB_MEETINGS_2026,      official: true  },
  { key: 'boe',      label: 'BOE',      flag: '🇬🇧', dates: BOE_MEETINGS_2026,      official: true  },
  { key: 'boj',      label: 'BOJ',      flag: '🇯🇵', dates: BOJ_MEETINGS_2026,      official: false },
  { key: 'pboc',     label: 'PBOC',     flag: '🇨🇳', dates: PBOC_MEETINGS_2026,     official: false },
  { key: 'rbnz',     label: 'RBNZ',     flag: '🇳🇿', dates: RBNZ_MEETINGS_2026,     official: false },
  { key: 'boc',      label: 'BOC',      flag: '🇨🇦', dates: BOC_MEETINGS_2026,      official: false },
  { key: 'snb',      label: 'SNB',      flag: '🇨🇭', dates: SNB_MEETINGS_2026,      official: false },
  { key: 'riksbank', label: 'Riksbank', flag: '🇸🇪', dates: RIKSBANK_MEETINGS_2026, official: false },
]

const PILL = {
  HOLD: { colour: '#C9A84C', bg: 'rgba(201,168,76,0.14)', border: 'rgba(201,168,76,0.4)' },
  CUT:  { colour: '#2D8A50', bg: 'rgba(45,138,80,0.16)',  border: 'rgba(45,138,80,0.45)' },
  HIKE: { colour: '#CC4444', bg: 'rgba(200,68,68,0.16)',  border: 'rgba(200,68,68,0.45)' },
}

export default function UpcomingDecisions({ days = 90 }) {
  // Captured once on mount. A calendar does not need to tick; it needs to hold
  // still while you read it, and Date.now() in a memo body would make "9 days"
  // change on any unrelated re-render.
  const [now] = useState(() => Date.now())

  const rows = useMemo(() => {
    const horizon = now + days * 86400000
    const out = []
    for (const b of BANKS) {
      let first = true
      for (const d of [...(b.dates ?? [])].sort()) {
        const ts = new Date(`${d}T00:00:00`).getTime()
        if (ts <= now) continue
        // `first` tracks the bank's next meeting overall, so a bank whose next
        // meeting falls outside the window does not hand its stance to a later
        // one that happens to land inside it.
        const isNext = first
        first = false
        if (ts > horizon) continue
        out.push({
          ...b, date: d, ts, isNext, expected: EXPECTED[b.key] ?? 'HOLD',
          daysAway: Math.ceil((ts - now) / 86400000),
        })
      }
    }
    return out.sort((a, b) => a.ts - b.ts)
  }, [days, now])

  if (!rows.length) return null

  return (
    <div className="border-t border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span className="text-terminal-gold">UPCOMING DECISIONS</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">NEXT {days} DAYS</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case ml-auto">{rows.length} meetings</span>
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-terminal-text-dim border-b border-terminal-border/50" style={{ fontSize: 8 }}>
            <th className="text-left font-normal px-3 py-1 tracking-widest" style={{ width: 34 }}></th>
            <th className="text-left font-normal py-1 tracking-widest" style={{ width: 90 }}>BANK</th>
            <th className="text-left font-normal py-1 tracking-widest">&nbsp;</th>
            <th className="text-left font-normal py-1 tracking-widest" style={{ width: 100 }}>DATE</th>
            <th className="text-right font-normal py-1 tracking-widest" style={{ width: 90 }}>CURRENT</th>
            <th className="text-left font-normal py-1 pl-6 tracking-widest" style={{ width: 130 }}>EXPECTED</th>
            <th className="text-right font-normal px-3 py-1 tracking-widest" style={{ width: 90 }}>AWAY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = PILL[r.expected] ?? PILL.HOLD
            const soon = r.daysAway <= 14
            return (
              <tr
                key={`${r.key}-${r.date}`}
                className="border-b border-terminal-border/25 hover:bg-terminal-accent/10 transition-colors"
              >
                <td className="px-3 py-1" style={{ fontSize: 14 }}>{r.flag}</td>
                <td className="py-1 font-mono font-bold text-terminal-text-bright" style={{ fontSize: 10 }}>
                  {r.label}
                  {!r.official && (
                    <span
                      className="text-terminal-text-dim/40 ml-1"
                      title="Follows this bank's known meeting cadence rather than a published calendar"
                    >~</span>
                  )}
                </td>
                <td className="py-1 font-mono text-terminal-text-dim/70 truncate" style={{ fontSize: 9 }}>
                  {VERIFIED_CONSTANTS[r.key]?.country ?? ''}
                </td>
                <td className="py-1 font-mono tabular-nums text-terminal-text" style={{ fontSize: 10 }}>
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </td>
                {/* The rate going INTO the meeting — the number the expected
                    decision would move. A date and a stance with no level
                    between them makes the reader look it up again. */}
                <td className="py-1 text-right font-mono tabular-nums text-terminal-gold" style={{ fontSize: 10 }}>
                  {VERIFIED_CONSTANTS[r.key]?.cashRate?.toFixed(2)}%
                </td>
                <td className="py-1 pl-6">
                  {r.isNext ? (
                    <span
                      className="font-mono font-bold inline-block"
                      style={{
                        fontSize: 8, letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 2,
                        color: st.colour, background: st.bg, border: `1px solid ${st.border}`,
                      }}
                    >{r.expected}</span>
                  ) : (
                    <span className="font-mono text-terminal-text-dim/35" style={{ fontSize: 10 }} title="No stance recorded for a bank's later meetings">—</span>
                  )}
                </td>
                <td
                  className="px-3 py-1 text-right font-mono tabular-nums"
                  style={{ fontSize: 10, color: soon ? '#C9A84C' : '#637899', fontWeight: soon ? 700 : 400 }}
                >
                  {r.daysAway} {r.daysAway === 1 ? 'day' : 'days'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="px-3 py-1.5 border-t border-terminal-border/40 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 8 }}>
        RBA, Fed, ECB and BOE dates are each bank&apos;s published calendar. The six marked
        <span className="text-terminal-text-dim/80"> ~ </span>
        follow that bank&apos;s known meeting cadence — treat those dates as approximate.
        EXPECTED is this terminal&apos;s recorded stance into each bank&apos;s next meeting,
        not a market-implied probability: no rate-futures feed is connected.
      </div>
    </div>
  )
}
