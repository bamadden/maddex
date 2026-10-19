// Everything the watchlist knows about a symbol beyond "it is on the list".
//
// A SIDECAR, DELIBERATELY.
//
// useStore keeps the watchlist as a flat array of symbol strings, and a dozen
// things read it that way — the command bar, the news watchlist highlight, the
// dashboard widget, the earnings stars. Changing that array into objects to
// carry a note would mean touching every one of them, and any consumer missed
// would silently start comparing a string to an object and quietly match
// nothing.
//
// So this is keyed BY symbol and layered on top. The array stays the source of
// truth for membership; this file answers everything else.

const KEY = 'maddex_watchlist_meta'

export const GROUP_COLOURS = {
  gold:   '#C9A84C',
  blue:   '#4A7FB5',
  green:  '#2D8A50',
  purple: '#7C6BC4',
}

export const DEFAULT_GROUPS = [
  { id: 'favourites', name: 'FAVOURITES', colour: 'gold' },
  { id: 'watching',   name: 'WATCHING',   colour: 'blue' },
  { id: 'tracked',    name: 'PORTFOLIO TRACKED', colour: 'green' },
  { id: 'research',   name: 'SECTOR RESEARCH', colour: 'purple' },
]

const EMPTY = { groups: DEFAULT_GROUPS, bySymbol: {} }

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return EMPTY
    return {
      groups: Array.isArray(parsed.groups) && parsed.groups.length ? parsed.groups : DEFAULT_GROUPS,
      bySymbol: parsed.bySymbol && typeof parsed.bySymbol === 'object' ? parsed.bySymbol : {},
    }
  } catch { return EMPTY }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota */ }
  return state
}

export const getMeta = () => read()
export const metaFor = (symbol) => read().bySymbol[symbol] ?? null

// ─── Notes ───────────────────────────────────────────────────────────────────

export function setNote(symbol, note) {
  const s = read()
  const trimmed = String(note ?? '').slice(0, 200)
  const entry = { ...(s.bySymbol[symbol] ?? {}), note: trimmed || undefined }
  if (!entry.note) delete entry.note
  return write({ ...s, bySymbol: { ...s.bySymbol, [symbol]: entry } })
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export function setGroup(symbol, groupId) {
  const s = read()
  const entry = { ...(s.bySymbol[symbol] ?? {}), group: groupId || undefined }
  if (!entry.group) delete entry.group
  return write({ ...s, bySymbol: { ...s.bySymbol, [symbol]: entry } })
}

export function addGroup(name, colour = 'gold') {
  const s = read()
  const id = `g_${Date.now().toString(36)}`
  return write({ ...s, groups: [...s.groups, { id, name: String(name).toUpperCase().slice(0, 24), colour }] })
}

export function removeGroup(groupId) {
  const s = read()
  // Symbols in a deleted group become ungrouped rather than disappearing —
  // deleting a folder should never look like deleting its contents.
  const bySymbol = Object.fromEntries(
    Object.entries(s.bySymbol).map(([sym, v]) => [sym, v.group === groupId ? { ...v, group: undefined } : v]),
  )
  return write({ groups: s.groups.filter((g) => g.id !== groupId), bySymbol })
}

// ─── Price targets ───────────────────────────────────────────────────────────
//
// One target per symbol, in A$ (the currency the watchlist displays — a US
// stock's target moves with the exchange rate, as its displayed price does).
// The direction is fixed when the target is set: a target above the price
// then is an upside target, hit when the price reaches it; one below is a
// downside target, hit when the price falls to it. Without that, a "sell if
// it drops to" level would read as already hit the moment it was saved.
export function setTarget(symbol, target, priceNow) {
  const s = read()
  const cur = { ...(s.bySymbol[symbol] ?? {}) }
  if (Number.isFinite(target) && target > 0) {
    cur.target = { price: target, dir: Number.isFinite(priceNow) && target < priceNow ? 'down' : 'up', setAt: new Date().toISOString() }
  } else {
    delete cur.target
  }
  return write({ ...s, bySymbol: { ...s.bySymbol, [symbol]: cur } })
}

// { price, dir, hit, gap, gapPct } — gap in A$ from the current price to the
// target, gapPct as a share of the current price. Null without a target.
export function targetStatus(symbol, price) {
  const t = metaFor(symbol)?.target
  if (!t?.price || !Number.isFinite(price) || price <= 0) return t?.price ? { ...t, hit: false, gap: null, gapPct: null } : null
  const hit = t.dir === 'down' ? price <= t.price : price >= t.price
  const gap = t.price - price
  return { ...t, hit, gap, gapPct: (gap / price) * 100 }
}

// ─── Price when added ────────────────────────────────────────────────────────
//
// Recorded the first time a symbol is seen with a price, not when it is added
// — at the moment of adding, the quote has usually not arrived yet, and
// storing a null would permanently poison the "since added" column for that
// stock with no way for the user to tell why it says nothing.
export function rememberEntryPrice(symbol, price) {
  if (!Number.isFinite(price) || price <= 0) return read()
  const s = read()
  const cur = s.bySymbol[symbol] ?? {}
  if (cur.entryPrice != null) return s          // never overwrite
  return write({
    ...s,
    bySymbol: { ...s.bySymbol, [symbol]: { ...cur, entryPrice: price, entryAt: new Date().toISOString() } },
  })
}

export function sinceAdded(symbol, currentPrice) {
  const m = metaFor(symbol)
  if (!m?.entryPrice || !Number.isFinite(currentPrice) || m.entryPrice <= 0) return null
  return {
    entryPrice: m.entryPrice,
    entryAt: m.entryAt ?? null,
    pct: ((currentPrice - m.entryPrice) / m.entryPrice) * 100,
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// Plain-text table for the clipboard: fixed-width columns so it lines up in
// an email, a chat message or a notes app. `demo` adds a line saying the
// prices are demo data, which they are until a live equities feed exists.
const pad = (s, n) => String(s).slice(0, n).padEnd(n)

export function watchlistToText(rows, { date = new Date(), demo = false } = {}) {
  const stamp = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const lines = [
    `My Maddex Watchlist — ${stamp}`,
    'Generated by Maddex · maddex.com.au',
    '',
    `${pad('TICKER', 8)}| ${pad('COMPANY', 21)}| ${pad('PRICE', 13)}| TODAY`,
  ]
  for (const r of rows) {
    const price = r.price != null ? `A$${r.price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
    const chg = r.pct != null ? `${r.pct >= 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(2)}%` : '—'
    lines.push(`${pad(r.symbol, 8)}| ${pad(r.name ?? '', 21)}| ${pad(price, 13)}| ${chg}`)
  }
  lines.push('')
  if (demo) lines.push('Equity prices are demo data, not live quotes.')
  lines.push('General information only — not financial advice.')
  return lines.join('\n')
}

const num = (v, dp = 2) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(dp))

export function watchlistToCsv(rows) {
  const headers = ['Symbol', 'Name', 'Group', 'Price (AUD)', 'Change %', '52W Low', '52W High', 'Off High %', 'Volume', 'Volume vs Avg', 'Market Cap', 'Target (AUD)', 'Since Added %', 'Note']
  const lines = [
    '# Madden Terminal watchlist',
    `# Exported ${new Date().toLocaleString('en-AU')}`,
    '# Equity prices are DEMO data. General information only, not advice.',
    headers.map(cell).join(','),
  ]
  for (const r of rows) {
    lines.push([
      r.symbol, r.name ?? '', r.groupName ?? '',
      num(r.price), num(r.pct), num(r.week52Low), num(r.week52High), num(r.offHigh),
      r.volume ?? '', num(r.volRatio, 2), r.marketCap != null ? Math.round(r.marketCap) : '',
      num(r.target), num(r.sincePct), r.note ?? '',
    ].map(cell).join(','))
  }
  return lines.join('\n')
}
