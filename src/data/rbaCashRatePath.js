// The RBA cash rate target since 2008: the level in force on 1 Jan 2008,
// then every change, on its effective date, from the RBA's cash rate target
// table (rba.gov.au/statistics/cash-rate), read 3 Nov 2026. Changes only —
// a hold leaves the level where it was. Add a row when the target changes
// (the effective date is the day after the announcement).
//
// It exists so that "the highest since …" is worked out from the record,
// not typed in: at 4.85% the answer is 2008 (5.25% until the 3 Dec 2008
// cut), at 4.60% it is 2011 (4.75% until the 2 Nov 2011 cut).
export const RBA_TARGET_PATH = [
  ['2007-12-05', 6.75], // in force on 1 Jan 2008
  ['2008-02-06', 7.00], ['2008-03-05', 7.25], ['2008-09-03', 7.00], ['2008-10-08', 6.00],
  ['2008-11-05', 5.25], ['2008-12-03', 4.25], ['2009-02-04', 3.25], ['2009-04-08', 3.00],
  ['2009-10-07', 3.25], ['2009-11-04', 3.50], ['2009-12-02', 3.75], ['2010-03-03', 4.00],
  ['2010-04-07', 4.25], ['2010-05-05', 4.50], ['2010-11-03', 4.75], ['2011-11-02', 4.50],
  ['2011-12-07', 4.25], ['2012-05-02', 3.75], ['2012-06-06', 3.50], ['2012-10-03', 3.25],
  ['2012-12-05', 3.00], ['2013-05-08', 2.75], ['2013-08-07', 2.50], ['2015-02-04', 2.25],
  ['2015-05-06', 2.00], ['2016-05-04', 1.75], ['2016-08-03', 1.50], ['2019-06-05', 1.25],
  ['2019-07-03', 1.00], ['2019-10-02', 0.75], ['2020-03-04', 0.50], ['2020-03-20', 0.25],
  ['2020-11-04', 0.10], ['2022-05-04', 0.35], ['2022-06-08', 0.85], ['2022-07-06', 1.35],
  ['2022-08-03', 1.85], ['2022-09-07', 2.35], ['2022-10-05', 2.60], ['2022-11-02', 2.85],
  ['2022-12-07', 3.10], ['2023-02-08', 3.35], ['2023-03-08', 3.60], ['2023-05-03', 3.85],
  ['2023-06-07', 4.10], ['2023-11-08', 4.35], ['2025-02-19', 4.10], ['2025-05-21', 3.85],
  ['2025-08-13', 3.60], ['2026-02-04', 3.85], ['2026-03-18', 4.10], ['2026-05-06', 4.35],
  ['2026-09-30', 4.60],
  ['2026-11-04', 4.85], // 3 Nov hike, mr-26-30; effective the next day
].map(([effective, rate]) => ({ effective, rate }))

const dayBefore = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

// The year of the last day the target was above `rate`. Null when that was
// within the year before `asOf` (after a cut, "the highest since" would be
// true but empty), when the record never shows it higher, or when `rate` is
// below the level the record says is in force.
export function highestSinceYear(rate, { asOf, path = RBA_TARGET_PATH } = {}) {
  if (path.at(-1).rate > rate + 1e-9) return null // not the rate in force now
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i - 1].rate > rate + 1e-9 && path[i].rate <= rate + 1e-9) {
      const lastHigher = dayBefore(path[i].effective)
      if (asOf && daysBetween(lastHigher, asOf) < 365) return null
      return Number(lastHigher.slice(0, 4))
    }
  }
  return null
}

export const levelContextFor = (rate, opts) => {
  const year = highestSinceYear(rate, opts)
  return year ? `the highest since ${year}` : null
}
