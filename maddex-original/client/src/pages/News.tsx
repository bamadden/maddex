import NewsCard from "@/components/NewsCard";
import AIInsightCard from "@/components/AIInsightCard";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function News() {
  const [, setLocation] = useLocation();

  const highlights = [
    {
      headline: "Fed signals potential rate cuts in Q2 2025 amid cooling inflation",
      timestamp: "2 hours ago",
      impact: "High" as const,
      category: "Economics",
    },
    {
      headline: "AI revolution drives tech stocks to record highs, reshaping market dynamics",
      timestamp: "4 hours ago",
      impact: "High" as const,
      category: "Technology",
    },
    {
      headline: "Bitcoin ETF approval boosts institutional crypto adoption worldwide",
      timestamp: "6 hours ago",
      impact: "High" as const,
      category: "Crypto",
    },
  ];

  const newsItems = [
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
    {
      headline: "Energy sector shows resilience amid global transition to renewables",
      timestamp: "10 hours ago",
      impact: "Medium" as const,
      category: "Energy",
    },
    {
      headline: "Healthcare stocks climb on breakthrough treatment approvals",
      timestamp: "12 hours ago",
      impact: "Low" as const,
      category: "Healthcare",
    },
    {
      headline: "Emerging markets attract record foreign investment in Q1",
      timestamp: "14 hours ago",
      impact: "Medium" as const,
      category: "Global Markets",
    },
    {
      headline: "Semiconductor shortage easing as new fabs come online",
      timestamp: "16 hours ago",
      impact: "Low" as const,
      category: "Technology",
    },
  ];

  const handleNewsClick = (headline: string) => {
    console.log(`Clicked news: ${headline}`);
    setLocation("/chat");
  };

  return (
    <div className="space-y-6" data-testid="page-news">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Market News</h2>
        <p className="text-sm text-muted-foreground">Stay updated with AI-powered insights</p>
      </div>

      <AIInsightCard
        title="AI News Summary"
        insight="Today's headlines suggest positive market sentiment with Fed rate cut signals and strong tech sector performance. Cryptocurrency adoption accelerating. Recommended action: Monitor tech stocks and consider crypto exposure."
        confidence={86}
        tags={["Bullish Sentiment", "Rate Cuts", "Tech Focus"]}
      />

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Today's Highlights</h3>
        <Card 
          className="p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.1) 100%)",
            border: "1px solid rgba(40, 123, 255, 0.2)",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
          <div className="space-y-4">
            {highlights.map((item, index) => (
              <NewsCard
                key={index}
                {...item}
                onClick={() => handleNewsClick(item.headline)}
              />
            ))}
          </div>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Latest Updates</h3>
        <div className="space-y-3">
          {newsItems.map((item, index) => (
            <NewsCard
              key={index}
              {...item}
              onClick={() => handleNewsClick(item.headline)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
