import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PortfolioPieChart from "@/components/PortfolioPieChart";
import HoldingsTable from "@/components/HoldingsTable";
import AIInsightCard from "@/components/AIInsightCard";
import WatchlistButton from "@/components/WatchlistButton";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState("holdings");
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("watchlist", []);
  const { toast } = useToast();

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const allocationData = {
    labels: ['Equities', 'Crypto', 'Cash', 'Bonds', 'Alternatives'],
    values: [56, 22, 7, 9, 6],
  };

  const holdings = [
    { asset: "NVIDIA Corporation", symbol: "NVDA", value: "$44,625", change: 6.4, aiSentiment: "Bullish" as const },
    { asset: "Bitcoin", symbol: "BTC", value: "$32,790", change: 2.1, aiSentiment: "Bullish" as const },
    { asset: "Apple Inc.", symbol: "AAPL", value: "$28,450", change: 1.2, aiSentiment: "Neutral" as const },
    { asset: "Microsoft Corporation", symbol: "MSFT", value: "$21,340", change: 0.8, aiSentiment: "Bullish" as const },
    { asset: "BHP Group", symbol: "BHP", value: "$12,340", change: -3.1, aiSentiment: "Bearish" as const },
  ];

  const watchlistAssets = [
    { asset: "Tesla Inc.", symbol: "TSLA", value: "$245.30", change: -2.4, aiSentiment: "Neutral" as const },
    { asset: "Ethereum", symbol: "ETH", value: "$2,340", change: 3.5, aiSentiment: "Bullish" as const },
    { asset: "Amazon.com Inc.", symbol: "AMZN", value: "$178.90", change: 1.1, aiSentiment: "Bullish" as const },
    { asset: "NVIDIA Corporation", symbol: "NVDA", value: "$892.50", change: 6.4, aiSentiment: "Bullish" as const },
    { asset: "Bitcoin", symbol: "BTC", value: "$43,250", change: 2.1, aiSentiment: "Bullish" as const },
    { asset: "Australian Dollar", symbol: "AUD/USD", value: "$0.6542", change: -1.3, aiSentiment: "Bearish" as const },
  ];

  const watchlistData = watchlistAssets.filter(asset => watchlist.includes(asset.symbol));

  return (
    <div className="space-y-6" data-testid="page-portfolio">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Portfolio</h2>
          <p className="text-sm text-muted-foreground">Track your investments and watchlist</p>
        </div>
        <Button 
          onClick={() => toast({ title: "Feature coming soon", description: "Add new asset to portfolio" })}
          data-testid="button-add-asset"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      <AIInsightCard
        title="Portfolio Performance Analysis"
        insight="Your portfolio is well-diversified across sectors. Current allocation shows strong bias toward growth stocks. Consider rebalancing if tech sector exceeds 60% allocation."
        confidence={91}
        tags={["Well Diversified", "Growth Focus", "Moderate Risk"]}
      />

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Asset Allocation</h3>
          <div className="flex items-center gap-1 text-xs text-primary">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="font-semibold">AI Optimized</span>
          </div>
        </div>
        <PortfolioPieChart data={allocationData} />
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
          <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
        </TabsList>
        
        <TabsContent value="holdings" className="mt-6">
          <Card className="p-6">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Click on any row to view detailed analytics and AI insights
              </p>
            </div>
            <HoldingsTable holdings={holdings} />
          </Card>
        </TabsContent>
        
        <TabsContent value="watchlist" className="mt-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {watchlist.length === 0 ? "No items in watchlist" : `Tracking ${watchlist.length} assets`}
              </p>
              {watchlist.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setWatchlist([])}
                  data-testid="button-clear-watchlist"
                >
                  Clear All
                </Button>
              )}
            </div>
            {watchlist.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Your watchlist is empty</p>
                <p className="text-sm text-muted-foreground">Add assets from the AI recommendations on the home page</p>
              </div>
            ) : (
              <HoldingsTable holdings={watchlistData} />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
