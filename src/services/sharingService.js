import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Share links ────────────────────────────────────────────────────────────
//
// A share link is a random UUID. The record is written to Supabase
// (`shared_links`, migration 007) so anyone with the link can open it, signed
// in or not, through the get_shared_link() lookup. It is also kept in this
// browser, which is what makes the link work at once here and is the whole
// story when the server copy fails (signed out, offline, or the migration
// not applied) — `stored` resolves to 'server' or 'local' so the share modal
// can say which, instead of handing out a link that will 404 for everyone
// else.

const SHARE_PREFIX = 'maddex_share_'
const PATHS = { watchlist: '/watchlist/share/', research: '/research/share/', portfolio: '/portfolio/share/' }

const makeId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`)

// kind: 'watchlist' | 'research' | 'portfolio'
export function createShareLink(kind, payload) {
  const id = makeId()
  const record = { kind, payload, createdAt: new Date().toISOString() }
  try { localStorage.setItem(`${SHARE_PREFIX}${kind}_${id}`, JSON.stringify(record)) } catch { /* best-effort */ }
  const stored = (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!data?.session) return 'local'
      const { error } = await supabase.from('shared_links').insert({ id, kind, payload })
      return error ? 'local' : 'server'
    } catch { return 'local' }
  })()
  const path = `${PATHS[kind]}${id}`
  return {
    id,
    path,
    brandedUrl: `maddex.com.au${path}`,
    resolvableUrl: `${window.location.origin}${path}`,
    stored,
  }
}

export async function getSharedRecord(kind, id) {
  try {
    const raw = localStorage.getItem(`${SHARE_PREFIX}${kind}_${id}`)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to the server */ }
  try {
    const { data, error } = await supabase.rpc('get_shared_link', { p_id: id, p_kind: kind })
    return error ? null : data ?? null
  } catch { return null }
}

// → undefined while loading, null when the link resolves nowhere.
export function useSharedRecord(kind, id) {
  const [record, setRecord] = useState(undefined)
  useEffect(() => {
    let live = true
    getSharedRecord(kind, id).then((r) => { if (live) setRecord(r) })
    return () => { live = false }
  }, [kind, id])
  return record
}
