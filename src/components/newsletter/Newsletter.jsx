import { useEffect, useState } from 'react'
import {
  NEWSLETTER, NEWSLETTER_CHANGED_EVENT, isValidEmail, latestEdition, subscribeNewsletter, subscribedEmail,
} from '../../services/newsletterService'
import { useAuthStore } from '../../store/useAuthStore'

// The Maddex Intelligence Brief, wherever the terminal offers it: Settings →
// About (card), below the morning brief (inline), the News module (banner),
// and the Brief module's LATEST NEWSLETTER EDITION section (edition).

const BANNER_DISMISSED_KEY = 'maddex_newsletter_banner_dismissed'

function useSubscribed() {
  const [email, setEmail] = useState(subscribedEmail)
  useEffect(() => {
    const sync = () => setEmail(subscribedEmail())
    window.addEventListener(NEWSLETTER_CHANGED_EVENT, sync)
    return () => window.removeEventListener(NEWSLETTER_CHANGED_EVENT, sync)
  }, [])
  return email
}

function SubscribedNote({ email, compact }) {
  return (
    <div className={`font-mono text-terminal-green ${compact ? 'text-2xs' : 'text-xs'}`}>
      You're subscribed ✓ <span className="text-terminal-text-dim">{email}</span>
    </div>
  )
}

function SignupForm({ autoFocus = false, compact = false }) {
  const { user } = useAuthStore()
  const [email, setEmail] = useState(user?.email ?? '')
  const [status, setStatus] = useState('idle') // idle | saving | subscribed | already | local | invalid

  const submit = async (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) { setStatus('invalid'); return }
    setStatus('saving')
    setStatus(await subscribeNewsletter(email))
  }

  if (status === 'local') {
    return (
      <div className="font-mono text-2xs text-terminal-text-dim leading-relaxed">
        <span className="text-terminal-gold">Not subscribed yet.</span> The subscriber list couldn't be reached —{' '}
        <button type="button" onClick={() => setStatus('idle')} className="text-terminal-gold underline">try again</button>.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="font-mono">
      <div className="flex gap-2">
        <input
          type="email" value={email} autoFocus={autoFocus}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
          placeholder="you@example.com" aria-label="Email address for the newsletter"
          className={`flex-1 min-w-0 bg-terminal-bg border border-terminal-border focus:border-terminal-gold outline-none px-2.5 text-terminal-text-bright ${compact ? 'py-1 text-2xs' : 'py-1.5 text-xs'}`}
        />
        <button
          type="submit" disabled={status === 'saving'}
          className={`font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50 ${compact ? 'px-2.5 text-[9px]' : 'px-3 text-2xs'}`}
        >{status === 'saving' ? '…' : 'SUBSCRIBE'}</button>
      </div>
      {status === 'invalid' && <div className="text-2xs text-terminal-red mt-1">Enter a valid email address.</div>}
    </form>
  )
}

// Settings → About.
export function NewsletterCard() {
  const email = useSubscribed()
  return (
    <div className="border border-terminal-gold/30 p-3" style={{ background: 'rgba(201,168,76,0.04)' }}>
      <div className="text-2xs text-terminal-gold font-bold tracking-widest">{NEWSLETTER.name}</div>
      <div className="text-2xs text-terminal-text-dim mt-1 mb-2.5">{NEWSLETTER.tagline}</div>
      {email ? <SubscribedNote email={email} /> : <SignupForm />}
    </div>
  )
}

// Below the morning brief.
export function NewsletterInline() {
  const email = useSubscribed()
  return (
    <div className="mt-6 border-t border-terminal-border pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-terminal-text-bright font-semibold">Enjoyed this brief?</div>
        <div className="text-2xs text-terminal-text-dim mt-0.5">Get weekly insights delivered to your inbox — The Maddex Intelligence Brief, every Friday.</div>
      </div>
      <div className="sm:w-80 flex-shrink-0">{email ? <SubscribedNote email={email} compact /> : <SignupForm compact />}</div>
    </div>
  )
}

// News module. Subtle, dismissable, and gone for good once subscribed.
export function NewsletterBanner() {
  const email = useSubscribed()
  const [dismissed, setDismissed] = useState(() => { try { return !!localStorage.getItem(BANNER_DISMISSED_KEY) } catch { return false } })
  const [open, setOpen] = useState(false)
  if (email || dismissed) return null
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(BANNER_DISMISSED_KEY, '1') } catch { /* private mode */ } }
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-terminal-border font-mono flex-wrap" style={{ background: 'rgba(201,168,76,0.05)' }}>
      <span className="text-[9px] text-terminal-gold font-bold tracking-widest">✉ {NEWSLETTER.name}</span>
      <span className="text-2xs text-terminal-text-dim">Weekly, every Friday.</span>
      <div className="ml-auto flex items-center gap-2">
        {open ? <div className="w-72"><SignupForm compact autoFocus /></div> : (
          <button onClick={() => setOpen(true)} className="text-[9px] font-bold tracking-widest text-terminal-gold hover:underline">SUBSCRIBE →</button>
        )}
        <button onClick={dismiss} aria-label="Dismiss newsletter banner" className="text-terminal-text-dim hover:text-terminal-gold text-xs px-1">✕</button>
      </div>
    </div>
  )
}

// Brief module: LATEST NEWSLETTER EDITION and PREVIOUS EDITIONS.
export function NewsletterEditions() {
  const email = useSubscribed()
  const [signup, setSignup] = useState(false)
  const ed = latestEdition()
  return (
    <div className="space-y-3">
      <div className="border border-terminal-border">
        <div className="px-3 py-2 border-b border-terminal-border/50 flex items-center justify-between">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">LATEST NEWSLETTER EDITION</span>
          <span className="text-2xs text-terminal-text-dim">{NEWSLETTER.name}</span>
        </div>
        <div className="p-3">
          <div className="text-xs text-terminal-text-bright font-bold tracking-wide">{ed.title}</div>
          <div className="text-xs text-terminal-text-dim mt-1.5 leading-relaxed font-sans">
            {ed.preview ?? 'The preview appears once this week’s market review has generated — after the Friday close, in the Weekly tab.'}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <a href={ed.url} target="_blank" rel="noopener noreferrer"
              className="text-2xs font-bold tracking-widest border border-terminal-gold/50 text-terminal-gold px-2.5 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >READ FULL EDITION ↗</a>
            {email ? <SubscribedNote email={email} compact /> : !signup && (
              <button onClick={() => setSignup(true)}
                className="text-2xs font-bold tracking-widest bg-terminal-gold text-terminal-bg px-2.5 py-1 hover:bg-terminal-gold-bright transition-colors"
              >SUBSCRIBE</button>
            )}
          </div>
          {signup && !email && <div className="mt-3 max-w-md"><SignupForm compact autoFocus /></div>}
        </div>
      </div>

      <div className="border border-terminal-border">
        <div className="px-3 py-2 border-b border-terminal-border/50">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">PREVIOUS EDITIONS</span>
        </div>
        <div className="px-3 py-4 text-center">
          <div className="text-2xs text-terminal-text-dim">Newsletter archive coming soon.</div>
          {!email && (
            <button onClick={() => setSignup(true)} className="mt-2 text-[9px] font-bold tracking-widest text-terminal-gold hover:underline">
              SUBSCRIBE TO GET FUTURE EDITIONS →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
