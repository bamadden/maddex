import { useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { generateResearchNote, RESEARCH_NOTE_STEPS } from '../../services/researchNoteService'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../ui/UpgradePrompt'
import ShareLinkModal from '../ui/ShareLinkModal'
import { createShareLink } from '../../services/sharingService'

// Stance, not rating. BUY/HOLD/SELL is a recommendation, and the note has no
// valuation behind it to support one — see researchNoteService.
const STANCE_COLOR = {
  CONSTRUCTIVE: { bg: '#0e2a1a', text: '#3dad65', border: '#2d8a50' },
  BALANCED:     { bg: '#16304f', text: '#8ba3c4', border: '#637899' },
  CAUTIOUS:     { bg: '#2a1414', text: '#c93e3e', border: '#a83232' },
  'UNDER REVIEW': { bg: '#16304f', text: '#8ba3c4', border: '#637899' },
}

const todayStr = () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

// ─── Printable note — mounted off-screen at a fixed A4-proportioned width so
// html2canvas captures consistent, print-quality output regardless of the
// viewer's actual browser width. Inline styles throughout (not Tailwind
// classes) — html2canvas renders most reliably against explicit computed
// styles rather than relying on the app's CSS pipeline for an off-screen node.
const PAGE_W = 800 // px, ~A4 width at ~96dpi-equivalent scale for this capture

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', borderBottom: '2px solid #C9A84C' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#C9A84C', fontSize: 18 }}>▲</span>
        <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>MADDEX</span>
      </div>
      <span style={{ color: '#8BA3C4', fontSize: 10, letterSpacing: 3 }}>EQUITY RESEARCH</span>
      <span style={{ color: '#637899', fontSize: 10 }}>{todayStr()}</span>
    </div>
  )
}

function Footer({ page, totalPages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 40px', borderTop: '1px solid #16304F', marginTop: 20 }}>
      <span style={{ color: '#637899', fontSize: 9 }}>MADDEX FINANCIAL INTELLIGENCE · General information only · Not financial advice · {todayStr()}</span>
      <span style={{ color: '#637899', fontSize: 9 }}>{page} / {totalPages}</span>
    </div>
  )
}

function SectionBlock({ title, children }) {
  return (
    <div style={{ padding: '0 40px 24px' }}>
      <div style={{ color: '#C9A84C', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, borderBottom: '1px solid #16304F', paddingBottom: 6, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Para({ children }) {
  return <p style={{ color: '#E8EDF5', fontSize: 11, lineHeight: 1.7, marginBottom: 10 }}>{children}</p>
}

function PrintableNote({ note, forwardRef }) {
  const { asset, stance, stanceRationale, timeHorizon, riskRating, executiveSummary, investmentThesis, businessOverview, financialAnalysis, valuationAnalysis, catalysts, risks, technicalAnalysis, conclusion, disclaimer } = note
  const stanceStyle = STANCE_COLOR[stance] ?? STANCE_COLOR['UNDER REVIEW']

  return (
    <div ref={forwardRef} style={{ width: PAGE_W, background: '#060D1A', fontFamily: '"IBM Plex Mono", Menlo, monospace' }}>
      <Header />

      {/* Cover */}
      <div style={{ padding: '32px 40px 8px' }}>
        <div style={{ color: '#FFFFFF', fontSize: 30, fontWeight: 700, marginBottom: 6 }}>{asset.name}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <span style={{ border: '1px solid #16304F', color: '#8BA3C4', fontSize: 10, padding: '3px 8px' }}>{asset.symbol}</span>
          <span style={{ border: '1px solid #16304F', color: '#8BA3C4', fontSize: 10, padding: '3px 8px' }}>{(asset.type ?? 'EQUITY').toUpperCase()}</span>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
          <div style={{ background: stanceStyle.bg, border: `2px solid ${stanceStyle.border}`, color: stanceStyle.text, fontSize: 22, fontWeight: 700, padding: '10px 28px', letterSpacing: 2 }}>{stance}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#8BA3C4', fontSize: 11, lineHeight: 1.5 }}>{stanceRationale}</div>
          </div>
        </div>

        {/* The CURRENT PRICE / TARGET PRICE / UPSIDE row that sat here was
            arithmetic on two invented numbers: a mock quote and a model's
            guess. The note is qualitative now, so the cover states its
            character and horizon rather than a valuation it cannot support. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #16304F', marginBottom: 22 }}>
          {[
            ['STANCE', stance],
            ['HORIZON', timeHorizon],
            ['RISK', riskRating],
          ].map(([label, value], i) => (
            <div key={label} style={{ padding: '12px 14px', borderLeft: i > 0 ? '1px solid #16304F' : 'none' }}>
              <div style={{ color: '#637899', fontSize: 9, marginBottom: 4 }}>{label}</div>
              <div style={{ color: '#E8EDF5', fontSize: 15, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.06)', padding: '8px 12px', marginBottom: 18 }}>
          <div style={{ color: '#C9A84C', fontSize: 9, letterSpacing: 1.2, fontWeight: 700 }}>AI ESTIMATE · QUALITATIVE ANALYSIS</div>
          <div style={{ color: '#8BA3C4', fontSize: 9, marginTop: 3, lineHeight: 1.5 }}>
            Written by MaddenAI. Contains no price target, valuation or technical level — this note has no live market data behind it. Take every figure from the terminal&apos;s live panels, not from here.
          </div>
        </div>

        <Para>{executiveSummary}</Para>
      </div>

      <SectionBlock title="INVESTMENT THESIS">
        {investmentThesis?.split('\n').filter(Boolean).map((p, i) => <Para key={i}>{p}</Para>)}
      </SectionBlock>

      <SectionBlock title="BUSINESS OVERVIEW">
        {businessOverview?.split('\n').filter(Boolean).map((p, i) => <Para key={i}>{p}</Para>)}
      </SectionBlock>

      <SectionBlock title="FINANCIAL ANALYSIS">
        {[
          ['Revenue Outlook', financialAnalysis?.revenueOutlook],
          ['Margin Analysis', financialAnalysis?.marginAnalysis],
          ['Balance Sheet', financialAnalysis?.balanceSheet],
          ['Cash Flow', financialAnalysis?.cashFlow],
        ].map(([label, body]) => body && (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ color: '#8BA3C4', fontSize: 10, fontWeight: 700, marginBottom: 3 }}>{label.toUpperCase()}</div>
            <Para>{body}</Para>
          </div>
        ))}
      </SectionBlock>

      <SectionBlock title="VALUATION">
        {valuationAnalysis?.split('\n').filter(Boolean).map((p, i) => <Para key={i}>{p}</Para>)}
      </SectionBlock>

      <SectionBlock title="CATALYSTS">
        {(catalysts ?? []).map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <span style={{ color: '#3DAD65', fontWeight: 700, fontSize: 11 }}>{i + 1}.</span>
            <span style={{ color: '#E8EDF5', fontSize: 11, lineHeight: 1.6 }}>{c}</span>
          </div>
        ))}
      </SectionBlock>

      <SectionBlock title="RISKS">
        {(risks ?? []).map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <span style={{ color: '#C93E3E', fontWeight: 700, fontSize: 11 }}>{i + 1}.</span>
            <span style={{ color: '#E8EDF5', fontSize: 11, lineHeight: 1.6 }}>{r}</span>
          </div>
        ))}
      </SectionBlock>

      <SectionBlock title="TECHNICAL ANALYSIS">
        <div style={{ display: 'flex', gap: 24, marginBottom: 10, fontSize: 10 }}>
          <span style={{ color: '#8BA3C4' }}>TREND <b style={{ color: '#E8EDF5' }}>{technicalAnalysis?.trend}</b></span>

        </div>
        <Para>{technicalAnalysis?.momentum}</Para>
      </SectionBlock>

      <SectionBlock title="CONCLUSION">
        <Para>{conclusion}</Para>
      </SectionBlock>

      <div style={{ padding: '0 40px 20px' }}>
        <div style={{ border: '1px solid #16304F', padding: 12, color: '#637899', fontSize: 9, lineHeight: 1.6 }}>{disclaimer}</div>
      </div>

      <Footer page={1} totalPages={1} />
    </div>
  )
}

async function downloadPDF(noteRef, symbol) {
  const canvas = await html2canvas(noteRef, {
    scale: 2,
    backgroundColor: '#060D1A',
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
                {/* Live preview — the exact node captured for the PDF, at its
                    real size (no CSS transform scaling: html2canvas would
                    capture the scaled/distorted layout, not the true one). */}
                <div className="border border-terminal-border overflow-auto" style={{ maxHeight: '60vh' }}>
                  <PrintableNote note={note} forwardRef={printableRef} />
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
