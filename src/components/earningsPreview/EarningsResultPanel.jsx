import { getEarningsResult } from '../../services/earningsAnalystService'

const VERDICT_COLOR = {
  'STRONG BEAT': 'text-terminal-green',
  BEAT: 'text-terminal-green',
  'IN LINE': 'text-terminal-text-dim',
  MISS: 'text-terminal-red',
  'STRONG MISS': 'text-terminal-red',
}
const IMPLICATION_COLOR = {
  'SIGNIFICANTLY HIGHER': 'text-terminal-green',
  HIGHER: 'text-terminal-green',
  NEUTRAL: 'text-terminal-text-dim',
  LOWER: 'text-terminal-red',
  'SIGNIFICANTLY LOWER': 'text-terminal-red',
}

export default function EarningsResultPanel({ ticker, companyName, onClose }) {
  const record = getEarningsResult(ticker)
  const { reportData, analysis, analysisError } = record ?? {}
  const beatMiss = reportData ? (reportData.actualEPS > reportData.consensusEPS ? 'BEAT' : 'MISS') : null
  const beatMagnitude = reportData
    ? Math.abs(((reportData.actualEPS - reportData.consensusEPS) / reportData.consensusEPS) * 100).toFixed(1)
    : null

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <div>
            <span className="text-2xs text-terminal-gold font-bold tracking-widest">EARNINGS RESULT · {ticker.replace('.AX', '')}</span>
            <div className="text-2xs text-terminal-text-dim">{companyName}{reportData ? ` · reported ${new Date(reportData.reportDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</div>
          </div>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!reportData && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
              <span className="text-terminal-text-dim text-2xs">No result recorded for this stock yet.</span>
            </div>
          )}

          {reportData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">ACTUAL EPS</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{reportData.actualEPS}</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">CONSENSUS EPS</div>
                  <div className="text-sm font-bold text-terminal-text-bright">{reportData.consensusEPS}</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">RESULT</div>
                  <div className={`text-sm font-bold ${beatMiss === 'BEAT' ? 'text-terminal-green' : 'text-terminal-red'}`}>{beatMiss} {beatMiss === 'BEAT' ? '+' : '-'}{beatMagnitude}%</div>
                </div>
                <div className="border border-terminal-border p-2">
                  <div className="text-2xs text-terminal-text-dim">REVENUE</div>
                  <div className="text-sm font-bold text-terminal-text-bright">A${reportData.actualRevenue.toLocaleString()}M</div>
                </div>
              </div>

              <div className="border border-terminal-border p-3">
                <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">GUIDANCE</div>
                <div className="text-2xs text-terminal-text">{reportData.guidance}</div>
              </div>

              {!analysis && !analysisError && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="text-terminal-gold text-2xs tracking-widest animate-pulse">MADDENAI · ANALYSING RESULTS...</div>
                </div>
              )}

              {analysisError && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
                  <span className="text-terminal-red text-lg">⚠</span>
                  <div className="text-2xs text-terminal-red">{analysisError}</div>
                </div>
              )}

              {analysis && (
                <>
                  <div className={`border px-3 py-2 text-center ${VERDICT_COLOR[analysis.verdict] ?? ''}`} style={{ borderColor: 'currentColor' }}>
                    <div className="text-sm font-bold tracking-widest">{analysis.verdict} ({analysis.verdictScore}/10)</div>
                    <div className="text-2xs mt-0.5">{analysis.headline}</div>
                  </div>

                  <div className="border border-terminal-border p-3">
                    <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">KEY POINTS</div>
                    <ul className="space-y-1">
                      {(analysis.keyPoints ?? []).map((p, i) => (
                        <li key={i} className="text-2xs text-terminal-text flex gap-2"><span className="text-terminal-gold">{i + 1}.</span>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-terminal-border p-3">
                    <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">GUIDANCE ASSESSMENT</div>
                    <div className="text-2xs text-terminal-text">{analysis.guidanceAssessment}</div>
                  </div>

                  <div className="flex items-center gap-2 border border-terminal-border p-3">
                    <span className="text-2xs text-terminal-text-dim">PRICE IMPLICATION:</span>
                    <span className={`text-2xs font-bold ${IMPLICATION_COLOR[analysis.priceImplication] ?? ''}`}>{analysis.priceImplication}</span>
                  </div>

                  <div className="border border-terminal-border p-3">
                    <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1">WATCH FOR NEXT QUARTER</div>
                    <div className="text-2xs text-terminal-text">{analysis.watchFor}</div>
                  </div>

                  <div className="border border-terminal-border p-3">
                    <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">FULL ANALYSIS</div>
                    <div className="text-2xs text-terminal-text leading-relaxed whitespace-pre-line">{analysis.fullAnalysis}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
