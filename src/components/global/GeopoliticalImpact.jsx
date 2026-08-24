import { STATUS_BADGE, RISK_LEVEL, portfolioImpact, macroImpact } from '../../services/geopoliticalImpactService'
import { dispatchAskAI } from '../../utils/askAI'
import { fmt } from '../../utils/format'

const STATUS_COLOR = { ACTIVE: 'text-terminal-red border-terminal-red', MONITORING: 'text-terminal-gold border-terminal-gold', RESOLVED: 'text-terminal-green border-terminal-green' }
const RISK_COLOR = { CRITICAL: 'text-terminal-red', HIGH: 'text-terminal-red', MEDIUM: 'text-terminal-gold', LOW: 'text-terminal-green' }
const EXPOSURE_COLOR = { HIGH: 'text-terminal-red', MEDIUM: 'text-terminal-gold', LOW: 'text-terminal-text-dim' }

export default function GeopoliticalImpact({ chokepoint, onClose }) {
  const statusBadge = STATUS_BADGE[chokepoint.status] ?? 'MONITORING'
  const risk = RISK_LEVEL[chokepoint.status] ?? 'MEDIUM'
  const { rows, totalImpact, totalImpactPct } = portfolioImpact(chokepoint)
  const macro = macroImpact(chokepoint)

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-terminal-gold tracking-widest uppercase">{chokepoint.name}</span>
            <span className={`text-2xs font-bold px-1.5 py-0.5 border ${STATUS_COLOR[statusBadge]}`}>{statusBadge}</span>
            <span className={`text-2xs font-bold ${RISK_COLOR[risk]}`}>RISK: {risk}</span>
          </div>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-2xs text-terminal-text-dim">{chokepoint.note}</div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">HOW THIS AFFECTS YOUR PORTFOLIO</div>
            {rows.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/60 border border-terminal-border p-2.5">No ASX holdings in your portfolio to assess exposure for.</div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.symbol} className="border border-terminal-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold text-terminal-text-bright">{r.symbol}</span>
                      <span className={`text-2xs font-bold ${EXPOSURE_COLOR[r.exposure]}`}>{r.exposure} exposure</span>
                    </div>
                    <div className="text-2xs text-terminal-text-dim mt-1">
                      {r.exposure === 'HIGH' && chokepoint.asxNote ? chokepoint.asxNote : r.exposure === 'LOW' ? 'Minimal direct exposure to this route.' : `Indirect exposure via ${chokepoint.commodity?.toLowerCase() ?? 'trade'} cost flow-through.`}
                    </div>
                    <div className="text-2xs mt-1">
                      Estimated portfolio impact: {r.impactValue ? (
                        <span className={r.impactValue < 0 ? 'text-terminal-red font-bold' : 'text-terminal-text-dim'}>
                          {fmt.aud(r.impactValue, { clarify: true })} ({(r.shockPct * 100).toFixed(1)}%)
                        </span>
                      ) : <span className="text-terminal-text-dim">—</span>}
                    </div>
                  </div>
                ))}
                <div className="border-t border-terminal-border pt-1.5 flex items-center justify-between text-2xs">
                  <span className="text-terminal-text-dim font-bold">TOTAL ESTIMATED IMPACT</span>
                  <span className={`font-bold ${totalImpact < 0 ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>
                    {fmt.aud(totalImpact, { clarify: true })} ({totalImpactPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">MACRO IMPACT</div>
            <div className="space-y-2">
              <div className="border border-terminal-border p-2.5">
                <div className="text-2xs text-terminal-text-dim font-bold mb-0.5">OIL PRICE SENSITIVITY</div>
                <div className="text-2xs text-terminal-text">{macro.oilSensitivity}</div>
              </div>
              <div className="border border-terminal-border p-2.5">
                <div className="text-2xs text-terminal-text-dim font-bold mb-0.5">AU INFLATION IMPACT</div>
                <div className="text-2xs text-terminal-text">{macro.inflationImpact}</div>
              </div>
              <div className="border border-terminal-border p-2.5">
                <div className="text-2xs text-terminal-text-dim font-bold mb-0.5">RBA IMPLICATIONS</div>
                <div className="text-2xs text-terminal-text">{macro.rbaImplication}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-terminal-border px-4 py-3 flex-shrink-0">
          <button
            onClick={() => dispatchAskAI({
              instruction: `Give me a deep analysis of the ${chokepoint.name} situation (currently ${statusBadge}) and its impact on Australian investors — what's driving it, the macro/commodity implications, and what to watch for.`,
            }, { rawPrompt: true, fullscreen: true })}
            className="w-full text-2xs text-terminal-gold border border-terminal-gold px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-widest"
          >MADDENAI DEEP ANALYSIS →</button>
        </div>
      </div>
    </div>
  )
}
