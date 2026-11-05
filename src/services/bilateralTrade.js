// Bilateral trade values for the Global country panel.
//
// The only bilateral figures Maddex holds are Australia's, from the ABS
// (verifiedConstants.auTrade: top five export and import partners). A pair
// that involves Australia and one of those partners gets the ABS values with
// period and source; any other pair gets null and the panel lists the partner
// by name only. Nothing is estimated or generated.

import { VERIFIED_CONSTANTS } from '../data/verifiedConstants.js'

const ALIAS = { USA: 'United States', US: 'United States', 'United States of America': 'United States', UK: 'United Kingdom', Korea: 'South Korea', 'Republic of Korea': 'South Korea' }
const canon = (name) => ALIAS[name?.trim()] ?? name?.trim()

// Australia's goods and services trade with `other`, in A$ billions, from the
// ABS. exportsBn / importsBn are null where the partner is outside that list.
export function auTradeWith(other, vc = VERIFIED_CONSTANTS) {
  const t = vc?.auTrade
  const name = canon(other)
  if (!t || !name) return null
  const ex = t.exports?.find((r) => r.country === name)?.bn ?? null
  const im = t.imports?.find((r) => r.country === name)?.bn ?? null
  if (ex == null && im == null) return null
  return { exportsBn: ex, importsBn: im, period: t.period, source: t.source, asOf: t.asOf }
}

// For the panel of `countryName`, the sourced figures for one listed partner:
// only when one side of the pair is Australia.
export function partnerTrade(countryName, partnerName, vc = VERIFIED_CONSTANTS) {
  const a = canon(countryName), b = canon(partnerName)
  if (a === 'Australia') return auTradeWith(b, vc)
  if (b === 'Australia') return auTradeWith(a, vc)
  return null
}
