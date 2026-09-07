import { askClaudeJSON } from './api'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'

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
  "executiveSummary": "2-3 sentence summary — what a reader should know in 30 seconds",
  "investmentConsiderations": ["3-5 short bullets, a deliberate mix of supportive and cautionary — each one clause, no figures"],
  "investmentThesis": "3-4 paragraphs on the core argument, positive and negative",
  "businessOverview": "2-3 paragraphs on what the company does",
  "financialAnalysis": {
    "revenueOutlook": "paragraph — direction and drivers, no figures",
    "marginAnalysis": "paragraph — direction and drivers, no figures",
    "balanceSheet": "paragraph — condition and flexibility, no figures",
    "cashFlow": "paragraph — quality and conversion, no figures"
  },
  "macroContext": "2 paragraphs placing this business in the CURRENT Australian macro environment. You MAY quote the figures listed under VERIFIED MACRO FIGURES in the user message, and only those. Name the mechanism — how the cash rate reaches this company's earnings, how the AUD reaches its revenue — rather than restating the number.",
  "valuationAnalysis": "2-3 paragraphs assessing valuation qualitatively — premium or discount, to what, and why. No multiples, no target.",
  "catalysts": ["what to watch 1 — a dated or scheduled event where possible", "what to watch 2", "what to watch 3"],
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
  // THE ONE PLACE FIGURES ARE ALLOWED IN, AND WHY.
  //
  // The note may not carry a figure describing the SECURITY, because this app
  // has none. It should carry figures describing the ENVIRONMENT, because
  // those are maintained, dated and checkable in verifiedConstants — and a
  // research note that cannot say what the cash rate is while discussing a
  // bank is worse than useless, it is evasive.
  //
  // The two rules are therefore different and the prompt says so explicitly:
  // quote these, invent nothing else.
  const { rba, fed, au, commodities } = VERIFIED_CONSTANTS
  const macroBlock = [
    `- RBA cash rate: ${rba.cashRate}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}`,
    `- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})`,
    `- AU CPI: ${au.cpi}% for the ${au.cpiPeriod}; RBA target band ${au.rbaTargetBand}`,
    `- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})`,
    `- AU GDP: ${au.gdpQoQ}% QoQ, ${au.gdpAnnual}% annual (${au.gdpPeriod})`,
    `- Iron ore: US$${commodities.ironOreUSD}/t (as at ${commodities.asOf})`,
    `- Brent crude: US$${commodities.brentUSD}/bbl (as at ${commodities.asOf})`,
    `- ASX 200 market P/E ${au.asx200PE}, dividend yield ${au.asx200DivYield}% (as at ${au.asxMetricsRelease})`,
  ].join('\n')

  const userContent = `
Analyse ${asset.name} (${asset.symbol}).

Today: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

VERIFIED MACRO FIGURES — you may quote any of these, and no others:
${macroBlock}

These describe the ENVIRONMENT, not this security. Use them in macroContext to
explain how conditions reach this company's earnings. Do not use them to imply
anything numeric about the company itself.

You have been given no price, market cap, multiple or estimate for ${asset.symbol},
and none is available to you. Write the rest of the note within that
constraint — qualitative judgements only, no figures describing the security.

Generate the full research note now.
  `.trim()

  const note = await askClaudeJSON(userContent, { maxTokens: 4500, systemPrompt: RESEARCH_SYSTEM })
  const stamped = { ...note, asset, generatedAt: new Date().toISOString() }
  saveNoteToHistory(stamped)
  return stamped
}


// ─── Note history ────────────────────────────────────────────────────────────
//
// The last ten notes, newest first. A research note costs a model call and
// several seconds; regenerating one the user read yesterday because there was
// nowhere to find it again is the kind of waste that makes a premium feature
// feel cheap.
//
// Stored whole, so a note reopens exactly as it was written rather than being
// regenerated into something subtly different.
const HISTORY_KEY = 'maddex_research_notes'
const HISTORY_KEEP = 10

export function listNoteHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveNoteToHistory(note) {
  if (!note?.asset?.symbol) return listNoteHistory()
  try {
    // One entry per symbol — a second note on the same stock replaces the
    // first rather than filling the list with near-duplicates.
    const rest = listNoteHistory().filter((n) => n.asset?.symbol !== note.asset.symbol)
    const next = [note, ...rest].slice(0, HISTORY_KEEP)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    return next
  } catch {
    // Quota is a real risk here: ten full notes is a lot of prose. Failing to
    // cache must never fail the note the user is currently reading.
    return listNoteHistory()
  }
}

export function deleteNoteFromHistory(symbol) {
  try {
    const next = listNoteHistory().filter((n) => n.asset?.symbol !== symbol)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    return next
  } catch { return listNoteHistory() }
}

// ─── Shareable text ──────────────────────────────────────────────────────────
//
// Plain text, for pasting into a message or an email. Carries the stance, the
// summary and the disclaimer — and deliberately not the full note, which is
// long enough that a paste would be unreadable and short enough on context to
// be misquoted.
export function noteToShareText(note) {
  if (!note) return ''
  const a = note.asset ?? {}
  return [
    `MADDEX RESEARCH NOTE — ${(a.name ?? '').toUpperCase()} (${a.symbol ?? ''})`,
    `Generated: ${new Date(note.generatedAt ?? Date.now()).toLocaleString('en-AU')}`,
    `Stance: ${note.stance ?? 'UNDER REVIEW'}${note.riskRating ? ` · Risk: ${note.riskRating}` : ''}`,
    '',
    note.executiveSummary ?? '',
    '',
    ...(note.investmentConsiderations?.length
      ? ['Key considerations:', ...note.investmentConsiderations.map((c) => `  - ${c}`), '']
      : []),
    'General information only — not financial advice. Contains no price targets.',
    'Generated by MaddenAI via maddex.com.au',
  ].join('\n')
}
