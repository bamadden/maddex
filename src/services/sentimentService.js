import { askClaudeJSON } from './api'

// One generation per calendar hour — matches the brief's "hourly market
// sentiment score" cadence.
const SENTIMENT_CACHE_KEY = () => {
  const now = new Date()
  const hour = now.getHours()
  const date = now.toISOString().split('T')[0]
  return `maddex_sentiment_${date}_${hour}`
}

// newsHeadlines: array of fetchNews() article objects ({ headline, ... }).
export async function calculateSentiment(newsHeadlines) {
  const cacheKey = SENTIMENT_CACHE_KEY()
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* fall through to regenerate */ }
  }

  const headlines = (newsHeadlines ?? []).slice(0, 20).map((n) => n.headline).filter(Boolean).join('\n')

  const prompt = `Analyse these financial news headlines and return a market sentiment score for Australian investors.

Headlines:
${headlines}

Return JSON only:
{
  "score": number 0-100,
  "label": "STRONGLY BULLISH" | "BULLISH" | "CAUTIOUSLY BULLISH" | "NEUTRAL" | "CAUTIOUSLY BEARISH" | "BEARISH" | "STRONGLY BEARISH",
  "drivers": ["top positive driver", "top negative driver"],
  "asxBias": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "keyTheme": "one sentence on the dominant theme"
}`

  const sentiment = await askClaudeJSON(prompt, { maxTokens: 300 })
  try { localStorage.setItem(cacheKey, JSON.stringify(sentiment)) } catch { /* best-effort */ }
  return sentiment
}
