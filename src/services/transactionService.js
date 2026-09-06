// Portfolio transaction history.
//
// Holdings answer "what do I own"; transactions answer "what did I do, and
// what did it earn". Those are different questions and the second one cannot
// be reconstructed from the first: a position closed last March leaves no
// trace in a holdings list, and neither does the dividend it paid.
//
// REALISED P&L IS COMPUTED, NEVER TYPED
//
// A SELL's realised gain depends on what the units cost, which depends on
// every BUY before it. Asking the user to enter the number invites them to
// enter a wrong one; deriving it from the ledger means the figure and the
// history cannot disagree. Average cost is used rather than FIFO because that
// is what the rest of this app already shows (`avgCost` on each holding), and
// two cost bases in one product would be worse than either alone.
//
// This is a record of what the user tells us, not tax advice, and the UI says
// so — Australian CGT has parcel-level rules this deliberately does not model.

const KEY = 'maddex_transactions'

export const TX_TYPES = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT']

export const TX_TONE = {
  BUY:      { border: '#2D8A50', label: 'BUY' },
  SELL:     { border: '#A83232', label: 'SELL' },
  DIVIDEND: { border: '#C9A84C', label: 'DIVIDEND' },
  SPLIT:    { border: '#4A7FB5', label: 'SPLIT' },
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota */ }
  return list
}

// Newest first — the order every ledger in finance is read in.
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

export function getTransactions() {
  return read().sort(byDateDesc)
}

export function addTransaction(tx) {
  const list = read()
  const entry = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...tx,
  }
  write([entry, ...list])
  return entry
}

export function deleteTransaction(id) {
  return write(read().filter((t) => t.id !== id))
}

export function clearTransactions() {
  try { localStorage.removeItem(KEY) } catch { /* best effort */ }
}

// ── Auto-generation from holdings ────────────────────────────────────────────
//
// A holding added before this feature existed has no opening BUY, so the
// ledger would show a position with no purchase — the summary would report
// zero invested against a live portfolio.
//
// Idempotent by construction: each generated row carries the holding's id in
// `fromHolding`, and a holding that already has one is skipped. Without that
// key this would duplicate every buy on every mount, and the "total invested"
// figure would climb each time the user opened the tab.
export function syncTransactionsFromHoldings(holdings = []) {
  const list = read()
  const seeded = new Set(list.filter((t) => t.fromHolding).map((t) => t.fromHolding))

  const created = holdings
    .filter((h) => h?.id && !seeded.has(h.id))
    .map((h) => ({
      id: `tx_auto_${h.id}`,
      createdAt: new Date().toISOString(),
      fromHolding: h.id,
      date: h.addedAt ?? h.purchaseDate ?? new Date().toISOString().slice(0, 10),
      type: 'BUY',
      symbol: h.symbol,
      name: h.name,
      units: h.shares,
      price: h.avgCost,
      currency: h.costCurrency ?? 'AUD',
      note: 'Opening position',
      auto: true,
    }))

  // Reports whether anything was actually written, so a caller can avoid
  // re-rendering when there was nothing to seed. Without that signal the
  // caller sets state on every run, and since `holdings` is a fresh array
  // reference on each parent render, the two would drive each other in a loop.
  if (!created.length) return { list: list.sort(byDateDesc), created: 0 }
  return { list: write([...created, ...list]).sort(byDateDesc), created: created.length }
}

// ── Derived figures ──────────────────────────────────────────────────────────

// Gross value of a row, IN ITS OWN CURRENCY. DIVIDEND rows carry the cash
// amount in `price` with no units, so multiplying would zero them out.
export function txValue(t) {
  if (t.type === 'DIVIDEND') return Number(t.price) || 0
  if (t.type === 'SPLIT') return 0
  return (Number(t.units) || 0) * (Number(t.price) || 0)
}

// Same value converted to AUD.
//
// A US holding is recorded at its USD cost — AAPL at US$240 — because that is
// what the user paid and what the holding stores. Summing those beside AUD
// rows without converting reported "TOTAL INVESTED A$80,000" for a book that
// had US$7,200 in it, understating the real figure by roughly the FX spread on
// every US position. The same mistake, in the other direction, produced the
// A$136,060-vs-A$47,587 portfolio disagreement earlier in this project.
//
// `toAud` is the caller's converter (useAudRates). When it is unavailable the
// value is returned unconverted and the UI flags the total as mixed-currency
// rather than printing a confident A$ figure that is not one.
export function txValueAud(t, toAud) {
  const raw = txValue(t)
  if ((t.currency ?? 'AUD') === 'AUD') return raw
  return typeof toAud === 'function' ? (toAud(raw) ?? raw) : raw
}

// Running average cost per symbol, walked oldest-first, so a SELL can be
// priced against what the units actually cost at that moment.
//
// Returns a Map of transaction id -> realised P&L for SELL rows. A sale of
// units never bought (a short, or an import gap) yields null rather than a
// number computed against a cost basis of zero, which would report the entire
// proceeds as profit.
export function realisedByTx(transactions) {
  const out = new Map()
  const book = new Map() // symbol -> { units, cost }

  for (const t of [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const sym = t.symbol
    if (!sym) continue
    const pos = book.get(sym) ?? { units: 0, cost: 0 }

    if (t.type === 'BUY') {
      pos.units += Number(t.units) || 0
      pos.cost += txValue(t)
      book.set(sym, pos)
    } else if (t.type === 'SELL') {
      const units = Number(t.units) || 0
      if (pos.units <= 0 || units <= 0) { out.set(t.id, null); continue }
      const avg = pos.cost / pos.units
      const sold = Math.min(units, pos.units)
      out.set(t.id, (Number(t.price) || 0) * sold - avg * sold)
      pos.units -= sold
      pos.cost -= avg * sold
      book.set(sym, pos)
    } else if (t.type === 'SPLIT') {
      // A split changes the unit count without changing the cost base. `price`
      // carries the ratio (2 for a 2-for-1), so a 2-for-1 doubles units and
      // halves average cost, leaving total cost untouched.
      const ratio = Number(t.price) || 1
      if (ratio > 0) { pos.units *= ratio; book.set(sym, pos) }
    }
  }
  return out
}

export function summarise(transactions, toAud) {
  const realised = realisedByTx(transactions)

  let invested = 0
  let dividends = 0
  let realisedTotal = 0
  let realisedKnown = false
  // Whether any non-AUD row was summed without a converter available.
  let unconverted = false

  for (const t of transactions) {
    const foreign = (t.currency ?? 'AUD') !== 'AUD'
    if (foreign && typeof toAud !== 'function') unconverted = true
    if (t.type === 'BUY') invested += txValueAud(t, toAud)
    else if (t.type === 'DIVIDEND') dividends += txValueAud(t, toAud)
    else if (t.type === 'SELL') {
      const r = realised.get(t.id)
      if (r != null) { realisedTotal += r; realisedKnown = true }
    }
  }

  // Average holding period, over CLOSED positions only.
  //
  // Including open positions would measure "how long ago did I buy", which
  // drifts upward every day the app is not used and is not a holding period at
  // all. A symbol counts once its first sale happens, measured from its first
  // buy — the simplest reading that is defensible.
  const firstBuy = new Map()
  const firstSell = new Map()
  for (const t of transactions) {
    if (!t.symbol || !t.date) continue
    if (t.type === 'BUY' && (!firstBuy.has(t.symbol) || t.date < firstBuy.get(t.symbol))) firstBuy.set(t.symbol, t.date)
    if (t.type === 'SELL' && (!firstSell.has(t.symbol) || t.date < firstSell.get(t.symbol))) firstSell.set(t.symbol, t.date)
  }
  const spans = []
  for (const [sym, sell] of firstSell) {
    const buy = firstBuy.get(sym)
    if (!buy) continue
    const months = (new Date(sell) - new Date(buy)) / (30.44 * 86400000)
    if (Number.isFinite(months) && months >= 0) spans.push(months)
  }
  const avgHoldMonths = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null

  return {
    invested,
    dividends,
    realised: realisedKnown ? realisedTotal : null,
    avgHoldMonths,
    closedPositions: spans.length,
    count: transactions.length,
    unconverted,
  }
}

// ── CSV ──────────────────────────────────────────────────────────────────────
//
// Every field quoted, internal quotes doubled: company names and notes contain
// commas, and one unquoted comma silently shifts every later column in that
// row by one.
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function transactionsToCsv(transactions) {
  const realised = realisedByTx(transactions)
  const headers = ['Date', 'Type', 'Ticker', 'Name', 'Units', 'Price', 'Value', 'Currency', 'Realised P&L', 'Notes']
  const lines = [
    `# Madden Terminal transaction history`,
    `# Exported ${new Date().toLocaleString('en-AU')}`,
    '# Realised P&L is derived from this ledger on an average-cost basis. Not tax advice.',
    headers.map(cell).join(','),
  ]
  for (const t of [...transactions].sort(byDateDesc)) {
    const r = t.type === 'SELL' ? realised.get(t.id) : null
    lines.push([
      t.date, t.type, t.symbol ?? '', t.name ?? '',
      t.type === 'DIVIDEND' ? '' : (t.units ?? ''),
      t.price ?? '', txValue(t).toFixed(2), t.currency ?? 'AUD',
      r == null ? '' : r.toFixed(2), t.note ?? '',
    ].map(cell).join(','))
  }
  return lines.join('\n')
}
