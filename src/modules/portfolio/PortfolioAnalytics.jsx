import { useMemo, useState } from 'react'
import { AreaChart, Area } from 'recharts'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS, getMockFMPRow, getMockFMPHistory } from '../../services/mockData'
import Tooltip from '../../components/ui/Tooltip'
import SafeChart from '../../components/ui/SafeChart'

const SECTOR_BY_SYMBOL = Object.fromEntries([
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, s]) => [sym.replace(/\.AX$/, ''), s.sector]),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, s]) => [sym, s.sector]),
])

// Illustrative betas by sector — same spirit as StressTest.jsx's own
// BETA_BY_SECTOR, kept as an independent copy here (small enough that
// exporting/sharing isn't worth coupling the two files together). Keys
// match mockData.js's actual sector strings exactly (verified against
// every sector value used there — Comms/Cons Disc/Energy/Financials/
// Health/Industrials/IT/Materials/Real Est/Staples/Utilities).
const BETA_BY_SECTOR = {
  Materials: 1.35, Financials: 1.10, Health: 0.75, 'Cons Disc': 1.25, Comms: 0.95,
  Industrials: 1.05, Staples: 0.55, Energy: 1.30, 'Real Est': 0.90, Utilities: 0.60, IT: 1.45,
}
const FACTOR_BY_SECTOR = {
  Materials: 'China demand · Iron ore',
  Financials: 'Domestic banking rates',
  Energy: 'Global oil & gas prices',
  'Cons Disc': 'Domestic consumer',
  Staples: 'Domestic consumer (defensive)',
  IT: 'Tech growth / global rates',
  Health: 'Defensive / healthcare demand',
  'Real Est': 'Domestic property & rates',
  Utilities: 'Rate-sensitive infrastructure',
  Comms: 'Domestic consumer / media',
  Industrials: 'Domestic economic activity',
}

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

// Opening value → each holding's $ contribution → currency effect →
// dividends → closing value, as a connected SVG waterfall — each bar
// starts where the running total left off, rather than every bar
// starting from zero like a plain bar chart would.
function WaterfallChart({ openingValue, bars, closingValue, fmtCur, totalReturn }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const W = 560, H = 170, padTop = 12, padBottom = 24, barGap = 6
  const steps = [
    { label: 'OPENING', delta: null, running: openingValue, kind: 'anchor' },
    ...bars,
    { label: 'CLOSING', delta: null, running: closingValue, kind: 'anchor' },
  ]
  const allValues = steps.flatMap((s) => s.kind === 'anchor' ? [0, s.running] : [s.runningBefore, s.runningAfter])
  const minV = Math.min(0, ...allValues)
  const maxV = Math.max(...allValues) * 1.08
  const usableH = H - padTop - padBottom
  const y = (v) => padTop + usableH - ((v - minV) / (maxV - minV || 1)) * usableH
  const barW = (W - barGap * (steps.length - 1)) / steps.length

  const colorFor = (s) => {
    if (s.kind === 'anchor') return '#8BA3C4'
    if (s.kind === 'currency') return '#2D7DD2'
    if (s.kind === 'dividend') return '#C9A84C'
    return s.delta >= 0 ? '#2D8A50' : '#A83232'
  }

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <line x1={0} y1={y(0)} x2={W} y2={y(0)} stroke="var(--t-border)" strokeDasharray="2 2" opacity={0.5} />
        {steps.map((s, i) => {
          const x = i * (barW + barGap)
          const top = s.kind === 'anchor' ? y(s.running) : y(Math.max(s.runningBefore, s.runningAfter))
          const bottom = s.kind === 'anchor' ? y(0) : y(Math.min(s.runningBefore, s.runningAfter))
          const height = Math.max(1, bottom - top)
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'default' }}>
              <rect x={x} y={top} width={barW} height={height} fill={colorFor(s)} opacity={hoverIdx === null || hoverIdx === i ? 0.9 : 0.35} />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={7} fill="var(--t-text-dim)" className="font-mono">
                {s.label.length > 8 ? `${s.label.slice(0, 7)}…` : s.label}
              </text>
              {hoverIdx === i && (
                <g>
                  <rect x={Math.min(Math.max(x - 20, 0), W - 100)} y={Math.max(top - 30, 0)} width={100} height={26} fill="var(--t-panel, #0B1628)" stroke="var(--mt-gold, #C9A84C)" strokeWidth={0.5} />
                  <text x={Math.min(Math.max(x - 20, 0), W - 100) + 6} y={Math.max(top - 30, 0) + 11} fontSize={7} fill="var(--t-text-bright)" className="font-mono">
                    {s.kind === 'anchor' ? fmtCur(s.running) : fmtCur(s.delta)}
                  </text>
                  {s.kind !== 'anchor' && totalReturn && (
                    <text x={Math.min(Math.max(x - 20, 0), W - 100) + 6} y={Math.max(top - 30, 0) + 20} fontSize={6} fill="var(--t-text-dim)" className="font-mono">
                      {((s.delta / totalReturn) * 100).toFixed(0)}% of return
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function PortfolioAnalytics({ holdings, mktTotal, fmtCur }) {
  const asxHoldings = useMemo(() => holdings.filter((h) => h.type === 'asx' && h.mktVal != null), [holdings])

  // ── 1. Risk metrics ──────────────────────────────────────────────────────
  const risk = useMemo(() => {
    if (!holdings.length || !mktTotal) return null
    const weighted = holdings.map((h) => {
      const weight = mktTotal ? (h.mktVal ?? 0) / mktTotal : 0
      const sector = SECTOR_BY_SYMBOL[h.symbol]
      const beta = BETA_BY_SECTOR[sector] ?? (h.type === 'crypto' ? 1.8 : 1.0)
      return { symbol: h.symbol, weight, beta, contribution: weight * beta }
    })
    const portfolioBeta = weighted.reduce((s, w) => s + w.contribution, 0)
    const topDrivers = [...weighted].sort((a, b) => b.contribution - a.contribution).slice(0, 3)

    // Volatility: annualised stdev of daily returns, weighted by position,
    // computed from each holding's own mock history.
    const volPerHolding = holdings.map((h) => {
      const hist = getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, 90)
      const closes = hist.map((d) => d.close)
      if (closes.length < 2) return { symbol: h.symbol, vol: 0.18 }
      const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i])
      const mean = rets.reduce((s, r) => s + r, 0) / rets.length
      const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
      return { symbol: h.symbol, vol: Math.sqrt(variance) * Math.sqrt(252) }
    })
    const portfolioVol = holdings.reduce((s, h, i) => {
      const weight = mktTotal ? (h.mktVal ?? 0) / mktTotal : 0
      return s + weight * (volPerHolding[i]?.vol ?? 0.18)
    }, 0)
    const asxVol = 0.142 // reference, matches the brief's example

    // Sharpe (very rough, illustrative): weighted since-purchase return / vol.
    const avgReturnPct = holdings.reduce((s, h) => {
      const weight = mktTotal ? (h.mktVal ?? 0) / mktTotal : 0
      return s + weight * ((h.pnlPct ?? 0) / 100)
    }, 0)
    const sharpe = portfolioVol > 0 ? avgReturnPct / portfolioVol : 0

    // Max drawdown: build a synthetic portfolio value series from each
    // holding's own mock history (aligned by index, same 90-day window).
    const days = 90
    const series = Array.from({ length: days }, () => 0)
    for (const h of holdings) {
      const hist = getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, days)
      hist.forEach((d, i) => { series[i] += d.close * h.shares })
    }
    let peak = series[0] ?? 0, peakIdx = 0, maxDD = 0, troughIdx = 0
    series.forEach((v, i) => {
      if (v > peak) { peak = v; peakIdx = i }
      const dd = peak > 0 ? (v - peak) / peak : 0
      if (dd < maxDD) { maxDD = dd; troughIdx = i }
    })
    const ddDate = new Date()
    ddDate.setDate(ddDate.getDate() - (days - peakIdx))
    const chartData = series.map((v, i) => ({ i, value: parseFloat(v.toFixed(0)) }))

    return { portfolioBeta, topDrivers, portfolioVol, asxVol, sharpe, maxDD, peakDate: ddDate, chartData, troughIdx }
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

  // ── 4. Sector / factor exposure ──────────────────────────────────────────
  const factorExposure = useMemo(() => {
    const bySector = {}
    for (const h of holdings) {
      if (h.mktVal == null) continue
      const sector = SECTOR_BY_SYMBOL[h.symbol] ?? 'Other'
      bySector[sector] = (bySector[sector] ?? 0) + h.mktVal
    }
    return Object.entries(bySector)
      .map(([sector, value]) => ({ sector, pct: mktTotal ? (value / mktTotal) * 100 : 0, factor: FACTOR_BY_SECTOR[sector] ?? 'General market' }))
      .sort((a, b) => b.pct - a.pct)
  }, [holdings, mktTotal])

  // ── 5. Performance attribution (illustrative, ~30D) ──────────────────────
  const attribution = useMemo(() => {
    const rows = holdings.filter((h) => h.mktVal != null).map((h) => {
      const hist = getMockFMPHistory(h.type === 'asx' ? `${h.symbol}.AX` : h.symbol, 30)
      const startClose = hist[0]?.close, endClose = hist[hist.length - 1]?.close
      const contribution = startClose && endClose ? (endClose - startClose) * h.shares : 0
      return { symbol: h.symbol, contribution }
    })
    const stockTotal = rows.reduce((s, r) => s + r.contribution, 0)
    const hasUS = holdings.some((h) => h.type === 'us' && h.mktVal != null)
    const currencyEffect = hasUS ? stockTotal * 0.015 : 0 // illustrative — no real historical FX series wired here
    const dividendsThisMonth = dividends.rows
      .filter((r) => r.months.includes(new Date().getMonth()))
      .reduce((s, r) => s + r.annualIncome / 2, 0)
    const total = stockTotal + currencyEffect + dividendsThisMonth
    return { rows: rows.filter((r) => Math.abs(r.contribution) > 0.01).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), currencyEffect, dividendsThisMonth, total }
  }, [holdings, dividends])

  if (!holdings.length) {
    return <div className="text-2xs text-terminal-text-dim/60 text-center py-10">Add holdings to see portfolio analytics.</div>
  }

  return (
    <div className="space-y-5 p-1">
      {/* 1. Risk metrics */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">RISK METRICS</div>
        {risk && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard
                label="PORTFOLIO BETA"
                value={risk.portfolioBeta.toFixed(2)}
                valueColor={risk.portfolioBeta > 1 ? 'text-terminal-red' : 'text-terminal-green'}
                sub={risk.portfolioBeta > 1 ? 'Higher risk than market' : 'Lower risk than market'}
                badge={risk.portfolioBeta > 1.3 ? 'High risk' : risk.portfolioBeta > 1.05 ? 'Moderate risk' : risk.portfolioBeta < 0.85 ? 'Defensive' : 'Market-like'}
                badgeTone={risk.portfolioBeta > 1.3 ? 'bad' : risk.portfolioBeta > 1.05 ? 'warn' : 'good'}
              />
              <MetricCard
                label="VOLATILITY (ANN.)"
                value={`${(risk.portfolioVol * 100).toFixed(1)}%`}
                valueColor={risk.portfolioVol > risk.asxVol ? 'text-terminal-gold' : 'text-terminal-green'}
                sub={`vs ASX 200: ${(risk.asxVol * 100).toFixed(1)}%`}
                badge={risk.portfolioVol > risk.asxVol * 1.25 ? 'Well above market' : risk.portfolioVol > risk.asxVol ? 'Above market' : 'At or below market'}
                badgeTone={risk.portfolioVol > risk.asxVol * 1.25 ? 'bad' : risk.portfolioVol > risk.asxVol ? 'warn' : 'good'}
              />
              <MetricCard
                label="SHARPE RATIO"
                value={risk.sharpe.toFixed(2)}
                valueColor={risk.sharpe >= 0.5 ? 'text-terminal-green' : 'text-terminal-gold'}
                sub={risk.sharpe >= 0.5 ? 'Acceptable risk-adjusted return' : 'Weak risk-adjusted return'}
                badge={risk.sharpe >= 1 ? 'Strong' : risk.sharpe >= 0.5 ? 'Acceptable' : risk.sharpe >= 0 ? 'Below average' : 'Negative'}
                badgeTone={risk.sharpe >= 1 ? 'good' : risk.sharpe >= 0.5 ? 'neutral' : risk.sharpe >= 0 ? 'warn' : 'bad'}
              />
              <MetricCard
                label="MAX DRAWDOWN"
                value={`${(risk.maxDD * 100).toFixed(1)}%`}
                valueColor="text-terminal-red"
                sub={`from peak ${risk.peakDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                badge={Math.abs(risk.maxDD) > 0.2 ? 'Severe' : Math.abs(risk.maxDD) > 0.1 ? 'Moderate' : 'Shallow'}
                badgeTone={Math.abs(risk.maxDD) > 0.2 ? 'bad' : Math.abs(risk.maxDD) > 0.1 ? 'warn' : 'good'}
              />
            </div>
            <div className="mt-2 text-2xs text-terminal-text-dim">
              Beta driven mainly by: {risk.topDrivers.map((d) => d.symbol).join(', ')}
            </div>
            <div className="border border-terminal-border p-2 mt-2" style={{ height: 120 }}>
              <SafeChart width="100%" height="100%">
                <AreaChart data={risk.chartData}>
                  <Area type="monotone" dataKey="value" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.15} isAnimationActive={false} />
                </AreaChart>
              </SafeChart>
            </div>
          </>
        )}
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

      {/* 3. Dividends */}
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

      {/* 4. Sector / factor exposure */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">FACTOR EXPOSURE</div>
        <div className="space-y-1.5">
          {factorExposure.map((f) => (
            <div key={f.sector} className="border border-terminal-border p-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold text-terminal-text-bright">{f.sector}</span>
                <span className="text-2xs text-terminal-gold font-bold">{f.pct.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-terminal-surface2 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-terminal-gold" style={{ width: `${f.pct}%` }} />
              </div>
              <div className="text-2xs text-terminal-text-dim mt-1">Factor exposure: {f.factor}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Performance attribution — connected waterfall: opening value →
          each holding's contribution → currency effect → dividends →
          closing value. */}
      <div>
        <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">RETURN ATTRIBUTION WATERFALL · LAST 30D</div>
        <div className="border border-terminal-border p-2">
          {(() => {
            const openingValue = mktTotal - attribution.total
            const steps = [
              ...attribution.rows.map((r) => ({ label: r.symbol, delta: r.contribution, kind: 'stock' })),
              { label: 'FX', delta: attribution.currencyEffect, kind: 'currency' },
              { label: 'DIVS', delta: attribution.dividendsThisMonth, kind: 'dividend' },
            ]
            const bars = steps.reduce((acc, step) => {
              const runningBefore = acc.length ? acc[acc.length - 1].runningAfter : openingValue
              return [...acc, { ...step, runningBefore, runningAfter: runningBefore + step.delta }]
            }, [])
            return (
              <WaterfallChart
                openingValue={openingValue}
                bars={bars}
                closingValue={mktTotal}
                fmtCur={fmtCur}
                totalReturn={attribution.total}
              />
            )
          })()}
          <div className="flex items-center gap-3 text-[9px] text-terminal-text-dim mt-1 flex-wrap">
            <span><span className="inline-block w-2 h-2 bg-[#8BA3C4] mr-1" />Opening/Closing</span>
            <span><span className="inline-block w-2 h-2 bg-[#2D8A50] mr-1" />Gain</span>
            <span><span className="inline-block w-2 h-2 bg-[#A83232] mr-1" />Loss</span>
            <span><span className="inline-block w-2 h-2 bg-[#2D7DD2] mr-1" />Currency</span>
            <span><span className="inline-block w-2 h-2 bg-[#C9A84C] mr-1" />Dividends</span>
          </div>
        </div>
        <div className="space-y-1 mt-2">
          {attribution.rows.map((r) => (
            <div key={r.symbol} className="flex justify-between text-2xs">
              <span className="text-terminal-text-dim">{r.symbol} contributed:</span>
              <span className={r.contribution >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>{fmtCur(r.contribution)}</span>
            </div>
          ))}
          <div className="flex justify-between text-2xs">
            <span className="text-terminal-text-dim">Currency (AUD/USD):</span>
            <span className={attribution.currencyEffect >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>{fmtCur(attribution.currencyEffect)}</span>
          </div>
          <div className="flex justify-between text-2xs">
            <span className="text-terminal-text-dim">Dividends received:</span>
            <span className="text-terminal-green">{fmtCur(attribution.dividendsThisMonth)}</span>
          </div>
          <div className="flex justify-between text-2xs border-t border-terminal-border pt-1 font-bold">
            <span className="text-terminal-text-bright">Total:</span>
            <span className={attribution.total >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>{fmtCur(attribution.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
