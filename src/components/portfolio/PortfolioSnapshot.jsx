import { useEffect, useRef } from 'react'

const W = 900
const H = 1200

const COLOR = {
  bg1: 'rgb(6,13,26)',
  bg2: 'rgb(11,22,40)',
  border: 'rgb(22,48,79)',
  gold: 'rgb(201,168,76)',
  goldBright: 'rgb(232,201,106)',
  green: 'rgb(61,173,101)',
  red: 'rgb(201,62,62)',
  text: 'rgb(232,237,245)',
  textDim: 'rgb(184,200,216)',
}

const DONUT_PALETTE = ['rgb(201,168,76)', 'rgb(61,173,101)', 'rgb(139,163,196)', 'rgb(201,62,62)', 'rgb(99,120,153)', 'rgb(138,110,42)']

function fmtCurShort(n, currency) {
  if (n == null || isNaN(n)) return '—'
  const sym = currency === 'USD' ? 'US$' : 'A$'
  const sign = n < 0 ? '-' : ''
  return `${sign}${sym}${Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
}

function draw(ctx, { holdings, totalPnl, pnlPct, mktTotal, currency, ownerName }) {
  ctx.clearRect(0, 0, W, H)

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, COLOR.bg2)
  grad.addColorStop(1, COLOR.bg1)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'

  // Header
  ctx.fillStyle = COLOR.gold
  ctx.font = 'bold 30px "IBM Plex Mono", monospace'
  ctx.fillText('▲ MADDEX', 60, 80)

  ctx.fillStyle = COLOR.textDim
  ctx.font = '16px "IBM Plex Mono", monospace'
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }), W - 60, 80)
  ctx.textAlign = 'left'

  ctx.fillStyle = COLOR.text
  ctx.font = 'bold 26px "IBM Plex Mono", monospace'
  ctx.fillText(`${ownerName}'s Portfolio`, 60, 150)

  // Total P&L — the headline number
  const pnlColor = totalPnl >= 0 ? COLOR.green : COLOR.red
  ctx.fillStyle = COLOR.textDim
  ctx.font = '14px "IBM Plex Mono", monospace'
  ctx.fillText('TOTAL RETURN', 60, 210)

  ctx.fillStyle = pnlColor
  ctx.font = 'bold 64px "IBM Plex Mono", monospace'
  ctx.fillText(`${totalPnl >= 0 ? '+' : ''}${fmtCurShort(totalPnl, currency)}`, 60, 280)

  ctx.font = 'bold 28px "IBM Plex Mono", monospace'
  ctx.fillText(`${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`, 60, 320)

  ctx.fillStyle = COLOR.textDim
  ctx.font = '15px "IBM Plex Mono", monospace'
  ctx.fillText(`Portfolio value: ${fmtCurShort(mktTotal, currency)}`, 60, 360)

  ctx.strokeStyle = COLOR.border
  ctx.beginPath()
  ctx.moveTo(60, 400)
  ctx.lineTo(W - 60, 400)
  ctx.stroke()

  // Best / worst performer
  const sorted = [...holdings].filter((h) => h.pnlPct != null).sort((a, b) => b.pnlPct - a.pnlPct)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  ctx.fillStyle = COLOR.textDim
  ctx.font = '14px "IBM Plex Mono", monospace'
  ctx.fillText('BEST PERFORMER', 60, 445)
  ctx.fillText('WORST PERFORMER', W / 2 + 20, 445)

  ctx.fillStyle = COLOR.green
  ctx.font = 'bold 26px "IBM Plex Mono", monospace'
  ctx.fillText(best ? best.symbol.replace('.AX', '') : '—', 60, 480)
  ctx.font = '16px "IBM Plex Mono", monospace'
  ctx.fillText(best ? `+${best.pnlPct.toFixed(1)}%` : '', 60, 505)

  ctx.fillStyle = worst && worst.pnlPct < 0 ? COLOR.red : COLOR.textDim
  ctx.font = 'bold 26px "IBM Plex Mono", monospace'
  ctx.fillText(worst ? worst.symbol.replace('.AX', '') : '—', W / 2 + 20, 480)
  ctx.font = '16px "IBM Plex Mono", monospace'
  ctx.fillText(worst ? `${worst.pnlPct >= 0 ? '+' : ''}${worst.pnlPct.toFixed(1)}%` : '', W / 2 + 20, 505)

  ctx.strokeStyle = COLOR.border
  ctx.beginPath()
  ctx.moveTo(60, 545)
  ctx.lineTo(W - 60, 545)
  ctx.stroke()

  // Allocation donut
  ctx.fillStyle = COLOR.textDim
  ctx.font = '14px "IBM Plex Mono", monospace'
  ctx.fillText('ALLOCATION', 60, 590)

  const byValue = [...holdings].filter((h) => h.mktVal > 0).sort((a, b) => b.mktVal - a.mktVal)
  const top = byValue.slice(0, 6)
  const otherVal = byValue.slice(6).reduce((s, h) => s + h.mktVal, 0)
  const slices = otherVal > 0 ? [...top, { symbol: 'OTHER', mktVal: otherVal }] : top
  const total = slices.reduce((s, h) => s + h.mktVal, 0) || 1

  const cx = 220, cy = 780, r = 130, rInner = 78
  let angle = -Math.PI / 2
  slices.forEach((s, i) => {
    const frac = s.mktVal / total
    const next = angle + frac * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, next)
    ctx.closePath()
    ctx.fillStyle = DONUT_PALETTE[i % DONUT_PALETTE.length]
    ctx.fill()
    angle = next
  })
  // Punch the hole for the donut
  ctx.beginPath()
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
  ctx.fillStyle = COLOR.bg1
  ctx.fill()

  // Legend
  let ly = 660
  slices.forEach((s, i) => {
    ctx.fillStyle = DONUT_PALETTE[i % DONUT_PALETTE.length]
    ctx.fillRect(420, ly - 12, 14, 14)
    ctx.fillStyle = COLOR.text
    ctx.font = '15px "IBM Plex Mono", monospace'
    const pct = ((s.mktVal / total) * 100).toFixed(0)
    ctx.fillText(`${s.symbol.replace('.AX', '')} · ${pct}%`, 444, ly)
    ly += 32
  })

  // Footer
  ctx.strokeStyle = COLOR.border
  ctx.beginPath()
  ctx.moveTo(60, H - 110)
  ctx.lineTo(W - 60, H - 110)
  ctx.stroke()

  ctx.fillStyle = COLOR.goldBright
  ctx.font = 'bold 16px "IBM Plex Mono", monospace'
  ctx.fillText('Powered by Maddex', 60, H - 70)

  ctx.fillStyle = COLOR.textDim
  ctx.font = '12px "IBM Plex Mono", monospace'
  ctx.fillText('General information only — not financial advice.', 60, H - 45)
}

export default function PortfolioSnapshot({ holdings, totalPnl, pnlPct, mktTotal, currency, ownerName, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    draw(canvas.getContext('2d'), { holdings, totalPnl, pnlPct, mktTotal, currency, ownerName })
  }, [holdings, totalPnl, pnlPct, mktTotal, currency, ownerName])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `Maddex_Portfolio_${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-terminal-panel border border-terminal-gold/40 shadow-2xl font-mono max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
          <span className="text-terminal-gold font-bold tracking-widest text-sm">SHARE YOUR PERFORMANCE</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-gold text-lg leading-none">✕</button>
        </div>
        <div className="p-4 overflow-auto flex-1 flex flex-col items-center gap-3">
          <canvas ref={canvasRef} width={W} height={H} style={{ width: 340, height: (340 * H) / W }} className="border border-terminal-border" />
          <button
            onClick={download}
            className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-5 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >DOWNLOAD PNG</button>
        </div>
      </div>
    </div>
  )
}
