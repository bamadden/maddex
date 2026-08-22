import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Needs the function form (not a plain object) so loadEnv can read
// ANTHROPIC_API_KEY — a non-VITE_-prefixed var, kept out of the client
// bundle on purpose — for the dev-only /api/claude proxy below.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
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
        // Dev-only stand-in for api/claude.js (Vercel serverless function
        // in prod). Forwards straight to Anthropic and injects the API key
        // here, server-side in the Vite dev process — the browser never
        // sees it, same guarantee as the deployed function.
        '/api/claude': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY || '')
              proxyReq.setHeader('anthropic-version', '2023-06-01')
            })
          },
        },
      },
    },
  }
})
