import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../../data/verifiedConstants'
import { liveDataService } from '../../../services/liveDataService'
import { LiveBadge, HandEnteredBadge } from '../../../components/ui/VerifiedBadge'
import { WidgetBody, WidgetRows, WidgetRow } from './_shared'

// Gold is live; Brent and WTI are the EIA's dated spot prices. Iron ore,
// copper and coal have no licensed feed, so the widget says so instead.
// The two are labelled differently rather than blended, so a reader can tell
// which number moved this morning and which was checked last week.
const C = VERIFIED_CONSTANTS.commodities

export default function CommodityWidget() {
  const [gold, setGold] = useState(null)
  const [source, setSource] = useState('failed')
  const [at, setAt] = useState(null)

  useEffect(() => {
    let alive = true
    liveDataService.getGoldPrice()
      .then(({ data, source: s, at: t }) => { if (alive && data) { setGold(data); setSource(s); setAt(t ?? null) } })
      .catch(() => { /* row is simply omitted */ })
    return () => { alive = false }
  }, [])

  return (
    <WidgetBody>
      <div className="flex items-center justify-end gap-1.5 flex-shrink-0 mb-1">
        {gold && <LiveBadge label="PAXG gold proxy · CoinGecko" source={source} at={at} />}
        <HandEnteredBadge dataKey="commodities" />
      </div>
      <WidgetRows>
        {gold && <WidgetRow label="GOLD" value={`US$${gold.USD.toLocaleString()}`} change={gold.change24h} />}
        {C.brentUSD != null && <WidgetRow label="BRENT (SPOT)" value={`US$${C.brentUSD.toFixed(2)}`} />}
        {C.wtiUSD != null && <WidgetRow label="WTI (SPOT)" value={`US$${C.wtiUSD.toFixed(2)}`} />}
      </WidgetRows>
      <div className="text-terminal-text-dim mt-1" style={{ fontSize: 11 }} data-commodities-not-shown>{C.notShown}</div>
    </WidgetBody>
  )
}
