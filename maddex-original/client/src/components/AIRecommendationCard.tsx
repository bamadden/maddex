import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface AIRecommendationCardProps {
  symbol: string;
  name: string;
  confidence: number;
  recommendation: "Buy" | "Sell" | "Hold";
  price: string;
  change: number;
  onClick?: () => void;
}

export default function AIRecommendationCard({
  symbol,
  name,
  confidence,
  recommendation,
  price,
  change,
  onClick,
}: AIRecommendationCardProps) {
  const isPositive = change >= 0;
  
  return (
    <Card 
      className="p-6 hover-elevate active-elevate-2 transition-all cursor-pointer relative overflow-hidden"
      style={{
        boxShadow: "0 0 20px rgba(40, 123, 255, 0.2)",
        border: "1px solid rgba(40, 123, 255, 0.3)",
      }}
      onClick={onClick}
      data-testid={`ai-recommendation-${symbol.toLowerCase()}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10" />
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">{symbol}</h3>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
        <Badge variant={recommendation === "Buy" ? "default" : recommendation === "Sell" ? "destructive" : "secondary"}>
          {recommendation}
        </Badge>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AI Confidence</span>
          <span className="text-sm font-semibold text-primary">{confidence}%</span>
        </div>
        
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${confidence}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <span className="text-2xl font-bold text-foreground">{price}</span>
          <div className={`flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-sm font-semibold">{isPositive ? "+" : ""}{change.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
