import { askClaudeJSON } from './api'

const BRIEF_CACHE_KEY = () => `maddex_morning_brief_${new Date().toISOString().split('T')[0]}`
const PORTFOLIO_KEY = 'madden_portfolio_v2'

export function getWeekendMessage() {
  return {
    headline: "Markets are closed for the weekend — see you Monday.",
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

// watchlist: array of ticker strings (useStore's shape). portfolio: optional
// override — defaults to reading the same localStorage key PortfolioModule
// itself persists to, since portfolio holdings aren't in the shared store.
export async function generateMorningBrief(watchlist = [], portfolio = null) {
  const cacheKey = BRIEF_CACHE_KEY()
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* fall through and regenerate */ }
  }

  const day = new Date().getDay()
  if (day === 0 || day === 6) return getWeekendMessage()

  const holdings = portfolio ?? readPortfolioHoldings()
  const watchlistSymbols = watchlist.join(', ')
  const portfolioSummary = holdings.map((p) => `${p.symbol}: ${p.shares} units @ A$${p.avgCost}`).join(', ')

  const prompt = `
You are MaddenAI. Generate a personalised morning market brief for an Australian investor.

Today: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: 7:00 AM AEST

Investor's watchlist: ${watchlistSymbols || 'Not set'}
Portfolio holdings: ${portfolioSummary || 'Not set'}

Generate a JSON object:
{
  "headline": "One punchy sentence summarising the market mood today",
  "maddenAIScore": number between 0-100 (overall market bullishness),
  "scoreLabel": "STRONGLY BULLISH" | "BULLISH" | "CAUTIOUSLY BULLISH" | "NEUTRAL" | "CAUTIOUSLY BEARISH" | "BEARISH" | "STRONGLY BEARISH",
  "sections": [
    { "title": "OVERNIGHT MARKETS", "content": "2-3 sentences on what happened in US/Europe overnight and why it matters for ASX today" },
    { "title": "ASX OUTLOOK", "content": "2-3 sentences on expected ASX open and key stocks/sectors to watch" },
    { "title": "YOUR WATCHLIST", "content": "2-3 sentences specifically about stocks on the investor's watchlist — what to watch, any news" },
    { "title": "KEY RISK TODAY", "content": "1-2 sentences on the one thing that could move markets today" },
    { "title": "ONE THING TO WATCH", "content": "One specific, actionable thing to watch today with a specific level or event" }
  ],
  "keyEvents": [
    {"time": "10:30 AM", "event": "AU CPI Monthly", "impact": "HIGH"},
    {"time": "2:30 PM", "event": "RBA Decision", "impact": "HIGH"}
  ]
}

Be specific and Australian-focused. Reference actual macro context. General information only.
Return ONLY valid JSON.
  `.trim()

  const brief = await askClaudeJSON(prompt, { maxTokens: 1500 })
  try { localStorage.setItem(cacheKey, JSON.stringify(brief)) } catch { /* best-effort cache write */ }
  return brief
}
