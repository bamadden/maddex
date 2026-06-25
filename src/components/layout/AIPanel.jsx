import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { askClaude } from '../../services/api'

const QUICK_PROMPTS = [
  'ASX Market Summary',
  'AUD/USD Outlook',
  'RBA Next Move',
  'Top ASX Movers',
]

export default function AIPanel() {
  const { chatOpen, setChatOpen, chatMessages, addChatMessage, updateLastChatMessage } = useStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  // Global intelligence module "ASK AI" button hook
  useEffect(() => {
    const handler = (e) => {
      const prompt = e.detail?.prompt
      if (!prompt) return
      setChatOpen(true)
      // Use a short delay so the panel opens before sending
      setTimeout(() => send(prompt), 100)
    }
    window.addEventListener('madden:ask-ai', handler)
    return () => window.removeEventListener('madden:ask-ai', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      await askClaude(
        [...history, userMsg],
        (_, full) => updateLastChatMessage({ role: 'assistant', content: full })
      )
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

  if (!chatOpen) return null

  return (
    <div className="w-80 xl:w-96 flex flex-col border-l border-terminal-border bg-terminal-panel flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-header">
        <span className="text-2xs font-semibold text-terminal-gold tracking-widest">▲ MADDEN AI</span>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-terminal-text-dim">claude-sonnet-4</span>
          <button
            onClick={() => setChatOpen(false)}
            className="text-terminal-text-dim hover:text-terminal-text text-xs ml-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-terminal-border flex-shrink-0">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={loading}
            className="text-2xs px-2 py-0.5 border border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold transition-colors disabled:opacity-40"
          >
            {q}
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
                    <button
                      onClick={() => copyMessage(msg.content)}
                      className="text-terminal-text-dim hover:text-terminal-gold text-2xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy"
                    >
                      COPY
                    </button>
                  )}
                </div>
                <span className="whitespace-pre-wrap">
                  {msg.content}
                  {i === chatMessages.length - 1 && loading && (
                    <span className="inline-block w-2 h-3 bg-terminal-gold animate-pulse ml-0.5" />
                  )}
                </span>
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
