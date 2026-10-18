// Read-later list for the News module. A copy of each article is kept — not
// just its id — because the feed moves on and a story saved this morning will
// have dropped off the wire by tonight. Newest first, at most 20.

const KEY = 'maddex_saved_articles'
export const SAVED_MAX = 20

export function loadSavedArticles() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

const keyOf = (a) => a.link || a.headline

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota, private mode */ }
  return list
}

// Returns the new list. Saving the 21st drops the oldest.
export function toggleSavedArticle(article) {
  const list = loadSavedArticles()
  const k = keyOf(article)
  if (list.some((a) => keyOf(a) === k)) return write(list.filter((a) => keyOf(a) !== k))
  const { headline, summary, link, source, pubDate, impact } = article
  return write([{ headline, summary, link, source, pubDate, impact, savedAt: Date.now() }, ...list].slice(0, SAVED_MAX))
}

export function removeSavedArticle(article) {
  const k = keyOf(article)
  return write(loadSavedArticles().filter((a) => keyOf(a) !== k))
}

export const savedKey = keyOf
