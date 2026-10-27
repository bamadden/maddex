import jsPDF from 'jspdf'
import { displayTicker, NOTE_DISCLAIMER, NOTE_KIND_LABEL, parseProse } from '../../services/researchNoteService'

// The research note as a real PDF document.
//
// This used to be an html2canvas screenshot of PrintableNote sliced into A4
// strips: the text was a picture (blurry when zoomed, not selectable, not
// searchable), a line could be cut in half at a page edge, and there was no
// way to put a footer or page number on each page. Here jsPDF lays out text
// directly, so the type is vector, breaks fall between lines, and every page
// carries the masthead footer and "Page n of N".
//
// Helvetica for structure, Times for body — the two faces jsPDF ships with,
// so nothing is fetched and the file stays small. Both use WinAnsi encoding,
// which is why text goes through clean() first.

const PAGE_W = 210
const PAGE_H = 297
const M = 18                    // side margin, mm
const CONTENT_W = PAGE_W - M * 2
const FOOTER_Y = PAGE_H - 11
const BODY_BOTTOM = PAGE_H - 20

const INK = [20, 24, 33]
const MUTED = [90, 100, 114]
const RULE = [216, 220, 227]
const GOLD = [168, 134, 47]
const PANEL = [247, 248, 250]

const STANCE_TONE = {
  CONSTRUCTIVE: [45, 122, 74],
  BALANCED: [168, 134, 47],
  CAUTIOUS: [168, 50, 50],
}

// Characters outside WinAnsi render as garbage in the standard fonts.
const clean = (s) => String(s ?? '')
  .replace(/[→⟶]/g, '->').replace(/[←]/g, '<-').replace(/[≈~]/g, 'approx. ')
  .replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[▲]/g, 'up').replace(/[▼]/g, 'down')
  .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\n]/g, '')

const dateLabel = (iso) => new Date(iso ?? Date.now())
  .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

export function buildNotePdf(note) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const a = note.asset ?? {}
  let y = 0

  const font = (face, style, size, color = INK) => {
    pdf.setFont(face, style); pdf.setFontSize(size); pdf.setTextColor(...color)
  }
  const lineH = (size, lead = 1.45) => size * 0.3528 * lead
  const ensure = (h) => { if (y + h > BODY_BOTTOM) { pdf.addPage(); y = 20 } }

  // Wrapped paragraph; breaks between lines, never through one.
  const para = (text, { face = 'times', size = 10, color = INK, x = M, w = CONTENT_W, after = 2.5, style = 'normal' } = {}) => {
    for (const block of clean(text).split(/\n+/).map((t) => t.trim()).filter(Boolean)) {
      font(face, style, size, color)
      for (const ln of pdf.splitTextToSize(block, w)) {
        ensure(lineH(size))
        pdf.text(ln, x, y + lineH(size) * 0.75)
        y += lineH(size)
      }
      y += after
    }
  }

  const list = (items, numbered) => items.forEach((item, i) => {
    const marker = numbered ? `${i + 1}.` : '•'
    font('times', 'normal', 10)
    const lines = pdf.splitTextToSize(clean(item), CONTENT_W - 7)
    ensure(lineH(10) * Math.min(lines.length, 2))
    font(numbered ? 'helvetica' : 'times', numbered ? 'bold' : 'normal', numbered ? 9 : 10, numbered ? GOLD : INK)
    pdf.text(marker, M + 1, y + lineH(10) * 0.75)
    para(item, { x: M + 7, w: CONTENT_W - 7, after: 1.8 })
  })

  const section = (title) => {
    ensure(18)
    y += 4
    pdf.setDrawColor(...RULE); pdf.setLineWidth(0.3); pdf.line(M, y, PAGE_W - M, y)
    y += 5
    font('helvetica', 'bold', 8, INK)
    pdf.setCharSpace(0.6)
    pdf.text(title.toUpperCase(), M, y)
    pdf.setCharSpace(0)
    y += 4.5
  }

  // ── Masthead ──
  pdf.setFillColor(...GOLD); pdf.rect(0, 0, PAGE_W, 13, 'F')
  font('helvetica', 'bold', 10, [255, 255, 255])
  pdf.setCharSpace(1.2); pdf.text('MADDEX RESEARCH', M, 8.4); pdf.setCharSpace(0)
  font('helvetica', 'normal', 7, [255, 255, 255])
  pdf.text('GENERAL INFORMATION ONLY', PAGE_W - M, 8.4, { align: 'right' })

  // ── Stance box (top right) ──
  const boxW = 62, boxX = PAGE_W - M - boxW, boxY = 21
  const stance = note.stance ?? NOTE_KIND_LABEL[note.kind] ?? 'BALANCED'
  const tone = STANCE_TONE[stance] ?? MUTED
  font('times', 'italic', 8.5, MUTED)
  const rationale = pdf.splitTextToSize(clean(note.stanceRationale ?? (note.body ? 'Long-form MaddenAI analysis, kept from the chat panel.' : '')), boxW - 8)
  const boxH = 17 + rationale.length * lineH(8.5, 1.35) + 6
  pdf.setFillColor(...PANEL); pdf.setDrawColor(...RULE); pdf.setLineWidth(0.3)
  pdf.rect(boxX, boxY, boxW, boxH, 'FD')
  font('helvetica', 'bold', 6.5, MUTED)
  pdf.setCharSpace(0.5); pdf.text('STANCE', boxX + 4, boxY + 5.5); pdf.setCharSpace(0)
  font('helvetica', 'bold', 8.5, [255, 255, 255])
  const pillW = pdf.getTextWidth(stance) + 8
  pdf.setFillColor(...tone); pdf.roundedRect(boxX + 4, boxY + 7.5, pillW, 6, 3, 3, 'F')
  pdf.text(stance, boxX + 4 + pillW / 2, boxY + 11.6, { align: 'center' })
  font('times', 'italic', 8.5, MUTED)
  let ry = boxY + 18.5
  for (const ln of rationale) { pdf.text(ln, boxX + 4, ry); ry += lineH(8.5, 1.35) }
  font('helvetica', 'normal', 6, MUTED)
  pdf.text('Not a recommendation — general information only', boxX + 4, boxY + boxH - 2.5)

  // ── Title block (left of the stance box) ──
  const titleW = boxX - M - 6
  y = 25
  font('helvetica', 'bold', 21, INK)
  for (const ln of pdf.splitTextToSize(clean(a.name ?? a.symbol), titleW)) { pdf.text(ln, M, y + 6); y += 8.5 }
  y += 2
  font('helvetica', 'normal', 9.5, MUTED)
  pdf.text(clean([displayTicker(a), note.sector, note.exchange].filter(Boolean).join('  ·  ')), M, y + 3)
  y += 5.5
  pdf.text(clean(`${dateLabel(note.generatedAt)}  ·  General Information Only`), M, y + 3)
  y = Math.max(y + 8, boxY + boxH + 6)
  pdf.setDrawColor(...INK); pdf.setLineWidth(0.6); pdf.line(M, y, PAGE_W - M, y)
  y += 2

  // ── Body ──
  if (note.body) {
    for (const sec of parseProse(note.body)) {
      section(sec.title ?? 'Analysis')
      const items = []
      const flush = () => { if (items.length) { list(items.splice(0), false) } }
      for (const b of sec.blocks) {
        if (b.type === 'li') items.push(b.text)
        else { flush(); para(b.text) }
      }
      flush()
    }
  } else {
    section('Executive Summary')
    para(note.executiveSummary, { size: 10.5 })
  }

  if (note.businessOverview) { section('Business Overview'); para(note.businessOverview) }
  if (note.investmentConsiderations?.length) { section('Investment Considerations'); list(note.investmentConsiderations, false) }
  if (note.macroContext) { section('Sector & Macro Context'); para(note.macroContext) }
  if (note.risks?.length) { section('Key Risks'); list(note.risks, true) }
  if (note.catalysts?.length) { section('Catalysts to Watch'); list(note.catalysts, true) }

  // Notes saved before the six-section format still carry these.
  if (note.investmentThesis) { section('Investment Thesis'); para(note.investmentThesis) }
  if (note.valuationAnalysis) { section('Valuation'); para(note.valuationAnalysis) }
  if (note.conclusion) { section('Conclusion'); para(note.conclusion) }

  // ── Disclaimer ──
  font('times', 'normal', 8)
  const disc = pdf.splitTextToSize(clean(NOTE_DISCLAIMER), CONTENT_W - 10)
  const discH = 9 + disc.length * lineH(8, 1.4) + 3
  ensure(discH + 8)
  y += 6
  pdf.setFillColor(...PANEL); pdf.setDrawColor(...RULE); pdf.rect(M, y, CONTENT_W, discH, 'FD')
  font('helvetica', 'bold', 7, MUTED)
  pdf.setCharSpace(0.5); pdf.text('IMPORTANT INFORMATION', M + 5, y + 5.5); pdf.setCharSpace(0)
  font('times', 'normal', 8, MUTED)
  let dy = y + 10
  for (const ln of disc) { pdf.text(ln, M + 5, dy); dy += lineH(8, 1.4) }

  // ── Footer and page numbers, every page ──
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(0.5); pdf.line(M, FOOTER_Y - 4, PAGE_W - M, FOOTER_Y - 4)
    font('helvetica', 'normal', 6.5, MUTED)
    pdf.setCharSpace(0.3)
    pdf.text('MADDEX INTELLIGENCE  ·  GENERAL INFORMATION ONLY  ·  maddex.com.au', M, FOOTER_Y)
    pdf.setCharSpace(0)
    pdf.text(`Page ${p} of ${pages}`, PAGE_W - M, FOOTER_Y, { align: 'right' })
  }
  return pdf
}

export function noteFilename(note) {
  const sym = String(note.asset?.symbol ?? 'note').replace(/\.AX$/i, '')
  return `Maddex_Research_${sym}_${String(note.generatedAt ?? new Date().toISOString()).slice(0, 10)}.pdf`
}

export function downloadNotePdf(note) {
  buildNotePdf(note).save(noteFilename(note))
}
