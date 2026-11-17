import { FundamentalProfile, ParsedDataset } from './types';
import { mean } from './mathUtils';

export function computeFundamentalIntelligence(dataset: ParsedDataset): FundamentalProfile[] {
  const metricLabels: Array<{ key: keyof FundamentalProfile['metrics']; label: string }> = [
    { key: 'marketCapKes', label: 'Market Capitalization' },
    { key: 'revenueGrowthYoY', label: 'Revenue Growth (YoY)' },
    { key: 'netMargin', label: 'Net Profit Margin' },
    { key: 'roe', label: 'Return on Equity (ROE)' },
    { key: 'debtToEquity', label: 'Debt-to-Equity' },
    { key: 'peRatio', label: 'P/E Ratio' },
    { key: 'pbRatio', label: 'P/B Ratio' },
    { key: 'dividendYield', label: 'Dividend Yield' },
    { key: 'fcfConversion', label: 'FCF Conversion' },
  ];

  // Collect cross-sectional arrays for relative valuation & health scoring where available
  const allHealthInputs = dataset.securities.map((sec) => sec.fundamentals);

  return dataset.securities.map((sec) => {
    const f = sec.fundamentals;
    if (!f) {
      return {
        ticker: sec.ticker,
        name: sec.name,
        sector: sec.sector,
        classification: 'UNAVAILABLE DATA',
        reportingPeriod: 'Unavailable',
        completenessRatio: 0,
        missingFields: metricLabels.map((m) => m.label),
        metrics: {
          marketCapKes: null,
          revenueGrowthYoY: null,
          netMargin: null,
          roe: null,
          debtToEquity: null,
          peRatio: null,
          pbRatio: null,
          dividendYield: null,
          fcfConversion: null,
        },
        fundamentalHealthScore: null,
        valuationScore: null,
        healthAssessment:
          'Fundamental filings unavailable in current dataset. Fundamental and relative valuation dimensions cannot be verified.',
      };
    }

    const metrics: FundamentalProfile['metrics'] = {
      marketCapKes: f.marketCapKes,
      revenueGrowthYoY: f.revenueGrowthYoY,
      netMargin: f.netMargin,
      roe: f.roe,
      debtToEquity: f.debtToEquity,
      peRatio: f.peRatio,
      pbRatio: f.pbRatio,
      dividendYield: f.dividendYield,
      fcfConversion: f.fcfConversion,
    };

    const missingFields: string[] = [];
    for (const item of metricLabels) {
      if (metrics[item.key] === null) {
        missingFields.push(item.label);
      }
    }

    const completenessRatio =
      (metricLabels.length - missingFields.length) / metricLabels.length;

    // Score Fundamental Health only from actually present fields
    const healthComponents: number[] = [];
    if (metrics.revenueGrowthYoY !== null) {
      // -5% to +25% mapped to 0..100
      healthComponents.push(Math.max(0, Math.min(100, ((metrics.revenueGrowthYoY + 0.05) / 0.3) * 100)));
    }
    if (metrics.netMargin !== null) {
      healthComponents.push(Math.max(0, Math.min(100, (metrics.netMargin / 0.3) * 100)));
    }
    if (metrics.roe !== null) {
      healthComponents.push(Math.max(0, Math.min(100, (metrics.roe / 0.32) * 100)));
    }
    if (metrics.debtToEquity !== null) {
      // Lower leverage generally safer (capped 0..2.5)
      healthComponents.push(Math.max(0, Math.min(100, (1 - metrics.debtToEquity / 2.5) * 100)));
    }
    if (metrics.fcfConversion !== null) {
      healthComponents.push(Math.max(0, Math.min(100, metrics.fcfConversion * 100)));
    }

    // Score Relative Valuation from present valuation multiples (lower P/E, lower P/B, higher Div Yield)
    const valComponents: number[] = [];
    const peerPes = allHealthInputs
      .map((x) => x?.peRatio)
      .filter((v): v is number => v !== null && v !== undefined && v > 0);
    const peerPbs = allHealthInputs
      .map((x) => x?.pbRatio)
      .filter((v): v is number => v !== null && v !== undefined && v > 0);

    if (metrics.peRatio !== null && metrics.peRatio > 0 && peerPes.length > 0) {
      const maxPe = Math.max(...peerPes, 15);
      valComponents.push(Math.max(0, Math.min(100, (1 - (metrics.peRatio - 2) / maxPe) * 100)));
    }
    if (metrics.pbRatio !== null && metrics.pbRatio > 0 && peerPbs.length > 0) {
      const maxPb = Math.max(...peerPbs, 4);
      valComponents.push(Math.max(0, Math.min(100, (1 - metrics.pbRatio / maxPb) * 100)));
    }
    if (metrics.dividendYield !== null) {
      valComponents.push(Math.max(0, Math.min(100, (metrics.dividendYield / 0.12) * 100)));
    }

    const fundamentalHealthScore =
      healthComponents.length >= 2 ? Number(mean(healthComponents).toFixed(1)) : null;
    const valuationScore =
      valComponents.length >= 1 ? Number(mean(valComponents).toFixed(1)) : null;

    let healthAssessment = '';
    if (fundamentalHealthScore === null) {
      healthAssessment = 'Insufficient verified financial statement fields to compute health score.';
    } else if (fundamentalHealthScore >= 70) {
      healthAssessment = 'Strong profitability and growth indicators relative to universe benchmarks.';
    } else if (fundamentalHealthScore >= 45) {
      healthAssessment = 'Moderate operational health; monitor margin stability and leverage.';
    } else {
      healthAssessment = 'Constrained fundamental health driven by weak margins, low ROE, or elevated leverage.';
    }

    if (missingFields.length > 0) {
      healthAssessment += ` Missing ${missingFields.length} field(s): ${missingFields.join(', ')}.`;
    }

    return {
      ticker: sec.ticker,
      name: sec.name,
      sector: sec.sector,
      classification: f.classification,
      reportingPeriod: f.reportingPeriod,
      completenessRatio,
      missingFields,
      metrics,
      fundamentalHealthScore,
      valuationScore,
      healthAssessment,
    };
  });
}
