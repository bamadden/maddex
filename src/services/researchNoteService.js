import { getMockFMPRow, getMockFMPHistory, MOCK_CRYPTO } from './mockData'
import { askClaudeJSON } from './api'

// Stable instruction template — the section list and JSON schema never vary,
// so they live in the cached system prefix; the per-stock figures go in the
// user message.
const RESEARCH_SYSTEM = `You are MaddenAI, an institutional-grade financial analyst. Generate a comprehensive research note for the asset the user names.

Generate a professional research note with these EXACT sections in this order. Return as JSON:

{
  "rating": "BUY" | "HOLD" | "SELL" | "UNDER REVIEW",
  "targetPrice": number,
  "targetCurrency": "AUD" | "USD",
  "timeHorizon": "3 months" | "6 months" | "12 months",
  "riskRating": "LOW" | "MEDIUM" | "HIGH" | "SPECULATIVE",
  "executiveSummary": "2-3 sentence summary",
  "investmentThesis": "3-4 paragraphs on why this rating",
  "businessOverview": "2-3 paragraphs on what the company does",
  "financialAnalysis": {
    "revenueOutlook": "paragraph",
    "marginAnalysis": "paragraph",
    "balanceSheet": "paragraph",
    "cashFlow": "paragraph"
  },
  "valuationAnalysis": "2-3 paragraphs on valuation",
  "catalysts": ["catalyst 1", "catalyst 2", "catalyst 3"],
  "risks": ["risk 1", "risk 2", "risk 3", "risk 4"],
  "technicalAnalysis": {
    "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
    "support": [price1, price2],
    "resistance": [price1, price2],
    "momentum": "paragraph"
  },
  "conclusion": "2-3 sentence conclusion",
  "disclaimer": "This research note is general information only and does not constitute financial advice. Past performance is not indicative of future results. Maddex and its affiliates may hold positions in securities mentioned. Always consider your personal financial situation before making investment decisions."
}

Be specific, professional, and data-driven. Australian investor perspective where relevant.
Return ONLY valid JSON, no markdown.`

// Pulls a quote-shaped object for either an equity (via the existing FMP
// mock generator, which also synthesises reasonable data for any unknown
// symbol) or a crypto asset (via the CoinGecko-shaped mock list, since
// crypto isn't covered by getMockFMPRow). Both branches resolve to the same
// Yahoo/FMP-style field names the research-note prompt below expects.
function getAssetQuote(asset) {
  if (asset.type === 'crypto') {
    const coin = MOCK_CRYPTO.find((c) => c.symbol.toUpperCase() === asset.symbol.toUpperCase())
    const price = coin?.current_price ?? asset.price ?? 0
    return {
      regularMarketPrice: price,
      regularMarketChangePercent: coin?.price_change_percentage_24h ?? asset.pct ?? 0,
      marketCap: coin?.market_cap ?? null,
      trailingPE: null,
      // MOCK_CRYPTO has no 52-week range — approximate a plausible band
      // around the current price rather than showing a false-precision "—".
      fiftyTwoWeekHigh: price ? +(price * 1.6).toFixed(price < 1 ? 4 : 2) : null,
      fiftyTwoWeekLow:  price ? +(price * 0.45).toFixed(price < 1 ? 4 : 2) : null,
    }
  }
  return getMockFMPRow(asset.symbol) ?? {
    regularMarketPrice: asset.price ?? 0,
    regularMarketChangePercent: asset.pct ?? 0,
    marketCap: null,
    trailingPE: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
  }
}

function getAssetHistory(asset, days = 365) {
  if (asset.type === 'crypto') return [] // not needed by the prompt below; kept for signature parity
  return getMockFMPHistory(asset.symbol, days)
}

export const RESEARCH_NOTE_STEPS = [
  'Analysing price data...',
  'Running fundamental analysis...',
  'Generating investment thesis...',
  'Compiling research note...',
]

// asset: { symbol, name, type } — the same shape DetailModal/Screener pass
// around already (openModal's argument, or a screener row).
export async function generateResearchNote(asset) {
  const quote = getAssetQuote(asset)
  getAssetHistory(asset) // reserved for a future price-history chart in the note

  const userContent = `
Analyse ${asset.name} (${asset.symbol}).

Today: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Current data:
Price: ${quote.regularMarketPrice}
Change: ${quote.regularMarketChangePercent}%
Market Cap: ${quote.marketCap ?? 'N/A'}
P/E: ${quote.trailingPE ?? 'N/A'}
52W High: ${quote.fiftyTwoWeekHigh ?? 'N/A'}
52W Low: ${quote.fiftyTwoWeekLow ?? 'N/A'}

Generate the full research note now.
  `.trim()

  const note = await askClaudeJSON(userContent, { maxTokens: 4000, systemPrompt: RESEARCH_SYSTEM })
  return { ...note, asset, quote, generatedAt: new Date().toISOString() }
}
