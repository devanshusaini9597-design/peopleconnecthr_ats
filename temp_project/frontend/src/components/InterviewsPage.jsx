import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, Video, Phone, User, 
  Briefcase, Star, FileText, Check, X, Plus, Filter, MessageSquare
} from 'lucide-react';
import API_URL from '../config';

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
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Interviews</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage your upcoming interviews and candidate scorecards.</p>
          </div>
          <button 
            onClick={() => setShowSchedule(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Schedule Interview
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gray-50/50">
            {['my', 'all', 'calendar'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-medium transition-colors capitalize
                  ${activeTab === tab 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                {tab === 'my' ? 'My Interviews' : tab === 'all' ? 'All Interviews' : 'Calendar View'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'my' && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MOCK_INTERVIEWS.map(interview => (
                  <div key={interview.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-white flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                          {interview.candidate.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{interview.candidate}</h4>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3" /> {interview.job}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        interview.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {interview.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{interview.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {interview.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <TypeIcon type={interview.type} />
                        {interview.type} Interview
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-100 flex gap-2">
                      {interview.status === 'Scheduled' && (
                        <>
                          <a href={interview.link} target="_blank" rel="noreferrer" className="flex-1 text-center py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                            Join Meeting
                          </a>
                          <button className="px-3 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {interview.status === 'Completed' && !interview.scorecardSubmitted && (
                        <button 
                          onClick={() => setShowScorecard(true)}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
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
              <div className="text-center py-12 text-gray-500">
                <Filter className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                <p>Table view coming soon.</p>
              </div>
            )}
            
            {activeTab === 'calendar' && (
              <div className="text-center py-12 text-gray-500">
                <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                <p>Calendar integration coming soon.</p>
              </div>
            )}
          </div>
        </div>

        {/* Scorecard Modal */}
        {showScorecard && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Interview Scorecard</h2>
                  <p className="text-sm text-gray-500">Sarah Smith - Product Manager</p>
                </div>
                <button onClick={() => setShowScorecard(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">Overall Recommendation</label>
                  <div className="flex gap-2">
                    {['Strong No', 'No', 'Neutral', 'Yes', 'Strong Yes'].map((rec, i) => (
                      <button key={rec} className="flex-1 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        {rec}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2">Skills Evaluation</h3>
                  {['Technical Skills', 'Communication', 'Problem Solving', 'Culture Fit'].map(skill => (
                    <div key={skill} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">{skill}</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} className="w-5 h-5 text-gray-300 hover:text-yellow-400 cursor-pointer transition-colors" />
                          ))}
                        </div>
                      </div>
                      <textarea placeholder="Add notes..." className="w-full text-sm p-2 border border-gray-200 rounded mt-2 focus:ring-1 focus:ring-blue-500 outline-none resize-none" rows="2"></textarea>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Final Notes</label>
                  <textarea placeholder="Overall summary, strengths, concerns..." className="w-full text-sm p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" rows="4"></textarea>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl sticky bottom-0">
                <button onClick={() => setShowScorecard(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={() => setShowScorecard(false)} className="px-5 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                  Submit Scorecard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
