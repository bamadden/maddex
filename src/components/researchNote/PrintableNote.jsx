import { displayTicker, NOTE_DISCLAIMER } from '../../services/researchNoteService'

// The on-screen preview of the research note, in document colours.
//
// It mirrors the PDF that notePdf.js builds — gold masthead, title block,
// stance box, six sections, disclaimer, footer — so what the reader sees is
// what they download. The PDF is no longer a capture of this node; it is laid
// out as text by jsPDF, which is what makes it selectable and gives every page
// a footer.
//
// Colours are literals, not theme variables: a document does not inherit the
// reader's UI theme or accent.

const INK = '#141821'
const MUTED = '#5A6472'
const RULE = '#D8DCE3'
const GOLD = '#A8862F'
const PANEL = '#F7F8FA'
const SERIF = 'Georgia, "Times New Roman", serif'
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif'

const STANCE_TONE = {
  CONSTRUCTIVE: '#2D7A4A',
  BALANCED: '#A8862F',
  CAUTIOUS: '#A83232',
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
      <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: INK, fontVariant: 'small-caps', marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

const bodyStyle = { fontFamily: SERIF, fontSize: 13, lineHeight: 1.6, color: INK }

// Model prose arrives with newlines as paragraph breaks.
function Prose({ text }) {
  if (!text) return null
  return String(text).split(/\n+/).filter((p) => p.trim()).map((p, i) => (
    <p key={i} style={{ ...bodyStyle, margin: '0 0 9px 0' }}>{p.trim()}</p>
  ))
}

function List({ items, numbered }) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag style={{ margin: 0, paddingLeft: 20 }}>
      {items.map((c, i) => <li key={i} style={{ ...bodyStyle, marginBottom: 6 }}>{c}</li>)}
    </Tag>
  )
}

export default function PrintableNote({ note, forwardRef }) {
  if (!note) return null
  const a = note.asset ?? {}
  const stance = note.stance ?? 'BALANCED'
  const tone = STANCE_TONE[stance] ?? MUTED
  // The note's own timestamp, not the clock — the same note always shows the
  // same date.
  const date = new Date(note.generatedAt ?? 0).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div ref={forwardRef} style={{ width: 794, background: '#FFFFFF', color: INK, fontFamily: SANS, paddingBottom: 28 }}>
      <div style={{ background: GOLD, color: '#FFFFFF', padding: '14px 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.3em' }}>MADDEX RESEARCH</span>
        <span style={{ fontSize: 9, letterSpacing: '0.14em' }}>GENERAL INFORMATION ONLY</span>
      </div>

      <div style={{ padding: '26px 56px 0 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, paddingBottom: 18, borderBottom: `2px solid ${INK}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' }}>{a.name ?? a.symbol}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
              {[displayTicker(a), note.sector, note.exchange].filter(Boolean).join('  ·  ')}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{date}  ·  General Information Only</div>
          </div>
          <div style={{ width: 236, flexShrink: 0, background: PANEL, border: `1px solid ${RULE}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: MUTED }}>STANCE</div>
            <div style={{ display: 'inline-block', marginTop: 6, background: tone, color: '#FFFFFF', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', padding: '3px 12px', borderRadius: 999 }}>
              {stance}
            </div>
            {note.stanceRationale && (
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 11.5, lineHeight: 1.45, color: MUTED, marginTop: 7 }}>{note.stanceRationale}</div>
            )}
            <div style={{ fontSize: 8, color: MUTED, marginTop: 7 }}>Not a recommendation — general information only</div>
          </div>
        </div>

        <Section title="Executive Summary"><Prose text={note.executiveSummary} /></Section>
        {note.businessOverview && <Section title="Business Overview"><Prose text={note.businessOverview} /></Section>}
        {note.investmentConsiderations?.length > 0 && <Section title="Investment Considerations"><List items={note.investmentConsiderations} /></Section>}
        {note.macroContext && <Section title="Sector & Macro Context"><Prose text={note.macroContext} /></Section>}
        {note.risks?.length > 0 && <Section title="Key Risks"><List items={note.risks} numbered /></Section>}
        {note.catalysts?.length > 0 && <Section title="Catalysts to Watch"><List items={note.catalysts} numbered /></Section>}
        {/* Notes saved before the six-section format. */}
        {note.investmentThesis && <Section title="Investment Thesis"><Prose text={note.investmentThesis} /></Section>}
        {note.valuationAnalysis && <Section title="Valuation"><Prose text={note.valuationAnalysis} /></Section>}
        {note.conclusion && <Section title="Conclusion"><Prose text={note.conclusion} /></Section>}

        <div style={{ marginTop: 24, background: PANEL, border: `1px solid ${RULE}`, padding: '10px 14px' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: MUTED, marginBottom: 4 }}>IMPORTANT INFORMATION</div>
          <div style={{ fontFamily: SERIF, fontSize: 10.5, lineHeight: 1.55, color: MUTED }}>{NOTE_DISCLAIMER}</div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 8, borderTop: `1.5px solid ${GOLD}`, display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: '0.1em', color: MUTED }}>
          <span>MADDEX INTELLIGENCE · GENERAL INFORMATION ONLY · maddex.com.au</span>
        </div>
      </div>
    </div>
  )
}
