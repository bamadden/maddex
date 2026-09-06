import { useEffect, useState } from 'react'
import { VERIFIED_CONSTANTS } from '../../../data/verifiedConstants'
import { liveDataService } from '../../../services/liveDataService'
import VerifiedBadge, { LiveBadge } from '../../../components/ui/VerifiedBadge'
import { WidgetBody, WidgetRows, WidgetRow } from './_shared'

// Gold is genuinely live; the rest are verified levels with no free feed.
// The two are labelled differently rather than blended, so a reader can tell
// which number moved this morning and which was checked last week.
const C = VERIFIED_CONSTANTS.commodities

export default function CommodityWidget() {
  const [gold, setGold] = useState(null)
  const [source, setSource] = useState('failed')

  useEffect(() => {
    let alive = true
    liveDataService.getGoldPrice()
      .then(({ data, source: s }) => { if (alive && data) { setGold(data); setSource(s) } })
      .catch(() => { /* row is simply omitted */ })
    return () => { alive = false }
  }, [])

  return (
    <WidgetBody>
      <div className="flex items-center justify-end gap-1.5 flex-shrink-0 mb-1">
        {gold && <LiveBadge label="Gold — PAXG proxy via CoinGecko" source={source} />}
        <VerifiedBadge dataKey="commodities" />
      </div>
      <WidgetRows>
        {gold && <WidgetRow label="GOLD" value={`US$${gold.USD.toLocaleString()}`} change={gold.change24h} />}
        <WidgetRow label="IRON ORE" value={`US$${C.ironOreUSD}`} />
        <WidgetRow label="BRENT" value={`US$${C.brentUSD}`} />
        <WidgetRow label="COPPER" value={`US$${C.copperUSDPerLb}`} />
        <WidgetRow label="COAL" value={`US$${C.thermalCoalUSD}`} />
      </WidgetRows>
    </WidgetBody>
  )
}
