import { requireYFSym } from '../../utils/tickerGuard'
import { SECTOR_BY_SYMBOL } from '../portfolio/sectorMap'

// The portfolio's value and P&L from equity quotes, in A$ — shared by the
// Overview's holdings panel and the snapshot widget, and mirroring
// PortfolioModule's own calculation field for field (US quotes converted
// once; an unpriced holding has no market value and is left out of both
// sides of the P&L). priceable: ASX/US holdings; rows: quotes by yfSym.
export function computePortfolioSnapshot(priceable, rows, usdToAud) {
  if (!priceable.length) return null
  let value = 0, cost = 0, dayPnl = 0, dayBase = 0, priced = 0, best = null, worst = null
  // The day's move by sector, value-weighted from the same prev-close base
  // as the total, with the tickers that make it up.
  const sectors = new Map()

  for (const h of priceable) {
    const q = rows[requireYFSym(h)]
    const isAsx = h.type === 'asx'
    const conv = (v) => (v == null ? null : (isAsx ? v : usdToAud(v)))
    const last = conv(q?.last)
    if (last == null) continue

    const avgCostAud = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
    if (avgCostAud == null) continue
    value += last * h.shares
    cost += avgCostAud * h.shares
    priced += 1

    // The day's move, in dollars, from the previous close — a different
    // question from total P&L and the one a reader checks most mornings.
    // Only holdings whose quote carries a previous close contribute, to
    // both the numerator and the base, so the percentage stays honest when
    // some positions lack one.
    const prev = conv(q?.prevClose)
    if (prev != null) {
      dayPnl += (last - prev) * h.shares
      dayBase += prev * h.shares
      const sec = SECTOR_BY_SYMBOL[h.symbol] ?? (h.type === 'us' ? 'US' : 'Other')
      const e = sectors.get(sec) ?? { sector: sec, move: 0, base: 0, syms: [] }
      e.move += (last - prev) * h.shares; e.base += prev * h.shares; e.syms.push(h.symbol)
      sectors.set(sec, e)
    }

    const pct = q?.pct
    if (pct != null) {
      if (!best || pct > best.pct) best = { sym: h.symbol, pct }
      if (!worst || pct < worst.pct) worst = { sym: h.symbol, pct }
    }
  }

  if (!priced) return null
  return {
    value,
    pnl: value - cost,
    pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
    dayPnl: dayBase ? dayPnl : null,
    dayPct: dayBase ? (dayPnl / dayBase) * 100 : null,
    best,
    worst,
    priced,
    sectors: [...sectors.values()]
      .map((e) => ({ ...e, pct: e.base ? (e.move / e.base) * 100 : 0 }))
      .sort((a, b) => b.base - a.base),
  }
}

// Per-holding rows for a table, in A$, largest position first.
export function holdingRows(priceable, rows, usdToAud) {
  const out = []
  for (const h of priceable) {
    const q = rows[requireYFSym(h)]
    const isAsx = h.type === 'asx'
    const last = q?.last == null ? null : isAsx ? q.last : usdToAud(q.last)
    const avg = h.costCurrency === 'USD' ? usdToAud(h.avgCost) : h.avgCost
    out.push({ symbol: h.symbol, last, pct: q?.pct ?? null, value: last == null ? null : last * h.shares, pnlPct: last == null || !avg ? null : ((last - avg) / avg) * 100 })
  }
  const total = out.reduce((s, r) => s + (r.value ?? 0), 0)
  return out.map((r) => ({ ...r, weight: r.value != null && total ? (r.value / total) * 100 : null })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
}

// Rows by the size of the day's move, either way, largest first; rows with
// no move yet go last, in their existing order. The Overview's holdings and
// watchlist are movers lists, so the day's biggest moves lead.
export function byMove(rows, pctOf = (r) => r.pct) {
  return rows
    .map((r, i) => ({ r, i, m: pctOf(r) }))
    .sort((a, b) => (a.m == null) - (b.m == null) || Math.abs(b.m ?? 0) - Math.abs(a.m ?? 0) || a.i - b.i)
    .map((x) => x.r)
}
