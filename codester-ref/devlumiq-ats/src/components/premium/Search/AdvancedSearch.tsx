'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, Save, Trash2, Play, Clock,
  ChevronDown, X, Plus, Star 
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';

interface SavedSearch {
  id: string;
  name: string;
  description: string;
  query: string;
  booleanQuery: string;
  skills: string[];
  experienceMin: number;
  experienceMax: number;
  location: string;
  remoteOnly: boolean;
  isAlertEnabled: boolean;
  alertFrequency: string;
  resultCount: number;
  createdAt: string;
}

export default function AdvancedSearch() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [booleanQuery, setBooleanQuery] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [experienceMin, setExperienceMin] = useState('');
  const [experienceMax, setExperienceMax] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    fetchSavedSearches();
  }, []);

  const fetchSavedSearches = async () => {
    try {
      // Session userId is stored when user logs in
      const userId = localStorage.getItem('token');
      if (!userId) return;
      const res = await fetch(`/api/search?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      // POST /api/search is the advanced search endpoint
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: searchQuery,
          booleanQuery,
          skills,
          experienceMin: experienceMin ? parseInt(experienceMin) : undefined,
          experienceMax: experienceMax ? parseInt(experienceMax) : undefined,
          location,
          remoteOnly,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.candidates || []);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = async () => {
    try {
      const userId = localStorage.getItem('token');
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: searchName,
          userId,
          query: searchQuery,
          booleanQuery,
          skills,
          experienceMin: experienceMin ? parseInt(experienceMin) : undefined,
          experienceMax: experienceMax ? parseInt(experienceMax) : undefined,
          location,
          remoteOnly,
        }),
      });
      if (res.ok) {
        setShowSaveModal(false);
        setSearchName('');
        fetchSavedSearches();
      }
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setSearchQuery(search.query || '');
    setBooleanQuery(search.booleanQuery || '');
    setSkills(search.skills || []);
    setExperienceMin(search.experienceMin?.toString() || '');
    setExperienceMax(search.experienceMax?.toString() || '');
    setLocation(search.location || '');
    setRemoteOnly(search.remoteOnly || false);
  };

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <PageShell>
      <PageHeader
        icon={Search}
        title="Advanced Search"
        subtitle="Find candidates with Boolean filters and advanced criteria"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar - Saved Searches */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="font-semibold text-stone-900 mb-3">Saved Searches</h3>
            <div className="space-y-2">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  onClick={() => loadSavedSearch(search)}
                  className="p-3 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-stone-900">{search.name}</span>
                    <span className="text-xs text-stone-500">{search.resultCount} results</span>
                  </div>
                  {search.isAlertEnabled && (
                    <div className="flex items-center gap-1 text-xs text-brand-600 mt-1">
                      <Clock className="w-3 h-3" />
                      Alert ({search.alertFrequency})
                    </div>
                  )}
                </div>
              ))}
              {savedSearches.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-4">No saved searches</p>
              )}
            </div>
          </div>

          <div className="bg-brand-50 rounded-xl border border-brand-200 p-4">
            <h3 className="font-semibold text-brand-900 mb-2">Search Tips</h3>
            <ul className="text-sm text-brand-700 space-y-1">
              <li>• Use AND, OR, NOT for Boolean logic</li>
              <li>• "exact phrase" for exact matches</li>
              <li>• (parentheses) for grouping</li>
              <li>• * for wildcards</li>
            </ul>
          </div>
        </div>

        {/* Main Search Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Search Input */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidates by name, email, or keywords..."
                  className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <button
                onClick={performSearch}
                disabled={loading}
                className="btn-primary !px-6 !py-3 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading ? 'Searching...' : <><Search className="w-4 h-4" /> Search</>}
              </button>
            </div>

            {/* Boolean Query */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Boolean Query (Advanced)
              </label>
              <input
                type="text"
                value={booleanQuery}
                onChange={(e) => setBooleanQuery(e.target.value)}
                placeholder="(react OR vue) AND (senior OR lead) NOT junior"
                className="w-full px-4 py-2 border border-stone-200 rounded-lg font-mono text-sm"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                    placeholder="Add skill..."
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={addSkill}
                    className="p-2 bg-stone-100 rounded-lg hover:bg-stone-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 rounded text-xs"
                    >
                      {skill}
                      <button onClick={() => removeSkill(skill)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Experience (Years)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={experienceMin}
                    onChange={(e) => setExperienceMin(e.target.value)}
                    placeholder="Min"
                    className="w-20 px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  />
                  <span className="text-stone-400">-</span>
                  <input
                    type="number"
                    value={experienceMax}
                    onChange={(e) => setExperienceMax(e.target.value)}
                    placeholder="Max"
                    className="w-20 px-3 py-2 border border-stone-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country, or Remote"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                />
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={remoteOnly}
                    onChange={(e) => setRemoteOnly(e.target.checked)}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-sm text-stone-700">Remote only</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50"
              >
                <Save className="w-4 h-4" />
                Save Search
              </button>
              <span className="text-sm text-stone-500">
                {results.length} results found
              </span>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="p-4 border-b border-stone-200">
              <h3 className="font-semibold text-stone-900">Search Results</h3>
            </div>
            <div className="divide-y divide-stone-200">
              {results.map((candidate) => (
                <div key={candidate.id} className="p-4 hover:bg-stone-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-stone-900">{candidate.name}</h4>
                      <p className="text-sm text-stone-500">{candidate.email}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-stone-600">
                        {candidate.currentTitle && (
                          <span>{candidate.currentTitle}</span>
                        )}
                        {candidate.currentCompany && (
                          <span>@ {candidate.currentCompany}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {candidate.skills?.slice(0, 5).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-stone-500">
                        {candidate.experience} years exp
                      </span>
                      <p className="text-xs text-stone-400">{candidate.location}</p>
                    </div>
                  </div>
                </div>
              ))}
              {results.length === 0 && !loading && (
                <div className="p-8 text-center text-stone-400">
                  <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Enter search criteria and click Search to find candidates</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Search Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Save Search</h3>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search name..."
              className="w-full px-3 py-2 border border-stone-200 rounded-lg mb-4"
            />
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="alert" className="w-4 h-4 text-brand-600" />
              <label htmlFor="alert" className="text-sm text-stone-700">
                Enable email alerts for new matches
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 border border-stone-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveSearch}
                className="flex-1 btn-primary !px-4 !py-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
