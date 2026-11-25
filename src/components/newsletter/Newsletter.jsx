import { useEffect, useState } from 'react'
import {
  NEWSLETTER, NEWSLETTER_CHANGED_EVENT, NEWSLETTER_CONSENT, isValidEmail, subscribeNewsletter, pendingConfirmation,
} from '../../services/newsletterService'
import { useAuthStore } from '../../store/useAuthStore'
import { formatDate } from '../../utils/dateUtils'

// The newsletter sign-up, offered only in Settings → About until editions
// exist. (The banner in News and the edition/archive sections in Brief were
// removed on 1 Nov 2026: there was nothing to subscribe to yet.) Double
// opt-in since 26 Nov 2026: this device only ever knows that a confirmation
// email was sent, so it never says "subscribed".

function usePending() {
  const [pending, setPending] = useState(() => pendingConfirmation())
  useEffect(() => {
    const sync = () => setPending(pendingConfirmation())
    window.addEventListener(NEWSLETTER_CHANGED_EVENT, sync)
    return () => window.removeEventListener(NEWSLETTER_CHANGED_EVENT, sync)
  }, [])
  return pending
}

function PendingNote({ pending, onAgain }) {
  return (
    <div className="font-mono text-2xs text-terminal-text-dim leading-relaxed" role="status">
      <span className="text-terminal-gold">Check your inbox.</span> A confirmation link went to{' '}
      <span className="text-terminal-text-bright">{pending.email}</span> on {formatDate(pending.at.slice(0, 10))}. You are subscribed once you press Confirm in that email; the link works for 48 hours.{' '}
      <button type="button" onClick={onAgain} className="text-terminal-gold underline">Use another address</button>
    </div>
  )
}

const MESSAGES = {
  invalid: { tone: 'text-terminal-red', text: 'Enter a valid email address.' },
  consent: { tone: 'text-terminal-red', text: 'Tick the box to agree to the newsletter emails.' },
  rate_limited: { tone: 'text-terminal-gold', text: 'Too many attempts. Try again in a few minutes.' },
  unavailable: { tone: 'text-terminal-gold', text: "Sign-up isn't open just now. Nothing was recorded; please try again later." },
}

function SignupForm({ autoFocus = false, compact = false }) {
  const { user } = useAuthStore()
  const [email, setEmail] = useState(user?.email ?? '')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('idle') // idle | saving | pending | invalid | consent | rate_limited | unavailable

  const submit = async (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) { setStatus('invalid'); return }
    if (!consent) { setStatus('consent'); return }
    setStatus('saving')
    setStatus(await subscribeNewsletter(email, consent))
  }
  const msg = MESSAGES[status]

  return (
    <form onSubmit={submit} className="font-mono" noValidate>
      <div className="flex gap-2">
        <input
          type="email" value={email} autoFocus={autoFocus}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
          placeholder="you@example.com" aria-label="Email address for the newsletter"
          className={`flex-1 min-w-0 bg-terminal-bg border border-terminal-border focus:border-terminal-gold outline-none px-2.5 text-terminal-text-bright ${compact ? 'py-1 text-2xs' : 'py-1.5 text-xs'}`}
        />
        <button
          type="submit" disabled={status === 'saving'}
          className={`font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50 ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-2xs'}`}
        >{status === 'saving' ? '…' : 'SUBSCRIBE'}</button>
      </div>
      <label className="flex items-start gap-2 mt-2 text-2xs text-terminal-text-dim leading-snug cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setStatus('idle') }} className="mt-0.5 accent-terminal-gold" data-newsletter-consent />
        <span>{NEWSLETTER_CONSENT}</span>
      </label>
      {msg && <div className={`text-2xs mt-1 ${msg.tone}`} role="alert">{msg.text}</div>}
    </form>
  )
}

// Settings → About.
export function NewsletterCard() {
  const pending = usePending()
  const [again, setAgain] = useState(false)
  return (
    <div className="border border-terminal-gold/30 p-3" style={{ background: 'rgba(201,168,76,0.04)' }}>
      <div className="text-2xs text-terminal-gold font-bold tracking-widest">{NEWSLETTER.name}</div>
      <div className="text-2xs text-terminal-text-dim mt-1 mb-2.5">{NEWSLETTER.tagline}</div>
      {pending && !again ? <PendingNote pending={pending} onAgain={() => setAgain(true)} /> : <SignupForm />}
    </div>
  )
}
