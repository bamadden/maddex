// Analysis worth keeping.
//
// A MaddenAI reply currently lives until the chat is cleared, which means the
// one genuinely useful paragraph a user got last Tuesday is gone. This keeps
// the ones they mark, so a piece of reasoning can be returned to rather than
// regenerated — and regenerating it would not even produce the same answer.
//
// Twenty, newest first. The cap is not arbitrary: these are full replies, some
// of them several hundred words, and an uncapped list in localStorage is a
// quota failure waiting for the user who saves everything.

const KEY = 'maddex_saved_insights'
const MAX = 20

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota */ }
  return list
}

export const listInsights = () => read()

// The first meaningful line, for the collapsed row.
//
// Skips the compliance banner every reply opens with — a list of twenty
// insights all reading "General information only" would be useless as an
// index, which is the only job the preview has.
function previewOf(content) {
  const lines = String(content ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^⚠|^general information only/i.test(l))
  const first = lines[0] ?? String(content ?? '').trim()
  return first.length > 120 ? `${first.slice(0, 117)}…` : first
}

export function saveInsight({ content, context = null }) {
  if (!content?.trim()) return read()
  const list = read()
  // Saving the same reply twice is a misclick, not an intention.
  if (list.some((i) => i.content === content)) return list
  const entry = {
    id: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    preview: previewOf(content),
    content,
    context,
  }
  return write([entry, ...list].slice(0, MAX))
}

export const removeInsight = (id) => write(read().filter((i) => i.id !== id))
export const clearInsights = () => write([])
export const isInsightSaved = (content) => read().some((i) => i.content === content)
export const INSIGHT_LIMIT = MAX
