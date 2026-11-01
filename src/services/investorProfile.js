// ─── Investor profile ───────────────────────────────────────────────────────
//
// What the user tells MaddenAI about themselves: experience, focus, sectors,
// horizon and risk tolerance. Stored locally ('maddex_investor_profile') and
// read by three consumers:
//   - AIPanel: getInvestorContext() is prepended to every USER message. It is
//     never put in the system prompt — the cached prefix has to stay
//     byte-identical between users and between profile edits.
//   - AIPanel quick prompts: getProfilePrompts().
//   - The morning brief: briefProfileLines().
//
// Experience shares its values with profiles.experience_level in Supabase
// (and EXPERIENCE_CONTEXT in profileUtils), so the one setting drives both the
// system-prompt tone variant and this context block. 'ADVANCED' is labelled
// EXPERIENCED in the UI; the stored value stays compatible with the column.

const KEY = 'maddex_investor_profile'
const EVENT = 'maddex:investor-profile'

export const EXPERIENCE = [
  { value: 'BEGINNER',     label: 'BEGINNER' },
  { value: 'INTERMEDIATE', label: 'INTERMEDIATE' },
  { value: 'ADVANCED',     label: 'EXPERIENCED' },
  { value: 'PROFESSIONAL', label: 'PROFESSIONAL' },
]
export const FOCUS = ['INCOME', 'GROWTH', 'BALANCED', 'SPECULATION']
export const SECTORS = ['MATERIALS', 'FINANCIALS', 'HEALTHCARE', 'TECHNOLOGY', 'ENERGY', 'CONSUMER', 'PROPERTY', 'INFRASTRUCTURE']
export const HORIZONS = [
  { value: 'SHORT',  label: 'SHORT (<2Y)' },
  { value: 'MEDIUM', label: 'MEDIUM (2-7Y)' },
  { value: 'LONG',   label: 'LONG (7Y+)' },
]

export const riskLabel = (n) => (n <= 3 ? 'CONSERVATIVE' : n <= 7 ? 'MODERATE' : 'AGGRESSIVE')
export const experienceLabel = (v) => EXPERIENCE.find((e) => e.value === v)?.label ?? v
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase()

export const emptyProfile = (experience = 'INTERMEDIATE') => ({
  experience, focus: null, sectors: [], timeHorizon: null, riskTolerance: 5,
})

// Anything malformed in storage is dropped field by field rather than
// trusted — this text goes into every AI request.
function sanitise(p) {
  if (!p || typeof p !== 'object') return null
  const risk = Number(p.riskTolerance)
  return {
    experience:    EXPERIENCE.some((e) => e.value === p.experience) ? p.experience : 'INTERMEDIATE',
    focus:         FOCUS.includes(p.focus) ? p.focus : null,
    sectors:       Array.isArray(p.sectors) ? p.sectors.filter((s) => SECTORS.includes(s)) : [],
    timeHorizon:   HORIZONS.some((h) => h.value === p.timeHorizon) ? p.timeHorizon : null,
    riskTolerance: Number.isFinite(risk) ? Math.min(10, Math.max(1, Math.round(risk))) : 5,
    updatedAt:     typeof p.updatedAt === 'string' ? p.updatedAt : null,
  }
}

// Snapshot cached by the raw string, so useSyncExternalStore gets the same
// object back until the stored value actually changes.
let lastRaw, lastParsed = null
export function getInvestorProfile() {
  let raw = null
  try { raw = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (raw === lastRaw) return lastParsed
  lastRaw = raw
  try { lastParsed = raw ? sanitise(JSON.parse(raw)) : null } catch { lastParsed = null }
  return lastParsed
}

export function saveInvestorProfile(p) {
  const next = sanitise({ ...p, updatedAt: new Date().toISOString() })
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT))
  return next
}

export function clearInvestorProfile() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeInvestorProfile(cb) {
  const onStorage = (e) => { if (e.key === KEY) cb() }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage) }
}

// ── MaddenAI context ─────────────────────────────────────────────────────────

export function getInvestorContext(p = getInvestorProfile()) {
  if (!p) return ''
  // Reading level and topics only. Time horizon and risk tolerance stay on
  // the device and are never sent: personalisation may change tone and
  // depth, never use the reader's goals or risk appetite to suggest an
  // action (the advice line in MADDEX_SYSTEM_PROMPT).
  const lines = [
    `Reading level: ${experienceLabel(p.experience)}`,
    p.focus && `Topics of interest: ${p.focus.toLowerCase()}`,
    p.sectors.length && `Sectors of interest: ${p.sectors.join(', ')}`,
  ].filter(Boolean)
  return `READER PREFERENCES (tone and depth only):
${lines.join('\n')}

Pitch explanations to the reading level: define terms for a beginner, be technical for a professional.
Topics and sectors of interest decide which examples to reach for, nothing else.
These preferences are not the reader's objectives, financial situation or needs, and are never a reason to suggest what to buy, sell or hold.

`
}

// ── Quick prompts ────────────────────────────────────────────────────────────

const q = (label, prompt) => ({ label, prompt, dataKeys: ['asx'] })

const PROMPTS = {
  INCOME: [
    q('DIVIDEND RELIABILITY', 'What makes a dividend reliable rather than just high? Explain payout ratios, earnings cover and franking, using only figures you have been given.'),
    q("BHP'S DIVIDEND", "Is BHP's dividend sustainable? Cover payout policy, the iron ore link and what would put it at risk."),
    q('FRANKING CREDITS', 'How does franking credit work for me? Explain with a simple worked example and who benefits most.'),
    q('INCOME SECTORS', 'Which ASX sectors have historically paid most of their earnings as dividends, and what drives that? Describe the sectors; no stock picks.'),
  ],
  GROWTH: [
    q('SMALL-CAP GROWTH', 'How do analysts assess growth companies under A$5B market cap, and what are the risks particular to small caps? No stock picks.'),
    q('AU TECH OUTLOOK', 'Tech sector outlook for AU investors?'),
    q('CSL VS PRO MEDICUS', 'CSL vs Pro Medicus — growth comparison? Cover business model, growth drivers and valuation risk in words.'),
    q('WHERE IS ASX GROWTH?', 'Where is the ASX finding growth right now?'),
  ],
  BEGINNER: [
    q('WHAT IS A P/E RATIO?', 'What is a P/E ratio and does it matter?'),
    q('START INVESTING', 'How do I start investing in the ASX? Walk me through the practical steps.'),
    q('ETFS VS STOCKS', 'Explain ETFs vs individual stocks for someone starting out.'),
    q('COSTS AND FEES', 'What costs come with buying ASX shares or ETFs — brokerage, management fees, spreads — and how are they calculated?'),
  ],
  PROFESSIONAL: [
    q('YIELD CURVE & BANKS', 'Yield curve implications for AU banks? Cover net interest margin and funding costs.'),
    q('RBA FORWARD GUIDANCE', 'RBA forward guidance — read between the lines?'),
    q('IRON ORE ↔ AUD/USD', 'Iron ore correlation with AUD/USD — make the thesis and the cases where it breaks down.'),
    q('AU VS US RISK-ADJ.', 'Risk-adjusted return on AU vs US equities? Discuss the framework without inventing statistics.'),
  ],
}

// Experience decides how a question is pitched, focus decides what it is
// about. When both have a set, two of each; otherwise whichever exists.
// Null means "no personal set — use the module's own prompts".
export function getProfilePrompts(p = getInvestorProfile()) {
  if (!p) return null
  const byExperience = PROMPTS[p.experience] ?? null
  const byFocus = PROMPTS[p.focus] ?? null
  if (byExperience && byFocus) return [byExperience[0], byFocus[0], byExperience[1], byFocus[1]]
  return byExperience ?? byFocus
}

// ── Morning brief ────────────────────────────────────────────────────────────

const LEAD_WITH = {
  INCOME:      'Lead with what matters for income: dividends, yield, payout sustainability and rate sensitivity.',
  GROWTH:      'Lead with momentum, earnings and growth catalysts.',
  BALANCED:    'Balance income and growth angles evenly.',
  SPECULATION: 'Lead with volatility, catalysts and the higher-risk end of the market, and be explicit about downside.',
}

export function briefProfileLines(p = getInvestorProfile()) {
  if (!p) return ''
  const summary = [
    p.focus && `interested in ${p.focus.toLowerCase()}`,
    title(experienceLabel(p.experience)),
    p.sectors.length && p.sectors.map(title).join('/'),
  ].filter(Boolean).join(', ')
  const asks = [
    p.focus && LEAD_WITH[p.focus],
    p.sectors.length && `In SECTOR FOCUS, start with the investor's preferred sectors (${p.sectors.map(title).join(', ')}) where the day gives a reason to; do not force one in without one.`,
    p.experience === 'BEGINNER' && 'Briefly explain any term a newer investor may not know.',
  ].filter(Boolean)
  return `READER PREFERENCES (tone and topics only — never a basis for suggesting an action): ${summary}\n${asks.map((a) => `- ${a}`).join('\n')}`
}
