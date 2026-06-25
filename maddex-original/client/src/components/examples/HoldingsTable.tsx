import HoldingsTable from '../HoldingsTable';

export default function HoldingsTableExample() {
  const mockHoldings = [
    { asset: "NVIDIA Corporation", symbol: "NVDA", value: "$44,625", change: 6.4, aiSentiment: "Bullish" as const },
    { asset: "Bitcoin", symbol: "BTC", value: "$32,790", change: 2.1, aiSentiment: "Bullish" as const },
    { asset: "Apple Inc.", symbol: "AAPL", value: "$28,450", change: 1.2, aiSentiment: "Neutral" as const },
    { asset: "BHP Group", symbol: "BHP", value: "$12,340", change: -3.1, aiSentiment: "Bearish" as const },
  ];

  return (
    <div className="p-4">
      <HoldingsTable holdings={mockHoldings} />
    </div>
  );
}
