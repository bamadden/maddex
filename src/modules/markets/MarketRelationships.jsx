import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFxHistory, fetchCoinHistory } from '../../services/api'
import { fetchAu10y } from '../../services/bondHistory'
import {
  SERIES, PAIRS, NOT_COMPUTED, WINDOW,
  fromFrankfurter, fromCoinGecko, fromF2, correlate, strength, explain,
} from '../../services/marketRelationships'

// MARKET RELATIONSHIPS — measured correlations between the real daily series
// this build can reach (services/marketRelationships). A matrix for the shape,
// then the pairs that matter to an Australian investor in plain English.

const COINS = { GOLD: 'pax-gold', BTC: 'bitcoin', ETH: 'ethereum' }

// Green for moving together, red for opposite, grey near zero.
function cellColour(r) {
  if (r == null) return 'rgba(99,120,153,0.08)'
  const a = Math.min(1, Math.abs(r))
  if (Math.abs(r) < 0.2) return `rgba(99,120,153,${0.12 + a * 0.4})`
  return r > 0 ? `rgba(45,138,80,${0.18 + a * 0.6})` : `rgba(204,68,68,${0.18 + a * 0.6})`
}

function useSeries() {
  const fx = useQuery({ queryKey: ['relFx'], queryFn: () => fetchFxHistory('AUD', 'USD', 140), staleTime: 6 * 3600_000, retry: 1 })
  const coins = useQuery({
    queryKey: ['relCoins'],
    queryFn: async () => {
      const out = {}
      for (const [id, cg] of Object.entries(COINS)) {
        try { out[id] = await fetchCoinHistory(cg, 'usd', 180) } catch { out[id] = null }
      }
      return out
    },
    staleTime: 6 * 3600_000,
    retry: 1,
  })
  const bond = useQuery({ queryKey: ['au10yF2'], queryFn: () => fetchAu10y(), staleTime: 12 * 3600_000, retry: 1 })
  const series = useMemo(() => {
    const m = {}
    if (fx.data) m.AUDUSD = fromFrankfurter(fx.data)
    for (const id of Object.keys(COINS)) if (coins.data?.[id]) m[id] = fromCoinGecko(coins.data[id])
    if (bond.data?.yields) m.AU10Y = fromF2(bond.data.yields)
    return m
  }, [fx.data, coins.data, bond.data])
  return { series, loading: fx.isLoading || coins.isLoading || bond.isLoading }
}

export default function MarketRelationships() {
  const { series, loading } = useSeries()
  const kind = Object.fromEntries(SERIES.map((s) => [s.id, s.kind]))
  const corr = useMemo(() => {
    const out = {}
    for (const x of SERIES) for (const y of SERIES) {
      if (x.id >= y.id) continue
      const c = correlate(series[x.id], series[y.id], kind[x.id], kind[y.id])
      out[`${x.id}|${y.id}`] = c
      out[`${y.id}|${x.id}`] = c
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series])
  const span = Object.values(corr).find(Boolean)
  const available = SERIES.filter((s) => series[s.id]?.size)

  return (
    <div className="border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span>MARKET RELATIONSHIPS</span>
        <span className="text-2xs font-normal normal-case text-terminal-text-dim/60">
          correlation of daily changes · last {WINDOW} shared days{span ? ` (${span.from} → ${span.to})` : ''} · real series only
        </span>
        {loading && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING…</span>}
      </div>

      <div className="flex flex-col xl:flex-row">
        {/* Matrix */}
        <div className="p-3 flex-shrink-0 border-b xl:border-b-0 xl:border-r border-terminal-border">
          <table className="font-mono" style={{ fontSize: 9, borderCollapse: 'separate', borderSpacing: 2 }}>
            <thead>
              <tr>
                <th />
                {SERIES.map((s) => <th key={s.id} className="text-terminal-text-dim font-normal px-1 pb-1 whitespace-nowrap">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {SERIES.map((row) => (
                <tr key={row.id}>
                  <th className="text-right text-terminal-text-dim font-normal pr-1.5 whitespace-nowrap">{row.label}</th>
                  {SERIES.map((col) => {
                    if (row.id === col.id) return <td key={col.id} className="text-center text-terminal-text-dim/40" style={{ width: 52, height: 30, background: 'rgba(99,120,153,0.06)' }}>—</td>
                    const c = corr[`${row.id}|${col.id}`]
                    return (
                      <td key={col.id}
                        className="text-center tabular-nums font-bold"
                        title={c ? `${row.label} vs ${col.label}: ${c.r.toFixed(2)} (${strength(c.r).toLowerCase()}, ${c.n} days)` : 'Not enough shared history'}
                        style={{ width: 52, height: 30, background: cellColour(c?.r), color: c ? '#E8EDF5' : '#4A6080' }}>
                        {c ? `${c.r >= 0 ? '+' : ''}${c.r.toFixed(2)}` : '…'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-2 font-mono text-terminal-text-dim/70" style={{ fontSize: 8 }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5" style={{ background: cellColour(0.8) }} /> together</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5" style={{ background: cellColour(-0.8) }} /> opposite</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5" style={{ background: cellColour(0.05) }} /> unrelated</span>
          </div>
          <div className="font-mono text-terminal-text-dim/50 mt-1.5 leading-snug" style={{ fontSize: 8, maxWidth: 300 }}>
            Sources: {available.map((s) => `${s.label} — ${s.source}`).join('; ') || 'loading'}.
          </div>
        </div>

        {/* Plain English */}
        <div className="flex-1 min-w-0 p-3 space-y-2">
          {PAIRS.map((p) => {
            const c = corr[`${p.a}|${p.b}`]
            const tone = c == null ? '#4A6080' : Math.abs(c.r) < 0.2 ? '#8BA3C4' : c.r > 0 ? '#2D8A50' : '#CC4444'
            return (
              <div key={p.title} className="flex gap-3 items-start">
                <div className="w-[118px] flex-shrink-0">
                  <div className="font-mono text-terminal-text-bright font-bold" style={{ fontSize: 10 }}>{p.title}</div>
                  <div className="font-mono font-bold tabular-nums" style={{ fontSize: 13, color: tone }}>
                    {c ? `${c.r >= 0 ? '+' : ''}${c.r.toFixed(2)}` : '…'}
                    {c && <span className="ml-1.5 tracking-wider" style={{ fontSize: 7 }}>{strength(c.r)}</span>}
                  </div>
                </div>
                <p className="text-2xs text-terminal-text-dim leading-snug flex-1">{c ? explain(p, c.r) : loading ? 'Loading…' : 'Not enough shared history to measure.'}</p>
              </div>
            )
          })}
          <div className="pt-2 border-t border-terminal-border/40 space-y-1">
            <div className="font-mono text-terminal-text-dim/60 tracking-widest" style={{ fontSize: 8 }}>NOT COMPUTED — NO REAL DAILY SERIES IN THIS BUILD</div>
            {NOT_COMPUTED.map((n) => (
              <div key={n.title} className="text-2xs leading-snug">
                <span className="text-terminal-text-dim font-bold">{n.title}: </span>
                <span className="text-terminal-text-dim/70">{n.why}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-terminal-text-dim/50 leading-snug">
            Correlation describes the past {WINDOW} days, not a law — relationships shift, especially around central-bank decisions. General information, not advice.
          </div>
        </div>
      </div>
    </div>
  )
}
