import { LATEST_RELEASE } from '../../data/releaseNotes'

// Release notes, shown once per version (APP_VERSION, from package.json) to
// returning users. The list lives in data/releaseNotes.js, shared with
// Settings → About; the modal shows the first six and points to the rest.
const SHOWN = 6

export default function WhatsNewModal({ onDismiss, onShowMe, version }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at center, rgba(6,13,26,0.88) 0%, rgba(0,0,0,0.94) 100%)' }}
      role="dialog" aria-modal="true" aria-label="What's new">
      <div className="relative w-full max-w-md shadow-2xl font-mono"
        style={{ backgroundColor: '#0B1628', backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0) 34%)',
          border: '1px solid rgba(201,168,76,0.4)', animation: 'maddex-welcome-in 300ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div className="px-6 pt-6 pb-4 border-b border-terminal-border/40">
          <div className="flex items-baseline justify-between">
            <div className="text-terminal-gold font-bold text-sm tracking-[0.24em]">WHAT'S NEW</div>
            {version && <div className="text-[10px] text-terminal-text-dim tracking-wider">{version}</div>}
          </div>
          <div className="text-xs text-terminal-text-dim mt-1">Shipped since you were last here.</div>
        </div>

        <div className="px-6 py-5 space-y-3.5 max-h-[60vh] overflow-y-auto">
          {LATEST_RELEASE.items.slice(0, SHOWN).map((f) => (
            <div key={f.title} className="border-l-2 border-terminal-gold/50 pl-3">
              <div className="text-xs font-bold text-terminal-text-bright">{f.title}</div>
              <div className="text-xs text-terminal-text-dim leading-relaxed mt-0.5">{f.desc}</div>
            </div>
          ))}
          {LATEST_RELEASE.items.length > SHOWN && (
            <div className="text-[10px] text-terminal-text-dim tracking-wider">
              + {LATEST_RELEASE.items.length - SHOWN} more in Settings → About
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-6">
          {onShowMe && (
            <button
              onClick={onShowMe}
              className="flex-1 text-xs tracking-widest border border-terminal-gold/50 text-terminal-gold py-2 hover:bg-terminal-gold/10 transition-colors"
            >TRY MADDENAI</button>
          )}
          <button
            onClick={onDismiss}
            autoFocus
            className="flex-1 text-xs font-bold tracking-widest bg-terminal-gold text-terminal-bg py-2 hover:bg-terminal-gold-bright transition-colors"
          >GOT IT</button>
        </div>
      </div>
    </div>
  )
}
