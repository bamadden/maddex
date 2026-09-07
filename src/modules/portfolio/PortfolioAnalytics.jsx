import { useMemo } from 'react'
import { buildSchedule } from '../../services/dividendSchedule'
import { fmt } from '../../utils/format'
import { auRecessionRisk } from '../../data/recessionRisk'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { getMockFMPRow } from '../../services/mockData'
// One sector map, not three — sectorMap.js already exported this and this
// file kept its own byte-identical copy.
import { SECTOR_BY_SYMBOL } from './sectorMap'
import Tooltip from '../../components/ui/Tooltip'

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Verdict tints for the badge. A metric card's number means nothing to most
// readers without a judgement attached — 1.24 beta is only "high" if you
// already know what typical is — so each card states its own reading.
const BADGE_TONE = {
  good:    { bg: 'rgba(45,138,80,0.15)',  fg: '#2D8A50' },
  neutral: { bg: 'rgba(201,168,76,0.15)', fg: '#C9A84C' },
  warn:    { bg: 'rgba(214,158,46,0.15)', fg: '#D69E2E' },
  bad:     { bg: 'rgba(168,50,50,0.15)',  fg: '#A83232' },
}

function MetricCard({ label, value, valueColor, sub, badge, badgeTone = 'neutral', children }) {
  const tone = BADGE_TONE[badgeTone] ?? BADGE_TONE.neutral
  return (
    <div className="border border-terminal-border p-3 flex flex-col">
      <div className="text-2xs text-terminal-text-dim tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${valueColor ?? 'text-terminal-text-bright'}`}>{value}</div>
      {sub && <div className="text-2xs text-terminal-text-dim mt-0.5">{sub}</div>}
      {badge && (
        <span
          className="mt-2 self-start text-[9px] font-mono font-bold tracking-widest uppercase"
          style={{ background: tone.bg, color: tone.fg, borderRadius: 2, padding: '2px 6px' }}
        >
          {badge}
        </span>
      )}
      {children}
    </div>
  )
}

function DividendSection({ holdings, fmtCur }) {
  const sched = useMemo(() => buildSchedule(holdings), [holdings])
  if (!sched.rows.length) {
    return (
      <div className="text-2xs text-terminal-text-dim/60 px-3 py-6 text-center">
        No holdings carry a dividend yield yet — add an income stock to see a schedule.
      </div>
    )
  }
  const maxMonth = Math.max(...sched.calendar.map((c) => c.total), 1)

  return (
    <div className="space-y-3">
      {/* Four numbers, because they answer four different questions: how much,
          how often, how it compares to what you paid, and how it compares to
          what it is worth now. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: 'rgba(201,168,76,0.12)' }}>
        {[
          ['EST. ANNUAL INCOME', fmtCur(sched.totalAnnual), '#C9A84C'],
          ['MONTHLY AVERAGE', fmtCur(sched.monthlyAverage), null],
          ['YIELD ON VALUE', sched.yieldOnValue != null ? `${sched.yieldOnValue.toFixed(2)}%` : '—', null],
          ['YIELD ON COST', sched.yieldOnCost != null ? `${sched.yieldOnCost.toFixed(2)}%` : '—', '#2D8A50'],
        ].map(([label, value, tone]) => (
          <div key={label} style={{ background: '#0B1628', padding: '10px 12px' }}>
            <div className="text-2xs text-terminal-text-dim/60 tracking-wider" style={{ fontSize: 8 }}>{label}</div>
            <div className="font-mono font-bold tabular-nums mt-0.5" style={{ fontSize: 16, color: tone ?? '#E8EDF5' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Twelve months forward from this one, not from January — the question
          is "what is coming", not "what does a calendar year look like". */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">NEXT 12 MONTHS</div>
        <div className="flex items-end gap-1" style={{ height: 72 }}>
          {sched.calendar.map((c, i) => (
            <div key={`${c.month}-${i}`} className="flex-1 flex flex-col items-center justify-end min-w-0"
              title={c.payers.length ? `${c.label}: ${c.payers.map((p) => p.symbol.replace(/\.AX$/i, '')).join(', ')} — ${fmtCur(c.total)}` : `${c.label}: no scheduled payments`}>
              <div className="w-full" style={{
                height: `${Math.max(c.total > 0 ? 6 : 2, (c.total / maxMonth) * 52)}px`,
                background: c.total > 0 ? 'rgba(201,168,76,0.55)' : 'rgba(201,168,76,0.08)',
              }} />
              <div className="text-2xs text-terminal-text-dim/50 mt-1" style={{ fontSize: 8 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-holding, biggest contributor first. */}
      <div className="border border-terminal-border divide-y divide-terminal-border/50">
        {sched.rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-2xs font-bold text-terminal-text-bright w-14 flex-shrink-0">
              {r.symbol.replace(/\.AX$/i, '')}
            </span>
            <span className="text-2xs text-terminal-text-dim truncate flex-1 min-w-0">{r.note ?? '—'}</span>
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

      {sched.totalCredits > 0 && (
        <div className="text-2xs text-terminal-text-dim leading-relaxed px-1">
          <span className="text-terminal-green font-bold">Est. franking credits: {fmtCur(sched.totalCredits)}/year.</span>
          {' '}Franking credits attach to dividends already taxed at the company rate and may be claimable
          as a tax offset. Figures here are arithmetic on each holding&rsquo;s trailing yield, not a forecast
          of future dividends — general information only, not tax advice.
        </div>
      )}
    </div>
  )
}

export default function PortfolioAnalytics({ holdings, mktTotal, fmtCur }) {
  const asxHoldings = useMemo(() => holdings.filter((h) => h.type === 'asx' && h.mktVal != null), [holdings])

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

  // ── 3. Dividends ─────────────────────────────────────────────────────────
  const dividends = useMemo(() => {
    const rows = asxHoldings.map((h) => {
      const q = getMockFMPRow(`${h.symbol}.AX`)
      const yieldPct = q?.dividendYield ?? 0
      const annualIncome = (h.mktVal ?? 0) * (yieldPct / 100)
      const rng = mulberry32(hashStr(`div_${h.symbol}`))
      // Most ASX blue chips pay semi-annually — assign a deterministic pair
      // of payment months per stock rather than a single real calendar.
      const m1 = Math.floor(rng() * 12)
      const m2 = (m1 + 6) % 12
      return { symbol: h.symbol, yieldPct, annualIncome, months: [m1, m2], price: h.last }
    }).filter((r) => r.yieldPct > 0)

    const totalIncome = rows.reduce((s, r) => s + r.annualIncome, 0)
    const portfolioYield = mktTotal ? (totalIncome / mktTotal) * 100 : 0

    const now = new Date()
    let next = null
    for (let offset = 0; offset < 12; offset++) {
      const month = (now.getMonth() + offset) % 12
      const hit = rows.find((r) => r.months.includes(month) && (offset > 0 || month !== now.getMonth()))
      if (hit) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 15)
        const days = Math.max(0, Math.round((targetDate - now) / 86400000))
        next = { ...hit, days, estPerShare: hit.price ? (hit.price * (hit.yieldPct / 100)) / 2 : null }
        break
      }
    }

    return { rows, totalIncome, portfolioYield, next }
  }, [asxHoldings, mktTotal])

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
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">DIVIDEND SCHEDULE</div>
        <DividendSection holdings={holdings} fmtCur={fmtCur} />
      </div>

      {/* 3b. Dividends */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">DIVIDEND ANALYSIS</div>
        {dividends.rows.length === 0 ? (
          <div className="text-2xs text-terminal-text-dim/60 border border-terminal-border p-2.5">No dividend-paying ASX holdings.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              <MetricCard label="ANNUAL DIVIDEND INCOME" value={fmtCur(dividends.totalIncome)} />
              <MetricCard
                label="PORTFOLIO YIELD"
                value={`${dividends.portfolioYield.toFixed(2)}%`}
                valueColor={dividends.portfolioYield > 4.5 ? 'text-terminal-green' : 'text-terminal-gold'}
                sub={`vs term deposit 4.5% (${dividends.portfolioYield > 4.5 ? 'higher' : 'lower'})`}
              />
              {dividends.next && (
                <MetricCard
                  label="NEXT DIVIDEND"
                  value={dividends.next.symbol}
                  sub={`~${fmtCur(dividends.next.estPerShare)}/share · in ${dividends.next.days} days`}
                />
              )}
            </div>
            <div className="border border-terminal-border p-2.5">
              <div className="text-2xs text-terminal-text-dim mb-1.5">DIVIDEND CALENDAR</div>
              {/* One dot per payer rather than a comma-joined ticker list: the
                  shape of the year — which months are heavy, which are empty —
                  is the thing worth seeing at a glance, and a row of dots
                  carries that where run-together text does not. Detail moves
                  to the hover. */}
              <div className="grid grid-cols-6 xl:grid-cols-12 gap-1">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
                  const payers = dividends.rows.filter((r) => r.months.includes(i))
                  const isCurrent = i === new Date().getMonth()
                  return (
                    <div
                      key={m}
                      className="text-center rounded-[2px] py-1"
                      style={isCurrent ? { background: 'rgba(201,168,76,0.07)' } : undefined}
                    >
                      <div className={`text-[9px] font-mono ${isCurrent ? 'text-terminal-gold' : 'text-terminal-text-dim/70'}`}>{m}</div>
                      <div className="flex items-center justify-center gap-1 flex-wrap mt-1 min-h-[10px]">
                        {payers.length === 0 && <span className="text-terminal-text-dim/25 text-[9px]">·</span>}
                        {payers.map((p) => (
                          <Tooltip
                            key={p.symbol}
                            content={
                              `${p.symbol}\n` +
                              `Yield:      ${p.yieldPct.toFixed(2)}%\n` +
                              `Est. payout: ${fmtCur(p.annualIncome / 2)}\n` +
                              `Month:      ${m}`
                            }
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-gold cursor-default" />
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
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

    </div>
  )
}
