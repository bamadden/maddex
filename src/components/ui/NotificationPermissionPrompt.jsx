import { useEffect, useState } from 'react'
import { requestPermission, dismissPrompt, shouldOfferPrompt } from '../../services/browserNotify'

// Shown once, when the user sets their first alert, before the browser's own
// permission dialog. A cold browser prompt with no context is the one most
// people refuse — and a refusal can only be undone from browser settings.
export default function NotificationPermissionPrompt() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOffer = () => { if (shouldOfferPrompt()) setOpen(true) }
    window.addEventListener('maddex:notify-offer', onOffer)
    return () => window.removeEventListener('maddex:notify-offer', onOffer)
  }, [])
  if (!open) return null
  const close = () => { dismissPrompt(); setOpen(false) }
  return (
    <div className="fixed bottom-16 right-6 z-[160] w-[340px] font-mono shadow-2xl"
      style={{ background: 'rgba(7,20,40,0.98)', border: '1px solid rgba(201,168,76,0.45)', borderLeft: '3px solid #C9A84C' }}
      role="dialog" aria-label="Enable notifications">
      <div className="p-4">
        <div className="text-2xs font-bold tracking-widest text-terminal-gold mb-1.5">🔔 GET ALERTED IN THE BACKGROUND</div>
        <div className="text-2xs text-terminal-text leading-relaxed">
          Enable notifications to get alerted when your price targets are hit, even when Maddex is running in the background.
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => { await requestPermission(); close() }}
            className="flex-1 text-2xs font-bold tracking-widest py-1.5 bg-terminal-gold text-terminal-bg hover:brightness-110"
          >ENABLE NOTIFICATIONS</button>
          <button onClick={close} className="text-2xs font-bold tracking-widest px-3 py-1.5 border border-terminal-border text-terminal-text-dim hover:text-terminal-text">NOT NOW</button>
        </div>
        <div className="text-[9px] text-terminal-text-dim/60 mt-2">Change any time in Settings → Notifications.</div>
      </div>
    </div>
  )
}
