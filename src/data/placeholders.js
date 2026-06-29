// Placeholder data — official statistics labeled with release dates
// Index values (SPX, NDX etc.) are point values — displayed as pts
// All AUS statistics: SOURCE ABS/RBA official releases

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

// AU Government Bond Yield Curve — RBA/AOFM published rates
export const AU_BONDS = [
  { maturity: '3M',  yield: 4.10 },
  { maturity: '6M',  yield: 4.05 },
  { maturity: '1Y',  yield: 3.98 },
  { maturity: '2Y',  yield: 3.90 },
  { maturity: '3Y',  yield: 3.95 },
  { maturity: '5Y',  yield: 4.08 },
  { maturity: '10Y', yield: 4.25 },
  { maturity: '30Y', yield: 4.40 },
]

// Central bank policy rates — SOURCE: official central bank releases
// RBA: 4.10% as at June 2025 meeting (source: rba.gov.au)
// Fed: 4.25–4.50% target range, held Dec 2025 (source: federalreserve.gov)
export const CENTRAL_BANK_RATES = [
  { bank: 'Reserve Bank of Australia', country: 'AUD', rate: 4.10, direction: 'cut',  lastChange: '2025-06-03', src: 'rba.gov.au' },
  { bank: 'Federal Reserve',           country: 'USD', rate: 4.50, direction: 'hold', lastChange: '2025-12-18', src: 'federalreserve.gov' },
  { bank: 'ECB',                       country: 'EUR', rate: 2.15, direction: 'cut',  lastChange: '2026-04-17', src: 'ecb.europa.eu' },
  { bank: 'Bank of England',           country: 'GBP', rate: 4.00, direction: 'cut',  lastChange: '2026-05-08', src: 'bankofengland.co.uk' },
  { bank: 'Bank of Japan',             country: 'JPY', rate: 0.75, direction: 'hike', lastChange: '2026-01-24', src: 'boj.or.jp' },
  { bank: 'PBOC',                      country: 'CNY', rate: 3.00, direction: 'cut',  lastChange: '2026-02-20', src: 'pbc.gov.cn' },
  { bank: 'RBNZ',                      country: 'NZD', rate: 3.25, direction: 'cut',  lastChange: '2026-04-09', src: 'rbnz.govt.nz' },
]

// ─── AU Macro ─────────────────────────────────────────────────────────────────
// Official ABS/RBA statistics — dates reflect the publication date of each figure
// Sources: abs.gov.au | rba.gov.au

export const AU_MACRO = [
  // RBA Cash Rate: 4.35% as at May 2026 RBA Board meeting — source: rba.gov.au
  { name: 'RBA Cash Rate',       value: '4.35%', prev: '4.10%', date: '2026-05-20', beat: null, src: 'rba.gov.au' },
  // AU CPI YoY: 2.4% Q1 2026 — ABS Cat. 6401.0, released 2026-04-29
  { name: 'AU CPI YoY',          value: '2.4%',  prev: '2.3%',  date: '2026-04-29', beat: null, src: 'abs.gov.au/6401.0' },
  { name: 'AU CPI Trimmed Mean', value: '2.7%',  prev: '2.9%',  date: '2026-04-29', beat: true,  src: 'abs.gov.au/6401.0' },
  // AU Unemployment: 4.1% May 2026 — ABS Labour Force, released 2026-06-19
  { name: 'AU Unemployment',     value: '4.1%',  prev: '4.1%',  date: '2026-06-19', beat: null,  src: 'abs.gov.au/6202.0' },
  // AU GDP Q4 2025 — ABS National Accounts, released 2026-03-04
  { name: 'AU GDP QoQ',          value: '0.4%',  prev: '0.3%',  date: '2026-03-04', beat: true,  src: 'abs.gov.au/5206.0' },
  // AU GDP Annual 1.3% as at Q4 2025 — source: abs.gov.au
  { name: 'AU GDP Annual',       value: '1.3%',  prev: '1.0%',  date: '2026-03-04', beat: true,  src: 'abs.gov.au/5206.0' },
  { name: 'AU Trade Balance',    value: 'A$7.2B',prev: 'A$6.1B',date: '2026-04-02', beat: true,  src: 'abs.gov.au/5368.0' },
  { name: 'AU Retail Sales MoM', value: '0.3%',  prev: '0.5%',  date: '2026-05-28', beat: false, src: 'abs.gov.au/8501.0' },
  { name: 'CoreLogic HPI MoM',   value: '+0.5%', prev: '+0.4%', date: '2026-06-02', beat: null,  src: 'corelogic.com.au' },
  { name: 'ASX200 P/E',          value: '19.2',  prev: '18.8',  date: '2026-05-31', beat: null,  src: 'asx.com.au' },
  { name: 'ASX200 Div Yield',    value: '3.7%',  prev: '3.9%',  date: '2026-05-31', beat: null,  src: 'asx.com.au' },
]

// GLOBAL_MACRO — official statistical agency releases
// US CPI 2.4% as at May 2026 (source: bls.gov), US Unemp 4.1% May 2026 (source: bls.gov)
export const GLOBAL_MACRO = [
  { name: 'US CPI YoY',      value: '2.4%',  prev: '2.5%',  date: '2026-05-13', beat: true,  region: 'US', src: 'bls.gov' },
  { name: 'US GDP QoQ Ann',  value: '1.8%',  prev: '2.4%',  date: '2026-04-30', beat: false, region: 'US', src: 'bea.gov' },
  // US Unemployment: 4.1% — source: bls.gov
  { name: 'US Unemployment', value: '4.1%',  prev: '4.1%',  date: '2026-06-05', beat: null,  region: 'US', src: 'bls.gov' },
  { name: 'US NFP',          value: '142K',  prev: '185K',  date: '2026-06-05', beat: false, region: 'US', src: 'bls.gov' },
  // US Fed Funds Rate: 4.25–4.50% target range (source: federalreserve.gov)
  { name: 'US Fed Funds',    value: '4.25–4.50%', prev: '4.25–4.50%', date: '2026-05-07', beat: null, region: 'US', src: 'federalreserve.gov' },
  { name: 'CN CPI YoY',     value: '0.1%',  prev: '-0.1%', date: '2026-05-14', beat: true,  region: 'CN', src: 'stats.gov.cn' },
  { name: 'CN GDP QoQ',     value: '1.5%',  prev: '1.2%',  date: '2026-04-16', beat: true,  region: 'CN', src: 'stats.gov.cn' },
  { name: 'CN PMI Mfg',     value: '50.3',  prev: '50.4',  date: '2026-05-31', beat: false, region: 'CN', src: 'stats.gov.cn' },
  { name: 'EZ CPI YoY',     value: '2.0%',  prev: '2.2%',  date: '2026-06-03', beat: true,  region: 'EU', src: 'ec.europa.eu' },
  { name: 'UK CPI YoY',     value: '2.8%',  prev: '3.0%',  date: '2026-05-20', beat: true,  region: 'UK', src: 'ons.gov.uk' },
  { name: 'UK GDP QoQ',     value: '0.4%',  prev: '0.3%',  date: '2026-05-15', beat: true,  region: 'UK', src: 'ons.gov.uk' },
]

export const MACRO_INDICATORS = GLOBAL_MACRO

// ─── Economic Calendars ───────────────────────────────────────────────────────
// Dates: DD MMM format (e.g. '17 JUN'). Times shown in AEST.
// These are indicative upcoming events — not real-time data.

export const AU_CALENDAR = [
  { date: '17 JUN', time: '11:30', event: 'RBA Meeting Minutes',          region: 'AU', importance: 'high',   forecast: '—',     prev: '—'      },
  { date: '18 JUN', time: '11:30', event: 'AU Building Permits MoM',     region: 'AU', importance: 'medium', forecast: '+1.5%', prev: '-2.2%'  },
  { date: '19 JUN', time: '11:30', event: 'AU Employment Change',         region: 'AU', importance: 'high',   forecast: '+15K',  prev: '+38K'   },
  { date: '19 JUN', time: '11:30', event: 'AU Unemployment Rate',         region: 'AU', importance: 'high',   forecast: '4.1%',  prev: '4.1%'   },
  { date: '25 JUN', time: '11:30', event: 'AU CPI Monthly (May 2026)',    region: 'AU', importance: 'high',   forecast: '2.3%',  prev: '2.4%'   },
  { date: '01 JUL', time: '11:30', event: 'AU Building Approvals MoM',   region: 'AU', importance: 'medium', forecast: '+0.8%', prev: '-2.2%'  },
  { date: '01 JUL', time: '11:30', event: 'AU Retail Sales MoM (May)',   region: 'AU', importance: 'medium', forecast: '+0.3%', prev: '+0.3%'  },
  { date: '07 JUL', time: '14:30', event: 'RBA Rate Decision (Jul 2026)',  region: 'AU', importance: 'high',   forecast: '4.10%', prev: '4.10%'  },
  { date: '08 JUL', time: '11:30', event: 'AU Trade Balance (May)',        region: 'AU', importance: 'medium', forecast: 'A$7.5B',prev: 'A$7.2B' },
  { date: '10 JUL', time: '09:00', event: 'AU Consumer Sentiment (Jul)',   region: 'AU', importance: 'medium', forecast: '—',     prev: '—'      },
]

export const GLOBAL_CALENDAR = [
  { date: '17 JUN', time: '01:15', event: 'US Industrial Production MoM', region: 'US', importance: 'medium', forecast: '+0.2%', prev: '+0.3%'  },
  { date: '18 JUN', time: '04:00', event: 'FOMC Meeting Minutes',          region: 'US', importance: 'high',   forecast: '—',     prev: '—'      },
  { date: '18 JUN', time: '22:30', event: 'US Housing Starts MoM',         region: 'US', importance: 'medium', forecast: '+1.0%', prev: '-1.5%'  },
  { date: '26 JUN', time: '22:30', event: 'US Core PCE Price Index MoM',   region: 'US', importance: 'high',   forecast: '+0.2%', prev: '+0.2%'  },
  { date: '26 JUN', time: '22:30', event: 'US Personal Spending MoM',      region: 'US', importance: 'medium', forecast: '+0.3%', prev: '+0.5%'  },
  { date: '02 JUL', time: '22:30', event: 'US Nonfarm Payrolls (Jun)',      region: 'US', importance: 'high',   forecast: '+160K', prev: '+142K'  },
  { date: '02 JUL', time: '22:30', event: 'US Unemployment Rate (Jun)',     region: 'US', importance: 'high',   forecast: '4.1%',  prev: '4.1%'   },
  { date: '07 JUL', time: '01:00', event: 'US ISM Services PMI (Jun)',      region: 'US', importance: 'medium', forecast: '52.5',  prev: '51.6'   },
  { date: '10 JUL', time: '22:30', event: 'US CPI YoY (Jun)',               region: 'US', importance: 'high',   forecast: '2.3%',  prev: '2.4%'   },
  { date: '17 JUL', time: '02:00', event: 'FOMC Rate Decision (Jul)',        region: 'US', importance: 'high',   forecast: '4.25–4.50%', prev: '4.25–4.50%' },
]

export const ECONOMIC_CALENDAR = GLOBAL_CALENDAR

// ─── AU Historical Data (ABS official releases) ───────────────────────────────

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

// ─── RBA Rate History (Jan 2022 – Jun 2026) ─────────────────────────────────
// SOURCE: rba.gov.au board decisions
export const RBA_RATE_HISTORY = [
  { date: 'Jan-22', rate: 0.10 }, { date: 'Feb-22', rate: 0.10 },
  { date: 'Mar-22', rate: 0.10 }, { date: 'Apr-22', rate: 0.10 },
  { date: 'May-22', rate: 0.35 }, { date: 'Jun-22', rate: 0.85 },
  { date: 'Jul-22', rate: 1.35 }, { date: 'Aug-22', rate: 1.85 },
  { date: 'Sep-22', rate: 2.35 }, { date: 'Oct-22', rate: 2.60 },
  { date: 'Nov-22', rate: 2.85 }, { date: 'Dec-22', rate: 3.10 },
  { date: 'Jan-23', rate: 3.35 }, { date: 'Feb-23', rate: 3.35 },
  { date: 'Mar-23', rate: 3.60 }, { date: 'Apr-23', rate: 3.60 },
  { date: 'May-23', rate: 3.85 }, { date: 'Jun-23', rate: 4.10 },
  { date: 'Jul-23', rate: 4.10 }, { date: 'Aug-23', rate: 4.10 },
  { date: 'Sep-23', rate: 4.10 }, { date: 'Oct-23', rate: 4.35 },
  { date: 'Nov-23', rate: 4.35 }, { date: 'Dec-23', rate: 4.35 },
  { date: 'Jan-24', rate: 4.35 }, { date: 'Feb-24', rate: 4.35 },
  { date: 'Mar-24', rate: 4.35 }, { date: 'Apr-24', rate: 4.35 },
  { date: 'May-24', rate: 4.35 }, { date: 'Jun-24', rate: 4.35 },
  { date: 'Jul-24', rate: 4.35 }, { date: 'Aug-24', rate: 4.35 },
  { date: 'Sep-24', rate: 4.35 }, { date: 'Oct-24', rate: 4.35 },
  { date: 'Nov-24', rate: 4.35 }, { date: 'Dec-24', rate: 4.35 },
  { date: 'Jan-25', rate: 4.35 }, { date: 'Feb-25', rate: 4.35 },
  { date: 'Mar-25', rate: 4.35 }, { date: 'Apr-25', rate: 4.35 },
  { date: 'May-25', rate: 4.35 }, { date: 'Jun-25', rate: 4.35 },
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

export const RBA_RECENT_STATEMENTS = [
  {
    date: '20 May 2025',
    decision: 'HOLD at 4.35%',
    key: '"The Board remains resolute in its determination to return inflation to target. Recent data has been encouraging but the job is not yet done."',
  },
  {
    date: '08 Apr 2025',
    decision: 'HOLD at 4.35%',
    key: '"Global uncertainty has increased. The Board is closely monitoring developments in financial markets and the real economy."',
  },
  {
    date: '18 Feb 2025',
    decision: 'HOLD at 4.35%',
    key: '"The labour market remains tight. While inflation has declined, it remains above the 2–3 per cent target range."',
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
