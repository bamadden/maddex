import { useEffect, useState } from 'react'
import {
  LineChart, Bitcoin, ArrowLeftRight, Activity, Globe, Star, Briefcase, Newspaper, Search,
  Settings as SettingsIcon, LogOut, Pin, PinOff, Sunrise, Rewind, Radar, Lightbulb, Home, Calendar,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuthStore } from '../../store/useAuthStore'
import NavContextMenu from '../ui/NavContextMenu'
import { shortcutService } from '../../services/shortcutService'

// Most nav ids match shortcutService's nav.* action ids directly; 'fx' is
// the one exception (its action is nav.rates — see App.jsx's
// NAV_ACTION_MODULE for the same mapping used the other direction).
const NAV_ACTION_ID = { fx: 'nav.rates' }

function shortcutHint(item) {
  const actionId = NAV_ACTION_ID[item.id] ?? `nav.${item.id}`
  const letter = shortcutService.shortcuts[actionId]?.display
  const parts = [item.fkey, letter].filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}

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
  { id: 'global',    label: 'GLOBAL',    short: 'GLB',  fkey: 'F8', Icon: Globe },
  // Dividers sit before the item carrying groupBreak, giving three groups:
  // markets research | holdings | news & tools.
  { id: 'watchlist', label: 'WATCHLIST', short: 'WL',   fkey: 'F6', Icon: Star, groupBreak: true },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT', fkey: 'F2', Icon: Briefcase },
  { id: 'news',      label: 'NEWS',      short: 'NWS',  fkey: 'F7', Icon: Newspaper },
  { id: 'brief',     label: 'BRIEF',     short: 'BRF',  fkey: null, Icon: Sunrise, groupBreak: true },
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

export const APP_VERSION = 'v0.1.0-beta'
const LABEL_BASE = 'text-[13px] font-sans font-medium tracking-wide uppercase whitespace-nowrap transition-opacity duration-150'

// Every nav row is the same 44px box in both states, so expanding the rail
// slides labels in without the list jumping vertically. The transparent 3px
// left border is carried by every row — active state just recolours it — so
// one icon column lines up across nav, AI toggle and the bottom actions.
const ROW = 'h-11 flex items-center w-full flex-shrink-0 border-l-[3px] border-l-transparent transition-colors duration-100'
// Icon column = padding + the 3px border. Collapsed: 20+3 = 23px, centring an
// 18px icon in the 64px rail. Expanded: 17+3 = 20px per spec. The 3px slide
// rides the same 150ms width transition, so it reads as one motion.
const ICON_PAD = (pinned) => (pinned ? 'pl-[17px]' : 'pl-5 group-hover/nav:pl-[17px]')
// Icon (18px) ends at 38px; a 14px gap puts the label at the spec's 52px.
const GAP = 'gap-[14px]'

// Desktop left sidebar — 64px icon-only by default, expands to 220px with
// labels on hover, or pins open at 220px via the toggle at the top. Hidden
// below the md breakpoint in favour of MobileNavBar, a bottom tab bar that's
// a better fit for touch navigation.
export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()
  const { signOut } = useAuthStore()
  const [pinned, setPinned] = usePinnedSidebar()
  const labelCls = `${LABEL_BASE} ${pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'}`
  const iconPad = ICON_PAD(pinned)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const showBriefDot = isBriefNotifyWindow(now)

  // Right-click target: { x, y, id, label } or null.
  const [ctxMenu, setCtxMenu] = useState(null)

  const runCtxAction = (action, moduleId) => {
    if (action === 'open') return setActiveModule(moduleId)
    if (action === 'popout') {
      return window.dispatchEvent(new CustomEvent('madden:pop-out', { detail: { moduleId } }))
    }
    if (action === 'split') {
      return window.dispatchEvent(new CustomEvent('madden:split-with', { detail: { moduleId } }))
    }
  }

  return (
    <div
      data-tour="nav-sidebar"
      className={`group/nav hidden md:flex flex-col bg-terminal-bg border-r border-terminal-border flex-shrink-0 overflow-x-hidden transition-all duration-150 z-30 ${
        pinned ? 'w-[220px]' : 'w-16 hover:w-[220px]'
      }`}
    >
      {/* Pin toggle — 28px square, centred in the collapsed rail and pushed
          right once the labels are in view. */}
      <div
        className={`h-8 flex items-center flex-shrink-0 border-b border-terminal-border px-3 ${
          pinned ? 'justify-end' : 'justify-center group-hover/nav:justify-end'
        }`}
      >
        <button
          onClick={() => setPinned((p) => !p)}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          aria-pressed={pinned}
          className={`w-7 h-7 flex items-center justify-center rounded-[3px] transition-colors duration-100 ${
            pinned
              ? 'text-terminal-gold bg-terminal-gold/[0.10]'
              : 'text-terminal-muted/50 hover:text-terminal-muted hover:bg-terminal-surface2'
          }`}
        >
          {pinned
            ? <Pin size={14} strokeWidth={1.75} fill="currentColor" />
            : <PinOff size={14} strokeWidth={1.75} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden thin-scrollbar py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeModule === item.id
          const hint = shortcutHint(item)
          return (
            <div key={item.id}>
              {item.groupBreak && <div className="h-px bg-terminal-gold/[0.08] mx-3 my-1.5 flex-shrink-0" />}
              <button
                onClick={() => setActiveModule(item.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id, label: item.label })
                }}
                title={hint ? `${item.label} (${hint})` : item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`group/item relative ${ROW} ${GAP} ${iconPad} pr-3 ${
                  isActive
                    ? 'border-l-terminal-gold bg-terminal-gold/[0.06] text-terminal-gold'
                    : 'border-l-transparent text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2 rounded-r-[4px]'
                }`}
              >
                <span
                  className="relative flex-shrink-0 transition-transform duration-150 group-hover/item:scale-[1.15]"
                  style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.55))' } : undefined}
                >
                  <item.Icon size={18} strokeWidth={1.75} />
                  {item.id === 'brief' && showBriefDot && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-terminal-gold pulse-gold" title="New brief available" />
                  )}
                </span>
                <span className={labelCls}>{item.label}</span>
                {/* Shortcut hint is secondary — only surfaced on row hover. */}
                {/* Hovering a row implies the rail is expanded, so the item
                    group alone gates this correctly in both states. */}
                <span
                  className="ml-auto pl-2 text-[9px] font-mono tracking-wide text-terminal-muted/70 whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150"
                >
                  {hint}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {ctxMenu && (
        <NavContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          moduleLabel={ctxMenu.label}
          onSelect={(action) => runCtxAction(action, ctxMenu.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* AI Analyst toggle */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        title={`AI Analyst (${shortcutService.shortcuts['ui.ai']?.display ?? 'A'})`}
        className={`${ROW} ${GAP} ${iconPad} pr-3 border-t border-terminal-border ${
          chatOpen ? 'border-l-terminal-gold bg-terminal-gold text-terminal-bg' : 'border-l-transparent text-terminal-gold hover:bg-terminal-surface2 rounded-r-[4px]'
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
          className={`${ROW} ${GAP} ${iconPad} pr-3 rounded-r-[4px] text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2`}
        >
          <Lightbulb size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>IDEAS</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: {} }))}
          title="Settings"
          className={`${ROW} ${GAP} ${iconPad} pr-3 rounded-r-[4px] text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface2`}
        >
          <SettingsIcon size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>SETTINGS</span>
        </button>
        <button
          onClick={signOut}
          title="Sign out"
          className={`${ROW} ${GAP} ${iconPad} pr-3 rounded-r-[4px] text-terminal-muted hover:text-terminal-red hover:bg-terminal-surface2`}
        >
          <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0" />
          <span className={labelCls}>SIGN OUT</span>
        </button>
      </div>
      <div className={`flex items-center ${GAP} ${iconPad} pr-3 h-8 border-l-[3px] border-l-transparent border-t border-terminal-border flex-shrink-0`}>
        <a
          href="https://maddex.com.au/disclaimer"
          target="_blank"
          rel="noopener noreferrer"
          title="General information only — not financial advice"
          className="flex items-center gap-2 min-w-0 flex-1 text-terminal-muted/40 hover:text-terminal-gold transition-colors"
        >
          <span className="text-2xs flex-shrink-0 w-[18px] text-center">⚠</span>
          {/* truncate (not nowrap) so a narrow rail ellipses this rather than
              letting it run under the version stamp on the same row. */}
          <span
            className={`text-[11px] font-sans truncate transition-opacity duration-150 ${
              pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'
            }`}
          >
            General info only
          </span>
        </a>
        <span
          className={`ml-auto pl-2 flex-shrink-0 text-[9px] font-mono tracking-wide text-terminal-muted/50 whitespace-nowrap transition-opacity duration-150 ${
            pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'
          }`}
        >
          {APP_VERSION}
        </span>
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
