// ─── Market regime ──────────────────────────────────────────────────────────
//
// A one-word read on the policy backdrop — TIGHTENING / EASING / ON HOLD — and
// a short stance for the RBA, the Fed and the Australian outlook, all derived
// from VERIFIED_CONSTANTS rather than typed in. When the RBA's next decision
// lands in the constants, the regime, MaddenAI's context and the Dashboard
// quick prompts follow with no edit here.
//
// Stances say what the banks did and said, not what they will do: "door open
// to further hikes" is from the RBA's own minutes; nothing here forecasts a
// move nobody announced.

import VERIFIED_CONSTANTS from '../data/verifiedConstants.js'

const verb = (cb) => String(cb?.lastDecisionVerb ?? '').toUpperCase()

export function getMarketRegime(c = VERIFIED_CONSTANTS) {
  const { rba, fed, au } = c
  const moves = [verb(rba), verb(fed)]
  const marketRegime = moves.every((v) => v === 'HIKE') ? 'TIGHTENING'
    : moves.every((v) => v === 'CUT') ? 'EASING'
    : moves.includes('HIKE') ? 'MIXED — TIGHTENING BIAS'
    : moves.includes('CUT') ? 'MIXED — EASING BIAS' : 'ON HOLD'

  const rbaOpen = /further|more hikes|if required/i.test(rba.minutes?.summary ?? '')
  const rbaStance = verb(rba) === 'HIKE'
    ? `HAWKISH — hiked ${rba.lastChange ?? ''} to ${rba.cashRate.toFixed(2)}% on ${rba.lastDecision}${rbaOpen ? '; minutes leave the door open to more hikes' : ''}`
    : verb(rba) === 'CUT' ? `DOVISH — cut to ${rba.cashRate.toFixed(2)}% on ${rba.lastDecision}` : `ON HOLD at ${rba.cashRate.toFixed(2)}%`
  const fedStance = verb(fed) === 'HIKE'
    ? `HAWKISH — hiked ${fed.lastChange ?? ''} to ${fed.rateRange} on ${fed.lastDecision}; next meeting ${fed.nextMeeting}`
    : verb(fed) === 'CUT' ? `DOVISH — cut to ${fed.rateRange} on ${fed.lastDecision}` : `ON HOLD at ${fed.rateRange}`

  const rising = au.unemploymentPrevious != null && au.unemployment > au.unemploymentPrevious
  const slowing = rising || (au.gdpAnnual != null && au.gdpAnnual < 2.5)
  const auOutlook = `${slowing ? 'SLOWING' : 'STEADY'} — GDP ${au.gdpAnnual}% annual (${au.gdpPeriod}), unemployment ${au.unemployment}% (${au.unemploymentPeriod})${rising ? ', rising' : ''}, CPI ${au.cpi.toFixed(1)}% (${au.cpiPeriod}) above the ${au.rbaTargetBand} target`

  return { marketRegime, rbaStance, fedStance, auOutlook }
}

// For MaddenAI's per-turn context.
export function regimeForAI() {
  const r = getMarketRegime()
  return `[MARKET REGIME — derived from the verified facts]\n- Regime: ${r.marketRegime}\n- RBA: ${r.rbaStance}\n- Fed: ${r.fedStance}\n- Australia: ${r.auOutlook}`
}

// Dashboard quick prompts for the current regime.
export function regimePrompts() {
  const { rba } = VERIFIED_CONSTANTS
  const rate = `${rba.cashRate.toFixed(2)}%`
  const { marketRegime } = getMarketRegime()
  if (!marketRegime.includes('TIGHTENING')) return null
  return [
    { label: 'RATE HIKES & ASX SECTORS', prompt: 'How are the RBA and Fed rate hikes affecting ASX sectors? Which sectors are most exposed to higher rates, and which have held up?', dataKeys: ['asx'] },
    { label: `WHO BENEFITS FROM ${rate}?`, prompt: `Which kinds of ASX stocks tend to benefit from a ${rate} cash rate, and why? Explain the mechanism for each — margins, cash balances, pricing power.`, dataKeys: ['asx'] },
    { label: 'BUY NOW OR WAIT?', prompt: 'In a tightening cycle like this one, what are the considerations for investing now versus waiting? Lay out both cases and what would tip the balance — not a personal recommendation.', dataKeys: ['asx', 'aud'] },
    { label: 'RISK OF MORE RBA HIKES', prompt: `What is the case for and against another RBA hike at the ${rba.nextMeeting} meeting, and what data between now and then matters most? Describe it in words — no market-implied probability.`, dataKeys: [] },
  ]
}
