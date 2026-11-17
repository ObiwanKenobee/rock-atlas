import {
  MarketOverview,
  ParsedDataset,
  SectorPerformance,
  SecurityMarketSummary,
} from './types';
import { mean, sampleStd, simpleReturns, sma } from './mathUtils';

export function computeMarketIntelligence(dataset: ParsedDataset): MarketOverview {
  const summaries: SecurityMarketSummary[] = [];
  const alerts: MarketOverview['alerts'] = [];

  // Gather union of all dates for composite index calculation
  const dateSet = new Set<string>();
  for (const sec of dataset.securities) {
    for (const b of sec.bars) dateSet.add(b.date);
  }
  const allDates = Array.from(dateSet).sort();

  // Map ticker -> date -> bar
  const priceLookup = new Map<string, Map<string, { close: number; turnover: number }>>();

  for (const sec of dataset.securities) {
    const bars = sec.bars;
    if (bars.length < 2) continue;

    const map = new Map<string, { close: number; turnover: number }>();
    for (const b of bars) map.set(b.date, { close: b.close, turnover: b.turnover });
    priceLookup.set(sec.ticker, map);

    const closes = bars.map((b) => b.close);
    const vols = bars.map((b) => b.volume);
    const turns = bars.map((b) => b.turnover);
    const sma20Arr = sma(closes, 20);
    const sma50Arr = sma(closes, 50);

    const n = bars.length;
    const latest = bars[n - 1];
    const prev = bars[n - 2];
    const dailyReturn = prev.close > 0 ? latest.close / prev.close - 1 : 0;
    const idx20 = Math.max(0, n - 21);
    const idx60 = Math.max(0, n - 61);
    const return20d = bars[idx20].close > 0 ? latest.close / bars[idx20].close - 1 : 0;
    const return60d = bars[idx60].close > 0 ? latest.close / bars[idx60].close - 1 : 0;
    const ytdOrPeriodReturn = bars[0].close > 0 ? latest.close / bars[0].close - 1 : 0;

    const recent20Vols = vols.slice(Math.max(0, n - 21), n - 1);
    const avgVolume20d = recent20Vols.length > 0 ? mean(recent20Vols) : latest.volume;
    const volumeRatio = avgVolume20d > 0 ? latest.volume / avgVolume20d : 1;

    const recent20Turns = turns.slice(Math.max(0, n - 20));
    const avgTurnover20d = mean(recent20Turns);

    const foreignBars = bars.filter((b) => b.foreignTurnover !== null && b.turnover > 0);
    const foreignParticipationRatio =
      foreignBars.length > 0
        ? foreignBars.reduce((acc, b) => acc + (b.foreignTurnover ?? 0), 0) /
          foreignBars.reduce((acc, b) => acc + b.turnover, 0)
        : null;

    const sma20 = sma20Arr[n - 1];
    const sma50 = sma50Arr[n - 1];
    const aboveSma50 = sma50 !== null ? latest.close > sma50 : null;

    // Check unusual activity in the latest 5 trading sessions
    const rets = simpleReturns(closes);
    const retStd = sampleStd(rets);
    let unusualActivityFlag: string | null = null;

    for (let k = Math.max(20, n - 5); k < n; k++) {
      const b = bars[k];
      const windowVolMean = mean(vols.slice(Math.max(0, k - 20), k));
      const vRatio = windowVolMean > 0 ? b.volume / windowVolMean : 1;
      const dayRet = bars[k - 1].close > 0 ? b.close / bars[k - 1].close - 1 : 0;

      if (vRatio >= 2.2) {
        const msg = `${vRatio.toFixed(1)}x 20-day avg volume`;
        if (k === n - 1) unusualActivityFlag = msg;
        alerts.push({
          ticker: sec.ticker,
          date: b.date,
          type: 'Volume Spike',
          severity: vRatio >= 3.0 ? 'High' : 'Moderate',
          detail: `${sec.ticker} recorded ${vRatio.toFixed(2)}x average 20D volume (${b.volume.toLocaleString()} shares).`,
        });
      }
      if (retStd > 0 && Math.abs(dayRet) >= 2.5 * retStd) {
        const dir = dayRet > 0 ? '+' : '';
        if (k === n - 1 && !unusualActivityFlag) {
          unusualActivityFlag = `${dir}${(dayRet * 100).toFixed(1)}% price move`;
        }
        alerts.push({
          ticker: sec.ticker,
          date: b.date,
          type: 'Price Shock',
          severity: Math.abs(dayRet) >= 3.2 * retStd ? 'High' : 'Moderate',
          detail: `${sec.ticker} moved ${dir}${(dayRet * 100).toFixed(2)}% (${(Math.abs(dayRet) / retStd).toFixed(1)} sigma).`,
        });
      }
    }

    summaries.push({
      ticker: sec.ticker,
      name: sec.name,
      sector: sec.sector,
      latestDate: latest.date,
      latestClose: latest.close,
      prevClose: prev.close,
      dailyReturn,
      return20d,
      return60d,
      ytdOrPeriodReturn,
      sma20,
      sma50,
      aboveSma50,
      latestVolume: latest.volume,
      avgVolume20d,
      volumeRatio,
      latestTurnover: latest.turnover,
      avgTurnover20d,
      foreignParticipationRatio,
      unusualActivityFlag,
    });
  }

  // Build Equal-Weighted & Turnover-Weighted Composite Index normalized to 100
  const indexSeries: MarketOverview['indexSeries'] = [];
  let eqIdx = 100;
  let tvIdx = 100;

  for (let t = 0; t < allDates.length; t++) {
    const d = allDates[t];
    if (t === 0) {
      indexSeries.push({ date: d, equalWeightIndex: 100, turnoverWeightIndex: 100 });
      continue;
    }
    const prevD = allDates[t - 1];
    const eqRets: number[] = [];
    let weightedRetNum = 0;
    let weightedRetDen = 0;

    for (const sec of dataset.securities) {
      const m = priceLookup.get(sec.ticker);
      const curr = m?.get(d);
      const prev = m?.get(prevD);
      if (curr && prev && prev.close > 0) {
        const r = curr.close / prev.close - 1;
        eqRets.push(r);
        const w = Math.max(1, prev.turnover);
        weightedRetNum += r * w;
        weightedRetDen += w;
      }
    }

    const eqStep = eqRets.length > 0 ? mean(eqRets) : 0;
    const tvStep = weightedRetDen > 0 ? weightedRetNum / weightedRetDen : eqStep;
    eqIdx *= 1 + eqStep;
    tvIdx *= 1 + tvStep;
    indexSeries.push({
      date: d,
      equalWeightIndex: Number(eqIdx.toFixed(2)),
      turnoverWeightIndex: Number(tvIdx.toFixed(2)),
    });
  }

  // Sector breakdown
  const sectorMap = new Map<string, SecurityMarketSummary[]>();
  for (const s of summaries) {
    const arr = sectorMap.get(s.sector) ?? [];
    arr.push(s);
    sectorMap.set(s.sector, arr);
  }

  const totalUniverseTurnover = dataset.securities.reduce(
    (acc, sec) => acc + sec.bars.reduce((s, b) => s + b.turnover, 0),
    0
  );

  const sectors: SectorPerformance[] = [];
  for (const [sector, list] of sectorMap.entries()) {
    const sectorSeries = dataset.securities.filter((s) => s.sector === sector);
    const sectorTotalTurnover = sectorSeries.reduce(
      (acc, sec) => acc + sec.bars.reduce((s, b) => s + b.turnover, 0),
      0
    );
    const sectorVols = sectorSeries.map((sec) => {
      const rets = simpleReturns(sec.bars.map((b) => b.close));
      return sampleStd(rets) * Math.sqrt(252);
    });

    sectors.push({
      sector,
      securityCount: list.length,
      avgPeriodReturn: mean(list.map((x) => x.ytdOrPeriodReturn)),
      avgReturn20d: mean(list.map((x) => x.return20d)),
      totalPeriodTurnover: sectorTotalTurnover,
      turnoverShare: totalUniverseTurnover > 0 ? sectorTotalTurnover / totalUniverseTurnover : 0,
      avgVolatility: mean(sectorVols),
    });
  }
  sectors.sort((a, b) => b.avgPeriodReturn - a.avgPeriodReturn);

  const advancers = summaries.filter((s) => s.dailyReturn > 0.0005).length;
  const decliners = summaries.filter((s) => s.dailyReturn < -0.0005).length;
  const unchanged = summaries.length - advancers - decliners;
  const withSma50 = summaries.filter((s) => s.aboveSma50 !== null);
  const pctAboveSma50 =
    withSma50.length > 0
      ? withSma50.filter((s) => s.aboveSma50).length / withSma50.length
      : 0;

  const totalLatestTurnover = summaries.reduce((a, s) => a + s.latestTurnover, 0);
  const avgDailyUniverseTurnover = summaries.reduce((a, s) => a + s.avgTurnover20d, 0);
  const compositeIndexReturn =
    indexSeries.length > 0 ? indexSeries[indexSeries.length - 1].equalWeightIndex / 100 - 1 : 0;

  alerts.sort((a, b) => b.date.localeCompare(a.date));

  return {
    asOfDate: allDates[allDates.length - 1] ?? '',
    universeCount: summaries.length,
    advancers,
    decliners,
    unchanged,
    pctAboveSma50,
    totalLatestTurnover,
    avgDailyUniverseTurnover,
    compositeIndexReturn,
    indexSeries,
    securities: summaries,
    sectors,
    alerts: alerts.slice(0, 12),
  };
}
