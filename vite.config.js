import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin: proxy Yahoo Finance from Node.js so we control exact headers.
// The Vite http-proxy can't override User-Agent reliably; Node fetch can.
function yahooFinanceProxy() {
  const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Referer': 'https://finance.yahoo.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  }
  return {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/yahoo/')) return next()
        const targetPath = req.url.replace('/api/yahoo', '')
        const targetUrl = `https://query1.finance.yahoo.com${targetPath}`
        try {
          const r = await fetch(targetUrl, { headers: YAHOO_HEADERS })
          const body = await r.text()
          res.writeHead(r.status, {
            'Content-Type': r.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          })
          res.end(body)
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), yahooFinanceProxy()],
  server: {
    proxy: {
      '/api/frankfurter': {
        // api.frankfurter.app 301-redirects to api.frankfurter.dev/v1 — point
        // at the new host directly to skip that hop.
        target: 'https://api.frankfurter.dev/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/frankfurter/, ''),
      },
      '/api/rba': {
        target: 'https://api.rba.gov.au',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rba/, ''),
      },
      '/api/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stooq/, ''),
      },
    },
  },
})
