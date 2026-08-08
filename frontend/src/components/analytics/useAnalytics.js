import { useEffect, useState, useMemo, useRef } from 'react';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../../utils/fetchUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BASE_API_URL from '../../config';
import { useToast } from '../Toast';
import usePageTour from '../../hooks/usePageTour';
import { ANALYTICS_TOUR_KEY } from './constants';

export default function useAnalytics() {
  const toast = useToast();
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = usePageTour(ANALYTICS_TOUR_KEY);
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

  // Drag-to-scroll wide tables — only from data cells, never from the scrollbar
  const tableScrollRef = useRef(null);
  const previewScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0, el: null });

  const isClickOnScrollbar = (el, e) => {
    const rect = el.getBoundingClientRect();
    const canScrollX = el.scrollWidth > el.clientWidth + 1;
    const canScrollY = el.scrollHeight > el.clientHeight + 1;
    const hBar = Math.max(el.offsetHeight - el.clientHeight, 0);
    const vBar = Math.max(el.offsetWidth - el.clientWidth, 0);
    if (canScrollX && e.clientY >= rect.bottom - Math.max(hBar, 16)) return true;
    if (canScrollY && e.clientX >= rect.right - Math.max(vBar, 16)) return true;
    return false;
  };

  const onTableDragScrollStart = (ref) => (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
    if (!e.target.closest('td, th, .cand-table-drag')) return;
    const el = ref.current;
    if (!el) return;
    if (isClickOnScrollbar(el, e)) return;
    dragScrollRef.current = { active: true, moved: false, startX: e.pageX, scrollLeft: el.scrollLeft, el };
    el.dataset.dragging = '1';
  };

  const onTableDragScrollMove = (e) => {
    const state = dragScrollRef.current;
    if (!state.active || !state.el) return;
    e.preventDefault();
    const dx = e.pageX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    state.el.scrollLeft = state.scrollLeft - dx;
  };

  const onTableDragScrollEnd = () => {
    const state = dragScrollRef.current;
    if (!state.active) return;
    state.active = false;
    if (state.el) delete state.el.dataset.dragging;
    state.el = null;
  };

  // Fetch filtered candidate count when date range or report type changes
  useEffect(() => {
    const fetchFilteredCount = async () => {
      if (activeTab !== 'export') return;
      try {
        const response = await fetch(`${BASE_API_URL}/api/export/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reportType: 'recruitment-summary', dateRange, customFrom, customTo })
        });
        if (response.ok) {
          const data = await response.json();
          const total = data.summary?.find(s => s.label === 'Total')?.value || 0;
          setFilteredCandidateCount(total);
        }
      } catch {
        /* API may be offline — keep last known count */
      }
    };
    if (dateRange === 'custom' && (!customFrom || !customTo)) return;
    fetchFilteredCount();
  }, [dateRange, customFrom, customTo, activeTab]);

  const fetchStats = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/api/analytics/dashboard-stats`);
      if (isUnauthorized(response)) { handleUnauthorized(); return; }
      if (!response.ok) throw new Error('Analytics unavailable');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
      if (showRefresh) {
        toast.error('Analytics data is unavailable right now. Retry when the API is back.');
      }
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
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        toast.success('Report exported successfully');
        setTimeout(() => setExportSuccess(false), 4000);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Export failed. Please try again.');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export unavailable right now. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch(`${BASE_API_URL}/api/export/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportType, dateRange, customFrom, customTo })
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setShowPreview(true);
      } else {
        toast.error('Preview failed. Please try again.');
      }
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Preview unavailable right now. Please try again later.');
    } finally {
      setPreviewLoading(false);
    }
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

  const retryFetchStats = () => {
    setLoading(true);
    fetchStats();
  };

  return {
    navigate,
    tourOpen,
    setTourOpen,
    stats,
    loading,
    error,
    setSearchParams,
    isExporting,
    refreshing,
    activeTab,
    exportFormat,
    setExportFormat,
    reportType,
    setReportType,
    dateRange,
    setDateRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    exportSuccess,
    previewData,
    previewLoading,
    showPreview,
    setShowPreview,
    filteredCandidateCount,
    showShareModal,
    setShowShareModal,
    teamMembers,
    selectedMembers,
    setSelectedMembers,
    isLoadingMembers,
    isSharingReport,
    shareMessage,
    setShareMessage,
    tableScrollRef,
    previewScrollRef,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    fetchStats,
    activePipeline,
    totalActive,
    handleExport,
    handlePreview,
    handleShareReport,
    openShareModal,
    retryFetchStats,
  };
}
