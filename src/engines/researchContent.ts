import {
  BacktestResult,
  DatasetMetadata,
  KMRIAnalysis,
  MarketOverview,
  OpportunityScore,
  SecurityRiskProfile,
  ValidationReport,
  WorkspaceId,
} from './types';

export interface DeterministicBriefInput {
  metadata: DatasetMetadata;
  validation: ValidationReport;
  market: MarketOverview;
  opportunities: OpportunityScore[];
  riskProfiles: SecurityRiskProfile[];
  kmri: KMRIAnalysis;
  backtest: BacktestResult;
}

export function buildDeterministicResearchBrief(input: DeterministicBriefInput): string {
  const { metadata, validation, market, opportunities, riskProfiles, kmri, backtest } = input;
  const top3 = opportunities.slice(0, 3);
  const topKmri = kmri.scores.slice(0, 3);
  const riskByTicker = new Map(riskProfiles.map((r) => [r.ticker, r]));

  return [
    `# ROCK ATLAS — Analytical Research Brief`,
    ``,
    `**Provenance Classification:** ${metadata.classification}`,
    `**Dataset:** ${metadata.name} (${metadata.source})`,
    `**Coverage:** ${metadata.startDate} to ${metadata.endDate} (${metadata.tradingDays} trading sessions, ${metadata.securityCount} securities, Currency: ${metadata.currency})`,
    `**Validation Status:** ${validation.overallStatus} (${validation.validRowsRetained}/${validation.totalRowsInspected} rows retained)`,
    ``,
    `> **Methodological Disclosure:** ${
      metadata.classification === 'SYNTHETIC DATA'
        ? 'This brief is generated from the SYNTHETIC NSE demonstration corpus. Figures verify computational mechanics and decision-support traceability only and MUST NOT be interpreted as empirical Nairobi Securities Exchange findings.'
        : 'Figures below are computed deterministically from the uploaded dataset under the disclosed model assumptions.'
    }`,
    ``,
    `---`,
    ``,
    `## 1. Market Intelligence Overview`,
    `- **Equal-Weight Composite Return:** ${(market.compositeIndexReturn * 100).toFixed(2)}%`,
    `- **Latest Session Breadth:** ${market.advancers} Advancers · ${market.decliners} Decliners · ${market.unchanged} Unchanged`,
    `- **Trend Participation:** ${(market.pctAboveSma50 * 100).toFixed(1)}% of securities trading above 50-day SMA`,
    `- **20D Average Daily Universe Turnover:** KES ${(market.avgDailyUniverseTurnover / 1e6).toFixed(2)}M`,
    `- **Top Performing Sector:** ${market.sectors[0]?.sector ?? 'N/A'} (${((market.sectors[0]?.avgPeriodReturn ?? 0) * 100).toFixed(1)}% avg period return)`,
    ``,
    `## 2. Opportunity Radar — Top Ranked Candidates (Not Investment Advice)`,
    ...top3.map((o) => {
      const r = riskByTicker.get(o.ticker);
      return [
        `### #${o.rank} ${o.ticker} — ${o.name} (${o.compositeScore}/100 · Uncertainty: ${o.uncertaintyLevel})`,
        `- **Score Contributions:** Momentum ${o.dimensionContributions.momentum} | Fundamentals ${o.dimensionContributions.fundamentals} | Valuation ${o.dimensionContributions.valuation} | Risk ${o.dimensionContributions.risk} | Liquidity ${o.dimensionContributions.liquidity}`,
        `- **Risk Snapshot:** Ann. Vol ${r ? (r.annualizedVolatility * 100).toFixed(1) : 'N/A'}% | Max Drawdown ${r ? (r.maxDrawdown * 100).toFixed(1) : 'N/A'}% | Sharpe ${r ? r.sharpeRatio.toFixed(2) : 'N/A'}`,
        `- **Supporting Evidence:** ${o.supportingEvidence.join(' ')}`,
        `- **Key Risks:** ${o.keyRisks.join(' ')}`,
        `- **Missing Data:** ${o.missingDataPoints.length > 0 ? o.missingDataPoints.join(', ') : 'None'}`,
      ].join('\n');
    }),
    ``,
    `## 3. Kenyan Market Resilience Index (KMRI) — Experimental Findings`,
    `- **Isolated Stress Window:** ${kmri.stressWindow.startDate} to ${kmri.stressWindow.endDate} (Composite drop ${(kmri.stressWindow.marketDropPct * 100).toFixed(1)}%)`,
    `- **Top 3 Resilient Counters:** ${topKmri.map((k) => `${k.ticker} (${k.kmriScore}/100)`).join(', ')}`,
    `- **Cohort Stress Behaviour:** Top-half KMRI averaged ${(kmri.stressCohortComparison.topHalfAvgStressReturn * 100).toFixed(2)}% during stress vs ${(kmri.stressCohortComparison.bottomHalfAvgStressReturn * 100).toFixed(2)}% for bottom-half peers.`,
    `- **Weight Sensitivity (Spearman Rho):** ${kmri.sensitivityAnalysis.map((s) => `${s.schemeName}: ρ=${s.spearmanRhoVsBaseline}`).join(' · ')}`,
    ``,
    `## 4. Predictive Intelligence & Chronological Backtest (${backtest.testStartDate} to ${backtest.testEndDate})`,
    `- **Walk-Forward Out-of-Sample Top-${backtest.config.topK} Strategy (Net of ${backtest.config.transactionCostBps} bps round-trip cost):**`,
    `  - Net Cumulative Return: ${(backtest.strategyMetrics.cumulativeReturn * 100).toFixed(2)}% vs Equal-Weight Benchmark ${(backtest.benchmarkMetrics.cumulativeReturn * 100).toFixed(2)}%`,
    `  - Net Annualized Return: ${(backtest.strategyMetrics.annualizedReturn * 100).toFixed(2)}% | Net Sharpe: ${backtest.strategyMetrics.sharpeRatio.toFixed(2)} | Max Drawdown: ${(backtest.strategyMetrics.maxDrawdown * 100).toFixed(2)}%`,
    `  - Total Transaction Cost Drag: ${(backtest.strategyMetrics.totalTransactionCostPct * 100).toFixed(2)}%`,
    `- **Statistical Baselines (OOS RMSE):** ${backtest.modelComparisons.map((m) => `${m.modelName}: ${(m.oosRmse * 100).toFixed(2)}%`).join(' | ')}`,
    ``,
    `## 5. Limitations & Governance Warnings`,
    ...metadata.limitations.map((l) => `- ${l}`),
    `- Risk-free rate assumption fixed at ${(backtest.config.riskFreeRate * 100).toFixed(1)}% (disclosed CBK T-bill reference).`,
    `- Predictive intervals reflect empirical historical residuals and do not guarantee future market performance.`,
  ].join('\n');
}

export interface LiveDemoStep {
  stepNumber: number;
  title: string;
  workspace: WorkspaceId;
  objective: string;
  actionSummary: string;
}

export const LIVE_DEMO_STEPS: LiveDemoStep[] = [
  {
    stepNumber: 1,
    title: 'Inspect Active Dataset & Provenance',
    workspace: 'governance',
    objective: 'Verify whether active records are VERIFIED DATA or SYNTHETIC DATA before running models.',
    actionSummary: 'Review dataset coverage, currency (KES), column dictionary, and limitations.',
  },
  {
    stepNumber: 2,
    title: 'Audit 10-Point Data Validation Suite',
    workspace: 'governance',
    objective: 'Confirm missing values, duplicate keys, OHLC consistency, and temporal leakage checks pass.',
    actionSummary: 'Inspect row retention counts and outlier flags without silent data deletion.',
  },
  {
    stepNumber: 3,
    title: 'Assess NSE Market Breadth & Sectors',
    workspace: 'command-centre',
    objective: 'Understand macro market direction, sector turnover concentration, and unusual volume spikes.',
    actionSummary: 'Compare Equal-Weighted vs Turnover-Weighted composite index behaviour.',
  },
  {
    stepNumber: 4,
    title: 'Run the Opportunity Radar',
    workspace: 'opportunity-radar',
    objective: 'Rank securities using configurable factor weights without issuing automated BUY/SELL calls.',
    actionSummary: 'Adjust weights, inspect factor contributions, missing data points, and thesis invalidation rules.',
  },
  {
    stepNumber: 5,
    title: 'Inspect Individual Security Mechanics',
    workspace: 'security-explorer',
    objective: 'Verify price trend (SMA20/SMA50), volume spikes, underwater drawdown, and available fundamentals.',
    actionSummary: 'Confirm unavailable ratios are explicitly flagged UNAVAILABLE DATA.',
  },
  {
    stepNumber: 6,
    title: 'Quantify Portfolio Risk & Stress Shocks',
    workspace: 'risk-laboratory',
    objective: 'Examine cross-asset correlation, Amihud illiquidity, HHI concentration, and stress scenarios.',
    actionSummary: 'Simulate portfolio allocations under -15% macro tightening and banking contagion.',
  },
  {
    stepNumber: 7,
    title: 'Evaluate Kenyan Market Resilience Index',
    workspace: 'kmri',
    objective: 'Test whether high-KMRI counters behaved differently during the isolated worst market drawdown.',
    actionSummary: 'Verify rank stability across alternative weighting schemes via Spearman rho.',
  },
  {
    stepNumber: 8,
    title: 'Audit Out-of-Sample Walk-Forward Backtest',
    workspace: 'predictive-intelligence',
    objective: 'Compare Ridge multi-feature forecasts against naive zero-drift and historical mean baselines.',
    actionSummary: 'Inspect net-of-cost equity curve, turnover drag, and 95% forecast uncertainty intervals.',
  },
  {
    stepNumber: 9,
    title: 'Generate Evidence-Linked Research Brief',
    workspace: 'research-studio',
    objective: 'Synthesize deterministic quantitative outputs into an exportable decision-support brief.',
    actionSummary: 'Export Markdown brief or generate an AI-assisted narrative grounded strictly in computed figures.',
  },
];

export const RESEARCH_PAPER_SECTIONS: Array<{
  num: string;
  title: string;
  status: 'Framework Defined' | 'Demonstrated on Synthetic Corpus' | 'Requires Verified Rock Data Plus';
  summary: string;
}> = [
  {
    num: '01',
    title: 'Title and Abstract',
    status: 'Framework Defined',
    summary:
      'ROCK ATLAS: An Integrated, Explainable Market Intelligence and Resilience Framework for East African Capital Markets.',
  },
  {
    num: '02–05',
    title: 'Context, Problem Statement, Research Question & Objectives',
    status: 'Framework Defined',
    summary:
      'Investigates whether multi-factor price, fundamental, liquidity, and risk signals can be combined transparently under emerging-market data sparsity and liquidity frictions.',
  },
  {
    num: '06',
    title: 'Literature & Related Work',
    status: 'Requires Verified Rock Data Plus',
    summary:
      'Requires formal citation verification of empirical African frontier market studies (NSE liquidity, Amihud illiquidity premia, and composite factor scoring) prior to publication.',
  },
  {
    num: '07–08',
    title: 'Data Sources, Provenance & Preparation Pipeline',
    status: 'Demonstrated on Synthetic Corpus',
    summary:
      '10-check ingestion and validation pipeline operational for Rock Data Plus CSV schemas, distinguishing VERIFIED, SYNTHETIC, ESTIMATED, and UNAVAILABLE fields.',
  },
  {
    num: '09–11',
    title: 'Market, Opportunity Radar & Risk Modelling Engines',
    status: 'Demonstrated on Synthetic Corpus',
    summary:
      'Configurable 5-factor Opportunity Radar, Amihud illiquidity, peak-to-trough drawdown recovery, HHI concentration, and three macro/sector stress scenarios.',
  },
  {
    num: '12',
    title: 'Kenyan Market Resilience Index (KMRI)',
    status: 'Demonstrated on Synthetic Corpus',
    summary:
      'Experimental 5-dimension composite with automated stress-regime isolation and Spearman rank sensitivity testing. Empirical NSE validation pending historical verified feed.',
  },
  {
    num: '13–15',
    title: 'Backtesting, Results & Robustness Sensitivity',
    status: 'Demonstrated on Synthetic Corpus',
    summary:
      'Chronological train/test split with explicit 180 bps round-trip NSE transaction costs, baseline error comparisons, and rank-correlation sensitivity audits.',
  },
  {
    num: '16–22',
    title: 'Discussion, Limitations, Ethics, Recommendations & Reproducibility',
    status: 'Framework Defined',
    summary:
      'Addresses survivorship bias, thin trading distortion, AI non-hallucination guardrails, and deterministic TypeScript test suite reproducibility.',
  },
];

export const PROJECT_STATUS_LEDGER: Array<{
  phase: string;
  deliverable: string;
  status: 'Completed' | 'In Progress' | 'Requires Verification' | 'Blocked / Pending Data';
  notes: string;
}> = [
  {
    phase: 'Phase 01: Discovery',
    deliverable: 'Central Research Question, Hypotheses & Engine Dependency Map',
    status: 'Completed',
    notes: 'Six engines and KMRI hypotheses structured in architecture and Research Studio.',
  },
  {
    phase: 'Phase 02: Data Acquisition',
    deliverable: 'Verified Rock Data Plus Historical NSE Dataset Import',
    status: 'Blocked / Pending Data',
    notes: 'No raw Rock Data Plus files present in workspace; live CSV ingestion pipeline built and ready.',
  },
  {
    phase: 'Phase 02: Data Governance',
    deliverable: '10-Point Validation Suite & Provenance Classification',
    status: 'Completed',
    notes: 'Operational for both synthetic demonstration corpus and uploaded verified CSV datasets.',
  },
  {
    phase: 'Phase 03–04: Quantitative Engines',
    deliverable: 'Six Analytical Engines + KMRI + Walk-Forward Backtester',
    status: 'Completed',
    notes: 'Implemented in pure modular TypeScript with automated unit tests.',
  },
  {
    phase: 'Phase 05: Application Development',
    deliverable: '8-Workspace Investment Command Centre UI',
    status: 'Completed',
    notes: 'Interactive charts, configurable Opportunity Radar, Risk Lab, KMRI, and Brief Studio.',
  },
  {
    phase: 'Phase 06–07: Empirical Validation',
    deliverable: 'Real-Market NSE Empirical Findings & Survivorship Audit',
    status: 'Requires Verification',
    notes: 'Must be executed on verified Rock Data Plus data (including delisted/suspended counters where available).',
  },
  {
    phase: 'Phase 08: Competition Alignment',
    deliverable: 'Official Competition Rules, Dates & Judging Rubric Verification',
    status: 'Requires Verification',
    notes: 'External competition brief details treated as unverified until confirmed by organizers.',
  },
];
