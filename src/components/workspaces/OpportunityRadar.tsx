import React, { useState } from 'react';
import { OpportunityScore, OpportunityWeights } from '../../engines/types';
import { DEFAULT_OPPORTUNITY_WEIGHTS } from '../../engines/opportunityEngine';
import { RotateCcw, ArrowUpRight } from 'lucide-react';

interface OpportunityRadarProps {
  opportunities: OpportunityScore[];
  weights: OpportunityWeights;
  onChangeWeights: (w: OpportunityWeights) => void;
  onSelectSecurity: (ticker: string) => void;
}

export const OpportunityRadar: React.FC<OpportunityRadarProps> = ({
  opportunities,
  weights,
  onChangeWeights,
  onSelectSecurity,
}) => {
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTicker, setSelectedTicker] = useState<string>(
    opportunities[0]?.ticker ?? ''
  );

  const sectors = ['ALL', ...Array.from(new Set(opportunities.map((o) => o.sector)))];

  const filtered = opportunities.filter((o) => {
    const matchSector = sectorFilter === 'ALL' || o.sector === sectorFilter;
    const matchQuery =
      searchQuery.trim() === '' ||
      o.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSector && matchQuery;
  });

  const activeItem =
    opportunities.find((o) => o.ticker === selectedTicker) ?? filtered[0] ?? opportunities[0];

  const weightEntries: Array<{ key: keyof OpportunityWeights; label: string }> = [
    { key: 'momentum', label: 'Market Momentum' },
    { key: 'fundamentals', label: 'Financial Fundamentals' },
    { key: 'valuation', label: 'Relative Valuation' },
    { key: 'risk', label: 'Risk Profile (Low Vol/DD)' },
    { key: 'liquidity', label: 'Market Liquidity' },
  ];

  const totalRaw =
    weights.momentum +
    weights.fundamentals +
    weights.valuation +
    weights.risk +
    weights.liquidity;

  return (
    <div className="space-y-6">
      {/* Configurable Factor Weight Calibration Bar */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              African Investment Opportunity Radar — Factor Weight Calibration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Weights are normalized dynamically to 100% and represent configurable research hypotheses—not automated BUY/SELL instructions.
            </p>
          </div>
          <button
            onClick={() => onChangeWeights(DEFAULT_OPPORTUNITY_WEIGHTS)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Proposal (20/25/20/20/15)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {weightEntries.map((entry) => {
            const pct = totalRaw > 0 ? (weights[entry.key] / totalRaw) * 100 : 20;
            return (
              <div key={entry.key}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {entry.label}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={Math.round(weights[entry.key] * 100)}
                  onChange={(e) =>
                    onChangeWeights({
                      ...weights,
                      [entry.key]: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Split: Ranked Table (Left) + Explainable Thesis Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Sectors' : s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter ticker or company..."
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 w-48"
              />
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Showing {filtered.length} of {opportunities.length} securities
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2 font-medium">Rank</th>
                  <th className="py-2 px-2 font-medium">Security</th>
                  <th className="py-2 px-2 text-right font-medium">Composite</th>
                  <th className="py-2 px-2 text-right font-medium">Mom</th>
                  <th className="py-2 px-2 text-right font-medium">Fund</th>
                  <th className="py-2 px-2 text-right font-medium">Val</th>
                  <th className="py-2 px-2 text-right font-medium">Risk</th>
                  <th className="py-2 px-2 text-right font-medium">Liq</th>
                  <th className="py-2 pl-2 text-right font-medium">Uncertainty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {filtered.map((item) => {
                  const isSelected = activeItem?.ticker === item.ticker;
                  return (
                    <tr
                      key={item.ticker}
                      onClick={() => setSelectedTicker(item.ticker)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/70 dark:bg-teal-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 pr-2 font-mono tabular-nums font-semibold text-slate-500">
                        #{item.rank}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.ticker}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {item.sector}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {item.compositeScore.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.dimensionScores.momentum.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.dimensionScores.fundamentals.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.dimensionScores.valuation.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.dimensionScores.risk.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.dimensionScores.liquidity.toFixed(0)}
                      </td>
                      <td
                        className={`py-2.5 pl-2 text-right font-medium ${
                          item.uncertaintyLevel === 'High'
                            ? 'text-red-600 dark:text-red-400'
                            : item.uncertaintyLevel === 'Moderate'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {item.uncertaintyLevel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Explainability Drawer */}
        {activeItem && (
          <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Rank #{activeItem.rank} · {activeItem.sector} · Uncertainty: {activeItem.uncertaintyLevel}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {activeItem.ticker} — {activeItem.name}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                  {activeItem.compositeScore.toFixed(1)}
                </div>
                <div className="text-[11px] text-slate-500">out of 100</div>
              </div>
            </div>

            {/* Weighted Contribution Breakdown */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
                What Contributed to the Score (Weighted Points)
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Market Momentum', val: activeItem.dimensionContributions.momentum, sub: activeItem.dimensionScores.momentum },
                  { label: 'Fundamentals', val: activeItem.dimensionContributions.fundamentals, sub: activeItem.dimensionScores.fundamentals },
                  { label: 'Relative Valuation', val: activeItem.dimensionContributions.valuation, sub: activeItem.dimensionScores.valuation },
                  { label: 'Risk Profile', val: activeItem.dimensionContributions.risk, sub: activeItem.dimensionScores.risk },
                  { label: 'Liquidity', val: activeItem.dimensionContributions.liquidity, sub: activeItem.dimensionScores.liquidity },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        +{row.val.toFixed(1)} pts (subscore {row.sub.toFixed(0)}/100)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 bg-teal-700 dark:bg-teal-500"
                        style={{ width: `${Math.min(100, row.sub)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence, Weaknesses, Risks, Invalidation, Missing Data */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3.5 text-xs">
              <div>
                <div className="font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
                  Supporting Evidence
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {activeItem.supportingEvidence.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Weakening Factors & Missing Data
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {activeItem.weakeningFactors.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                  <li>
                    Missing fields:{' '}
                    <span className="font-mono">
                      {activeItem.missingDataPoints.length > 0
                        ? activeItem.missingDataPoints.join(', ')
                        : 'None'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-red-700 dark:text-red-400 mb-1">
                  Present Risks & Thesis Invalidation Criteria
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {activeItem.keyRisks.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                  {activeItem.invalidationCriteria.map((line, i) => (
                    <li key={`inv-${i}`}>Invalidation: {line}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => onSelectSecurity(activeItem.ticker)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Inspect {activeItem.ticker} in Security Explorer</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
