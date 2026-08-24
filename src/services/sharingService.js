// ─── Shareable-link infrastructure ─────────────────────────────────────────
// Forward-looking, local-only implementation: without a live Supabase table
// backing this yet, a "shared" link only resolves for whoever generated it,
// in the same browser (localStorage). The URL shape, the read-only viewer
// page, and the "sign up" CTA are all real and ready to swap onto a real
// backend later — only the storage layer is a stand-in.

const SHARE_PREFIX = 'maddex_share_'

function makeId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

// kind: 'watchlist' | 'research'
export function createShareLink(kind, payload) {
  const id = makeId()
  const record = { kind, payload, createdAt: new Date().toISOString() }
  try { localStorage.setItem(`${SHARE_PREFIX}${kind}_${id}`, JSON.stringify(record)) } catch { /* best-effort */ }
  const path = kind === 'watchlist' ? `/watchlist/share/${id}` : `/research/share/${id}`
  return {
    id,
    path,
    brandedUrl: `maddex.com.au${path}`,
    resolvableUrl: `${window.location.origin}${path}`,
  }
}

export function getSharedRecord(kind, id) {
  try {
    const raw = localStorage.getItem(`${SHARE_PREFIX}${kind}_${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
