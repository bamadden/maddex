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

// Real published RBA cash-rate decision dates/levels — the one part of this
// module that's sourced rather than illustrative.
export const RBA_RATE_HISTORY = [
  { date: '2019-10-02', rate: 0.75 },
  { date: '2020-03-04', rate: 0.50 },
  { date: '2020-03-20', rate: 0.25 },
  { date: '2020-11-04', rate: 0.10 },
  { date: '2022-05-04', rate: 0.35 },
  { date: '2022-06-08', rate: 0.85 },
  { date: '2022-07-06', rate: 1.35 },
  { date: '2022-08-03', rate: 1.85 },
  { date: '2022-09-07', rate: 2.35 },
  { date: '2022-10-05', rate: 2.60 },
  { date: '2022-11-02', rate: 2.85 },
  { date: '2022-12-07', rate: 3.10 },
  { date: '2023-02-08', rate: 3.35 },
  { date: '2023-03-08', rate: 3.60 },
  { date: '2023-05-03', rate: 3.85 },
  { date: '2023-06-07', rate: 4.10 },
  { date: '2023-11-08', rate: 4.35 },
  { date: '2025-02-19', rate: 4.10 },
  { date: '2025-05-21', rate: 3.85 },
  { date: '2025-08-13', rate: 3.60 },
]

export function rbaRateOn(dateStr) {
  const applicable = RBA_RATE_HISTORY.filter((r) => r.date <= dateStr)
  return applicable.length ? applicable[applicable.length - 1].rate : RBA_RATE_HISTORY[0].rate
}

export const PRESET_SCENARIOS = [
  { key: 'COVID', label: 'COVID CRASH — March 2020', startDate: '2020-02-15', endDate: '2020-04-15' },
  { key: 'RBA_CYCLE', label: 'RBA RATE CYCLE — May 2022 to Nov 2023', startDate: '2022-05-01', endDate: '2023-11-15' },
  { key: 'IRON_ORE', label: 'IRON ORE PEAK — July 2021', startDate: '2021-06-01', endDate: '2021-08-31' },
  { key: 'AI_BOOM', label: 'AI BOOM — Jan 2023 to Present', startDate: '2023-01-01', endDate: new Date().toISOString().slice(0, 10) },
]

export const EDUCATIONAL_EVENTS = [
  { date: '2020-02-20', text: 'Global markets begin a sharp selloff as COVID-19 spreads beyond China' },
  { date: '2020-03-09', text: 'An oil price war compounds COVID fears, triggering a "Black Monday" crash' },
  { date: '2020-03-16', text: 'ASX 200 falls over 9% in a single session — one of its worst days on record' },
  { date: '2020-03-20', text: 'RBA cuts the cash rate to 0.25% and begins its first bond-buying program' },
  { date: '2020-03-23', text: 'Global markets bottom out as central banks announce unprecedented stimulus' },
  { date: '2021-07-15', text: 'Iron ore price peaks near US$230/tonne on Chinese steel demand' },
  { date: '2022-05-04', text: 'RBA raises rates for the first time since 2010, ending the record-low-rate era' },
  { date: '2022-06-08', text: 'RBA delivers a 50bp hike — its largest single move since 2000' },
  { date: '2023-02-08', text: "RBA hikes for the 9th consecutive meeting as inflation stays elevated" },
  { date: '2023-11-08', text: "RBA delivers what becomes its final hike of the cycle, taking the cash rate to 4.35%" },
  { date: '2023-01-01', text: 'ChatGPT-driven AI enthusiasm begins reshaping tech valuations through the year' },
  { date: '2023-05-24', text: "NVIDIA's blowout earnings guidance ignites the AI trade" },
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

// A handful of date-seeded "movers" for the replay day — same technique,
// just symbol-per-row instead of one index series.
const REPLAY_SYMBOLS = [
  ['BHP.AX', 'BHP Group'], ['CBA.AX', 'Commonwealth Bank'], ['CSL.AX', 'CSL Limited'],
  ['RIO.AX', 'Rio Tinto'], ['FMG.AX', 'Fortescue'], ['WES.AX', 'Wesfarmers'],
]
export function generateReplayMovers(dateStr) {
  return REPLAY_SYMBOLS.map(([symbol, name]) => {
    const rng = mulberry32(hashStr(`${symbol}_movers_${dateStr}`))
    const pct = (rng() - 0.5) * 6 + scenarioDrift(dateStr) * 100
    return { symbol, name, pct }
  })
}

// Date-only arithmetic done entirely in UTC — parsing "T00:00:00" (local)
// then round-tripping through toISOString() silently shifts the date by a
// day in any UTC+ timezone (e.g. AEST), since local midnight converts to
// the previous UTC day.
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
