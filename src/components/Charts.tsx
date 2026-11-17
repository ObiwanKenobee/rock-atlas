import React, { useState } from 'react';

export interface LineSeriesSpec {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  values: Array<number | null>;
}

interface MultiLineChartProps {
  dates: string[];
  series: LineSeriesSpec[];
  height?: number;
  valueFormatter?: (v: number) => string;
  yAxisLabel?: string;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  dates,
  series,
  height = 280,
  valueFormatter = (v) => v.toFixed(2),
  yAxisLabel,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (dates.length === 0 || series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500">
        No time-series observations available for charting.
      </div>
    );
  }

  const width = 820;
  const padLeft = 64;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (v !== null && Number.isFinite(v)) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    minVal = 0;
    maxVal = 100;
  }
  if (maxVal === minVal) {
    minVal -= 1;
    maxVal += 1;
  }
  const margin = (maxVal - minVal) * 0.08;
  minVal -= margin;
  maxVal += margin;

  const xAt = (idx: number) =>
    dates.length <= 1 ? padLeft : padLeft + (idx / (dates.length - 1)) * plotW;
  const yAt = (val: number) =>
    padTop + ((maxVal - val) / (maxVal - minVal)) * plotH;

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks }, (_, i) =>
    minVal + ((maxVal - minVal) * i) / (yTicks - 1)
  );

  const xTickIndices = [
    0,
    Math.floor((dates.length - 1) * 0.25),
    Math.floor((dates.length - 1) * 0.5),
    Math.floor((dates.length - 1) * 0.75),
    dates.length - 1,
  ];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    if (relX < padLeft || relX > width - padRight) {
      setHoverIdx(null);
      return;
    }
    const frac = (relX - padLeft) / plotW;
    const idx = Math.max(0, Math.min(dates.length - 1, Math.round(frac * (dates.length - 1))));
    setHoverIdx(idx);
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="inline-block h-0.5 w-4"
                style={{
                  backgroundColor: s.color,
                  borderTop: s.dashed ? `2px dashed ${s.color}` : undefined,
                }}
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        {yAxisLabel && (
          <span className="text-xs font-mono text-slate-500">{yAxisLabel}</span>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal gridlines */}
          {tickValues.map((tv, i) => {
            const y = yAt(tv);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {valueFormatter(tv)}
                </text>
              </g>
            );
          })}

          {/* X-axis dates */}
          {xTickIndices.map((idx, i) => (
            <text
              key={`${idx}-${i}`}
              x={xAt(idx)}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === xTickIndices.length - 1 ? 'end' : 'middle'}
              className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
            >
              {dates[idx]}
            </text>
          ))}

          {/* Series paths */}
          {series.map((s) => {
            let d = '';
            let started = false;
            for (let i = 0; i < dates.length; i++) {
              const v = s.values[i];
              if (v === null || !Number.isFinite(v)) {
                started = false;
                continue;
              }
              const x = xAt(i).toFixed(1);
              const y = yAt(v).toFixed(1);
              d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
              started = true;
            }
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
              />
            );
          })}

          {/* Interactive crosshair */}
          {hoverIdx !== null && (
            <g>
              <line
                x1={xAt(hoverIdx)}
                x2={xAt(hoverIdx)}
                y1={padTop}
                y2={height - padBottom}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {series.map((s) => {
                const v = s.values[hoverIdx];
                if (v === null || !Number.isFinite(v)) return null;
                return (
                  <circle
                    key={s.id}
                    cx={xAt(hoverIdx)}
                    cy={yAt(v)}
                    r={3.5}
                    fill={s.color}
                    className="stroke-white dark:stroke-slate-900"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoverIdx !== null && (
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-slate-200 dark:border-slate-800 pt-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {dates[hoverIdx]}
            </span>
            {series.map((s) => {
              const v = s.values[hoverIdx];
              return (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.label}:</span>
                  <span className="font-medium">
                    {v !== null && Number.isFinite(v) ? valueFormatter(v) : 'N/A'}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface DrawdownAreaChartProps {
  series: Array<{ date: string; drawdown: number }>;
  height?: number;
}

export const DrawdownAreaChart: React.FC<DrawdownAreaChartProps> = ({ series, height = 180 }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (series.length === 0) return null;

  const width = 820;
  const padLeft = 64;
  const padRight = 18;
  const padTop = 14;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minDd = Math.min(-0.05, ...series.map((s) => s.drawdown));
  const xAt = (idx: number) =>
    series.length <= 1 ? padLeft : padLeft + (idx / (series.length - 1)) * plotW;
  const yAt = (val: number) => padTop + (val / minDd) * plotH;

  const linePath = series
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(pt.drawdown).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${padTop} L ${padLeft} ${padTop} Z`;

  const ticks = [0, minDd * 0.5, minDd];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          if (relX < padLeft || relX > width - padRight) {
            setHoverIdx(null);
            return;
          }
          const idx = Math.max(
            0,
            Math.min(series.length - 1, Math.round(((relX - padLeft) / plotW) * (series.length - 1)))
          );
          setHoverIdx(idx);
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {ticks.map((tv, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yAt(tv)}
              y2={yAt(tv)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={padLeft - 8}
              y={yAt(tv) + 4}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
            >
              {(tv * 100).toFixed(1)}%
            </text>
          </g>
        ))}

        <path d={areaPath} fill="rgba(220, 38, 38, 0.14)" />
        <path d={linePath} fill="none" stroke="#DC2626" strokeWidth={1.6} />

        {hoverIdx !== null && (
          <g>
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={padTop}
              y2={height - padBottom}
              className="stroke-slate-400"
              strokeDasharray="3 3"
            />
            <circle cx={xAt(hoverIdx)} cy={yAt(series[hoverIdx].drawdown)} r={3.5} fill="#DC2626" />
          </g>
        )}
      </svg>
      {hoverIdx !== null && (
        <div className="mt-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {series[hoverIdx].date} · Drawdown from peak:{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">
            {(series[hoverIdx].drawdown * 100).toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface VolumeBarChartProps {
  dates: string[];
  volumes: number[];
  height?: number;
}

export const VolumeBarChart: React.FC<VolumeBarChartProps> = ({ dates, volumes, height = 140 }) => {
  if (dates.length === 0) return null;
  const width = 820;
  const padLeft = 64;
  const padRight = 18;
  const padTop = 10;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVol = Math.max(1, ...volumes);
  // Downsample bars visually if > 160 points for crisp rendering
  const step = Math.max(1, Math.ceil(volumes.length / 160));
  const sampled: Array<{ date: string; vol: number }> = [];
  for (let i = 0; i < volumes.length; i += step) {
    const slice = volumes.slice(i, i + step);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    sampled.push({ date: dates[i], vol: avg });
  }

  const barW = Math.max(1.5, plotW / sampled.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={height - padBottom}
        y2={height - padBottom}
        className="stroke-slate-200 dark:stroke-slate-800"
      />
      <text
        x={padLeft - 8}
        y={padTop + 8}
        textAnchor="end"
        className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
      >
        {(maxVol / 1e6).toFixed(1)}M
      </text>
      <text
        x={padLeft - 8}
        y={height - padBottom}
        textAnchor="end"
        className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
      >
        0
      </text>
      {sampled.map((item, idx) => {
        const h = (item.vol / maxVol) * plotH;
        const x = padLeft + (idx / sampled.length) * plotW;
        const y = height - padBottom - h;
        return (
          <rect
            key={item.date}
            x={x}
            y={y}
            width={barW}
            height={Math.max(1, h)}
            className="fill-teal-700/75 dark:fill-teal-500/75"
          />
        );
      })}
    </svg>
  );
};
