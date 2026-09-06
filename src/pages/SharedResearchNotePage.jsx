import { getSharedRecord } from '../services/sharingService'

// Stance, not rating.
//
// This page had drifted out of step with the note it renders. Research notes
// used to carry a BUY/HOLD/SELL `rating` and a `targetPrice`; both were
// removed at the source — a model was inventing them — and replaced with a
// qualitative `stance` plus a one-sentence `stanceRationale`. The generator
// and the share payload were updated; this reader was not.
//
// So every note shared after that change rendered here with an empty badge
// (n.rating was undefined), an empty gold line where the price target had
// been, an orphaned "· price target" caption, and no rationale at all — on
// the one surface in this app that is public and unauthenticated.
//
// BUY/HOLD/SELL are kept in the colour map only so notes shared BEFORE the
// change still render their badge. targetPrice is deliberately not read at
// all: those old values were invented, and a stale share link is not a reason
// to keep publishing one.
const STANCE_COLOR = {
  CONSTRUCTIVE: 'text-terminal-green border-terminal-green/50',
  BALANCED:     'text-terminal-gold border-terminal-gold/50',
  CAUTIOUS:     'text-terminal-red border-terminal-red/50',
  'UNDER REVIEW': 'text-terminal-text-dim border-terminal-border',
  // Legacy share links.
  BUY:  'text-terminal-green border-terminal-green/50',
  HOLD: 'text-terminal-gold border-terminal-gold/50',
  SELL: 'text-terminal-red border-terminal-red/50',
}

// Public, read-only web view of a shared research note — reached via
// maddex.com.au/research/share/[hash], routed here directly by App.jsx
// before the authenticated app mounts. A lighter web rendering of the note
// than the PDF export, not a pixel copy of it.
export default function SharedResearchNotePage({ id }) {
  const record = getSharedRecord('research', id)

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-terminal-gold text-xl">▲</span>
          <span className="text-terminal-gold font-bold tracking-widest">MADDEX</span>
          <span className="text-2xs text-terminal-text-dim ml-2 tracking-widest">EQUITY RESEARCH</span>
        </div>

        {!record ? (
          <div className="border border-terminal-border p-6 text-center">
            <div className="text-terminal-text-bright font-bold mb-2">This link isn't available</div>
            <div className="text-2xs text-terminal-text-dim">
              Shared research notes currently only resolve in the browser that created them (this feature's backend isn't live yet).
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const n = record.payload
              const stance = n.stance ?? n.rating ?? 'UNDER REVIEW'
              const stanceCls = STANCE_COLOR[stance] ?? STANCE_COLOR['UNDER REVIEW']
              return (
                <>
                  <div className="text-2xl font-bold text-terminal-text-bright mb-1">{n.assetName}</div>
                  <div className="text-2xs text-terminal-text-dim mb-4">{n.assetSymbol} · shared {new Date(record.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

                  <div className="flex items-start gap-4 mb-6">
                    <span className={`text-lg font-bold border px-4 py-1.5 flex-shrink-0 ${stanceCls}`}>{stance}</span>
                    <div className="min-w-0">
                      {n.stanceRationale && (
                        <div className="text-2xs text-terminal-text leading-relaxed">{n.stanceRationale}</div>
                      )}
                      {n.timeHorizon && (
                        <div className="text-2xs text-terminal-text-dim mt-1">Horizon: {n.timeHorizon}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">EXECUTIVE SUMMARY</div>
                      <p className="text-2xs text-terminal-text leading-relaxed">{n.executiveSummary}</p>
                    </div>
                    <div>
                      <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">CONCLUSION</div>
                      <p className="text-2xs text-terminal-text leading-relaxed">{n.conclusion}</p>
                    </div>
                  </div>

                  <div className="mt-6 border border-terminal-border p-3 text-2xs text-terminal-text-dim leading-relaxed">{n.disclaimer}</div>
                </>
              )
            })()}
          </>
        )}

        <a
          href="/"
          className="block mt-8 text-center text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >SIGN UP TO GENERATE YOUR OWN →</a>
      </div>
    </div>
  )
}
