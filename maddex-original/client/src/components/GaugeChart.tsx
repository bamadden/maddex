import { Card } from "@/components/ui/card";

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  subtitle: string;
}

export default function GaugeChart({ value, max, label, subtitle }: GaugeChartProps) {
  const percentage = (value / max) * 100;
  const rotation = (percentage / 100) * 180 - 90;
  
  const getColor = () => {
    if (percentage < 33) return "text-red-500";
    if (percentage < 66) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <Card className="p-6" data-testid="gauge-chart">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground mb-1">{label}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        
        <div className="relative w-48 h-24 mx-auto">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <path
              d="M 20 80 A 80 80 0 0 1 180 80"
              fill="none"
              stroke="hsl(220, 30%, 20%)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 20 80 A 80 80 0 0 1 180 80"
              fill="none"
              stroke="hsl(217, 100%, 58%)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 2.51} 251`}
            />
            <circle cx="100" cy="80" r="6" fill="hsl(0, 0%, 100%)" />
            <line
              x1="100"
              y1="80"
              x2="100"
              y2="20"
              stroke="hsl(0, 0%, 100%)"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${rotation} 100 80)`}
            />
          </svg>
        </div>
        
        <div className="text-center">
          <p className={`text-4xl font-bold ${getColor()}`}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1">out of {max}</p>
        </div>
      </div>
    </Card>
  );
}
