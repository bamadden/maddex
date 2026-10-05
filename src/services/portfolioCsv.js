// ─── Portfolio CSV import / export ──────────────────────────────────────────
//
// Pure functions (no React, no storage except the import log) so the parser
// and validator can be exercised from node as well as the modal.
//
// Every imported row becomes its own LOT — a holding with its own units,
// price and date. Merging lots into one averaged row at import time would
// destroy the per-parcel cost basis a tax return needs; the portfolio views
// aggregate lots per symbol where they need one figure (see mergeLots).

import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from './mockData.js'
import { AU_ETFS } from '../data/etfData.js'

// Symbol classification lives here so the add form and the importer agree on
// what is ASX, US or crypto. PortfolioModule imports these.
export const CRYPTO_SYMS = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','AVAX','DOGE','DOT','MATIC','LINK','LTC','ATOM','OP','ARB','NEAR','APT','SUI'])
export const ASX_KNOWN   = new Set(['BHP','CBA','CSL','ANZ','WBC','NAB','WOW','RIO','MQG','TLS','FMG','MIN','PLS','WDS','ORG','REA','WTC','XRO','AGL','IAG','QBE','STO','WPL','ALL','GMG'])

export function detectType(sym) {
  const s = sym.toUpperCase().replace(/\.AX$|:ASX$/, '').trim()
  if (CRYPTO_SYMS.has(s)) return 'crypto'
  const raw = sym.toUpperCase()
  if (raw.endsWith('.AX') || raw.endsWith(':ASX') || ASX_KNOWN.has(s)) return 'asx'
  return 'us'
}

export function cleanSymbol(sym, type) {
  const s = sym.toUpperCase().trim()
  if (type === 'asx') return s.replace(/\.AX$|:ASX$/, '')
  return s
}

const yahooSym = (sym, type) => (type === 'asx' ? `${sym}.AX` : type === 'crypto' ? `${sym}-USD` : sym)

const KNOWN_NAMES = {
  ...Object.fromEntries(Object.entries(MOCK_ASX_STOCKS).map(([k, v]) => [k.replace(/\.AX$/, ''), v.name])),
  ...Object.fromEntries(Object.entries(MOCK_US_STOCKS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(AU_ETFS.map((e) => [e.ticker, e.name])),
}
export const nameFor = (symbol) => KNOWN_NAMES[symbol] ?? symbol

export const TEMPLATE_CSV = [
  'Symbol,Units,Purchase Price (AUD),Purchase Date',
  'BHP.AX,100,43.21,2026-01-15',
  'CBA.AX,50,148.20,2025-11-03',
  'VAS.AX,200,88.40,2025-06-01',
].join('\n') + '\n'

// ── Parsing ──────────────────────────────────────────────────────────────────

// RFC 4180: quoted fields, doubled quotes, CRLF. Lines starting with '#' are
// comments — which is what lets an EXPORT be re-imported unchanged.
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  const src = String(text ?? '').replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim() !== '') && !r[0].trim().startsWith('#'))
}

// Header → field. Letters only, so "Purchase Price (AUD)", "purchase_price"
// and "PurchasePrice" all match; the aliases cover the column names broker
// exports commonly use, so a renamed file is the exception, not the rule.
const HEADER_ALIASES = {
  symbol: ['symbol', 'code', 'ticker', 'stock', 'security', 'asxcode'],
  units:  ['units', 'qty', 'quantity', 'shares', 'unitsheld', 'holding'],
  price:  ['purchaseprice', 'purchasepriceaud', 'avgcost', 'averagecost', 'avgprice', 'averageprice', 'costprice', 'buyprice', 'price'],
  date:   ['purchasedate', 'date', 'tradedate', 'buydate', 'acquired', 'acquireddate'],
}
const normHeader = (h) => h.toLowerCase().replace(/[^a-z]/g, '')

export function mapHeaders(headerRow) {
  const map = {}
  headerRow.forEach((h, i) => {
    const n = normHeader(h)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] == null && aliases.includes(n)) map[field] = i
    }
  })
  return map
}

const parseNumber = (s) => {
  const t = String(s ?? '').trim().replace(/^(A|US)?\$/i, '').replace(/[,\s]/g, '')
  if (!/^-?\d*\.?\d+$/.test(t)) return NaN
  return Number(t)
}

// ISO (2026-01-15) or Australian day-first (15/01/2026). A US-style
// month-first date is not guessed at: 03/11/2025 is read as 3 November.
export function parseDate(s) {
  const t = String(s ?? '').trim()
  let y, m, d
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (mt) [, y, m, d] = mt.map(Number)
  else if ((mt = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +mt[1]; m = +mt[2]; y = +mt[3] }
  else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const localToday = () => new Date().toLocaleDateString('en-CA')

// ── Validation ───────────────────────────────────────────────────────────────

// Returns { error } for a file that can't be read at all, or { rows } with a
// status per row. Nothing is added here; the modal decides.
export function validateCsv(text, { today = localToday() } = {}) {
  const table = parseCsv(text)
  if (table.length === 0) return { error: 'The file is empty.' }
  const cols = mapHeaders(table[0])
  const missing = ['symbol', 'units', 'price', 'date'].filter((f) => cols[f] == null)
  if (missing.length) {
    const names = { symbol: 'Symbol', units: 'Units', price: 'Purchase Price', date: 'Purchase Date' }
    return { error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.map((f) => names[f]).join(', ')}. Download the template for the expected header.` }
  }
  if (table.length === 1) return { error: 'The file has a header but no rows.' }

  const rows = table.slice(1).map((r, i) => {
    const get = (f) => String(r[cols[f]] ?? '').trim()
    const errors = [], warnings = []
    const rawSym = get('symbol').toUpperCase()
    const rawUnits = get('units'), rawPrice = get('price'), rawDate = get('date')

    let symbol = null, type = null
    if (!rawSym) errors.push('Symbol missing')
    else if (!/^[A-Z0-9][A-Z0-9.:-]{0,14}$/.test(rawSym)) errors.push(`"${rawSym}" is not a valid symbol`)
    else {
      type = detectType(rawSym)
      symbol = cleanSymbol(rawSym, type)
      const suffixed = /\.AX$|:ASX$/.test(rawSym)
      if (type === 'asx' && !suffixed) warnings.push(`No .AX — matched to ASX ${symbol}.AX`)
      else if (type === 'us') warnings.push('No .AX — imported as a US listing')
    }

    const units = parseNumber(rawUnits)
    if (!rawUnits) errors.push('Units missing')
    else if (!Number.isFinite(units) || units <= 0) errors.push(`Units "${rawUnits}" must be a positive number`)

    const price = parseNumber(rawPrice)
    if (!rawPrice) errors.push('Purchase price missing')
    else if (!Number.isFinite(price) || price <= 0) errors.push(`Price "${rawPrice}" must be a positive number`)

    const date = rawDate ? parseDate(rawDate) : null
    if (!rawDate) errors.push('Purchase date missing')
    else if (!date) errors.push(`Date "${rawDate}" — use YYYY-MM-DD or DD/MM/YYYY`)
    else if (date > today) errors.push(`Date ${date} is in the future`)

    return {
      line: i + 2,
      symbol, type, units, price, date,
      display: { symbol: rawSym, units: rawUnits, price: rawPrice, date: rawDate },
      errors, warnings,
      valid: errors.length === 0,
    }
  })
  return { rows }
}

// A validated row → the holding shape PortfolioModule stores.
export function rowToHolding(row, idSeed) {
  return {
    id:           `csv-${idSeed}`,
    symbol:       row.symbol,
    yfSym:        yahooSym(row.symbol, row.type),
    name:         nameFor(row.symbol),
    shares:       row.units,
    avgCost:      row.price,
    costCurrency: 'AUD',
    type:         row.type,
    addedAt:      row.date,
  }
}

// ── Lots → positions ─────────────────────────────────────────────────────────

// Several lots of one security become one position for every aggregate view
// (allocation, analytics, stress test). Costs and values sum; the average
// cost is the cost-weighted one; the earliest lot dates the position.
export function mergeLots(computed) {
  const out = new Map()
  for (const h of computed) {
    const key = `${h.type}:${h.symbol}`
    const p = out.get(key)
    if (!p) { out.set(key, { ...h, lots: 1 }); continue }
    const shares = p.shares + h.shares
    const totalCost = p.totalCost + h.totalCost
    const mktVal = p.mktVal != null && h.mktVal != null ? p.mktVal + h.mktVal : null
    const pnl = mktVal != null ? mktVal - totalCost : null
    out.set(key, {
      ...p,
      shares,
      totalCost,
      avgCost: totalCost / shares,
      costCurrency: 'AUD',
      mktVal,
      pnl,
      pnlPct: pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null,
      addedAt: h.addedAt < p.addedAt ? h.addedAt : p.addedAt,
      lots: p.lots + 1,
    })
  }
  return [...out.values()]
}

// ── Export ───────────────────────────────────────────────────────────────────

const cell = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const num = (v, dp = 2) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(dp))
// Unit prices: cents for anything over a dollar, four places below it (a
// small-cap or a sub-dollar coin loses its meaning at two).
const unitPrice = (v) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(Math.abs(v) >= 1 ? 2 : 4))

// One row per lot, in AUD. The leading comment lines are skipped by
// parseCsv, so an export round-trips through IMPORT unchanged.
export function holdingsToCsv(lots, { sectorOf = () => '', date = new Date() } = {}) {
  const stamp = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const lines = [
    `# Maddex Portfolio Export — ${stamp}`,
    '# General information only — not financial advice',
    'Symbol,Company,Units,Purchase Price (AUD),Purchase Date,Current Price (AUD),Total Cost (AUD),Current Value (AUD),P&L (AUD),P&L%,Sector',
  ]
  for (const h of lots) {
    const avgCostAud = h.totalCost != null && h.shares ? h.totalCost / h.shares : h.avgCost
    lines.push([
      h.type === 'asx' ? `${h.symbol}.AX` : h.symbol,
      h.name ?? h.symbol,
      h.shares,
      unitPrice(avgCostAud),
      h.addedAt ?? '',
      unitPrice(h.last),
      num(h.totalCost),
      num(h.mktVal),
      num(h.pnl),
      num(h.pnlPct),
      sectorOf(h) ?? '',
    ].map(cell).join(','))
  }
  return lines.join('\n') + '\n'
}

export const exportFilename = (date = new Date()) => `maddex-portfolio-${date.toLocaleDateString('en-CA')}.csv`

export function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Import history ───────────────────────────────────────────────────────────

const HISTORY_KEY = 'maddex_portfolio_imports'

export function getImportHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

export function logImport({ source = 'CSV', holdingsAdded, holdingsSkipped, holdingsReplaced = 0 }) {
  const entry = { date: new Date().toISOString(), source, holdingsAdded, holdingsSkipped, holdingsReplaced }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...getImportHistory()].slice(0, 20))) } catch { /* private mode */ }
  return entry
}
