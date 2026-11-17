import {
  FundamentalProfile,
  MarketOverview,
  OpportunityScore,
  OpportunityWeights,
  SecurityRiskProfile,
} from './types';
import { minMaxNormalize } from './mathUtils';

export const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityWeights = {
  momentum: 0.2,
  fundamentals: 0.25,
  valuation: 0.2,
  risk: 0.2,
  liquidity: 0.15,
};

export function computeOpportunityRadar(
  market: MarketOverview,
  fundamentals: FundamentalProfile[],
  riskProfiles: SecurityRiskProfile[],
  rawWeights: OpportunityWeights = DEFAULT_OPPORTUNITY_WEIGHTS
): OpportunityScore[] {
  const sumW =
    rawWeights.momentum +
    rawWeights.fundamentals +
    rawWeights.valuation +
    rawWeights.risk +
    rawWeights.liquidity;
  const w: OpportunityWeights =
    sumW > 0
      ? {
          momentum: rawWeights.momentum / sumW,
          fundamentals: rawWeights.fundamentals / sumW,
          valuation: rawWeights.valuation / sumW,
          risk: rawWeights.risk / sumW,
          liquidity: rawWeights.liquidity / sumW,
        }
      : DEFAULT_OPPORTUNITY_WEIGHTS;

  const tickers = market.securities.map((s) => s.ticker);
  const fundMap = new Map(fundamentals.map((f) => [f.ticker, f]));
  const riskMap = new Map(riskProfiles.map((r) => [r.ticker, r]));

  // 1. Momentum raw metric: blended 20D (40%) + 60D (60%) return
  const rawMomentum = market.securities.map((s) => 0.4 * s.return20d + 0.6 * s.return60d);
  const normMomentum = minMaxNormalize(rawMomentum, true);

  // 2. Risk raw metric: combined normalized inverse Volatility + inverse Max Drawdown severity
  const rawVol = market.securities.map((s) => riskMap.get(s.ticker)?.annualizedVolatility ?? 0.3);
  const rawDd = market.securities.map((s) => Math.abs(riskMap.get(s.ticker)?.maxDrawdown ?? 0.25));
  const normVol = minMaxNormalize(rawVol, false);
  const normDd = minMaxNormalize(rawDd, false);
  const normRisk = normVol.map((v, i) => 0.5 * v + 0.5 * normDd[i]);

  // 3. Liquidity raw metric: log10(avgTurnover20d) minus zero-volume penalty
  const rawLiq = market.securities.map((s) => {
    const zeroPct = riskMap.get(s.ticker)?.zeroVolumeDaysPct ?? 0;
    return Math.log10(Math.max(1, s.avgTurnover20d)) - zeroPct * 2;
  });
  const normLiquidity = minMaxNormalize(rawLiq, true);

  const items: OpportunityScore[] = tickers.map((ticker, i) => {
    const mkt = market.securities[i];
    const fund = fundMap.get(ticker);
    const risk = riskMap.get(ticker);

    const missingDataPoints: string[] = [...(fund?.missingFields ?? ['All Fundamental Filings'])];
    if (mkt.foreignParticipationRatio === null) {
      missingDataPoints.push('Foreign Investor Turnover');
    }

    // Use verified fundamental/valuation score if present; otherwise neutral 50 with explicit uncertainty penalty
    const fundScore = fund?.fundamentalHealthScore ?? 50;
    const valScore = fund?.valuationScore ?? 50;
    const momScore = Number(normMomentum[i].toFixed(1));
    const riskScore = Number(normRisk[i].toFixed(1));
    const liqScore = Number(normLiquidity[i].toFixed(1));

    const contributions = {
      momentum: Number((momScore * w.momentum).toFixed(2)),
      fundamentals: Number((fundScore * w.fundamentals).toFixed(2)),
      valuation: Number((valScore * w.valuation).toFixed(2)),
      risk: Number((riskScore * w.risk).toFixed(2)),
      liquidity: Number((liqScore * w.liquidity).toFixed(2)),
    };

    const compositeScore = Number(
      (
        contributions.momentum +
        contributions.fundamentals +
        contributions.valuation +
        contributions.risk +
        contributions.liquidity
      ).toFixed(1)
    );

    // Explainable narrative generation strictly grounded in calculated values
    const supportingEvidence: string[] = [];
    const weakeningFactors: string[] = [];
    const keyRisks: string[] = [];
    const invalidationCriteria: string[] = [];

    if (momScore >= 65) {
      supportingEvidence.push(
        `Positive relative trend: 60D return ${(mkt.return60d * 100).toFixed(1)}% and 20D return ${(mkt.return20d * 100).toFixed(1)}%.`
      );
    } else if (momScore < 40) {
      weakeningFactors.push(
        `Negative or lagging momentum: 60D return ${(mkt.return60d * 100).toFixed(1)}%.`
      );
    }

    if (fund?.fundamentalHealthScore !== null && fund?.fundamentalHealthScore !== undefined) {
      if (fund.fundamentalHealthScore >= 65) {
        supportingEvidence.push(
          `Solid fundamental health (${fund.fundamentalHealthScore}/100): ROE ${fund.metrics.roe !== null ? (fund.metrics.roe * 100).toFixed(1) + '%' : 'N/A'}, Net Margin ${fund.metrics.netMargin !== null ? (fund.metrics.netMargin * 100).toFixed(1) + '%' : 'N/A'}.`
        );
      } else if (fund.fundamentalHealthScore < 45) {
        weakeningFactors.push(
          `Subdued fundamental health (${fund.fundamentalHealthScore}/100); review profitability and leverage.`
        );
      }
    } else {
      weakeningFactors.push('Fundamental health score unavailable; neutral placeholder (50) applied.');
    }

    if (fund?.valuationScore !== null && fund?.valuationScore !== undefined && fund.valuationScore >= 65) {
      supportingEvidence.push(
        `Attractive relative valuation (${fund.valuationScore}/100): P/E ${fund.metrics.peRatio ?? 'N/A'}x, P/B ${fund.metrics.pbRatio ?? 'N/A'}x.`
      );
    } else if (fund?.valuationScore !== null && fund?.valuationScore !== undefined && fund.valuationScore < 40) {
      weakeningFactors.push(
        `Demanding valuation multiples relative to NSE peer set (P/E ${fund.metrics.peRatio ?? 'N/A'}x).`
      );
    }

    if (liqScore >= 65) {
      supportingEvidence.push(
        `Deep market liquidity: 20D average turnover KES ${(mkt.avgTurnover20d / 1e6).toFixed(2)}M.`
      );
    } else if (liqScore < 35) {
      weakeningFactors.push(
        `Thin daily liquidity: 20D average turnover KES ${(mkt.avgTurnover20d / 1e6).toFixed(2)}M.`
      );
      keyRisks.push('Execution slippage and wide bid-ask spreads when entering or exiting size.');
    }

    if (risk) {
      if (risk.maxDrawdown < -0.25) {
        keyRisks.push(
          `Severe historical peak-to-trough drawdown of ${(risk.maxDrawdown * 100).toFixed(1)}% (${risk.maxDrawdownDurationDays} trading days).`
        );
      }
      if (risk.annualizedVolatility > 0.28) {
        keyRisks.push(
          `Elevated annualized volatility of ${(risk.annualizedVolatility * 100).toFixed(1)}%.`
        );
      }
      if (risk.sharpeRatio < 0) {
        keyRisks.push(
          `Negative Sharpe ratio (${risk.sharpeRatio.toFixed(2)}) relative to disclosed 14.5% risk-free benchmark.`
        );
      }
    }

    if (keyRisks.length === 0) {
      keyRisks.push(
        `Standard equity market risk (${risk ? (risk.annualizedVolatility * 100).toFixed(1) : 'N/A'}% annualized vol) and macro currency/rate sensitivity.`
      );
    }

    invalidationCriteria.push(
      `Sustained close below 50-day SMA${mkt.sma50 ? ` (KES ${mkt.sma50.toFixed(2)})` : ''} accompanied by declining turnover.`
    );
    invalidationCriteria.push(
      `Max drawdown breach beyond ${risk ? (Math.abs(risk.maxDrawdown) * 120).toFixed(0) : 25}% or material deterioration in earnings margin.`
    );

    const completeness = fund?.completenessRatio ?? 0;
    const uncertaintyLevel: OpportunityScore['uncertaintyLevel'] =
      completeness < 0.65 || (risk?.observationCount ?? 0) < 120
        ? 'High'
        : completeness < 0.9 || (risk?.annualizedVolatility ?? 0) > 0.3
          ? 'Moderate'
          : 'Low';

    return {
      rank: 0,
      ticker,
      name: mkt.name,
      sector: mkt.sector,
      compositeScore,
      dimensionScores: {
        momentum: momScore,
        fundamentals: fundScore,
        valuation: valScore,
        risk: riskScore,
        liquidity: liqScore,
      },
      dimensionContributions: contributions,
      uncertaintyLevel,
      missingDataPoints,
      supportingEvidence:
        supportingEvidence.length > 0
          ? supportingEvidence
          : ['Balanced mid-pack positioning across available metrics without extreme outliers.'],
      weakeningFactors:
        weakeningFactors.length > 0
          ? weakeningFactors
          : ['No severe quantitative drag detected relative to peer universe.'],
      keyRisks,
      invalidationCriteria,
    };
  });

  items.sort((a, b) => b.compositeScore - a.compositeScore);
  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return items;
}
