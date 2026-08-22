import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAudRates } from '../../hooks/useAudRates'
import { fetchFxRates } from '../../services/api'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import SettingsPanel from '../settings/SettingsPanel'
import NotificationCenter from '../ui/NotificationCenter'
import { getInitials } from '../../lib/profileUtils'

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
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState(undefined)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // UpgradePrompt buttons and other "manage your plan" CTAs dispatch this
  // instead of needing a prop-drilled way to open Settings from anywhere.
  useEffect(() => {
    const handler = (e) => {
      setSettingsSection(e.detail?.section)
      setShowSettings(true)
    }
    window.addEventListener('madden:open-settings', handler)
    return () => window.removeEventListener('madden:open-settings', handler)
  }, [])

  const initials = getInitials(profile, user)
  const displayName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email || ''
  // Flag only appears once profiles.preferred_currency exists (post-migration)
  const currencyFlag = profile?.preferred_currency ? CURRENCY_FLAGS[profile.preferred_currency] : null

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 flex items-center justify-center bg-terminal-accent border border-terminal-gold/60 text-terminal-gold text-2xs font-bold flex-shrink-0">
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
              ['⚙', 'Settings', () => { setShowSettings(true); setOpen(false) }],
              ['👤', 'Edit Profile', () => { setShowSettings(true); setOpen(false) }],
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
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} initialSection={settingsSection} />}
    </>
  )
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

const Divider = () => <span className="text-terminal-gold/40 text-sm mx-2 flex-shrink-0">│</span>

export default function TopBar() {
  const [time, setTime] = useState(new Date())
  const { audUsd } = useAudRates()
  const { user } = useAuthStore()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
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
    <div className="flex items-center bg-terminal-header border-b border-terminal-gold/20 px-3 flex-shrink-0" style={{ height:36 }}>

      {/* LEFT — branding */}
      <div className="flex items-baseline gap-1.5 flex-shrink-0">
        <span className="text-terminal-gold font-bold text-sm tracking-[0.2em] uppercase">
          ▲ MADDEX
        </span>
        <span className="hidden sm:inline text-terminal-text-dim text-[9px] tracking-wider">FINANCIAL INTELLIGENCE TERMINAL</span>
      </div>

      <Divider />

      {/* AUD/USD + market dropdown — kept next to branding so the centre
          slot below is free for the clock */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-terminal-text-dim text-2xs">AUD/USD</span>
        <span className="text-terminal-gold font-bold text-2xs">{audUsd.toFixed(4)}</span>
        {audUsdChg != null && (
          <span className={`text-2xs font-semibold ${audUsdChg >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {audUsdChg >= 0 ? '▲' : '▼'} {Math.abs(audUsdChg).toFixed(2)}%
          </span>
        )}
      </div>

      <Divider />

      <div className="hidden md:block"><MarketDropdown now={time} /></div>

      <div className="flex-1" />

      {/* CENTRE — combined date/time clock */}
      <span className="hidden md:inline font-mono text-[10px] text-terminal-text-dim tracking-wider flex-shrink-0 whitespace-nowrap">
        {clockStr}
      </span>

      <div className="flex-1" />

      {/* RIGHT — major-market open/closed row */}
      <div className="hidden lg:flex items-center gap-2.5 flex-shrink-0">
        {MAJOR_MARKETS.map((id, i) => {
          const ex = EXCHANGES.find(e => e.id === id)
          const isOpen = ex ? isExchangeOpen(ex, time) : false
          return (
            <span key={id} className="flex items-center gap-1">
              {i > 0 && <span className="text-terminal-border mr-1.5">|</span>}
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-terminal-green animate-pulse' : 'bg-terminal-text-dim/25'}`} />
              <span className={`text-2xs font-semibold ${isOpen ? 'text-terminal-green' : 'text-terminal-text-dim/60'}`}>{id}</span>
            </span>
          )
        })}
      </div>

      {user && (
        <>
          <Divider />
          <NotificationCenter />
          <Divider />
          <UserMenu />
        </>
      )}
    </div>
  )
}
