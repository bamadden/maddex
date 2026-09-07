import { useEffect, useMemo, useRef, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { RBA_RATE_HISTORY } from '../../data/placeholders'
import VerifiedBadge, { AIContentBadge } from '../../components/ui/VerifiedBadge'
import aiContentService from '../../services/aiContentService'

// ─── Central bank comparison cards ──────────────────────────────────────────
//
// Ten banks, sorted by policy rate descending, each expanding in place to the
// detail behind the number.
//
// SORTED BY RATE, NOT BY IMPORTANCE. The previous grid put the RBA first
// because this is an Australian terminal, and kept it there with a gold left
// marker. Sorting by rate drops it to second behind the Fed — and that is the
// more useful ordering, because the question a card grid answers is "who is
// paying what", which is a ranking. The RBA keeps every piece of its visual
// weight (marker, gold figure, HOME tag); it just sits where its rate puts it,
// which is itself information.

const BANKS = [
  { key: 'rba',      name: 'Reserve Bank of Australia', flag: '🇦🇺', ccy: 'AUD', home: true },
  { key: 'fed',      name: 'Federal Reserve',           flag: '🇺🇸', ccy: 'USD' },
  { key: 'ecb',      name: 'ECB',                       flag: '🇪🇺', ccy: 'EUR' },
  { key: 'boe',      name: 'Bank of England',           flag: '🇬🇧', ccy: 'GBP' },
  { key: 'boj',      name: 'Bank of Japan',             flag: '🇯🇵', ccy: 'JPY' },
  { key: 'pboc',     name: 'PBOC',                      flag: '🇨🇳', ccy: 'CNY' },
  { key: 'rbnz',     name: 'RBNZ',                      flag: '🇳🇿', ccy: 'NZD' },
  { key: 'boc',      name: 'Bank of Canada',            flag: '🇨🇦', ccy: 'CAD' },
  { key: 'snb',      name: 'Swiss National Bank',       flag: '🇨🇭', ccy: 'CHF' },
  { key: 'riksbank', name: 'Riksbank',                  flag: '🇸🇪', ccy: 'SEK' },
]

// The last decision, turned into a stance. A cut is easing, a hike is
// tightening, a hold is neither — which is what NEUTRAL means here and is
// worth saying plainly: it describes the last move, not a forecast of the
// next one.
const BIAS = {
  CUT:  { label: 'EASING',     colour: '#2D8A50', bg: 'rgba(45,138,80,0.16)',  border: 'rgba(45,138,80,0.45)' },
  HIKE: { label: 'TIGHTENING', colour: '#CC4444', bg: 'rgba(200,68,68,0.16)',  border: 'rgba(200,68,68,0.45)' },
  HOLD: { label: 'NEUTRAL',    colour: '#C9A84C', bg: 'rgba(201,168,76,0.14)', border: 'rgba(201,168,76,0.4)' },
}

const DOT = { HIKE: '#CC4444', CUT: '#2D8A50', HOLD: '#C9A84C' }

// A fixed three-letter table rather than toLocaleDateString('short'): ICU's
// en-AU short months are not all three letters — June and July come back
// spelled out — so a row of cards ends up reading AUG / JULY / JUNE / MAY with
// the pill after them landing in a different place on every card.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const monthYear = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d) ? '—' : `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

const dayMonth = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// The RBA's last three decisions, derived from the published cash-rate path
// exactly as the timeline panel derives its own — a change is a hike or a cut,
// a repeated level is a hold.
//
// ONLY THE RBA GETS THREE. RBA_RATE_HISTORY is a real series; for the other
// nine banks this codebase records exactly one decision each, in
// verifiedConstants. Drawing three dots for the Riksbank would mean inventing
// two of them, and an invented decision is not a rounding error — it is a
// false claim about what a central bank did on a date. Those cards show the
// one decision that is recorded and say that is all that is recorded.
function rbaLastThree() {
  const h = RBA_RATE_HISTORY
  const out = []
  for (let i = h.length - 1; i > 0 && out.length < 3; i--) {
    const diff = +(h[i].rate - h[i - 1].rate).toFixed(2)
    out.push({
      date: h[i].date,
      decision: diff > 0 ? 'HIKE' : diff < 0 ? 'CUT' : 'HOLD',
      rate: h[i].rate,
    })
  }
  return out
}

function DecisionDots({ rows }) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.date} className="flex items-center gap-1.5">
          <span className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: DOT[r.decision] ?? '#637899' }} />
          <span className="font-mono font-bold" style={{ fontSize: 9, color: DOT[r.decision] ?? '#637899' }}>{r.decision}</span>
          <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{monthYear(r.date)}</span>
          {r.rate != null && (
            <span className="font-mono text-terminal-text-dim/60 tabular-nums ml-auto" style={{ fontSize: 9 }}>{r.rate.toFixed(2)}%</span>
          )}
        </div>
      ))}
    </div>
  )
}

function CardBody({ bank, c, now, bias, biasSource }) {
  const gov = VERIFIED_CONSTANTS.centralBankOfficials?.[bank.key]
  const next = c.nextMeeting ? new Date(`${c.nextMeeting}T00:00:00`) : null
  const daysAway = next ? Math.max(0, Math.ceil((next.getTime() - now) / 86400000)) : null

  const decisions = bank.key === 'rba'
    ? rbaLastThree()
    : [{ date: c.lastDecision, decision: (c.lastDecisionVerb ?? 'HOLD').toUpperCase(), rate: c.cashRate }]

  return (
    <div className="pt-2 mt-2 space-y-2" style={{ borderTop: '1px solid rgba(201,168,76,0.14)' }}>
      {/* Office holder. Named only where verifiedConstants holds a checked
          name — six of these ten banks have no verified office holder in this
          build, and the card says so rather than filling the line from
          memory. */}
      <div>
        <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 7, letterSpacing: '0.14em' }}>OFFICE HOLDER</div>
        {gov?.name ? (
          <>
            <div className="font-mono text-terminal-text-bright" style={{ fontSize: 10 }}>{gov.name}</div>
            <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8 }}>
              {gov.role}{gov.since ? ` · since ${new Date(`${gov.since}T00:00:00`).getFullYear()}` : ''}
            </div>
          </>
        ) : (
          <div className="font-mono text-terminal-text-dim/45 italic leading-snug" style={{ fontSize: 8 }}>
            Not verified in this build — no name shown.
          </div>
        )}
      </div>

      <div>
        <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 7, letterSpacing: '0.14em' }}>NEXT MEETING</div>
        <div className="font-mono" style={{ fontSize: 10 }}>
          <span className="text-terminal-text-bright">{dayMonth(c.nextMeeting)}</span>
          {daysAway != null && <span className="text-terminal-gold"> · {daysAway} {daysAway === 1 ? 'day' : 'days'} away</span>}
        </div>
      </div>

      <div>
        <div className="font-mono text-terminal-text-dim/50 mb-1" style={{ fontSize: 7, letterSpacing: '0.14em' }}>
          {bank.key === 'rba' ? 'LAST 3 DECISIONS' : 'LAST DECISION'}
        </div>
        <DecisionDots rows={decisions} />
        {bank.key !== 'rba' && (
          <div className="font-mono text-terminal-text-dim/40 italic mt-1 leading-snug" style={{ fontSize: 7 }}>
            Only the most recent decision is recorded for this bank.
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-mono text-terminal-text-dim/50" style={{ fontSize: 7, letterSpacing: '0.14em' }}>POLICY BIAS</span>
          <AIContentBadge source={biasSource} label="AI-ESTIMATE" />
        </div>
        <div className="font-mono text-terminal-text-dim leading-snug" style={{ fontSize: 9 }}>
          {bias ?? (biasSource === 'loading' ? 'Reading…' : 'Unavailable — the daily generation did not return.')}
        </div>
      </div>
    </div>
  )
}

export default function CentralBankCards() {
  const [open, setOpen] = useState(null)
  // Captured once. A clock read during render makes "9 days away" change on
  // any unrelated re-render and makes this component non-idempotent.
  const [now] = useState(() => Date.now())

  const [bias, setBias] = useState(null)
  const [biasSource, setBiasSource] = useState(null)
  // A ref, not state: this is a run-once latch, and a failed generation should
  // not refire on every subsequent card the user opens.
  const requested = useRef(false)

  // Lazily generated: the first expansion triggers the day's single call, and
  // a module visit that never opens a card costs nothing.
  useEffect(() => {
    if (open == null || requested.current) return
    requested.current = true
    let live = true
    aiContentService.getPolicyBias()
      .then(({ data, source }) => {
        if (!live) return
        setBias(data ?? {})
        setBiasSource(source === 'failed' ? 'failed' : source)
      })
      .catch(() => { if (live) setBiasSource('failed') })
    return () => { live = false }
  }, [open])

  // Derived, not stored — the request is in flight exactly while a card is
  // open and nothing has come back yet, which is a fact about the two states
  // above rather than a third state to keep in sync with them.
  const biasState = biasSource ?? (open != null ? 'loading' : 'idle')

  const cards = useMemo(() => BANKS
    .map((b) => ({ ...b, c: VERIFIED_CONSTANTS[b.key] }))
    .filter((b) => b.c)
    .sort((a, b) => b.c.cashRate - a.c.cashRate), [])

  return (
    <div className="border-b border-terminal-border flex-shrink-0">
      <div className="panel-header flex items-center gap-2">
        <span className="text-terminal-gold">GLOBAL POLICY RATES</span>
        {/* Every bank in this grid shares one verification date, so the badge
            belongs on the header rather than repeated ten times. */}
        <VerifiedBadge dataKey="rba" alwaysShow />
        <span className="text-2xs text-terminal-text-dim font-normal normal-case ml-auto">
          10 banks · highest rate first · click a card for detail
        </span>
      </div>

      {/* Cells stretch to the tallest in the row, so an expanded card takes
          its whole row rather than leaving a ragged edge — the button inside
          pins its own content to the top so the short cards do not float. */}
      <div className="grid grid-cols-5">
        {cards.map((b) => {
          const c = b.c
          const verb = (c.lastDecisionVerb ?? 'HOLD').toUpperCase()
          const st = BIAS[verb] ?? BIAS.HOLD
          const isOpen = open === b.key
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : b.key)}
              aria-expanded={isOpen}
              className={`flex flex-col justify-start text-left border-r border-b border-terminal-border p-2 transition-colors hover:bg-terminal-accent/10 ${
                b.home ? 'bg-terminal-gold/[0.07] border-l-2 border-l-terminal-gold' : ''
              } ${isOpen ? 'bg-terminal-accent/15' : ''}`}
              style={{ minWidth: 180 }}
            >
              <div className={`flex items-center gap-1 font-mono uppercase tracking-wide ${
                b.home ? 'text-terminal-gold font-bold' : 'text-terminal-text-dim'
              }`} style={{ fontSize: 9 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{b.flag}</span>
                <span className="truncate">{b.name}</span>
                {b.home && <span className="ml-auto text-terminal-gold/60 flex-shrink-0" style={{ fontSize: 7, letterSpacing: '0.18em' }}>HOME</span>}
              </div>

              <div className="font-mono font-bold text-terminal-gold leading-tight tabular-nums mt-1" style={{ fontSize: 18 }}>
                {c.cashRate.toFixed(2)}%
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 8 }}>
                  {verb} {monthYear(c.lastDecision)}
                </span>
                <span
                  className="ml-auto font-mono font-bold flex-shrink-0"
                  style={{
                    fontSize: 7, letterSpacing: '0.1em', padding: '1px 4px', borderRadius: 2,
                    color: st.colour, background: st.bg, border: `1px solid ${st.border}`,
                  }}
                >{st.label}</span>
              </div>

              {c.rateRange && (
                <div className="font-mono text-terminal-text-dim/50 mt-0.5" style={{ fontSize: 7 }}>Target range {c.rateRange}</div>
              )}
              {c.note && !c.rateRange && (
                <div className="font-mono text-terminal-text-dim/50 mt-0.5 truncate" style={{ fontSize: 7 }}>{c.note}</div>
              )}

              {/* 0fr → 1fr on a grid row animates height without measuring
                  anything, so the panel opens smoothly whatever it contains. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: isOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  {isOpen && <CardBody bank={b} c={c} now={now} bias={bias?.[b.key]} biasSource={biasState} />}
                </div>
              </div>

              <div className="font-mono text-terminal-text-dim/40 mt-1.5" style={{ fontSize: 7 }}>
                {isOpen ? '▲ CLOSE' : '▼ DETAIL'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
