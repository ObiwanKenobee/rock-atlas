import React from 'react';
import { BacktestConfig, BacktestResult } from '../../engines/types';
import { MultiLineChart } from '../Charts';

interface PredictiveWorkspaceProps {
  backtest: BacktestResult;
  config: BacktestConfig;
  onChangeConfig: (c: BacktestConfig) => void;
}

export const PredictiveWorkspace: React.FC<PredictiveWorkspaceProps> = ({
  backtest,
  config,
  onChangeConfig,
}) => {
  const dates = backtest.equityCurve.map((e) => e.date);

  return (
    <div className="space-y-6">
      {/* Configuration & Anti-Leakage Disclosure */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Engine 03: Predictive Intelligence & Walk-Forward Backtest
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Strict chronological split: In-sample training ({backtest.trainStartDate} to{' '}
              {backtest.trainEndDate}) · Out-of-sample test ({backtest.testStartDate} to{' '}
              {backtest.testEndDate}). Statistical forecasts reflect empirical residual bands, never certainty.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">In-Sample Train Split</label>
            <select
              value={config.trainFraction}
              onChange={(e) =>
                onChangeConfig({ ...config, trainFraction: Number(e.target.value) })
              }
              className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value={0.5}>50% Train / 50% OOS</option>
              <option value={0.6}>60% Train / 40% OOS</option>
              <option value={0.7}>70% Train / 30% OOS</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Portfolio Top-K Selection</label>
            <select
              value={config.topK}
              onChange={(e) => onChangeConfig({ ...config, topK: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value={2}>Top 2 Ranked</option>
              <option value={3}>Top 3 Ranked</option>
              <option value={5}>Top 5 Ranked</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Rebalance Horizon</label>
            <select
              value={config.rebalanceDays}
              onChange={(e) =>
                onChangeConfig({ ...config, rebalanceDays: Number(e.target.value) })
              }
              className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value={10}>10 Trading Days</option>
              <option value={20}>20 Trading Days</option>
              <option value={40}>40 Trading Days</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Round-Trip Transaction Cost</label>
            <select
              value={config.transactionCostBps}
              onChange={(e) =>
                onChangeConfig({ ...config, transactionCostBps: Number(e.target.value) })
              }
              className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value={0}>0 bps (Gross Frictionless)</option>
              <option value={100}>100 bps (1.0%)</option>
              <option value={180}>180 bps (NSE Statutory Ref)</option>
              <option value={250}>250 bps (High Slippage)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Out-of-Sample Equity Curve & Strategy vs Benchmark Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Out-of-Sample Cumulative Equity Curve (Gross vs Net of Costs vs Benchmark)
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {backtest.testTradingDays} OOS trading sessions
            </span>
          </div>

          <MultiLineChart
            dates={dates}
            series={[
              {
                id: 'net',
                label: `Strategy Net (${config.transactionCostBps} bps)`,
                color: '#0F766E',
                values: backtest.equityCurve.map((e) => e.strategyNet),
              },
              {
                id: 'gross',
                label: 'Strategy Gross',
                color: '#94A3B8',
                dashed: true,
                values: backtest.equityCurve.map((e) => e.strategyGross),
              },
              {
                id: 'bench',
                label: 'Equal-Weight Benchmark',
                color: '#1E293B',
                values: backtest.equityCurve.map((e) => e.benchmark),
              },
            ]}
            valueFormatter={(v) => v.toFixed(1)}
            yAxisLabel="Base = 100.0"
          />
        </div>

        <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Out-of-Sample Performance Audit
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              {
                label: 'Net Cumulative Return',
                strat: `${(backtest.strategyMetrics.cumulativeReturn * 100).toFixed(2)}%`,
                bench: `${(backtest.benchmarkMetrics.cumulativeReturn * 100).toFixed(2)}%`,
              },
              {
                label: 'Net Annualized Return',
                strat: `${(backtest.strategyMetrics.annualizedReturn * 100).toFixed(2)}%`,
                bench: `${(backtest.benchmarkMetrics.annualizedReturn * 100).toFixed(2)}%`,
              },
              {
                label: 'Annualized Volatility',
                strat: `${(backtest.strategyMetrics.annualizedVolatility * 100).toFixed(2)}%`,
                bench: `${(backtest.benchmarkMetrics.annualizedVolatility * 100).toFixed(2)}%`,
              },
              {
                label: 'Maximum Drawdown',
                strat: `${(backtest.strategyMetrics.maxDrawdown * 100).toFixed(2)}%`,
                bench: `${(backtest.benchmarkMetrics.maxDrawdown * 100).toFixed(2)}%`,
              },
              {
                label: 'Sharpe Ratio (Net)',
                strat: backtest.strategyMetrics.sharpeRatio.toFixed(2),
                bench: backtest.benchmarkMetrics.sharpeRatio.toFixed(2),
              },
              {
                label: 'Rebalance Win Rate',
                strat: `${(backtest.strategyMetrics.winRate * 100).toFixed(0)}%`,
                bench: '—',
              },
              {
                label: 'Avg One-Way Turnover',
                strat: `${(backtest.strategyMetrics.avgTurnoverPerRebalance * 100).toFixed(1)}%`,
                bench: '0.0%',
              },
              {
                label: 'Cumulative Cost Drag',
                strat: `-${(backtest.strategyMetrics.totalTransactionCostPct * 100).toFixed(2)}%`,
                bench: '0.00%',
              },
            ].map((row) => (
              <div key={row.label} className="py-2.5 flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                <div className="font-mono tabular-nums text-right">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {row.strat}
                  </span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-slate-500">{row.bench}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Format: Net Strategy / Equal-Weight Benchmark. Historical outperformance does not imply future returns.
          </div>
        </div>
      </div>

      {/* Baseline Model Comparison + Latest Forward Forecasts with 95% Uncertainty */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Statistical Baselines vs Multi-Feature Ridge (OOS Errors)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-2 font-medium">Model</th>
                  <th className="py-2 px-2 text-right font-medium">OOS MAE</th>
                  <th className="py-2 px-2 text-right font-medium">OOS RMSE</th>
                  <th className="py-2 pl-2 text-right font-medium">Dir. Acc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {backtest.modelComparisons.map((m) => (
                  <tr key={m.modelName}>
                    <td className="py-2.5 pr-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.modelName}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.methodology}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {(m.oosMae * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {(m.oosRmse * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {(m.directionalAccuracy * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Latest 20D Statistical Return Estimates (95% Empirical Residual Intervals)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-2 font-medium">Ticker</th>
                  <th className="py-2 px-2 text-right font-medium">Point Est.</th>
                  <th className="py-2 px-2 text-right font-medium">95% Interval</th>
                  <th className="py-2 pl-2 font-medium">Feature Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {backtest.latestForecasts.map((f) => (
                  <tr key={f.ticker}>
                    <td className="py-2 pr-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {f.ticker}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-mono tabular-nums ${
                        f.expected20dReturn >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {f.expected20dReturn >= 0 ? '+' : ''}
                      {(f.expected20dReturn * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      [{(f.lower95Interval * 100).toFixed(1)}%, +{(f.upper95Interval * 100).toFixed(1)}%]
                    </td>
                    <td className="py-2 pl-2 font-mono text-[11px] text-slate-500">
                      {f.signalBasis}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
