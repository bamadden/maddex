// ─── Standardised "madden:ask-ai" prompt builder ──────────────────────────────
// Every asset/headline/chokepoint "ASK AI" button across the terminal funnels
// through here so AIPanel always receives the same header-field shape (for its
// context bar) regardless of which module dispatched it. The closing
// instruction line stays call-site-specific — a chokepoint isn't a "price
// action and technical levels" prompt — but the header block and the
// disclaimer are fixed.

const DISCLAIMER = 'General information only — not financial advice.'

export const DEFAULT_INSTRUCTION =
  'Provide a concise professional analysis: current price action and key technical levels, ' +
  'the 2-3 most important drivers right now, and your near-term outlook. Be direct and specific.'

export function todayAEST() {
  return new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildHeader({ name, ticker, exchange, price, change, sector, date }) {
  const lines = []
  if (name) lines.push(`Asset: ${name}${ticker ? ` (${ticker})` : ''}`)
  else if (ticker) lines.push(`Asset: ${ticker}`)
  if (exchange) lines.push(`Exchange: ${exchange}`)
  if (price) lines.push(`Current Price: ${price}`)
  if (change) lines.push(`Day Change: ${change}`)
  if (sector) lines.push(`Sector/Category: ${sector}`)
  if (date) lines.push(`Date: ${date} AEST`)
  return lines.join('\n')
}

// fields: { name, ticker, exchange, price, change, sector, date, instruction }
// `instruction` defaults to the standard price-action/technical-levels prompt —
// pass a tailored one for non-tradeable subjects (headlines, chokepoints, countries).
export function buildAskAIPrompt(fields) {
  const header = buildHeader(fields)
  const body   = fields.instruction ?? DEFAULT_INSTRUCTION
  return [header, '', body, DISCLAIMER].filter(Boolean).join('\n')
}

export function dispatchAskAI(fields) {
  const { name, ticker, exchange, price, change, sector, date } = fields
  window.dispatchEvent(new CustomEvent('madden:ask-ai', {
    detail: {
      prompt: buildAskAIPrompt(fields),
      context: { ticker, name, price, change, exchange, sector, date },
    },
  }))
}
