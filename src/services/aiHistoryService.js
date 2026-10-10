// Saved MaddenAI conversations — localStorage-backed, newest first, max 10.
// Each entry: { id, title, messages, date }.
//
// Ten, not fifty: the list is a rail you scan in fullscreen, not an archive,
// and every entry carries its full message array — fifty long research
// sessions is megabytes of localStorage for a list nobody scrolls.
const HISTORY_KEY = 'maddex_ai_conversations'
const LEGACY_KEY = 'maddex_ai_history'   // { id, date, preview, messages }, up to 50
const MAX_CONVERSATIONS = 10

// One-time move from the old key: newest ten kept, `preview` becomes `title`.
function migrate() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy == null) return
    if (localStorage.getItem(HISTORY_KEY) == null) {
      const old = JSON.parse(legacy)
      const moved = (Array.isArray(old) ? old : [])
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, MAX_CONVERSATIONS)
        .map(({ id, date, preview, messages }) => ({ id, title: preview || 'Untitled', messages: messages ?? [], date }))
      localStorage.setItem(HISTORY_KEY, JSON.stringify(moved))
    }
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* unreadable legacy data is simply not carried over */ }
}

function load() {
  migrate()
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* best-effort */ }
}

// The first thing the user asked; for a conversation opened by an ASK AI
// button (a silent prompt, no user bubble) the asset it was about.
function titleFor(messages) {
  const firstUser = messages.find((m) => m.role === 'user' && m.content)
  if (firstUser) return firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 80)
  const ctx = messages.find((m) => m.context)?.context
  const subject = ctx?.ticker || ctx?.name
  return subject ? `Analysis: ${subject}` : 'Untitled'
}

export function listConversations() {
  return load()
}

// Saves `messages` as a conversation, keyed by `id` if provided (updated in
// place and moved to the top, so the rail shows the most recently active
// first) or creates a new entry. No-ops when there is no real reply yet.
export function saveConversation(messages, id = null) {
  if (!(messages ?? []).some((m) => m.role === 'assistant' && m.content)) return id

  const entry = {
    id: id ?? `conv_${Date.now()}`,
    title: titleFor(messages),
    messages,
    date: new Date().toISOString(),
  }
  const rest = load().filter((c) => c.id !== entry.id)
  save([entry, ...rest].slice(0, MAX_CONVERSATIONS))
  return entry.id
}

export function deleteConversation(id) {
  save(load().filter((c) => c.id !== id))
}

export function clearAllHistory() {
  save([])
}

export function getConversation(id) {
  return load().find((c) => c.id === id) ?? null
}
