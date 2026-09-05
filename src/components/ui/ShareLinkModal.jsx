import { useState } from 'react'

// Small shared "here's your link" modal used by both Watchlist and Research
// Note sharing — same copy-to-clipboard shape, different title/copy line.
export default function ShareLinkModal({ title, brandedUrl, resolvableUrl, onClose }) {
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
          <div className="text-2xs text-terminal-text-dim">Anyone with this link gets a read-only view.</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-2 py-1.5 border border-terminal-border text-2xs text-terminal-text-bright truncate">
              {brandedUrl}
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
