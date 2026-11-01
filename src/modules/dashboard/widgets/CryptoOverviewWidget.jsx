import { useEffect, useState } from 'react'
import DataBadge from '../../../components/ui/DataBadge'
import { liveDataService } from '../../../services/liveDataService'
import {WidgetBody, WidgetRows, WidgetRow, WidgetEmpty} from './_shared'
import { goModule } from './navigate'

const COINS = [['bitcoin', 'BTC'], ['ethereum', 'ETH'], ['ripple', 'XRP'], ['solana', 'SOL'], ['cardano', 'ADA']]

export default function CryptoOverviewWidget() {
  const [prices, setPrices] = useState(null)
  const [meta, setMeta] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    liveDataService.getCryptoPrices()
      .then(({ data, source, meta: m }) => { if (alive) { if (data) { setPrices(data); setMeta({ source, ...m }) } else setFailed(true) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) return <WidgetEmpty action="OPEN CRYPTO" onAction={() => goModule('crypto')}>Crypto feed unavailable</WidgetEmpty>
  if (!prices) return <WidgetBody />

  const money = (n) => (n >= 1000 ? `A$${Math.round(n).toLocaleString()}` : `A$${n?.toFixed(2)}`)

  return (
    <WidgetBody>
      <WidgetRows>
        {COINS.map(([id, sym]) => {
          const c = prices[id]
          return (
            <WidgetRow
              key={id}
              label={sym}
              value={c?.aud != null ? money(c.aud) : '—'}
              change={c?.aud_24h_change ?? null}
              onClick={() => goModule('crypto')}
            />
          )
        })}
      </WidgetRows>
      {/* The shared crypto snapshot: its provider and fetch time. */}
      {meta && <div className="mt-1"><DataBadge cls={meta.source === 'stale' ? 'STALE' : 'LIVE'} source={meta.provider} at={meta.at ?? null} /></div>}
    </WidgetBody>
  )
}
