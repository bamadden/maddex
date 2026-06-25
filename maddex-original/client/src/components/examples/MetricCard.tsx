import MetricCard from '../MetricCard';
import { DollarSign } from 'lucide-react';

export default function MetricCardExample() {
  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <MetricCard title="Cash" value="$8,450" icon={DollarSign} />
      <MetricCard title="Top Gainer" value="NVDA" icon={DollarSign} trend={6.4} />
    </div>
  );
}
