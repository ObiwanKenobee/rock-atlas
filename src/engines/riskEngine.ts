import {
  CorrelationMatrix,
  ParsedDataset,
  PortfolioRiskAnalysis,
  SecurityRiskProfile,
} from './types';
import {
  computeDrawdowns,
  downsideDeviation,
  mean,
  pearsonCorrelation,
  quantile,
  sampleStd,
  simpleReturns,
} from './mathUtils';

export function computeRiskIntelligence(
  dataset: ParsedDataset,
  riskFreeRate = 0.145 // Disclosed CBK 91-day T-bill reference assumption
): {
  profiles: SecurityRiskProfile[];
  correlation: CorrelationMatrix;
} {
  const profiles: SecurityRiskProfile[] = [];
  const returnsByTicker = new Map<string, Map<string, number>>();

  for (const sec of dataset.securities) {
    const bars = sec.bars;
    if (bars.length < 10) continue;
    const dates = bars.map((b) => b.date);
    const closes = bars.map((b) => b.close);
    const rets = simpleReturns(closes);

    const retMap = new Map<string, number>();
    for (let i = 1; i < bars.length; i++) {
      retMap.set(bars[i].date, rets[i - 1]);
    }
    returnsByTicker.set(sec.ticker, retMap);

    const cumulativeReturn = closes[0] > 0 ? closes[closes.length - 1] / closes[0] - 1 : 0;
    const years = Math.max(1 / 252, rets.length / 252);
    const annualizedReturn =
      cumulativeReturn > -1 ? Math.pow(1 + cumulativeReturn, 1 / years) - 1 : -1;
    const annualizedVolatility = sampleStd(rets) * Math.sqrt(252);
    const ddDev = downsideDeviation(rets, 0) * Math.sqrt(252);

    const ddStats = computeDrawdowns(dates, closes);
    const sharpeRatio =
      annualizedVolatility > 0 ? (annualizedReturn - riskFreeRate) / annualizedVolatility : 0;
    const var95Daily = quantile(rets, 0.05);

    // Amihud Illiquidity = average(|r_t| / Turnover_t) * 1e6
    const amihudObs: number[] = [];
    let zeroVolDays = 0;
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].volume <= 0) zeroVolDays++;
      if (bars[i].turnover > 0) {
        amihudObs.push(Math.abs(rets[i - 1]) / bars[i].turnover);
      }
    }
    const amihudIlliquidity = amihudObs.length > 0 ? mean(amihudObs) * 1e6 : 999;
    const zeroVolumeDaysPct = bars.length > 0 ? zeroVolDays / bars.length : 0;

    profiles.push({
      ticker: sec.ticker,
      name: sec.name,
      sector: sec.sector,
      observationCount: bars.length,
      cumulativeReturn,
      annualizedReturn,
      annualizedVolatility,
      downsideDeviation: ddDev,
      maxDrawdown: ddStats.maxDrawdown,
      maxDrawdownStart: ddStats.maxDrawdownStart,
      maxDrawdownTrough: ddStats.maxDrawdownTrough,
      maxDrawdownDurationDays: ddStats.maxDrawdownDurationDays,
      recoveryDays: ddStats.recoveryDays,
      sharpeRatio,
      var95Daily,
      amihudIlliquidity,
      zeroVolumeDaysPct,
      drawdownSeries: ddStats.series,
    });
  }

  // Pairwise correlation matrix across aligned dates
  const tickers = profiles.map((p) => p.ticker);
  const matrix: number[][] = Array.from({ length: tickers.length }, () =>
    new Array(tickers.length).fill(0)
  );

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i; j < tickers.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const mapA = returnsByTicker.get(tickers[i])!;
      const mapB = returnsByTicker.get(tickers[j])!;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [d, valA] of mapA.entries()) {
        const valB = mapB.get(d);
        if (valB !== undefined) {
          xs.push(valA);
          ys.push(valB);
        }
      }
      const corr = Number(pearsonCorrelation(xs, ys).toFixed(3));
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return {
    profiles,
    correlation: { tickers, matrix },
  };
}

export function analyzePortfolioRisk(
  dataset: ParsedDataset,
  profiles: SecurityRiskProfile[],
  rawWeights: Record<string, number>,
  riskFreeRate = 0.145
): PortfolioRiskAnalysis {
  // Normalize positive weights
  const activeTickers = profiles.map((p) => p.ticker);
  let sumW = 0;
  for (const t of activeTickers) {
    sumW += Math.max(0, rawWeights[t] ?? 0);
  }
  const weights: Record<string, number> = {};
  for (const t of activeTickers) {
    weights[t] = sumW > 0 ? Math.max(0, rawWeights[t] ?? 0) / sumW : 1 / activeTickers.length;
  }

  // Build aligned portfolio daily return series
  const dateSet = new Set<string>();
  const retLookup = new Map<string, Map<string, number>>();
  for (const sec of dataset.securities) {
    if (!weights[sec.ticker]) continue;
    const m = new Map<string, number>();
    const rets = simpleReturns(sec.bars.map((b) => b.close));
    for (let i = 1; i < sec.bars.length; i++) {
      dateSet.add(sec.bars[i].date);
      m.set(sec.bars[i].date, rets[i - 1]);
    }
    retLookup.set(sec.ticker, m);
  }

  const dates = Array.from(dateSet).sort();
  const portDailyRets: number[] = [];
  let equity = 100;
  let benchEquity = 100;
  const equitySeries: number[] = [];
  const chartEquitySeries: PortfolioRiskAnalysis['equitySeries'] = [];

  for (const d of dates) {
    let dayRet = 0;
    let wCovered = 0;
    let benchSum = 0;
    let benchCount = 0;
    for (const t of activeTickers) {
      const r = retLookup.get(t)?.get(d);
      if (r !== undefined) {
        benchSum += r;
        benchCount++;
        const w = weights[t];
        if (w > 0) {
          dayRet += w * r;
          wCovered += w;
        }
      }
    }
    const normalizedRet = wCovered > 0 ? dayRet / wCovered : 0;
    const benchRet = benchCount > 0 ? benchSum / benchCount : 0;
    portDailyRets.push(normalizedRet);
    equity *= 1 + normalizedRet;
    benchEquity *= 1 + benchRet;
    equitySeries.push(equity);
    chartEquitySeries.push({
      date: d,
      portfolio: Number(equity.toFixed(2)),
      benchmark: Number(benchEquity.toFixed(2)),
    });
  }

  const cumRet = equity / 100 - 1;
  const years = Math.max(1 / 252, portDailyRets.length / 252);
  const portfolioAnnReturn = cumRet > -1 ? Math.pow(1 + cumRet, 1 / years) - 1 : -1;
  const portfolioAnnVolatility = sampleStd(portDailyRets) * Math.sqrt(252);
  const portfolioSharpe =
    portfolioAnnVolatility > 0 ? (portfolioAnnReturn - riskFreeRate) / portfolioAnnVolatility : 0;
  const ddStats = computeDrawdowns(dates, equitySeries);

  const weightedIndivVol = profiles.reduce(
    (acc, p) => acc + (weights[p.ticker] ?? 0) * p.annualizedVolatility,
    0
  );
  const diversificationRatio =
    portfolioAnnVolatility > 0 ? weightedIndivVol / portfolioAnnVolatility : 1;

  const herfindahlIndex = activeTickers.reduce((acc, t) => acc + weights[t] * weights[t], 0);
  const concentrationLabel =
    herfindahlIndex > 0.25
      ? 'High Concentration'
      : herfindahlIndex > 0.14
        ? 'Moderate Concentration'
        : 'Diversified';

  // Stress testing scenarios
  const bankingWeight = profiles
    .filter((p) => p.sector.toLowerCase().includes('bank'))
    .reduce((acc, p) => acc + (weights[p.ticker] ?? 0), 0);

  const illiquidWeight = profiles
    .filter((p) => p.amihudIlliquidity > 0.05)
    .reduce((acc, p) => acc + (weights[p.ticker] ?? 0), 0);

  const stressTests: PortfolioRiskAnalysis['stressTests'] = [
    {
      scenario: 'Broad NSE Macro Tightening Shock',
      assumption: '-15.0% uniform equity market shock amplified by historical asset volatility ratio.',
      estimatedImpactPct: -0.15 * Math.min(1.35, Math.max(0.75, portfolioAnnVolatility / 0.2)),
      portfolioStressedReturn:
        portfolioAnnReturn - 0.15 * Math.min(1.35, Math.max(0.75, portfolioAnnVolatility / 0.2)),
      notes: 'Models sovereign yield repricing and foreign capital outflow pressure.',
    },
    {
      scenario: 'Banking Sector Credit Stress',
      assumption: `-25.0% sector shock to Banking counters (current portfolio Banking exposure: ${(bankingWeight * 100).toFixed(1)}%).`,
      estimatedImpactPct: -(bankingWeight * 0.25 + (1 - bankingWeight) * 0.06),
      portfolioStressedReturn:
        portfolioAnnReturn - (bankingWeight * 0.25 + (1 - bankingWeight) * 0.06),
      notes: 'Evaluates sector concentration risk under rising NPL provisions.',
    },
    {
      scenario: 'Liquidity Freeze & Wide Spread Impact',
      assumption: `50% turnover contraction; forced exit slippage on thin counters (${(illiquidWeight * 100).toFixed(1)}% weight).`,
      estimatedImpactPct: -(0.04 + illiquidWeight * 0.11),
      portfolioStressedReturn: portfolioAnnReturn - (0.04 + illiquidWeight * 0.11),
      notes: 'Captures execution slippage on low-turnover NSE securities during stress.',
    },
  ];

  return {
    weights,
    portfolioAnnReturn,
    portfolioAnnVolatility,
    portfolioSharpe,
    portfolioMaxDrawdown: ddStats.maxDrawdown,
    diversificationRatio,
    herfindahlIndex,
    concentrationLabel,
    equitySeries: chartEquitySeries,
    stressTests,
  };
}
