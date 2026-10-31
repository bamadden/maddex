import { useState, useRef, useEffect, useCallback, memo, Fragment } from 'react'
import { deepDive, rbaPreview } from '../../utils/askAI'
import VERIFIED_CONSTANTS from '../../data/verifiedConstants'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import { useDebounce } from '../../hooks/useDebounce'
import { fetchYFQuote, fetchYahooBatch, fetchCryptoMarkets, transformCryptoMarkets, USING_MOCK_DATA } from '../../services/api'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'
import { fmt } from '../../utils/format'
import Tooltip from '../ui/Tooltip'
import { shortcutService } from '../../services/shortcutService'
import { setModuleIntent, sendModuleIntent } from '../../services/moduleIntent'
import {
  resolveAsset, searchCatalogue, parseSectorQuery, calcMatches, parseCompound,
  parseBondQuery, timeSuggestions, sydneyClock,
} from './commandSearch'

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
  { key:'calendar',  label:'CALENDAR',  desc:'Economic & earnings calendar' },
  { key:'bonds',     label:'BONDS',     desc:'Sovereign curves, bond maths' },
  { key:'etf',       label:'ETFs',      desc:'ETF explorer, fee drag, comparison' },
  { key:'futures',   label:'FUTURES',   desc:'Futures, options chain, short interest' },
  { key:'calculators', label:'CALC',    desc:'Compound, super, CGT, mortgage, tax' },
  { key:'relationships', label:'RELATIONSHIPS', desc:'Company graph — ownership, exposure, peers, every edge sourced' },
  { key:'company',   label:'COMPANY',   desc:'Company profile — DES BHP: ownership, connections, sourced facts' },
]

// Stocks to scan for TOP/LOSERS commands
const TOP_SCAN_AU = ['BHP.AX','CBA.AX','CSL.AX','ANZ.AX','WBC.AX','NAB.AX','WOW.AX','WES.AX','RIO.AX','FMG.AX','MQG.AX','TLS.AX','WDS.AX','STO.AX','MIN.AX','PLS.AX','QAN.AX','GMG.AX']
const TOP_SCAN_US = ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','BAC','XOM','V','AMD','NFLX','DIS','BA']
const TOP_SCAN_ALL = [...TOP_SCAN_AU, ...TOP_SCAN_US]

const NAV_MAP = {
  markets:   ['markets','mkt','indices','heat'],
  portfolio: ['portfolio','holdings','pnl'],
  crypto:    ['crypto','defi','cry','crypt'],
  fx:        ['fx','forex','rates','yield'],
  macro:     ['macro','economic','gdp','cpi','rba','mac'],
  watchlist: ['watchlist','wl','watch'],
  news:      ['news','feed','headlines'],
  global:    ['global','glb','globe'],
  calendar:  ['calendar','cal','events'],
  bonds:     ['bonds','bond','bnd','yields','gilts','treasuries'],
  etf:       ['etf','etfs'],
  futures:   ['futures','fut','derivatives'],
  calculators: ['calc','calcs','calculator','calculators'],
  relationships: ['relationships','rel','graph','network','links'],
  company:   ['company','profile','des'],
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
    { cmd:'CALENDAR / CAL', desc:'Economic & earnings calendar' },
    { cmd:'BONDS / BND', desc:'Sovereign bond curves' },
    { cmd:'ETF', desc:'ETF explorer' },
    { cmd:'FUTURES / FUT', desc:'Futures, options, market structure' },
    { cmd:'CALC', desc:'Calculators' },
  ]},
  { title:'TICKER LOOKUP', items:[
    { cmd:'BHP / CBA / AAPL ...', desc:'Any symbol → full asset profile' },
    { cmd:'westpac / rio tinto', desc:'Company names, typos forgiven' },
    { cmd:'materials / banks', desc:'An ASX sector\'s stocks' },
    { cmd:'au 10y / 30y gilt', desc:'Bonds at that maturity' },
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
    { cmd:'alert BHP above 48', desc:'Alerts in words — also "notify me when BHP hits 48"' },
    { cmd:'add BHP / watch CSL', desc:'Add to watchlist' },
    { cmd:'analyse CSL', desc:'MaddenAI analysis — also "what is CSL", "tell me about BHP"' },
    { cmd:'deep dive BHP', desc:'Six-part MaddenAI deep dive, saved to research' },
    { cmd:'rba preview', desc:'Pre-decision brief on the next RBA meeting, saved to research' },
    { cmd:'compound 10000 8% 20 years', desc:'Opens the calculator filled in' },
    { cmd:'CORRELATE {s1} {s2}', desc:'Open Correlation Explorer — e.g. CORRELATE BHP AUD' },
    { cmd:'WL ADD {sym}', desc:'Quick add to watchlist — e.g. WL ADD NVDA' },
    { cmd:'AI {question}', desc:'Ask MaddenAI directly' },
    { cmd:'IDEAS / ROADMAP', desc:'Vote on features, see what\'s coming' },
    { cmd:'HELP / ?', desc:'Show this panel' },
  ]},
  { title:'KEYBOARD', items:[
    { cmd:'/', desc:'Focus command bar from anywhere' },
    { cmd:'↑ / ↓', desc:'Move through results, or history when none' },
    { cmd:'Tab / Shift+Tab', desc:'Next / previous result group' },
    { cmd:'ESC', desc:'Close modal or AI panel' },
    { cmd:'M / C / F / N / G / P / W / X', desc:'Module hotkeys' },
    { cmd:'F1–F8', desc:'Module function keys' },
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
// exists to catch. Known symbols and company names resolve through the
// catalogue ("westpac" → WBC.AX); anything else is passed through untouched
// rather than guessed at.
function resolveSymbol(raw) {
  const q = String(raw ?? '').trim()
  if (!q) return null
  return resolveAsset(q)?.sym ?? q.toUpperCase()
}

// The display form — BHP rather than BHP.AX, for confirmations.
function displaySymbol(raw) {
  const q = String(raw ?? '').trim()
  return resolveAsset(q)?.label ?? q.toUpperCase()
}

// Module names as a person would say them, mapped to module ids. Checked
// against NAV_MAP's aliases first, so this only has to carry the names that
// are not already aliases.
const SPOKEN_MODULES = {
  brief: 'brief', 'morning brief': 'brief', 'my brief': 'brief', 'weekly review': 'brief',
  scanner: 'scanner', scan: 'scanner', screener: 'screener', screen: 'screener',
  dashboard: 'dashboard', home: 'dashboard',
  calendar: 'calendar', settings: 'settings', replay: 'replay',
  'ai analyst': 'ai', 'maddenai': 'ai',
  calculators: 'calculators', etfs: 'etf', rates: 'fx', markets: 'markets',
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

const analysisQuery = (sym) =>
  `Give me a full analysis of ${sym}: what the business does, what is driving the share price, the main risks, and what an Australian investor should be watching. General information only, not advice.`

// An asset named in a phrase — a ticker or a company name the catalogue can
// pin to one listing. Prose ("inflation", "the RBA") returns null.
function assetIn(phrase) {
  const p = String(phrase ?? '').trim().replace(/[?.!]$/, '')
  if (!p || moduleIdFor(p)) return null
  const hit = resolveAsset(p)
  if (hit) return { sym: hit.sym, label: hit.label, name: hit.desc.split(' · ')[0] }
  return /^[A-Z^][A-Z0-9.^/-]{0,11}$/.test(p) ? { sym: p, label: p, name: null } : null
}

// Returns { kind, ...args, say } or null. `say` is the preview line, and is
// also what the confirmation flash is built from, so the two always agree.
function parseNaturalLanguage(raw) {
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return null
  const lower = t.toLowerCase()

  const m = (re) => t.match(re)

  // "add BHP to watchlist" / "add westpac" / "watch BHP"
  let hit = m(/^(?:add|watch|track|follow) (.+?)(?: to (?:my |the )?watch ?list)?$/i)
  if (hit && !/ to (?:my |the )?portfolio$/i.test(t)) {
    const a = assetIn(hit[1])
    if (a) return { kind: 'watchlist', symbol: a.sym, say: `Add ${a.sym} to watchlist` }
  }

  // "add BHP to portfolio" — the Portfolio module owns position entry.
  hit = m(/^add (.+?) to (?:my |the )?portfolio$/i)
  if (hit) {
    const a = assetIn(hit[1])
    if (a) return { kind: 'nav', module: 'portfolio', say: `Open Portfolio to add ${a.label}` }
  }

  // "alert BHP above 48" / "set alert BHP below 40" / "alert me when CBA goes above 170"
  // "set alert BHP 48" / "notify me when BHP hits 48" — no direction: the
  // execute step reads the price and picks the side the target is on.
  //
  // The name group is lazy so "BHP above 48" does not read "BHP above" as the
  // name; a two-word name ("rio tinto") still matches when one word cannot.
  hit = m(new RegExp(`^(?:set (?:an? )?)?(?:price )?alert(?: me)?(?: for| on| when)? (${TICKER_RE}(?: [a-z]+)??) (?:goes |gets |is |hits |reaches |crosses )?(?:(above|below|over|under|at) )?(?:A?\\$)?([0-9]+(?:\\.[0-9]+)?)$`, 'i'))
    ?? m(new RegExp(`^(?:notify|tell|ping) me (?:when|if) (${TICKER_RE}(?: [a-z]+)??) (?:goes |gets |is |trades )?(?:(above|below|over|under) )?(?:hits |reaches |crosses |touches )?(?:A?\\$)?([0-9]+(?:\\.[0-9]+)?)$`, 'i'))
  if (hit) {
    const a = assetIn(hit[1])
    if (a) {
      const direction = !hit[2] || /at/i.test(hit[2]) ? null : /above|over/i.test(hit[2]) ? 'above' : 'below'
      const price = parseFloat(hit[3])
      return {
        kind: 'alert', symbol: a.sym, direction, price,
        say: `Set alert: ${a.sym} ${direction ?? 'at'} A$${price.toFixed(2)}`,
      }
    }
  }

  // "compare BHP and RIO" / "compare BHP vs RIO" / "compare westpac with anz"
  hit = m(/^compare (.+?) (?:and|vs\.?|versus|with|to) (.+)$/i)
    ?? m(/^compare (\S+) (\S+)$/i)
  if (hit) {
    const [a, b] = [assetIn(hit[1]), assetIn(hit[2])]
    if (a && b) return { kind: 'compare', a: a.sym, b: b.sym, say: `Compare ${a.label} vs ${b.label}` }
  }

  // "calculate compound 10000 8% 20 years"
  const calc = parseCompound(t)
  if (calc) {
    return {
      kind: 'calc', tab: 'investment', compound: calc,
      say: `Compound A$${Math.round(calc.initial).toLocaleString('en-AU')} at ${calc.rate}% for ${calc.years} years → A$${Math.round(calc.final).toLocaleString('en-AU')}`,
    }
  }

  // "au 10y" / "10 year treasury" → that maturity on the Bonds module.
  const bond = parseBondQuery(t)
  if (bond.length && !/^(bonds?|yields?)$/i.test(lower)) {
    const b = bond[0]
    return { kind: 'bond', market: b.market, maturity: b.maturity, say: `Open BONDS · ${b.label}` }
  }

  // "what is CSL" / "what's westpac" — an overview of the company.
  //
  // Only when the catalogue knows the name. "what is inflation", "what is a
  // P/E ratio" and "what is CPI" are questions, and reach MaddenAI as typed —
  // a capitalised acronym is not evidence of a ticker here the way it is in
  // "add NVDA", because finance terms are written in capitals too.
  hit = m(/^what(?:'s| is| are)(?: the)? (.+?)\??$/i)
  if (hit) {
    const known = resolveAsset(hit[1])
    if (known && !moduleIdFor(hit[1])) {
      const name = known.desc.split(' · ')[0]
      return {
        kind: 'ai', symbol: known.label,
        query: `What is ${name} (${known.label})? Give me an overview of what they do, their key metrics, and what drives their share price.`,
        say: `Ask MaddenAI: what is ${name} (${known.label})`,
      }
    }
    return null
  }

  // "rba preview" / "rba analysis" — the pre-decision brief for the next
  // RBA meeting, kept in SAVED RESEARCH.
  if (/^(?:rba (?:preview|analysis|decision preview)|preview (?:the )?rba)\??$/i.test(t)) return { kind: 'rbapreview', say: 'MaddenAI RBA decision preview' }

  // "deep dive BHP" / "deep dive into CSL" / "BHP deep dive" — the six-part
  // long-form analysis, kept in SAVED RESEARCH.
  hit = m(/^deep ?dive(?: on| into)?(?: the)? (.+?)\??$/i) ?? m(/^(.+?) deep ?dive$/i)
  if (hit) {
    const a = assetIn(hit[1])
    if (a) return { kind: 'deepdive', sym: a.sym, name: a.name ?? a.label, say: `MaddenAI deep dive: ${a.label}` }
  }

  // "analyse BHP" / "analyze BHP" / "tell me about CSL" / "research westpac" /
  // "BHP analysis" / "analysis of BHP"
  hit = m(/^(?:analys[ez]e?|research|tell me about|analysis of)(?: the)? (.+?)\??$/i)
    ?? m(/^(.+?) (?:analysis|research)$/i)
  if (hit) {
    const a = assetIn(hit[1])
    if (a) return { kind: 'ai', symbol: a.label, query: analysisQuery(a.label), say: `Ask MaddenAI to analyse ${a.label}` }
  }

  // "how is BHP doing" / "how's BHP doing" / "how is BHP performing"
  hit = m(/^how(?:'s| is| has) (.+?) (?:been )?(?:doing|performing|going|performed)\??$/i)
  if (hit && !/^(?:my |the )?portfolio$/i.test(hit[1])) {
    const a = assetIn(hit[1])
    if (a) {
      return {
        kind: 'ai', symbol: a.label,
        query: `How has ${a.label} been performing recently, and what has been driving it? Describe direction and condition rather than quoting prices you were not given. General information only, not advice.`,
        say: `Ask MaddenAI how ${a.label} is performing`,
      }
    }
  }

  // "how is my portfolio" / "how's my portfolio doing" / "portfolio summary"
  if (/^(?:how(?:'s| is| has)? (?:my |the )?portfolio(?: been)?(?: doing| going| performing| looking)?|(?:my )?portfolio (?:summary|overview|performance|update))\??$/i.test(t)) {
    return { kind: 'nav', module: 'portfolio', say: 'Navigate to PORTFOLIO' }
  }

  // "scan for breakouts" / "scan for oversold stocks"
  hit = m(/^scan (?:for |the )?([a-z ]+?)(?: stocks| setups)?$/i)
  if (hit) {
    const wanted = hit[1].trim().toLowerCase()
    const TABS = { breakouts: 'breakouts', breakout: 'breakouts', oversold: 'oversold', overbought: 'overbought', volume: 'volume', gaps: 'gaps', gap: 'gaps', momentum: 'momentum', patterns: 'patterns', pattern: 'patterns' }
    const tab = TABS[wanted]
    if (tab) return { kind: 'scanner', tab, say: `Scanner → ${tab.toUpperCase()}` }
  }

  // Phrases that name a tool rather than a module: open the module on the
  // right tab. Exact phrases only, so a question about the topic still
  // reaches MaddenAI.
  const DEEP = {
    'compound':             ['calculators', { tab: 'investment' }, 'CALC · INVESTMENT'],
    'compound interest':    ['calculators', { tab: 'investment' }, 'CALC · INVESTMENT'],
    'mortgage':             ['calculators', { tab: 'property' },   'CALC · PROPERTY'],
    'cgt':                  ['calculators', { tab: 'tax' },        'CALC · TAX'],
    'super':                ['calculators', { tab: 'super' },      'CALC · SUPER'],
    'options':              ['futures', { tab: 'options' },        'FUTURES · OPTIONS'],
    'compound calculator':  ['calculators', { tab: 'investment' }, 'CALC · INVESTMENT'],
    'mortgage calculator':  ['calculators', { tab: 'property' },   'CALC · PROPERTY'],
    'stamp duty':           ['calculators', { tab: 'property' },   'CALC · PROPERTY'],
    'cgt calculator':       ['calculators', { tab: 'tax' },        'CALC · TAX'],
    'tax calculator':       ['calculators', { tab: 'tax' },        'CALC · TAX'],
    'super calculator':     ['calculators', { tab: 'super' },      'CALC · SUPER'],
    'au bonds':             ['bonds', { market: 'AU' }, 'BONDS · AU'],
    'us bonds':             ['bonds', { market: 'US' }, 'BONDS · US'],
    'treasuries':           ['bonds', { market: 'US' }, 'BONDS · US'],
    'gilts':                ['bonds', { market: 'UK' }, 'BONDS · UK'],
    'etf comparison':       ['etf', { compareMode: true }, 'ETFs · COMPARISON'],
    'compare etfs':         ['etf', { compareMode: true }, 'ETFs · COMPARISON'],
    'short interest':       ['futures', { tab: 'structure' }, 'FUTURES · MARKET STRUCTURE'],
    'options calculator':   ['futures', { tab: 'options' },   'FUTURES · OPTIONS'],
    'options chain':        ['futures', { tab: 'options' },   'FUTURES · OPTIONS'],
  }
  const deep = DEEP[lower.replace(/[?.!]$/, '')]
  if (deep) return { kind: 'deeplink', module: deep[0], intent: deep[1], say: `Open ${deep[2]}` }

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

  // A module named on its own — "scanner", "brief", "etfs".
  const bare = moduleIdFor(lower)
  if (bare) return { kind: 'nav', module: bare, say: `Navigate to ${bare.toUpperCase()}` }

  // Everything else is prose, and prose goes to the model — unchanged.
  return null
}

// The terse terminal forms, "ALERT BHP 48" and "COMPARE BHP RIO". Shared by
// the preview and execute() so both stand aside for the same sentences.
//
// The guards are not cosmetic. "alert BHP above 48" used to be caught as the
// terse form, read "above" as the price and failed with a format error; the
// sentence never reached the parser that understands it. "compare BHP and
// RIO" fetched a quote for AND (a real NASDAQ listing) and drew "BHP vs AND".
const isTerseAlert = (parts) =>
  parts.length === 3 && parts[0].toLowerCase() === 'alert' && /^\$?\d+(\.\d+)?$/.test(parts[2])
const isTerseCompare = (parts) =>
  parts.length === 3 && parts[0].toLowerCase() === 'compare'

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
  if (['des', 'profile'].includes(parts[0].toLowerCase()) && parts[1]) return `Company profile for ${parts[1].toUpperCase()}`
  for (const [module, aliases] of Object.entries(NAV_MAP)) {
    if (aliases.includes(cmd)) return `Navigate to ${module.toUpperCase()}`
  }
  if (parts[0].toLowerCase() === 'news' && parts.length > 1) return `Filter news by "${parts.slice(1).join(' ')}"`
  if (cmd === 'top' || cmd === 'movers' || cmd === 'gainers') return 'Show top 10 movers today'
  if (cmd === 'losers') return 'Show top 10 losers today'
  if (cmd === 'asx top') return 'Show top ASX 200 movers'
  if (cmd === 'crypto top') return 'Navigate to CRYPTO module'
  if (parts[0].toLowerCase() === 'wl' && parts[1]?.toLowerCase() === 'add' && parts[2]) return `Add ${resolveSymbol(parts[2])} to watchlist`
  if (parts[0].toLowerCase() === 'port' && parts[1]?.toLowerCase() === 'add' && parts[2]) return `Open Portfolio to add ${parts[2].toUpperCase()}`
  if (isTerseCompare(parts)) return `Compare ${displaySymbol(parts[1])} vs ${displaySymbol(parts[2])}`
  if (isTerseAlert(parts)) return `Set alert: ${resolveSymbol(parts[1])} at A$${parseFloat(parts[2].replace('$', '')).toFixed(2)}`
  const sector = parseSectorQuery(trimmed)
  if (sector) return `${sector.sector} · ${sector.stocks.length} ASX stocks — ↵ or ↓ to pick one`
  // Natural language, checked before the two catch-alls below so the preview
  // says "Add BHP.AX to watchlist" rather than "Ask MaddenAI: …".
  const nl = parseNaturalLanguage(trimmed)
  if (nl) return nl.say

  const named = resolveAsset(trimmed)
  if (named) return `Look up ${named.label} · ${named.desc.split(' · ')[0]}`
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

// ─── Autocomplete ──────────────────────────────────────────────────────────────
// Categorised results. A parsed command leads, because that is what the user
// typed; then assets, bonds, modules, calculators and terminal commands; and
// last, always, the offer to ask MaddenAI.

const PER_CATEGORY = 5
const MATCH_LIMIT = 9

const isHelpQuery = (raw) => /^(\?|help|commands)$/i.test(raw.trim())

// A half-typed command or module name ("compa", "calen") is not a ticker, and
// offering "Add COMPA to watchlist" for it is noise in the middle of typing.
const isCommandPrefix = (q) => {
  const Q = q.toUpperCase()
  return CMD_SUGGESTIONS.some((c) => c.sym.startsWith(Q))
    || MODULE_LIST.some((m) => m.label.startsWith(Q) || m.key.toUpperCase().startsWith(Q))
    || Object.values(NAV_MAP).flat().some((a) => a.toUpperCase().startsWith(Q))
}

function buildActionSuggestions(rawInput, nl) {
  const q = rawInput.trim()
  if (nl) {
    const ai = nl.kind === 'ai' || nl.kind === 'deepdive'
    const category = ai ? 'MADDENAI' : nl.kind === 'calc' ? 'CALC' : nl.kind === 'bond' ? 'BONDS' : 'ACTIONS'
    const type = ai ? 'ai' : nl.kind === 'calc' ? 'calc' : nl.kind === 'bond' ? 'bond' : 'action'
    return [{ sym: `nl:${q}`, label: nl.say, type, category, desc: 'Press Enter to run', action: 'command', payload: q }]
  }
  // Watchlist/portfolio adds only for something that names an asset. They used
  // to be offered for any first word, so "rba" offered "Add RBA to watchlist".
  if (q.includes(' ') && !resolveAsset(q)) return []
  const asset = resolveAsset(q)
  if (!asset && (moduleIdFor(q) || !/^[a-z0-9.^-]{1,6}$/i.test(q) || isCommandPrefix(q))) return []
  if (asset?.type === 'fx' || asset?.type === 'index') return []
  const sym = asset?.sym ?? q.toUpperCase()
  return [
    { sym:`wl:${sym}`,   label:`Add ${sym} to watchlist`,  type:'action', category:'ACTIONS', desc:'Quick add to your watchlist',       action:'watchlist', payload:sym },
    { sym:`port:${sym}`, label:`Add ${sym} to portfolio`,  type:'action', category:'ACTIONS', desc:'Opens Portfolio to add a position', action:'portfolio', payload:sym },
  ]
}

function getSuggestions(input) {
  const raw = input.trim()
  if (!raw || isHelpQuery(raw)) return []
  const Q = raw.toUpperCase()
  const lower = raw.toLowerCase()
  const nl = parseNaturalLanguage(raw)

  const sector = parseSectorQuery(raw)
  const found = sector
    ? sector.stocks.map((s) => ({ ...s, category: 'STOCKS', desc: s.desc }))
    : searchCatalogue(raw).map((s) => ({
        ...s,
        category: s.type === 'crypto' ? 'CRYPTO' : s.type === 'fx' ? 'FX' : 'STOCKS',
      }))

  const bonds = parseBondQuery(raw).map((b) => ({
    sym: `bond:${b.market}:${b.maturity}`, label: b.label, desc: b.desc, type: 'bond', category: 'BONDS',
    market: b.market, maturity: b.maturity,
  }))

  const modules = MODULE_LIST
    .filter((m) => m.label.startsWith(Q) || m.key.startsWith(lower) || (lower.length >= 2 && NAV_MAP[m.key]?.some((a) => a === lower)))
    .map((m) => ({ sym:m.key, label:m.label, desc:m.desc, type:'module', category:'MODULES' }))

  const calcs = nl?.kind === 'calc' ? [] : calcMatches(raw).map((c) => ({
    sym: `calc:${c.key}`, label: c.label, desc: c.desc, type: 'calc', category: 'CALC', tab: c.tab,
  }))

  const commands = CMD_SUGGESTIONS
    .filter((c) => c.sym.startsWith(Q))
    .map((c) => ({ ...c, category:'COMMANDS' }))

  const perCat = (items) => items.slice(0, sector ? 8 : PER_CATEGORY)
  const matched = [
    ...perCat(found.filter((s) => s.category === 'STOCKS')),
    ...perCat(found.filter((s) => s.category === 'CRYPTO')),
    ...perCat(found.filter((s) => s.category === 'FX')),
    ...bonds, ...modules, ...calcs, ...commands,
  ].slice(0, sector ? 8 : MATCH_LIMIT)

  // "bonds" parses as navigation and also lists the BONDS module, and "10y"
  // parses as a bond and also lists AU 10Y and US 10Y — one row each, not two.
  const duplicate = (nl?.kind === 'nav' && modules.some((x) => x.sym === nl.module)) || (nl?.kind === 'bond' && bonds.length)
  const actions = duplicate ? [] : buildActionSuggestions(raw, nl)
  const ask = nl?.kind === 'ai' ? [] : [{
    sym: `ai:${raw}`, label: `Ask MaddenAI about "${raw.length > 40 ? raw.slice(0, 40) + '…' : raw}"`,
    type: 'ai', category: 'MADDENAI', desc: 'Route this query to MaddenAI', action: 'ai', payload: raw,
  }]
  // A parsed command leads: it is what Enter will do.
  return flattenGroups(nl ? [...actions, ...matched, ...ask] : [...matched, ...actions, ...ask])
}

// ─── Help card — "?" or "help" typed into the bar ─────────────────────────────

const QUICK_HELP = [
  { tag: 'SEARCH',    text: 'any ticker, company, sector or module', eg: 'westpac' },
  { tag: 'ACTIONS',   text: '"add BHP" · "alert BHP above 48"',      eg: 'alert BHP above 48' },
  { tag: 'NAVIGATE',  text: '"go to bonds" · "open calc" · "au 10y"', eg: 'go to bonds' },
  { tag: 'ANALYSE',   text: '"analyse CSL" · "compare BHP RIO"',     eg: 'analyse CSL' },
  { tag: 'CALCULATE', text: '"compound 10000 8% 20 years"',          eg: 'compound 10000 8% 20 years' },
]

function HelpCard({ onPick, onFull }) {
  return (
    <div className="absolute bottom-full left-0 right-0 border-t border-terminal-gold/30 bg-terminal-panel border border-terminal-border shadow-2xl z-[70]">
      <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold/70 font-bold tracking-widest">
        COMMAND BAR HELP
      </div>
      {QUICK_HELP.map((h) => (
        <div
          key={h.tag}
          className="flex items-center gap-3 px-3 py-1.5 cursor-pointer text-2xs hover:bg-terminal-accent/20 border-l-2 border-transparent"
          onMouseDown={(e) => { e.preventDefault(); onPick(h.eg) }}
        >
          <span className="font-mono font-bold text-terminal-gold w-24 flex-shrink-0">[{h.tag}]</span>
          <span className="text-terminal-text-dim flex-1 truncate">{h.text}</span>
          <span className="text-terminal-text-dim/40 flex-shrink-0">try →</span>
        </div>
      ))}
      <div className="px-3 py-1 border-t border-terminal-border/40 flex items-center bg-terminal-panel gap-3">
        <KeyHints context="help" />
        <button
          className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold"
          onMouseDown={(e) => { e.preventDefault(); onFull() }}
        >FULL REFERENCE ↵</button>
      </div>
    </div>
  )
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
          Click any row to open full asset profile · {USING_MOCK_DATA ? '● DEMO DATA — prices simulated' : 'Source: Stooq / CoinGecko'}
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
          {USING_MOCK_DATA ? '● DEMO DATA — prices simulated' : 'Source: Stooq / CoinGecko'} · Prices in AUD
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
// "execute what I typed" without one, and TAB moves between groups only when
// there are groups to move between. A row that says the same thing in both
// states teaches the wrong model of the bar.
function KeyHints({ context = 'idle', className = '' }) {
  const HINTS = {
    suggestions: [['↑↓', 'navigate'], ['Tab', 'next group'], ['↵', 'select'], ['Esc', 'close']],
    recent:      [['↑↓', 'navigate'], ['Tab', 'next group'], ['↵', 'run'], ['Esc', 'close']],
    help:        [['click', 'try it'], ['↵', 'full reference'], ['Esc', 'close']],
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

// ─── Grouping ─────────────────────────────────────────────────────────────────
//
// Keyboard nav (suggestIdx) indexes the flat array, and the dropdown renders
// it grouped. Those only agree if every group is contiguous in the flat array,
// so getSuggestions passes its list through flattenGroups: groups keep the
// order they first appear in, items keep their order within a group.

function groupByCategory(items) {
  const groups = new Map()
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, [])
    groups.get(item.category).push(item)
  }
  return [...groups].map(([category, list]) => ({ category, items: list }))
}

function flattenGroups(items) {
  return groupByCategory(items).flatMap((g) => g.items)
}

// Index of the first item of the next (dir 1) or previous (dir -1) group.
function nextGroupStart(items, idx, dir) {
  const starts = []
  items.forEach((it, i) => { if (i === 0 || items[i - 1].category !== it.category) starts.push(i) })
  if (!starts.length) return -1
  const cur = starts.filter((s) => s <= idx).length - 1
  const next = idx < 0 ? (dir > 0 ? 0 : starts.length - 1) : (cur + dir + starts.length) % starts.length
  return starts[next]
}

const TYPE_ICON = {
  asx: '📈', us: '📈', index: '📈', crypto: '₿', fx: '💱', bond: '🏛',
  module: '▶', action: '⚡', cmd: '⚡', ai: '🤖', calc: '🔢',
}

const CATEGORY_LABEL = { MADDENAI: 'MADDENAI', CALC: 'CALCULATORS' }

// ─── Suggestions dropdown (memoised to avoid re-renders on every keystroke) ──
// `quotes` maps symbol -> { price, pct } for live STOCKS/CRYPTO rows — absent
// entries just show no price yet.

const SuggestionsList = memo(function SuggestionsList({ suggestions, suggestIdx, onSelect, quotes }) {
  const activeRef = useRef(null)
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }) }, [suggestIdx])
  if (!suggestions.length) return null
  const grouped = groupByCategory(suggestions)
  return (
    <div className="absolute bottom-full left-0 right-0 border-t border-terminal-gold/30 bg-terminal-panel border border-terminal-border shadow-2xl z-[70] max-h-96 overflow-auto">
      {grouped.map(({ category, items }) => (
        <div key={category}>
          <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold/70 font-bold tracking-widest sticky top-0">
            {CATEGORY_LABEL[category] ?? category}
          </div>
          {items.map((s) => {
            const i = suggestions.indexOf(s)
            const q = quotes?.[s.sym] ?? quotes?.[s.label]
            return (
              <div
                key={s.sym}
                role="option"
                aria-selected={i === suggestIdx}
                ref={i === suggestIdx ? activeRef : null}
                className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer text-2xs transition-colors ${
                  i === suggestIdx
                    ? 'bg-terminal-blue-bright/20 border-l-2 border-terminal-blue-bright'
                    : 'hover:bg-terminal-accent/20 border-l-2 border-transparent'
                }`}
                onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
              >
                <span className="w-4 flex-shrink-0 text-center" aria-hidden="true">{TYPE_ICON[s.type] ?? '·'}</span>
                <span className={`font-bold font-mono flex-shrink-0 truncate ${s.category === 'ACTIONS' || s.category === 'MADDENAI' ? 'max-w-[60%]' : 'w-28'} ${
                  s.type === 'cmd'    ? 'text-terminal-gold' :
                  s.type === 'action' ? 'text-terminal-blue-bright' :
                  s.type === 'ai'     ? 'text-terminal-blue-bright' :
                  s.type === 'module' ? 'text-terminal-gold' :
                  s.type === 'calc'   ? 'text-terminal-gold' :
                  s.type === 'bond'   ? 'text-terminal-gold' :
                  s.type === 'asx'    ? 'text-terminal-text-bright' :
                  s.type === 'crypto' ? 'text-terminal-green' :
                  s.type === 'index'  ? 'text-terminal-blue-bright' :
                  s.type === 'fx'     ? 'text-[#4a9dd9]' :
                  'text-terminal-text'
                }`}>{s.label}</span>
                <span className="text-terminal-text-dim flex-1 truncate">{s.desc}</span>
                {q && (
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {q.demo && <span className="text-terminal-gold/70 font-bold" style={{ fontSize: 8 }}>DEMO</span>}
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

// ─── Empty bar — recent commands and time-of-day suggestions ─────────────────

const IdleList = memo(function IdleList({ items, activeIdx, onSelect }) {
  if (!items.length) return null
  const grouped = groupByCategory(items)
  return (
    <div className="absolute bottom-full left-0 right-0 border-t border-terminal-gold/30 bg-terminal-panel border border-terminal-border shadow-2xl z-[70]">
      {grouped.map(({ category, items: rows }) => (
        <div key={category}>
          <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold/70 font-bold tracking-widest">
            {category}
          </div>
          {rows.map((r) => {
            const i = items.indexOf(r)
            return (
              <div
                key={r.sym}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-2xs transition-colors ${
                  i === activeIdx
                    ? 'bg-terminal-blue-bright/20 border-l-2 border-terminal-blue-bright'
                    : 'hover:bg-terminal-accent/20 border-l-2 border-transparent'
                }`}
                onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
              >
                <span className="w-4 text-center text-terminal-text-dim/60" aria-hidden="true">{r.icon ?? '↺'}</span>
                <span className={r.type === 'recent' ? 'text-terminal-text-bright font-mono' : 'text-terminal-text'}>{r.label}</span>
              </div>
            )
          })}
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
    openModal,
    setNewsFilter,
    alerts, addAlert,
    watchlist,
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
  const [watchMover,  setWatchMover]  = useState(null)

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

  // ── Biggest watchlist move, for the market-hours suggestion ─────────────────
  // Fetched when the empty bar opens during ASX hours, and only the name is
  // shown: the suggestion points at the stock, it does not quote it. ASX names
  // only — at 1pm in Sydney a US stock's "today" is last night's session.
  useEffect(() => {
    if (!showRecent) return
    const { hour, weekend } = sydneyClock()
    if (weekend || hour < 10 || hour >= 16) return
    const syms = watchlist.filter((s) => /\.AX$/.test(s)).slice(0, 12)
    if (!syms.length) return
    let cancelled = false
    fetchYahooBatch(syms)
      .then((q) => {
        const top = Object.entries(q)
          .filter(([, v]) => v?.pct != null)
          .sort((a, b) => Math.abs(b[1].pct) - Math.abs(a[1].pct))[0]
        if (!cancelled && top) setWatchMover(top[0].replace(/\.AX$/, ''))
      })
      .catch(() => { /* the suggestion falls back to the watchlist module */ })
    return () => { cancelled = true }
  }, [showRecent, watchlist])

  // ── Live price/change% for STOCKS + CRYPTO suggestion rows ──────────────────
  // Only fires once there are actual matches to price, and only after 2+
  // characters — keeps this from firing a full CoinGecko/batch fetch on
  // every single keystroke.
  useEffect(() => {
    const stockSyms  = suggestions.filter((s) => s.category === 'STOCKS').map((s) => s.sym).slice(0, 4)
    const cryptoSyms = suggestions.filter((s) => s.category === 'CRYPTO').map((s) => s.label).slice(0, 4)
    if (debouncedValue.trim().length < 2 || (!stockSyms.length && !cryptoSyms.length)) {
      // Clears stale quotes before starting a new suggestion fetch, so the previous
      // query's prices cannot sit under the current query's names. The fetch below
      // is the external system; this is its reset.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
            next[sym] = { price: v.currency === 'USD' ? v.last / audUsd : v.last, pct: v.pct, demo: USING_MOCK_DATA }
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

  // Derived during render, not in an effect — the same pattern AnimatedNumber
  // uses in this codebase, and React's documented shape for "adjust state when
  // an input changes".
  //
  // A useMemo would be wrong here: `suggestions` is not purely a function of
  // the query. Escape clears it, selecting an item clears it, blur clears it —
  // seven call sites write to it. So it has to stay state, and this is how you
  // reset state on an input change without paying a committed render first.
  //
  // As an effect it produced a visible artifact, not just a lint error: the
  // list rendered once with the PREVIOUS query's suggestions before the effect
  // replaced them, so a fast typist saw the prior match flash under the cursor.
  const [prevQuery, setPrevQuery] = useState(debouncedValue)
  if (prevQuery !== debouncedValue) {
    setPrevQuery(debouncedValue)
    setSuggestIdx(-1)
    setSuggestions(debouncedValue.trim() ? getSuggestions(debouncedValue) : [])
  }

  // Recent commands and time-of-day suggestions, as one navigable list with
  // the same shape as suggestion items, so keyboard nav is shared.
  const idleItems = [
    ...recentSearches.map((r) => ({ sym: `recent:${r}`, label: r, type: 'recent', category: 'RECENT', command: r })),
    ...timeSuggestions({ mover: watchMover, alertCount: alerts.length }).map((t) => ({
      ...t, sym: `sugg:${t.label}`, type: 'suggested', category: 'SUGGESTED FOR YOU',
    })),
  ]
  const helpMode   = isHelpQuery(inputValue)
  const activeList = suggestions.length ? suggestions : (showRecent && !inputValue.trim() ? idleItems : [])

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
    // Tab jumps to the first result of the next group; Shift+Tab the previous.
    if (e.key === 'Tab' && activeList.length > 0) {
      e.preventDefault()
      setSuggestIdx(nextGroupStart(activeList, suggestIdx, e.shiftKey ? -1 : 1))
      return
    }
    if (e.key === 'Escape') {
      setSuggestions([]); setSuggestIdx(-1); setShowRecent(false)
      if (helpMode) setInputValue('')
      return
    }
    if (e.key === 'Enter') {
      if (suggestIdx >= 0 && activeList[suggestIdx]) {
        selectSuggestion(activeList[suggestIdx])
        return
      }
      // A sector is a list, not a command: Enter moves into it. Without this
      // "healthcare" resolved to Sonic Healthcare by name and opened that.
      if (suggestions.length && parseSectorQuery(inputValue)) {
        setSuggestIdx(0)
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
  // Routes through AIPanel rather than calling askClaude directly.
  //
  // THE BUG THIS FIXES. This function used to call askClaude([userMsg]) itself,
  // which skipped everything AIPanel's send() does: the [CONTEXT] block, the
  // [VERIFIED FACTS] block, the system prompt with the user's experience level,
  // the query-intent shaping, the conversation history and the Core message
  // quota. The command bar advertises itself as "Ticker · Command · Question",
  // so this is a primary way in — and asking "what is the current RBA cash
  // rate" here got an answer recalled from training data (4.10%, from a
  // February 2025 meeting) while the same question in the panel got the
  // verified 4.35%. The model even said so: "I don't have a [VERIFIED FACTS]
  // block in this session."
  //
  // One event, one code path, one answer.
  const routeToAI = (raw) => {
    flash(`ROUTING TO AI — "${raw.trim().substring(0, 40)}${raw.length > 40 ? '…' : ''}"`, 'text-terminal-gold', 2000)
    window.dispatchEvent(new CustomEvent('madden:ask-ai', {
      detail: { prompt: raw.trim(), visible: true },
    }))
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
    const knownEntry = resolveAsset(sym)
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
          price:  q.currency === 'USD' ? q.last / audUsd : q.last,
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

  // ── Shared actions — one implementation per thing the bar can do ────────────

  // Returns true when the symbol is on the watchlist afterwards. Crypto is
  // stored in its -USD form (BTC-USD), as the watchlist's defaults are.
  const addWatch = (raw) => {
    const sym = detectAssetType(raw) === 'crypto' && !/-USD$/.test(raw) ? `${raw}-USD` : raw
    if (watchlist.includes(sym)) {
      flash(`${sym} IS ALREADY ON YOUR WATCHLIST`, 'text-terminal-text-dim', 2500)
      return true
    }
    if (!addToWatchlist(sym)) return false   // plan limit — prompt shown
    flash(`ADDED ${sym} TO WATCHLIST ✓`, 'text-terminal-green', 2500)
    return true
  }

  // A target with no direction ("set alert BHP 48") takes the side of the
  // price it sits on. And a target already behind the price ("above 48" on a
  // stock at 61) fires on the next check — the bar says so now rather than
  // leaving the user to wonder why an alert went off the moment it was set.
  const createAlert = async (sym, price, direction) => {
    let last = null
    try { last = (await fetchYFQuote(toYahooSymbol(sym, detectAssetType(sym))))?.last ?? null } catch { /* no quote — direction defaults below */ }
    const dir = direction ?? (last != null && price < last ? 'below' : 'above')
    if (!addAlert(sym, price, dir)) return   // plan limit — prompt shown
    const crossed = last != null && (dir === 'above' ? last >= price : last <= price)
    flash(
      `ALERT SET: ${sym} ${dir.toUpperCase()} A$${price.toFixed(2)} ✓${crossed ? ` · ALREADY ${dir.toUpperCase()} — FIRES ON NEXT CHECK` : ''}`,
      crossed ? 'text-terminal-gold' : 'text-terminal-green',
      crossed ? 6000 : 3000,
    )
  }

  const runCompare = async (a, b) => {
    flash('LOADING COMPARISON...', 'text-terminal-gold', 0)
    try {
      const [q1, q2] = await Promise.all([
        fetchYFQuote(toYahooSymbol(a, detectAssetType(a))),
        fetchYFQuote(toYahooSymbol(b, detectAssetType(b))),
      ])
      setCompareAssets([
        buildModalAsset(q1, detectAssetType(a), displaySymbol(a)),
        buildModalAsset(q2, detectAssetType(b), displaySymbol(b)),
      ])
      flash('READY')
    } catch {
      flash('COMPARE FAILED — CHECK SYMBOLS', 'text-terminal-red', 3000)
    }
  }

  const openBond = (market, maturity) => {
    sendModuleIntent('bonds', { market, maturity })
    setActiveModule('bonds')
    flash(`→ BONDS · ${market} ${maturity}`, 'text-terminal-green', 2000)
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

    // ── DES / PROFILE {ticker}: the company profile ──
    if (['des', 'profile'].includes(parts[0].toLowerCase()) && parts[1]) {
      // Loaded on use: the node list is not part of the first paint.
      const [{ graphNodeForTicker }, { openCompanyProfile, isCompanyNodeId }] = await Promise.all([import('../../data/graph/nodes'), import('../../utils/openRelationships')])
      const id = graphNodeForTicker(parts[1])
      if (isCompanyNodeId(id)) {
        openCompanyProfile(setActiveModule, id)
        flash(`→ COMPANY PROFILE · ${id}`, 'text-terminal-green', 1500)
      } else {
        flash(`No company profile for ${parts[1].toUpperCase()} yet — profiles cover the companies in the Relationships graph`, 'text-terminal-gold', 3500)
      }
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
      // `news` is one of NEWS's own aliases. It used to be an extra `|| cmd ===
      // 'news'` here, which is true on the loop's first pass — MARKETS — so
      // typing "news" opened Markets.
      if (aliases.includes(cmd)) {
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
      if (addWatch(resolveSymbol(parts[2]))) setActiveModule('watchlist')
      return
    }

    // ── PORT ADD {symbol} — placeholder (portfolio module doesn't support programmatic adds yet) ──
    if (parts[0].toLowerCase() === 'port' && parts[1]?.toLowerCase() === 'add' && parts[2]) {
      flash('PORT ADD: Open Portfolio module to add positions', 'text-terminal-text-dim', 3000)
      setActiveModule('portfolio')
      return
    }

    // ── COMPARE {sym1} {sym2} ── (see isTerseCompare for the joining-word guard)
    if (isTerseCompare(parts) && !/^(and|vs|vs\.|versus|with|to)$/i.test(parts[2])) {
      await runCompare(resolveSymbol(parts[1]), resolveSymbol(parts[2]))
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

    // ── ALERT {sym} {price} ── (direction taken from where the price is)
    if (isTerseAlert(parts)) {
      await createAlert(resolveSymbol(parts[1]), parseFloat(parts[2].replace('$', '')), null)
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
          addWatch(nl.symbol)
          return

        case 'alert':
          await createAlert(nl.symbol, nl.price, nl.direction)
          return

        case 'calc':
          // A fresh id per command, so the calculator remounts with these
          // values even when it is already showing a previous fill.
          sendModuleIntent('calculators', { tab: nl.tab, compound: { ...nl.compound, id: Date.now() } })
          setActiveModule('calculators')
          flash(`CALC · ${nl.say.replace(/^Compound /, '')}`, 'text-terminal-green', 5000)
          return

        case 'bond':
          openBond(nl.market, nl.maturity)
          return

        case 'nav':
          setActiveModule(nl.module)
          if (nl.module === 'news') setNewsFilter('')
          flash(`→ ${nl.module.toUpperCase()}`, 'text-terminal-green', 1500)
          return

        case 'deeplink':
          sendModuleIntent(nl.module, nl.intent)
          setActiveModule(nl.module)
          flash(`→ ${nl.say.replace(/^Open /, '')}`, 'text-terminal-green', 2000)
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

        case 'ai':
          await routeToAI(nl.query)
          return

        case 'rbapreview':
          rbaPreview(VERIFIED_CONSTANTS.rba.nextMeeting)
          flash('→ MADDENAI RBA DECISION PREVIEW', 'text-terminal-green', 2000)
          return

        case 'deepdive':
          deepDive({ symbol: nl.sym, name: nl.name })
          flash(`→ MADDENAI DEEP DIVE · ${nl.sym.replace(/\.AX$/i, '')}`, 'text-terminal-green', 2000)
          return

        case 'compare':
          await runCompare(nl.a, nl.b)
          return

        default:
          break
      }
    }

    // ── A company or ticker the catalogue can name — "rio tinto", "commonweatlh" ──
    const named = resolveAsset(trimmed)
    if (named) {
      await lookupTicker(named.sym)
      return
    }

    // ── Ticker lookup (no spaces = likely a symbol) ──
    if (!trimmed.includes(' ')) {
      await lookupTicker(trimmed)
      return
    }

    // ── Unknown → AI ──
    await routeToAI(trimmed)
  }, [addAlert, addToWatchlist, watchlist, audUsd, pushHistory, setActiveModule, setNewsFilter, openModal, setChatOpen, addChatMessage, updateLastChatMessage])

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
      case 'ai':
      case 'calc':
      case 'bond':
        setInputValue('')
        // A parsed natural-language command routes straight back through
        // execute(), so clicking the suggestion and pressing Enter on the same
        // text do exactly the same thing.
        if (item.action === 'command') { execute(item.payload); return }
        if (item.action === 'ai') { routeToAI(item.payload); return }
        if (item.type === 'calc') {
          sendModuleIntent('calculators', { tab: item.tab })
          setActiveModule('calculators')
          flash(`→ CALC · ${item.label}`, 'text-terminal-green', 1500)
          return
        }
        if (item.type === 'bond') { openBond(item.market, item.maturity); return }
        if (item.action === 'watchlist') {
          if (addWatch(item.payload)) setActiveModule('watchlist')
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
      case 'suggested':
        setInputValue('')
        if (item.action === 'alerts') { window.dispatchEvent(new CustomEvent('maddex:manage-alerts')); return }
        execute(item.command)
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
        {!suggestions.length && showRecent && !inputValue.trim() && (
          <IdleList items={idleItems} activeIdx={suggestIdx} onSelect={selectSuggestion} />
        )}
        {helpMode && (
          <HelpCard
            onPick={(eg) => { setInputValue(eg); inputRef.current?.focus() }}
            onFull={() => { setInputValue(''); setHelpOpen(true) }}
          />
        )}

        {/* Command bar */}
        <div data-tour="cmd-bar" className="flex items-center bg-terminal-bg border-t border-terminal-border px-3 py-1.5 gap-3">
          <Tooltip content={`Command bar\n${shortcutService.shortcuts['ui.command']?.display ?? '/'} to focus from anywhere`}>
            <span className="text-terminal-gold text-2xs font-bold tracking-widest flex-shrink-0 cursor-blink">CMD&gt;</span>
          </Tooltip>

          <input
            ref={inputRef}
            data-command-bar
            className="cmd-input input-terminal flex-1 text-xs"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim()) setSuggestions(getSuggestions(inputValue))
              else setShowRecent(true)
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
