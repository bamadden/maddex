// Placeholder data — official statistics labeled with release dates
// Index values (SPX, NDX etc.) are point values — displayed as pts
// All AUS statistics: SOURCE ABS/RBA official releases
//
// SINGLE SOURCE OF TRUTH
// Every headline figure below is DERIVED from src/data/verifiedConstants.js
// rather than written out again here. Before this, the same numbers lived in
// both files and had already drifted apart: this file had the RBA last
// changing on 2026-05-06 with a HIKE, verifiedConstants had 2026-08-12 with a
// HOLD, and the Fed differed by seven months. Two copies of a fact is one
// copy plus one lie, and nothing on screen said which was which.
//
// The export names and row shapes are unchanged, so no call site had to move.
// What each row gains is `vkey` — the verifiedConstants group it came from —
// which is what lets the UI render a staleness badge next to the number.
//
// TO UPDATE A FIGURE: edit verifiedConstants.js. Not this file.

import { VERIFIED_CONSTANTS } from './verifiedConstants'
import { curveForRates } from './bondCurves'
import { RBA_DECISIONS } from './rbaDecisions'
import { RBA_TARGET_PATH } from './rbaCashRatePath'

const { rba, fed, au } = VERIFIED_CONSTANTS

const pct = (n) => `${Number(n).toFixed(1)}%`
const pct2 = (n) => `${Number(n).toFixed(2)}%`
const audM = (bn) => `${bn < 0 ? '-' : ''}A$${Math.abs(bn) < 1 ? `${Math.round(Math.abs(bn) * 1000)}M` : `${Math.abs(bn).toFixed(1)}B`}`

// The ASX 200 sector weights that stood here were typed without a date or
// source and nothing read them: removed 15 Nov 2026.

// AU / US yield curves — derived from bondCurves.js, the single source for
// yields (see BOND_CURVES_AS_OF there for the as-at dates).
const toBondRows = (key) => curveForRates(key).map(({ m, y }) => ({ maturity: m, yield: y }))
export const AU_BONDS = toBondRows('AU')
export const US_BONDS = toBondRows('US')

// Central bank policy rates, derived from VERIFIED_CONSTANTS.
//
// `direction` is the last decision that was actually taken. An undated,
// unsourced "expectation" per bank (fed: hike, boj: hike, ...) stood here and
// fed an EXPECTED column; it was a forecast with no source and was removed
// on 15 Nov 2026.

const CB_ORDER = [
  ['rba', 'Reserve Bank of Australia', 'AUD'],
  ['fed', 'Federal Reserve', 'USD'],
  ['ecb', 'ECB', 'EUR'],
  ['boe', 'Bank of England', 'GBP'],
  ['boj', 'Bank of Japan', 'JPY'],
  ['pboc', 'PBOC', 'CNY'],
  ['boc', 'Bank of Canada', 'CAD'],
  ['snb', 'Swiss National Bank', 'CHF'],
  ['riksbank', 'Riksbank', 'SEK'],
]

export const CENTRAL_BANK_RATES = CB_ORDER.map(([key, bank, country]) => {
  const c = VERIFIED_CONSTANTS[key]
  return {
    bank,
    country,
    rate: c.cashRate,
    direction: c.lastDecisionVerb.toLowerCase(),
    lastChange: c.lastDecision,
    nextMeeting: c.nextMeeting,
    src: c.source,
    ...(c.note ? { note: c.note } : {}),
    vkey: key,
  }
})

// ─── AU Macro ─────────────────────────────────────────────────────────────────
// Official ABS/RBA statistics — dates reflect the publication date of each figure
// Sources: abs.gov.au | rba.gov.au

// Each reading names its reference PERIOD (what it measures) and the date
// it was RELEASED, which are different things: September's CPI came out on
// 28 Oct, and these cards used to read "as at Oct 2026" for it (16 Nov 2026).
// `prev` is the previous reading as published, or null when none is held:
// the typed priors that stood here ('0.3%', '1.0%' for GDP) are gone, as are
// the "beat" arrows, which were hand-set with no consensus source. The
// CoreLogic, ASX P/E and dividend-yield rows (months old, no dated source)
// and the unused GLOBAL_MACRO table (typed priors, hand-set beats) were
// removed.
const gdpPrev = au.gdpHistory?.at(-2)?.value
export const AU_MACRO = [
  { name: 'RBA Cash Rate',       value: pct2(rba.cashRate),  prev: pct2(rba.previousRate), period: 'target in force', date: rba.lastDecision, src: rba.source, vkey: 'rba' },
  { name: 'AU CPI YoY',          value: pct(au.cpi),         prev: pct(au.cpiPrevious),   period: au.cpiPeriod, date: au.cpiLastRelease, src: 'abs.gov.au/6401.0', vkey: 'au' },
  { name: 'AU CPI Trimmed Mean', value: pct(au.cpiTrimmedMean), prev: pct(au.cpiTrimmedMeanPrevious), period: au.cpiPeriod, date: au.cpiLastRelease, src: 'abs.gov.au/6401.0', vkey: 'au' },
  { name: 'AU Unemployment',     value: pct(au.unemployment), prev: pct(au.unemploymentPrevious), period: au.unemploymentPeriod, date: au.unemploymentLastRelease, src: 'abs.gov.au/6202.0', vkey: 'au' },
  { name: 'AU GDP QoQ',          value: pct(au.gdpQoQ),      prev: gdpPrev != null ? pct(gdpPrev) : null, period: au.gdpPeriod, date: au.gdpLastRelease, src: 'abs.gov.au/5206.0', vkey: 'au' },
  { name: 'AU GDP Annual',       value: pct(au.gdpAnnual),   prev: null, period: au.gdpPeriod, date: au.gdpLastRelease, src: 'abs.gov.au/5206.0', vkey: 'au' },
  { name: 'AU Goods Trade Bal',  value: audM(au.tradeBalanceBn), prev: audM(au.tradeBalancePrevBn), period: au.tradeBalancePeriod, date: au.tradeBalanceRelease, src: 'abs.gov.au/statistics/economy/international-trade/international-trade-goods/latest-release', vkey: 'au' },
  { name: 'NAB Business Conf',   value: String(au.nabConfidence), prev: String(au.nabConfidencePrev), period: au.nabPeriod, date: au.nabRelease, src: 'nab.com.au', vkey: 'au' },
]


// ─── AU Historical Data (ABS official releases) ───────────────────────────────
// Note: the economic calendar previously hardcoded here has moved to
// src/services/calendarService.js, which auto-drops past events instead of
// needing this file hand-edited every session.

// The three chart series are the ABS-sourced histories in verifiedConstants,
// relabelled for the x-axis. They were hand-typed here until 2026-10-19 and
// had drifted from the ABS by up to 0.8pp; see the note on au.cpiHistory.
//
// '2026-08' → 'Aug-26'; '2025-Q1' → 'Mar-25' (the quarter's last month, so a
// quarterly point and the monthly series that follows it share one axis).
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function chartLabel(period) {
  const q = period.match(/^(\d{4})-Q(\d)$/)
  if (q) return `${MON[q[2] * 3 - 1]}-${q[1].slice(2)}`
  const m = period.match(/^(\d{4})-(\d{2})$/)
  return m ? `${MON[m[2] - 1]}-${m[1].slice(2)}` : period
}
// `t` is a month index (year × 12 + month), so the charts can use a true
// time axis: eight quarterly points then monthly ones would otherwise be
// spaced evenly, squeezing two years of quarters into the width of eight
// months.
export function periodMonth(period) {
  const q = period.match(/^(\d{4})-Q(\d)$/)
  if (q) return +q[1] * 12 + q[2] * 3 - 1
  const m = period.match(/^(\d{4})-(\d{2})$/)
  return m ? +m[1] * 12 + (m[2] - 1) : null
}
export const monthLabel = (t) => `${MON[t % 12]}-${String(Math.floor(t / 12)).slice(2)}`
const toChart = (rows) => rows.map((r) => ({ ...r, date: chartLabel(r.period), t: periodMonth(r.period) }))

// AU CPI, annual % — quarterly to Mar 2025, monthly from Apr 2025 (`type`).
export const AU_CPI_HISTORY = toChart(au.cpiHistory)

// AU unemployment rate, seasonally adjusted, monthly.
export const AU_UNEMP_HISTORY = toChart(au.unemploymentHistory)

// AU real GDP, % change on the previous quarter. Labelled Q2-26 style, which
// is how quarterly national accounts are read.
export const AU_GDP_HISTORY = au.gdpHistory.map((r) => ({ ...r, date: `Q${r.period.slice(6)}-${r.period.slice(2, 4)}`, t: periodMonth(r.period) }))

export const BREAKING_NEWS_THRESHOLD_MINUTES = 30

// ─── Portfolio ────────────────────────────────────────────────────────────────
// Holdings are stored in localStorage under 'madden_portfolio_v2' — no demo data
export const DEMO_PORTFOLIO_HOLDINGS = []

export const WATCHLIST_DEFAULT_SYMBOLS = ['BHP.AX', 'CBA.AX', 'CSL.AX', 'WOW.AX', 'AAPL', 'NVDA', 'BTC-USD']

// ─── RBA Rate History (May 2022 onwards) ────────────────────────────────────
// One point per Board decision on its EFFECTIVE date (the day after the
// announcement, as the RBA's cash rate target table records it). Render as a
// step chart: rates do not interpolate between decisions.
//
// Built from the RBA's own record, never typed here (16 Nov 2026): the
// 2022–23 changes from data/rbaCashRatePath (the cash rate target table),
// and every decision from Nov 2023 on, holds included, from
// data/rbaDecisions (statement and table). A typed copy here used to skip
// eleven holds between Dec 2023 and Dec 2025, so the Rates timeline showed
// Aug 2025 to Feb 2026 as consecutive meetings.
const RBA_RECORD_FROM = RBA_DECISIONS.at(-1).effective
export const RBA_RATE_HISTORY = [
  ...RBA_TARGET_PATH
    .filter((p) => p.effective >= '2022-05-04' && p.effective < RBA_RECORD_FROM)
    .map((p) => ({ date: p.effective, rate: p.rate })),
  ...[...RBA_DECISIONS].reverse().map((d) => ({
    date: d.effective, rate: d.rate, announced: d.announced, change: d.changeBp,
    decision: d.changeBp > 0 ? 'HIKE' : d.changeBp < 0 ? 'CUT' : 'HOLD',
  })),
]

const dayAfter = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// FED_RATE_HISTORY — the Fed's path on EFFECTIVE dates (the day after each
// announcement), the same convention as RBA_RATE_HISTORY so the two can be
// compared day by day. `rate` is the top of the target range. Derived from
// VERIFIED_CONSTANTS.fed.decisions; holds are kept as points.
export const FED_RATE_HISTORY = fed.decisions.map((d) => ({
  date: dayAfter(d.date), rate: d.rate, decision: d.decision, change: d.change, announced: d.date,
}))

// Board composition — names, roles and appointment years, which are public
// record on rba.gov.au.
//
// THE `votes` FIELD IS GONE, DELIBERATELY.
//
// Each member used to carry a policy leaning: 'Hold', 'Cautious cut',
// 'Hold / Cut', 'Data dependent'. Those were invented, and they were attached
// to nine named, identifiable people and rendered in a column headed with
// their roles — so the UI read as a published voting record.
//
// The RBA does not publish one. Decisions are announced as the Board's, and
// the unattributed vote count introduced in 2024 is a count, not a roll call.
// There is no source that could make this column true, which is why it was
// removed rather than sourced or labelled.
//
// Read from rba.gov.au/about-rba/boards/monetary-policy-board.html on
// RBA_BOARD_READ. The list held before was the pre-2025 Reserve Bank Board
// (five of its nine names are not on the Monetary Policy Board) with typed
// "since" years; names and roles only now, as the page gives them.
export const RBA_BOARD_READ = '2026-11-16'
export const RBA_BOARD_SOURCE = 'https://www.rba.gov.au/about-rba/boards/monetary-policy-board.html'
export const RBA_BOARD_MEMBERS = [
  { name: 'Michele Bullock',     role: 'Chair, RBA Governor' },
  { name: 'Andrew Hauser',       role: 'Deputy Chair, RBA Deputy Governor' },
  { name: 'Jenny Wilkinson',     role: 'Ex officio, Secretary to the Treasury' },
  { name: 'Marnie Baker',        role: 'Non-executive member' },
  { name: 'Melinda Cilento',     role: 'Non-executive member' },
  { name: 'Renée Fry-McKibbin',  role: 'Non-executive member' },
  { name: 'Carolyn Hewson',      role: 'Non-executive member' },
  { name: 'Bruce Preston',       role: 'Non-executive member' },
  { name: 'Iain Ross',           role: 'Non-executive member' },
]

// Trimmed to the last 3 (most recent first) — deliberately, so this column
// naturally matches the height of the chart + next-meeting-pricing column
// next to it instead of running much longer.
export const RBA_RECENT_STATEMENTS = [
  {
    date: '3 Nov 2026',
    decision: 'HIKE +25bp to 4.85% (6–3)',
    key: '"Given the revised inflation outlook and the continuing upside risks, the Board judged that a further tightening in financial conditions is warranted."',
  },
  {
    date: '13 Oct 2026',
    decision: 'MINUTES of 29 Sep',
    key: 'Board briefly weighed a pause; inflation risks made the case to act promptly. Open to further hikes "if required".',
  },
  {
    date: '29 Sep 2026',
    decision: 'HIKE +25bp to 4.60%',
    key: '"Inflation remains elevated and some of the upside risks flagged in August are materialising."',
  },
]

// Consumer sentiment, business confidence and the goods trade balance below
// were read from Westpac, NAB and the ABS on this date.
export const MACRO_SERIES_AS_OF = '2026-11-15'

// ─── Leading Indicators ───────────────────────────────────────────────────────

// Westpac–Melbourne Institute Consumer Sentiment Index, Jan–Nov 2026, each
// month read 15 Nov 2026 from westpaciq.com.au. Below 100 = more pessimists
// than optimists. The 2024–25 points and the 2026 values typed before (Jan
// held as 83.5; Westpac published 92.9) were removed.
export const AU_CONSUMER_SENTIMENT = [
  { date: 'Jan-26', value: 92.9 }, { date: 'Feb-26', value: 90.5 },
  { date: 'Mar-26', value: 91.6 }, { date: 'Apr-26', value: 80.1 },
  { date: 'May-26', value: 83.0 }, { date: 'Jun-26', value: 80.6 },
  { date: 'Jul-26', value: 83.9 }, { date: 'Aug-26', value: 88.9 },
  { date: 'Sep-26', value: 84.4 }, { date: 'Oct-26', value: 80.4 },
  { date: 'Nov-26', value: 78.2 },
]

// NAB Monthly Business Survey, business confidence (net balance), Jan–Oct
// 2026, each month read 15 Nov 2026 from nab.com.au; September as revised in
// the October release. The typed values held before were wrong (March held
// as +4; NAB published -29) and the 2024–25 points were removed.
export const AU_BUSINESS_CONFIDENCE = [
  { date: 'Jan-26', value: 3 }, { date: 'Feb-26', value: -1 },
  { date: 'Mar-26', value: -29 }, { date: 'Apr-26', value: -24 },
  { date: 'May-26', value: -14 }, { date: 'Jun-26', value: -5 },
  { date: 'Jul-26', value: -6 }, { date: 'Aug-26', value: -8 },
  { date: 'Sep-26', value: -14 }, { date: 'Oct-26', value: -15 },
]

// ABS balance on goods, seasonally adjusted (Jan 2024 – Sep 2026, A$ billions)
// Positive = surplus · SOURCE: ABS Data API, ITGS 1.2.0 M1.170.20.AUS.M, fetched
// 2026-11-15 (August as revised). Replaced a goods-and-services series that did not match the
// ABS (it showed a A$6.9B surplus for Mar 2026, a month the goods balance
// was a A$2.1B deficit). The monthly release is goods only now.
export const AU_TRADE_BALANCE = [
  { date: 'Jan-24', value: 9.5 }, { date: 'Feb-24', value: 8.319 },
  { date: 'Mar-24', value: 4.486 }, { date: 'Apr-24', value: 6.157 },
  { date: 'May-24', value: 5.434 }, { date: 'Jun-24', value: 5.542 },
  { date: 'Jul-24', value: 5.413 }, { date: 'Aug-24', value: 5.874 },
  { date: 'Sep-24', value: 3.533 }, { date: 'Oct-24', value: 4.651 },
  { date: 'Nov-24', value: 6.001 }, { date: 'Dec-24', value: 3.986 },
  { date: 'Jan-25', value: 4.352 }, { date: 'Feb-25', value: 3.321 },
  { date: 'Mar-25', value: 7.091 }, { date: 'Apr-25', value: 4.446 },
  { date: 'May-25', value: 2.296 }, { date: 'Jun-25', value: 4.667 },
  { date: 'Jul-25', value: 6.383 }, { date: 'Aug-25', value: 0.903 },
  { date: 'Sep-25', value: 3.047 }, { date: 'Oct-25', value: 4.179 },
  { date: 'Nov-25', value: 2.217 }, { date: 'Dec-25', value: 3.158 },
  { date: 'Jan-26', value: 2.627 }, { date: 'Feb-26', value: 5.179 },
  { date: 'Mar-26', value: -2.088 }, { date: 'Apr-26', value: 1.507 },
  { date: 'May-26', value: -2.604 }, { date: 'Jun-26', value: 2.314 },
  { date: 'Jul-26', value: 1.515 }, { date: 'Aug-26', value: 0.184 },
  { date: 'Sep-26', value: 2.826 },
]

// The iron ore series (labelled SGX / Platts, licensed data, typed and
// undated) and the China Watch panel (typed figures contradicting the NBS)
// that stood here were removed on 15 Nov 2026.

