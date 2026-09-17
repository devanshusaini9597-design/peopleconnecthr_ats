import React, { useMemo } from 'react';
import { Filter, RotateCcw, X, Sparkles, Search, RefreshCw } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import { useAuth } from '../../context/AuthContext';
import { searchPicklistOptions, PICKLIST_MIN_SEARCH } from '../../utils/orgListFetch';

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
  { key: 'position', label: 'Position' },
  { key: 'skills', label: 'Skill' },
  { key: 'product', label: 'Product' },
  { key: 'spoc', label: 'SPOC' },
  { key: 'companyName', label: 'Company' },
  { key: 'client', label: 'Client' },
  { key: 'location', label: 'Location' },
  { key: 'expMin', label: 'Exp ≥' },
  { key: 'expMax', label: 'Exp ≤' },
  { key: 'ctcMin', label: 'CTC ≥' },
  { key: 'ctcMax', label: 'CTC ≤' },
  { key: 'expectedCtcMin', label: 'Exp. CTC ≥' },
  { key: 'expectedCtcMax', label: 'Exp. CTC ≤' },
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

export default function CandidatesAdvancedFilters(props) {
  const {
    showAdvancedSearch, activeAdvFilterCount, clearAdvancedFilters, advancedSearchFilters,
    setAdvancedSearchFilters, positionFilterOptions, expOptions, ctcFilterOptions,
    activityPeriod = '', setActivityPeriod,
    activityFrom = '', setActivityFrom,
    activityTo = '', setActivityTo,
    applyAdvancedFilters,
    filtersDirty = false,
    isSearching = false,
    onApplyError,
  } = props;

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

  const patchFilter = (key, value) => {
    setAdvancedSearchFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearOne = (key) => {
    setAdvancedSearchFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const activeChips = useMemo(
    () => FILTER_CHIPS.filter(({ key }) => Boolean(String(advancedSearchFilters?.[key] || '').trim())),
    [advancedSearchFilters],
  );

  if (!showAdvancedSearch) return null;

  return (
    <div
      className="cand-filters-panel animate-fade-in"
      data-tour="cand-adv-filters"
      style={themeStyle}
    >
      <div className="cand-filters-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="cand-filters-header-icon">
            <Filter size={13} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold tracking-tight text-white">Filter criteria</span>
              {activeAdvFilterCount > 0 ? (
                <span className="cand-filters-badge">
                  {activeAdvFilterCount} applied
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-white/75 font-medium">
                  <Sparkles size={11} aria-hidden="true" /> Theme-aware filters
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={clearAdvancedFilters}
          disabled={activeAdvFilterCount === 0}
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
              onClick={() => clearOne(key)}
              className="cand-filters-chip"
              title={`Remove ${label}`}
            >
              <span className="cand-filters-chip-key">{label}</span>
              <span className="cand-filters-chip-val">{String(advancedSearchFilters[key])}</span>
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
                value={activityPeriod || ''}
                onChange={(v) => {
                  const next = v || '';
                  setActivityPeriod?.(next);
                  if (next !== 'custom') {
                    setActivityFrom?.('');
                    setActivityTo?.('');
                  }
                }}
                options={PERIOD_OPTIONS}
                placeholder="Any time"
                allowClear
              />
            </Field>
            {activityPeriod === 'custom' ? (
              <>
                <Field label="From">
                  <PremiumDatePicker
                    value={activityFrom || ''}
                    onChange={(v) => setActivityFrom?.(v || '')}
                    placeholder="Start date"
                    allowClear
                  />
                </Field>
                <Field label="To">
                  <PremiumDatePicker
                    value={activityTo || ''}
                    onChange={(v) => setActivityTo?.(v || '')}
                    placeholder="End date"
                    allowClear
                  />
                </Field>
              </>
            ) : null}
          </div>
          {activityPeriod === 'custom' && (!activityFrom || !activityTo) ? (
            <p className="mt-2 text-[11px] text-amber-700">Select both From and To, then click Search.</p>
          ) : null}
        </Section>

        <Section title="Role & organisation">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-3 gap-y-2.5">
            <Field label="Position">
              <PremiumSelect
                variant="list"
                compact
                value={advancedSearchFilters.position}
                onChange={(v) => patchFilter('position', v)}
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
                value={advancedSearchFilters.skills || ''}
                onChange={(e) => patchFilter('skills', e.target.value)}
                placeholder="Banking, Sales…"
              />
            </Field>
            <Field label="Product / Skill">
              <TextInput
                value={advancedSearchFilters.product || ''}
                onChange={(e) => patchFilter('product', e.target.value)}
                placeholder="Home Loan…"
              />
            </Field>
            <Field label="SPOC">
              <TextInput
                value={advancedSearchFilters.spoc || ''}
                onChange={(e) => patchFilter('spoc', e.target.value)}
                placeholder="Owner name"
              />
            </Field>
            <Field label="Company">
              <TextInput
                value={advancedSearchFilters.companyName || ''}
                onChange={(e) => patchFilter('companyName', e.target.value)}
                placeholder="Company"
              />
            </Field>
            <Field label="Client">
              <TextInput
                value={advancedSearchFilters.client || ''}
                onChange={(e) => patchFilter('client', e.target.value)}
                placeholder="Client"
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={advancedSearchFilters.location || ''}
                onChange={(e) => patchFilter('location', e.target.value)}
                placeholder="City / state"
              />
            </Field>
          </div>
        </Section>

        <Section title="Experience & compensation">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2.5">
            <Field label="Experience (years)">
              <RangePair
                minValue={advancedSearchFilters.expMin}
                maxValue={advancedSearchFilters.expMax}
                onMin={(v) => patchFilter('expMin', v)}
                onMax={(v) => patchFilter('expMax', v)}
                options={expOptions}
              />
            </Field>
            <Field label="Current CTC">
              <RangePair
                minValue={advancedSearchFilters.ctcMin}
                maxValue={advancedSearchFilters.ctcMax}
                onMin={(v) => patchFilter('ctcMin', v)}
                onMax={(v) => patchFilter('ctcMax', v)}
                options={ctcFilterOptions}
              />
            </Field>
            <Field label="Expected CTC">
              <RangePair
                minValue={advancedSearchFilters.expectedCtcMin}
                maxValue={advancedSearchFilters.expectedCtcMax}
                onMin={(v) => patchFilter('expectedCtcMin', v)}
                onMax={(v) => patchFilter('expectedCtcMax', v)}
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
            onClick={() => {
              const result = applyAdvancedFilters?.();
              if (result && result.ok === false) {
                onApplyError?.(result.message || 'Could not apply filters');
              }
            }}
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
