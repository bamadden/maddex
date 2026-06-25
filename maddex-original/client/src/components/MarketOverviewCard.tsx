import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketOverviewCardProps {
  name: string;
  symbol: string;
  value: string;
  change: number;
  changePercent: number;
}

export default function MarketOverviewCard({
  name,
  symbol,
  value,
  change,
  changePercent,
}: MarketOverviewCardProps) {
  const isPositive = change >= 0;

  return (
    <Card className="p-6 hover-elevate active-elevate-2 transition-all" data-testid={`market-${symbol.toLowerCase()}`}>
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <p className="text-xs text-muted-foreground">{symbol}</p>
        </div>
        
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <div className={`flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-sm font-semibold">
              {isPositive ? "+" : ""}{change.toFixed(2)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
