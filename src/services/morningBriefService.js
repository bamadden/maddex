import { askClaudeJSON } from './api'
import { liveDataService } from './liveDataService'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'
import { getEconomicCalendar, upcomingEvents } from './calendarService'
import { sydneyTzAbbr } from '../utils/dateUtils'

// Stable instruction template — identical on every call, so it sits in the
// cached system prefix. Everything that changes day to day goes in the user
// message instead.
//
// The tone instructions are doing real work here. The previous prompt asked
// for "2-3 sentences" per section and got exactly what that asks for:
// competent filler. Naming the failure mode explicitly — no throat-clearing,
// every sentence carries a fact or a judgement — produces noticeably
// different output from the same model.
const BRIEF_SYSTEM = `You are a senior financial analyst writing the morning brief for sophisticated Australian investors who manage their own portfolios.

STYLE, which matters as much as the content:
- Direct and specific. No throat-clearing, no "it is important to note", no restating the question.
- Every sentence carries a fact, a figure you were given, or a judgement. If a sentence could appear in any brief on any day, delete it.
- Take a position. "Watch the banks" is useless; "the banks have been sensitive to rate expectations and the RBA minutes land midweek" is not.
- Australian context throughout: ASX sectors, AUD, and what offshore moves mean for a Sydney open.

FIGURES, which you must not invent:
- You may quote any figure supplied in the user message.
- You may NOT state an index level, a stock price, a percentage move, or an economic print that was not supplied to you.
- Where a number would be natural and none was given, describe direction and condition in words: "softer", "near the top of its recent range", "holding above".
- This is not a stylistic preference. A confident wrong number is worse than no number.

Generate a JSON object:
{
  "headline": "One sentence naming the single most important thing about today",
  "maddenAIScore": number 0-100 (overall market bullishness),
  "scoreLabel": "STRONGLY BULLISH" | "BULLISH" | "CAUTIOUSLY BULLISH" | "NEUTRAL" | "CAUTIOUSLY BEARISH" | "BEARISH" | "STRONGLY BEARISH",
  "scoreRationale": "One sentence justifying that score specifically",
  "sections": [
    { "title": "OVERNIGHT SUMMARY", "content": "3-4 sentences: what happened globally while Australia slept, and which parts matter here" },
    { "title": "ASX OUTLOOK", "content": "3-4 sentences: how overnight action feeds into today's open, which sectors to watch and why" },
    { "title": "KEY THEMES", "content": "The three most important macro themes right now, each as 'Theme name — one sentence'. Separate with a newline." },
    { "title": "YOUR WATCHLIST", "content": "2-3 sentences on the investor's specific watchlist names. If the watchlist is empty, say what a starting watchlist for these conditions would emphasise instead." },
    { "title": "WHAT TO WATCH", "content": "Three specific things to monitor today, with times where applicable. Separate with a newline." }
  ],
  "keyEvents": [
    {"time": "10:30 AM", "event": "AU CPI Monthly", "impact": "HIGH"}
  ]
}

General information only, not financial advice. Return ONLY valid JSON.`

// The Australian market day, not UTC and not the browser's day.
//
// toISOString() keys the cache to the UTC day, which in Australia rolls over
// mid-morning — the brief would regenerate partway through the trading day and
// a reader who opened it at 9am and again at noon would get two different
// briefs for the same morning.
//
// Pinned to Australia/Brisbane rather than plain local time for the same
// reason aiContentService is: a morning brief is a market-day artefact, and
// opening the terminal from London should still give Sydney's Tuesday brief
// rather than starting a new day mid-Australian-afternoon. Queensland has no
// daylight saving, so the boundary is a stable UTC+10 all year.
const AU_MARKET_TZ = 'Australia/Brisbane'
export const briefDayKey = (d = new Date()) =>
  d.toLocaleDateString('en-CA', { timeZone: AU_MARKET_TZ })

const BRIEF_CACHE_KEY = (day = briefDayKey()) => `maddex_morning_brief_${day}`
const PORTFOLIO_KEY = 'madden_portfolio_v2'
const BRIEF_HISTORY_KEEP = 5

// Weekday in Australian time, not the browser's. getDay() on a plain Date is
// the reader's local weekday: at 8am Monday in Sydney it is still Sunday in
// London, and a London-based holder would have been shown the weekend state
// on a trading day.
export function auWeekday(d = new Date()) {
  return d.toLocaleDateString('en-AU', { timeZone: AU_MARKET_TZ, weekday: 'short' })
}

export const isAuWeekend = (d = new Date()) => ['Sat', 'Sun'].includes(auWeekday(d))

// Hour of day in Australian time, for the auto-generation window.
export function auHour(d = new Date()) {
  return Number(d.toLocaleString('en-AU', { timeZone: AU_MARKET_TZ, hour: 'numeric', hour12: false }))
}

export function getWeekendMessage() {
  return {
    headline: 'Markets are closed for the weekend — see you Monday.',
    maddenAIScore: 50,
    scoreLabel: 'NEUTRAL',
    sections: [
      { title: 'WEEKEND', content: 'No new brief is generated on weekends. Check back Monday from 7am AEST for a fresh, personalised market brief.' },
    ],
    keyEvents: [],
    isWeekend: true,
  }
}

function readPortfolioHoldings() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) ?? '[]') } catch { return [] }
}

// Gathers the figures the brief is allowed to quote.
//
// Settled individually rather than with Promise.all: one slow feed should
// cost that line of context, not the whole brief. Anything that fails is
// simply absent from the prompt, and the model has been told to describe
// direction in words when it has no number.
async function gatherContext() {
  const [fx, gold, fg, crypto] = await Promise.allSettled([
    liveDataService.getFXRates(),
    liveDataService.getGoldPrice(),
    liveDataService.getFearGreed(),
    liveDataService.getCryptoPrices(),
  ])
  const ok = (r) => (r.status === 'fulfilled' ? r.value?.data : null)
  return { fx: ok(fx), gold: ok(gold), fg: ok(fg), crypto: ok(crypto) }
}

// ── Brief history ──────────────────────────────────────────────────────────
//
// The last few briefs, newest first. Worth keeping because the value of a
// daily brief compounds: reading Monday's beside Thursday's shows how the
// narrative moved, which no single day can.
//
// Read straight from the cache keys rather than a separate index, so there is
// one source of truth and no way for an index to disagree with what is
// actually stored.
export function listBriefHistory(limit = BRIEF_HISTORY_KEEP) {
  const out = []
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('maddex_morning_brief_')) continue
      const day = key.replace('maddex_morning_brief_', '')
      // Only date-shaped keys. The News module writes its own brief under a
      // differently formatted key with the same prefix, and including those
      // would put "6 Sept 2026" in a list sorted as ISO dates.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      try {
        const brief = JSON.parse(localStorage.getItem(key))
        if (brief) out.push({ day, brief })
      } catch { /* skip corrupt entry */ }
    }
  } catch { /* storage unavailable */ }
  return out.sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, limit)
}

// Trims to the newest N so the cache cannot grow without bound.
function trimBriefHistory() {
  try {
    const dated = Object.keys(localStorage)
      .filter((k) => /^maddex_morning_brief_\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .reverse()
    dated.slice(BRIEF_HISTORY_KEEP).forEach((k) => localStorage.removeItem(k))
  } catch { /* best-effort */ }
}

export function clearBriefCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('maddex_morning_brief_'))
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* best effort */ }
}

// Identifies the set of verified figures a brief was written from.
function factsStamp() {
  const { rba, fed, au, bonds } = VERIFIED_CONSTANTS
  return [rba.cashRate, rba.lastDecision, fed.rateRange, au.cpi, au.cpiPeriod, au.unemployment, au.unemploymentPeriod, bonds?.asOf].join('|')
}

// watchlist: array of ticker strings (useStore's shape). portfolio: optional
// override — defaults to reading the same localStorage key PortfolioModule
// persists to, since holdings are not in the shared store.
export async function generateMorningBrief(watchlist = [], portfolio = null, { force = false } = {}) {
  const cacheKey = BRIEF_CACHE_KEY()
  if (!force) {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      // A brief written before the verified figures changed (an RBA decision
      // mid-day, a CPI print) describes a world that no longer exists, so it
      // is regenerated rather than served for the rest of the day.
      try {
        const parsed = JSON.parse(cached)
        if (parsed?.factsStamp === factsStamp()) return parsed
      } catch { /* fall through and regenerate */ }
    }
  }

  if (isAuWeekend()) return getWeekendMessage()

  const holdings = portfolio ?? readPortfolioHoldings()
  const watchlistSymbols = watchlist.join(', ')
  const portfolioSummary = holdings.map((p) => `${p.symbol}: ${p.shares} units @ A$${p.avgCost}`).join(', ')

  const { fx, gold, fg, crypto } = await gatherContext()
  const { rba, fed, au, bonds } = VERIFIED_CONSTANTS

  // The next fortnight of scheduled events, so the brief names what is
  // actually coming rather than recalling a calendar from training data.
  let upcoming = ''
  try {
    const { events } = await getEconomicCalendar()
    upcoming = upcomingEvents(events, 14)
      .filter((e) => e.importance === 'high' || e.importance === 'medium')
      .slice(0, 8)
      .map((e) => `- ${e.date}${e.time && e.time !== '—' ? ` ${e.time}` : ''}: ${e.event} (${e.region})`)
      .join('\n')
  } catch { /* calendar is optional context */ }
  const spreadBp = bonds ? Math.round((bonds.au10y - bonds.us10y) * 100) : null

  // Only lines with a value are included — an "AUD/USD: unavailable" line
  // invites the model to comment on the fact that it is unavailable.
  const live = [
    fx?.AUDUSD != null && `- AUD/USD: ${fx.AUDUSD.toFixed(4)}`,
    fx?.AUDJPY != null && `- AUD/JPY: ${fx.AUDJPY.toFixed(2)}`,
    crypto?.bitcoin?.aud != null && `- Bitcoin: A$${Math.round(crypto.bitcoin.aud).toLocaleString()} (${(crypto.bitcoin.aud_24h_change ?? 0).toFixed(1)}% 24h)`,
    gold?.USD != null && `- Gold: US$${gold.USD.toLocaleString()}/oz`,
    fg?.value != null && `- Crypto Fear & Greed: ${fg.value} (${fg.classification})`,
  ].filter(Boolean).join('\n')

  const userContent = `
Today: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: 7:00 AM ${sydneyTzAbbr(new Date().toLocaleDateString('en-CA'))}

VERIFIED FIGURES — you may quote these, and no others:
- RBA cash rate: ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb}${rba.lastChange ? ` ${rba.lastChange}` : ''} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}
- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})
- AU CPI: ${au.cpi.toFixed(1)}% YoY (${au.cpiPeriod}), trimmed mean ${au.cpiTrimmedMean}%; RBA target band ${au.rbaTargetBand}
- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})
${bonds ? `- Bond yields: AU 10Y ${bonds.au10y.toFixed(2)}% (${bonds.au10yAsOf}), US 10Y ${bonds.us10y.toFixed(2)}% (${bonds.us10yAsOf}); spread ${spreadBp >= 0 ? '+' : ''}${spreadBp}bp (${spreadBp >= 0 ? 'AU premium' : 'US premium'})` : ''}
${upcoming ? `\nSCHEDULED EVENTS — next 14 days (dates are fixed; use these, not any you recall):\n${upcoming}` : ''}
${live ? `\nLIVE AS OF NOW:\n${live}` : ''}

Investor's watchlist: ${watchlistSymbols || 'Not set'}
Portfolio holdings: ${portfolioSummary || 'Not set'}

Generate the morning brief now. Do not state any figure not listed above.
  `.trim()

  const brief = await askClaudeJSON(userContent, { maxTokens: 2200, systemPrompt: BRIEF_SYSTEM })
  const stamped = { ...brief, generatedAt: new Date().toISOString(), factsStamp: factsStamp() }
  try { localStorage.setItem(cacheKey, JSON.stringify(stamped)) } catch { /* best-effort cache write */ }
  trimBriefHistory()
  return stamped
}

// ── Auto-generation ────────────────────────────────────────────────────────
//
// Called once at app start. Generates today's brief in the background if it
// is a weekday morning in Australia and one has not been made yet.
//
// THREE GUARDS, each for a reason:
//   - Cached already: never regenerate a brief the reader may have read. A
//     brief that changes under someone mid-morning is worse than a stale one.
//   - Weekend: nothing to brief on, and getWeekendMessage covers the display.
//   - Outside 6am-10am AEST: this is a morning ritual. Someone opening the
//     terminal at 9pm wants yesterday's brief on screen, not a fresh one
//     generated against a closed market — and it would silently spend an API
//     call for every late-evening visit.
//
// Returns the brief when it generated one, null otherwise, so a caller can
// decide whether to announce it.
export async function autoGenerateBrief(watchlist = []) {
  try {
    if (localStorage.getItem(BRIEF_CACHE_KEY())) return null
  } catch { /* storage unavailable — fall through and try */ }

  if (isAuWeekend()) return null

  const hour = auHour()
  if (!(hour >= 6 && hour < 10)) return null

  return generateMorningBrief(watchlist)
}
