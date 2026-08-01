import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, Clock, MapPin, Video, Phone, User,
  Briefcase, Star, FileText, Check, X, Plus, Filter, MessageSquare
} from 'lucide-react';
import API_URL from '../config';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';

const MOCK_INTERVIEWS = [
  {
    id: 1,
    candidate: 'Alex Johnson',
    job: 'Senior Frontend Developer',
    date: 'Tomorrow',
    time: '2:00 PM - 3:00 PM',
    type: 'Video',
    status: 'Scheduled',
    interviewer: 'Me',
    link: 'https://zoom.us/j/12345'
  },
  {
    id: 2,
    candidate: 'Sarah Smith',
    job: 'Product Manager',
    date: 'Today',
    time: '10:00 AM - 11:00 AM',
    type: 'Phone',
    status: 'Completed',
    interviewer: 'Me',
    scorecardSubmitted: false
  }
];

export default function InterviewsPage() {
  const [activeTab, setActiveTab] = useState('my');
  const [showScorecard, setShowScorecard] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const TypeIcon = ({ type }) => {
    switch(type) {
      case 'Video': return <Video className="w-4 h-4" />;
      case 'Phone': return <Phone className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={CalendarIcon}
        title="Interviews"
        subtitle="Manage your upcoming interviews and candidate scorecards."
      >
        <button
          type="button"
          onClick={() => setShowSchedule(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> Schedule Interview
        </button>
      </PageHeader>

      <div className="card-ats-bordered overflow-hidden">
        <div className="flex border-b border-stone-200 bg-stone-50/50">
          {['my', 'all', 'calendar'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium transition-colors capitalize border-b-2
                ${activeTab === tab
                  ? 'border-brand-500 text-brand-700 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              {tab === 'my' ? 'My Interviews' : tab === 'all' ? 'All Interviews' : 'Calendar View'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'my' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_INTERVIEWS.map(interview => (
                <div key={interview.id} className="card-ats-bordered p-5 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center font-bold text-sm ring-1 ring-brand-200/60">
                        {interview.candidate.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-stone-900 text-sm">{interview.candidate}</h4>
                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3" /> {interview.job}
                        </p>
                      </div>
                    </div>
                    <span className={interview.status === 'Completed' ? 'badge-success' : 'badge-warning'}>
                      {interview.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-stone-600 mb-6 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-stone-400" />
                      <span className="font-medium text-stone-900">{interview.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-stone-400" />
                      {interview.time}
                    </div>
                    <div className="flex items-center gap-2">
                      <TypeIcon type={interview.type} />
                      {interview.type} Interview
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-stone-100 flex gap-2">
                    {interview.status === 'Scheduled' && (
                      <>
                        <a href={interview.link} target="_blank" rel="noreferrer" className="flex-1 text-center py-2 bg-brand-50 text-brand-700 rounded-xl text-sm font-medium hover:bg-brand-100 transition-colors">
                          Join Meeting
                        </a>
                        <button type="button" className="px-3 py-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {interview.status === 'Completed' && !interview.scorecardSubmitted && (
                      <button
                        type="button"
                        onClick={() => setShowScorecard(true)}
                        className="btn-primary w-full"
                      >
                        <FileText className="w-4 h-4" /> Fill Scorecard
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'all' && (
            <EmptyState
              icon={Filter}
              message="Table view coming soon."
              subMessage="A full interview table with filters will appear here."
            />
          )}

          {activeTab === 'calendar' && (
            <EmptyState
              icon={CalendarIcon}
              message="Calendar integration coming soon."
              subMessage="Sync interviews with your calendar once the integration is available."
            />
          )}
        </div>
      </div>

      {/* Scorecard Modal */}
      {showScorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" aria-hidden />
          <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl my-8 border border-stone-200/60 overflow-hidden modal-panel-ats">
            <div className="h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
            <div className="p-6 border-b border-stone-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-stone-900 tracking-tight">Interview Scorecard</h2>
                <p className="text-sm text-stone-500 mt-0.5">Sarah Smith - Product Manager</p>
              </div>
              <button
                type="button"
                onClick={() => setShowScorecard(false)}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-900 mb-3">Overall Recommendation</label>
                <div className="flex gap-2">
                  {['Strong No', 'No', 'Neutral', 'Yes', 'Strong Yes'].map((rec) => (
                    <button
                      key={rec}
                      type="button"
                      className="flex-1 py-2 text-xs font-medium border border-stone-200 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-colors focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-stone-900 border-b border-stone-100 pb-2">Skills Evaluation</h3>
                {['Technical Skills', 'Communication', 'Problem Solving', 'Culture Fit'].map(skill => (
                  <div key={skill} className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-stone-700">{skill}</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} className="w-5 h-5 text-stone-300 hover:text-yellow-400 cursor-pointer transition-colors" />
                        ))}
                      </div>
                    </div>
                    <textarea placeholder="Add notes..." className="textarea-ats mt-2" rows="2"></textarea>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-900 mb-1.5">Final Notes</label>
                <textarea placeholder="Overall summary, strengths, concerns..." className="textarea-ats resize-y" rows="4"></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-stone-50/50 sticky bottom-0">
              <button type="button" onClick={() => setShowScorecard(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => setShowScorecard(false)} className="btn-primary">
                Submit Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
