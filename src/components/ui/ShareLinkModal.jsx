import { useEffect, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

// Small shared "here's your link" modal used by both Watchlist and Research
// Note sharing — same copy-to-clipboard shape, different title/copy line.
// `stored` (from createShareLink) resolves to 'server' or 'local'; a link that
// only this browser can open says so rather than being handed out as public.
export default function ShareLinkModal({ title, resolvableUrl, stored, onClose }) {
  useEscapeKey(onClose)
  const [where, setWhere] = useState(stored ? 'saving' : 'server')
  useEffect(() => {
    let live = true
    stored?.then((w) => { if (live) setWhere(w) })
    return () => { live = false }
  }, [stored])

  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resolvableUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard permission denied — link is still visible to copy manually */ }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-terminal-panel border border-terminal-gold/40 w-full max-w-md shadow-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">{title}</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-2xs text-terminal-text-dim">
            {where === 'saving' ? 'Saving the link…'
              : where === 'server' ? 'Anyone with this link gets a read-only view — no sign-in needed.'
              : <span className="text-terminal-gold">This link only opens in this browser — sign in to share it with anyone else.</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-2 py-1.5 border border-terminal-border text-2xs text-terminal-text-bright truncate">
              {resolvableUrl}
            </div>
            <button
              onClick={copy}
              className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors flex-shrink-0"
            >{copied ? 'COPIED ✓' : 'COPY LINK'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
