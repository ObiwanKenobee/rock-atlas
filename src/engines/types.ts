export type DataClassification =
  | 'VERIFIED DATA'
  | 'SYNTHETIC DATA'
  | 'ESTIMATED DATA'
  | 'UNAVAILABLE DATA';

export interface OHLCVBar {
  date: string; // YYYY-MM-DD
  ticker: string;
  name: string;
  sector: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  foreignTurnover: number | null;
}

export interface FundamentalSnapshot {
  ticker: string;
  name: string;
  sector: string;
  currency: string;
  marketCapKes: number | null;
  revenueGrowthYoY: number | null; // decimal e.g. 0.12 = 12%
  netMargin: number | null; // decimal
  roe: number | null; // decimal
  debtToEquity: number | null; // ratio
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null; // decimal
  fcfConversion: number | null; // decimal
  reportingPeriod: string;
  classification: DataClassification;
}

export interface DatasetMetadata {
  datasetId: string;
  name: string;
  source: string;
  acquisitionDate: string;
  classification: DataClassification;
  currency: string;
  units: string;
  frequency: 'Daily';
  startDate: string;
  endDate: string;
  tradingDays: number;
  securityCount: number;
  totalRows: number;
  licensingNotes: string;
  limitations: string[];
  columnDefinitions: Array<{
    column: string;
    type: string;
    unit: string;
    description: string;
  }>;
}

export interface ValidationCheckResult {
  id: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  affectedCount: number;
  summary: string;
  sampleDetails: string[];
}

export interface ValidationReport {
  timestamp: string;
  overallStatus: 'VALIDATED' | 'VALIDATED WITH WARNINGS' | 'FAILED';
  totalRowsInspected: number;
  validRowsRetained: number;
  checks: ValidationCheckResult[];
}

export interface SecuritySeries {
  ticker: string;
  name: string;
  sector: string;
  bars: OHLCVBar[];
  fundamentals: FundamentalSnapshot | null;
}

export interface ParsedDataset {
  metadata: DatasetMetadata;
  validation: ValidationReport;
  securities: SecuritySeries[];
}

// Engine 01: Market Intelligence
export interface SecurityMarketSummary {
  ticker: string;
  name: string;
  sector: string;
  latestDate: string;
  latestClose: number;
  prevClose: number;
  dailyReturn: number;
  return20d: number;
  return60d: number;
  ytdOrPeriodReturn: number;
  sma20: number | null;
  sma50: number | null;
  aboveSma50: boolean | null;
  latestVolume: number;
  avgVolume20d: number;
  volumeRatio: number;
  latestTurnover: number;
  avgTurnover20d: number;
  foreignParticipationRatio: number | null;
  unusualActivityFlag: string | null;
}

export interface SectorPerformance {
  sector: string;
  securityCount: number;
  avgPeriodReturn: number;
  avgReturn20d: number;
  totalPeriodTurnover: number;
  turnoverShare: number;
  avgVolatility: number;
}

export interface MarketOverview {
  asOfDate: string;
  universeCount: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  pctAboveSma50: number;
  totalLatestTurnover: number;
  avgDailyUniverseTurnover: number;
  compositeIndexReturn: number;
  indexSeries: Array<{ date: string; equalWeightIndex: number; turnoverWeightIndex: number }>;
  securities: SecurityMarketSummary[];
  sectors: SectorPerformance[];
  alerts: Array<{
    ticker: string;
    date: string;
    type: 'Volume Spike' | 'Price Shock';
    severity: 'Moderate' | 'High';
    detail: string;
  }>;
}

// Engine 02: Fundamental Intelligence
export interface FundamentalProfile {
  ticker: string;
  name: string;
  sector: string;
  classification: DataClassification;
  reportingPeriod: string;
  completenessRatio: number;
  missingFields: string[];
  metrics: {
    marketCapKes: number | null;
    revenueGrowthYoY: number | null;
    netMargin: number | null;
    roe: number | null;
    debtToEquity: number | null;
    peRatio: number | null;
    pbRatio: number | null;
    dividendYield: number | null;
    fcfConversion: number | null;
  };
  fundamentalHealthScore: number | null; // 0-100, null if insufficient data
  valuationScore: number | null; // 0-100, null if insufficient data
  healthAssessment: string;
}

// Engine 04: Risk Intelligence
export interface SecurityRiskProfile {
  ticker: string;
  name: string;
  sector: string;
  observationCount: number;
  cumulativeReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  downsideDeviation: number;
  maxDrawdown: number; // negative decimal e.g. -0.24
  maxDrawdownStart: string;
  maxDrawdownTrough: string;
  maxDrawdownDurationDays: number;
  recoveryDays: number | null; // null if not yet recovered
  sharpeRatio: number;
  var95Daily: number;
  amihudIlliquidity: number; // scaled * 1e6
  zeroVolumeDaysPct: number;
  drawdownSeries: Array<{ date: string; drawdown: number }>;
}

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
}

export interface PortfolioRiskAnalysis {
  weights: Record<string, number>;
  portfolioAnnReturn: number;
  portfolioAnnVolatility: number;
  portfolioSharpe: number;
  portfolioMaxDrawdown: number;
  diversificationRatio: number;
  herfindahlIndex: number;
  concentrationLabel: 'Diversified' | 'Moderate Concentration' | 'High Concentration';
  equitySeries: Array<{
    date: string;
    portfolio: number;
    benchmark: number;
  }>;
  stressTests: Array<{
    scenario: string;
    assumption: string;
    estimatedImpactPct: number;
    portfolioStressedReturn: number;
    notes: string;
  }>;
}

export interface SavedReportRecord {
  id: string;
  title: string;
  authorMode: 'Deterministic' | 'AI-Assisted (Gemini)';
  datasetName: string;
  classification: DataClassification;
  createdAt: string;
  markdown: string;
}

export interface SavedDatasetRecord {
  id: string;
  name: string;
  source: string;
  classification: DataClassification;
  savedAt: string;
  securityCount: number;
  tradingDays: number;
  csvText: string;
}

// Engine 03: Predictive Intelligence
export interface PredictiveModelComparison {
  modelName: string;
  methodology: string;
  inSampleR2: number | null;
  oosMae: number;
  oosRmse: number;
  directionalAccuracy: number;
  sampleCount: number;
}

export interface BacktestConfig {
  trainFraction: number; // e.g. 0.6
  rebalanceDays: number; // e.g. 20
  topK: number; // e.g. 3
  transactionCostBps: number; // e.g. 180 bps round-trip (NSE brokerage + levies)
  riskFreeRate: number; // e.g. 0.145 (14.5% CBK T-bill reference)
}

export interface BacktestResult {
  config: BacktestConfig;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  testTradingDays: number;
  modelComparisons: PredictiveModelComparison[];
  strategyMetrics: {
    cumulativeReturn: number;
    annualizedReturn: number;
    annualizedVolatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    avgTurnoverPerRebalance: number;
    totalTransactionCostPct: number;
  };
  benchmarkMetrics: {
    cumulativeReturn: number;
    annualizedReturn: number;
    annualizedVolatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  equityCurve: Array<{
    date: string;
    strategyGross: number;
    strategyNet: number;
    benchmark: number;
  }>;
  latestForecasts: Array<{
    ticker: string;
    name: string;
    expected20dReturn: number;
    lower95Interval: number;
    upper95Interval: number;
    residualStd: number;
    signalBasis: string;
  }>;
}

// Engine 05: Opportunity Intelligence (Radar)
export interface OpportunityWeights {
  momentum: number;
  fundamentals: number;
  valuation: number;
  risk: number;
  liquidity: number;
}

export interface OpportunityScore {
  rank: number;
  ticker: string;
  name: string;
  sector: string;
  compositeScore: number;
  dimensionScores: {
    momentum: number;
    fundamentals: number;
    valuation: number;
    risk: number;
    liquidity: number;
  };
  dimensionContributions: {
    momentum: number;
    fundamentals: number;
    valuation: number;
    risk: number;
    liquidity: number;
  };
  uncertaintyLevel: 'Low' | 'Moderate' | 'High';
  missingDataPoints: string[];
  supportingEvidence: string[];
  weakeningFactors: string[];
  keyRisks: string[];
  invalidationCriteria: string[];
}

// Original Research: Kenyan Market Resilience Index (KMRI)
export interface KMRIWeights {
  performance: number;
  resilience: number;
  stability: number;
  liquidity: number;
  participation: number;
}

export interface KMRIScore {
  rank: number;
  ticker: string;
  name: string;
  sector: string;
  kmriScore: number;
  dimensions: {
    performance: number;
    resilience: number;
    stability: number;
    liquidity: number;
    participation: number | null;
  };
  stressPeriodReturn: number;
  stressPeriodMaxDrawdown: number;
  recoveryDays: number | null;
  foreignTurnoverRatio: number | null;
}

export interface KMRIAnalysis {
  weights: KMRIWeights;
  participationAvailable: boolean;
  stressWindow: {
    startDate: string;
    endDate: string;
    marketDropPct: number;
    description: string;
  };
  scores: KMRIScore[];
  stressCohortComparison: {
    topHalfAvgStressReturn: number;
    bottomHalfAvgStressReturn: number;
    topHalfAvgStressDrawdown: number;
    bottomHalfAvgStressDrawdown: number;
    findingSummary: string;
  };
  sensitivityAnalysis: Array<{
    schemeName: string;
    weightsLabel: string;
    spearmanRhoVsBaseline: number;
    topThreeTickers: string[];
    maxRankShift: number;
  }>;
}

export type WorkspaceId =
  | 'command-centre'
  | 'opportunity-radar'
  | 'security-explorer'
  | 'risk-laboratory'
  | 'predictive-intelligence'
  | 'kmri'
  | 'research-studio'
  | 'governance';
