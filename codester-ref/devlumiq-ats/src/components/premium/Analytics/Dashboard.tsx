'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, Clock, Target, 
  Filter, Download, Calendar, ArrowUp, ArrowDown 
} from 'lucide-react';

interface AnalyticsData {
  totalApplicants: number;
  avgTimeToHire: number;
  conversionRates: Array<{ stage: string; rate: number }>;
  topSources: Array<{ source: string; hires: number; applicants: number }>;
  pipelineMetrics: any[];
  sourceMetrics: any[];
}

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const res = await fetch(`/api/analytics/dashboard?period=${period}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  if (loading || !data) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Hiring Analytics</h1>
          <p className="text-stone-500">Track your hiring pipeline performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg hover:bg-stone-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Applicants"
          value={data.totalApplicants}
          change="+12%"
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Avg Time to Hire"
          value={`${data.avgTimeToHire} days`}
          change="-3 days"
          icon={Clock}
          trend="down"
        />
        <StatCard
          title="Offer Acceptance"
          value="78%"
          change="+5%"
          icon={Target}
          trend="up"
        />
        <StatCard
          title="Pipeline Velocity"
          value="4.2 days"
          change="-0.5 days"
          icon={TrendingUp}
          trend="up"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {data.conversionRates.map((stage, index) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-stone-700">{stage.stage}</span>
                  <span className="font-medium text-stone-900">{stage.rate.toFixed(1)}%</span>
                </div>
                <div className="h-8 bg-stone-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-lg transition-all duration-500"
                    style={{ width: `${stage.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Quality */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="font-semibold text-stone-900 mb-4">Top Sources</h3>
          <div className="space-y-3">
            {data.topSources.map((source) => (
              <div key={source.source} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div>
                  <span className="font-medium text-stone-900">{source.source}</span>
                  <p className="text-xs text-stone-500">{source.applicants} applicants</p>
                </div>
                <div className="text-right">
                  <span className="font-medium text-brand-600">{source.hires} hires</span>
                  <p className="text-xs text-stone-500">
                    {((source.hires / source.applicants) * 100).toFixed(1)}% conversion
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time to Hire Chart */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="font-semibold text-stone-900 mb-4">Time to Hire Trends</h3>
        <div className="h-48 flex items-end gap-2">
          {[35, 28, 42, 33, 38, 31, 29, 34, 30, 36, 32, 28].map((value, index) => (
            <div
              key={index}
              className="flex-1 bg-brand-100 hover:bg-brand-200 rounded-t transition-colors relative group"
              style={{ height: `${(value / 50) * 100}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {value} days
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-stone-500">
          <span>Jan</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
          <span>Jul</span>
          <span>Aug</span>
          <span>Sep</span>
          <span>Oct</span>
          <span>Nov</span>
          <span>Dec</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, trend }: any) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-stone-500 text-sm">{title}</span>
        <div className="p-2 bg-brand-50 rounded-lg">
          <Icon className="w-5 h-5 text-brand-600" />
        </div>
      </div>
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div className={`flex items-center gap-1 text-sm mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
        {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        <span>{change}</span>
        <span className="text-stone-400 ml-1">vs last period</span>
      </div>
    </div>
  );
}
