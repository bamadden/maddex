import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import { askClaude, buildSystemPrompt } from '../../services/api'
import { RBA_MEETINGS_2026, LAST_DECISIONS, getNextMeeting } from '../../services/centralBankSchedule'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import VoiceInterface from '../voice/VoiceInterface'
import { soundService } from '../../services/soundService'
import { createAlert } from '../../services/alertsService'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import { logActivity } from '../../services/activityLogService'
import { listConversations, saveConversation, deleteConversation } from '../../services/aiHistoryService'
import { getAiPreferences } from '../../services/aiPreferencesService'

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
  } catch {}
}

// ─── Quick prompts (base templates — live data injected at call time) ─────────

const nextRbaMeeting = getNextMeeting(RBA_MEETINGS_2026)
const nextRbaLabel = nextRbaMeeting
  ? nextRbaMeeting.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  : 'the next scheduled meeting'
const lastRbaLabel = new Date(`${LAST_DECISIONS.RBA.date}T00:00:00`)
  .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

// Exactly 6, rendered 2 rows of 3 — row order matters (matches the grid flow).
// Post-response ticker detection is checked against the real mock universe
// rather than a bare regex, so it doesn't fire on capitalised acronyms like
// RBA/CPI/GDP that a bare [A-Z]{2,5} match would catch.
const VALID_TICKERS = new Set([...Object.keys(MOCK_ASX_STOCKS), ...Object.keys(MOCK_US_STOCKS)])

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
  prompt: `What is the most likely RBA decision at the next board meeting on ${nextRbaLabel} and why? Current cash rate is 4.35% after the RBA ${LAST_DECISIONS.RBA.decision.toLowerCase()} at its ${lastRbaLabel} meeting (${LAST_DECISIONS.RBA.note}).`,
  dataKeys: ['asx', 'aud'],
}

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
    RBA_PROMPT,
    { label: 'AUD/USD OUTLOOK', prompt: 'Analyse the current AUD/USD outlook considering RBA policy, commodity prices, and global risk sentiment.', dataKeys: ['aud'] },
    { label: 'YIELD CURVE ANALYSIS', prompt: 'What is the current AU yield curve telling us, and how does it compare to the US curve?', dataKeys: [] },
    { label: 'RATE CUT TIMELINE', prompt: 'What is the market currently pricing for the RBA rate cut/hold timeline over the next 12 months?', dataKeys: ['aud'] },
  ],
  macro: [
    { label: 'AU MACRO OUTLOOK', prompt: 'Summarise the current Australian macroeconomic outlook — growth, inflation, and labour market.', dataKeys: ['aud'] },
    { label: 'INFLATION TRAJECTORY', prompt: "What is the current trajectory of Australian inflation and how does it compare to the RBA's target band?", dataKeys: [] },
    { label: 'RBA POLICY OUTLOOK', prompt: RBA_PROMPT.prompt, dataKeys: ['asx', 'aud'] },
    { label: 'GLOBAL RECESSION RISK', prompt: 'What is the current assessment of global recession risk and how would it affect Australian markets?', dataKeys: ['asx'] },
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

const DEFAULT_PROMPTS = [
  { label: 'ASX OUTLOOK TODAY', prompt: 'What is the current outlook for the ASX 200 and key sector themes for Australian investors?', dataKeys: ['asx', 'aud'] },
  RBA_PROMPT,
  { label: 'IRON ORE OUTLOOK', prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.', dataKeys: ['aud'] },
  { label: 'AUD/USD OUTLOOK', prompt: 'Analyse the current AUD/USD outlook considering RBA policy, commodity prices, and global risk sentiment.', dataKeys: ['aud'] },
]

// selectedSymbol: the ticker currently open in the stock detail modal, if
// any — asset-specific prompts take priority over module-specific ones.
function getQuickPrompts(activeModule, selectedSymbol) {
  if (selectedSymbol) {
    const bare = selectedSymbol.replace('.AX', '')
    return [
      { label: `ANALYSE ${bare}`, prompt: `Give a concise analysis of ${selectedSymbol} — current price action, key drivers, and near-term outlook.`, dataKeys: [] },
      { label: `${bare} PRICE TARGETS`, prompt: `What are reasonable price targets for ${selectedSymbol} based on current technicals and fundamentals?`, dataKeys: [] },
      { label: `NEWS ON ${bare}`, prompt: `What news or catalysts are currently driving ${selectedSymbol} right now?`, dataKeys: [] },
      { label: `${bare} RISK FACTORS`, prompt: `What are the key risk factors investors should watch for ${selectedSymbol}?`, dataKeys: [] },
    ]
  }
  return MODULE_PROMPTS[activeModule] ?? DEFAULT_PROMPTS
}

// ─── Inline text formatter (replaces markdown with styled HTML) ───────────────

function formatInline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<span style="color:var(--mt-text);font-weight:700">$1</span>')
    .replace(/\*([^*]+)\*/g,     '<span style="color:var(--mt-muted)">$1</span>')
    .replace(/(\+[\d.]+%)/g,    '<span style="color:var(--color-gain)">$1</span>')
    .replace(/(−[\d.]+%|-[\d.]+%)/g, '<span style="color:var(--color-loss)">$1</span>')
    .replace(/A?\$[\d,]+(?:\.[\d]+)?/g, '<span style="color:var(--mt-gold)">$&</span>')
    .replace(/US\$[\d,]+(?:\.[\d]+)?/g, '<span style="color:var(--mt-muted)">$&</span>')
    .replace(/^#+\s*/g, '')
}

// ─── Sentiment score rendering ─────────────────────────────────────────────────

function scoreColour(score) {
  if (score >= 67) return 'var(--color-gain)'
  if (score >= 34) return 'var(--mt-amber, #fbbf24)'
  return 'var(--color-loss)'
}

function sentimentLabelColour(label) {
  const u = label?.toUpperCase()
  if (u === 'BULLISH' || u === 'RISK ON') return 'var(--color-gain)'
  if (u === 'BEARISH' || u === 'RISK OFF') return 'var(--color-loss)'
  return 'var(--mt-amber, #fbbf24)'
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
  const m = text.match(/^([\w][\w\s]*):\s*(\d+)\/100(?:\s*[—\-]\s*([A-Z][A-Z\s]+))?/)
  if (!m) return null
  const score = parseInt(m[2], 10)
  return { label: m[1].trim(), score, sentiment: m[3]?.trim() ?? null }
}

// Check if we're inside a SENTIMENT: section (simple heuristic: label is one of the known fields)
const SENTIMENT_FIELDS = new Set(['Overall', 'Momentum', 'Volume', 'Macro Alignment', 'Risk',
  'Overall Market', 'Sector Momentum', 'Macro Environment', 'Global Risk'])

// ─── Formatted response renderer ──────────────────────────────────────────────

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

        // ALL-CAPS label: value  (ASSESSMENT: / LEVELS: / OUTLOOK: etc.)
        if (
          /^[A-Z][A-Z\s\/]+:/.test(trimmed) &&
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
        if (/^[◆\-\*•]\s/.test(trimmed)) {
          const content = trimmed.replace(/^[◆\-\*•]\s*/, '')
          const parsed  = parseSentimentBullet(content)

          if (parsed && SENTIMENT_FIELDS.has(parsed.label)) {
            return (
              <div key={i} style={{ display:'flex', gap:'8px', padding:'2px 0 2px 8px', alignItems:'center' }}>
                <span style={{ color:'var(--mt-gold)', flexShrink:0 }}>◆</span>
                <span style={{ color:'var(--mt-muted)', minWidth:'120px', flexShrink:0 }}>{parsed.label}:</span>
                {parsed.score != null
                  ? <ScoreBar score={parsed.score} />
                  : <span style={{ color:'var(--mt-muted)' }}>N/A</span>
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

export default function AIPanel({ wide = false }) {
  const {
    chatOpen, setChatOpen,
    aiMode, setAiMode,
    chatMessages, setChatMessages, addChatMessage, updateLastChatMessage, clearChatMessages,
    addNotification, activeModule, modalAsset, watchlist, addToWatchlist,
  } = useStore()
  const [showHistory, setShowHistory] = useState(false)
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
  const quickPrompts = getQuickPrompts(activeModule, modalAsset?.symbol)

  const queryClient = useQueryClient()

  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
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

  // Global intelligence "ASK AI" button hook — dispatched by asset/headline/
  // chokepoint click sites across the terminal. The prompt is sent to Claude
  // but never shown as a user bubble; see `send(text, { silent, context })`.
  useEffect(() => {
    const handler = (e) => {
      const { prompt, context, fullscreen: wantFullscreen } = e.detail ?? {}
      if (!prompt) return
      setChatOpen(true)
      if (wantFullscreen) setAiMode('fullscreen')
      setTimeout(() => send(prompt, { context, silent: true }), 100)
    }
    window.addEventListener('madden:ask-ai', handler)
    return () => window.removeEventListener('madden:ask-ai', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      try { localStorage.setItem('madden_ai_notes', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      try { localStorage.setItem('madden_ai_notes', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────

  // Dynamic per-turn context — active module/selected asset/watchlist/
  // portfolio/date. This is prepended to the USER message, never to the
  // system prompt: it changes on almost every turn, and anything volatile
  // inside the cached system prefix invalidates the prompt cache each call.
  const buildDynamicContext = useCallback(() => {
    if (!getAiPreferences().contextAwareness) return ''
    const moduleLabel = MODULE_LABELS[activeModule] ?? activeModule
    let holdingsCount = 0
    try { holdingsCount = (JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]')).length } catch { /* best-effort */ }
    const lines = [
      `Today's date: ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      `User is currently viewing: ${moduleLabel}`,
    ]
    if (modalAsset?.symbol) lines.push(`Asset currently open in detail view: ${modalAsset.symbol}`)
    if (watchlist?.length) lines.push(`User's watchlist: ${watchlist.join(', ')}`)
    lines.push(holdingsCount > 0 ? `User has ${holdingsCount} portfolio holding(s) tracked.` : 'User has no portfolio holdings tracked yet.')
    return `[CONTEXT]\n${lines.join('\n')}\n\n`
  }, [activeModule, modalAsset, watchlist])

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

    // Displayed turn keeps the clean text; the wire turn carries the context
    // prefix so the cached system prefix stays byte-identical between calls.
    const userTurn     = { role: 'user', content: text }
    const userTurnWire = { role: 'user', content: `${buildDynamicContext()}${text}` }
    if (!silent) addChatMessage(userTurn)
    addChatMessage(silent ? { role: 'assistant', content: '', silent: true, context } : { role: 'assistant', content: '' })

    const history = chatMessages
      .filter((m) => m.role !== 'system')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const result = await askClaude(
        [...history, userTurnWire],
        (_, full) => updateLastChatMessage({ role: 'assistant', content: full }),
        { systemPrompt: buildSystemPrompt(profile?.experience_level) }
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

  // Auto-analyse — when enabled in Settings, opening an asset's detail view
  // while the AI panel is already open auto-sends the ANALYSE quick prompt
  // for it, so a new symbol never gets analysed twice in a row.
  const lastAutoAnalysedRef = useRef(null)
  useEffect(() => {
    if (!chatOpen || !modalAsset?.symbol) return
    if (!getAiPreferences().autoAnalyse) return
    if (lastAutoAnalysedRef.current === modalAsset.symbol) return
    lastAutoAnalysedRef.current = modalAsset.symbol
    const prompt = getQuickPrompts(activeModule, modalAsset.symbol)[0]?.prompt
    if (prompt) send(prompt)
  }, [modalAsset, chatOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Monogram + disclaimer each appear once per session, not per message.
  const detectResponseActions = useCallback((text) => {
    if (!text) return []
    const actions = []
    const candidates = [...new Set(text.match(/\b[A-Z]{2,5}(?:\.AX)?\b/g) ?? [])]
    const tickers = candidates
      .map((t) => (VALID_TICKERS.has(t) ? t : VALID_TICKERS.has(`${t}.AX`) ? `${t}.AX` : null))
      .filter(Boolean)
    const uniqueTickers = [...new Set(tickers)]

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
              : 'fixed inset-0 z-40 md:relative md:inset-auto md:z-auto w-full md:w-80 xl:w-96 flex flex-col border-l border-terminal-border bg-terminal-panel flex-shrink-0'
      }
      style={isPip ? { left: pipPos.x, top: pipPos.y, width: 320, height: 400, opacity: pipHovered ? 1 : 0.85 } : undefined}
    >
      {/* Header */}
      <div
        onMouseDown={isPip ? onPipDragStart : undefined}
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.35)', background: 'var(--mt-header, #0A1F3D)', cursor: isPip ? 'grab' : undefined }}
      >
        <div className="flex items-center gap-2" title="Model: Claude Sonnet">
          <span className="text-2xs font-semibold text-terminal-gold tracking-widest font-mono">MADDENAI</span>
          {turnCount > 0 && (
            <span className="text-2xs text-terminal-text-dim/50">Turn {turnCount}</span>
          )}
          {confirmClear ? (
            <button onClick={handleClear} className="text-2xs text-terminal-red ml-1">CONFIRM CLEAR?</button>
          ) : chatMessages.length > 0 && (
            <button onClick={handleClear} className="text-2xs text-terminal-text-dim/40 hover:text-terminal-red ml-1" title="Clear conversation">CLR</button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
              showHistory ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
            }`}
            title={`Conversation history${historyList.length > 0 ? ` (${historyList.length})` : ''}`}
          >
            🕐
          </button>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`w-6 h-6 flex items-center justify-center text-xs transition-colors ${
              showNotes ? 'text-terminal-gold' : 'text-terminal-text-dim hover:text-terminal-gold'
            }`}
            title={`Saved notes${notes.length > 0 ? ` (${notes.length})` : ''}`}
          >
            🗒
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
                    <div className="text-2xs text-terminal-text-bright truncate">{conv.preview || 'Untitled'}</div>
                  </div>
                  <span
                    onClick={(e) => removeConversation(conv.id, e)}
                    className="text-terminal-text-dim/40 hover:text-terminal-red text-2xs opacity-0 group-hover:opacity-100 flex-shrink-0 px-0.5"
                    title="Delete"
                  >🗑</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

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
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={isFullscreen ? 'max-w-[800px] mx-auto p-4 space-y-3' : 'p-3 space-y-3'}>
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="w-10 h-10 rounded-full bg-terminal-gold/15 border border-terminal-border-gold text-terminal-gold text-base font-bold font-mono flex items-center justify-center">M</span>
            <span className="text-2xs text-terminal-text-dim tracking-[0.2em] font-mono">READY</span>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
            {msg.role === 'user' ? (
              <div
                className="inline-block bg-terminal-surface2 border-l-2 border-terminal-gold px-2.5 py-1.5 text-terminal-text-bright text-left max-w-[90%] font-sans"
                style={{ fontSize: 13, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
              >
                <span className="text-terminal-gold text-2xs font-mono block mb-0.5">YOU &gt;</span>
                {msg.content}
              </div>
            ) : msg.silent && !msg.content ? (
              <div className="flex items-center justify-center py-4">
                <span className="font-mono text-[9px] tracking-[0.2em] text-terminal-text-dim animate-pulse">
                  MADDENAI · ANALYSING {(msg.context?.ticker || msg.context?.name || 'ASSET').toUpperCase()}...
                </span>
              </div>
            ) : (
              <div className="group">
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
                  </span>
                  {msg.content && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => isApex
                          ? saveNote(msg.content)
                          : window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: 'SUBSCRIPTION' } }))}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title={isApex ? 'Save to notes' : 'Research Notes requires Apex — upgrade to save'}
                      >SAVE{!isApex ? ' 🔒' : ''}</button>
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Copy to clipboard"
                      >COPY</button>
                    </div>
                  )}
                </div>

                <FormattedResponse text={msg.content} />

                {msg.content && !(i === chatMessages.length - 1 && loading) && (() => {
                  const responseActions = detectResponseActions(msg.content)
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
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold pulse-gold" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold pulse-gold" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-gold pulse-gold" style={{ animationDelay: '400ms' }} />
                  </div>
                )}
                {i === chatMessages.length - 1 && loading && msg.content && (
                  <span className="inline-block w-2 h-3 bg-terminal-gold animate-pulse ml-0.5 mt-0.5" />
                )}

              </div>
            )}
          </div>
        ))}
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
  )
}
