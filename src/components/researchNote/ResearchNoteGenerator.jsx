import { useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { generateResearchNote, RESEARCH_NOTE_STEPS, noteToShareText } from '../../services/researchNoteService'
import PrintableNote from './PrintableNote'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../ui/UpgradePrompt'
import ShareLinkModal from '../ui/ShareLinkModal'
import { createShareLink } from '../../services/sharingService'

// Stance, not rating. BUY/HOLD/SELL is a recommendation, and the note has no
// valuation behind it to support one — see researchNoteService.


// ─── Printable note — mounted off-screen at a fixed A4-proportioned width so
// html2canvas captures consistent, print-quality output regardless of the
// viewer's actual browser width. Inline styles throughout (not Tailwind
// classes) — html2canvas renders most reliably against explicit computed
// styles rather than relying on the app's CSS pipeline for an off-screen node.





// A4 at 96dpi, and the width the preview is shrunk to inside the modal.
const PAGE_W = 794
const PREVIEW_W = 640

async function downloadPDF(noteRef, symbol) {
  const canvas = await html2canvas(noteRef, {
    scale: 2,
    backgroundColor: '#FFFFFF',
    useCORS: true,
  })
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgWidth = 210
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const pageHeight = 297
  const imgData = canvas.toDataURL('image/png')

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  let heightLeft = imgHeight - pageHeight
  let position = -pageHeight
  while (heightLeft > 0) {
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    position -= pageHeight
  }
  pdf.save(`Maddex_${symbol}_Research_Note_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ─── Main modal ─────────────────────────────────────────────────────────────

export default function ResearchNoteGenerator({ asset, onClose }) {
  const { isApex, tier } = useSubscription()
  const [status, setStatus] = useState('idle') // idle | generating | complete | error
  const [stepIndex, setStepIndex] = useState(0)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const printableRef = useRef(null)
  const stepTimerRef = useRef(null)

  useEffect(() => () => clearInterval(stepTimerRef.current), [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const generate = async () => {
    setStatus('generating')
    setStepIndex(0)
    setError(null)
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, RESEARCH_NOTE_STEPS.length - 1))
    }, 1500)
    try {
      const result = await generateResearchNote(asset)
      clearInterval(stepTimerRef.current)
      setNote(result)
      setStatus('complete')
    } catch (e) {
      clearInterval(stepTimerRef.current)
      setError(e.message)
      setStatus('error')
    }
  }

  // Clipboard text, for pasting into a message.
  //
  // Deliberately the summary and the considerations rather than the whole
  // note: a full paste is unreadable in a chat window, and an EXCERPT of a
  // long argument is the easiest thing in the world to misquote. What goes on
  // the clipboard carries the stance, the reasoning behind it, and the
  // disclaimer — the three things that must never travel separately.
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

  const handleShare = () => {
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
    if (!printableRef.current) return
    setDownloading(true)
    try {
      await downloadPDF(printableRef.current, asset.symbol)
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
          <span className="text-terminal-gold font-bold tracking-widest text-sm">RESEARCH NOTE GENERATOR</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>

        {!isApex ? (
          <div className="relative" style={{ minHeight: 320 }}>
            <UpgradePrompt feature="MaddenAI Research Note Generator" requiredTier="apex" currentTier={tier} />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {status === 'idle' && (
              <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                <div className="text-3xl">📄</div>
                <div className="text-terminal-text-bright text-sm font-semibold">Generate an institutional-quality research note</div>
                <div className="text-terminal-text-dim text-2xs max-w-sm leading-relaxed">
                  MaddenAI will produce a full investment thesis, financial analysis,
                  valuation, catalysts, risks, and technicals for {asset.name} ({asset.symbol}) — exportable as a PDF.
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
                    <button
                      onClick={generate}
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >REGENERATE</button>
                    <button
                      onClick={handleCopy}
                      title="Copy a short text version to the clipboard"
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >{copied ? '✓ COPIED' : '⧉ COPY'}</button>
                    <button
                      onClick={handleShare}
                      className="text-2xs text-terminal-text-dim hover:text-terminal-gold border border-terminal-border px-3 py-1.5 transition-colors"
                    >SHARE ▾</button>
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-3 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-50"
                    >{downloading ? 'BUILDING PDF...' : 'DOWNLOAD PDF ▾'}</button>
                  </div>
                </div>
                {/* Live preview of the exact node captured for the PDF.
                    The page is a true 794px wide — A4 at 96dpi — which is
                    wider than this modal, so it was clipping on the right and
                    reading as a broken layout.
                    The SCALE LIVES ON A WRAPPER, never on the captured node.
                    html2canvas clones its target and renders it standalone, so
                    an ancestor transform is not inherited into the capture:
                    the preview shrinks to fit, the PDF is still generated from
                    a full-size, unscaled page. */}
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
                      <PrintableNote note={note} forwardRef={printableRef} />
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
