import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BacktestConfig,
  DataClassification,
  KMRIWeights,
  OpportunityWeights,
  ParsedDataset,
  WorkspaceId,
} from './engines/types';
import { createSyntheticNseDataset, parseCsvDataset } from './engines/dataGovernance';
import { computeMarketIntelligence } from './engines/marketEngine';
import { computeFundamentalIntelligence } from './engines/fundamentalEngine';
import { computeRiskIntelligence } from './engines/riskEngine';
import {
  computeOpportunityRadar,
  DEFAULT_OPPORTUNITY_WEIGHTS,
} from './engines/opportunityEngine';
import { computeKMRI, DEFAULT_KMRI_WEIGHTS } from './engines/kmriEngine';
import { computePredictiveIntelligence } from './engines/predictiveEngine';
import { LIVE_DEMO_STEPS } from './engines/researchContent';
import { CommandCentre } from './components/workspaces/CommandCentre';
import { OpportunityRadar } from './components/workspaces/OpportunityRadar';
import { SecurityExplorer } from './components/workspaces/SecurityExplorer';
import { RiskLaboratory } from './components/workspaces/RiskLaboratory';
import { PredictiveWorkspace } from './components/workspaces/PredictiveWorkspace';
import { KMRIWorkspace } from './components/workspaces/KMRIWorkspace';
import { ResearchStudio } from './components/workspaces/ResearchStudio';
import { GovernanceWorkspace } from './components/workspaces/GovernanceWorkspace';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  FileText,
  Menu,
  Moon,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sun,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';

const WORKSPACES: Array<{
  id: WorkspaceId;
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'command-centre', code: '01.', label: 'Command Centre', icon: Activity },
  { id: 'opportunity-radar', code: '02.', label: 'Opportunity Radar', icon: Compass },
  { id: 'security-explorer', code: '03.', label: 'Security Explorer', icon: BarChart3 },
  { id: 'risk-laboratory', code: '04.', label: 'Risk Laboratory', icon: ShieldAlert },
  { id: 'predictive-intelligence', code: '05.', label: 'Predictive Models', icon: TrendingUp },
  { id: 'kmri', code: '06.', label: 'Resilience Index', icon: ShieldCheck },
  { id: 'research-studio', code: '07.', label: 'Research Studio', icon: FileText },
  { id: 'governance', code: '08.', label: 'Data Governance', icon: Database },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('command-centre');

  const [dataset, setDataset] = useState<ParsedDataset>(() => createSyntheticNseDataset());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>('SCOM');

  const [radarWeights, setRadarWeights] = useState<OpportunityWeights>(DEFAULT_OPPORTUNITY_WEIGHTS);
  const [kmriWeights, setKmriWeights] = useState<KMRIWeights>(DEFAULT_KMRI_WEIGHTS);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(0.145);
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    trainFraction: 0.6,
    rebalanceDays: 20,
    topK: 3,
    transactionCostBps: 180,
    riskFreeRate: 0.145,
  });

  const [demoStepIdx, setDemoStepIdx] = useState<number | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    setBacktestConfig((prev) => ({ ...prev, riskFreeRate }));
  }, [riskFreeRate]);

  // Execute all six interconnected analytical engines deterministically
  const market = useMemo(() => computeMarketIntelligence(dataset), [dataset]);
  const fundamentals = useMemo(() => computeFundamentalIntelligence(dataset), [dataset]);
  const risk = useMemo(
    () => computeRiskIntelligence(dataset, riskFreeRate),
    [dataset, riskFreeRate]
  );
  const opportunities = useMemo(
    () => computeOpportunityRadar(market, fundamentals, risk.profiles, radarWeights),
    [market, fundamentals, risk.profiles, radarWeights]
  );
  const kmri = useMemo(
    () => computeKMRI(dataset, market, risk.profiles, kmriWeights),
    [dataset, market, risk.profiles, kmriWeights]
  );
  const backtest = useMemo(
    () => computePredictiveIntelligence(dataset, backtestConfig),
    [dataset, backtestConfig]
  );

  const handleUploadCsv = (
    csvText: string,
    fileName: string,
    sourceLabel = 'User-Uploaded CSV Dataset',
    classification: DataClassification = 'VERIFIED DATA'
  ) => {
    try {
      const parsed = parseCsvDataset(csvText, fileName, sourceLabel, classification);
      setDataset(parsed);
      setSelectedTicker(parsed.securities[0]?.ticker ?? '');
      setUploadError(null);
      setActiveWorkspace('governance');

      fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileName,
          source: sourceLabel,
          classification,
          securityCount: parsed.metadata.securityCount,
          tradingDays: parsed.metadata.tradingDays,
          csvText,
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unable to parse CSV file.');
      setActiveWorkspace('governance');
    }
  };

  const handleQuickCsvInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleUploadCsv(String(reader.result ?? ''), file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectSecurity = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveWorkspace('security-explorer');
  };

  const handleStartLiveDemo = () => {
    setDemoStepIdx(0);
    setActiveWorkspace(LIVE_DEMO_STEPS[0].workspace);
  };

  const handleMoveDemoStep = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= LIVE_DEMO_STEPS.length) return;
    setDemoStepIdx(nextIdx);
    setActiveWorkspace(LIVE_DEMO_STEPS[nextIdx].workspace);
  };

  const currentWorkspaceMeta =
    WORKSPACES.find((w) => w.id === activeWorkspace) ?? WORKSPACES[0];

  const isSynthetic = dataset.metadata.classification === 'SYNTHETIC DATA';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ROCK ATLAS
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            African Market Intelligence
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {WORKSPACES.map((ws) => {
            const Icon = ws.icon;
            const active = activeWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-mono text-[11px] opacity-75">{ws.code}</span>
                <span className="truncate">{ws.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            <div>Initial Market: Kenya (NSE)</div>
            <div className="mt-0.5">Research. Discover. Evaluate. Explain.</div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span>{darkMode ? 'Light Research Theme' : 'Dark Terminal Theme'}</span>
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-[260px] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-base">ROCK ATLAS</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="p-1 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {WORKSPACES.map((ws) => {
                const Icon = ws.icon;
                const active = activeWorkspace === ws.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspace(ws.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-medium ${
                      active
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-mono text-[11px] opacity-75">{ws.code}</span>
                    <span>{ws.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, 2 Single-Line Actions on Right */}
        <header className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-1.5 text-slate-600 dark:text-slate-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-display font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                ROCK ATLAS
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentWorkspaceMeta.code} {currentWorkspaceMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <input
              ref={quickFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleQuickCsvInput}
              className="hidden"
            />
            <button
              onClick={() => quickFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload CSV</span>
            </button>
            <button
              onClick={handleStartLiveDemo}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Live Demo</span>
            </button>
          </div>
        </header>

        {/* Data Governance Classification Strip */}
        <div
          className={`px-6 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-2 ${
            isSynthetic
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-200'
              : 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/60 text-teal-950 dark:text-teal-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{dataset.metadata.classification}</span>
            <span aria-hidden="true">·</span>
            <span>{dataset.metadata.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {dataset.metadata.startDate} to {dataset.metadata.endDate} ({dataset.metadata.securityCount} equities)
            </span>
          </div>
          <div className="text-[11px] opacity-90">
            {isSynthetic
              ? 'Software demonstration corpus only — upload verified Rock Data Plus CSV for empirical NSE findings.'
              : `Source: ${dataset.metadata.source}`}
          </div>
        </div>

        {/* Guided End-to-End Live Demonstration Strip (only active when user starts Live Demo) */}
        {demoStepIdx !== null && (
          <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Live Demonstration Step {LIVE_DEMO_STEPS[demoStepIdx].stepNumber} of{' '}
                {LIVE_DEMO_STEPS.length}: {LIVE_DEMO_STEPS[demoStepIdx].title}
              </div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                {LIVE_DEMO_STEPS[demoStepIdx].objective} —{' '}
                {LIVE_DEMO_STEPS[demoStepIdx].actionSummary}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleMoveDemoStep(demoStepIdx - 1)}
                disabled={demoStepIdx === 0}
                className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 disabled:opacity-40 whitespace-nowrap"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => handleMoveDemoStep(demoStepIdx + 1)}
                disabled={demoStepIdx === LIVE_DEMO_STEPS.length - 1}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 whitespace-nowrap"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDemoStepIdx(null)}
                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Exit Demo
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeWorkspace === 'command-centre' && (
            <CommandCentre
              metadata={dataset.metadata}
              validation={dataset.validation}
              market={market}
              opportunities={opportunities}
              onSelectSecurity={handleSelectSecurity}
              onNavigate={setActiveWorkspace}
            />
          )}

          {activeWorkspace === 'opportunity-radar' && (
            <OpportunityRadar
              opportunities={opportunities}
              weights={radarWeights}
              onChangeWeights={setRadarWeights}
              onSelectSecurity={handleSelectSecurity}
            />
          )}

          {activeWorkspace === 'security-explorer' && (
            <SecurityExplorer
              dataset={dataset}
              market={market}
              fundamentals={fundamentals}
              riskProfiles={risk.profiles}
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
            />
          )}

          {activeWorkspace === 'risk-laboratory' && (
            <RiskLaboratory
              dataset={dataset}
              profiles={risk.profiles}
              correlation={risk.correlation}
              riskFreeRate={riskFreeRate}
              onChangeRiskFreeRate={setRiskFreeRate}
            />
          )}

          {activeWorkspace === 'predictive-intelligence' && (
            <PredictiveWorkspace
              backtest={backtest}
              config={backtestConfig}
              onChangeConfig={setBacktestConfig}
            />
          )}

          {activeWorkspace === 'kmri' && (
            <KMRIWorkspace
              kmri={kmri}
              weights={kmriWeights}
              onChangeWeights={setKmriWeights}
            />
          )}

          {activeWorkspace === 'research-studio' && (
            <ResearchStudio
              metadata={dataset.metadata}
              validation={dataset.validation}
              market={market}
              opportunities={opportunities}
              riskProfiles={risk.profiles}
              kmri={kmri}
              backtest={backtest}
            />
          )}

          {activeWorkspace === 'governance' && (
            <GovernanceWorkspace
              dataset={dataset}
              metadata={dataset.metadata}
              validation={dataset.validation}
              onUploadCsv={handleUploadCsv}
              onResetSynthetic={() => {
                setDataset(createSyntheticNseDataset());
                setSelectedTicker('SCOM');
                setUploadError(null);
              }}
              uploadError={uploadError}
            />
          )}
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <span>
            ROCK ATLAS — Experimental African financial research and decision-support platform. Does not constitute personalized investment advice or a guarantee of future performance.
          </span>
          <span className="font-mono">Research. Discover. Evaluate. Explain.</span>
        </footer>
      </div>
    </div>
  );
}
