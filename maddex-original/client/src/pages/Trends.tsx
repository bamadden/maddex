import MarketOverviewCard from "@/components/MarketOverviewCard";
import SectorRadarChart from "@/components/SectorRadarChart";
import GaugeChart from "@/components/GaugeChart";
import AIInsightCard from "@/components/AIInsightCard";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function Trends() {
  const marketOverview = [
    { name: "S&P 500", symbol: "SPX", value: "4,783.45", change: 23.45, changePercent: 0.49 },
    { name: "NASDAQ", symbol: "NDX", value: "16,825.93", change: 118.67, changePercent: 0.71 },
    { name: "Bitcoin", symbol: "BTC", value: "$43,250", change: 892.30, changePercent: 2.1 },
    { name: "Gold", symbol: "XAU", value: "$2,048.50", change: -12.30, changePercent: -0.60 },
  ];

  const sectorData = {
    labels: ['Tech', 'Energy', 'Finance', 'Healthcare', 'Crypto'],
    values: [85, 62, 78, 71, 68],
  };

  const topMovers = [
    { name: "NVIDIA", symbol: "NVDA", change: 6.4, price: "$892.50" },
    { name: "Bitcoin", symbol: "BTC", change: 2.1, price: "$43,250" },
    { name: "BHP Group", symbol: "BHP", change: -3.1, price: "$42.80" },
  ];

  return (
    <div className="space-y-6" data-testid="page-trends">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Market Trends</h2>
        <p className="text-sm text-muted-foreground">Real-time market analysis and insights</p>
      </div>

      <AIInsightCard
        title="Market Trend Analysis"
        insight="Tech sector leading market gains driven by AI chip demand. NASDAQ outperforming S&P 500. Crypto showing strong momentum with institutional adoption increasing. Energy sector maintaining stability."
        confidence={89}
        tags={["Tech Rally", "Crypto Bullish", "Market Momentum"]}
      />

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Market Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          {marketOverview.map((market) => (
            <MarketOverviewCard key={market.symbol} {...market} />
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Sector Strength</h3>
          <div className="flex items-center gap-1 text-xs text-primary">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-semibold">Live AI Analysis</span>
          </div>
        </div>
        <SectorRadarChart data={sectorData} />
        <p className="text-sm text-muted-foreground text-center mt-4">
          AI Insight: Technology sector showing exceptional strength (85/100)
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Top Movers</h3>
          <div className="space-y-4">
            {topMovers.map((mover) => {
              const isPositive = mover.change >= 0;
              return (
                <div 
                  key={mover.symbol} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary hover-elevate active-elevate-2 transition-all"
                  data-testid={`top-mover-${mover.symbol.toLowerCase()}`}
                >
                  <div>
                    <p className="font-semibold text-foreground">{mover.name}</p>
                    <p className="text-sm text-muted-foreground">{mover.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{mover.price}</p>
                    <div className={`flex items-center gap-1 justify-end ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">
                        {isPositive ? "+" : ""}{mover.change}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <GaugeChart
          value={56}
          max={100}
          label="Crypto Momentum Index"
          subtitle="Mildly Bullish"
        />
      </div>
    </div>
  );
}
