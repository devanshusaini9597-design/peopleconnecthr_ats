import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Phone, Bell, Eye, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';
import { BASE_API_URL } from '../config';
import EmptyState from './ui/EmptyState';

const CallbackRemindersWidget = () => {
  const navigate = useNavigate();
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCallbacks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(`${BASE_API_URL}/api/notifications/upcoming-callbacks`);
      const data = await res.json();
      if (data.success) {
        setCallbacks(data.callbacks || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch callbacks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCallbacks();
    const interval = setInterval(fetchCallbacks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCallbacks]);

  const priorityConfig = {
    urgent: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', chip: 'bg-red-200 text-red-800' },
    high: { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', chip: 'bg-orange-200 text-orange-800' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', chip: 'bg-amber-200 text-amber-800' },
    low: { bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-500', chip: 'bg-sky-200 text-sky-800' },
  };

  if (loading) {
    return (
      <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <Bell size={16} className="text-orange-500" />
          </div>
          <h2 className="text-base font-bold text-stone-900">Callback Reminders</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-stone-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-ats-bordered p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Callback Reminders</h2>
            {totalCount > 0 && (
              <p className="text-[11px] text-stone-400 font-medium">{totalCount} upcoming</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchCallbacks}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-400 hover:text-stone-600"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {callbacks.length === 0 ? (
        <EmptyState
          icon={Phone}
          tone="sky"
          compact
          message="No upcoming callbacks"
          subMessage="Set callback dates on candidates to get reminders."
        />
      ) : (
        <div className="space-y-2">
          {callbacks.slice(0, 6).map((cb) => {
            const config = priorityConfig[cb.priority] || priorityConfig.medium;
            return (
              <button
                key={cb._id}
                type="button"
                className={`${config.bg} border ${config.border} rounded-xl p-3.5 w-full text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group`}
                onClick={() => navigate(cb.candidateName ? `/ats?q=${encodeURIComponent(cb.candidateName)}` : '/ats')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full ${config.dot} mt-1.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-900 truncate">{cb.candidateName}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.chip}`}>
                        {cb.daysRemaining < 0 ? `${Math.abs(cb.daysRemaining)}d OVERDUE`
                          : cb.daysRemaining === 0 ? 'TODAY'
                            : cb.daysRemaining === 1 ? 'TOMORROW'
                              : `${cb.daysRemaining} DAYS`}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{cb.candidatePosition || 'No position'}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-3">
                        {cb.callBackDate && (
                          <span className="flex items-center gap-1 text-[11px] text-stone-500">
                            <Calendar size={10} /> {cb.callBackDate}
                          </span>
                        )}
                        {cb.candidateContact && (
                          <span className="flex items-center gap-1 text-[11px] text-stone-500">
                            <Phone size={10} /> {cb.candidateContact}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {cb.candidateContact && (
                          <a
                            href={`tel:${cb.candidateContact}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-emerald-700 transition-colors"
                            title="Call"
                          >
                            <Phone size={11} />
                          </a>
                        )}
                        <span className="p-1.5 bg-sky-100 rounded-lg text-sky-700" title="View in ATS">
                          <Eye size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {totalCount > 6 && (
            <button
              type="button"
              onClick={() => navigate('/ats')}
              className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700 pt-1 transition-colors"
            >
              + {totalCount - 6} more — view all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CallbackRemindersWidget;
