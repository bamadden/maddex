import { askClaudeJSON } from './api'

// Stable instruction template — the section list and JSON schema never vary,
// so they live in the cached system prefix; the per-stock figures go in the
// user message.
// Stable instruction template — the section list and JSON schema never vary,
// so they live in the cached system prefix; the per-stock context goes in the
// user message.
//
// WHAT THIS PROMPT USED TO ASK FOR, AND WHY IT NO LONGER DOES
//
// The original schema asked the model for a BUY/HOLD/SELL rating, a numeric
// targetPrice, and support/resistance arrays — and the "current data" block it
// reasoned from came out of getMockFMPRow, which synthesises a plausible price
// for any symbol. So the note rendered a gold price target and green support
// levels computed from a number that was never real, in a layout that looked
// exactly like a broker note.
//
// A price target is a valuation output. This terminal has no earnings
// estimates, no discount rate and no live price for ASX names, so any target
// the model produced was a guess wearing a decimal point. The note keeps
// everything a model can legitimately do — the business, the thesis, the
// catalysts, the risks, the qualitative valuation read — and states none of
// the figures it cannot know.
const RESEARCH_SYSTEM = `You are MaddenAI, an institutional-grade financial analyst. Generate a comprehensive research note for the asset the user names.

ABSOLUTE CONSTRAINT — NO INVENTED FIGURES
You have not been given this asset's price, market cap, P/E, earnings or estimates, and you cannot recall them. Therefore:
- Do NOT state a price target, a fair value, a support or resistance level, a percentage upside or downside, a multiple, a margin, a growth rate, or any other number describing this security.
- Do NOT give a BUY, HOLD, SELL, ACCUMULATE, REDUCE or equivalent rating. You are writing analysis, not a recommendation.
- Where you would reach for a figure, write the judgement instead: "trading at a premium to its historical range", "cheap relative to domestic peers on most measures", "margins have been compressing for several halves". These are assessments a reader can weigh. A fabricated number is not.
- This applies to the technical section too. Describe the trend and what would confirm or invalidate it in words. Do not name levels.

You may reference widely-known, stable facts about the business — what it sells, which markets it operates in, its major segments, its competitive position. You may not attach current figures to them.

Generate a professional research note with these EXACT sections in this order. Return as JSON:

{
  "stance": "CONSTRUCTIVE" | "BALANCED" | "CAUTIOUS" | "UNDER REVIEW",
  "stanceRationale": "one sentence on why the analysis lands there — no figures, and not a recommendation to trade",
  "timeHorizon": "3 months" | "6 months" | "12 months",
  "riskRating": "LOW" | "MEDIUM" | "HIGH" | "SPECULATIVE",
  "executiveSummary": "2-3 sentence summary",
  "investmentThesis": "3-4 paragraphs on the core argument, positive and negative",
  "businessOverview": "2-3 paragraphs on what the company does",
  "financialAnalysis": {
    "revenueOutlook": "paragraph — direction and drivers, no figures",
    "marginAnalysis": "paragraph — direction and drivers, no figures",
    "balanceSheet": "paragraph — condition and flexibility, no figures",
    "cashFlow": "paragraph — quality and conversion, no figures"
  },
  "valuationAnalysis": "2-3 paragraphs assessing valuation qualitatively — premium or discount, to what, and why. No multiples, no target.",
  "catalysts": ["catalyst 1", "catalyst 2", "catalyst 3"],
  "risks": ["risk 1", "risk 2", "risk 3", "risk 4"],
  "technicalAnalysis": {
    "trend": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
    "momentum": "paragraph describing momentum and what would change it — no price levels"
  },
  "conclusion": "2-3 sentence conclusion",
  "disclaimer": "This research note is general information only and does not constitute financial advice. It contains no price targets or valuations — every figure relevant to a decision should be taken from live market data, not from this note. Past performance is not indicative of future results. Maddex and its affiliates may hold positions in securities mentioned. Always consider your personal financial situation before making investment decisions."
}

Be substantive, professional, and Australian-investor-focused. A note that reasons carefully about three things beats one that gestures at ten.
If you find yourself typing a digit that describes this security, stop and write the judgement in words instead.
Return ONLY valid JSON, no markdown.`

// getAssetQuote and getAssetHistory are gone with the figures they fed.
//
// Both sourced from the mock generators — getMockFMPRow synthesises a price
// for any symbol, and the crypto branch invented a 52-week band outright as
// price * 1.6 and price * 0.45. Passing that into a prompt as "Current data"
// gave the model a false anchor and made every conclusion drawn from it read
// as though it described the real security.

export const RESEARCH_NOTE_STEPS = [
  'Reviewing the business...',
  'Running fundamental analysis...',
  'Generating investment thesis...',
  'Compiling research note...',
]

// asset: { symbol, name, type } — the same shape DetailModal/Screener pass
// around already (openModal's argument, or a screener row).
export async function generateResearchNote(asset) {
  const userContent = `
Analyse ${asset.name} (${asset.symbol}).

Today: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

You have been given no price, market cap, multiple or estimate for this asset, and none is available to you. Write the note within that constraint — qualitative judgements only, no figures describing the security.

Generate the full research note now.
  `.trim()

  const note = await askClaudeJSON(userContent, { maxTokens: 4000, systemPrompt: RESEARCH_SYSTEM })
  return { ...note, asset, generatedAt: new Date().toISOString() }
}
