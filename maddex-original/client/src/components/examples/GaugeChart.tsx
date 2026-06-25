import GaugeChart from '../GaugeChart';

export default function GaugeChartExample() {
  return (
    <div className="p-4">
      <GaugeChart
        value={56}
        max={100}
        label="Crypto Momentum Index"
        subtitle="Mildly Bullish"
      />
    </div>
  );
}
