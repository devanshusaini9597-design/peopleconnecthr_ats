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
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import { useToast } from './Toast';
import { authenticatedFetch, isUnauthorized, handleUnauthorized } from '../utils/fetchUtils';
import API_URL from '../config';

const BASE = API_URL;

const STATUS_STYLES = {
  accepted: 'bg-sky-50 text-sky-800 ring-sky-200',
  sending: 'bg-amber-50 text-amber-800 ring-amber-200',
  sent: 'bg-stone-100 text-stone-700 ring-stone-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  opened: 'bg-teal-50 text-teal-800 ring-teal-200',
  clicked: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200',
  failed: 'bg-rose-50 text-rose-800 ring-rose-200',
  bounced: 'bg-rose-50 text-rose-800 ring-rose-200',
  soft_bounced: 'bg-orange-50 text-orange-800 ring-orange-200',
  hard_bounced: 'bg-rose-50 text-rose-900 ring-rose-300',
  unsubscribed: 'bg-stone-100 text-stone-600 ring-stone-200',
  spam: 'bg-rose-50 text-rose-700 ring-rose-200',
  unopened: 'bg-stone-50 text-stone-500 ring-stone-200',
  replied: 'bg-violet-50 text-violet-800 ring-violet-200',
  queued: 'bg-stone-50 text-stone-500 ring-stone-200',
};

function Badge({ children, tone = 'sent' }) {
  const cls = STATUS_STYLES[tone] || STATUS_STYLES.sent;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function KpiCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{value ?? 0}</p>
          {sub != null && <p className="mt-1 text-xs font-medium text-stone-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ item, onClose, onSync, syncing }) {
  if (!item) return null;
  const recipients = item.recipients || [];
  const totals = item.totals || {};
  const rates = item.rates || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-[1px]">
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-stone-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {item.channel} · {item.provider?.replace('_', ' ')}
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-stone-900">
              {item.subject || item.campaignName || 'Untitled send'}
            </h2>
            <p className="mt-1 text-sm text-stone-500">{fmtDate(item.sentAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onSync(item._id)}
              disabled={syncing}
              className="btn-ats-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100">
              ✕
            </button>
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
              <div key={label} className="rounded-xl bg-stone-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-stone-500">{label}</p>
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
              <dd className="mt-0.5 font-medium text-stone-800 break-all">{item.fromEmail || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Reply-To</dt>
              <dd className="mt-0.5 font-medium text-stone-800 break-all">{item.replyToEmail || '—'}</dd>
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
                <dd className="mt-0.5 font-mono text-xs text-stone-700 break-all">{item.campaignKey}</dd>
              </div>
            )}
            {item.messageId && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-stone-500">Message ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-stone-700 break-all">{item.messageId}</dd>
              </div>
            )}
            {item.clientReference && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-stone-500">Client reference</dt>
                <dd className="mt-0.5 font-mono text-xs text-stone-700 break-all">{item.clientReference}</dd>
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
            {item.lastError && (
              <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                <p className="text-xs font-semibold uppercase">Last sync note</p>
                <p className="mt-1 text-sm">{item.lastError}</p>
              </div>
            )}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-bold text-stone-900">
              Recipients ({recipients.length})
            </h3>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50 text-left text-xs font-semibold uppercase text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Opens</th>
                    <th className="px-3 py-2">Clicks</th>
                    <th className="px-3 py-2">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                        No per-recipient rows yet. Click Sync to pull Zoho / Zepto details.
                      </td>
                    </tr>
                  )}
                  {recipients.map((r) => (
                    <tr key={r.email} className="align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-stone-800 break-all">{r.email}</div>
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
                      <td className="px-3 py-2">
                        <Badge tone={r.status}>{r.status?.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.openCount || 0}</td>
                      <td className="px-3 py-2 tabular-nums">{r.clickCount || 0}</td>
                      <td className="px-3 py-2 text-xs text-stone-600">
                        <div>Sent: {fmtDate(r.sentAt)}</div>
                        {r.deliveredAt && <div>Delivered: {fmtDate(r.deliveredAt)}</div>}
                        {r.openedAt && <div>Opened: {fmtDate(r.openedAt)}</div>}
                        {r.clickedAt && <div>Clicked: {fmtDate(r.clickedAt)}</div>}
                        {r.bouncedAt && <div>Bounced: {fmtDate(r.bouncedAt)}</div>}
                        {r.repliedAt && <div>Replied: {fmtDate(r.repliedAt)}</div>}
                        {r.unsubscribedAt && <div>Unsub: {fmtDate(r.unsubscribedAt)}</div>}
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
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports?${queryString}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load reports');
      setItems(data.items || []);
      setSummary(data.summary || {});
      setPagination(data.pagination || { page: 1, pages: 1, total: 0, limit: 25 });
    } catch (err) {
      toast.error(err.message || 'Failed to load email reports');
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await authenticatedFetch(`${BASE}/api/email/reports/${id}`);
      if (isUnauthorized(res)) return handleUnauthorized();
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load detail');
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
      const data = await res.json();
      if (!data.success) throw new Error(data.message || data.displayMessage || 'Sync failed');
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
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Refresh failed');
      const camp = data.campaigns || {};
      toast.success(
        `Refreshed. Synced ${data.stale?.ok || 0} sends` +
          (camp.synced != null ? `, imported/synced ${camp.synced} campaigns` : '')
      );
      if (camp.error) toast.error(`Campaigns sync note: ${camp.error}`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Refresh failed');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Inbox}
        title="Email Reports"
        subtitle="Enterprise delivery & engagement for ZeptoMail (transactional) and Zoho Campaigns (marketing) — sent, delivered, opened, clicked, bounced, replied."
      >
        <button
          type="button"
          onClick={syncAll}
          disabled={syncingAll}
          className="btn-ats-primary inline-flex items-center gap-2"
        >
          {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh from Zoho
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Sends" value={summary.sends} icon={Send} accent="bg-sky-50 text-sky-700" />
        <KpiCard label="Recipients" value={summary.recipients} icon={Mail} accent="bg-stone-100 text-stone-700" />
        <KpiCard label="Delivered" value={summary.delivered} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-700" />
        <KpiCard
          label="Opened"
          value={summary.opened}
          sub={`${summary.openRate ?? 0}% rate`}
          icon={Eye}
          accent="bg-teal-50 text-teal-700"
        />
        <KpiCard
          label="Clicked"
          value={summary.clicked}
          sub={`${summary.clickRate ?? 0}% rate`}
          icon={MousePointerClick}
          accent="bg-indigo-50 text-indigo-700"
        />
        <KpiCard
          label="Bounced"
          value={summary.bounced}
          sub={`${summary.bounceRate ?? 0}% rate`}
          icon={AlertTriangle}
          accent="bg-amber-50 text-amber-700"
        />
        <KpiCard label="Replied" value={summary.replied} icon={MessageSquareReply} accent="bg-violet-50 text-violet-700" />
        <KpiCard label="Failed" value={summary.failed} icon={XCircle} accent="bg-rose-50 text-rose-700" />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
          <Filter className="h-4 w-4" /> Filters
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

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
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
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading email reports…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-500">
                    No tracked sends yet. Send a transactional or marketing email, then click{' '}
                    <strong>Refresh from Zoho</strong> to import Campaigns history.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row) => (
                  <tr key={row._id} className="hover:bg-stone-50/80">
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
                        {(row.provider || '').replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">{row.totals?.sent ?? 0}</td>
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
                        className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
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
                className="btn-ats-secondary px-3 py-1.5"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-ats-secondary px-3 py-1.5"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        Tip: Enable open/click tracking on your ZeptoMail agent. Marketing metrics sync from Zoho Campaigns
        reports APIs. Replies are detected when inbound messages land in ATS Inbox from the same recipient.
        Older Campaigns can be imported with <strong>Refresh from Zoho</strong>.
      </p>

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
