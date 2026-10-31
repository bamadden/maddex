// Known changes with a date on them — things that WILL be true after a given
// moment and need a person to update the terminal when they happen.
//
// `npm run check-stats` reads this list and warns, by name, for each change
// whose effective moment has passed while its fields still hold the old
// value. It does not make the change: each one needs the new figure read
// from its source (the RBA statement, the Macquarie announcement), which is a
// person's job — see docs/RBA_DECISION_DAY.md for the RBA steps.
//
// effective: the moment the change takes effect, with its UTC offset.
// fields:    { path, expect } checked against the context check-stats builds:
//            the verified constants, plus graph.ceo.<TICKER> and
//            graph.chair.<TICKER> — the CEO and chair named in
//            src/data/graph/nodes.js — and keyFacts.<TICKER>.<field>.value
//            from src/data/graph/keyFacts.js. expect is one of
//            { gte: value } — the field is at least this (ISO dates compare);
//            { eq: value }  — the field equals this;
//            { ne: value }  — the field no longer equals this;
//            { hasDate: d } — a list of { date } contains this date.
//
// Dependency-free so the Node script can import it.

export const DATED_CHANGES = [
  {
    id: 'rba-2026-11-03',
    what: 'RBA decision, Tue 3 Nov 2026',
    effective: '2026-11-03T14:30:00+11:00',
    fields: [
      { path: 'rba.lastDecision', expect: { gte: '2026-11-03' } },
      { path: 'rba.nextMeeting', expect: { eq: '2026-12-08' } },
      { path: 'rba.decisions', expect: { hasDate: '2026-11-03' } },
      { path: 'rba.latestStatement.date', expect: { eq: '2026-11-03' } },
    ],
    source: 'rba.gov.au media releases',
    howTo: 'docs/RBA_DECISION_DAY.md',
  },
  {
    // Already past when added (31 Oct 2026): the successor needed election at
    // the 29 Oct AGM, and the result has not been read. Shows as overdue
    // until it is — see src/data/graph/TODO.md.
    id: 'wes-chair-2026-10-29',
    what: 'Wesfarmers chair: Ken MacKenzie succeeds Michael Chaney (subject to election at the 29 Oct 2026 AGM)',
    effective: '2026-10-29T13:00:00+08:00',
    fields: [
      { path: 'graph.chair.WES', expect: { eq: 'Ken MacKenzie' } },
    ],
    source: 'WES ASX release, 28 Aug 2025; AGM results release, 29 Oct 2026 (not yet read)',
    howTo: 'src/data/graph/nodes.js PEOPLE — add Ken MacKenzie as WES Chair once the AGM result is read',
  },
  {
    id: 'mqg-ceo-2026-11-07',
    what: 'Macquarie Group CEO: Greg Ward succeeds Shemara Wikramanayake',
    effective: '2026-11-07T00:00:00+11:00',
    fields: [
      { path: 'graph.ceo.MQG', expect: { eq: 'Greg Ward' } },
    ],
    source: 'Macquarie release, 23 Jul 2026 (subject to approvals — confirm they were received)',
    howTo: 'src/data/graph/nodes.js PEOPLE — replace the Shemara Wikramanayake row',
  },
  {
    id: 'rba-2026-12-08',
    what: 'RBA decision, Tue 8 Dec 2026',
    effective: '2026-12-08T14:30:00+11:00',
    fields: [
      { path: 'rba.lastDecision', expect: { gte: '2026-12-08' } },
      { path: 'rba.decisions', expect: { hasDate: '2026-12-08' } },
    ],
    source: 'rba.gov.au media releases',
    howTo: 'docs/RBA_DECISION_DAY.md',
  },
  {
    // 8–9 Dec meeting; the statement is at 2pm Washington on the 9th
    // (6am AEDT on the 10th).
    id: 'fed-2026-12-09',
    what: 'FOMC decision, 8–9 Dec 2026',
    effective: '2026-12-09T14:00:00-05:00',
    fields: [
      { path: 'fed.lastDecision', expect: { gte: '2026-12-09' } },
      { path: 'fed.nextMeeting', expect: { ne: '2026-12-09' } },
    ],
    source: 'federalreserve.gov',
  },
  {
    // Macquarie 2026 Annual Report (PDF p52): KPMG recommended as auditor
    // "for the financial year commencing on 1 April 2027", subject to
    // regulatory consents and shareholder approval.
    id: 'mqg-auditor-2027-04-01',
    what: 'Macquarie Group auditor: KPMG replaces PwC (subject to approval)',
    effective: '2027-04-01T00:00:00+11:00',
    fields: [
      { path: 'keyFacts.MQG.auditor.value', expect: { eq: 'KPMG' } },
    ],
    source: 'Macquarie Group 2026 Annual Report, PDF p52',
    howTo: 'src/data/graph/keyFacts.js — update once the appointment is confirmed (a report or notice of meeting)',
  },
  {
    // 17–18 Dec meeting; the decision comes around midday Tokyo on the 18th.
    id: 'boj-2026-12-18',
    what: 'Bank of Japan decision, 17–18 Dec 2026',
    effective: '2026-12-18T12:00:00+09:00',
    fields: [
      { path: 'boj.lastDecision', expect: { gte: '2026-12-18' } },
      { path: 'boj.nextMeeting', expect: { ne: '2026-12-18' } },
    ],
    source: 'boj.or.jp',
  },
]

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

// Whether one field holds its post-change value.
export function fieldUpdated(ctx, { path, expect }) {
  const v = get(ctx, path)
  if ('gte' in expect) return v != null && String(v) >= expect.gte
  if ('eq' in expect) return v === expect.eq
  if ('ne' in expect) return v !== expect.ne
  if ('hasDate' in expect) return Array.isArray(v) && v.some((x) => x?.date === expect.hasDate)
  return false
}

// Changes whose moment has passed with at least one field not yet updated.
export function overdueChanges(ctx, now = Date.now(), list = DATED_CHANGES) {
  return list
    .filter((c) => Date.parse(c.effective) <= now)
    .map((c) => ({ ...c, stale: c.fields.filter((f) => !fieldUpdated(ctx, f)) }))
    .filter((c) => c.stale.length > 0)
}

// The next changes still ahead, soonest first.
export const upcomingChanges = (now = Date.now(), list = DATED_CHANGES) =>
  list.filter((c) => Date.parse(c.effective) > now).sort((a, b) => Date.parse(a.effective) - Date.parse(b.effective))
