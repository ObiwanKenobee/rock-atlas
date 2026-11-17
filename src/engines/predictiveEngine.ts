import {
  BacktestConfig,
  BacktestResult,
  ParsedDataset,
  PredictiveModelComparison,
} from './types';
import {
  computeDrawdowns,
  fitRidgeRegression,
  mean,
  sampleStd,
  simpleReturns,
} from './mathUtils';

interface FeatureRow {
  ticker: string;
  dateIdx: number;
  date: string;
  ret5d: number;
  ret20d: number;
  vol20d: number;
  targetFwd20d: number;
}

/**
 * Engine 03: Predictive Intelligence
 * Enforces strict chronological train/test separation with zero look-ahead bias.
 * Evaluates simple statistical baselines before Ridge multi-feature regression.
 */
export function computePredictiveIntelligence(
  dataset: ParsedDataset,
  config: BacktestConfig = {
    trainFraction: 0.6,
    rebalanceDays: 20,
    topK: 3,
    transactionCostBps: 180,
    riskFreeRate: 0.145,
  }
): BacktestResult {
  // Align common trading calendar across universe
  const dateSet = new Set<string>();
  const barMap = new Map<string, Map<string, number>>();
  for (const sec of dataset.securities) {
    const m = new Map<string, number>();
    for (const b of sec.bars) {
      dateSet.add(b.date);
      m.set(b.date, b.close);
    }
    barMap.set(sec.ticker, m);
  }
  const dates = Array.from(dateSet).sort();
  const totalDays = dates.length;
  const horizon = config.rebalanceDays;

  if (totalDays < 90) {
    return {
      config,
      trainStartDate: dates[0] ?? '',
      trainEndDate: dates[0] ?? '',
      testStartDate: dates[0] ?? '',
      testEndDate: dates[totalDays - 1] ?? '',
      testTradingDays: 0,
      modelComparisons: [],
      strategyMetrics: {
        cumulativeReturn: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0,
        avgTurnoverPerRebalance: 0,
        totalTransactionCostPct: 0,
      },
      benchmarkMetrics: {
        cumulativeReturn: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
      },
      equityCurve: [],
      latestForecasts: [],
    };
  }

  const splitIdx = Math.max(45, Math.min(totalDays - horizon - 10, Math.floor(totalDays * config.trainFraction)));

  // Build lag-safe feature rows (features at dateIdx use only <= dateIdx; target is dateIdx -> dateIdx + horizon)
  const trainRows: FeatureRow[] = [];
  const testRows: FeatureRow[] = [];

  for (const sec of dataset.securities) {
    const bars = sec.bars;
    if (bars.length < 60) continue;
    const closes = bars.map((b) => b.close);
    const dailyRets = simpleReturns(closes);

    // Map bar date -> global date index
    const dateToLocalIdx = new Map<string, number>();
    for (let i = 0; i < bars.length; i++) dateToLocalIdx.set(bars[i].date, i);

    for (let gIdx = 25; gIdx + horizon < totalDays; gIdx++) {
      const d = dates[gIdx];
      const dFwd = dates[gIdx + horizon];
      const lIdx = dateToLocalIdx.get(d);
      const lFwd = dateToLocalIdx.get(dFwd);
      if (lIdx === undefined || lFwd === undefined || lIdx < 20) continue;

      const pNow = closes[lIdx];
      const p5 = closes[lIdx - 5];
      const p20 = closes[lIdx - 20];
      const pFwd = closes[lFwd];
      if (p5 <= 0 || p20 <= 0 || pNow <= 0) continue;

      const ret5d = pNow / p5 - 1;
      const ret20d = pNow / p20 - 1;
      const vol20d = sampleStd(dailyRets.slice(Math.max(0, lIdx - 20), lIdx)) * Math.sqrt(252);
      const targetFwd20d = pFwd / pNow - 1;

      const row: FeatureRow = {
        ticker: sec.ticker,
        dateIdx: gIdx,
        date: d,
        ret5d,
        ret20d,
        vol20d,
        targetFwd20d,
      };

      // Strict chronological split: training targets must ALSO end before splitIdx (no leakage!)
      if (gIdx + horizon <= splitIdx) {
        trainRows.push(row);
      } else if (gIdx >= splitIdx) {
        testRows.push(row);
      }
    }
  }

  // Fit Ridge Regression purely on trainRows
  const XTrain = trainRows.map((r) => [1, r.ret5d, r.ret20d, r.vol20d]);
  const yTrain = trainRows.map((r) => r.targetFwd20d);
  const beta = fitRidgeRegression(XTrain, yTrain, 2.5);
  const trainHistMean = mean(yTrain);

  // Compute In-Sample R^2 for Ridge
  const yTrainMean = mean(yTrain);
  let ssResTrain = 0;
  let ssTotTrain = 0;
  for (let i = 0; i < trainRows.length; i++) {
    const pred =
      (beta[0] ?? 0) +
      (beta[1] ?? 0) * XTrain[i][1] +
      (beta[2] ?? 0) * XTrain[i][2] +
      (beta[3] ?? 0) * XTrain[i][3];
    ssResTrain += Math.pow(yTrain[i] - pred, 2);
    ssTotTrain += Math.pow(yTrain[i] - yTrainMean, 2);
  }
  const ridgeInSampleR2 = ssTotTrain > 0 ? 1 - ssResTrain / ssTotTrain : 0;

  // Evaluate 4 models on strict Out-of-Sample testRows
  const evalModel = (
    name: string,
    methodology: string,
    inSampleR2: number | null,
    predictFn: (r: FeatureRow) => number
  ): PredictiveModelComparison => {
    if (testRows.length === 0) {
      return {
        modelName: name,
        methodology,
        inSampleR2,
        oosMae: 0,
        oosRmse: 0,
        directionalAccuracy: 0,
        sampleCount: 0,
      };
    }
    let absErr = 0;
    let sqErr = 0;
    let hits = 0;
    for (const r of testRows) {
      const pred = predictFn(r);
      const err = r.targetFwd20d - pred;
      absErr += Math.abs(err);
      sqErr += err * err;
      if ((pred >= 0 && r.targetFwd20d >= 0) || (pred < 0 && r.targetFwd20d < 0)) {
        hits++;
      }
    }
    return {
      modelName: name,
      methodology,
      inSampleR2,
      oosMae: absErr / testRows.length,
      oosRmse: Math.sqrt(sqErr / testRows.length),
      directionalAccuracy: hits / testRows.length,
      sampleCount: testRows.length,
    };
  };

  const modelComparisons: PredictiveModelComparison[] = [
    evalModel(
      'Naive Zero-Drift Baseline',
      'Predicts 0% excess 20D return (random walk benchmark)',
      null,
      () => 0
    ),
    evalModel(
      'Expanding Historical Mean',
      'Predicts in-sample trailing mean 20D return',
      0,
      () => trainHistMean
    ),
    evalModel(
      'Volatility-Scaled Mean Reversion',
      'Short-horizon 5D reversal dampened by realized 20D volatility',
      null,
      (r) => -0.25 * r.ret5d / Math.max(0.15, r.vol20d)
    ),
    evalModel(
      'Ridge Multi-Feature Regression',
      'L2-regularized linear model on 5D/20D momentum + 20D volatility',
      Number(ridgeInSampleR2.toFixed(3)),
      (r) =>
        (beta[0] ?? 0) +
        (beta[1] ?? 0) * r.ret5d +
        (beta[2] ?? 0) * r.ret20d +
        (beta[3] ?? 0) * r.vol20d
    ),
  ];

  // Out-of-sample residual std for 95% confidence interval estimation
  const ridgeResiduals = testRows.map(
    (r) =>
      r.targetFwd20d -
      ((beta[0] ?? 0) +
        (beta[1] ?? 0) * r.ret5d +
        (beta[2] ?? 0) * r.ret20d +
        (beta[3] ?? 0) * r.vol20d)
  );
  const residualStd = Math.max(0.02, sampleStd(ridgeResiduals));

  // Walk-forward Out-of-Sample Portfolio Backtest from splitIdx -> totalDays - 1
  let eqGross = 100;
  let eqNet = 100;
  let eqBench = 100;
  const equityCurve: BacktestResult['equityCurve'] = [
    {
      date: dates[splitIdx],
      strategyGross: 100,
      strategyNet: 100,
      benchmark: 100,
    },
  ];

  let currentHoldings = new Map<string, number>();
  const testDailyGross: number[] = [];
  const testDailyNet: number[] = [];
  const testDailyBench: number[] = [];
  const rebalancePeriodReturns: number[] = [];
  const turnovers: number[] = [];
  let totalTxCostPct = 0;
  let periodAccReturn = 1;

  for (let gIdx = splitIdx + 1; gIdx < totalDays; gIdx++) {
    const prevDate = dates[gIdx - 1];
    const currDate = dates[gIdx];
    const isRebalance = (gIdx - (splitIdx + 1)) % horizon === 0;

    let dailyTxCost = 0;
    if (isRebalance) {
      if (gIdx > splitIdx + 1) {
        rebalancePeriodReturns.push(periodAccReturn - 1);
        periodAccReturn = 1;
      }

      // Score all securities using ONLY data available up to prevDate (no look-ahead)
      const candidates: Array<{ ticker: string; pred: number }> = [];
      for (const sec of dataset.securities) {
        const lIdx = sec.bars.findIndex((b) => b.date === prevDate);
        if (lIdx < 20) continue;
        const pNow = sec.bars[lIdx].close;
        const p5 = sec.bars[lIdx - 5].close;
        const p20 = sec.bars[lIdx - 20].close;
        if (p5 <= 0 || p20 <= 0) continue;
        const ret5d = pNow / p5 - 1;
        const ret20d = pNow / p20 - 1;
        const rets = simpleReturns(sec.bars.slice(Math.max(0, lIdx - 20), lIdx + 1).map((b) => b.close));
        const vol20d = sampleStd(rets) * Math.sqrt(252);
        const pred =
          (beta[0] ?? 0) +
          (beta[1] ?? 0) * ret5d +
          (beta[2] ?? 0) * ret20d +
          (beta[3] ?? 0) * vol20d;
        candidates.push({ ticker: sec.ticker, pred });
      }

      candidates.sort((a, b) => b.pred - a.pred);
      const selected = candidates.slice(0, Math.min(config.topK, candidates.length));
      const newHoldings = new Map<string, number>();
      const w = selected.length > 0 ? 1 / selected.length : 0;
      for (const s of selected) newHoldings.set(s.ticker, w);

      // One-way turnover calculation
      const allTickers = new Set([...currentHoldings.keys(), ...newHoldings.keys()]);
      let oneWayTurnover = 0;
      for (const t of allTickers) {
        oneWayTurnover += Math.abs((newHoldings.get(t) ?? 0) - (currentHoldings.get(t) ?? 0));
      }
      oneWayTurnover *= 0.5;
      turnovers.push(oneWayTurnover);

      // Apply half of round-trip transaction cost per unit of two-way weight change
      dailyTxCost = oneWayTurnover * 2 * (config.transactionCostBps / 10000);
      totalTxCostPct += dailyTxCost;
      currentHoldings = newHoldings;
    }

    // Compute daily return for strategy and equal-weight benchmark
    let stratDayRet = 0;
    let coveredWeight = 0;
    const benchRets: number[] = [];

    for (const sec of dataset.securities) {
      const m = barMap.get(sec.ticker);
      const pPrev = m?.get(prevDate);
      const pCurr = m?.get(currDate);
      if (pPrev && pCurr && pPrev > 0) {
        const r = pCurr / pPrev - 1;
        benchRets.push(r);
        const w = currentHoldings.get(sec.ticker) ?? 0;
        if (w > 0) {
          stratDayRet += w * r;
          coveredWeight += w;
        }
      }
    }

    const grossDay = coveredWeight > 0 ? stratDayRet / coveredWeight : 0;
    const netDay = grossDay - dailyTxCost;
    const benchDay = benchRets.length > 0 ? mean(benchRets) : 0;

    periodAccReturn *= 1 + netDay;
    eqGross *= 1 + grossDay;
    eqNet *= 1 + netDay;
    eqBench *= 1 + benchDay;

    testDailyGross.push(grossDay);
    testDailyNet.push(netDay);
    testDailyBench.push(benchDay);

    equityCurve.push({
      date: currDate,
      strategyGross: Number(eqGross.toFixed(2)),
      strategyNet: Number(eqNet.toFixed(2)),
      benchmark: Number(eqBench.toFixed(2)),
    });
  }

  const testYears = Math.max(1 / 252, testDailyNet.length / 252);
  const netCum = eqNet / 100 - 1;
  const benchCum = eqBench / 100 - 1;
  const netAnn = netCum > -1 ? Math.pow(1 + netCum, 1 / testYears) - 1 : -1;
  const benchAnn = benchCum > -1 ? Math.pow(1 + benchCum, 1 / testYears) - 1 : -1;
  const netVol = sampleStd(testDailyNet) * Math.sqrt(252);
  const benchVol = sampleStd(testDailyBench) * Math.sqrt(252);

  const stratDd = computeDrawdowns(
    equityCurve.map((e) => e.date),
    equityCurve.map((e) => e.strategyNet)
  );
  const benchDd = computeDrawdowns(
    equityCurve.map((e) => e.date),
    equityCurve.map((e) => e.benchmark)
  );

  // Latest forward 20D projections with 95% empirical intervals
  const latestForecasts: BacktestResult['latestForecasts'] = dataset.securities
    .filter((s) => s.bars.length >= 25)
    .map((sec) => {
      const bars = sec.bars;
      const n = bars.length;
      const pNow = bars[n - 1].close;
      const p5 = bars[n - 6].close;
      const p20 = bars[n - 21].close;
      const ret5d = p5 > 0 ? pNow / p5 - 1 : 0;
      const ret20d = p20 > 0 ? pNow / p20 - 1 : 0;
      const vol20d =
        sampleStd(simpleReturns(bars.slice(n - 21).map((b) => b.close))) * Math.sqrt(252);
      const pred =
        (beta[0] ?? 0) +
        (beta[1] ?? 0) * ret5d +
        (beta[2] ?? 0) * ret20d +
        (beta[3] ?? 0) * vol20d;
      const halfBand = 1.96 * residualStd;

      return {
        ticker: sec.ticker,
        name: sec.name,
        expected20dReturn: pred,
        lower95Interval: pred - halfBand,
        upper95Interval: pred + halfBand,
        residualStd,
        signalBasis: `5D=${(ret5d * 100).toFixed(1)}%, 20D=${(ret20d * 100).toFixed(1)}%, Vol=${(vol20d * 100).toFixed(1)}%`,
      };
    })
    .sort((a, b) => b.expected20dReturn - a.expected20dReturn);

  return {
    config,
    trainStartDate: dates[0],
    trainEndDate: dates[splitIdx],
    testStartDate: dates[splitIdx + 1] ?? dates[splitIdx],
    testEndDate: dates[totalDays - 1],
    testTradingDays: testDailyNet.length,
    modelComparisons,
    strategyMetrics: {
      cumulativeReturn: netCum,
      annualizedReturn: netAnn,
      annualizedVolatility: netVol,
      maxDrawdown: stratDd.maxDrawdown,
      sharpeRatio: netVol > 0 ? (netAnn - config.riskFreeRate) / netVol : 0,
      winRate:
        rebalancePeriodReturns.length > 0
          ? rebalancePeriodReturns.filter((r) => r > 0).length / rebalancePeriodReturns.length
          : 0,
      avgTurnoverPerRebalance: turnovers.length > 0 ? mean(turnovers) : 0,
      totalTransactionCostPct: totalTxCostPct,
    },
    benchmarkMetrics: {
      cumulativeReturn: benchCum,
      annualizedReturn: benchAnn,
      annualizedVolatility: benchVol,
      maxDrawdown: benchDd.maxDrawdown,
      sharpeRatio: benchVol > 0 ? (benchAnn - config.riskFreeRate) / benchVol : 0,
    },
    equityCurve,
    latestForecasts,
  };
}
