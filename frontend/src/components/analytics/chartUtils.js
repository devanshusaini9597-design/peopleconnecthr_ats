/** Shared analytics chart helpers — readable labels, top-N grouping, enterprise styling */

export const CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid #e7e5e4',
  fontSize: 12,
  boxShadow: '0 4px 14px rgba(28,25,23,0.08)',
  padding: '8px 12px',
};

export const CHART_GRID_STROKE = '#e7e5e4';

export function truncateLabel(text, max = 18) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Top N rows + optional "Other" bucket for pie / bar charts */
export function topNWithOther(items, { limit = 6, labelKey = 'label', valueKey = 'value' } = {}) {
  const rows = (items || [])
    .map((item) => ({
      ...item,
      [labelKey]: item[labelKey] ?? item.source ?? item.stage ?? item.name ?? 'Unknown',
      [valueKey]: Number(item[valueKey] ?? item.count ?? item.value ?? 0),
    }))
    .filter((item) => item[valueKey] > 0)
    .sort((a, b) => b[valueKey] - a[valueKey]);

  if (rows.length <= limit) return rows;

  const top = rows.slice(0, limit);
  const otherSum = rows.slice(limit).reduce((s, r) => s + r[valueKey], 0);
  if (otherSum > 0) {
    top.push({ [labelKey]: 'Other', [valueKey]: otherSum, _isOther: true });
  }
  return top;
}

export function formatSourceChartData(sources, limit = 8) {
  return topNWithOther(
    (sources || []).map((s) => ({
      label: truncateLabel(s.source || s.label || s._id, 22),
      fullLabel: s.source || s.label || s._id || 'Unknown',
      value: s.count ?? s.value ?? 0,
    })),
    { limit, labelKey: 'label', valueKey: 'value' }
  );
}

export function formatPipelineChartData(stages, limit = 10) {
  return (stages || [])
    .filter((s) => (s.count ?? s.value ?? 0) > 0)
    .map((s) => ({
      label: s.stage || s.label,
      value: s.count ?? s.value ?? 0,
    }));
}
