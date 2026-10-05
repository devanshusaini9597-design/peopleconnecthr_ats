import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  CheckSquare, Square, MinusSquare, Megaphone, Users,
} from 'lucide-react';
import { authenticatedFetch } from '../../utils/fetchUtils';
import { useToast } from '../Toast';
import EmptyState from '../ui/EmptyState';
import ConfirmationModal from '../ConfirmationModal';
import MisBulkToolbar from '../MisBulkToolbar';
import MisBulkEditModal from '../MisBulkEditModal';
import CandidateEmailModal from '../ats/CandidateEmailModal';
import EmailCampaignResultModal from '../ats/EmailCampaignResultModal';
import { useCandidateEmail } from '../ats/hooks/useCandidateEmail';
import { useTableDragScroll } from '../ats/hooks/useTableDragScroll';
import { guardTableCopy } from '../../utils/tableCopyGuard';
import BASE_API_URL from '../../config';
import { PAGE_SIZE } from '../ats/atsConstants';
import CandidatesPagination from '../ats/CandidatesPagination';
import DateSortHeader from './DateSortHeader';
import { selectAllMatching, resolveMatchingPeople } from './selectAllMatching';
import { useNavigate } from 'react-router-dom';

function dash(v) {
  return v ? <span className="text-sm text-stone-700 whitespace-nowrap">{v}</span> : <span className="text-stone-300">—</span>;
}

function formatDate(raw) {
  const d = raw ? new Date(raw) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return valid
    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

export default function GlobalSearchMisDesk({
  rows = [],
  jobs = [],
  page,
  setPage,
  totalCount = 0,
  countPending = false,
  countPlus = false,
  hasMore = false,
  loading,
  onReload,
  fetchMatching,
  audienceQuery = null,
  dateSort = 'latest',
  onDateSort,
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const { tableScrollRef, onTableDragScrollStart, onTableDragScrollMove, onTableDragScrollEnd } = useTableDragScroll();

  const [selectedIds, setSelectedIds] = useState([]);
  const [matchPool, setMatchPool] = useState([]);
  const [consentMenuOpen, setConsentMenuOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppTargets, setWhatsAppTargets] = useState([]);
  const [allMatching, setAllMatching] = useState(false);
  const matchPoolRef = useRef([]);

  const setSelectedIdsSafe = useCallback((next) => {
    setSelectedIds((prev) => {
      const ids = typeof next === 'function' ? next(prev) : next;
      const mapped = (Array.isArray(ids) ? ids : []).map(String);
      if (!mapped.length) {
        setMatchPool([]);
        matchPoolRef.current = [];
        setAllMatching(false);
      }
      return mapped;
    });
  }, []);

  const rememberPool = useCallback((rows) => {
    const next = Array.isArray(rows) ? rows : [];
    matchPoolRef.current = next;
    setMatchPool(next.length > 200 ? next.slice(0, 200) : next);
  }, []);

  const emailPool = matchPool.length ? matchPool : rows;
  const email = useCandidateEmail({
    toast,
    candidates: emailPool,
    selectedIds,
    setSelectedIds: setSelectedIdsSafe,
  });

  const pageIds = rows.map((r) => String(r._id));
  const isPageSelected = allMatching || (pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id)));
  const isPagePartial = !isPageSelected && pageIds.some((id) => selectedIds.includes(id));
  const isAllFilteredSelected =
    allMatching || (totalCount > 0 && selectedIds.length > 0 && selectedIds.length >= totalCount);

  const toggleOne = (id) => {
    const key = String(id);
    setAllMatching(false);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };
  const togglePage = () => {
    if (allMatching || isPageSelected) {
      setAllMatching(false);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  };

  const handleSelectAllFiltered = () => {
    selectAllMatching({
      pageIds,
      pageRows: rows,
      setSelectedIds: setSelectedIdsSafe,
      setMatchPool: rememberPool,
      setAllMatching,
      toast,
      expectedCount: totalCount,
      emptyWarning: 'No matching contacts to select.',
      successPrefix: 'Selected',
    });
  };

  const resolvePool = async () => resolveMatchingPeople({
    fetchMatching,
    entity: 'mis',
    matchPool: matchPoolRef.current.length ? matchPoolRef.current : matchPool,
    selectedIds,
    allMatching,
    pageRows: rows,
    expectedCount: totalCount,
    onHydrated: (loaded) => {
      if (loaded?.rows?.length) matchPoolRef.current = loaded.rows;
    },
  });

  const startEmail = async () => {
    if (!selectedIds.length) {
      toast.warning('Please select at least one contact.');
      return;
    }
    if (allMatching && audienceQuery) {
      const count = (totalCount > selectedIds.length ? totalCount : selectedIds.length) || selectedIds.length;
      const sample = (rows || []).find((c) => String(c.email || '').includes('@'))
        || (rows || [])[0]
        || { _id: 'audience-preview', name: 'Contact', email: 'name@example.com' };
      email.setBulkAudience({
        active: true,
        count,
        channel: 'marketing',
        query: { ...audienceQuery, entity: 'mis', requireConsent: true },
      });
      email.setBulkEmailRecipients([sample]);
      email.setEmailRecipient(sample);
      email.setEmailChannel('marketing');
      email.setEmailMode('template');
      email.setShowEmailModal(true);
      toast.success(
        count > 0
          ? `Ready to email all ${count.toLocaleString()} matching contacts. Send delivers to the full list.`
          : 'Ready to email everyone matching this search.'
      );
    } else {
    email.setBulkAudience?.(null);
    const pool = await resolvePool();
    const eligible = pool.filter((c) => {
      const em = String(c.email || '').trim().toLowerCase();
      if (!em || !em.includes('@')) return false;
      if (c.marketingConsent === false) return false;
      if (c.unsubscribedAt) return false;
      return true;
    }).map((c) => ({ ...c, _id: String(c._id) }));
    if (!eligible.length) {
      toast.warning('No eligible contacts — need a valid email, marketing consent, and not unsubscribed.');
      return;
    }
    email.setBulkEmailRecipients(eligible);
    email.setEmailRecipient(eligible[0]);
    email.setEmailChannel('marketing');
    email.setEmailMode('template');
    email.setShowEmailModal(true);
    }
    try {
      const statusRes = await authenticatedFetch(`${BASE_API_URL}/api/email/sender-status`);
      const statusData = await statusRes.json();
      if (statusData.success) {
        email.setEmailSenderInfo({
          fromEmail: statusData.fromEmail || statusData.agentFrom || '',
          replyTo: statusData.replyTo || '',
          displayName: statusData.displayName || '',
          verifiedDomain: statusData.verifiedDomain || '',
          sendAsUser: Boolean(statusData.sendAsUser),
          agentFrom: statusData.agentFrom || '',
          hint: statusData.hint || '',
        });
      }
    } catch { /* keep */ }
    try {
      const chRes = await authenticatedFetch(`${BASE_API_URL}/api/email/channels`);
      const chData = await chRes.json();
      if (chData.success && chData.channels) {
        email.setChannelsAvailable({
          transactional: false,
          marketing: chData.channels.marketing?.available ?? false,
        });
      }
    } catch { /* keep */ }
    if (!email.emailTemplates?.length) {
      try {
        const res = await authenticatedFetch(`${BASE_API_URL}/api/email-templates`);
        const data = await res.json();
        if (data.success && data.templates?.length) email.setEmailTemplates(data.templates);
      } catch { /* keep */ }
    }
  };

  const startWhatsApp = async () => {
    const pool = await resolvePool();
    const withPhone = pool.filter((c) => String(c.contact || c.phone || '').replace(/\D/g, '').length >= 7);
    if (!withPhone.length) {
      toast.warning('No valid phone numbers found in selected contacts.');
      return;
    }
    setWhatsAppTargets(withPhone);
    setWhatsAppOpen(true);
  };

  const submitBulkEdit = async (updates) => {
    if (!selectedIds.length || !updates || !Object.keys(updates).length) return;
    setBulkEditLoading(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Bulk edit failed');
      toast.success(`Updated ${data.modified ?? selectedIds.length} contact(s)`);
      setBulkEditOpen(false);
      await onReload?.();
    } catch (err) {
      toast.error(err.message || 'Bulk edit failed');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const setConsent = async (value) => {
    setConsentMenuOpen(false);
    if (!selectedIds.length) return;
    try {
      const res = await authenticatedFetch('/api/mis/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates: { marketingConsent: Boolean(value) } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Consent update failed');
      toast.success(value ? 'Consent enabled' : 'Consent removed');
      await onReload?.();
    } catch (err) {
      toast.error(err.message || 'Consent update failed');
    }
  };

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      const res = await authenticatedFetch('/api/mis/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      toast.success(`Deleted ${data.deleted || 0}`);
      setDeleteOpen(false);
      setSelectedIds([]);
      await onReload?.();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const moveToCandidates = async () => {
    setMoving(true);
    try {
      const res = await authenticatedFetch('/api/mis/move-to-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, removeFromMis: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Move failed');
      toast.success(data.message || `Moved ${data.moved || 0}`);
      setMoveOpen(false);
      setSelectedIds([]);
      await onReload?.();
    } catch (err) {
      toast.error(err.message || 'Move failed');
    } finally {
      setMoving(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'srNo',
      label: 'Sr No.',
      className: 'w-auto text-center',
      render: (_, index) => (
        <span className="text-sm font-mono text-stone-500 tabular-nums">
          {(page - 1) * PAGE_SIZE + index + 1}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-stone-900">{row.name || '—'}</span>
        </div>
      ),
    },
    { key: 'contact', label: 'Phone', render: (row) => <span className="text-sm font-mono text-stone-600">{row.contact || row.phone || '—'}</span> },
    { key: 'email', label: 'Email', render: (row) => <span className="text-sm text-stone-600">{row.email || '—'}</span> },
    { key: 'location', label: 'Location', render: (row) => dash(row.location) },
    { key: 'position', label: 'Position', render: (row) => (row.position ? <span className="text-sm font-semibold text-brand-700">{row.position}</span> : <span className="text-stone-300">—</span>) },
    { key: 'companyName', label: 'Company', render: (row) => dash(row.companyName) },
    { key: 'experience', label: 'Experience', render: (row) => dash(row.experience) },
    { key: 'ctc', label: 'CTC', render: (row) => dash(row.ctc) },
    { key: 'expectedCtc', label: 'Expected CTC', render: (row) => dash(row.expectedCtc) },
    { key: 'noticePeriod', label: 'Notice Period', render: (row) => dash(row.noticePeriod) },
    {
      key: 'consent',
      label: 'Marketing consent',
      render: (row) => {
        const ok = row.marketingConsent && !row.unsubscribedAt;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
            ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'
          }`}>
            {ok ? 'Consented' : row.unsubscribedAt ? 'Unsubscribed' : 'No consent'}
          </span>
        );
      },
    },
    { key: 'client', label: 'Client', render: (row) => dash(row.client) },
    { key: 'product', label: 'Product / Skill', render: (row) => dash(row.product) },
    { key: 'source', label: 'Source', render: (row) => (row.source ? <span className="text-sm px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full">{row.source}</span> : <span className="text-stone-300">—</span>) },
    { key: 'uploadedBy', label: 'Uploaded by', render: (row) => <span className="text-sm text-stone-700">{row.createdBy?.name || row.createdBy?.email || '—'}</span> },
    { key: 'date', label: <DateSortHeader value={dateSort} onChange={onDateSort} />, render: (row) => <span className="text-sm text-stone-600 tabular-nums">{formatDate(row.recordDate || row.createdAt)}</span> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const moved = Boolean(row.movedToCandidateAt || row.movedToCandidateId);
        if (moved) {
          return <span className="text-[11px] font-semibold text-indigo-600 whitespace-nowrap">Moved</span>;
        }
        return (
          <button
            type="button"
            onClick={() => { setSelectedIds([String(row._id)]); setMoveOpen(true); }}
            className="h-8 px-2.5 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 hover:border-brand-300 hover:text-brand-700"
          >
            <Users size={13} />
            To Candidates
          </button>
        );
      },
    },
  ], [page, dateSort, onDateSort]);

  const showOverlay = Boolean(loading);
  const totalPages = (countPending || countPlus)
    ? Math.max(1, page + (hasMore ? 1 : 0))
    : Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));

  if (!loading && rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={Megaphone} tone="amber" message="No matching MIS contacts" subMessage="Adjust keywords or filters, or open the Candidates tab." />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-5 pt-3">
        <MisBulkToolbar
          selectedIds={selectedIds}
          onClear={() => { setAllMatching(false); setSelectedIds([]); setMatchPool([]); setConsentMenuOpen(false); }}
          onEmail={startEmail}
          onWhatsApp={startWhatsApp}
          onBulkEdit={() => { setConsentMenuOpen(false); setBulkEditOpen(true); }}
          onConsentMenuToggle={() => setConsentMenuOpen((v) => !v)}
          consentMenuOpen={consentMenuOpen}
          onSetConsent={setConsent}
          onMoveToCandidates={() => setMoveOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          filteredCount={totalCount}
          isAllFilteredSelected={isAllFilteredSelected}
          selectingAll={false}
          onSelectAllFiltered={handleSelectAllFiltered}
        />
      </div>
      <div className="relative min-h-[280px]">
        <div
          ref={tableScrollRef}
          className={`cand-table-scroll overflow-x-auto select-none ${showOverlay ? 'pointer-events-none opacity-45 blur-[2.5px]' : ''}`}
          onMouseDown={showOverlay ? undefined : onTableDragScrollStart}
          onMouseMove={showOverlay ? undefined : onTableDragScrollMove}
          onMouseUp={showOverlay ? undefined : onTableDragScrollEnd}
          onMouseLeave={showOverlay ? undefined : onTableDragScrollEnd}
          onCopy={guardTableCopy}
        >
          <table className="cand-table-drag w-max min-w-full text-left border-collapse select-none border border-stone-200" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="bg-stone-100">
                <th className="px-3.5 py-3.5 w-[52px] text-center border border-stone-200 bg-stone-100">
                  <button type="button" onClick={togglePage} className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-200/80" aria-label="Select this page">
                    {isPageSelected ? <CheckSquare size={18} className="text-brand-600" /> : isPagePartial ? <MinusSquare size={18} className="text-brand-500" /> : <Square size={18} className="text-stone-400" />}
                  </button>
                </th>
                {columns.map((column) => (
                  <th key={column.key} className={`px-3.5 py-3.5 text-[10px] font-bold text-stone-600 uppercase tracking-wider whitespace-nowrap border border-stone-200 bg-stone-100 ${column.className || ''}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const id = String(row._id);
                const isSelected = allMatching || selectedIds.includes(id);
                return (
                  <tr key={id} className={`${isSelected ? 'bg-brand-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'} hover:bg-brand-50/50`}>
                    <td className="px-3.5 py-3 text-center w-[52px] border border-stone-200">
                      <button type="button" onClick={() => toggleOne(id)} className="cursor-pointer flex justify-center mx-auto p-1 rounded hover:bg-stone-100">
                        {isSelected ? <CheckSquare className="text-brand-600" size={17} /> : <Square className="text-stone-300" size={17} />}
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td key={`${id}-${column.key}`} className="px-3.5 py-3 text-sm text-stone-700 font-medium border border-stone-200 align-middle whitespace-nowrap">
                        {column.render(row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <CandidatesPagination
        visibleCandidates={rows}
        currentPage={page}
        setCurrentPage={setPage}
        filteredCandidates={rows}
        totalFilteredPages={totalPages}
        totalCount={totalCount}
        countPending={countPending}
        countPlus={countPlus}
      />

      <CandidateEmailModal
        showEmailModal={email.showEmailModal}
        emailRecipient={email.emailRecipient}
        setShowEmailModal={email.setShowEmailModal}
        bulkEmailRecipients={email.bulkEmailRecipients}
        setBulkEmailRecipients={email.setBulkEmailRecipients}
        bulkAudience={email.bulkAudience}
        setBulkAudience={email.setBulkAudience}
        setSelectedIds={setSelectedIdsSafe}
        emailChannel={email.emailChannel}
        setEmailChannel={email.setEmailChannel}
        channelsAvailable={email.channelsAvailable}
        emailSenderInfo={email.emailSenderInfo}
        emailMode={email.emailMode}
        setEmailMode={email.setEmailMode}
        emailCC={email.emailCC}
        setEmailCC={email.setEmailCC}
        emailBCC={email.emailBCC}
        setEmailBCC={email.setEmailBCC}
        teamMembers={[]}
        ccInput={email.ccInput}
        setCcInput={email.setCcInput}
        bccInput={email.bccInput}
        setBccInput={email.setBccInput}
        showCCPicker={email.showCCPicker}
        setShowCCPicker={email.setShowCCPicker}
        showBCCPicker={email.showBCCPicker}
        setShowBCCPicker={email.setShowBCCPicker}
        emailTemplates={email.emailTemplates}
        emailTemplatesLoading={email.emailTemplatesLoading}
        selectedTemplate={email.selectedTemplate}
        selectEmailTemplate={email.selectEmailTemplate}
        setSelectedTemplate={email.setSelectedTemplate}
        templateVars={email.templateVars}
        setTemplateVars={email.setTemplateVars}
        templateDraftSubject={email.templateDraftSubject}
        setTemplateDraftSubject={email.setTemplateDraftSubject}
        templateDraftBody={email.templateDraftBody}
        setTemplateDraftBody={email.setTemplateDraftBody}
        templateDraftDirty={email.templateDraftDirty}
        setTemplateDraftDirty={email.setTemplateDraftDirty}
        emailType={email.emailType}
        setEmailType={email.setEmailType}
        quickName={email.quickName}
        setQuickName={email.setQuickName}
        quickPosition={email.quickPosition}
        setQuickPosition={email.setQuickPosition}
        quickDepartment={email.quickDepartment}
        setQuickDepartment={email.setQuickDepartment}
        quickJoiningDate={email.quickJoiningDate}
        setQuickJoiningDate={email.setQuickJoiningDate}
        customMessage={email.customMessage}
        setCustomMessage={email.setCustomMessage}
        quickSubject={email.quickSubject}
        setQuickSubject={email.setQuickSubject}
        showQuickPreview={email.showQuickPreview}
        setShowQuickPreview={email.setShowQuickPreview}
        quickPreviewHtml={email.quickPreviewHtml}
        setQuickPreviewHtml={email.setQuickPreviewHtml}
        quickPreviewSubject={email.quickPreviewSubject}
        setQuickPreviewSubject={email.setQuickPreviewSubject}
        loadingPreview={email.loadingPreview}
        setLoadingPreview={email.setLoadingPreview}
        isSendingEmail={email.isSendingEmail}
        sendTemplateEmail={email.sendTemplateEmail}
        sendSingleEmail={email.sendSingleEmail}
        jobs={jobs}
        campaignJobId={email.campaignJobId}
        setCampaignJobId={email.setCampaignJobId}
        campaignJobMeta={email.campaignJobMeta}
        setCampaignJobMeta={email.setCampaignJobMeta}
        toast={toast}
      />
      <EmailCampaignResultModal
        open={Boolean(email.showEmailCampaignResult)}
        result={email.emailCampaignResult}
        onClose={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
        }}
        onViewReports={() => {
          email.setShowEmailCampaignResult?.(false);
          email.setEmailCampaignResult?.(null);
          navigate('/email-reports');
        }}
      />
      <MisBulkEditModal
        open={bulkEditOpen}
        onClose={() => !bulkEditLoading && setBulkEditOpen(false)}
        selectedCount={selectedIds.length}
        onSubmit={submitBulkEdit}
        isLoading={bulkEditLoading}
      />
      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => { if (!deleting) setDeleteOpen(false); }}
        onConfirm={deleteSelected}
        type="delete"
        title={`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}?`}
        message="Selected contacts will be removed from MIS. Candidate records are not affected."
        confirmText="Delete"
        isLoading={deleting}
      />
      <ConfirmationModal
        isOpen={moveOpen}
        onClose={() => { if (!moving) setMoveOpen(false); }}
        onConfirm={moveToCandidates}
        type="info"
        title={`Add ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'} to Candidates?`}
        message="Creates candidate records on your desk. Contacts stay in MIS and are marked In Candidates. Duplicates and invalid rows are skipped with a clear count."
        confirmText="Add to Candidates"
        isLoading={moving}
      />
      <ConfirmationModal
        isOpen={whatsAppOpen}
        onClose={() => { setWhatsAppOpen(false); setWhatsAppTargets([]); }}
        onConfirm={() => {
          setWhatsAppOpen(false);
          whatsAppTargets.forEach((c, i) => {
            setTimeout(() => {
              window.open(`https://wa.me/${String(c.contact || c.phone || '').replace(/\D/g, '')}`, '_blank');
            }, i * 500);
          });
        }}
        type="info"
        title="Open WhatsApp"
        message={`Open WhatsApp for ${whatsAppTargets.length} contact(s)? Each will open in a new tab.`}
        confirmText="Open WhatsApp"
      />
    </>
  );
}
