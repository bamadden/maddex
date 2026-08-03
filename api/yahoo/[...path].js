// Vercel serverless function mirroring the dev-time Yahoo proxy in
// vite.config.js. A plain vercel.json `rewrite` forwards the browser's own
// request headers to Yahoo (whatever Vercel's edge network sends), which is
// not the same as the explicit desktop-Chrome headers the Node dev proxy
// sends — Yahoo blocks the mismatched/missing ones in production even when
// dev works fine. Setting the same headers here keeps prod and dev in sync.
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://finance.yahoo.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(200).end()
  }

  const { path = [] } = req.query
  const targetPath = '/' + (Array.isArray(path) ? path.join('/') : path)
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const targetUrl = `https://query1.finance.yahoo.com${targetPath}${search}`

  try {
    const r = await fetch(targetUrl, { headers: YAHOO_HEADERS })
    const body = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (r.ok) {
      // Edge-cache successful responses so concurrent users share one Yahoo
      // hit instead of each triggering their own — meaningfully cuts 429s in
      // production. Note: the client appends its own `_t=<timestamp>` cache
      // buster (for its separate in-memory cache), which makes each request
      // URL unique and defeats this at the edge; it still helps for any
      // caller that doesn't send `_t`, and costs nothing to leave on.
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    } else {
      res.setHeader('Cache-Control', 'no-store')
    }
    res.send(body)
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
