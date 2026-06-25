import AIInsightCard from '../AIInsightCard';

export default function AIInsightCardExample() {
  return (
    <div className="p-4">
      <AIInsightCard
        title="Daily Market Insight"
        insight="Tech sector showing strong momentum with AI-driven stocks leading gains. Portfolio positioned well to capitalize on current trends. Consider increasing exposure to semiconductor ETFs."
        confidence={87}
        tags={["Tech Rally", "Growth Opportunity", "Low Risk"]}
      />
    </div>
  );
}
