import { useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

// Relative age — "2m ago" reads faster than a wall-clock stamp for a
// freshness indicator, which is the only thing this is used for.
function timeAgo(ts) {
  if (!ts) return null
  const secs = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000))
  if (secs < 10) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

// Page-level header for each top-level module (Markets, Crypto, Rates, ...).
// Distinct from the smaller `.panel-header` class used on sub-panels within
// a module — this is the one identity banner per module, always in the same
// place with the same shape, so switching modules feels consistent. All 14
// modules render through here, so this file is the single place that defines
// module-header geometry.
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

  const iconBtn =
    'flex items-center justify-center w-6 h-6 text-terminal-muted hover:text-terminal-gold transition-colors flex-shrink-0'

  return (
    <div className="group/mh flex-shrink-0 relative flex items-center h-12 px-5 bg-terminal-bg border-b border-terminal-gold/10">
      {/* Identity: name, then an optional sub-label on the same baseline —
          a second line here made the header's height vary per module. */}
      <div className="flex items-baseline gap-3 min-w-0">
        {/* 13px, not 11 — keeps the gold mono terminal identity while staying
            legible at a glance as the module you're currently in. */}
        <span className="font-mono font-semibold text-[13px] tracking-[0.18em] uppercase text-terminal-gold whitespace-nowrap">
          {title}
        </span>
        {subtitle && (
          <span className="font-sans text-[11px] text-terminal-muted/70 truncate">{subtitle}</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Status, not a control — stays visible. */}
      {live != null && (
        <span className={`flex items-center gap-1.5 text-[8px] font-mono tracking-wider flex-shrink-0 mr-2 ${live ? 'text-terminal-green' : 'text-terminal-gold'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full pulse-gold ${live ? 'bg-terminal-green' : 'bg-terminal-gold'}`} />
          {live ? 'LIVE' : 'DEMO'}
        </span>
      )}

      {/* Module-specific controls stay visible — hiding a module's own
          filters behind a hover would make them undiscoverable. */}
      {right}

      {/* The three standard affordances are noise until wanted, so they fade
          in on header hover. focus-within keeps them reachable by keyboard. */}
      <div className="flex items-center gap-2 ml-2 opacity-0 group-hover/mh:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
        {isFetching ? (
          <span className="text-terminal-muted text-[9px] font-mono animate-pulse whitespace-nowrap">REFRESHING…</span>
        ) : lastUpdated ? (
          <span className="text-terminal-muted text-[9px] font-mono whitespace-nowrap">{timeAgo(lastUpdated)}</span>
        ) : null}
        {onRefresh && (
          <button onClick={handleRefresh} title="Refresh" aria-label="Refresh" className={iconBtn}>
            <RefreshCw size={14} strokeWidth={2} className={spinning ? 'animate-spin' : ''} />
          </button>
        )}
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
              aria-label="Toggle fullscreen"
              className={`${iconBtn} text-[14px] leading-none`}
            >⤢</button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('madden:pop-out', { detail: { moduleId, title } }))}
              title="Pop out into a floating window"
              aria-label="Pop out into a floating window"
              className={`${iconBtn} text-[14px] leading-none`}
            >⊡</button>
          </>
        )}
      </div>

      {/* Gold gradient underline, fading to transparent */}
      <div
        className="absolute bottom-0 left-0 h-px w-full pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(201,168,76,0.4) 0%, rgba(201,168,76,0.1) 40%, transparent 100%)',
        }}
      />
    </div>
  )
}
