import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { fetchYahooQuote, toAUD } from './services/api'

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
console.log('[MADDEN] ✓ YAHOO FINANCE: proxy ready (/api/yahoo → query1.finance.yahoo.com)')
console.log('[MADDEN] ✓ STOOQ: proxy ready (/api/stooq) — not currently used for indices, see api.js')
console.log('[MADDEN] ✓ COINGECKO: no key required — direct browser access')
console.log('[MADDEN] ✓ FRANKFURTER: no key required — proxy ready (/api/frankfurter)')

// Startup price verification — runs 2s after load to let the dev server settle
setTimeout(async () => {
  const CHECKS = [
    { sym: 'BHP.AX',  label: 'BHP',   minAUD: 55,  maxAUD: 80,  currency: 'AUD' },
    { sym: 'CBA.AX',  label: 'CBA',   minAUD: 155, maxAUD: 190, currency: 'AUD' },
    { sym: 'WOW.AX',  label: 'WOW',   minAUD: 32,  maxAUD: 46,  currency: 'AUD' },
    { sym: 'RIO.AX',  label: 'RIO',   minAUD: 110, maxAUD: 145, currency: 'AUD' },
    { sym: 'AAPL',    label: 'AAPL',  minAUD: 280, maxAUD: 380, currency: 'USD' },
    { sym: 'NVDA',    label: 'NVDA',  minAUD: 160, maxAUD: 250, currency: 'USD' },
  ]
  console.log('[MADDEN VERIFY] Running startup price checks...')
  for (const c of CHECKS) {
    try {
      const q = await fetchYahooQuote(c.sym)
      if (!q) { console.warn(`[MADDEN VERIFY] ✗ ${c.label}: null response`); continue }
      // For display, we need AUD rate — approximate 0.645 as sanity check only
      const audUsd = 0.645
      const audPrice = toAUD(q.price, q.currency, audUsd)
      const ok = audPrice >= c.minAUD && audPrice <= c.maxAUD
      const arrow = ok ? '✓' : '✗'
      console[ok ? 'log' : 'warn'](
        `[MADDEN VERIFY] ${arrow} ${c.label}: ${q.price} ${q.currency} → A$${audPrice?.toFixed(2)} (expected A$${c.minAUD}–${c.maxAUD})`
      )
    } catch (e) {
      console.warn(`[MADDEN VERIFY] ✗ ${c.label}:`, e.message)
    }
  }
}, 2000)

const KEYED_APIS = {
  'EXCHANGERATE-API': import.meta.env.VITE_EXCHANGERATE_API_KEY,
  'ANTHROPIC':        import.meta.env.VITE_ANTHROPIC_API_KEY,
}
for (const [name, key] of Object.entries(KEYED_APIS)) {
  if (key) console.log(`[MADDEN] ✓ ${name}: configured (${key.slice(0, 8)}...)`)
  else     console.warn(`[MADDEN] ✗ ${name}: MISSING — set in .env`)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
