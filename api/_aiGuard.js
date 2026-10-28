// Who may call /api/claude, with which model, how long, and how often.
//
// Until 27 Oct 2026 /api/claude was an open proxy: any POST from anywhere was
// forwarded to Anthropic with the production key, with the model and
// max_tokens chosen by the caller, and the MaddenAI plan limits existed only
// in the browser. This module is the server side of all of that.
//
// SUPABASE ACCESS. The caller's token is verified against Supabase's own
// /auth/v1/user (the same check api/alert-email.js uses). Profile and usage
// reads and writes then go through PostgREST with SUPABASE_SERVICE_KEY when
// it is configured, and otherwise with the caller's own token under the RLS
// policies in migrations 001 and 009 — so the guard works without a new
// secret, and a missing service key cannot take MaddenAI down.
//
// TWO BUDGETS PER DAY. A Core user's ten questions are MaddenAI chat
// questions (purpose 'chat'). The terminal also calls the model for the
// morning brief, macro themes, the intel ticker and so on (purpose
// 'feature'); counting those against the ten would leave a Core user out of
// questions before opening the panel. So chat has the plan's limit, and every
// call — whatever the client says it is — counts against a ceiling per plan.
// A client that mislabels chat as 'feature' gains at most the ceiling, never
// unlimited access.
//
// The day is the Sydney day, as the client's own counter uses.

export const ALLOWED_MODELS = ['claude-sonnet-4-6', 'claude-sonnet-5-5', 'claude-opus-5-5']
export const DEFAULT_MODEL = 'claude-sonnet-4-6'
// Opus costs several times Sonnet; nothing in the client asks for it, so only
// paying Apex accounts may.
const MODEL_TIERS = { 'claude-opus-5-5': ['apex'] }

// MaddenAI chat questions per day. 'trial' is the 7-day trial, which the
// product sells as full Apex access — high enough that no person reaches it,
// low enough that a throwaway sign-up can't run the account up.
export const CHAT_LIMITS = { core: 10, prime: 50, apex: 9999, trial: 200 }
// Every model call per day, chat and features together.
export const DAILY_CEILING = { core: 60, prime: 150, apex: 500, trial: 300 }
// Output tokens per call. Chat sends 1,200 (3,000 in research mode, 3,600 for
// a deep dive, 4,000 for the RBA preview); the long-form features (research
// notes 2,200, macro themes 6,000) need more than any chat answer. Prime
// matches Apex here — at 3,000 a Prime deep dive was cut off mid-section; the
// plans differ in how many questions a day, not how complete an answer is.
export const MAX_TOKENS = {
  chat: { core: 1500, prime: 4000, apex: 4000, trial: 4000 },
  feature: { core: 6000, prime: 6000, apex: 6000, trial: 6000 },
}

const env = (...names) => names.map((n) => process.env[n]).find(Boolean)
const supabaseUrl = () => env('SUPABASE_URL', 'VITE_SUPABASE_URL')
const anonKey = () => env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
const serviceKey = () => env('SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY')

export function bearer(req) {
  const h = req.headers?.authorization ?? req.headers?.Authorization ?? ''
  return /^Bearer\s+\S+/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null
}

export async function verifyUser(token, fetchImpl = fetch) {
  const url = supabaseUrl(), anon = anonKey()
  if (!url || !anon || !token) return null
  try {
    const r = await fetchImpl(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } })
    if (!r.ok) return null
    const user = await r.json()
    return user?.id ? user : null
  } catch { return null }
}

// PostgREST as the service role when configured, else as the caller.
function rest(token, fetchImpl) {
  const url = supabaseUrl()
  const key = serviceKey() ?? anonKey()
  const auth = serviceKey() ?? token
  return (path, init = {}) => fetchImpl(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${auth}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}

// Mirrors plans.effectiveTier: an unexpired trial is 'trial' here (its own
// limits), an expired one is Core, anything unrecognised is Core.
export function tierFrom(profile, now = Date.now()) {
  const raw = profile?.subscription_tier || 'trial'
  if (raw === 'trial') {
    const ends = profile?.trial_ends_at ? Date.parse(profile.trial_ends_at) : null
    return ends != null && ends < now ? 'core' : 'trial'
  }
  return ['core', 'prime', 'apex'].includes(raw) ? raw : 'core'
}

// Midnight today in Sydney, as an ISO instant.
export function sydneyDayStart(now = new Date()) {
  const ymd = now.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', timeZoneName: 'longOffset' })
    .formatToParts(now).find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') || '+10:00'
  return new Date(`${ymd}T00:00:00${offset}`).toISOString()
}

// → { ok: true, user, tier, model, maxTokens, purpose, logId, db }
//   or { ok: false, status, body }
export async function guard(req, body, { fetchImpl = fetch, now = new Date() } = {}) {
  // Misconfiguration must not look like a bad token: without these every
  // signed-in user would get AUTH_INVALID, indistinguishable from an attack.
  if (!supabaseUrl() || !anonKey()) {
    console.error('[ai-guard] SUPABASE_URL / SUPABASE_ANON_KEY not set — refusing all AI calls')
    return { ok: false, status: 503, body: { error: 'MaddenAI is not configured', code: 'NOT_CONFIGURED' } }
  }
  const token = bearer(req)
  if (!token) return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_REQUIRED' } }
  const user = await verifyUser(token, fetchImpl)
  if (!user) return { ok: false, status: 401, body: { error: 'Invalid or expired token', code: 'AUTH_INVALID' } }

  const db = rest(token, fetchImpl)
  let profile = null
  try {
    const r = await db(`profiles?select=subscription_tier,trial_ends_at&id=eq.${user.id}`)
    if (r.ok) profile = (await r.json())?.[0] ?? null
  } catch { /* falls to Core below */ }
  const tier = profile ? tierFrom(profile, now.getTime()) : 'core'

  const model = body?.model ?? DEFAULT_MODEL
  if (!ALLOWED_MODELS.includes(model) || (MODEL_TIERS[model] && !MODEL_TIERS[model].includes(tier))) {
    return { ok: false, status: 400, body: { error: 'Model not permitted', code: 'MODEL_NOT_PERMITTED' } }
  }
  // A header, not a body field: the dev proxy forwards the body to Anthropic
  // untouched, and Anthropic rejects fields it does not know.
  const purpose = String(req.headers?.['x-maddex-purpose'] ?? '').toLowerCase() === 'chat' ? 'chat' : 'feature'
  const maxTokens = Math.max(1, Math.min(Number(body?.max_tokens) || 2000, MAX_TOKENS[purpose][tier]))

  // Usage: record this call first, then count — so a burst of parallel
  // requests sees each other rather than all reading the same low count.
  // If the ai_usage table is not there yet (migration 009 unapplied) the
  // guard still enforces sign-in, the model list and the token cap, and logs
  // that limits are off, rather than failing every request.
  let logId = null
  try {
    const ins = await db('ai_usage', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, model, purpose }),
    })
    if (!ins.ok) throw new Error(`ai_usage insert ${ins.status}: ${(await ins.text()).slice(0, 160)}`)
    logId = (await ins.json())?.[0]?.id ?? null

    const since = encodeURIComponent(sydneyDayStart(now))
    const countOf = async (filter) => {
      const r = await db(`ai_usage?select=id&user_id=eq.${user.id}&created_at=gte.${since}${filter}`, {
        method: 'HEAD', headers: { Prefer: 'count=exact' },
      })
      return Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
    }
    const [all, chat] = await Promise.all([countOf(''), purpose === 'chat' ? countOf('&purpose=eq.chat') : 0])
    const over = purpose === 'chat' && chat > CHAT_LIMITS[tier] ? CHAT_LIMITS[tier]
      : all > DAILY_CEILING[tier] ? DAILY_CEILING[tier] : null
    if (over != null) {
      return { ok: false, status: 429, body: {
        error: 'Daily limit reached', code: 'DAILY_LIMIT', limit: over, tier, purpose,
        upgradeRequired: tier !== 'apex',
      } }
    }
  } catch (e) {
    console.warn('[ai-guard] usage tracking unavailable — limits not enforced:', e.message)
  }

  return { ok: true, user, tier, model, maxTokens, purpose, logId, db }
}

// Token counts onto the row recorded before the call.
export async function recordTokens(g, usage) {
  if (!g?.logId || !usage) return
  try {
    await g.db(`ai_usage?id=eq.${g.logId}`, {
      method: 'PATCH',
      body: JSON.stringify({ input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 }),
    })
  } catch { /* the call is already made; stats only */ }
}
