import NewsCard from '../NewsCard';

export default function NewsCardExample() {
  return (
    <div className="p-4 space-y-4">
      <NewsCard
        headline="Fed signals potential rate cuts in Q2 2025 amid cooling inflation"
        timestamp="2 hours ago"
        impact="High"
        category="Economics"
        onClick={() => console.log('News clicked')}
      />
      <NewsCard
        headline="Tech sector rallies as AI chip demand surges to record highs"
        timestamp="5 hours ago"
        impact="Medium"
        category="Technology"
        onClick={() => console.log('News clicked')}
      />
    </div>
  );
}
