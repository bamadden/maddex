// ─── AI-generated content ───────────────────────────────────────────────────
//
// SCOPE, deliberately narrow: this service serves PROSE ONLY — risk
// narratives, interpretation, ticker lines, policy stance. It does not
// generate figures.
//
// The reason is that a language model cannot know today's cash rate, this
// morning's CPI print, or the current 10-year yield. Asked for them it will
// return numbers that look right and are not, with nothing on screen to
// signal the error. A wrong number presented confidently is worse than an
// obviously stale one.
//
// So the division is:
//   figures  → src/data/verifiedConstants.js (checked facts + verify dates)
//              or liveDataService (real APIs)
//   prose    → here
//
// SHARED, ONCE A DAY. Since 31 Oct 2026 the prompts live in
// services/aiDaily.js and are generated on the server by /api/ai-daily, once
// per Sydney day for every reader together — before, every reader's browser
// generated its own copy (and in production, without a sign-in token, the
// requests were refused and every reader saw the fallback). A stale-but-
// yesterday narrative is still preferred over a blank panel.

import { getDaily, readDaily, clearDaily, DAILY_PREFIX } from './aiDailyClient'
import { sydneyDay } from './aiDaily'

const yesterday = () => sydneyDay(new Date(Date.now() - 86_400_000))

// → { data, source: 'cache' | 'live' | 'stale' | 'failed' }
async function shared(key) {
  try {
    const { data, source } = await getDaily(key)
    return { data, source: source === 'shared' ? 'live' : source }
  } catch (err) {
    console.warn(`[AIContent] ${key} failed:`, err.message)
    return { data: null, source: 'failed' }
  }
}

export const aiContentService = {
  // NOTE: macro themes are NOT served here. services/macroThemeService owns
  // them, in the shape MacroModule renders. Both read the same shared
  // endpoint with the same verified figures in the prompt.

  getGeopoliticalRisks: () => shared('geo_risks'),
  getShippingStatus: () => shared('shipping_status'),
  getIntelTicker: () => shared('intel_ticker'),
  getMacroRegime: () => shared('macro_regime'),
  // Called lazily, on the first central-bank card expansion rather than on
  // module mount, so visiting Rates does not fetch a panel nobody opened.
  getPolicyBias: () => shared('policy_bias'),

  // ── Status + maintenance ──────────────────────────────────────────────────
  KEYS: ['geo_risks', 'shipping_status', 'intel_ticker', 'macro_regime', 'policy_bias'],

  getContentStatus() {
    return this.KEYS.map((key) => {
      if (readDaily(key)) return { key, kind: 'ai', status: 'today' }
      return { key, kind: 'ai', status: readDaily(key, yesterday()) ? 'yesterday' : 'none' }
    })
  },

  // Drops this browser's copy of ONE item (today's and yesterday's), so the
  // next read fetches the shared item again. It does not regenerate it: the
  // item is shared by every reader for the day.
  clearKey(key) {
    clearDaily(key)
  },

  clearCache() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(DAILY_PREFIX) || k.startsWith('maddex_ai_content_'))
        .forEach((k) => localStorage.removeItem(k))
    } catch { /* best effort */ }
  },

  // Fetches anything this browser does not have for today. Sequential: the
  // items are cached for the day, so a burst buys nothing.
  async refreshAll() {
    const missing = this.KEYS.filter((k) => k !== 'policy_bias' && !readDaily(k))
    let refreshed = 0
    for (const key of missing) {
      const r = await shared(key)
      if (r.source !== 'failed') refreshed += 1
    }
    return { refreshed, skipped: this.KEYS.length - missing.length }
  },
}

export default aiContentService
