import { useMemo, useState } from 'react'
import {
  BOND_MARKETS, BOND_CURVES, curveStats, priceFromYield, durationOf, dv01, ytm,
} from '../../data/bondCurves'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { useBondYields } from './useBondYields'
import ModuleHeader from '../../components/ui/ModuleHeader'
import Tooltip from '../../components/ui/Tooltip'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'

// ─── Bonds ──────────────────────────────────────────────────────────────────
//
// The full maturity spectrum, 1M to 50Y, for five sovereign markets — which is
// the point of the module. A retail investor sees a 10-year yield quoted
// constantly and almost never sees the shape of the whole curve it sits on.
//
// Everything here is INDICATIVE and says so. The one figure that is not is the
// CPI used for the real-yield column, which comes from verifiedConstants.

const TERM_TONE = (years) =>
  years < 2 ? '#4A7FB5' : years <= 10 ? '#C9A84C' : years <= 30 ? '#a855f7' : '#8BA3C4'

const SHAPE_TONE = {
  NORMAL: '#2D8A50', FLAT: '#C9A84C', INVERTED: '#CC4444', HUMPED: '#a855f7', '—': '#637899',
}

const bp = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}bp`

// ─── Yield curve chart ──────────────────────────────────────────────────────

function CurveChart({ series, hover, onHover, onPick }) {
  const W = 900, H = 240, padL = 42, padR = 16, padT = 14, padB = 26

  const all = series.flatMap((s) => s.rows)
  if (!all.length) return null
  const minY = Math.min(...all.map((r) => r.yield))
  const maxY = Math.max(...all.map((r) => r.yield))
  const span = (maxY - minY) || 1
  const lo = minY - span * 0.12
  const hi = maxY + span * 0.12

  // Log scale on maturity. Linear puts 1M through 1Y inside three pixels and
  // spends half the chart on the 30-to-50 year stretch where nothing happens —
  // the short end is where policy actually shows up.
  const minL = Math.log(1 / 12)
  const maxL = Math.log(50)
  const x = (years) => padL + ((Math.log(years) - minL) / (maxL - minL)) * (W - padL - padR)
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)

  const TICKS = [['1M', 1 / 12], ['3M', 0.25], ['1Y', 1], ['2Y', 2], ['5Y', 5], ['10Y', 10], ['20Y', 20], ['30Y', 30], ['50Y', 50]]

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const primary = series.find((s) => s.primary) ?? series[0]
    let best = null
    for (const r of primary.rows) {
      const d = Math.abs(x(r.years) - px)
      if (!best || d < best.d) best = { d, row: r, market: primary.key }
    }
    onHover(best && best.d < 40 ? best : null)
  }

  return (
    <svg
      width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}
      onMouseMove={onMove} onMouseLeave={() => onHover(null)}
      onClick={() => hover && onPick(hover.row)}
    >
      {[lo, (lo + hi) / 2, hi].map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#0F1E35" />
          <text x={6} y={y(v) + 3} fill="#4A6080" style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}>
            {v.toFixed(2)}%
          </text>
        </g>
      ))}
      {TICKS.map(([label, yrs]) => (
        <text key={label} x={x(yrs)} y={H - 8} textAnchor="middle" fill="#4A6080"
          style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}>{label}</text>
      ))}

      {series.map((s) => (
        <g key={s.key}>
          <polyline
            points={s.rows.map((r) => `${x(r.years)},${y(r.yield)}`).join(' ')}
            fill="none" stroke={s.colour}
            strokeWidth={s.primary ? 2 : 1}
            strokeOpacity={s.primary ? 1 : 0.45}
            strokeLinejoin="round"
          />
          {s.primary && s.rows.map((r) => (
            <circle key={r.maturity} cx={x(r.years)} cy={y(r.yield)} r={r.indicative ? 2 : 2.8}
              fill={s.colour} fillOpacity={r.indicative ? 0.4 : 1} />
          ))}
        </g>
      ))}

      {hover && (
        <>
          <line x1={x(hover.row.years)} x2={x(hover.row.years)} y1={padT} y2={H - padB}
            stroke="#C9A84C" strokeOpacity={0.4} />
          <circle cx={x(hover.row.years)} cy={y(hover.row.yield)} r={5} fill="#C9A84C" />
        </>
      )}
    </svg>
  )
}

// ─── Detail panel ───────────────────────────────────────────────────────────

function timeToMaturity(years) {
  const now = new Date()
  const end = new Date(now.getTime() + years * 365.25 * 86400000)
  const totalDays = Math.round((end - now) / 86400000)
  const y = Math.floor(totalDays / 365.25)
  const remAfterYears = totalDays - Math.floor(y * 365.25)
  const m = Math.floor(remAfterYears / 30.44)
  const d = Math.round(remAfterYears - m * 30.44)
  return { date: end, totalDays, y, m, d }
}

function BondDetail({ market, row, onClose }) {
  const t = timeToMaturity(row.years)
  const price = priceFromYield(row.coupon, row.yield, row.years)
  const dur = durationOf(row.coupon, row.yield, row.years)
  const dv = dv01(row.coupon, row.yield, row.years, 10000)
  const cpi = VERIFIED_CONSTANTS.au.cpi
  const realYield = row.yield - cpi

  const stat = (label, value, tip) => (
    <div>
      <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</div>
      {tip ? (
        <Tooltip content={tip}>
          <div className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 12 }}>{value}</div>
        </Tooltip>
      ) : (
        <div className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 12 }}>{value}</div>
      )}
    </div>
  )

  return (
    <div className="border-t border-terminal-border" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="font-mono font-bold text-terminal-gold tracking-widest" style={{ fontSize: 11 }}>
            {market.flag} {market.label} {row.maturity} {row.type}
          </span>
          <span className="font-mono font-bold text-terminal-gold tabular-nums" style={{ fontSize: 18 }}>
            {row.yield.toFixed(3)}%
          </span>
          {row.indicative && (
            <Tooltip content="Ultra-long bonds are thinly traded. Yields at these maturities are market estimates even in the real market, and this whole curve is indicative.">
              <span className="font-mono text-terminal-text-dim/60 italic" style={{ fontSize: 9 }}>INDICATIVE</span>
            </Tooltip>
          )}
          <button onClick={onClose} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">✕ CLOSE</button>
        </div>

        {/* THE POINT OF THE PANEL. A 30-year bond is a thirty-year decision and
            "30Y" does not read like one. The exact remaining term does. */}
        <div className="mb-3">
          <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
            TIME TO MATURITY
          </div>
          <div className="font-mono font-bold text-terminal-gold" style={{ fontSize: 20, letterSpacing: '0.04em' }}>
            {t.y} {t.y === 1 ? 'YEAR' : 'YEARS'} · {t.m} {t.m === 1 ? 'MONTH' : 'MONTHS'} · {t.d} {t.d === 1 ? 'DAY' : 'DAYS'}
          </div>
          <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 9 }}>
            {t.totalDays.toLocaleString()} days · matures {t.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {stat('COUPON', row.coupon ? `${row.coupon.toFixed(2)}%` : 'ZERO', row.coupon ? 'Annual coupon per 100 face.' : 'Bills are issued at a discount and pay no coupon.')}
          {stat('PRICE / 100', price.toFixed(2), 'Present value of the remaining coupons plus face, discounted at the yield. Below 100 means the coupon is under the market yield.')}
          {stat('MOD. DURATION', row.years < 1 ? '—' : `${dur.modified.toFixed(2)}y`, 'Macaulay duration ÷ (1 + y). Approximate price move for a 1% change in yield.')}
          {stat('CONVEXITY', row.years < 1 ? '—' : dur.convexity.toFixed(1), 'The curvature duration alone misses — why a long bond gains more on a rate fall than it loses on an equal rate rise.')}
          {stat('DV01 / A$10K', `A$${dv.toFixed(2)}`, 'Dollar value of one basis point: what a A$10,000 holding gains or loses if the yield moves 0.01%.')}
          {stat('REAL YIELD', `${realYield >= 0 ? '+' : ''}${realYield.toFixed(2)}%`, `Nominal yield minus AU CPI of ${cpi}% (${VERIFIED_CONSTANTS.au.cpiPeriod}). Positive means the bond beats inflation before tax.`)}
          {stat('VS CASH', `${(row.yield - VERIFIED_CONSTANTS.rba.cashRate) >= 0 ? '+' : ''}${(row.yield - VERIFIED_CONSTANTS.rba.cashRate).toFixed(2)}%`, `Against the RBA cash rate of ${VERIFIED_CONSTANTS.rba.cashRate}%.`)}
          {stat('ISSUER', market.issuer)}
        </div>

        <button
          onClick={() => dispatchAskAI({
            name: `${market.label} ${row.maturity} government bond`,
            sector: 'Fixed income', date: todayAEST(),
            instruction: `Explain the ${market.label} ${row.maturity} government bond yielding ${row.yield.toFixed(2)}% and what it means for an Australian investor compared with cash at ${VERIFIED_CONSTANTS.rba.cashRate}% and equities. AU CPI is ${cpi}%. Do not state any figure I have not given you.`,
          })}
          className="text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1"
        >ASK MADDENAI ▶</button>
      </div>
    </div>
  )
}

// ─── Bond calculator ────────────────────────────────────────────────────────

function BondCalculator() {
  const [face, setFace] = useState('1000')
  const [coupon, setCoupon] = useState('4.5')
  const [years, setYears] = useState('10')
  const [price, setPrice] = useState('980')

  const out = useMemo(() => {
    const f = parseFloat(face), c = parseFloat(coupon), n = parseFloat(years), p = parseFloat(price)
    if (![f, c, n, p].every(Number.isFinite) || f <= 0 || n <= 0 || p <= 0) return null
    const solved = ytm(f, c, n, p)
    const currentYield = ((c / 100) * f) / p * 100
    const dur = durationOf(c, solved.ytm, n)
    const dvv = dv01(c, solved.ytm, n, f)
    return { ...solved, currentYield, dur, dvv, f, c, n, p }
  }, [face, coupon, years, price])

  const field = (label, value, set, suffix) => (
    <label className="block">
      <span className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <input
          type="number" value={value} onChange={(e) => set(e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-2xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono tabular-nums"
        />
        {suffix && <span className="font-mono text-terminal-text-dim/50" style={{ fontSize: 9 }}>{suffix}</span>}
      </div>
    </label>
  )

  const res = (label, value, tip) => (
    <Tooltip content={tip}>
      <div className="border border-terminal-border px-2 py-1.5">
        <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>{label}</div>
        <div className="font-mono font-bold text-terminal-gold tabular-nums" style={{ fontSize: 14 }}>{value}</div>
      </div>
    </Tooltip>
  )

  return (
    <div className="border-t border-terminal-border">
      <div className="panel-header flex items-center gap-2">
        <span>BOND CALCULATOR</span>
        <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">
          arithmetic, not an estimate — updates as you type
        </span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {field('FACE VALUE', face, setFace, 'A$')}
          {field('COUPON RATE', coupon, setCoupon, '%')}
          {field('YEARS TO MATURITY', years, setYears, 'yr')}
          {field('MARKET PRICE', price, setPrice, 'A$')}
        </div>

        {out ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {res('CURRENT YIELD', `${out.currentYield.toFixed(2)}%`, 'Annual coupon ÷ market price. Ignores the capital gain or loss to maturity, which is why it differs from YTM.')}
              {res('YIELD TO MATURITY', `${out.ytm.toFixed(2)}%`, `Solved by Newton-Raphson iteration — the rate that discounts every remaining cash flow back to today's price. Converged in ${out.iterations} iteration${out.iterations === 1 ? '' : 's'}.`)}
              {res('DURATION', `${out.dur.macaulay.toFixed(2)}y`, 'Macaulay duration: the weighted average time until you get your money back, in years.')}
              {res('MOD. DURATION', out.dur.modified.toFixed(2), 'Macaulay ÷ (1 + y). The approximate percentage price move for a 1% change in yield.')}
              {res('CONVEXITY', out.dur.convexity.toFixed(1), 'Second-order sensitivity. Positive convexity means price rises on a yield fall exceed the losses on an equal rise.')}
              {res('DV01', `A$${out.dvv.toFixed(3)}`, `What this A$${out.f.toLocaleString()} holding gains or loses per 0.01% move in yield.`)}
            </div>

            <div className="text-2xs text-terminal-text-dim leading-relaxed mt-3">
              At A${out.p.toLocaleString()}, this bond yields{' '}
              <b className="text-terminal-gold">{out.ytm.toFixed(2)}%</b> to maturity. A modified duration of{' '}
              <b className="text-terminal-text-bright">{out.dur.modified.toFixed(2)}</b> means the price moves roughly{' '}
              {out.dur.modified.toFixed(1)}% for each 1% change in market rates — up if rates fall, down if they rise.
              {!out.converged && ' The solver did not fully converge on these inputs; treat the YTM as approximate.'}
            </div>
          </>
        ) : (
          <div className="text-2xs text-terminal-text-dim/60">Enter a face value, coupon, term and price.</div>
        )}

        <div className="text-terminal-text-dim/50 leading-snug mt-3" style={{ fontSize: 8 }}>
          Annual coupons assumed. General information only — not financial advice.
        </div>
      </div>
    </div>
  )
}

// ─── Module ─────────────────────────────────────────────────────────────────

export default function BondsModule() {
  const [marketKey, setMarketKey] = useState('AU')
  const [showAll, setShowAll] = useState(false)
  const [hover, setHover] = useState(null)
  const [picked, setPicked] = useState(null)

  const market = BOND_MARKETS.find((m) => m.key === marketKey) ?? BOND_MARKETS[0]
  const rows = useBondYields(marketKey)
  const stats = useMemo(() => curveStats(rows), [rows])
  const cpi = VERIFIED_CONSTANTS.au.cpi

  const series = useMemo(() => {
    if (!showAll) return [{ key: marketKey, colour: market.colour, rows, primary: true }]
    return BOND_MARKETS.map((m) => ({
      key: m.key,
      colour: m.colour,
      rows: m.key === marketKey ? rows : BOND_CURVES[m.key],
      primary: m.key === marketKey,
    }))
  }, [showAll, marketKey, market.colour, rows])

  const KEY_TENORS = ['2Y', '5Y', '10Y', '30Y']
  const usAt = (m) => BOND_CURVES.US.find((r) => r.maturity === m)?.yield ?? null
  const au10 = rows.find((r) => r.maturity === '10Y')?.yield ?? null
  const us10 = usAt('10Y')

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <ModuleHeader
        title="BONDS"
        subtitle="Sovereign debt · full maturity spectrum · 1M to 50Y"
        moduleId="bonds"
        right={<span className="text-terminal-gold text-2xs font-normal normal-case">● LIVE (SIMULATED)</span>}
      />

      {/* Provenance first, not buried in a footer. Every yield below is
          indicative; the CPI the real-yield column uses is not. */}
      <div className="px-3 py-1.5 border-b border-terminal-border flex items-center gap-2 flex-wrap"
        style={{ background: 'rgba(201,168,76,0.04)' }}>
        <span className="font-mono font-bold tracking-widest text-terminal-gold" style={{ fontSize: 8 }}>INDICATIVE DATA</span>
        <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 9 }}>
          Yields are an illustrative snapshot with simulated ticking, not a market feed. Real yields use
          verified AU CPI of {cpi}%.
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-terminal-border flex-wrap">
        {BOND_MARKETS.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMarketKey(m.key); setPicked(null) }}
            className="font-mono uppercase tracking-wider transition-colors"
            style={{
              fontSize: 9, padding: '3px 10px', borderRadius: 2,
              border: `1px solid ${marketKey === m.key ? m.colour : 'rgba(201,168,76,0.12)'}`,
              background: marketKey === m.key ? `${m.colour}26` : 'transparent',
              color: marketKey === m.key ? m.colour : '#4A6080',
            }}
          >{m.flag} {m.label}</button>
        ))}
        <button
          onClick={() => setShowAll((v) => !v)}
          className="font-mono uppercase tracking-wider transition-colors ml-2"
          style={{
            fontSize: 9, padding: '3px 10px', borderRadius: 2,
            border: `1px solid ${showAll ? '#C9A84C' : 'rgba(201,168,76,0.12)'}`,
            background: showAll ? 'rgba(201,168,76,0.15)' : 'transparent',
            color: showAll ? '#C9A84C' : '#4A6080',
          }}
        >ALL MARKETS</button>

        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono font-bold px-2 py-0.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: SHAPE_TONE[stats.shape], border: `1px solid ${SHAPE_TONE[stats.shape]}66` }}>
            {stats.shape} CURVE
          </span>
          <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
            2s10s <b className="text-terminal-text-bright tabular-nums">{stats.spread == null ? '—' : bp(stats.spread * 100)}</b>
          </span>
          {au10 != null && us10 != null && marketKey === 'AU' && (
            <span className="font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
              AU−US 10Y <b className="tabular-nums" style={{ color: au10 >= us10 ? '#2D8A50' : '#CC4444' }}>{bp((au10 - us10) * 100)}</b>
            </span>
          )}
        </span>
      </div>

      <div className="px-2 pt-2">
        <CurveChart series={series} hover={hover} onHover={setHover} onPick={setPicked} />
        <div className="flex items-center gap-3 px-1 pb-1 flex-wrap" style={{ minHeight: 18 }}>
          {hover ? (
            <span className="font-mono text-terminal-gold" style={{ fontSize: 9 }}>
              {market.label} {hover.row.maturity} · {hover.row.yield.toFixed(3)}% · click to open
            </span>
          ) : (
            <span className="font-mono text-terminal-text-dim/40" style={{ fontSize: 9 }}>
              Hover the curve for a reading · log scale, so the short end is legible
            </span>
          )}
          {showAll && BOND_MARKETS.map((m) => (
            <span key={m.key} className="flex items-center gap-1 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>
              <span style={{ width: 10, height: 2, background: m.colour, display: 'inline-block' }} />{m.label}
            </span>
          ))}
        </div>
      </div>

      {picked && <BondDetail market={market} row={picked} onClose={() => setPicked(null)} />}

      {showAll ? (
        <div className="border-t border-terminal-border">
          <div className="panel-header">CROSS-MARKET COMPARISON · KEY MATURITIES</div>
          <table className="terminal-table w-full">
            <thead>
              <tr>
                <th className="px-3 text-left">MATURITY</th>
                {BOND_MARKETS.map((m) => <th key={m.key} className="px-3 text-right">{m.flag} {m.label}</th>)}
                <th className="px-3 text-right">AU − US</th>
              </tr>
            </thead>
            <tbody>
              {KEY_TENORS.map((t) => {
                const au = BOND_CURVES.AU.find((r) => r.maturity === t)?.yield ?? null
                const us = usAt(t)
                const diff = au != null && us != null ? (au - us) * 100 : null
                return (
                  <tr key={t} className="border-b border-terminal-border/30">
                    <td className="px-3 py-1.5 font-mono font-bold text-terminal-text-bright" style={{ fontSize: 10 }}>{t}</td>
                    {BOND_MARKETS.map((m) => {
                      const v = BOND_CURVES[m.key].find((r) => r.maturity === t)?.yield
                      return (
                        <td key={m.key} className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: m.key === marketKey ? m.colour : '#8BA3C4' }}>
                          {v != null ? `${v.toFixed(2)}%` : '—'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums" style={{ fontSize: 10, color: diff == null ? '#637899' : diff >= 0 ? '#2D8A50' : '#CC4444' }}>
                      {diff == null ? '—' : bp(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 text-terminal-text-dim/50 leading-snug" style={{ fontSize: 8 }}>
            A positive AU−US spread pays investors more to hold Australian duration, which is historically
            supportive for the AUD. Not every market quotes every maturity, and a blank is a blank rather than a zero.
          </div>
        </div>
      ) : (
        <div className="border-t border-terminal-border">
          <div className="panel-header flex items-center gap-2">
            <span>{market.flag} {market.name}</span>
            <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">
              {rows.length} maturities · {market.issuer}
            </span>
          </div>
          <table className="terminal-table table-zebra w-full">
            <thead>
              <tr>
                <th className="px-3 text-left">MATURITY</th>
                <th className="px-2 text-left">TYPE</th>
                <th className="px-2 text-right">COUPON</th>
                <th className="px-2 text-right">YIELD</th>
                <th className="px-2 text-right">CHANGE</th>
                <th className="px-2 text-right">PRICE</th>
                <th className="px-2 text-right">REAL YIELD</th>
                <th className="px-3 text-right">MOD. DUR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const real = r.yield - cpi
                const dur = durationOf(r.coupon, r.yield, r.years)
                return (
                  <tr
                    key={r.maturity}
                    onClick={() => setPicked(r)}
                    className={`cursor-pointer hover:bg-terminal-accent/20 transition-colors border-b border-terminal-border/30 ${
                      picked?.maturity === r.maturity ? 'bg-terminal-accent/15' : ''
                    }`}
                    style={r.indicative ? { fontStyle: 'italic', opacity: 0.75 } : undefined}
                  >
                    <td className="px-3 py-1.5 font-mono font-bold" style={{ fontSize: 11, color: TERM_TONE(r.years) }}>
                      {r.maturity}
                      {r.indicative && (
                        <Tooltip content="Ultra-long bonds are thinly traded. Yields shown at these maturities are market estimates.">
                          <span className="ml-1.5 font-normal not-italic" style={{ fontSize: 7, color: '#4A6080', letterSpacing: '0.1em' }}>INDICATIVE</span>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{r.type}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-terminal-text-dim tabular-nums" style={{ fontSize: 10 }}>
                      {r.coupon ? `${r.coupon.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-terminal-gold tabular-nums" style={{ fontSize: 11 }}>
                      {r.yield.toFixed(3)}%
                    </td>
                    {/* A rising yield is a FALLING price. Green for down is
                        correct here and the opposite of every equity row in the
                        terminal, so the header says CHANGE and the tooltip says
                        which way the money went. */}
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: r.changeBp > 0.05 ? '#CC4444' : r.changeBp < -0.05 ? '#2D8A50' : '#637899' }}>
                      <Tooltip content={r.changeBp >= 0 ? 'Yield up since the session seed — bond prices fall as yields rise.' : 'Yield down since the session seed — bond prices rise as yields fall.'}>
                        <span>{bp(r.changeBp)}</span>
                      </Tooltip>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-terminal-text-dim tabular-nums" style={{ fontSize: 10 }}>
                      {priceFromYield(r.coupon, r.yield, r.years).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums" style={{ fontSize: 10, color: real >= 0 ? '#2D8A50' : '#CC4444' }}>
                      {real >= 0 ? '+' : ''}{real.toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-terminal-text-dim tabular-nums" style={{ fontSize: 10 }}>
                      {r.years < 1 ? '—' : `${dur.modified.toFixed(2)}y`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 py-1.5 text-terminal-text-dim/50 leading-snug" style={{ fontSize: 8 }}>
            REAL YIELD is the nominal yield less AU CPI of {cpi}% ({VERIFIED_CONSTANTS.au.cpiPeriod}) — a negative
            figure means the bond loses purchasing power before tax. PRICE, DURATION and the change column are
            calculated from the yield, not quoted.
          </div>
        </div>
      )}

      <BondCalculator />
    </div>
  )
}
