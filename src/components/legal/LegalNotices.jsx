import { useState } from 'react'
import { DISCLAIMER_POINTS, DISCLAIMER_SHORT, NOT_LICENSED } from '../../services/disclosures'
import { LEGAL_STATUS } from '../../data/legalVersions'

// The first-use acknowledgement and the terms acceptance (services/
// legalConsent records both). Neither can be dismissed without the action:
// there is no ✕ and no click-outside — the point is a record that the person
// saw these words.

const LINK = 'text-terminal-gold underline underline-offset-2 hover:text-terminal-gold-bright'

function Shell({ label, children }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-md bg-terminal-panel border border-terminal-border-gold font-mono p-6 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export function DisclaimerAcknowledgement({ onAcknowledge }) {
  const [busy, setBusy] = useState(false)
  return (
    <Shell label="Before you start">
      <div data-legal-ack className="space-y-3">
        <div className="text-2xs tracking-[0.24em] text-terminal-gold">BEFORE YOU START</div>
        <ul className="space-y-1.5 font-sans text-terminal-text" style={{ fontSize: 13 }}>
          {DISCLAIMER_POINTS.map((p) => <li key={p} className="flex gap-2"><span className="text-terminal-gold" aria-hidden="true">•</span><span>{p}</span></li>)}
        </ul>
        <p className="font-sans text-terminal-text-dim" style={{ fontSize: 12 }}>{NOT_LICENSED}</p>
        <p className="text-terminal-text-dim" style={{ fontSize: 11 }}>
          Read the full <a href="/disclaimer" target="_blank" rel="noopener noreferrer" className={LINK}>Disclaimer</a>.
        </p>
        <button disabled={busy} onClick={async () => { setBusy(true); await onAcknowledge() }}
          className="w-full mt-2 py-2.5 text-xs font-bold tracking-[0.16em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-60">
          I UNDERSTAND
        </button>
      </div>
    </Shell>
  )
}

export function TermsAcceptance({ onAccept, onSignOut }) {
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Shell label="Terms of Use and Privacy Policy">
      <div data-terms-accept className="space-y-3">
        <div className="text-2xs tracking-[0.24em] text-terminal-gold">TERMS OF USE AND PRIVACY POLICY</div>
        <p className="font-sans text-terminal-text" style={{ fontSize: 13 }}>
          Please read and accept the <a href="/terms" target="_blank" rel="noopener noreferrer" className={LINK}>Terms of Use</a> and
          the <a href="/privacy" target="_blank" rel="noopener noreferrer" className={LINK}>Privacy Policy</a> to continue.
        </p>
        <p className="text-terminal-text-dim" style={{ fontSize: 11 }}>Both are a {LEGAL_STATUS}.</p>
        <label className="flex items-start gap-2 font-sans text-terminal-text cursor-pointer" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          <span>I have read and agree to the Terms of Use and the Privacy Policy.</span>
        </label>
        {error && <div className="text-terminal-red" style={{ fontSize: 12 }}>{error}</div>}
        <button disabled={!agree || busy}
          onClick={async () => { setBusy(true); setError(null); try { await onAccept() } catch { setError('Could not save your acceptance. Check your connection and try again.'); setBusy(false) } }}
          className="w-full py-2.5 text-xs font-bold tracking-[0.16em] bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-50">
          ACCEPT AND CONTINUE
        </button>
        <button onClick={onSignOut} className="block mx-auto text-terminal-text-dim hover:text-terminal-text" style={{ fontSize: 11 }}>Sign out instead</button>
      </div>
    </Shell>
  )
}

// The persistent footer: every point of the disclaimer, on every screen.
// The short form, never cut off: one line on a laptop, wrapping on a phone;
// the full sentences in the tooltip and on the Disclaimer page.
export function LegalFooter() {
  const full = DISCLAIMER_POINTS.join(' · ')
  return (
    <div data-legal-footer role="contentinfo" title={full}
      className="flex-shrink-0 flex items-center gap-3 px-3 py-0.5 border-t border-terminal-border bg-terminal-bg text-terminal-text-dim font-mono" style={{ fontSize: 11, minHeight: 20 }}>
      <span data-legal-footer-text className="min-w-0 leading-snug">{DISCLAIMER_SHORT.join(' · ')}</span>
      <span className="ml-auto flex-shrink-0 flex gap-3">
        <a href="/disclaimer" target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold">Disclaimer</a>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold hidden sm:inline">Terms</a>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-terminal-gold hidden sm:inline">Privacy</a>
      </span>
    </div>
  )
}
