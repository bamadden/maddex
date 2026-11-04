// The standard words that go wherever Maddex content leaves the app or sits
// under a figure: newsletters, exported and shared reports, the footer and
// the first-use acknowledgement. One source, so every copy says the same
// thing (legal-risk pass, 1 Nov 2026).
//
// Never state or imply that Maddex is licensed, regulated or approved by
// ASIC: it is not, and these words say what it is instead.

import { formatDate } from '../utils/dateUtils.js'

export const DISCLAIMER_VERSION = 'disclaimer-2026-11-01'

export const DISCLAIMER_POINTS = [
  'General information only — not financial advice.',
  'It does not take into account your objectives, financial situation or needs.',
  'Past performance is not a reliable indicator of future performance.',
  'AI can make mistakes. Verify anything important before relying on it.',
]

export const STANDARD_DISCLAIMER = DISCLAIMER_POINTS.join(' ')

// The same four points, short enough that the footer shows all of them on
// every screen (the full sentences cut off after the second on a laptop).
export const DISCLAIMER_SHORT = [
  'General information only',
  'Not personal advice',
  'Past performance is not a reliable indicator of future performance',
  'AI can make mistakes',
]

export const NOT_LICENSED = 'Maddex does not hold an Australian Financial Services Licence and does not provide personal financial advice.'

export const AI_ASSISTED = 'Prepared with the assistance of AI (MaddenAI) from the data shown; reviewed by no person unless stated.'

// Lines for the foot of an exported or shared report.
//   asOf — the date the data describes (ISO date, ms, or Date)
//   ai   — whether AI wrote any of it
export function reportFooter({ asOf, ai = true } = {}) {
  return [
    asOf != null ? `Data as at ${formatDate(asOf instanceof Date ? asOf.getTime() : asOf)}.` : null,
    ai ? AI_ASSISTED : null,
    STANDARD_DISCLAIMER,
    NOT_LICENSED,
  ].filter(Boolean)
}
