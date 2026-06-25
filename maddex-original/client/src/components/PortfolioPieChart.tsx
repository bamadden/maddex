import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioPieChartProps {
  data: {
    labels: string[];
    values: number[];
  };
}

export default function PortfolioPieChart({ data }: PortfolioPieChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        data: data.values,
        backgroundColor: [
          'hsl(217, 100%, 58%)',
          'hsl(142, 71%, 45%)',
          'hsl(24, 94%, 50%)',
          'hsl(271, 81%, 56%)',
          'hsl(0, 84%, 60%)',
        ],
        borderColor: 'hsl(220, 54%, 9%)',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'hsl(0, 0%, 100%)',
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'hsl(220, 40%, 19%)',
        titleColor: 'hsl(0, 0%, 100%)',
        bodyColor: 'hsl(0, 0%, 100%)',
        borderColor: 'hsl(217, 100%, 58%)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            return context.label + ': ' + context.parsed + '%';
          }
        }
      },
    },
  };

  return (
    <div className="w-full max-w-md mx-auto" data-testid="portfolio-pie-chart">
      <Pie data={chartData} options={options} />
    </div>
  );
}
