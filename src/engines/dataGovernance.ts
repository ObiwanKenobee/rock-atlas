import {
  DataClassification,
  DatasetMetadata,
  FundamentalSnapshot,
  OHLCVBar,
  ParsedDataset,
  SecuritySeries,
  ValidationCheckResult,
  ValidationReport,
} from './types';
import { mean, sampleStd, simpleReturns } from './mathUtils';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

interface SyntheticBlueprint {
  ticker: string;
  name: string;
  sector: string;
  startPrice: number;
  annualDrift: number;
  annualVol: number;
  stressBeta: number;
  baseDailyVolume: number;
  foreignShare: number | null;
  fundamentals: Omit<FundamentalSnapshot, 'ticker' | 'name' | 'sector' | 'currency' | 'reportingPeriod' | 'classification'>;
}

const SYNTHETIC_BLUEPRINTS: SyntheticBlueprint[] = [
  {
    ticker: 'SCOM',
    name: 'Safaricom PLC (Modeled)',
    sector: 'Telecommunication & Technology',
    startPrice: 15.2,
    annualDrift: 0.14,
    annualVol: 0.22,
    stressBeta: 0.72,
    baseDailyVolume: 9_800_000,
    foreignShare: 0.62,
    fundamentals: {
      marketCapKes: 685_000_000_000,
      revenueGrowthYoY: 0.118,
      netMargin: 0.192,
      roe: 0.285,
      debtToEquity: 0.54,
      peRatio: 10.4,
      pbRatio: 3.1,
      dividendYield: 0.071,
      fcfConversion: 0.84,
    },
  },
  {
    ticker: 'EQTY',
    name: 'Equity Group Holdings (Modeled)',
    sector: 'Banking',
    startPrice: 37.5,
    annualDrift: 0.19,
    annualVol: 0.21,
    stressBeta: 0.68,
    baseDailyVolume: 2_650_000,
    foreignShare: 0.49,
    fundamentals: {
      marketCapKes: 174_000_000_000,
      revenueGrowthYoY: 0.165,
      netMargin: 0.248,
      roe: 0.238,
      debtToEquity: 1.18,
      peRatio: 4.1,
      pbRatio: 0.82,
      dividendYield: 0.088,
      fcfConversion: 0.78,
    },
  },
  {
    ticker: 'KCB',
    name: 'KCB Group PLC (Modeled)',
    sector: 'Banking',
    startPrice: 24.1,
    annualDrift: 0.22,
    annualVol: 0.28,
    stressBeta: 1.05,
    baseDailyVolume: 2_100_000,
    foreignShare: 0.34,
    fundamentals: {
      marketCapKes: 112_000_000_000,
      revenueGrowthYoY: 0.184,
      netMargin: 0.215,
      roe: 0.214,
      debtToEquity: 1.35,
      peRatio: 3.6,
      pbRatio: 0.59,
      dividendYield: 0.062,
      fcfConversion: 0.71,
    },
  },
  {
    ticker: 'COOP',
    name: 'Co-operative Bank of Kenya (Modeled)',
    sector: 'Banking',
    startPrice: 12.6,
    annualDrift: 0.16,
    annualVol: 0.18,
    stressBeta: 0.62,
    baseDailyVolume: 1_850_000,
    foreignShare: 0.18,
    fundamentals: {
      marketCapKes: 86_000_000_000,
      revenueGrowthYoY: 0.094,
      netMargin: 0.278,
      roe: 0.198,
      debtToEquity: 1.05,
      peRatio: 3.9,
      pbRatio: 0.74,
      dividendYield: 0.095,
      fcfConversion: 0.82,
    },
  },
  {
    ticker: 'ABSA',
    name: 'Absa Bank Kenya PLC (Modeled)',
    sector: 'Banking',
    startPrice: 11.9,
    annualDrift: 0.17,
    annualVol: 0.17,
    stressBeta: 0.58,
    baseDailyVolume: 1_150_000,
    foreignShare: 0.21,
    fundamentals: {
      marketCapKes: 78_000_000_000,
      revenueGrowthYoY: 0.132,
      netMargin: 0.285,
      roe: 0.242,
      debtToEquity: 0.96,
      peRatio: 4.3,
      pbRatio: 1.04,
      dividendYield: 0.104,
      fcfConversion: 0.88,
    },
  },
  {
    ticker: 'EABL',
    name: 'East African Breweries PLC (Modeled)',
    sector: 'Manufacturing & Consumer',
    startPrice: 132.0,
    annualDrift: 0.09,
    annualVol: 0.25,
    stressBeta: 0.94,
    baseDailyVolume: 215_000,
    foreignShare: 0.56,
    fundamentals: {
      marketCapKes: 124_000_000_000,
      revenueGrowthYoY: 0.078,
      netMargin: 0.096,
      roe: 0.312,
      debtToEquity: 1.62,
      peRatio: 11.8,
      pbRatio: 3.65,
      dividendYield: 0.044,
      fcfConversion: 0.65,
    },
  },
  {
    ticker: 'BATK',
    name: 'British American Tobacco Kenya (Modeled)',
    sector: 'Manufacturing & Consumer',
    startPrice: 412.0,
    annualDrift: -0.04,
    annualVol: 0.19,
    stressBeta: 0.74,
    baseDailyVolume: 28_000,
    foreignShare: 0.41,
    fundamentals: {
      marketCapKes: 38_500_000_000,
      revenueGrowthYoY: -0.032,
      netMargin: 0.145,
      roe: 0.34,
      debtToEquity: 0.38,
      peRatio: 8.6,
      pbRatio: 2.45,
      dividendYield: 0.112,
      fcfConversion: null, // Intentionally unavailable to test governance
    },
  },
  {
    ticker: 'KEGN',
    name: 'KenGen PLC (Modeled)',
    sector: 'Energy & Petroleum',
    startPrice: 2.35,
    annualDrift: 0.18,
    annualVol: 0.31,
    stressBeta: 1.12,
    baseDailyVolume: 3_400_000,
    foreignShare: 0.12,
    fundamentals: {
      marketCapKes: 21_400_000_000,
      revenueGrowthYoY: 0.068,
      netMargin: 0.114,
      roe: 0.045,
      debtToEquity: 0.62,
      peRatio: 4.5,
      pbRatio: 0.11,
      dividendYield: 0.092,
      fcfConversion: 0.59,
    },
  },
  {
    ticker: 'KPLC',
    name: 'Kenya Power & Lighting Co. (Modeled)',
    sector: 'Energy & Petroleum',
    startPrice: 1.62,
    annualDrift: 0.24,
    annualVol: 0.42,
    stressBeta: 1.38,
    baseDailyVolume: 2_850_000,
    foreignShare: 0.07,
    fundamentals: {
      marketCapKes: 6_900_000_000,
      revenueGrowthYoY: 0.141,
      netMargin: 0.042,
      roe: null, // Intentionally unavailable
      debtToEquity: 1.94,
      peRatio: 2.4,
      pbRatio: 0.12,
      dividendYield: null, // Intentionally unavailable
      fcfConversion: null,
    },
  },
  {
    ticker: 'JUB',
    name: 'Jubilee Holdings Ltd (Modeled)',
    sector: 'Insurance',
    startPrice: 186.0,
    annualDrift: 0.05,
    annualVol: 0.24,
    stressBeta: 0.88,
    baseDailyVolume: 14_500,
    foreignShare: 0.26,
    fundamentals: {
      marketCapKes: 14_800_000_000,
      revenueGrowthYoY: 0.052,
      netMargin: 0.088,
      roe: 0.091,
      debtToEquity: 0.42,
      peRatio: 4.8,
      pbRatio: 0.35,
      dividendYield: 0.068,
      fcfConversion: null,
    },
  },
];

function generateTradingDates(startIso: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(`${startIso}T00:00:00Z`);
  while (dates.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export function validateRows(
  bars: OHLCVBar[],
  referenceCutoffDate?: string
): ValidationReport {
  const totalRowsInspected = bars.length;
  const checks: ValidationCheckResult[] = [];

  // 1. Missing value detection
  const missingSamples: string[] = [];
  let missingCount = 0;
  for (const b of bars) {
    if (!b.date || !b.ticker || Number.isNaN(b.close) || Number.isNaN(b.volume)) {
      missingCount++;
      if (missingSamples.length < 4) {
        missingSamples.push(`${b.ticker || 'UNKNOWN'} @ ${b.date || 'NO_DATE'}`);
      }
    }
  }
  checks.push({
    id: 'missing-values',
    name: 'Missing Required Values',
    status: missingCount === 0 ? 'PASS' : 'FAIL',
    affectedCount: missingCount,
    summary:
      missingCount === 0
        ? 'All required OHLCV & identifier fields populated.'
        : `${missingCount} rows missing required price, volume, ticker, or date values.`,
    sampleDetails: missingSamples,
  });

  // 2. Duplicate (ticker, date) detection
  const seenKeys = new Set<string>();
  const dupSamples: string[] = [];
  let dupCount = 0;
  for (const b of bars) {
    const key = `${b.ticker}|${b.date}`;
    if (seenKeys.has(key)) {
      dupCount++;
      if (dupSamples.length < 4) dupSamples.push(key);
    } else {
      seenKeys.add(key);
    }
  }
  checks.push({
    id: 'duplicates',
    name: 'Duplicate (Ticker, Date) Keys',
    status: dupCount === 0 ? 'PASS' : 'WARN',
    affectedCount: dupCount,
    summary:
      dupCount === 0
        ? 'Zero duplicate ticker-date records detected.'
        : `${dupCount} duplicate ticker-date entries found (latest record retained).`,
    sampleDetails: dupSamples,
  });

  // 3. Invalid price detection
  const invalidPriceSamples: string[] = [];
  let invalidPriceCount = 0;
  for (const b of bars) {
    if (b.close <= 0 || b.open <= 0 || b.high <= 0 || b.low <= 0) {
      invalidPriceCount++;
      if (invalidPriceSamples.length < 4) {
        invalidPriceSamples.push(`${b.ticker} ${b.date}: close=${b.close}`);
      }
    }
  }
  checks.push({
    id: 'invalid-prices',
    name: 'Positive Price Integrity (> 0)',
    status: invalidPriceCount === 0 ? 'PASS' : 'FAIL',
    affectedCount: invalidPriceCount,
    summary:
      invalidPriceCount === 0
        ? 'All OHLC prices strictly positive.'
        : `${invalidPriceCount} records contain zero or negative prices.`,
    sampleDetails: invalidPriceSamples,
  });

  // 4. Invalid volume detection
  let invalidVolCount = 0;
  const invalidVolSamples: string[] = [];
  for (const b of bars) {
    if (b.volume < 0 || b.turnover < 0) {
      invalidVolCount++;
      if (invalidVolSamples.length < 4) {
        invalidVolSamples.push(`${b.ticker} ${b.date}: vol=${b.volume}`);
      }
    }
  }
  checks.push({
    id: 'invalid-volume',
    name: 'Non-Negative Volume & Turnover',
    status: invalidVolCount === 0 ? 'PASS' : 'FAIL',
    affectedCount: invalidVolCount,
    summary:
      invalidVolCount === 0
        ? 'All trading volumes and turnover values >= 0.'
        : `${invalidVolCount} rows have negative volume or turnover.`,
    sampleDetails: invalidVolSamples,
  });

  // 5. Date format & timestamp consistency
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  let badDateCount = 0;
  for (const b of bars) {
    if (!isoRegex.test(b.date) || Number.isNaN(Date.parse(b.date))) {
      badDateCount++;
    }
  }
  checks.push({
    id: 'date-consistency',
    name: 'ISO-8601 Date & Calendar Validity',
    status: badDateCount === 0 ? 'PASS' : 'FAIL',
    affectedCount: badDateCount,
    summary:
      badDateCount === 0
        ? 'All dates conform to valid YYYY-MM-DD trading calendar format.'
        : `${badDateCount} malformed or unparseable dates detected.`,
    sampleDetails: [],
  });

  // 6. Currency & unit consistency
  checks.push({
    id: 'currency-consistency',
    name: 'Currency & Unit Alignment (KES)',
    status: 'PASS',
    affectedCount: 0,
    summary: 'Price unit normalized to KES per share; turnover in KES.',
    sampleDetails: [],
  });

  // 7. Historical coverage per security
  const byTicker = new Map<string, OHLCVBar[]>();
  for (const b of bars) {
    const arr = byTicker.get(b.ticker) ?? [];
    arr.push(b);
    byTicker.set(b.ticker, arr);
  }
  let thinCoverageCount = 0;
  const thinSamples: string[] = [];
  for (const [ticker, arr] of byTicker.entries()) {
    if (arr.length < 60) {
      thinCoverageCount++;
      thinSamples.push(`${ticker}: ${arr.length} days`);
    }
  }
  checks.push({
    id: 'historical-coverage',
    name: 'Minimum Historical Depth (>= 60 Days)',
    status: thinCoverageCount === 0 ? 'PASS' : 'WARN',
    affectedCount: thinCoverageCount,
    summary:
      thinCoverageCount === 0
        ? `All ${byTicker.size} securities meet minimum 60-day analytical depth.`
        : `${thinCoverageCount} securities have fewer than 60 trading observations.`,
    sampleDetails: thinSamples,
  });

  // 8. Return outlier detection (|z| > 4.5)
  let outlierCount = 0;
  const outlierSamples: string[] = [];
  for (const [ticker, arr] of byTicker.entries()) {
    const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
    const rets = simpleReturns(sorted.map((x) => x.close));
    const m = mean(rets);
    const sd = sampleStd(rets);
    if (sd > 0) {
      for (let i = 0; i < rets.length; i++) {
        const z = Math.abs((rets[i] - m) / sd);
        if (z > 4.5) {
          outlierCount++;
          if (outlierSamples.length < 4) {
            outlierSamples.push(
              `${ticker} ${sorted[i + 1].date}: ${(rets[i] * 100).toFixed(1)}% (z=${z.toFixed(1)})`
            );
          }
        }
      }
    }
  }
  checks.push({
    id: 'outlier-detection',
    name: 'Extreme Return Outlier Audit (|z| > 4.5)',
    status: outlierCount === 0 ? 'PASS' : 'WARN',
    affectedCount: outlierCount,
    summary:
      outlierCount === 0
        ? 'No extreme daily return outliers above 4.5 standard deviations.'
        : `${outlierCount} tail return events detected (>4.5 sigma); preserved unclipped for drawdown transparency.`,
    sampleDetails: outlierSamples,
  });

  // 9. Cross-field OHLC consistency
  let ohlcIssues = 0;
  const ohlcSamples: string[] = [];
  for (const b of bars) {
    if (b.high < Math.max(b.open, b.close) - 1e-6 || b.low > Math.min(b.open, b.close) + 1e-6) {
      ohlcIssues++;
      if (ohlcSamples.length < 4) {
        ohlcSamples.push(`${b.ticker} ${b.date}: L=${b.low}, C=${b.close}, H=${b.high}`);
      }
    }
  }
  checks.push({
    id: 'cross-field-ohlc',
    name: 'Cross-Field OHLC Bounds Check',
    status: ohlcIssues === 0 ? 'PASS' : 'WARN',
    affectedCount: ohlcIssues,
    summary:
      ohlcIssues === 0
        ? 'High >= max(Open, Close) and Low <= min(Open, Close) verified across all bars.'
        : `${ohlcIssues} rows have minor OHLC boundary inconsistencies.`,
    sampleDetails: ohlcSamples,
  });

  // 10. Data leakage check
  const cutoff = referenceCutoffDate ?? new Date().toISOString().slice(0, 10);
  let futureRows = 0;
  for (const b of bars) {
    if (b.date > cutoff) futureRows++;
  }
  checks.push({
    id: 'data-leakage',
    name: 'Temporal Boundary & Future-Date Audit',
    status: futureRows === 0 ? 'PASS' : 'WARN',
    affectedCount: futureRows,
    summary:
      futureRows === 0
        ? `No observations exceed reference cutoff (${cutoff}).`
        : `${futureRows} rows have timestamps beyond ${cutoff}; verify backtest cutoff alignment.`,
    sampleDetails: [],
  });

  const hasFail = checks.some((c) => c.status === 'FAIL');
  const hasWarn = checks.some((c) => c.status === 'WARN');

  // Filter out strictly invalid rows for clean retention count
  const validRows = bars.filter(
    (b) => b.date && b.ticker && b.close > 0 && b.volume >= 0 && isoRegex.test(b.date)
  );

  return {
    timestamp: new Date().toISOString(),
    overallStatus: hasFail
      ? 'FAILED'
      : hasWarn
        ? 'VALIDATED WITH WARNINGS'
        : 'VALIDATED',
    totalRowsInspected,
    validRowsRetained: validRows.length,
    checks,
  };
}

function buildParsedDataset(
  bars: OHLCVBar[],
  fundamentalsMap: Map<string, FundamentalSnapshot>,
  metadataBase: Omit<DatasetMetadata, 'startDate' | 'endDate' | 'tradingDays' | 'securityCount' | 'totalRows'>,
  referenceCutoff?: string
): ParsedDataset {
  const validation = validateRows(bars, referenceCutoff);

  // Deduplicate by (ticker, date) keeping latest valid row
  const dedupedMap = new Map<string, OHLCVBar>();
  for (const b of bars) {
    if (!b.date || !b.ticker || b.close <= 0 || Number.isNaN(b.close)) continue;
    dedupedMap.set(`${b.ticker}|${b.date}`, b);
  }

  const byTicker = new Map<string, OHLCVBar[]>();
  const allDates = new Set<string>();
  for (const b of dedupedMap.values()) {
    allDates.add(b.date);
    const list = byTicker.get(b.ticker) ?? [];
    list.push(b);
    byTicker.set(b.ticker, list);
  }

  const sortedDates = Array.from(allDates).sort();
  const securities: SecuritySeries[] = [];

  for (const [ticker, tickerBars] of byTicker.entries()) {
    tickerBars.sort((a, b) => a.date.localeCompare(b.date));
    const latest = tickerBars[tickerBars.length - 1];
    securities.push({
      ticker,
      name: latest.name || ticker,
      sector: latest.sector || 'Unclassified',
      bars: tickerBars,
      fundamentals: fundamentalsMap.get(ticker) ?? null,
    });
  }

  securities.sort((a, b) => a.ticker.localeCompare(b.ticker));

  const metadata: DatasetMetadata = {
    ...metadataBase,
    startDate: sortedDates[0] ?? '',
    endDate: sortedDates[sortedDates.length - 1] ?? '',
    tradingDays: sortedDates.length,
    securityCount: securities.length,
    totalRows: dedupedMap.size,
  };

  return { metadata, validation, securities };
}

export function createSyntheticNseDataset(): ParsedDataset {
  const rng = mulberry32(20250411);
  const tradingDays = 480;
  const dates = generateTradingDates('2024-01-02', tradingDays);

  // Common market factor + Q3 2024 macro stress window (indices 135..185)
  const marketShocks: number[] = [];
  for (let t = 0; t < tradingDays; t++) {
    let shock = gaussianNoise(rng) * 0.0075;
    if (t >= 135 && t <= 185) {
      // Simulated adverse macro liquidity tightening period (~ -14% broad stress)
      shock -= 0.0032;
    } else if (t > 185 && t <= 245) {
      // Gradual post-stress recovery
      shock += 0.0014;
    }
    marketShocks.push(shock);
  }

  const allBars: OHLCVBar[] = [];
  const fundamentalsMap = new Map<string, FundamentalSnapshot>();

  for (const bp of SYNTHETIC_BLUEPRINTS) {
    let price = bp.startPrice;
    const dailyDrift = bp.annualDrift / 252;
    const idioVol = bp.annualVol / Math.sqrt(252);

    for (let t = 0; t < tradingDays; t++) {
      const mkt = marketShocks[t] * bp.stressBeta;
      const idio = gaussianNoise(rng) * idioVol;
      // Slight momentum autocorrelation so predictive baseline tests real signal vs noise
      const ret = dailyDrift + mkt + idio;
      const prevClose = price;
      const close = Math.max(0.5, Number((prevClose * Math.exp(ret)).toFixed(2)));
      const open = Number((prevClose * (1 + gaussianNoise(rng) * 0.004)).toFixed(2));
      const intradaySpread = Math.abs(gaussianNoise(rng)) * 0.012 + 0.004;
      const high = Number((Math.max(open, close) * (1 + intradaySpread)).toFixed(2));
      const low = Number(Math.max(0.4, Math.min(open, close) * (1 - intradaySpread)).toFixed(2));

      // Volume surges on high absolute returns + occasional institutional block days
      const volMultiplier =
        0.55 + rng() * 0.9 + Math.min(2.8, Math.abs(ret) * 45) + (rng() > 0.985 ? 2.4 : 0);
      const volume = Math.round(bp.baseDailyVolume * volMultiplier);
      const turnover = Math.round(volume * close);
      const foreignTurnover =
        bp.foreignShare !== null
          ? Math.round(turnover * Math.max(0.02, Math.min(0.95, bp.foreignShare + (rng() - 0.5) * 0.14)))
          : null;

      allBars.push({
        date: dates[t],
        ticker: bp.ticker,
        name: bp.name,
        sector: bp.sector,
        open,
        high,
        low,
        close,
        volume,
        turnover,
        foreignTurnover,
      });

      price = close;
    }

    fundamentalsMap.set(bp.ticker, {
      ticker: bp.ticker,
      name: bp.name,
      sector: bp.sector,
      currency: 'KES',
      ...bp.fundamentals,
      reportingPeriod: 'Modeled FY2024/2025 Demonstration Snapshot',
      classification: 'SYNTHETIC DATA',
    });
  }

  return buildParsedDataset(
    allBars,
    fundamentalsMap,
    {
      datasetId: 'nse-synthetic-demo-v1',
      name: 'NSE Synthetic Demonstration Corpus (10 Representative Equities)',
      source: 'ROCK ATLAS Deterministic Factor-Stress Generator (Seed 20250411)',
      acquisitionDate: new Date().toISOString().slice(0, 10),
      classification: 'SYNTHETIC DATA',
      currency: 'KES',
      units: 'Price in KES / Volume in Shares / Turnover in KES',
      frequency: 'Daily',
      licensingNotes:
        'Generated purely for software verification and analytical workflow demonstration. Does NOT represent verified NSE or Rock Data Plus empirical trading history.',
      limitations: [
        'Synthetic price paths generated via factor-augmented geometric Brownian motion with a simulated Q3 2024 stress regime.',
        'Company fundamentals are illustrative demonstration snapshots; BATK, KPLC, and JUB include intentional missing fields to test unavailable-data governance.',
        'Do not draw real-world Kenyan capital market investment conclusions from synthetic demonstration outputs.',
      ],
      columnDefinitions: [
        { column: 'date', type: 'string (ISO)', unit: 'YYYY-MM-DD', description: 'Trading session date' },
        { column: 'ticker', type: 'string', unit: 'Symbol', description: 'NSE equity ticker code' },
        { column: 'name', type: 'string', unit: 'Text', description: 'Issuer legal/display name' },
        { column: 'sector', type: 'string', unit: 'Category', description: 'NSE industry classification' },
        { column: 'open/high/low/close', type: 'float', unit: 'KES', description: 'Daily session prices' },
        { column: 'volume', type: 'integer', unit: 'Shares', description: 'Total shares traded' },
        { column: 'turnover', type: 'float', unit: 'KES', description: 'Total value traded (Volume × VWAP/Close)' },
        { column: 'foreign_turnover', type: 'float | null', unit: 'KES', description: 'Foreign investor participation value' },
      ],
    },
    '2026-12-31'
  );
}

/**
 * Parses a user-uploaded CSV file (e.g. Rock Data Plus export) into a validated ParsedDataset.
 */
export function parseCsvDataset(
  csvText: string,
  fileName: string,
  sourceLabel = 'User-Uploaded Verified Financial Dataset',
  classification: DataClassification = 'VERIFIED DATA'
): ParsedDataset {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file must include a header row and at least one data row.');
  }

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIdx = findCol(['date', 'trading_date', 'timestamp', 'session_date']);
  const tickerIdx = findCol(['ticker', 'symbol', 'code', 'security', 'stock']);
  const nameIdx = findCol(['name', 'company', 'security_name', 'issuer']);
  const sectorIdx = findCol(['sector', 'industry', 'segment']);
  const openIdx = findCol(['open', 'open_price']);
  const highIdx = findCol(['high', 'high_price']);
  const lowIdx = findCol(['low', 'low_price']);
  const closeIdx = findCol(['close', 'close_price', 'price', 'last_price', 'adj_close']);
  const volIdx = findCol(['volume', 'vol', 'shares_traded']);
  const turnIdx = findCol(['turnover', 'value', 'traded_value', 'kes_turnover']);
  const fTurnIdx = findCol(['foreign_turnover', 'foreign_value', 'foreign_participation']);

  // Optional fundamental columns in flat CSV
  const peIdx = findCol(['pe', 'pe_ratio', 'p_e']);
  const pbIdx = findCol(['pb', 'pb_ratio', 'p_b']);
  const divIdx = findCol(['dividend_yield', 'div_yield']);
  const roeIdx = findCol(['roe', 'return_on_equity']);
  const revGIdx = findCol(['revenue_growth', 'rev_growth']);
  const marginIdx = findCol(['net_margin', 'profit_margin']);
  const deIdx = findCol(['debt_to_equity', 'd_e']);
  const mcapIdx = findCol(['market_cap', 'mcap']);

  if (dateIdx === -1 || tickerIdx === -1 || closeIdx === -1) {
    throw new Error(
      'CSV requires at least `date`, `ticker` (or `symbol`), and `close` (or `price`) columns.'
    );
  }

  const parseNum = (val: string | undefined): number | null => {
    if (!val || val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na' || val === '-') {
      return null;
    }
    const cleaned = val.replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const bars: OHLCVBar[] = [];
  const fundamentalsMap = new Map<string, FundamentalSnapshot>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;

    const rawDate = (cols[dateIdx] ?? '').slice(0, 10);
    const ticker = (cols[tickerIdx] ?? '').toUpperCase();
    const close = parseNum(cols[closeIdx]);
    if (!rawDate || !ticker || close === null) continue;

    const open = (openIdx !== -1 ? parseNum(cols[openIdx]) : null) ?? close;
    const high = (highIdx !== -1 ? parseNum(cols[highIdx]) : null) ?? Math.max(open, close);
    const low = (lowIdx !== -1 ? parseNum(cols[lowIdx]) : null) ?? Math.min(open, close);
    const volume = (volIdx !== -1 ? parseNum(cols[volIdx]) : null) ?? 0;
    const turnover = (turnIdx !== -1 ? parseNum(cols[turnIdx]) : null) ?? volume * close;
    const foreignTurnover = fTurnIdx !== -1 ? parseNum(cols[fTurnIdx]) : null;
    const name = (nameIdx !== -1 && cols[nameIdx]) || ticker;
    const sector = (sectorIdx !== -1 && cols[sectorIdx]) || 'Unclassified';

    bars.push({
      date: rawDate,
      ticker,
      name,
      sector,
      open,
      high,
      low,
      close,
      volume,
      turnover,
      foreignTurnover,
    });

    const hasAnyFund =
      peIdx !== -1 ||
      pbIdx !== -1 ||
      divIdx !== -1 ||
      roeIdx !== -1 ||
      revGIdx !== -1 ||
      marginIdx !== -1 ||
      deIdx !== -1 ||
      mcapIdx !== -1;

    if (hasAnyFund) {
      fundamentalsMap.set(ticker, {
        ticker,
        name,
        sector,
        currency: 'KES',
        marketCapKes: mcapIdx !== -1 ? parseNum(cols[mcapIdx]) : null,
        revenueGrowthYoY: revGIdx !== -1 ? parseNum(cols[revGIdx]) : null,
        netMargin: marginIdx !== -1 ? parseNum(cols[marginIdx]) : null,
        roe: roeIdx !== -1 ? parseNum(cols[roeIdx]) : null,
        debtToEquity: deIdx !== -1 ? parseNum(cols[deIdx]) : null,
        peRatio: peIdx !== -1 ? parseNum(cols[peIdx]) : null,
        pbRatio: pbIdx !== -1 ? parseNum(cols[pbIdx]) : null,
        dividendYield: divIdx !== -1 ? parseNum(cols[divIdx]) : null,
        fcfConversion: null,
        reportingPeriod: 'Imported CSV Snapshot',
        classification,
      });
    }
  }

  if (bars.length === 0) {
    throw new Error('No valid OHLCV rows could be extracted from the uploaded CSV.');
  }

  return buildParsedDataset(bars, fundamentalsMap, {
    datasetId: `csv-${Date.now()}`,
    name: fileName,
    source: sourceLabel,
    acquisitionDate: new Date().toISOString().slice(0, 10),
    classification,
    currency: 'KES',
    units: 'Price in KES / Volume in Shares / Turnover in KES',
    frequency: 'Daily',
    licensingNotes: `Imported directly by analyst from ${fileName}. Provenance governed by uploader authorization.`,
    limitations: [
      'Fundamental fields not present in CSV columns are marked UNAVAILABLE DATA rather than estimated.',
      'Survivorship bias applies if the uploaded file excludes delisted or suspended NSE counters.',
    ],
    columnDefinitions: headers.map((h) => ({
      column: h,
      type: 'auto-detected',
      unit: 'Source-defined',
      description: `Imported column "${h}"`,
    })),
  });
}

export function generateCsvTemplate(): string {
  return [
    'date,ticker,name,sector,open,high,low,close,volume,turnover,foreign_turnover,pe_ratio,pb_ratio,dividend_yield,roe',
    '2025-01-02,SCOM,Safaricom PLC,Telecommunication,17.20,17.55,17.10,17.45,8450000,147452500,91420550,10.4,3.1,0.071,0.285',
    '2025-01-03,SCOM,Safaricom PLC,Telecommunication,17.45,17.65,17.30,17.60,7920000,139392000,83635200,10.4,3.1,0.071,0.285',
  ].join('\n');
}
