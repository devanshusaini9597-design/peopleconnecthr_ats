import React from 'react';
import { Check, ExternalLink, Download } from 'lucide-react';
import { planHasFeature } from '../../config/planFeatures';
import {
  COMPARE_ROWS, PLAN_LIMITS, formatLimit, formatMoney,
} from './billingConstants';

export function PlanComparisonTable({ catalog, currentPlan }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-teal-400 to-brand-600" />
      <div className="px-5 py-4 border-b border-stone-100">
        <h3 className="text-base font-bold text-stone-900">Plan comparison</h3>
        <p className="text-sm text-stone-500 mt-0.5">Limits and key entitlements side by side.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-stone-50/90 text-stone-500 text-xs uppercase tracking-wide">
              <th className="text-left font-semibold px-5 py-3">Capability</th>
              {['starter', 'professional', 'enterprise'].map((id) => (
                <th key={id} className={`text-center font-semibold px-4 py-3 capitalize ${id === currentPlan ? 'text-brand-700' : ''}`}>
                  {id}
                  {id === currentPlan && <span className="block text-[10px] font-bold normal-case text-brand-600">Current</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="hover:bg-stone-50/50">
                <td className="px-5 py-3 text-stone-700 font-medium">{row.label}</td>
                {['starter', 'professional', 'enterprise'].map((id) => {
                  const plan = catalog.find((p) => p.id === id);
                  const lim = plan?.limits || PLAN_LIMITS[id];
                  let cell;
                  if (row.kind === 'limit') {
                    cell = formatLimit(lim?.[row.field]);
                  } else {
                    cell = planHasFeature(id, row.key) ? (
                      <Check className="w-4 h-4 text-emerald-600 mx-auto" strokeWidth={3} />
                    ) : (
                      <span className="text-stone-300">—</span>
                    );
                  }
                  return (
                    <td key={id} className={`px-4 py-3 text-center tabular-nums text-stone-600 ${id === currentPlan ? 'bg-brand-50/40' : ''}`}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InvoicesSection({ invoices, status, onPortal }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">Invoices</h3>
          <p className="text-sm text-stone-500 mt-0.5">Recent Stripe invoices for this organization.</p>
        </div>
        {status?.subscription?.customerId && (
          <button type="button" onClick={onPortal} className="btn-secondary !py-2 !px-3 text-sm">
            <ExternalLink className="w-3.5 h-3.5" /> Open portal
          </button>
        )}
      </div>
      {invoices.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-stone-500">
          No invoices yet. They appear here after your first paid subscription.
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {invoices.map((inv) => (
            <li key={inv.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-stone-50/60">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">
                  {inv.number || inv.id}
                  <span className={`ml-2 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                    inv.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : inv.status === 'open'
                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                  >
                    {inv.status}
                  </span>
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {inv.created ? new Date(inv.created).toLocaleDateString() : '—'}
                  {' · '}
                  {formatMoney(inv.amountPaid ?? inv.amountDue, inv.currency)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inv.invoicePdf && (
                  <a
                    href={inv.invoicePdf}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:text-brand-600 hover:border-brand-300"
                    title="Download PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
