import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { askClaude } from '../../services/api'

// ─── Quick prompts (base templates — live data injected at call time) ─────────

const QUICK_PROMPTS = [
  {
    label:  'ASX OUTLOOK',
    prompt: 'What is the current outlook for the ASX 200 and key sector themes for Australian investors?',
    dataKeys: ['asx', 'aud'],
  },
  {
    label:  'RBA NEXT MOVE',
    prompt: 'What is the most likely RBA decision at the next board meeting on 1 July 2026 and why?',
    dataKeys: ['asx', 'aud'],
  },
  {
    label:  'AUD OUTLOOK',
    prompt: 'Analyse the current AUD/USD outlook considering RBA policy, commodity prices, and global risk sentiment.',
    dataKeys: ['aud'],
  },
  {
    label:  'IRON ORE',
    prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.',
    dataKeys: ['aud'],
  },
  {
    label:  'CRYPTO MARKET',
    prompt: 'Give a brief overview of current crypto market conditions with BTC and ETH outlook in AUD terms.',
    dataKeys: ['btc', 'eth'],
  },
  {
    label:  'GLOBAL RISK',
    prompt: 'What are the top 3 geopolitical risks currently affecting Australian markets and the AUD?',
    dataKeys: ['asx', 'aud'],
  },
]

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
    <div style={{ fontSize: '11px', lineHeight: '1.7', fontFamily: 'var(--font)' }}>
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

export default function AIPanel() {
  const {
    chatOpen, setChatOpen,
    chatMessages, addChatMessage, updateLastChatMessage, clearChatMessages,
  } = useStore()

  const queryClient = useQueryClient()

  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showNotes,    setShowNotes]    = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('madden_ai_notes') ?? '[]') } catch { return [] }
  })

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  // Global intelligence "ASK AI" button hook
  useEffect(() => {
    const handler = (e) => {
      const prompt = e.detail?.prompt
      if (!prompt) return
      setChatOpen(true)
      setTimeout(() => send(prompt), 100)
    }
    window.addEventListener('madden:ask-ai', handler)
    return () => window.removeEventListener('madden:ask-ai', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live data injection for quick prompts ─────────────────────────────────

  const buildQuickPrompt = useCallback((item) => {
    const fxRates     = queryClient.getQueryData(['fxRates'])
    const indicesData = queryClient.getQueryData(['yfBatch', 'indices'])
    const cryptoData  = queryClient.getQueryData(['cryptoMarkets', 'aud'])

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

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { role: 'user', content: text }
    addChatMessage(userMsg)
    addChatMessage({ role: 'assistant', content: '' })

    const history = chatMessages
      .filter((m) => m.role !== 'system')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const result = await askClaude(
        [...history, userMsg],
        (_, full) => updateLastChatMessage({ role: 'assistant', content: full })
      )
      updateLastChatMessage((prev) => ({
        ...prev,
        stats: { elapsed: result.elapsed, outputTokens: result.outputTokens },
      }))
    } catch (err) {
      updateLastChatMessage({
        role: 'assistant',
        content: `[ERROR] ${err.message}\n\nEnsure VITE_ANTHROPIC_API_KEY is set in .env`,
      })
    } finally {
      setLoading(false)
    }
  }

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

  if (!chatOpen) return null

  return (
    <div className="w-80 xl:w-96 flex flex-col border-l border-terminal-border bg-terminal-panel flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold text-terminal-gold tracking-widest">▲ MADDEX AI</span>
          {turnCount > 0 && (
            <span className="text-2xs text-terminal-text-dim/50">Turn {turnCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-terminal-text-dim">claude-sonnet-4-6</span>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`text-2xs px-1.5 py-0.5 border transition-colors ${
              showNotes
                ? 'border-terminal-gold text-terminal-gold'
                : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
            }`}
            title="Saved notes"
          >
            NOTES{notes.length > 0 ? ` (${notes.length})` : ''}
          </button>
          <button
            onClick={handleClear}
            className={`text-2xs transition-colors ${
              confirmClear ? 'text-terminal-red' : 'text-terminal-text-dim hover:text-terminal-red'
            }`}
            title={confirmClear ? 'Click again to confirm' : 'Clear conversation'}
          >
            {confirmClear ? 'CONFIRM?' : 'CLR'}
          </button>
          <button
            onClick={() => setChatOpen(false)}
            className="text-terminal-text-dim hover:text-terminal-text text-xs ml-1"
          >✕</button>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="border-b border-terminal-border flex-shrink-0">
          <div className="px-3 py-1 bg-terminal-header text-2xs text-terminal-gold font-bold tracking-widest border-b border-terminal-border/50">
            SAVED NOTES
          </div>
          <NotesPanel notes={notes} onDelete={deleteNote} />
        </div>
      )}

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-terminal-border flex-shrink-0">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            onClick={() => send(buildQuickPrompt(q))}
            disabled={loading}
            className="text-2xs px-2 py-0.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
            {msg.role === 'user' ? (
              <div className="inline-block bg-terminal-accent px-2 py-1 text-2xs text-terminal-text-bright text-left max-w-[90%]">
                <span className="text-terminal-gold text-2xs block mb-0.5">YOU &gt;</span>
                {msg.content}
              </div>
            ) : (
              <div className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs text-terminal-gold">AI &gt;</span>
                  {msg.content && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => saveNote(msg.content)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Save to notes"
                      >SAVE</button>
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Copy to clipboard"
                      >COPY</button>
                    </div>
                  )}
                </div>

                <FormattedResponse text={msg.content} />

                {i === chatMessages.length - 1 && loading && (
                  <span className="inline-block w-2 h-3 bg-terminal-gold animate-pulse ml-0.5 mt-0.5" />
                )}

                {msg.stats && (
                  <div className="flex items-center gap-2 mt-2 text-2xs" style={{ color: 'var(--mt-muted)', fontSize: '10px' }}>
                    <span>Generated in {msg.stats.elapsed}s</span>
                    <span>·</span>
                    <span>{msg.stats.outputTokens} tokens</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-terminal-border p-2 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          className="cmd-input flex-1 text-2xs"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about ASX, RBA, AUD, markets..."
          disabled={loading}
        />
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
