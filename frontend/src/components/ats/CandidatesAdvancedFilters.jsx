import React, { useMemo } from 'react';
import { Filter, RotateCcw, X, Search, RefreshCw, Fingerprint, CalendarRange, Building2, IndianRupee } from 'lucide-react';
import PremiumSelect from '../ui/PremiumSelect';
import PremiumDatePicker from '../ui/PremiumDatePicker';
import { useAuth } from '../../context/AuthContext';
import { searchPicklistOptions, PICKLIST_MIN_SEARCH } from '../../utils/orgListFetch';
import { INDIA_CITY_OPTIONS } from '../../data/indiaCities';

const PERIOD_OPTIONS = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

const LOCATION_RADIUS_OPTIONS = [
  { value: '0', label: 'This city only' },
  { value: '25', label: 'Within 25 km' },
  { value: '50', label: 'Within 50 km' },
  { value: '100', label: 'Within 100 km' },
];

const FILTER_CHIPS = [
  { key: 'candidateCode', label: 'Candidate ID' },
  { key: 'applicationCode', label: 'Application ID' },
  { key: 'position', label: 'Position' },
  { key: 'skills', label: 'Skills' },
  { key: 'product', label: 'Product' },
  { key: 'spoc', label: 'Hiring manager' },
  { key: 'companyName', label: 'Employer' },
  { key: 'client', label: 'Client' },
  { key: 'location', label: 'Location' },
  { key: 'expMin', label: 'Exp ≥' },
  { key: 'expMax', label: 'Exp ≤' },
  { key: 'ctcMin', label: 'CTC ≥' },
  { key: 'ctcMax', label: 'CTC ≤' },
  { key: 'expectedCtcMin', label: 'Exp. CTC ≥' },
  { key: 'expectedCtcMax', label: 'Exp. CTC ≤' },
  { key: 'locationRadiusKm', label: 'Radius' },
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

function Section({ title, icon: Icon, children }) {
  return (
    <div className="min-w-0">
      <div className="cand-filters-section-head">
        {Icon ? (
          <span className="cand-filters-section-icon" aria-hidden="true">
            <Icon size={12} strokeWidth={2.4} />
          </span>
        ) : null}
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
    setAdvancedSearchFilters, positionFilterOptions, productFilterOptions, clientFilterOptions,
    expOptions, ctcFilterOptions,
    activityPeriod = '', setActivityPeriod,
    activityFrom = '', setActivityFrom,
    activityTo = '', setActivityTo,
    applyAdvancedFilters,
    filtersDirty = false,
    isSearching = false,
    onApplyError,
    variant = 'candidates',
  } = props;

  const isGlobal = variant === 'globalSearch';

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
    setAdvancedSearchFilters((prev) => ({
      ...prev,
      [key]: Array.isArray(prev?.[key]) ? [] : '',
    }));
  };

  const chipValue = (key) => {
    const raw = advancedSearchFilters?.[key];
    if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
    if (key === 'ctcMin' && isGlobal && raw) {
      const n = String(raw);
      return n === '100' ? '1 Cr and above' : /^\d+(\.\d+)?$/.test(n) ? `${n} LPA and above` : n;
    }
    if (key === 'ctcMax' && isGlobal && raw) {
      const n = String(raw);
      return n === '100' ? 'Up to 1 Cr' : /^\d+(\.\d+)?$/.test(n) ? `Up to ${n} LPA` : n;
    }
    if (key === 'locationRadiusKm') {
      const opt = LOCATION_RADIUS_OPTIONS.find((o) => o.value === String(raw || '50'));
      return opt?.label || raw;
    }
    return String(raw || '');
  };

  const activeChips = useMemo(
    () => FILTER_CHIPS.filter(({ key }) => {
      if (isGlobal && (key === 'expectedCtcMin' || key === 'expectedCtcMax')) return false;
      if (key === 'locationRadiusKm') return Boolean(String(advancedSearchFilters?.location || '').trim());
      const raw = advancedSearchFilters?.[key];
      if (Array.isArray(raw)) return raw.some((v) => String(v || '').trim());
      return Boolean(String(raw || '').trim());
    }),
    [advancedSearchFilters, isGlobal],
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
              <span className="text-[13px] font-semibold tracking-tight text-white">
                {isGlobal ? 'Filters' : 'Filter criteria'}
              </span>
              {activeAdvFilterCount > 0 ? (
                <span className="cand-filters-badge">
                  {activeAdvFilterCount} applied
                </span>
              ) : null}
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
          Reset
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div className="cand-filters-chips">
          <span className="cand-filters-chips-label">Applied</span>
          {activeChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => clearOne(key)}
              className="cand-filters-chip"
              title={`Remove ${label}`}
            >
              <span className="cand-filters-chip-key">{label}</span>
              <span className="cand-filters-chip-val">{chipValue(key)}</span>
              <X size={11} className="opacity-70 flex-shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="cand-filters-body">
        <Section title="Identity" icon={Fingerprint}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Candidate ID">
              <TextInput
                value={advancedSearchFilters.candidateCode || ''}
                onChange={(e) => patchFilter('candidateCode', e.target.value)}
                placeholder="e.g. SKILLNIX-CAND-000001"
              />
            </Field>
            <Field label="Application ID">
              <TextInput
                value={advancedSearchFilters.applicationCode || ''}
                onChange={(e) => patchFilter('applicationCode', e.target.value)}
                placeholder="e.g. SKILLNIX-APP-000001"
              />
            </Field>
          </div>
        </Section>
        <Section title="Date range" icon={CalendarRange}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
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
                placeholder="All dates"
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
            <p className="mt-2 text-[11px] text-amber-700">Select a start date and an end date, then search.</p>
          ) : null}
        </Section>

        <Section title={isGlobal ? 'Role and organisation' : 'Role & organisation'} icon={Building2}>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isGlobal ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-x-4 gap-y-3.5`}>
            <Field label="Position">
              <PremiumSelect
                variant="list"
                compact
                multiple={isGlobal}
                menuMinWidth={isGlobal ? 360 : 0}
                value={isGlobal
                  ? (Array.isArray(advancedSearchFilters.position) ? advancedSearchFilters.position : (advancedSearchFilters.position ? [advancedSearchFilters.position] : []))
                  : advancedSearchFilters.position}
                onChange={(v) => patchFilter('position', v)}
                options={isGlobal ? (positionFilterOptions || []).filter((o) => o.value !== '') : positionFilterOptions}
                placeholder={isGlobal ? 'Select positions' : 'All positions'}
                searchable
                searchPlaceholder="Search positions"
                allowClear
                minSearchChars={PICKLIST_MIN_SEARCH}
                onSearch={async (q) => searchPicklistOptions('/api/positions', q)}
              />
            </Field>
            <Field label="Skills">
              <TextInput
                value={advancedSearchFilters.skills || ''}
                onChange={(e) => patchFilter('skills', e.target.value)}
                placeholder="e.g. Banking, Sales"
              />
            </Field>
            <Field label="Product">
              <PremiumSelect
                variant="list"
                compact
                multiple={isGlobal}
                menuMinWidth={isGlobal ? 380 : 0}
                value={isGlobal
                  ? (Array.isArray(advancedSearchFilters.product) ? advancedSearchFilters.product : (advancedSearchFilters.product ? [advancedSearchFilters.product] : []))
                  : advancedSearchFilters.product}
                onChange={(v) => patchFilter('product', v)}
                options={(productFilterOptions || []).filter((o) => !isGlobal || o.value !== '')}
                placeholder={isGlobal ? 'Select products' : 'All products'}
                searchable
                searchPlaceholder="Search products"
                allowClear
                minSearchChars={PICKLIST_MIN_SEARCH}
                onSearch={async (q) => searchPicklistOptions('/api/org-lists/product', q)}
              />
            </Field>
            <Field label={isGlobal ? 'Hiring manager' : 'SPOC'}>
              <TextInput
                value={advancedSearchFilters.spoc || ''}
                onChange={(e) => patchFilter('spoc', e.target.value)}
                placeholder={isGlobal ? 'Hiring manager name' : 'Owner name'}
              />
            </Field>
            <Field label={isGlobal ? 'Current employer' : 'Company'}>
              <TextInput
                value={advancedSearchFilters.companyName || ''}
                onChange={(e) => patchFilter('companyName', e.target.value)}
                placeholder="Company name"
              />
            </Field>
            <Field label="Client">
              <PremiumSelect
                variant="list"
                compact
                multiple={isGlobal}
                menuMinWidth={isGlobal ? 360 : 0}
                value={isGlobal
                  ? (Array.isArray(advancedSearchFilters.client) ? advancedSearchFilters.client : (advancedSearchFilters.client ? [advancedSearchFilters.client] : []))
                  : advancedSearchFilters.client}
                onChange={(v) => patchFilter('client', v)}
                options={(clientFilterOptions || []).filter((o) => !isGlobal || o.value !== '')}
                placeholder={isGlobal ? 'Select clients' : 'All clients'}
                searchable
                searchPlaceholder="Search clients"
                allowClear
                minSearchChars={PICKLIST_MIN_SEARCH}
                onSearch={async (q) => searchPicklistOptions('/api/clients', q)}
              />
            </Field>
            <Field label="Location">
              {isGlobal ? (
                <PremiumSelect
                  variant="list"
                  compact
                  menuMinWidth={320}
                  value={advancedSearchFilters.location || ''}
                  onChange={(v) => patchFilter('location', v || '')}
                  options={INDIA_CITY_OPTIONS}
                  placeholder="Select a city"
                  searchable
                  creatable
                  allowClear
                  searchPlaceholder="Search or enter a city"
                  createLabel={(q) => `Use “${q}”`}
                />
              ) : (
                <TextInput
                  value={advancedSearchFilters.location || ''}
                  onChange={(e) => patchFilter('location', e.target.value)}
                  placeholder="City / state"
                />
              )}
            </Field>
            {isGlobal ? (
              <Field label="Search radius">
                <PremiumSelect
                  variant="list"
                  compact
                  value={String(advancedSearchFilters.locationRadiusKm || '50')}
                  onChange={(v) => patchFilter('locationRadiusKm', v || '50')}
                  options={LOCATION_RADIUS_OPTIONS}
                  placeholder="Within 50 km"
                />
              </Field>
            ) : null}
          </div>
        </Section>

        <Section title="Experience and compensation" icon={IndianRupee}>
          <div className={`grid grid-cols-1 ${isGlobal ? 'sm:grid-cols-3' : 'sm:grid-cols-3'} gap-x-4 gap-y-3.5`}>
            <Field label="Experience (years)">
              <RangePair
                minValue={advancedSearchFilters.expMin}
                maxValue={advancedSearchFilters.expMax}
                onMin={(v) => patchFilter('expMin', v)}
                onMax={(v) => patchFilter('expMax', v)}
                options={expOptions}
              />
            </Field>
            {isGlobal ? (
              <>
                <Field label="Current CTC (minimum)">
                  <PremiumSelect
                    variant="list"
                    compact
                    menuMinWidth={280}
                    value={advancedSearchFilters.ctcMin || ''}
                    onChange={(v) => {
                      const raw = String(v || '').trim();
                      const n = parseFloat(raw);
                      patchFilter('ctcMin', Number.isFinite(n) ? String(n) : (raw || ''));
                    }}
                    options={props.ctcMinFilterOptions || ctcFilterOptions}
                    placeholder="Any amount"
                    allowClear
                    searchable
                    creatable
                    searchPlaceholder="Enter LPA, e.g. 15"
                    createLabel={(q) => `${q} LPA and above`}
                  />
                </Field>
                <Field label="Current CTC (maximum)">
                  <PremiumSelect
                    variant="list"
                    compact
                    menuMinWidth={280}
                    value={advancedSearchFilters.ctcMax || ''}
                    onChange={(v) => {
                      const raw = String(v || '').trim();
                      const n = parseFloat(raw);
                      patchFilter('ctcMax', Number.isFinite(n) ? String(n) : (raw || ''));
                    }}
                    options={ctcFilterOptions}
                    placeholder="Any amount"
                    allowClear
                    searchable
                    creatable
                    searchPlaceholder="Enter LPA, e.g. 7.5"
                    createLabel={(q) => `Up to ${q} LPA`}
                  />
                </Field>
              </>
            ) : (
              <Field label="Current CTC">
                <RangePair
                  minValue={advancedSearchFilters.ctcMin}
                  maxValue={advancedSearchFilters.ctcMax}
                  onMin={(v) => patchFilter('ctcMin', v)}
                  onMax={(v) => patchFilter('ctcMax', v)}
                  options={ctcFilterOptions}
                />
              </Field>
            )}
            {isGlobal ? null : (
              <Field label="Expected CTC">
                <RangePair
                  minValue={advancedSearchFilters.expectedCtcMin}
                  maxValue={advancedSearchFilters.expectedCtcMax}
                  onMin={(v) => patchFilter('expectedCtcMin', v)}
                  onMax={(v) => patchFilter('expectedCtcMax', v)}
                  options={ctcFilterOptions}
                />
              </Field>
            )}
          </div>
        </Section>
      </div>

      <div className="cand-filters-footer justify-end">
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:ml-auto">
          {filtersDirty ? (
            <span className="hidden sm:inline text-[11px] font-medium text-amber-700">Filters not applied yet</span>
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
