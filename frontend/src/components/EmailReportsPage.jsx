import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  Filter,
  Inbox,
  AlertCircle,
  Megaphone,
  Zap,
  GitBranch,
  XCircle,
  Loader2,
  X,
  Eye,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import EmailHtmlFrame from './ui/EmailHtmlFrame';
import ProductTour from './ui/ProductTour';
import TourHelpFab from './ui/TourHelpFab';
import usePageTour from '../hooks/usePageTour';
import useHorizontalDragScroll from '../hooks/useHorizontalDragScroll';
import { useToast } from './Toast';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import API_URL from '../config';
import EmailReportsTable from './emailReports/EmailReportsTable';
import FunnelMetricCard from './emailReports/FunnelMetricCard';
import {
  CHANNEL_TABS,
  EMAIL_REPORTS_TOUR_KEY,
  EMAIL_REPORTS_TOUR_STEPS,
  METRIC_LABELS,
  buildKpiFunnel,
} from './emailReports/emailReportsConstants';

const BASE = API_URL;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'completed', label: 'Completed' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'bounced', label: 'Bounced' },
];

const STATUS_STYLES = {
  accepted: 'bg-sky-50 text-sky-800 ring-sky-200/80',
  sending: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  sent: 'bg-stone-100 text-stone-700 ring-stone-200/80',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  opened: 'bg-teal-50 text-teal-800 ring-teal-200/80',
  clicked: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  failed: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  bounced: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  soft_bounced: 'bg-orange-50 text-orange-800 ring-orange-200/80',
  hard_bounced: 'bg-rose-50 text-rose-900 ring-rose-300/80',
  unsubscribed: 'bg-stone-100 text-stone-600 ring-stone-200/80',
  spam: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  unopened: 'bg-stone-50 text-stone-500 ring-stone-200/80',
  replied: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  queued: 'bg-stone-50 text-stone-500 ring-stone-200/80',
};

function Badge({ children, tone = 'sent' }) {
  const cls = STATUS_STYLES[tone] || STATUS_STYLES.sent;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {String(children || '').replace(/_/g, ' ')}
    </span>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(/\s*(AM|PM)\s*/i, (m) => ` ${m.trim().toLowerCase()}`);
  const date = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${time} · ${date} IST`;
}

async function readJson(res) {
  const ct = String(res.headers.get('content-type') || '');
  const text = await res.text();
  const trimmed = (text || '').trim();
  if (!trimmed) return {};
  if (ct.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      const err = new Error(`Invalid JSON from server (HTTP ${res.status}).`);
      err.status = res.status;
      throw err;
    }
  }
  if (trimmed.startsWith('<')) {
    const err = new Error(
      res.status >= 500
        ? 'Backend is restarting or unavailable. Wait ~1 minute, then click Retry.'
        : `Unexpected HTML response (HTTP ${res.status}). If this persists, Railway may still be deploying.`
    );
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const err = new Error(`Invalid server response (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
}

function emptySummary() {
  return {
    sends: 0,
    recipients: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    replied: 0,
    failed: 0,
    unsubscribed: 0,
  };
}

function DetailPanel({ item, onClose, onSync, syncing }) {
  if (!item) return null;
  const recipients = item.recipients || [];
  const totals = item.totals || {};
  const unsubscribedContacts = recipients.filter(
    (r) => r.status === 'unsubscribed' || r.unsubscribedAt
  );
  const subscribedContacts = recipients.filter(
    (r) =>
      r.status !== 'unsubscribed' &&
      !r.unsubscribedAt &&
      r.status !== 'failed' &&
      r.status !== 'hard_bounced' &&
      r.status !== 'soft_bounced'
  );
  const previewHtml = String(item.htmlBody || item.textBody || '').trim();
  const previewTo =
    recipients.length === 1
      ? recipients[0].email
      : recipients.length > 1
        ? `${recipients[0]?.email || ''} +${recipients.length - 1} more`
        : '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-[1px] animate-page-enter">
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="modal-panel-ats flex h-full w-full max-w-4xl flex-col border-l border-stone-200 bg-[#f6f5f3] shadow-[0_24px_80px_-24px_rgba(28,25,23,0.45)]">
        <div className="relative border-b border-stone-200/80 bg-white px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {item.channel} · {(item.provider || '').replace(/_/g, ' ')}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-stone-900">
                {item.subject || item.campaignName || 'Untitled send'}
              </h2>
              <p className="mt-1 text-sm font-medium text-stone-600">{fmtDate(item.sentAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onSync(item._id)}
                disabled={syncing}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh delivery
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"
                aria-label="Close details"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Mail preview — ZeptoMail / Zoho Campaigns style */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4 text-stone-500" />
              <h3 className="text-sm font-semibold tracking-tight text-stone-900">Sent message</h3>
            </div>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_8px_30px_-18px_rgba(28,25,23,0.45)]">
              <div className="space-y-1.5 border-b border-stone-100 bg-stone-50/90 px-4 py-3 text-xs">
                <div className="flex gap-2">
                  <span className="w-14 shrink-0 font-semibold uppercase tracking-wide text-stone-400">
                    Subject
                  </span>
                  <span className="min-w-0 break-words font-medium text-stone-800">
                    {item.subject || '—'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-14 shrink-0 font-semibold uppercase tracking-wide text-stone-400">
                    From
                  </span>
                  <span className="min-w-0 break-all text-stone-700">{item.fromEmail || '—'}</span>
                </div>
                {previewTo ? (
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 font-semibold uppercase tracking-wide text-stone-400">
                      To
                    </span>
                    <span className="min-w-0 break-all text-stone-700">{previewTo}</span>
                  </div>
                ) : null}
              </div>
              {previewHtml ? (
                <EmailHtmlFrame
                  html={previewHtml}
                  title="Email preview"
                  className="w-full border-0 bg-white"
                  style={{ height: 'min(68vh, 720px)', minHeight: '420px' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 bg-white px-6 py-16 text-center">
                  <Mail className="h-8 w-8 text-stone-300" />
                  <p className="text-sm font-medium text-stone-700">Message preview is not available</p>
                  <p className="max-w-md text-xs leading-relaxed text-stone-500">
                    The provider has not returned the sent layout for this record. Choose Refresh delivery, wait for it to finish, then open this send again.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ['Sent', totals.sent],
              ['Delivered', totals.delivered],
              ['Opened', totals.opened],
              ['Clicked', totals.clicked],
              ['Bounced', totals.bounced],
              ['Unsubscribed', totals.unsubscribed],
              ['Replied', totals.replied],
              ['Failed', totals.failed],
              ['Spam', totals.spam],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-stone-900">{val ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={item.status}>{item.status}</Badge>
          </div>

          <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 text-sm shadow-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">From</dt>
              <dd className="mt-0.5 break-all font-medium text-stone-800">{item.fromEmail || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Reply-To</dt>
              <dd className="mt-0.5 break-all font-medium text-stone-800">{item.replyToEmail || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Sent by</dt>
              <dd className="mt-0.5 font-medium text-stone-800">
                {item.sentByUserId?.name || item.sentByUserId?.email || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Type</dt>
              <dd className="mt-0.5 font-medium text-stone-800">{item.emailType || item.channel}</dd>
            </div>
            {item.campaignKey && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-stone-500">Campaign key</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-stone-700">{item.campaignKey}</dd>
              </div>
            )}
            {item.messageId && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-stone-500">Message ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-stone-700">{item.messageId}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Last synced</dt>
              <dd className="mt-0.5 font-medium text-stone-800">{fmtDate(item.lastSyncedAt)}</dd>
            </div>
            {item.lastError ? (
              <div className="sm:col-span-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-rose-800">
                <p className="text-xs font-semibold uppercase">Last sync note</p>
                <p className="mt-1 text-sm">{item.lastError}</p>
              </div>
            ) : null}
          </dl>

          {unsubscribedContacts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold tracking-tight text-rose-800">
                Unsubscribed ({unsubscribedContacts.length})
              </h3>
              <div className="overflow-hidden rounded-2xl border border-rose-200/80">
                <ul className="divide-y divide-rose-100 bg-white">
                  {unsubscribedContacts.map((r) => (
                    <li key={`unsub-${r.email}`} className="px-3 py-2.5 text-sm">
                      <div className="break-all font-medium text-stone-800">{r.email}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-stone-500">
                        {r.name ? <span>{r.name}</span> : null}
                        {r.unsubscribedAt ? <span>Opted out {fmtDate(r.unsubscribedAt)}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {subscribedContacts.length > 0 && item.channel === 'marketing' && (
            <div>
              <h3 className="mb-2 text-sm font-bold tracking-tight text-stone-900">
                Still subscribed ({subscribedContacts.length})
              </h3>
              <p className="mb-2 text-xs text-stone-500">
                Recipients on this send who have not unsubscribed or bounced.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-2xl border border-stone-200/80">
                <ul className="divide-y divide-stone-100 bg-white">
                  {subscribedContacts.slice(0, 100).map((r) => (
                    <li key={`sub-${r.email}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 break-all font-medium text-stone-800">{r.email}</span>
                      <Badge tone={r.status}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
              {subscribedContacts.length > 100 ? (
                <p className="mt-1 text-xs text-stone-400">Showing first 100 contacts.</p>
              ) : null}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold tracking-tight text-stone-900">
              All recipients ({recipients.length})
            </h3>
            <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
              <table className="min-w-full border-collapse border border-stone-300 text-sm">
                <thead className="bg-stone-100 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">
                  <tr>
                    <th className="border border-stone-300 px-3 py-2.5">Email</th>
                    <th className="border border-stone-300 px-3 py-2.5">Status</th>
                    <th className="border border-stone-300 px-3 py-2.5">Opens</th>
                    <th className="border border-stone-300 px-3 py-2.5">Clicks</th>
                    <th className="border border-stone-300 px-3 py-2.5">Timeline</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border border-stone-300 px-3 py-8 text-center text-stone-500">
                        Recipient activity is not available yet. Refresh delivery to load it from the provider.
                      </td>
                    </tr>
                  )}
                  {recipients.map((r) => (
                    <tr key={r.email} className="align-top">
                      <td className="border border-stone-300 px-3 py-2.5">
                        <div className="break-all font-medium text-stone-800">{r.email}</div>
                        {r.name ? <div className="text-xs text-stone-500">{r.name}</div> : null}
                        {r.bounceReason ? (
                          <div className="mt-1 text-xs text-rose-600">{r.bounceReason}</div>
                        ) : null}
                      </td>
                      <td className="border border-stone-300 px-3 py-2.5">
                        <Badge tone={r.status}>{r.status}</Badge>
                      </td>
                      <td className="border border-stone-300 px-3 py-2.5 tabular-nums">{r.openCount || 0}</td>
                      <td className="border border-stone-300 px-3 py-2.5 tabular-nums">{r.clickCount || 0}</td>
                      <td className="border border-stone-300 px-3 py-2.5 text-xs text-stone-600">
                        <div>Sent: {fmtDate(r.sentAt)}</div>
                        {r.deliveredAt && <div>Delivered: {fmtDate(r.deliveredAt)}</div>}
                        {r.openedAt && <div>Opened: {fmtDate(r.openedAt)}</div>}
                        {r.clickedAt && <div>Clicked: {fmtDate(r.clickedAt)}</div>}
                        {r.bouncedAt && <div>Bounced: {fmtDate(r.bouncedAt)}</div>}
                        {r.unsubscribedAt && <div>Unsubscribed: {fmtDate(r.unsubscribedAt)}</div>}
                        {r.repliedAt && <div>Replied: {fmtDate(r.repliedAt)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

const EmailReportsPage = () => {
  const toast = useToast();
  const [tourOpen, setTourOpen] = usePageTour(EMAIL_REPORTS_TOUR_KEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary());
  const [channelSummaries, setChannelSummaries] = useState({
    marketing: emptySummary(),
    transactional: emptySummary(),
    system: emptySummary(),
  });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('marketing');
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    metric: 'all',
    page: 1,
  });
  const [searchInput, setSearchInput] = useState('');

  const {
    scrollRef: kpiScrollRef,
    didDrag: kpiDidDrag,
    dragHandlers: kpiDragHandlers,
  } = useHorizontalDragScroll({ allowOnInteractive: true });

  const activeMeta = CHANNEL_TABS.find((t) => t.id === activeTab) || CHANNEL_TABS[0];

  const displaySummary = useMemo(() => {
    if (activeTab === 'marketing') return channelSummaries.marketing || emptySummary();
    if (activeTab === 'transactional') return channelSummaries.transactional || emptySummary();
    return summary;
  }, [activeTab, channelSummaries, summary]);

  const kpiFunnel = useMemo(
    () => buildKpiFunnel(displaySummary, activeTab),
    [displaySummary, activeTab]
  );

  // Debounce search so typing feels premium and doesn't spam the API
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => {
        if (f.search === searchInput) return f;
        return { ...f, search: searchInput, page: 1 };
      });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (activeTab === 'marketing') p.set('channel', 'marketing');
    else if (activeTab === 'transactional') p.set('channel', 'transactional');
    if (filters.status !== 'all') p.set('status', filters.status);
    if (filters.metric && filters.metric !== 'all') p.set('metric', filters.metric);
    if (filters.search.trim()) p.set('search', filters.search.trim());
    p.set('page', String(filters.page || 1));
    p.set('limit', '25');
    return p.toString();
  }, [activeTab, filters]);

  const filtersActive =
    filters.status !== 'all' ||
    Boolean(filters.search.trim()) ||
    (filters.metric && filters.metric !== 'all');

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ status: 'all', search: '', metric: 'all', page: 1 });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports?${queryString}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        throw new Error(
          data.displayMessage || data.message || `Failed to load reports (HTTP ${res.status})`
        );
      }
      const rows = Array.isArray(data.items) ? [...data.items] : [];
      rows.sort((a, b) => new Date(b.sentAt || b.createdAt || 0) - new Date(a.sentAt || a.createdAt || 0));
      setItems(rows);
      setSummary({ ...emptySummary(), ...(data.summary || {}) });
      setChannelSummaries({
        marketing: { ...emptySummary(), ...(data.channelSummaries?.marketing || {}) },
        transactional: { ...emptySummary(), ...(data.channelSummaries?.transactional || {}) },
        system: { ...emptySummary(), ...(data.channelSummaries?.system || {}) },
      });
      setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
    } catch (err) {
      setError(err.message || 'Failed to load email reports');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  // First visit: import recent Zoho Campaigns so older marketing mail appears
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch(`${BASE}/api/email/reports/sync`, { method: 'POST' });
        if (isUnauthorized(res) || cancelled) return;
        await readJson(res);
        if (!cancelled) load();
      } catch {
        /* silent — user can still Refresh manually */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports/${id}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to load detail');
      setSelected(data.item);
    } catch (err) {
      toast.error(err.message || 'Failed to open report');
    }
  };

  const syncOne = async (id) => {
    setSyncingId(id);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports/${id}/sync`, { method: 'POST' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        throw new Error(data.message || data.displayMessage || 'Sync failed');
      }
      setSelected(data.item);
      toast.success('Delivery details updated');
      load();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports/sync`, { method: 'POST' });
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) throw new Error(data.message || 'Refresh failed');
      const camp = data.campaigns || {};
      toast.success(
        `Refreshed · ${data.stale?.ok || 0} sends synced` +
          (camp.synced != null ? ` · ${camp.synced} campaigns` : '')
      );
      if (camp.error) toast.error(`Campaigns: ${camp.error}`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Refresh failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const switchTab = (id) => {
    setActiveTab(id);
    setFilters((f) => ({ ...f, page: 1, metric: 'all' }));
  };

  const onKpiClick = (kpi) => {
    if (kpiDidDrag()) return;
    const next = kpi.metric || 'all';
    setFilters((f) => ({
      ...f,
      page: 1,
      metric: f.metric === next ? 'all' : next,
    }));
  };

  return (
    <>
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Inbox}
          title="Email Reports"
          subtitle="Delivery, opens, clicks, bounces, and replies for marketing campaigns and transactional mail."
        >
          <button
            type="button"
            data-tour="email-reports-refresh"
            onClick={syncAll}
            disabled={syncingAll}
            className="btn-secondary"
          >
            <RefreshCw size={16} className={syncingAll ? 'animate-spin' : ''} />
            Refresh delivery
          </button>
        </PageHeader>

        <div data-tour="email-reports-tabs" className="card-ats-bordered relative overflow-hidden p-2 sm:p-2.5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {CHANNEL_TABS.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.id === 'marketing' ? Megaphone : tab.id === 'transactional' ? Zap : Mail;
              const count =
                tab.id === 'marketing'
                  ? channelSummaries.marketing?.sends || 0
                  : tab.id === 'transactional'
                    ? channelSummaries.transactional?.sends || 0
                    : summary.sends || 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`flex min-w-0 flex-1 items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                    active
                      ? 'border-brand-300 bg-gradient-to-br from-brand-50 to-teal-50/80 shadow-sm ring-1 ring-brand-200/60'
                      : 'border-transparent bg-stone-50/70 hover:border-stone-200 hover:bg-white'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      active
                        ? 'bg-gradient-to-br from-brand-500 to-teal-600 text-white shadow-md shadow-brand-500/20'
                        : 'bg-white text-stone-500 ring-1 ring-stone-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold ${active ? 'text-stone-900' : 'text-stone-700'}`}>
                        {tab.label}
                      </p>
                      <span className="tabular-nums text-xs font-semibold text-stone-500">{count}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      {tab.provider}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">{tab.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="card-ats-bordered flex flex-col gap-4 border-red-200 bg-red-50/40 p-6 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertCircle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-stone-900">Unable to load email reports</p>
              <p className="mt-0.5 text-sm text-red-600">{error}</p>
            </div>
            <button type="button" onClick={load} className="btn-primary">
              Retry
            </button>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <GitBranch size={16} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-stone-900">
                {activeMeta.label} engagement
              </h2>
              <p className="text-xs text-stone-500">
                Select a metric to filter the send history. Each campaign can include many recipients.
              </p>
            </div>
          </div>
          {filters.metric && filters.metric !== 'all' ? (
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, metric: 'all', page: 1 }))}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200/80"
            >
              Filtered: {METRIC_LABELS[filters.metric] || filters.metric}
              <XCircle className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div data-tour="email-reports-kpis" className="min-w-0 w-full">
          <div
            ref={kpiScrollRef}
            {...kpiDragHandlers}
            className="email-reports-drag-strip -mx-1 flex cursor-grab gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide select-none active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {kpiFunnel.map((kpi) => {
              const isActiveFilter =
                filters.metric !== 'all' && filters.metric === kpi.metric;
              return (
                <div key={kpi.key} className="w-[158px] shrink-0 sm:w-[168px]">
                  <FunnelMetricCard
                    icon={kpi.icon}
                    label={kpi.label}
                    value={kpi.value}
                    caption={kpi.caption}
                    loading={loading}
                    gradient={kpi.gradient}
                    active={isActiveFilter}
                    onClick={() => onKpiClick(kpi)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
              <Filter className="h-4 w-4 text-brand-600" />
              Filters
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Search
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  className="input-ats input-ats-icon w-full"
                  placeholder="Subject, recipient, campaign key…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
                    }
                    if (e.key === 'Escape') {
                      setSearchInput('');
                      setFilters((f) => ({ ...f, search: '', page: 1 }));
                    }
                  }}
                />
                {searchInput ? (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchInput('');
                      setFilters((f) => ({ ...f, search: '', page: 1 }));
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </label>
            <label className="flex w-full flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 lg:w-56">
              Status
              <select
                className="select-ats w-full"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filtersActive ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.metric && filters.metric !== 'all' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200/80">
                  Metric: {METRIC_LABELS[filters.metric] || filters.metric}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-brand-100"
                    aria-label="Clear metric filter"
                    onClick={() => setFilters((f) => ({ ...f, metric: 'all', page: 1 }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
              {filters.status !== 'all' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200">
                  Status: {STATUS_FILTERS.find((s) => s.value === filters.status)?.label || filters.status}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-stone-200"
                    aria-label="Clear status filter"
                    onClick={() => setFilters((f) => ({ ...f, status: 'all', page: 1 }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
              {filters.search.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200">
                  Search: {filters.search.trim()}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-stone-200"
                    aria-label="Clear search filter"
                    onClick={() => {
                      setSearchInput('');
                      setFilters((f) => ({ ...f, search: '', page: 1 }));
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <EmailReportsTable
          items={items}
          loading={loading}
          error={error}
          activeTab={activeTab}
          activeMeta={activeMeta}
          metricFilter={filters.metric}
          pagination={pagination}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onOpenDetail={openDetail}
        />
      </div>

      <TourHelpFab
        onClick={() => setTourOpen(true)}
        label="Take a tour"
        title="Take a tour of Email Reports"
      />
      <ProductTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={EMAIL_REPORTS_TOUR_STEPS}
        storageKey={EMAIL_REPORTS_TOUR_KEY}
      />

      <DetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onSync={syncOne}
        syncing={Boolean(syncingId)}
      />
    </>
  );
};

export default EmailReportsPage;
