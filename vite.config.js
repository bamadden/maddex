import { defineConfig, loadEnv } from 'vite'
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'

// Needs the function form (not a plain object) so loadEnv can read
// ANTHROPIC_API_KEY — a non-VITE_-prefixed var, kept out of the client
// bundle on purpose — for the dev-only /api/claude proxy below.
// The commit the running bundle was built from.
//
// Settings shows this so a bug report names a specific build rather than
// "the current version" — the difference between a reproducible report and a
// guess. Wrapped because a build from a tarball or a shallow CI checkout has
// no git directory, and a missing hash must not fail the build.
function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Runs api/rss.js in dev, so the RSS proxy behaves identically here and on
  // Vercel. A plain Vite proxy cannot do this job: the handler fetches AND
  // parses, and a proxy only forwards. Importing the real handler means there
  // is one parser to be correct rather than one per environment.
  const rssDevMiddleware = {
    name: 'maddex-rss-dev',
    configureServer(server) {
      server.middlewares.use('/api/rss', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/rss.js')
        // Minimal Express-shaped res, which is what the Vercel handler expects.
        const shim = {
          status(code) { res.statusCode = code; return shim },
          setHeader(k, v) { res.setHeader(k, v); return shim },
          json(body) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
        }
        try {
          await handler({ url: req.url, query: Object.fromEntries(new URL(req.url, 'http://x').searchParams) }, shim)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message, items: [] }))
        }
      })
    },
  }

  return {
    plugins: [react(), rssDevMiddleware],

    define: {
      __GIT_COMMIT__: JSON.stringify(gitCommit()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

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
