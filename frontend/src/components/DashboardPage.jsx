import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import { BarChart3, Users, Briefcase, Clock, TrendingUp, TrendingDown, ArrowRight, UserPlus, FileText, Loader2 } from 'lucide-react';
import CallbackRemindersWidget from './CallbackRemindersWidget';

import { BASE_API_URL } from '../config';

const DashboardPage = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('userEmail') || 'User';
  const userName = localStorage.getItem('userName') || '';
  const displayName = userName || (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);
  const userRole = localStorage.getItem('userRole') || 'recruiter';
  const orgName = localStorage.getItem('orgName') || '';
  const isAdmin = ['owner', 'admin'].includes(userRole);
  const isRecruiter = ['owner', 'admin', 'recruiter'].includes(userRole);

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`${BASE_API_URL}/api/analytics/dashboard-stats`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setDashData(data);
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Could not load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const StatCard = ({ icon: Icon, label, value, trend, color, bgColor }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-200 min-h-[100px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-sm font-medium truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 tabular-nums">{loading ? '—' : value}</p>
          {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? <TrendingUp size={14} className="text-green-600 flex-shrink-0" /> : <TrendingDown size={14} className="text-red-500 flex-shrink-0" />}
              <span className={`text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? '+' : ''}{trend}% vs last month
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ${bgColor}`}>
          <Icon size={22} className={color} />
        </div>
      </div>
    </div>
  );

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const statusColor = (status) => {
    const map = {
      'Applied': 'bg-blue-50 text-blue-700',
      'Screening': 'bg-amber-50 text-amber-700',
      'Interview': 'bg-indigo-50 text-indigo-700',
      'Offer': 'bg-purple-50 text-purple-700',
      'Hired': 'bg-green-50 text-green-700',
      'Joined': 'bg-emerald-50 text-emerald-700',
      'Rejected': 'bg-red-50 text-red-700',
      'Dropped': 'bg-gray-100 text-gray-600'
    };
    return map[status] || 'bg-gray-50 text-gray-600';
  };

  const pipelineColors = {
    'Applied': 'bg-blue-500',
    'Screening': 'bg-amber-500',
    'Interview': 'bg-indigo-500',
    'Offer': 'bg-purple-500',
    'Hired': 'bg-green-500',
    'Joined': 'bg-emerald-500',
    'Rejected': 'bg-red-400',
    'Dropped': 'bg-gray-400'
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const d = dashData || {};
  const maxPipeline = Math.max(...(d.pipeline || []).map(p => p.count), 1);

  return (
    <Layout>
      <div className="space-y-6 px-8 py-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}!</h1>
          <p className="text-gray-500 text-sm mt-1">Here's your recruitment overview for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}. Showing cached data if available.
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Candidates" value={d.totalCandidates || 0} trend={d.candidateTrend} color="text-blue-600" bgColor="bg-blue-50" />
          <StatCard icon={UserPlus} label="Added This Month" value={d.thisMonth || 0} trend={null} color="text-green-600" bgColor="bg-green-50" />
          <StatCard icon={Clock} label="Pending Review" value={d.pendingReview || 0} trend={null} color="text-orange-600" bgColor="bg-orange-50" />
          <StatCard icon={Briefcase} label="Hired / Joined" value={(d.pipeline || []).filter(p => p.stage === 'Hired' || p.stage === 'Joined').reduce((sum, p) => sum + p.count, 0)} trend={null} color="text-purple-600" bgColor="bg-purple-50" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Candidates */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Recent Candidates</h2>
              <button onClick={() => navigate('/ats')} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 cursor-pointer">
                View All <ArrowRight size={14} />
              </button>
            </div>
            {(d.recentCandidates || []).length > 0 ? (
              <div className="space-y-0 divide-y divide-gray-100">
                {d.recentCandidates.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(c.name || 'N')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.position || 'No position'} {c.source ? `· ${c.source}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(c.status)}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-gray-400 hidden sm:inline">{formatTimeAgo(c.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No candidates yet. Add your first candidate!</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2.5">
                <button onClick={() => navigate('/add-candidate')} className="w-full min-h-[44px] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer text-sm text-left">
                  + Add Candidate
                </button>
                <button onClick={() => navigate('/ats')} className="w-full min-h-[44px] px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-lg font-medium transition-colors cursor-pointer text-sm text-left">
                  View All Candidates
                </button>
                <button onClick={() => navigate('/resume-parsing')} className="w-full min-h-[44px] px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-lg font-medium transition-colors cursor-pointer text-sm text-left">
                  Resume Parsing
                </button>
                <button onClick={() => navigate('/email-templates')} className="w-full min-h-[44px] px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-lg font-medium transition-colors cursor-pointer text-sm text-left">
                  Email Templates
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Callback Reminders Section */}
        <CallbackRemindersWidget />

        {/* Bottom Section: Pipeline + Top Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hiring Pipeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-5">Hiring Pipeline</h2>
            {(d.pipeline || []).length > 0 ? (
              <div className="space-y-3.5">
                {d.pipeline.filter(p => p.count > 0).map((item) => (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                      <span className="text-sm font-bold text-gray-900">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${pipelineColors[item.stage] || 'bg-blue-500'} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max((item.count / maxPipeline) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {d.pipeline.every(p => p.count === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">No pipeline data yet</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No pipeline data yet</p>
            )}
          </div>

          {/* Top Positions + Sources */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Top Positions</h2>
              {(d.topPositions || []).length > 0 ? (
                <div className="space-y-3">
                  {d.topPositions.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{item.position}</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No position data</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Top Sources</h2>
              {(d.topSources || []).length > 0 ? (
                <div className="space-y-3">
                  {d.topSources.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-green-100 text-green-600 rounded text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{item.source}</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No source data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
