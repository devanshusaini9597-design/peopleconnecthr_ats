import React from 'react';
import { SquarePen, Share2, Trash2, Eye, FileDown, Mail, Info } from 'lucide-react';
import { WhatsAppIcon } from '../icons/BrandIcons';
import SendWhatsAppButton from '../SendWhatsAppButton';
import { PAGE_SIZE } from './atsConstants';

export function buildCandidateTableColumns(ctx) {
  const {
    handleEdit, handleShareClick, handleDelete, handleResumePreview, handleResumeDownload,
    handleSendEmail, sendWhatsApp, blindMode, currentPage, remarkPopoverTimeoutRef,
    setRemarkPopover, orgCandidateFields, candidates,
  } = ctx;

  const tableColumns = [
    {
      key: 'actions',
      label: 'Actions',
      className: 'min-w-[132px]',
      render: (candidate) => (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => handleEdit(candidate)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-100 bg-brand-50/80 text-brand-700 shadow-sm hover:bg-brand-100 hover:border-brand-200 transition-all"
            title="Edit candidate"
          >
            <SquarePen size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => handleShareClick(candidate)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-teal-100 bg-teal-50/80 text-teal-700 shadow-sm hover:bg-teal-100 hover:border-teal-200 transition-all"
            title="Share with team"
          >
            <Share2 size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(candidate._id)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50/70 text-red-600 shadow-sm hover:bg-red-100 hover:border-red-200 transition-all"
            title="Delete candidate"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      )
    },
    { key: 'srNo', label: 'Sr No.', className: 'min-w-[64px] text-center', render: (_, index) => <span className="text-sm font-mono text-stone-500 tabular-nums">{(currentPage - 1) * PAGE_SIZE + index + 1}</span> },
    {
      key: 'resume',
      label: 'Resume',
      className: 'min-w-[96px]',
      render: (candidate) => candidate.resume ? (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => handleResumePreview(candidate)}
            title="Preview resume"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-sky-100 bg-sky-50/80 text-sky-700 shadow-sm hover:bg-sky-100 hover:border-sky-200 transition-all"
          >
            <Eye size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => handleResumeDownload(candidate)}
            title="Download resume"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/80 text-emerald-700 shadow-sm hover:bg-emerald-100 hover:border-emerald-200 transition-all"
          >
            <FileDown size={15} strokeWidth={2} />
          </button>
        </div>
      ) : <span className="text-stone-300">—</span>
    },
    {
      key: 'tools',
      label: 'Contact',
      className: 'min-w-[132px]',
      render: (candidate) => (
        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => handleSendEmail(candidate)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-brand-100 bg-brand-50/80 text-brand-700 shadow-sm hover:bg-brand-100 hover:border-brand-200 transition-all"
            title="Send email"
          >
            <Mail size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => sendWhatsApp(candidate.contact)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-[#25D366]/12 text-[#128C7E] shadow-sm hover:bg-[#25D366]/20 hover:border-emerald-300 transition-all"
            title="Open WhatsApp chat"
          >
            <WhatsAppIcon size={15} />
          </button>
          <SendWhatsAppButton
            candidate={candidate}
            iconSize={15}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-violet-100 bg-violet-50/80 text-[#128C7E] shadow-sm hover:bg-violet-100 hover:border-violet-200 transition-all"
          />
        </div>
      )
    },
    { key: 'date', label: 'Date', className: 'min-w-[110px]', render: (candidate) => <span className="text-sm text-stone-600 whitespace-nowrap">{candidate.date ? new Date(candidate.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span> },
    { key: 'location', label: 'Location', className: 'min-w-[120px]', render: (candidate) => <span className="text-sm text-stone-700 whitespace-nowrap">{candidate.location || '—'}</span> },
    { key: 'position', label: 'Position', className: 'min-w-[140px]', render: (candidate) => candidate.position ? <span className="text-sm font-semibold text-brand-700 whitespace-nowrap">{candidate.position}</span> : <span className="text-stone-300">—</span> },
    {
      key: 'fls',
      label: 'FLS',
      className: 'min-w-[96px]',
      render: (candidate) => candidate.fls ? (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${candidate.fls === 'FLS' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-stone-100 text-stone-600 ring-1 ring-stone-200/80'}`}>
          {candidate.fls}
        </span>
      ) : <span className="text-stone-300">—</span>
    },
    { key: 'name', label: blindMode ? 'Candidate' : 'Name', className: 'min-w-[180px]', render: (candidate) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-700 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm shadow-brand-500/20">
          {blindMode ? '#' : (candidate.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-stone-900 whitespace-nowrap truncate max-w-[160px]">
              {blindMode ? `Candidate ${String(candidate._id).slice(-6).toUpperCase()}` : candidate.name}
            </span>
            {blindMode && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-700 whitespace-nowrap flex-shrink-0" title="Blind screening hides PII">
                Blind
              </span>
            )}
            {!blindMode && candidate._isShared && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 whitespace-nowrap flex-shrink-0" title={`Shared by ${candidate._sharedByOwner || 'team member'}`}>
                Shared
              </span>
            )}
          </div>
        </div>
      </div>
    )},
    { key: 'contact', label: 'Contact', className: 'min-w-[120px]', render: (candidate) => <span className="text-sm font-mono text-stone-600 whitespace-nowrap">{blindMode ? '••••••••' : (candidate.contact || '—')}</span> },
    { key: 'email', label: 'Email', render: (candidate) => <span className="text-sm text-stone-600 whitespace-nowrap">{blindMode ? '••••@••••' : (candidate.email || '—')}</span> },
    { key: 'companyName', label: 'Company', render: (candidate) => <span className="text-sm text-stone-700 whitespace-nowrap">{candidate.companyName || '—'}</span> },
    { key: 'experience', label: 'Experience', render: (candidate) => candidate.experience ? <span className="text-sm">{candidate.experience} </span> : <span className="text-stone-300">—</span> },
    {
      key: 'ctc',
      label: 'CTC',
      render: (candidate) => candidate.ctc ? <span className="text-sm whitespace-nowrap">{candidate.ctc}</span> : <span className="text-stone-300">—</span>
    },
    {
      key: 'expectedCtc',
      label: 'Expected CTC',
      render: (candidate) => candidate.expectedCtc ? <span className="text-sm whitespace-nowrap">{candidate.expectedCtc}</span> : <span className="text-stone-300">—</span>
    },
    {
      key: 'noticePeriod',
      label: 'Notice Period',
      render: (candidate) => candidate.noticePeriod ? <span className="text-sm whitespace-nowrap">{candidate.noticePeriod}</span> : <span className="text-stone-300">—</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (candidate) => {
        const remark = candidate.remark || '';
        const hasTooltip = !!remark;
        return (
          <div className="flex items-center gap-2">
            <span className={
              `inline-flex px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap ` +
              (candidate.status === 'Hired' ? 'bg-green-100 text-green-700' :
                candidate.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                candidate.status === 'Interview' ? 'bg-brand-100 text-brand-700' :
                'bg-brand-50 text-brand-700')
            }>
              {candidate.status}
            </span>
            {hasTooltip && (
              <button
                type="button"
                className="p-1 rounded-full hover:bg-stone-100 transition-colors"
                title="View remark"
                onMouseEnter={(e) => {
                  if (remarkPopoverTimeoutRef.current) clearTimeout(remarkPopoverTimeoutRef.current);
                  const r = e.currentTarget.getBoundingClientRect();
                  const centerX = r.left + r.width / 2;
                  const iconTop = r.top;
                  const showAbove = iconTop > 140;
                  setRemarkPopover({ left: centerX, top: iconTop, remark, showAbove });
                }}
                onMouseLeave={() => {
                  remarkPopoverTimeoutRef.current = setTimeout(() => setRemarkPopover(null), 150);
                }}
              >
                <Info size={16} className="text-stone-400 hover:text-stone-600" />
              </button>
            )}
          </div>
        );
      }
    },
    { key: 'client', label: 'Client', render: (candidate) => <span className="text-sm text-stone-700 whitespace-nowrap">{candidate.client || '—'}</span> },
    { key: 'spoc', label: 'SPOC', render: (candidate) => <span className="text-sm text-stone-700 whitespace-nowrap">{candidate.spoc || '—'}</span> },
    {
      key: 'source',
      label: 'Source',
      render: (candidate) => candidate.source ? <span className="text-sm px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full whitespace-nowrap">{candidate.source}</span> : <span className="text-stone-300">—</span>
    },
    ...orgCandidateFields
      .filter((f) => !f.isCore && f.showInTable !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((f) => ({
        key: `cf_${f.key}`,
        label: f.label,
        className: 'min-w-[120px]',
        render: (candidate) => {
          const raw = candidate.customFields?.[f.key];
          if (raw === undefined || raw === null || raw === '') return <span className="text-stone-300">—</span>;
          if (f.type === 'boolean') {
            const on = raw === true || raw === 'true' || raw === 'Yes' || raw === 1 || raw === '1';
            return <span className="text-sm whitespace-nowrap">{on ? 'Yes' : 'No'}</span>;
          }
          return <span className="text-sm text-stone-700 whitespace-nowrap">{String(raw)}</span>;
        },
      })),
    ...(candidates.some(c => c._isShared) ? [{
      key: 'sharedBy',
      label: 'Shared By',
      render: (candidate) => candidate._isShared ? (
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">
          {candidate._sharedByOwner || 'Team'}
        </span>
      ) : <span className="text-stone-300">—</span>
    }] : [])
  ];
  return tableColumns;
}
