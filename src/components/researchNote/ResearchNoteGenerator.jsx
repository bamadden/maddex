import { getUsage, recordResearchNote } from '../../services/usageService'
import { showLimitPrompt, nextTier } from '../../services/plans'
import { useEffect, useRef, useState } from 'react'
import { generateResearchNote, RESEARCH_NOTE_STEPS, noteToShareText } from '../../services/researchNoteService'
import PrintableNote from './PrintableNote'
import { downloadNotePdf } from './notePdf'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../ui/UpgradePrompt'
import ShareLinkModal from '../ui/ShareLinkModal'
import { createShareLink } from '../../services/sharingService'

// Stance, not rating. BUY/HOLD/SELL is a recommendation, and the note has no
// valuation behind it to support one — see researchNoteService.

// A4 at 96dpi, and the width the preview is shrunk to inside the modal.
const PAGE_W = 794
const PREVIEW_W = 640

// ─── Main modal ─────────────────────────────────────────────────────────────

// initialNote reopens a saved note (MaddenAI → SAVED RESEARCH) without a
// model call; asset then defaults to the note's own.
export default function ResearchNoteGenerator({ asset: assetProp, initialNote = null, onClose }) {
  const asset = assetProp ?? initialNote?.asset ?? {}
  const { canUse, limits, plan } = useSubscription()
  // Prime includes 5 notes a month, Apex unlimited (services/plans).
  const notesLeft = limits.researchNotesPerMonth - getUsage().researchNotes
  const [status, setStatus] = useState(initialNote ? 'complete' : 'idle') // idle | generating | complete | error
  const [stepIndex, setStepIndex] = useState(0)
  const [note, setNote] = useState(initialNote)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const stepTimerRef = useRef(null)

  useEffect(() => () => clearInterval(stepTimerRef.current), [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const generate = async () => {
    if (notesLeft <= 0) {
      showLimitPrompt('researchNotes', `You've used this month's ${limits.researchNotesPerMonth} research notes`, nextTier(plan))
      return
    }
    setStatus('generating')
    setStepIndex(0)
    setError(null)
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, RESEARCH_NOTE_STEPS.length - 1))
    }, 1500)
    try {
      const result = await generateResearchNote(asset)
      clearInterval(stepTimerRef.current)
      recordResearchNote()   // counted on success only — a failed call costs nothing
      setNote(result)
      setStatus('complete')
    } catch (e) {
      clearInterval(stepTimerRef.current)
      setError(e.message)
      setStatus('error')
    }
  }

  // SHARE: clipboard text, for pasting into a message — the stance, the
  // executive summary and the general-information line, which must never
  // travel separately. Not the whole note: a full paste is unreadable in a
  // chat window and an excerpt of it is easy to misquote.
  const handleCopy = async () => {
    if (!note) return
    try {
      await navigator.clipboard.writeText(noteToShareText({ ...note, asset }))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not access the clipboard.')
    }
  }

  const handleLink = () => {
    if (!note) return
    setShareLink(createShareLink('research', {
      assetName: asset.name,
      assetSymbol: asset.symbol,
      stance: note.stance,
      stanceRationale: note.stanceRationale,
      timeHorizon: note.timeHorizon,
      executiveSummary: note.executiveSummary,
      conclusion: note.conclusion,
      disclaimer: note.disclaimer,
    }))
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      downloadNotePdf({ ...note, asset })
    } catch (e) {
      setError(`PDF export failed: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-terminal-panel border border-terminal-gold/40 w-full max-w-3xl shadow-2xl font-mono max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">{note?.body ? 'SAVED RESEARCH' : 'RESEARCH NOTE GENERATOR'}</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>

        {!canUse('researchNotes') ? (
          <div className="relative" style={{ minHeight: 360 }}>
            <UpgradePrompt featureKey="researchNotes" requiredTier="prime" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {status === 'idle' && (
              <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                <div className="text-3xl">📄</div>
                <div className="text-terminal-text-bright text-sm font-semibold">Generate an institutional-quality research note</div>
                <div className="text-terminal-text-dim text-2xs max-w-sm leading-relaxed">
                  MaddenAI writes a six-section note on {asset.name} ({asset.symbol}): executive summary, business
                  overview, investment considerations, sector and macro context, key risks and catalysts to watch.
                  No price targets, no ratings. Exportable as a PDF.
                </div>
                <button
                  onClick={generate}
                  className="mt-2 text-xs font-bold text-terminal-gold border border-terminal-gold/50 px-5 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >GENERATE RESEARCH NOTE</button>
              </div>
            )}

            {status === 'generating' && (
              <div className="flex flex-col items-center justify-center gap-5 px-8 py-16 text-center">
                <div className="text-terminal-gold text-2xs font-bold tracking-widest animate-pulse">{RESEARCH_NOTE_STEPS[stepIndex]}</div>
                <div className="w-64 h-1 bg-terminal-border/40 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-terminal-gold transition-all duration-500"
                    style={{ width: `${((stepIndex + 1) / RESEARCH_NOTE_STEPS.length) * 100}%` }}
                  />
                </div>
                <div className="text-terminal-text-dim/60 text-2xs">Step {stepIndex + 1} of {RESEARCH_NOTE_STEPS.length}</div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                <div className="text-2xl text-terminal-red">⚠</div>
                <div className="text-terminal-red text-2xs max-w-sm">{error}</div>
                <button
                  onClick={generate}
                  className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                >RETRY</button>
              </div>
            )}

            {status === 'complete' && note && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-2xs text-terminal-green font-bold">✓ RESEARCH NOTE READY</span>
                  <div className="flex gap-2">
                    {!note.body && <button
                      onClick={generate}
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >REGENERATE</button>}
                    <button
                      onClick={handleCopy}
                      title="Copy the stance and executive summary to share"
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >{copied ? '✓ COPIED' : 'SHARE'}</button>
                    <button
                      onClick={handleLink}
                      title="Create a link to a summary of this note"
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >LINK ▾</button>
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-50"
                    >{downloading ? 'BUILDING PDF...' : 'DOWNLOAD PDF'}</button>
                  </div>
                </div>
                {/* Preview of the note at A4 width (794px at 96dpi), scaled
                    to fit the modal. The PDF is laid out separately by
                    notePdf.js in the same design. */}
                <div
                  className="border border-terminal-border overflow-auto bg-white/5"
                  style={{ maxHeight: '58vh' }}
                >
                  <div style={{ width: PREVIEW_W, margin: '0 auto' }}>
                    <div
                      style={{
                        transform: `scale(${PREVIEW_W / PAGE_W})`,
                        transformOrigin: 'top left',
                        width: PAGE_W,
                        // Reclaims the vertical space the scale gives back, so
                        // the scroll height matches what is actually drawn.
                        marginBottom: `calc(${PREVIEW_W / PAGE_W - 1} * 100%)`,
                      }}
                    >
                      <PrintableNote note={{ ...note, asset }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {shareLink && (
        <ShareLinkModal
          title="SHARE RESEARCH NOTE"
          brandedUrl={shareLink.brandedUrl}
          resolvableUrl={shareLink.resolvableUrl}
          onClose={() => setShareLink(null)}
        />
      )}
    </div>
  )
}
