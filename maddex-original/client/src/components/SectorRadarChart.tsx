import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface SectorRadarChartProps {
  data: {
    labels: string[];
    values: number[];
  };
}

export default function SectorRadarChart({ data }: SectorRadarChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Sector Strength',
        data: data.values,
        backgroundColor: 'rgba(40, 123, 255, 0.2)',
        borderColor: 'hsl(217, 100%, 58%)',
        borderWidth: 2,
        pointBackgroundColor: 'hsl(217, 100%, 58%)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'hsl(217, 100%, 58%)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        pointLabels: {
          color: 'hsl(220, 12%, 73%)',
          font: {
            size: 12,
          },
        },
        ticks: {
          color: 'hsl(220, 12%, 73%)',
          backdropColor: 'transparent',
        },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'hsl(220, 40%, 19%)',
        titleColor: 'hsl(0, 0%, 100%)',
        bodyColor: 'hsl(0, 0%, 100%)',
        borderColor: 'hsl(217, 100%, 58%)',
        borderWidth: 1,
        padding: 12,
      },
    },
  };

  return (
    <div className="w-full max-w-lg mx-auto" data-testid="sector-radar-chart">
      <Radar data={chartData} options={options} />
    </div>
  );
}
