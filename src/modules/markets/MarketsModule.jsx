import { useState } from 'react'
import IndicesTable from './IndicesTable'
import SectorHeatmap from './SectorHeatmap'
import SectorStrengthRadar from './SectorStrengthRadar'
import TopMovers from './TopMovers'
import MarketSentimentBanner from './MarketSentimentBanner'
import MarketBreadth from './MarketBreadth'
import SectorRotation from './SectorRotation'
import EarningsCalendar from './EarningsCalendar'
import { useStore } from '../../store/useStore'
import ModuleHeader from '../../components/ui/ModuleHeader'

export default function MarketsModule() {
  const { openModal } = useStore()
  const [selectedIndex, setSelectedIndex] = useState('^AXJO')

  return (
    <div
      id="markets-scroll-container"
      className="h-full overflow-y-auto"
    >
      <div className="flex flex-col min-h-full">
        <ModuleHeader title="MARKETS" subtitle="ASX 200 · S&P 500 · Global Equities" moduleId="markets" />

        {/* Global sentiment score */}
        <div className="flex-shrink-0">
          <MarketSentimentBanner />
        </div>

        {/* Market breadth — advances/declines/A-D ratio */}
        <MarketBreadth />

        {/* Indices — scrollable horizontal */}
        <div className="flex-shrink-0 border-b border-terminal-border">
          <IndicesTable
            openModal={openModal}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
          />
        </div>

        {/* ASX Movers + US Movers */}
        <div className="flex-shrink-0 border-b border-terminal-border">
          <TopMovers openModal={openModal} />
        </div>

        {/* Sector Heatmap / Index constituent list */}
        <div className="flex-shrink-0 border-b border-terminal-border">
          <SectorHeatmap
            selectedIndex={selectedIndex}
            openModal={openModal}
          />
        </div>

        {/* Sector Strength Radar — supplementary, below the main tables */}
        <div className="flex-shrink-0">
          <SectorStrengthRadar selectedIndex={selectedIndex} />
        </div>

        {/* Sector rotation snapshot */}
        <SectorRotation />

        {/* Upcoming ASX earnings */}
        <EarningsCalendar />
      </div>
    </div>
  )
}
