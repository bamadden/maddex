import { useCallback } from 'react'

// Click ripple for buttons.
//
// Returns an onClick-compatible handler that spawns the ripple and then calls
// through to whatever handler you pass, so it drops into an existing button
// without restructuring it:
//
//   const ripple = useRipple()
//   <button onClick={ripple(handleSave)}>SAVE</button>
//
// The span is appended and removed imperatively rather than held in state —
// a ripple is pure feedback with no bearing on what the component renders,
// and routing it through React would re-render the button mid-click.
//
// position/overflow are set inline only if the button isn't already
// positioned, so a button relying on `absolute` children (badges, dots)
// keeps working.
const DURATION = 400

export function useRipple() {
  return useCallback((handler) => (event) => {
    const btn = event.currentTarget
    try {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const rect = btn.getBoundingClientRect()
        const diameter = Math.max(rect.width, rect.height)
        const radius = diameter / 2

        const cs = getComputedStyle(btn)
        if (cs.position === 'static') btn.style.position = 'relative'
        const priorOverflow = btn.style.overflow
        btn.style.overflow = 'hidden'

        const circle = document.createElement('span')
        circle.setAttribute('aria-hidden', 'true')
        circle.style.cssText = [
          `width:${diameter}px`,
          `height:${diameter}px`,
          `left:${event.clientX - rect.left - radius}px`,
          `top:${event.clientY - rect.top - radius}px`,
          'position:absolute',
          'border-radius:50%',
          'background:rgba(201,168,76,0.3)',
          'transform:scale(0)',
          `animation:ripple ${DURATION}ms linear`,
          'pointer-events:none',
        ].join(';')

        btn.appendChild(circle)
        setTimeout(() => {
          circle.remove()
          // Only restore overflow once no other ripple is still running.
          if (!btn.querySelector('span[aria-hidden="true"][style*="ripple"]')) {
            btn.style.overflow = priorOverflow
          }
        }, DURATION)
      }
    } catch {
      // Feedback only — never let it block the actual click handler.
    }
    handler?.(event)
  }, [])
}

export default useRipple

// Delegated ripple for every button carrying a canonical variant class.
//
// Registered once at app level rather than threaded through each call site:
// there are ~100 buttons and counting, and a global listener means new ones
// get the behaviour for free instead of depending on whoever adds them
// remembering the hook. Uses the capture phase so it still fires when a
// handler stops propagation.
export function initGlobalRipples() {
  const onPointerDown = (event) => {
    const btn = event.target?.closest?.('.btn-primary, .btn-secondary')
    if (!btn || btn.disabled) return
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = btn.getBoundingClientRect()
      const diameter = Math.max(rect.width, rect.height)
      const radius = diameter / 2
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
      btn.style.overflow = 'hidden'

      const circle = document.createElement('span')
      circle.dataset.ripple = '1'
      circle.setAttribute('aria-hidden', 'true')
      circle.style.cssText = [
        `width:${diameter}px`, `height:${diameter}px`,
        `left:${event.clientX - rect.left - radius}px`,
        `top:${event.clientY - rect.top - radius}px`,
        'position:absolute', 'border-radius:50%',
        'background:rgba(201,168,76,0.3)', 'transform:scale(0)',
        'animation:ripple 400ms linear', 'pointer-events:none',
      ].join(';')
      btn.appendChild(circle)
      setTimeout(() => circle.remove(), 400)
    } catch {
      // Decorative only.
    }
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  return () => document.removeEventListener('pointerdown', onPointerDown, true)
}
