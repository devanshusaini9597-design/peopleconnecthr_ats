import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, Clock, Video, Phone, User,
  Briefcase, Star, FileText, X, Plus, Filter, Users
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Modal from './ui/Modal';

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

const RECS = ['Strong No', 'No', 'Neutral', 'Yes', 'Strong Yes'];
const SKILLS = ['Technical Skills', 'Communication', 'Problem Solving', 'Culture Fit'];

const TypeIcon = ({ type }) => {
  if (type === 'Video') return <Video className="w-4 h-4 text-brand-600" />;
  if (type === 'Phone') return <Phone className="w-4 h-4 text-sky-600" />;
  return <User className="w-4 h-4 text-stone-500" />;
};

export default function InterviewsPage() {
  const [activeTab, setActiveTab] = useState('my');
  const [showScorecard, setShowScorecard] = useState(false);
  const [scorecardTarget, setScorecardTarget] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [ratings, setRatings] = useState({});
  const [scheduleForm, setScheduleForm] = useState({
    candidate: '',
    job: '',
    date: '',
    time: '',
    type: 'Video',
    link: '',
    interviewer: '',
  });

  const openScorecard = (interview) => {
    setScorecardTarget(interview);
    setRecommendation('');
    setRatings({});
    setShowScorecard(true);
  };

  const tabs = [
    { id: 'my', label: 'My Interviews', icon: User },
    { id: 'all', label: 'All Interviews', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  ];

  return (
    <div className="page-shell-ats">
      <PageHeader
        icon={CalendarIcon}
        title="Interviews"
        subtitle="Manage upcoming interviews and submit candidate scorecards."
        gradientTitle
      >
        <button type="button" onClick={() => setShowSchedule(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Schedule Interview
        </button>
      </PageHeader>

      <div className="card-ats-bordered overflow-hidden">
        <div className="flex overflow-x-auto border-b border-stone-200 bg-stone-50/60 scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 sm:px-6 py-3.5 text-sm font-semibold transition-all whitespace-nowrap border-b-2
                ${activeTab === id
                  ? 'border-brand-500 text-brand-700 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'my' && (
            MOCK_INTERVIEWS.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                message="No interviews scheduled"
                subMessage="Schedule your first interview to get started."
                action={
                  <button type="button" onClick={() => setShowSchedule(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> Schedule Interview
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                {MOCK_INTERVIEWS.map((interview) => (
                  <div key={interview.id} className="card-ats p-5 flex flex-col hover:border-brand-200/80 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600 opacity-80" />
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-teal-100 text-brand-700 flex items-center justify-center font-bold text-sm ring-1 ring-brand-200/60 flex-shrink-0">
                          {interview.candidate.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-stone-900 text-sm truncate tracking-tight">{interview.candidate}</h4>
                          <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
                            <Briefcase className="w-3 h-3 flex-shrink-0" /> {interview.job}
                          </p>
                        </div>
                      </div>
                      <span className={interview.status === 'Completed' ? 'badge-success' : 'badge-warning'}>
                        {interview.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-stone-600 mb-5 bg-stone-50/80 p-3.5 rounded-xl border border-stone-100">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-stone-400" />
                        <span className="font-semibold text-stone-900">{interview.date}</span>
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
                          <a
                            href={interview.link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary flex-1 !py-2"
                          >
                            <Video className="w-4 h-4" /> Join Meeting
                          </a>
                          <button
                            type="button"
                            className="p-2.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors touch-target"
                            title="Cancel interview"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {interview.status === 'Completed' && !interview.scorecardSubmitted && (
                        <button
                          type="button"
                          onClick={() => openScorecard(interview)}
                          className="btn-primary w-full"
                        >
                          <FileText className="w-4 h-4" /> Fill Scorecard
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'all' && (
            <EmptyState
              icon={Filter}
              message="Table view coming soon"
              subMessage="A full interview table with filters and team visibility will appear here."
            />
          )}

          {activeTab === 'calendar' && (
            <EmptyState
              icon={CalendarIcon}
              message="Calendar integration coming soon"
              subMessage="Sync interviews with Google Calendar or Outlook once the integration is available."
            />
          )}
        </div>
      </div>

      {/* Schedule Interview */}
      <Modal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        title="Schedule Interview"
        description="Create a new interview slot for a candidate."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setShowSchedule(false)} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={() => {
                setShowSchedule(false);
                setScheduleForm({ candidate: '', job: '', date: '', time: '', type: 'Video', link: '', interviewer: '' });
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Schedule
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-ats">Candidate name</label>
            <input
              className="input-ats"
              value={scheduleForm.candidate}
              onChange={(e) => setScheduleForm((f) => ({ ...f, candidate: e.target.value }))}
              placeholder="e.g. Alex Johnson"
              autoFocus
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-ats">Job / Role</label>
            <input
              className="input-ats"
              value={scheduleForm.job}
              onChange={(e) => setScheduleForm((f) => ({ ...f, job: e.target.value }))}
              placeholder="e.g. Senior Frontend Developer"
            />
          </div>
          <div>
            <label className="label-ats">Date</label>
            <input
              type="date"
              className="input-ats"
              value={scheduleForm.date}
              onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-ats">Time</label>
            <input
              type="time"
              className="input-ats"
              value={scheduleForm.time}
              onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-ats">Interview type</label>
            <select
              className="input-ats"
              value={scheduleForm.type}
              onChange={(e) => setScheduleForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="Video">Video</option>
              <option value="Phone">Phone</option>
              <option value="Onsite">Onsite</option>
            </select>
          </div>
          <div>
            <label className="label-ats">Interviewer</label>
            <input
              className="input-ats"
              value={scheduleForm.interviewer}
              onChange={(e) => setScheduleForm((f) => ({ ...f, interviewer: e.target.value }))}
              placeholder="Name or email"
            />
          </div>
          {scheduleForm.type === 'Video' && (
            <div className="sm:col-span-2">
              <label className="label-ats">Meeting link</label>
              <input
                className="input-ats"
                value={scheduleForm.link}
                onChange={(e) => setScheduleForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://zoom.us/j/…"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Scorecard */}
      <Modal
        open={showScorecard}
        onClose={() => setShowScorecard(false)}
        title="Interview Scorecard"
        description={scorecardTarget ? `${scorecardTarget.candidate} · ${scorecardTarget.job}` : ''}
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => setShowScorecard(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => setShowScorecard(false)} className="btn-primary">
              Submit Scorecard
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="label-ats mb-2">Overall Recommendation</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RECS.map((rec) => (
                <button
                  key={rec}
                  type="button"
                  onClick={() => setRecommendation(rec)}
                  className={`py-2.5 px-2 text-xs font-semibold border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                    recommendation === rec
                      ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-stone-200 text-stone-600 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  {rec}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="section-title-ats !mb-3">Skills Evaluation</h3>
            {SKILLS.map((skill) => (
              <div key={skill} className="bg-stone-50/80 p-4 rounded-2xl border border-stone-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-stone-800">{skill}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatings((r) => ({ ...r, [skill]: star }))}
                        className="p-0.5 touch-target"
                        aria-label={`Rate ${skill} ${star} stars`}
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            (ratings[skill] || 0) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-stone-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea placeholder="Add notes…" className="textarea-ats" rows={2} />
              </div>
            ))}
          </div>

          <div>
            <label className="label-ats">Final Notes</label>
            <textarea placeholder="Overall summary, strengths, concerns…" className="textarea-ats resize-y" rows={4} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
