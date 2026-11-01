// A record of every MaddenAI reply, for complaint handling and audit
// (legal-risk pass, item 8). Written by the server — api/claude.js after each
// call, api/ai-daily.js for shared content — so a reader cannot alter or skip
// it.
//
// Each record: who (user id; null for shared daily content), when, the model,
// the purpose, the prompt template version (a name plus a hash of the system
// prompt), the date of the input data, the output check result
// (adviceGuard: version, flags, rewritten, blocked), and the reply text.
//
// NOT recorded: the prompt. A MaddenAI question can carry the reader's
// holdings; the Privacy Policy says Maddex does not store questions. A hash of
// the user turn is kept so a complaint can be matched to a specific request
// the reader still has.
//
// Table: ai_records (supabase/migrations/011_ai_records.sql). Until it is
// applied the insert fails, is logged once per instance, and the reply is
// unaffected. Retention: 2 years (purge function in the migration).

import { guardText, GUARD_VERSION } from '../src/services/adviceGuard.js'

export const RECORD_RETENTION_DAYS = 730

// FNV-1a, 32-bit hex: identifies a text without storing it.
export function textHash(text) {
  let h = 0x811c9dc5
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

const systemText = (system) => (Array.isArray(system) ? system.map((b) => b?.text ?? '').join('\n') : String(system ?? ''))
const lastUserText = (messages) => {
  const m = [...(messages ?? [])].reverse().find((x) => x?.role === 'user')
  if (!m) return ''
  return typeof m.content === 'string' ? m.content : (m.content ?? []).map((b) => b?.text ?? '').join('\n')
}

// template: the caller's named template (x-maddex-template header), e.g.
// 'maddex-system' or 'morning-brief'; dataDate: x-maddex-data-date (ISO day).
export function buildRecord({ userId = null, model, purpose, template, dataDate, system, messages, outputText, now = new Date() }) {
  const g = guardText(outputText)
  return {
    user_id: userId,
    created_at: now.toISOString(),
    model,
    purpose,
    template_version: `${String(template || 'unnamed').slice(0, 60)}@${textHash(systemText(system))}`,
    input_data_date: /^\d{4}-\d{2}-\d{2}$/.test(String(dataDate ?? '')) ? dataDate : null,
    guard_version: GUARD_VERSION,
    guard_flags: g.flags.map((f) => f.rule),
    guard_rewritten: g.rewritten,
    guard_blocked: g.blocked,
    request_hash: textHash(lastUserText(messages)),
    output_text: String(outputText ?? '').slice(0, 20000),
  }
}

let warned = false
// db: a PostgREST caller (api/_aiGuard's rest()), as the user or the service.
export async function saveRecord(db, record) {
  if (!db || !record) return false
  try {
    const r = await db('ai_records', { method: 'POST', body: JSON.stringify(record) })
    if (!r.ok) throw new Error(`ai_records insert ${r.status}`)
    return true
  } catch (e) {
    if (!warned) { console.warn('[ai-records] not recorded (is migration 011 applied?):', e.message); warned = true }
    return false
  }
}

// For server-generated content with no user (api/ai-daily.js): PostgREST with
// the service key, or null when it is not configured (nothing recorded).
export function serviceDb(env = process.env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return (path, init = {}) => fetchImpl(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}
