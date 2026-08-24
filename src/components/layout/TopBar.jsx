import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAudRates } from '../../hooks/useAudRates'
import { fetchFxRates } from '../../services/api'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import SettingsPanel from '../settings/SettingsPanel'
import NotificationCenter from '../ui/NotificationCenter'
import { getInitials } from '../../lib/profileUtils'
import { USING_MOCK_DATA } from '../../services/api'
import { useLayoutMode, LAYOUT_MODES } from '../../hooks/useLayoutMode'
import { useSentiment } from '../../hooks/useSentiment'
import { SentimentCompact } from '../ui/SentimentIndicator'

const LAYOUT_ICONS = { standard: '⊞', focus: '▣', split: '◫', research: '◨' }

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

function isExchangeOpen(ex, now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: ex.tz }))
  const d = local.getDay()
  if (d === 0 || d === 6) return false
  const mins = local.getHours() * 60 + local.getMinutes()
  return mins >= ex.open[0] * 60 + ex.open[1] && mins < ex.close[0] * 60 + ex.close[1]
}

// ─── Market Status Dropdown ────────────────────────────────────────────────────

function MarketDropdown({ now }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('ASX')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selectedEx  = EXCHANGES.find(e => e.id === selected) ?? EXCHANGES[0]
  const selectedOpen = isExchangeOpen(selectedEx, now)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 border border-terminal-border/60 px-2 py-0.5 hover:border-terminal-gold/60 transition-colors"
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-text-dim/40'}`} />
        <span className={`text-2xs font-bold ${selectedOpen ? 'text-terminal-green' : 'text-terminal-text-dim'}`}>
          {selectedEx.id}
        </span>
        <span className={`text-2xs ${selectedOpen ? 'text-terminal-green' : 'text-terminal-text-dim'}`}>
          {selectedOpen ? 'OPEN' : 'CLOSED'}
        </span>
        <span className="text-terminal-text-dim/40 text-2xs">▾</span>
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
                onClick={() => { setSelected(ex.id); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-2xs hover:bg-terminal-accent/30 transition-colors ${selected === ex.id ? 'bg-terminal-accent/20' : ''}`}
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

const CURRENCY_FLAGS = {
  AUD: '🇦🇺', USD: '🇺🇸', GBP: '🇬🇧', EUR: '🇪🇺',
  SGD: '🇸🇬', NZD: '🇳🇿', JPY: '🇯🇵', CAD: '🇨🇦',
}

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
  // Flag only appears once profiles.preferred_currency exists (post-migration)
  const currencyFlag = profile?.preferred_currency ? CURRENCY_FLAGS[profile.preferred_currency] : null

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="group flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-terminal-surface2 border border-terminal-border-gold text-terminal-gold text-2xs font-bold font-mono flex-shrink-0 transition-colors group-hover:border-terminal-gold">
            {initials}
          </div>
          {currencyFlag && <span className="text-xs flex-shrink-0" title={profile.preferred_currency}>{currencyFlag}</span>}
          <span className="text-terminal-text-dim text-2xs hidden sm:block">
            {profile?.first_name || user?.email?.split('@')[0] || ''}
          </span>
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

const Divider = () => <span className="w-px h-4 bg-terminal-border-gold mx-2 flex-shrink-0" />

// Compact "DEMO" pill for the top bar — the fuller DemoBadge (ModuleStates.jsx)
// carries an explanatory sentence that's the right call inside a module
// header, but too long for this 44px strip.
function LayoutSwitcher() {
  const { layout, setLayout } = useLayoutMode()
  const { setChatOpen } = useStore()
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
      <button
        onClick={() => setOpen((v) => !v)}
        title="Layout mode"
        className="flex items-center justify-center text-terminal-muted hover:text-terminal-gold transition-colors w-6 h-6 text-sm flex-shrink-0"
      >
        {LAYOUT_ICONS[layout]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-terminal-panel border border-terminal-border shadow-2xl w-48 font-mono">
          {LAYOUT_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setLayout(m.key)
                // RESEARCH pairs content with the AI panel, so opening it is
                // implied by picking the mode rather than a separate step.
                if (m.key === 'research') setChatOpen(true)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-2xs flex items-start gap-2 transition-colors ${
                layout === m.key ? 'text-terminal-gold bg-terminal-accent/20' : 'text-terminal-text-dim hover:bg-terminal-accent/20'
              }`}
            >
              <span className="text-sm leading-none">{LAYOUT_ICONS[m.key]}</span>
              <span>
                <div className="font-bold">{m.label}</div>
                <div className="text-terminal-text-dim/60">{m.desc}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

  return (
    <button
      onClick={handleClick}
      title="Click to refresh all live data"
      className="pulse-gold inline-flex items-center gap-1 rounded-full bg-terminal-gold/15 border border-terminal-border-gold px-2 py-0.5 text-2xs font-mono text-terminal-gold whitespace-nowrap flex-shrink-0 hover:bg-terminal-gold/25 transition-colors cursor-pointer"
    >
      <span>● DEMO</span>
      <span className="text-terminal-gold/50">·</span>
      <span>{timeAgo}</span>
      <span className="text-terminal-gold/50">·</span>
      <span>Refresh in {remaining}s</span>
    </button>
  )
}

export default function TopBar() {
  const [time, setTime] = useState(new Date())
  const { audUsd } = useAudRates()
  const { user } = useAuthStore()
  const { sentiment, status: sentimentStatus } = useSentiment()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState(undefined)

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
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

  // Yesterday's rate for % change
  const yesterday = (() => {
    const d = new Date(time)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  const { data: prevRates } = useQuery({
    queryKey:  ['fxRatesPrev', yesterday],
    queryFn:   () => fetchFxRates('AUD'),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const prevAudUsd = prevRates?.USD ?? null
  const audUsdChg  = prevAudUsd ? ((audUsd - prevAudUsd) / prevAudUsd) * 100 : null

  const timeStr = time.toLocaleTimeString('en-US', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' })
  const dateStr = time.toLocaleDateString('en-AU', {
    weekday:'short', day:'2-digit', month:'short', year:'numeric',
  }).toUpperCase().replace(/,/g, '')
  const clockStr = `${dateStr}  ${timeStr} AEST`

  // Compact open/closed row for the four major markets — the fuller
  // EXCHANGES/CLOCKS lists stay available in MarketDropdown for anyone who
  // wants per-exchange local time; this row is the at-a-glance version.
  const MAJOR_MARKETS = ['ASX', 'NYSE', 'LSE', 'TSE']

  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center bg-terminal-header border-b border-terminal-border-gold px-3 flex-shrink-0"
      style={{ height: 44 }}
    >
      {/* LEFT — branding + AUD/USD + exchange dropdown */}
      <div className="flex items-center min-w-0 overflow-hidden">
        <span className="font-mono font-semibold text-[13px] tracking-[0.15em] text-terminal-gold flex-shrink-0">
          ▲ MADDEX
        </span>

        <Divider />

        <span className="hidden sm:inline text-terminal-muted text-[8px] tracking-[0.3em] uppercase flex-shrink-0">
          FINANCIAL INTELLIGENCE
        </span>

        <Divider />

        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <span className="text-terminal-muted text-2xs font-mono">AUD/USD</span>
          <span className="text-terminal-gold font-bold text-2xs font-mono">{audUsd.toFixed(4)}</span>
          {audUsdChg != null && (
            <span className={`text-2xs font-semibold font-mono ${audUsdChg >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {audUsdChg >= 0 ? '▲' : '▼'} {Math.abs(audUsdChg).toFixed(2)}%
            </span>
          )}
        </div>

        <div className="hidden md:block flex-shrink-0"><MarketDropdown now={time} /></div>
      </div>

      {/* CENTRE — grid's two equal 1fr side columns keep this truly centred
          regardless of how much content sits in the left/right clusters */}
      <div className="flex items-center gap-4 justify-self-center flex-shrink-0 whitespace-nowrap">
        <span className="hidden md:inline font-mono text-[10px] text-terminal-muted tracking-wider">
          {clockStr}
        </span>
        <div className="hidden md:flex items-center gap-3">
          {MAJOR_MARKETS.map((id) => {
            const ex = EXCHANGES.find(e => e.id === id)
            const isOpen = ex ? isExchangeOpen(ex, time) : false
            return (
              <span key={id} className="flex items-center gap-1">
                <span
                  className={`inline-block rounded-full flex-shrink-0 ${isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-muted/30'}`}
                  style={{ width: 8, height: 8 }}
                />
                <span className={`text-2xs font-semibold font-mono ${isOpen ? 'text-terminal-green' : 'text-terminal-muted'}`}>{id}</span>
              </span>
            )
          })}
        </div>
        {(sentimentStatus === 'ready' || sentimentStatus === 'loading') && (
          <>
            <Divider />
            <SentimentCompact sentiment={sentiment} status={sentimentStatus} />
          </>
        )}
      </div>

      {/* RIGHT — demo badge, notifications, avatar */}
      <div className="flex items-center justify-self-end flex-shrink-0">
        <LayoutSwitcher />
        <Divider />
        {USING_MOCK_DATA && <DataFreshnessBadge />}
        {user && (
          <>
            <Divider />
            <NotificationCenter />
            <Divider />
            <UserMenu />
          </>
        )}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} initialSection={settingsSection} />}
    </div>
  )
}
