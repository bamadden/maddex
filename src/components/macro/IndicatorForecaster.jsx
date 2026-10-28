import { useState } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import SafeChart from '../ui/SafeChart'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { AU_TRADE_BALANCE } from '../../data/placeholders'
import { askClaudeJSON } from '../../services/api'
import { AIContentBadge } from '../ui/VerifiedBadge'

// ─── Economic dashboard — twelve Australian indicators ──────────────────────
//
// REBUILT 28 Oct 2026. This panel used to draw a seeded random walk for each
// indicator ("GDP Growth 1.03%", "Inflation 2.91%", "Consumer Confidence
// 1.13"), invent a "consensus" for every point and an accuracy statistic over
// the two, and then ask MaddenAI to forecast the next value of the invented
// series. It sat under the verified figures on the same page and contradicted
// every one of them.
//
// Every card is now a published figure from verifiedConstants (ABS, RBA,
// NAB, RBA table F4) or a series fetched from the agency's data API. Where a
// history is held it is charted; where only the latest and previous prints
// are held, the card says so rather than drawing a line between two points
// and calling it a trend. No consensus is shown — none is held.
//
// MADDENAI COMMENTARY is on demand, per card, and is told the real readings
// and nothing else: what the print says and what it means for the RBA, in
// words. It does not forecast the next value.

const { au, rba, bonds } = VERIFIED_CONSTANTS
const pct = (v, dp = 1) => (v == null ? '—' : `${v.toFixed(dp)}%`)
const ym = (p) => { const [y, m] = p.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]}-${y.slice(2)}` }
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null)

// Cash rate at each decision, from the RBA decision list.
const cashSeries = (rba.decisions ?? []).map((d) => ({ date: d.date.slice(0, 7), label: ym(d.date.slice(0, 7)), value: d.rate }))

const INDICATORS = [
  {
    key: 'cpi', label: 'CPI (annual)', unit: '%', value: au.cpi, prev: au.cpiPrevious, period: au.cpiPeriod,
    next: au.cpiNextRelease, src: 'ABS monthly CPI', hint: `RBA target ${au.rbaTargetBand}`, upIsBad: true,
    series: au.cpiHistory.filter((r) => r.type === 'monthly').map((r) => ({ label: ym(r.period), value: r.value })),
  },
  {
    key: 'trimmed', label: 'Trimmed mean (annual)', unit: '%', value: au.cpiTrimmedMean, prev: au.cpiTrimmedMeanPrevious, period: au.cpiPeriod,
    next: au.cpiNextRelease, src: 'ABS monthly CPI', hint: 'the RBA’s preferred underlying measure', upIsBad: true,
    series: au.cpiHistory.filter((r) => r.type === 'monthly' && r.trimmed != null).map((r) => ({ label: ym(r.period), value: r.trimmed })),
  },
  {
    key: 'tmq', label: 'Trimmed mean (quarter)', unit: '%', value: au.cpiQuarterTrimmedQoQ, prev: au.cpiQuarterPrevious?.trimmedQoQ, period: au.cpiQuarterPeriod,
    next: null, nextNote: 'Dec quarter: late Jan 2027', src: 'ABS CPI, Appendix 1a', hint: `RBA forecast ${au.cpiQuarterRbaForecast ?? '—'}% q/q`, upIsBad: true,
  },
  {
    key: 'unemp', label: 'Unemployment', unit: '%', value: au.unemployment, prev: au.unemploymentPrevious, period: au.unemploymentPeriod,
    next: au.unemploymentNextRelease, src: 'ABS Labour Force', hint: 'NAIRU estimate ~4.25%', upIsBad: true,
    series: au.unemploymentHistory.map((r) => ({ label: ym(r.period), value: r.value })),
  },
  {
    key: 'gdpq', label: 'GDP (quarter)', unit: '%', value: au.gdpQoQ, prev: au.gdpHistory?.at(-2)?.value, period: au.gdpPeriod,
    next: null, nextNote: 'Sep quarter: early Dec', src: 'ABS National Accounts', hint: 'real, seasonally adjusted',
    series: (au.gdpHistory ?? []).map((r) => ({ label: r.period.replace('20', '').replace('-', ' '), value: r.value })),
  },
  {
    key: 'gdpy', label: 'GDP (annual)', unit: '%', value: au.gdpAnnual, prev: au.auQuarterlyPath?.at(-2)?.gdpAnnual, period: au.gdpPeriod,
    next: null, nextNote: 'Sep quarter: early Dec', src: 'ABS National Accounts', hint: 'trend ~2.25%',
    series: (au.auQuarterlyPath ?? []).map((r) => ({ label: r.period, value: r.gdpAnnual })),
  },
  {
    key: 'cash', label: 'RBA cash rate', unit: '%', value: rba.cashRate, prev: rba.previousRate, period: `${rba.lastDecisionVerb} ${day(rba.lastDecision)}`,
    next: rba.nextMeeting, src: 'RBA', hint: rba.levelContext, dp: 2, step: true, series: cashSeries,
  },
  {
    key: 'trade', label: 'Goods trade balance', unit: 'B', prefix: 'A$', value: au.tradeBalanceBn, prev: au.tradeBalancePrevBn, period: au.tradeBalancePeriod,
    next: au.tradeBalanceNextRelease, src: 'ABS International Trade in Goods', hint: 'monthly, seasonally adjusted', dp: 2,
    series: AU_TRADE_BALANCE.map((r) => ({ label: r.date, value: r.value })),
  },
  {
    key: 'hhs', label: 'Household spending (month)', unit: '%', value: au.householdSpendingMoM, prev: au.householdSpendingPrevMoM, period: au.householdSpendingPeriod,
    next: au.householdSpendingNextRelease, src: 'ABS Household Spending Indicator', hint: `${au.householdSpendingYoY}% over the year`,
  },
  {
    key: 'nab', label: 'NAB business confidence', unit: '', value: au.nabConfidence, prev: au.nabConfidencePrev, period: au.nabPeriod,
    next: null, nextNote: 'October survey: mid-November', src: 'NAB Monthly Business Survey', hint: `conditions ${au.nabConditions}; long-run average about +5`, dp: 0,
  },
  {
    key: 'au10y', label: 'AU 10-year yield', unit: '%', value: bonds?.au10y, prev: null, period: day(bonds?.au10yAsOf),
    next: null, nextNote: 'market rate — daily', src: 'Market close', hint: `US 10Y ${bonds?.us10y?.toFixed(2)}%`, dp: 2,
  },
  {
    key: 'td3', label: '3-year term deposit', unit: '%', value: au.termDeposit3y, prev: null, period: au.termDepositPeriod,
    next: null, nextNote: 'RBA F4 — monthly', src: au.termDepositSource, hint: `1-year ${pct(au.termDeposit1y, 2)}`, dp: 2,
  },
]

const fmt = (ind, v) => (v == null ? '—' : `${ind.prefix ?? ''}${v.toFixed(ind.dp ?? 1)}${ind.unit}`)

// ─── Commentary ───────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'maddex_indicator_comment_'
async function commentOn(ind) {
  const cacheKey = `${CACHE_PREFIX}${ind.key}_${new Date().toLocaleDateString('en-CA')}_${ind.value}`
  try { const c = localStorage.getItem(cacheKey); if (c) return JSON.parse(c) } catch { /* regenerate */ }
  const recent = ind.series?.slice(-6).map((r) => `${r.label}: ${r.value}`).join(', ')
  const prompt = `You are MaddenAI. Comment on this Australian economic indicator for an investor. Use ONLY the figures given — do not state any other number, and do not forecast the next reading.

Indicator: ${ind.label} (${ind.hint})
Latest: ${fmt(ind, ind.value)} for ${ind.period}${ind.prev != null ? `; previous ${fmt(ind, ind.prev)}` : ''}
${recent ? `Recent readings: ${recent}` : ''}
Context: RBA cash rate ${rba.cashRate.toFixed(2)}%; CPI ${au.cpi}% (${au.cpiPeriod}); unemployment ${au.unemployment}% (${au.unemploymentPeriod}).

Return JSON only:
{ "read": "2 sentences on what this reading says", "rbaAngle": "1 sentence on what it means for RBA policy" }`
  const out = await askClaudeJSON(prompt, { maxTokens: 300 })
  try { localStorage.setItem(cacheKey, JSON.stringify(out)) } catch { /* best-effort */ }
  return out
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Spark({ data, step }) {
  return (
    <div style={{ width: 80, height: 28 }}>
      <SafeChart width="100%" height="100%">
        <LineChart data={data}>
          <Line type={step ? 'stepAfter' : 'monotone'} dataKey="value" stroke="#C9A84C" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </SafeChart>
    </div>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold">{payload[0].value}</div>
    </div>
  )
}

function IndicatorCard({ ind, expanded, onToggle }) {
  const [c, setC] = useState({ status: 'idle', data: null })
  const delta = ind.value != null && ind.prev != null ? ind.value - ind.prev : null
  const worse = delta == null || delta === 0 ? null : ind.upIsBad ? delta > 0 : delta < 0
  const tone = worse == null ? '#8BA3C4' : worse ? '#CC4444' : '#2D8A50'

  const toggle = () => {
    onToggle()
    if (!expanded && c.status === 'idle') {
      setC({ status: 'loading', data: null })
      commentOn(ind).then((d) => setC({ status: 'ready', data: d })).catch(() => setC({ status: 'error', data: null }))
    }
  }

  return (
    <div className="border-t border-l border-terminal-border/60 -ml-px -mt-px">
      <button onClick={toggle} className="w-full text-left p-2.5 hover:bg-terminal-accent/10 transition-colors" aria-expanded={expanded}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs text-terminal-text-dim tracking-wide truncate">{ind.label}</span>
          {delta != null && delta !== 0 && <span className="text-2xs" style={{ color: tone }}>{delta > 0 ? '▲' : '▼'}</span>}
        </div>
        <div className="text-lg font-bold mt-0.5 text-terminal-text-bright tabular-nums">{fmt(ind, ind.value)}</div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[9px] text-terminal-text-dim/70 truncate">
            {ind.period}{ind.prev != null ? ` · prev ${fmt(ind, ind.prev)}` : ''}
          </span>
          {ind.series?.length > 2 ? <Spark data={ind.series.slice(-12)} step={ind.step} /> : <span className="text-[8px] text-terminal-text-dim/40">latest only</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-terminal-border/60 p-3 space-y-3">
          {ind.series?.length > 2 ? (
            <div style={{ height: 150 }}>
              <SafeChart width="100%" height="100%">
                <AreaChart data={ind.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 8 }} stroke="var(--t-text-dim)" domain={['auto', 'auto']} width={34} />
                  <Tooltip content={<ChartTip />} />
                  <Area type={ind.step ? 'stepAfter' : 'monotone'} dataKey="value" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} isAnimationActive={false} connectNulls />
                </AreaChart>
              </SafeChart>
            </div>
          ) : (
            <div className="text-2xs text-terminal-text-dim/70">No history series held for this indicator — the latest and previous published readings are shown above.</div>
          )}

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <div><div className="text-[9px] text-terminal-text-dim tracking-widest">SOURCE</div><div className="text-terminal-text">{ind.src}</div></div>
            <div><div className="text-[9px] text-terminal-text-dim tracking-widest">NEXT RELEASE</div><div className="text-terminal-text">{ind.next ? day(ind.next) : (ind.nextNote ?? '—')}</div></div>
            <div className="col-span-2"><div className="text-[9px] text-terminal-text-dim tracking-widest">CONTEXT</div><div className="text-terminal-text">{ind.hint}</div></div>
          </div>

          <div className="border border-terminal-border p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs text-terminal-gold font-bold tracking-widest">MADDENAI COMMENTARY</span>
              {c.status === 'ready' && <AIContentBadge source="live" />}
            </div>
            {c.status === 'loading' && <div className="text-2xs text-terminal-gold animate-pulse">Reading the latest print…</div>}
            {c.status === 'error' && <div className="text-2xs text-terminal-text-dim">Commentary unavailable right now.</div>}
            {c.status === 'ready' && c.data && (
              <div className="space-y-1">
                <div className="text-2xs text-terminal-text leading-relaxed">{c.data.read}</div>
                {c.data.rbaAngle && <div className="text-2xs text-terminal-text-dim italic leading-relaxed">{c.data.rbaAngle}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function IndicatorForecaster() {
  const [expandedKey, setExpandedKey] = useState(null)
  return (
    <div className="border border-terminal-border">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span>ECONOMIC DASHBOARD</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case tracking-normal">12 Australian indicators · published figures · click for history, release date and MaddenAI commentary</span>
        <span className="ml-auto text-2xs text-terminal-green/80">ABS · RBA · NAB</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {INDICATORS.map((ind) => (
          <IndicatorCard key={ind.key} ind={ind} expanded={expandedKey === ind.key} onToggle={() => setExpandedKey((k) => (k === ind.key ? null : ind.key))} />
        ))}
      </div>
      <div className="px-3 py-2 border-t border-terminal-border text-[9px] text-terminal-text-dim/60 leading-snug">
        Every value is a published reading held in the terminal&apos;s verified figures and checked against the agencies by the stats check. No
        consensus or forecast is shown — none is held. Commentary describes the readings; it does not predict the next one.
      </div>
    </div>
  )
}
