import { RBA_RATE_HISTORY, FED_RATE_HISTORY } from './placeholders'

// ─── AU – US policy spread ──────────────────────────────────────────────────
//
// RBA cash rate minus the top of the Fed's target range, on every day, built
// from the two dated decision histories (both on effective dates). Nothing
// here is typed in: the current spread, the 12-month path and the five-year
// average all come from the same two lists, so they agree with the step
// charts and with each other.
//
// The brief for this panel suggested "a 5-year average of approximately +15bp"
// as AI-estimated context, and the line "AU has historically traded at a
// premium to the US". Computed from the decision histories, the five years to
// October 2026 average about −62bp: the RBA sat below the Fed for most of the
// 2022–25 cycle, by as much as 165bp. A computed figure replaces the estimate.

// RBA_RATE_HISTORY starts at the first hike of the 2022 cycle. The rate it
// replaced, 0.10% from 4 Nov 2020 (RBA table A2), is the anchor for any
// window that begins before May 2022.
export const RBA_PATH = [{ date: '2020-11-04', rate: 0.10 }, ...RBA_RATE_HISTORY]
export const FED_PATH = FED_RATE_HISTORY

const DAY = 86400000
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

export function rateOn(path, day) {
  let rate = null
  for (const r of path) { if (r.date <= day) rate = r.rate; else break }
  return rate
}

// Spread in basis points on one day, or null before both paths begin.
export function spreadOn(day) {
  const au = rateOn(RBA_PATH, day)
  const us = rateOn(FED_PATH, day)
  return au == null || us == null ? null : Math.round((au - us) * 100)
}

// One point per day from `fromMs` to `toMs`, keeping only the days the spread
// changes (plus both ends) so a step chart draws it exactly.
export function spreadSeries(fromMs, toMs) {
  const out = []
  let prev
  for (let t = fromMs; t <= toMs; t += DAY) {
    const day = iso(t)
    const bp = spreadOn(day)
    if (bp !== prev || t + DAY > toMs) out.push({ date: day, t, bp, au: rateOn(RBA_PATH, day), us: rateOn(FED_PATH, day) })
    prev = bp
  }
  return out
}

// Daily mean, low and high over the `years` to `toMs`; `hiDay`/`loDay` are
// the first day each extreme was reached. Null when the window starts before
// either path does.
export function spreadStats(years, toMs) {
  const from = new Date(toMs)
  from.setUTCFullYear(from.getUTCFullYear() - years)
  // A window reaching back before both paths begin would average over part
  // of it while claiming all of it — refuse rather than mislabel.
  if (spreadOn(iso(from.getTime())) == null) return null
  let sum = 0, n = 0, lo = Infinity, hi = -Infinity, loDay = null, hiDay = null
  for (let t = from.getTime(); t <= toMs; t += DAY) {
    const day = iso(t)
    const bp = spreadOn(day)
    if (bp == null) continue
    sum += bp; n++
    if (bp < lo) { lo = bp; loDay = day }
    if (bp > hi) { hi = bp; hiDay = day }
  }
  return n ? { mean: sum / n, lo, hi, loDay, hiDay, from: iso(from.getTime()) } : null
}
