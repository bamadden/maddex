import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compareHoldings, readAccountHoldings, addHoldingsToAccount, removeHoldingsFromAccount } from '../../services/portfolioSync'

// Where the holdings are saved, said plainly, with every change to either
// copy behind a confirmation that names exactly what will change. Nothing is
// written when the bar mounts; the account is only read. Same rules as the
// Watchlist's bar.
const list = (hs) => {
  const names = hs.map((h) => `${h.symbol} ${h.shares}`)
  return names.length <= 5 ? names.join(', ') : `${names.slice(0, 5).join(', ')} and ${names.length - 5} more`
}
const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`

export default function PortfolioSyncBar({ user, holdings, onLoad }) {
  const [account, setAccount] = useState(null)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(null)   // { kind, items }
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!user) return
    let live = true
    readAccountHoldings(supabase, user.id)
      .then((rows) => { if (live) { setAccount(rows); setFailed(false) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [user])

  const line = 'text-2xs text-terminal-text-dim px-3 py-1.5 border-b border-terminal-border/50 flex items-center gap-2 flex-wrap'
  const btn = 'text-2xs font-bold tracking-wide border border-terminal-gold/50 text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-1.5 py-0.5 transition-colors disabled:opacity-40'

  if (!user) return <div className={line} data-portfolio-sync="device">Saved on this device only. Sign in to keep a copy in your account.</div>
  if (failed) return <div className={line} data-portfolio-sync="error">Saved on this device. Your account copy could not be read just now.</div>
  if (account == null) return null

  const { onlyDevice, onlyAccount, same } = compareHoldings(holdings, account)

  const confirm = async () => {
    setBusy(true)
    try {
      if (pending.kind === 'save') await addHoldingsToAccount(supabase, user.id, pending.items)
      if (pending.kind === 'remove') await removeHoldingsFromAccount(supabase, user.id, pending.items)
      if (pending.kind === 'load') onLoad(pending.items)
      setAccount(await readAccountHoldings(supabase, user.id))
      setDone(pending.kind === 'load' ? `Added ${n(pending.items.length, 'holding')} to this device.` : pending.kind === 'save' ? `Saved ${n(pending.items.length, 'holding')} to your account.` : `Removed ${n(pending.items.length, 'holding')} from your account.`)
    } catch {
      setDone('That did not go through. Nothing was changed on this device; try again.')
    } finally {
      setBusy(false); setPending(null)
    }
  }

  if (pending) {
    const what = {
      save: `Add ${n(pending.items.length, 'holding')} to your account: ${list(pending.items)}. Nothing already in your account is changed or removed.`,
      load: `Add ${n(pending.items.length, 'holding')} from your account to this device: ${list(pending.items)}. Nothing on this device is removed.`,
      remove: `Remove ${n(pending.items.length, 'holding')} from your account only: ${list(pending.items)}. This device keeps its holdings.`,
    }[pending.kind]
    return (
      <div className={line} role="alertdialog" aria-label="Confirm portfolio change" data-portfolio-confirm={pending.kind}>
        <span className="text-terminal-text">{what}</span>
        <button type="button" className={btn} onClick={confirm} disabled={busy}>{busy ? '…' : 'CONFIRM'}</button>
        <button type="button" className="text-2xs text-terminal-text-dim hover:text-terminal-text px-1" onClick={() => setPending(null)} disabled={busy}>CANCEL</button>
      </div>
    )
  }

  return (
    <div className={line} data-portfolio-sync={same ? 'same' : 'differs'}>
      {same ? <span>Saved on this device and in your account.</span> : (
        <>
          {onlyDevice.length > 0 && (
            <>
              <span>{onlyDevice.length === holdings.length ? 'Saved on this device only.' : `${n(onlyDevice.length, 'holding')} saved on this device only.`}</span>
              <button type="button" className={btn} onClick={() => { setDone(null); setPending({ kind: 'save', items: onlyDevice }) }}>SAVE TO MY ACCOUNT</button>
            </>
          )}
          {onlyAccount.length > 0 && (
            <>
              <span>Your account has {n(onlyAccount.length, 'holding')} not on this device.</span>
              <button type="button" className={btn} onClick={() => { setDone(null); setPending({ kind: 'load', items: onlyAccount }) }}>ADD TO THIS DEVICE</button>
              <button type="button" className="text-2xs text-terminal-text-dim hover:text-terminal-text underline" onClick={() => { setDone(null); setPending({ kind: 'remove', items: onlyAccount }) }}>remove from account</button>
            </>
          )}
        </>
      )}
      {done && <span className="text-terminal-text" role="status">{done}</span>}
    </div>
  )
}
