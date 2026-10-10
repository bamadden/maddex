import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isNewUser, isTooltipSeen, markTooltipSeen, TOOLTIPS } from '../../services/onboardingState'

// A one-line tooltip, once, on a module's first visit during the first week —
// pointing at the thing it is about.
//
// THREE RULES, EACH LEARNED FROM HOW THESE USUALLY GO WRONG
//
// 1. It says something you cannot see. "This is the markets module" is noise
//    when the header says MARKETS. Every tooltip names a shortcut, a hidden
//    interaction or how the data behaves.
// 2. It appears once and remembers. A tooltip that returns trains the reader
//    to dismiss on sight — the habit that hides a genuinely important notice.
// 3. It expires. After seven days the tooltips stop, dismissed or not.
//
// `suppressed` is passed while a modal owns the screen: a tooltip that fires
// behind the welcome card would be invisible and, once dismissed, spent.

const WIDTH = 240
const GAP = 10

// Where to put the card relative to the target rect, and where its arrow goes.
function place(rect, placement) {
  const vw = window.innerWidth, vh = window.innerHeight
  const clampX = (x) => Math.max(12, Math.min(vw - WIDTH - 12, x))
  if (placement === 'left') {
    return { style: { top: Math.max(12, rect.top + 44), left: Math.max(12, rect.left - WIDTH - GAP - 4) }, arrow: 'right', arrowAt: 18 }
  }
  // A tall target (a table, a panel): sit just inside its top edge, arrow up
  // at the header, rather than below a box that runs off the screen.
  if (rect.height > 160) {
    const left = clampX(rect.left + 24)
    return { style: { top: rect.top + 40, left }, arrow: 'up', arrowAt: Math.min(WIDTH - 20, Math.max(14, rect.left + 60 - left)) }
  }
  const cx = rect.left + rect.width / 2
  const left = clampX(cx - WIDTH / 2)
  const arrowAt = Math.min(WIDTH - 20, Math.max(14, cx - left - 6))
  if (rect.bottom + 130 > vh) {
    return { style: { bottom: vh - rect.top + GAP, left }, arrow: 'down', arrowAt }
  }
  return { style: { top: rect.bottom + GAP, left }, arrow: 'up', arrowAt }
}

export default function ContextualTip({ moduleId, suppressed = false }) {
  const tip = TOOLTIPS[moduleId]

  // Eligibility read once, in the initialiser: both checks hit localStorage,
  // and this mounts on every module switch for users who are not new.
  const [eligible] = useState(() => Boolean(tip) && isNewUser() && !isTooltipSeen(moduleId))
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!eligible || suppressed) return undefined
    // After the module has painted — appearing in the same frame as the
    // content reads as the layout jumping. A tooltip with a `ready` check
    // (something else owns the screen first) waits for it.
    let timer = null
    const tryShow = () => {
      // One tooltip at a time: two arrows pointing in different directions
      // is a page shouting, not a hint. The later one waits its turn.
      if ((tip.ready && !tip.ready()) || document.querySelector('[data-contextual-tip]')) { timer = setTimeout(tryShow, 500); return }
      timer = setTimeout(() => setVisible(true), 700)
    }
    tryShow()
    return () => clearTimeout(timer)
  }, [eligible, suppressed, tip])

  // Track the target while shown: modules load data and reflow after mount.
  useLayoutEffect(() => {
    if (!visible || !tip?.target) return undefined
    const measure = () => {
      const r = document.querySelector(tip.target)?.getBoundingClientRect()
      setRect(r && r.width && r.bottom > 0 && r.top < window.innerHeight
        ? { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom }
        : null)
    }
    measure()
    const id = setInterval(measure, 300)
    window.addEventListener('resize', measure)
    return () => { clearInterval(id); window.removeEventListener('resize', measure) }
  }, [visible, tip])

  useEffect(() => { if (visible) cardRef.current?.querySelector('button')?.focus({ preventScroll: true }) }, [visible])

  if (!tip || !eligible || !visible || suppressed) return null

  const close = () => {
    markTooltipSeen(moduleId)
    setVisible(false)
  }

  const pos = rect ? place(rect, tip.placement) : null
  const arrowBase = 'absolute w-2.5 h-2.5 rotate-45'
  const arrowStyle = { background: '#0E1E36' }
  const edge = '1px solid rgba(201,168,76,0.6)'

  return (
    <div
      ref={cardRef}
      className={`${pos ? 'fixed' : 'absolute'} z-[150] font-mono shadow-2xl`}
      style={{
        ...(pos ? pos.style : { bottom: 14, left: 14 }),
        width: WIDTH,
        border: edge,
        borderRadius: 3,
        background: '#0E1E36',
        animation: 'maddex-tip-in 260ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      role="dialog"
      aria-label="Tip"
      data-contextual-tip=""
      onKeyDown={(e) => { if (e.key === 'Escape') close() }}
    >
      {pos?.arrow === 'up' && <span className={arrowBase} style={{ ...arrowStyle, top: -6, left: pos.arrowAt, borderLeft: edge, borderTop: edge }} />}
      {pos?.arrow === 'down' && <span className={arrowBase} style={{ ...arrowStyle, bottom: -6, left: pos.arrowAt, borderRight: edge, borderBottom: edge }} />}
      {pos?.arrow === 'right' && <span className={arrowBase} style={{ ...arrowStyle, right: -6, top: pos.arrowAt, borderRight: edge, borderTop: edge }} />}
      <div className="relative px-3 pt-2.5 pb-2">
        <div className="flex items-start gap-2">
          <span className="text-terminal-gold flex-shrink-0" style={{ fontSize: 10, lineHeight: '17px' }} aria-hidden="true">◆</span>
          <div className="text-[11.5px] text-terminal-text leading-[17px]">{tip.text}</div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={close}
            className="text-[9px] font-bold tracking-[0.18em] px-2 py-1 text-terminal-gold border border-terminal-gold/40 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
          >GOT IT</button>
        </div>
      </div>
    </div>
  )
}
