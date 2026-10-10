import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  LineChart, Bitcoin, ArrowLeftRight, Activity, Globe, Star, Briefcase, Newspaper, Search,
  Settings as SettingsIcon, Pin, PinOff, Sunrise, Rewind, Radar, Home, Calendar, Landmark, Calculator, Package, CandlestickChart,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import NavContextMenu from '../ui/NavContextMenu'
import { shortcutService } from '../../services/shortcutService'
import { getSidebarWidth, setSidebarWidth, onSidebarWidthChange } from '../../services/sidebarPref'
import { MILESTONES, getProgress, subscribeProgress, shouldShowProgress, markCelebrated } from '../../services/gettingStarted'
import { useSubscription } from '../../hooks/useSubscription'
import { PRICES, openPricing, startUpgrade } from '../../services/plans'

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

// FULL = pinned open with labels; COMPACT = icon rail that expands on hover.
// Stored via sidebarPref so Settings → Display can set it too.
function usePinnedSidebar() {
  const [width, setWidth] = useState(getSidebarWidth)
  useEffect(() => onSidebarWidthChange(setWidth), [])
  const setPinned = (next) => {
    const v = typeof next === 'function' ? next(width === 'full') : next
    setSidebarWidth(v ? 'full' : 'compact')
  }
  return [width === 'full', setPinned]
}

// fkey is fixed to CommandBar.jsx's hardcoded F1–F8 handlers (independent of
// display order below) — do not derive it from array position, or the hint
// shown on a button will name the wrong key the moment display order and
// key-binding order diverge, as they now deliberately do (grouped by
// function here vs. F1/F2/F3... in CommandBar).
const NAV_ITEMS = [
  // Overview — the home row stands alone, without a heading.
  { id: 'dashboard', label: 'DASHBOARD', short: 'HOME', fkey: null, Icon: Home,       group: null },

  { id: 'markets',   label: 'MARKETS',   short: 'MKT',  fkey: 'F1', Icon: LineChart,  group: 'MARKETS' },
  { id: 'crypto',    label: 'CRYPTO',    short: 'CRY',  fkey: 'F3', Icon: Bitcoin,    group: 'MARKETS' },
  { id: 'fx',        label: 'RATES',     short: 'FX',   fkey: 'F4', Icon: ArrowLeftRight, group: 'MARKETS' },
  { id: 'macro',     label: 'MACRO',     short: 'MAC',  fkey: 'F5', Icon: Activity,   group: 'MARKETS' },
  { id: 'global',    label: 'GLOBAL',    short: 'GLB',  fkey: 'F8', Icon: Globe,      group: 'MARKETS' },

  { id: 'watchlist', label: 'WATCHLIST', short: 'WL',   fkey: 'F6', Icon: Star,       group: 'PORTFOLIO' },
  { id: 'portfolio', label: 'PORTFOLIO', short: 'PORT', fkey: 'F2', Icon: Briefcase,  group: 'PORTFOLIO' },
  { id: 'news',      label: 'NEWS',      short: 'NWS',  fkey: 'F7', Icon: Newspaper,  group: 'PORTFOLIO' },

  { id: 'brief',     label: 'BRIEF',     short: 'BRF',  fkey: null, Icon: Sunrise,    group: 'ANALYSIS' },
  { id: 'calendar',  label: 'CALENDAR',  short: 'CAL',  fkey: null, Icon: Calendar,   group: 'ANALYSIS' },
  { id: 'scanner',   label: 'SCANNER',   short: 'SCN',  fkey: null, Icon: Radar,      group: 'ANALYSIS' },
  { id: 'screener',  label: 'SCREENER',  short: 'SCR',  fkey: null, Icon: Search,     group: 'ANALYSIS' },
  { id: 'replay',    label: 'REPLAY',    short: 'RPL',  fkey: null, Icon: Rewind,     group: 'ANALYSIS' },

  // INSTRUMENTS — asset classes the terminal covers beyond equities.
  { id: 'bonds',     label: 'BONDS',     short: 'BND',  fkey: null, Icon: Landmark,   group: 'INSTRUMENTS' },
  { id: 'etf',       label: 'ETFs',      short: 'ETF',  fkey: null, Icon: Package,    group: 'INSTRUMENTS' },
  { id: 'futures',   label: 'FUTURES',   short: 'FUT',  fkey: null, Icon: CandlestickChart, group: 'INSTRUMENTS' },
  { id: 'calculators', label: 'CALC',    short: 'CLC',  fkey: null, Icon: Calculator, group: 'INSTRUMENTS' },
]

// Headings are derived from the items as they render — a heading appears each
// time `group` changes — rather than from a separate list of group names,
// which is a second source of truth waiting to disagree with the first.

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

// From package.json via vite.config `define`. Bump the version there to ship
// release notes: What's New shows once per distinct APP_VERSION.
// eslint-disable-next-line no-undef
export const APP_VERSION = `v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}`

// Labels are IBM Plex Mono at 10px, not sans at 13px. The sidebar is a
// terminal chrome element sitting beside monospaced data; a 13px sans label
// was the single loudest thing in the rail and read as a website menu.
const LABEL_BASE =
  'font-mono text-[10px] tracking-[0.12em] uppercase whitespace-nowrap transition-opacity duration-150'

// Row height differs by state, deliberately, and not the way the spec first
// reads. 44px collapsed AND while hover-expanded; 40px only when pinned.
//
// Shrinking rows on hover would move every item under the cursor at the exact
// moment the user is reaching for one — you hover to read a label and the row
// you were aiming at slides 4px per item up the list. Pinning is an explicit
// click, so a one-off reflow there is fine; hovering is not.
const rowH = (pinned) => (pinned ? 'h-10' : 'h-11')

// 2px active border per spec, carried transparent by every row so the icon
// column lines up across nav, AI toggle and the bottom actions.
const ROW_BASE =
  'flex items-center w-full flex-shrink-0 border-l-2 border-l-transparent transition-colors duration-150'

// Icon column. Collapsed: 21+2 = 23px, centring an 18px icon in the 64px
// rail. Expanded: 18+2 = 20px per spec.
const ICON_PAD = (pinned) => (pinned ? 'pl-[18px]' : 'pl-[21px] group-hover/nav:pl-[18px]')
// Icon (18px) ends at 38px; a 14px gap puts the label at the spec's 52px.
const GAP = 'gap-[14px]'

// Desktop left sidebar — 64px icon-only by default, expands to 220px with
// labels on hover, or pins open at 220px via the toggle at the top. Hidden
// below the md breakpoint in favour of MobileNavBar, a bottom tab bar that's
// a better fit for touch navigation.
export default function NavBar() {
  const { activeModule, setActiveModule, chatOpen, setChatOpen } = useStore()
  const [pinned, setPinned] = usePinnedSidebar()
  const labelCls = `${LABEL_BASE} ${pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'}`

  const { plan } = useSubscription()

  // Getting-started progress (first week only; see services/gettingStarted).
  const progress = useSyncExternalStore(subscribeProgress, getProgress)
  const showProgress = shouldShowProgress(progress)
  // The completion line is shown once: it retires itself after ten seconds
  // if not dismissed, and the progress row goes with it.
  useEffect(() => {
    if (!showProgress || !progress.complete) return undefined
    const id = setTimeout(markCelebrated, 10_000)
    return () => clearTimeout(id)
  }, [showProgress, progress.complete])
  const iconPad = ICON_PAD(pinned)
  const ROW = `${ROW_BASE} ${rowH(pinned)}`
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const showBriefDot = isBriefNotifyWindow(now)

  // Right-click target: { x, y, id, label } or null.
  const [ctxMenu, setCtxMenu] = useState(null)

  // The list is taller than the rail on any realistic window, so the active
  // row can sit off-screen — especially when navigation came from a keyboard
  // shortcut or the command bar rather than from a click here. Scrolling it
  // into view keeps the sidebar an accurate picture of where you are.
  useEffect(() => {
    const el = document.querySelector('[data-tour="nav-sidebar"] .nav-row.is-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeModule])

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
      className={`group/nav hidden md:flex flex-col flex-shrink-0 overflow-x-hidden z-30 ${
        pinned ? 'w-[220px]' : 'w-16 hover:w-[220px]'
      }`}
      style={{
        background: '#030912',
        borderRight: '1px solid rgba(201,168,76,0.08)',
        // Explicit easing rather than Tailwind's default: the rail should
        // leave quickly and settle slowly, which linear-ish easing does not.
        transition: 'width 200ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Pin toggle — 28px square, centred in the collapsed rail and pushed
          right once the labels are in view. */}
      <div
        className={`h-12 flex items-center flex-shrink-0 px-3 relative ${
          pinned ? 'justify-end' : 'justify-center group-hover/nav:justify-end'
        }`}
        style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}
      >
        {/* The mark itself, always visible; the wordmark joins it once the
            rail is open. Collapsed, the icon alone is the brand — which is
            what a 64px rail can actually carry. */}
        <img
          src="/icons/icon-mark-96.png"
          alt="Maddex"
          className={pinned ? 'flex-shrink-0' : 'absolute left-1/2 -translate-x-1/2 group-hover/nav:static group-hover/nav:translate-x-0'}
          style={{ width: 36, height: 36, objectFit: 'contain' }}
        />
        <span
          className={`mr-auto pl-2 font-mono text-[10px] tracking-[0.22em] text-terminal-gold transition-opacity duration-150 ${
            pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'
          }`}
        >
          MADDEX
        </span>
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
            ? <Pin size={16} strokeWidth={1.75} fill="currentColor" />
            : <PinOff size={16} strokeWidth={1.75} />}
        </button>
      </div>
      {/* The scrollable region. This list is 14 rows tall and the viewport
          often is not — before this it scrolled silently, and nine items
          including GLOBAL and PORTFOLIO were simply unreachable unless you
          guessed they were there. The mask fades the last 12px so an
          overflowing list is visibly cut. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden nav-scroll py-1.5">
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeModule === item.id
          const hint = shortcutHint(item)
          const startsGroup = item.group && (i === 0 || NAV_ITEMS[i - 1].group !== item.group)
          return (
            <div key={item.id}>
              {startsGroup && (
                <>
                  {/* Collapsed: a hairline, since a label would not fit.
                      Expanded: the group name. Same slot either way, so the
                      list does not reflow when the rail opens. */}
                  <div className={`${i === 0 ? 'mt-1' : 'mt-2'} h-6 flex items-center`}>
                    <span
                      className={`pl-5 font-mono text-[8px] tracking-[0.2em] uppercase whitespace-nowrap transition-opacity duration-150 ${
                        pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100'
                      }`}
                      style={{ color: '#4A6080' }}
                    >
                      {item.group}
                    </span>
                    <span
                      className={`absolute h-px w-10 ml-3 transition-opacity duration-150 ${
                        pinned ? 'opacity-0' : 'opacity-100 group-hover/nav:opacity-0'
                      }`}
                      style={{ background: 'rgba(201,168,76,0.06)' }}
                    />
                  </div>
                </>
              )}
              <button
                onClick={() => setActiveModule(item.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id, label: item.label })
                }}
                title={hint ? `${item.label} (${hint})` : item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`group/item relative nav-row ${ROW} ${GAP} ${iconPad} pr-3 ${isActive ? 'is-active' : ''}`}
              >
                <span className="relative flex-shrink-0 nav-icon">
                  <item.Icon size={18} strokeWidth={1.75} />
                  {item.id === 'brief' && showBriefDot && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-terminal-gold pulse-gold" title="New brief available" />
                  )}
                </span>
                <span className={`nav-label ${labelCls}`}>{item.label}</span>
                <span
                  className="ml-auto pl-2 font-mono text-[9px] whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150"
                  style={{ color: '#4A6080' }}
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
        className={`nav-row ${ROW} ${GAP} ${iconPad} pr-3 ${chatOpen ? 'is-active' : ''}`}
        style={{ borderTop: '1px solid rgba(201,168,76,0.06)', color: chatOpen ? '#C9A84C' : '#C9A84C' }}
      >
        <span className="text-[18px] leading-none flex-shrink-0 w-[18px] text-center">▲</span>
        <span className={`nav-label ${labelCls}`} style={{ color: '#C9A84C' }}>AI ANALYST</span>
      </button>

      {/* Bottom: Settings only.
          IDEAS and SIGN OUT used to live here, costing 80px of permanent
          vertical space for two rarely-used actions while nine NAV items sat
          unreachable below the fold. Both remain available — sign out from
          the TopBar user menu, ideas from the command bar — so this trades
          nothing away and buys back two rows of navigation. */}
      {/* Upgrade, above Settings. Core: a real call to action. Prime: one
          quiet line. Apex (and a live trial, which is Apex): nothing. */}
      {plan === 'core' && (
        <div className="flex-shrink-0 relative" style={{ borderTop: '1px solid rgba(201,168,76,0.12)' }}>
          <button onClick={openPricing} title="Upgrade to Prime — unlock the full terminal"
            className={`nav-row ${ROW} ${GAP} ${iconPad} pr-3 w-full`} style={{ background: 'rgba(201,168,76,0.06)' }}>
            <span className="flex-shrink-0 text-terminal-gold" style={{ width: 18, textAlign: 'center', fontSize: 15 }} aria-hidden="true">★</span>
            <span className={`nav-label ${labelCls} flex-1 min-w-0 text-left leading-tight`}>
              <span className="block text-terminal-gold font-bold tracking-wider" style={{ fontSize: 10 }}>UPGRADE TO PRIME</span>
              <span className="block text-terminal-text-dim" style={{ fontSize: 9 }}>Unlock the full terminal · A${PRICES.prime.monthly}/month</span>
            </span>
            <span role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); startUpgrade('prime') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); startUpgrade('prime') } }}
              className={`nav-label ${labelCls} flex-shrink-0 px-2 py-0.5 bg-terminal-gold text-terminal-bg font-bold tracking-wider hover:bg-terminal-gold-bright`}
              style={{ fontSize: 9 }}>UPGRADE</span>
          </button>
        </div>
      )}
      {plan === 'prime' && (
        <button onClick={openPricing} title="Apex: unlimited MaddenAI, unlimited alerts, API access"
          className={`flex-shrink-0 nav-row ${ROW} ${GAP} ${iconPad} pr-3 text-terminal-text-dim/70 hover:text-terminal-gold`}
          style={{ borderTop: '1px solid rgba(201,168,76,0.06)' }}>
          <span className="flex-shrink-0" style={{ width: 18, textAlign: 'center', fontSize: 12 }} aria-hidden="true">✦</span>
          <span className={`nav-label ${labelCls}`} style={{ fontSize: 9, letterSpacing: '0.06em' }}>Upgrade to Apex for unlimited AI</span>
        </button>
      )}
      <div className="flex-shrink-0 relative" style={{ borderTop: '1px solid rgba(201,168,76,0.06)' }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: {} }))}
          title={showProgress
            ? `Settings\n\nGetting started — ${progress.count}/${progress.total}\n${MILESTONES.map((m) => `${progress.done.includes(m.id) ? '✓' : '○'} ${m.label}`).join('\n')}`
            : 'Settings'}
          aria-label={showProgress ? `Settings — getting started, ${progress.count} of ${progress.total} complete` : 'Settings'}
          className={`nav-row ${ROW} ${GAP} ${iconPad} pr-3`}
        >
          <span className="relative flex-shrink-0">
            <SettingsIcon size={18} strokeWidth={1.75} className="flex-shrink-0 nav-icon" />
            {/* First-week progress, under the icon so it reads in the compact
                rail too. Five dots, one per milestone. */}
            {showProgress && (
              <span className="absolute left-1/2 -translate-x-1/2 flex gap-[2px]" style={{ bottom: -7 }} aria-hidden="true">
                {MILESTONES.map((m) => (
                  <span key={m.id} className="w-[3px] h-[3px] rounded-full"
                    style={{ background: progress.done.includes(m.id) ? '#C9A84C' : 'rgba(99,120,153,0.45)' }} />
                ))}
              </span>
            )}
          </span>
          <span className={`nav-label ${labelCls}`}>
            SETTINGS
            {showProgress && <span className="ml-2 font-mono text-[9px] text-terminal-gold/80 tracking-wider">{progress.count}/{progress.total}</span>}
          </span>
          <span
            className="ml-auto pl-2 font-mono text-[9px] whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150"
            style={{ color: '#4A6080' }}
          >
            {shortcutService.shortcuts['ui.settings']?.display ?? ''}
          </span>
        </button>
        {showProgress && progress.complete && (
          <div role="status"
            className="fixed z-[150] font-mono shadow-2xl px-3 py-2.5 flex items-start gap-2.5"
            style={{ left: 76, bottom: 64, width: 250, background: '#0E1E36', border: '1px solid rgba(201,168,76,0.6)', borderRadius: 3, animation: 'maddex-tip-in 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <span className="text-terminal-gold" aria-hidden="true">✓</span>
            <div className="flex-1 text-[11.5px] leading-[17px] text-terminal-text">You've explored everything. Welcome aboard.</div>
            <button onClick={markCelebrated} aria-label="Dismiss" className="text-terminal-text-dim hover:text-terminal-text text-xs leading-none">✕</button>
          </div>
        )}
      </div>
      <div
        className={`flex items-center ${GAP} ${iconPad} pr-3 h-8 border-l-2 border-l-transparent flex-shrink-0`}
        style={{ borderTop: '1px solid rgba(201,168,76,0.06)' }}
      >
        <a
          href="/disclaimer"
          target="_blank"
          rel="noopener noreferrer"
          title="General information only — not financial advice"
          className="flex items-center gap-2 min-w-0 flex-1 text-terminal-muted/40 hover:text-terminal-gold transition-colors"
        >
          <span className="text-2xs flex-shrink-0 w-[18px] text-center">⚠</span>
          {/* truncate (not nowrap) so a narrow rail ellipses this rather than
              letting it run under the version stamp on the same row. */}
          <span
            className={`text-[10px] font-sans truncate transition-opacity duration-150 ${
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
