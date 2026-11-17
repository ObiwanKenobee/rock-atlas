import React, { useMemo, useState } from 'react';
import {
  CorrelationMatrix,
  ParsedDataset,
  SecurityRiskProfile,
} from '../../engines/types';
import { analyzePortfolioRisk } from '../../engines/riskEngine';
import { MultiLineChart } from '../Charts';

interface RiskLaboratoryProps {
  dataset: ParsedDataset;
  profiles: SecurityRiskProfile[];
  correlation: CorrelationMatrix;
  riskFreeRate: number;
  onChangeRiskFreeRate: (r: number) => void;
}

export const RiskLaboratory: React.FC<RiskLaboratoryProps> = ({
  dataset,
  profiles,
  correlation,
  riskFreeRate,
  onChangeRiskFreeRate,
}) => {
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of profiles) {
      init[p.ticker] = 10;
    }
    return init;
  });

  const portfolio = useMemo(
    () => analyzePortfolioRisk(dataset, profiles, weights, riskFreeRate),
    [dataset, profiles, weights, riskFreeRate]
  );

  const corrColor = (val: number) => {
    if (val >= 0.7) return 'bg-teal-700/20 text-teal-900 dark:text-teal-200';
    if (val >= 0.35) return 'bg-teal-600/10 text-slate-800 dark:text-slate-200';
    if (val <= -0.2) return 'bg-red-600/15 text-red-800 dark:text-red-300';
    return 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Disclosed Risk Assumptions Bar */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Engine 04: Risk Laboratory & Portfolio Stress Testing
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Volatility annualized via sqrt(252) · Simple daily returns · Sharpe evaluated against disclosed Risk-Free Rate assumption
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="text-slate-600 dark:text-slate-400 font-medium">
            Risk-Free Rate (CBK T-Bill Ref):
          </label>
          <select
            value={riskFreeRate}
            onChange={(e) => onChangeRiskFreeRate(Number(e.target.value))}
            className="px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value={0.10}>10.0%</option>
            <option value={0.125}>12.5%</option>
            <option value={0.145}>14.5% (Default)</option>
            <option value={0.16}>16.0%</option>
          </select>
        </div>
      </div>

      {/* Security Risk Metrics Table */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Security Risk & Liquidity Profiles
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">Ticker</th>
                <th className="py-2 px-2 text-right font-medium">Ann. Return</th>
                <th className="py-2 px-2 text-right font-medium">Ann. Vol</th>
                <th className="py-2 px-2 text-right font-medium">Max Drawdown</th>
                <th className="py-2 px-2 text-right font-medium">DD Duration</th>
                <th className="py-2 px-2 text-right font-medium">Recovery</th>
                <th className="py-2 px-2 text-right font-medium">Sharpe</th>
                <th className="py-2 px-2 text-right font-medium">Daily 95% VaR</th>
                <th className="py-2 pl-2 text-right font-medium">Amihud Illiq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {profiles.map((p) => (
                <tr key={p.ticker} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {p.ticker}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                      p.annualizedReturn >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {p.annualizedReturn >= 0 ? '+' : ''}
                    {(p.annualizedReturn * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {(p.annualizedVolatility * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                    {(p.maxDrawdown * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {p.maxDrawdownDurationDays}d
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {p.recoveryDays !== null ? `${p.recoveryDays}d` : 'Unrecovered'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {p.sharpeRatio.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                    {(p.var95Daily * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {p.amihudIlliquidity.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio Allocation Simulator + Stress Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Portfolio Weight Allocator
            </h3>
            <button
              onClick={() => {
                const eq: Record<string, number> = {};
                profiles.forEach((p) => (eq[p.ticker] = 10));
                setWeights(eq);
              }}
              className="text-xs text-teal-700 dark:text-teal-400 hover:underline"
            >
              Reset Equal Weights
            </button>
          </div>
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.ticker} className="grid grid-cols-12 items-center gap-2 text-xs">
                <span className="col-span-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {p.ticker}
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={weights[p.ticker] ?? 0}
                  onChange={(e) =>
                    setWeights({ ...weights, [p.ticker]: Number(e.target.value) })
                  }
                  className="col-span-6 accent-teal-700 cursor-pointer"
                />
                <span className="col-span-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {((portfolio.weights[p.ticker] ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Portfolio Risk & Concentration Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs text-slate-500">Ann. Return</div>
                <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {(portfolio.portfolioAnnReturn * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Ann. Volatility</div>
                <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {(portfolio.portfolioAnnVolatility * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Portfolio Max DD</div>
                <div className="mt-1 text-base font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {(portfolio.portfolioMaxDrawdown * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">HHI Concentration</div>
                <div className="mt-1 text-base font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {portfolio.herfindahlIndex.toFixed(3)} · {portfolio.concentrationLabel}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Macro & Liquidity Stress Test Scenarios
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {portfolio.stressTests.map((st) => (
                <div key={st.scenario} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-md">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {st.scenario}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">{st.assumption}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-red-600 dark:text-red-400">
                      {(st.estimatedImpactPct * 100).toFixed(1)}% Shock
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Stressed Return: {(st.portfolioStressedReturn * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Simulated Portfolio Equity Curve */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Simulated Portfolio Equity Curve vs Equal-Weight Benchmark
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Updates dynamically as weight sliders change · Diversification Ratio:{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {portfolio.diversificationRatio.toFixed(2)}x
              </span>{' '}
              · Sharpe:{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {portfolio.portfolioSharpe.toFixed(2)}
              </span>
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">Base = 100.0 (Ex-Costs)</span>
        </div>
        <MultiLineChart
          dates={portfolio.equitySeries.map((e) => e.date)}
          series={[
            {
              id: 'port',
              label: 'Simulated Portfolio',
              color: '#0F766E',
              values: portfolio.equitySeries.map((e) => e.portfolio),
            },
            {
              id: 'eqb',
              label: 'Equal-Weight Universe',
              color: '#475569',
              dashed: true,
              values: portfolio.equitySeries.map((e) => e.benchmark),
            },
          ]}
          valueFormatter={(v) => v.toFixed(1)}
          yAxisLabel="Base = 100.0"
        />
      </div>

      {/* Return Correlation Matrix */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Daily Return Correlation Matrix (Pairwise Complete Observations)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr>
                <th className="py-2 px-2 text-left text-slate-500 font-medium">Ticker</th>
                {correlation.tickers.map((t) => (
                  <th key={t} className="py-2 px-2 text-slate-700 dark:text-slate-300 font-semibold">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlation.tickers.map((rowT, i) => (
                <tr key={rowT} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-2 text-left font-semibold text-slate-800 dark:text-slate-200">
                    {rowT}
                  </td>
                  {correlation.matrix[i].map((val, j) => (
                    <td key={`${i}-${j}`} className={`py-2 px-2 ${corrColor(val)}`}>
                      {val.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
