// ─── MaddenAI response formatting ───────────────────────────────────────────
//
// Pure string functions for rendering a reply: inline markup (tickers,
// percentages, figures, bold), the FOLLOW_UPS line, and plain-text sharing.
// No React here, so the rules can be exercised from node.
//
// SAFETY: formatInline escapes FIRST and only then adds markup. Model output
// is untrusted text — a reply containing "<img src=x onerror=…>" must render
// as those characters, never as an element. Every tag below is one this file
// wrote. Keep it that way: never add a rule that re-inserts captured text
// without it having passed through escapeHtml.

import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from './mockData.js'
import { AU_ETFS } from '../data/etfData.js'

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Tickers ──────────────────────────────────────────────────────────────────
//
// Any CODE.AX is a ticker — the suffix is unambiguous. A BARE code links only
// if the terminal knows it, and never when it is also an everyday capitalised
// word in a market reply: "ASX 200", "ALL Ords", "a MIN of", "BOND yields",
// "V-shaped", "MA crossover". Those still link in their .AX form, which is
// how the model writes them when it means the security.
const BARE_UNSAFE = new Set(['ASX', 'ALL', 'MIN', 'COL', 'REA', 'BOND', 'GEAR', 'HACK', 'GLD', 'V', 'MA', 'MS', 'GS', 'AMD', 'META'])
const EXTRA_ASX = ['QAN', 'NCM', 'S32', 'NST', 'EVN', 'PLS', 'LTR', 'IGO', 'JHX', 'SUN', 'IAG', 'ORG', 'APA', 'TWE', 'CAR', 'SEK', 'PME', 'RMD', 'COH', 'SHL', 'ALX', 'TLC', 'BXB', 'AMC', 'ORI', 'WOR', 'NXT']
const ASX_BARE = [...new Set([
  ...Object.keys(MOCK_ASX_STOCKS).map((s) => s.replace(/\.AX$/, '')),
  ...AU_ETFS.map((e) => e.ticker),
  ...EXTRA_ASX,
])].filter((t) => !BARE_UNSAFE.has(t))
const US_BARE = Object.keys(MOCK_US_STOCKS).filter((t) => !BARE_UNSAFE.has(t))
const ASX_SET = new Set(ASX_BARE)

// Suffixed form first so "BHP.AX" is one pill, not "BHP" plus a stray ".AX".
// Lookarounds keep a code from matching inside a longer token ("XBHP", "BHP2").
const TICKER_RE = new RegExp(
  `(?<![A-Za-z0-9$/:])(?:([A-Z][A-Z0-9]{1,5})\\.AX|(${[...ASX_BARE, ...US_BARE].sort((a, b) => b.length - a.length).join('|')}))(?![A-Za-z0-9])`,
  'g',
)

// Symbol the detail panel should open. ASX codes always carry .AX — a bare
// "BHP" sent to a quote API returns the US ADR in USD, the exact failure
// tickerGuard.js exists to stop.
export const symbolFor = (code, suffixed) => (suffixed || ASX_SET.has(code) ? `${code}.AX` : code)

// Every ticker in a reply, in order of first appearance.
export function findTickers(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(TICKER_RE)) {
    const sym = symbolFor(m[1] ?? m[2], !!m[1])
    if (!out.includes(sym)) out.push(sym)
  }
  return out
}

// ── Inline markup ────────────────────────────────────────────────────────────

const NUM = String.raw`\d+(?:\.\d+)?%`
const UP = 'rose|rises|rising|up|gained|gains|gain of|climbed|jumped|rallied|advanced|added|surged|increased|higher by|lifted'
const DOWN = 'fell|falls|falling|down|dropped|declined|lost|slid|slipped|slumped|shed|tumbled|sank|eased|decreased|lower by|a fall of|a drop of'

export function formatInline(text) {
  return escapeHtml(text)
    // Bold, then italics. Bold is white rather than body grey so it reads as
    // emphasis at a glance.
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="ai-strong">$1</strong>')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em class="ai-em">$1</em>')
    // Ranges ("2-3%", "2–3%") are a rate band, not a fall — gold as a unit,
    // before the signed rule can read the hyphen as a minus.
    .replace(new RegExp(String.raw`(?<![\w.])(\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?%)`, 'g'), '<span class="ai-pct">$1</span>')
    // Signed changes. The lookbehind stops a hyphen inside a token from
    // counting as a sign.
    .replace(new RegExp(String.raw`(?<![\w.>])(\+${NUM})`, 'g'), '<span class="ai-pct-up">$1</span>')
    .replace(new RegExp(String.raw`(?<![\w.>])([-−]${NUM})`, 'g'), '<span class="ai-pct-down">$1</span>')
    // Unsigned changes whose direction the sentence states: "fell 1.8%",
    // "rose by 2%", "down about 3%". "up to 4%" is a ceiling, not a gain, and
    // does not match — the number must follow the verb directly.
    .replace(new RegExp(String.raw`\b(${UP})(\s+(?:by\s+)?(?:about\s+|around\s+|nearly\s+|almost\s+)?)(${NUM})`, 'gi'), '$1$2<span class="ai-pct-up">$3</span>')
    .replace(new RegExp(String.raw`\b(${DOWN})(\s+(?:by\s+)?(?:about\s+|around\s+|nearly\s+|almost\s+)?)(${NUM})`, 'gi'), '$1$2<span class="ai-pct-down">$3</span>')
    // Currency amounts as chips — the figures people scan back for.
    .replace(/US\$[\d,]+(?:\.\d+)?(?:[bmk]n?|B|M|K)?/g, '<span class="ai-chip">$&</span>')
    .replace(/(?<!US)A?\$[\d,]+(?:\.\d+)?(?:[bmk]n?|B|M|K)?/g, '<span class="ai-chip">$&</span>')
    // Whatever percentage is left is a level — a rate, a yield, a weight.
    .replace(new RegExp(String.raw`(?<![+\-−>\d.\w])(${NUM})`, 'g'), '<span class="ai-pct">$1</span>')
    // Tickers as pills. data-sym is read by a delegated click handler — an
    // onClick cannot survive innerHTML.
    .replace(TICKER_RE, (m, suffixedCode, bareCode) => {
      const sym = symbolFor(suffixedCode ?? bareCode, !!suffixedCode)
      return `<span class="ai-ticker" data-sym="${sym}" role="link" tabindex="0" title="Open ${sym}">${m}</span>`
    })
}

// ── Follow-ups ───────────────────────────────────────────────────────────────

const FOLLOW_RE = /^[ \t>*_]*FOLLOW[_ ]?UPS[*_]*\s*:[*_\s]*(.*)$/im
const FOLLOW_TAG = 'FOLLOW_UPS:'

// Splits a reply into the text to show and its suggested follow-ups.
//
// While a reply is still streaming the tag arrives a few characters at a
// time, so a trailing partial line that could be the start of it ("FOLL",
// "FOLLOW_U") is held back too — otherwise it flickers into view and vanishes.
export function splitFollowUps(content, { streaming = false } = {}) {
  let body = String(content ?? '')
  let followUps = []
  const m = body.match(FOLLOW_RE)
  if (m) {
    followUps = m[1]
      .split('|')
      .map((q) => q.trim().replace(/^[[("'“]+|[\])"'”]+$/g, '').trim())
      .filter((q) => q.length >= 4 && q.length <= 90)
      .slice(0, 3)
    body = body.slice(0, m.index) + body.slice(m.index + m[0].length)
  } else if (streaming) {
    const lastNl = body.lastIndexOf('\n')
    const tail = body.slice(lastNl + 1).trim().replace(/^[*_]+/, '').toUpperCase()
    if (tail && FOLLOW_TAG.startsWith(tail.slice(0, FOLLOW_TAG.length))) body = body.slice(0, lastNl + 1)
  }
  return { body: body.replace(/\s+$/, ''), followUps }
}

// ── Sharing ──────────────────────────────────────────────────────────────────

// A reply as clean plain text for pasting elsewhere: markdown markers gone,
// structure (headers, numbering, bullets) kept, attribution and the standing
// disclaimer added.
export function toShareText(body, { question = null, date = new Date() } = {}) {
  const clean = String(body ?? '')
    .split('\n')
    .map((l) => l
      .replace(/^#{1,6}\s*/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '$1')
      .replace(/^\s*[◆*•]\s+/, '• ')
      .replace(/^\s*-\s+/, '• '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const stamp = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return [
    `MaddenAI · ${stamp}`,
    question ? `Q: ${question}\n` : '',
    clean,
    '',
    '— General information only, not financial advice. Generated by MaddenAI in Maddex.',
  ].filter((x, i) => x !== '' || i === 3).join('\n')
}
