import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Needs the function form (not a plain object) so loadEnv can read
// ANTHROPIC_API_KEY — a non-VITE_-prefixed var, kept out of the client
// bundle on purpose — for the dev-only /api/claude proxy below.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // MapLibre ships its style/tile parser as a separate web worker, and
    // Vite's dependency optimizer rewrites the package without emitting
    // that worker file:
    //
    //   The file does not exist at ".../deps/maplibre-gl-worker.mjs" which
    //   is in the optimize deps directory.
    //
    // The map then fails in the worst possible way — silently. It fetches
    // style.json and the sprite on the main thread, reports no error, fires
    // no 'error' event, and simply never finishes loading the style, so it
    // requests zero vector tiles and renders an empty dark rectangle under
    // the deck.gl layers. Confirmed with a standalone MapLibre instance in
    // a correctly-sized container: same silent hang, no deck.gl involved.
    //
    // Excluding it from pre-bundling leaves the worker import intact.
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },

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
              // Vite's dev proxy forwards the browser's original Origin
              // header through to Anthropic (changeOrigin only rewrites
              // Host) — Anthropic sees that and demands this flag even
              // though the request is actually server-proxied. Safe to set
              // here: it's not a secret, and this path never ships (prod
              // uses api/claude.js, a fresh fetch() with no Origin at all).
              proxyReq.setHeader('anthropic-dangerous-direct-browser-access', 'true')
            })
          },
        },
      },
    },
  }
})
