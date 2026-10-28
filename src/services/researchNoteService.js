import { askClaudeJSON } from './api'
import { VERIFIED_CONSTANTS } from '../data/verifiedConstants'
import { COMPANY } from '../data/legalDocs'
import { eventsForAI } from './calendarService'

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
// THE STRUCTURE (2026-10-27): six sections, in sell-side order, with fixed
// counts — exactly three risks and three catalysts, three to five
// considerations — so every note reads the same way and a reader learns where
// to look. The long-form thesis, financial-analysis, valuation and technical
// sections are gone: with no figures to work from they were the padding
// that made notes run past 1,500 words. The disclaimer is no longer
// model-written; it is NOTE_DISCLAIMER below, identical on every note.
const RESEARCH_SYSTEM = `You are MaddenAI producing a professional research note for an experienced Australian investor. You MUST follow this exact structure.

ABSOLUTE CONSTRAINT — NO INVENTED FIGURES
You have not been given this security's price, market cap, multiples, earnings, segment revenue or estimates, and you cannot recall them reliably. Therefore:
- No price targets, fair values, support or resistance levels, upside or downside percentages, multiples, margins, growth rates, segment revenue shares or any other number describing this security.
- No BUY, HOLD, SELL, ACCUMULATE, REDUCE or equivalent rating. The stance is an assessment of the balance of considerations, not a recommendation.
- Where you would reach for a figure, write the judgement instead: "the larger of its two segments", "a premium to domestic peers", "margins under pressure for several halves".
- You MAY quote the figures under VERIFIED MACRO FIGURES in the user message, and only those. They describe the environment, not this security.
- Widely-known, stable facts about the business are fine: what it sells, its segments, where it operates, who it competes with.

SECTIONS — return JSON with exactly these keys:

{
  "sector": "GICS sector, e.g. Financials, Materials, Health Care",
  "exchange": "primary listing, e.g. ASX, NYSE, NASDAQ",
  "stance": "CONSTRUCTIVE" | "BALANCED" | "CAUTIOUS",
  "stanceRationale": "one sentence on why the considerations land there — no figures",
  "executiveSummary": "3-4 sentences, 60-85 words. The essential consideration; what an investor needs to know in 30 seconds.",
  "businessOverview": "80-110 words: what the company does, its key segments (by name and relative importance, no figures), its competitive position in plain English, and its geographic exposure.",
  "investmentConsiderations": ["3 to 5 bullets of at most 30 words each, a deliberate mix of supportive and cautionary, each specific to this company"],
  "macroContext": "90-120 words on how the current environment reaches THIS company's earnings. Banks: the cash rate and net interest margins. Miners: iron ore and Chinese demand. Offshore earners such as healthcare: the AUD/USD translation. Quote the verified figures that matter and name the mechanism.",
  "risks": ["exactly 3, at most 30 words each, specific and material to this company, not boilerplate"],
  "catalysts": ["exactly 3, at most 30 words each, specific upcoming events: results dates or reporting periods, commodity or data releases, RBA decisions. Use the scheduled dates in the user message where they apply."]
}

Rules:
- The section names (EXECUTIVE SUMMARY, BUSINESS OVERVIEW, INVESTMENT CONSIDERATIONS, SECTOR & MACRO CONTEXT, KEY RISKS, CATALYSTS TO WATCH) are added by the layout. Do not write them inside the values.
- Be specific to this company. If a sentence would be true of any company in its sector, cut it.
- Investment considerations: 3-5. Key risks: exactly 3. Catalysts: exactly 3.
- Total length across all sections: 400-600 words. Keep to each section's budget; a note that runs long gets cut by the reader, not finished.
- Do not state what the RBA or any central bank will do as settled ("would almost certainly seal a hike"). Say which way a result would push and leave the decision open.
- Australian English. Plain, precise prose; no hype.
- If you find yourself typing a digit that describes this security, stop and write the judgement in words.
Return ONLY valid JSON, no markdown.`

// getAssetQuote and getAssetHistory are gone with the figures they fed.
//
// Both sourced from the mock generators — getMockFMPRow synthesises a price
// for any symbol, and the crypto branch invented a 52-week band outright as
// price * 1.6 and price * 0.45. Passing that into a prompt as "Current data"
// gave the model a false anchor and made every conclusion drawn from it read
// as though it described the real security.

export const NOTE_DISCLAIMER = `This research note is general information only and does not constitute financial advice, a personal recommendation, or an offer to buy or sell any security. Past performance is not indicative of future results. The author may hold positions in securities mentioned. Always seek licensed financial advice before investing. ${COMPANY} does not hold an AFSL.`

export const STANCES = ['CONSTRUCTIVE', 'BALANCED', 'CAUTIOUS']

// Holds the model to the counts the prompt asks for, and fills the header
// fields the model should not be trusted with. The exchange comes from the
// symbol where the symbol says it; the counts are trimmed, never padded — a
// missing third risk is shown as two, not invented.
const SECTION_LABEL = /^\s*(EXECUTIVE SUMMARY|BUSINESS OVERVIEW|INVESTMENT CONSIDERATIONS|SECTOR & MACRO CONTEXT|KEY RISKS|CATALYSTS TO WATCH)\s*[—:-]\s*/i
const unlabel = (v) => (typeof v === 'string' ? v.replace(SECTION_LABEL, '') : v)

export function normaliseNote(note) {
  const a = note.asset ?? {}
  return {
    ...note,
    executiveSummary: unlabel(note.executiveSummary),
    businessOverview: unlabel(note.businessOverview),
    macroContext: unlabel(note.macroContext),
    stance: STANCES.includes(note.stance) ? note.stance : (note.stance ? 'BALANCED' : note.stance),
    exchange: /\.AX$/i.test(a.symbol ?? '') ? 'ASX' : note.exchange,
    investmentConsiderations: note.investmentConsiderations?.slice(0, 5).map(unlabel),
    risks: note.risks?.slice(0, 3).map(unlabel),
    catalysts: note.catalysts?.slice(0, 3).map(unlabel),
    disclaimer: NOTE_DISCLAIMER,
  }
}

// "ASX: BHP" — the ticker without its Yahoo-style suffix.
export const displayTicker = (a = {}) => {
  const t = String(a.symbol ?? '').replace(/\.AX$/i, '')
  return /\.AX$/i.test(a.symbol ?? '') ? `ASX: ${t}` : t
}

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
  const { rba, fed, au, commodities, rbaNextDecision: nd } = VERIFIED_CONSTANTS
  const macroBlock = [
    `- RBA cash rate: ${rba.cashRate.toFixed(2)}% (${rba.lastDecisionVerb} on ${rba.lastDecision}); next meeting ${rba.nextMeeting}`,
    `- US Fed funds: ${fed.rateRange} (${fed.lastDecisionVerb} on ${fed.lastDecision})`,
    `- AU CPI: ${au.cpi.toFixed(1)}% for the ${au.cpiPeriod}; RBA target band ${au.rbaTargetBand}`,
    `- AU CPI ${au.cpiQuarterPeriod}: trimmed mean ${au.cpiQuarterTrimmedQoQ.toFixed(1)}% q/q, ${au.cpiQuarterTrimmedYoY.toFixed(1)}% y/y; headline ${au.cpiQuarterQoQ.toFixed(1)}% q/q (ABS, ${au.cpiLastRelease})`,
    `- AU unemployment: ${au.unemployment}% (${au.unemploymentPeriod})`,
    `- AU GDP: ${au.gdpQoQ}% QoQ, ${au.gdpAnnual}% annual (${au.gdpPeriod})`,
    `- Iron ore: US$${commodities.ironOreUSD}/t (as at ${commodities.asOf})`,
    `- Brent crude: US$${commodities.brentUSD}/bbl (as at ${commodities.asOf})`,
    `- ASX 200 market P/E ${au.asx200PE}, dividend yield ${au.asx200DivYield}% (as at ${au.asxMetricsRelease})`,
    `- AU household spending: ${au.householdSpendingMoM.toFixed(1)}% m/m, ${au.householdSpendingYoY}% y/y (${au.householdSpendingPeriod}, ABS)`,
    `- NAB business confidence: ${au.nabConfidence} (${au.nabPeriod}); conditions ${au.nabConditions}`,
    ...(nd ? [`- Next RBA decision ${nd.date}: market pricing ~${nd.marketHikePct}% for a hike to ${nd.hikeRate.toFixed(2)}% (${nd.marketSource}, as at ${nd.marketAsOf})`] : []),
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

${eventsForAI(45)}

Generate the research note now.
  `.trim()

  const note = await askClaudeJSON(userContent, { maxTokens: 2200, systemPrompt: RESEARCH_SYSTEM })
  const stamped = normaliseNote({ ...note, asset, generatedAt: new Date().toISOString() })
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
// Fired on every save or delete, so MaddenAI's SAVED RESEARCH list follows
// along while it is open.
export const NOTES_CHANGED_EVENT = 'maddex:research-notes-changed'
const announce = () => { try { window.dispatchEvent(new Event(NOTES_CHANGED_EVENT)) } catch { /* non-browser */ } }

export function listNoteHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// A history entry's identity: its kind and its subject. A second note on
// the same stock replaces the first rather than filling the list with
// near-duplicates, but a deep dive does not replace a structured note.
export const noteId = (n) => `${n?.kind ?? 'note'}:${n?.asset?.symbol ?? ''}`

export const NOTE_KIND_LABEL = { note: 'RESEARCH NOTE', deepdive: 'DEEP DIVE', strategy: 'STRATEGY SESSION' }

export function saveNoteToHistory(note) {
  if (!note?.asset?.symbol) return listNoteHistory()
  try {
    const rest = listNoteHistory().filter((n) => noteId(n) !== noteId(note))
    const next = [note, ...rest].slice(0, HISTORY_KEEP)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    announce()
    return next
  } catch {
    // Quota is a real risk here: ten full notes is a lot of prose. Failing to
    // cache must never fail the note the user is currently reading.
    return listNoteHistory()
  }
}

export function deleteNoteFromHistory(id) {
  try {
    const next = listNoteHistory().filter((n) => noteId(n) !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    announce()
    return next
  } catch { return listNoteHistory() }
}

// A MaddenAI answer kept as research — a deep dive or a portfolio strategy
// session. Prose with section headers rather than the six structured fields;
// PrintableNote and notePdf lay out `body` when it is present. The first
// paragraph stands in as the summary for SHARE and the history list.
export function saveProseNote({ kind, asset, body }) {
  const text = String(body ?? '').replace(/\n?FOLLOW_UPS:.*$/s, '').trim()
  const firstPara = text.split(/\n\s*\n/).map((p) => p.replace(/^[#*\s]*[A-Z][A-Z &/—:-]{3,}:?\**\s*$/m, '').trim()).find((p) => p.length > 60 && !/^⚠|not financial advice/i.test(p)) ?? ''
  return saveNoteToHistory({ kind, asset, body: text, executiveSummary: firstPara.replace(/\*\*/g, ''), generatedAt: new Date().toISOString(), disclaimer: NOTE_DISCLAIMER })
}

// Splits a prose note into titled sections for layout. A header is a line on
// its own that is a markdown heading, wholly bold, or capitals ending in a
// colon ("OVERVIEW:"); "- " and "1. " lines are list items. Bold markers are
// dropped — the layout carries the emphasis.
export function parseProse(body) {
  const sections = []
  let cur = { title: null, blocks: [] }
  const push = () => { if (cur.title || cur.blocks.length) sections.push(cur) }
  for (const raw of String(body ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^#{1,4}\s+(.+)$/) ?? line.match(/^\*\*([^*]+)\*\*:?$/) ?? line.match(/^([A-Z0-9][A-Z0-9 &/,'’—-]{2,60}):\s*$/)
    if (heading) { push(); cur = { title: heading[1].replace(/[*:]+$/g, '').trim(), blocks: [] }; continue }
    const item = line.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/)
    const text = (item ? item[1] : line).replace(/\*\*/g, '')
    cur.blocks.push({ type: item ? 'li' : 'p', text })
  }
  push()
  return sections
}

// ─── Shareable text ──────────────────────────────────────────────────────────
//
// Plain text, for pasting into a message or an email. Carries the stance, the
// summary and the general-information line — and deliberately not the full note, which is
// long enough that a paste would be unreadable and short enough on context to
// be misquoted.
export function noteToShareText(note) {
  if (!note) return ''
  const a = note.asset ?? {}
  const date = new Date(note.generatedAt ?? Date.now()).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  return [
    `MADDEX RESEARCH — ${(a.name ?? '').toUpperCase()} (${String(a.symbol ?? '').replace(/\.AX$/i, '')})`,
    `${date} · Stance: ${note.stance ?? 'BALANCED'}`,
    '',
    note.executiveSummary ?? '',
    '',
    'Full note available at maddex.com.au',
    'General information only — not financial advice.',
  ].join('\n')
}
