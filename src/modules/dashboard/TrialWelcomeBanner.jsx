import { useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { useStore } from '../../store/useStore'
import { startUpgrade, trialState, lostOnCore, PRICES } from '../../services/plans'
import { getUsage } from '../../services/usageService'
import { loadAlerts } from '../../services/alertsService'

// YOUR TRIAL — DAY N OF 7, for an account on its free trial and only then.
//
// Shows the value already used (counted on this device, from the same usage
// counters that enforce the plan limits) and, from day 5, what Core does not
// include — derived from services/plans, so the list cannot overstate the
// difference. REMIND ME LATER hides it until tomorrow.

const HIDE_KEY = 'maddex_trial_banner_hidden_until'
const sydDay = (ms = Date.now()) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

function usedSoFar(alertsCount) {
  const u = getUsage()
  let briefs = 0, holdings = 0, weekly = false
  try {
    const keys = Object.keys(localStorage)
    briefs = keys.filter((k) => k.startsWith('maddex_morning_brief_')).length
    weekly = keys.some((k) => k.startsWith('maddex_weekly_review_'))
    holdings = JSON.parse(localStorage.getItem('madden_portfolio_v2') || '[]').length
  } catch { /* private mode */ }
  return [
    { done: briefs > 0, label: 'Morning Brief', value: briefs ? `${briefs} generated` : 'generates at 7am on weekdays' },
    { done: u.aiQueries > 0, label: 'MaddenAI', value: u.aiQueries ? `${u.aiQueries} question${u.aiQueries === 1 ? '' : 's'} asked` : 'ask it anything — press A' },
    { done: u.researchNotes > 0, label: 'Research Notes', value: u.researchNotes ? `${u.researchNotes} generated` : 'try one from any stock\'s detail panel' },
    { done: alertsCount > 0, label: 'Price Alerts', value: alertsCount ? `${alertsCount} active` : 'set one from the watchlist' },
    { done: weekly, label: 'Weekly Review', value: weekly ? 'read' : 'ready after Friday\'s close' },
    { done: holdings > 0, label: 'Portfolio Analysis', value: holdings ? `${holdings} holding${holdings === 1 ? '' : 's'} tracked` : 'add holdings to unlock' },
  ]
}

export default function TrialWelcomeBanner() {
  const { profile } = useProfile()
  const { alerts } = useStore()
  const [hiddenUntil, setHiddenUntil] = useState(() => { try { return localStorage.getItem(HIDE_KEY) } catch { return null } })
  const [open, setOpen] = useState(true)
  const t = trialState(profile)
  if (!t.active || (hiddenUntil && hiddenUntil >= sydDay())) return null

  const alertsCount = (alerts?.length ?? 0) + (loadAlerts()?.length ?? 0)
  const used = usedSoFar(alertsCount)
  const showLoss = t.day >= 5
  // Hidden for the rest of the Sydney day; back tomorrow.
  const later = () => {
    try { localStorage.setItem(HIDE_KEY, sydDay()) } catch { /* private mode */ }
    setHiddenUntil(sydDay())
  }

  return (
    <div className="flex-shrink-0 font-mono" style={{ padding: '10px 20px', background: 'rgba(201,168,76,0.07)', borderBottom: '1px solid rgba(201,168,76,0.18)' }}>
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => setOpen((v) => !v)} className="text-left" aria-expanded={open}>
          <div className="text-terminal-gold font-bold" style={{ fontSize: 11, letterSpacing: '0.18em' }}>YOUR TRIAL — DAY {t.day} OF {t.length} {open ? '▾' : '▸'}</div>
          <div className="text-terminal-text-dim mt-0.5" style={{ fontSize: 10 }}>
            Full Apex access · <span className="text-terminal-text-bright">{t.daysLeft} day{t.daysLeft === 1 ? '' : 's'} left</span>
          </div>
        </button>
        <div className="flex-1 min-w-[120px] max-w-[300px]">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(74,96,128,0.25)' }}>
            <div className="h-full rounded-full" style={{ width: `${(t.day / t.length) * 100}%`, background: t.daysLeft <= 2 ? '#E8A33D' : '#C9A84C' }} />
          </div>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button onClick={later} className="text-[9px] tracking-widest text-terminal-text-dim/70 hover:text-terminal-text-bright">REMIND ME LATER</button>
          <button onClick={() => startUpgrade('prime')} className="text-[10px] tracking-widest px-3 py-1.5 font-bold bg-terminal-gold text-terminal-bg hover:opacity-90">
            UPGRADE NOW — A${PRICES.prime.monthly}/month
          </button>
        </div>
      </div>
      {open && (
        <div className={`grid gap-x-8 gap-y-2 mt-2.5 ${showLoss ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <div className="text-terminal-text-dim/70 tracking-widest mb-1" style={{ fontSize: 8 }}>WHAT YOU&apos;VE USED</div>
            <div className={`grid gap-x-6 gap-y-0.5 ${showLoss ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
              {used.map((u) => (
                <div key={u.label} className="flex items-baseline gap-1.5" style={{ fontSize: 10 }}>
                  <span style={{ color: u.done ? '#2D8A50' : '#4A6080' }}>{u.done ? '✓' : '○'}</span>
                  <span className={u.done ? 'text-terminal-text-bright' : 'text-terminal-text-dim'}>{u.label}:</span>
                  <span className="text-terminal-text-dim">{u.value}</span>
                </div>
              ))}
            </div>
          </div>
          {showLoss && (
            <div>
              <div className="tracking-widest mb-1" style={{ fontSize: 8, color: '#E8A33D' }}>ON CORE AFTER DAY {t.length} — WHAT CHANGES</div>
              {lostOnCore().map((l) => (
                <div key={l} className="flex items-baseline gap-1.5 text-terminal-text-dim" style={{ fontSize: 10 }}>
                  <span style={{ color: '#CC4444' }}>✗</span>{l}
                </div>
              ))}
              <div className="text-terminal-text-dim/50 mt-1" style={{ fontSize: 8 }}>Your watchlist, portfolio and alerts are kept whichever plan you choose.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
