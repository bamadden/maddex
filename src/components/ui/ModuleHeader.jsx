import { useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

function timeShort(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('en-AU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Page-level header for each top-level module (Markets, Crypto, Rates, ...).
// Distinct from the smaller `.panel-header` class used on sub-panels within
// a module — this is the one identity banner per module, always in the same
// place with the same shape, so switching modules feels consistent.
//
// `live` is optional and opt-in: pass true for "● LIVE", false for "● DEMO"
// (both pulsing), or omit it entirely — existing callers that build their
// own live/demo indicator via `right` keep working unchanged.
export default function ModuleHeader({ title, subtitle, lastUpdated, onRefresh, isFetching = false, live, right = null, moduleId = null }) {
  const [spinning, setSpinning] = useState(false)
  const spinTimer = useRef(null)

  const handleRefresh = () => {
    setSpinning(true)
    clearTimeout(spinTimer.current)
    spinTimer.current = setTimeout(() => setSpinning(false), 600)
    onRefresh?.()
  }

  return (
    <div className="flex-shrink-0 bg-terminal-surface border-b border-terminal-border relative">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="font-sans font-bold text-[18px] text-white truncate leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="font-mono text-[9px] text-terminal-muted tracking-wider truncate mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="flex-1" />
        {live != null && (
          <span className={`flex items-center gap-1.5 text-[8px] font-mono tracking-wider flex-shrink-0 ${live ? 'text-terminal-green' : 'text-terminal-gold'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full pulse-gold ${live ? 'bg-terminal-green' : 'bg-terminal-gold'}`} />
            {live ? 'LIVE' : 'DEMO'}
          </span>
        )}
        {right}
        {moduleId && (
          <>
            <button
              onClick={(e) => {
                // Fullscreens the active module's content wrapper (App.jsx's
                // `.module-fade` div) — a no-op inside a floating window,
                // which has no such ancestor.
                const el = e.currentTarget.closest('.module-fade')
                if (!el) return
                if (document.fullscreenElement) document.exitFullscreen()
                else el.requestFullscreen?.()
              }}
              title="Toggle fullscreen"
              className="flex items-center justify-center text-terminal-muted hover:text-terminal-gold transition-colors p-1 border border-terminal-border hover:border-terminal-border-gold flex-shrink-0"
            >⤢</button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('madden:pop-out', { detail: { moduleId, title } }))}
              title="Pop out into a floating window"
              className="flex items-center justify-center text-terminal-muted hover:text-terminal-gold transition-colors p-1 border border-terminal-border hover:border-terminal-border-gold flex-shrink-0"
            >⊡</button>
          </>
        )}
        {(lastUpdated || onRefresh) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {isFetching ? (
              <span className="text-terminal-muted text-2xs font-mono animate-pulse">REFRESHING...</span>
            ) : lastUpdated ? (
              <span className="text-terminal-muted text-2xs font-mono">{timeShort(lastUpdated)}</span>
            ) : null}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                title="Refresh"
                className="flex items-center justify-center text-terminal-muted hover:text-terminal-gold transition-colors p-1 border border-terminal-border hover:border-terminal-border-gold"
              >
                <RefreshCw size={12} strokeWidth={2} className={spinning ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        )}
      </div>
      {/* Gold gradient underline, fading to transparent */}
      <div
        className="absolute bottom-0 left-0 h-px w-full"
        style={{ background: 'linear-gradient(90deg, rgba(200,168,75,0.7), rgba(200,168,75,0))' }}
      />
    </div>
  )
}
