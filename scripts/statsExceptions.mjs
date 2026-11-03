// Known, dated gaps between our figures and an agency's, each excused only
// for an exact figure, exact values and until a hard expiry (Sydney date).
// From the expiry the drift is a failure again. Never widen one: add a new
// entry with its own reason, and delete it once the agency has caught up
// (the check says when it is no longer needed).
export const STATS_EXCEPTIONS = [
  {
    label: 'RBA cash rate', ours: 4.85, official: 4.6, until: '2026-11-05',
    reason: 'RBA hiked to 4.85% on 3 Nov 2026 (mr-26-30), effective 4 Nov; Table A2 had not yet recorded it',
  },
  {
    label: 'RBA decisions', period: '2026-11-03', until: '2026-11-05',
    reason: 'the 3 Nov 2026 hike (mr-26-30) is not yet a row in Table A2, which records it on its effective date',
  },
]

const sydneyToday = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
const live = (e, now) => sydneyToday(now) < e.until

// A headline row's drift is excused when an unexpired entry names its label
// and both values exactly.
export function excuseRow(row, { now = Date.now(), exceptions = STATS_EXCEPTIONS } = {}) {
  if (row.status !== 'drift') return null
  return exceptions.find((e) => e.label === row.label && e.ours === Number(row.constant) && e.official === Number(row.official) && live(e, now)) ?? null
}

// A history series' misses, split into excused and still-failing.
export function excuseMisses(label, misses, { now = Date.now(), exceptions = STATS_EXCEPTIONS } = {}) {
  const excused = [], failing = []
  for (const m of misses) {
    const e = exceptions.find((x) => x.label === label && x.period === m.period && live(x, now))
    ;(e ? excused : failing).push(e ? { ...m, reason: e.reason, until: e.until } : m)
  }
  return { excused, failing }
}

// Entries past their expiry, or no longer needed because nothing drifts.
export function staleExceptions({ rows, hist, now = Date.now(), exceptions = STATS_EXCEPTIONS }) {
  return exceptions.filter((e) => {
    if (!live(e, now)) return true
    if (e.period) return !hist.some((h) => h.label === e.label && h.misses?.some((m) => m.period === e.period))
    return !rows.some((r) => r.label === e.label && r.status === 'drift')
  })
}
