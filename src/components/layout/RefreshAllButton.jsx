import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshAllData } from '../../services/refreshAll'

// Apex only (TopBar mounts it for Apex); Core and Prime refresh on the normal
// schedule. See services/refreshAll for what a refresh touches.
export default function RefreshAllButton() {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ busy: false, at: null })

  const run = async () => {
    setState((s) => ({ ...s, busy: true }))
    const at = await refreshAllData(queryClient).catch(() => new Date())
    setState({ busy: false, at })
  }
  const done = state.at && !state.busy
  return (
    <button
      onClick={run}
      disabled={state.busy}
      title="Refresh FX, crypto, Fear & Greed, DeFi TVL, news and the official statistics check now"
      className="text-[10px] font-mono whitespace-nowrap flex-shrink-0 text-terminal-text-dim hover:text-terminal-gold disabled:opacity-70 transition-colors"
    >
      {state.busy ? '↻ Refreshing…'
        : done ? <span className="text-terminal-green">Complete ✓ {state.at.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        : '↻ REFRESH ALL'}
    </button>
  )
}
