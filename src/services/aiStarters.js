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

// Every card asks for description (16 Nov 2026). They used to ask "which ASX
// stocks offer the best risk-adjusted yield right now", "where is the economy
// heading", which investor each stock "suits", and to review the reader's
// holdings for "position sizing" and "what is missing": rankings, forecasts
// and personal advice. The holdings cards now ask for the composition as
// given, never for a change to it.
const DESCRIBE = 'Describe only: no outlook, no forecast and no suggestion of any action.'

export const GENERIC_STARTERS = [
  { icon: '⊞', title: 'Deep dive',        subtitle: 'BHP: the business, what it reports and its disclosed risks',
    prompt: `Describe BHP.AX: the business, what it has reported recently, how it is usually measured as a miner, how it compares with its sector on the figures given, and the risks it discloses. ${DESCRIBE}` },
  { icon: '◉', title: 'Macro read',       subtitle: `The ${RATE} cash rate and the latest figures`,
    prompt: `Describe where the Australian economy stands on the latest published figures: the RBA cash rate and recent decisions, inflation, growth and unemployment, and the channels through which each is usually described as reaching ASX sectors, the AUD and bonds. ${DESCRIBE}` },
  { icon: '⚖️', title: 'Compare',          subtitle: 'BHP and RIO: how the two businesses differ',
    prompt: `Compare BHP and RIO as businesses: what each produces, where, and the figures each reports, and where the two genuinely differ. ${DESCRIBE} No verdict on which is better.` },
  { icon: '▦', title: 'Portfolio make-up', subtitle: 'Weights by holding and sector',
    prompt: `Describe the make-up of my holdings as given: the weight of each holding and each sector, and how concentrated the list is. ${DESCRIBE} Do not suggest adding, trimming or changing anything.` },
]

// Two sectors to set against each other: the investor's own first two picks,
// else the pairing that matters most for their focus.
const DEFAULT_PAIR = {
  INCOME: ['MATERIALS', 'FINANCIALS'],
  GROWTH: ['TECHNOLOGY', 'HEALTHCARE'],
  BALANCED: ['FINANCIALS', 'HEALTHCARE'],
  SPECULATION: ['ENERGY', 'MATERIALS'],
}

const makeUp = (what) => ({ icon: '▦', title: 'Portfolio make-up', subtitle: `My holdings by sector and ${what}`,
  prompt: `Describe the make-up of my holdings as given: the weight of each holding and each sector, and ${what}. ${DESCRIBE} Do not suggest adding, trimming or changing anything.` })

const BY_FOCUS = {
  INCOME: ([a, b]) => [
    { icon: '◈', title: 'How dividends are measured', subtitle: 'Yield, payout ratio, cover and franking',
      prompt: `Explain how dividends on ASX shares are described and measured: dividend yield, payout ratio, earnings cover and franking credits, and why a yield can rise because a share price has fallen. ${DESCRIBE} No stock names or rankings.` },
    makeUp('where the dividend income in the list comes from by sector'),
    { icon: '◉', title: 'Rates and bank dividends', subtitle: `The ${RATE} cash rate and how bank earnings are described`,
      prompt: `Describe how a change in the RBA cash rate (now ${RATE}) is usually described as reaching Australian bank earnings and dividends: net interest margins, bad-debt charges, capital requirements and payout ratios. ${DESCRIBE}` },
    { icon: '⚖️', title: 'Sector comparison', subtitle: `${title(a)} and ${title(b)}: dividends compared`,
      prompt: `${title(a)} and ${title(b)} on the ASX: describe how the two sectors compare on dividends, on yield, payout history and franking, and the cycle risks each sector's dividends are exposed to. ${DESCRIBE}` },
  ],
  GROWTH: ([a, b]) => [
    { icon: '◈', title: 'How growth is measured', subtitle: 'Revenue and earnings growth, and what a valuation multiple means',
      prompt: `Explain how growth in ASX companies is usually measured and described: revenue and earnings growth, reinvestment, and what a price-to-earnings multiple does and does not say. ${DESCRIBE} No stock names or rankings.` },
    makeUp('which holdings are in growth sectors'),
    { icon: '◉', title: 'Rates and valuations', subtitle: `How a ${RATE} cash rate is linked to growth valuations`,
      prompt: `Explain the discount-rate mechanism by which interest rates are linked to the valuations of growth companies, with the RBA cash rate at ${RATE}, and which kinds of company it is usually described as affecting most. ${DESCRIBE}` },
    { icon: '⚖️', title: 'Sector comparison', subtitle: `${title(a)} and ${title(b)}: growth drivers compared`,
      prompt: `${title(a)} and ${title(b)} on the ASX: describe how the two sectors compare on growth, the earnings drivers each reports and the risks each discloses. ${DESCRIBE}` },
  ],
  BALANCED: ([a, b]) => [
    { icon: '◈', title: 'Core and satellite', subtitle: 'What the terms mean',
      prompt: `Explain what "core" and "satellite" mean when portfolios are described, and how income and growth are distinguished. ${DESCRIBE} General terms only: no allocation for me or anyone.` },
    makeUp('the split between income-paying and other holdings'),
    { icon: '◉', title: 'Macro read', subtitle: `The ${RATE} cash rate, income and growth`,
      prompt: `Describe the channels through which the RBA cash rate (now ${RATE}) is usually described as reaching income and growth investments on the ASX. ${DESCRIBE}` },
    { icon: '⚖️', title: 'Sector comparison', subtitle: `${title(a)} and ${title(b)}: income and growth compared`,
      prompt: `${title(a)} and ${title(b)} on the ASX: describe how the two sectors compare on income and growth, and the risks each is exposed to. ${DESCRIBE} No verdict on which is better.` },
  ],
  SPECULATION: ([a, b]) => [
    { icon: '◈', title: 'Small-cap events', subtitle: 'The scheduled events ASX small caps report',
      prompt: `Describe the kinds of scheduled events ASX small caps report (drilling results, approvals, contract decisions, capital raisings) and the risks they commonly disclose around them. ${DESCRIBE}` },
    makeUp('the largest single holding'),
    { icon: '◉', title: 'Rates and risk appetite', subtitle: `How a ${RATE} cash rate is linked to risk appetite`,
      prompt: `Explain how interest rates, with the RBA cash rate at ${RATE}, are usually described as linked to demand for speculative shares. ${DESCRIBE}` },
    { icon: '⚖️', title: 'Sector comparison', subtitle: `${title(a)} and ${title(b)}: what drives volatility in each`,
      prompt: `${title(a)} and ${title(b)} on the ASX: describe what is usually described as driving price volatility in each sector. ${DESCRIBE}` },
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
