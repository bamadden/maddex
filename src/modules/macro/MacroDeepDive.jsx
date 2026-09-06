import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { askClaude } from '../../services/api'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'

// ─── Macro indicator deep dive ─────────────────────────────────────────────
//
// Expands an indicator card into what a reader actually wants next: how this
// reading compares to the last one, when the next one lands, where it sits
// against the RBA's target where one exists, and what it means.
//
// NO 24-MONTH HISTORY CHART. The brief asked for one. RBA_RATE_HISTORY is the
// only real series in this codebase — there is no 24-month path for CPI,
// unemployment, GDP or retail sales, and drawing one would mean generating
// twenty-odd readings per indicator that never existed. The panel shows the
// two readings that ARE real (current and previous) and says plainly when the
// next one is due.

const parseNum = (v) => {
  const m = String(v ?? '').match(/-?[\d.]+/)
  return m ? Number(m[0]) : null
}

// Where a reading sits against the RBA's 2-3% band. Only meaningful for the
// inflation series, so everything else returns null rather than inventing a
// relationship.
function targetRead(name, value) {
  if (!/CPI/i.test(name)) return null
  const v = parseNum(value)
  if (v == null) return null
  if (v > 3) return { label: 'ABOVE TARGET BAND', colour: '#C86464', detail: `${v}% against the RBA's 2–3% band` }
  if (v < 2) return { label: 'BELOW TARGET BAND', colour: '#4A9EDB', detail: `${v}% against the RBA's 2–3% band` }
  return { label: 'IN TARGET BAND', colour: '#2D8A50', detail: `${v}% within the RBA's 2–3% band` }
}

const CACHE_PREFIX = 'maddex_macro_read_'
const dayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

// One short interpretation per indicator per day.
//
// The figure is supplied in the prompt and the model is told it may quote that
// and nothing else — same contract as every other AI surface in this terminal.
// Cached per day because the underlying reading only changes on release, so
// regenerating on every expand would spend a call to say the same thing.
function useIndicatorRead(indicator, nextRelease) {
  const [state, setState] = useState({ status: 'idle', text: '', source: 'live' })

  useEffect(() => {
    if (!indicator) return
    const key = `${CACHE_PREFIX}${indicator.name}_${dayKey()}`
    let alive = true

    // Deferred rather than set in the effect body. Calling setState
    // synchronously as an effect runs is what triggers the cascading-render
    // lint rule, and the codebase already defers this way in NewsModule and
    // MorningBriefModule.
    let cached = null
    try { cached = localStorage.getItem(key) } catch { /* storage unavailable */ }

    if (cached) {
      const t = setTimeout(() => { if (alive) setState({ status: 'ready', text: cached, source: 'cache' }) }, 0)
      return () => { alive = false; clearTimeout(t) }
    }

    const t = setTimeout(() => { if (alive) setState({ status: 'loading', text: '', source: 'live' }) }, 0)

    const prompt = `Interpret one Australian economic indicator for an investor.

Indicator: ${indicator.name}
Latest reading: ${indicator.value} (released ${indicator.date})
Previous reading: ${indicator.prev}
${nextRelease ? `Next release: ${nextRelease}` : ''}
RBA cash rate: ${VERIFIED_CONSTANTS.rba.cashRate}%; inflation target band ${VERIFIED_CONSTANTS.au.rbaTargetBand}

In 2-3 sentences, say what this reading means for RBA policy, the AUD, and which ASX sectors it touches.
Quote only the figures given above. State no other number — no forecast, no estimate, no level for any market.
Plain prose, no markdown, no headings.`

    askClaude([{ role: 'user', content: prompt }], null, { maxTokens: 320 })
      .then(({ text }) => {
        if (!alive) return
        const clean = String(text ?? '').trim()
        try { localStorage.setItem(key, clean) } catch { /* quota */ }
        setState({ status: 'ready', text: clean, source: 'live' })
      })
      .catch(() => { if (alive) setState({ status: 'error', text: '', source: 'live' }) })

    return () => { alive = false; clearTimeout(t) }
  }, [indicator, nextRelease])

  return state
}

export function IndicatorDeepDive({ indicator, nextRelease, onClose }) {
  const read = useIndicatorRead(indicator, nextRelease)
  const target = targetRead(indicator.name, indicator.value)

  const cur = parseNum(indicator.value)
  const prev = parseNum(indicator.prev)
  const delta = cur != null && prev != null ? +(cur - prev).toFixed(2) : null

  return (
    <div className="border-b border-terminal-border" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="text-2xs font-bold text-terminal-gold tracking-widest">{indicator.name.toUpperCase()}</span>
          <span className="text-lg font-bold text-terminal-text-bright tabular-nums">{indicator.value}</span>
          {delta != null && (
            <span className="text-2xs tabular-nums" style={{ color: delta > 0 ? '#2D8A50' : delta < 0 ? '#C86464' : '#637899' }}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '→'} {Math.abs(delta)} vs previous ({indicator.prev})
            </span>
          )}
          {target && (
            <span className="text-2xs font-bold px-1.5 py-0.5" style={{ color: target.colour, border: `1px solid ${target.colour}66` }}>
              {target.label}
            </span>
          )}
          <button onClick={onClose} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">✕ CLOSE</button>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-2xs text-terminal-text-dim mb-2">
          <span>RELEASED <b className="text-terminal-text ml-1">{indicator.date}</b></span>
          {nextRelease && <span>NEXT <b className="text-terminal-gold ml-1">{nextRelease}</b></span>}
          <span>SOURCE <b className="text-terminal-text ml-1">{indicator.src}</b></span>
          {target && <span>{target.detail}</span>}
        </div>

        <div className="border-t border-terminal-border/40 pt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] text-terminal-gold font-bold tracking-widest">MADDENAI INTERPRETATION</span>
            <AIContentBadge source={read.source === 'cache' ? 'cache' : 'live'} />
          </div>
          {read.status === 'loading' && (
            <div className="text-2xs text-terminal-text-dim animate-pulse">Reading the print…</div>
          )}
          {read.status === 'error' && (
            <div className="text-2xs text-terminal-text-dim">Interpretation unavailable right now.</div>
          )}
          {read.status === 'ready' && (
            <div className="text-2xs text-terminal-text leading-relaxed">{read.text}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── RBA sensitivity matrix ────────────────────────────────────────────────
//
// Where the current readings put policy on the two axes the RBA actually
// trades off. The quadrant is located from verified constants — CPI against
// the target band, annual GDP against a trend rate — so the highlight moves
// when those figures are updated rather than being hardcoded.
//
// The lean in each cell is the textbook response, not a forecast. It says what
// the framework implies, which is a different claim from what the RBA will do,
// and the footnote says so.
const TREND_GDP = 2.25 // Australia's approximate trend growth, the usual dividing line

export function RbaSensitivityMatrix() {
  const { au, rba } = VERIFIED_CONSTANTS
  const inflationHigh = au.cpi > 3
  const growthHigh = au.gdpAnnual >= TREND_GDP

  const cells = [
    { growth: true,  infl: true,  lean: 'HIKE',      note: 'Demand running ahead of capacity' },
    { growth: true,  infl: false, lean: 'HOLD',      note: 'Growth without price pressure' },
    { growth: false, infl: true,  lean: 'HOLD',      note: 'Stagflationary — the hard quadrant' },
    { growth: false, infl: false, lean: 'CUT',       note: 'Room to support activity' },
  ]

  const LEAN_COLOUR = { HIKE: '#2D8A50', HOLD: '#C9A84C', CUT: '#C86464' }

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">RBA SENSITIVITY MATRIX</span>
        <span className="text-[9px] text-terminal-text-dim">
          CPI {au.cpi}% · GDP {au.gdpAnnual}% · cash rate {rba.cashRate}%
        </span>
      </div>

      <div className="p-3">
        <div className="grid" style={{ gridTemplateColumns: 'auto 1fr 1fr', gap: 4 }}>
          <div />
          <div className="text-[9px] text-terminal-text-dim tracking-widest text-center pb-1">INFLATION HIGH</div>
          <div className="text-[9px] text-terminal-text-dim tracking-widest text-center pb-1">INFLATION LOW</div>

          {[true, false].map((g) => (
            <Row key={String(g)} growthHigh={g} cells={cells} current={{ growthHigh, inflationHigh }} leanColour={LEAN_COLOUR} />
          ))}
        </div>

        <div className="text-[9px] text-terminal-text-dim/70 leading-snug mt-2.5">
          Current readings place Australia in the highlighted quadrant: inflation {au.cpi}%
          {inflationHigh ? ' above' : ' within or below'} the {au.rbaTargetBand} band, annual growth {au.gdpAnnual}%
          {growthHigh ? ' at or above' : ' below'} a ~{TREND_GDP}% trend. The lean shown is what the framework
          implies, not a forecast of what the board will decide.
        </div>
      </div>
    </div>
  )
}

function Row({ growthHigh, cells, current, leanColour }) {
  const row = cells.filter((c) => c.growth === growthHigh)
  return (
    <>
      <div className="text-[9px] text-terminal-text-dim tracking-widest flex items-center pr-2 whitespace-nowrap">
        GROWTH {growthHigh ? 'HIGH' : 'LOW'}
      </div>
      {row.map((c) => {
        const active = c.growth === current.growthHigh && c.infl === current.inflationHigh
        return (
          <div
            key={`${c.growth}-${c.infl}`}
            className="p-2 text-center"
            style={{
              border: active ? '1px solid rgba(201,168,76,0.7)' : '1px solid rgba(99,120,153,0.2)',
              background: active ? 'rgba(201,168,76,0.10)' : 'transparent',
            }}
          >
            <div className="text-2xs font-bold" style={{ color: active ? leanColour[c.lean] : '#637899' }}>
              → {c.lean}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: active ? '#8BA3C4' : 'rgba(99,120,153,0.6)' }}>
              {c.note}
            </div>
            {active && <div className="text-[8px] text-terminal-gold tracking-widest mt-1">YOU ARE HERE</div>}
          </div>
        )
      })}
    </>
  )
}
