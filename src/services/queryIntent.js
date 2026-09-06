import { TICKER_WHITELIST } from './api'

// ─── Query intent detection ────────────────────────────────────────────────
//
// Classifies what a user is actually asking so the system prompt can carry
// the right structure for it. A stock question, a head-to-head comparison and
// a macro question want visibly different answers, and a model given no shape
// produces the same flowing paragraphs for all three.
//
// ORDER MATTERS, and this is the whole difficulty. "BHP vs RIO" contains
// tickers, so a stock check would claim it first. "What is the RBA doing to
// inflation" contains RBA, which looks exactly like a ticker to a regex. So
// the checks run most-specific first: comparison, then macro, then stock.
//
// TICKERS ARE MATCHED AGAINST THE WHITELIST, NOT A SHAPE. The obvious
// /\b[A-Z]{2,5}\b/ matches RBA, CPI, GDP, ASX, AI, US and every other
// capitalised abbreviation in a macro question — it would route half the
// macro traffic into the stock branch. The whitelist already exists, is
// curated, and answers the real question: is this string a security we know?

const COMPARISON_RE = /\b(?:vs\.?|versus|compare[sd]?|comparison|against|better than|which (?:is|one))\b|\bbetween\b.+\band\b/i

const MACRO_RE = /\b(?:rba|reserve bank|federal reserve|the fed\b|fomc|ecb|boe|boj|central bank|interest rate|cash rate|rate (?:cut|rise|hike|decision)|inflation|cpi|gdp|unemployment|jobs data|economy|economic|recession|monetary policy|fiscal|budget|yield curve|bond market)\b/i

const ANALYSIS_RE = /\b(?:analys[ei]|analysis|tell me about|thoughts on|outlook (?:for|on)|should i|worth buying|worth holding|view on|deep dive|look at|what do you think of|research)\b/i

// Pulls whitelisted tickers out of a message, preserving order and dropping
// duplicates. `.AX` is stripped before the lookup so "BHP.AX" resolves.
export function extractTickers(message) {
  const found = []
  for (const raw of String(message ?? '').match(/\b[A-Za-z]{2,5}(?:\.AX)?\b/g) ?? []) {
    const sym = raw.toUpperCase().replace(/\.AX$/, '')
    if (TICKER_WHITELIST.has(sym) && !found.includes(sym)) found.push(sym)
  }
  return found
}

export function detectQueryIntent(message) {
  const msg = String(message ?? '')
  if (!msg.trim()) return null

  const tickers = extractTickers(msg)

  // Comparison first: it is the only intent that needs two subjects, and a
  // message with two tickers and "vs" is unambiguous.
  if (COMPARISON_RE.test(msg) && (tickers.length >= 2 || ANALYSIS_RE.test(msg) || MACRO_RE.test(msg))) {
    return 'comparison'
  }

  // Macro before stock. A macro question mentioning BHP as an example of iron
  // ore exposure is still a macro question, and the macro vocabulary is far
  // more distinctive than a three-letter uppercase run.
  if (MACRO_RE.test(msg)) return 'macro'

  // Stock needs either a known ticker or an explicit analysis verb. "Tell me
  // about the market" gets the analysis shape without a ticker, which is the
  // right call — it is still a request for structured judgement.
  if (tickers.length > 0 || ANALYSIS_RE.test(msg)) return 'stock'

  return null
}

// The structural guidance appended to the system prompt for each intent.
//
// Every one of these ends by restating the no-invented-figures rule. That is
// not redundancy for its own sake: these blocks are appended AFTER the main
// system prompt, and an instruction to produce "KEY METRICS" is exactly the
// kind of section heading that invites a model to fill it with plausible
// numbers. The nearest instruction wins, so the nearest instruction says no.
const GUIDANCE = {
  stock: `
QUERY SHAPE — SINGLE-ASSET ANALYSIS
The user is asking about a specific company or asset. Structure the answer under these headings, each on its own line, written as the heading word followed by an em dash:

OVERVIEW — what the business does and how it makes money. Two sentences.
RECENT PERFORMANCE — the direction price has travelled and what drove it. If no price data was supplied to you, describe the drivers and say plainly that live pricing is on the asset's detail panel.
KEY METRICS — what matters for this business and how to read it: which margin, which volume, which cycle. Name the metrics. Do NOT state values for them unless they were supplied to you.
SECTOR CONTEXT — where it sits against its peers and what the sector as a whole is facing.
RISKS — three specific risks. Specific to this company, not "market volatility".
WATCH — what a holder should be monitoring next, and roughly when.

No price targets. No valuation. No recommendation to buy, hold or sell.`,

  comparison: `
QUERY SHAPE — COMPARISON
The user is comparing two or more subjects. Structure the answer as:

THE SHORT VERSION — two sentences on how they actually differ.
[FIRST SUBJECT] — its distinct character, strengths and weaknesses.
[SECOND SUBJECT] — the same, written so the two can be read against each other.
KEY DIFFERENCES — the three axes on which they genuinely diverge. Where they are similar, say so rather than manufacturing a contrast.
WHICH SUITS WHOM — the investor profile each one fits, framed as characteristics, not as a recommendation.

Compare like with like. If one is a miner and the other a bank, say why the comparison is awkward before making it. No price targets, no verdict on which is "better".`,

  macro: `
QUERY SHAPE — MACRO
The user is asking about the economy, policy or rates. Structure the answer as:

CURRENT SITUATION — what the verified figures in your context actually show. Quote them exactly; state no figure that was not supplied.
TREND — the direction of travel and how firmly it is established.
MARKET IMPLICATIONS — what it means for ASX sectors, the AUD, and bonds. Be specific about which sectors and why.
WATCH — the upcoming releases or meetings that would change this read, with dates where you were given them.

Where you have no figure, describe direction and condition in words. A confident wrong number does more damage in a macro answer than anywhere else, because the reader cannot check it against a screen.`,
}

export const intentGuidance = (intent) => GUIDANCE[intent] ?? ''
