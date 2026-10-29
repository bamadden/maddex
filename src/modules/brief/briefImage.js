import { scoreColour } from '../../utils/briefScore'

// SHARE AS IMAGE — the brief as a 1200×630 card (the size social platforms
// preview), drawn on a canvas and downloaded as a PNG. Score gauge, headline,
// three key points (the first sentence of the first three sections), date and
// the general-information line, which travels with every copy.

const W = 1200, H = 630
const GOLD = '#C9A84C', BG = '#060D1A', TEXT = '#E8EDF5', DIM = '#8BA3C4'

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text ?? '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1]
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trimEnd()}…`
  }
  return lines
}

const firstSentence = (s) => (String(s ?? '').replace(/\*\*/g, '').split('\n')[0].match(/^.*?[.!?](\s|$)/)?.[0] ?? String(s ?? '').split('\n')[0]).trim()

export async function downloadBriefImage(brief, dayLabel) {
  try { await document.fonts?.ready } catch { /* fonts optional */ }
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const mono = '"IBM Plex Mono", ui-monospace, monospace'
  const sans = 'Inter, system-ui, sans-serif'

  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(240, 300, 20, 240, 300, 420)
  glow.addColorStop(0, 'rgba(201,168,76,0.10)'); glow.addColorStop(1, 'rgba(201,168,76,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 4)
  ctx.strokeStyle = 'rgba(201,168,76,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(24.5, 24.5, W - 49, H - 49)

  ctx.fillStyle = GOLD; ctx.font = `700 22px ${mono}`; ctx.fillText('MADDEX', 56, 78)
  ctx.fillStyle = DIM; ctx.font = `500 14px ${mono}`; ctx.fillText('MORNING INTELLIGENCE BRIEF', 160, 77)
  ctx.textAlign = 'right'; ctx.fillStyle = TEXT; ctx.font = `600 16px ${mono}`; ctx.fillText(dayLabel, W - 56, 78); ctx.textAlign = 'left'

  // Gauge: a 240° arc, filled to the score.
  const score = Math.max(0, Math.min(100, Number(brief.maddenAIScore ?? 50)))
  const col = scoreColour(score)
  const cx = 240, cy = 330, r = 120
  const a0 = (150 * Math.PI) / 180, span = (240 * Math.PI) / 180
  ctx.lineCap = 'round'; ctx.lineWidth = 18
  ctx.strokeStyle = 'rgba(99,120,153,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + span); ctx.stroke()
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (span * score) / 100); ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT; ctx.font = `700 72px ${mono}`; ctx.fillText(String(Math.round(score)), cx, cy + 22)
  ctx.fillStyle = DIM; ctx.font = `500 13px ${mono}`; ctx.fillText('/ 100  MADDENAI SCORE', cx, cy + 50)
  ctx.fillStyle = col; ctx.font = `700 18px ${mono}`; ctx.fillText(String(brief.scoreLabel ?? 'NEUTRAL'), cx, cy + 150)
  ctx.textAlign = 'left'

  // Headline and three points.
  const x = 440, maxW = W - x - 60
  ctx.fillStyle = TEXT; ctx.font = `600 28px ${sans}`
  let y = 150
  for (const l of wrap(ctx, brief.headline, maxW, 3)) { ctx.fillText(l, x, y); y += 38 }
  y += 18
  ctx.fillStyle = GOLD; ctx.font = `700 13px ${mono}`; ctx.fillText('KEY POINTS', x, y); y += 26
  const points = (brief.sections ?? []).slice(0, 3).map((s) => ({ t: s.title, p: firstSentence(s.content) }))
  for (const pt of points) {
    ctx.fillStyle = GOLD; ctx.fillRect(x, y - 11, 6, 6)
    ctx.fillStyle = DIM; ctx.font = `700 11px ${mono}`; ctx.fillText(pt.t, x + 16, y - 4)
    y += 16
    ctx.fillStyle = TEXT; ctx.font = `400 17px ${sans}`
    for (const l of wrap(ctx, pt.p, maxW - 16, 2)) { ctx.fillText(l, x + 16, y); y += 23 }
    y += 12
  }

  ctx.fillStyle = 'rgba(201,168,76,0.35)'; ctx.fillRect(56, H - 86, W - 112, 1)
  ctx.fillStyle = GOLD; ctx.font = `700 14px ${mono}`; ctx.fillText(`MADDEX · ${dayLabel}`, 56, H - 56)
  ctx.textAlign = 'right'; ctx.fillStyle = DIM; ctx.font = `500 13px ${mono}`
  ctx.fillText('maddex.com.au · general information only — not advice', W - 56, H - 56)

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not render the image')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maddex-brief-${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}.png`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
