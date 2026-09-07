// The PDF layout.
//
// WHY THIS IS A SEPARATE, LIGHT-THEMED COMPONENT
//
// The export used to screenshot the on-screen note with html2canvas and a
// #060D1A background — an A4 page of near-black. That is wrong in three ways:
// it empties an ink cartridge, it is unreadable on the office printer this
// would actually be sent to, and a research note is a document, not a
// screenshot of an app.
//
// So the PDF gets its own layout in document colours: white ground, near-black
// text, gold reserved for rules and the masthead. It is rendered offscreen and
// captured, which also means the on-screen note can keep its terminal styling
// without the two fighting.
//
// Colours are literals, not theme variables. This must render identically
// whichever theme or accent the user has chosen — a document does not inherit
// the reader's UI preferences.

const INK = '#141821'
const MUTED = '#5A6472'
const RULE = '#D8DCE3'
const GOLD = '#A8862F'

const STANCE_TONE = {
  CONSTRUCTIVE: '#2D7A4A',
  BALANCED: '#A8862F',
  CAUTIOUS: '#A83232',
  'UNDER REVIEW': '#5A6472',
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 22, breakInside: 'avoid' }}>
      <div
        style={{
          fontSize: 9, letterSpacing: '0.18em', color: GOLD, fontWeight: 700,
          borderBottom: `1px solid ${RULE}`, paddingBottom: 4, marginBottom: 8,
        }}
      >{title}</div>
      {children}
    </div>
  )
}

const P = ({ children }) => (
  <p style={{ fontSize: 10.5, lineHeight: 1.65, color: INK, margin: '0 0 9px 0' }}>{children}</p>
)

// The model returns prose with newlines; those are paragraph breaks and have to
// survive into the document or four paragraphs arrive as one wall.
function Prose({ text }) {
  if (!text) return null
  return String(text).split(/\n{1,}/).filter((p) => p.trim()).map((p, i) => <P key={i}>{p.trim()}</P>)
}

export default function PrintableNote({ note, forwardRef }) {
  if (!note) return null
  const a = note.asset ?? {}
  const stance = note.stance ?? 'UNDER REVIEW'
  // Falls back to the note's own timestamp rather than the clock: this
  // component is captured into a PDF, and reading Date.now() during render
  // makes the same note produce a different document each time it is exported.
  const generated = note.generatedAt ? new Date(note.generatedAt) : null

  return (
    <div
      ref={forwardRef}
      style={{
        // 794px is A4 width at 96dpi, so html2canvas captures at the page's
        // natural proportions and jsPDF scales 1:1 instead of guessing.
        width: 794,
        padding: '0 0 48px 0',
        background: '#FFFFFF',
        color: INK,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      }}
    >
      {/* Masthead */}
      <div style={{ height: 6, background: GOLD }} />
      <div style={{ padding: '26px 48px 0 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3em', color: GOLD }}>MADDEX</div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.14em', color: MUTED }}>
            RESEARCH · GENERAL INFORMATION ONLY
          </div>
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 22, letterSpacing: '-0.01em' }}>
          RESEARCH NOTE
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, paddingBottom: 14, borderBottom: `2px solid ${INK}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{a.name ?? a.symbol}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
              {a.symbol}{a.type ? ` · ${String(a.type).toUpperCase()}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                display: 'inline-block', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                color: STANCE_TONE[stance] ?? MUTED,
                border: `1px solid ${STANCE_TONE[stance] ?? MUTED}`,
                padding: '3px 9px',
              }}
            >{stance}</div>
            {generated && (
              <div style={{ fontSize: 9, color: MUTED, marginTop: 5 }}>
                {generated.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            {note.riskRating && (
              <div style={{ fontSize: 9, color: MUTED }}>Risk: {note.riskRating}</div>
            )}
          </div>
        </div>

        {note.stanceRationale && (
          <div style={{ fontSize: 10, color: MUTED, fontStyle: 'italic', marginTop: 12, lineHeight: 1.6 }}>
            {note.stanceRationale}
          </div>
        )}

        <Section title="EXECUTIVE SUMMARY">
          <Prose text={note.executiveSummary} />
        </Section>

        {note.investmentConsiderations?.length > 0 && (
          <Section title="INVESTMENT CONSIDERATIONS">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {note.investmentConsiderations.map((c, i) => (
                <li key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: INK, marginBottom: 5 }}>{c}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="BUSINESS OVERVIEW">
          <Prose text={note.businessOverview} />
        </Section>

        <Section title="INVESTMENT THESIS">
          <Prose text={note.investmentThesis} />
        </Section>

        {note.macroContext && (
          <Section title="SECTOR & MACRO CONTEXT">
            <Prose text={note.macroContext} />
          </Section>
        )}

        {note.financialAnalysis && (
          <Section title="FINANCIAL ANALYSIS">
            {[
              ['Revenue outlook', note.financialAnalysis.revenueOutlook],
              ['Margins', note.financialAnalysis.marginAnalysis],
              ['Balance sheet', note.financialAnalysis.balanceSheet],
              ['Cash flow', note.financialAnalysis.cashFlow],
            ].filter(([, v]) => v).map(([label, v]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, marginBottom: 3 }}>
                  {label.toUpperCase()}
                </div>
                <Prose text={v} />
              </div>
            ))}
          </Section>
        )}

        {note.valuationAnalysis && (
          <Section title="VALUATION">
            <Prose text={note.valuationAnalysis} />
          </Section>
        )}

        {note.risks?.length > 0 && (
          <Section title="KEY RISKS">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {note.risks.map((r, i) => (
                <li key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: INK, marginBottom: 5 }}>{r}</li>
              ))}
            </ol>
          </Section>
        )}

        {note.catalysts?.length > 0 && (
          <Section title="WHAT TO WATCH">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {note.catalysts.map((c, i) => (
                <li key={i} style={{ fontSize: 10.5, lineHeight: 1.6, color: INK, marginBottom: 5 }}>{c}</li>
              ))}
            </ul>
          </Section>
        )}

        {note.conclusion && (
          <Section title="CONCLUSION">
            <Prose text={note.conclusion} />
          </Section>
        )}

        <div style={{ marginTop: 26, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.14em', color: MUTED, fontWeight: 700, marginBottom: 5 }}>
            IMPORTANT
          </div>
          <div style={{ fontSize: 8.5, lineHeight: 1.7, color: MUTED }}>
            {note.disclaimer ?? 'This note is general information only and does not constitute financial advice or a personal recommendation. Past performance is not indicative of future performance. Seek professional financial advice before making investment decisions.'}
          </div>
          <div style={{ fontSize: 8.5, lineHeight: 1.7, color: MUTED, marginTop: 6 }}>
            This note contains no price targets, valuations or ratings. Maddex does not hold
            live pricing for this security; every figure relevant to a decision should be taken
            from live market data, not from this document.
          </div>
        </div>

        <div
          style={{
            marginTop: 20, paddingTop: 8, borderTop: `2px solid ${GOLD}`,
            display: 'flex', justifyContent: 'space-between',
            fontSize: 8, letterSpacing: '0.12em', color: MUTED,
          }}
        >
          <span>MADDEX INTELLIGENCE · GENERAL INFORMATION ONLY</span>
          <span>maddex.com.au</span>
        </div>
      </div>
    </div>
  )
}
