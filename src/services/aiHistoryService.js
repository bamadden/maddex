// Saved MaddenAI conversations — localStorage-backed, max 50 (oldest
// dropped first). Each entry: { id, date, preview, messages }.
const HISTORY_KEY = 'maddex_ai_history'
const MAX_CONVERSATIONS = 50

function load() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* best-effort */ }
}

export function listConversations() {
  return load()
}

// Saves `messages` as a conversation, keyed by `id` if provided (updates in
// place — used so the same conversation doesn't duplicate itself on every
// autosave) or creates a new entry. No-ops on an empty/silent-only message
// list so a conversation that never got a real reply isn't persisted.
export function saveConversation(messages, id = null) {
  const realMessages = (messages ?? []).filter((m) => m.content && !m.silent)
  if (realMessages.length === 0) return id

  const firstUser = messages.find((m) => m.role === 'user')
  const preview = (firstUser?.content ?? '').slice(0, 60)
  const list = load()
  const existingIdx = id ? list.findIndex((c) => c.id === id) : -1
  const entry = {
    id: id ?? `conv_${Date.now()}`,
    date: new Date().toISOString(),
    preview,
    messages,
  }

  let next
  if (existingIdx >= 0) {
    next = [...list]
    next[existingIdx] = entry
  } else {
    next = [entry, ...list].slice(0, MAX_CONVERSATIONS)
  }
  save(next)
  return entry.id
}

export function deleteConversation(id) {
  save(load().filter((c) => c.id !== id))
}

export function getConversation(id) {
  return load().find((c) => c.id === id) ?? null
}
