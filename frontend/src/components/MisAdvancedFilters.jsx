import React, { useMemo } from 'react';
import { Filter, RotateCcw, X, Search, RefreshCw } from 'lucide-react';
import PremiumSelect from './ui/PremiumSelect';
import PremiumDatePicker from './ui/PremiumDatePicker';
import { useAuth } from '../context/AuthContext';
import { searchPicklistOptions, PICKLIST_MIN_SEARCH } from '../utils/orgListFetch';

const PERIOD_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

const FILTER_CHIPS = [
  { key: 'consent', label: 'Consent' },
  { key: 'unsubscribed', label: 'Status' },
  { key: 'position', label: 'Position' },
  { key: 'skills', label: 'Skill' },
  { key: 'product', label: 'Product' },
  { key: 'companyName', label: 'Company' },
  { key: 'client', label: 'Client' },
  { key: 'location', label: 'Location' },
  { key: 'source', label: 'Source' },
  { key: 'expMin', label: 'Exp ≥' },
  { key: 'expMax', label: 'Exp ≤' },
  { key: 'ctcMin', label: 'CTC ≥' },
  { key: 'ctcMax', label: 'CTC ≤' },
  { key: 'expectedCtcMin', label: 'Exp. CTC ≥' },
  { key: 'expectedCtcMax', label: 'Exp. CTC ≤' },
  { key: 'datePeriod', label: 'Period' },
];

function normalizeHex(color) {
  const raw = String(color || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return '';
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="cand-filters-label">{label}</label>
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      type="text"
      autoComplete="off"
      {...props}
      className="input-ats cand-filters-control w-full min-w-0"
    />
  );
}

function RangePair({ minValue, maxValue, onMin, onMax, options }) {
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="flex-1 min-w-0">
        <PremiumSelect
          variant="list"
          compact
          value={minValue}
          onChange={onMin}
          options={options}
          placeholder="Min"
          allowClear
        />
      </div>
      <div className="cand-filters-range-sep" aria-hidden="true">to</div>
      <div className="flex-1 min-w-0">
        <PremiumSelect
          variant="list"
          compact
          value={maxValue}
          onChange={onMax}
          options={options}
          placeholder="Max"
          allowClear
        />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="min-w-0">
      <div className="cand-filters-section-head">
        <h4 className="cand-filters-section-title">{title}</h4>
        <div className="cand-filters-section-rule" />
      </div>
      {children}
    </div>
  );
}

function chipDisplayValue(filters, key) {
  if (key === 'consent') {
    if (filters.consent === 'yes') return 'Consented';
    if (filters.consent === 'no') return 'No consent';
    return '';
  }
  if (key === 'unsubscribed') {
    if (filters.unsubscribed === '0') return 'Active';
    if (filters.unsubscribed === '1') return 'Unsubscribed';
    return '';
  }
  if (key === 'datePeriod') {
    const p = filters.datePeriod || '';
    if (!p) return '';
    if (p === 'custom') {
      const from = filters.dateFrom || '…';
      const to = filters.dateTo || '…';
      return `${from} → ${to}`;
    }
    const opt = PERIOD_OPTIONS.find((o) => o.value === p);
    return opt?.label || p;
  }
  return String(filters[key] || '').trim();
}

/**
 * Candidates-style advanced filter panel for MIS.
 */
export default function MisAdvancedFilters({
  show,
  filters,
  onPatch,
  onClearAll,
  onClearOne,
  onApply,
  filtersDirty = false,
  isSearching = false,
  activeFilterCount = 0,
  positionFilterOptions = [],
  expOptions = [],
  ctcFilterOptions = [],
}) {
  const { organization } = useAuth() || {};
  const themeAccent = useMemo(() => {
    const fromOrg =
      normalizeHex(organization?.atsSettings?.brandColor) ||
      normalizeHex(organization?.brandColor) ||
      normalizeHex(organization?.whiteLabel?.brandColor);
    return fromOrg || '';
  }, [organization]);

  const themeStyle = useMemo(() => {
    if (!themeAccent) return undefined;
    return {
      '--cand-filter-accent': themeAccent,
      '--cand-filter-accent-soft': `color-mix(in srgb, ${themeAccent} 14%, white)`,
      '--cand-filter-accent-border': `color-mix(in srgb, ${themeAccent} 28%, white)`,
      '--cand-filter-accent-text': `color-mix(in srgb, ${themeAccent} 72%, #0f172a)`,
      '--cand-filter-header': `linear-gradient(135deg, ${themeAccent} 0%, color-mix(in srgb, ${themeAccent} 72%, #0f172a) 100%)`,
    };
  }, [themeAccent]);

  const activeChips = useMemo(
    () => FILTER_CHIPS.filter(({ key }) => Boolean(chipDisplayValue(filters, key))),
    [filters],
  );

  if (!show) return null;

  const datePeriod = filters.datePeriod || '';

  return (
    <div
      className="cand-filters-panel animate-fade-in"
      data-tour="mis-adv-filters"
      style={themeStyle}
    >
      <div className="cand-filters-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="cand-filters-header-icon">
            <Filter size={13} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold tracking-tight text-white">Filters</span>
              {activeFilterCount > 0 ? (
                <span className="cand-filters-badge">{activeFilterCount} applied</span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeFilterCount === 0 && !filtersDirty}
          className="cand-filters-clear"
        >
          <RotateCcw size={11} aria-hidden="true" />
          Clear all
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div className="cand-filters-chips">
          <span className="cand-filters-chips-label">Active</span>
          {activeChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onClearOne?.(key)}
              className="cand-filters-chip"
              title={`Remove ${label}`}
            >
              <span className="cand-filters-chip-key">{label}</span>
              <span className="cand-filters-chip-val">{chipDisplayValue(filters, key)}</span>
              <X size={11} className="opacity-70 flex-shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="cand-filters-body">
        <Section title="Date range">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-2.5">
            <Field label="Period">
              <PremiumSelect
                variant="list"
                compact
                value={datePeriod}
                onChange={(v) => {
                  const next = v || '';
                  onPatch?.('datePeriod', next);
                  if (next !== 'custom') {
                    onPatch?.('dateFrom', '');
                    onPatch?.('dateTo', '');
                  }
                }}
                options={PERIOD_OPTIONS}
                placeholder="Any time"
                allowClear
              />
            </Field>
            {datePeriod === 'custom' ? (
              <>
                <Field label="From">
                  <PremiumDatePicker
                    value={filters.dateFrom || ''}
                    onChange={(v) => onPatch?.('dateFrom', v || '')}
                    placeholder="Start date"
                    allowClear
                  />
                </Field>
                <Field label="To">
                  <PremiumDatePicker
                    value={filters.dateTo || ''}
                    onChange={(v) => onPatch?.('dateTo', v || '')}
                    placeholder="End date"
                    allowClear
                  />
                </Field>
              </>
            ) : null}
          </div>
          {datePeriod === 'custom' && (!filters.dateFrom || !filters.dateTo) ? (
            <p className="mt-2 text-[11px] text-amber-700">Select both From and To, then click Search.</p>
          ) : null}
        </Section>

        <Section title="Consent & status">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-2.5">
            <Field label="Consent">
              <PremiumSelect
                variant="list"
                compact
                value={filters.consent || 'all'}
                onChange={(v) => onPatch?.('consent', v || 'all')}
                options={[
                  { value: 'all', label: 'All consent' },
                  { value: 'yes', label: 'Consented' },
                  { value: 'no', label: 'No consent' },
                ]}
              />
            </Field>
            <Field label="Status">
              <PremiumSelect
                variant="list"
                compact
                value={filters.unsubscribed || 'all'}
                onChange={(v) => onPatch?.('unsubscribed', v || 'all')}
                options={[
                  { value: 'all', label: 'All status' },
                  { value: '0', label: 'Active' },
                  { value: '1', label: 'Unsubscribed' },
                ]}
              />
            </Field>
          </div>
        </Section>

        <Section title="Role & organisation">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-3 gap-y-2.5">
            <Field label="Position">
              <PremiumSelect
                variant="list"
                compact
                value={filters.position || ''}
                onChange={(v) => onPatch?.('position', v || '')}
                options={positionFilterOptions}
                placeholder="All positions"
                searchable
                searchPlaceholder="Search positions…"
                allowClear
                minSearchChars={PICKLIST_MIN_SEARCH}
                onSearch={async (q) => searchPicklistOptions('/api/positions', q)}
              />
            </Field>
            <Field label="Skill">
              <TextInput
                value={filters.skills || ''}
                onChange={(e) => onPatch?.('skills', e.target.value)}
                placeholder="Banking, Sales…"
              />
            </Field>
            <Field label="Product / Skill">
              <TextInput
                value={filters.product || ''}
                onChange={(e) => onPatch?.('product', e.target.value)}
                placeholder="Home Loan…"
              />
            </Field>
            <Field label="Company">
              <TextInput
                value={filters.companyName || ''}
                onChange={(e) => onPatch?.('companyName', e.target.value)}
                placeholder="Company"
              />
            </Field>
            <Field label="Client">
              <TextInput
                value={filters.client || ''}
                onChange={(e) => onPatch?.('client', e.target.value)}
                placeholder="Client"
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={filters.location || ''}
                onChange={(e) => onPatch?.('location', e.target.value)}
                placeholder="City / branch"
              />
            </Field>
            <Field label="Source">
              <TextInput
                value={filters.source || ''}
                onChange={(e) => onPatch?.('source', e.target.value)}
                placeholder="Naukri, Referral…"
              />
            </Field>
          </div>
        </Section>

        <Section title="Experience & CTC">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2.5">
            <Field label="Experience (years)">
              <RangePair
                minValue={filters.expMin || ''}
                maxValue={filters.expMax || ''}
                onMin={(v) => onPatch?.('expMin', v || '')}
                onMax={(v) => onPatch?.('expMax', v || '')}
                options={expOptions}
              />
            </Field>
            <Field label="Current CTC">
              <RangePair
                minValue={filters.ctcMin || ''}
                maxValue={filters.ctcMax || ''}
                onMin={(v) => onPatch?.('ctcMin', v || '')}
                onMax={(v) => onPatch?.('ctcMax', v || '')}
                options={ctcFilterOptions}
              />
            </Field>
            <Field label="Expected CTC">
              <RangePair
                minValue={filters.expectedCtcMin || ''}
                maxValue={filters.expectedCtcMax || ''}
                onMin={(v) => onPatch?.('expectedCtcMin', v || '')}
                onMax={(v) => onPatch?.('expectedCtcMax', v || '')}
                options={ctcFilterOptions}
              />
            </Field>
          </div>
        </Section>
      </div>

      <div className="cand-filters-footer justify-end">
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:ml-auto">
          {filtersDirty ? (
            <span className="hidden sm:inline text-[11px] font-medium text-amber-700">Unsaved changes</span>
          ) : null}
          <button
            type="button"
            disabled={isSearching}
            onClick={onApply}
            className="btn-primary min-w-[8.5rem] justify-center"
          >
            {isSearching ? (
              <>
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                Searching…
              </>
            ) : (
              <>
                <Search size={14} aria-hidden="true" />
                Search
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
