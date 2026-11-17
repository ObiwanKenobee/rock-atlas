import React from 'react';
import { KMRIAnalysis, KMRIWeights } from '../../engines/types';
import { DEFAULT_KMRI_WEIGHTS } from '../../engines/kmriEngine';
import { RotateCcw } from 'lucide-react';

interface KMRIWorkspaceProps {
  kmri: KMRIAnalysis;
  weights: KMRIWeights;
  onChangeWeights: (w: KMRIWeights) => void;
}

export const KMRIWorkspace: React.FC<KMRIWorkspaceProps> = ({
  kmri,
  weights,
  onChangeWeights,
}) => {
  const totalW =
    weights.performance +
    weights.resilience +
    weights.stability +
    weights.liquidity +
    (kmri.participationAvailable ? weights.participation : 0);

  const dims: Array<{ key: keyof KMRIWeights; label: string; formula: string; disabled?: boolean }> = [
    { key: 'performance', label: 'Performance', formula: 'Annualized geometric return' },
    { key: 'resilience', label: 'Resilience', formula: '65% Inv. Max DD + 35% Recovery Speed' },
    { key: 'stability', label: 'Stability', formula: 'Inverse annualized realized volatility' },
    { key: 'liquidity', label: 'Liquidity', formula: 'Log10(20D avg turnover) - zero-vol penalty' },
    {
      key: 'participation',
      label: 'Market Participation',
      formula: 'Foreign investor turnover share',
      disabled: !kmri.participationAvailable,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Experimental Research Header & Methodology Controls */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Experimental Research Framework · Pending Out-of-Sample Verified NSE Validation
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
              Kenyan Market Resilience Index (KMRI)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-3xl">
              Investigates which NSE securities exhibit the strongest combination of return, drawdown containment, realized stability, liquidity depth, and foreign participation—especially during isolated market stress regimes.
            </p>
          </div>
          <button
            onClick={() => onChangeWeights(DEFAULT_KMRI_WEIGHTS)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Baseline Weights</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 border-t border-slate-200 dark:border-slate-800 pt-4">
          {dims.map((d) => {
            const pct =
              d.disabled || totalW <= 0 ? 0 : (weights[d.key] / totalW) * 100;
            return (
              <div key={d.key} className={d.disabled ? 'opacity-50' : ''}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{d.label}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {d.disabled ? 'N/A' : `${pct.toFixed(0)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  disabled={d.disabled}
                  value={Math.round(weights[d.key] * 100)}
                  onChange={(e) =>
                    onChangeWeights({
                      ...weights,
                      [d.key]: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <div className="text-[11px] text-slate-500 mt-1">{d.formula}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stress Window Isolation Finding */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Adverse Stress Regime Cohort Test
            </h3>
            <div className="text-xs font-mono text-slate-500 mt-1">
              Isolated Window: {kmri.stressWindow.startDate} to {kmri.stressWindow.endDate} (Composite{' '}
              {(kmri.stressWindow.marketDropPct * 100).toFixed(1)}%)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-200 dark:border-slate-800 py-4 text-xs">
            <div>
              <div className="text-slate-500">Top-Half KMRI Stress Return</div>
              <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {(kmri.stressCohortComparison.topHalfAvgStressReturn * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Avg Max DD: {(kmri.stressCohortComparison.topHalfAvgStressDrawdown * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-slate-500">Bottom-Half KMRI Stress Return</div>
              <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
                {(kmri.stressCohortComparison.bottomHalfAvgStressReturn * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Avg Max DD: {(kmri.stressCohortComparison.bottomHalfAvgStressDrawdown * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {kmri.stressCohortComparison.findingSummary}
          </p>
        </div>

        {/* Weight Sensitivity Audit */}
        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Weighting Sensitivity & Rank Stability (Spearman Correlation)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Tests whether KMRI security rankings remain robust across competing methodology weightings.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Alternative Scheme</th>
                  <th className="py-2 px-2 font-medium">Weights (P/R/S/L/F)</th>
                  <th className="py-2 px-2 text-right font-medium">Spearman ρ</th>
                  <th className="py-2 px-2 text-right font-medium">Max Rank Shift</th>
                  <th className="py-2 pl-2 font-medium">Top 3 Ranked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {kmri.sensitivityAnalysis.map((s) => (
                  <tr key={s.schemeName}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                      {s.schemeName}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-300">
                      {s.weightsLabel}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                      {s.spearmanRhoVsBaseline.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      ±{s.maxRankShift}
                    </td>
                    <td className="py-2.5 pl-2 font-mono text-slate-800 dark:text-slate-200">
                      {s.topThreeTickers.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* KMRI Complete Rankings Table */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Kenyan Market Resilience Index — Security Composite Rankings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-2 font-medium">Rank</th>
                <th className="py-2 px-2 font-medium">Security</th>
                <th className="py-2 px-2 text-right font-medium">KMRI Score</th>
                <th className="py-2 px-2 text-right font-medium">Perf</th>
                <th className="py-2 px-2 text-right font-medium">Resil</th>
                <th className="py-2 px-2 text-right font-medium">Stab</th>
                <th className="py-2 px-2 text-right font-medium">Liq</th>
                <th className="py-2 px-2 text-right font-medium">Foreign</th>
                <th className="py-2 pl-2 text-right font-medium">Stress Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {kmri.scores.map((row) => (
                <tr key={row.ticker} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-2 font-mono font-semibold text-slate-500">
                    #{row.rank}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {row.ticker}
                    </span>
                    <span className="text-slate-500 ml-2">{row.sector}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                    {row.kmriScore.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {row.dimensions.performance.toFixed(0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {row.dimensions.resilience.toFixed(0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {row.dimensions.stability.toFixed(0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {row.dimensions.liquidity.toFixed(0)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {row.dimensions.participation !== null
                      ? row.dimensions.participation.toFixed(0)
                      : 'N/A'}
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right font-mono tabular-nums ${
                      row.stressPeriodReturn >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {row.stressPeriodReturn >= 0 ? '+' : ''}
                    {(row.stressPeriodReturn * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
