import React from 'react';
import {
  FundamentalProfile,
  MarketOverview,
  ParsedDataset,
  SecurityRiskProfile,
} from '../../engines/types';
import { sma } from '../../engines/mathUtils';
import { DrawdownAreaChart, MultiLineChart, VolumeBarChart } from '../Charts';

interface SecurityExplorerProps {
  dataset: ParsedDataset;
  market: MarketOverview;
  fundamentals: FundamentalProfile[];
  riskProfiles: SecurityRiskProfile[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

export const SecurityExplorer: React.FC<SecurityExplorerProps> = ({
  dataset,
  market,
  fundamentals,
  riskProfiles,
  selectedTicker,
  onSelectTicker,
}) => {
  const [compareTicker, setCompareTicker] = React.useState<string>('NONE');

  const sec =
    dataset.securities.find((s) => s.ticker === selectedTicker) ?? dataset.securities[0];

  if (!sec) {
    return (
      <div className="p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500">
        No securities available in the active dataset.
      </div>
    );
  }

  const peerSec =
    compareTicker !== 'NONE' && compareTicker !== sec.ticker
      ? dataset.securities.find((s) => s.ticker === compareTicker) ?? null
      : null;

  const mkt = market.securities.find((m) => m.ticker === sec.ticker);
  const fund = fundamentals.find((f) => f.ticker === sec.ticker);
  const risk = riskProfiles.find((r) => r.ticker === sec.ticker);
  const peerRisk = peerSec ? riskProfiles.find((r) => r.ticker === peerSec.ticker) : null;
  const peerFund = peerSec ? fundamentals.find((f) => f.ticker === peerSec.ticker) : null;

  const dates = sec.bars.map((b) => b.date);
  const closes = sec.bars.map((b) => b.close);
  const volumes = sec.bars.map((b) => b.volume);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);

  // Normalized Base-100 comparison series when peer is selected
  const peerPriceByDate = peerSec
    ? new Map(peerSec.bars.map((b) => [b.date, b.close]))
    : null;
  const secBase = closes[0] || 1;
  const peerBase = peerSec?.bars[0]?.close || 1;
  const normSecSeries = closes.map((c) => Number(((c / secBase) * 100).toFixed(2)));
  const normPeerSeries = peerPriceByDate
    ? dates.map((d) => {
        const val = peerPriceByDate.get(d);
        return val !== undefined ? Number(((val / peerBase) * 100).toFixed(2)) : null;
      })
    : [];

  const formatMetric = (
    val: number | null | undefined,
    formatter: (n: number) => string
  ): { text: string; unavailable: boolean } => {
    if (val === null || val === undefined || Number.isNaN(val)) {
      return { text: 'UNAVAILABLE DATA', unavailable: true };
    }
    return { text: formatter(val), unavailable: false };
  };

  const fundamentalRows = [
    {
      label: 'Market Cap',
      ...formatMetric(fund?.metrics.marketCapKes, (v) => `KES ${(v / 1e9).toFixed(2)}B`),
    },
    {
      label: 'Revenue Growth (YoY)',
      ...formatMetric(fund?.metrics.revenueGrowthYoY, (v) => `${(v * 100).toFixed(1)}%`),
    },
    {
      label: 'Net Profit Margin',
      ...formatMetric(fund?.metrics.netMargin, (v) => `${(v * 100).toFixed(1)}%`),
    },
    {
      label: 'Return on Equity (ROE)',
      ...formatMetric(fund?.metrics.roe, (v) => `${(v * 100).toFixed(1)}%`),
    },
    {
      label: 'Debt-to-Equity',
      ...formatMetric(fund?.metrics.debtToEquity, (v) => `${v.toFixed(2)}x`),
    },
    {
      label: 'P/E Ratio',
      ...formatMetric(fund?.metrics.peRatio, (v) => `${v.toFixed(1)}x`),
    },
    {
      label: 'P/B Ratio',
      ...formatMetric(fund?.metrics.pbRatio, (v) => `${v.toFixed(2)}x`),
    },
    {
      label: 'Dividend Yield',
      ...formatMetric(fund?.metrics.dividendYield, (v) => `${(v * 100).toFixed(1)}%`),
    },
    {
      label: 'FCF Conversion',
      ...formatMetric(fund?.metrics.fcfConversion, (v) => `${(v * 100).toFixed(0)}%`),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Security Selector Bar */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {sec.sector} · {sec.bars.length} Trading Observations · {dataset.metadata.currency}
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {sec.ticker} — {sec.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Primary:
            </label>
            <select
              value={sec.ticker}
              onChange={(e) => onSelectTicker(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {dataset.securities.map((s) => (
                <option key={s.ticker} value={s.ticker}>
                  {s.ticker} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Compare Peer:
            </label>
            <select
              value={compareTicker}
              onChange={(e) => setCompareTicker(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="NONE">None (Single Security)</option>
              {dataset.securities
                .filter((s) => s.ticker !== sec.ticker)
                .map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} — {s.sector}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Headline Security Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500">Latest Close</div>
          <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            KES {mkt?.latestClose.toFixed(2) ?? 'N/A'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Cumulative Return</div>
          <div
            className={`mt-1 text-lg font-mono font-semibold tabular-nums ${
              (risk?.cumulativeReturn ?? 0) >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {risk ? `${risk.cumulativeReturn >= 0 ? '+' : ''}${(risk.cumulativeReturn * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Annualized Volatility</div>
          <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {risk ? `${(risk.annualizedVolatility * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Maximum Drawdown</div>
          <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
            {risk ? `${(risk.maxDrawdown * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">20D Avg Turnover</div>
          <div className="mt-1 text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            KES {mkt ? `${(mkt.avgTurnover20d / 1e6).toFixed(2)}M` : 'N/A'}
          </div>
        </div>
      </div>

      {peerSec && peerRisk && (
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Comparative Relative Performance: {sec.ticker} vs {peerSec.ticker} (Indexed Base = 100)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Normalizes both price series to 100 at {dates[0]} for direct relative return and drawdown inspection.
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {sec.ticker}: Vol {(risk ? risk.annualizedVolatility * 100 : 0).toFixed(1)}%, P/E{' '}
              {fund?.metrics.peRatio ?? 'N/A'}x · {peerSec.ticker}: Vol{' '}
              {(peerRisk.annualizedVolatility * 100).toFixed(1)}%, P/E{' '}
              {peerFund?.metrics.peRatio ?? 'N/A'}x
            </div>
          </div>
          <MultiLineChart
            dates={dates}
            series={[
              { id: 'prim', label: `${sec.ticker} (Base 100)`, color: '#0F766E', values: normSecSeries },
              { id: 'peer', label: `${peerSec.ticker} (Base 100)`, color: '#D97706', dashed: true, values: normPeerSeries },
            ]}
            valueFormatter={(v) => v.toFixed(1)}
            yAxisLabel="Base = 100.0"
          />
        </div>
      )}

      {/* Charts + Fundamentals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Historical Price & Moving Averages (SMA 20 / SMA 50)
            </h3>
            <MultiLineChart
              dates={dates}
              series={[
                { id: 'close', label: 'Close (KES)', color: '#0F172A', values: closes },
                { id: 'sma20', label: 'SMA 20', color: '#0F766E', values: sma20 },
                { id: 'sma50', label: 'SMA 50', color: '#D97706', dashed: true, values: sma50 },
              ]}
              valueFormatter={(v) => v.toFixed(2)}
              yAxisLabel="KES"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Daily Share Volume Profile
            </h3>
            <VolumeBarChart dates={dates} volumes={volumes} />
          </div>

          {risk && (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Peak-to-Trough Underwater Drawdown
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  Worst trough: {risk.maxDrawdownStart} to {risk.maxDrawdownTrough} ·{' '}
                  {risk.recoveryDays !== null
                    ? `Recovered in ${risk.recoveryDays} trading days`
                    : 'Not yet recovered'}
                </span>
              </div>
              <DrawdownAreaChart series={risk.drawdownSeries} />
            </div>
          )}
        </div>

        {/* Fundamental Intelligence Profile */}
        <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Engine 02: Fundamental Profile
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              {fund?.reportingPeriod ?? 'No filings'} · Data Completeness:{' '}
              <span className="font-mono tabular-nums">
                {fund ? `${(fund.completenessRatio * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {fundamentalRows.map((row) => (
              <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                <span
                  className={`font-mono tabular-nums ${
                    row.unavailable
                      ? 'text-amber-600 dark:text-amber-400 text-[11px]'
                      : 'font-medium text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {row.text}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Fundamental Health Score</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {fund?.fundamentalHealthScore !== null && fund?.fundamentalHealthScore !== undefined
                  ? `${fund.fundamentalHealthScore} / 100`
                  : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Relative Valuation Score</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {fund?.valuationScore !== null && fund?.valuationScore !== undefined
                  ? `${fund.valuationScore} / 100`
                  : 'UNAVAILABLE'}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 pt-2 leading-relaxed">
              {fund?.healthAssessment}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
