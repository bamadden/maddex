import MarketOverviewCard from '../MarketOverviewCard';

export default function MarketOverviewCardExample() {
  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <MarketOverviewCard
        name="S&P 500"
        symbol="SPX"
        value="4,783.45"
        change={23.45}
        changePercent={0.49}
      />
      <MarketOverviewCard
        name="Bitcoin"
        symbol="BTC"
        value="$43,250"
        change={892.30}
        changePercent={2.1}
      />
    </div>
  );
}
