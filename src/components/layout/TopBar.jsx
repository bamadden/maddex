import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { displayService } from '../../services/displayService'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import SettingsPanel from '../settings/SettingsPanel'
import IdeasBoard from '../ideas/IdeasBoard'
import NotificationCenter from '../ui/NotificationCenter'
import { getInitials } from '../../lib/profileUtils'
import { USING_MOCK_DATA } from '../../services/api'
import { useSentiment } from '../../hooks/useSentiment'
import Tooltip from '../ui/Tooltip'
import { WORKSPACE_MODULE_LIST } from '../../config/workspaceModules'

// ─── Exchange market hours ─────────────────────────────────────────────────────

const EXCHANGES = [
  { id:'ASX',   label:'ASX',   tz:'Australia/Sydney',    open:[10,0],  close:[16,0],  country:'AU' },
  { id:'NYSE',  label:'NYSE',  tz:'America/New_York',    open:[9,30],  close:[16,0],  country:'US' },
  { id:'NASDAQ',label:'NASDAQ',tz:'America/New_York',    open:[9,30],  close:[16,0],  country:'US' },
  { id:'LSE',   label:'LSE',   tz:'Europe/London',       open:[8,0],   close:[16,30], country:'UK' },
  { id:'TSE',   label:'TSE',   tz:'Asia/Tokyo',          open:[9,0],   close:[15,30], country:'JP' },
  { id:'HKEX',  label:'HKEX',  tz:'Asia/Hong_Kong',      open:[9,30],  close:[16,0],  country:'HK' },
  { id:'SGX',   label:'SGX',   tz:'Asia/Singapore',      open:[9,0],   close:[17,0],  country:'SG' },
]

// The four the dot row reports on; MarketDots' dropdown still lists all of
// EXCHANGES for anyone wanting per-exchange local time.
const MAJOR_MARKETS = ['ASX', 'NYSE', 'LSE', 'TSE']

function isExchangeOpen(ex, now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }))
  const d = local.getDay()
  if (d === 0 || d === 6) return false
  const mins = local.getHours() * 60 + local.getMinutes()
  return mins >= ex.open[0] * 60 + ex.open[1] && mins < ex.close[0] * 60 + ex.close[1]
}

// ─── Market Status Dropdown ────────────────────────────────────────────────────

function MarketDots({ now }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Dots only — the exchange name and OPEN/CLOSED word moved into the
          per-dot tooltip and the dropdown, which is what kept this strip from
          fitting at 1280px. */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Market hours"
        className="flex items-center gap-1 h-7 rounded-[2px] hover:bg-terminal-surface2 transition-colors"
      >
        {MAJOR_MARKETS.map((id) => {
          const ex = EXCHANGES.find(e => e.id === id)
          const isOpen = ex ? isExchangeOpen(ex, now) : false
          return (
            <span
              key={id}
              title={`${id} — ${isOpen ? 'Open' : 'Closed'}`}
              className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-muted/30'
              }`}
            />
          )
        })}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-terminal-panel border border-terminal-border z-[60] shadow-2xl">
          <div className="px-2 py-1 border-b border-terminal-border text-2xs text-terminal-text-dim tracking-widest">
            EXCHANGES
          </div>
          {EXCHANGES.map(ex => {
            const isOpen = isExchangeOpen(ex, now)
            const localTime = now.toLocaleTimeString('en-US', { hour12:false, timeZone:ex.tz, hour:'2-digit', minute:'2-digit' })
            return (
              <button
                key={ex.id}
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-2xs hover:bg-terminal-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-text-dim/30'}`} />
                  <span className="text-terminal-text-bright font-bold w-14 text-left">{ex.label}</span>
                  <span className={`font-bold ${isOpen ? 'text-terminal-green' : 'text-terminal-text-dim/60'}`}>
                    {isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
                <span className="text-terminal-text-dim">{localTime}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── User Menu ─────────────────────────────────────────────────────────────────

function UserMenu() {
  const { profile, user, signOut } = useAuthStore()
  const { setActiveModule } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const openSettings = () => window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: {} }))

  const initials = getInitials(profile, user)
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email || ''

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="group flex items-center hover:opacity-80 transition-opacity"
          title={displayName || 'Account'}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 transition-colors"
            style={{
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid rgba(201,168,76,0.3)',
              color: '#C9A84C',
            }}
          >
            {initials}
          </div>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-terminal-panel border border-terminal-gold/40 z-[60] shadow-2xl">
            <div className="px-3 py-2.5 border-b border-terminal-border">
              <div className="text-2xs font-bold text-terminal-text-bright">{displayName}</div>
              <div className="text-2xs text-terminal-text-dim truncate">{user?.email}</div>
            </div>
            {[
              ['⚙', 'Settings', () => { openSettings(); setOpen(false) }],
              ['👤', 'Edit Profile', () => { openSettings(); setOpen(false) }],
              ['📊', 'Portfolio', () => { setActiveModule('portfolio'); setOpen(false) }],
              ['🔔', 'Price Alerts', () => { setActiveModule('watchlist'); setOpen(false) }],
            ].map(([icon, label, onClick]) => (
              <button key={label} onClick={onClick}
                className="w-full flex items-center gap-2 px-3 py-2 text-2xs text-terminal-text hover:bg-terminal-accent/30 transition-colors text-left"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
            <div className="border-t border-terminal-border">
              <button
                onClick={() => { signOut(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-2xs text-terminal-red hover:bg-terminal-red/10 transition-colors text-left"
              >
                <span>↩</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

// 16px, not full height: a divider that reaches the bar's edges cuts the
// row into boxes; one that stops short separates without partitioning.
const Divider = () => (
  <span className="w-px flex-shrink-0 mx-1.5" style={{ height: 16, background: 'rgba(201,168,76,0.08)' }} />
)

// Data freshness indicator — shows how long since the last refresh and a
// countdown to the next automatic one; click triggers an immediate refresh
// of every live query. lastRefreshRef (not state) tracks the timestamp so
// the 1s tick only ever forces a re-render, matching the same
// interval-driven pattern the clock above already uses (lint-clean: no
// setState called synchronously from an effect body).
function DataFreshnessBadge() {
  const queryClient = useQueryClient()
  const REFRESH_INTERVAL = 60
  const [lastRefresh, setLastRefresh] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  // Auto-refresh once the countdown lapses — the invalidate + reset both
  // happen inside the interval callback (deferred, not synchronous with the
  // effect body itself), same pattern as the plain clock tick above it.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      setLastRefresh((prev) => {
        const elapsed = Math.floor((Date.now() - prev) / 1000)
        if (elapsed < REFRESH_INTERVAL) return prev
        queryClient.invalidateQueries()
        return Date.now()
      })
    }, 1000)
    return () => clearInterval(id)
  }, [queryClient])

  const elapsed = Math.floor((now - lastRefresh) / 1000)
  const remaining = Math.max(0, REFRESH_INTERVAL - elapsed)
  const timeAgo = elapsed < 5 ? 'just now' : `${elapsed}s ago`

  const handleClick = () => {
    queryClient.invalidateQueries()
    setLastRefresh(Date.now())
  }

  // Green while fresh, amber once the refresh window has lapsed. The words
  // moved into the tooltip.
  // Three states, matching how old the data actually is rather than only
  // whether the refresh timer has lapsed: green under five minutes, gold
  // under an hour, red beyond. A single "fresh or not" dot said nothing
  // about the difference between two minutes and two hours.
  const ageMins = Math.floor(elapsed / 60)
  const tone = ageMins < 5 ? { c: '#2D8A50', pulse: true, word: 'Live' }
    : ageMins < 60 ? { c: '#C9A84C', pulse: false, word: 'Recent' }
    : { c: '#A83232', pulse: false, word: 'Stale' }
  const stale = remaining === 0
  return (
    <Tooltip content={`Data ${tone.word.toLowerCase()} — updated ${timeAgo}\n${stale ? 'Refresh due' : `Auto-refresh in ${remaining}s`}\nClick to refresh now`}>
    <button
      onClick={handleClick}
      aria-label="Refresh live data"
      className="flex items-center justify-center w-3.5 h-7 flex-shrink-0 group"
    >
      <span
        className={`inline-block rounded-full transition-colors ${tone.pulse ? 'animate-pulse' : ''}`}
        style={{ width: 5, height: 5, background: tone.c }}
      />
    </button>
    </Tooltip>
  )
}

// Sentiment reduced to score + direction; the BULLISH/BEARISH word and the
// mini gauge moved into the tooltip.
function SentimentTick({ sentiment, status }) {
  if (status === 'error' || (status === 'idle' && !sentiment)) return null
  const score = sentiment?.score
  const label = sentiment?.label ?? (status === 'loading' ? 'Analysing…' : '—')
  const bullish = typeof score === 'number' ? score >= 50 : null
  return (
    <Tooltip content={`MaddenAI Sentiment\n${score ?? '·'} / 100 — ${label}`}>
    <span
      className={`text-[9px] font-mono font-bold whitespace-nowrap flex-shrink-0 ${
        bullish === null ? 'text-terminal-muted' : bullish ? 'text-terminal-gold' : 'text-terminal-red'
      }`}
    >
      {score ?? '·'}{bullish === null ? '' : bullish ? ' ▲' : ' ▼'}
    </span>
    </Tooltip>
  )
}

// Names the module you are looking at, and nothing else.
//
// This replaced the workspace switcher pills. The pills were four preset
// layouts competing for the most valuable strip in the app, and switching
// between them was a thing people did roughly never; the module you are
// currently in is a thing they want to know constantly. WorkspaceRenderer is
// untouched and still drives split view — only the pills are gone.
//
// Deliberately inert: not a button, not a dropdown. A label.
function ModuleCrumb() {
  const { activeModule } = useStore()
  // Modules with internal views announce them rather than the TopBar reaching
  // into their state, so this stays correct for the thirteen that have none.
  //
  // The announcement is stored WITH its module and matched during render,
  // rather than cleared by an effect when the module changes. Clearing would
  // leave the old module's subview on screen for a frame, and would mean two
  // effects racing to decide what the label says.
  const [sub, setSub] = useState(null)

  useEffect(() => {
    const handler = (e) => setSub(e.detail?.module ? { module: e.detail.module, label: e.detail.label } : null)
    window.addEventListener('madden:subview', handler)
    return () => window.removeEventListener('madden:subview', handler)
  }, [])

  const subview = sub?.module === activeModule ? sub.label : null

  const mod = WORKSPACE_MODULE_LIST.find((m) => m.id === activeModule)
  if (!mod) return null
  return (
    <span className="flex items-center gap-2 min-w-0" aria-live="polite">
      <span className="text-[11px] leading-none flex-shrink-0 opacity-60">{mod.icon}</span>
      <span
        className="font-mono text-[10px] uppercase whitespace-nowrap truncate"
        style={{ letterSpacing: '0.15em', color: '#637899' }}
      >
        {mod.label}
        {subview && <span style={{ color: '#3A4A61' }}> · {subview}</span>}
      </span>
    </span>
  )
}

export default function TopBar() {
  const [time, setTime] = useState(new Date())
  const { user, supabaseOffline } = useAuthStore()
  const { sentiment, status: sentimentStatus } = useSentiment()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState(undefined)
  const [showIdeas, setShowIdeas] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Lives here (not inside UserMenu) so Settings — including the theme and
  // layout-mode switchers, which have nothing to do with account state —
  // stays reachable even when `user` is null and UserMenu doesn't render.
  // NavBar's sidebar gear, UpgradePrompt CTAs, and UserMenu's own "Settings"
  // item all just dispatch this same event rather than needing a
  // prop-drilled way to reach this state.
  useEffect(() => {
    const handler = (e) => {
      setSettingsSection(e.detail?.section)
      setShowSettings(true)
    }
    window.addEventListener('madden:open-settings', handler)
    return () => window.removeEventListener('madden:open-settings', handler)
  }, [])

  // Same "self-contained modal, opened via a global event" pattern as
  // Settings above — NavBar's sidebar button and CommandBar's "ideas"
  // command both just dispatch this rather than needing prop-drilled state.
  useEffect(() => {
    const handler = () => setShowIdeas(true)
    window.addEventListener('madden:open-ideas', handler)
    return () => window.removeEventListener('madden:open-ideas', handler)
  }, [])

  const clockFormat = useSyncExternalStore(
    (cb) => displayService.subscribe(cb),
    () => displayService.get('clockFormat'),
  )
  // Time only — the date and timezone moved into the tooltip. Seconds dropped:
  // a per-second relayout in a fixed-width strip is pure noise.
  const timeStr = time.toLocaleTimeString('en-US', {
    hour12: clockFormat === '12h', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
    <div
      className="flex items-stretch flex-shrink-0"
      style={{
        height: 48,
        background: '#030912',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
      }}
    >
      {/* LEFT — exactly 64px, mirroring the sidebar rail beneath it, with a
          divider on the same line as the sidebar's own right border. The two
          verticals read as one continuous edge down the left of the app. */}
      {/* Brand lockup: mark plus wordmark.
          This zone is no longer pinned to 64px. The logo at 28px, an 8px gap
          and MADDEX at 0.25em tracking need about 82px, and forcing that into
          64px would either clip the wordmark or shrink it below the 8px floor
          the typography pass just established. The alignment with the sidebar
          rail was worth having but it only ever held while the rail was
          collapsed — it breaks the moment the sidebar is hovered or pinned —
          so the lockup wins. */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ gap: 8, padding: '0 16px', borderRight: '1px solid rgba(201,168,76,0.08)' }}
      >
        <img
          src="/icons/icon-mark-96.png"
          alt="Maddex"
          style={{ width: 28, height: 28, objectFit: 'contain' }}
        />
        <span
          className="font-mono whitespace-nowrap"
          style={{ fontSize: 9, letterSpacing: '0.25em', color: '#C9A84C', fontWeight: 600 }}
        >
          MADDEX
        </span>
      </div>

      {/* CENTRE — breadcrumb, left-aligned against the divider rather than
          centred in the window. Centred text drifts as the right cluster
          changes width; anchored text does not move at all. */}
      <div className="flex items-center min-w-0 flex-1 overflow-hidden pl-5">
        <ModuleCrumb />
      </div>

      {/* RIGHT — compact groups on one line. Dividers are interleaved between
          present items only, so a signed-out or non-demo session never leaves
          a separator dangling with nothing after it. */}
      <div className="flex items-center flex-shrink-0 pr-3">
        {[
          <MarketDots key="markets" now={time} />,
          <SentimentTick key="sentiment" sentiment={sentiment} status={sentimentStatus} />,
          <span
            key="clock"
            title="Brisbane AEST"
            className="text-[10px] font-mono text-terminal-muted whitespace-nowrap flex-shrink-0"
          >
            {timeStr}
          </span>,
          USING_MOCK_DATA ? <DataFreshnessBadge key="data" /> : null,
          user ? <NotificationCenter key="bell" /> : null,
          user ? <UserMenu key="user" /> : null,
        ]
          .filter(Boolean)
          .flatMap((node, i) => (i === 0 ? [node] : [<Divider key={`d${i}`} />, node]))}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} initialSection={settingsSection} />}
      {showIdeas && <IdeasBoard onClose={() => setShowIdeas(false)} />}
    </div>
    {!isOnline ? (
      <div className="w-full px-3 py-1 bg-amber-500/15 border-b border-amber-500/40 text-amber-400 text-2xs font-mono font-bold tracking-wide text-center flex-shrink-0">
        ⚠ NO INTERNET CONNECTION — showing cached data
      </div>
    ) : supabaseOffline && (
      <div className="w-full px-3 py-1 bg-amber-500/15 border-b border-amber-500/40 text-amber-400 text-2xs font-mono font-bold tracking-wide text-center flex-shrink-0">
        ⚠ Using offline mode — data sync unavailable
      </div>
    )}
    </>
  )
}
