import { useState } from 'react'
import IndicesTable from './IndicesTable'
import SectorHeatmap from './SectorHeatmap'
import SectorStrengthRadar from './SectorStrengthRadar'
import TopMovers from './TopMovers'
import MarketSentimentBanner from './MarketSentimentBanner'
import { useStore } from '../../store/useStore'

export default function MarketsModule() {
  const { openModal } = useStore()
  const [selectedIndex, setSelectedIndex] = useState('^AXJO')

  return (
    <div className="h-full grid grid-rows-[auto_auto_auto_1fr_auto] gap-0 overflow-hidden">
      {/* Row 0: MaddenAI Market Sentiment Score */}
      <MarketSentimentBanner />

      {/* Row 1: Indices — scrollable horizontal */}
      <div className="border-b border-terminal-border flex-shrink-0">
        <IndicesTable
          openModal={openModal}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
        />
      </div>

      {/* Row 2: ASX Movers + US Movers */}
      <div className="border-b border-terminal-border flex-shrink-0">
        <TopMovers openModal={openModal} />
      </div>

      {/* Row 3: Sector Heatmap — fills remaining space */}
      <div className="min-h-0 overflow-hidden border-b border-terminal-border">
        <SectorHeatmap
          selectedIndex={selectedIndex}
          openModal={openModal}
        />
      </div>

      {/* Row 4: Sector Strength Radar */}
      <div className="min-h-0 overflow-hidden" style={{ height: '320px' }}>
        <SectorStrengthRadar />
      </div>
    </div>
  )
}
