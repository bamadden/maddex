import DataBadge from './DataBadge'

// The DEMO badge every sentiment score carries while its equity inputs are
// simulated (hooks/useMarketSentiment `demo`). Compact, so it shows at every
// screen width; the badge's tooltip and the legend explain the class.
export default function SentimentClass({ ms, className = '' }) {
  if (!ms?.sentiment || !ms.demo) return null
  return <DataBadge cls="DEMO" compact source="demo composite: simulated ASX and S&P 500 inputs" at={ms.asOf} className={className} />
}
