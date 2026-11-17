import {
  KMRIAnalysis,
  KMRIScore,
  KMRIWeights,
  MarketOverview,
  ParsedDataset,
  SecurityRiskProfile,
} from './types';
import {
  computeDrawdowns,
  mean,
  minMaxNormalize,
  spearmanRankCorrelation,
} from './mathUtils';

export const DEFAULT_KMRI_WEIGHTS: KMRIWeights = {
  performance: 0.2,
  resilience: 0.25,
  stability: 0.2,
  liquidity: 0.2,
  participation: 0.15,
};

function scoreWithWeights(
  baseRows: Array<{
    ticker: string;
    name: string;
    sector: string;
    perf: number;
    resil: number;
    stab: number;
    liq: number;
    part: number | null;
    stressRet: number;
    stressDd: number;
    recoveryDays: number | null;
    foreignRatio: number | null;
  }>,
  weights: KMRIWeights,
  participationAvailable: boolean
): KMRIScore[] {
  const effectiveW = participationAvailable
    ? weights
    : { ...weights, participation: 0 };
  const sumW =
    effectiveW.performance +
    effectiveW.resilience +
    effectiveW.stability +
    effectiveW.liquidity +
    effectiveW.participation;
  const w: KMRIWeights =
    sumW > 0
      ? {
          performance: effectiveW.performance / sumW,
          resilience: effectiveW.resilience / sumW,
          stability: effectiveW.stability / sumW,
          liquidity: effectiveW.liquidity / sumW,
          participation: effectiveW.participation / sumW,
        }
      : DEFAULT_KMRI_WEIGHTS;

  const scored = baseRows.map((r) => {
    const kmriScore = Number(
      (
        r.perf * w.performance +
        r.resil * w.resilience +
        r.stab * w.stability +
        r.liq * w.liquidity +
        (r.part ?? 0) * w.participation
      ).toFixed(1)
    );
    return {
      rank: 0,
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      kmriScore,
      dimensions: {
        performance: Number(r.perf.toFixed(1)),
        resilience: Number(r.resil.toFixed(1)),
        stability: Number(r.stab.toFixed(1)),
        liquidity: Number(r.liq.toFixed(1)),
        participation: r.part !== null ? Number(r.part.toFixed(1)) : null,
      },
      stressPeriodReturn: r.stressRet,
      stressPeriodMaxDrawdown: r.stressDd,
      recoveryDays: r.recoveryDays,
      foreignTurnoverRatio: r.foreignRatio,
    };
  });

  scored.sort((a, b) => b.kmriScore - a.kmriScore);
  scored.forEach((s, idx) => {
    s.rank = idx + 1;
  });
  return scored;
}

/**
 * Original Research Contribution: Kenyan Market Resilience Index (KMRI)
 * Experimental composite framework measuring Performance, Drawdown/Recovery Resilience,
 * Realized Stability, Liquidity, and Foreign Market Participation.
 */
export function computeKMRI(
  dataset: ParsedDataset,
  market: MarketOverview,
  riskProfiles: SecurityRiskProfile[],
  weights: KMRIWeights = DEFAULT_KMRI_WEIGHTS
): KMRIAnalysis {
  // Automatically isolate worst market drawdown window from Equal-Weight Index
  const idxSeries = market.indexSeries;
  const idxDd = computeDrawdowns(
    idxSeries.map((x) => x.date),
    idxSeries.map((x) => x.equalWeightIndex)
  );

  const stressStart = idxDd.maxDrawdownStart || idxSeries[0]?.date || '';
  const stressEnd = idxDd.maxDrawdownTrough || idxSeries[idxSeries.length - 1]?.date || '';

  const riskMap = new Map(riskProfiles.map((r) => [r.ticker, r]));
  const mktMap = new Map(market.securities.map((s) => [s.ticker, s]));

  const participationAvailable = market.securities.some(
    (s) => s.foreignParticipationRatio !== null
  );

  const activeSecs = dataset.securities.filter((sec) => riskMap.has(sec.ticker));

  const rawPerf = activeSecs.map((sec) => riskMap.get(sec.ticker)!.annualizedReturn);
  const rawMaxDd = activeSecs.map((sec) => Math.abs(riskMap.get(sec.ticker)!.maxDrawdown));
  const rawRecoveryPenalty = activeSecs.map((sec) => {
    const rec = riskMap.get(sec.ticker)!.recoveryDays;
    return rec === null ? 400 : rec;
  });
  const rawVol = activeSecs.map((sec) => riskMap.get(sec.ticker)!.annualizedVolatility);
  const rawLiq = activeSecs.map((sec) => {
    const avgTurn = mktMap.get(sec.ticker)?.avgTurnover20d ?? 1;
    const zeroPct = riskMap.get(sec.ticker)!.zeroVolumeDaysPct;
    return Math.log10(Math.max(1, avgTurn)) - zeroPct * 3;
  });

  const normPerf = minMaxNormalize(rawPerf, true);
  const normDd = minMaxNormalize(rawMaxDd, false);
  const normRec = minMaxNormalize(rawRecoveryPenalty, false);
  const normResil = normDd.map((d, i) => 0.65 * d + 0.35 * normRec[i]);
  const normStab = minMaxNormalize(rawVol, false);
  const normLiq = minMaxNormalize(rawLiq, true);

  let normPart: Array<number | null> = activeSecs.map(() => null);
  if (participationAvailable) {
    const rawPart = activeSecs.map(
      (sec) => mktMap.get(sec.ticker)?.foreignParticipationRatio ?? 0
    );
    normPart = minMaxNormalize(rawPart, true);
  }

  // Compute stress-window empirical behavior per security
  const baseRows = activeSecs.map((sec, i) => {
    const windowBars = sec.bars.filter((b) => b.date >= stressStart && b.date <= stressEnd);
    const stressRet =
      windowBars.length >= 2 && windowBars[0].close > 0
        ? windowBars[windowBars.length - 1].close / windowBars[0].close - 1
        : 0;
    const stressDdStats = computeDrawdowns(
      windowBars.map((b) => b.date),
      windowBars.map((b) => b.close)
    );
    const r = riskMap.get(sec.ticker)!;
    const m = mktMap.get(sec.ticker)!;

    return {
      ticker: sec.ticker,
      name: sec.name,
      sector: sec.sector,
      perf: normPerf[i],
      resil: normResil[i],
      stab: normStab[i],
      liq: normLiq[i],
      part: normPart[i],
      stressRet,
      stressDd: stressDdStats.maxDrawdown,
      recoveryDays: r.recoveryDays,
      foreignRatio: m.foreignParticipationRatio,
    };
  });

  const scores = scoreWithWeights(baseRows, weights, participationAvailable);

  // Compare Top Half vs Bottom Half KMRI during the isolated stress window
  const mid = Math.max(1, Math.floor(scores.length / 2));
  const topHalf = scores.slice(0, mid);
  const bottomHalf = scores.slice(mid);

  const topHalfAvgStressReturn = mean(topHalf.map((s) => s.stressPeriodReturn));
  const bottomHalfAvgStressReturn = mean(bottomHalf.map((s) => s.stressPeriodReturn));
  const topHalfAvgStressDrawdown = mean(topHalf.map((s) => s.stressPeriodMaxDrawdown));
  const bottomHalfAvgStressDrawdown = mean(bottomHalf.map((s) => s.stressPeriodMaxDrawdown));

  const outperformanceBps = (topHalfAvgStressReturn - bottomHalfAvgStressReturn) * 100;
  const findingSummary =
    outperformanceBps > 0
      ? `Top-half KMRI securities outperformed bottom-half peers by +${outperformanceBps.toFixed(1)} percentage points during the ${stressStart} to ${stressEnd} stress regime (note: full-sample overlap caveat applies; out-of-sample rolling validation required).`
      : `Top-half KMRI cohort trailed bottom-half peers by ${outperformanceBps.toFixed(1)} pp in the isolated stress window, demonstrating sensitivity to return momentum vs defensive beta.`;

  // Weight sensitivity analysis via Spearman Rank Correlation vs baseline
  const baselineRankMap = new Map(scores.map((s) => [s.ticker, s.rank]));
  const alternativeSchemes: Array<{ name: string; label: string; w: KMRIWeights }> = [
    {
      name: 'Equal-Weighted (20% Each)',
      label: '20 / 20 / 20 / 20 / 20',
      w: { performance: 0.2, resilience: 0.2, stability: 0.2, liquidity: 0.2, participation: 0.2 },
    },
    {
      name: 'Drawdown-First Defensive',
      label: '10 / 40 / 25 / 15 / 10',
      w: { performance: 0.1, resilience: 0.4, stability: 0.25, liquidity: 0.15, participation: 0.1 },
    },
    {
      name: 'Institutional Liquidity Focus',
      label: '15 / 20 / 15 / 35 / 15',
      w: { performance: 0.15, resilience: 0.2, stability: 0.15, liquidity: 0.35, participation: 0.15 },
    },
  ];

  const sensitivityAnalysis = alternativeSchemes.map((scheme) => {
    const altScores = scoreWithWeights(baseRows, scheme.w, participationAvailable);
    const altRankMap = new Map(altScores.map((s) => [s.ticker, s.rank]));
    const tickers = scores.map((s) => s.ticker);
    const baseRanks = tickers.map((t) => baselineRankMap.get(t)!);
    const altRanks = tickers.map((t) => altRankMap.get(t)!);
    const rho = Number(spearmanRankCorrelation(baseRanks, altRanks).toFixed(3));
    const maxShift = Math.max(
      ...tickers.map((t) => Math.abs((baselineRankMap.get(t) ?? 0) - (altRankMap.get(t) ?? 0)))
    );

    return {
      schemeName: scheme.name,
      weightsLabel: scheme.label,
      spearmanRhoVsBaseline: rho,
      topThreeTickers: altScores.slice(0, 3).map((s) => s.ticker),
      maxRankShift: maxShift,
    };
  });

  return {
    weights,
    participationAvailable,
    stressWindow: {
      startDate: stressStart,
      endDate: stressEnd,
      marketDropPct: idxDd.maxDrawdown,
      description: `Worst peak-to-trough market composite drawdown (${(idxDd.maxDrawdown * 100).toFixed(1)}%) detected in dataset.`,
    },
    scores,
    stressCohortComparison: {
      topHalfAvgStressReturn,
      bottomHalfAvgStressReturn,
      topHalfAvgStressDrawdown,
      bottomHalfAvgStressDrawdown,
      findingSummary,
    },
    sensitivityAnalysis,
  };
}
