import { useEffect, useState } from 'react'
import {
  LineChart, Bitcoin, ArrowLeftRight, Activity, Globe, Star, Briefcase, Newspaper, Search,
  Settings as SettingsIcon, LogOut, Pin, PinOff, Sunrise, Rewind, Radar, Lightbulb, Home, Calendar,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'

const PIN_KEY = 'maddex_sidebar_pinned'

function usePinnedSidebar() {
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(PIN_KEY, String(pinned)) } catch { /* ignore */ }
  }, [pinned])
  return [pinned, setPinned]
}

// fkey is fixed to CommandBar.jsx's hardcoded F1–F8 handlers (independent of
// display order below) — do not derive it from array position, or the hint
// shown on a button will name the wrong key the moment display order and
// key-binding order diverge, as they now deliberately do (grouped by
// function here vs. F1/F2/F3... in CommandBar).
const NAV_ITEMS = [
  // No fkey — F1-F8 are the existing hardcoded CommandBar bindings above;
  // reassigning them to make room here would break muscle memory for
  // existing shortcuts, so Dashboard/Calendar are mouse/click-nav only
  // (also reachable via shortcutService's customisable nav.* bindings).
  { id: 'dashboard', label: 'DASHBOARD', short: 'HOME', fkey: null, Icon: Home },
  { id: 'markets',   label: 'MARKETS',   short: 'MKT',  fkey: 'F1', Icon: LineChart },
  { id: 'crypto',    label: 'CRYPTO',    short: 'CRY',  fkey: 'F3', Icon: Bitcoin },
  { id: 'fx',        label: 'RATES',     short: 'FX',   fkey: 'F4', Icon: ArrowLeftRight },
  { id: 'macro',     label: 'MACRO',     short: 'MAC',  fkey: 'F5', Icon: Activity },
  { id: 'global',    label: 'GLOBAL',    short: 'GLB',  fkey: 'F8', Icon: Globe, groupBreak: true },
  { id: 'watchlist', label: 'WATCHLIST', short: 'WL',   fkey: 'F6', Icon: Star, groupBreak: true },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT', fkey: 'F2', Icon: Briefcase },
  { id: 'news',      label: 'NEWS',      short: 'NWS',  fkey: 'F7', Icon: Newspaper, groupBreak: true },
  { id: 'brief',     label: 'BRIEF',     short: 'BRF',  fkey: null, Icon: Sunrise },
  { id: 'calendar',  label: 'CALENDAR',  short: 'CAL',  fkey: null, Icon: Calendar },
  { id: 'screener',  label: 'SCREENER',  short: 'SCR',  fkey: null, Icon: Search },
  { id: 'replay',    label: 'REPLAY',    short: 'RPL',  fkey: null, Icon: Rewind },
  { id: 'scanner',   label: 'SCANNER',   short: 'SCN',  fkey: null, Icon: Radar },
]

// A fresh brief goes up at 7am AEST every weekday — show a notification dot
// on the nav item for the first few hours after that so it's noticeable
// without needing an actual push-notification system.
function isBriefNotifyWindow(now) {
  const aest = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
  const day = aest.getDay()
  if (day === 0 || day === 6) return false
  const hour = aest.getHours()
  return hour >= 7 && hour < 10
}

const APP_VERSION = 'v0.1.0-beta'
const LABEL_BASE = 'text-2xs font-semibold tracking-widest uppercase whitespace-nowrap transition-opacity duration-150'

// Desktop left sidebar — 56px icon-only by default, expands to 200px with
// labels on hover, or pins open at 200px via the toggle at the top. Hidden
// below the md breakpoint in favour of MobileNavBar, a bottom tab bar that's
// a better fit for touch navigation.
export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()
  const { signOut } = useAuthStore()
  const [pinned, setPinned] = usePinnedSidebar()
  const labelCls = `${LABEL_BASE} ${pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'}`
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const showBriefDot = isBriefNotifyWindow(now)

  return (
    <div
      data-tour="nav-sidebar"
      className={`group/nav hidden md:flex flex-col bg-terminal-bg border-r border-terminal-border flex-shrink-0 overflow-hidden transition-all duration-150 z-30 ${
        pinned ? 'w-[200px]' : 'w-14 hover:w-[200px]'
      }`}
    >
      <button
        onClick={() => setPinned((p) => !p)}
        title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
        className={`flex items-center gap-3 w-full px-4 py-2 border-b border-terminal-border flex-shrink-0 transition-colors duration-100 ${
          pinned ? 'text-terminal-gold' : 'text-terminal-muted/50 hover:text-terminal-muted'
        }`}
      >
        {pinned
          ? <Pin size={14} strokeWidth={1.75} className="flex-shrink-0" fill="currentColor" />
          : <PinOff size={14} strokeWidth={1.75} className="flex-shrink-0" />}
        <span className={labelCls}>{pinned ? 'PINNED' : 'PIN SIDEBAR'}</span>
      </button>
      <div className="flex-1 overflow-y-auto overflow-x-hidden thin-scrollbar py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeModule === item.id
          return (
            <div key={item.id}>
              {item.groupBreak && <div className="h-px bg-terminal-border mx-3 my-1.5 flex-shrink-0" />}
              <button
                onClick={() => setActiveModule(item.id)}
                title={item.fkey ? `${item.label} — press ${item.fkey}` : item.label}
                className={`group/item relative flex items-center gap-3 w-full px-4 py-2 border-l-2 transition-colors duration-100 ${
                  isActive
                    ? 'border-l-terminal-gold bg-terminal-gold/[0.07] text-terminal-gold'
                    : 'border-l-transparent text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2'
                }`}
              >
                <span className="relative flex-shrink-0 transition-transform duration-150 group-hover/item:scale-[1.15]">
                  <item.Icon size={18} strokeWidth={1.75} />
                  {item.id === 'brief' && showBriefDot && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-terminal-gold pulse-gold" title="New brief available" />
                  )}
                </span>
                <span className={labelCls}>{item.label}</span>
                <span className={`ml-auto text-terminal-muted/60 ${labelCls}`}>{item.fkey}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* AI Analyst toggle */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        title="AI Analyst"
        className={`flex items-center gap-3 px-4 py-2 border-t border-l-2 border-terminal-border transition-colors duration-100 ${
          chatOpen ? 'border-l-terminal-gold bg-terminal-gold text-terminal-bg' : 'border-l-transparent text-terminal-gold hover:bg-terminal-surface2'
        }`}
      >
        <span className="text-[18px] leading-none flex-shrink-0 w-[18px] text-center">▲</span>
        <span className={labelCls}>AI ANALYST</span>
      </button>

      {/* Bottom: ideas + settings + sign out */}
      <div className="border-t border-terminal-border flex-shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('madden:open-ideas'))}
          title="Ideas & roadmap"
          className="flex items-center gap-3 w-full px-4 py-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2 transition-colors"
        >
          <Lightbulb size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>IDEAS</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: {} }))}
          title="Settings"
          className="flex items-center gap-3 w-full px-4 py-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2 transition-colors"
        >
          <SettingsIcon size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>SETTINGS</span>
        </button>
        <button
          onClick={signOut}
          title="Sign out"
          className="flex items-center gap-3 w-full px-4 py-2 text-terminal-muted hover:text-terminal-red hover:bg-terminal-surface2 transition-colors"
        >
          <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>SIGN OUT</span>
        </button>
      </div>
      <a
        href="https://maddex.com.au/disclaimer"
        target="_blank"
        rel="noopener noreferrer"
        title="General information only — not financial advice"
        className="flex items-center gap-3 px-4 py-1.5 border-t border-terminal-border flex-shrink-0 text-terminal-muted/40 hover:text-terminal-gold transition-colors"
      >
        <span className="text-2xs flex-shrink-0 w-[18px] text-center">⚠</span>
        <span className={`text-2xs whitespace-nowrap ${labelCls}`}>General information only</span>
      </a>
      <div className="px-4 py-1.5 border-t border-terminal-border flex-shrink-0">
        <span className={`text-terminal-muted/40 ${labelCls}`}>{APP_VERSION}</span>
      </div>
    </div>
  )
}

// Mobile bottom tab bar (<768px) — a normal flex-flow element placed after
// CommandBar in App.jsx, not `fixed`, so it never overlaps the command input.
export function MobileNavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()

  return (
    <div className="flex md:hidden items-stretch bg-terminal-header border-t border-terminal-border flex-shrink-0 overflow-x-auto hide-scrollbar">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveModule(item.id)}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 flex-shrink-0 min-w-[56px] transition-colors ${
            activeModule === item.id ? 'text-terminal-gold' : 'text-terminal-muted'
          }`}
        >
          <item.Icon size={16} strokeWidth={1.75} />
          <span className="text-[8px] tracking-wide leading-none">{item.short}</span>
        </button>
      ))}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 flex-shrink-0 min-w-[56px] ml-auto border-l border-terminal-border ${
          chatOpen ? 'text-terminal-gold' : 'text-terminal-gold/70'
        }`}
      >
        <span className="text-sm leading-none">▲</span>
        <span className="text-[8px] tracking-wide leading-none">AI</span>
      </button>
    </div>
  )
}
