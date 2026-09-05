import { useState, useCallback, useRef, useEffect } from 'react'

// Copy-to-clipboard with transient confirmation.
//
// Returns { copy, copied }. `copied` flips true for 1.5s so a caller can show
// a "COPIED" flash without owning its own timer. The timeout is cleared on
// unmount so a copy immediately before navigating away can't setState on a
// dead component.
//
// navigator.clipboard requires a secure context and can reject if the
// document isn't focused, so there's a textarea fallback — copying is the
// kind of small affordance that is worse than useless if it silently fails.
export function useCopyToClipboard(resetAfter = 1500) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(async (text) => {
    const value = String(text ?? '')
    if (!value) return false
    let ok
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch { ok = false }
    }
    if (ok) {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), resetAfter)
    }
    return ok
  }, [resetAfter])

  return { copy, copied }
}

export default useCopyToClipboard
