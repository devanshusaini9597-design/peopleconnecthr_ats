import React, { useMemo } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import { formatRoleLabel } from '../organization/constants';

/** Soften ALL-CAPS names for UI without changing stored values. */
function displayPersonName(name, email) {
  const raw = String(name || '').trim();
  if (!raw) {
    const local = String(email || '').split('@')[0] || 'Teammate';
    return local;
  }
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters && letters === letters.toUpperCase()) {
    return raw
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }
  return raw;
}

export default function EmployeeScopeSelect({
  value = 'all',
  employees = [],
  onChange,
  loading = false,
  statsLoading = false,
  className = '',
}) {
  const options = useMemo(() => ([
    {
      value: 'all',
      label: 'All employees',
      description: 'Company-wide recruitment metrics',
      icon: Building2,
      avatarKind: 'org',
    },
    ...employees.map((e) => {
      const label = displayPersonName(e.name, e.email);
      const role = formatRoleLabel(e.role) || 'Team member';
      return {
        value: String(e.id),
        label,
        description: `${role} · SPOC desk`,
        meta: e.email || '',
        searchText: `${e.name || ''} ${label} ${e.email || ''} ${e.role || ''} ${role}`,
        photo: e.profilePicture || '',
        avatarName: label,
        avatarEmail: e.email || '',
      };
    }),
  ]), [employees]);

  const isOrg = !value || value === 'all';

  return (
    <div className={`min-w-0 ${className}`} data-tour="analytics-employee">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 mb-1.5">
        Reporting scope
        {statsLoading && <Loader2 size={11} className="animate-spin text-stone-400" />}
      </label>
      <PremiumSelect
        value={value || 'all'}
        onChange={(v) => onChange(v || 'all')}
        options={options}
        searchable
        searchPlaceholder="Search by name, role, or email…"
        placeholder={loading ? 'Loading team…' : 'All employees'}
        disabled={loading}
        menuMinWidth={320}
        emptyLabel="No teammates match your search"
      />
      <p className="text-[11px] text-stone-400 mt-1.5 leading-snug">
        {statsLoading
          ? 'Updating metrics…'
          : isOrg
            ? `${employees.length} team member${employees.length === 1 ? '' : 's'} available`
            : 'Showing metrics for this employee’s desk'}
      </p>
    </div>
  );
}
