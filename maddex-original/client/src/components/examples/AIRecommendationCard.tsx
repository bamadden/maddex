import AIRecommendationCard from '../AIRecommendationCard';

export default function AIRecommendationCardExample() {
  return (
    <div className="p-4 grid gap-4 md:grid-cols-3">
      <AIRecommendationCard
        symbol="NVDA"
        name="NVIDIA Corporation"
        confidence={82}
        recommendation="Buy"
        price="$892.50"
        change={6.4}
        onClick={() => console.log('NVDA clicked')}
      />
      <AIRecommendationCard
        symbol="BTC"
        name="Bitcoin"
        confidence={75}
        recommendation="Hold"
        price="$43,250"
        change={2.1}
        onClick={() => console.log('BTC clicked')}
      />
      <AIRecommendationCard
        symbol="AUD/USD"
        name="Australian Dollar"
        confidence={68}
        recommendation="Sell"
        price="$0.6542"
        change={-1.3}
        onClick={() => console.log('AUD/USD clicked')}
      />
    </div>
  );
}
