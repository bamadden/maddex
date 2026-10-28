// The RBA rate environment, in one word, from the decisions verifiedConstants
// records — never typed in, so it moves when a decision is added.
//
// Rule (stated where it is shown):
//   cuts in the last 12 months exceed hikes  → EASING
//   no moves in the last 12 months           → NEUTRAL
//   hikes exceed cuts, two or fewer hikes     → TIGHTENING
//   more than two hikes in 12 months         → AGGRESSIVE TIGHTENING

import VERIFIED_CONSTANTS from '../data/verifiedConstants'

const STYLE = {
  EASING:                  '#2D8A50',
  NEUTRAL:                 '#8BA3C4',
  TIGHTENING:              '#E8A33D',
  'AGGRESSIVE TIGHTENING': '#CC4444',
}

export function rbaRateEnvironment(now = Date.now()) {
  const since = new Date(now - 365 * 86400_000).toISOString().slice(0, 10)
  const recent = (VERIFIED_CONSTANTS.rba?.decisions ?? []).filter((d) => d.date >= since)
  const hikes = recent.filter((d) => d.decision === 'HIKE').length
  const cuts = recent.filter((d) => d.decision === 'CUT').length
  const label = cuts > hikes ? 'EASING'
    : hikes === 0 && cuts === 0 ? 'NEUTRAL'
    : hikes > 2 ? 'AGGRESSIVE TIGHTENING'
    : 'TIGHTENING'
  const bp = recent.reduce((s, d) => s + (d.change ?? 0), 0)
  return { label, colour: STYLE[label], hikes, cuts, bp, rate: VERIFIED_CONSTANTS.rba?.cashRate }
}
