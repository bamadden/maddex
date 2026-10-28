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

import { sydneyOffset } from '../utils/dateUtils.js'
import { MORTGAGE_MARGIN, repaymentChange } from '../modules/calculators/calcMath.js'

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
    // Added 2026-10-28 after the Sep-quarter CPI. The RBA's 0.8% is its August
    // SMP forecast (there is no October SMP; the next is with the 3 Nov
    // decision). The ~85% is Bloomberg data as reported by ABC News — see
    // rbaNextDecision for the reading itself.
    nextMeetingNote: 'Sep quarter trimmed mean CPI 1.0% q/q, above the RBA\'s August forecast of 0.8%. Market pricing ~85% for a fifth hike of 2026, to 4.85% (Bloomberg via ABC News, 28 Oct).',
    // AFTER EACH DECISION, fill this in as well as lastDecision / cashRate /
    // decisions. It is what MaddenAI's post-decision prompts read for the week
    // after (they switch on when lastDecision moves). keyPoints: three to five
    // short lines in the statement's own terms; marketReaction: one dated,
    // sourced sentence (AUD, ASX 200, 3-year yield) or null until there is one.
    latestStatement: {
      date: '2026-09-29',
      keyPoints: [
        'Hiked 25bp to 4.60%, the fourth increase of 2026, unanimously',
        'Upside inflation risks flagged in August are materialising',
        'The Board will do what is necessary to return inflation to target, including further increases if needed',
      ],
      marketReaction: null,
      url: 'https://www.rba.gov.au/media-releases/2026/mr-26-27.html',
    },
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
    // against A2. Votes and one-line reasons for 2026 are from each decision
    // statement (mr-26-03, -08, -12, -15, -19, -27); the Board has published
    // its vote since 2025. Append a row after each meeting.
    decisions: [
      { date: '2025-08-12', rate: 3.60, decision: 'CUT',  change: -25 },
      { date: '2026-02-03', rate: 3.85, decision: 'HIKE', change: 25, vote: 'Unanimous',
        reason: 'Inflation picked up materially in H2 2025; capacity pressures greater than assessed.' },
      { date: '2026-03-17', rate: 4.10, decision: 'HIKE', change: 25, vote: '5–4 majority',
        reason: 'Middle East conflict lifted fuel prices; material risk inflation stays above target longer.' },
      { date: '2026-05-05', rate: 4.35, decision: 'HIKE', change: 25, vote: '8–1 majority',
        reason: 'Fuel costs passing through to other prices; inflation risks tilted to the upside.' },
      { date: '2026-06-16', rate: 4.35, decision: 'HOLD', change: 0, vote: 'Unanimous',
        reason: 'Inflation still too high, but held to assess the response to three hikes.' },
      { date: '2026-08-11', rate: 4.35, decision: 'HOLD', change: 0, vote: 'Unanimous',
        reason: 'Oil shock smaller than feared so far; labour market easing a little faster than expected.' },
      { date: '2026-09-29', rate: 4.60, decision: 'HIKE', change: 25, vote: 'Unanimous',
        reason: 'Upside risks flagged in August are materialising; growth and inflation above forecast.' },
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
    // Every FOMC rate move since the 2020 emergency cut, and every 2026
    // meeting including holds, by ANNOUNCEMENT date. `rate` is the top of the
    // target range. Moves checked 2026-10-19 against the Fed's own target
    // series (DFEDTARU, which records each on its effective date, the day
    // after); 2026 decisions and votes read from each FOMC statement on
    // federalreserve.gov. Votes are for–against; `reason` paraphrases the
    // statement or names the dissents. Append a row after each meeting.
    // placeholders.js derives FED_RATE_HISTORY from this list.
    decisions: [
      { date: '2020-03-15', rate: 0.25, decision: 'CUT',  change: -100 },
      { date: '2022-03-16', rate: 0.50, decision: 'HIKE', change: 25 },
      { date: '2022-05-04', rate: 1.00, decision: 'HIKE', change: 50 },
      { date: '2022-06-15', rate: 1.75, decision: 'HIKE', change: 75 },
      { date: '2022-07-27', rate: 2.50, decision: 'HIKE', change: 75 },
      { date: '2022-09-21', rate: 3.25, decision: 'HIKE', change: 75 },
      { date: '2022-11-02', rate: 4.00, decision: 'HIKE', change: 75 },
      { date: '2022-12-14', rate: 4.50, decision: 'HIKE', change: 50 },
      { date: '2023-02-01', rate: 4.75, decision: 'HIKE', change: 25 },
      { date: '2023-03-22', rate: 5.00, decision: 'HIKE', change: 25 },
      { date: '2023-05-03', rate: 5.25, decision: 'HIKE', change: 25 },
      { date: '2023-07-26', rate: 5.50, decision: 'HIKE', change: 25 },
      { date: '2024-09-18', rate: 5.00, decision: 'CUT',  change: -50 },
      { date: '2024-11-07', rate: 4.75, decision: 'CUT',  change: -25 },
      { date: '2024-12-18', rate: 4.50, decision: 'CUT',  change: -25 },
      { date: '2025-09-17', rate: 4.25, decision: 'CUT',  change: -25 },
      { date: '2025-10-29', rate: 4.00, decision: 'CUT',  change: -25 },
      { date: '2025-12-10', rate: 3.75, decision: 'CUT',  change: -25 },
      { date: '2026-01-28', rate: 3.75, rateRange: '3.50–3.75', decision: 'HOLD', change: 0, vote: '10–2',
        reason: 'Held. Miran and Waller dissented, preferring a 25bp cut.' },
      { date: '2026-03-18', rate: 3.75, rateRange: '3.50–3.75', decision: 'HOLD', change: 0, vote: '11–1',
        reason: 'Held. Miran dissented, preferring a 25bp cut.' },
      { date: '2026-04-29', rate: 3.75, rateRange: '3.50–3.75', decision: 'HOLD', change: 0, vote: '8–4',
        reason: 'Held. Miran wanted a cut; Hammack, Kashkari and Logan opposed the statement\'s easing bias.' },
      { date: '2026-06-17', rate: 3.75, rateRange: '3.50–3.75', decision: 'HOLD', change: 0, vote: '12–0',
        reason: 'Inflation elevated, partly from energy supply shocks tied to the Middle East conflict.' },
      { date: '2026-07-29', rate: 3.75, rateRange: '3.50–3.75', decision: 'HOLD', change: 0, vote: '9–3',
        reason: 'Held. Hammack, Kashkari and Logan dissented, preferring a 25bp hike.' },
      { date: '2026-09-16', rate: 4.00, rateRange: '3.75–4.00', decision: 'HIKE', change: 25, vote: '12–0',
        reason: 'Inflation remains elevated; the hike supports a timelier return to 2%.' },
    ],
    source: 'federalreserve.gov',
    asOf: '2026-09-16',
    lastVerified: '2026-10-19',
  },
  ecb: {
    label: 'ECB', country: 'Euro area', cashRate: 2.50,
    lastDecision: '2026-09-10', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-29',
    note: 'Deposit facility rate',
    // Low of the last easing cycle, for the Rates "hike cycle" view: 2.00%
    // from June 2025; hiked to 2.25% (effective 17 Jun 2026) and 2.50%
    // (effective 16 Sep 2026) — euronews, 10 Sep 2026. Checked 2026-10-28.
    cycleLow: { rate: 2.00, date: '2025-06-11' },
    // Re-checked 2026-10-27: no decision since 10 Sep. The 28–29 Oct meeting
    // announces Thu 29 Oct, 14:15 CET.
    source: 'ecb.europa.eu', asOf: '2026-09-10', lastVerified: '2026-10-27',
  },
  boe: {
    label: 'BOE', country: 'United Kingdom', cashRate: 3.75,
    lastDecision: '2026-09-17', lastDecisionVerb: 'HOLD', nextMeeting: '2026-11-05',
    // Re-checked 2026-10-27: held 6–3 on 17 Sep (Greene, Mann, Pill for 4.00%).
    source: 'bankofengland.co.uk', asOf: '2026-09-17', lastVerified: '2026-10-27',
  },
  boj: {
    label: 'BOJ', country: 'Japan', cashRate: 1.25,
    lastDecision: '2026-09-18', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-30',
    // Low for the "hike cycle" view: −0.10%, the negative rate the BOJ ended on
    // 19 Mar 2024. 1.25% is the highest since 1995 (CNBC, 18 Sep 2026).
    cycleLow: { rate: -0.10, date: '2024-03-19' },
    // Re-checked 2026-10-27: hiked 1.00 → 1.25% on 18 Sep, 7–2 (Asada, Sato
    // dissenting). The 29–30 Oct meeting announces Fri 30 Oct.
    source: 'boj.or.jp', asOf: '2026-09-18', lastVerified: '2026-10-27',
  },
  pboc: {
    label: 'PBOC', country: 'China', cashRate: 3.00,
    lastDecision: '2026-10-20', lastDecisionVerb: 'HOLD', nextMeeting: '2026-11-20',
    // Was 3.10% with a Feb 2026 CUT — wrong on both counts. The 1Y LPR has
    // been 3.00% since the May 2025 cut; 20 Oct was the 17th straight hold.
    note: '1Y Loan Prime Rate (5Y LPR 3.50%)',
    source: 'pbc.gov.cn (via Trading Economics, 20 Oct 2026)', asOf: '2026-10-20', lastVerified: '2026-10-27',
  },
  rbnz: {
    label: 'RBNZ', country: 'New Zealand', cashRate: 2.75,
    lastDecision: '2026-09-02', lastDecisionVerb: 'HIKE', nextMeeting: '2026-10-28',
    // Re-checked 2026-10-27: no decision since the 2 Sep hike; next Wed 28 Oct.
    source: 'rbnz.govt.nz', asOf: '2026-09-02', lastVerified: '2026-10-27',
  },
  boc: {
    label: 'BOC', country: 'Canada', cashRate: 2.25,
    lastDecision: '2026-09-02', lastDecisionVerb: 'HOLD', nextMeeting: '2026-10-28',
    // Re-checked 2026-10-27: 2.25% since the 29 Oct 2025 cut; next Wed 28 Oct
    // (9:45 ET, with the MPR).
    source: 'bankofcanada.ca', asOf: '2026-09-02', lastVerified: '2026-10-27',
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
    // UPDATED 2026-10-28 — ABS monthly CPI, September 2026 (released Wed 28
    // Oct, 11:30 AEDT): "The Consumer Price Index (CPI) rose 4.3%, up from
    // 4.0% in the 12 months to August 2026." Trimmed mean 3.6%, "up from a
    // revised 3.5%" (August revised down from 3.6% on new seasonal factors).
    // Confirmed against the ABS Data API (ABS,CPI,2.0.0 3.10001.10.50.M and
    // 3.999902.20.50.M).
    cpi: 4.3,
    cpiPeriod: 'Sep 2026',
    cpiPrevious: 4.0,
    cpiPreviousPeriod: 'Aug 2026',
    cpiLastRelease: '2026-10-28',
    cpiNextRelease: '2026-11-25',       // October CPI, per the ABS release page
    cpiTrimmedMean: 3.6,
    cpiTrimmedMeanPrevious: 3.5,        // Aug 2026, revised
    cpiMoM: 0.8,                        // Sep, original (0.6% seasonally adjusted)
    // Main annual contributors, September 2026, as the release words them.
    cpiDrivers: 'Housing +5.2% y/y (new dwellings +4.7%, electricity +12.8% as Commonwealth rebates ended, rents +3.6%); automotive fuel +23.6% y/y (+9.4% in September).',
    rbaTargetBand: '2–3%',

    // September quarter 2026, published in the same release (tables 17–18
    // and Appendix 1a). Headline from Table 17 / the Data API (ABS,CPI,2.0.0
    // 2.10001.10.50.Q = 1.3); its annual change is computed from the Table 17
    // index, 103.64 against 99.73 a year earlier (+3.92%), because the table
    // does not print it. The quarterly trimmed mean (the RBA's measure) is
    // from Appendix 1a — seasonally adjusted, on the pre-October 2025 basis —
    // and is NOT on the Data API: A3604510W (q/q), A3604511X (y/y).
    cpiQuarterPeriod: 'Sep 2026 quarter',
    cpiQuarterQoQ: 1.3,
    cpiQuarterYoY: 3.9,
    cpiQuarterTrimmedQoQ: 1.0,
    cpiQuarterTrimmedYoY: 3.7,
    cpiQuarterPrevious: { period: 'Jun 2026 quarter', qoq: 0.6, trimmedQoQ: 0.8, trimmedYoY: 3.6 },
    // What the print was measured against, from the retired preview: the
    // RBA's August SMP forecast for trimmed mean q/q, and the big four's
    // published previews (CBA note 22 Oct; savings.com.au round-up 23 Oct).
    cpiQuarterRbaForecast: 0.8,         // trimmed mean q/q, RBA August SMP
    cpiQuarterForecasts: 'Trimmed mean q/q: RBA (Aug SMP) 0.8%; big four 0.9–1.0%. Headline q/q: big four 1.2–1.3%.',
    cpiQuarterUrl: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release',

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

    // UPDATED 2026-10-27 — this read A$7.2B as at an April release. The ABS
    // monthly trade release is now goods only ("International Trade in
    // Goods"); services are quarterly, in the balance of payments. August
    // 2026, released 1 Oct: the seasonally adjusted balance on goods "decreased
    // $856m" to A$495m, from A$1,351m in July. ABS Data API: ITGS
    // M1.170.20.AUS.M.
    tradeBalanceBn: 0.495,
    tradeBalancePrevBn: 1.351,
    tradeBalancePeriod: 'Aug 2026',
    tradeBalanceRelease: '2026-10-01',
    tradeBalanceNextRelease: '2026-11-05',

    // Retail Trade ended in 2025; the ABS's monthly read on consumer demand is
    // now the Monthly Household Spending Indicator. August 2026, released
    // 29 Sep: "Remained flat at 0.0% month-on-month" (current price, SA), up
    // 6.8% on August 2025. July was +1.1%. ABS Data API: HSI_M
    // 8.TOT.CUR.20.AUS.M (m/m) and 9.TOT.CUR.20.AUS.M (y/y).
    householdSpendingMoM: 0.0,
    householdSpendingPrevMoM: 1.1,
    householdSpendingYoY: 6.8,
    householdSpendingPeriod: 'Aug 2026',
    householdSpendingRelease: '2026-09-29',
    householdSpendingNextRelease: '2026-11-04',

    // NAB Monthly Business Survey, September 2026, released 13 Oct:
    // "confidence fell 4 points to -13 index points", 18 points below its
    // long-run average, a third straight monthly fall. "Business conditions
    // were unchanged at -1 index point." Not on an API — check nab.com.au.
    nabConfidence: -13,
    nabConfidencePrev: -9,
    nabConditions: -1,
    nabConditionsPrev: -1,
    nabPeriod: 'Sep 2026',
    nabRelease: '2026-10-13',
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
      { period: '2025-07', value: 3.0, trimmed: 3.0, type: 'monthly' },
      { period: '2025-08', value: 3.2, trimmed: 3.1, type: 'monthly' },
      { period: '2025-09', value: 3.6, trimmed: 3.2, type: 'monthly' },
      { period: '2025-10', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2025-11', value: 3.4, trimmed: 3.2, type: 'monthly' },
      { period: '2025-12', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2026-01', value: 3.8, trimmed: 3.3, type: 'monthly' },
      { period: '2026-02', value: 3.7, trimmed: 3.3, type: 'monthly' },
      { period: '2026-03', value: 4.6, trimmed: 3.3, type: 'monthly' },
      { period: '2026-04', value: 4.2, trimmed: 3.3, type: 'monthly' },
      { period: '2026-05', value: 4.0, trimmed: 3.5, type: 'monthly' },
      { period: '2026-06', value: 3.8, trimmed: 3.6, type: 'monthly' },
      { period: '2026-07', value: 3.5, trimmed: 3.6, type: 'monthly' },
      { period: '2026-08', value: 4.0, trimmed: 3.5, type: 'monthly' },   // trimmed revised from 3.6 on 28 Oct (as were Jul 25 3.1→3.0, Apr 26 3.4→3.3: new seasonal factors)
      { period: '2026-09', value: 4.3, trimmed: 3.6, type: 'monthly' },
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
    asOf: '2026-10-28',
    lastVerified: '2026-10-28',
  },

  // ── Other major economies ─────────────────────────────────────────────────
  // US figures refreshed 2026-10-19 from the agencies themselves: CPI and
  // unemployment from the BLS public API (CUUR0000SA0, CUUR0000SA0L1E,
  // LNS14000000, CES0000000001), GDP from BEA's Q2 third estimate. Year-on-year
  // CPI is computed from the unadjusted index, as BLS headlines it:
  // Sep 2026 336.940 / Sep 2025 324.800 = +3.7%; core 339.287 / 330.804 = +2.6%.
  // The block this replaced said CPI 2.4% for May 2026; the same index puts
  // May at +4.2%, so that figure was wrong as well as old.
  us: {
    cpi: 3.7, cpiPrevious: 3.4, cpiPeriod: 'Sep 2026', cpiRelease: '2026-10-14',
    cpiCore: 2.6, cpiCorePrevious: 2.4,
    unemployment: 4.2, unemploymentPrevious: 4.1, unemploymentPeriod: 'Sep 2026', unemploymentRelease: '2026-10-02',
    // Q2 2026, third estimate. Q1 was 2.5%. Q3 advance estimate due 29 Oct.
    gdpQoQAnnualised: 2.2, gdpPrevious: 2.5, gdpPeriod: 'Q2 2026', gdpRelease: '2026-09-30', gdpNextRelease: '2026-10-29',
    // Payroll change, thousands. Aug is the revised figure as of the Sep
    // report (Jul and Aug were revised down a combined 60k).
    nfpThousands: 29, nfpPrevious: 133, nfpRelease: '2026-10-02',
    fedFundsRelease: '2026-09-16',
    // Seasonally adjusted unemployment rate, monthly, for the Sahm-style
    // factor in recessionRisk.js. October 2025 is null: the federal
    // government shutdown meant the household survey was not collected that
    // month, and BLS publishes no figure for it.
    unemploymentHistory: [
      { period: '2024-07', value: 4.2 }, { period: '2024-08', value: 4.2 }, { period: '2024-09', value: 4.1 },
      { period: '2024-10', value: 4.1 }, { period: '2024-11', value: 4.2 }, { period: '2024-12', value: 4.1 },
      { period: '2025-01', value: 4.0 }, { period: '2025-02', value: 4.2 }, { period: '2025-03', value: 4.2 },
      { period: '2025-04', value: 4.2 }, { period: '2025-05', value: 4.3 }, { period: '2025-06', value: 4.1 },
      { period: '2025-07', value: 4.3 }, { period: '2025-08', value: 4.3 }, { period: '2025-09', value: 4.4 },
      { period: '2025-10', value: null }, { period: '2025-11', value: 4.5 }, { period: '2025-12', value: 4.4 },
      { period: '2026-01', value: 4.3 }, { period: '2026-02', value: 4.4 }, { period: '2026-03', value: 4.3 },
      { period: '2026-04', value: 4.3 }, { period: '2026-05', value: 4.3 }, { period: '2026-06', value: 4.2 },
      { period: '2026-07', value: 4.1 }, { period: '2026-08', value: 4.1 }, { period: '2026-09', value: 4.2 },
    ],
    source: 'bls.gov / bea.gov', asOf: '2026-10-14', lastVerified: '2026-10-19',
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
  // Refreshed 2026-10-22. The June levels were far out of date: the Hormuz
  // tanker attacks had lifted LNG from ~US$12 to ~US$30 and Brent from ~US$78
  // to ~US$109, and iron ore had fallen to a two-year low. Each figure now
  // carries its own date and source, and the 30 Jun levels are kept as
  // `previous` so the panel can show a real change between two dated
  // observations instead of an invented daily move. Lithium is quoted as the
  // source quotes it (CNY), not converted at a guessed rate.
  commodities: {
    ironOreUSD: 90.90,        // SGX 62% Fe, close 16 Oct (Bloomberg: under $90 intraday 15 Oct)
    thermalCoalUSD: 150.40,   // globalCOAL Newcastle, 16 Oct
    lngUSDPerMMBtu: 30.40,    // JKM spot, 20 Oct (Bloomberg)
    copperUSDPerLb: 6.64,     // LME 3-month US$14,635/t, 14 Oct
    copperUSDPerTonne: 14635,
    wheatUSDPerBu: 5.84,      // not refreshed — still the 30 Jun level
    lithiumCNYPerTonne: 104740, // GFEX most-active lithium carbonate, 12 Oct
    lithiumUSDPerTonne: 14200,  // 30 Jun level, kept for older readers
    brentUSD: 108.82,         // ICE Brent Dec settle, Tue 20 Oct (CNBC; FRED Dated Brent spot 115.22 same day)
    wtiUSD: 97.15,            // NYMEX WTI Dec settle, Tue 20 Oct (CNBC). Nov expired that day; FRED Cushing spot 107.89
    asOfBy: {
      ironOreUSD: '2026-10-16', thermalCoalUSD: '2026-10-16', lngUSDPerMMBtu: '2026-10-20',
      copperUSDPerLb: '2026-10-14', lithiumCNYPerTonne: '2026-10-12', brentUSD: '2026-10-20', wtiUSD: '2026-10-20',
      wheatUSDPerBu: '2026-06-30',
    },
    sourceBy: {
      ironOreUSD: 'SGX iron ore futures (via Bloomberg, Investing.com)',
      thermalCoalUSD: 'globalCOAL Newcastle (via Kalkine)',
      lngUSDPerMMBtu: 'Platts JKM (via Bloomberg)',
      copperUSDPerLb: 'LME 3-month',
      lithiumCNYPerTonne: 'GFEX lithium carbonate',
      brentUSD: 'ICE Brent futures (via CNBC)',
      wtiUSD: 'NYMEX WTI futures (via CNBC); spot cross-checked on FRED DCOILWTICO',
    },
    previous: {
      asOf: '2026-06-30',
      ironOreUSD: 98.40, thermalCoalUSD: 124.20, lngUSDPerMMBtu: 12.40,
      copperUSDPerLb: 4.12, brentUSD: 78.40,
    },
    source: 'Indicative — exchange settlements via news and data sites; see sourceBy',
    asOf: '2026-10-20',
    lastVerified: '2026-10-22',
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

  // ── Next RBA decision ─────────────────────────────────────────────────────
  // Market pricing is a dated reading, not a feed. UPDATED 2026-10-28 after
  // the September quarter CPI (trimmed mean 1.0% q/q against the RBA's 0.8%):
  // Bloomberg data put a 25bp hike on 3 Nov at about 85%, as reported by ABC
  // News that afternoon. No implied rate was reported with it, so none is
  // carried. Before the print, ASX 30-day futures implied 60% (rbawatch.com.au,
  // 27 Oct) and Bloomberg 51% (21 Oct).
  // The quote is the 29 Sep statement's own final paragraph (mr-26-27).
  rbaNextDecision: {
    label: 'RBA 3 Nov preview',
    date: '2026-11-03',
    time: '14:30',
    currentRate: 4.60,
    hikeRate: 4.85,
    marketHikePct: 85,
    marketImpliedRate: null,
    marketSource: 'Bloomberg data, as reported by ABC News',
    marketAsOf: '2026-10-28',
    marketContext: 'Up from 60% on ASX 30-day futures on 27 Oct (rbawatch.com.au), before the September quarter CPI.',
    keyFactor: 'Sep quarter CPI (28 Oct): trimmed mean 1.0% q/q, 3.7% y/y — above the RBA\'s own 0.8% forecast. Headline 1.3% q/q, 3.9% y/y.',
    statementQuote: 'The Board will continue to do what it considers necessary to bring inflation sustainably back to target, including increasing the cash rate target further if needed.',
    statementSource: 'RBA media release mr-26-27, 29 Sep 2026',
    statementUrl: 'https://www.rba.gov.au/media-releases/2026/mr-26-27.html',
    source: 'Bloomberg via abc.net.au (28 Oct); rba.gov.au',
    asOf: '2026-10-28',
    lastVerified: '2026-10-28',
  },

  // ── Australia's top trading partners ──────────────────────────────────────
  // ABS, International Trade: Supplementary Information, Financial Year,
  // 2024-25 — goods and services, A$ billion, read 2026-10-28. Shares are
  // computed against the release's totals (exports A$646.6b, imports
  // A$629.9b); the ABS notes country data is on a merchandise-trade basis and
  // the totals on a balance-of-payments basis, so shares are approximate. Its
  // own figures: the top five export markets were 60.2% of exports, the top
  // five import sources 48.9% of imports. `main` is an editorial summary of
  // what moves on each route, not an ABS figure. `to` is a map anchor.
  //
  // The map arcs this replaced (China A$296b, Japan 89, Korea 67…) had no
  // recorded source.
  auTrade: {
    label: 'AU trade partners',
    period: '2024-25',
    totalExportsBn: 646.6,
    totalImportsBn: 629.9,
    exports: [
      { country: 'China',          bn: 188.7, main: 'Iron ore, LNG, coal',     to: [116.4, 39.9] },
      { country: 'Japan',          bn: 69.7,  main: 'LNG, coal, beef',         to: [139.7, 35.7] },
      { country: 'United States',  bn: 54.6,  main: 'Gold, beef, services',    to: [-77.0, 38.9] },
      { country: 'South Korea',    bn: 41.3,  main: 'Iron ore, coal, LNG',     to: [126.9, 37.6] },
      { country: 'India',          bn: 35.0,  main: 'Coal, gold, education',   to: [77.2, 28.6] },
    ],
    imports: [
      { country: 'China',          bn: 120.0, main: 'Electronics, machinery',  to: [121.5, 31.2] },
      { country: 'United States',  bn: 96.8,  main: 'Machinery, services',     to: [-74.0, 40.7] },
      { country: 'Japan',          bn: 32.4,  main: 'Vehicles',                to: [135.5, 34.7] },
      { country: 'Singapore',      bn: 26.4,  main: 'Refined fuel',            to: [103.8, 1.35] },
      { country: 'Thailand',       bn: 23.5,  main: 'Vehicles',                to: [100.5, 13.75] },
    ],
    source: 'ABS, International Trade: Supplementary Information, Financial Year, 2024-25',
    sourceUrl: 'https://www.abs.gov.au/statistics/economy/international-trade/international-trade-supplementary-information-financial-year/latest-release',
    asOf: '2025-06-30',
    lastVerified: '2026-10-28',
  },

  // ── Benchmark index levels ────────────────────────────────────────────────
  // Indicative only. Live equity quotes come through dataService; these exist
  // so the intelligence map has something to label a marker with.
  indices: {
    // Real closes. Re-checked 2026-10-27: ASX 200 is the Tue 27 Oct close
    // (ABC News, MSN); S&P 500, Nasdaq Composite and Dow are the Mon 26 Oct
    // US closes (CNBC). The rest are still 30 Sep 2026 closes from the
    // 2026-10-03 check. STI, NZX 50 and TA-35 were dropped rather than
    // carried forward — no current close was found.
    asx200: 8850.1, sp500: 7676.77, nasdaq: 26169.38, dow: 52361.58,
    ftse100: 10606.0, nikkei225: 66753.72, hangSeng: 24613.27,
    sseComposite: 3842.19, dax: 25199.19, sensex: 72480.29, tsx: 35235.87,
    source: 'Index closes via ABC News, AP, Motley Fool AU, CNBC, BBN Times — indicative, not a live feed',
    asOf: '2026-10-27',
    lastVerified: '2026-10-27',
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
    if (au.cpiQuarterTrimmedQoQ != null) {
      const pq = au.cpiQuarterPrevious
      lines.push(`AU CPI ${au.cpiQuarterPeriod} (ABS, released ${au.cpiLastRelease}): headline ${au.cpiQuarterQoQ.toFixed(1)}% q/q, ${au.cpiQuarterYoY.toFixed(1)}% y/y; trimmed mean ${au.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q, ${au.cpiQuarterTrimmedYoY.toFixed(1)}% y/y${pq ? ` (${pq.period}: headline ${pq.qoq.toFixed(1)}% q/q, trimmed mean ${pq.trimmedQoQ.toFixed(1)}% q/q)` : ''}. Forecasts it was measured against — ${au.cpiQuarterForecasts}${au.cpiDrivers ? ` Drivers (${au.cpiPeriod}): ${au.cpiDrivers}` : ''}`)
    }
    if (au.unemployment != null) lines.push(`AU unemployment ${au.unemployment}% (${au.unemploymentPeriod})`)
    if (au.gdpAnnual != null) lines.push(`AU GDP ${au.gdpQoQ}% QoQ, ${au.gdpAnnual}% annual (${au.gdpPeriod})`)
  }
  // The coming RBA decision, while it is still ahead. It carries its date and
  // source so the model can attribute it.
  const now = Date.now()
  const nd = VERIFIED_CONSTANTS.rbaNextDecision
  if (nd && now < new Date(`${nd.date}T${nd.time}:00${sydneyOffset(nd.date)}`).getTime()) {
    const implied = nd.marketImpliedRate != null ? `implied ${nd.marketImpliedRate.toFixed(2)}%; ` : ''
    lines.push(`RBA ${nd.date} decision: market pricing ${nd.marketHikePct}% for a hike to ${nd.hikeRate.toFixed(2)}% (${implied}${nd.marketSource}, as at ${nd.marketAsOf}). ${nd.marketContext} 29 Sep statement: "${nd.statementQuote}"`)
    // Arithmetic, not a model guess: the same calculation as the Rates
    // hike-impact card, with its assumptions stated.
    const from = nd.currentRate + MORTGAGE_MARGIN, d = nd.hikeRate - nd.currentRate
    const m = [600_000, 800_000].map((p) => `A$${p / 1000}K +A$${Math.round(repaymentChange(p, from, d))}/month`).join(', ')
    lines.push(`Maddex's own mortgage arithmetic (not an RBA or lender figure) if the RBA hikes ${Math.round(d * 100)}bp and lenders pass it on in full (30-year P&I at an assumed variable rate of cash + ${MORTGAGE_MARGIN}% = ${from.toFixed(2)}% → ${(from + d).toFixed(2)}%): ${m}`)
  }
  // The week after an RBA decision: what was decided and said, from the
  // decision list and rba.latestStatement — filled in by a person after the
  // announcement (see the template on rba). Nothing here is inferred.
  const rbaC = VERIFIED_CONSTANTS.rba
  if (rbaC?.lastDecision) {
    const at = new Date(`${rbaC.lastDecision}T14:30:00${sydneyOffset(rbaC.lastDecision)}`).getTime()
    if (now >= at && now < at + 7 * 86400_000) {
      const d = rbaC.decisions?.find((x) => x.date === rbaC.lastDecision)
      const st = rbaC.latestStatement?.date === rbaC.lastDecision ? rbaC.latestStatement : null
      lines.push(`RBA decision ${rbaC.lastDecision}: ${rbaC.lastDecisionVerb}${rbaC.lastChange && rbaC.lastDecisionVerb !== 'HOLD' ? ` ${rbaC.lastChange}` : ''} to ${rbaC.cashRate.toFixed(2)}%${d?.vote ? `, vote ${d.vote}` : ''}.${d?.reason ? ` ${d.reason}` : ''}`
        + (st?.keyPoints?.length ? ` Statement key points: ${st.keyPoints.join('; ')}.` : '')
        + (st?.marketReaction ? ` Market reaction: ${st.marketReaction}` : '')
        + (st?.url ? ` (${st.url})` : ''))
    }
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
