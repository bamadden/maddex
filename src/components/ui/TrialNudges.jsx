import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useProfile } from '../../hooks/useProfile'
import { trialState, startUpgrade } from '../../services/plans'
import { getUsage, NUDGE_EVENT } from '../../services/usageService'
import { loadAlerts } from '../../services/alertsService'

// Two kinds of small prompt, bottom right, never more than one at a time.
//
// DISCOVERY (trial only): a feature not yet tried by the day it should have
// been — research notes by day 3, price alerts by day 4, a portfolio by day 5.
// One per session; dismissing one retires it for good.
//
// UPGRADE MOMENTS (any plan): fired from the usage counters at the moment a
// limit becomes relevant — first research note, tenth MaddenAI question in a
// day, third price alert. Each shows once, ever.

const DISMISSED = 'maddex_discovery_dismissed'
const SESSION = 'maddex_discovery_shown'
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? '[]') } catch { return [] } }

const DISCOVERY = [
  { id: 'notes', day: 3, title: 'Try RESEARCH NOTES', body: 'A structured analysis of any ASX stock — business, financial quality, risks — saved to your research. Open a stock and press RESEARCH NOTE.', cta: 'OPEN MARKETS', module: 'markets', unused: () => getUsage().researchNotes === 0 },
  { id: 'alerts', day: 4, title: 'Try PRICE ALERTS', body: 'Set a level on any watchlist stock and the terminal tells you when it is reached — in the app, and by email if you turn it on.', cta: 'OPEN WATCHLIST', module: 'watchlist', unused: (alerts) => alerts === 0 },
  { id: 'portfolio', day: 5, title: 'Add your PORTFOLIO', body: 'Track your real holdings with P&L, sector and rate exposure, and dividend income — and your daily digest is written around them.', cta: 'ADD HOLDINGS', module: 'portfolio', unused: () => { try { return JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]').length === 0 } catch { return false } } },
]

export default function TrialNudges() {
  const { profile } = useProfile()
  const { alerts, setActiveModule } = useStore()
  const [nudge, setNudge] = useState(null)
  const [discovery, setDiscovery] = useState(null)

  useEffect(() => {
    const on = (e) => setNudge(e.detail)
    window.addEventListener(NUDGE_EVENT, on)
    return () => window.removeEventListener(NUDGE_EVENT, on)
  }, [])

  const t = trialState(profile)
  useEffect(() => {
    if (!t.active) return
    let shown = false
    try { shown = sessionStorage.getItem(SESSION) === '1' } catch { /* private mode */ }
    if (shown) return
    const alertsCount = (alerts?.length ?? 0) + (loadAlerts()?.length ?? 0)
    const dismissed = read(DISMISSED)
    const pick = [...DISCOVERY].reverse().find((d) => t.day >= d.day && !dismissed.includes(d.id) && d.unused(alertsCount))
    if (!pick) return
    const id = setTimeout(() => {
      try { sessionStorage.setItem(SESSION, '1') } catch { /* private mode */ }
      setDiscovery(pick)
    }, 8000)
    return () => clearTimeout(id)
  }, [t.active, t.day, alerts])

  const card = nudge ?? discovery
  if (!card) return null
  const close = () => {
    if (discovery && !nudge) { try { localStorage.setItem(DISMISSED, JSON.stringify([...read(DISMISSED), discovery.id])) } catch { /* quota */ } setDiscovery(null) }
    else setNudge(null)
  }
  return (
    <div role="status" className="fixed z-[180] right-4 bottom-16 w-80 bg-terminal-panel shadow-2xl p-3 font-sans"
      style={{ border: '1px solid rgba(201,168,76,0.6)', borderLeft: '3px solid #C9A84C' }}>
      <div className="flex items-start gap-2">
        <span className="font-mono font-bold text-terminal-gold tracking-widest flex-1" style={{ fontSize: 10 }}>{card.title} →</span>
        <button onClick={close} aria-label="Dismiss" className="text-terminal-text-dim hover:text-terminal-text-bright leading-none">✕</button>
      </div>
      <p className="text-terminal-text mt-1 leading-snug" style={{ fontSize: 12 }}>{card.body}</p>
      <div className="flex items-center gap-2 mt-2">
        {card.module && (
          <button onClick={() => { setActiveModule(card.module); close() }}
            className="font-mono font-bold tracking-wider text-terminal-bg bg-terminal-gold px-2.5 py-1 hover:opacity-90" style={{ fontSize: 9 }}>{card.cta}</button>
        )}
        {card.upgrade && (
          <button onClick={() => { startUpgrade(card.upgrade); close() }}
            className="font-mono font-bold tracking-wider text-terminal-gold border border-terminal-gold/50 px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg" style={{ fontSize: 9 }}>SEE {card.upgrade.toUpperCase()}</button>
        )}
      </div>
    </div>
  )
}
