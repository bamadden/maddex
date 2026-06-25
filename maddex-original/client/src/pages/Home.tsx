import { useState } from "react";
import { Card } from "@/components/ui/card";
import EditableMetricCard from "@/components/EditableMetricCard";
import AIRecommendationCard from "@/components/AIRecommendationCard";
import NewsCard from "@/components/NewsCard";
import AIInsightCard from "@/components/AIInsightCard";
import WatchlistButton from "@/components/WatchlistButton";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { DollarSign, TrendingUp, TrendingDown, Bell } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("watchlist", []);

  const [portfolioValue, setPortfolioValue] = useState(126780);
  const portfolioChange = 1.3;

  const [metrics, setMetrics] = useState([
    { title: "Cash", value: "$8,450", icon: DollarSign, aiConfidence: 92, aiInsight: "Optimal liquidity level maintained" },
    { title: "Top Gainer", value: "NVDA", icon: TrendingUp, trend: 6.4, aiConfidence: 88, aiInsight: "Strong momentum in semiconductor sector" },
    { title: "Top Loser", value: "BHP", icon: TrendingDown, trend: -3.1, aiConfidence: 75, aiInsight: "Temporary dip, fundamentals remain solid" },
    { title: "AI Alerts", value: "2", icon: Bell, aiConfidence: 95, aiInsight: "Portfolio rebalancing recommended" },
  ]);

  const handleMetricChange = (title: string, newValue: string) => {
    setMetrics(prev => 
      prev.map(m => m.title === title ? { ...m, value: newValue } : m)
    );
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const aiRecommendations = [
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      confidence: 82,
      recommendation: "Buy" as const,
      price: "$892.50",
      change: 6.4,
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      confidence: 75,
      recommendation: "Hold" as const,
      price: "$43,250",
      change: 2.1,
    },
    {
      symbol: "AUD/USD",
      name: "Australian Dollar",
      confidence: 68,
      recommendation: "Sell" as const,
      price: "$0.6542",
      change: -1.3,
    },
  ];

  const newsHeadlines = [
    {
      headline: "Fed signals potential rate cuts in Q2 2025 amid cooling inflation",
      timestamp: "2 hours ago",
      impact: "High" as const,
      category: "Economics",
    },
    {
      headline: "Tech sector rallies as AI chip demand surges to record highs",
      timestamp: "5 hours ago",
      impact: "Medium" as const,
      category: "Technology",
    },
    {
      headline: "Cryptocurrency market cap surpasses $2 trillion milestone",
      timestamp: "8 hours ago",
      impact: "High" as const,
      category: "Crypto",
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-home">
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <div className="flex items-center gap-1 text-xs text-primary">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="font-semibold">94% AI Confidence</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl font-bold text-foreground">
              ${portfolioValue.toLocaleString()}
            </h2>
            <span className={`text-lg font-semibold ${portfolioChange >= 0 ? "text-green-500" : "text-red-500"}`}>
              {portfolioChange >= 0 ? "+" : ""}{portfolioChange}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">AI Analysis: Strong diversification with growth potential</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <EditableMetricCard 
            key={metric.title} 
            {...metric}
            onValueChange={(newValue) => handleMetricChange(metric.title, newValue)}
          />
        ))}
      </div>

      <AIInsightCard
        title="Daily Market Insight"
        insight="Tech sector showing strong momentum with AI-driven stocks leading gains. Portfolio positioned well to capitalize on current trends. Consider increasing exposure to semiconductor ETFs."
        confidence={87}
        tags={["Tech Rally", "Growth Opportunity", "Low Risk"]}
      />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">AI Recommendations</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {aiRecommendations.map((rec) => (
            <div key={rec.symbol} className="space-y-3">
              <AIRecommendationCard
                {...rec}
                onClick={() => setLocation("/trends")}
              />
              <WatchlistButton
                symbol={rec.symbol}
                isInWatchlist={watchlist.includes(rec.symbol)}
                onToggle={toggleWatchlist}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">Latest News</h3>
        </div>
        <div className="space-y-3">
          {newsHeadlines.map((news, index) => (
            <NewsCard
              key={index}
              {...news}
              onClick={() => setLocation("/news")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
