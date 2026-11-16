// The data registry (16 Nov 2026; docs/DATA_PLATFORM.md). Every figure about
// the world that Maddex shows or sends to MaddenAI belongs to one dataset
// here, which declares where it comes from, under what licence, how it is
// fetched, how often it changes, how old it may get, its class, and what a
// reader sees when it cannot be shown fresh.
//
// The registry holds no figures and no dates. Each dataset points at the
// constant in its own file that holds its as-of date (`asOf`), so the
// registry cannot drift from the data. tests/registry.test.mjs fails when a
// dataset is past its maximum age, has no as-of date, is missing a field,
// or when a file holding typed tables is in no dataset (this folds in the
// freshness guard that was src/data/freshness.js).
//
// Classes:
//   official   published by a government agency or central bank
//   market     a price or market fact from an exchange, issuer or vendor
//   derived    computed by Maddex from other datasets, or a Maddex method
//   editorial  a Maddex judgement or a curated record a person maintains
//   demo       simulated for demonstration, badged DEMO, not about the world

// Maximum age by kind of figure, in days from its as-of date.
export const MAX_AGE_DAYS = {
  rate: 45,       // a central-bank policy rate, from the date it was checked
  price: 30,      // a hand-entered market level (commodities, freight, curves)
  statistic: 60,  // an official statistic (monthly or quarterly release)
  schedule: 30,   // a calendar of dates to come
  editorial: 45,  // a Maddex judgement (route status, risk ratings)
  history: 45,    // a record of past decisions, re-reconciled with its source
  reference: 365, // slow-moving facts: tax years, officials, index rebalances
  method: 365,    // weights and bands of a Maddex method
}

export const CLASSES = ['official', 'market', 'derived', 'editorial', 'demo']

// What a reader sees when the dataset cannot be shown fresh.
const FB = {
  dated: 'Shown with its source and as-of date. Past its maximum age the build fails until the figure is re-read.',
  history: 'A past record does not change; new entries are added when the source publishes them, and the build fails past the maximum age until it is re-reconciled.',
  schedule: 'Dates already passed drop off; past the maximum age the build fails until the calendar is re-read from the source.',
  method: 'A Maddex method, named as one wherever it is used; it is reviewed at least yearly.',
  demo: 'Always badged DEMO; never presented as market data.',
  unverifiable: 'A figure that cannot be re-read from its source is removed, not shown undated.',
}

const VC = 'src/data/verifiedConstants.js'
const RBA = { name: 'Reserve Bank of Australia', url: 'https://www.rba.gov.au/statistics/' }
const ABS = { name: 'Australian Bureau of Statistics', url: 'https://www.abs.gov.au/' }
const LIC = {
  rba: 'RBA copyright: commercial use permitted with "Source: Reserve Bank of Australia"; must not imply RBA data is not free',
  abs: 'CC BY 4.0, attributed to the ABS',
  gov: 'Official publication, quoted with its source and date (a figure, not the document)',
  bank: "The central bank's own announcement, quoted with its source and date",
  maddex: "Maddex's own work",
  issuer: "The issuer's or exchange's published document, quoted with its source and date",
  news: 'A published figure quoted with its source and date; not a data feed or licence',
}
const MANUAL = (verify = null) => ({ method: 'manual', how: 'read by a person from the source page and typed with its date', verify })
const STATS = 'npm run check-stats'
const FETCHED = (source, extra = '') => ({ method: 'fetcher', how: `scripts/data/sources/${source}.mjs writes a dated record (npm run data:fetch); a person copies a changed figure across${extra}`, verify: `npm run data:verify -- ${source}` })

// A dataset. `kind` sets the maximum age unless `maxAgeDays` is given.
const d = (e) => ({ fallback: FB.dated, ...e, maxAgeDays: e.maxAgeDays ?? MAX_AGE_DAYS[e.kind] })

export const DATASETS = [
  // ── Central-bank policy (verifiedConstants groups) ─────────────────────────
  d({ id: 'vc:rba', what: 'RBA cash rate and last decision', cls: 'official', kind: 'rate', source: RBA, licence: LIC.rba, fetch: FETCHED('rba'), cadence: 'per meeting (8 a year)', modules: ['fx', 'macro', 'dashboard', 'brief', 'calculators'], asOf: { vc: 'rba' } }),
  d({ id: 'vc:fed', what: 'US federal funds target range', cls: 'official', kind: 'rate', source: { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm' }, licence: LIC.bank, fetch: MANUAL(STATS), cadence: 'per meeting (8 a year)', modules: ['fx', 'macro', 'dashboard', 'brief'], asOf: { vc: 'fed' } }),
  d({ id: 'vc:ecb', what: 'ECB deposit facility rate', cls: 'official', kind: 'rate', source: { name: 'European Central Bank', url: 'https://www.ecb.europa.eu/mopo/decisions/' }, licence: 'ECB: free use, citing the ECB as the source', fetch: FETCHED('ecb'), cadence: 'per meeting (8 a year)', modules: ['fx', 'macro', 'global'], asOf: { vc: 'ecb' } }),
  d({ id: 'vc:boe', what: 'Bank of England Bank Rate', cls: 'official', kind: 'rate', source: { name: 'Bank of England', url: 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'per meeting (8 a year)', modules: ['fx', 'global'], asOf: { vc: 'boe' } }),
  d({ id: 'vc:boj', what: 'Bank of Japan policy rate', cls: 'official', kind: 'rate', source: { name: 'Bank of Japan', url: 'https://www.boj.or.jp/en/mopo/mpmdeci/index.htm' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'per meeting (8 a year)', modules: ['fx', 'global'], asOf: { vc: 'boj' } }),
  d({ id: 'vc:pboc', what: 'PBoC loan prime rate', cls: 'official', kind: 'rate', source: { name: "People's Bank of China", url: 'http://www.pbc.gov.cn/en/' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'monthly (20th)', modules: ['fx', 'global'], asOf: { vc: 'pboc' } }),
  d({ id: 'vc:rbnz', what: 'RBNZ official cash rate', cls: 'official', kind: 'rate', source: { name: 'Reserve Bank of New Zealand', url: 'https://www.rbnz.govt.nz/' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'per meeting (7 a year)', modules: ['fx', 'global'], asOf: { vc: 'rbnz' } }),
  d({ id: 'vc:boc', what: 'Bank of Canada policy rate', cls: 'official', kind: 'rate', source: { name: 'Bank of Canada', url: 'https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/' }, licence: LIC.bank, fetch: FETCHED('boc'), cadence: 'per meeting (8 a year)', modules: ['fx', 'global'], asOf: { vc: 'boc' } }),
  d({ id: 'vc:snb', what: 'SNB policy rate', cls: 'official', kind: 'rate', source: { name: 'Swiss National Bank', url: 'https://www.snb.ch/en/' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'quarterly', modules: ['fx', 'global'], asOf: { vc: 'snb' } }),
  d({ id: 'vc:riksbank', what: 'Riksbank policy rate', cls: 'official', kind: 'rate', source: { name: 'Sveriges Riksbank', url: 'https://www.riksbank.se/en-gb/monetary-policy/the-policy-rate/' }, licence: LIC.bank, fetch: MANUAL(), cadence: 'per meeting (8 a year)', modules: ['fx', 'global'], asOf: { vc: 'riksbank' } }),
  d({ id: 'vc:centralBankOfficials', what: 'Central-bank governors and chairs', cls: 'official', kind: 'reference', source: { name: "Each central bank's own site", url: null }, licence: LIC.bank, fetch: MANUAL(), cadence: 'on change', modules: ['fx', 'macro'], asOf: { vc: 'centralBankOfficials' } }),
  d({ id: 'policy-rates', what: 'Country policy rates (Global panel)', cls: 'official', kind: 'rate', source: { name: "Each central bank's own announcement (docs/DATA_SOURCES.md)", url: null }, licence: LIC.bank, fetch: MANUAL(), cadence: 'per meeting', modules: ['global'], asOf: { file: VC, date: 'POLICY_RATES_CHECKED' }, fallback: FB.unverifiable }),

  // ── Official statistics ───────────────────────────────────────────────────
  d({ id: 'vc:au', what: 'Australian CPI, labour force, GDP and other headline statistics', cls: 'official', kind: 'statistic', source: ABS, licence: LIC.abs, fetch: FETCHED('abs', '; survey and other series by hand'), cadence: 'monthly and quarterly releases', modules: ['macro', 'dashboard', 'brief', 'fx', 'calculators'], asOf: { vc: 'au' } }),
  d({ id: 'vc:us', what: 'US CPI, unemployment and GDP', cls: 'official', kind: 'statistic', source: { name: 'BLS and BEA', url: 'https://www.bls.gov/' }, licence: 'US government work, public domain; BLS asks that derived analyses not be attributed to it', fetch: FETCHED('bls', '; GDP by hand from BEA, which needs a key'), cadence: 'monthly and quarterly releases', modules: ['macro', 'dashboard', 'brief'], asOf: { vc: 'us' } }),
  d({ id: 'vc:auTrade', what: 'Australian exports and imports by partner, 2024-25', cls: 'official', kind: 'statistic', source: ABS, licence: LIC.abs, fetch: MANUAL(), cadence: 'annual', maxAgeDays: 365, modules: ['global'], asOf: { vc: 'auTrade' } }),
  d({ id: 'country-stats', what: 'Country GDP growth and CPI (Global panel)', cls: 'official', kind: 'statistic', source: { name: "Each country's statistics agency (docs/DATA_SOURCES.md)", url: null }, licence: LIC.gov, fetch: MANUAL(), cadence: 'monthly and quarterly releases', modules: ['global', 'macro'], asOf: { file: VC, date: 'COUNTRY_STATS_CHECKED' }, fallback: FB.unverifiable }),
  d({ id: 'macro-series', what: 'Macro leading-indicator series (surveys, trade, spending)', cls: 'official', kind: 'statistic', source: { name: 'ABS, Westpac-Melbourne Institute, NAB', url: null }, licence: LIC.gov, fetch: MANUAL(), cadence: 'monthly', modules: ['macro'], asOf: { file: 'src/data/placeholders.js', date: 'MACRO_SERIES_AS_OF' } }),
  d({ id: 'tax-rates', what: 'Tax, super and duty rates; the CGT discount; the company rate for franking', cls: 'official', kind: 'reference', source: { name: 'ATO and state revenue offices', url: 'https://www.ato.gov.au/' }, licence: LIC.gov, fetch: MANUAL(), cadence: 'each financial year', modules: ['calculators', 'portfolio'], asOf: { file: 'src/data/auTaxRates.js', date: 'TAX_YEAR_START' } }),
  d({ id: 'country-db', what: 'Country reference (capitals, languages, currencies)', cls: 'official', kind: 'reference', source: { name: 'Natural Earth and national sources', url: 'https://www.naturalearthdata.com/' }, licence: 'Public domain (Natural Earth); facts', fetch: MANUAL(), cadence: 'on change', modules: ['global'], asOf: { file: 'src/data/countryDatabase.js', date: 'COUNTRY_DB_AS_OF' } }),

  // ── RBA records ───────────────────────────────────────────────────────────
  d({ id: 'rba-decisions', what: 'RBA decision record', cls: 'official', kind: 'history', source: RBA, licence: LIC.rba, fetch: { method: 'manual', how: 'typed from RBA media releases', verify: 'npm run check-rba' }, cadence: 'per meeting', modules: ['fx', 'macro', 'replay'], asOf: { file: 'src/data/rbaDecisions.js', date: 'RBA_DECISIONS_CHECKED' }, fallback: FB.history }),
  d({ id: 'rba-path', what: 'RBA cash-rate path since 2008', cls: 'official', kind: 'history', source: RBA, licence: LIC.rba, fetch: { method: 'manual', how: 'typed from RBA table A2', verify: STATS }, cadence: 'per meeting', modules: ['fx', 'replay'], asOf: { file: 'src/data/rbaCashRatePath.js', date: 'RBA_PATH_READ' }, fallback: FB.history }),
  d({ id: 'rba-board', what: 'RBA Monetary Policy Board members', cls: 'official', kind: 'reference', source: RBA, licence: LIC.rba, fetch: MANUAL(), cadence: 'on change', modules: ['fx', 'macro'], asOf: { file: 'src/data/placeholders.js', date: 'RBA_BOARD_READ' } }),
  d({ id: 'vc:rbaNextDecision', what: 'Next RBA decision and the dated market-pricing reading', cls: 'market', kind: 'statistic', maxAgeDays: 30, source: { name: 'RBA (date); market pricing as published (source named on the reading)', url: 'https://www.rba.gov.au/monetary-policy/' }, licence: LIC.news, fetch: MANUAL(), cadence: 'per meeting', modules: ['fx', 'brief'], asOf: { vc: 'rbaNextDecision' } }),

  d({ id: 'rba-f6', what: 'Average variable home-loan rate (RBA F6), the source of the mortgage margin', cls: 'official', kind: 'statistic', maxAgeDays: 30, source: { name: 'RBA table F6, housing lending rates (FLRHOOVA)', url: 'https://www.rba.gov.au/statistics/tables/csv/f6-data.csv' }, licence: LIC.rba, fetch: FETCHED('rba'), cadence: 'monthly', modules: ['calculators', 'fx'], asOf: { file: 'src/data/rbaLendingRates.js', date: 'F6_READ' } }),

  // ── Schedules ─────────────────────────────────────────────────────────────
  d({ id: 'cb-meetings', what: 'Central-bank meeting lists', cls: 'official', kind: 'schedule', source: { name: "Each central bank's published calendar", url: null }, licence: LIC.bank, fetch: MANUAL(), cadence: 'yearly, with changes', modules: ['fx', 'macro', 'calendar', 'brief'], asOf: { file: 'src/services/centralBankSchedule.js', date: 'MEETINGS_CHECKED' }, fallback: FB.schedule }),
  d({ id: 'cb-announce-times', what: 'Central-bank announcement times', cls: 'official', kind: 'schedule', source: { name: "Each central bank's published calendar", url: null }, licence: LIC.bank, fetch: MANUAL(), cadence: 'yearly, with changes', modules: ['fx', 'macro', 'calendar'], asOf: { file: 'src/services/centralBankSchedule.js', date: 'ANNOUNCE_AT_CHECKED' }, fallback: FB.schedule }),
  d({ id: 'econ-schedule', what: 'Economic calendar (Dashboard, Calendar, alerts)', cls: 'official', kind: 'schedule', source: { name: 'ABS, BLS and agency release calendars', url: 'https://www.abs.gov.au/release-calendar' }, licence: LIC.gov, fetch: MANUAL(), cadence: 'monthly', modules: ['calendar', 'dashboard', 'brief', 'macro', 'news', 'global'], asOf: { file: 'src/services/calendarService.js', date: 'ECON_SCHEDULE_CHECKED' }, fallback: FB.schedule }),
  d({ id: 'corporate-actions', what: 'Dividend, results and AGM dates', cls: 'official', kind: 'schedule', source: { name: 'ASX company announcements', url: 'https://www.asx.com.au/markets/trade-our-cash-market/announcements' }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'reporting seasons', modules: ['calendar', 'markets', 'portfolio'], asOf: { file: 'src/data/corporateActions.js', date: 'CORPORATE_ACTIONS_AS_OF' }, fallback: FB.schedule }),

  // ── Market facts ──────────────────────────────────────────────────────────
  d({ id: 'vc:commodities', what: 'Commodity reference levels', cls: 'market', kind: 'price', source: { name: 'Exchange settlements as published (source named per figure)', url: null }, licence: LIC.news, fetch: MANUAL(), cadence: 'daily markets; read by hand', modules: ['global', 'macro', 'markets'], asOf: { vc: 'commodities' } }),
  d({ id: 'vc:freight', what: 'Freightos Baltic Index', cls: 'market', kind: 'price', source: { name: 'Freightos (FBX)', url: 'https://fbx.freightos.com/' }, licence: 'Freightos terms not yet read (docs/DATA_SOURCES.md: REVIEW)', fetch: MANUAL(), cadence: 'weekly', modules: ['global'], asOf: { vc: 'freight' } }),
  d({ id: 'vc:bonds', what: 'Australian and US 10-year yields', cls: 'official', kind: 'price', source: { name: 'RBA table F2 (AU); US Treasury par curve (US)', url: 'https://www.rba.gov.au/statistics/tables/' }, licence: LIC.rba, fetch: FETCHED('rba', '; the US 10-year is read by hand from the Treasury par curve'), cadence: 'daily', modules: ['bonds', 'fx', 'dashboard'], asOf: { vc: 'bonds' } }),
  d({ id: 'vc:indices', what: 'Index closes (reference)', cls: 'market', kind: 'price', source: { name: 'Published market reports (named on the figure)', url: null }, licence: LIC.news, fetch: MANUAL(), cadence: 'daily markets; read by hand', modules: ['markets', 'dashboard'], asOf: { vc: 'indices' } }),
  d({ id: 'bond-curve', what: 'Sovereign bond curves (AU, US, UK, DE, JP)', cls: 'official', kind: 'price', source: { name: 'RBA, US Treasury, UK DMO, Bundesbank, Japan MoF', url: null }, licence: LIC.gov, fetch: MANUAL(), cadence: 'daily', modules: ['bonds', 'fx', 'macro', 'dashboard'], asOf: { file: 'src/data/bondCurves.js', rows: 'BOND_CURVES_AS_OF' } }),
  d({ id: 'etf-data', what: 'ETF fees, indices and fund sizes', cls: 'market', kind: 'statistic', source: { name: "Each issuer's product page", url: null }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'monthly', modules: ['etf', 'portfolio'], asOf: { file: 'src/data/etfData.js', date: 'ETF_DATA_AS_OF' }, fallback: FB.unverifiable }),
  d({ id: 'futures-specs', what: 'Futures contract specifications', cls: 'market', kind: 'reference', source: { name: "Each exchange's contract page", url: null }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'on change', modules: ['futures'], asOf: { file: 'src/data/futuresData.js', date: 'FUTURES_SPECS_CHECKED' }, fallback: FB.unverifiable }),
  d({ id: 'index-rebalance', what: 'Index constituent dates', cls: 'market', kind: 'reference', source: { name: 'S&P Dow Jones Indices announcements', url: 'https://www.spglobal.com/spdji/' }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'quarterly rebalances', modules: ['markets', 'dashboard', 'portfolio'], asOf: { file: 'src/data/sectorTaxonomy.js', rows: 'INDEX_METADATA', field: 'lastUpdated' } }),
  d({ id: 'company-facts', what: 'Company facts (Relationships, Company)', cls: 'official', kind: 'statistic', source: { name: 'Company annual reports and ASX filings', url: null }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'each reporting season', modules: ['company', 'relationships'], asOf: { file: 'src/data/graph/companyFacts.js', date: 'FACTS_AS_OF' } }),
  d({ id: 'key-facts', what: 'Key facts (Relationships, Company)', cls: 'official', kind: 'statistic', source: { name: 'Company filings, each fact cited', url: null }, licence: LIC.issuer, fetch: MANUAL(), cadence: 'each reporting season', modules: ['company', 'relationships'], asOf: { file: 'src/data/graph/keyFacts.js', date: 'KEY_FACTS_READ' } }),

  d({ id: 'crypto-au-facts', what: 'Crypto in Australia: ownership survey, AUSTRAC and ASIC rules, CGT treatment', cls: 'official', kind: 'reference', source: { name: 'Independent Reserve, AUSTRAC, ATO, Digital Assets Framework Act 2026 (named per fact)', url: null }, licence: LIC.gov, fetch: MANUAL(), cadence: 'on change', modules: ['crypto'], asOf: { file: 'src/modules/crypto/CryptoModule.jsx', date: 'AU_FACTS_CHECKED' } }),

  d({ id: 'us-circuit-breakers', what: 'US market-wide circuit-breaker thresholds', cls: 'official', kind: 'reference', source: { name: 'SEC (investor.gov); NYSE Rule 7.12', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-market-circuit-breakers' }, licence: LIC.gov, fetch: MANUAL(), cadence: 'on rule change', modules: ['markets'], asOf: { file: 'src/modules/markets/VolatilityBanner.jsx', date: 'MWCB_CHECKED' } }),

  // ── Editorial ─────────────────────────────────────────────────────────────
  d({ id: 'graph', what: 'Relationship graph (each link cited; links age on their own at 365 days)', cls: 'editorial', kind: 'reference', source: { name: 'Company filings, each link with its quote', url: null }, licence: LIC.maddex, fetch: { method: 'manual', how: 'proposed, verified, and approved by a person', verify: 'npm run graph:verify' }, cadence: 'on approval', modules: ['relationships', 'company', 'global'], asOf: { file: 'src/data/graph/nodes.js', date: 'GRAPH_AS_OF' } }),
  d({ id: 'geo-risk', what: 'Country risk notes (descriptive)', cls: 'editorial', kind: 'editorial', source: { name: 'Maddex, from cited reporting', url: null }, licence: LIC.maddex, fetch: MANUAL(), cadence: 'monthly review', modules: ['global'], asOf: { file: 'src/data/geopoliticalRisk.js', date: 'RISK_LAST_REVIEWED' } }),
  d({ id: 'chokepoint', what: 'Shipping route status', cls: 'editorial', kind: 'editorial', source: { name: 'Maddex, from cited reporting (per route)', url: null }, licence: LIC.maddex, fetch: MANUAL(), cadence: 'on change', modules: ['global'], asOf: { file: 'src/data/shippingRoutes.js', rows: 'SHIPPING_ROUTES', field: 'asOf', label: 'name' } }),

  d({ id: 'intel-map', what: 'Global map editorial content: disruptions, route notes and ratings, site notes', cls: 'editorial', kind: 'editorial', source: { name: 'Maddex, from cited reporting', url: null }, licence: LIC.maddex, fetch: MANUAL(), cadence: 'on change', modules: ['global'], asOf: { file: 'src/modules/global/intelMapData.js', date: 'INTEL_MAP_REVIEWED' } }),
  // ── Maddex methods (derived) ──────────────────────────────────────────────
  d({ id: 'crypto-momentum', what: 'Crypto momentum weights', cls: 'derived', kind: 'method', source: { name: 'Maddex method', url: null }, licence: LIC.maddex, fetch: { method: 'derived', how: 'computed from fetched prices with these weights', verify: null }, cadence: 'reviewed yearly', modules: ['crypto', 'markets'], asOf: { file: 'src/services/maddenAiScoring.js', date: 'CRYPTO_MOMENTUM_SET' }, fallback: FB.method }),
  d({ id: 'brief-bands', what: 'Brief score bands', cls: 'derived', kind: 'method', source: { name: 'Maddex method', url: null }, licence: LIC.maddex, fetch: { method: 'derived', how: 'computed from the day\'s figures', verify: null }, cadence: 'reviewed yearly', modules: ['brief', 'dashboard'], asOf: { file: 'src/utils/briefScore.js', date: 'BRIEF_BANDS_SET' }, fallback: FB.method }),
  d({ id: 'commodity-weights', what: 'Commodity exposure weights', cls: 'derived', kind: 'method', source: { name: 'Maddex method, from company revenue mix', url: null }, licence: LIC.maddex, fetch: { method: 'derived', how: 'set from filings, applied to prices', verify: null }, cadence: 'reviewed yearly', modules: ['relationships'], asOf: { file: 'src/data/graph/commodityWeights.js', date: 'COMMODITY_WEIGHTS_SET' }, fallback: FB.method }),
  d({ id: 'recession-rubric', what: 'Recession-risk rubric', cls: 'derived', kind: 'method', source: { name: 'Maddex method', url: null }, licence: LIC.maddex, fetch: { method: 'derived', how: 'scored from official statistics', verify: null }, cadence: 'reviewed yearly', modules: ['macro', 'portfolio'], asOf: { file: 'src/data/recessionRisk.js', date: 'RECESSION_RUBRIC_SET' }, fallback: FB.method }),
  d({ id: 'stress-betas', what: 'Stress-test sector betas', cls: 'derived', kind: 'method', source: { name: 'Maddex method', url: null }, licence: LIC.maddex, fetch: { method: 'derived', how: 'applied to holdings in the stress test', verify: null }, cadence: 'reviewed yearly', modules: ['portfolio'], asOf: { file: 'src/modules/portfolio/StressTest.jsx', date: 'STRESS_BETAS_SET' }, fallback: FB.method }),

  // ── Demo ──────────────────────────────────────────────────────────────────
  d({ id: 'demo-equities', what: 'Simulated equity and index prices', cls: 'demo', kind: 'method', source: { name: 'Maddex simulation', url: null }, licence: LIC.maddex, fetch: { method: 'demo', how: 'generated in the browser', verify: null }, cadence: 'each session', modules: ['markets', 'watchlist', 'portfolio', 'screener', 'scanner', 'dashboard', 'replay'], asOf: null, fallback: FB.demo, file: 'src/services/mockData.js' }),
  d({ id: 'demo-correlation', what: 'Correlation matrix (seeded)', cls: 'demo', kind: 'method', source: { name: 'Maddex simulation', url: null }, licence: LIC.maddex, fetch: { method: 'demo', how: 'seeded in the browser', verify: null }, cadence: 'each session', modules: ['markets'], asOf: null, fallback: FB.demo, file: 'src/services/correlationService.js' }),
]

// Files the scanner finds that hold no dated figures about the world.
export const EXEMPT = {
  'src/data/registry.js': 'this registry',
  'src/data/registryHealth.js': 'generated from this registry (npm run data:docs); the test holds it to the registry',
  'src/data/verifiedConstants.js': 'registered group by group (vc:*), each from its own lastVerified',
  'src/services/dashboardService.js': 'dashboard layout',
  'src/services/soundService.js': 'sound settings',
  'src/services/plans.js': "Maddex's own plan prices and limits",
  'src/components/settings/SettingsPanel.jsx': "Maddex's own release notes",
  'src/modules/calculators/CalculatorsModule.jsx': 'default inputs a reader edits',
  'src/modules/screener/ScreenerModule.jsx': 'filter defaults',
  'src/modules/macro/MacroModule.jsx': 'layout values; figures come from verifiedConstants',
  'src/data/datedChanges.js': 'self-checking: npm run check-stats warns, by name, on any change whose date has passed',
  'src/services/replayScenarios.js': 'past events, each sourced on its scenario; a past fact does not age',
  'src/services/replayService.js': 'past RBA decisions for replays; a past fact does not age',
  'src/data/globeExchanges.js': 'exchange locations and trading hours',
  'src/data/graph/edges.js': 'each edge dated and aged by data/graph/staleness (365 days)',
  'src/services/alertsService.js': 'derived from the economic calendar (econ-schedule)',
  'src/data/globeRoutes.js': 'lane statuses derive from the dated chokepoint table (chokepoint rows)',
}

// Known overdue or undated, each until a hard expiry (Sydney date). From
// that date the problem fails the test again. Never extend one without the
// check it names: fix the data, or add a new flag with a new reason.
export const FLAGS = [
  { id: 'intel-map', until: '2026-11-29', reason: 'Global map editorial content (disruptions, route notes, site notes) was never dated as a whole; it also repeats the dated chokepoint table. Re-read each item from its source by fetch, or remove it, then set INTEL_MAP_REVIEWED.' },
]

export const datasetById = Object.fromEntries(DATASETS.map((e) => [e.id, e]))
export const datasetsForModule = (moduleId) => DATASETS.filter((e) => e.modules.includes(moduleId))
// The file each dataset's figures live in.
export const fileOf = (e) => e.file ?? e.asOf?.file ?? (e.asOf?.vc ? VC : null)
