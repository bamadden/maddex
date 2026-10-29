// WEEKLY RESEARCH NOTES — fresh notes on the top three watchlist stocks,
// once a week, from Monday morning.
//
// There is no server-side scheduler, so this uses the same pattern as the
// morning brief and the weekly review: a check when the app loads. The first
// load in a new week (weeks start Monday, Sydney time) generates the notes; if
// the terminal is first opened on Monday before 10am, that is before the open.
// A week is marked done BEFORE generating, so two tabs or a reload mid-run
// cannot spend the month's notes twice.
//
// Notes count against the plan's monthly allowance like any other, and the
// run takes only as many stocks as the allowance has left.

import { generateResearchNote } from './researchNoteService'
import { getUsage, recordResearchNote } from './usageService'
import { canAccess, getCurrentTier, limitFor } from './plans'
import { getMockFMPRow } from './mockData'

const KEY = 'maddex_weekly_notes'
export const WEEKLY_NOTES_CHANGED = 'maddex:weekly-notes-changed'
export const WEEKLY_NOTE_COUNT = 3

export function getWeeklyNotes() {
  try { return { enabled: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { enabled: false } }
}

function save(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(WEEKLY_NOTES_CHANGED)) } catch { /* non-browser */ }
  return next
}

// Turning it on does not mark the current week as done: the next app load
// this week generates, which is what someone switching it on expects.
export const setWeeklyNotesEnabled = (enabled) => save({ ...getWeeklyNotes(), enabled })

// The Monday of `now`'s week in Sydney, as YYYY-MM-DD.
export function weekKey(now = Date.now()) {
  const syd = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
  const back = (syd.getDay() + 6) % 7
  syd.setDate(syd.getDate() - back)
  return syd.toLocaleDateString('en-CA')
}

export const weeklyNoteSymbols = (watchlist = []) => watchlist.slice(0, WEEKLY_NOTE_COUNT)

function assetFor(symbol) {
  const name = getMockFMPRow(symbol)?.shortName ?? symbol.replace(/\.AX$/i, '')
  return { symbol, name, type: /\.AX$/i.test(symbol) ? 'asx' : 'us' }
}

// → { symbols } when it ran, null when nothing was due.
export async function runWeeklyNotes(watchlist, now = Date.now()) {
  const s = getWeeklyNotes()
  const week = weekKey(now)
  if (!s.enabled || s.lastWeek === week) return null
  const tier = getCurrentTier()
  if (!canAccess('researchNotes', tier)) return null
  const left = limitFor('researchNotesPerMonth', tier) - getUsage().researchNotes
  const symbols = weeklyNoteSymbols(watchlist).slice(0, Math.max(0, left))
  if (!symbols.length) return null

  save({ ...s, lastWeek: week, lastRunAt: new Date(now).toISOString(), lastSymbols: symbols })
  const done = []
  for (const sym of symbols) {
    try {
      await generateResearchNote(assetFor(sym))
      recordResearchNote()
      done.push(sym)
    } catch (e) {
      console.warn(`[Weekly notes] ${sym} skipped:`, e.message)
    }
  }
  save({ ...getWeeklyNotes(), lastSymbols: done })
  return done.length ? { symbols: done } : null
}
