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

    // ── Central bank and government office holders ──────────────────────────
  //
  // WHY THIS IS HERE AND NOT IN THE MODEL'S HEAD.
  //
  // Asked in September 2026 who chairs the Fed, a model trained earlier answers
  // "Jerome Powell" with complete confidence. It is wrong: Kevin Warsh was
  // confirmed on 13 May 2026 and sworn in on 22 May. That is the whole problem
  // with recalled facts about people — an appointment changes on a single day,
  // the old answer stays fluent and plausible, and nothing on screen signals
  // the error.
  //
  // Every entry below was verified against a primary or major source on the
  // lastVerified date. termEnds is recorded ONLY where a source stated it.
  //
  // TO UPDATE: change the name, set `since`, and set lastVerified to today.
  // These reach MaddenAI through the per-turn context, not the cached system
  // prompt, so an edit here takes effect on the very next message.
  centralBankOfficials: {
    fed: {
      role: 'Chair of the Federal Reserve',
      name: 'Kevin Warsh',
      since: '2026-05-22',
      termEnds: '2030-05-21',
      note: 'Confirmed 13 May 2026, succeeded Jerome Powell',
      source: 'federalreserve.gov',
      lastVerified: '2026-09-07',
    },
    rba: {
      role: 'Governor of the Reserve Bank of Australia',
      name: 'Michele Bullock',
      since: '2023-09-18',
      // Seven-year term. Note: not 2028 — RBA governors serve seven years,
      // and 2023 + 7 is 2030.
      termEnds: '2030-09-17',
      source: 'rba.gov.au',
      lastVerified: '2026-09-07',
    },
    ecb: {
      role: 'President of the European Central Bank',
      name: 'Christine Lagarde',
      since: '2019-11-01',
      // Derived from the fixed eight-year non-renewable term rather than
      // quoted from a source, so it is marked as such.
      termEnds: '2027-10-31',
      termEndsDerived: true,
      source: 'ecb.europa.eu',
      lastVerified: '2026-09-07',
    },
    boe: {
      role: 'Governor of the Bank of England',
      name: 'Andrew Bailey',
      since: '2020-03-16',
      termEnds: '2028-03-15',
      source: 'bankofengland.co.uk',
      lastVerified: '2026-09-07',
    },
    au: {
      treasurer: 'Jim Chalmers',
      primeMinister: 'Anthony Albanese',
      source: 'pm.gov.au / treasury.gov.au',
      lastVerified: '2026-09-07',
    },
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

    // The RBA trade-weighted index — the AUD against a basket of Australia's
    // trading partners, weighted by trade share. It lived as a bare literal in
    // FXModule (`const AUD_TWI = 65.5`) with a comment for a date; it belongs
    // here with the rest of the hand-maintained figures so the staleness badge
    // applies to it like everything else.
    //
    // NO DAILY CHANGE FIGURE. The RBA publishes the TWI every business day,
    // but this build holds one verified snapshot, not the series — so there is
    // no "+0.2% today" to compute and none is shown. The card states the level
    // and its date, and puts the live 30-day AUD move against the majors
    // beside it as the change figure that IS measured.
    twi: 65.5,
    twiAsOf: '2026-08-31',
    twiSource: 'rba.gov.au/statistics/frequency/exchange-rates.html',

    // ASX 200 GICS sector weights, for the portfolio's overweight/underweight
    // read against the index.
    //
    // THREE SECTORS, NOT ELEVEN — DELIBERATELY.
    //
    // These three are the ones the STW factsheet actually stated. The other
    // eight are not here because no source gave them, and the difference
    // between "Materials 42% vs ASX 25%" and "Materials 42% vs ASX 28%"
    // decides whether a reader thinks they are wildly overweight or roughly
    // in line. An index weight is precisely the kind of figure that reads as
    // authoritative and is trivially wrong from memory, so a sector with no
    // verified weight shows the portfolio's own weight and says the
    // comparison is unavailable rather than inventing the other half of it.
    //
    // Keys match mockData.js's sector strings exactly, so the lookup is
    // direct rather than going through a name-mapping table that could drift.
    asx200SectorWeights: {
      Financials: 32.38,
      Materials: 24.90,
      Health: 7.15,
    },
    asx200SectorWeightsAsOf: '2026-01-31',
    asx200SectorWeightsSource: 'SPDR S&P/ASX 200 ETF (STW) factsheet, ssga.com',

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

// ─── For MaddenAI ────────────────────────────────────────────────────────────
//
// The model had no access to any of this. Asked "what is the RBA cash rate",
// it correctly refused — because rule 2 of its system prompt forbids recalling
// a figure it was not given, and nothing gave it one. So the terminal held a
// human-verified 4.35% on screen while the analyst sitting beside it said it
// could not say. That is the wrong kind of honest.
//
// This goes into the PER-TURN context, never the system prompt. The system
// prompt is cached on a stable prefix, and a cached prompt carrying a cash rate
// is a stale cash rate the moment the RBA moves — the exact failure this file
// exists to prevent. Sent per turn, it is read fresh from the constants every
// time, and it carries its own dates so the model can say "as at 12 August"
// rather than implying it is live.
//
// Deliberately narrow: policy rates and the headline Australian series. Not
// prices, not index levels, not anything that moves intraday — those reach the
// model through the live-price context or not at all.
export function verifiedFactsForAI() {
  const { rba, fed, au } = VERIFIED_CONSTANTS
  const lines = []

  if (rba) {
    // previousRate is DELIBERATELY NOT SENT.
    //
    // It is the level before the last change, and the constants carry no date
    // for when that change happened — only the date of the last MEETING. Given
    // an undated "from 4.1%" beside a dated meeting, the model attaches one to
    // the other every time: two rewordings later it still described the
    // 12 August HOLD as "a hike from 4.10%", which is flatly wrong and is
    // exactly the kind of confident, plausible, false statement this whole
    // file exists to prevent.
    //
    // A figure that cannot be stated unambiguously is worse than an absent
    // one. The terminal's own UI shows the previous rate with its full
    // context; the model does not need it to answer "what is the cash rate".
    lines.push(
      `RBA cash rate ${rba.cashRate}% — ${(rba.lastDecisionVerb ?? 'SET').toUpperCase()} at the ${rba.lastDecision} meeting` +
      `${rba.nextMeeting ? `; next meeting ${rba.nextMeeting}` : ''}`,
    )
  }
  if (fed) {
    const fedHeld = (fed.lastDecisionVerb ?? '').toUpperCase() === 'HOLD'
    lines.push(`US Fed funds ${fed.rateRange ?? `${fed.cashRate}%`} — ${fedHeld ? 'HELD at this level' : fed.lastDecisionVerb ?? 'set'} at the ${fed.lastDecision} meeting${fed.nextMeeting ? `; next meeting ${fed.nextMeeting}` : ''}`)
  }
  if (au) {
    if (au.cpi != null) lines.push(`AU CPI ${au.cpi}% YoY (${au.cpiPeriod}), trimmed mean ${au.cpiTrimmedMean}%, RBA target band ${au.rbaTargetBand}`)
    if (au.unemployment != null) lines.push(`AU unemployment ${au.unemployment}% (${au.unemploymentPeriod})`)
    if (au.gdpAnnual != null) lines.push(`AU GDP ${au.gdpQoQ}% QoQ, ${au.gdpAnnual}% annual (${au.gdpPeriod})`)
  }
  // Office holders. Same principle as the rates: verified by a person, dated,
  // and sent per turn so an appointment change lands on the next message rather
  // than waiting for a cached prompt to expire.
  const o = VERIFIED_CONSTANTS.centralBankOfficials
  if (o) {
    const who = []
    if (o.fed?.name) who.push(`${o.fed.role}: ${o.fed.name} (since ${o.fed.since})`)
    if (o.rba?.name) who.push(`${o.rba.role}: ${o.rba.name} (since ${o.rba.since})`)
    if (o.ecb?.name) who.push(`${o.ecb.role}: ${o.ecb.name}`)
    if (o.boe?.name) who.push(`${o.boe.role}: ${o.boe.name}`)
    if (o.au?.treasurer) who.push(`Australian Treasurer: ${o.au.treasurer}`)
    if (o.au?.primeMinister) who.push(`Australian Prime Minister: ${o.au.primeMinister}`)
    if (who.length) lines.push(`Office holders — ${who.join('; ')}`)
  }

  if (!lines.length) return ''

  const verified = [rba?.lastVerified, fed?.lastVerified, au?.lastVerified].filter(Boolean).sort()[0]
  return `[VERIFIED FACTS — human-checked, dated, safe to quote${verified ? `; oldest check ${verified}` : ''}]\n`
    + lines.map((l) => `- ${l}`).join('\n')
}
