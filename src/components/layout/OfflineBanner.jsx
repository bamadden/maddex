import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// "● OFFLINE — showing cached data" while the browser reports no connection;
// "✓ RECONNECTED — refreshing data" for a few seconds after it returns, while
// every live feed refetches. The modules already fall back to their own
// cached copies (and label them stale), so the banner's only job is to say
// why the numbers are not moving.
export default function OfflineBanner() {
  const queryClient = useQueryClient()
  const [state, setState] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'))

  useEffect(() => {
    let timer
    const off = () => { clearTimeout(timer); setState('offline') }
    const on = () => {
      setState('back')
      import('../../services/refreshAll').then((m) => m.refreshAllData(queryClient)).catch(() => {})
      clearTimeout(timer)
      timer = setTimeout(() => setState('online'), 4000)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); clearTimeout(timer) }
  }, [queryClient])

  if (state === 'online') return null
  const offline = state === 'offline'
  return (
    <div role="status" aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[300] font-mono font-bold tracking-widest px-3 py-1 shadow-lg"
      style={{
        top: 6, fontSize: 10,
        color: offline ? '#E8A33D' : '#2D8A50',
        background: 'rgba(6,13,26,0.95)',
        border: `1px solid ${offline ? 'rgba(232,163,61,0.6)' : 'rgba(45,138,80,0.6)'}`,
      }}>
      {offline ? '● OFFLINE — showing cached data' : '✓ RECONNECTED — refreshing data'}
    </div>
  )
}
