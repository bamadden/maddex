import { outlookColour } from '../../utils/briefScore'
import { toneWord } from '../../utils/tone'
import { PAL } from '../../styles/palette.js'

// SHARE AS IMAGE — the brief as a 1200×630 card (the size social platforms
// preview), drawn on a canvas and downloaded as a PNG. Score gauge, headline,
// three key points (the first sentence of the first three sections), date and
// the general-information line, which travels with every copy.

const W = 1200, H = 630
const GOLD = PAL.gold, BG = PAL.bg, TEXT = PAL.bright, DIM = PAL.dim

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

  // MaddenAI's outlook in words (the brief carries no model-made score).
  const label = brief.scoreLabel ? toneWord(brief.scoreLabel) : ''
  if (label) {
    ctx.textAlign = 'center'
    ctx.fillStyle = DIM; ctx.font = `500 14px ${mono}`; ctx.fillText('MADDENAI OUTLOOK', 240, 290)
    ctx.fillStyle = outlookColour(label); ctx.font = `700 26px ${mono}`
    const words = label.split(' ')
    if (words.length > 1 && ctx.measureText(label).width > 330) {
      ctx.fillText(words.slice(0, -1).join(' '), 240, 336); ctx.fillText(words.at(-1), 240, 372)
    } else ctx.fillText(label, 240, 340)
    ctx.textAlign = 'left'
  }

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
  ctx.textAlign = 'right'; ctx.fillStyle = DIM; ctx.font = `500 12px ${mono}`
  ctx.fillText(`Prepared with the assistance of AI · data as at ${dayLabel}`, W - 56, H - 62)
  ctx.fillText('General information only — not financial advice. Does not consider your objectives, situation or needs.', W - 56, H - 44)

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not render the image')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maddex-brief-${new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })}.png`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
