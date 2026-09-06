import { askClaudeJSON } from './api'
import { liveDataService } from './liveDataService'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

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

// Local date, not UTC. toISOString() keys the cache to the UTC day, which in
// Australia rolls over mid-morning — so the brief would regenerate partway
// through the trading day and a reader who opened it at 9am and again at noon
// would get two different briefs for the same morning. en-CA formats as
// YYYY-MM-DD. Same fix as aiContentService.
const BRIEF_CACHE_KEY = () => `maddex_morning_brief_${new Date().toLocaleDateString('en-CA')}`
const PORTFOLIO_KEY = 'madden_portfolio_v2'

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

export function clearBriefCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('maddex_morning_brief_'))
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* best effort */ }
}

// watchlist: array of ticker strings (useStore's shape). portfolio: optional
// override — defaults to reading the same localStorage key PortfolioModule
// persists to, since holdings are not in the shared store.
export async function generateMorningBrief(watchlist = [], portfolio = null, { force = false } = {}) {
  const cacheKey = BRIEF_CACHE_KEY()
  if (!force) {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try { return JSON.parse(cached) } catch { /* fall through and regenerate */ }
    }
  }

  const day = new Date().getDay()
  if (day === 0 || day === 6) return getWeekendMessage()

  const holdings = portfolio ?? readPortfolioHoldings()
  const watchlistSymbols = watchlist.join(', ')
  const portfolioSummary = holdings.map((p) => `${p.symbol}: ${p.shares} units @ A$${p.avgCost}`).join(', ')

  const { fx, gold, fg, crypto } = await gatherContext()
  const { rba, fed, au } = VERIFIED_CONSTANTS

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
Time: 7:00 AM AEST

VERIFIED FIGURES — you may quote these, and no others:
- RBA cash rate: ${rba.cashRate}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}
- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})
- AU CPI: ${au.cpi}% for the ${au.cpiPeriod}; RBA target band ${au.rbaTargetBand}
- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})
${live ? `\nLIVE AS OF NOW:\n${live}` : ''}

Investor's watchlist: ${watchlistSymbols || 'Not set'}
Portfolio holdings: ${portfolioSummary || 'Not set'}

Generate the morning brief now. Do not state any figure not listed above.
  `.trim()

  const brief = await askClaudeJSON(userContent, { maxTokens: 2200, systemPrompt: BRIEF_SYSTEM })
  const stamped = { ...brief, generatedAt: new Date().toISOString() }
  try { localStorage.setItem(cacheKey, JSON.stringify(stamped)) } catch { /* best-effort cache write */ }
  return stamped
}
