
import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Plus, Search, Mail, MessageCircle, Upload, 
  Filter, CheckSquare, Square, FileText, Cpu, Trash2, Edit, X, Briefcase, BarChart3, AlertCircle, RefreshCw, Download, Eye, Info, Share2, Megaphone
} from 'lucide-react';
import { useParsing } from '../hooks/useParsing';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BASE_API_URL from '../config';
import ColumnMapper from './ColumnMapper';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import useCountries from '../utils/useCountries';
import { useToast } from './Toast';
import ConfirmationModal from './ConfirmationModal';
import { ctcRanges, ctcLpaBreakpoints, expectedCtcOptions, noticePeriodOptions } from '../utils/ctcRanges';
import { dedupeByName } from '../utils/dedupeMasterData';


const ATS = forwardRef((props, ref) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const autoUploadInputRef = useRef(null);
  const { onImportComplete } = props || {};


  const API_URL = `${BASE_API_URL}/candidates`;
// Pehle: const API_URL = 'http://localhost:5000/candidates';
// const API_URL = 'http://localhost:5000/api/candidates';  
  const JOBS_URL = `${BASE_API_URL}/jobs`;
  const BULK_UPLOAD_URL = `${BASE_API_URL}/candidates/bulk-upload`;

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [viewMode] = useState('all'); // Always 'all' - Shared tab removed
  const [filterJob, setFilterJob] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [parsedResults, setParsedResults] = useState([]); 
  const [showPreview, setShowPreview] = useState(false);
  const [previewResumeUrl, setPreviewResumeUrl] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);
  const [previewResumeError, setPreviewResumeError] = useState(null); // e.g. 'file_not_found'
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState([]); // For bulk email mode
  const [emailType, setEmailType] = useState('interview');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailCC, setEmailCC] = useState([]);
  const [emailBCC, setEmailBCC] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCCPicker, setShowCCPicker] = useState(false);
  const [showBCCPicker, setShowBCCPicker] = useState(false);
  
  // Quick Send editable fields
  const [quickName, setQuickName] = useState('');
  const [quickPosition, setQuickPosition] = useState('');
  const [quickDepartment, setQuickDepartment] = useState('');
  const [quickJoiningDate, setQuickJoiningDate] = useState('');
  const [showQuickPreview, setShowQuickPreview] = useState(false);
  const [quickPreviewHtml, setQuickPreviewHtml] = useState('');
  const [quickPreviewSubject, setQuickPreviewSubject] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Template-based email states
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [emailMode, setEmailMode] = useState('template'); // 'template' or 'quick'
  const [emailChannel, setEmailChannel] = useState('transactional'); // 'transactional' or 'marketing'
  const [channelsAvailable, setChannelsAvailable] = useState({ transactional: true, marketing: false });
  const [showVerifiedEmailRequiredModal, setShowVerifiedEmailRequiredModal] = useState(false);
  const [verifiedEmailRequiredMessage, setVerifiedEmailRequiredMessage] = useState('');
  
  // Bulk Email Workflow States
  const [bulkEmailStep, setBulkEmailStep] = useState(null); // null, 'select', 'confirm', 'sending', 'results'
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [emailStatuses, setEmailStatuses] = useState({});
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateRecords, setDuplicateRecords] = useState([]);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [correctionRecords, setCorrectionRecords] = useState([]);
  const [showOnlyCorrect, setShowOnlyCorrect] = useState(false); // Show all records by default
  const [totalRecordsInDB, setTotalRecordsInDB] = useState(0);
  const [remarkPopover, setRemarkPopover] = useState(null); // { left, top, remark } for portal tooltip
  const remarkPopoverTimeoutRef = useRef(null);

  // ✅ NEW: Review & Fix Workflow
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'review', 'blocked'
  const [importConfirmation, setImportConfirmation] = useState(null); // {candidateName, show: true}

  // Download Excel confirmation modal
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Share Candidate Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareConfirmation, setShowShareConfirmation] = useState(false);
  const [shareCandidate, setShareCandidate] = useState(null);
  const [selectedShareMembers, setSelectedShareMembers] = useState([]);
  const [selectedCandidatesForShare, setSelectedCandidatesForShare] = useState([]);
  const [isSharingCandidate, setIsSharingCandidate] = useState(false);
  const [isImportingShared, setIsImportingShared] = useState(false);
  const [showImportSharedConfirm, setShowImportSharedConfirm] = useState(false);
  const [importSharedSuccess, setImportSharedSuccess] = useState(null); // { imported: number }
  const [showImportAllConfirm, setShowImportAllConfirm] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importAllSuccess, setImportAllSuccess] = useState(null); // { imported: number }

  // Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: 'warning', title: '', message: '', details: null, confirmText: 'Confirm', onConfirm: () => {}, isLoading: false });

  // ✅ Advanced Search Panel (inline, above table)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearchFilters, setAdvancedSearchFilters] = useState({
    position: '',
    companyName: '',
    location: '',
    expMin: '',
    expMax: '',
    ctcMin: '',
    ctcMax: '',
    expectedCtcMin: '',
    expectedCtcMax: '',
    date: ''
  });

  // Sort controls
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

 const initialFormState = {
    srNo: '', date: new Date().toISOString().split('T')[0], location: '', position: '',
    fls: '', name: '', contact: '', email: '', companyName: '', experience: '',
    ctc: '', expectedCtc: '', noticePeriod: '', status: 'Applied', client: '',
    spoc: '', source: '', resume: null, callBackDate: '', remark: ''
};
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  // Refs for step-by-step validation focus
  const fieldRefs = {
    name: useRef(null),
    email: useRef(null),
    contact: useRef(null),
    ctc: useRef(null),
    position: useRef(null),
    companyName: useRef(null),
    location: useRef(null),
    spoc: useRef(null),
  };

  // Show mine / View all candidates (all users can see all data when "View all" is selected)
  const [candidatesViewMode, setCandidatesViewMode] = useState('all'); // 'all' = enterprise: everyone sees all; 'mine' = only own + shared

  // Master data for dropdowns (fetch all positions, clients, sources from DB regardless of who added)
  const [masterPositions, setMasterPositions] = useState([]);
  const [masterClients, setMasterClients] = useState([]);
  const [masterSources, setMasterSources] = useState([]);
  const [countryCode, setCountryCode] = useState('+91');
  const countryCodes = useCountries();

  // Fetch master data for modal dropdowns
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const [positionsRes, clientsRes, sourcesRes, teamRes] = await Promise.all([
          fetch(`${BASE_API_URL}/api/positions/all`, { headers }),
          fetch(`${BASE_API_URL}/api/clients/all`, { headers }),
          fetch(`${BASE_API_URL}/api/sources/all`, { headers }),
          fetch(`${BASE_API_URL}/api/team`, { headers })
        ]);
        if (positionsRes.ok) setMasterPositions(dedupeByName(await positionsRes.json()));
        if (clientsRes.ok) setMasterClients(dedupeByName(await clientsRes.json()));
        if (sourcesRes.ok) setMasterSources(dedupeByName(await sourcesRes.json()));
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.success) setTeamMembers(teamData.members || []);
        }
      } catch (error) {
        console.error('Error fetching master data:', error);
      }
    };
    fetchMasterData();
  }, []);

  // Authenticated resume URL - works for all candidates (own + others) because backend sends file with token
  const getResumeEndpointUrl = (candidateId, forDownload = false) => {
    if (!candidateId) return '';
    const base = (BASE_API_URL || '').replace(/\/$/, '');
    const q = forDownload ? '?download=1' : '';
    return `${base}/candidates/${candidateId}/resume${q}`;
  };

  // Fallback: direct file URL (must be absolute so iframe doesn't hit Vite dev server)
  const getResumeUrl = (resumePath) => {
    if (!resumePath || typeof resumePath !== 'string') return '';
    const p = resumePath.trim();
    if (p.startsWith('http')) return p;
    const base = (BASE_API_URL || '').replace(/\/$/, '');
    if (!base) return ''; // avoid relative URL when BASE_API_URL is missing
    const pathPart = p.startsWith('/') ? p : `/${p}`;
    const url = `${base}${pathPart}`;
    return url.startsWith('http') ? url : '';
  };

  // --- Resume Preview: fetch with auth so it works for all candidates (own + others) ---
  const handleResumePreview = async (candidate) => {
    if (!candidate?.resume) {
      toast.error('No resume available for this candidate');
      return;
    }
    const candidateId = candidate._id;
    if (!candidateId) {
      toast.error('Cannot load resume');
      return;
    }
    const authUrl = getResumeEndpointUrl(candidateId);
    // Never open modal or set iframe to a relative URL (would hit Vite and show "Cannot GET /uploads/...")
    if (!authUrl || !authUrl.startsWith('http')) {
      console.error('[Resume] API base URL not set. Set VITE_API_URL or run backend on same origin.');
      toast.error('Cannot load resume (API URL not configured)');
      return;
    }
    setPreviewResumeUrl(authUrl);
    setPreviewBlobUrl(null);
    setPreviewResumeError(null);
    setIsPreviewLoading(true);
    try {
      const res = await authenticatedFetch(authUrl);
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('[Resume] Auth endpoint failed:', 'status=', res.status, 'statusText=', res.statusText, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, 'body=', bodyText.slice(0, 200));
        const isFileNotFound = res.status === 404 && (bodyText.includes('Resume file not found') || bodyText.includes('not found'));
        if (isFileNotFound) {
          setPreviewResumeCandidate(candidate);
          setPreviewResumeError('file_not_found');
          setPreviewResumeUrl(authUrl);
        } else {
          const directUrl = getResumeUrl(candidate.resume);
          if (directUrl && directUrl.startsWith('http')) {
            setPreviewBlobUrl(directUrl);
            setPreviewResumeUrl(directUrl);
            setPreviewResumeCandidate(candidate);
          } else {
            toast.error(`Failed to load resume (${res.status}). Check console for details.`);
            setPreviewResumeUrl(null);
          }
        }
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(blobUrl);
      setPreviewResumeUrl(authUrl);
      setPreviewResumeCandidate(candidate);
    } catch (err) {
      console.error('[Resume] Error loading resume:', 'message=', err?.message, 'url=', authUrl, 'candidateId=', candidateId, 'resumePath=', candidate.resume, err);
      const directUrl = getResumeUrl(candidate.resume);
      if (directUrl && directUrl.startsWith('http')) {
        setPreviewBlobUrl(directUrl);
        setPreviewResumeUrl(directUrl);
        setPreviewResumeCandidate(candidate);
      } else {
        toast.error('Failed to load resume. Check console for details.');
        setPreviewResumeUrl(null);
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closeResumePreview = () => {
    if (previewBlobUrl && typeof previewBlobUrl === 'string' && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setPreviewResumeUrl(null);
    setPreviewResumeCandidate(null);
    setPreviewResumeError(null);
  };

  // Download resume via authenticated endpoint (works for all candidates)
  const handleResumeDownload = async (candidate) => {
    if (!candidate?.resume || !candidate?._id) {
      toast.error('No resume available for this candidate');
      return;
    }
    const url = getResumeEndpointUrl(candidate._id, true);
    try {
      const res = await authenticatedFetch(url);
      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        toast.error('Failed to download resume');
        return;
      }
      const blob = await res.blob();
      const ext = (candidate.resume && candidate.resume.split('.').pop()) || 'pdf';
      const filename = `resume-${candidate.name || candidate._id}.${ext.replace(/\?.*$/, '')}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Resume downloaded');
    } catch (err) {
      console.error('Error downloading resume:', err);
      toast.error('Failed to download resume');
    }
  };

  // --- Data Fetch Logic (with pagination + server-side search) ---
  const fetchData = async (page = 1, options = {}) => {
    try {
      setIsLoadingInitial(true);
      const search = (options.search || '').trim();
      const position = (options.position || '').trim();
      const isSearch = Boolean(search || position);
      
      // ✅ FETCH ALL DATA: Always load all records so filtering/search works across entire DB
      const limit = 50000;
      
      setIsLoadingMore(page > 1 && !isSearch);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (search) params.append('search', search);
      if (position) params.append('position', position);
      // view=mine (default): own + shared; view=all: all candidates in DB
      params.append('view', candidatesViewMode);

      console.log('📤 Fetching candidates from:', `${API_URL}?${params.toString()}`);
      // Run candidates and jobs in parallel so initial load is faster
      const [res, jobRes] = await Promise.all([
        authenticatedFetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' }),
        authenticatedFetch(`${JOBS_URL}?isTemplate=false`)
      ]);

      if (isUnauthorized(res)) {
        handleUnauthorized();
        return;
      }

      let response;
      try {
        response = await res.json();
      } catch (parseErr) {
        console.error('❌ Failed to parse JSON response:', parseErr);
        toast.error('Invalid response from server');
        setCandidates([]);
        return;
      }

      console.log('🔍 HTTP Status:', res.status, 'OK:', res.ok);
      console.log('🔍 API Response - isSearch:', isSearch, 'limit:', limit, 'page:', page);
      console.log('🔍 API Response:', response);
      console.log('🔍 response.success:', response?.success, 'response.data type:', Array.isArray(response?.data) ? `array[${response.data.length}]` : typeof response?.data);

      // Handle both paginated and raw array formats — only update list on success so failed "View all" doesn't wipe the list
      let candidatesData = [];
      let pages = 1;

      // Check HTTP status first — on failure, keep previous candidates and toast (do not clear)
      if (!res.ok) {
        console.error('❌ HTTP Error:', res.status, response?.message || response?.error);
        toast.error(response?.message || `Server error (${res.status})`);
        candidatesData = null; // signal: do not update state
      }
      // Format 1: Success response with pagination
      else if (response?.success === true && Array.isArray(response?.data)) {
        candidatesData = response.data;
        pages = response.pagination?.totalPages || 1;
        const total = response.pagination?.totalCount ?? candidatesData.length;
        setTotalPages(pages);
        setTotalRecordsInDB(total);
        console.log('✅ Candidates loaded (paginated):', candidatesData.length, 'Total:', total);
      }
      // Format 2: Response with data property (success may be undefined)
      else if (response && Array.isArray(response.data)) {
        candidatesData = response.data;
        pages = response.pagination?.totalPages || 1;
        const total = response.pagination?.totalCount ?? candidatesData.length;
        setTotalPages(pages);
        setTotalRecordsInDB(total);
        console.log('✅ Candidates loaded (data property):', candidatesData.length, 'Total:', total);
      }
      // Format 3: Raw array response (legacy)
      else if (Array.isArray(response)) {
        candidatesData = response;
        setTotalPages(1);
        setTotalRecordsInDB(candidatesData.length);
        console.log('✅ Candidates loaded (raw array):', candidatesData.length);
      }
      // Format 4: Error response
      else if (response?.success === false) {
        console.error('❌ API Error:', response.message);
        toast.error(response.message || 'Server error');
        candidatesData = null;
      }
      // Format 5: Empty or unexpected
      else {
        console.warn('⚠️ Unexpected format - treating as empty result:', response);
        candidatesData = [];
        setTotalPages(1);
        setTotalRecordsInDB(0);
      }

      if (candidatesData !== null && Array.isArray(candidatesData)) {
        if (page === 1) {
          setCandidates(candidatesData);
        } else {
          setCandidates(prev => [...prev, ...candidatesData]);
        }
        setCurrentPage(page);
      }

      // Process jobs (fetched in parallel above)
      try {
        if (isUnauthorized(jobRes)) {
          handleUnauthorized();
          return;
        }
        const jobData = await jobRes.json();
        if (Array.isArray(jobData)) {
          setJobs(jobData);
        } else if (jobData && jobData.data && Array.isArray(jobData.data)) {
          setJobs(jobData.data);
        }
      } catch (jobError) {
        console.warn('⚠️ Failed to load jobs:', jobError.message);
      }
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      toast.error('Failed to load candidates. Please refresh page or check your connection.');
      // Do not clear candidates on network error so "View all" / switch doesn't wipe the list
    } finally {
      setIsLoadingMore(false);
      setIsLoadingInitial(false);
    }
  };

  // ✅ Expose methods to parent via ref
  useImperativeHandle(ref, () => {
    // useImperativeHandle - exposing ATS methods
    return {
      triggerAutoImport: () => {
        console.log('🎬 triggerAutoImport called');
        console.log('👉 autoUploadInputRef.current:', autoUploadInputRef.current);
        autoUploadInputRef.current?.click();
      },
      openAddCandidateModal: () => {
        console.log('🎬 openAddCandidateModal called');
        setEditId(null);
        setFormData(initialFormState);
        setFormErrors({});
        setShowModal(true);
      },
      refreshCandidates: () => {
        console.log('🔄 refreshCandidates called');
        fetchData(1, { search: '', position: '' });
      },
      autoUploadInputRef: autoUploadInputRef,
      fileInputRef: fileInputRef
    };
  });

  // INITIAL DATA LOAD + refetch when view mode (Show mine / View all) changes
  useEffect(() => {
    fetchData(1, { search: searchQuery || '', position: filterJob || '' });
  }, [candidatesViewMode]);

  // ✅ SEARCH/FILTER CHANGES - Reset to page 1 (filtering is all client-side)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, advancedSearchFilters, showOnlyCorrect]);

  // ✅ MONITOR REVIEW DATA - When confirmation closes, ensure UI refreshes
  useEffect(() => {
    if (importConfirmation?.show === false || importConfirmation === null) {
      // Force a re-render by accessing current reviewData
      console.log('🔄 Refreshing tab display - confirmation closed');
      console.log('📊 Current Ready:', reviewData?.ready?.length || 0);
      console.log('📊 Current Review:', reviewData?.review?.length || 0);
      console.log('📊 Current Blocked:', reviewData?.blocked?.length || 0);
    }
  }, [importConfirmation]);

  // ✅ REVIEW DATA CHANGES - Log updates to track filtering
  useEffect(() => {
    if (reviewData) {
      console.log('✨ ReviewData Updated:', {
        ready: reviewData.ready?.length || 0,
        review: reviewData.review?.length || 0,
        blocked: reviewData.blocked?.length || 0
      });
    }
  }, [reviewData]);



const handleBulkUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
    setIsHeaderLoading(true);
        // Send file to backend to extract headers
        const formData = new FormData();
        formData.append('file', file);

        const res = await authenticatedFetch(`${BASE_API_URL}/candidates/extract-headers`, {
            method: 'POST',
            body: formData
        });

        if (isUnauthorized(res)) {
          handleUnauthorized();
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
            toast.error('Error reading Excel: ' + (data.message || 'Unknown error'));
            event.target.value = null;
            return;
        }

        setExcelHeaders(data.headers);
        setPendingFile(file);
        setShowColumnMapper(true);
        event.target.value = null;
    } catch (error) {
        console.error("Error reading Excel:", error);
        toast.error('Error reading Excel file. Please try again.');
        event.target.value = null;
      } finally {
        setIsHeaderLoading(false);
    }
};

// 🔥 NEW: Auto-upload without column mapping (reads Excel headers automatically)
const handleAutoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        setIsUploading(true);
        
        const uploadData = new FormData();
        uploadData.append('file', file);
        // NO columnMapping - backend will auto-detect!
        
        console.log('📤 Uploading file:', file.name);
        const response = await authenticatedFetch(`${BASE_API_URL}/candidates/bulk-upload-auto`, {
            method: 'POST',
            body: uploadData
        });

        console.log('📦 Response status:', response.status, 'ok:', response.ok);

        if (isUnauthorized(response)) {
          handleUnauthorized();
          setIsUploading(false);
          return;
        }
        
        if (!response.ok) {
          let errorMessage = 'Upload failed';
          try {
            const errorText = await response.text();
            console.error('❌ Error response text:', errorText);
            if (errorText) {
              try {
                const parsed = JSON.parse(errorText);
                if (parsed?.message) errorMessage = parsed.message;
              } catch {
                errorMessage = errorText.substring(0, 100);
              }
            }
          } catch (e) {
            console.error('Error reading response:', e);
          }
          throw new Error(`${errorMessage} (HTTP ${response.status})`);
        }

        // ✅ Parse response with error handling
        let data;
        try {
          // Read as text first to handle NDJSON format
          const responseText = await response.text();
          console.log('📝 Raw response (first 500 chars):', responseText.substring(0, 500));
          
          if (!responseText || responseText === '') {
            throw new Error('Empty response from server');
          }
          
          // Split by newlines to handle NDJSON format
          const lines = responseText.trim().split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error('No JSON lines in response');
          }
          
          // Find the "complete" message (last object in NDJSON stream)
          let completeMessage = null;
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'complete' || parsed.success) {
                completeMessage = parsed;
                break; // Found it, stop looking
              }
            } catch (e) {
              // Skip invalid lines
              continue;
            }
          }
          
          // If no complete message found, use the last valid JSON
          if (!completeMessage) {
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                completeMessage = JSON.parse(lines[i]);
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (!completeMessage) {
            throw new Error('Could not parse any valid JSON from response');
          }
          
          data = completeMessage;
          console.log('✅ Parsed complete message:', data);
        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          console.error('Response status:', response.status, response.statusText);
          throw new Error('Invalid response format: ' + parseError.message);
        }
        
        console.log('✅ Parsed data:', data);

        if (data.success && data.results) {
            // ✅ Show review modal with categorized results
            setReviewData(data.results);
            setReviewFilter('ready'); // Default to Ready tab
            setEditingRow(null);
            setShowReviewModal(true);
            
            console.log(`📊 Validation Complete: ${data.stats.ready} ready, ${data.stats.review} review, ${data.stats.blocked} blocked`);
            toast.success(`Validation complete! Ready: ${data.stats.ready}, Review: ${data.stats.review}, Blocked: ${data.stats.blocked}`);
        } else if (data.success && data.imported) {
            // ❌ Older backend version still running - it auto-imported instead of returning results
            toast.warning(`Backend version mismatch! Restart backend and try again. Imported ${data.imported} records.`);
            setIsUploading(false);
            return;
        } else {
            throw new Error(data.message || 'Failed to process file - check if backend was restarted');
        }

        setIsUploading(false);
    } catch (error) {
        console.error("❌ Auto Upload Error:", error);
        toast.error('Error: ' + error.message);
        setIsUploading(false);
    } finally {
        event.target.value = null;
    }
};

const handleUploadWithMapping = async (mapping) => {
    if (!pendingFile) return;
    const file = pendingFile;

    try {
        setIsUploading(true);
        console.log("📤 Sending mapping to backend:", mapping);
        console.log("📤 Mapping keys:", Object.keys(mapping || {}));
        console.log("📤 Mapping values:", Object.values(mapping || {}));
        console.log("📄 File selected:", {
          name: file?.name,
          type: file?.type,
          size: file?.size
        });
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('columnMapping', JSON.stringify(mapping));

        console.log("📦 FormData prepared with file and mapping");
        console.log("📦 columnMapping JSON:", JSON.stringify(mapping));
        console.log("📦 FormData entries:");
        for (const pair of uploadData.entries()) {
          console.log(`   - ${pair[0]}:`, pair[1]);
        }
        
        // Use fetch to handle streaming response
        const response = await fetch(`${BULK_UPLOAD_URL}`, {
            method: 'POST',
            body: uploadData,
            headers: { 'Accept': 'application/x-ndjson' }
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }

        // Read streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let isComplete = false;
        let buffer = ''; // Buffer for incomplete lines

        while (!isComplete) {
            const { done, value } = await reader.read();
            if (done) {
                // Process any remaining buffer
                if (buffer.trim()) {
                    try {
                        const msg = JSON.parse(buffer);
                        if (msg.type === 'complete') isComplete = true;
                    } catch (e) {
                        console.error('Final buffer parse error:', e.message, 'buffer:', buffer.substring(0, 100));
                    }
                }
                break;
            }

            // Append to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Split by newlines but keep incomplete lines in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line

            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const msg = JSON.parse(line);

                    if (msg.type === 'progress') {
                      const percent = ((msg.processed / msg.total) * 100).toFixed(1);
                      console.log(`⏳ Progress: ${msg.processed}/${msg.total} (${percent}%) - ${new Date().toLocaleTimeString()}`);
                    } else if (msg.type === 'complete') {
                      // Just import silently - no duplicate modals
                      setTimeout(() => {
                        fetchData(1, { search: '', position: '' });
                      }, 500);
                      
                      const duplicateCount = (msg.duplicatesInFile || 0) + (msg.duplicatesInDB || 0);
                      
                      // Show simple success message
                      toast.success(`Upload complete! Imported: ${msg.totalProcessed} candidates. Duplicates removed: ${duplicateCount}`);
                    } else if (msg.type === 'error') {
                        toast.error(msg.message);
                        setIsUploading(false);
                    }
                } catch (e) {
                    console.error('Parse error for line:', e.message);
                    // Log the problematic line for debugging
                    if (line.length > 0 && line.length < 200) {
                        console.error('Problematic line:', line);
                    } else if (line.length > 0) {
                        console.error('Problematic line (truncated):', line.substring(0, 100), '...');
                    }
                }
            }
        }
    } catch (error) {
        console.error("Bulk Upload Error:", error);
        toast.error('Error: ' + error.message);
        setIsUploading(false);
    } finally {
        setShowColumnMapper(false);
        setPendingFile(null);
        setColumnMapping(null);
    }
};

// Iske niche ka ye useParsing wala part MATH HATANA, isse rehne dena
const { selectedIds, setSelectedIds, isParsing, toggleSelection, selectAll, handleBulkParse } = useParsing(async () => {
  await fetchData(1, { search: searchQuery, position: filterJob });
    const res = await authenticatedFetch(API_URL);
    
    if (isUnauthorized(res)) {
      handleUnauthorized();
      return;
    }
    
    const latestData = await res.json();
    const newlyParsed = latestData.filter(c => selectedIds.includes(c._id));
    setParsedResults(newlyParsed);
    setShowPreview(true);
});

  /* ================= NEW BULK COMMUNICATION LOGIC ================= */

  // ✅ BULK EMAIL: Integrated with AWS SES
  const handleBulkEmail = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }

    const selectedCandidates = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selectedCandidates.filter(c => c.email && c.email.includes('@'));

    if (validCandidates.length === 0) {
      toast.warning('No valid email addresses found in selected candidates.');
      return;
    }

    const emailTypeChoice = prompt(
      `📧 Send Bulk Email to ${validCandidates.length} candidates\n\n` +
      `Select email type:\n` +
      `1 - Interview Invitation\n` +
      `2 - Rejection Letter\n` +
      `3 - Document Request\n` +
      `4 - Onboarding\n` +
      `5 - Custom Message\n\n` +
      `Enter number (1-5):`
    );

    if (!emailTypeChoice) return;

    const typeMap = {
      '1': 'interview',
      '2': 'rejection',
      '3': 'document',
      '4': 'onboarding',
      '5': 'custom'
    };

    const selectedType = typeMap[emailTypeChoice];

    if (!selectedType) {
      toast.error('Invalid choice!');
      return;
    }

    let customMsg = '';
    if (selectedType === 'custom') {
      customMsg = prompt('Enter your custom message:');
      if (!customMsg) return;
    }

    const proceedWithBulkEmail = async () => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      setIsUploading(true);

      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: validCandidates.map(c => ({
            email: c.email,
            name: c.name,
            position: c.position,
            department: c.department || 'N/A',
            joiningDate: c.joiningDate || 'TBD'
          })),
          emailType: selectedType,
          customMessage: customMsg
        })
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (data.success) {
        toast.success(`Bulk email sent! Total: ${data.data.total}, Sent: ${data.data.sent}, Failed: ${data.data.failed}`);
        setSelectedIds([]);
      } else {
        toast.error(`Failed to send bulk emails: ${data.message}`);
      }
    } catch (error) {
      console.error('Bulk email error:', error);
      toast.error('Failed to send bulk emails. Please try again.');
    } finally {
      setIsUploading(false);
    }
    };

    setConfirmModal({
      isOpen: true, type: 'info',
      title: 'Send Bulk Emails',
      message: `Send ${selectedType} emails to ${validCandidates.length} candidate(s)?`,
      confirmText: `Send ${validCandidates.length} Email${validCandidates.length > 1 ? 's' : ''}`,
      onConfirm: proceedWithBulkEmail
    });
  };

  // ===================== BULK EMAIL WORKFLOW FUNCTIONS =====================
  
  // Start bulk email workflow
  const startBulkEmailFlow = () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate!');
      return;
    }
    
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (validCandidates.length === 0) {
      toast.warning('No valid email addresses found in selected candidates!');
      return;
    }
    
    // Open single email modal with multiple recipients (bulk mode)
    setBulkEmailRecipients(validCandidates);
    setEmailRecipient(validCandidates[0]); // Set first as primary for UI
    setEmailMode('quick'); // Start in quick send mode
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setShowQuickPreview(false);
    setShowEmailModal(true);
    
    // Fetch templates if needed
    if (emailTemplates.length === 0) {
      (async () => {
        try {
          const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
          const data = await res.json();
          if (data.success && data.templates.length > 0) {
            setEmailTemplates(data.templates);
          }
        } catch (err) {
          console.error('Failed to load templates:', err);
        }
      })();
    }
  };
  
  // Toggle email selection
  const toggleEmailSelection = (email) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedEmails(newSet);
  };
  
  // Select all visible emails
  const selectAllEmails = () => {
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const validCandidates = selected.filter(c => c.email);
    
    if (selectedEmails.size === validCandidates.length) {
      setSelectedEmails(new Set()); // Deselect all
    } else {
      const emails = new Set(validCandidates.map(c => c.email));
      setSelectedEmails(emails); // Select all
    }
  };
  
  // Confirm and send emails
  const handleConfirmSend = async () => {
    if (selectedEmails.size === 0) {
      toast.warning('No emails selected!');
      return;
    }
    
    setBulkEmailStep('sending');
    setIsSendingEmail(true);
    
    try {
      // Get candidate data for selected emails
      const selectedCandidates = candidates.filter(c => 
        selectedEmails.has(c.email)
      );
      
      const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: selectedCandidates.map(c => ({
            email: c.email,
            name: c.name,
            position: c.position,
            department: c.client || 'N/A',
            joiningDate: c.callBackDate || 'TBD'
          })),
          emailType: emailType,
          customMessage: customMessage || ''
        })
      });

      if (isUnauthorized(response)) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      
      // Set campaign status
      setCampaignStatus({
        totalEmails: data.data.total,
        completed: data.data.sent,
        failed: data.data.failed,
        waiting: 0,
        processing: 0,
        successRate: data.data.successRate
      });
      
      // Move to results after a brief delay
      setTimeout(() => {
        setBulkEmailStep('results');
        setIsSendingEmail(false);
      }, 1000);
      
    } catch (error) {
      console.error('Bulk email error:', error);
      toast.error('Failed to send bulk emails. Please try again.');
      setBulkEmailStep('select');
      setIsSendingEmail(false);
    }
  };
  
  // Close bulk email flow
  const closeBulkEmailFlow = () => {
    setBulkEmailStep(null);
    setSelectedEmails(new Set());
    setCampaignStatus(null);
    setEmailStatuses({});
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setSelectedIds([]);
  };

  // ===================== OLD BULK EMAIL HANDLER (REPLACED) =====================

  /* ================================================================ */

  const sendEmail = (email) => {
    window.location.href = `mailto:${email}?subject=Job Opportunity&body=Hello, we saw your profile...`;
  };

  const sendWhatsApp = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Bulk WhatsApp: open wa.me for each selected candidate with valid phone
  const handleBulkWhatsApp = () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }
    const selected = candidates.filter(c => selectedIds.includes(c._id));
    const withPhone = selected.filter(c => c.contact && c.contact.replace(/\D/g, '').length >= 7);
    if (withPhone.length === 0) {
      toast.warning('No valid phone numbers found in selected candidates.');
      return;
    }
    setConfirmModal({
      isOpen: true, type: 'info', title: 'Open WhatsApp',
      message: `Open WhatsApp for ${withPhone.length} candidate(s)? Each will open in a new tab.`,
      confirmText: 'Open WhatsApp',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        withPhone.forEach((c, i) => {
          setTimeout(() => {
            const cleanPhone = c.contact.replace(/\D/g, '');
            window.open(`https://wa.me/${cleanPhone}`, '_blank');
          }, i * 500);
        });
      }
    });
  };

  // Bulk delete selected candidates
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one candidate.');
      return;
    }
    setConfirmModal({
      isOpen: true, type: 'delete',
      title: `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${selectedIds.length} selected candidate(s)? This action cannot be undone.`,
      confirmText: `Delete ${selectedIds.length} Candidate${selectedIds.length > 1 ? 's' : ''}`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await authenticatedFetch(`${API_URL}/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Deleted ${data.deletedCount} of ${selectedIds.length} candidates.`);
          } else {
            toast.error(data.message || 'Failed to delete candidates.');
          }
          setSelectedIds([]);
          const pageToRestore = currentPage;
          await fetchData(1, { search: searchQuery, position: filterJob });
          setCurrentPage(pageToRestore);
        } catch (err) {
          console.error('Bulk delete error:', err);
          toast.error('Failed to delete candidates.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Bulk status update
  const handleBulkStatusUpdate = (newStatus) => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true, type: 'edit',
      title: 'Update Status',
      message: `Update status to "${newStatus}" for ${selectedIds.length} candidate(s)?`,
      confirmText: `Update to ${newStatus}`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          let updated = 0;
          for (const id of selectedIds) {
            const res = await authenticatedFetch(`${API_URL}/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) updated++;
          }
          toast.success(`Updated ${updated} of ${selectedIds.length} candidates to "${newStatus}".`);
          setSelectedIds([]);
          const pageToRestore = currentPage;
          await fetchData(1, { search: searchQuery, position: filterJob });
          setCurrentPage(pageToRestore);
        } catch (err) {
          console.error('Bulk status update error:', err);
          toast.error('Failed to update some candidates.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // const handleDelete = async (id) => {
  //   if (window.confirm("Are you sure?")) {
  //     try {
  //       await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  //       fetchData();
  //     } catch (err) { alert("Delete failed"); }
  //   }
  // };

const handleDelete = (id) => {
    const candidate = candidates.find(c => c._id === id);
    setConfirmModal({
      isOpen: true, type: 'delete',
      title: 'Delete Candidate',
      message: `Are you sure you want to delete "${candidate?.name || 'this candidate'}"? This action cannot be undone.`,
      confirmText: 'Delete Candidate',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
            const response = await authenticatedFetch(`${API_URL}/${id}`, { 
                method: 'DELETE' 
            });

            if (isUnauthorized(response)) {
              handleUnauthorized();
              return;
            }

            if (response.ok) {
              toast.success('Deleted successfully!');
              const pageToRestore = currentPage;
              await fetchData(1, { search: searchQuery, position: filterJob });
              setCurrentPage(pageToRestore);
            } else {
                const errorData = await response.json();
                toast.error(`Error: ${errorData.message}`);
            }
        } catch (err) {
            console.error("Delete Error:", err);
            toast.error('Network error: Could not reach the server.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
};

  // ✅ Download Excel for a single candidate
  const handleDownloadExcel = (candidate) => {
    const data = [{
      'Name': candidate.name || '',
      'Email': candidate.email || '',
      'Contact': candidate.contact || '',
      'Company': candidate.companyName || '',
      'Position': candidate.position || '',
      'Location': candidate.location || '',
      'Experience': candidate.experience || '',
      'Current CTC': candidate.ctc || '',
      'Expected CTC': candidate.expectedCtc || '',
      'Notice Period': candidate.noticePeriod || '',
      'Status': candidate.status || '',
      'Client': candidate.client || '',
      'SPOC': candidate.spoc || '',
      'Source': candidate.source || '',
      'FLS': candidate.fls || '',
      'Date': candidate.date ? new Date(candidate.date).toLocaleDateString('en-IN') : '',
      'Remark': candidate.remark || ''
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidate');
    const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, String(data[0][key]).length) + 2 }));
    ws['!cols'] = colWidths;
    const fileName = `${(candidate.name || 'Candidate').replace(/\s+/g, '_')}_Details.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Downloaded ${candidate.name || 'candidate'} details`);
  };

  const handleEdit = async (candidate) => {
    try {
      // Fetch fresh candidate data from backend
      const response = await authenticatedFetch(`${API_URL}/${candidate._id}`);
      if (response.ok) {
        const freshCandidate = await response.json();
        setEditId(freshCandidate._id);
        setFormData({ 
          ...freshCandidate, 
          resume: null,
          countryCode: freshCandidate.countryCode || '+91',
          date: freshCandidate.date ? freshCandidate.date.split('T')[0] : new Date().toISOString().split('T')[0],
          callBackDate: freshCandidate.callBackDate ? freshCandidate.callBackDate.split('T')[0] : ''
        });
        setCountryCode(freshCandidate.countryCode || '+91');
        setFormErrors({});
        setShowModal(true);
      } else {
        toast.error('Failed to load candidate details. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Error loading candidate details.');
    }
  };

  const handleSendEmail = async (candidate) => {
    if (!candidate.email || !candidate.email.includes('@')) {
      toast.warning('Invalid email address for this candidate.');
      return;
    }

    // Check if user has email settings configured
    try {
      const configRes = await authenticatedFetch(`${BASE_API_URL}/api/email-settings`);
      const configData = await configRes.json();
      if (!configData.success || !configData.settings?.isConfigured) {
        toast.error(
          'Please configure your email settings first. Go to Email → Email Settings to set up your SMTP credentials.',
          6000
        );
        return;
      }
    } catch (err) {
      toast.error('Please configure your email settings before sending emails.');
      return;
    }

    // Transactional (ZeptoMail): only verified-domain company emails can send
    try {
      const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
      const statusData = await statusRes.json();
      if (statusData.success && statusData.canSend === false) {
        setVerifiedEmailRequiredMessage(statusData.reason || 'Please log in with your company verified email to send emails.');
        setShowVerifiedEmailRequiredModal(true);
        return;
      }
    } catch (_) { /* allow open if status fails */ }

    // Fetch available channels
    try {
      const chRes = await authenticatedFetch(`${BASE_API_URL}/api/email/channels`);
      const chData = await chRes.json();
      if (chData.success && chData.channels) {
        setChannelsAvailable({
          transactional: chData.channels.transactional?.available ?? true,
          marketing: chData.channels.marketing?.available ?? false
        });
      }
    } catch (_) { /* keep defaults */ }

    setEmailRecipient(candidate);
    setEmailChannel('transactional');
    setEmailType('interview');
    setCustomMessage('');
    setEmailCC([]);
    setEmailBCC([]);
    setCcInput('');
    setBccInput('');
    setQuickName(candidate.name || '');
    setQuickPosition(candidate.position || '');
    setQuickDepartment(candidate.department || '');
    setQuickJoiningDate(candidate.joiningDate || '');
    setShowQuickPreview(false);
    setQuickPreviewHtml('');
    setQuickPreviewSubject('');
    setSelectedTemplate(null);
    setTemplateVars({});
    setEmailMode('template');
    setShowEmailModal(true);

    // Fetch templates
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
      const data = await res.json();
      if (data.success && data.templates.length > 0) {
        setEmailTemplates(data.templates);
      } else {
        // Seed defaults first
        await authenticatedFetch(`${BASE_API_URL}/api/email-templates/seed-defaults`, { method: 'POST' });
        const res2 = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
        const data2 = await res2.json();
        if (data2.success) setEmailTemplates(data2.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const selectEmailTemplate = (template) => {
    setSelectedTemplate(template);
    // Pre-fill variables from candidate data
    const vars = {};
    (template.variables || []).forEach(v => {
      if (v === 'candidateName') vars[v] = emailRecipient?.name || '';
      else if (v === 'position') vars[v] = emailRecipient?.position || '';
      else if (v === 'company') vars[v] = emailRecipient?.client || emailRecipient?.companyName || '';
      else if (v === 'ctc') vars[v] = emailRecipient?.ctc || '';
      else if (v === 'experience') vars[v] = emailRecipient?.experience || '';
      else if (v === 'location') vars[v] = emailRecipient?.location || '';
      else vars[v] = '';
    });
    setTemplateVars(vars);
  };

  const sendTemplateEmail = async () => {
    if (!emailRecipient || !selectedTemplate) return;
    setIsSendingEmail(true);
    try {
      // Build recipient list (supports both single and bulk)
      const recipients = bulkEmailRecipients.length > 0
        ? bulkEmailRecipients.map(c => ({ email: c.email, name: c.name }))
        : [{ email: emailRecipient.email, name: emailRecipient.name }];

      const body = {
        templateId: selectedTemplate._id,
        recipients: recipients,
        variables: templateVars,
        channel: emailChannel,
      };
      if (emailCC.length > 0) body.cc = emailCC;
      if (emailBCC.length > 0) body.bcc = emailBCC;

      const response = await authenticatedFetch(`${BASE_API_URL}/api/email-templates/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const failedCount = data.data?.failed?.length ?? 0;
      const successCount = data.data?.success?.length ?? 0;
      if (data.success) {
        if (bulkEmailRecipients.length > 0) {
          if (failedCount > 0) {
            toast.error(`Bulk email: ${successCount} sent, ${failedCount} failed. ${data.data.failed?.[0]?.error || ''}`);
            if (data.data?.failed?.length) console.error('[Send email] Failed:', data.data.failed);
          } else {
            toast.success(`Bulk email sent! Sent: ${successCount}`);
          }
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setSelectedIds([]);
        } else {
          if (failedCount > 0) {
            const first = data.data?.failed?.[0];
            const errMsg = first?.displayMessage || first?.error || 'Send failed';
            toast.error(`Email not sent: ${errMsg}`, 8000);
            console.error('[Send email] Failed:', data.data?.failed);
          } else {
            const via = emailChannel === 'marketing' ? ' (via Marketing)' : ' (via Transactional)';
            toast.success(`Email sent to ${emailRecipient.email}${via}`);
            setShowEmailModal(false);
            setEmailRecipient(null);
          }
        }
        setSelectedTemplate(null);
        if (data.data && failedCount === 0) console.log('[Send email] Success:', data.data);
      } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
        console.error('[Send email] Not configured:', data);
        toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
        setShowEmailModal(false);
      } else if (data.code === 'CAMPAIGNS_NOT_CONFIGURED') {
        toast.error(data.displayMessage || data.message || 'Zoho Campaigns is not configured. Add credentials and ZOHO_CAMPAIGNS_LIST_KEY in backend .env.', 8000);
        setShowEmailModal(false);
      } else if (data.code === 'USE_VERIFIED_DOMAIN') {
        setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
        setShowVerifiedEmailRequiredModal(true);
        setShowEmailModal(false);
      } else {
        console.error('[Send email] API error:', data.message, data);
        toast.error(data.displayMessage || data.message || 'Failed to send email', 6000);
      }
    } catch (err) {
      console.error('[Send email] Error:', err?.message, err);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };
  const sendSingleEmail = async () => {
    if (!emailRecipient) return;

    try {
      setIsSendingEmail(true);

      // If bulk mode, send to all recipients
      if (bulkEmailRecipients.length > 0) {
        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidates: bulkEmailRecipients.map(c => ({
              email: c.email,
              name: c.name,
              position: c.position,
              department: c.department || 'N/A',
              joiningDate: c.joiningDate || 'TBD'
            })),
            emailType: emailType,
            customMessage: customMessage,
            cc: emailCC,
            bcc: emailBCC
          })
        });

        const data = await response.json();

        if (data.success) {
          toast.success(`Bulk email sent! Total: ${data.data.total}, Sent: ${data.data.sent}, Failed: ${data.data.failed}`);
          setShowEmailModal(false);
          setBulkEmailRecipients([]);
          setSelectedIds([]);
          setEmailRecipient(null);
          console.log('[Send bulk email] Success:', data.data);
        } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
          console.error('[Send bulk email] Not configured:', data);
          toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
          setShowEmailModal(false);
        } else if (data.code === 'USE_VERIFIED_DOMAIN') {
          setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
          setShowVerifiedEmailRequiredModal(true);
          setShowEmailModal(false);
        } else {
          console.error('[Send bulk email] API error:', data.message, data);
          toast.error(`Failed to send bulk emails: ${data.message}`);
        }
      } else {
        // Single email mode (existing code)
        const emailBody = {
          email: emailRecipient.email,
          name: quickName || emailRecipient.name,
          position: quickPosition || emailRecipient.position,
          emailType: emailType,
          customMessage: customMessage,
          department: quickDepartment || emailRecipient.department || 'N/A',
          joiningDate: quickJoiningDate || emailRecipient.joiningDate || 'TBD'
        };

        // Add CC if provided
        if (emailCC.length > 0) emailBody.cc = emailCC;

        // Add BCC if provided
        if (emailBCC.length > 0) emailBody.bcc = emailBCC;

        const response = await authenticatedFetch(`${BASE_API_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailBody)
        });

        const data = await response.json();

        if (data.success) {
          let successMessage = `Email sent to ${emailRecipient.email}`;
          if (emailCC.length > 0) successMessage += ` (CC: ${emailCC.join(', ')})`;
          if (emailBCC.length > 0) successMessage += ` (BCC: ${emailBCC.join(', ')})`;
          toast.success(successMessage);
          setShowEmailModal(false);
          setEmailRecipient(null);
          console.log('[Send email] Success:', data);
        } else if (data.message === 'EMAIL_NOT_CONFIGURED') {
          console.error('[Send email] Not configured:', data);
          toast.error('Please configure your email settings first. Go to Email → Email Settings.', 6000);
          setShowEmailModal(false);
        } else if (data.code === 'USE_VERIFIED_DOMAIN') {
          setVerifiedEmailRequiredMessage(data.message || 'Please use your company verified email to send.');
          setShowVerifiedEmailRequiredModal(true);
          setShowEmailModal(false);
        } else {
          console.error('[Send email] API error:', data.message, data);
          toast.error(`Failed to send email: ${data.message}`);
        }
      }
    } catch (error) {
      console.error('[Send email] Error:', error?.message, error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ✅ Share Candidate with Team Members
  const handleShareClick = (candidate) => {
    // Support both single and bulk share
    const selectedForBulk = candidates.filter(c => selectedIds.includes(c._id));
    if (!candidate && selectedForBulk.length > 0) {
      // Bulk mode from action bar - share selected candidates
      setSelectedCandidatesForShare(selectedForBulk.map(c => c._id));
      setShareCandidate(null);
    } else if (selectedForBulk.length > 0 && candidate) {
      // If items are selected but clicked on a specific one, still use selected
      setSelectedCandidatesForShare(selectedForBulk.map(c => c._id));
      setShareCandidate(null);
    } else if (candidate) {
      // Single mode - share one candidate
      setSelectedCandidatesForShare([candidate._id]);
      setShareCandidate(candidate);
    } else {
      toast.warning('Please select at least one candidate to share.');
      return;
    }
    setSelectedShareMembers([]);
    setShowShareModal(true);
  };

  const handleShareCandidate = async () => {
    // Validation
    if (selectedCandidatesForShare.length === 0 || selectedShareMembers.length === 0) {
      toast.warning('Please select team members to share with');
      return;
    }

    // Show confirmation modal first
    if (!showShareConfirmation) {
      setShowShareConfirmation(true);
      return;
    }

    // Perform the actual share
    setShowShareConfirmation(false);
    setIsSharingCandidate(true);
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: selectedCandidatesForShare,
          sharedWith: selectedShareMembers
        })
      });

      const data = await response.json();

      if (data.success) {
        const candidateWord = data.sharedCandidateCount > 1 ? 'candidates' : 'candidate';
        const memberWord = data.sharedMemberCount > 1 ? 'members' : 'member';
        toast.success(`${data.sharedCandidateCount} ${candidateWord} shared with ${data.sharedMemberCount} team ${memberWord}!`);
        setShowShareModal(false);
        setShareCandidate(null);
        setSelectedShareMembers([]);
        setSelectedCandidatesForShare([]);
      } else {
        toast.error(`Failed to share: ${data.message}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share candidate. Please try again.');
    } finally {
      setIsSharingCandidate(false);
    }
  };

  const getIdsToImportShared = () => {
    const list = selectedIds.length > 0
      ? candidates.filter(c => selectedIds.includes(c._id) && c._isShared)
      : filteredCandidates.filter(c => c._isShared);
    return list.map(c => c._id).filter(id => id != null && String(id).trim() !== '');
  };

  const handleImportSharedToMineClick = () => {
    const idsToImport = getIdsToImportShared();
    if (idsToImport.length === 0) {
      toast.warning('No shared candidates selected.');
      return;
    }
    setShowImportSharedConfirm(true);
  };

  const handleImportSharedToMine = async () => {
    setShowImportSharedConfirm(false);
    const idsToImport = getIdsToImportShared();
    if (idsToImport.length === 0) return;
    setIsImportingShared(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/candidates/import-shared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: idsToImport })
      });
      const data = await res.json();
      if (data.success) {
        const importedCount = Number(data.imported);
        setImportSharedSuccess({ imported: Number.isNaN(importedCount) ? 0 : importedCount });
        if (selectedIds.length > 0) setSelectedIds([]);
        fetchData(1, { search: searchQuery || '', position: filterJob || '' });
      } else {
        const msg = data.message != null ? String(data.message) : 'Import failed';
        console.error('[Import shared] API error:', data.message, data);
        toast.error(msg);
      }
    } catch (err) {
      const errMsg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to import shared candidates';
      console.error('[Import shared] Error:', errMsg, err);
      toast.error(errMsg);
    } finally {
      setIsImportingShared(false);
    }
  };

  const handleImportAllToMineClick = () => {
    if (candidatesViewMode !== 'all') return;
    setShowImportAllConfirm(true);
  };

  const handleImportAllToMine = async () => {
    setShowImportAllConfirm(false);
    setIsImportingAll(true);
    try {
      const res = await authenticatedFetch(`${BASE_API_URL}/candidates/import-all-to-mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        const importedCount = Number(data.imported);
        setImportAllSuccess({ imported: Number.isNaN(importedCount) ? 0 : importedCount });
        fetchData(1, { search: searchQuery || '', position: filterJob || '' });
      } else {
        const msg = data.message != null ? String(data.message) : 'Import failed';
        console.error('[Import all] API error:', data.message, data);
        toast.error(msg);
      }
    } catch (err) {
      const errMsg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to import candidates';
      console.error('[Import all] Error:', errMsg, err);
      toast.error(errMsg);
    } finally {
      setIsImportingAll(false);
    }
  };

const handleInputChange = async (e) => {
  const { name, value, files } = e.target;

  // Clear error for the field being edited
  if (formErrors[name]) {
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  }

  let finalValue = value;

  if (name === 'email') {
    finalValue = value.toLowerCase()
      .replace(/@gnail\.con$/, '@gmail.com')
      .replace(/@gnail\.com$/, '@gmail.com')
      .replace(/@gmail\.con$/, '@gmail.com')
      .replace(/@gmal\.com$/, '@gmail.com');
  } else if (name === 'name' || name === 'spoc' || name === 'location' || name === 'companyName') {
    // Remove leading spaces, collapse multiple spaces to one, proper-case each word
    // "DeVANshU saINI" → "Devanshu Saini"
    let v = value.replace(/^\s+/, '');
    v = v.replace(/\s{2,}/g, ' ');
    v = v.split(' ').map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
    finalValue = v;
  }

  // Collapse multiple consecutive spaces for all text fields (except email)
  if (typeof finalValue === 'string' && name !== 'email') {
    finalValue = finalValue.replace(/\s{2,}/g, ' ');
  }

  // --- Resume parsing ---
  if (name === 'resume') {
    const file = files[0];
    setFormData(prev => ({ ...prev, resume: file }));

    if (file) {
      setIsAutoParsing(true);
      const data = new FormData();
      data.append('resume', file);

      try {
        const response = await fetch(`${BASE_API_URL}/candidates/parse-logic`, {
          method: 'POST',
          body: data,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Parsed Data Received:", result);

          setFormData(prev => ({
            ...prev,
            name: result.name ? result.name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : prev.name,
            email: result.email ? result.email.toLowerCase().trim().replace(/@gnail\.con$/, '@gmail.com').replace(/@gmail\.con$/, '@gmail.com') : prev.email,
            contact: result.contact || prev.contact
          }));
          setFormErrors({}); // Clear all errors after successful parse
        }
      } catch (error) {
        console.error("Auto-parse error:", error);
      } finally {
        setIsAutoParsing(false);
      }
    }
  } else {
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  }
};


const handleAddCandidate = async (e) => {
  e.preventDefault();

  // --- Auto-trim all string fields + collapse spaces + proper case ---
  const trimmed = {};
  Object.keys(formData).forEach(key => {
    if (typeof formData[key] === 'string') {
      trimmed[key] = formData[key].trim().replace(/\s{2,}/g, ' ');
    } else {
      trimmed[key] = formData[key];
    }
  });

  // Proper-case name, spoc, location, companyName on submit
  ['name', 'spoc', 'location', 'companyName'].forEach(field => {
    if (trimmed[field]) {
      trimmed[field] = trimmed[field].split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  });

  setFormData(prev => ({ ...prev, ...trimmed }));

  // --- Step-by-step validation ---
  const errors = {};

  // 1. Name: required, min 2 chars, letters/spaces only
  if (!trimmed.name) {
    errors.name = 'Name is required';
  } else if (trimmed.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (!/^[a-zA-Z\s.''-]+$/.test(trimmed.name)) {
    errors.name = 'Name can only contain letters, spaces, and hyphens';
  }

  // 2. Email: required, valid format
  if (!trimmed.email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // 3. Contact: required, 10 digits for India
  if (!trimmed.contact) {
    errors.contact = 'Contact number is required';
  } else {
    const digits = trimmed.contact.replace(/\D/g, '');
    if (countryCode === '+91' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit mobile number';
    } else if (countryCode === '+1' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit phone number';
    } else if (digits.length < 7 || digits.length > 15) {
      errors.contact = 'Enter a valid phone number';
    }
  }

  // 4. CTC: required
  if (!trimmed.ctc) {
    errors.ctc = 'Current CTC is required';
  }

  // If there are errors, set them, focus the first invalid field, and stop
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    // Focus on the first error field
    const firstErrorField = Object.keys(errors)[0];
    if (fieldRefs[firstErrorField]?.current) {
      fieldRefs[firstErrorField].current.focus();
      fieldRefs[firstErrorField].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast.warning(errors[Object.keys(errors)[0]]);
    return;
  }

  setFormErrors({});

  try {
    let response;
    
    // Use FormData for both create and edit (supports file upload)
    const data = new FormData();
    Object.keys(trimmed).forEach((key) => {
      if (['statusHistory', '_id', '__v', 'updatedAt', 'createdAt'].includes(key)) return;
      if (key === 'resume') {
        if (trimmed[key] instanceof File) data.append('resume', trimmed[key]);
      } else {
        data.append(key, trimmed[key] || "");
      }
    });

    const token = localStorage.getItem('token');
    const url = editId ? `${API_URL}/${editId}` : API_URL;
    const method = editId ? 'PUT' : 'POST';
    response = await fetch(url, {
      method,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: data
    });

    if (isUnauthorized(response)) {
      handleUnauthorized();
      return;
    }

    if (response.ok) {
      toast.success(editId ? 'Profile Updated!' : 'Candidate Added!');
      setShowModal(false);
      setEditId(null);
      setFormData(initialFormState);
      setFormErrors({});
      const pageToRestore = currentPage;
      await fetchData(1, { search: searchQuery, position: filterJob });
      setCurrentPage(pageToRestore);
    } else {
      const errJson = await response.json();
      toast.error('Error: ' + errJson.message);
    }
  } catch (err) { 
    console.error(err);
    toast.error('Server Error'); 
  }
};
  const handleStatusChange = async (id, newStatus) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  };

  // ✅ Handle CTC Dropdown Change
  const handleCtcChange = async (id, newCtc) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ctc: newCtc })
    });
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  };

  // ✅ Handle Expected CTC Dropdown Change
  const handleExpectedCtcChange = async (id, newExpectedCtc) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedCtc: newExpectedCtc })
    });
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  };

  // ✅ Handle Notice Period Dropdown Change
  const handleNoticePeriodChange = async (id, newNoticePeriod) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticePeriod: newNoticePeriod })
    });
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  };

  // ✅ Handle Source of CV Dropdown Change
  const handleSourceChange = async (id, newSource) => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: newSource })
    });
    const pageToRestore = currentPage;
    await fetchData(1, { search: searchQuery, position: filterJob });
    setCurrentPage(pageToRestore);
  };

  // ✅ HELPER: Validate and Auto-Fix Email
  const validateAndFixEmail = (email) => {
    if (!email) return { isValid: false, value: '' };
    
    let fixed = String(email).trim().toLowerCase();
    
    // Check if it has @ and valid domain format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fixed);
    
    return { isValid, value: fixed };
  };

  // ✅ HELPER: Validate and Auto-Fix Mobile Number
  const validateAndFixMobile = (mobile) => {
    if (!mobile) return { isValid: false, value: '' };
    
    // Remove all non-digits first
    let digitsOnly = String(mobile).replace(/\D/g, '');
    
    // If it has +91 country code, remove it and take last 10 digits
    if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    
    // Take only last 10 digits if more than 10
    if (digitsOnly.length > 10) {
      digitsOnly = digitsOnly.slice(-10);
    }
    
    // Check if exactly 10 digits and starts with 6-9
    const isValid = digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly);
    
    return { isValid, value: digitsOnly };
  };

  // ✅ HELPER: Validate and Auto-Fix Name
  const validateAndFixName = (name) => {
    if (!name) return { isValid: false, value: '' };
    
    // Remove all digits and special characters, keep only alphabets and spaces
    let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
    
    // Convert to title case (First letter of each word capitalized)
    fixed = fixed.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Check if length >= 2 and only has alphabets and spaces
    const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
    
    return { isValid, value: fixed };
  };

  // ✅ Check if a record is 100% PROPERLY FILLED - SIMPLE 3-FIELD VALIDATION
  const is100PercentCorrect = (candidate) => {
    // Validate Email
    const emailCheck = validateAndFixEmail(candidate.email);
    
    // Validate Mobile Number
    const mobileCheck = validateAndFixMobile(candidate.contact);
    
    // Validate Name
    const nameCheck = validateAndFixName(candidate.name);

    // RETURN TRUE ONLY IF ALL THREE CORE FIELDS ARE VALID
    return emailCheck.isValid && mobileCheck.isValid && nameCheck.isValid;
  };

  const filteredCandidates = candidates.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    let matchesSearch = true;
    if (q) {
      if (searchScope === 'spoc') {
        matchesSearch = (c.spoc || '').toLowerCase().includes(q);
      } else if (searchScope === 'name') {
        matchesSearch = (c.name || '').toLowerCase().includes(q);
      } else if (searchScope === 'email') {
        matchesSearch = (c.email || '').toLowerCase().includes(q);
      } else if (searchScope === 'position') {
        matchesSearch = (c.position || '').toLowerCase().includes(q);
      } else if (searchScope === 'location') {
        matchesSearch = (c.location || '').toLowerCase().includes(q);
      } else if (searchScope === 'company') {
        matchesSearch = (c.companyName || '').toLowerCase().includes(q);
      } else if (searchScope === 'client') {
        matchesSearch = (c.client || '').toLowerCase().includes(q);
      } else {
        matchesSearch =
          (c.name || '').toLowerCase().includes(q) ||
          (c.position || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.location || '').toLowerCase().includes(q) ||
          (c.companyName || '').toLowerCase().includes(q) ||
          (c.contact || '').toLowerCase().includes(q) ||
          (c.spoc || '').toLowerCase().includes(q);
      }
    }

    // ✅ Advanced Search Filters
    const advSearch = advancedSearchFilters;
    
    // Position filter (exact match from dropdown)
    const matchesAdvPosition = advSearch.position 
      ? (c.position?.toLowerCase() === advSearch.position.toLowerCase())
      : true;
    
    // Company filter (partial text match)
    const matchesAdvCompany = advSearch.companyName 
      ? (c.companyName?.toLowerCase().includes(advSearch.companyName.toLowerCase()) || false)
      : true;
    
    // Location filter (partial text match)
    const matchesAdvLocation = advSearch.location 
      ? (c.location?.toLowerCase().includes(advSearch.location.toLowerCase()) || false)
      : true;
    
    // Experience range filter (numeric comparison)
    const candidateExp = parseFloat(c.experience) || 0;
    const expMin = advSearch.expMin ? parseFloat(advSearch.expMin) : null;
    const expMax = advSearch.expMax ? parseFloat(advSearch.expMax) : null;
    const matchesExpRange = 
      (expMin === null || candidateExp >= expMin) &&
      (expMax === null || candidateExp <= expMax);
    
    // CTC range filter (index-based comparison for dropdown ranges)
    const getCTCRank = (val) => {
      if (!val) return -1;
      const idx = ctcRanges.indexOf(val);
      if (idx !== -1) return idx;
      // Fallback: parse numeric value and map to nearest range index
      const str = String(val).toUpperCase().trim();
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      if (isNaN(num)) return -1;
      let lpa = num;
      if (str.includes('K')) lpa = num / 100; // 50K = 0.5 LPA
      for (let i = 0; i < ctcLpaBreakpoints.length - 1; i++) {
        if (lpa <= ctcLpaBreakpoints[i + 1]) return i;
      }
      return ctcRanges.length - 1; // Above 50L
    };
    
    const candidateCTCRank = getCTCRank(c.ctc);
    const ctcMinRank = advSearch.ctcMin ? getCTCRank(advSearch.ctcMin) : null;
    const ctcMaxRank = advSearch.ctcMax ? getCTCRank(advSearch.ctcMax) : null;
    const matchesCTCRange = 
      (ctcMinRank === null || candidateCTCRank >= ctcMinRank) &&
      (ctcMaxRank === null || candidateCTCRank <= ctcMaxRank);
    
    // Expected CTC range filter
    const candidateExpCTCRank = getCTCRank(c.expectedCtc);
    const expectedCtcMinRank = advSearch.expectedCtcMin ? getCTCRank(advSearch.expectedCtcMin) : null;
    const expectedCtcMaxRank = advSearch.expectedCtcMax ? getCTCRank(advSearch.expectedCtcMax) : null;
    const matchesExpectedCTCRange = 
      (expectedCtcMinRank === null || candidateExpCTCRank >= expectedCtcMinRank) &&
      (expectedCtcMaxRank === null || candidateExpCTCRank <= expectedCtcMaxRank);
    
    // Date filter
    const matchesDate = advSearch.date 
      ? (c.date?.includes(advSearch.date) || false)
      : true;
    
    const matchesAdvanced = matchesAdvPosition && matchesAdvCompany && matchesAdvLocation && 
                          matchesExpRange && matchesCTCRange && matchesExpectedCTCRange && matchesDate;
    
    return matchesSearch && matchesAdvanced;
  });
  // Displayed/filtered candidates tracking

  // Sort candidates
  const sortedCandidates = useMemo(() => {
    const sorted = [...filteredCandidates];
    sorted.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name': valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); break;
        case 'email': valA = (a.email || '').toLowerCase(); valB = (b.email || '').toLowerCase(); break;
        case 'position': valA = (a.position || '').toLowerCase(); valB = (b.position || '').toLowerCase(); break;
        case 'location': valA = (a.location || '').toLowerCase(); valB = (b.location || '').toLowerCase(); break;
        case 'company': valA = (a.companyName || '').toLowerCase(); valB = (b.companyName || '').toLowerCase(); break;
        case 'status': valA = (a.status || '').toLowerCase(); valB = (b.status || '').toLowerCase(); break;
        case 'spoc': valA = (a.spoc || '').toLowerCase(); valB = (b.spoc || '').toLowerCase(); break;
        case 'date':
        default:
          valA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
          valB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
          break;
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredCandidates, sortField, sortOrder]);

  // Show ALL candidates (no pagination on initial load)
  // CLIENT-SIDE PAGINATION: Show 50 records per page
  const PAGE_SIZE = 50;
  const totalFilteredPages = Math.ceil(sortedCandidates.length / PAGE_SIZE);
  const visibleCandidates = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    return sortedCandidates.slice(startIdx, endIdx);
  }, [sortedCandidates, currentPage]);

  const loadMoreRef = useRef(null);
  const isAutoPagingRef = useRef(false);

  useEffect(() => {
    isAutoPagingRef.current = false;
  }, [currentPage, searchQuery]);
  
  // ✅ NO AUTO-SCROLL: Only button-based pagination
  // Removed IntersectionObserver - users must click "Load More" button

  const isAllSelected = filteredCandidates.length > 0 && selectedIds.length === filteredCandidates.length;

  const tableColumns = [
    {
      key: 'actions',
      label: 'Actions',
      render: (candidate) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(candidate)} className="p-1.5 rounded" title="Edit" style={{color: 'var(--info-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--info-bg)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Edit size={16} /></button>
          <button onClick={() => handleDelete(candidate._id)} className="p-1.5 rounded" title="Delete" style={{color: 'var(--error-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-bg)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Trash2 size={16} /></button>
          <button onClick={() => handleSendEmail(candidate)} className="p-1.5 rounded" title="Send Email" style={{color: 'var(--primary-main)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-lighter)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Mail size={16} /></button>
          <button onClick={() => handleShareClick(candidate)} className="p-1.5 rounded" title="Share with team" style={{color: '#10b981'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1fae5'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Share2 size={16} /></button>
        </div>
      )
    },
    { key: 'srNo', label: 'Sr No.', render: (_, index) => <span className="text-sm font-mono text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</span> },
    {
      key: 'resume',
      label: 'Resume',
      render: (candidate) => candidate.resume ? (
        <div className="flex items-center gap-1">
          <button onClick={() => handleResumePreview(candidate)} title="Preview Resume" className="p-1.5 rounded-lg cursor-pointer" style={{backgroundColor: 'var(--info-bg)', color: 'var(--info-main)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--info-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--info-bg)'; }}><Eye size={15} /></button>
          <button onClick={() => handleResumeDownload(candidate)} title="Download Resume" className="p-1.5 rounded-lg" style={{backgroundColor: 'var(--success-bg)', color: 'var(--success-main)'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--success-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--success-bg)'; }}><Download size={15} /></button>
        </div>
      ) : <span className="text-gray-300">—</span>
    },
    {
      key: 'tools',
      label: 'Contact Tools',
      render: (candidate) => (
        <div className="flex gap-1.5">
          <button onClick={() => handleSendEmail(candidate)} className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110" title="Send Email" style={{backgroundColor: '#dbeafe', color: '#2563eb'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bfdbfe'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </button>
          <button onClick={() => sendWhatsApp(candidate.contact)} className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110" title="WhatsApp Message" style={{backgroundColor: '#dcfce7', color: '#16a34a'}} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bbf7d0'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      )
    },
    { key: 'date', label: 'Date', render: (candidate) => <span className="text-sm text-gray-600 whitespace-nowrap">{candidate.date ? new Date(candidate.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span> },
    { key: 'location', label: 'Location', render: (candidate) => <span className="text-sm text-gray-700 whitespace-nowrap">{candidate.location || '—'}</span> },
    { key: 'position', label: 'Position', render: (candidate) => candidate.position ? <span className="text-sm font-semibold text-indigo-700 whitespace-nowrap">{candidate.position}</span> : <span className="text-gray-300">—</span> },
    { key: 'fls', label: 'FLS', render: (candidate) => candidate.fls ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${candidate.fls === 'FLS' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{candidate.fls}</span> : <span className="text-gray-300">—</span> },
    { key: 'name', label: 'Name', render: (candidate) => (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{candidate.name}</span>
        {candidate._isShared && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 whitespace-nowrap" title={`Shared by ${candidate._sharedByOwner || 'team member'}`}>
            Shared
          </span>
        )}
      </div>
    )},
    { key: 'contact', label: 'Contact', render: (candidate) => <span className="text-sm font-mono text-gray-600 whitespace-nowrap">{candidate.contact || '—'}</span> },
    { key: 'email', label: 'Email', render: (candidate) => <span className="text-sm text-gray-600 whitespace-nowrap">{candidate.email || '—'}</span> },
    { key: 'companyName', label: 'Company', render: (candidate) => <span className="text-sm text-gray-700 whitespace-nowrap">{candidate.companyName || '—'}</span> },
    { key: 'experience', label: 'Experience', render: (candidate) => candidate.experience ? <span className="text-sm">{candidate.experience} </span> : <span className="text-gray-300">—</span> },
    {
      key: 'ctc',
      label: 'CTC',
      render: (candidate) => candidate.ctc ? <span className="text-sm whitespace-nowrap">{candidate.ctc}</span> : <span className="text-gray-300">—</span>
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      render: (candidate) => candidate.expectedCtc ? <span className="text-sm whitespace-nowrap">{candidate.expectedCtc}</span> : <span className="text-gray-300">—</span>
    },
    {
      key: 'noticePeriod',
      label: 'Notice Period',
      render: (candidate) => candidate.noticePeriod ? <span className="text-sm whitespace-nowrap">{candidate.noticePeriod}</span> : <span className="text-gray-300">—</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (candidate) => {
        const remark = candidate.remark || '';
        const hasTooltip = !!remark;
        return (
          <div className="flex items-center gap-2">
            <span className={
              `px-3 py-1 rounded-full text-xs font-bold ` +
              (candidate.status === 'Hired' ? 'bg-green-100 text-green-700' :
                candidate.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                candidate.status === 'Interview' ? 'bg-blue-100 text-blue-700' :
                'bg-blue-50 text-blue-700')
            }>
              {candidate.status}
            </span>
            {hasTooltip && (
              <button
                type="button"
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="View remark"
                onMouseEnter={(e) => {
                  if (remarkPopoverTimeoutRef.current) clearTimeout(remarkPopoverTimeoutRef.current);
                  const r = e.currentTarget.getBoundingClientRect();
                  const centerX = r.left + r.width / 2;
                  const iconTop = r.top;
                  const showAbove = iconTop > 140;
                  setRemarkPopover({ left: centerX, top: iconTop, remark, showAbove });
                }}
                onMouseLeave={() => {
                  remarkPopoverTimeoutRef.current = setTimeout(() => setRemarkPopover(null), 150);
                }}
              >
                <Info size={16} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        );
      }
    },
    { key: 'client', label: 'Client', render: (candidate) => <span className="text-sm text-gray-700 whitespace-nowrap">{candidate.client || '—'}</span> },
    { key: 'spoc', label: 'SPOC', render: (candidate) => <span className="text-sm text-gray-700 whitespace-nowrap">{candidate.spoc || '—'}</span> },
    {
      key: 'source',
      label: 'Source',
      render: (candidate) => candidate.source ? <span className="text-sm px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{candidate.source}</span> : <span className="text-gray-300">—</span>
    },
    ...(candidates.some(c => c._isShared) ? [{
      key: 'sharedBy',
      label: 'Shared By',
      render: (candidate) => candidate._isShared ? (
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">
          {candidate._sharedByOwner || 'Team'}
        </span>
      ) : <span className="text-gray-300">—</span>
    }] : [])
  ];

  const [statusOptions, setStatusOptions] = useState(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']);

  // Fetch status options from master data (or backend) on mount
  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BASE_API_URL}/api/statuses`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) setStatusOptions(data);
        }
      } catch (err) {
        // fallback to default
      }
    };
    fetchStatusOptions();
  }, []);

  // ✅ REVIEW & FIX HELPERS
  const handleRevalidateRecord = async (record) => {
    try {
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/revalidate-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: record.fixed || record })
      });
      
      if (!response.ok) throw new Error('Revalidation failed');
      
      const result = await response.json();
      
      // Update the edited row with new validation
      setEditingRow({
        ...record,
        fixed: result.fixed,
        autoFixChanges: result.autoFixChanges,
        validation: result.validation
      });
      
      toast.success(`Category: ${result.validation.category.toUpperCase()} — ${result.validation.confidence}% Confidence`);
    } catch (error) {
      toast.error(`Revalidation error: ${error.message}`);
    }
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRow) return;
    
    console.log('💾 Saving & Importing edited record:', editingRow);
    console.log('🔍 Row to remove - rowIndex:', editingRow.rowIndex, 'name:', editingRow.fixed?.name);
    
    try {
      const recordData = editingRow.fixed || editingRow.original || editingRow;
      const candidateName = recordData.name || 'Candidate';
      const rowIndexToRemove = editingRow.rowIndex;
      const nameToRemove = editingRow.fixed?.name?.toLowerCase();
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords: [recordData],
          reviewRecords: []
        })
      });
      
      if (!response.ok) throw new Error('Failed to import');
      
      const result = await response.json();
      console.log('✅ Record imported:', result);
      
      // Close edit modal first
      setEditingRow(null);
      
      // Update reviewData - remove the imported record from ALL categories
      // Use both rowIndex AND name matching for reliability
      setReviewData(prev => {
        if (!prev) return prev;
        
        const filterRecord = (r) => {
          const recordName = r.fixed?.name?.toLowerCase();
          const recordRowIndex = r.rowIndex;
          
          // Match by rowIndex first, then by name as fallback
          if (rowIndexToRemove !== undefined && recordRowIndex === rowIndexToRemove) {
            console.log('🗑️ Removing by rowIndex match:', rowIndexToRemove);
            return false;
          }
          if (nameToRemove && recordName === nameToRemove) {
            console.log('🗑️ Removing by name match:', nameToRemove);
            return false;
          }
          return true;
        };
        
        const updated = {
          ...prev,
          ready: prev.ready.filter(filterRecord),
          review: prev.review.filter(filterRecord),
          blocked: prev.blocked.filter(filterRecord)
        };
        
        console.log('📊 Updated reviewData:', {
          ready: updated.ready?.length || 0,
          review: updated.review?.length || 0,
          blocked: updated.blocked?.length || 0
        });
        return updated;
      });
      
      // Show confirmation modal after a small delay to let state update
      setTimeout(() => {
        setImportConfirmation({ 
          candidateName,
          show: true 
        });
      }, 200);
      
    } catch (error) {
      console.error('❌ [Import single record] Error:', error?.message, error);
      toast.error('Import error: ' + (error?.message != null ? String(error.message) : 'Unknown error'));
    }
  };

  const handleImportReviewed = async () => {
    if (!reviewData) return;
    
    const readyRecords = reviewData.ready; 
    const reviewRecords = reviewData.review || [];
    
    try {
      console.log(`📤 [IMPORT] Sending ${readyRecords.length} ready + ${reviewRecords.length} review records`);
      
      // Mark review records with pending_review status
      const reviewRecordsWithStatus = reviewRecords.map(r => ({
        ...r.fixed || r.original,
        status: 'Pending Review',
        needsReview: true
      }));
      
      const response = await authenticatedFetch(`${BASE_API_URL}/candidates/import-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readyRecords,
          reviewRecords: reviewRecordsWithStatus
        })
      });
      
      console.log(`📥 [IMPORT] Response status: ${response.status}, ok: ${response.ok}`);
      
      let result;
      const responseText = await response.text();
      console.log(`📥 [IMPORT] Response text (first 500 chars): ${responseText.substring(0, 500)}`);
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ [IMPORT] Failed to parse response as JSON:`, parseError);
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 200)}`);
      }
      
      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }
      
      console.log(`✅ [IMPORT] Response:`, result);
      toast.success(`${result.imported} candidates imported successfully! ${reviewRecords.length} added for review`);
      
      // Get the review count from reviewData before closing modal
      const reviewCount = reviewRecords.length;
      
      // Refresh data and close modal
      setShowReviewModal(false);
      setReviewData(null);
      setEditingRow(null);
      fetchData(1, { search: '', position: '' });
      
      // Call completion callback if provided
      if (onImportComplete) {
        console.log('📢 Calling onImportComplete callback');
        onImportComplete({
          imported: result.imported,
          review: reviewCount,
          timestamp: new Date()
        });
      }
    } catch (error) {
      const msg = error?.message != null ? String(error.message) : 'Unknown error';
      console.error('[Import reviewed] Error:', msg, error);
      toast.error(`Import error: ${msg}`);
    }
  };

  const getFilteredReviewData = () => {
    if (!reviewData) return { ready: [], review: [], blocked: [] };
    
    if (reviewFilter === 'review') {
      return { ready: [], review: reviewData.review || [], blocked: [] };
    } else if (reviewFilter === 'blocked') {
      return { ready: [], review: [], blocked: reviewData.blocked || [] };
    }
    return reviewData;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-8 py-6 font-sans text-gray-900">
      
      {/* COLUMN MAPPER MODAL */}
      {showColumnMapper && (
        <ColumnMapper 
          excelHeaders={excelHeaders}
          onMapComplete={handleUploadWithMapping}
          onClose={() => {
            setShowColumnMapper(false);
            setPendingFile(null);
          }}
        />
      )}

      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <h3 className="text-lg font-bold text-gray-800">Uploading candidates…</h3>
            <p className="mt-2 text-sm text-gray-500">Please wait. This can take a few minutes for large files.</p>
          </div>
        </div>
      )}

      {showVerifiedEmailRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Mail className="text-amber-600" size={20} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Use company email to send</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                {verifiedEmailRequiredMessage}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                Emails can only be sent from verified company addresses (e.g. yourname@yourcompany.com). Log in with that account to send emails to candidates.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowVerifiedEmailRequiredModal(false); setVerifiedEmailRequiredMessage(''); }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading bar only — thin top bar when initial load, no skeleton */}
      {isLoadingInitial && candidates.length === 0 && (
        <div className="h-1 w-full bg-gray-100 rounded overflow-hidden mb-5">
          <div className="h-full w-1/3 bg-indigo-500 rounded animate-shimmer" />
        </div>
      )}
      
      {/* Hidden file inputs (no UI) */}
      <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />
      <input type="file" accept=".csv, .xlsx, .xls" ref={autoUploadInputRef} onChange={handleAutoUpload} className="hidden" />

      {/* HEADER + TOOLBAR — single card, enterprise layout */}
      <div className="mb-5 rounded-xl border border-gray-200/80 bg-white shadow shadow-gray-200/50 overflow-hidden">
        {/* Row 1: Title, view toggle, count, import actions */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">All Candidates</h1>
          <div className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200/80">
            <button
              type="button"
              onClick={() => setCandidatesViewMode('mine')}
              className={`px-3.5 py-2 text-sm font-medium rounded-md transition-all duration-150 ${candidatesViewMode === 'mine' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Show only mine
            </button>
            <button
              type="button"
              onClick={() => setCandidatesViewMode('all')}
              className={`px-3.5 py-2 text-sm font-medium rounded-md transition-all duration-150 ${candidatesViewMode === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              View all
            </button>
          </div>
          <span className="text-sm font-medium text-gray-600 tabular-nums">
            {filteredCandidates.length.toLocaleString()} records
            {searchQuery && <span className="font-normal text-gray-500"> · &ldquo;{searchQuery}&rdquo;</span>}
          </span>
          {candidatesViewMode === 'all' && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleImportAllToMineClick}
                disabled={isImportingShared || isImportingAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-indigo-700 hover:shadow disabled:opacity-50 transition-all duration-150"
                title="Copy every candidate in the database into your list"
              >
                {isImportingAll ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
                {isImportingAll ? 'Importing...' : 'Import all from database'}
              </button>
              {filteredCandidates.some(c => c._isShared) && (
                <button
                  onClick={handleImportSharedToMineClick}
                  disabled={isImportingShared || isImportingAll}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-emerald-700 hover:shadow disabled:opacity-50 transition-all duration-150"
                  title="Import only candidates shared with you"
                >
                  {isImportingShared ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={14} />}
                  {isImportingShared ? 'Importing...' : (selectedIds.length > 0 ? `Import ${selectedIds.length} shared` : 'Import shared')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Search + Filters + Export + Sort — one toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-gray-50/80 border-t border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-xl bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/25 focus-within:border-indigo-400 transition-all">
            <Search className="text-gray-400 flex-shrink-0" size={18} />
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
              className="text-sm border-0 bg-transparent text-gray-600 font-medium outline-none cursor-pointer py-0"
              title="Search in"
            >
              <option value="all">All fields</option>
              <option value="spoc">SPOC</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="position">Position</option>
              <option value="location">Location</option>
              <option value="company">Company</option>
              <option value="client">Client</option>
            </select>
            <input
              type="text"
              placeholder={searchScope === 'all' ? 'Search candidates...' : `Search ${searchScope}...`}
              className="flex-1 min-w-0 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {(searchScope !== 'all' || searchQuery.trim()) && (
              <button type="button" onClick={() => { setSearchScope('all'); setSearchQuery(''); setCurrentPage(1); }} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Clear">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${showAdvancedSearch ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'}`}
          >
            <Filter size={16} /> {showAdvancedSearch ? 'Close' : 'Filters'}
          </button>
          <button
            onClick={() => { if (filteredCandidates.length === 0) toast.warning('No candidates to download.'); else setShowDownloadModal(true); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all duration-150"
          >
            <Download size={16} /> Export{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm">
            <span className="text-sm text-gray-500 font-medium">Sort</span>
            <select
              value={sortField}
              onChange={(e) => { setSortField(e.target.value); setCurrentPage(1); }}
              className="text-sm py-1 pr-6 border-0 bg-transparent text-gray-700 font-medium outline-none cursor-pointer focus:ring-0"
            >
              <option value="date">Date Added</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="position">Position</option>
              <option value="location">Location</option>
              <option value="company">Company</option>
              <option value="status">Status</option>
              <option value="spoc">SPOC</option>
            </select>
            <button
              onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* ADVANCED SEARCH PANEL - ABOVE TABLE */}
      {showAdvancedSearch && (
        <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-gray-800">Advanced Search Filters</h3>
            <button
              onClick={() => {
                setAdvancedSearchFilters({
                  position: '',
                  companyName: '',
                  location: '',
                  expMin: '',
                  expMax: '',
                  ctcMin: '',
                  ctcMax: '',
                  expectedCtcMin: '',
                  expectedCtcMax: '',
                  date: ''
                });
                setSearchQuery('');
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg text-sm font-medium transition hover:bg-gray-50"
            >
              <RefreshCw size={14} /> Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Position - Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Position</label>
              <select
                value={advancedSearchFilters.position}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, position: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">All Positions</option>
                {masterPositions.map(pos => (
                  <option key={pos._id} value={pos.name}>{pos.name}</option>
                ))}
              </select>
            </div>

            {/* Company - Text Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Company</label>
              <input
                type="text"
                value={advancedSearchFilters.companyName}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Search company"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Location - Text input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Location</label>
              <input
                type="text"
                value={advancedSearchFilters.location}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City or location"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Experience Min - Number Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Min Experience (Yrs)</label>
              <select
                value={advancedSearchFilters.expMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expMin: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {[...Array(31).keys()].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'year' : 'years'}</option>
                ))}
              </select>
            </div>

            {/* Experience Max - Number Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Max Experience (Yrs)</label>
              <select
                value={advancedSearchFilters.expMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expMax: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {[...Array(31).keys()].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'year' : 'years'}</option>
                ))}
              </select>
            </div>

            {/* CTC Min - Range Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Min CTC</label>
              <select
                value={advancedSearchFilters.ctcMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, ctcMin: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {ctcRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            {/* CTC Max - Range Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Max CTC</label>
              <select
                value={advancedSearchFilters.ctcMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, ctcMax: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {ctcRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            {/* Expected CTC Min - Range Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Min Expected CTC</label>
              <select
                value={advancedSearchFilters.expectedCtcMin}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expectedCtcMin: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {ctcRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            {/* Expected CTC Max - Range Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Max Expected CTC</label>
              <select
                value={advancedSearchFilters.expectedCtcMax}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, expectedCtcMax: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Any</option>
                {ctcRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={advancedSearchFilters.date}
                onChange={(e) => setAdvancedSearchFilters(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">Filters apply instantly to the candidate list below</p>
        </div>
      )}

      {/* PARSING PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Cpu size={20}/> Parsed Results</h3>
              <button onClick={() => setShowPreview(false)}><X size={24}/></button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500 font-bold"><th>Name</th><th>Email</th><th>Contact</th></tr></thead>
                <tbody>
                  {parsedResults.map(p => (
                    <tr key={p._id} className="border-b">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.email}</td>
                      <td className="py-2">{p.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowPreview(false)} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-30 bg-indigo-600 text-white rounded-xl shadow-lg px-5 py-3 flex items-center justify-between gap-4 mb-4 animate-in">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 px-3 py-1 rounded-lg text-sm font-bold">
              {selectedIds.length} selected
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="text-white/80 hover:text-white text-xs underline underline-offset-2 cursor-pointer"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startBulkEmailFlow}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              title="Send bulk email"
            >
              <Mail size={15} /> Email
            </button>
            <button
              onClick={handleBulkWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              title="Send bulk WhatsApp"
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                title="Change status"
              >
                <RefreshCw size={15} /> Status
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 hidden group-hover:block z-50">
                {['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Joined', 'Rejected', 'Dropped'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleBulkStatusUpdate(s)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleShareClick(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/80 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              title="Share selected with team"
            >
              <Share2 size={15} /> Share
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              title="Delete selected"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-300">
              <th className="px-4 py-4 w-[50px] text-center">
                <div onClick={() => selectAll(filteredCandidates.map(c => c._id))} className="cursor-pointer flex justify-center">
                  {isAllSelected ? <CheckSquare size={18} className="text-white" /> : <Square size={18} className="text-gray-400" />}
                </div>
              </th>
              {tableColumns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap border-r border-gray-700"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {visibleCandidates.map((candidate, index) => (
              <tr key={candidate._id} className={`transition-colors ${selectedIds.includes(candidate._id) ? 'bg-indigo-50/60' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40`}>
                <td className="px-4 py-3 text-center w-[50px]">
                  <div onClick={() => toggleSelection(candidate._id)} className="cursor-pointer flex justify-center">
                    {selectedIds.includes(candidate._id) ? <CheckSquare className="text-indigo-600" size={17} /> : <Square className="text-gray-300 hover:text-gray-400" size={17} />}
                  </div>
                </td>
                {tableColumns.map((column) => (
                  <td
                    key={`${candidate._id}-${column.key}`}
                    className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200 font-medium"
                  >
                    {column.render(candidate, index)}
                  </td>
                ))}
              </tr>
            ))}
            {visibleCandidates.length === 0 && !isLoadingInitial && (
              <tr>
                <td colSpan={tableColumns.length + 1} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    {viewMode === 'shared' ? (
                      <>
                        <Share2 size={36} className="text-gray-300" />
                        <p className="text-sm font-medium text-gray-500">No shared candidates yet</p>
                        <p className="text-xs text-gray-400">When team members share candidates with you, they will appear here.</p>
                      </>
                    ) : searchQuery ? (
                      <>
                        <Search size={36} className="text-gray-300" />
                        <p className="text-sm font-medium text-gray-500">No candidates match your search</p>
                        <p className="text-xs text-gray-400">Try different keywords or clear the search filter</p>
                      </>
                    ) : (
                      <>
                        <Briefcase size={36} className="text-gray-300" />
                        <p className="text-sm font-medium text-gray-500">No candidates yet</p>
                        <p className="text-xs text-gray-400">Add candidates manually or use Auto Import to bring data from Excel</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Remark popover via portal so it is not cut off by table overflow */}
      {remarkPopover && createPortal(
        <div
          className="fixed z-[9999] w-64 max-w-[90vw] p-3 bg-white text-gray-800 text-xs rounded-lg shadow-xl border border-gray-200 whitespace-normal"
          style={{
            left: Math.max(8, Math.min(remarkPopover.left - 128, typeof window !== 'undefined' ? window.innerWidth - 264 : 0)),
            ...(remarkPopover.showAbove
              ? { top: Math.max(8, remarkPopover.top - 8), transform: 'translateY(-100%)' }
              : { top: remarkPopover.top + 24 })
          }}
          onMouseEnter={() => { if (remarkPopoverTimeoutRef.current) clearTimeout(remarkPopoverTimeoutRef.current); }}
          onMouseLeave={() => setRemarkPopover(null)}
        >
          {remarkPopover.showAbove ? (
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200" style={{ borderTopColor: 'white' }} />
          ) : (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white" />
          )}
          <div className="font-semibold text-gray-500 mb-1">Remark</div>
          <div className="leading-relaxed">{remarkPopover.remark}</div>
        </div>,
        document.body
      )}

      {/* Sentinel for lazy-loading more rows */}
      <div ref={loadMoreRef} />
      
      {/* PAGINATION */}
      <div className="flex items-center justify-between py-4 px-1">
        <p className="text-xs text-gray-500">
          Showing {visibleCandidates.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredCandidates.length)} of {filteredCandidates.length.toLocaleString()} candidates
        </p>
        <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalFilteredPages) }, (_, i) => {
                let page;
                if (totalFilteredPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalFilteredPages - 2) page = totalFilteredPages - 4 + i;
                else page = currentPage - 2 + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition ${page === currentPage ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            {currentPage < totalFilteredPages && (
              <button 
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Next
              </button>
            )}
        </div>
      </div>

{showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{editId ? '📝 Edit Profile' : '👤 Add New Candidate'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors p-1 rounded-lg hover:bg-red-50">&times;</button>
            </div>
            <form onSubmit={handleAddCandidate} className="space-y-6">
              
              {/* Resume Upload */}
              <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 bg-blue-50 text-center hover:bg-blue-100 transition-colors cursor-pointer relative">
                <input type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleInputChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center gap-3">
                  <Upload size={32} className="text-blue-600" />
                  <p className="font-semibold text-gray-800 text-sm">Click to upload resume (PDF, DOC, DOCX)</p>
                  {isAutoParsing && (
                    <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Parsing resume...
                    </div>
                  )}
                  {formData.resume && (
                    <p className="text-sm text-green-600 font-semibold">✅ {formData.resume.name || 'File selected'}</p>
                  )}
                </div>
              </div>

              {/* 📋 Basic Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-indigo-500">📋 Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Name <span className="text-red-500">*</span></label>
                    <input ref={fieldRefs.name} type="text" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="Full Name"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:outline-none transition-all text-sm font-medium ${formErrors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'}`} />
                    {formErrors.name && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Email <span className="text-red-500">*</span></label>
                    <input ref={fieldRefs.email} type="email" name="email" value={formData.email || ''} onChange={handleInputChange} placeholder="email@example.com"
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:outline-none transition-all text-sm font-medium ${formErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'}`} />
                    {formErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Contact <span className="text-red-500">*</span></label>
                    <div className={`flex w-full items-stretch border-2 rounded-lg focus-within:ring-2 focus-within:outline-none transition-all bg-white overflow-hidden ${formErrors.contact ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-200 bg-red-50' : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-100'}`}>
                      <select
                        className="px-3 py-2.5 bg-white text-sm font-semibold min-w-[92px] border-r border-gray-300 outline-none"
                        value={countryCode}
                        onChange={(e) => {
                          setCountryCode(e.target.value);
                          setFormData(prev => ({ ...prev, countryCode: e.target.value }));
                        }}
                      >
                        {countryCodes.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                      </select>
                      <input ref={fieldRefs.contact} type="tel" name="contact" value={formData.contact || ''} placeholder="1234567890"
                        onChange={(e) => {
                          let digitsOnly = e.target.value.replace(/\D/g, '');
                          if (digitsOnly.length > 10) digitsOnly = digitsOnly.slice(0, 10);
                          setFormData(prev => ({ ...prev, contact: digitsOnly }));
                          if (formErrors.contact) setFormErrors(prev => ({ ...prev, contact: '' }));
                        }}
                        className="flex-1 px-4 py-2.5 text-sm outline-none font-medium" maxLength="10" />
                    </div>
                    {formErrors.contact && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.contact}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Position</label>
                    <select name="position" value={formData.position || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select Position</option>
                      {masterPositions.map(pos => <option key={pos._id} value={pos.name}>{pos.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Company</label>
                    <input type="text" name="companyName" value={formData.companyName || ''} onChange={handleInputChange} placeholder="Company Name"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Location</label>
                    <input ref={fieldRefs.location} type="text" name="location" value={formData.location || ''} onChange={handleInputChange} placeholder="City/Region"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium" />
                  </div>
                </div>
              </div>

              {/* 💼 Experience & Compensation */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-indigo-500">💼 Experience & Compensation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Experience (Years)</label>
                    <select name="experience" value={formData.experience || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select</option>
                      <option value="Fresher">Fresher</option>
                      {[...Array(31).keys()].slice(1).map(num => <option key={num} value={num}>{num}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Current CTC (LPA) <span className="text-red-500">*</span></label>
                    <select ref={fieldRefs.ctc} name="ctc" value={formData.ctc || ''} onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:outline-none transition-all text-sm font-medium max-h-52 ${formErrors.ctc ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'}`}>
                      <option value="">Select CTC</option>
                      {ctcRanges.map(range => <option key={range} value={range}>{range}</option>)}
                    </select>
                    {formErrors.ctc && <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.ctc}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Expected CTC (LPA)</label>
                    <select name="expectedCtc" value={formData.expectedCtc || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium max-h-52">
                      <option value="">Select Expected CTC</option>
                      {expectedCtcOptions.map(range => <option key={range} value={range}>{range}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Notice Period</label>
                    <select name="noticePeriod" value={formData.noticePeriod || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select Notice Period</option>
                      {noticePeriodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">FLS/Non FLS</label>
                    <select name="fls" value={formData.fls || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select</option>
                      <option value="FLS">FLS</option>
                      <option value="Non-FLS">Non-FLS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Status</label>
                    <select name="status" value={formData.status || 'Applied'} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="Applied">Applied</option>
                      <option value="Screening">Screening</option>
                      <option value="Interview">Interview</option>
                      <option value="Offer">Offer</option>
                      <option value="Hired">Hired</option>
                      <option value="Joined">Joined</option>
                      <option value="Dropped">Dropped</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Interested">Interested</option>
                      <option value="Interested and scheduled">Interested and scheduled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 📝 Additional Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-indigo-500">📝 Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Client</label>
                    <select name="client" value={formData.client || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select Client</option>
                      {masterClients.map(client => <option key={client._id} value={client.name}>{client.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">SPOC</label>
                    <input ref={fieldRefs.spoc} type="text" name="spoc" value={formData.spoc || ''} onChange={handleInputChange} placeholder="SPOC Name"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Source of CV</label>
                    <select name="source" value={formData.source || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium">
                      <option value="">Select Source</option>
                      {masterSources.map(source => <option key={source._id} value={source.name}>{source.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Date</label>
                    <input type="date" name="date" value={formData.date || new Date().toISOString().split('T')[0]} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Call Back Date</label>
                    <input type="date" name="callBackDate" value={formData.callBackDate || ''} onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium" />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Remark</label>
                    <textarea name="remark" value={formData.remark || ''} onChange={handleInputChange} placeholder="e.g. Rejected due to salary mismatch, Not reachable, etc."
                      rows="2" className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all text-sm font-medium resize-none" />
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-6 border-t-2 border-gray-200 justify-center">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-8 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all text-sm min-w-[120px]">
                  Cancel
                </button>
                <button type="submit"
                  className="px-8 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all text-sm min-w-[160px]">
                  {editId ? 'Save Changes' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📧 EMAIL MODAL — Template-Powered */}
      {showEmailModal && emailRecipient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Mail className="text-indigo-600" size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {bulkEmailRecipients.length > 0 ? `📧 Bulk Email (${bulkEmailRecipients.length} recipients)` : 'Send Email'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {bulkEmailRecipients.length > 0 
                      ? `To: ${bulkEmailRecipients.map(c => c.name).join(', ')}`
                      : `To: ${emailRecipient.name} (${emailRecipient.email})`
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => {
                setShowEmailModal(false);
                setBulkEmailRecipients([]);
                setSelectedIds([]);
              }} className="p-2 hover:bg-gray-200 rounded-lg transition">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="space-y-4">

                {/* Channel Selector */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setEmailChannel('transactional')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${emailChannel === 'transactional' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Mail size={12} /> Transactional
                    </button>
                    <button
                      onClick={() => setEmailChannel('marketing')}
                      disabled={!channelsAvailable.marketing}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${emailChannel === 'marketing' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'} ${!channelsAvailable.marketing ? 'opacity-40 cursor-not-allowed' : ''}`}
                      title={!channelsAvailable.marketing ? 'Zoho Campaigns not configured' : 'Send via Zoho Campaigns (marketing)'}
                    >
                      <Megaphone size={12} /> Marketing
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    via {emailChannel === 'marketing' ? 'Zoho Campaigns' : 'ZeptoMail'}
                  </span>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    onClick={() => { setEmailMode('template'); setSelectedTemplate(null); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${emailMode === 'template' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >Use Template</button>
                  <button
                    onClick={() => setEmailMode('quick')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${emailMode === 'quick' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >Quick Send</button>
                </div>

                {/* CC / BCC - Gmail-style Chip Autocomplete */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
                  {/* CC Field */}
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">CC (Optional)</label>
                    <div className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white cursor-text"
                      onClick={() => document.getElementById('cc-input')?.focus()}>
                      {emailCC.map((email, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium max-w-[180px]">
                          <span className="truncate">{teamMembers.find(m => m.email === email)?.name || email}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setEmailCC(prev => prev.filter((_, idx) => idx !== i)); }}
                            className="hover:bg-indigo-200 rounded p-0.5 flex-shrink-0"><X size={10} /></button>
                        </span>
                      ))}
                      <input id="cc-input" type="text" value={ccInput}
                        onChange={(e) => { setCcInput(e.target.value); setShowCCPicker(true); setShowBCCPicker(false); }}
                        onFocus={() => { if (ccInput || teamMembers.length > 0) setShowCCPicker(true); setShowBCCPicker(false); }}
                        onBlur={() => setTimeout(() => setShowCCPicker(false), 200)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && ccInput.trim()) {
                            e.preventDefault();
                            const email = ccInput.trim().replace(/,$/, '');
                            if (email.includes('@') && !emailCC.includes(email.toLowerCase())) {
                              setEmailCC(prev => [...prev, email.toLowerCase()]);
                            }
                            setCcInput(''); setShowCCPicker(false);
                          } else if (e.key === 'Backspace' && !ccInput && emailCC.length > 0) {
                            setEmailCC(prev => prev.slice(0, -1));
                          }
                        }}
                        placeholder={emailCC.length === 0 ? (teamMembers.length > 0 ? "Type name or email..." : "email@example.com") : ""}
                        className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
                      />
                    </div>
                    {showCCPicker && (() => {
                      const q = ccInput.toLowerCase();
                      const filtered = teamMembers.filter(m =>
                        !emailCC.includes(m.email.toLowerCase()) &&
                        (q === '' || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
                      );
                      return filtered.length > 0 ? (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-36 overflow-y-auto">
                          {filtered.map(m => (
                            <button key={m._id} type="button"
                              onMouseDown={(e) => { e.preventDefault(); setEmailCC(prev => [...prev, m.email]); setCcInput(''); setShowCCPicker(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 transition-colors">
                              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-[9px] font-bold text-indigo-700">{m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                              </div>
                              {m.role && m.role !== 'Team Member' && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{m.role}</span>}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* BCC Field */}
                  <div className="relative">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">BCC (Optional)</label>
                    <div className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white cursor-text"
                      onClick={() => document.getElementById('bcc-input')?.focus()}>
                      {emailBCC.map((email, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium max-w-[180px]">
                          <span className="truncate">{teamMembers.find(m => m.email === email)?.name || email}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setEmailBCC(prev => prev.filter((_, idx) => idx !== i)); }}
                            className="hover:bg-amber-200 rounded p-0.5 flex-shrink-0"><X size={10} /></button>
                        </span>
                      ))}
                      <input id="bcc-input" type="text" value={bccInput}
                        onChange={(e) => { setBccInput(e.target.value); setShowBCCPicker(true); setShowCCPicker(false); }}
                        onFocus={() => { if (bccInput || teamMembers.length > 0) setShowBCCPicker(true); setShowCCPicker(false); }}
                        onBlur={() => setTimeout(() => setShowBCCPicker(false), 200)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && bccInput.trim()) {
                            e.preventDefault();
                            const email = bccInput.trim().replace(/,$/, '');
                            if (email.includes('@') && !emailBCC.includes(email.toLowerCase())) {
                              setEmailBCC(prev => [...prev, email.toLowerCase()]);
                            }
                            setBccInput(''); setShowBCCPicker(false);
                          } else if (e.key === 'Backspace' && !bccInput && emailBCC.length > 0) {
                            setEmailBCC(prev => prev.slice(0, -1));
                          }
                        }}
                        placeholder={emailBCC.length === 0 ? (teamMembers.length > 0 ? "Type name or email..." : "email@example.com") : ""}
                        className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
                      />
                    </div>
                    {showBCCPicker && (() => {
                      const q = bccInput.toLowerCase();
                      const filtered = teamMembers.filter(m =>
                        !emailBCC.includes(m.email.toLowerCase()) &&
                        (q === '' || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
                      );
                      return filtered.length > 0 ? (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-36 overflow-y-auto">
                          {filtered.map(m => (
                            <button key={m._id} type="button"
                              onMouseDown={(e) => { e.preventDefault(); setEmailBCC(prev => [...prev, m.email]); setBccInput(''); setShowBCCPicker(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50 transition-colors">
                              <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-[9px] font-bold text-amber-700">{m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                              </div>
                              {m.role && m.role !== 'Team Member' && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{m.role}</span>}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* ═══ TEMPLATE MODE ═══ */}
                {emailMode === 'template' && (
                  <>
                    {/* Template Selection */}
                    {!selectedTemplate ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Choose a Template</label>
                        {emailTemplates.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                            <Mail size={24} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">Loading templates...</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                            {emailTemplates.map(t => {
                              const catColors = {
                                hiring: 'border-indigo-200 bg-indigo-50/50', interview: 'border-cyan-200 bg-cyan-50/50',
                                rejection: 'border-red-200 bg-red-50/50', onboarding: 'border-green-200 bg-green-50/50',
                                document: 'border-amber-200 bg-amber-50/50', custom: 'border-purple-200 bg-purple-50/50'
                              };
                              const catIcons = { hiring: '💼', interview: '📞', rejection: '❌', onboarding: '🎉', document: '📄', custom: '✏️' };
                              return (
                                <button
                                  key={t._id}
                                  onClick={() => selectEmailTemplate(t)}
                                  className={`text-left p-3 rounded-lg border-2 hover:shadow-sm transition-all ${catColors[t.category] || catColors.custom}`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm">{catIcons[t.category] || '✏️'}</span>
                                    <h4 className="text-xs font-bold text-gray-900 truncate">{t.name}</h4>
                                  </div>
                                  <p className="text-[10px] text-gray-500 line-clamp-2">{t.subject}</p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Selected template header */}
                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
                          <div>
                            <p className="text-xs font-bold text-indigo-700">{selectedTemplate.name}</p>
                            <p className="text-[10px] text-indigo-500">{selectedTemplate.subject}</p>
                          </div>
                          <button onClick={() => setSelectedTemplate(null)} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 hover:bg-indigo-100 rounded">
                            Change
                          </button>
                        </div>

                        {/* Variable Inputs */}
                        {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">Fill Template Details</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {selectedTemplate.variables.map(v => {
                                const labels = {
                                  candidateName: 'Candidate Name', position: 'Position / Role', company: 'Company Name',
                                  ctc: 'CTC / Salary', experience: 'Experience Required', location: 'Location',
                                  date: 'Date', time: 'Time', venue: 'Venue / Address', spoc: 'SPOC Name'
                                };
                                return (
                                  <div key={v}>
                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">{labels[v] || v}</label>
                                    {v === 'time' ? (
                                      <select
                                        value={(() => { const t = templateVars[v]; if (!t) return ''; const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return ''; let h = parseInt(m[1]); const ampm = m[3].toUpperCase(); if (ampm === 'PM' && h !== 12) h += 12; if (ampm === 'AM' && h === 12) h = 0; return `${String(h).padStart(2,'0')}:${m[2]}`; })()}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val) {
                                            const [h, m] = val.split(':');
                                            const hr = parseInt(h);
                                            const ampm = hr >= 12 ? 'PM' : 'AM';
                                            const hr12 = hr % 12 || 12;
                                            setTemplateVars(prev => ({ ...prev, [v]: `${hr12}:${m} ${ampm}` }));
                                          } else {
                                            setTemplateVars(prev => ({ ...prev, [v]: '' }));
                                          }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                      >
                                        <option value="">Select time</option>
                                        {Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i / 2); const m = i % 2 === 0 ? '00' : '30'; const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return <option key={i} value={`${String(h).padStart(2,'0')}:${m}`}>{`${h12}:${m} ${ampm}`}</option>; })}
                                      </select>
                                    ) : (
                                      <input
                                        type={v === 'date' ? 'date' : 'text'}
                                        value={templateVars[v] || ''}
                                        onChange={(e) => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                                        placeholder={labels[v] || v}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Live Preview */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-2">Email Preview</label>
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-indigo-600 px-4 py-2.5">
                              <p className="text-white text-xs font-semibold">
                                {(() => {
                                  let subj = selectedTemplate.subject;
                                  Object.entries(templateVars).forEach(([k, v]) => { subj = subj.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`); });
                                  return subj;
                                })()}
                              </p>
                            </div>
                            <div className="p-4 bg-white max-h-48 overflow-y-auto">
                              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                                {(() => {
                                  let body = selectedTemplate.body;
                                  Object.entries(templateVars).forEach(([k, v]) => { body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`); });
                                  return body;
                                })()}
                              </div>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                              <p className="text-[9px] text-gray-400">Sent via SkillNix PCHR</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ═══ QUICK SEND MODE ═══ */}
                {emailMode === 'quick' && (
                  <>
                    {/* Email Type */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Type</label>
                      <select
                        value={emailType}
                        onChange={(e) => { setEmailType(e.target.value); setShowQuickPreview(false); }}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                      >
                        <option value="interview">📞 Interview Invitation</option>
                        <option value="rejection">❌ Rejection Letter</option>
                        <option value="document">📄 Document Request</option>
                        <option value="onboarding">🎯 Onboarding Welcome</option>
                        <option value="custom">✏️ Custom Message</option>
                      </select>
                    </div>

                    {/* Editable Candidate Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Candidate Name</label>
                        <input
                          type="text"
                          value={quickName}
                          onChange={(e) => { setQuickName(e.target.value); setShowQuickPreview(false); }}
                          placeholder="Candidate name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Position / Role</label>
                        <input
                          type="text"
                          value={quickPosition}
                          onChange={(e) => { setQuickPosition(e.target.value); setShowQuickPreview(false); }}
                          placeholder="Position applied for"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Onboarding-specific fields */}
                    {emailType === 'onboarding' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Department</label>
                          <input
                            type="text"
                            value={quickDepartment}
                            onChange={(e) => { setQuickDepartment(e.target.value); setShowQuickPreview(false); }}
                            placeholder="e.g. Engineering, HR, Sales"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Joining Date</label>
                          <input
                            type="date"
                            value={quickJoiningDate}
                            onChange={(e) => { setQuickJoiningDate(e.target.value); setShowQuickPreview(false); }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Custom Message */}
                    {emailType === 'custom' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Custom Message</label>
                        <textarea
                          value={customMessage}
                          onChange={(e) => { setCustomMessage(e.target.value); setShowQuickPreview(false); }}
                          placeholder="Enter your custom message here..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                        />
                      </div>
                    )}

                    {/* Preview Toggle */}
                    <div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (showQuickPreview) {
                            setShowQuickPreview(false);
                            return;
                          }
                          setLoadingPreview(true);
                          try {
                            const resp = await authenticatedFetch(`${BASE_API_URL}/api/email/preview`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                name: quickName || emailRecipient?.name || 'Candidate',
                                position: quickPosition || emailRecipient?.position || 'Position',
                                emailType,
                                customMessage,
                                department: quickDepartment || 'N/A',
                                joiningDate: quickJoiningDate || 'TBD'
                              })
                            });
                            const data = await resp.json();
                            if (data.success) {
                              setQuickPreviewHtml(data.html);
                              setQuickPreviewSubject(data.subject);
                              setShowQuickPreview(true);
                            } else {
                              toast.error('Failed to load preview');
                            }
                          } catch (err) {
                            console.error('Preview error:', err);
                            toast.error('Failed to generate preview');
                          } finally {
                            setLoadingPreview(false);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all
                          ${showQuickPreview ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}"
                        disabled={loadingPreview}
                      >
                        {loadingPreview ? (
                          <><div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" /> Generating...</>
                        ) : (
                          <><Eye size={14} /> {showQuickPreview ? 'Hide Preview' : 'Preview Email'}</>
                        )}
                      </button>
                    </div>

                    {/* Live Preview Panel */}
                    {showQuickPreview && quickPreviewHtml && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
                          <p className="text-white text-xs font-semibold">{quickPreviewSubject}</p>
                          <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full">Preview</span>
                        </div>
                        <div className="bg-white">
                          <iframe
                            srcDoc={quickPreviewHtml}
                            title="Email Preview"
                            className="w-full border-0"
                            style={{ height: '260px' }}
                            sandbox=""
                          />
                        </div>
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <p className="text-[9px] text-gray-400">Sent via SkillNix PCHR</p>
                          <p className="text-[9px] text-gray-400">To: {emailRecipient?.email}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition text-sm"
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={emailMode === 'template' ? sendTemplateEmail : sendSingleEmail}
                disabled={isSendingEmail || (emailMode === 'template' && !selectedTemplate) || (emailMode === 'quick' && emailType === 'custom' && !customMessage.trim())}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isSendingEmail ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ===================== DUPLICATES MODAL ===================== */}
      {showDuplicatesModal && duplicateRecords.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={28} />
                Duplicate Records ({duplicateRecords.length})
              </h2>
              <button onClick={() => setShowDuplicatesModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">These records were detected as duplicates and were not imported:</p>
              
              {/* Duplicates Table */}
              <div className="overflow-x-auto border-2 border-red-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b-2 border-red-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Position</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700">Company</th>
                      <th className="px-4 py-3 text-left font-bold text-red-700 whitespace-nowrap">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-red-100 hover:bg-red-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-700">{record.row}</td>
                        <td className="px-4 py-3 text-gray-700">{record.name}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{record.email}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{record.contact}</td>
                        <td className="px-4 py-3 text-gray-700">{record.position}</td>
                        <td className="px-4 py-3 text-gray-700">{record.company}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                            🔄 {record.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-800 font-semibold mb-2">💡 Why were these marked as duplicates?</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li><strong>Duplicate Email:</strong> The same email address appeared more than once in your file</li>
                  <li><strong>Duplicate Contact:</strong> The same phone number appeared more than once in your file</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDuplicatesModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy duplicates to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Position,Company,Reason'].concat(
                      duplicateRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.position}","${r.company}","${r.reason}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    toast.success('Duplicates copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CORRECTIONS MODAL (Field Misalignment Fixes) ===================== */}
      {showCorrectionsModal && correctionRecords.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <RefreshCw className="text-green-600" size={28} />
                Field Corrections ({correctionRecords.length})
              </h2>
              <button onClick={() => setShowCorrectionsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">🎯 These records had misaligned fields (e.g., email in wrong column) that were automatically corrected:</p>
              
              {/* Corrections Table */}
              <div className="overflow-x-auto border-2 border-green-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 border-b-2 border-green-200 sticky top-12">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Row</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Email</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700">Contact</th>
                      <th className="px-4 py-3 text-left font-bold text-green-700 whitespace-nowrap">Corrections Made</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctionRecords.map((record, idx) => (
                      <tr key={idx} className="border-b border-green-100 hover:bg-green-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-700">{record.row}</td>
                        <td className="px-4 py-3 text-gray-700">{record.name}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs bg-green-50 p-2 rounded">{record.email}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs bg-green-50 p-2 rounded">{record.contact}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {record.corrections.map((correction, cIdx) => (
                              <div key={cIdx} className="bg-green-100 text-green-800 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap">
                                ✅ {correction.description}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800 font-semibold mb-2">✅ What was corrected?</p>
                <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li><strong>Email ↔ Contact Swapped:</strong> Email field had phone number and Contact field had email - they were automatically swapped</li>
                  <li><strong>Field Moved:</strong> A field contained data of wrong type (e.g., Name had email) - data was moved to correct field</li>
                  <li><strong>Misaligned:</strong> Field contains data of wrong type for that column</li>
                </ul>
                <p className="text-xs text-green-700 mt-3 italic">💡 All corrections were made automatically during import</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrectionsModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Copy corrections to clipboard as CSV
                    const csv = ['Row,Name,Email,Contact,Corrections'].concat(
                      correctionRecords.map(r => 
                        `${r.row},"${r.name}","${r.email}","${r.contact}","${r.corrections.map(c => c.description).join('; ')}"`
                      )
                    ).join('\n');
                    navigator.clipboard.writeText(csv);
                    toast.success('Field corrections copied to clipboard as CSV');
                  }}
                  className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transition"
                >
                  📋 Copy as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BULK EMAIL WORKFLOW MODAL - DEPRECATED (use single email modal instead) ===================== */}
      {false && bulkEmailStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* SELECT STEP */}
            {bulkEmailStep === 'select' && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Bulk Email Manager</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Send professional emails to multiple candidates</p>
                  </div>
                  <button 
                    onClick={closeBulkEmailFlow}
                    className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Email Type Selection */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      Step 1: Select Email Type
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { value: 'interview', label: 'Interview Call', icon: '📞' },
                        { value: 'offer', label: 'Offer Letter', icon: '💼' },
                        { value: 'rejection', label: 'Rejection', icon: '❌' },
                        { value: 'document', label: 'Documents', icon: '📄' },
                        { value: 'onboarding', label: 'Onboarding', icon: '🎯' },
                        { value: 'custom', label: 'Custom', icon: '✏️' },
                      ].map((opt) => (
                        <label key={opt.value} className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          emailType === opt.value
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <input
                            type="radio"
                            name="emailType"
                            value={opt.value}
                            checked={emailType === opt.value}
                            onChange={(e) => setEmailType(e.target.value)}
                            className="absolute opacity-0"
                          />
                          <div className="text-center">
                            <div className="text-2xl mb-1.5">{opt.icon}</div>
                            <div className={`text-sm font-semibold ${emailType === opt.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                              {opt.label}
                            </div>
                          </div>
                          {emailType === opt.value && (
                            <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Candidates</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email).length}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Valid Emails</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {candidates.filter(c => selectedIds.includes(c._id) && c.email && c.email.includes('@')).length}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Selected</div>
                      <div className="text-2xl font-bold text-indigo-600">{selectedEmails.size}</div>
                    </div>
                  </div>

                  {/* Candidate Selection Table */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">
                      Step 2: Select Recipients
                    </h3>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-center w-12">
                                <input 
                                  type="checkbox" 
                                  checked={selectedEmails.size === candidates.filter(c => selectedIds.includes(c._id) && c.email).length && selectedEmails.size > 0}
                                  onChange={selectAllEmails}
                                  className="w-4 h-4 cursor-pointer accent-indigo-600"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Position</th>
                              <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidates
                              .filter(c => selectedIds.includes(c._id) && c.email)
                              .map((candidate) => (
                                <tr key={candidate._id} className="border-b border-gray-100 hover:bg-gray-50/60 transition">
                                  <td className="px-4 py-3 text-center">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedEmails.has(candidate.email)}
                                      onChange={() => toggleEmailSelection(candidate.email)}
                                      className="w-4 h-4 cursor-pointer accent-indigo-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{candidate.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{candidate.email}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{candidate.position || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                      candidate.status === 'Hired' || candidate.status === 'Joined' ? 'bg-green-100 text-green-700' :
                                      candidate.status === 'Rejected' || candidate.status === 'Dropped' ? 'bg-red-100 text-red-700' :
                                      candidate.status === 'Interview' ? 'bg-purple-100 text-purple-700' :
                                      candidate.status === 'Offer' ? 'bg-cyan-100 text-cyan-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {candidate.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {selectedEmails.size === 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-amber-800 font-medium">Please select at least one recipient to continue</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-5 border-t border-gray-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => setBulkEmailStep('confirm')}
                      disabled={selectedEmails.size === 0}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition text-sm font-semibold ${
                        selectedEmails.size === 0 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      Next: Confirm
                      <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                        {selectedEmails.size} selected
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONFIRM STEP */}
            {bulkEmailStep === 'confirm' && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Confirm Sending</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Review your campaign before sending</p>
                  </div>
                  <button 
                    onClick={closeBulkEmailFlow}
                    className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Campaign Summary */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
                    <div className="text-center mb-5">
                      <p className="text-lg font-bold text-gray-900">
                        Ready to send <span className="text-indigo-600">{selectedEmails.size}</span> emails
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-5">
                      <span className="text-sm text-gray-500">Email Type:</span>
                      <span className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
                        {emailType === 'interview' ? '📞 Interview Call' :
                         emailType === 'offer' ? '💼 Offer Letter' :
                         emailType === 'rejection' ? '❌ Rejection' :
                         emailType === 'document' ? '📄 Document Collection' :
                         emailType === 'onboarding' ? '🎯 Onboarding' :
                         '✏️ Custom Email'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Processing</div>
                        <div className="text-sm font-bold text-gray-900">Batch Mode</div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Est. Time</div>
                        <div className="text-sm font-bold text-gray-900">~{Math.ceil(selectedEmails.size / 5)}s</div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                        <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Service</div>
                        <div className="text-sm font-bold text-gray-900">AWS SES</div>
                      </div>
                    </div>

                    <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <p className="text-xs text-blue-700 font-medium">
                        Each email will be sent once. Make sure all information is correct before proceeding.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-5 border-t border-gray-200">
                    <button 
                      onClick={() => setBulkEmailStep('select')}
                      className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConfirmSend}
                      disabled={isSendingEmail}
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingEmail ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send All Emails Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SENDING STEP */}
            {bulkEmailStep === 'sending' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Sending In Progress</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Please wait while we send your emails...</p>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-900 mb-4">
                      Sending {campaignStatus.totalEmails} emails
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-500">Overall Progress</span>
                        <span className="text-sm font-bold text-indigo-600">
                          {Math.min(100, Math.round(((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100))}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                          style={{ width: `${Math.min(100, ((campaignStatus.completed + campaignStatus.failed) / campaignStatus.totalEmails) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{campaignStatus.completed + campaignStatus.failed} / {campaignStatus.totalEmails} processed</p>
                    </div>

                    {/* Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Queued</div>
                        <div className="text-2xl font-bold text-gray-900">{campaignStatus.waiting || 0}</div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Processing</div>
                        <div className="text-2xl font-bold text-gray-900">{campaignStatus.processing || 0}</div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-green-600 uppercase mb-1">Sent</div>
                        <div className="text-2xl font-bold text-green-700">{campaignStatus.completed || 0}</div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="text-xs font-semibold text-red-600 uppercase mb-1">Failed</div>
                        <div className="text-2xl font-bold text-red-700">{campaignStatus.failed || 0}</div>
                      </div>
                    </div>

                    <div className="text-center mt-5">
                      <div className="inline-flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-600 font-medium">Processing emails... Please wait</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESULTS STEP */}
            {bulkEmailStep === 'results' && campaignStatus && (
              <div>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Campaign Complete</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Your bulk email campaign has finished processing</p>
                </div>

                <div className="p-6">
                  {/* Success Banner */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-800 mb-1">All Emails Processed</h3>
                    <p className="text-sm text-green-700">Campaign completed successfully</p>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Emails</div>
                      <div className="text-3xl font-bold text-gray-900">{campaignStatus.totalEmails || 0}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Successfully Sent</div>
                      <div className="text-3xl font-bold text-green-700">{campaignStatus.completed || 0}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                      <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Failed</div>
                      <div className="text-3xl font-bold text-red-700">{campaignStatus.failed || 0}</div>
                    </div>
                  </div>

                  {/* Success Rate */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Success Rate</div>
                        <div className="text-sm text-gray-600">Overall campaign performance</div>
                      </div>
                      <div className="text-3xl font-bold text-indigo-600">
                        {campaignStatus.successRate || '0%'}
                      </div>
                    </div>
                  </div>

                  {/* Email Type */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="text-sm text-gray-500">Email Type:</span>
                    <span className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
                      {emailType === 'interview' ? '📞 Interview Call' :
                       emailType === 'offer' ? '💼 Offer Letter' :
                       emailType === 'rejection' ? '❌ Rejection' :
                       emailType === 'document' ? '📄 Document Collection' :
                       emailType === 'onboarding' ? '🎯 Onboarding' :
                       '✏️ Custom Email'}
                    </span>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-center pt-5 border-t border-gray-200">
                    <button 
                      onClick={closeBulkEmailFlow}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ✅ REVIEW & FIX MODAL */}
      {showReviewModal && reviewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Review & Import Candidates</h1>
                <p className="text-sm text-gray-500 mt-0.5">Ready: {reviewData.ready?.length || 0} | Review: {reviewData.review?.length || 0} | Blocked: {reviewData.blocked?.length || 0}</p>
              </div>
              <button 
                onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }} 
                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 px-6 py-3 border-b border-gray-200">
              {[
                { key: 'ready', label: `Ready (${reviewData.ready?.length || 0})`, color: 'text-green-700' },
                { key: 'review', label: `Review (${reviewData.review?.length || 0})`, color: 'text-amber-700' },
                { key: 'blocked', label: `Blocked (${reviewData.blocked?.length || 0})`, color: 'text-red-700' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setReviewFilter(tab.key); setEditingRow(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    reviewFilter === tab.key 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-white p-6 min-h-80 max-h-[65vh] overflow-y-auto">
              {(() => {
                let categoryData;
                if (reviewFilter === 'ready') {
                  categoryData = reviewData.ready;
                } else if (reviewFilter === 'review') {
                  categoryData = reviewData.review;
                } else if (reviewFilter === 'blocked') {
                  categoryData = reviewData.blocked;
                } else { // 'all' - show all records
                  categoryData = [
                    ...(reviewData.ready || []),
                    ...(reviewData.review || []),
                    ...(reviewData.blocked || [])
                  ];
                }
                
                if (!categoryData || categoryData.length === 0) {
                  return <p className="text-gray-400 text-center py-12 text-sm">No records in this category</p>;
                }

                return (
                  <div className="space-y-4">
                    {/* Records Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Position</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">CTC</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Confidence</th>
                            <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.map((row, idx) => (
                            <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50/60 transition ${
                              row.validation.category === 'ready' ? 'bg-green-50/50' :
                              row.validation.category === 'review' ? 'bg-amber-50/50' :
                              'bg-red-50/50'
                            }`}>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.fixed?.name || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.fixed?.email || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.fixed?.contact || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.fixed?.position || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.fixed?.ctc ? `${row.fixed.ctc} LPA` : '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.fixed?.status || '-'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  row.validation.confidence >= 80 ? 'bg-green-200 text-green-800' :
                                  row.validation.confidence >= 50 ? 'bg-amber-200 text-amber-800' :
                                  'bg-red-200 text-red-800'
                                }`}>
                                  {row.validation.confidence}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setEditingRow(row)}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold"
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Editing Panel */}
                    {editingRow && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
                          <h3 className="text-lg font-bold text-gray-900 mb-5">Edit Record — {editingRow.fixed?.name}</h3>
                          
                          <div className="grid grid-cols-3 gap-3 mb-5">
                            {[
                              { field: 'name', label: 'Name', type: 'text' },
                              { field: 'email', label: 'Email', type: 'email' },
                              { field: 'contact', label: 'Contact', type: 'tel' },
                              { field: 'position', label: 'Position', type: 'text' },
                              { field: 'experience', label: 'Experience', type: 'text' },
                              { field: 'ctc', label: 'CTC (LPA)', type: 'text' },
                              { field: 'expectedCtc', label: 'Expected CTC', type: 'text' },
                              { field: 'noticePeriod', label: 'Notice Period', type: 'text' },
                              { field: 'companyName', label: 'Company', type: 'text' },
                              { field: 'location', label: 'Location', type: 'text' },
                              { field: 'client', label: 'Client', type: 'text' },
                              { field: 'source', label: 'Source', type: 'text' },
                              { field: 'fls', label: 'FLS/Non FLS', type: 'text' },
                              { field: 'spoc', label: 'SPOC', type: 'text' },
                              { field: 'date', label: 'Date', type: 'date' },
                              { field: 'status', label: 'Status', type: 'select' }
                            ].map(({ field, label, type }) => (
                              <div key={field}>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
                                {type === 'select' ? (
                                  <select
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(e) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: e.target.value } })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="">Select Status</option>
                                    {['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Interested', 'Interested and scheduled'].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={type}
                                    value={editingRow.fixed?.[field] || ''}
                                    onChange={(e) => setEditingRow({ ...editingRow, fixed: { ...editingRow.fixed, [field]: e.target.value } })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                  />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Validation Summary */}
                          {editingRow.validation && (
                            <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
                              {editingRow.validation.errors?.length > 0 && (
                                <div className="mb-3">
                                  <p className="font-bold text-red-700 mb-1">❌ Errors:</p>
                                  {editingRow.validation.errors.map((e, i) => (
                                    <p key={i} className="text-sm text-red-600">• {e.field}: {e.message}</p>
                                  ))}
                                </div>
                              )}
                              {editingRow.validation.warnings?.length > 0 && (
                                <div>
                                  <p className="font-bold text-amber-700 mb-1">⚠️ Warnings:</p>
                                  {editingRow.validation.warnings.map((w, i) => (
                                    <p key={i} className="text-sm text-amber-600">• {w.field}: {w.message}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleSaveEditedRecord()}
                              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                            >
                              Save & Import
                            </button>
                            <button
                              onClick={() => handleRevalidateRecord(editingRow)}
                              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                            >
                              Re-validate
                            </button>
                            <button
                              onClick={() => setEditingRow(null)}
                              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Import Confirmation Modal */}
            {importConfirmation?.show && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Imported Successfully</h3>
                    <p className="text-sm text-gray-600">
                      <strong>{importConfirmation.candidateName}</strong> has been saved to the database.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setImportConfirmation(null);
                      setReviewFilter('ready');
                    }}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 justify-end">
              <button
                onClick={() => { setShowReviewModal(false); setReviewData(null); setEditingRow(null); }}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={handleImportReviewed}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
              >
                Import All Ready Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Excel Confirmation Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDownloadModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Download size={20} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Download Excel</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {selectedIds.length > 0 
                ? `You have selected ${selectedIds.length} candidate(s). Do you want to download their data as Excel?`
                : `No candidates selected. This will download all ${filteredCandidates.length} displayed candidate(s) as Excel.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const toDownload = selectedIds.length > 0 
                    ? filteredCandidates.filter(c => selectedIds.includes(c._id))
                    : filteredCandidates;
                  const data = toDownload.map(c => ({
                    'Name': c.name || '',
                    'Email': c.email || '',
                    'Contact': c.contact || '',
                    'Company': c.companyName || '',
                    'Position': c.position || '',
                    'Location': c.location || '',
                    'Experience': c.experience || '',
                    'Current CTC': c.ctc || '',
                    'Expected CTC': c.expectedCtc || '',
                    'Notice Period': c.noticePeriod || '',
                    'Status': c.status || '',
                    'Client': c.client || '',
                    'SPOC': c.spoc || '',
                    'Source': c.source || '',
                    'FLS': c.fls || '',
                    'Date': c.date ? new Date(c.date).toLocaleDateString('en-IN') : '',
                    'Remark': c.remark || ''
                  }));
                  const ws = XLSX.utils.json_to_sheet(data);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
                  ws['!cols'] = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, ...data.map(r => String(r[key]).length)) + 2 }));
                  XLSX.writeFile(wb, `Candidates_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
                  toast.success(`Downloaded ${toDownload.length} candidate(s) to Excel`);
                  setShowDownloadModal(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition flex items-center gap-2"
              >
                <Download size={16} /> Download {selectedIds.length > 0 ? `${selectedIds.length} Selected` : 'All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Preview Modal */}
      {previewResumeUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={closeResumePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Resume Preview</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2">
                  <Download size={16} /> Download
                </button>
                <button onClick={closeResumePreview} className="p-2 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 flex items-center justify-center">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-gray-500 font-medium">Loading preview...</p>
                </div>
              ) : previewResumeError === 'file_not_found' ? (
                <div className="flex flex-col items-center gap-4 p-6 text-center max-w-md">
                  <AlertCircle size={40} className="text-amber-500" />
                  <p className="text-gray-700 font-medium">Resume file not found on this server</p>
                  <p className="text-sm text-gray-500">
                    The file may have been uploaded on the live site. View it there, or re-upload the resume for this candidate here.
                  </p>
                  <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Try Download
                  </button>
                </div>
              ) : previewBlobUrl && (previewBlobUrl.startsWith('http') || previewBlobUrl.startsWith('blob:')) ? (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full border-0"
                  title="Resume Preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle size={32} className="text-red-400" />
                  <p className="text-gray-500 font-medium">Unable to preview this file</p>
                  <button type="button" onClick={() => previewResumeCandidate && handleResumeDownload(previewResumeCandidate)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Download Instead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (reusable for delete, status, whatsapp, etc.) */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isLoading={confirmModal.isLoading}
      />

      {/* Import shared candidates: confirm */}
      {showImportSharedConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setShowImportSharedConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Import shared candidates</h3>
            <p className="text-gray-600 mb-6">
              Import {getIdsToImportShared().length} shared candidate(s) to your database? They will be copied to All Candidates.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportSharedConfirm(false)} className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleImportSharedToMine} disabled={isImportingShared} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Import all from database: confirm */}
      {showImportAllConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setShowImportAllConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Import all candidates from database</h3>
            <p className="text-gray-600 mb-6">
              Copy every candidate in the database into your list? Candidates you already own will be skipped. This adds all others as &ldquo;My candidates&rdquo;.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportAllConfirm(false)} className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleImportAllToMine} disabled={isImportingAll} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {isImportingAll ? 'Importing...' : 'Import all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import all from database: success */}
      {importAllSuccess !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Candidates imported</h3>
            <p className="text-gray-600 mb-6">{Number(importAllSuccess.imported) || 0} candidate(s) have been added to your database. You can find them under &ldquo;Show only mine&rdquo; or &ldquo;View all&rdquo;.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setImportAllSuccess(null)} className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors">Stay here</button>
              <button onClick={() => { setImportAllSuccess(null); fetchData(1, { search: '', position: '' }); }} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">Go to All Candidates</button>
            </div>
          </div>
        </div>
      )}

      {/* Import shared candidates: success */}
      {importSharedSuccess !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Candidates imported</h3>
            <p className="text-gray-600 mb-6">{Number(importSharedSuccess.imported) || 0} shared candidate(s) have been added to your database.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setImportSharedSuccess(null); }} className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors">Stay here</button>
              <button onClick={() => { setImportSharedSuccess(null); fetchData(1, { search: '', position: '' }); }} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">Go to All Candidates</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Candidate Modal - Member Selection */}
      {showShareModal && !showShareConfirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Share Candidate{selectedCandidatesForShare.length > 1 ? 's' : ''}</h3>
              <button onClick={() => { setShowShareModal(false); setShowShareConfirmation(false); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              {selectedCandidatesForShare.length === 1 ? (
                <>Share <span className="font-semibold text-gray-900">{shareCandidate?.fullName || shareCandidate?.name || 'candidate'}</span> with team members</>
              ) : (
                <>Share <span className="font-semibold text-gray-900">{selectedCandidatesForShare.length} candidates</span> with team members</>
              )}
            </p>

            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {teamMembers && teamMembers.length > 0 ? (
                teamMembers.map((member) => (
                  <label key={member._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedShareMembers.includes(member._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedShareMembers([...selectedShareMembers, member._id]);
                        } else {
                          setSelectedShareMembers(selectedShareMembers.filter(id => id !== member._id));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                    {member.role && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded whitespace-nowrap">
                        {member.role}
                      </span>
                    )}
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No team members available</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowShareModal(false); setShowShareConfirmation(false); }}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareCandidate}
                disabled={selectedShareMembers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Share2 size={16} />
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {showShareConfirmation && selectedShareMembers.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setShowShareConfirmation(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Confirm Share</h3>
              <button onClick={() => setShowShareConfirmation(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Candidates being shared */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-2">CANDIDATES ({selectedCandidatesForShare.length})</p>
                <div className="space-y-2">
                  {selectedCandidatesForShare.length === 1 && shareCandidate ? (
                    <p className="text-sm text-blue-800">{shareCandidate.fullName || shareCandidate.name || 'Unknown'}</p>
                  ) : (
                    <p className="text-sm text-blue-800">{selectedCandidatesForShare.length} candidates selected</p>
                  )}
                </div>
              </div>

              {/* Team members being shared with */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-900 mb-2">SHARING WITH ({selectedShareMembers.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {teamMembers && teamMembers.filter(m => selectedShareMembers.includes(m._id)).map((member) => (
                    <div key={member._id} className="text-sm text-green-800">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-green-700">{member.email}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500">Once shared, team members can view and interact with these candidates. This action cannot be undone.</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowShareConfirmation(false)}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleShareCandidate}
                disabled={isSharingCandidate}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSharingCandidate ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    Confirm Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

ATS.displayName = 'ATS';

export default ATS;




