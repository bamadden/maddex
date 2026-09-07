import { useEffect } from 'react'

// Escape closes the thing on top.
//
// Nineteen components already handled this individually and four did not —
// DetailModal, ShareLinkModal, FloatingWindow and the notification dropdown —
// which is the worst possible split: a user who learns that Escape closes the
// command bar reasonably expects it to close the stock detail modal too, and
// pressing it there did nothing at all.
//
// TWO RULES, BOTH LEARNED FROM HOW THIS GOES WRONG:
//
// 1. It does not fire while a text field has focus. Escape inside an input
//    already means "cancel what I am typing"; stealing it to close the whole
//    modal throws away the user's work on a keystroke they meant as an undo.
//
// 2. It listens in the CAPTURE phase and stops propagation, so the topmost
//    listener wins and one keypress closes exactly one layer. Without that, a
//    modal opened over the AI panel closes both at once and the user is two
//    screens back from where they meant to be.
export function useEscapeKey(onEscape, active = true) {
  useEffect(() => {
    if (!active || typeof onEscape !== 'function') return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.stopPropagation()
      onEscape()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onEscape, active])
}

export default useEscapeKey
