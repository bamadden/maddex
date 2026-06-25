import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Holding {
  asset: string;
  symbol: string;
  value: string;
  change: number;
  aiSentiment: "Bullish" | "Bearish" | "Neutral";
}

interface HoldingsTableProps {
  holdings: Holding[];
}

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <div className="overflow-x-auto" data-testid="holdings-table">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-sm font-semibold text-foreground p-3">Asset</th>
            <th className="text-right text-sm font-semibold text-foreground p-3">Value</th>
            <th className="text-right text-sm font-semibold text-foreground p-3">Change</th>
            <th className="text-center text-sm font-semibold text-foreground p-3">AI Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding, index) => {
            const isPositive = holding.change >= 0;
            return (
              <tr 
                key={index} 
                className="border-b border-border/50 hover-elevate active-elevate-2 transition-all"
                data-testid={`holding-row-${holding.symbol.toLowerCase()}`}
              >
                <td className="p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{holding.asset}</p>
                    <p className="text-xs text-muted-foreground">{holding.symbol}</p>
                  </div>
                </td>
                <td className="text-right p-3">
                  <p className="text-sm font-semibold text-foreground">{holding.value}</p>
                </td>
                <td className="text-right p-3">
                  <div className={`flex items-center justify-end gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-sm font-semibold">
                      {isPositive ? "+" : ""}{holding.change.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="text-center p-3">
                  <Badge 
                    variant={
                      holding.aiSentiment === "Bullish" 
                        ? "default" 
                        : holding.aiSentiment === "Bearish" 
                        ? "destructive" 
                        : "secondary"
                    }
                  >
                    {holding.aiSentiment}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
