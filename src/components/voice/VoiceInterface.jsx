import { useState, useRef, useCallback } from 'react'
import { useStore } from '../../store/useStore'

// "go to markets" / "show crypto" style navigation — matched against the
// same module keys App.jsx's MODULE_MAP uses.
const MODULE_KEYWORDS = {
  markets: 'markets', crypto: 'crypto', rates: 'fx', fx: 'fx', macro: 'macro',
  watchlist: 'watchlist', portfolio: 'portfolio', news: 'news', global: 'global',
  screener: 'screener', brief: 'brief', replay: 'replay',
}

function matchModule(lower) {
  for (const [keyword, moduleId] of Object.entries(MODULE_KEYWORDS)) {
    if (lower.includes(keyword)) return moduleId
  }
  return null
}

// Props: onTranscript(text) — called with the final recognised command for
// anything that isn't a direct navigation match (AIPanel wires this to its
// own send()).
export default function VoiceInterface({ onTranscript }) {
  const { setActiveModule } = useStore()
  const [status, setStatus] = useState('idle') // idle | listening | processing | error
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  const handleVoiceCommand = useCallback((command) => {
    const lower = command.toLowerCase()

    if (lower.includes('go to') || lower.includes('show ') || lower.includes('switch to')) {
      const moduleId = matchModule(lower)
      if (moduleId) {
        setActiveModule(moduleId)
        setStatus('idle')
        return
      }
    }

    // Everything else (including "analyse BHP") is a perfectly valid
    // MaddenAI chat message as-is — no need to special-case it here since
    // this voice interface already lives inside the AI panel.
    setStatus('processing')
    onTranscript?.(command)
    setTimeout(() => setStatus('idle'), 400)
  }, [setActiveModule, onTranscript])

  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input isn’t supported in this browser — try Chrome.')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-AU'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => { setStatus('listening'); setError(null); setTranscript('') }
    recognition.onend = () => { if (status === 'listening') setStatus('idle') }
    recognition.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone access denied.' : 'Voice recognition error — try again.')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }

    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0].transcript).join('')
      setTranscript(text)
      if (event.results[0].isFinal) {
        handleVoiceCommand(text)
      }
    }

    recognition.start()
  }, [status, handleVoiceCommand])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setStatus('idle')
  }, [])

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={status === 'listening' ? stopListening : startVoiceRecognition}
        disabled={status === 'processing'}
        title={status === 'listening' ? 'Stop listening' : 'Ask MaddenAI by voice'}
        className={`w-7 h-7 flex items-center justify-center border transition-colors ${
          status === 'listening'
            ? 'border-terminal-red text-terminal-red bg-terminal-red/10'
            : status === 'error'
              ? 'border-terminal-red/60 text-terminal-red'
              : status === 'processing'
                ? 'border-terminal-gold text-terminal-gold'
                : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold'
        }`}
      >
        {status === 'processing' ? (
          <span className="text-xs animate-spin inline-block">◐</span>
        ) : status === 'error' ? (
          <span className="text-xs">✕</span>
        ) : (
          <span className={`text-xs ${status === 'listening' ? 'animate-pulse' : ''}`}>🎤</span>
        )}
      </button>

      {status === 'listening' && (
        <div className="absolute bottom-full mb-2 right-0 bg-terminal-panel border border-terminal-red/40 px-3 py-2 w-56 shadow-2xl z-10">
          <div className="flex items-center gap-2 text-terminal-red">
            <div className="waveform">
              <span /><span /><span /><span /><span />
            </div>
            <span className="text-2xs font-bold tracking-widest">LISTENING...</span>
          </div>
          {transcript && <div className="text-2xs text-terminal-text-dim mt-1.5 leading-snug">{transcript}</div>}
        </div>
      )}

      {status === 'error' && error && (
        <div className="absolute bottom-full mb-2 right-0 bg-terminal-panel border border-terminal-red/40 px-3 py-2 w-56 shadow-2xl z-10">
          <div className="text-2xs text-terminal-red">{error}</div>
        </div>
      )}
    </div>
  )
}
