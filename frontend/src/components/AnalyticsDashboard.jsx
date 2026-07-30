// frontend/src/components/AnalyticsDashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { TrendingUp, TrendingDown, Users, CheckCircle, AlertCircle, Award, Download, Share2, FileText, Calendar, Briefcase, MapPin, Target, BarChart3, Clock, ArrowUpRight, RefreshCw, FileSpreadsheet, ClipboardList, Building2, GitBranch, Filter, Eye, X, Send, Mail } from 'lucide-react';
import Layout from './Layout';
import { useSearchParams } from 'react-router-dom';
import BASE_API_URL from '../config';
import { useToast } from './Toast';

const PIPELINE_COLORS = {
  Applied: '#3b82f6', Screening: '#f59e0b', Interview: '#8b5cf6',
  Offer: '#06b6d4', Hired: '#10b981', Joined: '#059669',
  Rejected: '#ef4444', Dropped: '#6b7280'
};
const PIE_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

const AnalyticsDashboard = () => {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const activeTab = searchParams.get('tab') || 'analytics';

  // Export form state
  const [exportFormat, setExportFormat] = useState('pdf');
  const [reportType, setReportType] = useState('recruitment-summary');
  const [dateRange, setDateRange] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [filteredCandidateCount, setFilteredCandidateCount] = useState(null);

  // Share report state
  const [showShareModal, setShowShareModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSharingReport, setIsSharingReport] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  // Fetch filtered candidate count when date range or report type changes
  useEffect(() => {
    const fetchFilteredCount = async () => {
      if (activeTab !== 'export') return;
      try {
        const response = await fetch(`${BASE_API_URL}/api/export/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ reportType: 'recruitment-summary', dateRange, customFrom, customTo })
        });
        if (response.ok) {
          const data = await response.json();
          const total = data.summary?.find(s => s.label === 'Total')?.value || 0;
          setFilteredCandidateCount(total);
        }
      } catch (err) { console.error('Count fetch error:', err); }
    };
    if (dateRange === 'custom' && (!customFrom || !customTo)) return;
    fetchFilteredCount();
  }, [dateRange, customFrom, customTo, activeTab]);

  const fetchStats = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/api/analytics/dashboard-stats`);
      if (isUnauthorized(response)) { handleUnauthorized(); return; }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  // Computed values
  const activePipeline = useMemo(() => {
    if (!stats?.pipeline) return [];
    return stats.pipeline.filter(s => s.count > 0);
  }, [stats]);

  const totalActive = useMemo(() => {
    if (!stats?.pipeline) return 0;
    return stats.pipeline.filter(s => !['Rejected', 'Dropped'].includes(s.stage)).reduce((sum, s) => sum + s.count, 0);
  }, [stats]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const response = await fetch(`${BASE_API_URL}/api/export/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reportType, format: exportFormat, dateRange, customFrom, customTo })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = exportFormat === 'pdf' ? 'pdf' : exportFormat === 'csv' ? 'csv' : 'xlsx';
        a.download = `report.${ext}`;
        // Try to get filename from Content-Disposition
        const disp = response.headers.get('Content-Disposition');
        if (disp) {
          const match = disp.match(/filename="?(.+)"?/);
          if (match) a.download = match[1];
        }
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 4000);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.message || 'Export failed. Please try again.');
      }
    } catch (err) { console.error('Export error:', err); alert('Export error. Please try again.'); }
    finally { setIsExporting(false); }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch(`${BASE_API_URL}/api/export/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reportType, dateRange, customFrom, customTo })
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setShowPreview(true);
      } else {
        alert('Preview failed. Please try again.');
      }
    } catch (err) { console.error('Preview error:', err); alert('Preview error. Please try again.'); }
    finally { setPreviewLoading(false); }
  };

  // Fetch team members for sharing
  const fetchTeamMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/api/team`);
      if (isUnauthorized(response)) { handleUnauthorized(); return; }
      const data = await response.json();
      if (data.success) {
        setTeamMembers(data.members || []);
      } else {
        toast.error('Failed to load team members');
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
      toast.error('Error loading team members');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Handle sharing report with team members
  const handleShareReport = async () => {
    if (selectedMembers.length === 0) {
      toast.warning('Please select at least one team member');
      return;
    }

    setIsSharingReport(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/api/export/share-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          dateRange,
          customFrom,
          customTo,
          selectedMembers: selectedMembers.map(m => m._id),
          message: shareMessage
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Report shared with ${selectedMembers.length} team member(s)`);
        setShowShareModal(false);
        setSelectedMembers([]);
        setShareMessage('');
      } else {
        toast.error(data.message || 'Failed to share report');
      }
    } catch (err) {
      console.error('Share error:', err);
      toast.error('Error sharing report');
    } finally {
      setIsSharingReport(false);
    }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    if (teamMembers.length === 0) {
      await fetchTeamMembers();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-sm text-gray-500 font-medium">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="m-8 p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <div>
            <p className="font-semibold">Unable to load analytics</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => { setLoading(true); fetchStats(); }} className="ml-auto px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-semibold transition">Retry</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Recruitment performance overview and data exports</p>
          </div>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 mb-6 border-b border-gray-200">
          <button
            onClick={() => setSearchParams({ tab: 'analytics' })}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'analytics' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            <span className="flex items-center gap-2"><BarChart3 size={16} /> Analytics</span>
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'export' })}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'export' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            <span className="flex items-center gap-2"><Download size={16} /> Export Data</span>
          </button>
        </div>

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {activeTab === 'analytics' && stats && (
          <div className="space-y-6">

            {/* ── Row 1: KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Candidates */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Candidates</span>
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Users size={18} className="text-indigo-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalCandidates?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{totalActive} active in pipeline</p>
              </div>

              {/* This Month */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Added This Month</span>
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                    <Calendar size={18} className="text-green-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.thisMonth || 0}</p>
                <div className="flex items-center gap-1 mt-1">
                  {stats.candidateTrend >= 0
                    ? <TrendingUp size={14} className="text-green-600" />
                    : <TrendingDown size={14} className="text-red-500" />}
                  <span className={`text-xs font-semibold ${stats.candidateTrend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {stats.candidateTrend >= 0 ? '+' : ''}{stats.candidateTrend}% vs last month
                  </span>
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conversion Rate</span>
                  <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
                    <Target size={18} className="text-cyan-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.conversionRate || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">Offer + Hired + Joined</p>
              </div>

              {/* Pending Review */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Review</span>
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingReview || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Applied + Screening</p>
              </div>
            </div>

            {/* ── Row 2: Daily Trend + Pipeline Funnel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Submissions Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Daily CV Submissions</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Last 7 days activity</p>
                  </div>
                </div>
                {stats.dailySubmissions && stats.dailySubmissions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={stats.dailySubmissions} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}
                        labelStyle={{ fontWeight: 700 }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fill="url(#colorCount)" name="Submissions" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No submission data for the last 7 days</div>
                )}
              </div>

              {/* Pipeline Funnel */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-5">Pipeline Overview</h3>
                <div className="space-y-3">
                  {stats.pipeline?.map((stage) => {
                    const percent = stats.totalCandidates > 0 ? Math.round((stage.count / stats.totalCandidates) * 100) : 0;
                    const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
                    return (
                      <div key={stage.stage}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                            <span className="text-xs font-medium text-gray-700">{stage.stage}</span>
                          </div>
                          <span className="text-xs font-bold text-gray-900">{stage.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Summary */}
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">
                      {(stats.pipeline?.find(s => s.stage === 'Hired')?.count || 0) + (stats.pipeline?.find(s => s.stage === 'Joined')?.count || 0)}
                    </p>
                    <p className="text-[10px] font-semibold text-green-600 uppercase">Hired / Joined</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <p className="text-lg font-bold text-red-700">{stats.rejectionRate || 0}%</p>
                    <p className="text-[10px] font-semibold text-red-600 uppercase">Rejection Rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 3: Top Positions + Sources + Locations ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Positions */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase size={16} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Top Positions</h3>
                </div>
                {stats.topPositions && stats.topPositions.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topPositions.map((pos, idx) => (
                      <div key={pos.position} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{pos.position}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{pos.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">No data yet</p>
                )}
              </div>

              {/* Top Sources */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <ArrowUpRight size={16} className="text-green-600" />
                  <h3 className="text-sm font-bold text-gray-900">Top Sources</h3>
                </div>
                {stats.topSources && stats.topSources.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topSources.map((src, idx) => (
                      <div key={src.source} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{src.source}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{src.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">No data yet</p>
                )}
              </div>

              {/* Location Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <MapPin size={16} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900">Top Locations</h3>
                </div>
                {stats.locationBreakdown && stats.locationBreakdown.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.locationBreakdown.map((loc, idx) => (
                      <div key={loc.location} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{loc.location}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{loc.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-6">No location data</p>
                )}
              </div>
            </div>

            {/* ── Row 4: Pipeline Chart + Source Pie ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Bar Chart */}
              {activePipeline.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-5">Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={activePipeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Candidates">
                        {activePipeline.map((entry, i) => (
                          <Cell key={i} fill={PIPELINE_COLORS[entry.stage] || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Source Distribution Pie */}
              {stats.topSources && stats.topSources.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-5">Source Distribution</h3>
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={stats.topSources} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="count" nameKey="source" paddingAngle={3}>
                          {stats.topSources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                    {stats.topSources.map((s, i) => (
                      <div key={s.source} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                        <span className="text-[11px] text-gray-600 font-medium">{s.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Row 5: Recent Activity Table ── */}
            {stats.recentCandidates && stats.recentCandidates.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Latest candidates added to the system</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Candidate</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Position</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.recentCandidates.map((c, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60 transition">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                {c.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">{c.position || '—'}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">{c.source || '—'}</td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              c.status === 'Hired' || c.status === 'Joined' ? 'bg-green-100 text-green-700' :
                              c.status === 'Offer' ? 'bg-cyan-100 text-cyan-700' :
                              c.status === 'Interview' ? 'bg-purple-100 text-purple-700' :
                              c.status === 'Rejected' || c.status === 'Dropped' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════ EXPORT TAB ═══════════════ */}
        {activeTab === 'export' && (
          <div className="space-y-6">

            {/* Success banner */}
            {exportSuccess && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                Report exported successfully! Check your downloads folder.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Left Column: Report Type Selection ── */}
              <div className="lg:col-span-2 space-y-6">

                {/* Report Type */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-900">Select Report Type</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">Choose the type of report you want to generate and download</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'recruitment-summary', label: 'Recruitment Summary', desc: 'Pipeline breakdown, conversion rate, rejection rate, and key hiring metrics overview', icon: BarChart3, color: 'indigo' },
                      { value: 'source-performance', label: 'Source Performance', desc: 'Source-wise analysis — total candidates, stage distribution, and conversion % per source', icon: ArrowUpRight, color: 'green' },
                      { value: 'position-report', label: 'Position-wise Report', desc: 'Breakdown by job position — applications, interviews, offers, hires, and fill rate %', icon: Briefcase, color: 'purple' },
                      { value: 'client-report', label: 'Client Report', desc: 'Client-wise candidate count, interview stage, offers, hires, and success rate analysis', icon: Building2, color: 'amber' },
                      { value: 'pipeline-status', label: 'Pipeline Status Export', desc: 'All candidates sorted by current pipeline status with key details for tracking progress', icon: GitBranch, color: 'rose' },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = reportType === opt.value;
                      const colorMap = {
                        indigo: { bg: 'bg-indigo-50', ring: 'ring-indigo-500', icon: 'text-indigo-600', iconBg: 'bg-indigo-100' },
                        cyan: { bg: 'bg-cyan-50', ring: 'ring-cyan-500', icon: 'text-cyan-600', iconBg: 'bg-cyan-100' },
                        green: { bg: 'bg-green-50', ring: 'ring-green-500', icon: 'text-green-600', iconBg: 'bg-green-100' },
                        purple: { bg: 'bg-purple-50', ring: 'ring-purple-500', icon: 'text-purple-600', iconBg: 'bg-purple-100' },
                        amber: { bg: 'bg-amber-50', ring: 'ring-amber-500', icon: 'text-amber-600', iconBg: 'bg-amber-100' },
                        rose: { bg: 'bg-rose-50', ring: 'ring-rose-500', icon: 'text-rose-600', iconBg: 'bg-rose-100' },
                      };
                      const c = colorMap[opt.color];
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setReportType(opt.value)}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? `${c.bg} border-transparent ring-2 ${c.ring}`
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${isSelected ? c.iconBg : 'bg-gray-100'}`}>
                            <Icon size={18} className={isSelected ? c.icon : 'text-gray-500'} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900">{opt.label}</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-900">Date Range</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">Filter data by time period, or set a custom date range</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { value: 'all', label: 'All Time' },
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 Days' },
                      { value: 'month', label: 'This Month' },
                      { value: 'quarter', label: 'This Quarter' },
                      { value: 'year', label: 'This Year' },
                      { value: 'custom', label: 'Custom Range' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDateRange(opt.value)}
                        className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                          dateRange === opt.value
                            ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom date inputs */}
                  {dateRange === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase mb-1">From</label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <span className="text-gray-400 font-medium mt-4">to</span>
                      <div className="flex flex-col">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase mb-1">To</label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      {customFrom && customTo && (
                        <span className="text-xs text-indigo-600 font-medium mt-4">
                          {Math.ceil((new Date(customTo) - new Date(customFrom)) / (1000 * 60 * 60 * 24)) + 1} days selected
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right Column: Format + Actions ── */}
              <div className="space-y-6">

                {/* Export Format */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <FileSpreadsheet size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-900">File Format</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Choose output format</p>

                  <div className="space-y-2">
                    {[
                      { value: 'pdf', label: 'PDF (.pdf)', desc: 'Professional branded report with charts', icon: '📋' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setExportFormat(opt.value)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-all ${
                          exportFormat === opt.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{opt.label}</h4>
                          <p className="text-[11px] text-gray-500">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Summary & Button */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Export Summary</h3>
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Report</span>
                      <span className="font-semibold text-gray-900 text-right text-xs max-w-[140px] truncate">
                        {{ 'recruitment-summary': 'Recruitment Summary', 'source-performance': 'Source Performance', 'position-report': 'Position Report', 'client-report': 'Client Report', 'pipeline-status': 'Pipeline Status' }[reportType]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Format</span>
                      <span className="font-semibold text-gray-900">{exportFormat === 'pdf' ? 'PDF' : 'Excel'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Date Range</span>
                      <span className="font-semibold text-gray-900 text-xs">
                        {dateRange === 'custom' && customFrom && customTo
                          ? `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                          : { all: 'All Time', today: 'Today', yesterday: 'Yesterday', week: 'Last 7 Days', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom' }[dateRange]}
                      </span>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Candidates</span>
                        <span className="font-bold text-indigo-600">{(filteredCandidateCount !== null ? filteredCandidateCount : stats?.totalCandidates)?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={handlePreview}
                      disabled={previewLoading || (dateRange === 'custom' && (!customFrom || !customTo))}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {previewLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye size={16} />
                          Preview
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleExport}
                      disabled={isExporting || (dateRange === 'custom' && (!customFrom || !customTo))}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isExporting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Export
                        </>
                      )}
                    </button>

                    <button
                      onClick={openShareModal}
                      disabled={dateRange === 'custom' && (!customFrom || !customTo)}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                  </div>

                  {dateRange === 'custom' && (!customFrom || !customTo) && (
                    <p className="text-[11px] text-amber-600 font-medium mt-2 text-center">Please select both From and To dates</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ PREVIEW MODAL ═══════════════ */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Eye size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{previewData.title}</h3>
                  <p className="text-xs text-gray-500">Report Preview — {previewData.rows?.length || 0} rows</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowPreview(false); handleExport(); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all"
                >
                  <Download size={14} />
                  Download {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
                </button>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {previewData.summary && previewData.summary.length > 0 && (
              <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex gap-3 overflow-x-auto">
                  {previewData.summary.map((card, i) => (
                    <div key={i} className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 min-w-[120px]">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{card.label}</p>
                      <p className="text-lg font-bold text-gray-900">{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {previewData.headers?.map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows?.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2.5 text-sm text-gray-700 border-b border-gray-100 whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.totalRows && previewData.totalRows > (previewData.rows?.length || 0) && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 font-medium">
                  Showing {previewData.rows?.length} of {previewData.totalRows} total rows. Download the full report for complete data.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/80 flex items-center justify-between flex-shrink-0">
              <p className="text-[11px] text-gray-400">Confidential — SkillNix PCHR</p>
              <button onClick={() => setShowPreview(false)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SHARE REPORT MODAL ═══════════════ */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Share2 size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Share Report</h3>
                  <p className="text-xs text-gray-500">Send report to team members</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Team Members Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Select Team Members</label>
                {isLoadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent"></div>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No team members found</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {teamMembers.map((member) => (
                      <label key={member._id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={selectedMembers.some(m => m._id === member._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers([...selectedMembers, member]);
                            } else {
                              setSelectedMembers(selectedMembers.filter(m => m._id !== member._id));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                          <p className="text-xs text-gray-500 truncate">{member.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message (Optional)</label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="Add a message for the recipients..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none"
                />
              </div>

              {/* Selected Members Count */}
              {selectedMembers.length > 0 && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700">
                    {selectedMembers.length === 1 ? '1 team member' : `${selectedMembers.length} team members`} selected
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleShareReport}
                disabled={isSharingReport || selectedMembers.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharingReport ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Share Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AnalyticsDashboard;
