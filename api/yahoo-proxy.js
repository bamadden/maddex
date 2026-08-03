// Flat (non-nested, non-bracket) Vercel Serverless Function. Nested dynamic
// catch-all functions (api/<dir>/[...path].js) are a less-standard pattern
// on Vercel outside Next.js and were unreliable in production; a flat file
// routed to via an explicit vercel.json rewrite sidesteps that entirely —
// the client still calls /api/yahoo/... (YAHOO_BASE in api.js is unchanged),
// vercel.json rewrites that to here with the captured path as a query param.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(200).end()
  }

  const path = req.query.path || ''
  const params = { ...req.query }
  delete params.path
  const queryString = new URLSearchParams(params).toString()
  const yahooUrl = `https://query1.finance.yahoo.com/${path}${queryString ? '?' + queryString : ''}`

  try {
    const resp = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
      },
    })
    const text = await resp.text()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/json')
    res.setHeader('Cache-Control', resp.ok ? 's-maxage=60, stale-while-revalidate=300' : 'no-store')
    return res.status(resp.status).send(text)
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(502).json({ error: err.message })
  }
}
