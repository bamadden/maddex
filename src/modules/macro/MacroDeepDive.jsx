import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS, pendingRbaDecision } from '../../data/verifiedConstants'
import { askClaude } from '../../services/api'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'
import RegimeQuadrant from './RegimeQuadrant'

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
  if (v > 3) return { label: 'ABOVE TARGET BAND', colour: '#CC4444', detail: `${v}% against the RBA's 2–3% band` }
  if (v < 2) return { label: 'BELOW TARGET BAND', colour: '#4A9EDB', detail: `${v}% against the RBA's 2–3% band` }
  return { label: 'IN TARGET BAND', colour: '#2D8A50', detail: `${v}% within the RBA's 2–3% band` }
}

// How directly each indicator feeds the RBA's decision. This is a property of
// the series, not a judgement made per render: CPI and the labour market are
// the two halves of the Bank's mandate, GDP and retail sales inform the demand
// picture, and an ASX ratio does not enter the framework at all.
const RBA_RELEVANCE = [
  { test: /CPI|inflation|trimmed/i,        level: 'HIGH',   why: 'Inflation is one half of the RBA\'s dual mandate — this reading feeds the decision directly.' },
  { test: /unemploy|labour|employ|wage/i,  level: 'HIGH',   why: 'Full employment is the other half of the mandate; the labour market is watched as closely as inflation.' },
  { test: /cash rate/i,                    level: 'HIGH',   why: 'This IS the policy setting.' },
  { test: /GDP|growth/i,                   level: 'MEDIUM', why: 'Growth shapes the demand picture the Board reasons about, but it is not a mandate target.' },
  { test: /retail|housing|HPI|confidence/i, level: 'MEDIUM', why: 'A demand-side input — informative for the outlook rather than decisive on its own.' },
  { test: /trade|balance/i,                level: 'LOW',    why: 'Reaches policy indirectly, mainly through the currency.' },
]

const RELEVANCE_TONE = { HIGH: '#CC4444', MEDIUM: '#C9A84C', LOW: '#637899' }

function rbaRelevance(name = '') {
  const hit = RBA_RELEVANCE.find((r) => r.test.test(name))
  return hit ?? { level: 'LOW', why: 'Not a direct input to the policy framework.' }
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
RBA cash rate: ${VERIFIED_CONSTANTS.rba.cashRate.toFixed(2)}%; inflation target band ${VERIFIED_CONSTANTS.au.rbaTargetBand}

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
            <span className="text-2xs tabular-nums" style={{ color: delta > 0 ? '#2D8A50' : delta < 0 ? '#CC4444' : '#637899' }}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '→'} {Math.abs(delta)} vs previous ({indicator.prev})
            </span>
          )}
          {target && (
            <span className="text-2xs font-bold px-1.5 py-0.5" style={{ color: target.colour, border: `1px solid ${target.colour}66` }}>
              {target.label}
            </span>
          )}
          {(() => {
            const rel = rbaRelevance(indicator.name)
            const tone = RELEVANCE_TONE[rel.level]
            return (
              <span
                className="text-2xs font-bold px-1.5 py-0.5"
                style={{ color: tone, border: `1px solid ${tone}66` }}
                title={rel.why}
              >{rel.level} RELEVANCE TO RBA POLICY</span>
            )
          })()}
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

// ─── Growth / inflation position — the RBA sensitivity matrix ─────────────
//
// Where current readings put Australia on the two axes the RBA trades off,
// drawn as the quadrant chart (RegimeQuadrant: gold dot now, the published
// quarterly path behind it) beside what each quadrant means for policy.
//
// The narrative is assembled from verifiedConstants — the quadrant, the
// readings, the decisions this year and the dated market pricing — not
// generated, so it cannot state a figure the constants do not hold.
//
// The stagflation lean used to read HOLD, while the RBA was hiking. With
// inflation outside the target band the textbook trade-off resolves toward
// inflation, which is what the Board has done; the cell now says so.
const TREND_GDP = 2.25 // Australia's approximate trend growth, the usual dividing line

const QUADRANT_GUIDE = [
  { key: 'stag', label: 'STAGFLATION RISK', growth: false, infl: true, lean: 'HIKE / HOLD', tone: '#CC4444',
    note: 'The hardest case — growth below trend, inflation above target. Inflation outside the band usually wins: the RBA tightens despite the slowdown.' },
  { key: 'over', label: 'OVERHEATING', growth: true, infl: true, lean: 'HIKE', tone: '#E8A33D',
    note: 'Demand running ahead of capacity — the textbook case for tightening.' },
  { key: 'rec', label: 'CONTRACTION', growth: false, infl: false, lean: 'CUT', tone: '#4A9EDB',
    note: 'Weak growth and inflation in or below the band — room to support activity.' },
  { key: 'gold', label: 'GOLDILOCKS', growth: true, infl: false, lean: 'HOLD', tone: '#2D8A50',
    note: 'Growth at trend without price pressure — policy can sit still.' },
]

export function RbaSensitivityMatrix() {
  const { au, rba } = VERIFIED_CONSTANTS
  const nd = pendingRbaDecision()
  const inflationHigh = au.cpi > 3
  const growthHigh = au.gdpAnnual >= TREND_GDP
  const here = QUADRANT_GUIDE.find((q) => q.growth === growthHigh && q.infl === inflationHigh)
  const year = rba.lastDecision.slice(0, 4)
  const hikes = (rba.decisions ?? []).filter((d) => d.date.startsWith(year) && d.decision === 'HIKE').length
  const pricing = nd?.marketHikePct != null
    ? ` Markets price ~${nd.marketHikePct}% for a further hike to ${nd.hikeRate.toFixed(2)}% on ${new Date(`${nd.date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} (${nd.marketSource}, ${nd.marketAsOf}).`
    : ''
  const narrative = here.key === 'stag'
    ? `Australia sits in the stagflation-risk quadrant. Annual GDP growth of ${au.gdpAnnual}% (${au.gdpPeriod}) is below the ~${TREND_GDP}% trend, while CPI at ${au.cpi.toFixed(1)}% (${au.cpiPeriod}) is above the ${au.rbaTargetBand} target band. With inflation outside the band the RBA has put it ahead of growth: ${hikes} hike${hikes === 1 ? '' : 's'} in ${year}, to ${rba.cashRate.toFixed(2)}%.${pricing}`
    : `Australia sits in the ${here.label.toLowerCase()} quadrant: annual GDP growth ${au.gdpAnnual}% (${au.gdpPeriod}) against a ~${TREND_GDP}% trend, CPI ${au.cpi.toFixed(1)}% (${au.cpiPeriod}) against the ${au.rbaTargetBand} band, cash rate ${rba.cashRate.toFixed(2)}%.${pricing}`

  return (
    <div className="border border-terminal-border">
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-terminal-border flex-wrap gap-2">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">GROWTH / INFLATION POSITION · RBA SENSITIVITY</span>
        <span className="text-[9px] text-terminal-text-dim">
          CPI {au.cpi.toFixed(1)}% · GDP {au.gdpAnnual}% · cash rate {rba.cashRate.toFixed(2)}%
        </span>
      </div>

      <div className="p-3 grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-4">
        <RegimeQuadrant />

        <div className="space-y-1.5 min-w-0">
          {QUADRANT_GUIDE.map((q) => {
            const active = q.key === here.key
            return (
              <div key={q.key} className="px-2.5 py-1.5" style={{
                border: active ? `1px solid ${q.tone}AA` : '1px solid rgba(99,120,153,0.2)',
                background: active ? `${q.tone}14` : 'transparent',
              }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-bold tracking-widest" style={{ color: active ? q.tone : '#637899' }}>{q.label}</span>
                  <span className="text-[9px] font-mono" style={{ color: active ? '#E8EDF5' : '#4A6080' }}>→ {q.lean}</span>
                  {active && <span className="ml-auto text-[8px] text-terminal-gold tracking-widest font-bold">YOU ARE HERE</span>}
                </div>
                <div className="text-[9px] mt-0.5 leading-snug" style={{ color: active ? '#8BA3C4' : 'rgba(99,120,153,0.6)' }}>{q.note}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="border-t border-terminal-border/50 pt-2.5 flex items-start gap-2">
          <span className="font-mono font-bold flex-shrink-0 px-1.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: '#8BA3C4', border: '1px solid rgba(139,163,196,0.35)' }}
            title="Assembled from verified figures, not generated by MaddenAI">FROM VERIFIED FIGURES</span>
          <p className="text-2xs text-terminal-text leading-relaxed">{narrative}</p>
        </div>
        <div className="text-[9px] text-terminal-text-dim/60 leading-snug mt-1.5">
          Quadrant boundaries: ~{TREND_GDP}% trend growth; inflation above the top of the band counts as high. The lean is
          what the framework implies, not a forecast of the Board&apos;s decision.
        </div>
      </div>
    </div>
  )
}
