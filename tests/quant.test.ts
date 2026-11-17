import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDrawdowns,
  fitRidgeRegression,
  pearsonCorrelation,
  simpleReturns,
  sma,
  spearmanRankCorrelation,
} from '../src/engines/mathUtils.ts';
import { createSyntheticNseDataset, parseCsvDataset } from '../src/engines/dataGovernance.ts';
import { computeMarketIntelligence } from '../src/engines/marketEngine.ts';
import { computeFundamentalIntelligence } from '../src/engines/fundamentalEngine.ts';
import { computeRiskIntelligence } from '../src/engines/riskEngine.ts';
import { computeOpportunityRadar } from '../src/engines/opportunityEngine.ts';
import { computeKMRI } from '../src/engines/kmriEngine.ts';
import { computePredictiveIntelligence } from '../src/engines/predictiveEngine.ts';

test('simpleReturns and SMA compute exact deterministic values', () => {
  const prices = [100, 110, 99, 99];
  const rets = simpleReturns(prices);
  assert.equal(rets.length, 3);
  assert.ok(Math.abs(rets[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(rets[1] - -0.1) < 1e-9);
  assert.ok(Math.abs(rets[2] - 0) < 1e-9);

  const s = sma([10, 20, 30, 40], 2);
  assert.deepEqual(s, [null, 15, 25, 35]);
});

test('computeDrawdowns identifies peak, trough, max drawdown, and recovery days', () => {
  const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05'];
  const prices = [100, 120, 90, 105, 125];
  const dd = computeDrawdowns(dates, prices);
  assert.ok(Math.abs(dd.maxDrawdown - -0.25) < 1e-9);
  assert.equal(dd.maxDrawdownStart, '2025-01-02');
  assert.equal(dd.maxDrawdownTrough, '2025-01-03');
  assert.equal(dd.recoveryDays, 2); // 2025-01-05 recovers above 120
});

test('pearsonCorrelation and spearmanRankCorrelation return exact bounds', () => {
  assert.ok(Math.abs(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2]) - -1) < 1e-9);
  assert.ok(Math.abs(spearmanRankCorrelation([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
});

test('fitRidgeRegression solves linear trend accurately', () => {
  const X = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
  ];
  const y = [3, 5, 7, 9];
  const beta = fitRidgeRegression(X, y, 0.0001);
  assert.ok(Math.abs(beta[0] - 1) < 0.01);
  assert.ok(Math.abs(beta[1] - 2) < 0.01);
});

test('Synthetic dataset generation, validation, and all 6 engines execute end-to-end', () => {
  const ds = createSyntheticNseDataset();
  assert.equal(ds.metadata.classification, 'SYNTHETIC DATA');
  assert.equal(ds.securities.length, 10);
  assert.ok(ds.validation.checks.length === 10);

  const mkt = computeMarketIntelligence(ds);
  assert.equal(mkt.securities.length, 10);

  const fund = computeFundamentalIntelligence(ds);
  const kplc = fund.find((f) => f.ticker === 'KPLC');
  assert.ok(kplc && kplc.missingFields.length > 0, 'Missing fields should remain explicitly flagged');

  const risk = computeRiskIntelligence(ds, 0.145);
  assert.equal(risk.profiles.length, 10);

  const radar = computeOpportunityRadar(mkt, fund, risk.profiles);
  assert.equal(radar.length, 10);
  assert.equal(radar[0].rank, 1);

  const kmri = computeKMRI(ds, mkt, risk.profiles);
  assert.equal(kmri.scores.length, 10);
  assert.equal(kmri.sensitivityAnalysis.length, 3);

  const backtest = computePredictiveIntelligence(ds);
  assert.ok(backtest.testStartDate > backtest.trainEndDate, 'Strict chronological split must prevent leakage');
  assert.equal(backtest.modelComparisons.length, 4);
  assert.ok(backtest.equityCurve.length > 100);
});

test('CSV parser rejects invalid headers and validates clean NSE CSV input', () => {
  assert.throws(() => parseCsvDataset('foo,bar\n1,2', 'bad.csv'));

  const validCsv = [
    'date,ticker,name,sector,open,high,low,close,volume,turnover',
    ...Array.from({ length: 70 }, (_, idx) => {
      const day = String((idx % 28) + 1).padStart(2, '0');
      const month = String(Math.floor(idx / 28) + 1).padStart(2, '0');
      const price = (20 + idx * 0.1).toFixed(2);
      return `2025-${month}-${day},EQTY,Equity Group,Banking,${price},${price},${price},${price},100000,${100000 * Number(price)}`;
    }),
  ].join('\n');

  const parsed = parseCsvDataset(validCsv, 'sample.csv');
  assert.equal(parsed.metadata.classification, 'VERIFIED DATA');
  assert.equal(parsed.securities.length, 1);
  assert.equal(parsed.validation.overallStatus, 'VALIDATED');
});
