import { useMemo, useState } from 'react'
import { SECTOR_BY_SYMBOL } from './sectorMap'
import { dispatchAskAI } from '../../utils/askAI'

// ─── Portfolio what-if analyser ────────────────────────────────────────────
//
// Models a set of hypothetical trades against the real portfolio and reports
// what changes. The point is the second column: people can usually guess that
// buying more of something raises its weight, but not what it does to their
// largest position, their sector balance, or their concentration.
//
// ONE THING THIS DELIBERATELY DOES NOT PRODUCE: a projected return, a target
// value, or a verdict on whether the trade is good. It reports arithmetic on
// weights the user already owns — every figure here is derived from their own
// holdings and the prices already on screen. Nothing is estimated, forecast
// or recommended, which is what keeps it on the right side of the line the
// rest of the terminal holds.

const sectorOf = (symbol) => SECTOR_BY_SYMBOL[String(symbol).replace(/\.AX$/i, '').toUpperCase()] ?? 'Other'

// Herfindahl-style read on concentration, expressed as a band rather than an
// index. The index itself means nothing to most readers; "one position is a
// third of your book" does.
function concentrationBand(weights) {
  if (!weights.length) return { label: '—', rank: 0 }
  const top = Math.max(...weights)
  const hhi = weights.reduce((s, w) => s + w * w, 0)
  if (top >= 0.35 || hhi >= 0.30) return { label: 'HIGH', rank: 3 }
  if (top >= 0.22 || hhi >= 0.20) return { label: 'MEDIUM', rank: 2 }
  return { label: 'LOW', rank: 1 }
}

// Reduces a set of positions to the metrics the table compares.
function profile(positions) {
  const priced = positions.filter((p) => p.value > 0)
  const total = priced.reduce((s, p) => s + p.value, 0)
  if (total <= 0) {
    return { total: 0, count: priced.length, largest: 0, largestName: '—', sectors: {}, concentration: { label: '—', rank: 0 } }
  }

  const bySymbol = {}
  const sectors = {}
  for (const p of priced) {
    bySymbol[p.symbol] = (bySymbol[p.symbol] ?? 0) + p.value
    const sec = sectorOf(p.symbol)
    sectors[sec] = (sectors[sec] ?? 0) + p.value
  }

  const entries = Object.entries(bySymbol)
  const weights = entries.map(([, v]) => v / total)
  const [largestName, largestVal] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))

  return {
    total,
    count: entries.length,
    largest: largestVal / total,
    largestName,
    sectors: Object.fromEntries(Object.entries(sectors).map(([k, v]) => [k, v / total])),
    concentration: concentrationBand(weights),
  }
}

const pct = (v) => `${(v * 100).toFixed(1)}%`
const money = (v) => `A$${Math.round(v).toLocaleString()}`

// Direction of travel for a row.
//
// `lowerIsBetter` flips the colouring — a falling largest-position weight is
// an improvement, a falling total is not. `neutral` suppresses colour
// entirely, which is what sector weights get: there is no such thing as a
// materials weight moving in a good direction, and colouring one green and
// another red implies a judgement this tool does not make.
function Delta({ before, after, lowerIsBetter = false, neutral = false }) {
  const diff = after - before
  if (Math.abs(diff) < 1e-9) return <span style={{ color: '#637899' }}>→</span>
  const arrow = diff > 0 ? '▲' : '▼'
  if (neutral) return <span style={{ color: '#8BA3C4' }}>{arrow}</span>
  const good = lowerIsBetter ? diff < 0 : diff > 0
  return <span style={{ color: good ? '#2D8A50' : '#C86464', fontWeight: 700 }}>{arrow}</span>
}

export default function WhatIf({ holdings, onOpenAI }) {
  const [trades, setTrades] = useState([])
  const [draft, setDraft] = useState({ action: 'BUY', symbol: '', units: '', price: '' })

  // Only priced, non-crypto equity positions participate. A holding with no
  // quote has no weight to redistribute, and including it at zero would
  // silently understate every other position's share.
  const current = useMemo(
    () => holdings
      .filter((h) => h.mktVal != null && h.mktVal > 0)
      .map((h) => ({ symbol: h.symbol, value: h.mktVal, shares: h.shares })),
    [holdings],
  )

  const before = useMemo(() => profile(current), [current])

  const after = useMemo(() => {
    if (!trades.length) return before
    const next = current.map((p) => ({ ...p }))
    for (const t of trades) {
      const delta = t.units * t.price
      const row = next.find((p) => p.symbol.toUpperCase() === t.symbol.toUpperCase())
      if (t.action === 'BUY') {
        if (row) row.value += delta
        else next.push({ symbol: t.symbol.toUpperCase(), value: delta, shares: t.units })
      } else if (row) {
        // A sell cannot take a position below zero — selling more than you
        // hold is a data-entry slip, not a short position, and modelling it
        // as negative weight would produce percentages that sum past 100.
        row.value = Math.max(0, row.value - delta)
      }
    }
    return profile(next)
  }, [current, trades, before])

  const addTrade = () => {
    const units = Number(draft.units)
    const price = Number(draft.price)
    if (!draft.symbol.trim() || !Number.isFinite(units) || units <= 0 || !Number.isFinite(price) || price <= 0) return
    setTrades((t) => [...t, { ...draft, symbol: draft.symbol.trim().toUpperCase(), units, price }])
    setDraft({ action: 'BUY', symbol: '', units: '', price: '' })
  }

  // Sectors present on either side, so a sector introduced by a trade appears
  // with a 0% "before" rather than being omitted.
  const sectorKeys = useMemo(
    () => [...new Set([...Object.keys(before.sectors), ...Object.keys(after.sectors)])]
      .sort((a, b) => (after.sectors[b] ?? 0) - (after.sectors[a] ?? 0))
      .slice(0, 5),
    [before, after],
  )

  const askAI = () => {
    const summary = trades.map((t) => `${t.action} ${t.units} × ${t.symbol} @ A$${t.price}`).join('; ')
    const book = current.map((p) => `${p.symbol} ${pct(p.value / (before.total || 1))}`).join(', ')
    dispatchAskAI({
      instruction:
        `I am considering the following trade(s): ${summary}. `
        + `My current portfolio by weight is: ${book}. `
        + `After the trade my largest position would move from ${pct(before.largest)} to ${pct(after.largest)} `
        + `and concentration from ${before.concentration.label} to ${after.concentration.label}. `
        + 'What should I consider? Do not state a price target or tell me whether to place the trade.',
    }, { rawPrompt: true })
    onOpenAI?.()
  }

  const rows = [
    { label: 'Total Value',      b: money(before.total),  a: money(after.total),  bn: before.total,  an: after.total },
    { label: '# Holdings',       b: before.count,         a: after.count,         bn: before.count,  an: after.count },
    { label: 'Largest Position', b: pct(before.largest),  a: pct(after.largest),  bn: before.largest, an: after.largest, lower: true,
      note: after.largestName !== before.largestName ? `${before.largestName} → ${after.largestName}` : before.largestName },
    ...sectorKeys.map((s) => ({
      label: `${s} Weight`,
      b: pct(before.sectors[s] ?? 0),
      a: pct(after.sectors[s] ?? 0),
      bn: before.sectors[s] ?? 0,
      an: after.sectors[s] ?? 0,
      muted: true,
      neutral: true,
    })),
    { label: 'Concentration Risk', b: before.concentration.label, a: after.concentration.label,
      bn: before.concentration.rank, an: after.concentration.rank, lower: true },
  ]

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-3 py-3 border-b border-terminal-border">
        <div className="text-terminal-gold text-2xs font-bold tracking-widest">PORTFOLIO WHAT-IF ANALYSER</div>
        <div className="text-2xs text-terminal-text-dim mt-0.5">Model changes to your portfolio before making them.</div>
      </div>

      {current.length === 0 ? (
        <div className="px-6 py-12 text-center text-2xs text-terminal-text-dim">
          Add priced holdings to model changes against them.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* ── Proposed changes ── */}
          <div className="border-r border-terminal-border p-3">
            <div className="text-2xs font-bold text-terminal-text-bright tracking-widest mb-2">SIMULATE A TRADE</div>

            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <div className="flex border border-terminal-border rounded-sm overflow-hidden">
                {['BUY', 'SELL'].map((a) => (
                  <button key={a} onClick={() => setDraft((d) => ({ ...d, action: a }))}
                    className={`text-2xs px-2 py-1 font-bold transition-colors ${draft.action === a ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                  >{a}</button>
                ))}
              </div>
              <input value={draft.symbol} onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value }))}
                placeholder="TICKER" aria-label="Ticker"
                className="bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-2 py-1 w-24 uppercase focus:border-terminal-gold focus:outline-none" />
              <input value={draft.units} onChange={(e) => setDraft((d) => ({ ...d, units: e.target.value }))}
                type="number" placeholder="UNITS" aria-label="Units"
                className="bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-2 py-1 w-20 tabular-nums focus:border-terminal-gold focus:outline-none" />
              <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') addTrade() }}
                type="number" step="0.01" placeholder="PRICE" aria-label="Price"
                className="bg-terminal-bg border border-terminal-border text-terminal-text-bright text-2xs px-2 py-1 w-24 tabular-nums focus:border-terminal-gold focus:outline-none" />
              <button onClick={addTrade}
                className="text-2xs font-bold px-2.5 py-1 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >+ ADD</button>
            </div>

            {trades.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/60 py-2">No simulated trades yet.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {trades.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-2xs px-2 py-1"
                    style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
                    <span className="font-bold" style={{ color: t.action === 'BUY' ? '#2D8A50' : '#C86464' }}>{t.action}</span>
                    <span className="text-terminal-text-bright">{t.units} × {t.symbol}</span>
                    <span className="text-terminal-text-dim">@ A${t.price.toFixed(2)}</span>
                    <span className="text-terminal-text-dim ml-auto tabular-nums">{money(t.units * t.price)}</span>
                    <button onClick={() => setTrades((x) => x.filter((_, j) => j !== i))}
                      className="text-terminal-text-dim hover:text-terminal-red">✕</button>
                  </div>
                ))}
                <button onClick={() => setTrades([])}
                  className="text-2xs text-terminal-text-dim hover:text-terminal-red self-start mt-1">CLEAR ALL</button>
              </div>
            )}
          </div>

          {/* ── Projected impact ── */}
          <div className="p-3">
            <div className="text-2xs font-bold text-terminal-text-bright tracking-widest mb-2">PROJECTED IMPACT</div>
            <table className="w-full text-2xs">
              <thead>
                <tr className="text-terminal-text-dim border-b border-terminal-border">
                  <th className="text-left font-normal py-1">METRIC</th>
                  <th className="text-right font-normal py-1">CURRENT</th>
                  <th className="text-center font-normal py-1 w-6"></th>
                  <th className="text-right font-normal py-1">AFTER</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-terminal-border/30">
                    <td className={`py-1 ${r.muted ? 'text-terminal-text-dim' : 'text-terminal-text'}`}>
                      {r.label}
                      {r.note && <div className="text-[9px] text-terminal-text-dim/60">{r.note}</div>}
                    </td>
                    <td className="py-1 text-right tabular-nums text-terminal-text-dim">{r.b}</td>
                    <td className="py-1 text-center">
                      {trades.length > 0 && <Delta before={r.bn} after={r.an} lowerIsBetter={r.lower} neutral={r.neutral} />}
                    </td>
                    <td className="py-1 text-right tabular-nums text-terminal-text-bright font-semibold">{r.a}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {trades.length > 0 && (
              <button onClick={askAI}
                className="w-full mt-3 text-2xs font-bold py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
              >ASK MADDENAI ABOUT THIS TRADE ▶</button>
            )}

            <div style={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, color: '#4A6080',
              letterSpacing: '0.1em', marginTop: 10, paddingTop: 8,
              borderTop: '1px solid rgba(201,168,76,0.1)',
            }}>
              ⓘ GENERAL INFORMATION ONLY — NOT ADVICE. Figures are arithmetic on your own
              holdings at the prices shown. No return, valuation or outcome is projected.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
