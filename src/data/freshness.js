// Freshness guard (tests/freshness.test.mjs). Every hand-typed figure, date,
// weight or constant in the codebase is registered here with the constant
// that holds its as-of date and the maximum age for its kind. The test fails
// when one is older than that, when one has no as-of date, and when a file
// holding typed tables is in none of these lists. Nothing in the app imports
// this file.
//
// The as-of date is always read from the data's own file, never typed here,
// so this registry cannot drift from the data.

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

// Groups of verifiedConstants are picked up automatically from their own
// `lastVerified`. A group with a policy rate is a 'rate'; these are not
// 'statistic', the default.
export const VC_KINDS = { commodities: 'price', freight: 'price', bonds: 'price', indices: 'price', centralBankOfficials: 'reference' }

// One dataset per row: `date` is the name of the constant in `file` that holds
// its as-of date ('YYYY-MM-DD', or null when none was recorded).
export const FRESHNESS = [
  { id: 'policy-rates', what: 'Country policy rates (Global panel)', kind: 'rate', file: 'src/data/verifiedConstants.js', date: 'POLICY_RATES_CHECKED' },
  { id: 'corporate-actions', what: 'Dividend, results and AGM dates', kind: 'schedule', file: 'src/data/corporateActions.js', date: 'CORPORATE_ACTIONS_AS_OF' },
  { id: 'econ-schedule', what: 'Economic calendar (Dashboard, Calendar, alerts)', kind: 'schedule', file: 'src/services/calendarService.js', date: 'ECON_SCHEDULE_CHECKED' },
  { id: 'cb-meetings', what: 'Central-bank meeting lists', kind: 'schedule', file: 'src/services/centralBankSchedule.js', date: 'MEETINGS_CHECKED' },
  { id: 'cb-meetings-unverified', what: 'RBNZ and PBoC meeting dates', kind: 'schedule', file: 'src/services/centralBankSchedule.js', date: 'MEETINGS_UNVERIFIED_CHECKED' },
  { id: 'geo-risk', what: 'Country risk ratings', kind: 'editorial', file: 'src/data/geopoliticalRisk.js', date: 'RISK_LAST_REVIEWED' },
  { id: 'rba-decisions', what: 'RBA decision record', kind: 'history', file: 'src/data/rbaDecisions.js', date: 'RBA_DECISIONS_CHECKED' },
  { id: 'rba-path', what: 'RBA cash-rate path since 2008', kind: 'history', file: 'src/data/rbaCashRatePath.js', date: 'RBA_PATH_READ' },
  { id: 'company-facts', what: 'Company facts (Relationships)', kind: 'statistic', file: 'src/data/graph/companyFacts.js', date: 'FACTS_AS_OF' },
  { id: 'key-facts', what: 'Key facts (Relationships)', kind: 'statistic', file: 'src/data/graph/keyFacts.js', date: 'KEY_FACTS_READ' },
  { id: 'graph', what: 'Relationship graph (edges age on their own, 365 days)', kind: 'reference', file: 'src/data/graph/nodes.js', date: 'GRAPH_AS_OF' },
  { id: 'country-db', what: 'Country reference (capitals, languages, currencies)', kind: 'reference', file: 'src/data/countryDatabase.js', date: 'COUNTRY_DB_AS_OF' },
  { id: 'country-stats', what: 'Country GDP growth and CPI (Global panel)', kind: 'statistic', file: 'src/data/verifiedConstants.js', date: 'COUNTRY_STATS_CHECKED' },
  { id: 'sector-weights', what: 'ASX 200 sector weights', kind: 'statistic', file: 'src/data/placeholders.js', date: 'SECTOR_WEIGHTS_AS_OF' },
  { id: 'etf-data', what: 'ETF fees, sizes and returns (INDICATIVE)', kind: 'price', file: 'src/data/etfData.js', date: 'ETF_DATA_AS_OF' },
  { id: 'futures-data', what: 'Futures prices and margins (INDICATIVE)', kind: 'price', file: 'src/data/futuresData.js', date: 'FUTURES_AS_OF' },
  { id: 'tax-rates', what: 'Tax, super and duty rates', kind: 'reference', file: 'src/data/auTaxRates.js', date: 'TAX_YEAR_START' },
  { id: 'crypto-momentum', what: 'Crypto momentum weights', kind: 'method', file: 'src/services/maddenAiScoring.js', date: 'CRYPTO_MOMENTUM_SET' },
  { id: 'brief-bands', what: 'Brief score bands', kind: 'method', file: 'src/utils/briefScore.js', date: 'BRIEF_BANDS_SET' },
  { id: 'commodity-weights', what: 'Commodity exposure weights', kind: 'method', file: 'src/data/graph/commodityWeights.js', date: 'COMMODITY_WEIGHTS_SET' },
  { id: 'recession-rubric', what: 'Recession-risk rubric', kind: 'method', file: 'src/data/recessionRisk.js', date: 'RECESSION_RUBRIC_SET' },
  { id: 'stress-betas', what: 'Stress-test sector betas', kind: 'method', file: 'src/modules/portfolio/StressTest.jsx', date: 'STRESS_BETAS_SET' },
]

// Datasets dated row by row: `rows` is the export, `field` the date on each
// row, `label` the field that names it.
export const FRESHNESS_ROWS = [
  { id: 'chokepoint', what: 'Shipping route status', kind: 'editorial', file: 'src/data/shippingRoutes.js', rows: 'SHIPPING_ROUTES', field: 'asOf', label: 'name' },
  { id: 'bond-curve', what: 'Sovereign bond curves', kind: 'price', file: 'src/data/bondCurves.js', rows: 'BOND_CURVES_AS_OF' },
  { id: 'index-rebalance', what: 'Index constituent dates', kind: 'reference', file: 'src/data/sectorTaxonomy.js', rows: 'INDEX_METADATA', field: 'lastUpdated' },
]

// Files the scanner finds that hold no dated figures about the world.
export const FRESHNESS_EXEMPT = {
  'src/data/freshness.js': 'this registry: its dates are flag expiries',
  'src/data/verifiedConstants.js': 'checked group by group from its own lastVerified (VC_KINDS)',
  'src/services/mockData.js': 'DEMO simulation inputs, badged DEMO, not figures about the world',
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
  'src/modules/global/intelMapData.js': 'locations and hours; levels come from the quote layer; AU trade values cite ABS 2024-25',
  'src/data/graph/edges.js': 'each edge dated and aged by data/graph/staleness (365 days)',
  'src/data/graph/nodes.js': 'registered as graph (GRAPH_AS_OF)',
  'src/services/alertsService.js': 'derived from the economic calendar (econ-schedule)',
  'src/data/globeRoutes.js': 'lane statuses derive from the dated chokepoint table (chokepoint rows)',
  'src/services/correlationService.js': 'DEMO: a seeded matrix, badged DEMO on the Correlation Explorer and named as simulated to MaddenAI',
}

// Known overdue or undated, each until a hard expiry (Sydney date). From
// that date the problem fails the test again. Never extend one without the
// check it names: fix the data, or add a new flag with a new reason.
export const FRESHNESS_FLAGS = [
  { id: 'cb-meetings-unverified', until: '2026-11-29', reason: "rbnz.govt.nz refuses automated requests and the PBoC publishes no forward LPR calendar; read RBNZ's dates in a browser, or show both as not confirmed" },
  { id: 'sector-weights', until: '2026-11-29', reason: "ASX 200 sector weights typed without a date or source; read S&P/ASX's published weights" },
  { id: 'etf-data', until: '2026-11-29', reason: "INDICATIVE on screen; no date was recorded; read each fund's PDS/fact sheet for fees and size, or drop the figures" },
  { id: 'futures-data', until: '2026-11-29', reason: "INDICATIVE on screen; prices and margins undated; contract specs to be checked against ASX/CME" },
]
