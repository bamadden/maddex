import { useEffect, useState } from 'react'
import {
  NEWSLETTER, NEWSLETTER_CHANGED_EVENT, isValidEmail, subscribeNewsletter, subscribedEmail,
} from '../../services/newsletterService'
import { useAuthStore } from '../../store/useAuthStore'

// The newsletter sign-up, offered only in Settings → About until editions
// exist. (The banner in News and the edition/archive sections in Brief were
// removed on 1 Nov 2026: there was nothing to subscribe to yet.)

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
          className={`font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50 ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-2xs'}`}
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
