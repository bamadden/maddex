import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { fetchYahooQuote, USING_MOCK_DATA } from './services/api'
import { getMockFMPRow } from './services/mockData'

// Clear stale stock-price cache on every load — only `madden_idx_*` keys hold
// quote data; everything else under `madden_*` (portfolio, currency, alerts,
// command history, view prefs) is user data/settings and must be preserved.
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith('madden_idx_')) localStorage.removeItem(key)
  }
  console.log('[MADDEN] ✓ Cleared stale stock-price cache from localStorage')
} catch (e) {
  console.warn('[MADDEN] Failed to clear localStorage cache:', e.message)
}

// API startup verification
console.log('[MADDEN] ✓ FMP: direct browser access (CORS-enabled) — equities + indices')
console.log('[MADDEN] ✓ STOOQ: proxy ready (/api/stooq) — not currently used for indices, see api.js')
console.log('[MADDEN] ✓ COINGECKO: no key required — direct browser access')
console.log('[MADDEN] ✓ FRANKFURTER: no key required — proxy ready (/api/frankfurter)')
console.log('[MADDEN] ✓ ANTHROPIC: server-side only — proxied via /api/claude, key never in this bundle')

// Startup price verification — a guard against the wrong LISTING (BHP's US
// ADR price shown as BHP.AX, a USD price shown as AUD), not a price forecast.
//
// The expected bands used to be typed-in ranges from an earlier year, so
// they drifted into false alarms (CBA, AAPL, NVDA all "failing" on correct
// data). Each band is now ±40% around the demo layer's reference price for
// the same symbol — wide enough for any real market move, narrow enough to
// catch a currency or listing mix-up, which is typically off by 30-60%.
// Skipped entirely on demo data, where it would only be checking the demo
// layer against itself.
setTimeout(async () => {
  if (USING_MOCK_DATA) return
  const CHECKS = ['BHP.AX', 'CBA.AX', 'WOW.AX', 'RIO.AX', 'AAPL', 'NVDA']
  console.log('[MADDEN VERIFY] Running startup price checks...')
  for (const sym of CHECKS) {
    try {
      const ref = getMockFMPRow(sym)?.regularMarketPrice
      const q = await fetchYahooQuote(sym)
      if (!q || !ref) { console.warn(`[MADDEN VERIFY] ✕ ${sym}: no quote or no reference`); continue }
      const ok = q.price >= ref * 0.6 && q.price <= ref * 1.4
      console[ok ? 'log' : 'warn'](
        `[MADDEN VERIFY] ${ok ? '✓' : '✕'} ${sym}: ${q.price} ${q.currency} (reference ${ref.toFixed(2)}, ±40%)`
      )
    } catch (e) {
      console.warn(`[MADDEN VERIFY] ✕ ${sym}:`, e.message)
    }
  }
}, 2000)

// ANTHROPIC deliberately excluded — its key is server-side only (see
// api/claude.js) and is never read as a VITE_-prefixed client var.
const KEYED_APIS = {
  'EXCHANGERATE-API': import.meta.env.VITE_EXCHANGERATE_API_KEY,
  'FMP':              import.meta.env.VITE_FMP_API_KEY,
}
for (const [name, key] of Object.entries(KEYED_APIS)) {
  if (key) console.log(`[MADDEN] ✓ ${name}: configured (${key.slice(0, 8)}...)`)
  // An absent equities key is the expected DEMO setup, not a fault.
  else if (name === 'FMP' && USING_MOCK_DATA) console.info(`[MADDEN] ○ ${name}: not set — equities run on labelled DEMO data`)
  else     console.warn(`[MADDEN] ✕ ${name}: MISSING — set in .env`)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
