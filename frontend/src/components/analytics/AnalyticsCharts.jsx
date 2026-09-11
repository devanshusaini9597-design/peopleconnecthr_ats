import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { PIPELINE_COLORS, PIE_COLORS } from './constants';
import { CHART_TOOLTIP_STYLE, CHART_GRID_STROKE, topNWithOther } from './chartUtils';

function normalizeRows(data) {
  return (data || []).map((item) => ({
    label: item.label ?? item.stage ?? item.source ?? item.name ?? 'Unknown',
    fullLabel: item.fullLabel ?? item.label ?? item.stage ?? item.source ?? item.name ?? 'Unknown',
    value: Number(item.value ?? item.count ?? 0),
  })).filter((item) => item.value > 0);
}

function useChartRows(data, limit = 8) {
  return useMemo(
    () => topNWithOther(normalizeRows(data), { limit, labelKey: 'label', valueKey: 'value' }),
    [data, limit]
  );
}

function barColor(label, index) {
  return PIPELINE_COLORS[label] || PIE_COLORS[index % PIE_COLORS.length];
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-stone-900 max-w-[220px]">{row?.fullLabel || row?.label}</p>
      <p className="text-stone-600 mt-0.5 tabular-nums">{payload[0]?.value?.toLocaleString?.() ?? payload[0]?.value} candidates</p>
    </div>
  );
}

/** Enterprise category chart — auto horizontal layout for long labels (sources, clients, etc.) */
export function CategoryBarChart({
  data,
  limit = 8,
  horizontal = 'auto',
  height,
  name = 'Candidates',
}) {
  const rows = useChartRows(data, limit);
  const isHorizontal = horizontal === true
    || (horizontal === 'auto' && rows.some((r) => String(r.fullLabel || r.label).length > 11));

  if (!rows.length) return null;

  if (isHorizontal) {
    const chartHeight = height || Math.min(420, Math.max(240, rows.length * 38 + 48));
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 8, right: 20, left: 4, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#78716c' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={148}
            tick={{ fontSize: 10, fill: '#57534e', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              const s = String(v || '');
              return s.length > 22 ? `${s.slice(0, 20)}…` : s;
            }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={24} name={name} maxBarSize={28}>
            {rows.map((entry, i) => (
              <Cell key={`${entry.label}-${i}`} fill={barColor(entry.fullLabel || entry.label, i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const chartHeight = height || 260;
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={42}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} name={name} maxBarSize={48}>
          {rows.map((entry, i) => (
            <Cell key={`${entry.label}-${i}`} fill={barColor(entry.fullLabel || entry.label, i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranked legend list — cleaner than crowded pie for many categories */
export function CategoryRankList({ data, limit = 8, total }) {
  const rows = useChartRows(data, limit);
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);

  if (!rows.length) return null;

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => {
        const pct = sum > 0 ? Math.round((row.value / sum) * 100) : 0;
        const color = barColor(row.fullLabel || row.label, i);
        return (
          <div key={`${row.label}-${i}`} className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium text-stone-700 truncate" title={row.fullLabel || row.label}>
                  {row.fullLabel || row.label}
                </span>
              </div>
              <span className="text-xs font-bold text-stone-900 tabular-nums flex-shrink-0">
                {row.value.toLocaleString()} <span className="text-stone-400 font-semibold">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
