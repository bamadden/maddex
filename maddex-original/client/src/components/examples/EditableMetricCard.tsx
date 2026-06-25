import { useState } from 'react';
import EditableMetricCard from '../EditableMetricCard';
import { DollarSign } from 'lucide-react';

export default function EditableMetricCardExample() {
  const [value, setValue] = useState("$8,450");
  
  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <EditableMetricCard 
        title="Cash" 
        value={value}
        icon={DollarSign}
        onValueChange={setValue}
        aiConfidence={92}
        aiInsight="Optimal liquidity level maintained"
      />
      <EditableMetricCard 
        title="Top Gainer" 
        value="NVDA" 
        icon={DollarSign} 
        trend={6.4}
        aiConfidence={88}
        aiInsight="Strong momentum in semiconductor sector"
      />
    </div>
  );
}
