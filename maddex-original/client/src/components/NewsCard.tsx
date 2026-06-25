import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface NewsCardProps {
  headline: string;
  timestamp: string;
  impact: "High" | "Medium" | "Low";
  category: string;
  onClick?: () => void;
}

export default function NewsCard({ headline, timestamp, impact, category, onClick }: NewsCardProps) {
  const impactColors = {
    High: "bg-red-500/20 text-red-500 border-red-500/30",
    Medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    Low: "bg-green-500/20 text-green-500 border-green-500/30",
  };
  
  return (
    <Card 
      className="p-4 hover-elevate active-elevate-2 transition-all cursor-pointer"
      onClick={onClick}
      data-testid={`news-${headline.slice(0, 20).toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{category}</Badge>
            <Badge className={`text-xs ${impactColors[impact]}`}>
              {impact} Impact
            </Badge>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{headline}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timestamp}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
