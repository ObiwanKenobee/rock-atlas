export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

export function downsideDeviation(returns: number[], threshold = 0): number {
  if (returns.length < 2) return 0;
  let sumSq = 0;
  for (let i = 0; i < returns.length; i++) {
    const diff = Math.min(0, returns[i] - threshold);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / returns.length);
}

export function simpleReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      out.push(prices[i] / prices[i - 1] - 1);
    } else {
      out.push(0);
    }
  }
  return out;
}

export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      out.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      out.push(0);
    }
  }
  return out;
}

export function sma(values: number[], window: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (window <= 0) return out;
  let runningSum = 0;
  for (let i = 0; i < values.length; i++) {
    runningSum += values[i];
    if (i >= window) {
      runningSum -= values[i - window];
    }
    if (i >= window - 1) {
      out[i] = runningSum / window;
    }
  }
  return out;
}

export interface DrawdownStats {
  maxDrawdown: number;
  maxDrawdownStart: string;
  maxDrawdownTrough: string;
  maxDrawdownDurationDays: number;
  recoveryDays: number | null;
  series: Array<{ date: string; drawdown: number }>;
}

export function computeDrawdowns(dates: string[], prices: number[]): DrawdownStats {
  if (prices.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownStart: '',
      maxDrawdownTrough: '',
      maxDrawdownDurationDays: 0,
      recoveryDays: null,
      series: [],
    };
  }

  let peak = prices[0];
  let peakIdx = 0;
  let maxDd = 0;
  let bestPeakIdx = 0;
  let bestTroughIdx = 0;

  let currentDuration = 0;
  let maxDuration = 0;

  const series: Array<{ date: string; drawdown: number }> = [];

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] >= peak) {
      peak = prices[i];
      peakIdx = i;
      currentDuration = 0;
    } else {
      currentDuration = i - peakIdx;
      if (currentDuration > maxDuration) {
        maxDuration = currentDuration;
      }
    }
    const dd = peak > 0 ? prices[i] / peak - 1 : 0;
    series.push({ date: dates[i], drawdown: dd });
    if (dd < maxDd) {
      maxDd = dd;
      bestPeakIdx = peakIdx;
      bestTroughIdx = i;
    }
  }

  // Find recovery from bestTroughIdx back to prices[bestPeakIdx]
  let recoveryDays: number | null = null;
  const peakPrice = prices[bestPeakIdx];
  for (let j = bestTroughIdx + 1; j < prices.length; j++) {
    if (prices[j] >= peakPrice) {
      recoveryDays = j - bestTroughIdx;
      break;
    }
  }

  return {
    maxDrawdown: maxDd,
    maxDrawdownStart: dates[bestPeakIdx] ?? '',
    maxDrawdownTrough: dates[bestTroughIdx] ?? '',
    maxDrawdownDurationDays: maxDuration,
    recoveryDays,
    series,
  };
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dxSq = 0;
  let dySq = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dxSq += dx * dx;
    dySq += dy * dy;
  }
  const denom = Math.sqrt(dxSq * dySq);
  return denom === 0 ? 0 : num / denom;
}

export function spearmanRankCorrelation(ranksA: number[], ranksB: number[]): number {
  return pearsonCorrelation(ranksA, ranksB);
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function minMaxNormalize(values: number[], higherIsBetter = true): number[] {
  if (values.length === 0) return [];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  if (maxVal === minVal) return values.map(() => 50);
  return values.map((v) => {
    const norm = ((v - minVal) / (maxVal - minVal)) * 100;
    return higherIsBetter ? norm : 100 - norm;
  });
}

/**
 * Solves Ridge Regression (X^T X + lambda I) beta = X^T y via Gaussian elimination.
 * X rows should include intercept column 1.0 as feature 0 (not penalized).
 */
export function fitRidgeRegression(
  X: number[][],
  y: number[],
  lambda = 1.0
): number[] {
  const n = X.length;
  if (n === 0 || X[0].length === 0) return [];
  const p = X[0].length;

  const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const b: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      b[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) {
        A[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  for (let j = 1; j < p; j++) {
    A[j][j] += lambda;
  }

  // Augment [A | b]
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) {
        pivot = r;
      }
    }
    if (Math.abs(M[pivot][col]) < 1e-12) continue;
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const div = M[col][col];
    for (let k = col; k <= p; k++) M[col][k] /= div;

    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let k = col; k <= p; k++) {
        M[r][k] -= factor * M[col][k];
      }
    }
  }

  return M.map((row) => row[p]);
}
