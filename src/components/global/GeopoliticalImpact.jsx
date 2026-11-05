import { STATUS_BADGE, RISK_LEVEL, EXPOSURE_LABEL, portfolioExposure, costChannels } from '../../services/geopoliticalImpactService'
import { dispatchAskAI } from '../../utils/askAI'
import { ROUTE_STATUS_SOURCE } from '../../data/shippingRoutes'
import { formatDate } from '../../utils/dateUtils'

const STATUS_COLOR = { ACTIVE: 'text-terminal-red border-terminal-red', MONITORING: 'text-terminal-gold border-terminal-gold', RESOLVED: 'text-terminal-green border-terminal-green' }
const RISK_COLOR = { CRITICAL: 'text-terminal-red', HIGH: 'text-terminal-red', MEDIUM: 'text-terminal-gold', LOW: 'text-terminal-green' }
const EXPOSURE_COLOR = { NAMED: 'text-terminal-gold', SECTOR: 'text-terminal-text', NONE: 'text-terminal-text-dim' }

export default function GeopoliticalImpact({ chokepoint, onClose }) {
  const statusBadge = STATUS_BADGE[chokepoint.status] ?? 'MONITORING'
  const risk = RISK_LEVEL[chokepoint.status] ?? 'MEDIUM'
  const rows = portfolioExposure(chokepoint)
  const channels = costChannels(chokepoint)

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
          <button onClick={onClose} aria-label="Close" className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-2xs text-terminal-text-dim">
            {chokepoint.note}
            {chokepoint.asOf && <div className="text-terminal-text-dim/60 mt-0.5">Status: {ROUTE_STATUS_SOURCE}, as entered {formatDate(chokepoint.asOf)}</div>}
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">YOUR HOLDINGS' LINKS TO THIS ROUTE</div>
            {rows.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/60 border border-terminal-border p-2.5">No ASX holdings in your portfolio to check.</div>
            ) : (
              <div className="space-y-1.5" data-route-exposure>
                {rows.map((r) => (
                  <div key={r.symbol} className="border border-terminal-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold text-terminal-text-bright">{r.symbol}</span>
                      <span className={`text-2xs font-bold ${EXPOSURE_COLOR[r.exposure]}`}>{EXPOSURE_LABEL[r.exposure]}</span>
                    </div>
                    <div className="text-2xs text-terminal-text-dim mt-1">{r.reason}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[11px] text-terminal-text-dim mt-1.5">Maddex&apos;s editorial mapping of companies and sectors to shipping routes. A description of links, not an estimate of gains or losses, and not a recommendation.</div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">HOW COSTS TRAVEL</div>
            <div className="space-y-2">
              {channels.map((c) => (
                <div key={c.title} className="border border-terminal-border p-2.5">
                  <div className="text-2xs text-terminal-text-dim font-bold mb-0.5">{c.title}</div>
                  <div className="text-2xs text-terminal-text">{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-terminal-border px-4 py-3 flex-shrink-0">
          <button
            onClick={() => dispatchAskAI({
              instruction: `Describe the ${chokepoint.name} situation (status in Maddex: ${statusBadge}): what has happened, which cargoes use the route, and the channels through which disruption reaches Australian prices and companies. Describe only; do not forecast prices or suggest any action.`,
            }, { rawPrompt: true, fullscreen: true })}
            className="w-full text-2xs text-terminal-gold border border-terminal-gold px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-widest"
          >MADDENAI DEEP ANALYSIS →</button>
        </div>
      </div>
    </div>
  )
}
