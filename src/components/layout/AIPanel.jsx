import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { askClaude } from '../../services/api'

const QUICK_PROMPTS = [
  { label: 'ASX OUTLOOK',  prompt: 'What is the current outlook for the ASX 200 and key sector themes for Australian investors?' },
  { label: 'RBA NEXT MOVE', prompt: 'What is the most likely RBA decision at the next board meeting on 1 July 2026 and why?' },
  { label: 'AUD OUTLOOK',  prompt: 'Analyse the current AUD/USD outlook considering RBA policy, commodity prices, and global risk sentiment.' },
  { label: 'IRON ORE',     prompt: 'Analyse current iron ore market conditions and implications for Australian miners and the AUD.' },
  { label: 'CRYPTO MARKET',prompt: 'Give a brief overview of current crypto market conditions with BTC and ETH outlook in AUD terms.' },
  { label: 'GLOBAL RISK',  prompt: 'What are the top 3 geopolitical risks currently affecting Australian markets and the AUD?' },
]

// ─── Response formatter ───────────────────────────────────────────────────────

function ColorizedText({ text }) {
  const parts = text.split(/([+-]?\d+\.?\d*%)/g)
  if (parts.length === 1) return <span>{text}</span>
  return (
    <>
      {parts.map((part, i) => {
        if (/^[+-]?\d+\.?\d*%$/.test(part)) {
          const isNeg = part.startsWith('-')
          const cls   = isNeg ? 'text-terminal-red' : 'text-terminal-green'
          return <span key={i} className={cls}>{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function FormattedResponse({ content }) {
  if (!content) return null
  return (
    <div className="space-y-0.5">
      {content.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />

        // [ASSET] [PRICE] header
        if (/^\[.+\]/.test(line)) {
          return <div key={i} className="text-terminal-gold font-bold font-mono">{line}</div>
        }

        // LABEL: value  (all-caps label before colon)
        if (/^[A-Z][A-Z\s]{1,15}:/.test(line)) {
          const colonIdx = line.indexOf(':')
          const label    = line.slice(0, colonIdx)
          const rest     = line.slice(colonIdx + 1)
          return (
            <div key={i}>
              <span className="text-terminal-gold font-bold">{label}:</span>
              <ColorizedText text={rest} />
            </div>
          )
        }

        // ▲ / ▼ lines
        if (line.startsWith('▲')) return <div key={i} className="text-terminal-green">{line}</div>
        if (line.startsWith('▼')) return <div key={i} className="text-terminal-red">{line}</div>

        // Bullet points → ◆
        if (/^[-•*]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-terminal-gold flex-shrink-0 mt-0.5">◆</span>
              <ColorizedText text={line.slice(2)} />
            </div>
          )
        }

        // Numbered points
        if (/^\d+\.\s/.test(line)) {
          const m    = line.match(/^(\d+\.\s)(.*)$/)
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-terminal-gold flex-shrink-0">{m[1]}</span>
              <ColorizedText text={m[2]} />
            </div>
          )
        }

        return <div key={i}><ColorizedText text={line} /></div>
      })}
    </div>
  )
}

// ─── Notes panel ──────────────────────────────────────────────────────────────

function NotesPanel({ notes, onDelete }) {
  if (notes.length === 0) {
    return <div className="p-3 text-2xs text-terminal-text-dim/50 italic">No saved notes yet — click SAVE on any AI response</div>
  }
  return (
    <div className="overflow-auto max-h-48">
      {notes.map((note) => (
        <div key={note.id} className="border-b border-terminal-border/40 last:border-0 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-2xs text-terminal-text leading-snug line-clamp-3">{note.content.slice(0, 180)}{note.content.length > 180 ? '…' : ''}</div>
            <button onClick={() => onDelete(note.id)} className="text-terminal-text-dim/40 hover:text-terminal-red text-xs flex-shrink-0">✕</button>
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

  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [showNotes,  setShowNotes]  = useState(false)
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
            className={`text-2xs px-1.5 py-0.5 border transition-colors ${showNotes ? 'border-terminal-gold text-terminal-gold' : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'}`}
            title="Saved notes"
          >
            NOTES{notes.length > 0 ? ` (${notes.length})` : ''}
          </button>
          <button
            onClick={handleClear}
            className={`text-2xs transition-colors ${confirmClear ? 'text-terminal-red' : 'text-terminal-text-dim hover:text-terminal-red'}`}
            title={confirmClear ? 'Click again to confirm' : 'Clear conversation'}
          >
            {confirmClear ? 'CONFIRM?' : 'CLR'}
          </button>
          <button
            onClick={() => setChatOpen(false)}
            className="text-terminal-text-dim hover:text-terminal-text text-xs ml-1"
          >
            ✕
          </button>
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
            onClick={() => send(q.prompt)}
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
              <div className="text-2xs text-terminal-text leading-relaxed group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-terminal-gold">AI &gt;</span>
                  {msg.content && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => saveNote(msg.content)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Save to notes"
                      >
                        SAVE
                      </button>
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="text-terminal-text-dim hover:text-terminal-gold text-2xs"
                        title="Copy"
                      >
                        COPY
                      </button>
                    </div>
                  )}
                </div>
                <FormattedResponse content={msg.content} />
                {i === chatMessages.length - 1 && loading && (
                  <span className="inline-block w-2 h-3 bg-terminal-gold animate-pulse ml-0.5 mt-0.5" />
                )}
                {msg.stats && (
                  <div className="flex items-center gap-2 mt-1.5 text-terminal-text-dim/40 text-2xs">
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
