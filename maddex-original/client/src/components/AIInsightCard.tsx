import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface AIInsightCardProps {
  title: string;
  insight: string;
  confidence: number;
  tags?: string[];
}

export default function AIInsightCard({ title, insight, confidence, tags }: AIInsightCardProps) {
  return (
    <Card 
      className="p-4 relative overflow-hidden"
      style={{
        boxShadow: "0 0 20px rgba(40, 123, 255, 0.15)",
        border: "1px solid rgba(40, 123, 255, 0.2)",
      }}
      data-testid="ai-insight-card"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10" />
      
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <div className="flex items-center gap-1 text-xs text-primary">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="font-semibold">{confidence}% Confidence</span>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
          
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
