import { useMemo, useState } from 'react'
import {
  RBA_MEETINGS_2026, FOMC_MEETINGS_2026, ECB_MEETINGS_2026, BOE_MEETINGS_2026,
  BOJ_MEETINGS_2026, BOC_MEETINGS_2026,
  SNB_MEETINGS_2026, RIKSBANK_MEETINGS_2026, MEETINGS_CHECKED, ANNOUNCE_AT, ANNOUNCE_AT_CHECKED, announcement, daysBetweenDays,
} from '../../services/centralBankSchedule'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { PAL } from '../../styles/palette.js'
import { formatDate, sydneyClock, localClock } from '../../utils/dateUtils'

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

const BANKS = [
  { key: 'rba',      label: 'RBA',      flag: '🇦🇺', dates: RBA_MEETINGS_2026 },
  { key: 'fed',      label: 'Fed',      flag: '🇺🇸', dates: FOMC_MEETINGS_2026 },
  { key: 'ecb',      label: 'ECB',      flag: '🇪🇺', dates: ECB_MEETINGS_2026 },
  { key: 'boe',      label: 'BOE',      flag: '🇬🇧', dates: BOE_MEETINGS_2026 },
  { key: 'boj',      label: 'BOJ',      flag: '🇯🇵', dates: BOJ_MEETINGS_2026 },
  { key: 'boc',      label: 'BOC',      flag: '🇨🇦', dates: BOC_MEETINGS_2026 },
  { key: 'snb',      label: 'SNB',      flag: '🇨🇭', dates: SNB_MEETINGS_2026 },
  { key: 'riksbank', label: 'Riksbank', flag: '🇸🇪', dates: RIKSBANK_MEETINGS_2026 },
]

const PILL = {
  HOLD: { colour: PAL.gold, bg: 'rgba(201,168,76,0.14)', border: 'rgba(201,168,76,0.4)' },
  CUT:  { colour: PAL.up, bg: 'rgba(45,138,80,0.16)',  border: 'rgba(45,138,80,0.45)' },
  HIKE: { colour: PAL.down, bg: 'rgba(200,68,68,0.16)',  border: 'rgba(200,68,68,0.45)' },
}

export default function UpcomingDecisions({ days = 90 }) {
  // Captured once on mount. A calendar does not need to tick; it needs to hold
  // still while you read it, and Date.now() in a memo body would make "9 days"
  // change on any unrelated re-render.
  const [now] = useState(() => Date.now())

  const rows = useMemo(() => {
    // Every row in Sydney time: the announcement instant from the bank's own
    // time and zone, the countdown in Sydney calendar days (it used to count
    // from the browser's midnight, and to show foreign dates as bank-local).
    const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const out = []
    for (const b of BANKS) {
      let first = true
      for (const d of [...(b.dates ?? [])].sort()) {
        const { at, sydneyDate } = announcement(b.key, d)
        if (at != null ? at <= now : sydneyDate < today) continue
        const ts = at ?? Date.parse(`${sydneyDate}T00:00:00Z`)
        const daysAway = daysBetweenDays(today, sydneyDate)
        // `first` tracks the bank's next meeting overall, so a bank whose next
        // meeting falls outside the window does not hand its stance to a later
        // one that happens to land inside it.
        const isNext = first
        first = false
        if (daysAway > days) continue
        out.push({ ...b, date: d, at, sydneyDate, ts, isNext, daysAway })
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
          <tr className="text-terminal-text-dim border-b border-terminal-border/50" style={{ fontSize: 11 }}>
            <th className="text-left font-normal px-3 py-1 tracking-widest" style={{ width: 34 }}></th>
            <th className="text-left font-normal py-1 tracking-widest" style={{ width: 90 }}>BANK</th>
            <th className="text-left font-normal py-1 tracking-widest">&nbsp;</th>
            <th className="text-left font-normal py-1 tracking-widest" style={{ width: 150 }}>WHEN (SYDNEY)</th>
            <th className="text-right font-normal py-1 tracking-widest" style={{ width: 90 }}>CURRENT</th>
            <th className="text-left font-normal py-1 pl-6 tracking-widest" style={{ width: 150 }}>LAST DECISION</th>
            <th className="text-right font-normal px-3 py-1 tracking-widest" style={{ width: 90 }}>AWAY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vc = VERIFIED_CONSTANTS[r.key]
            const st = PILL[vc?.lastDecisionVerb] ?? PILL.HOLD
            const soon = r.daysAway <= 14
            return (
              <tr
                key={`${r.key}-${r.date}`}
                className="border-b border-terminal-border/25 hover:bg-terminal-accent/10 transition-colors"
              >
                <td className="px-3 py-1" style={{ fontSize: 14 }}>{r.flag}</td>
                <td className="py-1 font-mono font-bold text-terminal-text-bright" style={{ fontSize: 11 }}>
                  {r.label}
                </td>
                <td className="py-1 font-mono text-terminal-text-dim/70 truncate" style={{ fontSize: 11 }}>
                  {VERIFIED_CONSTANTS[r.key]?.country ?? ''}
                </td>
                <td
                  className="py-1 font-mono tabular-nums text-terminal-text" style={{ fontSize: 11 }}
                  title={ANNOUNCE_AT[r.key] ? `${formatDate(r.date, { year: false })}, ${ANNOUNCE_AT[r.key][0]} ${ANNOUNCE_AT[r.key][1].split('/')[1].replace('_', ' ')} time` : 'The bank\'s pages state no announcement time'}
                  data-decision-time
                >
                  <div>{formatDate(r.sydneyDate, { weekday: true, year: false })}{r.at != null ? ` ${sydneyClock(r.at).text}` : ''}</div>
                  {r.at != null && localClock(r.at).zone !== 'Australia/Sydney' && (
                    <div className="text-terminal-text-dim/70">your time {localClock(r.at).text}</div>
                  )}
                  {r.at == null && <div className="text-terminal-text-dim/70">time not stated</div>}
                </td>
                {/* The rate going into the meeting, as the bank states it (the
                    Fed as its range). */}
                <td className="py-1 text-right font-mono tabular-nums text-terminal-gold" style={{ fontSize: 11 }}>
                  {vc?.rateRange ?? (vc?.cashRate != null ? `${vc.cashRate.toFixed(2)}%` : '—')}
                </td>
                <td className="py-1 pl-6">
                  {r.isNext && vc?.lastDecisionVerb ? (
                    <span className="font-mono inline-flex items-center gap-1.5" style={{ fontSize: 11 }}>
                      <span className="font-bold inline-block" style={{ letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 2, color: st.colour, background: st.bg, border: `1px solid ${st.border}` }}>{vc.lastDecisionVerb}</span>
                      <span className="text-terminal-text-dim">{formatDate(vc.lastDecision, { year: false })}</span>
                    </span>
                  ) : (
                    <span className="font-mono text-terminal-text-dim/35" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
                <td
                  className="px-3 py-1 text-right font-mono tabular-nums"
                  style={{ fontSize: 11, color: soon ? PAL.gold : PAL.muted, fontWeight: soon ? 700 : 400 }}
                >
                  {r.daysAway === 0 ? 'today' : `${r.daysAway} ${r.daysAway === 1 ? 'day' : 'days'}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="px-3 py-1.5 border-t border-terminal-border/40 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 11 }}>
        Dates are each bank&apos;s own published calendar, read {formatDate(MEETINGS_CHECKED)}; times are the
        announcement time each bank states, read {formatDate(ANNOUNCE_AT_CHECKED)}, shown in Sydney (hover for the
        bank&apos;s own). AWAY counts Sydney calendar days. The RBNZ and PBoC are not listed: their dates could
        not be read from a published calendar. LAST DECISION is what the bank last did, from its own statement; Maddex
        shows no expected outcome for the next meeting.
      </div>
    </div>
  )
}
