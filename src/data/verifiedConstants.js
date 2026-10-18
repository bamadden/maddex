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
    cashRate: 4.60,
    lastDecision: '2026-09-29',
    lastDecisionVerb: 'HIKE',
    previousRate: 4.35,
    nextMeeting: '2026-11-03',
    lastChange: '+25bp',
    nextMeetingTime: '2:30pm AEDT',
    note: 'Fourth hike of 2026, unanimous. "Upside risks flagged in August are materialising."',
    // 4.60% is above every level since Nov 2011, when the rate was cut from
    // 4.75% to 4.50% (and 4.50% to 4.25% that December). The 2023 peak was 4.35%.
    levelContext: 'the highest since 2011',
    // Minutes of the 28–29 Sep meeting, released Tue 13 Oct 2026. Wording
    // checked against the CommBank and FXStreet write-ups of the minutes; the
    // quoted phrase is the minutes' own.
    minutes: {
      released: '2026-10-13',
      meeting: '2026-09-29',
      summary: 'Board briefly weighed a pause, but stronger July inflation, widespread cost pressures and upside risks already unfolding made the case to act promptly. Unanimous. Open to "increasing the cash rate target further if required".',
      source: 'rba.gov.au minutes (via commbank.com.au, fxstreet.com)',
    },
    // Every decision since the last move of the 2025 easing cycle, by
    // ANNOUNCEMENT date (day two of the meeting, 2:30pm Sydney). Meeting dates
    // from rba.gov.au's 2026 board schedule; levels and changes checked
    // against statistical table A2 on 2026-10-19, which records the same moves
    // on their EFFECTIVE date, the day after. A2 lists only changes, so the
    // Jun and Aug holds are confirmed by the absence of an A2 row between the
    // 6 May and 30 Sep changes. `npm run check-stats` re-checks this list
    // against A2. Append a row after each meeting.
    decisions: [
      { date: '2025-08-12', rate: 3.60, decision: 'CUT',  change: -25 },
      { date: '2026-02-03', rate: 3.85, decision: 'HIKE', change: 25 },
      { date: '2026-03-17', rate: 4.10, decision: 'HIKE', change: 25 },
      { date: '2026-05-05', rate: 4.35, decision: 'HIKE', change: 25 },
      { date: '2026-06-16', rate: 4.35, decision: 'HOLD', change: 0 },
      { date: '2026-08-11', rate: 4.35, decision: 'HOLD', change: 0 },
      { date: '2026-09-29', rate: 4.60, decision: 'HIKE', change: 25 },
    ],
    source: 'rba.gov.au (mr-26-27)',
    asOf: '2026-09-29',
    lastVerified: '2026-10-18',
  },
  fed: {
    label: 'Fed',
    country: 'United States',
    cashRate: 4.00,
    rateRange: '3.75–4.00%',
    previousRate: 3.75,
    lastChange: '+25bp',
    note: 'Unanimous 12-0 vote; first hike since 2023',
    lastDecision: '2026-09-16',
    lastDecisionVerb: 'HIKE',
    nextMeeting: '2026-10-28',
    // Top of the target range after each move since Sep 2025, from the FOMC
    // statements on federalreserve.gov (the Dec 2025 cut re-checked
    // 2026-10-19). Enough history for a 12-month change; the recession
    // monitor reads it.
    decisions: [
      { date: '2025-09-17', rate: 4.25, decision: 'CUT',  change: -25 },
      { date: '2025-10-29', rate: 4.00, decision: 'CUT',  change: -25 },
      { date: '2025-12-10', rate: 3.75, decision: 'CUT',  change: -25 },
      { date: '2026-09-16', rate: 4.00, decision: 'HIKE', change: 25 },
    ],
    source: 'federalreserve.gov',
    asOf: '2026-09-16',
    lastVerified: '2026-10-18',
  },
  ecb: {
    label: 'ECB', country: 'Euro area', cashRate: 2.50,
    lastDecision: '2026-09-10', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-29',
    note: 'Deposit facility rate',
    source: 'ecb.europa.eu', asOf: '2026-09-10', lastVerified: '2026-10-01',
  },
  boe: {
    label: 'BOE', country: 'United Kingdom', cashRate: 3.75,
    lastDecision: '2026-09-17', lastDecisionVerb: 'HOLD', nextMeeting: '2026-11-05',
    source: 'bankofengland.co.uk', asOf: '2026-09-17', lastVerified: '2026-10-01',
  },
  boj: {
    label: 'BOJ', country: 'Japan', cashRate: 1.25,
    lastDecision: '2026-09-18', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-30',
    source: 'boj.or.jp', asOf: '2026-09-18', lastVerified: '2026-10-01',
  },
  pboc: {
    label: 'PBOC', country: 'China', cashRate: 3.00,
    lastDecision: '2026-09-21', lastDecisionVerb: 'HOLD', nextMeeting: '2026-10-20',
    // Was 3.10% with a Feb 2026 CUT — wrong on both counts. The 1Y LPR has
    // been 3.00% since the May 2025 cut; September was the 16th straight hold.
    note: '1Y Loan Prime Rate (5Y LPR 3.50%)',
    source: 'pbc.gov.cn (via FXStreet, 21 Sep 2026)', asOf: '2026-09-21', lastVerified: '2026-10-01',
  },
  rbnz: {
    label: 'RBNZ', country: 'New Zealand', cashRate: 2.75,
    lastDecision: '2026-09-02', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-28',
    source: 'rbnz.govt.nz', asOf: '2026-09-02', lastVerified: '2026-10-01',
  },
  boc: {
    label: 'BOC', country: 'Canada', cashRate: 2.25,
    lastDecision: '2026-09-02', lastDecisionVerb: 'HOLD', nextMeeting: '2026-10-28',
    source: 'bankofcanada.ca', asOf: '2026-09-02', lastVerified: '2026-10-01',
  },
  snb: {
    label: 'SNB', country: 'Switzerland', cashRate: 0.00,
    lastDecision: '2026-09-24', lastDecisionVerb: 'HOLD', nextMeeting: '2026-12-17',
    note: 'Next assessment date not confirmed — SNB meets quarterly',
    source: 'snb.ch', asOf: '2026-09-24', lastVerified: '2026-10-01',
  },
  riksbank: {
    label: 'Riksbank', country: 'Sweden', cashRate: 1.75,
    lastDecision: '2026-09-24', lastDecisionVerb: 'HOLD', nextMeeting: '2026-11-19',
    note: 'Effective 30 Sep; next date per the Riksbank cadence, not confirmed',
    source: 'riksbank.se', asOf: '2026-09-24', lastVerified: '2026-10-01',
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
      lastVerified: '2026-10-01',
    },
    rba: {
      role: 'Governor of the Reserve Bank of Australia',
      name: 'Michele Bullock',
      since: '2023-09-18',
      // Seven-year term. Note: not 2028 — RBA governors serve seven years,
      // and 2023 + 7 is 2030.
      termEnds: '2030-09-17',
      source: 'rba.gov.au',
      lastVerified: '2026-10-01',
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
    // UPDATED 2026-10-01 to the ABS monthly CPI, which is now the headline
    // series. Source: abs.gov.au media release "CPI rose 4.0% in the year to
    // August 2026" (released 30 Sep). July was 3.5%; June 3.8%. Trimmed mean
    // "remained steady at 3.6 per cent for the third consecutive month".
    // The 2.7% trimmed mean this file carried before was not a 2026 figure.
    cpi: 4.0,
    cpiPeriod: 'Aug 2026',
    cpiPrevious: 3.5,
    cpiPreviousPeriod: 'Jul 2026',
    cpiLastRelease: '2026-09-30',
    cpiNextRelease: '2026-10-28',
    cpiTrimmedMean: 3.6,
    rbaTargetBand: '2–3%',

    // UPDATED 2026-10-18 — Labour Force, September 2026 (released Thu 15 Oct):
    // up 0.1pt to 4.7% seasonally adjusted, a five-year high. Trend 4.6%.
    unemployment: 4.7,
    unemploymentPeriod: 'Sep 2026',
    unemploymentPrevious: 4.6,          // Aug 2026, as published 24 Sep
    unemploymentLastRelease: '2026-10-15',
    unemploymentNextRelease: '2026-11-19',


    // UPDATED 2026-09-07 — this was two quarters stale, reading 1.3% as at
    // Q4 2025 while the June 2026 national accounts were published. Growth has
    // decelerated through the year (2.6 → 2.5 → 2.1), which is a different
    // story from a flat 1.3 and reaches the recession rubric, the RBA
    // sensitivity matrix and MaddenAI's verified facts.
    // Source: abs.gov.au national accounts, June 2026 quarter.
    gdpQoQ: 0.4,
    gdpAnnual: 2.1,
    gdpPeriod: 'Jun 2026 quarter',
    // The June-quarter national accounts publish in the first week of
    // September. The exact day was not stated on the release page read here —
    // confirm at next verification.
    gdpLastRelease: '2026-09-03',

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

    // Three quarters of published annual CPI and annual GDP, for the growth /
    // inflation quadrant's trail.
    //
    // WHY THIS IS RECORDED RATHER THAN GENERATED. A trail of dots on a
    // macro plane is a claim about where the economy has been, and it is the
    // most persuasive form that claim can take — far more so than the same
    // numbers in a table. Each of these six figures is from an ABS release.
    // Where a quarter is missing, the dot is simply absent.
    auQuarterlyPath: [
      { period: 'Dec 25', cpi: 3.8, gdpAnnual: 2.6 },
      { period: 'Mar 26', cpi: 4.6, gdpAnnual: 2.5 },
      { period: 'Jun 26', cpi: 3.8, gdpAnnual: 2.1 },
    ],
    auQuarterlyPathSource: 'abs.gov.au — CPI releases and national accounts',
    auQuarterlyPathAsOf: '2026-06-30',

    // ── History series for the Macro charts ─────────────────────────────────
    //
    // Pulled from the ABS Data API on 2026-10-19 and re-checked by
    // `npm run check-stats`, which compares every point against the API.
    // These replaced hand-typed chart series that had drifted badly: the
    // old CPI chart had Sep 2025 at 2.5% (ABS: 3.2% for the quarter, 3.6% for
    // the month), unemployment had Sep 2025 at 4.0% (ABS: 4.4%), and GDP had
    // Q2 2025 at 0.3% (ABS: 0.8%).
    //
    // CPI changes frequency part-way. The ABS published the quarterly CPI as
    // the headline until the Sep quarter 2025; the complete monthly CPI
    // starts in Apr 2025 and is the headline now. The chart uses quarterly
    // points up to Mar 2025 and monthly from Apr 2025, and each point says
    // which it is. Quarterly: ABS,CPI,1.1.0 (series 3.10001.10.50.Q).
    // Monthly: ABS,CPI,2.0.0 (3.10001.10.50.M headline, 3.999902.20.50.M
    // trimmed mean). All annual % change, weighted average of eight capitals.
    cpiHistory: [
      { period: '2023-Q2', value: 6.0, type: 'quarterly' },
      { period: '2023-Q3', value: 5.4, type: 'quarterly' },
      { period: '2023-Q4', value: 4.1, type: 'quarterly' },
      { period: '2024-Q1', value: 3.6, type: 'quarterly' },
      { period: '2024-Q2', value: 3.8, type: 'quarterly' },
      { period: '2024-Q3', value: 2.8, type: 'quarterly' },
      { period: '2024-Q4', value: 2.4, type: 'quarterly' },
      { period: '2025-Q1', value: 2.4, type: 'quarterly' },
      { period: '2025-04', value: 2.4, trimmed: 3.2, type: 'monthly' },
      { period: '2025-05', value: 2.1, trimmed: 3.0, type: 'monthly' },
      { period: '2025-06', value: 1.9, trimmed: 2.8, type: 'monthly' },
      { period: '2025-07', value: 3.0, trimmed: 3.1, type: 'monthly' },
      { period: '2025-08', value: 3.2, trimmed: 3.1, type: 'monthly' },
      { period: '2025-09', value: 3.6, trimmed: 3.2, type: 'monthly' },
      { period: '2025-10', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2025-11', value: 3.4, trimmed: 3.2, type: 'monthly' },
      { period: '2025-12', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2026-01', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2026-02', value: 3.7, trimmed: 3.3, type: 'monthly' },
      { period: '2026-03', value: 4.6, trimmed: 3.3, type: 'monthly' },
      { period: '2026-04', value: 4.2, trimmed: 3.4, type: 'monthly' },
      { period: '2026-05', value: 4.0, trimmed: 3.5, type: 'monthly' },
      { period: '2026-06', value: 3.8, trimmed: 3.6, type: 'monthly' },
      { period: '2026-07', value: 3.5, trimmed: 3.6, type: 'monthly' },
      { period: '2026-08', value: 4.0, trimmed: 3.6, type: 'monthly' },
    ],

    // Unemployment rate, seasonally adjusted (ABS,LF,1.0.0 M13.3.1599.20.AUS.M),
    // rounded to one decimal as the ABS publishes it. These are the CURRENT
    // vintage, so revised months can differ from the figure first published:
    // August was released as 4.6% on 24 Sep and now sits at 4.65%, which
    // rounds to 4.7. `unemploymentPrevious` above keeps the as-published 4.6.
    unemploymentHistory: [
      { period: '2024-10', value: 4.1 }, { period: '2024-11', value: 3.9 }, { period: '2024-12', value: 4.0 },
      { period: '2025-01', value: 4.1 }, { period: '2025-02', value: 4.1 }, { period: '2025-03', value: 4.1 },
      { period: '2025-04', value: 4.1 }, { period: '2025-05', value: 4.1 }, { period: '2025-06', value: 4.3 },
      { period: '2025-07', value: 4.3 }, { period: '2025-08', value: 4.2 }, { period: '2025-09', value: 4.4 },
      { period: '2025-10', value: 4.3 }, { period: '2025-11', value: 4.3 }, { period: '2025-12', value: 4.1 },
      { period: '2026-01', value: 4.1 }, { period: '2026-02', value: 4.3 }, { period: '2026-03', value: 4.3 },
      { period: '2026-04', value: 4.5 }, { period: '2026-05', value: 4.4 }, { period: '2026-06', value: 4.4 },
      { period: '2026-07', value: 4.5 }, { period: '2026-08', value: 4.7 }, { period: '2026-09', value: 4.7 },
    ],

    // Real GDP, % change on the previous quarter, seasonally adjusted chain
    // volume (ABS,ANA_AGG,1.0.0 M2.GPM.20.AUS.Q). Current vintage.
    gdpHistory: [
      { period: '2023-Q1', value: 0.6 }, { period: '2023-Q2', value: 0.3 }, { period: '2023-Q3', value: 0.4 },
      { period: '2023-Q4', value: 0.0 }, { period: '2024-Q1', value: 0.3 }, { period: '2024-Q2', value: 0.2 },
      { period: '2024-Q3', value: 0.3 }, { period: '2024-Q4', value: 0.4 }, { period: '2025-Q1', value: 0.4 },
      { period: '2025-Q2', value: 0.8 }, { period: '2025-Q3', value: 0.5 }, { period: '2025-Q4', value: 0.9 },
      { period: '2026-Q1', value: 0.3 }, { period: '2026-Q2', value: 0.4 },
    ],
    historySource: 'ABS Data API (data.api.abs.gov.au)',
    historyAsOf: '2026-10-19',

    source: 'abs.gov.au',
    asOf: '2026-10-15',
    lastVerified: '2026-10-18',
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

  // ── Sovereign 10Y benchmarks ───────────────────────────────────────────────
  // The two points the dashboard widget, the brief and the Bonds hero quote.
  // The full curves live in bondCurves.js and agree with these.
  bonds: {
    label: 'Bonds',
    au10y: 5.45, au10yAsOf: '2026-10-01',
    us10y: 5.19, us10yAsOf: '2026-09-30',
    source: 'home.treasury.gov (US par curve) / tradingeconomics.com (AU)',
    asOf: '2026-10-01',
    lastVerified: '2026-10-01',
  },

  // ── Benchmark index levels ────────────────────────────────────────────────
  // Indicative only. Live equity quotes come through dataService; these exist
  // so the intelligence map has something to label a marker with.
  indices: {
    // Real closes. ASX 200, S&P 500, Nasdaq and Dow re-checked 2026-10-18:
    // Fri 16 Oct 2026 closes (ABC News / AP). The rest are still 30 Sep 2026
    // closes from the 2026-10-03 check. STI, NZX 50 and TA-35 were dropped
    // rather than carried forward — no current close was found.
    asx200: 8806.7, sp500: 7659.44, nasdaq: 26140.03, dow: 52002.41,
    ftse100: 10606.0, nikkei225: 66753.72, hangSeng: 24613.27,
    sseComposite: 3842.19, dax: 25199.19, sensex: 72480.29, tsx: 35235.87,
    source: 'Index closes via ABC News, AP, Motley Fool AU, CNBC, BBN Times — indicative, not a live feed',
    asOf: '2026-10-16',
    lastVerified: '2026-10-18',
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Whole days since a group was last confirmed correct. null when the key or
// its date is missing, so callers can distinguish "unknown" from "fresh".
// Groups whose figures an official feed confirmed this session (see
// services/officialStats.js). A confirmation is as good as a human check on
// that day, so it resets the staleness clock — but only for groups whose
// every checked figure matched; one mismatch confirms nothing.
const confirmedAt = {}
export function markConfirmed(key, isoDate) { confirmedAt[key] = isoDate }
export function confirmationFor(key) { return confirmedAt[key] ?? null }

export function daysSinceVerified(key) {
  const human = VERIFIED_CONSTANTS[key]?.lastVerified
  const auto = confirmedAt[key]
  const date = human && auto ? (auto > human ? auto : human) : (human ?? auto)
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
      `RBA cash rate ${rba.cashRate.toFixed(2)}% — ${(rba.lastDecisionVerb ?? 'SET').toUpperCase()}${rba.lastChange ? ` ${rba.lastChange}` : ''} at the ${rba.lastDecision} meeting` +
      `${rba.nextMeeting ? `; next meeting ${rba.nextMeeting}` : ''}` +
      `${rba.note ? ` (${rba.note})` : ''}`,
    )
    if (rba.minutes) lines.push(`RBA minutes of the ${rba.minutes.meeting} meeting (released ${rba.minutes.released}): ${rba.minutes.summary}`)
  }
  if (fed) {
    const fedHeld = (fed.lastDecisionVerb ?? '').toUpperCase() === 'HOLD'
    lines.push(`US Fed funds ${fed.rateRange ?? `${fed.cashRate}%`} — ${fedHeld ? 'HELD at this level' : fed.lastDecisionVerb ?? 'set'} at the ${fed.lastDecision} meeting${fed.nextMeeting ? `; next meeting ${fed.nextMeeting}` : ''}`)
  }
  if (rba && fed?.cashRate != null) {
    const bp = Math.round((rba.cashRate - fed.cashRate) * 100)
    lines.push(`AU/US policy spread: RBA ${rba.cashRate.toFixed(2)}% vs top of Fed range ${fed.cashRate.toFixed(2)}% = ${bp >= 0 ? '+' : ''}${bp}bp`)
  }
  if (au) {
    if (au.cpi != null) lines.push(`AU CPI ${au.cpi.toFixed(1)}% YoY (${au.cpiPeriod}; ${au.cpiPrevious}% in ${au.cpiPreviousPeriod}), trimmed mean ${au.cpiTrimmedMean}%, RBA target band ${au.rbaTargetBand}`)
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

  // A same-day confirmation against the RBA/ABS feeds counts as a check.
  const checkedOn = (k, c) => { const a = confirmedAt[k]; return a && c?.lastVerified ? (a > c.lastVerified ? a : c.lastVerified) : (c?.lastVerified ?? a) }
  const verified = [checkedOn('rba', rba), fed?.lastVerified, checkedOn('au', au)].filter(Boolean).sort()[0]
  return `[VERIFIED FACTS — human-checked, dated, safe to quote${verified ? `; oldest check ${verified}` : ''}]\n`
    + lines.map((l) => `- ${l}`).join('\n')
}
