import { useEffect, useMemo, useState } from 'react'
import { defiService } from '../../services/defiService'

// ─── Bitcoin halving countdown ──────────────────────────────────────────────
//
// The halving is a block height, not a date: every 210,000 blocks. The date
// is an estimate — blocks remaining × the network's recent average block
// time, both read live from mempool.space — and is labelled as one. A fixed
// "April 2028" typed into the UI would drift by weeks as hashrate changes.
const HALVING_INTERVAL = 210000

export function HalvingCard() {
  const [state, setState] = useState({ data: null, source: null })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let alive = true
    defiService.getHalvingInputs().then((r) => { if (alive) setState(r) })
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const d = state.data
  if (!d) {
    return (
      <div className="px-3 py-2.5">
        <div className="text-[9px] text-terminal-gold font-bold tracking-widest">NEXT BTC HALVING</div>
        <div className="text-2xs text-terminal-text-dim mt-1">{state.source === 'failed' ? 'Block height unavailable' : 'Loading block height…'}</div>
      </div>
    )
  }
  const nextHeight = Math.ceil((d.height + 1) / HALVING_INTERVAL) * HALVING_INTERVAL
  const remaining = nextHeight - d.height
  const eta = new Date(now + remaining * d.avgBlockMs)
  const days = Math.max(0, Math.round((eta - now) / 86400000))
  const epochPct = ((HALVING_INTERVAL - remaining) / HALVING_INTERVAL) * 100
  const subsidyNow = 50 / 2 ** Math.floor(d.height / HALVING_INTERVAL)

  return (
    <div className="px-3 py-3" style={{ background: 'linear-gradient(180deg, rgba(247,147,26,0.08), transparent)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest" style={{ color: '#f7931a' }}>NEXT BTC HALVING</span>
        <span className="text-[9px] text-terminal-text-dim">block {nextHeight.toLocaleString()}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-mono font-bold tabular-nums text-terminal-text-bright" style={{ fontSize: 24 }}>{days.toLocaleString()}</span>
        <span className="text-2xs text-terminal-text-dim">days · est. {eta.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100,130,160,0.2)' }}>
        <div className="h-full" style={{ width: `${epochPct}%`, background: '#f7931a' }} />
      </div>
      <div className="flex justify-between text-[9px] text-terminal-text-dim mt-1 tabular-nums">
        <span>{remaining.toLocaleString()} blocks to go</span>
        <span>{epochPct.toFixed(1)}% of epoch</span>
      </div>
      <div className="text-[9px] text-terminal-text-dim/80 mt-1.5 leading-snug">
        Block reward falls from {subsidyNow} to {subsidyNow / 2} BTC. Past halvings have preceded strong rallies, but four
        cycles is a small sample. Estimate from the live block height and recent block times · general information only.
      </div>
    </div>
  )
}

// ─── My crypto ──────────────────────────────────────────────────────────────
//
// A deliberately separate, local-only tracker. The main portfolio is
// equity-first and AUD-cost-based; this is for the quick "what is my bag worth"
// check, priced off the same live CoinGecko rows the table shows.
const STORE_KEY = 'maddex_my_crypto_v1'
const load = () => { try { const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const save = (rows) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(rows)) } catch { /* quota */ } }

const money = (v, prefix) => `${v < 0 ? '−' : ''}${prefix}${Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2, minimumFractionDigits: 2 })}`

export function MyCryptoPanel({ markets, currPrefix }) {
  const [rows, setRows] = useState(load)
  const [coin, setCoin] = useState(markets?.[0]?.symbol ?? 'BTC')
  const [units, setUnits] = useState('')
  const [cost, setCost] = useState('')
  const bySym = useMemo(() => Object.fromEntries((markets ?? []).map((m) => [m.symbol, m])), [markets])

  const update = (next) => { setRows(next); save(next) }
  const add = () => {
    const u = Number(units), c = Number(cost)
    if (!(u > 0) || !(c >= 0) || !coin) return
    // Same coin twice merges into one line at a weighted average cost —
    // two BTC rows would make the totals harder to read, not easier.
    const existing = rows.find((r) => r.symbol === coin)
    const next = existing
      ? rows.map((r) => r.symbol === coin ? { ...r, units: r.units + u, avgCost: (r.units * r.avgCost + u * c) / (r.units + u) } : r)
      : [...rows, { symbol: coin, units: u, avgCost: c, addedAt: new Date().toISOString() }]
    update(next)
    setUnits(''); setCost('')
  }

  const priced = rows.map((r) => {
    const m = bySym[r.symbol]
    const value = m ? m.price * r.units : null
    const costBasis = r.avgCost * r.units
    const gain = value != null ? value - costBasis : null
    return { ...r, price: m?.price ?? null, value, gain, pct: gain != null && costBasis > 0 ? (gain / costBasis) * 100 : null }
  })
  const total = priced.reduce((s, r) => s + (r.value ?? 0), 0)
  const totalCost = priced.reduce((s, r) => s + r.avgCost * r.units, 0)
  const totalGain = total - totalCost
  const tone = (v) => (v == null ? '#8BA3C4' : v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)')
  const input = 'bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1.5 font-mono outline-none focus:border-terminal-gold'

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['TOTAL VALUE', money(total, currPrefix), null],
          ['COST BASIS', money(totalCost, currPrefix), null],
          ['GAIN / LOSS', `${totalGain >= 0 ? '+' : ''}${money(totalGain, currPrefix)}${totalCost > 0 ? ` (${((totalGain / totalCost) * 100).toFixed(1)}%)` : ''}`, totalGain],
        ].map(([label, value, t]) => (
          <div key={label} className="border border-terminal-border px-3 py-2">
            <div className="text-[9px] text-terminal-text-dim tracking-widest">{label}</div>
            <div className="font-mono font-bold tabular-nums mt-0.5" style={{ fontSize: 15, color: t == null ? '#E8EDF5' : tone(t) }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap border border-terminal-border p-2">
        <span className="text-[9px] text-terminal-gold font-bold tracking-widest mr-1">ADD HOLDING</span>
        <select value={coin} onChange={(e) => setCoin(e.target.value)} className={input}>
          {(markets ?? []).map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol}</option>)}
        </select>
        <input value={units} onChange={(e) => setUnits(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="units" inputMode="decimal" className={`${input} w-24`} />
        <span className="text-2xs text-terminal-text-dim">@ {currPrefix}</span>
        <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="avg cost / unit" inputMode="decimal" className={`${input} w-32`}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add} className="text-2xs font-bold tracking-widest border border-terminal-gold text-terminal-gold px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">ADD</button>
      </div>

      {priced.length === 0 ? (
        <div className="text-center text-2xs text-terminal-text-dim py-10">No crypto holdings yet. Add one above — it stays in this browser only.</div>
      ) : (
        <table className="w-full text-2xs font-mono">
          <thead>
            <tr className="text-terminal-text-dim text-[9px] tracking-widest border-b border-terminal-border">
              {['COIN', 'UNITS', 'AVG COST', 'CURRENT', 'VALUE', 'GAIN/LOSS', '%', ''].map((h, i) => (
                <th key={h || i} className={`py-1.5 px-2 font-normal ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priced.map((r) => (
              <tr key={r.symbol} className="border-b border-terminal-border/40">
                <td className="py-1.5 px-2 font-bold text-terminal-text-bright">{r.symbol}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{r.units.toLocaleString('en-AU', { maximumFractionDigits: 8 })}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{money(r.avgCost, currPrefix)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{r.price != null ? money(r.price, currPrefix) : '—'}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-terminal-text-bright">{r.value != null ? money(r.value, currPrefix) : '—'}</td>
                <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: tone(r.gain) }}>{r.gain != null ? `${r.gain >= 0 ? '+' : ''}${money(r.gain, currPrefix)}` : '—'}</td>
                <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: tone(r.pct) }}>{r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%` : '—'}</td>
                <td className="py-1.5 px-2 text-right">
                  <button onClick={() => update(rows.filter((x) => x.symbol !== r.symbol))} className="text-terminal-text-dim hover:text-terminal-red" title="Remove">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="text-[9px] text-terminal-text-dim/60">
        Priced live from CoinGecko in {currPrefix === 'A$' ? 'AUD' : 'USD'}. Stored in this browser only. Not financial advice.
      </div>
    </div>
  )
}
