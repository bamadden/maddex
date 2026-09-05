import { useState, useEffect } from 'react'
import { generateEarningsPreview } from '../../services/earningsPreviewService'
import { daysUntil } from '../../services/earningsCalendar'

const SENTIMENT_COLOR = { BULLISH: 'text-terminal-green', NEUTRAL: 'text-terminal-text-dim', BEARISH: 'text-terminal-red' }
const REC_COLOR = {
  'ADD BEFORE': 'border-terminal-green text-terminal-green',
  'HOLD INTO EARNINGS': 'border-terminal-gold text-terminal-gold',
  'REDUCE BEFORE': 'border-terminal-red text-terminal-red',
}

export default function EarningsPreviewPanel({ ticker, earningsDate, companyName, onClose }) {
  const [status, setStatus] = useState('loading') // loading | ready | error | unavailable
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const d = daysUntil(earningsDate)

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const result = await generateEarningsPreview(ticker, earningsDate)
        if (!result) { setStatus('unavailable'); return }
        setPreview(result)
        setStatus('ready')
      } catch (e) {
        setError(e.message)
        setStatus('error')
      }
    }, 0)
    return () => clearTimeout(t)
  }, [ticker, earningsDate])

  return (
    <div className="modal-backdrop fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <div>
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">EARNINGS PREVIEW · {ticker.replace('.AX', '')}</span>
            <div className="text-2xs text-terminal-text-dim">{companyName} · reports in {d} day{d === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="text-terminal-gold text-2xs tracking-widest animate-pulse">MADDENAI · PREVIEWING {ticker.replace('.AX', '')} EARNINGS...</div>
            </div>
          )}

          {status === 'unavailable' && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
              <span className="text-terminal-text-dim text-2xs">This earnings date is more than 7 days away — previews generate closer to the report date.</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
              <span className="text-terminal-red text-lg">⚠</span>
              <div className="text-2xs text-terminal-red">{error}</div>
            </div>
          )}

          {status === 'ready' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">CONSENSUS EPS</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{preview.consensusEPS}</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">CONSENSUS REVENUE</div>
                  <div className="text-sm font-bold text-terminal-text-bright">
                    {preview.revenueCurrency === 'AUD' ? 'A$' : 'US$'}{preview.consensusRevenue?.toLocaleString?.() ?? preview.consensusRevenue}M
                  </div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">BEAT RATE</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{preview.historicalBeatRate}</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">IMPLIED MOVE</div>
                  <div className="text-sm font-bold text-terminal-gold">±{preview.impliedMove}%</div>
                </div>
              </div>

              <div className="border border-terminal-border p-3">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">ANALYST VIEW</div>
                <div className="flex items-center gap-3 text-2xs">
                  <span className={`font-bold ${SENTIMENT_COLOR[preview.analystSentiment] ?? ''}`}>{preview.analystSentiment}</span>
                  <span className="text-terminal-text-dim">{preview.analystCount} analysts</span>
                  <span className="text-terminal-text-dim">Target: <span className="text-terminal-text-bright">A${preview.priceTarget}</span></span>
                </div>
              </div>

              <div className="border border-terminal-border p-3">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">KEY METRICS TO WATCH</div>
                <ul className="space-y-1">
                  {(preview.keyMetricsToWatch ?? []).map((m, i) => (
                    <li key={i} className="text-2xs text-terminal-text flex gap-2"><span className="text-terminal-gold">{i + 1}.</span>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-terminal-green/30 p-2">
                  <div className="text-2xs text-terminal-green font-bold tracking-widest mb-1">BULL CASE</div>
                  <div className="text-2xs text-terminal-text">{preview.bullCase}</div>
                </div>
                <div className="border border-terminal-red/30 p-2">
                  <div className="text-2xs text-terminal-red font-bold tracking-widest mb-1">BEAR CASE</div>
                  <div className="text-2xs text-terminal-text">{preview.bearCase}</div>
                </div>
              </div>

              <div className="border border-terminal-border p-3">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">KEY QUESTION</div>
                <div className="text-2xs text-terminal-text italic">{preview.keyQuestion}</div>
              </div>

              <div className={`border px-3 py-2 text-center text-2xs font-bold tracking-widest ${REC_COLOR[preview.recommendation] ?? 'border-terminal-border text-terminal-text'}`}>
                {preview.recommendation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
