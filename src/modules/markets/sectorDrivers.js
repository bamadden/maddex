import { VERIFIED_CONSTANTS } from '../../data/verifiedConstants'
import { IRON_ORE_HISTORY } from '../../data/placeholders'

// What actually moves each ASX sector.
//
// WHY THIS IS A DATA FILE AND NOT A PROMPT
//
// The DRIVERS tab used to ask Claude for this at runtime, including a
// `newsStories` array specified as "recent, plausible headline affecting this
// sector" — five invented headlines per sector, rendered under a heading that
// read RECENT NEWS. A reader had no way to tell them from the real feed.
//
// The mechanism by which iron ore moves Materials, or the cash rate moves
// bank margins, is structural: it does not change day to day and does not
// need a model to restate it each morning. So the mechanism is written down
// here, once, and the READING attached to it comes from a source — a verified
// constant with an as-of date, or a live feed. Where neither exists, the
// driver says so rather than carrying a number.
//
// Every `reading` returns { value, asOf, source } or null. Null renders as
// "not connected", never as a plausible-looking figure.

const { commodities, rba, au, fed } = VERIFIED_CONSTANTS

const C_ASOF = commodities.asOf
const C_SRC = 'verifiedConstants · commodities'

// Direction, only where a prior value genuinely exists in the data. A driver
// with no comparable prior gets no arrow — an arrow is a claim about movement,
// and inventing one is the same error as inventing the level.
const dir = (cur, prev) => (prev == null || cur == null ? null : cur > prev ? 'up' : cur < prev ? 'down' : 'flat')

const ironOrePrev = IRON_ORE_HISTORY.length >= 2
  ? IRON_ORE_HISTORY[IRON_ORE_HISTORY.length - 2].value
  : null
const ironOreLatest = IRON_ORE_HISTORY.length
  ? IRON_ORE_HISTORY[IRON_ORE_HISTORY.length - 1].value
  : null

// ctx: { fx } — the live FX payload from liveDataService, or null while it
// loads or if it failed. Drivers that need it degrade to null, not to a guess.
export function sectorDrivers(sectorName, ctx = {}) {
  const fx = ctx.fx ?? null

  const audUsd = fx?.AUDUSD != null
    ? { value: fx.AUDUSD.toFixed(4), asOf: 'live', source: 'open.er-api.com' }
    : null

  const ironOre = {
    value: `US$${commodities.ironOreUSD.toFixed(2)}/t`,
    asOf: C_ASOF,
    source: C_SRC,
    trend: dir(ironOreLatest, ironOrePrev),
  }

  const BY_SECTOR = {
    Materials: [
      {
        name: 'Iron ore (62% Fe)',
        reading: ironOre,
        impact: 'The single largest earnings input for BHP, RIO and FMG. Roughly two-thirds of ASX Materials earnings track it.',
      },
      {
        name: 'China steel demand',
        reading: null,
        impact: 'China takes the majority of Australian iron ore. Property construction is the swing factor.',
        note: 'No China PMI feed connected.',
      },
      {
        name: 'AUD/USD',
        reading: audUsd,
        impact: 'Miners sell in USD and pay costs in AUD, so a weaker AUD lifts reported margins.',
      },
      {
        name: 'Copper',
        reading: { value: `US$${commodities.copperUSDPerLb.toFixed(2)}/lb`, asOf: C_ASOF, source: C_SRC },
        impact: 'Electrification demand; matters most for diversified miners rather than pure iron ore names.',
      },
    ],

    Financials: [
      {
        name: 'RBA cash rate',
        reading: {
          value: `${rba.cashRate}%`,
          asOf: rba.lastDecision,
          source: rba.source,
          trend: dir(rba.cashRate, rba.previousRate),
        },
        impact: 'Sets the floor under deposit and lending pricing. The level matters less to margins than the direction of the next move.',
      },
      {
        name: 'Net interest margin',
        reading: null,
        impact: 'The spread banks earn between funding and lending — the main driver of major-bank earnings.',
        note: 'Reported half-yearly by each bank; no feed connected.',
      },
      {
        name: 'Housing prices (CoreLogic)',
        reading: { value: `${au.corelogicHpiMoM >= 0 ? '+' : ''}${au.corelogicHpiMoM}% MoM`, asOf: au.corelogicRelease, source: 'corelogic.com.au' },
        impact: 'Mortgages dominate major-bank loan books, so housing drives both credit growth and arrears.',
      },
      {
        name: 'Unemployment',
        reading: { value: `${au.unemployment}%`, asOf: au.unemploymentLastRelease, source: au.source },
        impact: 'The key input to bad-debt provisioning. Low unemployment keeps loan losses contained.',
      },
    ],

    'Information Technology': [
      {
        name: 'AUD/USD',
        reading: audUsd,
        impact: 'WiseTech, Xero and Altium earn most revenue offshore in USD, so a weaker AUD flatters reported results.',
      },
      {
        name: 'US Fed funds',
        reading: { value: fed.rateRange, asOf: fed.lastDecision, source: fed.source },
        impact: 'Long-duration growth valuations are the most rate-sensitive on the exchange — higher discount rates compress them hardest.',
      },
      {
        name: 'Global tech sentiment',
        reading: null,
        impact: 'ASX tech trades as a high-beta follower of the Nasdaq rather than on domestic news.',
        note: 'Index prices are DEMO until an equity feed is connected.',
      },
      {
        name: 'M&A activity',
        reading: null,
        impact: 'Mid-cap ASX software has been a persistent target for offshore private equity; bids reprice the whole peer group.',
        note: 'No deal-flow feed connected.',
      },
    ],

    Energy: [
      {
        name: 'Brent crude',
        reading: { value: `US$${commodities.brentUSD.toFixed(2)}/bbl`, asOf: C_ASOF, source: C_SRC },
        impact: 'Woodside and Santos revenue tracks it directly, and most LNG contracts are oil-linked with a lag.',
      },
      {
        name: 'LNG spot',
        reading: { value: `US$${commodities.lngUSDPerMMBtu.toFixed(2)}/MMBtu`, asOf: C_ASOF, source: C_SRC },
        impact: 'Australia is among the largest LNG exporters; spot matters for uncontracted volumes.',
      },
      {
        name: 'Thermal coal',
        reading: { value: `US$${commodities.thermalCoalUSD.toFixed(2)}/t`, asOf: C_ASOF, source: C_SRC },
        impact: 'Still a meaningful earnings line for several ASX energy names despite transition pressure.',
      },
      {
        name: 'Energy transition policy',
        reading: null,
        impact: 'Safeguard mechanism settings and offshore approvals shape the cost of new supply.',
        note: 'Qualitative — no policy feed connected.',
      },
    ],

    'Health Care': [
      {
        name: 'AUD/USD',
        reading: audUsd,
        impact: 'CSL earns the bulk of revenue in USD while reporting in AUD — the sector\'s largest single swing factor.',
      },
      {
        name: 'PBS listings and pricing',
        reading: null,
        impact: 'Domestic reimbursement decisions set volume and price for locally sold therapies.',
        note: 'No PBS feed connected.',
      },
      {
        name: 'Ageing demographics',
        reading: null,
        impact: 'A structural tailwind for plasma, hearing and pathology demand — slow-moving, not a trading signal.',
        note: 'Structural; no periodic reading.',
      },
      {
        name: 'US Fed funds',
        reading: { value: fed.rateRange, asOf: fed.lastDecision, source: fed.source },
        impact: 'Affects both the discount rate on long-dated pipelines and the USD the sector earns in.',
      },
    ],

    'Consumer Discretionary': [
      {
        name: 'Consumer confidence',
        reading: null,
        impact: 'Leads discretionary spending by a month or two — the closest thing the sector has to a leading indicator.',
        note: 'Westpac-Melbourne Institute index; no feed connected.',
      },
      {
        name: 'Retail sales',
        reading: { value: `${au.retailSalesMoM >= 0 ? '+' : ''}${au.retailSalesMoM}% MoM`, asOf: au.retailSalesRelease, source: au.source },
        impact: 'The direct read on the sector\'s top line.',
      },
      {
        name: 'RBA cash rate',
        reading: {
          value: `${rba.cashRate}%`,
          asOf: rba.lastDecision,
          source: rba.source,
          trend: dir(rba.cashRate, rba.previousRate),
        },
        impact: 'Mortgage repayments come out of the same household budget as discretionary spending.',
      },
      {
        name: 'Unemployment',
        reading: { value: `${au.unemployment}%`, asOf: au.unemploymentLastRelease, source: au.source },
        impact: 'Job security drives willingness to spend on big-ticket discretionary items.',
      },
    ],

    'Consumer Staples': [
      {
        name: 'AU CPI',
        reading: {
          value: `${au.cpi}%`,
          asOf: au.cpiLastRelease,
          source: au.source,
          trend: dir(au.cpi, au.cpiPrevious),
        },
        impact: 'Staples retailers pass input costs through with a lag, so inflation shows up in margin before price.',
      },
      {
        name: 'Retail sales',
        reading: { value: `${au.retailSalesMoM >= 0 ? '+' : ''}${au.retailSalesMoM}% MoM`, asOf: au.retailSalesRelease, source: au.source },
        impact: 'Food and grocery volumes are defensive but not immune to trading-down behaviour.',
      },
      {
        name: 'Unemployment',
        reading: { value: `${au.unemployment}%`, asOf: au.unemploymentLastRelease, source: au.source },
        impact: 'Staples typically outperform when the labour market weakens — the defensive rotation destination.',
      },
    ],

  }

  // Sectors without a bespoke list get the macro set that applies to every
  // Australian sector, rather than an empty tab.
  const GENERIC = [
    {
      name: 'RBA cash rate',
      reading: {
        value: `${rba.cashRate}%`,
        asOf: rba.lastDecision,
        source: rba.source,
        trend: dir(rba.cashRate, rba.previousRate),
      },
      impact: 'Sets the discount rate applied to every domestic earnings stream.',
    },
    {
      name: 'AUD/USD',
      reading: audUsd,
      impact: 'Determines the AUD value of offshore earnings and the cost of imported inputs.',
    },
    {
      name: 'AU CPI',
      reading: {
        value: `${au.cpi}%`,
        asOf: au.cpiLastRelease,
        source: au.source,
        trend: dir(au.cpi, au.cpiPrevious),
      },
      impact: `Against the RBA's ${au.rbaTargetBand} target band — the main input to the next rate decision.`,
    },
    {
      name: 'Unemployment',
      reading: { value: `${au.unemployment}%`, asOf: au.unemploymentLastRelease, source: au.source },
      impact: 'The other half of the RBA\'s mandate, and the broadest read on domestic demand.',
    },
  ]

  return BY_SECTOR[sectorName] ?? GENERIC
}
