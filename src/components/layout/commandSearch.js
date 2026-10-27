// Search and intent helpers for the command bar. Pure: no React, no store, no
// fetches — so every rule here can be exercised from a console or a test and
// the bar's preview, suggestions and execute() all read the same answers.

import { ASX_SECTOR_STOCKS } from '../../data/sectorTaxonomy'
import { BOND_MARKETS, BOND_CURVES } from '../../data/bondCurves'
import { compound } from '../../modules/calculators/calcMath'

// ─── Symbol catalogue ───────────────────────────────────────────────────────
// `aka` carries the names people actually type that are not in the
// description — "commbank", "csl behring". Everything else is matched from the
// description's company name.

export const KNOWN_SYMBOLS = [
  // ASX — blue chips
  { sym:'BHP.AX',  label:'BHP',    type:'asx',   desc:'BHP Group · Mining', aka:['BHP Billiton'] },
  { sym:'CBA.AX',  label:'CBA',    type:'asx',   desc:'Commonwealth Bank · Finance', aka:['CommBank', 'Commonwealth Bank of Australia'] },
  { sym:'CSL.AX',  label:'CSL',    type:'asx',   desc:'CSL Limited · Healthcare', aka:['CSL Behring', 'CSL Seqirus'] },
  { sym:'ANZ.AX',  label:'ANZ',    type:'asx',   desc:'ANZ Banking Group · Finance', aka:['ANZ Bank'] },
  { sym:'WBC.AX',  label:'WBC',    type:'asx',   desc:'Westpac Banking · Finance' },
  { sym:'NAB.AX',  label:'NAB',    type:'asx',   desc:'National Australia Bank · Finance' },
  { sym:'WOW.AX',  label:'WOW',    type:'asx',   desc:'Woolworths Group · Consumer', aka:['Woolies'] },
  { sym:'WES.AX',  label:'WES',    type:'asx',   desc:'Wesfarmers · Conglomerate', aka:['Bunnings'] },
  { sym:'RIO.AX',  label:'RIO',    type:'asx',   desc:'Rio Tinto · Mining' },
  { sym:'FMG.AX',  label:'FMG',    type:'asx',   desc:'Fortescue · Iron Ore', aka:['Fortescue Metals'] },
  { sym:'MQG.AX',  label:'MQG',    type:'asx',   desc:'Macquarie Group · Finance' },
  { sym:'TLS.AX',  label:'TLS',    type:'asx',   desc:'Telstra · Telecoms' },
  { sym:'WDS.AX',  label:'WDS',    type:'asx',   desc:'Woodside Energy · Energy' },
  { sym:'STO.AX',  label:'STO',    type:'asx',   desc:'Santos · Energy' },
  { sym:'MIN.AX',  label:'MIN',    type:'asx',   desc:'Mineral Resources · Mining' },
  { sym:'PLS.AX',  label:'PLS',    type:'asx',   desc:'Pilbara Minerals · Lithium' },
  { sym:'NXT.AX',  label:'NXT',    type:'asx',   desc:'NextDC · Data Centres' },
  { sym:'QAN.AX',  label:'QAN',    type:'asx',   desc:'Qantas Airways · Transport' },
  { sym:'AMC.AX',  label:'AMC',    type:'asx',   desc:'Amcor · Packaging' },
  { sym:'GMG.AX',  label:'GMG',    type:'asx',   desc:'Goodman Group · REITs' },
  // US mega-caps
  { sym:'AAPL',    label:'AAPL',   type:'us',    desc:'Apple Inc · NASDAQ' },
  { sym:'MSFT',    label:'MSFT',   type:'us',    desc:'Microsoft · NASDAQ' },
  { sym:'GOOGL',   label:'GOOGL',  type:'us',    desc:'Alphabet · NASDAQ', aka:['Google'] },
  { sym:'AMZN',    label:'AMZN',   type:'us',    desc:'Amazon · NASDAQ' },
  { sym:'META',    label:'META',   type:'us',    desc:'Meta Platforms · NASDAQ', aka:['Facebook'] },
  { sym:'NVDA',    label:'NVDA',   type:'us',    desc:'NVIDIA · NASDAQ' },
  { sym:'TSLA',    label:'TSLA',   type:'us',    desc:'Tesla · NASDAQ' },
  { sym:'BRK-B',   label:'BRK-B',  type:'us',    desc:'Berkshire Hathaway · NYSE' },
  { sym:'JPM',     label:'JPM',    type:'us',    desc:'JPMorgan Chase · NYSE' },
  { sym:'BAC',     label:'BAC',    type:'us',    desc:'Bank of America · NYSE' },
  { sym:'XOM',     label:'XOM',    type:'us',    desc:'ExxonMobil · NYSE' },
  { sym:'V',       label:'V',      type:'us',    desc:'Visa · NYSE' },
  // Indices
  { sym:'^AXJO',   label:'^AXJO',  type:'index', desc:'ASX 200 · Index' },
  { sym:'^GSPC',   label:'^GSPC',  type:'index', desc:'S&P 500 · Index' },
  { sym:'^IXIC',   label:'^IXIC',  type:'index', desc:'NASDAQ Composite · Index' },
  { sym:'^DJI',    label:'^DJI',   type:'index', desc:'Dow Jones Industrial · Index' },
  { sym:'^FTSE',   label:'^FTSE',  type:'index', desc:'FTSE 100 · Index' },
  { sym:'^N225',   label:'^N225',  type:'index', desc:'Nikkei 225 · Index' },
  { sym:'^HSI',    label:'^HSI',   type:'index', desc:'Hang Seng · Index' },
  { sym:'^VIX',    label:'^VIX',   type:'index', desc:'CBOE Volatility · Index' },
  // Crypto
  { sym:'BTC',     label:'BTC',    type:'crypto', desc:'Bitcoin · Crypto' },
  { sym:'ETH',     label:'ETH',    type:'crypto', desc:'Ethereum · Crypto' },
  { sym:'SOL',     label:'SOL',    type:'crypto', desc:'Solana · Crypto' },
  { sym:'BNB',     label:'BNB',    type:'crypto', desc:'BNB · Crypto' },
  { sym:'XRP',     label:'XRP',    type:'crypto', desc:'XRP · Crypto', aka:['Ripple'] },
  { sym:'ADA',     label:'ADA',    type:'crypto', desc:'Cardano · Crypto' },
  { sym:'DOGE',    label:'DOGE',   type:'crypto', desc:'Dogecoin · Crypto' },
  { sym:'AVAX',    label:'AVAX',   type:'crypto', desc:'Avalanche · Crypto' },
  // FX
  { sym:'AUD/USD', label:'AUD/USD', type:'fx',  desc:'Australian Dollar vs USD', aka:['Aussie dollar'] },
  { sym:'AUD/EUR', label:'AUD/EUR', type:'fx',  desc:'Australian Dollar vs EUR' },
  { sym:'AUD/JPY', label:'AUD/JPY', type:'fx',  desc:'Australian Dollar vs JPY' },
  { sym:'AUD/GBP', label:'AUD/GBP', type:'fx',  desc:'Australian Dollar vs GBP' },
  { sym:'USD/JPY', label:'USD/JPY', type:'fx',  desc:'US Dollar vs Japanese Yen' },
  { sym:'EUR/USD', label:'EUR/USD', type:'fx',  desc:'Euro vs US Dollar' },
]

// The sector taxonomy is the single source for which ASX names sit in which
// sector, so the catalogue folds it in rather than keeping a second list:
// "cochlear" and "xero" are findable without being typed out twice.
const SECTOR_OF = {}
for (const [sector, rows] of Object.entries(ASX_SECTOR_STOCKS)) {
  for (const [sym] of rows) SECTOR_OF[sym] ??= sector
}

const CATALOGUE = (() => {
  const seen = new Set(KNOWN_SYMBOLS.map((k) => k.sym))
  const extra = []
  for (const [sector, rows] of Object.entries(ASX_SECTOR_STOCKS)) {
    for (const [sym, name] of rows) {
      if (seen.has(sym)) continue
      seen.add(sym)
      extra.push({ sym, label: sym.replace(/\.AX$/, ''), type: 'asx', desc: `${name} · ${sector}` })
    }
  }
  return [...KNOWN_SYMBOLS, ...extra].map((e) => {
    const names = [e.desc.split(' · ')[0], ...(e.aka ?? [])].map(norm)
    return {
      ...e,
      sector: SECTOR_OF[e.sym] ?? null,
      _names: names,
      _tokens: new Set(names.flatMap((n) => n.split(' '))),
      _compact: names.map((n) => n.replace(/ /g, '')),
    }
  })
})()

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9^/.& -]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Shorthand people type for words that appear in company names.
const ABBR = { grp: 'group', hldgs: 'holdings', corp: 'corporation', intl: 'international', aust: 'australia', bk: 'bank', min: 'minerals' }
// Words that may appear in a query without matching the company name — "rio
// tinto limited", "bhp shares" — but cannot match on their own.
const SOFT = new Set(['the', 'stock', 'stocks', 'share', 'shares', 'ltd', 'limited', 'inc', 'co', 'asx', 'plc', 'group', 'holdings', 'corporation', 'company'])

// Optimal string alignment distance: Levenshtein plus adjacent transposition,
// which is the commonest typing slip ("commonweatlh").
function osa(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// 100 exact ticker · 96 exact name · 86–95 ticker prefix · 80 every word
// matches the name · 60/50 within one or two typos. 0 is no match.
const TICKER_PREFIX = (s) => s >= 86 && s <= 95
function scoreEntry(e, q) {
  const Q = q.toUpperCase()
  if (e.label.toUpperCase() === Q || e.sym.toUpperCase() === Q) return 100
  if (e.label.toUpperCase().startsWith(Q) || e.sym.toUpperCase().startsWith(Q)) return 95 - Math.min(9, e.label.length - Q.length)

  const words = norm(q).split(' ').filter(Boolean).map((w) => ABBR[w] ?? w)
  const label = e.label.toLowerCase()
  const matches = (w) => w === label || [...e._tokens].some((t) => t.startsWith(w) && (w.length >= 2 || t === w))
  let hard = 0, ok = true
  for (const w of words) {
    if (matches(w)) { if (!SOFT.has(w)) hard++ }
    else if (!SOFT.has(w)) { ok = false; break }
  }
  if (ok && hard > 0) return e._names.some((n) => n === words.join(' ')) ? 96 : 80

  const compact = words.join('')
  if (compact.length < 5) return 0
  const budget = compact.length >= 8 ? 2 : 1
  let best = Infinity
  for (const c of e._compact) {
    for (const len of [compact.length - 1, compact.length, compact.length + 1]) {
      if (len > 0 && len <= c.length) best = Math.min(best, osa(compact, c.slice(0, len)))
    }
  }
  return best <= budget ? 60 - 10 * best : 0
}

// Ranked catalogue matches for a free-text query.
export function searchCatalogue(query, limit = 12) {
  const q = String(query ?? '').trim()
  if (!q) return []
  return CATALOGUE
    .map((e) => ({ e, s: scoreEntry(e, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.label.length - b.e.label.length)
    .slice(0, limit)
    .map(({ e, s }) => ({ sym: e.sym, label: e.label, type: e.type, desc: e.desc, sector: e.sector, score: s }))
}

// The one asset a phrase unambiguously names, or null. Stricter than search:
// a ticker prefix ("CB") is a suggestion, not a resolution, and "bank" names
// four companies so it names none of them.
export function resolveAsset(raw) {
  const q = String(raw ?? '').trim()
  if (!q) return null
  const [top, next] = searchCatalogue(q, 4).filter((h) => !TICKER_PREFIX(h.score))
  if (!top) return null
  if (top.score >= 96) return top
  // A typo match names an asset only for a long query: at five letters "banks"
  // is one edit from "banko(famerica)", and "what are banks" is not about BAC.
  if (top.score < 80 && norm(q).replace(/ /g, '').length < 7) return null
  if (next && next.score === top.score) return null
  return top
}

// ─── Sectors ────────────────────────────────────────────────────────────────

const SECTOR_WORDS = {
  'materials': 'Materials', 'mining': 'Materials', 'miners': 'Materials', 'resources': 'Materials',
  'financials': 'Financials', 'financial': 'Financials', 'banks': 'Financials', 'banking': 'Financials', 'finance': 'Financials',
  'healthcare': 'Health Care', 'health care': 'Health Care', 'health': 'Health Care',
  'tech': 'Information Technology', 'technology': 'Information Technology', 'it': 'Information Technology', 'information technology': 'Information Technology',
  'energy': 'Energy', 'oil and gas': 'Energy',
  'staples': 'Consumer Staples', 'consumer staples': 'Consumer Staples',
  'discretionary': 'Consumer Discretionary', 'consumer discretionary': 'Consumer Discretionary', 'retail': 'Consumer Discretionary',
  'comms': 'Communication Services', 'communication services': 'Communication Services', 'communications': 'Communication Services', 'telcos': 'Communication Services', 'media': 'Communication Services',
  'industrials': 'Industrials',
  'real estate': 'Real Estate', 'reits': 'Real Estate', 'property stocks': 'Real Estate',
  'utilities': 'Utilities',
}

// "materials stocks", "asx financials", "healthcare" → the sector and its
// ASX names. The whole query has to be a sector phrase, so "energy" lists the
// sector while "woodside energy" stays a company search.
export function parseSectorQuery(raw) {
  let q = norm(raw)
  if (SECTOR_WORDS[q]) return { sector: SECTOR_WORDS[q], stocks: sectorStocks(SECTOR_WORDS[q]) }
  q = q.replace(/^(asx|australian|aussie) /, '').replace(/ (stocks|shares|sector|names|companies)$/, '')
  const sector = SECTOR_WORDS[q] ?? SECTOR_WORDS[`${q} stocks`]
  return sector ? { sector, stocks: sectorStocks(sector) } : null
}

function sectorStocks(sector) {
  return (ASX_SECTOR_STOCKS[sector] ?? []).map(([sym, name]) => ({
    sym, label: sym.replace(/\.AX$/, ''), type: 'asx', desc: `${name} · ${sector}`,
  }))
}

// ─── Calculators ────────────────────────────────────────────────────────────

const CALC_TOOLS = [
  { key: 'compound',  tab: 'investment', label: 'COMPOUND',   desc: 'Compound growth · Investment tab', words: ['compound', 'compound interest', 'investment', 'growth'] },
  { key: 'drp',       tab: 'investment', label: 'DRP',        desc: 'Dividend reinvestment · Investment tab', words: ['drp', 'dividend reinvestment'] },
  { key: 'brokerage', tab: 'investment', label: 'BROKERAGE',  desc: 'Brokerage cost · Investment tab', words: ['brokerage'] },
  { key: 'super',     tab: 'super',      label: 'SUPER',      desc: 'Super projection · Super tab', words: ['super', 'superannuation', 'retirement'] },
  { key: 'mortgage',  tab: 'property',   label: 'MORTGAGE',   desc: 'Mortgage repayments · Property tab', words: ['mortgage', 'home loan', 'repayments'] },
  { key: 'stamp',     tab: 'property',   label: 'STAMP DUTY', desc: 'Stamp duty by state · Property tab', words: ['stamp duty'] },
  { key: 'tax',       tab: 'tax',        label: 'INCOME TAX', desc: 'Income tax · Tax tab', words: ['income tax', 'tax'] },
  { key: 'cgt',       tab: 'tax',        label: 'CGT',        desc: 'Capital gains tax · Tax tab', words: ['cgt', 'capital gains'] },
  { key: 'loans',     tab: 'loans',      label: 'LOAN COMPARISON', desc: 'Compare loans · Loans tab', words: ['loan comparison', 'compare loans', 'loans'] },
]

// Calculator tools whose name the query starts, or that the query names
// ("mortgage calculator").
export function calcMatches(raw) {
  const q = norm(raw).replace(/ (calc|calculator|calculators)$/, '')
  if (q.length < 3) return []
  return CALC_TOOLS.filter((t) => t.words.some((w) => w.startsWith(q) || q === w))
}

function parseAmount(s) {
  const m = String(s).toLowerCase().replace(/^a?\$/, '').replace(/,/g, '').match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!m) return null
  return parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1)
}

// "calculate compound 10000 8% 20 years" / "compound $10k at 8% for 20 yrs".
// Lump sum, annual compounding, no contributions — what the sentence says,
// and so the figure in the preview is the one the calculator then shows.
export function parseCompound(raw) {
  const m = String(raw ?? '').trim().match(/^(?:calc(?:ulate)? )?compound(?: interest| growth)?(?: on| of)? (a?\$?[\d,.]+[km]?) (?:at )?([\d.]+) ?(?:%|pc|percent)?(?: p\.?a\.?)? (?:for |over )?([\d.]+) ?(?:years?|yrs?|y)?$/i)
  if (!m) return null
  const initial = parseAmount(m[1])
  const rate = parseFloat(m[2])
  const years = parseFloat(m[3])
  if (!(initial > 0) || !Number.isFinite(rate) || !(years > 0) || years > 100) return null
  const { final } = compound({ initial, contribution: 0, contributionsPerYear: 1, annualRate: rate, years, compoundsPerYear: 1 })
  return { initial, rate, years, final }
}

// ─── Bonds ──────────────────────────────────────────────────────────────────

const BOND_MARKET_WORDS = {
  au: 'AU', aus: 'AU', australia: 'AU', australian: 'AU', acgb: 'AU',
  us: 'US', usa: 'US', american: 'US', treasury: 'US', treasuries: 'US', ust: 'US',
  uk: 'UK', british: 'UK', gilt: 'UK', gilts: 'UK',
  de: 'DE', german: 'DE', germany: 'DE', bund: 'DE', bunds: 'DE',
  jp: 'JP', japan: 'JP', japanese: 'JP', jgb: 'JP', jgbs: 'JP',
}

// "10y", "au 10 year", "us 2y yield", "30 year gilt", "bonds" → maturities
// that exist on that market's curve. No market named → AU then US.
export function parseBondQuery(raw) {
  const q = norm(raw)
  if (/^(bonds?|yields?|yield curve|govvies)$/.test(q)) {
    return ['AU', 'US'].map((mk) => bondRow(mk, '10Y')).filter(Boolean)
  }
  const m = q.match(/^(?:([a-z]+) )?(\d{1,2}) ?-? ?(y|yr|yrs|year|years|m|mo|month|months)(?: ([a-z]+))?(?: (?:bonds?|yields?))?$/)
  if (!m) return []
  const named = [m[1], m[4]].filter(Boolean)
  if (named.some((w) => !BOND_MARKET_WORDS[w] && !/^(bonds?|yields?|government|govt)$/.test(w))) return []
  const market = named.map((w) => BOND_MARKET_WORDS[w]).find(Boolean)
  const maturity = `${parseInt(m[2], 10)}${m[3].startsWith('m') ? 'M' : 'Y'}`
  return (market ? [market] : ['AU', 'US']).map((mk) => bondRow(mk, maturity)).filter(Boolean)
}

function bondRow(market, maturity) {
  if (!BOND_CURVES[market]?.some((r) => r.maturity === maturity)) return null
  const info = BOND_MARKETS.find((b) => b.key === market)
  return { market, maturity, label: `${market} ${maturity}`, desc: `${info.name} · ${maturity}` }
}

// ─── Time-of-day suggestions ────────────────────────────────────────────────

// Sydney wall-clock, whatever the machine's zone — the ASX keeps Sydney hours.
export function sydneyClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  return { hour, weekend: weekday === 'Sat' || weekday === 'Sun' }
}

// What to offer under an empty bar. Each item carries the command it runs, so
// selecting one goes through execute() like anything typed. Copy is kept to
// what is true at that hour: Wall Street has closed by a Sydney morning, and
// in a Sydney evening the US session is still hours away.
export function timeSuggestions({ now = new Date(), mover = null, alertCount = 0 } = {}) {
  const { hour, weekend } = sydneyClock(now)
  if (weekend) {
    return [
      { icon: '📰', label: 'Weekly market review', command: 'brief' },
      { icon: '📅', label: "Next week's events", command: 'calendar' },
      { icon: '⭐', label: 'Review your watchlist', command: 'watchlist' },
    ]
  }
  if (hour >= 6 && hour < 10) {
    return [
      { icon: '📰', label: 'Check morning brief', command: 'brief' },
      { icon: '📊', label: 'Wall St closed — check overnight indices', command: 'markets' },
      { icon: '💼', label: 'Portfolio overnight move', command: 'portfolio' },
    ]
  }
  if (hour >= 10 && hour < 16) {
    return [
      mover
        ? { icon: '📈', label: `${mover} — biggest move on your watchlist today`, command: mover }
        : { icon: '📈', label: 'ASX open — watchlist moves', command: 'watchlist' },
      { icon: '📊', label: 'Check scanner for signals', command: 'scanner' },
      { icon: '⚡', label: alertCount ? `${alertCount} active alert${alertCount === 1 ? '' : 's'}` : 'Active alerts', action: 'alerts' },
    ]
  }
  if (hour >= 16 && hour < 20) {
    return [
      { icon: '📊', label: 'ASX closed — day summary', command: 'markets' },
      { icon: '📅', label: "Tomorrow's events", command: 'calendar' },
      { icon: '🌐', label: 'US session tonight — futures', command: 'futures' },
    ]
  }
  return [
    hour < 6
      ? { icon: '🌐', label: 'US session live — global indices', command: 'markets' }
      : { icon: '🌐', label: 'US pre-market — futures', command: 'futures' },
    { icon: '📅', label: "Tomorrow's events", command: 'calendar' },
    { icon: '⭐', label: 'Review your watchlist', command: 'watchlist' },
  ]
}
