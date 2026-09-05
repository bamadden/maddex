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

const { rba, fed, au, us, cn, eu, uk } = VERIFIED_CONSTANTS

const pct = (n) => `${n}%`

// ASX 200 Sector Heatmap — mktCapWeight is % of ASX 200
export const ASX_SECTOR_HEATMAP = [
  { name: 'Financials',       ticker: 'XFJ', pct: null, mktCapWeight: 30.1 },
  { name: 'Materials',        ticker: 'XMJ', pct: null, mktCapWeight: 22.5 },
  { name: 'Healthcare',       ticker: 'XHJ', pct: null, mktCapWeight: 10.2 },
  { name: 'Industrials',      ticker: 'XIJ', pct: null, mktCapWeight:  7.3 },
  { name: 'Consumer Staples', ticker: 'XSJ', pct: null, mktCapWeight:  6.8 },
  { name: 'Information Tech', ticker: 'XIT', pct: null, mktCapWeight:  5.5 },
  { name: 'Energy',           ticker: 'XEJ', pct: null, mktCapWeight:  4.8 },
  { name: 'Consumer Disc',    ticker: 'XDJ', pct: null, mktCapWeight:  4.2 },
  { name: 'Real Estate',      ticker: 'XPJ', pct: null, mktCapWeight:  3.8 },
  { name: 'Utilities',        ticker: 'XUJ', pct: null, mktCapWeight:  2.4 },
  { name: 'Comm Services',    ticker: 'XTJ', pct: null, mktCapWeight:  2.4 },
]

// AU Government Bond Yield Curve — RBA/AOFM published rates — as at 2 Aug 2026
export const AU_BONDS = [
  { maturity: '3M',  yield: 3.88 },
  { maturity: '6M',  yield: 3.80 },
  { maturity: '1Y',  yield: 3.72 },
  { maturity: '2Y',  yield: 3.65 },
  { maturity: '3Y',  yield: 3.75 },
  { maturity: '5Y',  yield: 3.90 },
  { maturity: '10Y', yield: 4.20 },
  { maturity: '30Y', yield: 4.55 },
]

// US Treasury Yield Curve — as at 2 Aug 2026
export const US_BONDS = [
  { maturity: '3M',  yield: 4.30 },
  { maturity: '6M',  yield: 4.22 },
  { maturity: '1Y',  yield: 4.15 },
  { maturity: '2Y',  yield: 4.10 },
  { maturity: '3Y',  yield: 4.15 },
  { maturity: '5Y',  yield: 4.25 },
  { maturity: '10Y', yield: 4.45 },
  { maturity: '30Y', yield: 4.85 },
]

// Central bank policy rates, derived from VERIFIED_CONSTANTS.
//
// `direction` is the last decision that was actually taken; `expectation` is
// the market-implied stance into the NEXT meeting. They are different things
// and are deliberately kept apart — a bank that just held can still be
// expected to cut. `expectation` is a judgement rather than a published
// statistic, so it stays here rather than in verifiedConstants.
const CB_EXPECTATION = {
  rba: 'hold', fed: 'cut', ecb: 'hold', boe: 'hold', boj: 'hike',
  pboc: 'hold', rbnz: 'hold', boc: 'hold', snb: 'hold', riksbank: 'hold',
}

const CB_ORDER = [
  ['rba', 'Reserve Bank of Australia', 'AUD'],
  ['fed', 'Federal Reserve', 'USD'],
  ['ecb', 'ECB', 'EUR'],
  ['boe', 'Bank of England', 'GBP'],
  ['boj', 'Bank of Japan', 'JPY'],
  ['pboc', 'PBOC', 'CNY'],
  ['rbnz', 'RBNZ', 'NZD'],
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
    expectation: CB_EXPECTATION[key],
    vkey: key,
  }
})

// ─── AU Macro ─────────────────────────────────────────────────────────────────
// Official ABS/RBA statistics — dates reflect the publication date of each figure
// Sources: abs.gov.au | rba.gov.au

// `prev` and `beat` describe the move from the previous print, not the print
// itself, so they stay literal here — they are context about a transition
// rather than a current figure that can go stale-wrong.
export const AU_MACRO = [
  { name: 'RBA Cash Rate',       value: pct(rba.cashRate),   prev: pct(rba.previousRate), date: rba.lastDecision,      beat: null,  src: rba.source,           vkey: 'rba' },
  { name: 'AU CPI YoY',          value: pct(au.cpi),         prev: pct(au.cpiPrevious),   date: au.cpiLastRelease,     beat: false, src: 'abs.gov.au/6401.0',  vkey: 'au' },
  { name: 'AU CPI Trimmed Mean', value: pct(au.cpiTrimmedMean), prev: '2.9%',             date: '2026-04-29',          beat: true,  src: 'abs.gov.au/6401.0',  vkey: 'au' },
  { name: 'AU Unemployment',     value: pct(au.unemployment), prev: '4.1%',               date: au.unemploymentLastRelease, beat: null, src: 'abs.gov.au/6202.0', vkey: 'au' },
  { name: 'AU GDP QoQ',          value: pct(au.gdpQoQ),      prev: '0.3%',                date: au.gdpLastRelease,     beat: true,  src: 'abs.gov.au/5206.0',  vkey: 'au' },
  { name: 'AU GDP Annual',       value: pct(au.gdpAnnual),   prev: '1.0%',                date: au.gdpLastRelease,     beat: true,  src: 'abs.gov.au/5206.0',  vkey: 'au' },
  { name: 'AU Trade Balance',    value: `A$${au.tradeBalanceBn}B`, prev: 'A$6.1B',        date: au.tradeBalanceRelease, beat: true, src: 'abs.gov.au/5368.0',  vkey: 'au' },
  { name: 'AU Retail Sales MoM', value: pct(au.retailSalesMoM), prev: '0.5%',             date: au.retailSalesRelease, beat: false, src: 'abs.gov.au/8501.0',  vkey: 'au' },
  { name: 'CoreLogic HPI MoM',   value: `+${au.corelogicHpiMoM}%`, prev: '+0.4%',         date: au.corelogicRelease,   beat: null,  src: 'corelogic.com.au',   vkey: 'au' },
  { name: 'ASX200 P/E',          value: String(au.asx200PE), prev: '18.8',                date: au.asxMetricsRelease,  beat: null,  src: 'asx.com.au',         vkey: 'au' },
  { name: 'ASX200 Div Yield',    value: pct(au.asx200DivYield), prev: '3.9%',             date: au.asxMetricsRelease,  beat: null,  src: 'asx.com.au',         vkey: 'au' },
]

// GLOBAL_MACRO — official statistical agency releases, derived as above.
export const GLOBAL_MACRO = [
  { name: 'US CPI YoY',      value: pct(us.cpi),               prev: '2.5%',  date: us.cpiRelease,          beat: true,  region: 'US', src: 'bls.gov',             vkey: 'us' },
  { name: 'US GDP QoQ Ann',  value: pct(us.gdpQoQAnnualised),  prev: '2.4%',  date: us.gdpRelease,          beat: false, region: 'US', src: 'bea.gov',             vkey: 'us' },
  { name: 'US Unemployment', value: pct(us.unemployment),      prev: '4.1%',  date: us.unemploymentRelease, beat: null,  region: 'US', src: 'bls.gov',             vkey: 'us' },
  { name: 'US NFP',          value: `${us.nfpThousands}K`,     prev: '185K',  date: us.nfpRelease,          beat: false, region: 'US', src: 'bls.gov',             vkey: 'us' },
  { name: 'US Fed Funds',    value: fed.rateRange,             prev: fed.rateRange, date: us.fedFundsRelease, beat: null, region: 'US', src: fed.source,           vkey: 'fed' },
  { name: 'CN CPI YoY',      value: pct(cn.cpi),               prev: '-0.1%', date: cn.cpiRelease,          beat: true,  region: 'CN', src: 'stats.gov.cn',        vkey: 'cn' },
  { name: 'CN GDP QoQ',      value: pct(cn.gdpQoQ),            prev: '1.2%',  date: cn.gdpRelease,          beat: true,  region: 'CN', src: 'stats.gov.cn',        vkey: 'cn' },
  { name: 'CN PMI Mfg',      value: String(cn.pmiManufacturing), prev: '50.4', date: cn.pmiRelease,         beat: false, region: 'CN', src: 'stats.gov.cn',        vkey: 'cn' },
  { name: 'EZ CPI YoY',      value: pct(eu.cpi),               prev: '2.2%',  date: eu.cpiRelease,          beat: true,  region: 'EU', src: 'ec.europa.eu',        vkey: 'eu' },
  { name: 'UK CPI YoY',      value: pct(uk.cpi),               prev: '3.0%',  date: uk.cpiRelease,          beat: true,  region: 'UK', src: 'ons.gov.uk',          vkey: 'uk' },
  { name: 'UK GDP QoQ',      value: pct(uk.gdpQoQ),            prev: '0.3%',  date: uk.gdpRelease,          beat: true,  region: 'UK', src: 'ons.gov.uk',          vkey: 'uk' },
]

export const MACRO_INDICATORS = GLOBAL_MACRO

// ─── AU Historical Data (ABS official releases) ───────────────────────────────
// Note: the economic calendar previously hardcoded here has moved to
// src/services/calendarService.js, which auto-drops past events instead of
// needing this file hand-edited every session.

// AU CPI History — ABS Quarterly CPI / Monthly Indicator (YoY %) — SOURCE: abs.gov.au/6401.0
export const AU_CPI_HISTORY = [
  { date: 'Jun-23', value: 5.4 },
  { date: 'Sep-23', value: 5.4 },
  { date: 'Dec-23', value: 4.1 },
  { date: 'Mar-24', value: 3.6 },
  { date: 'Jun-24', value: 3.8 },
  { date: 'Sep-24', value: 2.8 },
  { date: 'Dec-24', value: 2.4 },
  { date: 'Mar-25', value: 2.4 },
  { date: 'Jun-25', value: 2.7 },
  { date: 'Sep-25', value: 2.5 },
  { date: 'Dec-25', value: 2.3 },
  { date: 'Mar-26', value: 2.4 },
]

// AU Unemployment History — ABS Labour Force Survey (%) — SOURCE: abs.gov.au/6202.0
export const AU_UNEMP_HISTORY = [
  { date: 'Jun-23', value: 3.5 },
  { date: 'Sep-23', value: 3.6 },
  { date: 'Dec-23', value: 3.8 },
  { date: 'Mar-24', value: 3.8 },
  { date: 'Jun-24', value: 4.1 },
  { date: 'Sep-24', value: 4.1 },
  { date: 'Dec-24', value: 4.0 },
  { date: 'Mar-25', value: 4.1 },
  { date: 'Jun-25', value: 4.1 },
  { date: 'Sep-25', value: 4.0 },
  { date: 'Dec-25', value: 4.0 },
  { date: 'Mar-26', value: 4.1 },
]

// AU GDP History — ABS National Accounts (QoQ %) — SOURCE: abs.gov.au/5206.0
// Annual Q4 2025: 1.3% (sum of 4 quarters ≈ 1.3%)
export const AU_GDP_HISTORY = [
  { date: 'Q1-23', value: 0.4 },
  { date: 'Q2-23', value: 0.4 },
  { date: 'Q3-23', value: 0.2 },
  { date: 'Q4-23', value: 0.1 },
  { date: 'Q1-24', value: 0.1 },
  { date: 'Q2-24', value: 0.2 },
  { date: 'Q3-24', value: 0.3 },
  { date: 'Q4-24', value: 0.3 },
  { date: 'Q1-25', value: 0.3 },
  { date: 'Q2-25', value: 0.3 },
  { date: 'Q3-25', value: 0.3 },
  { date: 'Q4-25', value: 0.4 },
]

export const BREAKING_NEWS_THRESHOLD_MINUTES = 30

// ─── Portfolio ────────────────────────────────────────────────────────────────
// Holdings are stored in localStorage under 'madden_portfolio_v2' — no demo data
export const DEMO_PORTFOLIO_HOLDINGS = []

export const WATCHLIST_DEFAULT_SYMBOLS = ['BHP.AX', 'CBA.AX', 'CSL.AX', 'WOW.AX', 'AAPL', 'NVDA', 'BTC-USD']

// ─── RBA Rate History (Jan 2022 – Aug 2026) ─────────────────────────────────
// SOURCE: rba.gov.au board decisions. One entry per decision date (not one
// per month) — dates are exact board-meeting dates, values only change when
// the Board actually moved; render as a step chart (rates don't interpolate
// between decisions).
//
// 2025 saw an easing cycle (Feb/May/Aug, -0.25 each, 4.35% → 3.60%). 2026
// reversed that with three hikes (Feb/Mar/May, +0.25 each, 3.60% → 4.35%) in
// response to the global energy shock from the Iran-Middle East conflict.
// The Jun 2026 meeting held at 4.35%, and the Board held again at the Aug 12
// 2026 meeting following a softer CPI print of 3.8%. Next decision 16 Sep 2026.
export const RBA_RATE_HISTORY = [
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
  { date: '2026-02-04', rate: 3.85 },
  { date: '2026-03-18', rate: 4.10 },
  { date: '2026-05-06', rate: 4.35 },
  { date: '2026-06-17', rate: 4.35 },
  { date: '2026-08-12', rate: 4.35 },
]

export const RBA_BOARD_MEMBERS = [
  { name: 'Michele Bullock',    role: 'Governor (Chair)',           since: '2023', votes: 'Hold / Cut' },
  { name: 'Andrew Hauser',      role: 'Deputy Governor',            since: '2024', votes: 'Hold / Cut' },
  { name: 'Jenny Wilkinson',    role: 'Treasury Representative',    since: '2023', votes: 'Reflects Treasury' },
  { name: 'Carol Schwartz',     role: 'External Member',            since: '2018', votes: 'Hold' },
  { name: 'Ian Harper',         role: 'External Member',            since: '2016', votes: 'Hold' },
  { name: 'Mark Barnaba',       role: 'External Member',            since: '2018', votes: 'Hold' },
  { name: 'Elana Rubin',        role: 'External Member',            since: '2016', votes: 'Hold' },
  { name: 'Iain Ross',          role: 'External Member',            since: '2016', votes: 'Cautious cut' },
  { name: 'Renée Roberts',      role: 'External Member',            since: '2023', votes: 'Data dependent' },
]

// Trimmed to the last 3 (most recent first) — deliberately, so this column
// naturally matches the height of the chart + next-meeting-pricing column
// next to it instead of running much longer.
export const RBA_RECENT_STATEMENTS = [
  {
    date: '12 Aug 2026',
    decision: 'HOLD at 4.35%',
    key: '"Held, citing softer June CPI of 3.8% and Middle East uncertainty."',
  },
  {
    date: '17 Jun 2026',
    decision: 'HOLD at 4.35%',
    key: '"Held after three straight hikes — monitoring inflation and labour market conditions."',
  },
  {
    date: '06 May 2026',
    decision: 'HIKE +25bp to 4.35%',
    key: '"Raised rates on persistent inflation from the energy shock — third straight 2026 hike."',
  },
]

// ─── Leading Indicators ───────────────────────────────────────────────────────

// Westpac-Melbourne Institute Consumer Sentiment (Jan 2024 – Jun 2026)
// Below 100 = pessimistic · SOURCE: Westpac-Melbourne Institute, released monthly
export const AU_CONSUMER_SENTIMENT = [
  { date: 'Jan-24', value: 81.0 }, { date: 'Feb-24', value: 86.0 },
  { date: 'Mar-24', value: 82.4 }, { date: 'Apr-24', value: 82.4 },
  { date: 'May-24', value: 83.0 }, { date: 'Jun-24', value: 82.4 },
  { date: 'Jul-24', value: 85.3 }, { date: 'Aug-24', value: 84.6 },
  { date: 'Sep-24', value: 87.5 }, { date: 'Oct-24', value: 86.7 },
  { date: 'Nov-24', value: 87.9 }, { date: 'Dec-24', value: 89.8 },
  { date: 'Jan-25', value: 92.1 }, { date: 'Feb-25', value: 95.1 },
  { date: 'Mar-25', value: 95.9 }, { date: 'Apr-25', value: 94.0 },
  { date: 'May-25', value: 90.0 }, { date: 'Jun-25', value: 88.5 },
  { date: 'Jul-25', value: 89.8 }, { date: 'Aug-25', value: 87.9 },
  { date: 'Sep-25', value: 85.6 }, { date: 'Oct-25', value: 84.0 },
  { date: 'Nov-25', value: 84.9 }, { date: 'Dec-25', value: 85.0 },
  { date: 'Jan-26', value: 83.5 }, { date: 'Feb-26', value: 84.0 },
  { date: 'Mar-26', value: 82.5 }, { date: 'Apr-26', value: 82.0 },
  { date: 'May-26', value: 82.0 }, { date: 'Jun-26', value: 82.4 },
]

// NAB Monthly Business Confidence Survey (Jan 2024 – Jun 2026)
// Positive = above average confidence · SOURCE: NAB Business Survey, released monthly
export const AU_BUSINESS_CONFIDENCE = [
  { date: 'Jan-24', value: 2  }, { date: 'Feb-24', value: 5  },
  { date: 'Mar-24', value: 0  }, { date: 'Apr-24', value: -2 },
  { date: 'May-24', value: 1  }, { date: 'Jun-24', value: 3  },
  { date: 'Jul-24', value: 4  }, { date: 'Aug-24', value: -1 },
  { date: 'Sep-24', value: 3  }, { date: 'Oct-24', value: 5  },
  { date: 'Nov-24', value: 7  }, { date: 'Dec-24', value: 5  },
  { date: 'Jan-25', value: 8  }, { date: 'Feb-25', value: 6  },
  { date: 'Mar-25', value: 4  }, { date: 'Apr-25', value: 2  },
  { date: 'May-25', value: -1 }, { date: 'Jun-25', value: 1  },
  { date: 'Jul-25', value: 3  }, { date: 'Aug-25', value: 4  },
  { date: 'Sep-25', value: 5  }, { date: 'Oct-25', value: 3  },
  { date: 'Nov-25', value: 4  }, { date: 'Dec-25', value: 4  },
  { date: 'Jan-26', value: 3  }, { date: 'Feb-26', value: 5  },
  { date: 'Mar-26', value: 4  }, { date: 'Apr-26', value: 2  },
  { date: 'May-26', value: 4  },
]

// ABS International Trade Balance (Jan 2024 – May 2026, AUD billions)
// Positive = surplus · SOURCE: ABS Cat. 5368.0, released monthly
export const AU_TRADE_BALANCE = [
  { date: 'Jan-24', value: 10.9 }, { date: 'Feb-24', value: 8.1  },
  { date: 'Mar-24', value: 5.0  }, { date: 'Apr-24', value: 6.5  },
  { date: 'May-24', value: 7.7  }, { date: 'Jun-24', value: 5.1  },
  { date: 'Jul-24', value: 6.0  }, { date: 'Aug-24', value: 5.6  },
  { date: 'Sep-24', value: 4.6  }, { date: 'Oct-24', value: 5.2  },
  { date: 'Nov-24', value: 5.5  }, { date: 'Dec-24', value: 5.0  },
  { date: 'Jan-25', value: 5.6  }, { date: 'Feb-25', value: 2.9  },
  { date: 'Mar-25', value: 6.9  }, { date: 'Apr-25', value: 6.3  },
  { date: 'May-25', value: 6.0  }, { date: 'Jun-25', value: 6.5  },
  { date: 'Jul-25', value: 7.0  }, { date: 'Aug-25', value: 6.8  },
  { date: 'Sep-25', value: 7.1  }, { date: 'Oct-25', value: 7.2  },
  { date: 'Nov-25', value: 6.9  }, { date: 'Dec-25', value: 7.0  },
  { date: 'Jan-26', value: 6.5  }, { date: 'Feb-26', value: 6.8  },
  { date: 'Mar-26', value: 6.9  },
]

// Iron Ore Spot Price (USD/tonne) — last 12 months
// SOURCE: Singapore Exchange (SGX) / S&P Global Platts
export const IRON_ORE_HISTORY = [
  { date: 'Jun-25', value: 102 }, { date: 'Jul-25', value: 98  },
  { date: 'Aug-25', value: 96  }, { date: 'Sep-25', value: 100 },
  { date: 'Oct-25', value: 105 }, { date: 'Nov-25', value: 103 },
  { date: 'Dec-25', value: 100 }, { date: 'Jan-26', value: 98  },
  { date: 'Feb-26', value: 97  }, { date: 'Mar-26', value: 100 },
  { date: 'Apr-26', value: 99  }, { date: 'May-26', value: 98  },
]

// ─── China Watch ─────────────────────────────────────────────────────────────
// Key Chinese economic indicators with 12-month sparkline data
// SOURCE: NBS China (stats.gov.cn), General Administration of Customs, CISA
export const CHINA_WATCH = [
  {
    name: 'China GDP (Ann)', value: '4.8%', trend: 'up', mom: '+0.3pp',
    source: 'NBS China', date: 'Q1 2026',
    why: 'Drives iron ore & LNG demand — key for BHP, FMG, WDS',
    history: [4.5,4.6,4.9,5.2,4.7,4.6,4.6,4.9,5.2,5.0,4.8,4.8].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'China CPI YoY', value: '0.1%', trend: 'up', mom: '+0.2pp',
    source: 'NBS China', date: 'Apr 2026',
    why: 'Low inflation signals weak domestic demand — impacts AUD outlook',
    history: [-0.8,-0.7,-0.3,0.1,-0.1,0.6,0.4,0.3,0.2,0.1,-0.1,0.1].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'PMI Manufacturing', value: '50.4', trend: 'up', mom: '+0.1',
    source: 'NBS China', date: 'May 2026',
    why: 'Above 50 = expansion in factory activity; key for commodity prices',
    history: [49.1,49.5,50.8,51.4,50.5,49.9,50.1,50.4,50.6,50.3,50.4,50.4].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'PMI Services', value: '53.2', trend: 'up', mom: '+0.4',
    source: 'NBS China', date: 'May 2026',
    why: 'Services expansion supports consumer recovery; less direct AU impact',
    history: [52.9,54.2,53.0,51.5,52.1,53.0,52.0,52.3,54.5,53.4,52.8,53.2].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'Iron Ore Imports', value: '102Mt', trend: 'down', mom: '-3Mt',
    source: 'GAC China', date: 'Apr 2026',
    why: 'Australia supplies ~60% of China\'s iron ore — critical for AU exports',
    history: [98,102,108,95,89,93,97,105,112,110,105,102].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'Steel Production', value: '88Mt', trend: 'flat', mom: '0Mt',
    source: 'NBS / CISA', date: 'Apr 2026',
    why: 'Drives iron ore demand; lower output = lower AU iron ore prices',
    history: [82,85,90,88,84,86,90,92,88,87,88,88].map((v,i)=>({ date: `${i+1}m`, v })),
  },
  {
    name: 'Property Price Index', value: '-3.2%', trend: 'down', mom: '-0.1pp',
    source: 'NBS China', date: 'Apr 2026',
    why: 'Property slump dampens steel/copper demand — headwind for AU miners',
    history: [-1.4,-1.9,-2.2,-2.5,-2.8,-3.0,-3.2,-3.4,-3.5,-3.3,-3.2,-3.2].map((v,i)=>({ date: `${i+1}m`, v })),
  },
]
