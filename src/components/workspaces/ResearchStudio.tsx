import React, { useEffect, useMemo, useState } from 'react';
import {
  BacktestResult,
  DatasetMetadata,
  KMRIAnalysis,
  MarketOverview,
  OpportunityScore,
  SavedReportRecord,
  SecurityRiskProfile,
  ValidationReport,
} from '../../engines/types';
import {
  buildDeterministicResearchBrief,
  RESEARCH_PAPER_SECTIONS,
} from '../../engines/researchContent';
import { Download, Save, Sparkles, Trash2 } from 'lucide-react';

interface ResearchStudioProps {
  metadata: DatasetMetadata;
  validation: ValidationReport;
  market: MarketOverview;
  opportunities: OpportunityScore[];
  riskProfiles: SecurityRiskProfile[];
  kmri: KMRIAnalysis;
  backtest: BacktestResult;
}

export const ResearchStudio: React.FC<ResearchStudioProps> = ({
  metadata,
  validation,
  market,
  opportunities,
  riskProfiles,
  kmri,
  backtest,
}) => {
  const deterministicBrief = useMemo(
    () =>
      buildDeterministicResearchBrief({
        metadata,
        validation,
        market,
        opportunities,
        riskProfiles,
        kmri,
        backtest,
      }),
    [metadata, validation, market, opportunities, riskProfiles, kmri, backtest]
  );

  const [focusTopic, setFocusTopic] = useState('Comprehensive NSE Market & Resilience Assessment');
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'brief' | 'archive' | 'paper'>('brief');
  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReportRecord | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((data) => {
        if (Array.isArray(data.reports)) {
          setSavedReports(data.reports);
          if (data.reports.length > 0 && !selectedReport) {
            setSelectedReport(data.reports[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveReport = async (
    title: string,
    authorMode: 'Deterministic' | 'AI-Assisted (Gemini)',
    markdown: string
  ) => {
    setSaveNotice(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          authorMode,
          datasetName: metadata.name,
          classification: metadata.classification,
          markdown,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.reports)) {
        setSavedReports(data.reports);
        setSelectedReport(data.report);
        setSaveNotice(`Saved "${title}" to Research Archive.`);
      } else {
        setSaveNotice(data.error || 'Unable to save report.');
      }
    } catch {
      setSaveNotice('Network error saving report.');
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.reports)) {
        setSavedReports(data.reports);
        if (selectedReport?.id === id) {
          setSelectedReport(data.reports[0] ?? null);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleGenerateAiBrief = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const payload = {
        provenance: {
          name: metadata.name,
          classification: metadata.classification,
          coverage: `${metadata.startDate} to ${metadata.endDate}`,
          tradingDays: metadata.tradingDays,
          securities: metadata.securityCount,
          validationStatus: validation.overallStatus,
        },
        marketSummary: {
          compositeReturnPct: Number((market.compositeIndexReturn * 100).toFixed(2)),
          advancers: market.advancers,
          decliners: market.decliners,
          pctAboveSma50: Number((market.pctAboveSma50 * 100).toFixed(1)),
          topSectors: market.sectors.slice(0, 3).map((s) => ({
            sector: s.sector,
            avgReturnPct: Number((s.avgPeriodReturn * 100).toFixed(2)),
            turnoverSharePct: Number((s.turnoverShare * 100).toFixed(1)),
          })),
        },
        topOpportunityRadar: opportunities.slice(0, 4).map((o) => ({
          rank: o.rank,
          ticker: o.ticker,
          score: o.compositeScore,
          uncertainty: o.uncertaintyLevel,
          missingDataPoints: o.missingDataPoints,
          contributions: o.dimensionContributions,
          keyRisks: o.keyRisks,
        })),
        kmriFindings: {
          stressWindow: kmri.stressWindow,
          topResilient: kmri.scores.slice(0, 3).map((k) => ({
            ticker: k.ticker,
            score: k.kmriScore,
            stressReturnPct: Number((k.stressPeriodReturn * 100).toFixed(2)),
          })),
          cohortComparison: kmri.stressCohortComparison.findingSummary,
          sensitivitySpearman: kmri.sensitivityAnalysis.map((s) => ({
            scheme: s.schemeName,
            rho: s.spearmanRhoVsBaseline,
          })),
        },
        backtestAudit: {
          oosPeriod: `${backtest.testStartDate} to ${backtest.testEndDate}`,
          txCostBps: backtest.config.transactionCostBps,
          netCumReturnPct: Number((backtest.strategyMetrics.cumulativeReturn * 100).toFixed(2)),
          benchmarkCumReturnPct: Number((backtest.benchmarkMetrics.cumulativeReturn * 100).toFixed(2)),
          netSharpe: Number(backtest.strategyMetrics.sharpeRatio.toFixed(2)),
          maxDrawdownPct: Number((backtest.strategyMetrics.maxDrawdown * 100).toFixed(2)),
        },
      };

      const res = await fetch('/api/research/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, focusTopic }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Failed to synthesize research brief.');
      } else {
        setAiBrief(data.brief);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Network error calling research brief service.');
    } finally {
      setAiLoading(false);
    }
  };

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Sub-Navigation */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Engine 06: Decision Intelligence & Research Studio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Converts quantitative outputs into reproducible, evidence-linked research briefs. AI synthesis never invents figures or issues BUY/SELL advice.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'brief'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Research Brief Generator
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'archive'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Saved Archive ({savedReports.length})
          </button>
          <button
            onClick={() => setActiveTab('paper')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'paper'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            22-Section Paper Architecture
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="px-4 py-2.5 border border-teal-300 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 text-xs text-teal-900 dark:text-teal-200">
          {saveNotice}
        </div>
      )}

      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Deterministic Brief (Always Available, Reproducible) */}
          <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Deterministic Evidence-Linked Brief
                </h3>
                <div className="text-xs text-slate-500">
                  100% computed directly from Engines 01–05 & KMRI
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleSaveReport(
                      `Deterministic Brief — ${metadata.endDate || 'Current'}`,
                      'Deterministic',
                      deterministicBrief
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() =>
                    downloadMarkdown(
                      deterministicBrief,
                      `rock-atlas-brief-${metadata.endDate || 'draft'}.md`
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Markdown</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-[560px] overflow-y-auto">
              {deterministicBrief}
            </pre>
          </div>

          {/* Grounded Gemini Synthesis */}
          <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Grounded AI Executive Narrative
              </h3>
              <div className="text-xs text-slate-500 mt-0.5">
                Server-side synthesis restricted strictly to verified quantitative payload
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                placeholder="Research focus topic..."
              />
              <button
                onClick={handleGenerateAiBrief}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{aiLoading ? 'Synthesizing...' : 'Generate AI Brief'}</span>
              </button>
            </div>

            {aiError && (
              <div className="p-3 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
                {aiError}
              </div>
            )}

            {aiBrief ? (
              <div className="space-y-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() =>
                      handleSaveReport(
                        focusTopic || 'AI Research Brief',
                        'AI-Assisted (Gemini)',
                        aiBrief
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1 text-xs border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save to Archive</span>
                  </button>
                  <button
                    onClick={() => downloadMarkdown(aiBrief, 'rock-atlas-ai-brief.md')}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export AI Brief</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-[480px] overflow-y-auto">
                  {aiBrief}
                </pre>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                Click "Generate AI Brief" to synthesize an institutional narrative grounded strictly in your current computed tables, KMRI stress findings, and backtest metrics.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Saved Research Briefs Repository
            </h3>
            {savedReports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6">
                No saved reports yet. Generate and save a Deterministic or AI-Assisted brief from the Research Brief Generator tab.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {savedReports.map((rpt) => (
                  <div
                    key={rpt.id}
                    className={`py-3 flex items-start justify-between gap-2 cursor-pointer px-2 -mx-2 ${
                      selectedReport?.id === rpt.id ? 'bg-teal-50/70 dark:bg-teal-950/30' : ''
                    }`}
                    onClick={() => setSelectedReport(rpt)}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {rpt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {rpt.authorMode} · {rpt.classification} · {rpt.createdAt.slice(0, 10)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(rpt.id);
                      }}
                      aria-label="Delete saved report"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            {selectedReport ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedReport.title}
                    </h3>
                    <div className="text-xs text-slate-500">
                      {selectedReport.datasetName} · {selectedReport.classification} · Saved{' '}
                      {new Date(selectedReport.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      downloadMarkdown(selectedReport.markdown, `${selectedReport.id}.md`)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-[540px] overflow-y-auto">
                  {selectedReport.markdown}
                </pre>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-10 text-center">
                Select a saved report on the left to inspect or export.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'paper' && (
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Structured Research Paper Outline (22 Sections)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Distinguishes completed framework architecture, synthetic software demonstrations, and pending empirical verification.
          </p>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {RESEARCH_PAPER_SECTIONS.map((sec) => (
              <div key={sec.num} className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <div className="md:col-span-4 font-semibold text-slate-900 dark:text-slate-100">
                  <span className="font-mono text-slate-500 mr-2">{sec.num}</span>
                  {sec.title}
                </div>
                <div className="md:col-span-3 font-medium text-teal-800 dark:text-teal-400">
                  {sec.status}
                </div>
                <div className="md:col-span-5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  {sec.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
