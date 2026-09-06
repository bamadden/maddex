import { useState, useRef, useEffect, useCallback, memo, Fragment } from 'react'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { useDebounce } from '../../hooks/useDebounce'
import { fetchYFQuote, fetchYahooBatch, fetchCryptoMarkets, transformCryptoMarkets, askClaude } from '../../services/api'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { fmt } from '../../utils/format'
import Tooltip from '../ui/Tooltip'
import { shortcutService } from '../../services/shortcutService'
import { setModuleIntent } from '../../services/moduleIntent'

// ─── Autocomplete symbol catalogue ────────────────────────────────────────────

const KNOWN_SYMBOLS = [
  // ASX — blue chips
  { sym:'BHP.AX',  label:'BHP',    type:'asx',   desc:'BHP Group · Mining' },
  { sym:'CBA.AX',  label:'CBA',    type:'asx',   desc:'Commonwealth Bank · Finance' },
  { sym:'CSL.AX',  label:'CSL',    type:'asx',   desc:'CSL Limited · Healthcare' },
  { sym:'ANZ.AX',  label:'ANZ',    type:'asx',   desc:'ANZ Banking Group · Finance' },
  { sym:'WBC.AX',  label:'WBC',    type:'asx',   desc:'Westpac Banking · Finance' },
  { sym:'NAB.AX',  label:'NAB',    type:'asx',   desc:'National Australia Bank · Finance' },
  { sym:'WOW.AX',  label:'WOW',    type:'asx',   desc:'Woolworths Group · Consumer' },
  { sym:'WES.AX',  label:'WES',    type:'asx',   desc:'Wesfarmers · Conglomerate' },
  { sym:'RIO.AX',  label:'RIO',    type:'asx',   desc:'Rio Tinto · Mining' },
  { sym:'FMG.AX',  label:'FMG',    type:'asx',   desc:'Fortescue · Iron Ore' },
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
  { sym:'GOOGL',   label:'GOOGL',  type:'us',    desc:'Alphabet · NASDAQ' },
  { sym:'AMZN',    label:'AMZN',   type:'us',    desc:'Amazon · NASDAQ' },
  { sym:'META',    label:'META',   type:'us',    desc:'Meta Platforms · NASDAQ' },
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
  { sym:'XRP',     label:'XRP',    type:'crypto', desc:'XRP · Crypto' },
  { sym:'ADA',     label:'ADA',    type:'crypto', desc:'Cardano · Crypto' },
  { sym:'DOGE',    label:'DOGE',   type:'crypto', desc:'Dogecoin · Crypto' },
  { sym:'AVAX',    label:'AVAX',   type:'crypto', desc:'Avalanche · Crypto' },
  // FX
  { sym:'AUD/USD', label:'AUD/USD', type:'fx',  desc:'Australian Dollar vs USD' },
  { sym:'AUD/EUR', label:'AUD/EUR', type:'fx',  desc:'Australian Dollar vs EUR' },
  { sym:'AUD/JPY', label:'AUD/JPY', type:'fx',  desc:'Australian Dollar vs JPY' },
  { sym:'AUD/GBP', label:'AUD/GBP', type:'fx',  desc:'Australian Dollar vs GBP' },
  { sym:'USD/JPY', label:'USD/JPY', type:'fx',  desc:'US Dollar vs Japanese Yen' },
  { sym:'EUR/USD', label:'EUR/USD', type:'fx',  desc:'Euro vs US Dollar' },
]

// Module nav now has its own MODULES category (below) — these are the
// remaining power-user commands that aren't just "go to a module".
const CMD_SUGGESTIONS = [
  { sym:'TOP',             label:'TOP',               type:'cmd', desc:'Top 10 movers today' },
  { sym:'GAINERS',         label:'GAINERS',           type:'cmd', desc:'Top 10 gainers today' },
  { sym:'LOSERS',          label:'LOSERS',            type:'cmd', desc:'Top 10 losers today' },
  { sym:'MOVERS',          label:'MOVERS',            type:'cmd', desc:'Top 10 movers today' },
  { sym:'CRYPTO TOP',      label:'CRYPTO TOP',        type:'cmd', desc:'Top 10 crypto by market cap' },
  { sym:'ASX TOP',         label:'ASX TOP',           type:'cmd', desc:'Top ASX movers today' },
  { sym:'NEWS',            label:'NEWS {keyword}',    type:'cmd', desc:'Filter news by keyword' },
  { sym:'WL ADD',          label:'WL ADD {sym}',      type:'cmd', desc:'Quick add to watchlist' },
  { sym:'COMPARE',         label:'COMPARE {s1} {s2}', type:'cmd', desc:'Compare two assets side by side' },
  { sym:'ALERT',           label:'ALERT {sym} {$}',   type:'cmd', desc:'Set a price alert' },
  { sym:'CORRELATE',       label:'CORRELATE {s1} {s2}', type:'cmd', desc:'Open the Correlation Explorer' },
  { sym:'HELP',            label:'HELP / ?',          type:'cmd', desc:'Show all commands' },
]

// MODULES search category
const MODULE_LIST = [
  { key:'markets',   label:'MARKETS',   desc:'ASX 200, S&P 500, global equities' },
  { key:'portfolio', label:'PORTFOLIO', desc:'Your holdings, P&L, allocation' },
  { key:'crypto',    label:'CRYPTO',    desc:'Top coins, market cap, fear & greed' },
  { key:'fx',        label:'RATES',     desc:'FX pairs, yield curves, metals' },
  { key:'macro',     label:'MACRO',     desc:'RBA, AU/US indicators, economic calendar' },
  { key:'watchlist', label:'WATCHLIST', desc:'Your tracked tickers' },
  { key:'news',      label:'NEWS',      desc:'Market-moving headlines' },
  { key:'global',    label:'GLOBAL',    desc:'Global risk & intelligence' },
  { key:'screener',  label:'SCREENER',  desc:'AI-assisted stock screening' },
]

// Stocks to scan for TOP/LOSERS commands
const TOP_SCAN_AU = ['BHP.AX','CBA.AX','CSL.AX','ANZ.AX','WBC.AX','NAB.AX','WOW.AX','WES.AX','RIO.AX','FMG.AX','MQG.AX','TLS.AX','WDS.AX','STO.AX','MIN.AX','PLS.AX','QAN.AX','GMG.AX']
const TOP_SCAN_US = ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','BAC','XOM','V','AMD','NFLX','DIS','BA']
const TOP_SCAN_ALL = [...TOP_SCAN_AU, ...TOP_SCAN_US]

const NAV_MAP = {
  markets:   ['markets','mkt','indices','heat'],
  portfolio: ['portfolio','holdings','pnl'],
  crypto:    ['crypto','defi','cry','crypt'],
  fx:        ['fx','forex','rates','yield','bonds'],
  macro:     ['macro','economic','calendar','gdp','cpi','rba','mac'],
  watchlist: ['watchlist','wl','watch'],
  news:      ['news','feed','headlines'],
  global:    ['global','glb','globe'],
}

const HELP_SECTIONS = [
  { title:'NAVIGATION', items:[
    { cmd:'MARKETS / MKT', desc:'Markets module' },
    { cmd:'PORTFOLIO / PORT', desc:'Portfolio module' },
    { cmd:'CRYPTO', desc:'Crypto module' },
    { cmd:'RATES', desc:'Rates module' },
    { cmd:'MACRO', desc:'Macro module' },
    { cmd:'WATCHLIST / WL', desc:'Watchlist module' },
    { cmd:'NEWS', desc:'News feed module' },
    { cmd:'GLOBAL / GLB', desc:'Global intelligence module' },
  ]},
  { title:'TICKER LOOKUP', items:[
    { cmd:'BHP / CBA / AAPL ...', desc:'Any symbol → full asset profile' },
    { cmd:'^AXJO / ^GSPC', desc:'Indices — prefix with ^' },
    { cmd:'BTC / ETH / SOL', desc:'Crypto assets' },
    { cmd:'AUD/USD', desc:'FX pairs' },
  ]},
  { title:'MARKET COMMANDS', items:[
    { cmd:'TOP / MOVERS / GAINERS', desc:'Top 10 movers (all markets)' },
    { cmd:'LOSERS', desc:'Top 10 losers (all markets)' },
    { cmd:'ASX TOP', desc:'Top ASX 200 movers' },
    { cmd:'CRYPTO TOP', desc:'Top 10 crypto by market cap' },
  ]},
  { title:'TOOLS', items:[
    { cmd:'NEWS {keyword}', desc:'Filter news — e.g. NEWS RBA, NEWS CHINA' },
    { cmd:'COMPARE {s1} {s2}', desc:'Side-by-side asset comparison' },
    { cmd:'ALERT {sym} {price}', desc:'Set price alert — e.g. ALERT BHP 50' },
    { cmd:'CORRELATE {s1} {s2}', desc:'Open Correlation Explorer — e.g. CORRELATE BHP AUD' },
    { cmd:'WL ADD {sym}', desc:'Quick add to watchlist — e.g. WL ADD NVDA' },
    { cmd:'AI {question}', desc:'Ask MaddenAI directly' },
    { cmd:'IDEAS / ROADMAP', desc:'Vote on features, see what\'s coming' },
    { cmd:'HELP / ?', desc:'Show this panel' },
  ]},
  { title:'KEYBOARD', items:[
    { cmd:'/', desc:'Focus command bar from anywhere' },
    { cmd:'↑ / ↓', desc:'Cycle command history' },
    { cmd:'ESC', desc:'Close modal or AI panel' },
    { cmd:'M / C / F / N / G / P / W / X', desc:'Module hotkeys' },
    { cmd:'F1–F8', desc:'Module function keys' },
    { cmd:'Tab', desc:'Accept autocomplete suggestion' },
  ]},
]

// ─── Natural language ─────────────────────────────────────────────────────────
//
// A terminal command line and a sentence are different interfaces, and this
// bar had only the first: "WL ADD BHP" worked, "add BHP to my watchlist" fell
// through to the catch-all and became an AI question — a round trip to a model
// to do something the app can do locally and instantly.
//
// ONE PARSER, TWO CALLERS. parseNaturalLanguage returns a plain descriptor and
// touches nothing. interpretCommand renders it as the preview line under the
// input; execute() acts on it. That is deliberate: the preview exists to tell
// the user what Enter will do, and a preview derived from a second, parallel
// set of patterns is a preview that can lie. Adding a pattern here changes
// both at once.
//
// Deliberately conservative. Every pattern is anchored and requires its
// keywords in order, so ordinary prose still reaches MaddenAI rather than
// being caught by a loose match — "how do I compare franking credits across
// two brokers" is a question, not a COMPARE command.

// Word characters, a dot, a caret or a slash — enough for BHP, BHP.AX, ^AXJO
// and AUD/USD, and nothing else.
const TICKER_RE = '[A-Za-z0-9.^/-]{1,12}'

// Resolves what the user typed to the symbol the app actually uses.
//
// "add BHP to watchlist" must add BHP.AX, not BHP: a bare ASX ticker resolves
// to the US listing at a USD price, silently — the failure tickerGuard.js
// exists to catch. Known symbols resolve through the catalogue; anything else
// is passed through untouched rather than guessed at.
function resolveSymbol(raw) {
  const q = String(raw ?? '').trim().toUpperCase()
  if (!q) return null
  const known = KNOWN_SYMBOLS.find((k) => k.label.toUpperCase() === q || k.sym.toUpperCase() === q)
  return known ? known.sym : q
}

// Whether a token is plausibly a symbol rather than an English word.
function looksLikeTicker(raw) {
  const q = String(raw ?? '').trim()
  if (!q) return false
  if (KNOWN_SYMBOLS.some((k) => k.label.toUpperCase() === q.toUpperCase() || k.sym.toUpperCase() === q.toUpperCase())) return true
  return /^[A-Z^][A-Z0-9.^/-]*$/.test(q)
}

// The display form — BHP rather than BHP.AX, for confirmations.
function displaySymbol(raw) {
  const q = String(raw ?? '').trim().toUpperCase()
  const known = KNOWN_SYMBOLS.find((k) => k.label.toUpperCase() === q || k.sym.toUpperCase() === q)
  return known ? known.label : q
}

// Module names as a person would say them, mapped to module ids. Checked
// against NAV_MAP's aliases first, so this only has to carry the names that
// are not already aliases.
const SPOKEN_MODULES = {
  brief: 'brief', 'morning brief': 'brief', 'my brief': 'brief',
  scanner: 'scanner', scan: 'scanner', screener: 'screener', screen: 'screener',
  dashboard: 'dashboard', home: 'dashboard',
  calendar: 'calendar', settings: 'settings', replay: 'replay',
  'ai analyst': 'ai', 'maddenai': 'ai',
}

function moduleIdFor(name) {
  const n = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!n) return null
  if (SPOKEN_MODULES[n]) return SPOKEN_MODULES[n]
  for (const [module, aliases] of Object.entries(NAV_MAP)) {
    if (aliases.includes(n)) return module
  }
  return null
}

// Returns { kind, ...args, say } or null. `say` is the preview line, and is
// also what the confirmation flash is built from, so the two always agree.
function parseNaturalLanguage(raw) {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return null
  const lower = t.toLowerCase()

  const m = (re) => t.match(re)

  // "add BHP to watchlist" / "add BHP to my watchlist"
  let hit = m(new RegExp(`^add (${TICKER_RE}) to (?:my )?watch ?list$`, 'i'))
  if (hit) {
    const sym = resolveSymbol(hit[1])
    return { kind: 'watchlist', symbol: sym, say: `Add ${sym} to watchlist` }
  }

  // "set alert BHP above 50" / "alert me when CBA goes below 170"
  hit = m(new RegExp(`^(?:set )?alert (?:me )?(?:for |on |when )?(${TICKER_RE}) (?:goes |gets |is )?(above|below|over|under) \\$?([0-9]+(?:\\.[0-9]+)?)$`, 'i'))
  if (hit) {
    const sym = resolveSymbol(hit[1])
    const direction = /above|over/i.test(hit[2]) ? 'above' : 'below'
    const price = parseFloat(hit[3])
    return {
      kind: 'alert', symbol: sym, direction, price,
      say: `Set alert: ${sym} ${direction} A$${price.toFixed(2)}`,
    }
  }

  // "compare BHP and RIO" / "compare BHP vs RIO" / "compare BHP with RIO"
  hit = m(new RegExp(`^compare (${TICKER_RE}) (?:and|vs\\.?|versus|with|to) (${TICKER_RE})$`, 'i'))
  if (hit) {
    const [a, b] = [displaySymbol(hit[1]), displaySymbol(hit[2])]
    return { kind: 'compare', a: hit[1], b: hit[2], say: `Compare ${a} vs ${b}` }
  }

  // "analyse BHP" / "analyze BHP"
  hit = m(new RegExp(`^analys[ez]e? (${TICKER_RE})$`, 'i'))
  if (hit) {
    const sym = displaySymbol(hit[1])
    return {
      kind: 'ai', symbol: sym,
      query: `Give me a full analysis of ${sym}: what the business does, what is driving the share price, the main risks, and what an Australian investor should be watching. General information only, not advice.`,
      say: `Ask MaddenAI to analyse ${sym}`,
    }
  }

  // "how is BHP doing" / "how's BHP doing" / "how is BHP performing"
  hit = m(new RegExp(`^how(?:'s| is| has) (${TICKER_RE}) (?:been )?(?:doing|performing|going|performed)\\??$`, 'i'))
  if (hit) {
    const sym = displaySymbol(hit[1])
    return {
      kind: 'ai', symbol: sym,
      query: `How has ${sym} been performing recently, and what has been driving it? Describe direction and condition rather than quoting prices you were not given. General information only, not advice.`,
      say: `Ask MaddenAI how ${sym} is performing`,
    }
  }

  // "what is BHP" / "what's BHP" — a lookup, not a question for the model.
  //
  // Guarded on the token actually looking like a ticker. Without the guard
  // "what is inflation" parses as a lookup of INFLATION, fails, and only then
  // falls through to MaddenAI — a slower, worse answer to a real question. A
  // token counts as a ticker if the catalogue knows it, or if the user typed
  // it in capitals, which is how people write tickers and not how they write
  // nouns.
  hit = m(new RegExp(`^what(?:'s| is) (${TICKER_RE})\\??$`, 'i'))
  if (hit && looksLikeTicker(hit[1])) {
    const sym = displaySymbol(hit[1])
    return { kind: 'lookup', symbol: hit[1], say: `Look up ${sym}` }
  }

  // "scan for breakouts" / "scan for oversold stocks"
  hit = m(/^scan (?:for |the )?([a-z ]+?)(?: stocks| setups)?$/i)
  if (hit) {
    const wanted = hit[1].trim().toLowerCase()
    const TABS = { breakouts: 'breakouts', breakout: 'breakouts', oversold: 'oversold', overbought: 'overbought', volume: 'volume', gaps: 'gaps', gap: 'gaps', momentum: 'momentum', patterns: 'patterns', pattern: 'patterns' }
    const tab = TABS[wanted]
    if (tab) return { kind: 'scanner', tab, say: `Scanner → ${tab.toUpperCase()}` }
  }

  // "my portfolio" / "my brief" / "morning brief" / "my watchlist"
  hit = m(/^(?:my |the )?(portfolio|holdings|watchlist|morning brief|brief|dashboard)$/i)
  if (hit) {
    const id = moduleIdFor(hit[1]) ?? hit[1].toLowerCase()
    return { kind: 'nav', module: id, say: `Navigate to ${id.toUpperCase()}` }
  }

  // "show me markets" / "go to the crypto module" / "open portfolio"
  hit = m(/^(?:show me|show|go to|open|take me to)(?: the)? ([a-z ]+?)(?: module| page| tab)?$/i)
  if (hit) {
    const id = moduleIdFor(hit[1])
    if (id) return { kind: 'nav', module: id, say: `Navigate to ${id.toUpperCase()}` }
  }

  // Everything else is prose, and prose goes to the model — unchanged.
  return lower === '' ? null : null
}

// ─── Command interpretation preview ────────────────────────────────────────────
// A pure, side-effect-free mirror of execute()'s branching — shown live below
// the input so the user sees what Enter will do before committing to it.

function interpretCommand(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cmd = trimmed.toLowerCase()
  const parts = trimmed.split(/\s+/)

  if (cmd === 'help' || cmd === '?' || cmd === 'commands') return 'Show command reference'
  if (parts[0].toLowerCase() === 'ai') return `Ask MaddenAI: "${parts.slice(1).join(' ') || 'market overview'}"`
  for (const [module, aliases] of Object.entries(NAV_MAP)) {
    if (aliases.includes(cmd)) return `Navigate to ${module.toUpperCase()}`
  }
  if (parts[0].toLowerCase() === 'news' && parts.length > 1) return `Filter news by "${parts.slice(1).join(' ')}"`
  if (cmd === 'top' || cmd === 'movers' || cmd === 'gainers') return 'Show top 10 movers today'
  if (cmd === 'losers') return 'Show top 10 losers today'
  if (cmd === 'asx top') return 'Show top ASX 200 movers'
  if (cmd === 'crypto top') return 'Navigate to CRYPTO module'
  if (parts[0].toLowerCase() === 'wl' && parts[1]?.toLowerCase() === 'add' && parts[2]) return `Adding ${parts[2].toUpperCase()} to watchlist...`
  if (parts[0].toLowerCase() === 'port' && parts[1]?.toLowerCase() === 'add' && parts[2]) return `Open Portfolio to add ${parts[2].toUpperCase()}`
  if (parts[0].toLowerCase() === 'compare' && parts.length >= 3 && !/^(and|vs|vs\.|versus|with|to)$/i.test(parts[2])) return `Compare ${parts[1].toUpperCase()} vs ${parts[2].toUpperCase()}`
  if (parts[0].toLowerCase() === 'alert' && parts.length >= 3) {
    const p = parseFloat(parts[2])
    return isNaN(p) ? 'Alert format: ALERT {symbol} {price}' : `Set alert: ${parts[1].toUpperCase()} @ A$${p.toFixed(2)}`
  }
  // Natural language, checked before the two catch-alls below so the preview
  // says "Add BHP.AX to watchlist" rather than "Ask MaddenAI: …".
  const nl = parseNaturalLanguage(trimmed)
  if (nl) return nl.say

  if (!trimmed.includes(' ')) return `Look up ${trimmed.toUpperCase()}`
  return `Ask MaddenAI: "${trimmed.length > 50 ? trimmed.slice(0, 50) + '…' : trimmed}"`
}

// ─── History helpers (localStorage) ───────────────────────────────────────────

const LS_KEY = 'madden_cmd_history'
const readHistory = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
const writeHistory = (hist) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(hist.slice(0, 50))) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
}

// ─── Autocomplete filter ───────────────────────────────────────────────────────
// Categorised results: STOCKS, CRYPTO, FX, MODULES, COMMANDS, then ACTIONS —
// the last always present once there's a query, since "ask AI about this" /
// "add this to watchlist" / "add this to portfolio" apply to any input.

function buildActionSuggestions(rawInput) {
  const q = rawInput.trim()
  if (!q) return []

  // When the input already parses as a command, offer that command instead of
  // the three generic ones. The generic list takes the first token as a ticker,
  // which for "add BHP to watchlist" produced "Add ADD to watchlist" — an
  // action that would run, and do the wrong thing.
  const nl = parseNaturalLanguage(q)
  if (nl) {
    return [{
      sym: `nl:${q}`, label: nl.say, type: 'action', category: 'ACTIONS',
      desc: 'Press Enter to run', action: 'command', payload: q,
    }]
  }

  const ticker = q.toUpperCase().split(/\s+/)[0]
  return [
    { sym:`ai:${q}`,   label:`Ask MaddenAI about "${q}"`,   type:'action', category:'ACTIONS', desc:'Route this query to MaddenAI',       action:'ai',        payload:q },
    { sym:`wl:${ticker}`,   label:`Add ${ticker} to watchlist`,  type:'action', category:'ACTIONS', desc:'Quick add to your watchlist',        action:'watchlist', payload:ticker },
    { sym:`port:${ticker}`, label:`Add ${ticker} to portfolio`,  type:'action', category:'ACTIONS', desc:'Opens Portfolio to add a position',  action:'portfolio', payload:ticker },
  ]
}

function getSuggestions(input) {
  if (!input.trim()) return []
  const q = input.trim().toUpperCase()

  const stocks = KNOWN_SYMBOLS
    .filter((s) => (s.type === 'asx' || s.type === 'us' || s.type === 'index') && (s.label.startsWith(q) || s.sym.startsWith(q)))
    .map((s) => ({ ...s, category:'STOCKS' }))
  const crypto = KNOWN_SYMBOLS
    .filter((s) => s.type === 'crypto' && s.label.startsWith(q))
    .map((s) => ({ ...s, category:'CRYPTO' }))
  const fx = KNOWN_SYMBOLS
    .filter((s) => s.type === 'fx' && s.label.startsWith(q))
    .map((s) => ({ ...s, category:'FX' }))
  const modules = MODULE_LIST
    .filter((m) => m.label.startsWith(q))
    .map((m) => ({ sym:m.key, label:m.label, desc:m.desc, type:'module', category:'MODULES' }))
  const commands = CMD_SUGGESTIONS
    .filter((c) => c.sym.startsWith(q))
    .map((c) => ({ ...c, category:'COMMANDS' }))

  const matched = [...stocks, ...crypto, ...fx, ...modules, ...commands].slice(0, 7)
  return [...matched, ...buildActionSuggestions(input)]
}

// ─── Help Overlay ──────────────────────────────────────────────────────────────

function HelpOverlay({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div
        className="modal-panel bg-terminal-panel border border-terminal-gold/40 w-full max-w-5xl mb-12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">▲ MADDEX · COMMAND REFERENCE</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg">✕</button>
        </div>
        <div className="grid grid-cols-3 xl:grid-cols-5 gap-0 max-h-[60vh] overflow-auto">
          {HELP_SECTIONS.map((sec) => (
            <div key={sec.title} className="border-r border-terminal-border last:border-0 p-3">
              <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2 pb-1 border-b border-terminal-border/50">
                {sec.title}
              </div>
              <div className="space-y-1.5">
                {sec.items.map((item) => (
                  <div key={item.cmd}>
                    <div className="text-2xs text-terminal-text-bright font-semibold font-mono">{item.cmd}</div>
                    <div className="text-2xs text-terminal-text-dim/70">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-1.5 border-t border-terminal-border bg-terminal-header text-2xs text-terminal-text-dim/50">
          Press ESC or click outside to close · Unknown input is automatically routed to MADDEN AI
        </div>
      </div>
    </div>
  )
}

// ─── Movers Panel ─────────────────────────────────────────────────────────────

function MoversPanel({ title, items, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end justify-center"
      onClick={onClose}>
      <div
        className="modal-panel bg-terminal-panel border border-terminal-border w-full max-w-2xl mb-12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header">
          <span className="text-terminal-gold font-bold tracking-widest text-2xs">{title}</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold">✕</button>
        </div>
        <div className="overflow-auto max-h-[50vh]">
          <table className="terminal-table w-full">
            <thead>
              <tr>
                <th className="px-3 text-left">#</th>
                <th className="px-2 text-left">SYMBOL</th>
                <th className="px-2 text-left">NAME</th>
                <th className="px-2 text-right">PRICE</th>
                <th className="px-3 text-right">CHG%</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.symbol}
                  className="cursor-pointer hover:bg-terminal-accent/30"
                  onClick={() => { onSelect(item); onClose() }}>
                  <td className="px-3 text-terminal-text-dim">{i + 1}</td>
                  <td className="px-2 font-bold text-terminal-text-bright">{item.symbol}</td>
                  <td className="px-2 text-terminal-text-dim truncate max-w-[180px]">{item.name}</td>
                  <td className="px-2 text-right text-terminal-text">
                    A${item.price != null ? fmt.price(item.price) : '—'}
                  </td>
                  <td className={`px-3 text-right font-bold ${item.pct > 0 ? 'text-terminal-green' : item.pct < 0 ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>
                    {item.pct > 0 ? '+' : ''}{item.pct?.toFixed(2) ?? '—'}%
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-2xs text-terminal-text-dim text-center">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1 border-t border-terminal-border text-2xs text-terminal-text-dim/50">
          Click any row to open full asset profile · Source: Stooq / CoinGecko
        </div>
      </div>
    </div>
  )
}

// ─── Compare Modal ─────────────────────────────────────────────────────────────

function CompareModal({ assets, onClose }) {
  if (!assets || assets.length < 2) return null
  const [a, b] = assets

  const fmtP = (v) => v != null ? `A$${fmt.price(Number(v))}` : '—'
  const fmtPct = fmt.pct   // identical output, kept as a local alias for the call site below
  const rows = [
    { label:'PRICE', aVal: fmtP(a.price), bVal: fmtP(b.price) },
    { label:'DAY CHG', aVal: fmtPct(a.pct), bVal: fmtPct(b.pct),
      aCls: a.pct > 0 ? 'text-terminal-green' : a.pct < 0 ? 'text-terminal-red' : '',
      bCls: b.pct > 0 ? 'text-terminal-green' : b.pct < 0 ? 'text-terminal-red' : '' },
    { label:'52W HIGH', aVal: fmtP(a.extra?.week52High), bVal: fmtP(b.extra?.week52High) },
    { label:'52W LOW',  aVal: fmtP(a.extra?.week52Low),  bVal: fmtP(b.extra?.week52Low)  },
    { label:'EXCHANGE', aVal: a.extra?.exchange ?? '—', bVal: b.extra?.exchange ?? '—' },
    { label:'STATUS',
      aVal: a.extra?.isOpen ? 'OPEN' : 'CLOSED',
      bVal: b.extra?.isOpen ? 'OPEN' : 'CLOSED',
      aCls: a.extra?.isOpen ? 'text-terminal-green' : 'text-terminal-text-dim',
      bCls: b.extra?.isOpen ? 'text-terminal-green' : 'text-terminal-text-dim' },
  ]

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end justify-center"
      onClick={onClose}>
      <div
        className="modal-panel bg-terminal-panel border border-terminal-border w-full max-w-2xl mb-12 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header">
          <span className="text-terminal-gold font-bold tracking-widest text-2xs">
            COMPARE · {a.symbol} vs {b.symbol}
          </span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold">✕</button>
        </div>
        <div className="grid grid-cols-[120px_1fr_1fr] text-2xs">
          <div className="p-3 border-r border-terminal-border" />
          {[a, b].map((asset) => (
            <div key={asset.symbol} className="p-3 border-r border-terminal-border last:border-0 text-center">
              <div className="text-terminal-gold font-bold text-sm mb-0.5">{asset.symbol}</div>
              <div className="text-terminal-text-dim truncate">{asset.name}</div>
              <div className={`text-2xs border px-1 mt-1 inline-block ${asset.type === 'asx' ? 'border-terminal-gold text-terminal-gold' : asset.type === 'crypto' ? 'border-terminal-green text-terminal-green' : 'border-terminal-border text-terminal-text-dim'}`}>
                {asset.type?.toUpperCase()}
              </div>
            </div>
          ))}
          {rows.map((row) => (
            <Fragment key={row.label}>
              <div className="px-3 py-1.5 border-r border-terminal-border border-t border-terminal-border/30 text-terminal-text-dim">{row.label}</div>
              <div className={`px-3 py-1.5 border-r border-terminal-border border-t border-terminal-border/30 text-center font-semibold ${row.aCls ?? 'text-terminal-text-bright'}`}>{row.aVal}</div>
              <div className={`px-3 py-1.5 border-t border-terminal-border/30 text-center font-semibold ${row.bCls ?? 'text-terminal-text-bright'}`}>{row.bVal}</div>
            </Fragment>
          ))}
        </div>
        <div className="px-3 py-1 border-t border-terminal-border text-2xs text-terminal-text-dim/50">
          Source: Stooq / CoinGecko · Prices in AUD
        </div>
      </div>
    </div>
  )
}

// ─── Alert indicator (top-right of command bar) ───────────────────────────────

function AlertBadge({ alerts }) {
  const [show, setShow] = useState(false)
  const { removeAlert } = useStore()
  const ref = useRef(null)

  useEffect(() => {
    if (!show) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setShow(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [show])

  if (!alerts.length) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(v => !v)}
        className="flex items-center gap-1 text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:border-terminal-gold transition-colors"
      >
        <span className="text-terminal-gold">◎</span>
        <span>{alerts.length} ALERT{alerts.length !== 1 ? 'S' : ''}</span>
      </button>
      {show && (
        <div className="absolute bottom-full mb-1 right-0 w-64 bg-terminal-panel border border-terminal-border shadow-2xl z-[90]">
          <div className="px-2 py-1 border-b border-terminal-border text-2xs text-terminal-gold font-bold tracking-widest">
            PRICE ALERTS
          </div>
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border/40 last:border-0">
              <div>
                <span className="text-terminal-text-bright font-bold text-2xs">{a.sym}</span>
                <span className="text-terminal-text-dim text-2xs ml-2">@ A${a.price.toFixed(2)}</span>
              </div>
              <button onClick={() => removeAlert(a.id)} className="text-terminal-text-dim/40 hover:text-terminal-red text-xs">✕</button>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="px-2 py-3 text-2xs text-terminal-text-dim/60 text-center">No alerts set</div>
          )}
          <div className="px-2 py-1 text-2xs text-terminal-text-dim/40 border-t border-terminal-border/30">
            ALERT {'{'}sym{'}'} {'{'}price{'}'} to add
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Keyboard hints ───────────────────────────────────────────────────────────
//
// The hints change with what is on screen, because a fixed row is wrong most
// of the time: ENTER means "select this suggestion" with a list open and
// "execute what I typed" without one, and TAB fills a suggestion only when
// there is a suggestion to fill from. A row that says the same thing in both
// states teaches the wrong model of the bar.
function KeyHints({ context = 'idle', className = '' }) {
  const HINTS = {
    suggestions: [['↑↓', 'navigate'], ['↵', 'select'], ['Tab', 'fill'], ['Esc', 'close']],
    recent:      [['↑↓', 'navigate'], ['↵', 'run'], ['Esc', 'close']],
    typing:      [['↵', 'execute'], ['Esc', 'clear'], ['⌘K', 'focus']],
    idle:        [['↑↓', 'history'], ['↵', 'execute'], ['⌘K', 'open anywhere']],
  }
  return (
    <span className={`flex items-center gap-2.5 text-2xs ${className}`}>
      {(HINTS[context] ?? HINTS.idle).map(([key, label]) => (
        <span key={key} className="flex items-center gap-1 whitespace-nowrap">
          <kbd
            className="font-mono"
            style={{
              fontSize: 8, padding: '0 3px', borderRadius: 2,
              border: '1px solid rgba(99,120,153,0.3)', color: '#8BA3C4',
            }}
          >{key}</kbd>
          <span className="text-terminal-text-dim/50">{label}</span>
        </span>
      ))}
    </span>
  )
}

// ─── Suggestions dropdown (memoised to avoid re-renders on every keystroke) ──
// Grouped by category (STOCKS/CRYPTO/FX/MODULES/COMMANDS/ACTIONS) in the
// order categories first appear. `quotes` maps symbol -> { price, pct } for
// live STOCKS/CRYPTO rows — absent entries just show no price yet.

// Must match the concatenation order in getSuggestions() — keyboard nav
// (suggestIdx) indexes the flat `suggestions` array, and the sequential
// row index assigned during grouped rendering below only lines up with
// that flat index because both orders agree.
const CATEGORY_ORDER = ['STOCKS', 'CRYPTO', 'FX', 'MODULES', 'COMMANDS', 'ACTIONS']

function groupByCategory(items) {
  const groups = {}
  for (const item of items) (groups[item.category] ??= []).push(item)
  return CATEGORY_ORDER.filter((c) => groups[c]?.length).map((c) => ({ category: c, items: groups[c] }))
}

const SuggestionsList = memo(function SuggestionsList({ suggestions, suggestIdx, onSelect, quotes }) {
  if (!suggestions.length) return null
  const grouped = groupByCategory(suggestions)
  return (
    <div className="absolute bottom-full left-0 right-0 border-t border-terminal-gold/30 bg-terminal-panel border border-terminal-border shadow-2xl z-[70] max-h-96 overflow-auto">
      {grouped.map(({ category, items }) => (
        <div key={category}>
          <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold/70 font-bold tracking-widest sticky top-0">
            {category}
          </div>
          {items.map((s) => {
            // Grouped rendering preserves the flat array's order (see the
            // CATEGORY_ORDER comment above), so indexOf recovers the same
            // index handleKeyDown uses — without a mutable render-time counter.
            const i = suggestions.indexOf(s)
            const q = quotes?.[s.sym] ?? quotes?.[s.label]
            return (
              <div
                key={s.sym}
                className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer text-2xs transition-colors ${
                  i === suggestIdx
                    ? 'bg-terminal-blue-bright/20 border-l-2 border-terminal-blue-bright'
                    : 'hover:bg-terminal-accent/20 border-l-2 border-transparent'
                }`}
                onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
              >
                <span className={`font-bold font-mono w-28 flex-shrink-0 truncate ${
                  s.type === 'cmd'    ? 'text-terminal-gold' :
                  s.type === 'action' ? 'text-terminal-blue-bright' :
                  s.type === 'module' ? 'text-terminal-gold' :
                  s.type === 'asx'    ? 'text-terminal-text-bright' :
                  s.type === 'crypto' ? 'text-terminal-green' :
                  s.type === 'index'  ? 'text-terminal-blue-bright' :
                  s.type === 'fx'     ? 'text-[#4a9dd9]' :
                  'text-terminal-text'
                }`}>{s.label}</span>
                <span className="text-terminal-text-dim flex-1 truncate">{s.desc}</span>
                {q && (
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-terminal-text-bright font-semibold">
                      {q.price != null ? `A$${fmt.price(q.price)}` : '—'}
                    </span>
                    <span className={`font-bold ${q.pct > 0 ? 'text-terminal-green' : q.pct < 0 ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>
                      {q.pct != null ? `${q.pct > 0 ? '+' : ''}${q.pct.toFixed(2)}%` : ''}
                    </span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <div className="px-3 py-1 border-t border-terminal-border/40 flex items-center sticky bottom-0 bg-terminal-panel">
        <KeyHints context="suggestions" />
      </div>
    </div>
  )
})

// ─── Recent searches — shown under an empty, focused command bar ─────────────

const RecentSearchesList = memo(function RecentSearchesList({ recents, activeIdx, onSelect }) {
  if (!recents.length) return null
  return (
    <div className="absolute bottom-full left-0 right-0 border-t border-terminal-gold/30 bg-terminal-panel border border-terminal-border shadow-2xl z-[70]">
      <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold/70 font-bold tracking-widest">
        RECENT SEARCHES
      </div>
      {recents.map((r, i) => (
        <div
          key={r}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-2xs transition-colors ${
            i === activeIdx
              ? 'bg-terminal-blue-bright/20 border-l-2 border-terminal-blue-bright'
              : 'hover:bg-terminal-accent/20 border-l-2 border-transparent'
          }`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
        >
          <span className="text-terminal-text-dim/60">↺</span>
          <span className="text-terminal-text-bright font-mono">{r}</span>
        </div>
      ))}
      <div className="px-3 py-1 border-t border-terminal-border/40 flex items-center bg-terminal-panel">
        <KeyHints context="recent" />
      </div>
    </div>
  )
})

// ─── Main CommandBar ──────────────────────────────────────────────────────────

export default function CommandBar() {
  const {
    setActiveModule, pushCmdHistory, cmdHistory,
    setChatOpen, addChatMessage, updateLastChatMessage,
    addToWatchlist,
    openModal, closeModal,
    setNewsFilter,
    alerts, addAlert,
  } = useStore()

  const { audUsd } = useAudRates()

  const [inputValue,  setInputValue]  = useState('')
  const [status,      setStatus]      = useState('READY')
  const [histIdx,     setHistIdx]     = useState(-1)
  const [suggestions, setSuggestions] = useState([])
  const [suggestIdx,  setSuggestIdx]  = useState(-1)
  const [helpOpen,    setHelpOpen]    = useState(false)
  const [movers,      setMovers]      = useState(null)
  const [compareAssets, setCompareAssets] = useState(null)
  const [showRecent,  setShowRecent]  = useState(false)
  const [suggestionQuotes, setSuggestionQuotes] = useState({})

  const debouncedValue = useDebounce(inputValue, 150)

  const inputRef   = useRef(null)
  const wrapperRef = useRef(null)

  // ── History stored in localStorage ──────────────────────────────────────────
  const [localHistory, setLocalHistory] = useState(readHistory)
  const recentSearches = localHistory.slice(0, 5)

  const pushHistory = useCallback((cmd) => {
    setLocalHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 50)
      writeHistory(next)
      return next
    })
    pushCmdHistory(cmd)
  }, [pushCmdHistory])

  // ── Close recent-searches on outside click (same pattern as AlertBadge) ─────
  useEffect(() => {
    if (!showRecent) return
    const h = (e) => { if (!wrapperRef.current?.contains(e.target)) setShowRecent(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showRecent])

  // ── Live price/change% for STOCKS + CRYPTO suggestion rows ──────────────────
  // Only fires once there are actual matches to price, and only after 2+
  // characters — keeps this from firing a full CoinGecko/batch fetch on
  // every single keystroke.
  useEffect(() => {
    const stockSyms  = suggestions.filter((s) => s.category === 'STOCKS').map((s) => s.sym).slice(0, 4)
    const cryptoSyms = suggestions.filter((s) => s.category === 'CRYPTO').map((s) => s.label).slice(0, 4)
    if (debouncedValue.trim().length < 2 || (!stockSyms.length && !cryptoSyms.length)) {
      setSuggestionQuotes({})
      return
    }
    let cancelled = false
    ;(async () => {
      const next = {}
      if (stockSyms.length) {
        try {
          const q = await fetchYahooBatch(stockSyms)
          for (const [sym, v] of Object.entries(q)) {
            next[sym] = { price: v.currency === 'USD' ? v.last * audUsd : v.last, pct: v.pct }
          }
        } catch {
          // Live price is a nice-to-have in the dropdown — fall back to no price
        }
      }
      if (cryptoSyms.length) {
        try {
          const raw = await fetchCryptoMarkets('aud')
          const coins = transformCryptoMarkets(raw.data, raw.currency)
          for (const c of coins) {
            if (cryptoSyms.includes(c.symbol)) next[c.symbol] = { price: c.price, pct: c.pct24h }
          }
        } catch {
          // Live price is a nice-to-have in the dropdown — fall back to no price
        }
      }
      if (!cancelled) setSuggestionQuotes(next)
    })()
    return () => { cancelled = true }
  }, [suggestions, debouncedValue, audUsd])

  // ── Global keyboard focus ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { inputRef.current?.focus(); setSuggestions([]); return }
      if (e.key === 'F1') setActiveModule('markets')
      if (e.key === 'F2') setActiveModule('portfolio')
      if (e.key === 'F3') setActiveModule('crypto')
      if (e.key === 'F4') setActiveModule('fx')
      if (e.key === 'F5') setActiveModule('macro')
      if (e.key === 'F6') setActiveModule('watchlist')
      if (e.key === 'F7') setActiveModule('news')
      if (e.key === 'F8') setActiveModule('global')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveModule])

  // ── Autocomplete — debounced so typing never blocks the UI ──────────────────
  const handleChange = (e) => {
    setInputValue(e.target.value)
    setHistIdx(-1)
    setShowRecent(false)
  }

  useEffect(() => {
    setSuggestIdx(-1)
    setSuggestions(debouncedValue.trim() ? getSuggestions(debouncedValue) : [])
  }, [debouncedValue])

  // Recent-search entries treated as a navigable list, same shape as a
  // suggestion item, so keyboard nav can be shared between both dropdowns.
  const recentItems = recentSearches.map((r) => ({ sym: r, label: r, type: 'recent' }))
  const activeList  = suggestions.length ? suggestions : (showRecent ? recentItems : [])

  // ── Key handling — only navigation keys, no processing on regular keystrokes ─
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (activeList.length > 0) {
        setSuggestIdx((i) => Math.max(i - 1, -1))
      } else {
        const allHist = localHistory.length ? localHistory : cmdHistory
        const idx = Math.min(histIdx + 1, allHist.length - 1)
        setHistIdx(idx)
        setInputValue(allHist[idx] ?? '')
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (activeList.length > 0) {
        setSuggestIdx((i) => Math.min(i + 1, activeList.length - 1))
      } else {
        const allHist = localHistory.length ? localHistory : cmdHistory
        const idx = Math.max(histIdx - 1, -1)
        setHistIdx(idx)
        setInputValue(idx === -1 ? '' : allHist[idx])
      }
      return
    }
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      const sel = suggestIdx >= 0 ? suggestions[suggestIdx] : suggestions[0]
      if (sel) { setInputValue(sel.label); setSuggestions([]); setSuggestIdx(-1) }
      return
    }
    if (e.key === 'Escape') {
      setSuggestions([]); setSuggestIdx(-1); setShowRecent(false); return
    }
    if (e.key === 'Enter') {
      if (suggestIdx >= 0 && activeList[suggestIdx]) {
        selectSuggestion(activeList[suggestIdx])
        return
      }
      execute(inputValue)
    }
  }

  // ── Status helper ─────────────────────────────────────────────────────────────
  const flash = (msg, cls = '', ms = 3000) => {
    setStatus({ text: msg, cls })
    if (ms) setTimeout(() => setStatus('READY'), ms)
  }

  // ── AI routing ────────────────────────────────────────────────────────────────
  const routeToAI = async (raw) => {
    flash(`ROUTING TO AI — "${raw.trim().substring(0, 40)}${raw.length > 40 ? '…' : ''}"`, 'text-terminal-gold', 0)
    setChatOpen(true)
    const userMsg = { role:'user', content: raw.trim() }
    addChatMessage(userMsg)
    addChatMessage({ role:'assistant', content:'' })
    try {
      await askClaude([userMsg], (_, full) => updateLastChatMessage({ role:'assistant', content: full }))
      flash('READY')
    } catch (err) {
      updateLastChatMessage({ role:'assistant', content:`[ERROR] ${err.message}` })
      flash('AI ERROR — CHECK API KEY', 'text-terminal-red', 5000)
    }
  }

  // ── Build modal asset from YF quote ──────────────────────────────────────────
  const buildModalAsset = (q, type, resolvedSym) => {
    const isUSD   = q.currency === 'USD'
    const toAud   = (v) => v != null ? (isUSD ? v / audUsd : v) : null
    return {
      symbol:  resolvedSym,
      name:    q.name,
      price:   toAud(q.last),
      pct:     q.pct,
      change:  toAud(q.change),
      type,
      extra: {
        open:      toAud(q.open),
        high:      toAud(q.high),
        low:       toAud(q.low),
        vol:       q.vol,
        week52High: toAud(q.week52High),
        week52Low:  toAud(q.week52Low),
        prevClose:  toAud(q.prevClose),
        isOpen:     q.isOpen,
        exchange:   q.exchange,
        currency:   q.currency,
        nativePrice: q.last,
      },
    }
  }

  // ── Ticker lookup ─────────────────────────────────────────────────────────────
  const lookupTicker = async (raw) => {
    const sym = raw.trim().toUpperCase()
    flash(`LOOKING UP ${sym}...`, 'text-terminal-gold animate-pulse', 0)

    // Known crypto → fetch from CoinGecko via existing cache
    const COIN_IDS = { BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin', XRP:'ripple', ADA:'cardano', DOGE:'dogecoin', AVAX:'avalanche-2', MATIC:'matic-network', LINK:'chainlink' }
    if (COIN_IDS[sym]) {
      try {
        const raw2 = await fetchCryptoMarkets('aud')
        const { data: coinList, currency: ccy } = raw2
        const coins = transformCryptoMarkets(coinList, ccy)
        const coin  = coins.find((c) => c.symbol === sym)
        if (coin) {
          openModal({
            symbol: sym,
            name:   coin.name,
            price:  coin.price,
            pct:    coin.pct24h,
            change: coin.change24h,
            type:   'crypto',
            coinId: COIN_IDS[sym],
            extra:  { supply: coin.supply, ath: coin.ath, dominance: coin.dominance },
          })
          flash(`PROFILE: ${sym}`, 'text-terminal-green', 2000)
          return
        }
      } catch { /* not a known coin — fall through to the next lookup */ }
    }

    // FX pair → navigate to FX module with a status note
    if (sym.includes('/') || sym.length === 6 && ['AUD','USD','EUR','GBP','JPY','NZD'].some(c => sym.startsWith(c))) {
      setActiveModule('fx')
      flash(`→ FX MODULE · ${sym}`, 'text-terminal-green', 2000)
      return
    }

    // YF lookup: try the symbol directly, then with .AX suffix
    const knownEntry = KNOWN_SYMBOLS.find((s) => s.label === sym || s.sym === sym)
    const yfSym      = knownEntry?.sym ?? sym

    const tryLookup = async (s, type) => {
      try {
        const q = await fetchYFQuote(s)
        if (q?.last != null) return { q, resolvedSym: s, type: type ?? detectAssetType(s) }
      } catch { /* symbol variant did not resolve — caller tries the next one */ }
      return null
    }

    let result = await tryLookup(yfSym, knownEntry?.type)
    if (!result && !yfSym.includes('.') && !yfSym.startsWith('^')) {
      result = await tryLookup(`${sym}.AX`, 'asx')
    }

    if (result) {
      const { q, resolvedSym, type } = result
      openModal(buildModalAsset(q, type, resolvedSym))
      flash(`PROFILE: ${resolvedSym}`, 'text-terminal-green', 2000)
      return
    }

    // Fallback to AI
    flash('NOT FOUND — ROUTING TO AI...', 'text-terminal-gold', 1000)
    setTimeout(() => routeToAI(raw), 800)
  }

  // ── Movers fetch ──────────────────────────────────────────────────────────────
  const fetchMovers = async (title, symbols, sortDir = 'desc') => {
    flash(`LOADING ${title}...`, 'text-terminal-gold animate-pulse', 0)
    try {
      const quotes = await fetchYahooBatch(symbols)
      const items = Object.entries(quotes)
        .map(([sym, q]) => ({
          symbol: sym,
          name:   q.name,
          price:  q.currency === 'USD' ? q.last * audUsd : q.last,
          pct:    q.pct,
          type:   detectAssetType(sym),
          q,
        }))
        .filter((i) => i.pct != null)
        .sort((a, b) => sortDir === 'desc' ? b.pct - a.pct : a.pct - b.pct)
        .slice(0, 10)
      flash('READY')
      setMovers({ title, items })
    } catch {
      flash('FETCH ERROR', 'text-terminal-red', 3000)
    }
  }

  // ── Command executor ──────────────────────────────────────────────────────────
  const execute = useCallback(async (raw) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    const cmd  = trimmed.toLowerCase()
    const parts = trimmed.split(/\s+/)

    pushHistory(trimmed)
    setHistIdx(-1)
    setInputValue('')
    setSuggestions([])

    // ── HELP ──
    if (cmd === 'help' || cmd === '?' || cmd === 'commands') {
      setHelpOpen(true)
      return
    }

    // ── IDEAS / ROADMAP ──
    if (cmd === 'ideas' || cmd === 'roadmap') {
      window.dispatchEvent(new CustomEvent('madden:open-ideas'))
      flash('→ IDEAS & ROADMAP', 'text-terminal-green', 1500)
      return
    }

    // ── AI direct ──
    if (parts[0].toLowerCase() === 'ai') {
      const query = parts.slice(1).join(' ') || 'Give me an Australian market overview'
      routeToAI(query)
      return
    }

    // ── Navigation ──
    for (const [module, aliases] of Object.entries(NAV_MAP)) {
      if (aliases.includes(cmd) || (cmd === 'news' && parts.length === 1)) {
        setActiveModule(module)
        if (module === 'news') setNewsFilter('')
        flash(`→ ${module.toUpperCase()}`, 'text-terminal-green', 1500)
        return
      }
    }

    // ── NEWS {keyword} ──
    if (parts[0].toLowerCase() === 'news' && parts.length > 1) {
      const keyword = parts.slice(1).join(' ')
      setNewsFilter(keyword.toUpperCase())
      setActiveModule('news')
      flash(`NEWS FILTER: ${keyword.toUpperCase()}`, 'text-terminal-green', 2000)
      return
    }

    // ── TOP movers ──
    if (cmd === 'top' || cmd === 'movers' || cmd === 'gainers') {
      await fetchMovers('TOP MOVERS TODAY', TOP_SCAN_ALL, 'desc')
      return
    }
    if (cmd === 'losers') {
      await fetchMovers('TOP LOSERS TODAY', TOP_SCAN_ALL, 'asc')
      return
    }
    if (cmd === 'asx top') {
      await fetchMovers('ASX TOP MOVERS', TOP_SCAN_AU, 'desc')
      return
    }
    if (cmd === 'crypto top') {
      setActiveModule('crypto')
      flash('→ CRYPTO MODULE', 'text-terminal-green', 1500)
      return
    }

    // ── WL ADD {symbol} ──
    if (parts[0].toLowerCase() === 'wl' && parts[1]?.toLowerCase() === 'add' && parts[2]) {
      const sym = parts[2].toUpperCase()
      addToWatchlist(sym)
      flash(`WATCHLIST: ${sym} ADDED`, 'text-terminal-green', 2500)
      setActiveModule('watchlist')
      return
    }

    // ── PORT ADD {symbol} — placeholder (portfolio module doesn't support programmatic adds yet) ──
    if (parts[0].toLowerCase() === 'port' && parts[1]?.toLowerCase() === 'add' && parts[2]) {
      flash('PORT ADD: Open Portfolio module to add positions', 'text-terminal-text-dim', 3000)
      setActiveModule('portfolio')
      return
    }

    // ── COMPARE {sym1} {sym2} ──
    //
    // The joining-word guard is not cosmetic. Without it "compare BHP and RIO"
    // was caught here, took "and" as the second symbol, and fetched a quote for
    // AND — a real NASDAQ listing (The Andersons) — then drew a comparison
    // table headed "BHP vs AND" with genuine prices in it. Nothing errored.
    // The natural-language branch further down handles that phrasing properly.
    const JOINERS = /^(and|vs|vs\.|versus|with|to)$/i
    if (parts[0].toLowerCase() === 'compare' && parts.length >= 3 && !JOINERS.test(parts[2])) {
      const [, s1raw, s2raw] = parts
      flash(`LOADING COMPARISON...`, 'text-terminal-gold', 0)
      try {
        const [q1, q2] = await Promise.all([
          fetchYFQuote(toYahooSymbol(s1raw, detectAssetType(s1raw))),
          fetchYFQuote(toYahooSymbol(s2raw, detectAssetType(s2raw))),
        ])
        const a1 = buildModalAsset(q1, detectAssetType(s1raw), s1raw.toUpperCase())
        const a2 = buildModalAsset(q2, detectAssetType(s2raw), s2raw.toUpperCase())
        setCompareAssets([a1, a2])
        flash('READY')
      } catch {
        flash('COMPARE FAILED — CHECK SYMBOLS', 'text-terminal-red', 3000)
      }
      return
    }

    // ── CORRELATE {sym1} {sym2} — opens the Correlation Explorer preloaded
    // with both assets (plus the default ASX top 10). "AUD" is accepted as
    // shorthand for AUD/USD. ──
    if (parts[0].toLowerCase() === 'correlate' && parts.length >= 2) {
      const norm = (s) => (s.toUpperCase() === 'AUD' ? 'AUDUSD' : s.toUpperCase().replace(/\.AX$/i, ''))
      const assets = parts.slice(1, 3).map(norm)
      window.dispatchEvent(new CustomEvent('madden:open-correlation', { detail: { assets } }))
      flash(`CORRELATION EXPLORER: ${assets.join(' · ')}`, 'text-terminal-green', 2000)
      return
    }

    // ── ALERT {sym} {price} ──
    if (parts[0].toLowerCase() === 'alert' && parts.length >= 3) {
      const alertSym   = parts[1].toUpperCase()
      const alertPrice = parseFloat(parts[2])
      if (isNaN(alertPrice)) {
        flash('ALERT FORMAT: ALERT {SYMBOL} {PRICE}', 'text-terminal-red', 3000)
        return
      }
      addAlert(alertSym, alertPrice)
      flash(`ALERT SET: ${alertSym} @ A$${alertPrice.toFixed(2)}`, 'text-terminal-green', 3000)
      return
    }

    // ── Natural language ──
    //
    // Runs after every exact terminal command, so "TOP", "ALERT BHP 50" and
    // the rest keep their existing behaviour, and before the ticker lookup and
    // the AI catch-all, so "add BHP to watchlist" is handled locally rather
    // than becoming a question for the model. parseNaturalLanguage is the same
    // function the preview line uses — see its comment.
    const nl = parseNaturalLanguage(trimmed)
    if (nl) {
      switch (nl.kind) {
        case 'watchlist':
          addToWatchlist(nl.symbol)
          flash(`ADDED ${nl.symbol} ✓`, 'text-terminal-green', 2500)
          return

        case 'alert':
          addAlert(nl.symbol, nl.price, nl.direction)
          flash(`ALERT SET: ${nl.symbol} ${nl.direction.toUpperCase()} A$${nl.price.toFixed(2)} ✓`, 'text-terminal-green', 3000)
          return

        case 'nav':
          setActiveModule(nl.module)
          if (nl.module === 'news') setNewsFilter('')
          flash(`→ ${nl.module.toUpperCase()}`, 'text-terminal-green', 1500)
          return

        case 'scanner':
          // Intent first, then navigate, then the event. The intent is read by
          // the Scanner's useState initialiser and covers a cold open (the
          // module is lazy-loaded, so at this instant it may not exist yet);
          // the event covers a Scanner already on screen. See moduleIntent.js.
          setModuleIntent('scanner', { tab: nl.tab })
          setActiveModule('scanner')
          window.dispatchEvent(new CustomEvent('madden:scanner-tab', { detail: { tab: nl.tab } }))
          flash(`→ SCANNER · ${nl.tab.toUpperCase()}`, 'text-terminal-green', 2000)
          return

        case 'lookup':
          await lookupTicker(nl.symbol)
          return

        case 'ai':
          await routeToAI(nl.query)
          return

        case 'compare': {
          flash('LOADING COMPARISON...', 'text-terminal-gold', 0)
          try {
            const [q1, q2] = await Promise.all([
              fetchYFQuote(toYahooSymbol(nl.a, detectAssetType(nl.a))),
              fetchYFQuote(toYahooSymbol(nl.b, detectAssetType(nl.b))),
            ])
            setCompareAssets([
              buildModalAsset(q1, detectAssetType(nl.a), nl.a.toUpperCase()),
              buildModalAsset(q2, detectAssetType(nl.b), nl.b.toUpperCase()),
            ])
            flash('READY')
          } catch {
            flash('COMPARE FAILED — CHECK SYMBOLS', 'text-terminal-red', 3000)
          }
          return
        }

        default:
          break
      }
    }

    // ── Ticker lookup (no spaces = likely a symbol) ──
    if (!trimmed.includes(' ')) {
      await lookupTicker(trimmed)
      return
    }

    // ── Unknown → AI ──
    await routeToAI(trimmed)
  }, [addAlert, addToWatchlist, audUsd, pushHistory, setActiveModule, setNewsFilter, openModal, setChatOpen, addChatMessage, updateLastChatMessage])

  // ── Unified suggestion/recent-search selection — click and Enter both land ──
  // here, so "select" always means the same thing regardless of input method.
  const selectSuggestion = (item) => {
    setSuggestions([]); setSuggestIdx(-1); setShowRecent(false)
    switch (item.type) {
      case 'module':
        setInputValue('')
        setActiveModule(item.sym)
        flash(`→ ${item.sym.toUpperCase()}`, 'text-terminal-green', 1500)
        return
      case 'action':
        setInputValue('')
        // A parsed natural-language command routes straight back through
        // execute(), so clicking the suggestion and pressing Enter on the same
        // text do exactly the same thing.
        if (item.action === 'command') { execute(item.payload); return }
        if (item.action === 'ai') { routeToAI(item.payload); return }
        if (item.action === 'watchlist') {
          addToWatchlist(item.payload)
          flash(`WATCHLIST: ${item.payload} ADDED`, 'text-terminal-green', 2500)
          setActiveModule('watchlist')
          return
        }
        if (item.action === 'portfolio') {
          flash('Open Portfolio to add this position', 'text-terminal-text-dim', 3000)
          setActiveModule('portfolio')
          return
        }
        return
      case 'cmd':
        setInputValue('')
        execute(item.label)
        return
      case 'recent':
        setInputValue('')
        execute(item.label)
        return
      default: // asx/us/index/crypto/fx — a matched ticker
        setInputValue('')
        lookupTicker(item.sym)
        return
    }
  }

  const statusText = typeof status === 'object' ? status.text : status
  const statusCls  = typeof status === 'object' ? status.cls  : 'text-terminal-text-dim'

  return (
    <>
      {helpOpen  && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      {movers    && <MoversPanel
        title={movers.title} items={movers.items}
        onClose={() => setMovers(null)}
        onSelect={(item) => {
          if (item.q) openModal(buildModalAsset(item.q, item.type, item.symbol))
          else lookupTicker(item.symbol)
        }}
      />}
      {compareAssets && <CompareModal assets={compareAssets} onClose={() => setCompareAssets(null)} />}

      <div className="relative flex-shrink-0" ref={wrapperRef}>
        <SuggestionsList
          suggestions={suggestions}
          suggestIdx={suggestIdx}
          onSelect={selectSuggestion}
          quotes={suggestionQuotes}
        />
        {!suggestions.length && showRecent && (
          <RecentSearchesList
            recents={recentSearches}
            activeIdx={suggestIdx}
            onSelect={(r) => selectSuggestion({ sym: r, label: r, type: 'recent' })}
          />
        )}

        {/* Command bar */}
        <div data-tour="cmd-bar" className="flex items-center bg-terminal-bg border-t border-terminal-border px-3 py-1.5 gap-3">
          <Tooltip content={`Command bar\n${shortcutService.shortcuts['ui.command']?.display ?? '/'} to focus from anywhere`}>
            <span className="text-terminal-gold text-2xs font-bold tracking-widest flex-shrink-0 cursor-blink">CMD&gt;</span>
          </Tooltip>

          <input
            ref={inputRef}
            className="cmd-input flex-1 text-xs"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim()) setSuggestions(getSuggestions(inputValue))
              else if (recentSearches.length) setShowRecent(true)
            }}
            placeholder="Ticker · Command · Question — type HELP or ? for all commands"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex items-center gap-3 text-2xs flex-shrink-0">
            <span className={statusCls}>{statusText}</span>
            <span className="text-terminal-border">│</span>
            <AlertBadge alerts={alerts} />
            <span className="text-terminal-border hidden xl:inline">│</span>
            <Tooltip content={`All commands and shortcuts\n${shortcutService.shortcuts['ui.shortcuts']?.display ?? '?'}`}>
              <button
                onClick={() => setHelpOpen(true)}
                className="text-terminal-text-dim hover:text-terminal-gold transition-colors hidden xl:inline"
              >
                HELP
              </button>
            </Tooltip>
            <span className="text-terminal-border hidden xl:inline">│</span>
            <KeyHints context="idle" className="hidden xl:flex" />
          </div>
        </div>

        {/* Live interpretation preview — mirrors what execute() will do if the
            user hits Enter right now, before they commit to it. */}
        {inputValue.trim() && (
          <div className="px-3 py-1 bg-terminal-bg border-t border-terminal-border/30 text-2xs text-terminal-text-dim/70 flex items-center gap-1.5">
            <span className="text-terminal-gold/60">→</span>
            <span className="truncate min-w-0">{interpretCommand(inputValue)}</span>
            <KeyHints
              context={suggestions.length ? 'suggestions' : 'typing'}
              className="ml-auto flex-shrink-0 hidden md:flex"
            />
          </div>
        )}
      </div>
    </>
  )
}
