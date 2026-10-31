import { useMemo, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts'
import SafeChart from '../../components/ui/SafeChart'
import { buildSchedule } from '../../services/dividendSchedule'
import { fmt } from '../../utils/format'
import { auRecessionRisk } from '../../data/recessionRisk'
import { VERIFIED_CONSTANTS, pendingRbaDecision } from '../../data/verifiedConstants'
// One sector map, not three — sectorMap.js already exported this and this
// file kept its own byte-identical copy.
import { SECTOR_BY_SYMBOL } from './sectorMap'
import { portfolioRate } from './rateSensitivity'
import { RATE_LEVEL_STYLE } from '../../data/sectorTaxonomy'
import { AIContentBadge } from '../../components/ui/VerifiedBadge'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// DIVIDEND INCOME — a calendar year of estimated payments, Jan to Dec, with
// the four figures that matter under it. Every amount is arithmetic on each
// holding's trailing yield, placed in the months that company has paid in for
// years (dividendSchedule.js); nothing here is a declared dividend.
function DividendSection({ holdings, fmtCur }) {
  const sched = useMemo(() => buildSchedule(holdings), [holdings])
  const [nowMonth] = useState(() => new Date().getMonth())
  if (!sched.rows.length) {
    return (
      <div className="text-2xs text-terminal-text-dim/60 px-3 py-6 text-center">
        No holdings carry a dividend yield yet — add an income stock to see a schedule.
      </div>
    )
  }
  const year = MONTHS.map((label, i) => {
    const payers = sched.rows.filter((r) => r.months?.includes(i + 1))
    return { label, total: payers.reduce((s, r) => s + r.perPayment, 0), payers }
  })
  const unplaced = sched.rows.filter((r) => !r.months)
  const td = VERIFIED_CONSTANTS.au?.termDeposit1y

  return (
    <div className="space-y-3">
      <div style={{ height: 150 }}>
        <SafeChart width="100%" height="100%">
          <BarChart data={year} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#637899' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: '#4A6080' }} axisLine={false} tickLine={false} width={44}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v))} />
            <RTooltip
              cursor={{ fill: 'rgba(201,168,76,0.06)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const m = payload[0].payload
                return (
                  <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                    <div className="text-terminal-gold font-bold">{m.label} · {fmtCur(m.total)}</div>
                    {m.payers.length
                      ? m.payers.map((p) => <div key={p.symbol} className="text-terminal-text-dim">{p.symbol.replace(/\.AX$/i, '')} {fmtCur(p.perPayment)}</div>)
                      : <div className="text-terminal-text-dim">No scheduled payments</div>}
                  </div>
                )
              }}
            />
            <Bar dataKey="total" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {year.map((m, i) => (
                <Cell key={m.label} fill={i === nowMonth ? '#E8C766' : m.total > 0 ? 'rgba(201,168,76,0.6)' : 'rgba(201,168,76,0.1)'} />
              ))}
            </Bar>
          </BarChart>
        </SafeChart>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: 'rgba(201,168,76,0.12)' }}>
        {[
          ['ESTIMATED ANNUAL INCOME', fmtCur(sched.totalAnnual), '#C9A84C', `${fmtCur(sched.monthlyAverage)} a month on average`],
          ['YIELD ON COST', sched.yieldOnCost != null ? `${sched.yieldOnCost.toFixed(2)}%` : '—', '#2D8A50', 'Income ÷ what you paid'],
          ['YIELD ON VALUE', sched.yieldOnValue != null ? `${sched.yieldOnValue.toFixed(2)}%` : '—', null,
            sched.yieldOnValue != null && td != null ? `vs 1-yr term deposit ${td.toFixed(2)}% (RBA F4)` : 'Income ÷ value today'],
          ['EST. FRANKING CREDITS', fmtCur(sched.totalCredits), '#2D8A50', 'Per year, at the 30% company rate'],
        ].map(([label, value, tone, sub]) => (
          <div key={label} style={{ background: '#0B1628', padding: '10px 12px' }}>
            <div className="text-terminal-text-dim/60 tracking-wider" style={{ fontSize: 8 }}>{label}</div>
            <div className="font-mono font-bold tabular-nums mt-0.5" style={{ fontSize: 16, color: tone ?? '#E8EDF5' }}>{value}</div>
            <div className="text-terminal-text-dim/50 mt-0.5" style={{ fontSize: 8 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Per-holding, biggest contributor first. */}
      <div className="border border-terminal-border divide-y divide-terminal-border/50">
        {sched.rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-2xs font-bold text-terminal-text-bright w-14 flex-shrink-0">
              {r.symbol.replace(/\.AX$/i, '')}
            </span>
            <span className="text-2xs text-terminal-text-dim truncate flex-1 min-w-0">{r.note ?? 'Payment months not recorded'}</span>
            {r.franking != null && (
              <span className="badge flex-shrink-0" style={{
                color: r.franking >= 100 ? '#2D8A50' : r.franking > 0 ? '#C9A84C' : '#637899',
                border: `1px solid ${r.franking >= 100 ? 'rgba(45,138,80,0.4)' : r.franking > 0 ? 'rgba(201,168,76,0.4)' : 'rgba(99,120,153,0.3)'}`,
              }}>{r.franking}% FRANKED</span>
            )}
            <span className="text-2xs font-mono tabular-nums text-terminal-gold w-20 text-right flex-shrink-0">
              {fmtCur(r.annual)}/yr
            </span>
          </div>
        ))}
      </div>

      <div className="text-2xs text-terminal-text-dim/70 leading-relaxed px-1">
        Based on current holdings and published dividend yields. Actual dividends depend on company decisions and ex-dates.
        {unplaced.length > 0 && <> {unplaced.map((r) => r.symbol.replace(/\.AX$/i, '')).join(', ')} {unplaced.length === 1 ? 'is' : 'are'} counted in the annual total but not placed on the chart: {unplaced.length === 1 ? 'its' : 'their'} payment months are not recorded here.</>}
        {' '}Franking credits may be claimable as a tax offset — general information only, not tax advice.
      </div>
    </div>
  )
}

export default function PortfolioAnalytics({ holdings, mktTotal, fmtCur }) {

  // ── Regime alignment ─────────────────────────────────────────────────────
  //
  // The regime comes from the recession rubric in the Macro module, so the two
  // modules cannot describe the same economy differently. Sector reads are
  // MECHANISMS — how a sector connects to the current policy setting — not
  // backtested excess returns, which this app has no series to compute.
  const regime = useMemo(() => {
    const au = auRecessionRisk()
    const real = au.factors.find((f) => f.key === 'policy')
    const restrictive = (real?.points ?? 0) > 0

    const MECHANISMS = {
      Materials: { exposed: true, text: 'Earnings track commodity prices set offshore, so domestic rates reach them mainly through the currency.' },
      Energy: { exposed: true, text: 'Same offshore pricing, plus oil-linked contracts — largely insulated from the domestic cycle.' },
      Financials: { exposed: true, text: 'Margins widen with the cash rate but bad debts rise if unemployment follows. Cuts both ways.' },
      IT: { exposed: false, text: 'Long-duration earnings are the most sensitive to the discount rate — a restrictive setting compresses them hardest.' },
      'Cons Disc': { exposed: false, text: 'Mortgage repayments and discretionary spending come out of the same household budget.' },
      Staples: { exposed: true, text: 'Defensive demand; typically where money rotates when the labour market turns.' },
      Health: { exposed: true, text: 'Defensive, and largely USD-earning — domestic rates reach it only indirectly.' },
      'Real Est': { exposed: false, text: 'Directly rate-sensitive through both cap rates and financing costs.' },
      Utilities: { exposed: false, text: 'Bond-proxy earnings; competes with cash when the cash rate is high.' },
      Comms: { exposed: true, text: 'Mostly domestic and defensive, with steady subscription revenue.' },
      Industrials: { exposed: false, text: 'Tracks domestic activity, which slows when policy is restrictive.' },
    }

    const byWeight = new Map()
    for (const h of holdings) {
      const sector = SECTOR_BY_SYMBOL[h.symbol]
      if (!sector || !mktTotal) continue
      byWeight.set(sector, (byWeight.get(sector) ?? 0) + ((h.mktVal ?? 0) / mktTotal) * 100)
    }

    const sectorReads = [...byWeight.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sector, weight]) => ({
        sector,
        weight,
        exposed: MECHANISMS[sector]?.exposed ?? true,
        mechanism: MECHANISMS[sector]?.text ?? 'General domestic market exposure.',
      }))

    return {
      label: restrictive ? 'RESTRICTIVE POLICY' : 'ACCOMMODATIVE POLICY',
      score: au.score,
      realRate: real?.reading ?? '—',
      description: restrictive
        ? 'The cash rate sits above inflation, so policy is actively slowing the economy. Rate-sensitive and long-duration earnings face the most pressure; offshore-earning and defensive businesses are the least exposed to the domestic setting.'
        : 'The cash rate sits below inflation, so policy is still supporting activity. Rate-sensitive sectors face less pressure than they would in a restrictive setting.',
      sectorReads,
    }
  }, [holdings, mktTotal])

  // ── Factor tilts ─────────────────────────────────────────────────────────
  //
  // Cap-weighted portfolio fundamentals against the ASX 200's, from
  // verifiedConstants. Only holdings that actually carry the field contribute,
  // to BOTH the weighted average and its weight base — otherwise a portfolio
  // where half the positions lack a P/E would report the other half's average
  // as the whole book's, which is the same error that made the dashboard and
  // the portfolio page disagree earlier in this project.
  const factorTilts = useMemo(() => {
    if (!holdings.length || !mktTotal) return []

    const weightedAvg = (pick) => {
      let sum = 0, base = 0
      for (const h of holdings) {
        const v = pick(h)
        const w = h.mktVal ?? 0
        if (v == null || !Number.isFinite(v) || w <= 0) continue
        sum += v * w
        base += w
      }
      return base > 0 ? { value: sum / base, coverage: base / mktTotal } : null
    }

    const mktPE = VERIFIED_CONSTANTS.au.asx200PE
    const mktYield = VERIFIED_CONSTANTS.au.asx200DivYield

    const out = []

    // VALUE: a lower P/E than the market is a value tilt, so the sign is
    // inverted relative to the raw comparison.
    const pe = weightedAvg((h) => h.pe)
    if (pe && pe.coverage >= 0.4) {
      const rel = (mktPE - pe.value) / mktPE
      out.push({
        key: 'value',
        label: 'Value',
        tilt: Math.max(-1, Math.min(1, rel * 2)),
        direction: rel > 0.08 ? 'over' : rel < -0.08 ? 'under' : 'neutral',
        mineLabel: `${pe.value.toFixed(1)}x P/E`,
        marketLabel: `${mktPE}x`,
        note: rel > 0
          ? 'You hold cheaper earnings than the index on average. Value tilts have historically done better when rates rise.'
          : 'You pay more per dollar of earnings than the index. That is typical of growth-tilted books.',
      })
    }

    // YIELD
    const dy = weightedAvg((h) => h.divYield)
    if (dy && dy.coverage >= 0.4) {
      const rel = (dy.value - mktYield) / mktYield
      out.push({
        key: 'yield',
        label: 'Yield',
        tilt: Math.max(-1, Math.min(1, rel)),
        direction: rel > 0.08 ? 'over' : rel < -0.08 ? 'under' : 'neutral',
        mineLabel: `${dy.value.toFixed(2)}%`,
        marketLabel: `${mktYield}%`,
        note: rel > 0
          ? 'More income than the index, which usually means more of the return arrives as franked dividends rather than capital growth.'
          : 'Less income than the index — more of any return has to come from price.',
      })
    }

    // SIZE: median-ish comparison against a large-cap threshold rather than
    // against an index average this app does not hold.
    const cap = weightedAvg((h) => h.marketCap)
    if (cap && cap.coverage >= 0.4) {
      const LARGE = 50e9
      const rel = Math.log10(Math.max(cap.value, 1) / LARGE)
      out.push({
        key: 'size',
        label: 'Size (large cap)',
        tilt: Math.max(-1, Math.min(1, rel)),
        direction: rel > 0.1 ? 'over' : rel < -0.1 ? 'under' : 'neutral',
        // fmt.large, not fmtCur — a cap-weighted average market cap is in the
        // hundreds of billions, and the currency formatter rendered it as
        // "A$2,103,920,676,888.16", which is accurate and unreadable.
        mineLabel: fmt.large(cap.value),
        marketLabel: 'A$50B large-cap line',
        note: rel > 0
          ? 'Concentrated in large caps — typically steadier, and typically slower.'
          : 'Tilted below the large-cap line, which usually means more volatility in both directions.',
      })
    }

    return out
  }, [holdings, mktTotal])

  // ── 2. Concentration ─────────────────────────────────────────────────────
  const concentration = useMemo(() => {
    if (!holdings.length || !mktTotal) return null
    const weights = holdings.map((h) => (mktTotal ? (h.mktVal ?? 0) / mktTotal : 0))
    const hhi = weights.reduce((s, w) => s + w * w, 0) // 0 (fully diversified) .. 1 (single holding)
    const top = [...holdings].sort((a, b) => (b.mktVal ?? 0) - (a.mktVal ?? 0))[0]
    const topPct = top && mktTotal ? ((top.mktVal ?? 0) / mktTotal) * 100 : 0
    return { hhi, top, topPct }
  }, [holdings, mktTotal])

  if (!holdings.length) {
    return <div className="text-2xs text-terminal-text-dim/60 text-center py-10">Add holdings to see portfolio analytics.</div>
  }

  return (
    <div className="space-y-5 p-1">
      {/* Risk metrics, sector allocation and the return-attribution waterfall
          moved to the PERFORMANCE tab, where they sit under the benchmark
          chart they belong with. They were rendered here as well, so a reader
          comparing the two tabs met two Sharpe ratios and two waterfalls with
          no way to tell which was authoritative. This tab keeps what is
          distinctly its own: concentration, income, factor tilts and regime. */}
      <div className="text-2xs text-terminal-text-dim/50 border border-terminal-border/50 px-3 py-2">
        Risk metrics, sector allocation and return attribution are on the{' '}
        <span className="text-terminal-gold">PERFORMANCE</span> tab.
      </div>

      {/* 2. Concentration */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">PORTFOLIO CONCENTRATION RISK</div>
        {concentration && (
          <div className="border border-terminal-border p-3 space-y-2">
            <div className="text-2xs text-terminal-text">
              Top holding: <span className="font-bold text-terminal-text-bright">{concentration.top?.symbol}</span> — {concentration.topPct.toFixed(1)}% of portfolio
            </div>
            {concentration.topPct > 20 && (
              <div className="text-2xs text-terminal-red font-bold">HIGH CONCENTRATION — consider diversifying</div>
            )}
            <div>
              <div className="flex justify-between text-2xs text-terminal-text-dim mb-0.5">
                <span>DIVERSIFIED</span><span>CONCENTRATED</span>
              </div>
              <div className="relative h-2 bg-terminal-surface2 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-terminal-green via-terminal-gold to-terminal-red" style={{ width: '100%' }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-terminal-text-bright" style={{ left: `${Math.min(97, concentration.hhi * 100)}%` }} />
              </div>
              <div className="text-2xs text-terminal-text-dim/70 mt-0.5">Herfindahl Index: {concentration.hhi.toFixed(2)}</div>
            </div>
            <div className="text-2xs text-terminal-text-dim italic">No single stock should exceed 20% of portfolio for a balanced risk profile.</div>
          </div>
        )}
      </div>

      {/* 3a. Dividend schedule — when the income actually arrives, and what
             it is worth against cost and against current value. Sits above the
             existing yield analysis because "when do I get paid" is the
             question people open this tab with. */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">DIVIDEND INCOME</div>
        <DividendSection holdings={holdings} fmtCur={fmtCur} />
      </div>

      {/* 4. Factor tilts — MEASURED, not asserted */}
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">FACTOR TILTS VS MARKET</span>
          <span className="text-2xs text-terminal-text-dim/60">DEMO fundamentals</span>
        </div>

        {factorTilts.length === 0 ? (
          <div className="border border-terminal-border p-3 text-2xs text-terminal-text-dim">
            No holdings with the fundamentals needed to measure a tilt.
          </div>
        ) : (
          <div className="border border-terminal-border divide-y divide-terminal-border/30">
            {factorTilts.map((f) => {
              // Centre line at 50%; the marker moves either side of it.
              const offset = 50 + Math.max(-50, Math.min(50, f.tilt * 50))
              return (
                <div key={f.key} className="p-2.5">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-2xs font-bold text-terminal-text-bright">{f.label}</span>
                    <span
                      className="text-2xs font-bold tabular-nums"
                      style={{ color: f.direction === 'over' ? '#2D8A50' : f.direction === 'under' ? '#A83232' : '#637899' }}
                    >
                      {f.direction === 'over' ? '▲ OVERWEIGHT' : f.direction === 'under' ? '▼ UNDERWEIGHT' : '→ NEUTRAL'}
                    </span>
                  </div>

                  <div className="relative h-2 mb-1">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-terminal-border/50" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-terminal-text-dim/40" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                      style={{ left: `${offset}%`, background: '#C9A84C' }}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-2 text-2xs">
                    <span className="text-terminal-text-dim">
                      Yours <span className="text-terminal-text-bright">{f.mineLabel}</span>
                      {' · '}Market <span className="text-terminal-text-bright">{f.marketLabel}</span>
                    </span>
                  </div>
                  <div className="text-2xs text-terminal-text-dim/70 leading-snug mt-0.5">{f.note}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* WHY THIS IS A TILT AND NOT A FACTOR LOADING.
            A real factor exposure is a regression coefficient against a factor
            return series. This app has neither the factor returns nor a price
            history to regress, so a "+0.8 Value loading" would be a precise
            number with nothing behind it. What IS computable is the portfolio's
            weighted fundamentals against the market's — a comparison, stated as
            a comparison, with both sides shown so the reader can see the
            arithmetic. */}
        <div className="text-2xs text-terminal-text-dim/60 mt-2 leading-relaxed">
          Measured by comparing your cap-weighted fundamentals with the ASX 200's, not by
          regression against factor returns — this app holds neither the factor series nor the
          price history that would need. Both sides of each comparison are shown. Equity
          fundamentals are DEMO until a data provider is connected.
        </div>
      </div>

      {/* Regime alignment */}
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">POSITIONING VS THE CURRENT REGIME</span>
          <span className="text-2xs text-terminal-text-dim/60">from the recession rubric</span>
        </div>
        <div className="border border-terminal-border p-3 space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xs text-terminal-text-dim">Regime:</span>
            <span className="text-2xs font-bold text-terminal-text-bright">{regime.label}</span>
            <span className="text-2xs text-terminal-text-dim">
              · AU risk score {regime.score}/100 · real policy rate {regime.realRate}
            </span>
          </div>

          <div className="text-2xs text-terminal-text leading-relaxed">{regime.description}</div>

          <div className="pt-2 border-t border-terminal-border/40 space-y-1.5">
            {regime.sectorReads.map((r) => (
              <div key={r.sector} className="flex items-start gap-2">
                <span
                  className="text-2xs font-bold flex-shrink-0 w-16"
                  style={{ color: r.exposed ? '#C9A84C' : '#637899' }}
                >{r.weight.toFixed(0)}%</span>
                <span className="text-2xs font-bold text-terminal-text-bright w-20 flex-shrink-0">{r.sector}</span>
                <span className="text-2xs text-terminal-text-dim flex-1 leading-snug">{r.mechanism}</span>
              </div>
            ))}
          </div>

          {/* NO FABRICATED EXCESS RETURNS.
              The design asked for "Energy: +2.1% avg excess return in
              tightening regimes". That is a backtest result, and this app has
              neither the historical sector series nor the regime dating to
              produce one — the figure would be invented, and it is exactly the
              sort a reader would size a position against. What is stated
              instead is the MECHANISM connecting each sector to the current
              setting, which is structural and checkable, plus the weight the
              portfolio actually carries. */}
          <div className="text-2xs text-terminal-text-dim/60 pt-2 border-t border-terminal-border/30 leading-relaxed">
            Mechanisms, not backtests. This shows how each sector connects to the current
            policy setting and what you hold in it — no historical excess-return figures,
            because this terminal holds neither the sector series nor the regime dating that
            would take. General information only.
          </div>
        </div>
      </div>

      <RateSensitivitySection holdings={holdings} fmtCur={fmtCur} />

    </div>
  )
}

// ── Rate sensitivity ─────────────────────────────────────────────────────────
//
// Each holding's sensitivity to rising rates and its estimated move if the RBA
// hikes 25bp, from the shared sector table (sectorTaxonomy.RATE_SENSITIVITY,
// via ./rateSensitivity) — the same assumptions the stress test's RBA
// scenario and the Markets heatmap use. Sector-level ESTIMATES: the table
// header says so, and the dollar column is the estimate applied to the
// holding's value, nothing more.
function RateSensitivitySection({ holdings, fmtCur }) {
  const pr = useMemo(() => portfolioRate(holdings), [holdings])
  if (!pr) return null
  const nd = pendingRbaDecision()
  const hikeTo = nd?.hikeRate != null ? `${nd.hikeRate.toFixed(2)}%` : null
  const tone = RATE_LEVEL_STYLE[pr.rating]?.colour ?? '#8BA3C4'
  const topText = pr.top.map(([s, w]) => `${s} (${Math.round(w * 100)}%)`).join(' and ')
  const verdict = {
    POSITIVE: 'tends to benefit from rising rates — banks\' margins outweigh the pressure elsewhere',
    LOW: 'has LOW rate sensitivity — little of it is in the sectors a hike hits hardest',
    MEDIUM: 'has MEDIUM rate sensitivity — a meaningful share sits in rate-exposed sectors',
    HIGH: 'has HIGH rate sensitivity — rate-exposed sectors dominate it',
  }[pr.rating]
  const sorted = [...pr.rows].sort((a, b) => b.h.mktVal - a.h.mktVal)
  const fmtShock = (v) => (Math.abs(v) < 0.05 ? 'Minimal' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">RATE SENSITIVITY ANALYSIS</span>
        <AIContentBadge source="fallback" label="ESTIMATE" />
      </div>
      <div className="border border-terminal-border p-3 space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xs text-terminal-text-dim">Overall:</span>
          <span className="text-xs font-bold" style={{ color: tone }}>{pr.rating}</span>
          <span className="text-2xs text-terminal-text-dim">
            · est. {pr.shock >= 0 ? '+' : ''}{pr.shock.toFixed(1)}% ({pr.shock >= 0 ? '+' : '−'}{fmtCur(Math.abs(pr.total * pr.shock / 100))}) if the RBA hikes 25bp
          </span>
        </div>
        <div className="text-2xs text-terminal-text leading-relaxed">
          Your portfolio {verdict}. {topText ? `${topText} carry the most weight.` : ''}
        </div>

        <div>
          <div className="text-2xs text-terminal-text-dim tracking-widest mb-1">
            SIMULATED IMPACT: {hikeTo ? `RBA HIKES TO ${hikeTo}` : 'A 25BP RBA HIKE'}
          </div>
          <table className="w-full text-2xs">
            <thead>
              <tr className="text-terminal-text-dim/70 text-left">
                <th className="font-normal py-1">HOLDING</th>
                <th className="font-normal">SECTOR</th>
                <th className="font-normal">RATE SENSITIVITY</th>
                <th className="font-normal text-right">EST. IMPACT</th>
                <th className="font-normal text-right hidden sm:table-cell">VALUE</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ h, r }) => {
                const st = RATE_LEVEL_STYLE[r.level]
                return (
                  <tr key={h.id ?? h.symbol} className="border-t border-terminal-border/30" title={r.why}>
                    <td className="py-1 font-bold text-terminal-text-bright">{h.symbol}</td>
                    <td className="text-terminal-text-dim">{r.sector}</td>
                    <td className="font-bold" style={{ color: st?.colour ?? '#637899' }}>{st?.label ?? '—'}</td>
                    <td className="text-right tabular-nums" style={{ color: r.shock > 0.05 ? 'var(--color-gain)' : r.shock < -0.05 ? 'var(--color-loss)' : undefined }}>{fmtShock(r.shock)}</td>
                    <td className="text-right tabular-nums text-terminal-text-dim hidden sm:table-cell">
                      {Math.abs(r.shock) < 0.05 ? '—' : `${r.shock > 0 ? '+' : '−'}${fmtCur(Math.abs(h.mktVal * r.shock / 100))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="text-2xs text-terminal-text-dim/60 pt-2 border-t border-terminal-border/30 leading-relaxed">
          Estimates only, from each holding&apos;s sector: the typical direction of the relationship with an assumed size,
          not a forecast or a backtest. Broad Australian ETFs are treated as the ASX 200&apos;s sector mix (approximate);
          offshore holdings are affected mainly through the AUD. Hover a row for the mechanism. General information, not advice.
        </div>
      </div>
    </div>
  )
}
