import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { marketSession } from '../../services/newsIntelligence'
import VERIFIED_CONSTANTS, { verifiedFactsForAI } from '../../data/verifiedConstants'
import { saveInsight, isInsightSaved, listInsights, removeInsight, clearInsights, INSIGHT_LIMIT } from '../../services/savedInsights'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { askClaude, buildSystemPrompt } from '../../services/api'
import { detectQueryIntent, intentGuidance } from '../../services/queryIntent'
import { RBA_MEETINGS_2026, LAST_DECISIONS, getNextMeeting } from '../../services/centralBankSchedule'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import VoiceInterface from '../voice/VoiceInterface'
import { soundService } from '../../services/soundService'
import { createAlert } from '../../services/alertsService'
import { logActivity } from '../../services/activityLogService'
import { listConversations, saveConversation, deleteConversation } from '../../services/aiHistoryService'
import { getAiPreferences } from '../../services/aiPreferencesService'
import { getInvestorContext, getProfilePrompts } from '../../services/investorProfile'
import { formatInline, splitFollowUps, toShareText, findTickers } from '../../services/aiResponseFormat'
import { getStarters } from '../../services/aiStarters'
import { getSessionTokens, HIGH_SESSION_TOKENS } from '../../services/aiUsageService'
import { markMilestone } from '../../services/gettingStarted'
import { useInvestorProfile } from '../../hooks/useInvestorProfile'

// ── MaddenAI monthly message quota (Core tier only — Prime+ is unlimited) ──
// Tracked client-side in localStorage under a month-stamped key, so it
// resets automatically on the 1st with no cron/server job needed.
const AI_QUOTA_LIMIT = 50

function aiQuotaKey() {
  const d = new Date()
  return `madden_ai_msgcount_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getAiMessageCount() {
  try { return parseInt(localStorage.getItem(aiQuotaKey()) || '0', 10) } catch { return 0 }
}
function incrementAiMessageCount() {
  try {
    const next = getAiMessageCount() + 1
    localStorage.setItem(aiQuotaKey(), String(next))
  } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
}

// ─── Quick prompts (base templates — live data injected at call time) ─────────

const nextRbaMeeting = getNextMeeting(RBA_MEETINGS_2026)
const nextRbaLabel = nextRbaMeeting
  ? nextRbaMeeting.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  : 'the next scheduled meeting'
const lastRbaLabel = new Date(`${LAST_DECISIONS.RBA.date}T00:00:00`)
  .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })


// Readable labels for buildDynamicContext() — mirrors App.jsx's private
// MODULE_TITLES (not exported, so duplicated here rather than touching a
// file this session has already edited many times for an unrelated const).
const MODULE_LABELS = {
  dashboard: 'Dashboard', markets: 'Markets', portfolio: 'Portfolio', crypto: 'Crypto',
  fx: 'Rates & FX', macro: 'Macro', watchlist: 'Watchlist', news: 'News', global: 'Global',
  screener: 'Screener', brief: 'Morning Brief', replay: 'Market Replay', scanner: 'Market Scanner',
  calendar: 'Calendar',
}

// Module-specific prompt sets (4 each, shown as a 2×2 pill grid) — replaces
// the old single static list. RBA_PROMPT reuses the same nextRbaLabel/
// lastRbaLabel computed above, so its dynamic date/rate text is unchanged.
const RBA_PROMPT = {
  label:  'RBA NEXT MOVE',
  prompt: `What is the most likely RBA decision at the next board meeting on ${nextRbaLabel} and why? Current cash rate is ${LAST_DECISIONS.RBA.rate} after the RBA ${LAST_DECISIONS.RBA.decision.toLowerCase()} at its ${lastRbaLabel} meeting (${LAST_DECISIONS.RBA.note}).`,
  dataKeys: ['asx', 'aud'],
}

// Figures in prompt labels come from verifiedConstants, so the pills move
// with the data rather than naming a rate that has since changed.
const RBA_RATE = `${VERIFIED_CONSTANTS.rba.cashRate.toFixed(2)}%`
const RBA_VERB_PAST = { HIKE: 'raised', CUT: 'cut', HOLD: 'held' }[VERIFIED_CONSTANTS.rba.lastDecisionVerb] ?? 'set'
const RBA_MOVE_LABEL = { HIKE: 'RBA JUST HIKED — WHAT NOW?', CUT: 'RBA JUST CUT — WHAT NOW?' }[VERIFIED_CONSTANTS.rba.lastDecisionVerb] ?? `WHAT DOES ${RBA_RATE} MEAN?`
const FED_RANGE = VERIFIED_CONSTANTS.fed.rateRange
const AU_UNEMP = `${VERIFIED_CONSTANTS.au.unemployment}%`

const MODULE_PROMPTS = {
  markets: [
    { label: 'ASX OUTLOOK TODAY', prompt: 'What is the current outlook for the ASX 200 and key sector themes for Australian investors?', dataKeys: ['asx', 'aud'] },
    { label: 'TOP SECTOR TODAY', prompt: "Which ASX sector is performing best today and why? What's driving it?", dataKeys: ['asx'] },
    { label: "WHAT'S MOVING MARKETS?", prompt: 'What are the top 3 stories or catalysts moving markets right now?', dataKeys: ['asx', 'aud'] },
    { label: 'IRON ORE OUTLOOK', prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.', dataKeys: ['aud'] },
  ],
  crypto: [
    { label: 'BTC OUTLOOK', prompt: 'What is the current outlook for Bitcoin — key levels, sentiment, and near-term catalysts?', dataKeys: ['btc'] },
    { label: 'CRYPTO SENTIMENT', prompt: 'Summarise current crypto market sentiment and what is driving it right now.', dataKeys: ['btc', 'eth'] },
    { label: 'ETH VS BTC', prompt: 'Compare the current relative strength and outlook of Ethereum versus Bitcoin.', dataKeys: ['btc', 'eth'] },
    { label: 'DEFI SECTOR OUTLOOK', prompt: 'What is the current outlook for the DeFi sector within crypto markets?', dataKeys: [] },
  ],
  fx: [
    { label: RBA_MOVE_LABEL, prompt: `The RBA ${RBA_VERB_PAST} the cash rate to ${RBA_RATE} at its ${lastRbaLabel} meeting. What does that mean for Australian borrowers, savers and investors?`, dataKeys: ['asx', 'aud'] },
    { label: `${RBA_RATE} & ASX SECTORS`, prompt: `How does a ${RBA_RATE} cash rate affect ASX sectors — banks, REITs, consumer discretionary, miners and growth stocks?`, dataKeys: ['asx'] },
    { label: 'WHEN WILL THE RBA CUT?', prompt: `What would need to happen for the RBA to start cutting from ${RBA_RATE}? Describe the conditions in words — you have no market-implied pricing, so do not state a probability or a date.`, dataKeys: ['aud'] },
    { label: 'AUD IMPACT', prompt: `How does the RBA's latest decision (${RBA_VERB_PAST} to ${RBA_RATE}) bear on the AUD, given the Fed is at ${FED_RANGE}?`, dataKeys: ['aud'] },
  ],
  macro: [
    { label: 'RBA MOVE & THE ECONOMY', prompt: `What is the likely impact of the RBA's move to ${RBA_RATE} on the Australian economy — households, housing, business investment and jobs?`, dataKeys: ['aud'] },
    { label: 'RECESSION RISK?', prompt: 'Is Australia heading for recession? Weigh growth, unemployment, inflation and the policy rate you have been given.', dataKeys: ['asx'] },
    { label: `${AU_UNEMP} UNEMPLOYMENT`, prompt: `What does unemployment at ${AU_UNEMP} mean for the labour market and for the RBA's next decision?`, dataKeys: [] },
    { label: 'AU VS US OUTLOOK', prompt: 'Compare the Australian and US economic outlooks — growth, inflation, labour market and policy.', dataKeys: ['aud'] },
  ],
  bonds: [
    { label: 'YIELD CURVE SHAPE', prompt: 'Explain the current shape of the Australian and US yield curves and what it signals.', dataKeys: [] },
    { label: 'AU VS US SPREAD', prompt: `What do the AU–US spreads mean — the policy spread (RBA ${RBA_RATE} vs Fed ${FED_RANGE}) and the 10-year bond spread — for the AUD and for investors?`, dataKeys: ['aud'] },
    { label: 'CASH VS 10Y BONDS', prompt: `With the cash rate at ${RBA_RATE}, how does holding cash compare with locking in a 10-year Australian government bond? Cover duration risk.`, dataKeys: [] },
    { label: 'BONDS VS CASH VS SHARES', prompt: 'At current rates, how do bonds, cash and equities compare for an Australian investor? General information only.', dataKeys: ['asx'] },
  ],
  etf: [
    { label: 'ETFS IN A HIGH-RATE WORLD', prompt: `Which kinds of ETFs tend to suit a high-rate environment like a ${RBA_RATE} cash rate, and which struggle? Explain by category rather than recommending products.`, dataKeys: [] },
    { label: 'VAS VS A200', prompt: 'VAS vs A200 — how do these two ASX 200/300 ETFs differ (index, fees, size, holdings), and what kind of investor does each suit?', dataKeys: [] },
    { label: 'RATE HIKES & BOND ETFS', prompt: 'How do rate hikes affect bond ETFs — duration, price falls, and the yield you lock in afterwards?', dataKeys: [] },
    { label: 'ETFS VS STOCKS', prompt: 'Should an Australian investor use ETFs or individual stocks? Cover cost, diversification, tax and effort.', dataKeys: [] },
  ],
  futures: [
    { label: 'RATE FUTURES & THE RBA', prompt: 'How do ASX 30-day interbank cash rate futures imply an expected RBA decision? Explain the mechanics — you have no live futures pricing, so do not state an implied probability.', dataKeys: [] },
    { label: 'SPI 200 FUTURES', prompt: 'Explain the SPI 200 futures contract — what it tracks, contract size, trading hours, and how investors use it.', dataKeys: ['asx'] },
    { label: 'SHORT INTEREST SIGNALS', prompt: 'What is short interest, how is it reported on the ASX, and what can high short interest tell us (and not tell us)?', dataKeys: [] },
    { label: 'OPTIONS ON ASX STOCKS', prompt: 'How do exchange-traded options work for ASX stocks — calls, puts, premiums, expiry and the main risks?', dataKeys: [] },
  ],
  calculators: [
    { label: 'COMPOUND INTEREST', prompt: 'How does compound interest work, and why does time matter more than the rate?', dataKeys: [] },
    { label: 'NEGATIVE GEARING', prompt: 'What is negative gearing in Australia, how does it work for property and shares, and what are the risks?', dataKeys: [] },
    { label: 'CGT 50% DISCOUNT', prompt: 'Explain the Australian CGT 50% discount — who gets it, the 12-month rule, and a worked example.', dataKeys: [] },
    { label: 'SUPER VS PROPERTY', prompt: 'Super vs property for building wealth in Australia — tax treatment, leverage, liquidity and risk. General information only.', dataKeys: [] },
  ],
  global: [
    { label: 'GEOPOLITICAL RISKS', prompt: 'What are the top 3 geopolitical risks currently affecting Australian markets and the AUD?', dataKeys: ['asx', 'aud'] },
    { label: 'IRON ORE OUTLOOK', prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.', dataKeys: ['aud'] },
    { label: 'TRADE WAR IMPACT', prompt: "What is the current state of global trade tensions and their impact on Australia's economy?", dataKeys: [] },
    { label: 'CHINA ECONOMY', prompt: "Summarise the current state of China's economy and its implications for Australian exporters.", dataKeys: ['aud'] },
  ],
  news: [
    { label: "TODAY'S KEY THEMES", prompt: "What are today's key market themes for Australian investors?", dataKeys: ['asx', 'aud'] },
    { label: 'MARKET IMPACT SUMMARY', prompt: "Summarise the market impact of today's top news stories.", dataKeys: ['asx'] },
    { label: 'RISKS TO WATCH', prompt: 'What are the key risks investors should watch based on current news flow?', dataKeys: ['asx', 'aud'] },
    { label: 'ASX CATALYSTS TODAY', prompt: 'What are the key catalysts for the ASX today?', dataKeys: ['asx'] },
  ],
}


// Openers shown on a blank panel live in services/aiStarters.js — the
// generic set, or a set written for the saved investor profile.

const DEFAULT_PROMPTS = [
  { label: 'ASX OUTLOOK TODAY', prompt: 'What is the current outlook for the ASX 200 and key sector themes for Australian investors?', dataKeys: ['asx', 'aud'] },
  RBA_PROMPT,
  { label: 'IRON ORE OUTLOOK', prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.', dataKeys: ['aud'] },
  { label: 'AUD/USD OUTLOOK', prompt: 'Analyse the current AUD/USD outlook considering RBA policy, commodity prices, and global risk sentiment.', dataKeys: ['aud'] },
]

// Modules whose own prompts are generic market openers. With an investor
// profile saved, the personal set replaces them here; specialist modules
// (bonds, FX, crypto, calculators…) keep prompts about their own subject.
const PROFILE_PROMPT_MODULES = new Set(['dashboard', 'markets', 'news', 'portfolio', 'watchlist', 'screener'])

// selectedSymbol: the ticker currently open in the stock detail modal, if
// any — asset-specific prompts take priority over everything else, then the
// investor-profile set on general modules, then module-specific ones.
function getQuickPrompts(activeModule, selectedSymbol, profilePrompts = null) {
  if (selectedSymbol) {
    const bare = selectedSymbol.replace('.AX', '')
    return [
      { label: `ANALYSE ${bare}`, prompt: `Give a concise analysis of ${selectedSymbol} — current price action, key drivers, and near-term outlook.`, dataKeys: [] },
      { label: `${bare} PRICE TARGETS`, prompt: `What are reasonable price targets for ${selectedSymbol} based on current technicals and fundamentals?`, dataKeys: [] },
      { label: `NEWS ON ${bare}`, prompt: `What news or catalysts are currently driving ${selectedSymbol} right now?`, dataKeys: [] },
      { label: `${bare} RISK FACTORS`, prompt: `What are the key risk factors investors should watch for ${selectedSymbol}?`, dataKeys: [] },
    ]
  }
  if (profilePrompts && (PROFILE_PROMPT_MODULES.has(activeModule) || !MODULE_PROMPTS[activeModule])) return profilePrompts
  return MODULE_PROMPTS[activeModule] ?? DEFAULT_PROMPTS
}

// ─── Inline text formatter ─────────────────────────────────────────────────────
// formatInline (escape-first HTML for dangerouslySetInnerHTML), ticker pills,
// percentage colouring and the FOLLOW_UPS parser live in
// services/aiResponseFormat.js, where they can be tested without React.

// Instruction appended to the chat system prompt. Constant, so it caches with
// the rest of the prefix; the line it asks for is parsed off the reply by
// splitFollowUps and rendered as chips rather than shown as text.
const FOLLOW_UP_GUIDE = `

FOLLOW-UP SUGGESTIONS: End every reply with one final line in exactly this form, and nothing after it:
FOLLOW_UPS: question one | question two | question three
Two or three questions this user would plausibly ask next, each under 60 characters, specific to what you just said — not generic ("tell me more"). Phrase them as the user would type them.`

// RESEARCH mode instruction. Sent in the user turn, not the system prompt,
// so switching modes never changes the cached prefix.
const RESEARCH_INSTRUCTION = `[MODE]
User is in RESEARCH mode. Provide comprehensive, structured analysis.
Use clear section headers, each on its own line in capitals followed by a colon, in this order:
OVERVIEW:
ANALYSIS:
RISKS:
CONCLUSION:
Be thorough — this is a deep dive, not a quick answer. The rules on figures still apply: quote only figures you were given.

`

// ─── Sentiment score rendering ─────────────────────────────────────────────────

function scoreColour(score) {
  if (score >= 67) return 'var(--color-gain)'
  if (score >= 34) return 'var(--mt-amber, #C9A84C)'
  return 'var(--color-loss)'
}

function sentimentLabelColour(label) {
  const u = label?.toUpperCase()
  if (u === 'BULLISH' || u === 'RISK ON') return 'var(--color-gain)'
  if (u === 'BEARISH' || u === 'RISK OFF') return 'var(--color-loss)'
  return 'var(--mt-amber, #C9A84C)'
}

function ScoreBar({ score }) {
  const colour = scoreColour(score)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
      <span style={{ color: colour, fontWeight: 700 }}>{score}/100</span>
      <span style={{
        display:'inline-block', width:'60px', height:'3px',
        background:'rgba(100,120,160,0.25)', borderRadius:'2px', flexShrink:0,
      }}>
        <span style={{
          display:'block', width:`${score}%`, height:'100%',
          background: colour, borderRadius:'2px',
        }} />
      </span>
    </span>
  )
}

// Detect sentiment bullet: "Label: XX/100 — BULLISH" or "Label: XX/100"
function parseSentimentBullet(text) {
  const m = text.match(/^([\w][\w\s]*):\s*(\d+)\/100(?:\s*[—-]\s*([A-Z][A-Z\s]+))?/)
  if (!m) return null
  const score = parseInt(m[2], 10)
  return { label: m[1].trim(), score, sentiment: m[3]?.trim() ?? null }
}

// Check if we're inside a SENTIMENT: section (simple heuristic: label is one of the known fields)
const SENTIMENT_FIELDS = new Set(['Overall', 'Momentum', 'Volume', 'Macro Alignment', 'Risk',
  'Overall Market', 'Sector Momentum', 'Macro Environment', 'Global Risk'])

// ─── Formatted response renderer ──────────────────────────────────────────────


// Per-response feedback. Stored locally only — this is a signal for Ben when
// reviewing where MaddenAI is weak, not telemetry, so it never leaves the
// browser. Keyed by a hash of the response so re-renders and reordering
// don't lose or misattribute a rating.
const AI_FEEDBACK_KEY = 'madden_ai_feedback'
// FABRICATED FIGURE is its own reason, not a kind of "inaccurate": a number
// the model was never given is the failure the whole verified-figures setup
// exists to prevent, and it should be countable on its own.
const FEEDBACK_REASONS = ['INACCURATE', 'UNHELPFUL', 'TOO LONG', 'TOO SHORT', 'FABRICATED FIGURE']

function hashResponse(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

function readFeedback() {
  try { return JSON.parse(localStorage.getItem(AI_FEEDBACK_KEY) || '{}') } catch { return {} }
}

// `text` is the reply as displayed (follow-ups already stripped), so a
// rating, a save and a share all refer to the same thing the user read.
function ResponseFeedback({ text, question, onSaved }) {
  const id = useMemo(() => hashResponse(text), [text])
  const [rating, setRating] = useState(() => readFeedback()[id]?.rating ?? null)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState(null)
  const [saved, setSaved] = useState(() => isInsightSaved(text))
  const [shared, setShared] = useState(false)

  const record = (next, reason) => {
    try {
      const all = readFeedback()
      all[id] = { rating: next, reason: reason ?? null, at: new Date().toISOString() }
      localStorage.setItem(AI_FEEDBACK_KEY, JSON.stringify(all))
    } catch { /* best-effort */ }
    setRating(next)
  }

  const flash = (msg) => { setNote(msg); setTimeout(() => setNote(null), 3000) }
  const save = () => { saveInsight({ content: text }); setSaved(true); onSaved?.() }
  const share = () => {
    navigator.clipboard?.writeText(toShareText(text, { question }))
      .then(() => { setShared(true); setTimeout(() => setShared(false), 2000) })
      .catch(() => flash('Copy blocked by the browser'))
  }

  const chip = 'text-[9px] font-mono tracking-wider px-1.5 py-0.5 border transition-colors'

  return (
    <div className="relative flex items-center gap-1.5">
      {note && <span className="text-[9px] font-mono text-terminal-gold whitespace-nowrap">{note}</span>}
      <button
        onClick={() => { record('up'); setAsking(false) }}
        title="Helpful"
        aria-label="Helpful"
        className={`text-[12px] leading-none transition-opacity ${rating === 'up' ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
      >👍</button>
      <button
        onClick={() => { record('down'); setAsking(true) }}
        title="Not helpful"
        aria-label="Not helpful"
        className={`text-[12px] leading-none transition-opacity ${rating === 'down' ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
      >👎</button>
      {/* After a 👍 the two things worth doing with a good answer appear as
          labelled actions; before it, save stays one quiet icon. */}
      {rating === 'up' ? (
        <>
          <button onClick={save} disabled={saved}
            className={`${chip} ${saved ? 'border-terminal-gold/40 text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold/60'}`}
            title="Save to your insights">{saved ? '✓ SAVED' : '💾 SAVE'}</button>
          <button onClick={share}
            className={`${chip} ${shared ? 'border-terminal-gold/40 text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold/60'}`}
            title="Copy as formatted text to share">{shared ? '✓ COPIED' : 'SHARE'}</button>
        </>
      ) : (
        <button
          onClick={save}
          disabled={saved}
          title={saved ? 'Saved to your insights' : 'Save this analysis'}
          aria-label={saved ? 'Saved to your insights' : 'Save this analysis'}
          className={`text-[12px] leading-none transition-opacity ${saved ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
        >{saved ? '★' : '☆'}</button>
      )}

      {asking && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-[100] bg-terminal-panel border border-terminal-border-gold shadow-2xl"
          onMouseLeave={() => setAsking(false)}
        >
          <div className="px-2 py-1 text-[9px] font-mono tracking-wider text-terminal-text-dim border-b border-terminal-border">
            WHAT WAS WRONG?
          </div>
          {FEEDBACK_REASONS.map((r) => (
            <button
              key={r}
              role="menuitem"
              onClick={() => { record('down', r); setAsking(false); flash('Thanks — this helps improve MaddenAI') }}
              className="block w-full text-left px-2 py-1.5 text-[10px] font-mono tracking-wider text-terminal-text-dim hover:bg-terminal-surface2 hover:text-terminal-text whitespace-nowrap"
            >{r}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function FormattedResponse({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="font-sans" style={{ fontSize: '13px', lineHeight: '1.7' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim()

        if (!trimmed || trimmed === '---' || trimmed === '***' || trimmed === '—')
          return <div key={i} style={{ height: '5px' }} />

        // Markdown headings → gold section header
        if (/^#{1,3}\s/.test(line)) {
          const content = line.replace(/^#+\s/, '')
          return (
            <div key={i} style={{
              color: 'var(--mt-gold)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.12em', marginTop: i > 0 ? '14px' : '0',
              marginBottom: '6px', borderBottom: '1px solid rgba(201,168,76,0.25)',
              paddingBottom: '4px', textTransform: 'uppercase',
            }}>{content}</div>
          )
        }

        // ALL-CAPS heading followed by an em dash — the shape the structured
        // query modes ask for ("OVERVIEW — what the business does"). Rendered
        // as a full section header rather than an inline label because these
        // divide the answer rather than annotating a value.
        if (/^[A-Z][A-Z\s/&-]{2,40}\s+—\s+/.test(trimmed)) {
          const dashIdx = trimmed.indexOf('—')
          const label = trimmed.slice(0, dashIdx).trim()
          const rest = trimmed.slice(dashIdx + 1).trim()
          return (
            <div key={i} style={{ marginTop: i > 0 ? '14px' : '0', marginBottom: '4px' }}>
              <div style={{
                color: 'var(--mt-gold)', fontWeight: 700, fontSize: '10px',
                letterSpacing: '0.14em', borderBottom: '1px solid rgba(201,168,76,0.2)',
                paddingBottom: '3px', marginBottom: '5px',
              }}>{label}</div>
              {rest && (
                <div style={{ color: 'var(--mt-text)' }}
                  dangerouslySetInnerHTML={{ __html: formatInline(rest) }} />
              )}
            </div>
          )
        }

        // A caps label alone on its line — "OVERVIEW:", "KEY RISKS:", also when
        // the model bolds it — is a section header, not an inline label. The
        // research-mode sections arrive in exactly this shape.
        const header = trimmed.match(/^\**([A-Z][A-Z0-9 /&'’-]{1,40}[A-Z0-9)])\s*:\**$/)
        if (header) {
          return (
            <div key={i} className="ai-section" style={{ marginTop: i > 0 ? '14px' : '0' }}>
              {header[1]}
            </div>
          )
        }

        // Numbered list — "1. Item" / "2) Item". Gold numeral in a fixed
        // column so multi-line items hang-indent under their own text.
        const numbered = trimmed.match(/^(\d{1,2})[.)]\s+(.+)$/)
        if (numbered) {
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', padding: '2px 0 2px 8px', alignItems: 'flex-start' }}>
              <span className="font-mono" style={{ color: 'var(--mt-gold)', flexShrink: 0, minWidth: '18px', fontSize: '11px', fontWeight: 700, paddingTop: '2px' }}>
                {numbered[1]}.
              </span>
              <span style={{ color: '#FFFFFF' }}
                dangerouslySetInnerHTML={{ __html: formatInline(numbered[2]) }} />
            </div>
          )
        }

        // ALL-CAPS label: value  (ASSESSMENT: / LEVELS: / OUTLOOK: etc.)
        if (
          /^[A-Z][A-Z\s/]+:/.test(trimmed) &&
          trimmed.length < 80 &&
          !trimmed.startsWith('A$') &&
          !trimmed.startsWith('US$')
        ) {
          const colonIdx = trimmed.indexOf(':')
          const label = trimmed.slice(0, colonIdx)
          const rest  = trimmed.slice(colonIdx + 1).trim()
          return (
            <div key={i} style={{ marginTop: '10px', marginBottom: '3px', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
              <span style={{ color: 'var(--mt-gold)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.1em', flexShrink: 0 }}>
                {label}:
              </span>
              {rest && (
                <span style={{ color: 'var(--mt-text)' }}
                  dangerouslySetInnerHTML={{ __html: formatInline(rest) }} />
              )}
            </div>
          )
        }

        // Bullet: ◆ - • *
        if (/^[◆\-*•]\s/.test(trimmed)) {
          const content = trimmed.replace(/^[◆\-*•]\s*/, '')
          const parsed  = parseSentimentBullet(content)

          if (parsed && SENTIMENT_FIELDS.has(parsed.label)) {
            return (
              <div key={i} style={{ display:'flex', gap:'8px', padding:'2px 0 2px 8px', alignItems:'center' }}>
                <span style={{ color:'var(--mt-gold)', flexShrink:0 }}>◆</span>
                <span style={{ color:'var(--mt-muted)', minWidth:'120px', flexShrink:0 }}>{parsed.label}:</span>
                {parsed.score != null
                  ? <ScoreBar score={parsed.score} />
                  : <span style={{ color:'var(--mt-muted)' }} title="No score for this line">—</span>
                }
                {parsed.sentiment && (
                  <span style={{ color: sentimentLabelColour(parsed.sentiment), fontWeight:700, fontSize:'10px', marginLeft:'4px' }}>
                    {parsed.sentiment}
                  </span>
                )}
              </div>
            )
          }

          return (
            <div key={i} style={{ display: 'flex', gap: '8px', padding: '2px 0 2px 8px', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--mt-gold)', flexShrink: 0, marginTop: '1px' }}>◆</span>
              <span style={{ color: 'var(--mt-text)' }}
                dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
            </div>
          )
        }

        // Italic-only line (*text*)
        if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
          return (
            <div key={i} style={{ color: 'var(--mt-muted)', fontSize: '10px', marginTop: '8px', fontStyle: 'italic' }}
              dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/^\*|\*$/g, '')) }} />
          )
        }

        // Default paragraph line
        return (
          <div key={i} style={{ color: 'var(--mt-text)', marginBottom: '2px' }}
            dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        )
      })}
    </div>
  )
}

// ─── Notes panel ──────────────────────────────────────────────────────────────

function NotesPanel({ notes, onDelete }) {
  if (notes.length === 0) {
    return (
      <div className="p-3 text-2xs text-terminal-text-dim/50 italic">
        No saved notes yet — click SAVE on any AI response
      </div>
    )
  }
  return (
    <div className="overflow-auto max-h-48">
      {notes.map((note) => (
        <div key={note.id} className="border-b border-terminal-border/40 last:border-0 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-2xs text-terminal-text leading-snug">
              {note.content.slice(0, 180)}{note.content.length > 180 ? '…' : ''}
            </div>
            <button
              onClick={() => onDelete(note.id)}
              className="text-terminal-text-dim/40 hover:text-terminal-red text-xs flex-shrink-0"
            >✕</button>
          </div>
          <div className="text-2xs text-terminal-text-dim/40 mt-0.5">
            {new Date(note.savedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main AIPanel ─────────────────────────────────────────────────────────────

// Conversation window, sized for prompt caching.
//
// Caching matches a byte-identical prefix. A window that slides one exchange
// per turn changes its head message every turn, so the cached history prefix
// is invalidated every single call. Instead the window grows to HISTORY_MAX
// and then drops back to HISTORY_KEEP in one go, which means the head only
// moves once per chunk — the prefix stays stable in between, and a long
// session pays a cache reset periodically rather than continuously.
//
// The start index is quantised to whole chunks so it is a pure function of
// the message count: the same conversation length always yields the same
// window, which is what keeps the prefix reproducible across turns.
const HISTORY_MAX   = 20                              // grow to here…
const HISTORY_KEEP  = 12                              // …then cut back to here
const HISTORY_CHUNK = HISTORY_MAX - HISTORY_KEEP      // 8 messages ≈ 4 exchanges

function windowedHistory(msgs) {
  if (msgs.length <= HISTORY_MAX) return msgs
  const start = Math.floor((msgs.length - HISTORY_KEEP) / HISTORY_CHUNK) * HISTORY_CHUNK
  return msgs.slice(start)
}

export default function AIPanel({ wide = false }) {
  const {
    chatOpen, setChatOpen,
    aiMode, setAiMode,
    chatMessages, setChatMessages, addChatMessage, updateLastChatMessage, clearChatMessages,
    addNotification, activeModule, setActiveModule, modalAsset, watchlist, addToWatchlist, openModal,
  } = useStore()
  const [showHistory, setShowHistory] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(() => listInsights())
  const [expandedInsight, setExpandedInsight] = useState(null)
  const refreshInsights = useCallback(() => setInsights(listInsights()), [])
  const [historyList, setHistoryList] = useState(() => listConversations())
  const [currentConvId, setCurrentConvId] = useState(null)
  const currentConvIdRef = useRef(null)
  useEffect(() => { currentConvIdRef.current = currentConvId }, [currentConvId])

  const persistConversation = useCallback(() => {
    if (chatMessages.length === 0) return
    const id = saveConversation(chatMessages, currentConvIdRef.current)
    setCurrentConvId(id)
    setHistoryList(listConversations())
  }, [chatMessages])

  // Auto-save on close and on tab close — the brief's third trigger
  // ("starting a new conversation") is handled at the NEW CHAT button
  // itself, since that's the one place the transition is explicit.
  useEffect(() => {
    if (chatOpen) return undefined
    const t = setTimeout(persistConversation, 0)
    return () => clearTimeout(t)
  }, [chatOpen, persistConversation])

  useEffect(() => {
    const handler = () => persistConversation()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [persistConversation])

  const startNewChat = useCallback(() => {
    persistConversation()
    clearChatMessages()
    setCurrentConvId(null)
    setShowHistory(false)
  }, [persistConversation, clearChatMessages])

  const loadConversation = useCallback((conv) => {
    setChatMessages(conv.messages)
    setCurrentConvId(conv.id)
    setShowHistory(false)
  }, [setChatMessages])

  const removeConversation = useCallback((id, e) => {
    e.stopPropagation()
    deleteConversation(id)
    setHistoryList(listConversations())
    setCurrentConvId((cur) => (cur === id ? null : cur))
  }, [])
  const { profile } = useAuthStore()
  const { canAccess, isApex, tier } = useSubscription()
  const investorProfile = useInvestorProfile()
  const quickPrompts = getQuickPrompts(activeModule, modalAsset?.symbol, getProfilePrompts(investorProfile))

  const queryClient = useQueryClient()

  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)

  // CHAT: the conversational default. RESEARCH: long, sectioned deep dives.
  // Remembered per browser — someone who works in research mode keeps it.
  const [responseMode, setResponseModeState] = useState(() => {
    try { return localStorage.getItem('maddex_ai_response_mode') === 'research' ? 'research' : 'chat' } catch { return 'chat' }
  })
  const setResponseMode = (m) => {
    setResponseModeState(m)
    try { localStorage.setItem('maddex_ai_response_mode', m) } catch { /* private mode */ }
  }

  // Save after every completed reply, not only on close — the fullscreen
  // history rail lists the live conversation, and a crash or closed laptop
  // mid-session should not lose it.
  const wasLoadingRef = useRef(false)
  useEffect(() => {
    if (wasLoadingRef.current && !loading) persistConversation()
    wasLoadingRef.current = loading
  }, [loading, persistConversation])

  // Tokens this tab has pulled through the model; see aiUsageService.
  const [sessionTokens, setSessionTokens] = useState(getSessionTokens)
  useEffect(() => {
    const sync = () => setSessionTokens(getSessionTokens())
    window.addEventListener('maddex:ai-usage', sync)
    return () => window.removeEventListener('maddex:ai-usage', sync)
  }, [])
  const [showNotes,    setShowNotes]    = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('madden_ai_notes') ?? '[]') } catch { return [] }
  })
  // Dismissed per browser session (sessionStorage, not localStorage) — the
  // brief reminder should resurface on a fresh session, not vanish forever
  // the first time someone dismisses it.
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => {
    const freq = getAiPreferences().disclaimerFrequency
    if (freq === 'never') return true
    if (freq === 'always') return false
    try { return sessionStorage.getItem('maddex_ai_disclaimer_dismissed') === 'true' } catch { return false }
  })
  const dismissDisclaimer = () => {
    const freq = getAiPreferences().disclaimerFrequency
    if (freq === 'always') return // Settings: "always show" — dismiss is a no-op
    setDisclaimerDismissed(true)
    if (freq !== 'never') {
      try { sessionStorage.setItem('maddex_ai_disclaimer_dismissed', 'true') } catch { /* best-effort */ }
    }
  }
  const isFullscreen = aiMode === 'fullscreen'
  const isPip = aiMode === 'pip'
  const toggleMode = useCallback(() => {
    setAiMode(isFullscreen ? 'sidebar' : 'fullscreen')
  }, [isFullscreen, setAiMode])

  // Picture-in-picture — a small draggable floating chat window, semi
  // transparent until hovered. Position is transient (not persisted),
  // same as the multi-window FloatingWindow instances.
  const [pipPos, setPipPos] = useState(() => ({
    x: Math.max(0, window.innerWidth - 340),
    y: Math.max(0, window.innerHeight - 460),
  }))
  const [pipHovered, setPipHovered] = useState(false)
  const pipDragging = useRef(false)
  const pipOffset = useRef({ x: 0, y: 0 })
  const onPipDragStart = useCallback((e) => {
    if (!isPip) return
    pipDragging.current = true
    pipOffset.current = { x: e.clientX - pipPos.x, y: e.clientY - pipPos.y }
    const onMove = (ev) => {
      if (!pipDragging.current) return
      setPipPos({
        x: Math.min(Math.max(0, ev.clientX - pipOffset.current.x), window.innerWidth - 320),
        y: Math.min(Math.max(0, ev.clientY - pipOffset.current.y), window.innerHeight - 400),
      })
    }
    const onUp = () => {
      pipDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [isPip, pipPos])

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  // ESC-to-exit-fullscreen is handled by App.jsx's global handler (it needs
  // to run before the "close the whole panel" Escape case, so it lives with
  // the rest of that priority chain rather than duplicated here).

  // ── Live data injection for quick prompts ─────────────────────────────────

  const buildQuickPrompt = useCallback((item) => {
    // fxRates and indicesData are cached in dataService's { data, stale,
    // source } envelope (fetchFxRatesUnified / fetchIndexQuotesUnified) —
    // unwrap .data. Crypto keeps its existing { data: [...], currency }
    // shape either way (fetchCryptoMarkets and fetchCryptoMarketsUnified
    // both nest the coin array under .data), so no change needed there.
    const fxRates      = queryClient.getQueryData(['fxRates'])?.data
    const indicesData  = queryClient.getQueryData(['yfBatch', 'indices'])?.data
    const cryptoData   = queryClient.getQueryData(['cryptoMarkets', 'aud'])

    const audUsd   = fxRates?.USD
    const asxPrice = indicesData?.['^AXJO']?.last
    const btcData  = cryptoData?.data?.find(c => c.id === 'bitcoin')
    const ethData  = cryptoData?.data?.find(c => c.id === 'ethereum')

    const parts = []
    if (item.dataKeys.includes('asx') && asxPrice)
      parts.push(`ASX 200: ${asxPrice.toFixed(0)} pts`)
    if (item.dataKeys.includes('aud') && audUsd)
      parts.push(`AUD/USD: ${audUsd.toFixed(4)}`)
    if (item.dataKeys.includes('btc') && btcData?.current_price)
      parts.push(`BTC: A$${Math.round(btcData.current_price).toLocaleString('en-AU')}`)
    if (item.dataKeys.includes('eth') && ethData?.current_price)
      parts.push(`ETH: A$${Math.round(ethData.current_price).toLocaleString('en-AU')}`)

    const context = parts.length ? `Live market data — ${parts.join(', ')}.\n\n` : ''
    return context + item.prompt
  }, [queryClient])

  // ── Notes ─────────────────────────────────────────────────────────────────

  const saveNote = useCallback((content) => {
    const note = { id: Date.now(), content, savedAt: new Date().toISOString() }
    setNotes((prev) => {
      const next = [note, ...prev].slice(0, 20)
      try { localStorage.setItem('madden_ai_notes', JSON.stringify(next)) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
      return next
    })
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      try { localStorage.setItem('madden_ai_notes', JSON.stringify(next)) } catch { /* quota, private mode, or blocked site data — persistence is best-effort */ }
      return next
    })
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────

  // Dynamic per-turn context — active module/selected asset/watchlist/
  // portfolio/date. This is prepended to the USER message, never to the
  // system prompt: it changes on almost every turn, and anything volatile
  // inside the cached system prefix invalidates the prompt cache each call.
  //
  // The investor profile rides along even with context awareness off: the
  // user saved it for exactly this purpose, and clearing it is how to stop it.
  const buildDynamicContext = useCallback(() => {
    const investor = getInvestorContext(investorProfile)
    if (!getAiPreferences().contextAwareness) return investor ? `[CONTEXT]\n${investor}` : ''
    const moduleLabel = MODULE_LABELS[activeModule] ?? activeModule
    let holdingSymbols = []
    try {
      holdingSymbols = (JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]'))
        .map((h) => h?.symbol).filter(Boolean)
    } catch { /* best-effort */ }
    const lines = [
      `Today's date: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      `User is currently viewing: ${moduleLabel}`,
    ]
    // Reuses the session logic the news module and status bar already run on,
    // so the model is told the same session the user can see on screen.
    const session = marketSession()
    lines.push(`Market session: ${session.label} — ${session.detail}`)
    if (modalAsset?.symbol) lines.push(`Asset currently open in detail view: ${modalAsset.symbol}`)
    if (watchlist?.length) lines.push(`User's watchlist: ${watchlist.slice(0, 12).join(', ')}`)
    // Symbols, not just a count. "User has 6 holdings" tells the model nothing
    // it can use; the tickers let it answer "am I exposed to iron ore" without
    // asking the user to retype their own portfolio.
    if (holdingSymbols.length) lines.push(`User's portfolio holdings: ${holdingSymbols.slice(0, 12).join(', ')}`)
    else lines.push('User has no portfolio holdings tracked yet.')

    const facts = verifiedFactsForAI()
    return `[CONTEXT]\n${lines.join('\n')}\n\n${investor}${facts ? facts + '\n\n' : ''}`
  }, [activeModule, modalAsset, watchlist, investorProfile])

  const send = async (textOverride, opts = {}) => {
    const { context, silent } = opts
    const text = (textOverride ?? input).trim()
    if (!text || loading) return

    if (!canAccess('prime') && getAiMessageCount() >= AI_QUOTA_LIMIT) {
      if (!silent) {
        addChatMessage({ role: 'user', content: text })
        addChatMessage({
          role: 'assistant',
          content: `[LIMIT REACHED] You've used all ${AI_QUOTA_LIMIT} MaddenAI messages included in Core this month.\n\nUpgrade to Prime for unlimited MaddenAI access.`,
        })
        setInput('')
      }
      return
    }

    setInput('')
    setLoading(true)
    incrementAiMessageCount()
    markMilestone('ai')

    // Displayed turn keeps the clean text; the wire turn carries the context
    // prefix so the cached system prefix stays byte-identical between calls.
    const research = responseMode === 'research'
    const userTurn     = { role: 'user', content: text }
    const userTurnWire = { role: 'user', content: `${buildDynamicContext()}${research ? RESEARCH_INSTRUCTION : ''}${text}` }
    if (!silent) addChatMessage(userTurn)
    addChatMessage(silent
      ? { role: 'assistant', content: '', silent: true, context, mode: responseMode }
      : { role: 'assistant', content: '', mode: responseMode })

    const history = windowedHistory(chatMessages.filter((m) => m.role !== 'system'))
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      // The shape of the answer is chosen from the shape of the question.
      // A stock query, a head-to-head and a macro query want visibly
      // different structures, and a model given none produces the same
      // flowing paragraphs for all three. See services/queryIntent.js.
      const intent = detectQueryIntent(text)
      // One experience setting: the investor profile's when saved, else the
      // account's. It picks one of four fixed system-prompt variants, each of
      // which caches on its own.
      //
      // Research mode drops the intent guidance: that asks for a structure
      // chosen from the question's shape, and research mode has its own
      // four-section structure — two competing layouts produce neither.
      const systemPrompt = buildSystemPrompt(investorProfile?.experience ?? profile?.experience_level)
        + (research ? '' : intentGuidance(intent))
        + FOLLOW_UP_GUIDE

      const result = await askClaude(
        [...history, userTurnWire],
        (_, full) => updateLastChatMessage({ role: 'assistant', content: full }),
        { systemPrompt, maxTokens: research ? 3000 : 1200 }
      )
      updateLastChatMessage((prev) => ({
        ...prev,
        stats: { elapsed: result.elapsed, outputTokens: result.outputTokens },
      }))
      addNotification('SYSTEM', 'MaddenAI analysis ready')
      soundService.aiComplete()
    } catch (err) {
      updateLastChatMessage({
        role: 'assistant',
        content: `[ERROR] ${err.message}\n\nEnsure ANTHROPIC_API_KEY is set (server-side, in .env for dev or the Vercel dashboard for prod)`,
      })
      soundService.error()
    } finally {
      setLoading(false)
    }
  }

  // Global intelligence "ASK AI" button hook — dispatched by asset/headline/
  // chokepoint click sites across the terminal. The prompt is sent to Claude
  // but never shown as a user bubble; see `send(text, { silent, context })`.
  //
  // `send` IS A REAL DEPENDENCY, not a lint formality.
  //
  // This effect used to run with `[]` and an eslint-disable, which pinned the
  // handler to the `send` closure from the first render. `send` reads
  // `chatMessages` to build the history it puts on the wire, so every Ask-AI
  // click anywhere in the terminal — asset panels, headlines, chokepoints —
  // sent the conversation as it stood at mount, which is to say empty. The
  // reply came back with no memory of the conversation it was appended to, and
  // looked like a model that had lost the thread rather than a stale closure.
  // It also read `loading` and `input` from that first render.
  //
  // `send` is redefined each render, so this now re-subscribes on render. That
  // is the intended behaviour of the rule and is cheap: swapping one listener
  // is a synchronous pair of calls inside React's commit, with no window in
  // which an event could slip past.
  //
  // It also has to sit BELOW `send`. Naming a `const` in a dependency array
  // evaluates it during render, at this line — so while it lived above the
  // declaration the array itself threw a TDZ ReferenceError and took the
  // whole panel down. With `[]` that never showed, because an empty array
  // reads nothing; the stale closure and the ordering were the same bug seen
  // from two sides.
  useEffect(() => {
    const handler = (e) => {
      const { prompt, context, fullscreen: wantFullscreen, visible } = e.detail ?? {}
      if (!prompt) return
      setChatOpen(true)
      if (wantFullscreen) setAiMode('fullscreen')
      // `visible` is for prompts the user typed themselves — the command bar.
      // Those should appear as a user bubble; an ASK AI button's generated
      // prompt should not, because the user never wrote it.
      setTimeout(() => send(prompt, { context, silent: !visible }), 100)
    }
    window.addEventListener('madden:ask-ai', handler)
    return () => window.removeEventListener('madden:ask-ai', handler)
  }, [send, setChatOpen, setAiMode])

  // Auto-analyse — when enabled in Settings, opening an asset's detail view
  // while the AI panel is already open auto-sends the ANALYSE quick prompt
  // for it, so a new symbol never gets analysed twice in a row.
  const lastAutoAnalysedRef = useRef(null)
  useEffect(() => {
    // Auto-analyse: fires a prompt when a new asset opens while the panel is
    // already open. send() is an async side effect on the network, not derived
    // state — there is nothing here to compute during render.
    if (!chatOpen || !modalAsset?.symbol) return
    if (!getAiPreferences().autoAnalyse) return
    if (lastAutoAnalysedRef.current === modalAsset.symbol) return
    lastAutoAnalysedRef.current = modalAsset.symbol
    const prompt = getQuickPrompts(activeModule, modalAsset.symbol)[0]?.prompt
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prompt) send(prompt)
  }, [modalAsset, chatOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Opens the asset panel for a ticker mentioned in a reply. Reads the symbol
  // off the element rather than the text, so a ticker rendered inside other
  // markup still resolves.
  const openTickerFromEvent = useCallback((el) => {
    const sym = el?.dataset?.sym
    if (!sym) return
    // The detail panel opens over Markets, where the stock's context (index,
    // sector, movers) is one glance away.
    setActiveModule?.('markets')
    openModal({ symbol: sym, name: sym, type: sym.endsWith('.AX') ? 'asx' : 'us' })
  }, [openModal, setActiveModule])

  const handleTickerClick = useCallback((e) => {
    const el = e.target.closest?.('.ai-ticker')
    if (el) { e.preventDefault(); openTickerFromEvent(el) }
  }, [openTickerFromEvent])

  // Keyboard equivalent — the spans carry role="link" and tabindex, so they
  // are reachable by tab and must respond to Enter and Space.
  const handleTickerKey = useCallback((e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const el = e.target.closest?.('.ai-ticker')
    if (el) { e.preventDefault(); openTickerFromEvent(el) }
  }, [openTickerFromEvent])

  const copyMessage = (content) => {
    navigator.clipboard?.writeText(content).catch(() => {})
  }

  const handleClear = () => {
    if (confirmClear) {
      clearChatMessages()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  const turnCount = chatMessages.filter((m) => m.role === 'user').length
  const starters = getStarters(investorProfile)

  // Monogram + disclaimer each appear once per session, not per message.
  const detectResponseActions = useCallback((text) => {
    if (!text) return []
    const actions = []
    // Same detection as the ticker pills, so an action never names a code
    // the reply did not visibly link.
    const uniqueTickers = findTickers(text)

    uniqueTickers.slice(0, 2).forEach((ticker) => {
      if (watchlist.includes(ticker)) return
      actions.push({
        key: `wl-${ticker}`, label: `+ ${ticker.replace('.AX', '')}`, type: 'watchlist',
        onClick: () => { addToWatchlist(ticker); logActivity('watchlist', `Added ${ticker} to watchlist (from MaddenAI)`); soundService.actionSuccess() },
      })
    })

    const priceMatch = text.match(/A\$[\d,]+(?:\.\d+)?|US\$[\d,]+(?:\.\d+)?/)
    if (priceMatch && uniqueTickers[0]) {
      const value = parseFloat(priceMatch[0].replace(/[A-Z$,]/g, ''))
      actions.push({
        key: 'alert', label: `⚡ Alert at ${priceMatch[0]}`, type: 'alert',
        onClick: () => { createAlert({ type: 'PRICE', symbol: uniqueTickers[0], condition: 'above', value, label: `${uniqueTickers[0]} above ${priceMatch[0]}` }); addNotification('SYSTEM', `Alert set: ${uniqueTickers[0]} above ${priceMatch[0]}`) },
      })
    }
    return actions
  }, [watchlist, addToWatchlist, addNotification])

  const ACTION_STYLE = {
    watchlist: 'text-terminal-green border-terminal-green/40 hover:bg-terminal-green hover:text-terminal-bg',
    alert:     'text-terminal-gold border-terminal-gold/40 hover:bg-terminal-gold hover:text-terminal-bg',
  }

  const firstAssistantIdx = chatMessages.findIndex((m) => m.role === 'assistant' && !m.silent)
  const hasAnyReply = chatMessages.some((m) => m.role === 'assistant' && !m.silent && m.content)

  if (!chatOpen) return null

  return (
    <div
      data-tour="ai-panel"
      onMouseEnter={() => isPip && setPipHovered(true)}
      onMouseLeave={() => isPip && setPipHovered(false)}
      className={
        isFullscreen
          ? 'fixed inset-0 z-40 flex flex-col bg-terminal-panel'
          : isPip
            ? 'fixed z-40 flex flex-col bg-terminal-panel border border-terminal-border-gold shadow-2xl rounded-[4px] overflow-hidden transition-opacity'
            : wide
              ? 'fixed inset-0 z-40 md:relative md:inset-auto md:z-auto w-full md:w-1/2 flex flex-col border-l border-terminal-border bg-terminal-panel flex-shrink-0'
              // 320px (md:w-80) is a chat strip, not a reading column. MaddenAI
              // writes 200-350 word analyses in prose; at 320 that wraps every
              // six or seven words and the reader loses the sentence. 360 -> 420
              // -> 480 as the viewport allows, which keeps the measure in the
              // 45-75 character band prose is actually readable in.
              : 'fixed inset-0 z-40 md:relative md:inset-auto md:z-auto w-full md:w-[360px] xl:w-[420px] 2xl:w-[480px] flex flex-col border-l border-terminal-border bg-terminal-panel flex-shrink-0'
      }
      style={isPip ? { left: pipPos.x, top: pipPos.y, width: 320, height: 400, opacity: pipHovered ? 1 : 0.85 } : undefined}
    >
      {/* Header */}
      <div
        onMouseDown={isPip ? onPipDragStart : undefined}
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.35)', background: 'var(--mt-header, #0A1F3D)', cursor: isPip ? 'grab' : undefined }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xs font-semibold text-terminal-gold tracking-widest font-mono" title="Model: Claude Sonnet">MADDENAI</span>
          {/* Response mode. Segmented rather than a dropdown — two states,
              both always visible, one click to switch. */}
          <div className="flex border border-terminal-border rounded-[2px] overflow-hidden flex-shrink-0" role="radiogroup" aria-label="Response mode"
            onMouseDown={(e) => e.stopPropagation()}>
            {[['chat', 'CHAT', 'Conversational — shorter answers, quick back-and-forth'],
              ['research', 'RESEARCH', 'Deep dive — long, structured: overview, analysis, risks, conclusion']].map(([id, label, hint]) => (
              <button key={id} role="radio" aria-checked={responseMode === id} title={hint}
                onClick={() => setResponseMode(id)}
                className={`px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider transition-colors ${
                  responseMode === id ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                }`}
              >{label}</button>
            ))}
          </div>
          {turnCount > 0 && isFullscreen && (
            <span className="text-2xs text-terminal-text-dim/50">Turn {turnCount}</span>
          )}
          {sessionTokens > HIGH_SESSION_TOKENS && (
            <span data-usage-note
              className="text-[9px] font-mono text-terminal-gold/60 whitespace-nowrap truncate"
              title={`About ${Math.round(sessionTokens / 1000)}K tokens processed in this tab since it opened (including cached context). A session counter, not a bill — see Settings → MaddenAI for usage.`}
              aria-label="High usage this session"
            >●{isFullscreen && ' High usage this session'}</span>
          )}
          {confirmClear ? (
            <button onClick={handleClear} className="text-2xs text-terminal-red ml-1">CONFIRM CLEAR?</button>
          ) : chatMessages.length > 0 && (
            <button onClick={handleClear} className="text-2xs text-terminal-text-dim/40 hover:text-terminal-red ml-1" title="Clear conversation">CLR</button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isFullscreen && <button
            onClick={() => setShowHistory((v) => !v)}
            className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
              showHistory ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
            }`}
            title={`Conversation history${historyList.length > 0 ? ` (${historyList.length})` : ''}`}
          >
            ◷
          </button>}
          <button
            onClick={() => { setShowInsights((v) => !v); setShowHistory(false) }}
            className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
              showInsights ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
            }`}
            title={`Saved insights${insights.length > 0 ? ` (${insights.length})` : ''}`}
          >
            ★
          </button>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
              showNotes ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
            }`}
            title={`Saved notes${notes.length > 0 ? ` (${notes.length})` : ''}`}
          >
            ≡
          </button>
          {!isFullscreen && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setAiMode(isPip ? 'sidebar' : 'pip')}
              className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
                isPip ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
              }`}
              title={isPip ? 'Exit picture-in-picture' : 'Picture-in-picture (⌘⇧A)'}
            >
              ⊡
            </button>
          )}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMode}
            className="w-6 h-6 flex items-center justify-center text-xs text-terminal-text-dim hover:text-terminal-gold transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? '⤡' : '⤢'}
          </button>
          <button
            onClick={() => setChatOpen(false)}
            className="w-6 h-6 flex items-center justify-center text-xs text-terminal-text-dim hover:text-terminal-text transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Notes panel — Research Notes is an Apex feature */}
      {showInsights && (
        <div
          className="absolute top-0 bottom-0 left-0 z-30 bg-terminal-panel border-r border-terminal-border-gold flex flex-col panel-slide-in"
          style={{ width: 260 }}
        >
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border flex-shrink-0">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">
              SAVED INSIGHTS {insights.length > 0 && `(${insights.length}/${INSIGHT_LIMIT})`}
            </span>
            <button onClick={() => setShowInsights(false)} className="text-terminal-text-dim hover:text-terminal-gold text-xs">✕</button>
          </div>

          {insights.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4 text-center">
              <span className="text-2xs text-terminal-text-dim leading-relaxed">
                Nothing saved yet. Press ☆ on any MaddenAI reply to keep it here.
              </span>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {insights.map((ins) => (
                  <div key={ins.id} className="border-b border-terminal-border/40">
                    <button
                      onClick={() => setExpandedInsight((id) => (id === ins.id ? null : ins.id))}
                      className="w-full text-left px-2 py-2 hover:bg-terminal-accent/10 transition-colors"
                    >
                      <div className="text-2xs text-terminal-text-dim/60">
                        {new Date(ins.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-2xs text-terminal-text leading-snug mt-0.5">{ins.preview}</div>
                    </button>
                    {expandedInsight === ins.id && (
                      <div className="px-2 pb-2">
                        <div
                          className="text-2xs text-terminal-text-dim leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto border-l-2 border-terminal-gold/30 pl-2"
                        >{ins.content}</div>
                        <button
                          onClick={() => { removeInsight(ins.id); refreshInsights(); setExpandedInsight(null) }}
                          className="text-2xs text-terminal-text-dim hover:text-terminal-red mt-1.5"
                        >Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { clearInsights(); refreshInsights(); setExpandedInsight(null) }}
                className="text-2xs text-terminal-text-dim hover:text-terminal-red py-2 border-t border-terminal-border flex-shrink-0"
              >CLEAR SAVED</button>
            </>
          )}
        </div>
      )}

      {showHistory && (
        <div
          className="absolute top-0 bottom-0 left-0 z-30 bg-terminal-panel border-r border-terminal-border-gold flex flex-col panel-slide-in"
          style={{ width: 200 }}
        >
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border flex-shrink-0">
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">HISTORY</span>
            <button onClick={() => setShowHistory(false)} className="text-terminal-text-dim hover:text-terminal-gold text-xs">✕</button>
          </div>
          <button
            onClick={startNewChat}
            className="mx-2 mt-2 text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >
            + NEW CHAT
          </button>
          <div className="flex-1 overflow-y-auto mt-2">
            {historyList.length === 0 ? (
              <div className="px-2 py-4 text-2xs text-terminal-text-dim/50 text-center">No saved conversations</div>
            ) : (
              historyList.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`group flex items-start gap-1 w-full text-left px-2 py-1.5 border-b border-terminal-border/30 hover:bg-terminal-surface2 transition-colors ${
                    currentConvId === conv.id ? 'bg-terminal-gold/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-terminal-text-dim/60 font-mono">
                      {new Date(conv.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-2xs text-terminal-text-bright truncate">{conv.title || 'Untitled'}</div>
                  </div>
                  <span
                    onClick={(e) => removeConversation(conv.id, e)}
                    className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs opacity-0 group-hover:opacity-100 flex-shrink-0 px-0.5"
                    title="Delete"
                  >✕</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Body. In fullscreen a history rail sits on the left; elsewhere the
          ◷ drawer above does the same job without taking width. */}
      <div className="flex-1 min-h-0 flex">
      {isFullscreen && (
        <aside className="w-60 flex-shrink-0 border-r border-terminal-border flex flex-col bg-terminal-bg/40" aria-label="Conversation history">
          <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border">
            <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-terminal-gold">CONVERSATIONS</span>
            <span className="text-[9px] font-mono text-terminal-text-dim/50">{historyList.length}/10</span>
          </div>
          <button
            onClick={startNewChat}
            className="mx-3 mt-3 text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-2 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors tracking-wider"
          >+ NEW CHAT</button>
          <div className="flex-1 overflow-y-auto mt-3">
            {historyList.length === 0 ? (
              <div className="px-3 py-4 text-2xs text-terminal-text-dim/50">Conversations are saved here as you go — the last 10 are kept.</div>
            ) : historyList.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`group flex items-start gap-1 w-full text-left px-3 py-2 border-l-2 transition-colors ${
                  currentConvId === conv.id
                    ? 'border-terminal-gold bg-terminal-gold/10'
                    : 'border-transparent hover:bg-terminal-surface2'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-terminal-text-bright leading-snug line-clamp-2">{conv.title || 'Untitled'}</div>
                  <div className="text-[9px] text-terminal-text-dim/60 font-mono mt-0.5">
                    {new Date(conv.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    {' · '}{new Date(conv.date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' · '}{conv.messages.filter((m) => m.role === 'assistant' && m.content).length} repl{conv.messages.filter((m) => m.role === 'assistant' && m.content).length === 1 ? 'y' : 'ies'}
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => removeConversation(conv.id, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter') removeConversation(conv.id, e) }}
                  className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0 px-0.5"
                  title="Delete conversation"
                >✕</span>
              </button>
            ))}
          </div>
        </aside>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
      {showNotes && (
        <div className="border-b border-terminal-border flex-shrink-0 relative">
          <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold font-bold tracking-widest border-b border-terminal-border/50">
            SAVED NOTES
          </div>
          {isApex ? (
            <NotesPanel notes={notes} onDelete={deleteNote} />
          ) : (
            <div className="relative" style={{ height: 200 }}>
              <UpgradePrompt feature="Research Notes" requiredTier="apex" currentTier={tier} />
            </div>
          )}
        </div>
      )}

      {!disclaimerDismissed && (
        <div className="flex items-center justify-between gap-2 px-3 py-1 border-b border-terminal-border/50 flex-shrink-0">
          <span className="text-terminal-text-dim/60 font-mono" style={{ fontSize: '9px' }}>
            ⓘ General information only — not financial advice
          </span>
          <button
            onClick={dismissDisclaimer}
            title="Dismiss"
            className="text-terminal-text-dim/50 hover:text-terminal-gold flex-shrink-0 leading-none"
            style={{ fontSize: '9px' }}
          >✕</button>
        </div>
      )}

      {/* Quick prompts — context-aware: asset-specific when a stock detail
          modal is open, otherwise module-specific (2 rows of 2). */}
      <div className={`grid grid-cols-2 gap-1.5 p-2 border-b border-terminal-border flex-shrink-0 ${isFullscreen ? 'max-w-[800px] mx-auto w-full' : ''}`}>
        {quickPrompts.map((q) => (
          <button
            key={q.label}
            onClick={() => send(buildQuickPrompt(q))}
            disabled={loading}
            className="text-2xs font-mono px-2 py-1.5 rounded-full border border-terminal-border text-terminal-muted hover:bg-terminal-gold hover:border-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {/* Delegated ticker clicks.
          formatInline emits <span class="ai-ticker" data-sym="..."> because an
          onClick cannot survive dangerouslySetInnerHTML. One listener here
          covers every ticker in every message, including ones still streaming
          in, and costs one handler rather than one per span. */}
      <div className="flex-1 overflow-y-auto min-h-0" onClick={handleTickerClick} onKeyDown={handleTickerKey}>
        <div className={isFullscreen ? 'max-w-[800px] mx-auto p-4 space-y-3' : 'p-3 space-y-3'}>
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center px-1 py-10">
            <span className="text-terminal-gold font-mono font-bold leading-none" style={{ fontSize: 32 }}>M</span>
            <span className="mt-2 text-terminal-gold font-mono tracking-[0.2em] text-2xs">MADDENAI</span>
            <span className="mt-1 text-terminal-text-dim italic font-sans text-center" style={{ fontSize: 13 }}>
              Financial intelligence at your command.
            </span>

            {/* Four openers — written for the saved investor profile when there
                is one (services/aiStarters.js), otherwise the generic set. */}
            {starters.label && (
              <span className="mt-5 text-[9px] font-mono tracking-[0.16em] text-terminal-gold/70 text-center">{starters.label}</span>
            )}
            <div className={`grid grid-cols-2 gap-2 w-full ${starters.label ? 'mt-2' : 'mt-5'}`}>
              {starters.cards.map((c) => (
                <button
                  key={c.title}
                  onClick={() => send(c.prompt)}
                  disabled={loading}
                  className="empty-card text-left p-2.5 disabled:opacity-40"
                >
                  <span aria-hidden="true" className="block leading-none" style={{ fontSize: 16 }}>{c.icon}</span>
                  <span className="block mt-1.5 font-mono text-terminal-gold uppercase tracking-wider" style={{ fontSize: 11 }}>
                    {c.title}
                  </span>
                  <span className="block mt-0.5 font-sans text-terminal-text-dim leading-snug" style={{ fontSize: 11 }}>
                    {c.subtitle}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg, i) => {
          const streaming = i === chatMessages.length - 1 && loading
          const { body, followUps } = msg.role === 'assistant'
            ? splitFollowUps(msg.content, { streaming })
            : { body: msg.content, followUps: [] }
          const question = msg.role === 'assistant' ? chatMessages[i - 1]?.role === 'user' ? chatMessages[i - 1].content : null : null
          return (
          <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
            {msg.role === 'user' ? (
              <div
                className="inline-block text-terminal-text-bright text-left font-sans"
                style={{
                  fontSize: 13,
                  maxWidth: '85%',
                  padding: '10px 14px',
                  background: 'rgba(201,168,76,0.1)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  // Square only on the bottom-right, so the bubble points back
                  // at its own side of the conversation.
                  //
                  // 4px, not the 12px a chat app would use. Every other radius
                  // in this terminal is 2px; a 12px bubble here would be the
                  // single most consumer-app element on the screen and would
                  // read as imported from somewhere else. 4 is enough to
                  // distinguish the user's turn from the model's full-width
                  // reply without breaking the language.
                  borderRadius: '4px 4px 0 4px',
                }}
              >
                {msg.content}
              </div>
            ) : msg.silent && !msg.content ? (
              <div className="flex items-center justify-center py-4">
                <span className="font-mono text-[9px] tracking-[0.2em] text-terminal-text-dim animate-pulse">
                  MADDENAI · ANALYSING {(msg.context?.ticker || msg.context?.name || 'ASSET').toUpperCase()}...
                </span>
              </div>
            ) : (
              <div
                className="group"
                // The gold bar is MaddenAI's signature — the one mark that says
                // "this is the model talking" without a bubble or an avatar. At
                // 0.3 it was reading as a divider; 0.4 makes it deliberate.
                style={{ borderLeft: '2px solid rgba(201,168,76,0.4)', paddingLeft: 14, paddingTop: 8, paddingBottom: 8 }}
              >
                {msg.silent && msg.context && (
                  <div
                    className="-mx-3 mb-2 px-3 py-1.5"
                    style={{ background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}
                  >
                    <div className="font-mono text-[9px] tracking-wider text-terminal-text-dim flex items-center gap-1.5 flex-wrap">
                      {msg.context.ticker && <span className="text-terminal-text-bright font-bold">{msg.context.ticker}</span>}
                      {msg.context.price && <span>{msg.context.price}</span>}
                      {msg.context.change && (
                        <span className={/^[-−]/.test(msg.context.change) ? 'text-terminal-red' : 'text-terminal-green'}>
                          {msg.context.change}
                        </span>
                      )}
                    </div>
                    {(msg.context.exchange || msg.context.sector || msg.context.date) && (
                      <div className="font-mono text-[9px] tracking-wider text-terminal-text-dim mt-0.5">
                        {[msg.context.exchange, msg.context.sector, msg.context.date].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    {i === firstAssistantIdx && (
                      <span className="w-4 h-4 rounded-full bg-terminal-gold/15 border border-terminal-border-gold text-terminal-gold text-[9px] font-bold font-mono flex items-center justify-center flex-shrink-0">M</span>
                    )}
                    <span className="text-2xs text-terminal-gold font-mono">MADDENAI</span>
                    {msg.mode === 'research' && (
                      <span className="text-[8px] font-mono font-bold tracking-[0.16em] text-terminal-gold border border-terminal-gold/40 px-1 leading-[12px]">RESEARCH</span>
                    )}
                    {msg.at && (
                      <span className="text-[9px] font-mono text-terminal-muted/60">
                        {new Date(msg.at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    )}
                  </span>
                  {msg.content && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => isApex
                          ? saveNote(body)
                          : window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: 'SUBSCRIPTION' } }))}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title={isApex ? 'Save to notes' : 'Research Notes requires Apex — upgrade to save'}
                      >SAVE{!isApex ? ' ⊘' : ''}</button>
                      <button
                        onClick={() => copyMessage(body)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Copy to clipboard"
                      >COPY</button>
                      {!streaming && <ResponseFeedback text={body} question={question} onSaved={refreshInsights} />}
                    </div>
                  )}
                </div>

                <FormattedResponse text={body} />

                {/* Suggested follow-ups — parsed off the reply's FOLLOW_UPS
                    line. Only on the latest reply: on older ones they would
                    answer a question the conversation has moved past. */}
                {!streaming && followUps.length > 0 && i === chatMessages.length - 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Suggested follow-up questions">
                    {followUps.map((q) => (
                      <button key={q} data-followup onClick={() => send(q)} disabled={loading}
                        className="ai-followup text-left disabled:opacity-40">{q}</button>
                    ))}
                  </div>
                )}

                {msg.content && !streaming && (() => {
                  const responseActions = detectResponseActions(body)
                  return responseActions.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {responseActions.map((a) => (
                        <button
                          key={a.key}
                          onClick={a.onClick}
                          className={`text-[9px] font-mono px-2 py-0.5 border rounded-full transition-colors ${ACTION_STYLE[a.type]}`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )
                })()}

                {i === chatMessages.length - 1 && loading && !msg.content && (
                  <div className="flex items-center gap-1 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold typing-dot" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold typing-dot" style={{ animationDelay: '400ms' }} />
                  </div>
                )}
                {i === chatMessages.length - 1 && loading && msg.content && (
                  <span className="stream-cursor text-terminal-gold font-mono ml-0.5" aria-hidden="true">│</span>
                )}

              </div>
            )}
          </div>
          )
        })}
        {hasAnyReply && (
          <div className="text-2xs text-terminal-text-dim/40 text-center pt-1 font-sans">
            MaddenAI can make mistakes. Not financial advice.
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`border-t border-terminal-border p-2 flex gap-2 flex-shrink-0 ${isFullscreen ? 'max-w-[800px] mx-auto w-full' : ''}`}>
        <input
          ref={inputRef}
          className="cmd-input flex-1 text-2xs"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about ASX, RBA, AUD, markets..."
          disabled={loading}
        />
        <VoiceInterface onTranscript={(text) => send(text)} />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="text-2xs text-terminal-gold hover:text-terminal-bg hover:bg-terminal-gold px-2 py-1 border border-terminal-gold disabled:opacity-30 transition-colors"
        >
          {loading ? '...' : 'SEND'}
        </button>
      </div>
      </div>
      </div>
    </div>
  )
}
