import React, { useMemo, useState } from 'react';
import { Users, Download, RefreshCw, Send, Loader2, Shield, Search } from 'lucide-react';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import AnalyticsReportPreview from './AnalyticsReportPreview';
import { useAuth } from '../../context/AuthContext';
import { resolveOrgLogoSrc } from '../../utils/orgLogo';

export default function AnalyticsModals({
  showPreview,
  setShowPreview,
  previewData,
  previewLoading = false,
  exportFormat,
  handleExport,
  navigate,
  previewScrollRef,
  onTableDragScrollStart,
  onTableDragScrollMove,
  onTableDragScrollEnd,
  showShareModal,
  setShowShareModal,
  handleShareReport,
  isSharingReport,
  selectedMembers,
  setSelectedMembers,
  isLoadingMembers,
  teamMembers,
  shareMessage,
  setShareMessage,
}) {
  const { organization } = useAuth();
  const footerLogo = resolveOrgLogoSrc(previewData?.orgLogo || organization?.logo);
  const footerOrg = previewData?.orgName || organization?.name || '';
  const [memberQuery, setMemberQuery] = useState('');

  const shareableMembers = useMemo(
    () => (teamMembers || []).filter((m) => m && !m.isYou && m.email),
    [teamMembers],
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return shareableMembers;
    return shareableMembers.filter((m) => {
      const hay = `${m.name || ''} ${m.email || ''} ${m.role || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [shareableMembers, memberQuery]);

  const allFilteredSelected = filteredMembers.length > 0
    && filteredMembers.every((m) => selectedMembers.some((s) => String(s._id) === String(m._id)));

  const toggleMember = (member, checked) => {
    if (checked) {
      if (selectedMembers.some((m) => String(m._id) === String(member._id))) return;
      setSelectedMembers([...selectedMembers, member]);
    } else {
      setSelectedMembers(selectedMembers.filter((m) => String(m._id) !== String(member._id)));
    }
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const drop = new Set(filteredMembers.map((m) => String(m._id)));
      setSelectedMembers(selectedMembers.filter((m) => !drop.has(String(m._id))));
      return;
    }
    const map = new Map(selectedMembers.map((m) => [String(m._id), m]));
    filteredMembers.forEach((m) => map.set(String(m._id), m));
    setSelectedMembers([...map.values()]);
  };

  return (
    <>
      <Modal
        open={showPreview && (previewLoading || !!previewData)}
        onClose={() => !previewLoading && setShowPreview(false)}
        title={previewData?.title || 'Report preview'}
        description={previewData
          ? [
              previewData.scopeLabel ? `Scope: ${previewData.scopeLabel}` : null,
              previewData.subtitle ? `Period: ${previewData.subtitle}` : null,
            ].filter(Boolean).join(' · ')
          : 'Review metrics, charts, and data before download'}
        size="xl"
        footer={
          previewLoading ? null : (
            <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 min-w-0 sm:mr-auto">
                {footerLogo ? (
                  <img src={footerLogo} alt="" className="h-7 w-auto max-w-[88px] object-contain shrink-0" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-400 shrink-0">
                    <Shield size={14} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate">
                    {footerOrg || 'Recruitment report'}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Confidential — for authorized use only
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button type="button" onClick={() => setShowPreview(false)} className="btn-secondary flex-1 sm:flex-none">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPreview(false); handleExport(); }}
                  className="btn-primary flex-1 sm:flex-none"
                >
                  <Download size={16} /> Download {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
                </button>
              </div>
            </div>
          )
        }
      >
        {previewLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={36} className="animate-spin text-brand-600" />
            <div>
              <p className="text-sm font-bold text-stone-900">Generating report…</p>
              <p className="text-xs text-stone-500 mt-1">Compiling pipeline metrics and candidate records</p>
            </div>
            <div className="w-full max-w-md h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-brand-500 via-teal-400 to-brand-500 animate-shimmer" />
            </div>
          </div>
        ) : previewData ? (
          <AnalyticsReportPreview previewData={previewData} />
        ) : null}
      </Modal>

      <Modal
        open={showShareModal}
        onClose={() => {
          if (isSharingReport) return;
          setShowShareModal(false);
          setMemberQuery('');
        }}
        title="Share Report"
        description="Email teammates and notify them in-app with a link to this report."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setShowShareModal(false); setMemberQuery(''); }}
              disabled={isSharingReport}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleShareReport}
              disabled={isSharingReport || selectedMembers.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {isSharingReport ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {isSharingReport ? 'Sharing…' : 'Share Report'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="label-ats !mb-0">Team members</label>
              {filteredMembers.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  {allFilteredSelected ? 'Clear selection' : 'Select all'}
                </button>
              )}
            </div>

            {shareableMembers.length > 4 && (
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="search"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="input-ats !pl-9 w-full"
                />
              </div>
            )}

            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-emerald-500" />
              </div>
            ) : shareableMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                tone="emerald"
                compact
                message="No teammates available"
                subMessage="Invite colleagues to your organization to share reports."
              />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon={Search}
                tone="amber"
                compact
                message="No matches"
                subMessage="Try a different name or email."
              />
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50/60">
                {filteredMembers.map((member) => {
                  const checked = selectedMembers.some((m) => String(m._id) === String(member._id));
                  return (
                    <label
                      key={member._id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all min-w-0 ${
                        checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleMember(member, e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-900 truncate">{member.name}</p>
                        <p className="text-xs text-stone-500 truncate">{member.email}</p>
                      </div>
                      {member.kind === 'contact' ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 flex-shrink-0">Contact</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="label-ats">Message (optional)</label>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a note for recipients…"
              rows={3}
              className="textarea-ats field-premium"
            />
          </div>

          {selectedMembers.length > 0 && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs font-semibold text-emerald-700">
                {selectedMembers.length} recipient{selectedMembers.length === 1 ? '' : 's'} selected · email + in-app notice
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
