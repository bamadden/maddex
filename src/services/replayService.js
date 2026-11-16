import { RBA_TARGET_PATH, RBA_PATH_READ } from '../data/rbaCashRatePath'
import { RBA_DECISIONS } from '../data/rbaDecisions'

// Local seeded PRNG (mulberry32) + string hash — same technique mockData.js
// uses, kept as an independent copy here since mockData doesn't export its
// internals and replay's needs (date-keyed, not symbol-keyed) are different.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The RBA cash rate target on any date, from the RBA's own record (the cash
// rate target table, data/rbaCashRatePath, back to the level in force on
// 1 Jan 2008). Null before that: the rate is not shown rather than guessed.
// (16 Nov 2026: a shorter list fell back to 0.75% for any date before Oct
// 2019, so 2008 showed 0.75% instead of 7.25%.)
export const RBA_RATE_HISTORY = RBA_TARGET_PATH.map((p) => ({ date: p.effective, rate: p.rate }))
export const RBA_RATE_SOURCE = `RBA cash rate target table, read ${RBA_PATH_READ}`

export function rbaRateOn(dateStr) {
  let rate = null
  for (const r of RBA_RATE_HISTORY) { if (r.date <= dateStr) rate = r.rate; else break }
  return rate
}

export const PRESET_SCENARIOS = [
  { key: 'COVID', label: 'COVID CRASH — March 2020', startDate: '2020-02-15', endDate: '2020-04-15' },
  { key: 'RBA_CYCLE', label: 'RBA RATE CYCLE — May 2022 to Nov 2023', startDate: '2022-05-01', endDate: '2023-11-15' },
  { key: 'IRON_ORE', label: 'IRON ORE PEAK — July 2021', startDate: '2021-06-01', endDate: '2021-08-31' },
  { key: 'AI_BOOM', label: 'AI BOOM — Jan 2023 to Present', startDate: '2023-01-01', endDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) },
]

// "On this day": the RBA's own decisions only, each from its media release
// (data/rbaDecisions) or the cash rate target table (data/rbaCashRatePath),
// so every line has a source and a date. The typed list that stood here had
// no sources and disagreed with the scenario data (an iron-ore "peak" on
// 15 Jul 2021 against 12 May in the scenario; a cut dated to its effective
// day) and was removed (16 Nov 2026).
const EARLIEST_RELEASE = RBA_DECISIONS.at(-1).effective
export const EDUCATIONAL_EVENTS = [
  // Before the decision record begins: each change from the target table, on
  // its effective date.
  ...RBA_TARGET_PATH.slice(1)
    .map((p, i) => ({ p, prev: RBA_TARGET_PATH[i] }))
    .filter(({ p }) => p.effective < EARLIEST_RELEASE)
    .map(({ p, prev }) => ({
      date: p.effective,
      text: `The RBA cash rate target moves from ${prev.rate.toFixed(2)}% to ${p.rate.toFixed(2)}% (effective date)`,
      source: RBA_RATE_SOURCE,
    })),
  // From then on: each change, on the day it was announced.
  ...RBA_DECISIONS.filter((d) => d.changeBp !== 0).map((d) => ({
    date: d.announced,
    text: `RBA ${d.changeBp > 0 ? 'raises' : 'cuts'} the cash rate target by ${Math.abs(d.changeBp)}bp to ${d.rate.toFixed(2)}%`,
    source: `RBA media release ${d.mr}`,
  })),
]

export function eventOn(dateStr) {
  return EDUCATIONAL_EVENTS.find((e) => e.date === dateStr) ?? null
}

// Scenario-aware drift layered on top of the random walk so known
// historical windows are shaped like what actually happened (a crash, a
// peak-and-fade, a grind-down rate-hike period, an uptrend) rather than
// pure noise. Still approximate/illustrative, not sourced price data.
function scenarioDrift(iso) {
  if (iso >= '2020-02-20' && iso <= '2020-03-23') return -0.028
  if (iso > '2020-03-23' && iso <= '2020-06-01') return 0.012
  if (iso >= '2021-06-01' && iso <= '2021-07-15') return 0.006
  if (iso > '2021-07-15' && iso <= '2021-09-15') return -0.006
  if (iso >= '2022-05-01' && iso <= '2023-11-15') return -0.0015
  if (iso >= '2023-01-01') return 0.0012
  return 0
}

// Deterministic index-level series ending at `dateStr`, `days` trading days
// back. Level is unitless (starts effectively ~100 many years earlier) —
// the replay chart cares about the shape/direction, not an absolute price.
export function generateReplaySeries(symbol, dateStr, days = 90) {
  const rng = mulberry32(hashStr(`${symbol}_${dateStr}`) ^ 0x1234abcd)
  const dates = []
  let d = new Date(`${dateStr}T00:00:00Z`)
  while (dates.length < days) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) dates.unshift(new Date(d))
    d = new Date(d.getTime() - 86400000)
  }
  let level = 100
  return dates.map((date) => {
    const iso = date.toISOString().slice(0, 10)
    const dailyRet = (rng() - 0.5) * 0.018 + scenarioDrift(iso)
    level *= (1 + dailyRet)
    return { date: iso, level: Math.max(10, level) }
  })
}

// No "movers on this day" (removed 16 Nov 2026): random moves for real
// tickers on real dates are invented history.

// Date-only arithmetic done entirely in UTC — parsing "T00:00:00" (local)
// then round-tripping through toISOString() silently shifts the date by a
// day in any UTC+ timezone (e.g. AEST), since local midnight converts to
// the previous UTC day.
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
