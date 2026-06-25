import SectorRadarChart from '../SectorRadarChart';

export default function SectorRadarChartExample() {
  const mockData = {
    labels: ['Tech', 'Energy', 'Finance', 'Healthcare', 'Crypto'],
    values: [85, 62, 78, 71, 68],
  };

  return (
    <div className="p-4">
      <SectorRadarChart data={mockData} />
    </div>
  );
}
