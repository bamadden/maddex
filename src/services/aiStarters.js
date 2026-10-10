// ─── MaddenAI conversation starters ─────────────────────────────────────────
//
// The four cards on an empty MaddenAI panel. With an investor profile that
// has a focus, the cards are written for that investor; otherwise the generic
// set. The quick-prompt row above them stays module-specific (AIPanel).
//
// Rates come from VERIFIED_CONSTANTS, never a literal: "4.60%" typed into a
// starter would still be asking about 4.60% the day after the RBA moved.

import VERIFIED_CONSTANTS from '../data/verifiedConstants.js'
import { experienceLabel } from './investorProfile.js'

const RATE = `${VERIFIED_CONSTANTS.rba.cashRate.toFixed(2)}%`
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase()

export const GENERIC_STARTERS = [
  { icon: '⊞', title: 'Deep dive',        subtitle: 'BHP — the business, its drivers and its risks',
    prompt: 'Analyse BHP.AX for me — the business, recent performance and its drivers, the metrics that matter for a miner, how it sits against its sector, the main risks, and what to watch next.' },
  { icon: '◉', title: 'Macro read',       subtitle: `What a ${RATE} cash rate means for the ASX`,
    prompt: 'Where is the Australian economy heading? Cover the RBA cash rate path, inflation, growth and unemployment, and what each means for ASX sectors, the AUD and bonds.' },
  { icon: '⚖️', title: 'Compare',          subtitle: 'BHP vs RIO — which suits whom, and why',
    prompt: 'Compare BHP and RIO. How do the two businesses actually differ, on which axes do they genuinely diverge, and what kind of investor does each suit?' },
  { icon: '▦', title: 'Portfolio health', subtitle: 'Concentration risk and sector gaps',
    prompt: 'Review my portfolio holdings for concentration risk and sector gaps. Where am I over-exposed, what is missing, and what are the main risks I should be aware of?' },
]

// Two sectors to set against each other: the investor's own first two picks,
// else the pairing that matters most for their focus.
const DEFAULT_PAIR = {
  INCOME: ['MATERIALS', 'FINANCIALS'],
  GROWTH: ['TECHNOLOGY', 'HEALTHCARE'],
  BALANCED: ['FINANCIALS', 'HEALTHCARE'],
  SPECULATION: ['ENERGY', 'MATERIALS'],
}

const BY_FOCUS = {
  INCOME: ([a, b]) => [
    { icon: '◈', title: 'Dividend deep dive', subtitle: 'Which ASX stocks offer the best risk-adjusted yield right now?',
      prompt: 'Which ASX stocks offer the best risk-adjusted yield right now? Weigh yield against payout ratio, earnings cover, franking and balance-sheet strength — a high yield on a falling share price is not the same as a reliable one.' },
    { icon: '▦', title: 'Portfolio health check', subtitle: 'Review my holdings for concentration risk, sector gaps, and income gaps',
      prompt: 'Review my holdings for concentration risk, sector gaps, and income gaps. Where is my income concentrated, how dependent is it on one sector, and what is missing?' },
    { icon: '◉', title: 'Macro read for income', subtitle: `How does ${RATE} RBA rate affect dividend sustainability in AU banks?`,
      prompt: `How does the ${RATE} RBA cash rate affect dividend sustainability in Australian banks? Cover net interest margins, bad-debt risk, capital requirements and payout ratios.` },
    { icon: '⚖️', title: 'Sector intelligence', subtitle: `${title(a)} vs ${title(b)} — where is the better income opportunity now?`,
      prompt: `${title(a)} vs ${title(b)} on the ASX — where is the better income opportunity now? Compare yield, payout reliability, franking and the cycle risk to each sector's dividends.` },
  ],
  GROWTH: ([a, b]) => [
    { icon: '◈', title: 'Growth screen', subtitle: 'Which ASX companies have the longest growth runway — and what is priced in?',
      prompt: 'Which ASX companies have the longest growth runway, and how much of that growth is already priced in? Separate the business quality from the valuation risk.' },
    { icon: '▦', title: 'Portfolio health check', subtitle: 'Review my holdings for concentration risk, sector gaps, and growth drivers',
      prompt: 'Review my holdings for concentration risk, sector gaps, and growth drivers. Which positions carry the growth, how correlated are they, and what is missing?' },
    { icon: '◉', title: 'Macro read for growth', subtitle: `How does a ${RATE} cash rate affect ASX growth valuations?`,
      prompt: `How does a ${RATE} RBA cash rate affect the valuations of ASX growth stocks? Explain the discount-rate mechanism and which kinds of growth company are most exposed.` },
    { icon: '⚖️', title: 'Sector intelligence', subtitle: `${title(a)} vs ${title(b)} — where is the better growth opportunity now?`,
      prompt: `${title(a)} vs ${title(b)} on the ASX — where is the better growth opportunity now? Compare earnings growth drivers, valuation and what could derail each.` },
  ],
  BALANCED: ([a, b]) => [
    { icon: '◈', title: 'Core and satellite', subtitle: 'How should a balanced ASX portfolio split core and satellite?',
      prompt: 'How should a balanced Australian portfolio think about core holdings versus satellite positions — what belongs in each, and how do income and growth trade off?' },
    { icon: '▦', title: 'Portfolio health check', subtitle: 'Review my holdings for balance between income and growth',
      prompt: 'Review my holdings for concentration risk and sector gaps, and for the balance between income and growth. Where am I tilted, and what is missing?' },
    { icon: '◉', title: 'Macro read', subtitle: `What a ${RATE} cash rate means for income and growth`,
      prompt: `What does a ${RATE} RBA cash rate mean for both income and growth investments on the ASX? Which parts of a balanced portfolio does it help, and which does it hurt?` },
    { icon: '⚖️', title: 'Sector intelligence', subtitle: `${title(a)} vs ${title(b)} — which offers the better balance now?`,
      prompt: `${title(a)} vs ${title(b)} on the ASX — which offers the better balance of income and growth now, and what are the main risks to each?` },
  ],
  SPECULATION: ([a, b]) => [
    { icon: '◈', title: 'Catalyst watch', subtitle: 'Near-term catalysts for ASX small caps — and the downside if they miss',
      prompt: 'What kinds of near-term catalysts move ASX small caps, and what is the realistic downside when they do not land? Be explicit about risk.' },
    { icon: '▦', title: 'Risk check', subtitle: 'Review my holdings for position sizing and downside risk',
      prompt: 'Review my holdings for position sizing, concentration and downside risk. Where could one bad outcome do the most damage?' },
    { icon: '◉', title: 'Macro read for risk', subtitle: `How does a ${RATE} cash rate change risk appetite?`,
      prompt: `How does a ${RATE} RBA cash rate change the market's appetite for speculative ASX names? What would shift it either way?` },
    { icon: '⚖️', title: 'Sector intelligence', subtitle: `${title(a)} vs ${title(b)} — where is the asymmetric opportunity?`,
      prompt: `${title(a)} vs ${title(b)} on the ASX — where is the more asymmetric opportunity right now, and what is the downside case for each?` },
  ],
}

// { cards, label } — label is null for the generic set.
export function getStarters(profile) {
  const build = profile?.focus && BY_FOCUS[profile.focus]
  if (!build) return { cards: GENERIC_STARTERS, label: null }
  const pair = profile.sectors?.length >= 2 ? profile.sectors.slice(0, 2) : DEFAULT_PAIR[profile.focus]
  return {
    cards: build(pair),
    label: `MATCHED TO YOUR PROFILE · ${profile.focus} · ${experienceLabel(profile.experience)}`,
  }
}
