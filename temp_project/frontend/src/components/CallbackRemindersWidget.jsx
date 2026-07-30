import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Phone, MapPin, AlertTriangle, Clock, ChevronRight, RefreshCw, Bell, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../utils/fetchUtils';

import { BASE_API_URL } from '../config';

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
    // Refresh every 5 minutes
    const interval = setInterval(fetchCallbacks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCallbacks]);

  const priorityConfig = {
    urgent: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-700', label: 'OVERDUE / TODAY' },
    high: { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', text: 'text-orange-700', label: '1-2 DAYS' },
    medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700', label: '3-5 DAYS' },
    low: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', text: 'text-blue-700', label: '6-7 DAYS' }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Callback Reminders</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-100 rounded-lg">
            <Bell size={16} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Callback Reminders</h2>
            {totalCount > 0 && (
              <p className="text-[11px] text-gray-400">{totalCount} upcoming callback{totalCount !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <button
          onClick={fetchCallbacks}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {callbacks.length === 0 ? (
        <div className="text-center py-8">
          <Calendar size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No upcoming callbacks</p>
          <p className="text-xs text-gray-300 mt-1">Set callback dates on candidates to get reminders</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {callbacks.slice(0, 6).map((cb) => {
            const config = priorityConfig[cb.priority] || priorityConfig.medium;
            return (
              <div
                key={cb._id}
                className={`${config.bg} border ${config.border} rounded-lg p-3 transition-all hover:shadow-md cursor-pointer group`}
                onClick={() => navigate('/ats')}
              >
                <div className="flex items-start gap-3">
                  {/* Priority indicator */}
                  <div className={`w-2 h-2 rounded-full ${config.dot} mt-1.5 flex-shrink-0`} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{cb.candidateName}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        cb.daysRemaining <= 0 ? 'bg-red-200 text-red-800' :
                        cb.daysRemaining <= 2 ? 'bg-orange-200 text-orange-800' :
                        cb.daysRemaining <= 5 ? 'bg-yellow-200 text-yellow-800' :
                        'bg-blue-200 text-blue-800'
                      }`}>
                        {cb.daysRemaining < 0 ? `${Math.abs(cb.daysRemaining)}d OVERDUE` :
                         cb.daysRemaining === 0 ? 'TODAY' :
                         cb.daysRemaining === 1 ? 'TOMORROW' :
                         `${cb.daysRemaining} DAYS`}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-0.5">{cb.candidatePosition || 'No position'}</p>
                    
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-3">
                        {cb.callBackDate && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Calendar size={10} />
                            {cb.callBackDate}
                          </span>
                        )}
                        {cb.candidateContact && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Phone size={10} />
                            {cb.candidateContact}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {cb.candidateContact && (
                          <a
                            href={`tel:${cb.candidateContact}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 bg-green-100 hover:bg-green-200 rounded text-green-700 transition-colors"
                            title="Call"
                          >
                            <Phone size={11} />
                          </a>
                        )}
                        <span className="p-1 bg-blue-100 rounded text-blue-700" title="View in ATS">
                          <Eye size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {totalCount > 6 && (
            <p className="text-center text-xs text-gray-400 pt-1">
              + {totalCount - 6} more callback{totalCount - 6 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CallbackRemindersWidget;
