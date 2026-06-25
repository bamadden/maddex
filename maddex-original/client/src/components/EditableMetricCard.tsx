import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LucideIcon, Edit2, Check, X } from "lucide-react";

interface EditableMetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  onValueChange?: (newValue: string) => void;
  aiConfidence?: number;
  aiInsight?: string;
}

export default function EditableMetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  onValueChange,
  aiConfidence,
  aiInsight
}: EditableMetricCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onValueChange?.(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <Card className="p-4 hover-elevate active-elevate-2 transition-all cursor-pointer group relative" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {aiConfidence && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-primary">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="font-semibold">{aiConfidence}% AI</span>
        </div>
      )}
      
      <div className="flex items-start justify-between">
        <div className="flex-1 pt-6">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          {isEditing ? (
            <div className="flex gap-2 items-center mt-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 text-lg font-bold"
                data-testid={`input-edit-${title.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <Button size="icon" variant="ghost" onClick={handleSave} className="h-8 w-8" data-testid="button-save">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={handleCancel} className="h-8 w-8" data-testid="button-cancel">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-foreground">{value}</p>
              {onValueChange && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid="button-edit"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
          {trend !== undefined && (
            <p className={`text-xs mt-1 ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}{trend.toFixed(2)}%
            </p>
          )}
          {aiInsight && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{aiInsight}</p>
          )}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
