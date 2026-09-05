// ─── Verified constants ─────────────────────────────────────────────────────
//
// Every hardcoded financial fact in the terminal lives here, in one file, so
// updating after an RBA meeting or a CPI print is one edit rather than a hunt
// through 21 constants across several modules.
//
// WHY THESE ARE NOT AI-GENERATED
// A language model cannot know today's cash rate or this morning's CPI print.
// Asked, it will return a confident, plausible, wrong number — which is worse
// than a visibly stale one, because nothing on screen signals the error. So
// figures stay here as checked facts with a verification date, and MaddenAI
// is used only for prose: themes, risk narratives, interpretation.
//
// TWO DATES PER FACT, and they mean different things:
//   asOf         — when the statistic itself was published by its agency.
//                  A property of the data. CPI for the June quarter is
//                  "as at 2026-07-30" forever.
//   lastVerified — when a human last confirmed our copy is still current.
//                  A property of our maintenance. This is what goes stale.
//
// TO UPDATE: change the value, set asOf to the release date, and set the
// group's lastVerified to today. Anything over VERIFY_WARN_DAYS old renders a
// staleness badge in the UI, so a forgotten update becomes visible rather
// than silently wrong.

export const VERIFY_WARN_DAYS = 7

// ── Central bank policy ─────────────────────────────────────────────────────
export const VERIFIED_CONSTANTS = {
  rba: {
    label: 'RBA',
    country: 'Australia',
    cashRate: 4.35,
    lastDecision: '2026-08-12',
    lastDecisionVerb: 'HOLD',
    previousRate: 4.10,
    nextMeeting: '2026-09-16',
    note: 'Softer June-quarter CPI (3.8%) cited',
    source: 'rba.gov.au',
    asOf: '2026-08-12',
    lastVerified: '2026-09-06',
  },
  fed: {
    label: 'Fed',
    country: 'United States',
    cashRate: 4.50,
    rateRange: '4.25–4.50%',
    lastDecision: '2026-07-30',
    lastDecisionVerb: 'HOLD',
    nextMeeting: '2026-09-17',
    source: 'federalreserve.gov',
    asOf: '2026-07-30',
    lastVerified: '2026-09-06',
  },
  ecb: {
    label: 'ECB', country: 'Euro area', cashRate: 2.00,
    lastDecision: '2026-06-12', lastDecisionVerb: 'CUT', nextMeeting: '2026-09-11',
    source: 'ecb.europa.eu', asOf: '2026-06-12', lastVerified: '2026-09-06',
  },
  boe: {
    label: 'BOE', country: 'United Kingdom', cashRate: 4.25,
    lastDecision: '2026-05-08', lastDecisionVerb: 'CUT', nextMeeting: '2026-09-04',
    source: 'bankofengland.co.uk', asOf: '2026-05-08', lastVerified: '2026-09-06',
  },
  boj: {
    label: 'BOJ', country: 'Japan', cashRate: 0.50,
    lastDecision: '2026-01-24', lastDecisionVerb: 'HOLD', nextMeeting: '2026-09-18',
    source: 'boj.or.jp', asOf: '2026-01-24', lastVerified: '2026-09-06',
  },
  pboc: {
    label: 'PBOC', country: 'China', cashRate: 3.10,
    lastDecision: '2026-02-20', lastDecisionVerb: 'CUT', nextMeeting: '2026-09-21',
    note: '1Y Loan Prime Rate',
    source: 'pbc.gov.cn', asOf: '2026-02-20', lastVerified: '2026-09-06',
  },
  rbnz: {
    label: 'RBNZ', country: 'New Zealand', cashRate: 3.25,
    lastDecision: '2026-04-09', lastDecisionVerb: 'CUT', nextMeeting: '2026-10-07',
    source: 'rbnz.govt.nz', asOf: '2026-04-09', lastVerified: '2026-09-06',
  },
  boc: {
    label: 'BOC', country: 'Canada', cashRate: 2.75,
    lastDecision: '2026-03-12', lastDecisionVerb: 'CUT', nextMeeting: '2026-09-09',
    source: 'bankofcanada.ca', asOf: '2026-03-12', lastVerified: '2026-09-06',
  },
  snb: {
    label: 'SNB', country: 'Switzerland', cashRate: 0.00,
    lastDecision: '2026-03-19', lastDecisionVerb: 'CUT', nextMeeting: '2026-09-24',
    source: 'snb.ch', asOf: '2026-03-19', lastVerified: '2026-09-06',
  },
  riksbank: {
    label: 'Riksbank', country: 'Sweden', cashRate: 2.00,
    lastDecision: '2026-06-25', lastDecisionVerb: 'HOLD', nextMeeting: '2026-09-23',
    source: 'riksbank.se', asOf: '2026-06-25', lastVerified: '2026-09-06',
  },

  // ── Australian economy ────────────────────────────────────────────────────
  au: {
    cpi: 3.8,
    cpiPeriod: 'Jun 2026 quarter',
    cpiPrevious: 2.4,
    cpiLastRelease: '2026-07-30',
    cpiNextRelease: '2026-10-29',
    cpiTrimmedMean: 2.7,
    rbaTargetBand: '2–3%',

    unemployment: 4.1,
    unemploymentPeriod: 'May 2026',
    unemploymentLastRelease: '2026-06-19',

    gdpQoQ: 0.4,
    gdpAnnual: 1.3,
    gdpPeriod: 'Q4 2025',
    gdpLastRelease: '2026-03-04',

    tradeBalanceBn: 7.2,
    tradeBalanceRelease: '2026-04-02',
    retailSalesMoM: 0.3,
    retailSalesRelease: '2026-05-28',
    corelogicHpiMoM: 0.5,
    corelogicRelease: '2026-06-02',
    asx200PE: 19.2,
    asx200DivYield: 3.7,
    asxMetricsRelease: '2026-05-31',

    source: 'abs.gov.au',
    asOf: '2026-07-30',
    lastVerified: '2026-09-06',
  },

  // ── Other major economies ─────────────────────────────────────────────────
  us: {
    cpi: 2.4, cpiPeriod: 'May 2026', cpiRelease: '2026-05-13',
    unemployment: 4.1, unemploymentRelease: '2026-06-05',
    gdpQoQAnnualised: 1.8, gdpRelease: '2026-04-30',
    nfpThousands: 142, nfpRelease: '2026-06-05',
    fedFundsRelease: '2026-05-07',
    source: 'bls.gov / bea.gov', asOf: '2026-06-05', lastVerified: '2026-09-06',
  },
  cn: {
    cpi: 0.1, cpiRelease: '2026-05-14',
    gdpQoQ: 1.5, gdpRelease: '2026-04-16',
    pmiManufacturing: 50.3, pmiRelease: '2026-05-31',
    source: 'stats.gov.cn', asOf: '2026-05-31', lastVerified: '2026-09-06',
  },
  eu: { cpi: 2.0, cpiRelease: '2026-06-03', source: 'ec.europa.eu', asOf: '2026-06-03', lastVerified: '2026-09-06' },
  uk: {
    cpi: 2.8, cpiRelease: '2026-05-20',
    gdpQoQ: 0.4, gdpRelease: '2026-05-15',
    source: 'ons.gov.uk', asOf: '2026-05-20', lastVerified: '2026-09-06',
  },

  // ── Commodities and freight ───────────────────────────────────────────────
  // Gold is deliberately absent: it comes live from liveDataService via PAXG.
  commodities: {
    ironOreUSD: 98.40,
    thermalCoalUSD: 124.20,
    lngUSDPerMMBtu: 12.40,
    copperUSDPerLb: 4.12,
    wheatUSDPerBu: 5.84,
    lithiumUSDPerTonne: 14200,
    brentUSD: 78.40,
    source: 'Indicative — trading economics / SGX iron ore',
    asOf: '2026-06-30',
    lastVerified: '2026-09-06',
  },
  freight: {
    balticDryIndex: 1847,
    balticDryChangePct: 2.1,
    freightosFBX: 3420,
    freightosChangePct: -0.8,
    source: 'balticexchange.com / freightos.com',
    asOf: '2026-06-30',
    lastVerified: '2026-09-06',
  },

  // ── Benchmark index levels ────────────────────────────────────────────────
  // Indicative only. Live equity quotes come through dataService; these exist
  // so the intelligence map has something to label a marker with.
  indices: {
    asx200: 8247.3, sp500: 5842.3, ftse100: 8624.1, nikkei225: 38420.5,
    hangSeng: 18242.1, sseComposite: 3284.2, dax: 18842.3, sensex: 81242.4,
    sti: 3412.8, tsx: 22847.6, nzx50: 12284.3, ta35: 2124.8,
    source: 'Indicative — not a live feed',
    asOf: '2026-06-30',
    lastVerified: '2026-09-06',
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Whole days since a group was last confirmed correct. null when the key or
// its date is missing, so callers can distinguish "unknown" from "fresh".
export function daysSinceVerified(key) {
  const date = VERIFIED_CONSTANTS[key]?.lastVerified
  if (!date) return null
  const t = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export function isStale(key, warnDays = VERIFY_WARN_DAYS) {
  const days = daysSinceVerified(key)
  return days != null && days > warnDays
}

// Days since the underlying statistic was published, which is a different and
// often much larger number than days since we verified it.
export function daysSincePublished(key) {
  const date = VERIFIED_CONSTANTS[key]?.asOf
  if (!date) return null
  const t = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

// One-line provenance string for tooltips.
export function provenance(key) {
  const c = VERIFIED_CONSTANTS[key]
  if (!c) return 'Unknown source'
  const days = daysSinceVerified(key)
  const age = days == null ? 'never verified' : days === 0 ? 'verified today' : `verified ${days}d ago`
  return `${c.source ?? 'Manually maintained'} · as at ${c.asOf ?? '—'} · ${age}`
}

// Every group with a lastVerified, for the settings data-status table.
export function allVerifiedGroups() {
  return Object.entries(VERIFIED_CONSTANTS)
    .filter(([, v]) => v && typeof v === 'object' && v.lastVerified)
    .map(([key, v]) => ({
      key,
      label: v.label ?? key.toUpperCase(),
      source: v.source ?? null,
      asOf: v.asOf ?? null,
      lastVerified: v.lastVerified,
      daysSince: daysSinceVerified(key),
      stale: isStale(key),
    }))
}

export default VERIFIED_CONSTANTS
