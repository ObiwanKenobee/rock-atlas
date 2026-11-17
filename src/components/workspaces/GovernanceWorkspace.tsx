import React, { useEffect, useRef, useState } from 'react';
import {
  DataClassification,
  DatasetMetadata,
  ParsedDataset,
  SavedDatasetRecord,
  ValidationReport,
} from '../../engines/types';
import { exportDatasetToCsv, generateCsvTemplate } from '../../engines/dataGovernance';
import { PROJECT_STATUS_LEDGER } from '../../engines/researchContent';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';

interface GovernanceWorkspaceProps {
  dataset: ParsedDataset;
  metadata: DatasetMetadata;
  validation: ValidationReport;
  onUploadCsv: (
    csvText: string,
    fileName: string,
    sourceLabel: string,
    classification: DataClassification
  ) => void;
  onResetSynthetic: () => void;
  uploadError: string | null;
}

export const GovernanceWorkspace: React.FC<GovernanceWorkspaceProps> = ({
  dataset,
  metadata,
  validation,
  onUploadCsv,
  onResetSynthetic,
  uploadError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceLabel, setSourceLabel] = useState('Rock Data Plus NSE Export');
  const [uploadClass, setUploadClass] = useState<DataClassification>('VERIFIED DATA');
  const [savedDatasets, setSavedDatasets] = useState<SavedDatasetRecord[]>([]);

  const refreshSavedDatasets = () => {
    fetch('/api/datasets')
      .then((r) => (r.ok ? r.json() : { datasets: [] }))
      .then((d) => {
        if (Array.isArray(d.datasets)) setSavedDatasets(d.datasets);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshSavedDatasets();
  }, [dataset.metadata.datasetId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      onUploadCsv(text, file.name, sourceLabel, uploadClass);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([generateCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rock-atlas-nse-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActiveCsv = () => {
    const csv = exportDatasetToCsv(dataset);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.datasetId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSavedDataset = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.datasets)) {
        setSavedDatasets(data.datasets);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Dataset Ingestion & Provenance Switcher */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Data Ingestion & Provenance Governance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Import verified Rock Data Plus or NSE CSV datasets directly into all six analytical engines, or export the active corpus.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV Template</span>
            </button>
            <button
              onClick={handleExportActiveCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Active CSV</span>
            </button>
            <button
              onClick={onResetSynthetic}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Load Synthetic Demo</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border-t border-slate-200 dark:border-slate-800 pt-4 text-xs">
          <div className="md:col-span-5">
            <label className="block text-slate-500 mb-1">Dataset Source Attribution</label>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-slate-500 mb-1">Provenance Classification</label>
            <select
              value={uploadClass}
              onChange={(e) => setUploadClass(e.target.value as DataClassification)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="VERIFIED DATA">VERIFIED DATA (Authorized Source)</option>
              <option value="ESTIMATED DATA">ESTIMATED DATA (Derived Series)</option>
              <option value="SYNTHETIC DATA">SYNTHETIC DATA (Test Corpus)</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-1.5 font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import CSV Dataset</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mt-3 p-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-300">
            CSV Ingestion Error: {uploadError}
          </div>
        )}

        {savedDatasets.length > 0 && (
          <div className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Persisted Uploaded Datasets ({savedDatasets.length})
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {savedDatasets.map((sd) => (
                <div key={sd.id} className="py-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{sd.name}</span>
                    <span className="text-slate-500 ml-2 font-mono">
                      {sd.classification} · {sd.securityCount} securities · {sd.tradingDays} days
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        onUploadCsv(sd.csvText, sd.name, sd.source, sd.classification)
                      }
                      className="px-2.5 py-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => handleDeleteSavedDataset(sd.id)}
                      aria-label="Delete saved dataset"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Dataset Metadata & 10-Point Validation Suite */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Active Dataset Provenance Card
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              ['Classification', metadata.classification],
              ['Dataset Name', metadata.name],
              ['Source', metadata.source],
              ['Acquisition Date', metadata.acquisitionDate],
              ['Historical Coverage', `${metadata.startDate} to ${metadata.endDate}`],
              ['Dimensions', `${metadata.securityCount} securities · ${metadata.tradingDays} days · ${metadata.totalRows} rows`],
              ['Currency & Units', `${metadata.currency} · ${metadata.units}`],
              ['Frequency', metadata.frequency],
            ].map(([k, v]) => (
              <div key={k} className="py-2 flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">{k}</span>
                <span className="text-right font-mono text-slate-900 dark:text-slate-100">
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-xs space-y-1.5">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Disclosed Limitations
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
              {metadata.limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                10-Point Data Quality Validation Suite
              </h3>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Status: {validation.overallStatus} · {validation.validRowsRetained}/{validation.totalRowsInspected} rows retained
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {validation.checks.map((chk) => (
              <div key={chk.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{chk.name}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{chk.summary}</div>
                  {chk.sampleDetails.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      Samples: {chk.sampleDetails.join(' | ')}
                    </div>
                  )}
                </div>
                <span
                  className={`font-mono font-semibold shrink-0 ${
                    chk.status === 'PASS'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : chk.status === 'WARN'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {chk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Status Ledger */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          ROCK ATLAS Project Status Ledger & Acceptance Criteria Audit
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Honest separation of implemented quantitative software vs empirical validation pending verified Rock Data Plus datasets.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3 font-medium">Phase</th>
                <th className="py-2 px-2 font-medium">Deliverable</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 pl-2 font-medium">Verification Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {PROJECT_STATUS_LEDGER.map((item) => (
                <tr key={item.deliverable}>
                  <td className="py-2.5 pr-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.phase}
                  </td>
                  <td className="py-2.5 px-2 font-medium text-slate-900 dark:text-slate-100">
                    {item.deliverable}
                  </td>
                  <td
                    className={`py-2.5 px-2 font-mono font-semibold whitespace-nowrap ${
                      item.status === 'Completed'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : item.status === 'Blocked / Pending Data'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.status}
                  </td>
                  <td className="py-2.5 pl-2 text-slate-600 dark:text-slate-300">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
