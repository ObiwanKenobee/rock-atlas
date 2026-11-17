import React from 'react';
import {
  DatasetMetadata,
  MarketOverview,
  OpportunityScore,
  ValidationReport,
  WorkspaceId,
} from '../../engines/types';
import { MultiLineChart } from '../Charts';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';

interface CommandCentreProps {
  metadata: DatasetMetadata;
  validation: ValidationReport;
  market: MarketOverview;
  opportunities: OpportunityScore[];
  onSelectSecurity: (ticker: string) => void;
  onNavigate: (workspace: WorkspaceId) => void;
}

export const CommandCentre: React.FC<CommandCentreProps> = ({
  metadata,
  validation,
  market,
  opportunities,
  onSelectSecurity,
  onNavigate,
}) => {
  const dates = market.indexSeries.map((d) => d.date);
  const topRadar = opportunities.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Core KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Equal-Weight Composite Return
          </div>
          <div
            className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
              market.compositeIndexReturn >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {market.compositeIndexReturn >= 0 ? '+' : ''}
            {(market.compositeIndexReturn * 100).toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metadata.startDate} to {metadata.endDate}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Session Market Breadth
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {market.advancers} / {market.decliners}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Advancers vs Decliners · {(market.pctAboveSma50 * 100).toFixed(0)}% above SMA50
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            20D Avg Daily Turnover
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            KES {(market.avgDailyUniverseTurnover / 1e6).toFixed(1)}M
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Latest session: KES {(market.totalLatestTurnover / 1e6).toFixed(1)}M
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Data Governance Status
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {validation.overallStatus === 'VALIDATED' ? 'Validated' : 'Audit Flags'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {validation.validRowsRetained.toLocaleString()} rows · {metadata.classification}
          </div>
        </div>
      </div>

      {/* Primary Focal Anchor: Composite Market Trajectory + Sector Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                NSE Universe Composite Index Trajectory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Normalized base 100 · Comparing equal-weighted participation vs turnover-weighted liquidity leaders
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {metadata.tradingDays} trading sessions
            </span>
          </div>

          <MultiLineChart
            dates={dates}
            series={[
              {
                id: 'ew',
                label: 'Equal-Weight Composite',
                color: '#0F766E',
                values: market.indexSeries.map((d) => d.equalWeightIndex),
              },
              {
                id: 'tw',
                label: 'Turnover-Weight Composite',
                color: '#334155',
                dashed: true,
                values: market.indexSeries.map((d) => d.turnoverWeightIndex),
              },
            ]}
            valueFormatter={(v) => v.toFixed(1)}
            yAxisLabel="Base = 100.0"
          />
        </div>

        <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Key Research Observations
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated synthesis across Engines 01–05
            </p>

            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <div className="py-3">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Leading Sector (Period Return)
                </div>
                <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {market.sectors[0]?.sector ?? 'N/A'}
                </div>
                <div className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                  +{((market.sectors[0]?.avgPeriodReturn ?? 0) * 100).toFixed(1)}% avg ·{' '}
                  {((market.sectors[0]?.turnoverShare ?? 0) * 100).toFixed(1)}% of market turnover
                </div>
              </div>

              <div className="py-3">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Top Opportunity Radar Profiles
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {topRadar.map((item) => (
                    <button
                      key={item.ticker}
                      onClick={() => onSelectSecurity(item.ticker)}
                      className="w-full flex items-center justify-between text-left py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-1.5 -mx-1.5 transition-colors"
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        #{item.rank} {item.ticker} · {item.sector}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-400">
                        {item.compositeScore}/100
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-3">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Unusual Activity Monitor
                </div>
                {market.alerts.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    No volume or sigma return spikes detected in the past 5 sessions.
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {market.alerts.slice(0, 3).map((a, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-mono font-medium">{a.ticker}</span> ({a.date}): {a.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('opportunity-radar')}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            <span>Open Opportunity Radar</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sector Attribution & Market Universe Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Sector Performance & Turnover Concentration
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Sector</th>
                  <th className="py-2 px-2 text-right font-medium">Avg Return</th>
                  <th className="py-2 px-2 text-right font-medium">20D</th>
                  <th className="py-2 pl-2 text-right font-medium">Turnover Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {market.sectors.map((sec) => (
                  <tr key={sec.sector} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {sec.sector}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {sec.securityCount} {sec.securityCount === 1 ? 'security' : 'securities'} · Vol{' '}
                        {(sec.avgVolatility * 100).toFixed(1)}%
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                        sec.avgPeriodReturn >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {sec.avgPeriodReturn >= 0 ? '+' : ''}
                      {(sec.avgPeriodReturn * 100).toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                        sec.avgReturn20d >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {sec.avgReturn20d >= 0 ? '+' : ''}
                      {(sec.avgReturn20d * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {(sec.turnoverShare * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Market Movement Monitor
            </h2>
            <span className="text-xs text-slate-500">Click any row to inspect security profile</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Ticker</th>
                  <th className="py-2 px-2 text-right font-medium">Close (KES)</th>
                  <th className="py-2 px-2 text-right font-medium">1D</th>
                  <th className="py-2 px-2 text-right font-medium">20D</th>
                  <th className="py-2 px-2 text-right font-medium">Period</th>
                  <th className="py-2 pl-2 text-right font-medium">20D Turnover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {market.securities.map((s) => (
                  <tr
                    key={s.ticker}
                    onClick={() => onSelectSecurity(s.ticker)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {s.ticker}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {s.sector}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {s.latestClose.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                        s.dailyReturn >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {s.dailyReturn >= 0 ? '+' : ''}
                      {(s.dailyReturn * 100).toFixed(2)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                        s.return20d >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {s.return20d >= 0 ? '+' : ''}
                      {(s.return20d * 100).toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                        s.ytdOrPeriodReturn >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {s.ytdOrPeriodReturn >= 0 ? '+' : ''}
                      {(s.ytdOrPeriodReturn * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      KES {(s.avgTurnover20d / 1e6).toFixed(2)}M
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
