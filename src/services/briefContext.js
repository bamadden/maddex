import { liveDataService } from './liveDataService'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

// The figures an AI brief is allowed to quote, and the explicit list of
// markets it must not mention.
//
// WHY THIS EXISTS
//
// The news brief used to be generated from a prompt that supplied no data at
// all and asked the model to be "factual, specific". A language model given
// that instruction and no figures does not decline — it produces figures.
// It shipped "Brent crude trading near the 83 dollar per barrel range" and
// "the 0.6480 level" for AUD/USD under a dated header at the top of the news
// feed. This app tracks neither oil nor US equities. Both numbers were
// invented, and nothing on the page said so.
//
// A retail investor acting on a fabricated oil price is a real harm, so the
// rule here is stricter than "try to be accurate": the model is given a short
// list of figures and an explicit list of markets it has no data for, and is
// told to omit those markets entirely rather than reason about them.
//
// TWO THINGS THIS DELIBERATELY DOES NOT SUPPLY
//
// 1. Index levels. VERIFIED_CONSTANTS.indices exists, but it is labelled
//    "Indicative — not a live feed" and its asx200 is 8247.3 as at
//    2026-06-30, while the live ASX 200 is around 9,610. Handing that to a
//    prompt that says "use the exact number provided" would replace an
//    invented figure with a confidently wrong one — the same failure with
//    better provenance. Index levels stay out until they come from
//    dataService.
//
// 2. Anything whose feed returned stale data. withCache falls back to an old
//    localStorage copy when a fetch fails, flagged source: 'stale'. A
//    three-day-old AUD/USD quoted as this morning's is the problem we are
//    fixing, so only 'live' and 'cache' (cache being a hit inside its TTL)
//    are treated as quotable.

const QUOTABLE = new Set(['live', 'cache'])

// Unwraps a settled withCache result, but only when the data is actually
// current. Anything stale, failed or rejected becomes null, and null means
// "do not mention this market" downstream.
const fresh = (settled) => {
  if (settled.status !== 'fulfilled') return null
  const { data, source } = settled.value ?? {}
  return data != null && QUOTABLE.has(source) ? data : null
}

// Markets the terminal has no feed for. Named explicitly in the prompt
// because a blank space invites the model to fill it, while a stated absence
// does not.
const NOT_TRACKED = [
  'Oil and energy prices',
  'US equity index moves',
  'Bond yields and spreads',
  'Individual stock prices',
  'Currency pairs other than those listed',
]

export async function gatherBriefContext() {
  // Settled individually: one dead feed should cost that figure, not the
  // whole brief.
  const [fx, crypto, gold, fg] = await Promise.allSettled([
    liveDataService.getFXRates(),
    liveDataService.getCryptoPrices(),
    liveDataService.getGoldPrice(),
    liveDataService.getFearGreed(),
  ])

  const fxData = fresh(fx)
  const cryptoData = fresh(crypto)
  const goldData = fresh(gold)
  const fgData = fresh(fg)

  const { rba, au } = VERIFIED_CONSTANTS

  return {
    audusd: fxData?.AUDUSD != null ? fxData.AUDUSD.toFixed(4) : null,
    audjpy: fxData?.AUDJPY != null ? fxData.AUDJPY.toFixed(2) : null,
    btcAud: cryptoData?.bitcoin?.aud ?? null,
    btcChange24h: cryptoData?.bitcoin?.aud_24h_change ?? null,
    // Labelled as a proxy wherever it is rendered: this is PAX Gold, an
    // ERC-20 token redeemable for an ounce in an LBMA vault. It tracks spot
    // closely but it is not a spot feed, and calling it one would be a
    // smaller version of the same dishonesty.
    goldUsd: goldData?.USD ?? null,
    goldProxy: goldData?.proxy ?? null,
    fearGreed: fgData?.value ?? null,
    fearGreedLabel: fgData?.classification ?? null,

    rbaRate: rba.cashRate,
    rbaLastVerified: rba.lastVerified,
    rbaNextMeeting: rba.nextMeeting,
    rbaLastDecision: `${rba.lastDecisionVerb} on ${rba.lastDecision}`,
    auCpi: au.cpi,
    auCpiPeriod: au.cpiPeriod,
    auUnemployment: au.unemployment,
    auUnemploymentPeriod: au.unemploymentPeriod,
    rbaTargetBand: au.rbaTargetBand,

    missing: NOT_TRACKED,
  }
}

// Renders one figure line, or an explicit prohibition when it is absent.
//
// The negative case is not padding. Omitting the line entirely leaves the
// model to infer whether silence means "unavailable" or "unremarkable"; a
// line reading NOT AVAILABLE settles it.
const line = (label, value, suffix = '') =>
  value != null && value !== ''
    ? `- ${label}: ${value}${suffix}`
    : `- ${label}: NOT AVAILABLE — do not mention`

export function buildNewsBriefPrompt(ctx) {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return `You are MaddenAI writing a morning market brief for Australian investors.

STRICT RULES — a violation destroys the reader's trust in every other figure on the page:
1. Only quote figures that appear under VERIFIED DATA below.
2. If a figure is not there, do not mention that market at all. No oil. No bonds. No US equity levels. No individual stock prices. Not even in passing, and not hedged.
3. Never round, approximate or convert a figure. Reproduce it exactly as given.
4. Where a figure is marked NOT AVAILABLE, skip that topic entirely rather than describing it qualitatively.
5. Two or three short paragraphs. Plain prose, no markdown, no headings, no bullets.
6. Close with one sentence on what Australian investors should watch today — themes only, no figures.

You are not being asked to sound comprehensive. A brief that covers three markets accurately is worth more than one that covers ten and invents two.

VERIFIED DATA — the complete set of figures you may quote:

Live feeds:
${line('AUD/USD', ctx.audusd)}
${line('AUD/JPY', ctx.audjpy)}
${line('Bitcoin', ctx.btcAud && `A$${Math.round(ctx.btcAud).toLocaleString()}`, ctx.btcChange24h != null ? ` (${ctx.btcChange24h.toFixed(1)}% 24h)` : '')}
${line('Gold', ctx.goldUsd && `US$${ctx.goldUsd.toLocaleString()}/oz`, ctx.goldProxy ? ` — priced via ${ctx.goldProxy}, a proxy for spot, describe it as indicative` : '')}
${line('Crypto Fear & Greed', ctx.fearGreed, ctx.fearGreedLabel ? ` (${ctx.fearGreedLabel})` : '')}

Verified constants (manually maintained, dated):
- RBA cash rate: ${ctx.rbaRate}% (${ctx.rbaLastDecision}; last verified ${ctx.rbaLastVerified})
- RBA next meeting: ${ctx.rbaNextMeeting}
- AU CPI: ${ctx.auCpi}% for the ${ctx.auCpiPeriod}; RBA target band ${ctx.rbaTargetBand}
- AU unemployment: ${ctx.auUnemployment}% (${ctx.auUnemploymentPeriod})

NO DATA — you have no figures for these, so do not mention them:
${ctx.missing.map((m) => `- ${m}`).join('\n')}

Index levels, including the ASX 200, are deliberately absent. Do not state one, do not estimate one, and do not describe the index as up or down by any amount. You may discuss ASX sectors and themes qualitatively.

Today: ${today}

Write the brief now. General information only, not financial advice.`
}
