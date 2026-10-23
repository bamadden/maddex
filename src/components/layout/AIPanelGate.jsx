import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'

// ─── MaddenAI panel, loaded on first use ───────────────────────────────────
//
// AIPanel and its imports are the largest piece of the entry chunk, and the
// panel renders nothing until it is opened. This gate keeps it out of first
// paint: it mounts the panel the first time chatOpen goes true, or the first
// time something asks MaddenAI a question.
//
// That second case is why this is more than a lazy(). ASK AI buttons fire
// `madden:ask-ai` at a panel that is expected to be listening while closed.
// Until the panel has loaded, the gate is the listener: it holds the request,
// mounts the panel, and replays the event once the panel reports that its own
// listener is attached (onListening runs after that effect, in the same
// commit). After that the gate steps aside and the panel is never unmounted,
// so its close-time autosave behaves exactly as before.
//
// The chunk is also prefetched when the browser is idle, so the first open
// rarely waits on the network.

const loadPanel = () => import('./AIPanel')
const AIPanel = lazy(loadPanel)

export default function AIPanelGate({ wide }) {
  const { chatOpen } = useStore()
  const [armed, setArmed] = useState(chatOpen)
  const pending = useRef(null)

  if (chatOpen && !armed) setArmed(true)

  useEffect(() => {
    if (armed) return undefined
    const hold = (e) => {
      if (!e.detail?.prompt) return
      pending.current = e.detail
      setArmed(true)
    }
    window.addEventListener('madden:ask-ai', hold)
    return () => window.removeEventListener('madden:ask-ai', hold)
  }, [armed])

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 3000))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = idle(() => { loadPanel().catch(() => {}) }, { timeout: 8000 })
    return () => cancel(id)
  }, [])

  const onListening = useCallback(() => {
    const detail = pending.current
    if (!detail) return
    pending.current = null
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail }))
  }, [])

  if (!armed) return null
  return (
    <Suspense fallback={null}>
      <AIPanel wide={wide} onListening={onListening} />
    </Suspense>
  )
}
