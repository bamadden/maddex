// Vercel serverless function — the Terminal API, Apex tier's programmatic
// data access. Reuses the same mock data layer the client terminal itself
// runs on (src/services/mockData.js has no browser-only dependencies, so
// it imports cleanly into this Node runtime).

import { getMockFMPRow, getMockFMPHistory, MOCK_INDICES } from '../src/services/mockData.js'

// mdx_ + 32 hex chars, matching generateAPIKey()'s output shape.
const API_KEY_FORMAT = /^mdx_[a-f0-9]{32}$/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-maddex-api-key')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed — this API is read-only (GET)' })

  const apiKey = req.headers['x-maddex-api-key']

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required — pass it as the x-maddex-api-key header',
      docs: 'https://maddex.com.au/docs/api',
    })
  }

  // Format-valid keys are accepted for now (this is a demo data API, not a
  // billed one yet). TODO: validate against Supabase profiles.api_key +
  // confirm the owning account is Apex tier once this is live.
  if (!API_KEY_FORMAT.test(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key format',
      docs: 'https://maddex.com.au/docs/api',
    })
  }

  const { endpoint } = req.query

  switch (endpoint) {
    case 'quote': {
      const symbol = req.query.symbol
      if (!symbol) return res.status(400).json({ error: 'symbol query param required' })
      const quote = getMockFMPRow(symbol)
      if (!quote) return res.status(404).json({ error: `No data for symbol: ${symbol}` })
      return res.status(200).json({
        symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        timestamp: new Date().toISOString(),
        source: 'Maddex Terminal API v1',
        disclaimer: 'General information only. Not financial advice. Illustrative demo data.',
      })
    }

    case 'batch': {
      const symbols = req.query.symbols?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
      if (!symbols.length) return res.status(400).json({ error: 'symbols query param required (comma-separated)' })
      if (symbols.length > 50) return res.status(400).json({ error: 'Maximum 50 symbols per batch request' })
      const quotes = symbols.map((s) => {
        const q = getMockFMPRow(s)
        return q ? {
          symbol: s,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          marketCap: q.marketCap,
        } : { symbol: s, error: 'No data' }
      })
      return res.status(200).json({
        quotes,
        timestamp: new Date().toISOString(),
        count: quotes.length,
      })
    }

    case 'history': {
      const symbol = req.query.symbol
      if (!symbol) return res.status(400).json({ error: 'symbol query param required' })
      const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30))
      const history = getMockFMPHistory(symbol, days)
      if (!history.length) return res.status(404).json({ error: `No history for symbol: ${symbol}` })
      return res.status(200).json({
        symbol,
        days,
        data: history,
        timestamp: new Date().toISOString(),
      })
    }

    case 'indices':
      return res.status(200).json({
        indices: Object.entries(MOCK_INDICES).map(([symbol, v]) => ({ symbol, ...v })),
        timestamp: new Date().toISOString(),
      })

    case 'sentiment':
      // The real sentiment index (sentimentService.js) lives in browser
      // localStorage, generated client-side per user — there's no server-side
      // equivalent to read here, so this is a static illustrative value
      // matching the rest of this demo API.
      return res.status(200).json({
        score: 72,
        label: 'CAUTIOUSLY BULLISH',
        asxBias: 'POSITIVE',
        timestamp: new Date().toISOString(),
      })

    default:
      return res.status(404).json({
        error: `Unknown endpoint: ${endpoint}`,
        available: ['quote', 'batch', 'history', 'indices', 'sentiment'],
      })
  }
}
