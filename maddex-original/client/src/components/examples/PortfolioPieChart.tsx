import PortfolioPieChart from '../PortfolioPieChart';

export default function PortfolioPieChartExample() {
  const mockData = {
    labels: ['Equities', 'Crypto', 'Cash', 'Bonds', 'Alternatives'],
    values: [56, 22, 7, 9, 6],
  };

  return (
    <div className="p-4">
      <PortfolioPieChart data={mockData} />
    </div>
  );
}
