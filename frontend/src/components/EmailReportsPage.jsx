import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquareReply,
  Filter,
  Loader2,
  ChevronRight,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import KpiCard from './analytics/KpiCard';
import { useToast } from './Toast';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import API_URL from '../config';

const BASE = API_URL;

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
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function readJson(res) {
  const text = await res.text();
  const trimmed = (text || '').trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
    const err = new Error(
      res.status === 404
        ? 'Email reports API is not available on the server yet. Wait for Railway deploy, then refresh.'
        : `Server returned an HTML error page (HTTP ${res.status}). Try again in a moment.`
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

function DetailPanel({ item, onClose, onSync, syncing }) {
  if (!item) return null;
  const recipients = item.recipients || [];
  const totals = item.totals || {};
  const rates = item.rates || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-[1px] animate-page-enter">
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="modal-panel-ats flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white shadow-2xl">
        <div className="relative border-b border-stone-100 px-5 py-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {item.channel} · {(item.provider || '').replace(/_/g, ' ')}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-stone-900">
                {item.subject || item.campaignName || 'Untitled send'}
              </h2>
              <p className="mt-1 text-sm text-stone-500">{fmtDate(item.sentAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onSync(item._id)}
                disabled={syncing}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Sent', totals.sent],
              ['Delivered', totals.delivered],
              ['Opened', totals.opened],
              ['Clicked', totals.clicked],
              ['Bounced', totals.bounced],
              ['Replied', totals.replied],
              ['Failed', totals.failed],
              ['Unsub', totals.unsubscribed],
              ['Spam', totals.spam],
            ].map(([label, val]) => (
              <div key={label} className="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
                <p className="text-lg font-bold tabular-nums text-stone-900">{val ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={item.status}>{item.status}</Badge>
            {rates.openRate != null && <Badge tone="opened">Open {rates.openRate}%</Badge>}
            {rates.clickRate != null && <Badge tone="clicked">Click {rates.clickRate}%</Badge>}
            {rates.bounceRate != null && <Badge tone="bounced">Bounce {rates.bounceRate}%</Badge>}
            {rates.deliveryRate != null && <Badge tone="delivered">Delivery {rates.deliveryRate}%</Badge>}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Sync source</dt>
              <dd className="mt-0.5 font-medium text-stone-800">{item.syncSource || '—'}</dd>
            </div>
            {item.lastError ? (
              <div className="sm:col-span-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-rose-800">
                <p className="text-xs font-semibold uppercase">Last sync note</p>
                <p className="mt-1 text-sm">{item.lastError}</p>
              </div>
            ) : null}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-bold tracking-tight text-stone-900">
              Recipients ({recipients.length})
            </h3>
            <div className="overflow-hidden rounded-2xl border border-stone-200/80">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Opens</th>
                    <th className="px-3 py-2.5">Clicks</th>
                    <th className="px-3 py-2.5">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                        No per-recipient rows yet. Click Sync to pull Zoho / Zepto details.
                      </td>
                    </tr>
                  )}
                  {recipients.map((r) => (
                    <tr key={r.email} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="break-all font-medium text-stone-800">{r.email}</div>
                        {r.name ? <div className="text-xs text-stone-500">{r.name}</div> : null}
                        {r.bounceReason ? (
                          <div className="mt-1 text-xs text-rose-600">{r.bounceReason}</div>
                        ) : null}
                        {r.clickUrls?.length ? (
                          <div className="mt-1 space-y-0.5">
                            {r.clickUrls.slice(0, 3).map((u) => (
                              <div key={u} className="truncate text-[11px] text-indigo-600">
                                {u}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={r.status}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.openCount || 0}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.clickCount || 0}</td>
                      <td className="px-3 py-2.5 text-xs text-stone-600">
                        <div>Sent: {fmtDate(r.sentAt)}</div>
                        {r.deliveredAt && <div>Delivered: {fmtDate(r.deliveredAt)}</div>}
                        {r.openedAt && <div>Opened: {fmtDate(r.openedAt)}</div>}
                        {r.clickedAt && <div>Clicked: {fmtDate(r.clickedAt)}</div>}
                        {r.bouncedAt && <div>Bounced: {fmtDate(r.bouncedAt)}</div>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    channel: 'all',
    provider: 'all',
    status: 'all',
    search: '',
    page: 1,
  });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.channel !== 'all') p.set('channel', filters.channel);
    if (filters.provider !== 'all') p.set('provider', filters.provider);
    if (filters.status !== 'all') p.set('status', filters.status);
    if (filters.search.trim()) p.set('search', filters.search.trim());
    p.set('page', String(filters.page || 1));
    p.set('limit', '25');
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports?${queryString}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        throw new Error(data.displayMessage || data.message || `Failed to load reports (HTTP ${res.status})`);
      }
      setItems(data.items || []);
      setSummary(data.summary || {});
      setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
    } catch (err) {
      setError(err.message || 'Failed to load email reports');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports/${id}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to load detail');
      }
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
      toast.success('Report synced from provider');
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
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Refresh failed');
      }
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

  if (loading && !items.length && !error) {
    return (
      <div className="page-shell-ats animate-page-enter">
        <PageHeader
          icon={Inbox}
          title="Email Reports"
          subtitle="Delivery and engagement for ZeptoMail transactional mail and Zoho Campaigns marketing."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="skeleton-ats h-[118px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton-ats mt-2 h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-shell-ats animate-page-enter">
      <PageHeader
        icon={Inbox}
        title="Email Reports"
        subtitle="Enterprise delivery & engagement — sent, delivered, opened, clicked, bounced, replied — matching your ATS analytics style."
      >
        <button type="button" onClick={syncAll} disabled={syncingAll} className="btn-secondary">
          <RefreshCw size={16} className={syncingAll ? 'animate-spin' : ''} />
          Refresh from Zoho
        </button>
      </PageHeader>

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

      <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard icon={Send} label="Sends" value={summary.sends || 0} gradient="from-brand-500 to-teal-400" />
        <KpiCard icon={Mail} label="Recipients" value={summary.recipients || 0} gradient="from-sky-500 to-brand-400" />
        <KpiCard icon={CheckCircle2} label="Delivered" value={summary.delivered || 0} gradient="from-emerald-500 to-teal-400" />
        <KpiCard
          icon={Eye}
          label="Opened"
          value={summary.opened || 0}
          caption={`${summary.openRate ?? 0}% open rate`}
          gradient="from-teal-500 to-cyan-400"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Clicked"
          value={summary.clicked || 0}
          caption={`${summary.clickRate ?? 0}% click rate`}
          gradient="from-indigo-500 to-violet-400"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Bounced"
          value={summary.bounced || 0}
          caption={`${summary.bounceRate ?? 0}% bounce rate`}
          gradient="from-amber-500 to-orange-400"
        />
        <KpiCard
          icon={MessageSquareReply}
          label="Replied"
          value={summary.replied || 0}
          gradient="from-violet-500 to-fuchsia-400"
        />
        <KpiCard icon={XCircle} label="Failed" value={summary.failed || 0} gradient="from-rose-500 to-red-400" />
      </div>

      <div className="card-ats-bordered relative overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-800">
          <Filter className="h-4 w-4 text-brand-600" />
          Filters
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-stone-500">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                className="input-ats w-full pl-9"
                placeholder="Subject, recipient, campaign key…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
            Channel
            <select
              className="input-ats"
              value={filters.channel}
              onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value, page: 1 }))}
            >
              <option value="all">All</option>
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
            Provider
            <select
              className="input-ats"
              value={filters.provider}
              onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value, page: 1 }))}
            >
              <option value="all">All</option>
              <option value="zeptomail">ZeptoMail</option>
              <option value="zoho_campaigns">Zoho Campaigns</option>
              <option value="smtp">SMTP</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
            Status
            <select
              className="input-ats"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              <option value="all">All</option>
              <option value="accepted">Accepted</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card-ats-bordered relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100 text-sm">
            <thead className="bg-stone-50/90 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Subject / Campaign</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Click</th>
                <th className="px-4 py-3">Bounce</th>
                <th className="px-4 py-3">Reply</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-600" />
                    Loading email reports…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && !error && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-500">
                    No tracked sends yet. Send a candidate email or marketing campaign, then click{' '}
                    <strong className="text-stone-700">Refresh from Zoho</strong>.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row) => (
                  <tr key={row._id} className="transition-colors hover:bg-stone-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{fmtDate(row.sentAt)}</td>
                    <td className="max-w-xs px-4 py-3">
                      <div className="truncate font-semibold text-stone-900">
                        {row.subject || row.campaignName || '—'}
                      </div>
                      <div className="truncate text-xs text-stone-500">
                        {row.fromEmail || '—'}
                        {row.sentByUserId?.name ? ` · ${row.sentByUserId.name}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium capitalize text-stone-800">{row.channel}</div>
                      <div className="text-xs capitalize text-stone-500">
                        {(row.provider || '').replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{row.totals?.sent ?? 0}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.totals?.opened ?? 0}
                      <span className="text-xs text-stone-400"> · {row.rates?.openRate ?? 0}%</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.totals?.clicked ?? 0}
                      <span className="text-xs text-stone-400"> · {row.rates?.clickRate ?? 0}%</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.totals?.bounced ?? 0}</td>
                    <td className="px-4 py-3 tabular-nums">{row.totals?.replied ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row._id)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
                      >
                        Details <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm">
            <span className="text-stone-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} sends
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card-ats-bordered border-dashed bg-stone-50/50 p-4 text-xs leading-relaxed text-stone-600">
        <p className="font-semibold text-stone-800">Tracking checklist</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Zoho Campaigns (marketing):</strong> Settings → Campaign Policy → Campaign Tracking — your
            screenshot already shows <em>Complete Tracking</em> for Opens and Link Clicks. Nothing else to enable there.
          </li>
          <li>
            <strong>ZeptoMail (transactional / OTP / alerts):</strong> ZeptoMail → your Agent →{' '}
            <em>Email Tracking</em> → turn on Open tracking and Click tracking.
          </li>
          <li>
            New sends are logged automatically. Use <strong>Refresh from Zoho</strong> to import recent campaigns and
            update opens/clicks/bounces.
          </li>
        </ul>
      </div>

      <DetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onSync={syncOne}
        syncing={Boolean(syncingId)}
      />
    </div>
  );
};

export default EmailReportsPage;
