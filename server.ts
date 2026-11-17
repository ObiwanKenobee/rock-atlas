import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const REPORTS_FILE = path.resolve(__dirname, 'reports', 'saved_reports.json');
const DATASETS_FILE = path.resolve(__dirname, 'data', 'processed', 'saved_datasets.json');

async function readJsonStore<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonStore<T>(filePath: string, data: T[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'rock-atlas-intelligence-server',
      timestamp: new Date().toISOString(),
    });
  });

  // Persistent Research Reports Archive
  app.get('/api/reports', async (_req, res) => {
    const reports = await readJsonStore(REPORTS_FILE);
    res.json({ reports });
  });

  app.post('/api/reports', async (req, res) => {
    const { title, authorMode, datasetName, classification, markdown } = req.body ?? {};
    if (!title || !markdown) {
      return res.status(400).json({ error: 'Report title and markdown content are required.' });
    }
    const reports = await readJsonStore<Record<string, unknown>>(REPORTS_FILE);
    const record = {
      id: `rpt-${Date.now()}`,
      title: String(title),
      authorMode: authorMode === 'AI-Assisted (Gemini)' ? 'AI-Assisted (Gemini)' : 'Deterministic',
      datasetName: String(datasetName || 'Unknown Dataset'),
      classification: String(classification || 'SYNTHETIC DATA'),
      createdAt: new Date().toISOString(),
      markdown: String(markdown),
    };
    const updated = [record, ...reports].slice(0, 30);
    await writeJsonStore(REPORTS_FILE, updated);
    res.status(201).json({ report: record, reports: updated });
  });

  app.delete('/api/reports/:id', async (req, res) => {
    const reports = await readJsonStore<{ id: string }>(REPORTS_FILE);
    const updated = reports.filter((r) => r.id !== req.params.id);
    await writeJsonStore(REPORTS_FILE, updated);
    res.json({ reports: updated });
  });

  // Persistent Datasets Registry
  app.get('/api/datasets', async (_req, res) => {
    const datasets = await readJsonStore(DATASETS_FILE);
    res.json({ datasets });
  });

  app.post('/api/datasets', async (req, res) => {
    const { name, source, classification, securityCount, tradingDays, csvText } = req.body ?? {};
    if (!name || !csvText) {
      return res.status(400).json({ error: 'Dataset name and csvText are required.' });
    }
    const datasets = await readJsonStore<{ id: string; name: string }>(DATASETS_FILE);
    const record = {
      id: `ds-${Date.now()}`,
      name: String(name),
      source: String(source || 'Uploaded CSV'),
      classification: String(classification || 'VERIFIED DATA'),
      savedAt: new Date().toISOString(),
      securityCount: Number(securityCount || 0),
      tradingDays: Number(tradingDays || 0),
      csvText: String(csvText),
    };
    const updated = [record, ...datasets.filter((d) => d.name !== record.name)].slice(0, 10);
    await writeJsonStore(DATASETS_FILE, updated);
    res.status(201).json({ dataset: record, datasets: updated });
  });

  app.delete('/api/datasets/:id', async (req, res) => {
    const datasets = await readJsonStore<{ id: string }>(DATASETS_FILE);
    const updated = datasets.filter((d) => d.id !== req.params.id);
    await writeJsonStore(DATASETS_FILE, updated);
    res.json({ datasets: updated });
  });

  app.post('/api/research/brief', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in environment secrets. Use the deterministic Research Brief export or configure GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const { payload, focusTopic } = req.body ?? {};
    if (!payload) {
      return res.status(400).json({ error: 'Missing quantitative payload for brief synthesis.' });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = [
        'You are the Senior Investment Research Analyst for ROCK ATLAS, an African Capital Markets Intelligence Platform focused on the Nairobi Securities Exchange (NSE).',
        'STRICT GROUNDING RULES:',
        '1. Use ONLY the quantitative metrics, dates, classifications, and warnings provided in the JSON payload.',
        '2. NEVER invent stock prices, financial ratios, historical events, citations, or returns not present in the payload.',
        '3. NEVER issue BUY or SELL instructions. Frame findings strictly as analytical research and decision support.',
        '4. Explicitly state the dataset classification (e.g. SYNTHETIC DATA vs VERIFIED DATA) in the first paragraph.',
        '5. Highlight missing data fields, model uncertainty, transaction cost assumptions, and methodology limitations.',
        'Format output in clean institutional Markdown (approx. 450-650 words) with sections: Executive Assessment, Opportunity Radar Synthesis, Resilience & Risk Dynamics, Predictive Backtest Evaluation, and Methodological Limitations.',
      ].join('\n');

      const prompt = `Focus Topic: ${focusTopic || 'Comprehensive Universe Research Brief'}\n\nVerified Quantitative Payload:\n${JSON.stringify(payload, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const briefText = response.text;
      if (!briefText) {
        return res.status(502).json({ error: 'Empty response returned by language model.' });
      }

      return res.json({
        brief: briefText,
        model: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown upstream AI error';
      console.error('Gemini brief error:', message);
      return res.status(500).json({ error: `AI brief synthesis failed: ${message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ROCK ATLAS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
