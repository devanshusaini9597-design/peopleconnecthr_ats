import React from 'react';
import { Eye } from 'lucide-react';
import Modal from '../../ui/Modal';

/**
 * Full-screen-style email preview dialog (opens above the compose modal).
 */
export default function EmailPreviewModal({
  open,
  onClose,
  subject = '',
  html = '',
  to = '',
  brand = '',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email preview"
      description={subject || 'How this message will look when sent'}
      size="xl"
      zClass="z-[220]"
      icon={Eye}
      footer={
        <button type="button" onClick={onClose} className="btn-primary">
          Close preview
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide">Subject</p>
          <p className="text-sm font-semibold text-stone-900 mt-0.5 break-words">
            {subject || '—'}
          </p>
          {to ? (
            <p className="text-xs text-stone-500 mt-2 truncate" title={to}>
              To {to}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-stone-200 overflow-hidden bg-white shadow-sm">
          <iframe
            srcDoc={html || '<p style="padding:24px;color:#78716c;font-family:sans-serif;">No preview</p>'}
            title="Email preview"
            className="w-full border-0 bg-white"
            style={{ height: 'min(60vh, 520px)', minHeight: '320px' }}
            sandbox=""
          />
          {(brand || to) && (
            <div className="px-4 py-2.5 border-t border-stone-100 flex justify-between gap-3 text-[11px] text-stone-400 bg-stone-50">
              <span className="truncate">{brand || 'Organization'}</span>
              {to ? <span className="truncate">To {to}</span> : null}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
