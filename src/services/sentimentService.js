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

  const raw = await askClaudeJSON(prompt, { maxTokens: 300 })
  // Stamped so consumers can say how old the read is. The cache key is keyed
  // by calendar hour, which tells you which hour it was generated in but not
  // how long ago — at 10:59 an "hour 10" score is a minute old, and at 10:01
  // it is an hour old. A widget showing "updated 2h ago" has to know which.
  const sentiment = { ...raw, generatedAt: new Date().toISOString() }
  try { localStorage.setItem(cacheKey, JSON.stringify(sentiment)) } catch { /* best-effort */ }
  return sentiment
}
