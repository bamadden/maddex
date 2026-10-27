import { zipSync, strToU8 } from 'fflate'
import { loadAlerts } from './alertsService'
import { getTransactions } from './transactionService'
import { listNoteHistory, noteId } from './researchNoteService'

// EXPORT ALL DATA (Apex) — everything this browser holds for the user, in one
// ZIP: portfolio.csv (every lot as stored), watchlist.csv, alerts.csv,
// transactions.csv, research-notes/*.pdf (each saved note, laid out as its
// PDF export), and settings.json (preferences, not caches).
//
// Read from localStorage, where the terminal keeps these. The older JSON
// export above it reads Supabase tables; this one is what the terminal
// actually uses day to day.

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }

const cell = (v) => {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// One column per key seen in any row, in first-seen order.
export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

const PREF_KEY = /(pref|setting|theme|accent|layout|shortcut|persona|response_mode|investor|dashboard|workspace|column|density|font|sound|notif|currency|timezone|onboarding|tooltips)/i
const NOT_PREF = /(cache|share_|research_notes|weekly_review|brief_|official_stats|news|digest|history|_seen_)/i

function settingsSnapshot() {
  const out = {}
  for (const key of Object.keys(localStorage)) {
    if (!/^madd(en|ex)_/.test(key) || !PREF_KEY.test(key) || NOT_PREF.test(key)) continue
    const raw = localStorage.getItem(key)
    try { out[key] = JSON.parse(raw) } catch { out[key] = raw }
  }
  return out
}

export async function buildExportZip() {
  const watchlist = read('madden_watchlist_v1', [])
  const files = {
    'portfolio.csv': strToU8(toCsv(read('madden_portfolio_v2', []))),
    'watchlist.csv': strToU8(toCsv(watchlist.map((s) => (typeof s === 'string' ? { symbol: s } : s)))),
    'alerts.csv': strToU8(toCsv(loadAlerts())),
    'transactions.csv': strToU8(toCsv(getTransactions())),
    'settings.json': strToU8(JSON.stringify({ exportedAt: new Date().toISOString(), settings: settingsSnapshot() }, null, 2)),
  }
  const notes = listNoteHistory()
  if (notes.length) {
    const { buildNotePdf, noteFilename } = await import('../components/researchNote/notePdf')
    for (const n of notes) {
      try { files[`research-notes/${noteFilename(n).replace(/\.pdf$/, '')}_${noteId(n).split(':')[0]}.pdf`] = new Uint8Array(buildNotePdf(n).output('arraybuffer')) } catch { /* skip a note that will not lay out */ }
    }
  } else {
    files['research-notes/README.txt'] = strToU8('No research notes saved in this browser yet.\n')
  }
  return { zip: zipSync(files, { level: 6 }), counts: { notes: notes.length, files: Object.keys(files).length } }
}

export async function downloadExportZip() {
  const { zip, counts } = await buildExportZip()
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `maddex-export-${new Date().toLocaleDateString('en-CA')}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return counts
}
