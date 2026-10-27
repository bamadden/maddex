import { lazy, Suspense, useState } from 'react'
import { deleteNoteFromHistory, noteId, NOTE_KIND_LABEL } from '../../services/researchNoteService'
import { useResearchHistory } from '../../hooks/useResearchHistory'

// SAVED RESEARCH — the last ten research notes, in the MaddenAI panel.
//
// A note is stored whole when it is generated (researchNoteService), so
// reopening it is free and shows exactly what was written. The generator and
// the PDF builder (jsPDF) load only when a note is opened or exported.

const ResearchNoteGenerator = lazy(() => import('./ResearchNoteGenerator'))

const STANCE_TONE = { CONSTRUCTIVE: '#2D8A50', BALANCED: '#C9A84C', CAUTIOUS: '#A83232' }

export default function SavedResearch() {
  const notes = useResearchHistory()
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)

  const exportPdf = async (n) => {
    setBusy(noteId(n))
    try { (await import('./notePdf')).downloadNotePdf(n) } finally { setBusy(null) }
  }

  if (!notes.length) {
    return (
      <div className="p-3 text-2xs text-terminal-text-dim/50 italic">
        No research notes yet — generate one from any stock's detail panel or the Screener.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-auto max-h-56">
        {notes.map((n) => {
          const stance = n.stance ?? NOTE_KIND_LABEL[n.kind] ?? 'BALANCED'
          const tone = STANCE_TONE[stance] ?? '#8BA3C4'
          return (
            <div key={noteId(n)} className="group flex items-center gap-2 border-b border-terminal-border/40 last:border-0 px-3 py-1.5 hover:bg-terminal-surface2">
              <button onClick={() => setOpen(n)} className="flex-1 min-w-0 text-left" title="Open this note">
                <div className="text-xs text-terminal-text-bright truncate">
                  {n.asset.name ?? n.asset.symbol} {n.asset.symbol !== 'PORTFOLIO' && <span className="text-terminal-text-dim font-mono">{String(n.asset.symbol).replace(/\.AX$/i, '')}</span>}
                </div>
                <div className="text-[9px] text-terminal-text-dim/60 font-mono">
                  {new Date(n.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </button>
              <span className="text-[9px] font-bold font-mono px-1.5 py-px flex-shrink-0" style={{ color: tone, border: `1px solid ${tone}66` }}>{stance}</span>
              <button
                onClick={() => exportPdf(n)}
                disabled={busy === noteId(n)}
                className="text-[9px] font-bold font-mono text-terminal-gold/80 hover:text-terminal-gold border border-terminal-border px-1.5 py-px disabled:opacity-50"
              >PDF</button>
              <button
                onClick={() => deleteNoteFromHistory(noteId(n))}
                className="text-[9px] font-bold font-mono text-terminal-text-dim/60 hover:text-terminal-red px-1"
                title="Delete from history"
              >DELETE</button>
            </div>
          )
        })}
      </div>
      {open && (
        <Suspense fallback={null}>
          <ResearchNoteGenerator initialNote={open} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </>
  )
}
