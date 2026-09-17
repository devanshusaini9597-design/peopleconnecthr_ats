import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Compass,
  Map,
  Briefcase,
  Users,
  History,
  BarChart3,
  ChevronRight,
  ExternalLink,
  Shield,
} from 'lucide-react';
import Modal from './ui/Modal';
import {
  getLatestProductUpdate,
  latestProductUpdateId,
  readSeenProductUpdateId,
  isAdminAudienceRole,
  isProductUpdateUnseen,
  filterProductUpdateForRole,
} from '../config/productUpdates';
import { requestProductTour } from '../utils/productTourTrigger';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel } from './organization/constants';

const HIGHLIGHT_ICONS = [Briefcase, Users, History, BarChart3, Shield];

/**
 * Single product release notes modal (not a dated changelog timeline).
 * Content is filtered by role. Seen/unread state is per user account.
 */
const WhatsNewModal = ({ open, onClose, onAcknowledge }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'recruiter';
  const userId = String(user?.id || user?._id || user?.email || '').trim();
  const roleLabel = formatRoleLabel(role);
  const showAdminCue = isAdminAudienceRole(role) || role === 'owner';

  const seenId = useMemo(() => {
    if (!userId) return '';
    return readSeenProductUpdateId(userId);
  }, [open, userId]);

  const release = useMemo(() => {
    const latest = getLatestProductUpdate(role);
    if (!latest) return null;
    return {
      ...filterProductUpdateForRole(latest, role),
      unseen: isProductUpdateUnseen(latest.id, seenId),
    };
  }, [role, seenId]);

  if (!open || !release) return null;

  const dismiss = () => {
    onAcknowledge?.(latestProductUpdateId(role));
    onClose?.();
  };

  const goExplore = (item) => {
    onAcknowledge?.(latestProductUpdateId(role));
    onClose?.();
    if (item.tourKey) {
      requestProductTour(item.tourKey);
    }
    const rawPath = String(item.path || '/dashboard');
    const hashName = item.hash ? String(item.hash).replace(/^#/, '') : '';
    let pathname = rawPath;
    let search = '';
    try {
      const u = new URL(rawPath, window.location.origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      const q = rawPath.indexOf('?');
      if (q >= 0) {
        pathname = rawPath.slice(0, q);
        search = rawPath.slice(q);
      }
    }
    navigate({
      pathname,
      search: search || undefined,
      hash: hashName ? `#${hashName}` : undefined,
    });
    if (hashName) {
      window.setTimeout(() => {
        try {
          document.getElementById(hashName)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        } catch {
          /* ignore */
        }
      }, 450);
    }
  };

  const primaryTour = (release.explore || []).find((e) => e.tourKey)
    || (release.explore || [])[0];

  return (
    <Modal
      open={open}
      onClose={dismiss}
      size="lg"
      zClass="z-[90]"
      icon={Sparkles}
      title="What's new"
      description={release.title}
      footer={
        <>
          <button type="button" onClick={dismiss} className="btn-secondary">
            Dismiss
          </button>
          {primaryTour ? (
            <button
              type="button"
              onClick={() => goExplore(primaryTour)}
              className="btn-primary"
            >
              <Map size={15} />
              {primaryTour.tourKey ? 'Start guided tour' : primaryTour.label}
            </button>
          ) : (
            <button type="button" onClick={dismiss} className="btn-primary">
              Continue
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-800 border border-brand-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
            Product release
          </span>
          <span className="inline-flex items-center rounded-md bg-stone-100 text-stone-600 border border-stone-200 px-2 py-0.5 text-[11px] font-semibold">
            For {roleLabel}
          </span>
          {release.unseen ? (
            <span className="inline-flex items-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 text-[11px] font-semibold">
              Unread
            </span>
          ) : null}
        </div>

        {release.summary ? (
          <p className="text-sm text-stone-600 leading-relaxed border-l-2 border-brand-400 pl-3">
            {release.summary}
          </p>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2.5">
            What’s included
          </p>
          <ol className="space-y-0 divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden bg-white">
            {(release.highlights || []).map((h, idx) => {
              const title = typeof h === 'string' ? null : h.title;
              const body = typeof h === 'string' ? h : h.body;
              const audience = typeof h === 'string' ? 'all' : (h.audience || 'all');
              const Icon = HIGHLIGHT_ICONS[idx % HIGHLIGHT_ICONS.length];
              const isAdminOnly = audience === 'admin' && showAdminCue;
              return (
                <li key={`${release.id}-${title || body}`} className="flex gap-3 px-3.5 py-3.5 bg-white hover:bg-stone-50/80 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-100 text-brand-700 flex items-center justify-center mt-0.5">
                    <Icon size={15} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-stone-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {title ? (
                        <p className="text-sm font-semibold text-stone-900">{title}</p>
                      ) : null}
                      {isAdminOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          <Shield size={10} />
                          Admin
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-[13px] text-stone-600 leading-relaxed ${title ? 'mt-0.5' : ''}`}>
                      {body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {Array.isArray(release.explore) && release.explore.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2.5 flex items-center gap-1.5">
              <Compass size={12} className="text-brand-600" />
              Related actions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {release.explore.map((item) => {
                const isTour = Boolean(item.tourKey);
                return (
                  <button
                    key={`${item.path}-${item.label}`}
                    type="button"
                    onClick={() => goExplore(item)}
                    className="group flex items-center gap-2.5 text-left rounded-xl border border-stone-200 bg-white px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm transition-all"
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      isTour
                        ? 'bg-brand-600 text-white'
                        : 'bg-stone-100 text-stone-600 group-hover:bg-brand-100 group-hover:text-brand-700'
                    }`}>
                      {isTour ? <Map size={14} /> : <ExternalLink size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-stone-900 leading-snug">
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-stone-500 mt-0.5">
                        {item.audience === 'admin'
                          ? 'Administration'
                          : isTour
                            ? 'Guided walkthrough'
                            : 'Open in workspace'}
                      </span>
                    </span>
                    <ChevronRight size={14} className="flex-shrink-0 text-stone-300 group-hover:text-brand-600" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default WhatsNewModal;
