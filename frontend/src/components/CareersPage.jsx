import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, MapPin, Briefcase, Clock, Building, ArrowRight, Tag } from 'lucide-react';
import API_URL from '../config';

const CareersPage = () => {
  const { orgSlug } = useParams();
  const [orgData, setOrgData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const fetchCareers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/careers/${orgSlug}`);
        if (!res.ok) throw new Error('Organization or careers page not found');
        const data = await res.json();
        setOrgData(data.organization || {});
        setJobs(data.jobs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCareers();
  }, [orgSlug]);

  const departments = useMemo(() => [...new Set(jobs.map(j => j.department).filter(Boolean))], [jobs]);
  const locations = useMemo(() => [...new Set(jobs.map(j => j.location).filter(Boolean))], [jobs]);
  const types = useMemo(() => [...new Set(jobs.map(j => j.employmentType).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
      const matchesSearch = (job.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (job.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (job.department || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter ? job.department === deptFilter : true;
      const matchesLoc = locFilter ? job.location === locFilter : true;
      const matchesType = typeFilter ? job.employmentType === typeFilter : true;
      return matchesSearch && matchesDept && matchesLoc && matchesType;
    });

    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return filtered;
  }, [jobs, searchQuery, deptFilter, locFilter, typeFilter, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="animate-pulse flex flex-col items-center space-y-4">
            <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
            <div className="h-8 w-48 bg-gray-200 rounded"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 w-1/2 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-2/3 bg-gray-200 rounded mb-6"></div>
                <div className="h-10 w-full bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600">{error}</p>
          <Link to="/" className="mt-6 inline-block text-indigo-600 hover:text-indigo-800 font-medium">
            &larr; Return Home
          </Link>
        </div>
      </div>
    );
  }

  const primaryColor = orgData?.settings?.brandColor || '#4F46E5';

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-12 px-4 sm:px-6 lg:px-8 text-center flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          {orgData?.logo ? (
            <img src={orgData.logo} alt={orgData.name} className="h-20 w-auto mx-auto mb-6 object-contain" />
          ) : (
            <div className="h-20 w-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Building className="h-10 w-10" />
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Join the team at {orgData?.name || 'Us'}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            {orgData?.description || 'Help us build the future. We are looking for passionate, driven people to join our growing team.'}
          </p>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto flex items-center shadow-sm rounded-full overflow-hidden border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
            <div className="pl-4 text-gray-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search jobs by title, department, or location..."
              className="w-full py-3 px-4 outline-none text-gray-700 bg-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 space-y-4 md:space-y-0">
          <div className="flex flex-wrap gap-3">
            <select 
              className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select 
              className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={locFilter} onChange={e => setLocFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select 
              className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Job Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select 
              className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={sortBy} onChange={e => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>

        {/* Jobs List */}
        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map(job => (
              <div key={job._id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 p-6 flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">
                    {job.title}
                  </h3>
                </div>

                <div className="space-y-2 mb-6 flex-grow">
                  {job.department && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
                      {job.department}
                    </div>
                  )}
                  {job.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      {job.location}
                    </div>
                  )}
                  {job.employmentType && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-gray-400" />
                      {job.employmentType}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {job.skills && job.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {skill}
                    </span>
                  ))}
                  {job.skills && job.skills.length > 3 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      +{job.skills.length - 3} more
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <Link 
                    to={`/careers/${orgSlug}/jobs/${job._id}`}
                    className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 group-hover:translate-x-1 transition-transform"
                  >
                    Apply Now <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="mx-auto h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No open positions found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query, or check back later!</p>
            {(searchQuery || deptFilter || locFilter || typeFilter) && (
              <button 
                onClick={() => {
                  setSearchQuery(''); setDeptFilter(''); setLocFilter(''); setTypeFilter('');
                }}
                className="mt-4 text-indigo-600 font-medium hover:text-indigo-800"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          Powered by <a href="/" className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors">SkillNix ATS</a>
        </div>
      </footer>
    </div>
  );
};

export default CareersPage;
