import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Search, Plus, LayoutGrid, List, Star, Clock, 
  MapPin, Phone, Mail, Briefcase, FileText, 
  ChevronRight, X, User, Calendar, CheckCircle2, 
  AlertCircle, GripVertical, ChevronDown, Check,
  Activity, ArrowRight, XCircle, Award, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import API_URL from '../config';

const STAGES = [
  { id: 'Applied', label: 'Applied', color: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', icon: FileText },
  { id: 'Screening', label: 'Screening', color: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', icon: Target },
  { id: 'Interview', label: 'Interview', color: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700', icon: Calendar },
  { id: 'Offer', label: 'Offer', color: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', icon: Award },
  { id: 'Hired', label: 'Hired', color: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700', icon: CheckCircle2 }
];

const STAGE_IDS = STAGES.map(s => s.id);

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

export default function ApplicationsPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStage: {}, avgTime: 'N/A' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  
  const [selectedApp, setSelectedApp] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  
  const [toast, setToast] = useState(null);

  // Drag & Drop State
  const [draggedAppId, setDraggedAppId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId);
    } else {
      setApplications([]);
    }
  }, [selectedJobId]);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/applications/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data || { total: 0, byStage: {}, avgTime: 'N/A' });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchApplications = async (jobId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/applications?jobId=${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data || []);
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      showToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (appId, newStage) => {
    // Optimistic update
    const previousApps = [...applications];
    setApplications(prev => prev.map(app => 
      app._id === appId ? { ...app, stage: newStage } : app
    ));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/applications/${appId}/stage`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: newStage })
      });
      
      if (!res.ok) throw new Error('Failed to update stage');
      
      showToast(`Application moved to ${newStage}`);
      fetchStats();
      
      // Update selected app if it's open
      if (selectedApp && selectedApp._id === appId) {
        setSelectedApp({ ...selectedApp, stage: newStage });
      }
      
    } catch (err) {
      console.error(err);
      setApplications(previousApps); // Revert
      showToast('Failed to move application', 'error');
    }
  };

  const handleRatingChange = async (appId, rating) => {
    // Optimistic update
    const previousApps = [...applications];
    setApplications(prev => prev.map(app => 
      app._id === appId ? { ...app, rating } : app
    ));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/applications/${appId}/rating`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating })
      });
      if (!res.ok) throw new Error('Failed to update rating');
      
      if (selectedApp && selectedApp._id === appId) {
        setSelectedApp({ ...selectedApp, rating });
      }
    } catch (err) {
      console.error(err);
      setApplications(previousApps);
      showToast('Failed to update rating', 'error');
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, appId) => {
    setDraggedAppId(appId);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', appId);
    // Slight delay for smooth visual transition
    setTimeout(() => {
      e.target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50');
    setDraggedAppId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageId) {
      setDragOverStage(stageId);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Complex to handle leave properly without bubbling issues, handled by resetting on drop or end
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedAppId) {
      const app = applications.find(a => a._id === draggedAppId);
      if (app && app.stage !== stageId) {
        handleStageChange(draggedAppId, stageId);
      }
    }
  };

  // --- Filters ---
  const filteredApplications = applications.filter(app => {
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      const nameMatch = app.candidate?.name?.toLowerCase().includes(term);
      const emailMatch = app.candidate?.email?.toLowerCase().includes(term);
      if (!nameMatch && !emailMatch) return false;
    }
    return true;
  });

  const getAppsByStage = (stageId) => {
    return filteredApplications.filter(app => app.stage === stageId);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 z-10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600" />
              Pipeline Board
            </h1>
            <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
            
            {/* Job Selector */}
            <div className="relative">
              <select 
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="appearance-none bg-gray-100 border-none text-gray-700 py-2 pl-4 pr-10 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors cursor-pointer font-medium"
              >
                <option value="">Select a Job</option>
                {jobs.map(job => (
                  <option key={job._id} value={job._id}>{job.title}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search candidates..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm w-64"
              />
            </div>

            {/* View Toggles */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('kanban')}
                className={classNames(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === 'kanban' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
                title="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={classNames(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === 'table' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Add Button */}
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Application
            </button>
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="font-medium text-gray-900">{stats.total || applications.length}</span> Total Applications
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="font-medium text-gray-900">{stats.avgTime || '12d'}</span> Avg Time-to-Hire
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {!selectedJobId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Target className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a Job</h2>
            <p>Please select a job from the dropdown to view its pipeline.</p>
          </div>
        ) : loading ? (
          <div className="flex-1 p-6 flex gap-6 overflow-x-auto">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-[320px] flex-shrink-0 space-y-4">
                <div className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : applications.length === 0 && !searchQuery ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="bg-indigo-50 p-6 rounded-full mb-4">
              <User className="w-12 h-12 text-indigo-300" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No applications yet</h2>
            <p>Share your careers page to start receiving applications.</p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* KANBAN BOARD */
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <div className="flex gap-6 h-full items-start min-w-max pb-4">
              {STAGES.map((stage) => {
                const stageApps = getAppsByStage(stage.id);
                const isOver = dragOverStage === stage.id;
                
                return (
                  <div 
                    key={stage.id} 
                    className={classNames(
                      "w-[340px] flex-shrink-0 flex flex-col max-h-full bg-gray-100/50 rounded-2xl border transition-all duration-200",
                      isOver ? `border-indigo-400 bg-indigo-50/30 shadow-inner` : "border-gray-200/50"
                    )}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Column Header */}
                    <div className={classNames(
                      "px-4 py-3 border-b flex items-center justify-between rounded-t-2xl",
                      stage.color, stage.borderColor
                    )}>
                      <div className="flex items-center gap-2">
                        <stage.icon className={classNames("w-4 h-4", stage.textColor)} />
                        <h3 className={classNames("font-semibold", stage.textColor)}>
                          {stage.label}
                        </h3>
                      </div>
                      <span className={classNames(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold bg-white shadow-sm",
                        stage.textColor
                      )}>
                        {stageApps.length}
                      </span>
                    </div>

                    {/* Column Body */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 min-h-[150px]">
                      {stageApps.map((app) => (
                        <div
                          key={app._id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app._id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => { setSelectedApp(app); setIsPanelOpen(true); }}
                          className={classNames(
                            "bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer transition-all duration-200",
                            "hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 group",
                            draggedAppId === app._id ? "opacity-50 ring-2 ring-indigo-500" : ""
                          )}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {app.candidate?.name || 'Unknown'}
                            </h4>
                            {app.source && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                                {app.source}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate">{app.job?.title || 'Unknown Position'}</span>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                            {/* Stars */}
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star}
                                  className={classNames(
                                    "w-3.5 h-3.5 cursor-pointer transition-colors",
                                    star <= (app.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-200"
                                  )}
                                  onClick={() => handleRatingChange(app._id, star)}
                                />
                              ))}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {formatDate(app.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {stageApps.length === 0 && (
                        <div className="h-full min-h-[100px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-6 py-4 font-medium">Candidate</th>
                    <th className="px-6 py-4 font-medium">Position</th>
                    <th className="px-6 py-4 font-medium">Stage</th>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">Applied</th>
                    <th className="px-6 py-4 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredApplications.map(app => (
                    <tr 
                      key={app._id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedApp(app); setIsPanelOpen(true); }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{app.candidate?.name}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{app.candidate?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{app.job?.title}</td>
                      <td className="px-6 py-4">
                        <span className={classNames(
                          "px-2.5 py-1 rounded-full text-xs font-medium border",
                          STAGES.find(s => s.id === app.stage)?.color,
                          STAGES.find(s => s.id === app.stage)?.textColor,
                          STAGES.find(s => s.id === app.stage)?.borderColor
                        )}>
                          {app.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{app.source || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(app.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} className={classNames("w-3.5 h-3.5", star <= (app.rating||0) ? "text-amber-400 fill-amber-400" : "text-gray-300")} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Slide-over Panel */}
        {isPanelOpen && selectedApp && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setIsPanelOpen(false)}
            />
            
            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
              
              {/* Panel Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                    {selectedApp.candidate?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedApp.candidate?.name}</h2>
                    <p className="text-sm text-gray-500">{selectedApp.job?.title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative group inline-block">
                    <select 
                      value={selectedApp.stage}
                      onChange={(e) => handleStageChange(selectedApp._id, e.target.value)}
                      className="appearance-none bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium py-2 pl-4 pr-10 rounded-lg hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer text-sm transition-colors"
                    >
                      {STAGES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  
                  <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>

                  <button 
                    onClick={() => { setIsRejectModalOpen(true); }}
                    className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-2 ml-auto"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>

                {/* Candidate Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Candidate Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${selectedApp.candidate?.email}`} className="hover:text-indigo-600">{selectedApp.candidate?.email}</a>
                    </div>
                    {selectedApp.candidate?.phone && (
                      <div className="flex items-center gap-3 text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${selectedApp.candidate?.phone}`} className="hover:text-indigo-600">{selectedApp.candidate?.phone}</a>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Applied on {new Date(selectedApp.createdAt).toLocaleString()}
                    </div>
                    {selectedApp.resumeUrl && (
                      <div className="mt-4 pt-2">
                        <a href={selectedApp.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                          <FileText className="w-4 h-4" />
                          View Resume
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes placeholder */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Notes</h3>
                  <textarea 
                    placeholder="Add a note about this candidate..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px] resize-none"
                  ></textarea>
                  <div className="flex justify-end mt-2">
                    <button className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">Save Note</button>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

      </div>

      {/* Add Application Modal (Simplified placeholder) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Add Application</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500">
                  {jobs.map(job => <option key={job._id} value={job._id}>{job.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
          <div className={classNames(
            "px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium",
            toast.type === 'error' ? "bg-red-600 text-white" : "bg-gray-900 text-white"
          )}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {toast.message}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 20px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}} />
    </div>
  );
}
