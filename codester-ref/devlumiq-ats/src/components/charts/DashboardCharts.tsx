'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function useChartOptions() {
  const tickColor = '#78716c';
  const gridColor = '#f5f5f4';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28, 25, 23, 0.95)',
        titleColor: '#1c1917',
        bodyColor: '#44403c',
        padding: 12,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: tickColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: { font: { size: 11 }, color: tickColor },
      },
    },
  };
}

const DEFAULT_DAILY: { date: string; count: number }[] = [
  { date: 'Mon', count: 0 }, { date: 'Tue', count: 0 }, { date: 'Wed', count: 0 },
  { date: 'Thu', count: 0 }, { date: 'Fri', count: 0 }, { date: 'Sat', count: 0 }, { date: 'Sun', count: 0 },
];

export function WeeklyChart({ dailySubmissions }: { dailySubmissions?: { date: string; count: number }[] }) {
  const chartOptions = useChartOptions();
  const series = (dailySubmissions && dailySubmissions.length) ? dailySubmissions : DEFAULT_DAILY;
  const data = {
    labels: series.map((d) => d.date),
    datasets: [
      {
        label: 'Applications',
        data: series.map((d) => d.count),
        backgroundColor: series.map((_, i) =>
          `rgba(13, 148, 136, ${0.3 + (i % 4) * 0.15})`
        ),
        borderColor: 'rgb(13, 148, 136)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };
  return (
    <div className="h-[220px] sm:h-[260px] min-w-0">
      <Bar data={data} options={chartOptions} />
    </div>
  );
}

export function PipelineDoughnut({ pipeline: pipelineProp }: { pipeline?: { stage: string; count: number }[] }) {
  const pipeline = (pipelineProp ?? []).filter((p) => p.count > 0);
  
  // Professional empty state when no pipeline data
  if (pipeline.length === 0) {
    return (
      <div className="h-[200px] sm:h-[240px] min-w-0 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-4 border border-stone-200">
          <svg className="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <p className="text-stone-700 font-semibold text-sm">No Pipeline Data Available</p>
        <p className="text-stone-500 text-xs mt-1 text-center max-w-[200px]">
          Start adding candidates to see your hiring pipeline breakdown
        </p>
        <a 
          href="/dashboard/candidates" 
          className="mt-3 px-4 py-2 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg hover:bg-brand-100 transition-colors"
        >
          Add Candidates
        </a>
      </div>
    );
  }
  
  const colors = [
    '#0d9488', '#f59e0b', '#8b5cf6', '#10b981', '#059669',
    '#ef4444', '#64748b',
  ];
  const data = {
    labels: pipeline.map((p) => p.stage),
    datasets: [
      {
        data: pipeline.map((p) => p.count),
        backgroundColor: pipeline.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 4,
      },
    ],
  };
  return (
    <div className="h-[200px] sm:h-[240px] min-w-0">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 16,
                font: { size: 11, weight: 'bold' as const },
                usePointStyle: true,
                color: '#57534e',
              },
            },
            tooltip: {
              backgroundColor: 'rgba(28, 25, 23, 0.95)',
              titleColor: '#1c1917',
              bodyColor: '#44403c',
              padding: 12,
              cornerRadius: 8,
            },
          },
        }}
      />
    </div>
  );
}
