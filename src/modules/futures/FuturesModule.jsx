import { useMemo, useState } from 'react'
import {
  FUTURES_GROUPS, impliedRate, SHORT_INTEREST, MARGIN_LENDERS, POSITIONING,
} from '../../data/futuresData'
import { blackScholes, smileIv } from './blackScholes'
import { useFuturesPrices } from './useFuturesPrices'
import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import ModuleHeader from '../../components/ui/ModuleHeader'
import TabBar from '../../components/ui/TabBar'
import Tooltip from '../../components/ui/Tooltip'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'

// ─── Futures, options and market structure ──────────────────────────────────
//
// An INTELLIGENCE module, not a trading interface. Nothing here places an
// order; the value is in the specifications, the implied rates and the greeks,
// which are the things that make a derivative price mean something.
//
// Prices are indicative and simulated. The contract specifications and the
// option maths are not — a tick value or a delta is arithmetic, and both are
// checkable.

const TABS = [
  { key: 'futures',   label: 'FUTURES' },
  { key: 'options',   label: 'OPTIONS' },
  { key: 'structure', label: 'MARKET STRUCTURE' },
]

const money = (v, dp = 2) => (v == null ? '—' : `A$${v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`)
const num = (v, fb = 0) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fb)
const tone = (v) => (v > 0 ? '#2D8A50' : v < 0 ? '#CC4444' : '#637899')
const signed = (v, dp = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`

// ─── Futures tab ────────────────────────────────────────────────────────────

function ContractDetail({ c, onClose }) {
  const notional = useMemo(() => {
    const m = /([\d,]+(?:\.\d+)?)/.exec(c.size ?? '')
    const mult = m ? parseFloat(m[1].replace(/,/g, '')) : null
    return mult ? mult * c.livePrice : null
  }, [c])

  const stat = (l, v, tip) => (
    <div>
      <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>{l}</div>
      {tip
        ? <Tooltip content={tip}><div className="font-mono text-terminal-text-bright" style={{ fontSize: 11 }}>{v}</div></Tooltip>
        : <div className="font-mono text-terminal-text-bright" style={{ fontSize: 11 }}>{v}</div>}
    </div>
  )

  return (
    <div className="border-t border-terminal-border" style={{ background: 'rgba(201,168,76,0.03)' }}>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="font-mono font-bold text-terminal-gold tracking-widest" style={{ fontSize: 11 }}>
            {c.name} · {c.expiry}
          </span>
          <span className="font-mono font-bold text-terminal-text-bright tabular-nums" style={{ fontSize: 18 }}>
            {c.unit ? c.unit.replace('/', ' ').split(' ')[0] : ''}{c.livePrice.toLocaleString('en-AU', { minimumFractionDigits: c.dp ?? 2, maximumFractionDigits: c.dp ?? 2 })}
          </span>
          <span className="font-mono font-bold tabular-nums" style={{ fontSize: 11, color: tone(c.liveChange) }}>
            {signed(c.liveChange, c.dp ?? 2)}
          </span>
          {c.rate && (
            <span className="font-mono font-bold text-terminal-gold" style={{ fontSize: 12 }}>
              → {impliedRate(c.livePrice).toFixed(2)}% implied
            </span>
          )}
          <button onClick={onClose} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">✕ CLOSE</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
          {stat('EXCHANGE', c.exchange)}
          {stat('CONTRACT SIZE', c.size)}
          {stat('TICK SIZE', c.tick, 'The smallest price increment the contract can move.')}
          {stat('TICK VALUE', `${c.currency === 'AUD' ? 'A$' : c.currency === 'USD' ? 'US$' : ''}${c.tickValue.toLocaleString()}`,
            'What one tick is worth per contract — the number that turns a price move into money.')}
          {stat('SETTLEMENT', c.settlement, c.settlement === 'Physical' ? 'Physically settled — held to expiry, you take delivery of the commodity.' : 'Cash settled against the final index or reference price.')}
          {stat('INITIAL MARGIN', `${c.currency === 'AUD' ? 'A$' : 'US$'}${c.margin.toLocaleString()}`, 'Indicative. The deposit required to hold one contract — the whole source of the leverage.')}
        </div>

        {notional && (
          <div className="mb-2 px-2 py-1.5" style={{ background: 'rgba(204,68,68,0.08)', border: '1px solid rgba(204,68,68,0.3)' }}>
            <span className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>
              One contract controls a notional position of about{' '}
              <b className="text-terminal-text-bright">{c.currency === 'AUD' ? 'A$' : 'US$'}{Math.round(notional).toLocaleString()}</b>
              {' '}on roughly{' '}
              <b className="text-terminal-text-bright">{c.currency === 'AUD' ? 'A$' : 'US$'}{c.margin.toLocaleString()}</b> of margin —
              about <b style={{ color: '#CC4444' }}>{(notional / c.margin).toFixed(0)}×</b> leverage. A 1% move against you
              costs roughly {(((notional * 0.01) / c.margin) * 100).toFixed(0)}% of the margin.
            </span>
          </div>
        )}

        {c.context && (
          <div className="text-terminal-text-dim leading-relaxed mb-2" style={{ fontSize: 10, maxWidth: 700 }}>{c.context}</div>
        )}

        <button
          onClick={() => dispatchAskAI({
            name: `${c.name} ${c.expiry} futures`, sector: 'Derivatives', date: todayAEST(),
            instruction: `Explain the ${c.name} ${c.expiry} futures contract for an Australian investor: what it is, what moves it, and what its relevance is to the ASX. Contract size ${c.size}, exchange ${c.exchange}. Do not state any price or figure I have not given you.`,
          })}
          className="text-2xs font-bold tracking-wide text-terminal-gold border border-terminal-gold/40 rounded-full hover:bg-terminal-gold hover:text-terminal-bg transition-colors px-3 py-1"
        >ASK MADDENAI ▶</button>
      </div>
    </div>
  )
}

function FuturesTab() {
  const rows = useFuturesPrices()
  const [picked, setPicked] = useState(null)
  const sel = picked ? rows.find((r) => r.id === picked) : null

  return (
    <div>
      <div className="px-3 py-1.5 border-b flex items-center gap-2 flex-wrap"
        style={{ background: 'rgba(204,68,68,0.08)', borderColor: 'rgba(204,68,68,0.3)' }}>
        <span className="font-mono font-bold tracking-widest text-terminal-red" style={{ fontSize: 8 }}>INDICATIVE DATA</span>
        <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 9 }}>
          For information only. Futures carry significant risk including losses exceeding your initial investment.
        </span>
      </div>

      {sel && <ContractDetail c={sel} onClose={() => setPicked(null)} />}

      {FUTURES_GROUPS.map((g) => {
        const list = rows.filter((r) => r.group === g.key)
        if (!list.length) return null
        return (
          <div key={g.key} className="border-b border-terminal-border">
            <div className="panel-header flex items-center gap-2">
              <span>{g.label}</span>
              {g.key === 'rates' && (
                <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">
                  quoted as 100 minus the implied rate
                </span>
              )}
            </div>
            <table className="terminal-table table-zebra w-full">
              <thead>
                <tr>
                  <th className="px-3 text-left">CONTRACT</th>
                  <th className="px-2 text-left">EXPIRY</th>
                  <th className="px-2 text-right">PRICE</th>
                  <th className="px-2 text-right">CHANGE</th>
                  {g.key === 'rates' && <th className="px-2 text-right">IMPLIED</th>}
                  <th className="px-3 text-right">VOLUME</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} onClick={() => setPicked(c.id)}
                    className="cursor-pointer hover:bg-terminal-accent/20 transition-colors border-b border-terminal-border/30"
                    style={picked === c.id ? { background: 'rgba(201,168,76,0.08)' } : undefined}>
                    <td className="px-3 py-1.5 font-mono font-bold text-terminal-text-bright" style={{ fontSize: 11 }}>{c.name}</td>
                    <td className="px-2 py-1.5 font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>{c.expiry}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 11 }}>
                      {c.unit?.startsWith('US$') ? 'US$' : ''}
                      {c.livePrice.toLocaleString('en-AU', { minimumFractionDigits: c.dp ?? 2, maximumFractionDigits: c.dp ?? 2 })}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: tone(c.liveChange) }}>
                      {signed(c.liveChange, c.dp ?? 2)}
                    </td>
                    {g.key === 'rates' && (
                      <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-terminal-gold" style={{ fontSize: 11 }}>
                        {impliedRate(c.livePrice).toFixed(2)}%
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>
                      {c.volume.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {g.key === 'rates' && (
              <div className="px-3 py-1.5 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 9 }}>
                Implied rates show where the market expects rates to sit at each expiry. Against the RBA&apos;s current
                cash rate of <b className="text-terminal-gold">{VERIFIED_CONSTANTS.rba.cashRate}%</b>, a bank-bill
                strip that falls across later expiries is the market pricing cuts. These are indicative figures —
                this build has no rate-futures feed, and the Rates module says so too.
              </div>
            )}
          </div>
        )
      })}

      <div className="px-3 py-2 text-terminal-text-dim/60 leading-relaxed" style={{ fontSize: 9 }}>
        Futures involve significant risk including leverage and the potential for losses exceeding your initial
        investment. Margin means small price movements create large gains and losses. Trading futures in Australia
        requires the appropriate authorisation under the ASIC framework. Data shown is indicative only. Not advice.
      </div>
    </div>
  )
}

// ─── Options tab ────────────────────────────────────────────────────────────

const EXPIRIES = [{ label: 'Sep-26', days: 24 }, { label: 'Oct-26', days: 52 }, { label: 'Dec-26', days: 108 }, { label: 'Mar-27', days: 199 }]

const GREEK_HELP = [
  ['DELTA', 'How much the option price moves for a one-dollar move in the underlying. A delta of 0.42 means roughly 42 cents per dollar — and it doubles as a rough probability the option finishes in the money.'],
  ['GAMMA', 'How fast delta itself changes. High gamma means your exposure shifts quickly as the share moves, which is why an at-the-money option close to expiry behaves so violently.'],
  ['THETA', 'Time decay — what the option loses each day simply from a day passing, holding everything else still. It is the rent an option buyer pays and the income a seller collects.'],
  ['VEGA',  'Sensitivity to implied volatility. A vega of 0.06 means the option gains about six cents if implied volatility rises one percentage point, with the share price unchanged.'],
  ['RHO',   'Sensitivity to interest rates. Usually the smallest of the five for short-dated options, and the one that matters least day to day.'],
]

function OptionsTab() {
  const [expiryIdx, setExpiryIdx] = useState(0)
  const [spot, setSpot] = useState('43.21')
  const [strike, setStrike] = useState('44.00')
  const [days, setDays] = useState('45')
  const [vol, setVol] = useState('22')
  const [rate, setRate] = useState(String(VERIFIED_CONSTANTS.rba.cashRate))
  const [type, setType] = useState('call')
  const [showGreeks, setShowGreeks] = useState(false)

  const S = 43.21
  const expiry = EXPIRIES[expiryIdx]

  // Chain strikes at A$2 intervals, ATM at the nearest strike to spot.
  const chain = useMemo(() => {
    const strikes = []
    for (let k = 36; k <= 52; k += 2) strikes.push(k)
    const atm = strikes.reduce((best, k) => (Math.abs(k - S) < Math.abs(best - S) ? k : best), strikes[0])
    return strikes.map((k) => {
      const iv = smileIv(k, S)
      const call = blackScholes({ spot: S, strike: k, days: expiry.days, volPct: iv, ratePct: VERIFIED_CONSTANTS.rba.cashRate, type: 'call' })
      const put = blackScholes({ spot: S, strike: k, days: expiry.days, volPct: iv, ratePct: VERIFIED_CONSTANTS.rba.cashRate, type: 'put' })
      // Volume peaks at the money and falls away — the shape of a real chain.
      const vFactor = Math.exp(-((k - S) ** 2) / 32)
      return {
        strike: k, iv, atm: k === atm,
        call: { ...call, volume: Math.round(180 * vFactor + 6) },
        put: { ...put, volume: Math.round(150 * vFactor + 4) },
      }
    })
  }, [expiry.days])

  const bs = useMemo(() => blackScholes({
    spot: num(spot), strike: num(strike), days: num(days), volPct: num(vol), ratePct: num(rate), type,
  }), [spot, strike, days, vol, rate, type])

  const ivMin = Math.min(...chain.map((c) => c.iv))
  const ivMax = Math.max(...chain.map((c) => c.iv))

  const field = (label, value, set, suffix, opts) => (
    <label className="block mb-2">
      <span className="font-mono text-terminal-gold/70" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        {opts ? (
          <select value={value} onChange={(e) => set(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright outline-none focus:border-terminal-gold" style={{ fontSize: 12 }}>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type="number" value={value} step="0.01" onChange={(e) => set(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright outline-none focus:border-terminal-gold tabular-nums" style={{ fontSize: 12 }} />
        )}
        {suffix && <span className="font-mono text-terminal-text-dim/50" style={{ fontSize: 9 }}>{suffix}</span>}
      </div>
    </label>
  )

  return (
    <div>
      <div className="px-3 py-1.5 border-b flex items-center gap-2 flex-wrap"
        style={{ background: 'rgba(204,68,68,0.08)', borderColor: 'rgba(204,68,68,0.3)' }}>
        <span className="font-mono font-bold tracking-widest text-terminal-red" style={{ fontSize: 8 }}>THEORETICAL · EDUCATIONAL</span>
        <span className="font-mono text-terminal-text-dim/70" style={{ fontSize: 9 }}>
          Every price on this tab is a Black-Scholes model output, not a market quote.
        </span>
      </div>

      <div className="border-b border-terminal-border">
        <div className="panel-header flex items-center gap-2 flex-wrap">
          <span>OPTIONS CHAIN</span>
          <span className="text-2xs font-normal normal-case text-terminal-gold">BHP.AX</span>
          <span className="text-2xs font-normal normal-case text-terminal-text-dim">spot A${S.toFixed(2)}</span>
          <div className="ml-auto flex items-center gap-1">
            {EXPIRIES.map((e, i) => (
              <button key={e.label} onClick={() => setExpiryIdx(i)}
                className="font-mono uppercase tracking-wider transition-colors"
                style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 2,
                  border: `1px solid ${expiryIdx === i ? '#C9A84C' : 'rgba(201,168,76,0.12)'}`,
                  background: expiryIdx === i ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: expiryIdx === i ? '#C9A84C' : '#4A6080',
                }}>{e.label}</button>
            ))}
          </div>
        </div>

        {/* The smile. Out-of-the-money options carry higher implied vol than
            at-the-money ones, and downside puts higher still — the curve is the
            market charging more for tail risk. */}
        <div className="px-3 pt-2">
          <div className="font-mono text-terminal-text-dim/50 mb-1" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
            IMPLIED VOLATILITY SMILE · {expiry.label}
          </div>
          <svg width="100%" viewBox="0 0 800 90" style={{ display: 'block' }}>
            <polyline
              points={chain.map((c, i) => `${20 + (i / (chain.length - 1)) * 760},${76 - ((c.iv - ivMin) / ((ivMax - ivMin) || 1)) * 60}`).join(' ')}
              fill="none" stroke="#C9A84C" strokeWidth={1.5} />
            {chain.map((c, i) => (
              <circle key={c.strike} cx={20 + (i / (chain.length - 1)) * 760}
                cy={76 - ((c.iv - ivMin) / ((ivMax - ivMin) || 1)) * 60}
                r={c.atm ? 4 : 2.5} fill={c.atm ? '#E6EDF6' : '#C9A84C'} />
            ))}
            {chain.map((c, i) => (
              <text key={c.strike} x={20 + (i / (chain.length - 1)) * 760} y={88} textAnchor="middle"
                fill={c.atm ? '#C9A84C' : '#4A6080'} style={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}>{c.strike}</text>
            ))}
          </svg>
        </div>

        <table className="terminal-table w-full mt-1">
          <thead>
            <tr>
              <th className="px-2 text-right" colSpan={4} style={{ color: '#2D8A50' }}>CALLS</th>
              <th className="px-2 text-center">STRIKE</th>
              <th className="px-2 text-left" colSpan={4} style={{ color: '#CC4444' }}>PUTS</th>
            </tr>
            <tr>
              <th className="px-2 text-right">IV</th><th className="px-2 text-right">DELTA</th>
              <th className="px-2 text-right">VOL</th><th className="px-2 text-right">THEO</th>
              <th className="px-2 text-center" />
              <th className="px-2 text-left">THEO</th><th className="px-2 text-left">VOL</th>
              <th className="px-2 text-left">DELTA</th><th className="px-2 text-left">IV</th>
            </tr>
          </thead>
          <tbody>
            {chain.map((c) => (
              <tr key={c.strike} className="border-b border-terminal-border/25"
                style={c.atm ? { background: 'rgba(201,168,76,0.12)' } : undefined}>
                <td className="px-2 py-1 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{c.iv.toFixed(1)}%</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums" style={{ fontSize: 10, color: '#2D8A50' }}>{c.call.delta.toFixed(2)}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{c.call.volume}</td>
                <td className="px-2 py-1 text-right font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 10 }}>{c.call.price.toFixed(2)}</td>
                <td className="px-2 py-1 text-center font-mono font-bold" style={{ fontSize: 11, color: c.atm ? '#C9A84C' : '#E6EDF6' }}>
                  {c.strike}{c.atm && <span className="ml-1" style={{ fontSize: 7, letterSpacing: '0.1em' }}>ATM</span>}
                </td>
                <td className="px-2 py-1 font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 10 }}>{c.put.price.toFixed(2)}</td>
                <td className="px-2 py-1 font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{c.put.volume}</td>
                <td className="px-2 py-1 font-mono tabular-nums" style={{ fontSize: 10, color: '#CC4444' }}>{c.put.delta.toFixed(2)}</td>
                <td className="px-2 py-1 font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{c.iv.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-1.5 text-terminal-text-dim/50 leading-snug" style={{ fontSize: 8 }}>
          THEO is the Black-Scholes value at the implied volatility on that row, not a bid or an offer — this build
          has no options feed. Volumes are shaped to peak at the money, as a real chain does.
        </div>
      </div>

      <div className="border-b border-terminal-border">
        <div className="panel-header flex items-center gap-2">
          <span>BLACK-SCHOLES CALCULATOR</span>
          <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">updates as you type</span>
        </div>
        <div className="flex flex-col lg:flex-row">
          <div className="p-3 border-b lg:border-b-0 lg:border-r border-terminal-border" style={{ width: 'min(100%, 320px)' }}>
            {field('STOCK PRICE', spot, setSpot, 'A$')}
            {field('STRIKE PRICE', strike, setStrike, 'A$')}
            {field('DAYS TO EXPIRY', days, setDays, 'd')}
            {field('VOLATILITY (IV)', vol, setVol, '%')}
            {field('RISK-FREE RATE', rate, setRate, '%')}
            {field('OPTION TYPE', type, setType, null, [{ value: 'call', label: 'CALL' }, { value: 'put', label: 'PUT' }])}
          </div>
          <div className="p-3 flex-1 min-w-0">
            <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.14em' }}>THEORETICAL PRICE</div>
            <div className="font-mono font-bold text-terminal-gold tabular-nums leading-none" style={{ fontSize: 28, marginTop: 4 }}>
              {money(bs.price)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 mb-3" style={{ maxWidth: 320 }}>
              <div>
                <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8 }}>INTRINSIC VALUE</div>
                <div className="font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 13 }}>{money(bs.intrinsic)}</div>
              </div>
              <div>
                <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8 }}>TIME VALUE</div>
                <div className="font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 13 }}>{money(bs.timeValue)}</div>
              </div>
            </div>

            <div className="font-mono text-terminal-gold/70 mb-1.5" style={{ fontSize: 8, letterSpacing: '0.14em' }}>GREEKS</div>
            <div className="space-y-1">
              {[
                ['DELTA', bs.delta.toFixed(4), `Moves ${money(Math.abs(bs.delta))} per A$1 move in the underlying`],
                ['GAMMA', bs.gamma.toFixed(4), `Delta changes by ${bs.gamma.toFixed(3)} per A$1 move`],
                ['THETA', bs.theta.toFixed(4), `Loses ${money(Math.abs(bs.theta), 4)} per day to time decay`],
                ['VEGA',  bs.vega.toFixed(4),  `Gains ${money(bs.vega, 4)} per 1 percentage point rise in volatility`],
                ['RHO',   bs.rho.toFixed(4),   `Gains ${money(Math.abs(bs.rho), 4)} per 1 percentage point rise in rates`],
              ].map(([k, v, plain]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <span className="font-mono text-terminal-gold" style={{ fontSize: 9, width: 46 }}>{k}</span>
                  <span className="font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 11, width: 62 }}>{v}</span>
                  <span className="text-terminal-text-dim" style={{ fontSize: 10 }}>{plain}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setShowGreeks((v) => !v)}
              className="mt-3 text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors">
              {showGreeks ? '▲ HIDE' : '▼ LEARN ABOUT THE GREEKS'}
            </button>
            <div style={{ display: 'grid', gridTemplateRows: showGreeks ? '1fr' : '0fr', transition: 'grid-template-rows 200ms cubic-bezier(0.4,0,0.2,1)' }}>
              <div style={{ overflow: 'hidden' }}>
                <div className="pt-2 space-y-2">
                  {GREEK_HELP.map(([k, text]) => (
                    <div key={k}>
                      <div className="font-mono font-bold text-terminal-gold" style={{ fontSize: 9, letterSpacing: '0.1em' }}>{k}</div>
                      <div className="text-terminal-text-dim leading-relaxed" style={{ fontSize: 10, maxWidth: 620 }}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-terminal-text-dim/50 leading-snug mt-3" style={{ fontSize: 8, maxWidth: 620 }}>
              Theta is quoted per DAY and vega and rho per ONE percentage point, which is how a holder experiences
              them — the raw annualised forms are correct and useless. Black-Scholes assumes European exercise, no
              dividends and constant volatility; ASX equity options are American and most underlyings pay dividends,
              so a real quote will differ. Options are complex instruments not suitable for all investors. Not advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Market structure tab ───────────────────────────────────────────────────

function StructureTab() {
  const [portfolio, setPortfolio] = useState('100000')
  const [loan, setLoan] = useState('50000')
  const [limit, setLimit] = useState('70')
  const [mrate, setMrate] = useState('8.45')

  const m = useMemo(() => {
    const p = num(portfolio), l = num(loan), lim = num(limit) / 100
    const lvr = p > 0 ? (l / p) * 100 : 0
    // A margin call comes when loan / value exceeds the limit, so the trigger
    // value is loan ÷ limit. Below that, the lender wants cash or sells for you.
    const trigger = lim > 0 ? l / lim : 0
    const fall = p > 0 ? ((p - trigger) / p) * 100 : 0
    return { lvr, trigger, fall, interest: l * (num(mrate) / 100), safe: lvr < num(limit) }
  }, [portfolio, loan, limit, mrate])

  const shortTone = (p) => (p > 10 ? '#CC4444' : p >= 5 ? '#D69E2E' : '#637899')
  const sigTone = { BULLISH: '#2D8A50', NEUTRAL: '#C9A84C', BEARISH: '#CC4444' }

  const field = (label, value, set, suffix) => (
    <label className="block mb-2">
      <span className="font-mono text-terminal-gold/70" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <input type="number" value={value} onChange={(e) => set(e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-2 py-1 text-terminal-text-bright outline-none focus:border-terminal-gold tabular-nums" style={{ fontSize: 12 }} />
        {suffix && <span className="font-mono text-terminal-text-dim/50" style={{ fontSize: 9 }}>{suffix}</span>}
      </div>
    </label>
  )

  return (
    <div>
      <div className="border-b border-terminal-border">
        <div className="panel-header flex items-center gap-2">
          <span>ASX SHORT INTEREST</span>
          <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">
            ASIC publishes short positions with a lag · INDICATIVE
          </span>
        </div>
        <table className="terminal-table table-zebra w-full">
          <thead>
            <tr>
              <th className="px-3 text-left" style={{ width: 50 }}>#</th>
              <th className="px-2 text-left" style={{ width: 80 }}>TICKER</th>
              <th className="px-2 text-left">COMPANY</th>
              <th className="px-2 text-right" style={{ width: 110 }}>SHORT %</th>
              <th className="px-3 text-right" style={{ width: 130 }}>DAYS TO COVER</th>
            </tr>
          </thead>
          <tbody>
            {SHORT_INTEREST.map((s, i) => (
              <tr key={s.ticker} className="border-b border-terminal-border/25">
                <td className="px-3 py-1.5 font-mono text-terminal-text-dim/50" style={{ fontSize: 10 }}>{i + 1}</td>
                <td className="px-2 py-1.5 font-mono font-bold text-terminal-gold" style={{ fontSize: 11 }}>{s.ticker}</td>
                <td className="px-2 py-1.5 text-terminal-text-bright" style={{ fontSize: 11 }}>{s.company}</td>
                <td className="px-2 py-1.5 text-right">
                  <span className="font-mono font-bold tabular-nums px-1.5 py-0.5" style={{
                    fontSize: 11, borderRadius: 2, color: shortTone(s.shortPct), background: `${shortTone(s.shortPct)}1F`,
                  }}>{s.shortPct.toFixed(1)}%</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>
                  {s.daysToCover.toFixed(1)}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-1.5 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 9 }}>
          DAYS TO COVER is short interest divided by average daily volume — how long it would take shorts to buy
          back at normal turnover. A high figure is what makes a short squeeze possible. Rising short interest is
          often read as bearish institutional positioning, but shorts also hedge long books, so it is a signal to
          investigate rather than a conclusion.
        </div>
      </div>

      <div className="border-b border-terminal-border">
        <div className="panel-header">AU MARGIN LENDING</div>
        <div className="flex flex-col lg:flex-row">
          <div className="lg:border-r border-terminal-border" style={{ width: 'min(100%, 420px)' }}>
            <table className="terminal-table w-full">
              <thead>
                <tr>
                  <th className="px-3 text-left">LENDER</th>
                  <th className="px-2 text-right">RATE</th>
                  <th className="px-2 text-right">MAX LVR</th>
                  <th className="px-3 text-right">MIN LOAN</th>
                </tr>
              </thead>
              <tbody>
                {MARGIN_LENDERS.map((l) => (
                  <tr key={l.lender} className="border-b border-terminal-border/25">
                    <td className="px-3 py-1.5 text-terminal-text-bright" style={{ fontSize: 11 }}>{l.lender}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-terminal-gold" style={{ fontSize: 11 }}>{l.rate.toFixed(2)}%</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{l.maxLvr}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>
                      A${l.minLoan.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-1.5 text-terminal-text-dim/50" style={{ fontSize: 8 }}>
              Indicative rates. Verify with the lender — margin rates move with the cash rate and vary by balance.
            </div>
          </div>

          <div className="p-3 flex-1 min-w-0">
            <div className="font-mono text-terminal-gold/70 mb-2" style={{ fontSize: 8, letterSpacing: '0.14em' }}>MARGIN CALL CALCULATOR</div>
            <div className="flex gap-3 flex-wrap">
              <div style={{ width: 150 }}>
                {field('PORTFOLIO VALUE', portfolio, setPortfolio, 'A$')}
                {field('LOAN AMOUNT', loan, setLoan, 'A$')}
              </div>
              <div style={{ width: 130 }}>
                {field('LVR LIMIT', limit, setLimit, '%')}
                {field('INTEREST RATE', mrate, setMrate, '%')}
              </div>
              <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
                <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>CURRENT LVR</div>
                <div className="font-mono font-bold tabular-nums" style={{ fontSize: 24, color: m.safe ? '#2D8A50' : '#CC4444' }}>
                  {m.lvr.toFixed(1)}%
                </div>
                <div className="font-mono" style={{ fontSize: 10, color: m.safe ? '#2D8A50' : '#CC4444' }}>
                  {m.safe ? 'Within the limit' : 'ABOVE THE LIMIT — margin call territory'}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>
                    Margin call if the portfolio falls to{' '}
                    <b className="text-terminal-text-bright">{money(m.trigger, 0)}</b>
                  </div>
                  <div className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>
                    That is a fall of <b style={{ color: '#CC4444' }}>{m.fall.toFixed(1)}%</b> from here
                  </div>
                  <div className="font-mono text-terminal-text-dim" style={{ fontSize: 10 }}>
                    Annual interest cost <b className="text-terminal-gold">{money(m.interest, 0)}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 px-2 py-2" style={{ background: 'rgba(204,68,68,0.1)', border: '1px solid rgba(204,68,68,0.4)' }}>
              <div className="font-mono font-bold text-terminal-red mb-1" style={{ fontSize: 9, letterSpacing: '0.1em' }}>⚠ MARGIN LENDING RISK</div>
              <div className="text-terminal-text-dim leading-relaxed" style={{ fontSize: 10 }}>
                Margin lending amplifies losses as well as gains. A falling market can trigger a margin call
                requiring additional funds or forced asset sales — and it does so precisely when prices are worst
                and selling hurts most. The interest is payable whether the portfolio rises or falls. Seek
                professional advice before using margin.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-terminal-border">
        <div className="panel-header flex items-center gap-2">
          <span>WHERE IS THE SMART MONEY?</span>
          <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">INDICATIVE · illustrative positioning</span>
        </div>
        <table className="terminal-table w-full">
          <thead>
            <tr>
              <th className="px-3 text-left">ASSET</th>
              <th className="px-2 text-right">INSTITUTIONAL LONG</th>
              <th className="px-2 text-right">RETAIL LONG</th>
              <th className="px-2 text-left" style={{ width: 200 }}>SPLIT</th>
              <th className="px-3 text-right">NET SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {POSITIONING.map((p) => (
              <tr key={p.asset} className="border-b border-terminal-border/25">
                <td className="px-3 py-1.5 text-terminal-text-bright" style={{ fontSize: 11 }}>{p.asset}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-terminal-gold" style={{ fontSize: 11 }}>{p.inst}%</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 11 }}>{100 - p.inst}%</td>
                <td className="px-2 py-1.5">
                  <div className="flex h-1.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${p.inst}%`, background: '#C9A84C' }} />
                    <div style={{ width: `${100 - p.inst}%`, background: '#4A6080' }} />
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold" style={{ fontSize: 10, color: sigTone[p.signal] }}>
                  ● {p.signal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-1.5 text-terminal-text-dim/60 leading-snug" style={{ fontSize: 9 }}>
          Illustrative figures in the shape of a Commitment of Traders report. No COT-style feed is connected to
          this build, so these are not measurements — treat the panel as an explanation of what positioning data
          looks like, not as a read on where money currently sits. General information only.
        </div>
      </div>
    </div>
  )
}

// ─── Module ─────────────────────────────────────────────────────────────────

export default function FuturesModule() {
  const [tab, setTab] = useState('futures')
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="FUTURES & DERIVATIVES"
        subtitle="Futures · Options · Market structure — intelligence, not a trading interface"
        moduleId="futures"
        right={<span className="text-terminal-gold text-2xs font-normal normal-case">● LIVE (SIMULATED)</span>}
      />
      <TabBar tabs={TABS} activeKey={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto">
        {tab === 'futures' && <FuturesTab />}
        {tab === 'options' && <OptionsTab />}
        {tab === 'structure' && <StructureTab />}
      </div>
    </div>
  )
}
