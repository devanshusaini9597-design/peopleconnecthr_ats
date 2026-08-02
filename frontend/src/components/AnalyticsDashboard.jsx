// frontend/src/components/AnalyticsDashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import { TrendingUp, TrendingDown, Users, Users2, CheckCircle, AlertCircle, Download, Share2, Calendar, Briefcase, MapPin, Target, BarChart3, Clock, ArrowUpRight, RefreshCw, FileSpreadsheet, ClipboardList, Building2, GitBranch, Eye, Send, ArrowRight, FileText, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BASE_API_URL from '../config';
import { useToast } from './Toast';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import DEIAnalyticsSection from './DEIAnalyticsSection';

const PIPELINE_COLORS = {
  Applied: '#3b82f6', Screening: '#f59e0b', Interview: '#8b5cf6',
  Offer: '#06b6d4', Hired: '#10b981', Joined: '#059669',
  Rejected: '#ef4444', Dropped: '#6b7280'
};
const PIE_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

const KpiCard = ({ icon: Icon, label, value, sub, gradient, onClick, trend }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative card-ats-bordered p-5 text-left w-full overflow-hidden group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60 hover:border-transparent"
  >
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transition-all duration-300 group-hover:h-1.5`} />
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{label}</span>
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
    <p className="text-3xl font-bold text-stone-900 tracking-tight tabular-nums">{value}</p>
    {trend !== undefined && trend !== null ? (
      <div className="flex items-center gap-1 mt-1.5">
        {trend >= 0 ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-red-500" />}
        <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}% vs last month
        </span>
      </div>
    ) : (
      <p className="text-xs text-stone-500 mt-1.5">{sub}</p>
    )}
    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-stone-400 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
      Explore <ArrowRight size={12} />
    </div>
  </button>
);

const AnalyticsDashboard = () => {
  const toast = useToast();
  const navigate = useNavigate();
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
      <div className="page-shell-ats animate-page-enter">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl skeleton-ats flex-shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <div className="h-7 w-52 skeleton-ats rounded-lg" />
            <div className="h-4 w-72 max-w-full skeleton-ats rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 skeleton-ats rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2 h-64 skeleton-ats rounded-2xl" />
          <div className="h-64 skeleton-ats rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <div className="card-ats-bordered p-6 flex flex-col sm:flex-row sm:items-center gap-4 border-red-200 bg-red-50/40">
          <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-900">Unable to load analytics</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => { setLoading(true); fetchStats(); }} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          subtitle="Recruitment performance overview and data exports."
          gradientTitle
        >
          <button type="button" onClick={() => fetchStats(true)} disabled={refreshing} className="btn-secondary">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </PageHeader>

        <div className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'export', label: 'Export Data', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ═══════════════ ANALYTICS TAB ═══════════════ */}
        {activeTab === 'analytics' && stats && (
          <div className="space-y-6">

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={Users}
                label="Total Candidates"
                value={stats.totalCandidates?.toLocaleString() || 0}
                sub={`${totalActive} active in pipeline`}
                gradient="from-brand-500 to-teal-400"
                onClick={() => navigate('/ats')}
              />
              <KpiCard
                icon={Calendar}
                label="Added This Month"
                value={stats.thisMonth || 0}
                trend={stats.candidateTrend}
                gradient="from-emerald-500 to-lime-400"
                onClick={() => navigate('/ats')}
              />
              <KpiCard
                icon={Target}
                label="Conversion Rate"
                value={`${stats.conversionRate || 0}%`}
                sub="Offer + Hired + Joined"
                gradient="from-cyan-500 to-sky-400"
                onClick={() => navigate('/applications')}
              />
              <KpiCard
                icon={Clock}
                label="Pending Review"
                value={stats.pendingReview || 0}
                sub="Applied + Screening"
                gradient="from-amber-500 to-orange-400"
                onClick={() => navigate('/pending-review')}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 tracking-tight">Daily CV Submissions</h3>
                    <p className="text-xs text-stone-500 mt-0.5">Last 7 days activity</p>
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
                  <EmptyState
                    icon={BarChart3}
                    tone="violet"
                    compact
                    message="No submission data"
                    subMessage="No candidate submissions in the last 7 days."
                    className="h-48"
                  />
                )}
              </div>

              <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">Pipeline Overview</h3>
                  <button type="button" onClick={() => navigate('/recruitment')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5">
                    Board <ArrowRight size={12} />
                  </button>
                </div>
                <div className="space-y-3">
                  {stats.pipeline?.map((stage) => {
                    const percent = stats.totalCandidates > 0 ? Math.round((stage.count / stats.totalCandidates) * 100) : 0;
                    const color = PIPELINE_COLORS[stage.stage] || '#6b7280';
                    const route = ['Applied', 'Screening'].includes(stage.stage) ? '/pending-review'
                      : ['Interview', 'Offer', 'Hired', 'Joined'].includes(stage.stage) ? '/applications' : '/ats';
                    return (
                      <button key={stage.stage} type="button" onClick={() => navigate(route)} className="w-full text-left group/stage rounded-lg p-1 -mx-1 hover:bg-stone-50 transition-colors">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-stone-700 group-hover/stage:text-stone-900">{stage.stage}</span>
                          </div>
                          <span className="text-xs font-bold text-stone-900">{stage.count}</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: color }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Summary */}
                <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-teal-400" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-brand-600" />
                    <h3 className="text-sm font-bold text-stone-900">Top Positions</h3>
                  </div>
                  <button type="button" onClick={() => navigate('/manage-positions')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Manage</button>
                </div>
                {stats.topPositions?.length > 0 ? (
                  <div className="space-y-1">
                    {stats.topPositions.map((pos, idx) => (
                      <button
                        key={pos.position}
                        type="button"
                        onClick={() => navigate(`/ats?q=${encodeURIComponent(pos.position)}`)}
                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-brand-50/60 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                          <span className="text-sm font-medium text-stone-800 truncate">{pos.position}</span>
                        </div>
                        <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{pos.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Briefcase} tone="violet" compact message="No position data yet" subMessage="Hiring by role will show up here." />
                )}
              </div>

              <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-lime-400" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={16} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-stone-900">Top Sources</h3>
                  </div>
                  <button type="button" onClick={() => navigate('/manage-sources')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Manage</button>
                </div>
                {stats.topSources?.length > 0 ? (
                  <div className="space-y-1">
                    {stats.topSources.map((src, idx) => (
                      <button
                        key={src.source}
                        type="button"
                        onClick={() => navigate(`/ats?q=${encodeURIComponent(src.source)}`)}
                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-emerald-50/60 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                          <span className="text-sm font-medium text-stone-800 truncate">{src.source}</span>
                        </div>
                        <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{src.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Target} tone="emerald" compact message="No source data yet" subMessage="Track referrals, job boards, and channels here." />
                )}
              </div>

              <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
                <div className="flex items-center gap-2 mb-4">
                  <MapPin size={16} className="text-violet-600" />
                  <h3 className="text-sm font-bold text-stone-900">Top Locations</h3>
                </div>
                {stats.locationBreakdown?.length > 0 ? (
                  <div className="space-y-1">
                    {stats.locationBreakdown.map((loc, idx) => (
                      <button
                        key={loc.location}
                        type="button"
                        onClick={() => navigate(`/ats?q=${encodeURIComponent(loc.location)}`)}
                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-violet-50/60 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center transition-transform group-hover:scale-110">{idx + 1}</span>
                          <span className="text-sm font-medium text-stone-800 truncate">{loc.location}</span>
                        </div>
                        <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">{loc.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={MapPin} tone="sky" compact message="No location data" subMessage="Candidate locations will appear as you add profiles." />
                )}
              </div>
            </div>

            {/* ── Row 4: Pipeline Chart + Source Pie ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Bar Chart */}
              {activePipeline.length > 0 && (
                <div className="card-ats-bordered p-6">
                  <h3 className="text-sm font-bold text-stone-900 mb-5">Status Distribution</h3>
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
                <div className="card-ats-bordered p-6">
                  <h3 className="text-sm font-bold text-stone-900 mb-5">Source Distribution</h3>
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
                        <span className="text-[11px] text-stone-600 font-medium">{s.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Row 5: Recent Activity Table ── */}
            {stats.recentCandidates?.length > 0 && (
              <div className="table-shell-ats relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Recent Activity</h3>
                    <p className="text-xs text-stone-500 mt-0.5">Latest candidates added to the system</p>
                  </div>
                  <button type="button" onClick={() => navigate('/ats')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-all hover:gap-1.5">
                    View all <ArrowRight size={12} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Candidate</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Position</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {stats.recentCandidates.map((c, idx) => (
                        <tr
                          key={c.id || idx}
                          className="hover:bg-brand-50/40 transition-colors cursor-pointer"
                          onClick={() => navigate(c.name ? `/ats?q=${encodeURIComponent(c.name)}` : '/ats')}
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                                {c.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-stone-900">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-stone-600">{c.position || '—'}</td>
                          <td className="px-6 py-3.5 text-sm text-stone-600">{c.source || '—'}</td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              c.status === 'Hired' || c.status === 'Joined' ? 'bg-emerald-100 text-emerald-700' :
                              c.status === 'Offer' ? 'bg-cyan-100 text-cyan-700' :
                              c.status === 'Interview' ? 'bg-violet-100 text-violet-700' :
                              c.status === 'Rejected' || c.status === 'Dropped' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-stone-500">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══════════════ DIVERSITY & INCLUSION (add-on) ═══════════════ */}
            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                <Users2 size={20} className="text-violet-500" /> Diversity & Inclusion
              </h3>
              <DEIAnalyticsSection />
            </div>

          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            {exportSuccess && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold">
                <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
                Report exported successfully — check your downloads.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                      <ClipboardList size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 tracking-tight">Select report type</h3>
                      <p className="text-xs text-stone-500">Choose what to generate and download</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
                    {[
                      { value: 'recruitment-summary', label: 'Recruitment Summary', desc: 'Pipeline, conversion, and key hiring metrics', icon: BarChart3, tone: 'bg-brand-50 text-brand-600', ring: 'ring-brand-400 bg-brand-50/80' },
                      { value: 'source-performance', label: 'Source Performance', desc: 'Channel ROI and conversion by source', icon: ArrowUpRight, tone: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-400 bg-emerald-50/80' },
                      { value: 'position-report', label: 'Position-wise Report', desc: 'Applications, offers, and fill rate by role', icon: Briefcase, tone: 'bg-violet-50 text-violet-600', ring: 'ring-violet-400 bg-violet-50/80' },
                      { value: 'client-report', label: 'Client Report', desc: 'Client-wise pipeline and success rates', icon: Building2, tone: 'bg-amber-50 text-amber-600', ring: 'ring-amber-400 bg-amber-50/80' },
                      { value: 'pipeline-status', label: 'Pipeline Status', desc: 'All candidates sorted by current stage', icon: GitBranch, tone: 'bg-rose-50 text-rose-600', ring: 'ring-rose-400 bg-rose-50/80' },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = reportType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setReportType(opt.value)}
                          className={`relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                            isSelected
                              ? `border-transparent ring-2 ${opt.ring} shadow-sm`
                              : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm hover:-translate-y-0.5'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                          <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-transform ${isSelected ? 'scale-105' : ''} ${opt.tone}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 pr-4">
                            <h4 className="text-sm font-bold text-stone-900 tracking-tight">{opt.label}</h4>
                            <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400" />
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 tracking-tight">Date range</h3>
                      <p className="text-xs text-stone-500">Filter the report period</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-5">
                    {[
                      { value: 'all', label: 'All Time' },
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 Days' },
                      { value: 'month', label: 'This Month' },
                      { value: 'quarter', label: 'This Quarter' },
                      { value: 'year', label: 'This Year' },
                      { value: 'custom', label: 'Custom' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDateRange(opt.value)}
                        className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                          dateRange === opt.value
                            ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {dateRange === 'custom' && (
                    <div className="flex flex-wrap items-end gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200 mt-4">
                      <div className="flex flex-col">
                        <label className="label-ats">From</label>
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-ats" />
                      </div>
                      <span className="text-stone-400 font-medium pb-2.5">to</span>
                      <div className="flex flex-col">
                        <label className="label-ats">To</label>
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-ats" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="card-ats-bordered p-5 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 tracking-tight">File format</h3>
                      <p className="text-xs text-stone-500">Output type</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                      exportFormat === 'pdf' ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-stone-900">PDF</h4>
                      <p className="text-[11px] text-stone-500">Branded report with charts</p>
                    </div>
                    {exportFormat === 'pdf' && <Check size={16} className="text-brand-600 ml-auto" />}
                  </button>
                </div>

                <div className="card-ats-bordered p-5 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight mb-4">Export summary</h3>
                  <div className="space-y-3 mb-5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Report</span>
                      <span className="font-semibold text-stone-900 text-right text-xs max-w-[150px] truncate">
                        {{ 'recruitment-summary': 'Recruitment Summary', 'source-performance': 'Source Performance', 'position-report': 'Position Report', 'client-report': 'Client Report', 'pipeline-status': 'Pipeline Status' }[reportType]}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Format</span>
                      <span className="font-semibold text-stone-900">PDF</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Range</span>
                      <span className="font-semibold text-stone-900 text-xs text-right">
                        {dateRange === 'custom' && customFrom && customTo
                          ? `${new Date(customFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(customTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                          : { all: 'All Time', today: 'Today', yesterday: 'Yesterday', week: 'Last 7 Days', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom' }[dateRange]}
                      </span>
                    </div>
                    <div className="border-t border-stone-100 pt-3 flex justify-between">
                      <span className="text-stone-500">Candidates</span>
                      <span className="font-bold text-brand-600">
                        {(filteredCandidateCount !== null ? filteredCandidateCount : stats?.totalCandidates)?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewLoading || (dateRange === 'custom' && (!customFrom || !customTo))}
                    className="btn-secondary w-full mb-2 disabled:opacity-50"
                  >
                    {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
                    {previewLoading ? 'Loading…' : 'Preview'}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={isExporting || (dateRange === 'custom' && (!customFrom || !customTo))}
                      className="btn-primary disabled:opacity-50"
                    >
                      {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                      {isExporting ? '…' : 'Export'}
                    </button>
                    <button
                      type="button"
                      onClick={openShareModal}
                      disabled={dateRange === 'custom' && (!customFrom || !customTo)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Share2 size={16} /> Share
                    </button>
                  </div>
                  {dateRange === 'custom' && (!customFrom || !customTo) && (
                    <p className="text-[11px] text-amber-600 font-medium mt-2 text-center">Select both From and To dates</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showPreview && !!previewData}
        onClose={() => setShowPreview(false)}
        title={previewData?.title || 'Report Preview'}
        description={`${previewData?.rows?.length || 0} row${(previewData?.rows?.length || 0) === 1 ? '' : 's'} in this preview`}
        size="xl"
        footer={
          <>
            <p className="text-[11px] text-stone-400 mr-auto hidden sm:block">Confidential — SkillNix PCHR</p>
            <button type="button" onClick={() => setShowPreview(false)} className="btn-secondary">Close</button>
            <button
              type="button"
              onClick={() => { setShowPreview(false); handleExport(); }}
              className="btn-primary"
            >
              <Download size={16} /> Download {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
            </button>
          </>
        }
      >
        {previewData && (
          <div className="space-y-4">
            {previewData.summary?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {previewData.summary.map((card, i) => {
                  const tones = [
                    'from-brand-50 to-teal-50 border-brand-100 text-brand-700',
                    'from-violet-50 to-fuchsia-50 border-violet-100 text-violet-700',
                    'from-emerald-50 to-lime-50 border-emerald-100 text-emerald-700',
                    'from-amber-50 to-orange-50 border-amber-100 text-amber-700',
                  ];
                  const tone = tones[i % tones.length];
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border bg-gradient-to-br px-3.5 py-3 min-w-0 ${tone}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{card.label}</p>
                      <p className="text-xl font-bold text-stone-900 tabular-nums mt-0.5 tracking-tight">{card.value}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {!previewData.rows?.length ? (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50">
                <EmptyState
                  icon={BarChart3}
                  tone="brand"
                  compact
                  message="No data for this report"
                  subMessage="Try a wider date range, or add candidates with positions to populate this preview."
                  action={
                    <button type="button" onClick={() => { setShowPreview(false); navigate('/ats?add=1'); }} className="btn-secondary !text-xs">
                      Add Candidate
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[40vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                      <tr>
                        {previewData.headers?.map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {previewData.rows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-brand-50/30 transition-colors">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 text-sm text-stone-700 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.totalRows > (previewData.rows?.length || 0) && (
                  <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 font-medium">
                    Showing {previewData.rows.length} of {previewData.totalRows} rows — download for the full report.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Report"
        description="Send this report to team members by email."
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setShowShareModal(false)} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleShareReport}
              disabled={isSharingReport || selectedMembers.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {isSharingReport ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {isSharingReport ? 'Sharing…' : 'Share Report'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-ats">Team members</label>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-emerald-500" />
              </div>
            ) : teamMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                tone="emerald"
                compact
                message="No team members"
                subMessage="Invite teammates to share reports with them."
              />
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50/60">
                {teamMembers.map((member) => {
                  const checked = selectedMembers.some((m) => m._id === member._id);
                  return (
                    <label
                      key={member._id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                        checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, member]);
                          else setSelectedMembers(selectedMembers.filter((m) => m._id !== member._id));
                        }}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">{member.name}</p>
                        <p className="text-xs text-stone-500 truncate">{member.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="label-ats">Message (optional)</label>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a note for recipients…"
              rows={3}
              className="input-ats resize-none"
            />
          </div>

          {selectedMembers.length > 0 && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs font-semibold text-emerald-700">
                {selectedMembers.length} member{selectedMembers.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default AnalyticsDashboard;
