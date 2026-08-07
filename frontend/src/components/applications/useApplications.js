import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Briefcase } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { planHasFeature } from '../../config/planFeatures';
import usePageTour from '../../hooks/usePageTour';
import { useToast } from '../Toast';
import {
  APPS_TOUR_KEY,
  PIPELINE_TOUR_KEY,
  APPS_TOUR_STEPS,
  PIPELINE_TOUR_STEPS,
  emptyAddForm,
  jobTitle,
} from './constants';
import { useApplicationsData } from './useApplicationsData';
import { useApplicationsActions } from './useApplicationsActions';
import { useApplicationsEnterprise } from './useApplicationsEnterprise';
import { useApplicationsDrag } from './useApplicationsDrag';

export default function useApplications() {
  const { t } = useTranslation();
  const location = useLocation();
  const isApplicationsRoute = location.pathname.startsWith('/applications');
  const pageTitle = isApplicationsRoute
    ? t('pages.applications.title')
    : t('pages.applications.pipelineTitle');
  const pageSubtitle = t('pages.applications.subtitle');
  const tourKey = isApplicationsRoute ? APPS_TOUR_KEY : PIPELINE_TOUR_KEY;
  const tourSteps = isApplicationsRoute ? APPS_TOUR_STEPS : PIPELINE_TOUR_STEPS;

  const { organization } = useAuth();
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(tourKey);
  const hasBackgroundCheck = planHasFeature(organization?.plan, 'integrations.backgroundCheck');
  const hasEsign = planHasFeature(organization?.plan, 'integrations.esign');

  const [enterpriseActionLoading, setEnterpriseActionLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStage: {}, avgTime: 'N/A' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [viewMode, setViewMode] = useState(isApplicationsRoute ? 'table' : 'kanban');

  useEffect(() => {
    setViewMode(isApplicationsRoute ? 'table' : 'kanban');
  }, [isApplicationsRoute]);

  const [selectedApp, setSelectedApp] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: '',
    scheduledTime: '10:00',
    mode: 'Video',
    location: '',
    remark: '',
  });
  const [scheduling, setScheduling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const tableScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const showToast = useCallback((message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  }, [toast]);

  const { fetchJobs, fetchStats, fetchApplications } = useApplicationsData({
    setJobs,
    setApplications,
    setStats,
    setLoading,
    showToast,
  });

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId);
      fetchStats(selectedJobId);
    } else {
      setApplications([]);
      setStats({ total: 0, byStage: {}, avgTime: 'N/A' });
    }
  }, [selectedJobId, fetchApplications, fetchStats]);

  useEffect(() => {
    if (selectedApp) setNoteDraft(selectedApp.notes || '');
  }, [selectedApp?._id]);

  const {
    openPanel,
    closePanel,
    handleStageChange,
    handleRatingChange,
    handleSaveNote,
    handleReject,
    handleSchedule,
    handleAddApplication,
    handleDeleteApp,
    openAddModal,
    clearFilters,
  } = useApplicationsActions({
    applications,
    setApplications,
    selectedApp,
    setSelectedApp,
    setIsPanelOpen,
    noteDraft,
    setNoteDraft,
    setSavingNote,
    selectedJobId,
    setSelectedJobId,
    addForm,
    setAddForm,
    setIsAddModalOpen,
    setAdding,
    rejectReason,
    setRejectReason,
    setIsRejectModalOpen,
    setRejecting,
    scheduleForm,
    setScheduleForm,
    setIsScheduleOpen,
    setScheduling,
    deleteTarget,
    setDeleteTarget,
    setDeleting,
    fetchStats,
    showToast,
    setSearchQuery,
    setStageFilter,
  });

  const { orderBackgroundCheck, sendForEsign } = useApplicationsEnterprise({
    showToast,
    setSelectedApp,
    setEnterpriseActionLoading,
  });

  const {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
  } = useApplicationsDrag({
    applications,
    handleStageChange,
    draggedAppId,
    setDraggedAppId,
    dragOverStage,
    setDragOverStage,
    tableScrollRef,
    dragScrollRef,
  });

  const filteredApplications = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      if (stageFilter !== 'all' && app.stage !== stageFilter) return false;
      if (!term) return true;
      const name = app.candidate?.name?.toLowerCase() || '';
      const email = app.candidate?.email?.toLowerCase() || '';
      const phone = String(app.candidate?.phone || app.candidate?.contact || '').toLowerCase();
      const source = String(app.source || '').toLowerCase();
      const stage = String(app.stage || '').toLowerCase();
      const title = jobTitle(app.job).toLowerCase();
      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        source.includes(term) ||
        stage.includes(term) ||
        title.includes(term)
      );
    });
  }, [applications, searchQuery, stageFilter]);

  const getAppsByStage = (stageId) => filteredApplications.filter((app) => app.stage === stageId);

  const selectedJob = jobs.find((j) => j._id === selectedJobId);

  const jobOptions = useMemo(
    () =>
      jobs.map((job) => ({
        value: job._id,
        label: jobTitle(job),
        description: job.location || job.experience || 'Open role',
        icon: Briefcase,
        searchText: `${jobTitle(job)} ${job.location || ''} ${job.experience || ''}`,
      })),
    [jobs]
  );

  return {
    isApplicationsRoute,
    pageTitle,
    pageSubtitle,
    tourKey,
    tourSteps,
    tourOpen,
    setTourOpen,
    hasBackgroundCheck,
    hasEsign,
    enterpriseActionLoading,
    jobs,
    selectedJobId,
    setSelectedJobId,
    applications,
    stats,
    loading,
    searchQuery,
    setSearchQuery,
    stageFilter,
    setStageFilter,
    viewMode,
    setViewMode,
    selectedApp,
    isPanelOpen,
    noteDraft,
    setNoteDraft,
    savingNote,
    isAddModalOpen,
    setIsAddModalOpen,
    addForm,
    setAddForm,
    adding,
    isRejectModalOpen,
    setIsRejectModalOpen,
    rejectReason,
    setRejectReason,
    rejecting,
    isScheduleOpen,
    setIsScheduleOpen,
    scheduleForm,
    setScheduleForm,
    scheduling,
    deleteTarget,
    setDeleteTarget,
    deleting,
    draggedAppId,
    dragOverStage,
    tableScrollRef,
    dragScrollRef,
    openPanel,
    closePanel,
    handleStageChange,
    handleRatingChange,
    handleSaveNote,
    handleReject,
    handleSchedule,
    handleAddApplication,
    handleDeleteApp,
    orderBackgroundCheck,
    sendForEsign,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    filteredApplications,
    getAppsByStage,
    onTableDragScrollStart,
    onTableDragScrollMove,
    onTableDragScrollEnd,
    openAddModal,
    clearFilters,
    selectedJob,
    jobOptions,
  };
}
