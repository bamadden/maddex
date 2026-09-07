// Pre-earnings checklists, one per company per reporting date.
//
// Keyed by ticker AND date so last half's checklist does not come back ticked
// for this half's result — the whole value of the thing is that it is a fresh
// pass before each report.

const KEY = 'maddex_earnings_prep'

// The default list. Deliberately about PREPARATION rather than prediction:
// every item is something a reader can actually do before the announcement,
// and none of them asks them to guess the number.
export const DEFAULT_CHECKLIST = [
  'Read last half\'s result and what guidance they gave',
  'Note the two or three metrics that actually move this stock',
  'Check what the market already expects — and what is priced in',
  'Decide position sizing BEFORE the number lands, not after',
  'Set a price alert so you are not watching the screen',
]

const prepKey = (ticker, date) => `${ticker}|${date}`

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

function write(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* quota */ }
  return all
}

export function getPrep(ticker, date) {
  const all = read()
  const stored = all[prepKey(ticker, date)]
  if (stored?.items?.length) return stored
  return { items: DEFAULT_CHECKLIST.map((text) => ({ text, done: false })), note: '' }
}

export function togglePrepItem(ticker, date, index) {
  const all = read()
  const k = prepKey(ticker, date)
  const cur = all[k] ?? { items: DEFAULT_CHECKLIST.map((text) => ({ text, done: false })), note: '' }
  const items = cur.items.map((it, i) => (i === index ? { ...it, done: !it.done } : it))
  write({ ...all, [k]: { ...cur, items } })
  return { ...cur, items }
}

export function setPrepNote(ticker, date, note) {
  const all = read()
  const k = prepKey(ticker, date)
  const cur = all[k] ?? { items: DEFAULT_CHECKLIST.map((text) => ({ text, done: false })), note: '' }
  const next = { ...cur, note: String(note ?? '').slice(0, 300) }
  write({ ...all, [k]: next })
  return next
}

// Prunes checklists for reports that have already happened, so this cannot
// grow forever in storage.
export function prunePrep(now = Date.now()) {
  const all = read()
  const cutoff = new Date(now - 30 * 86400000).toISOString().slice(0, 10)
  let changed = false
  for (const k of Object.keys(all)) {
    const date = k.split('|')[1]
    if (date && date < cutoff) { delete all[k]; changed = true }
  }
  if (changed) write(all)
  return all
}
