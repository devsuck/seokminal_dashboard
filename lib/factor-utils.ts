import type { BarOut } from "@/lib/api";

export type FactorType = "momentum" | "volatility";

export interface InstrumentBars {
  instrumentId: string;
  bars: BarOut[];
}

export interface FactorValue {
  instrumentId: string;
  value: number | null;
  futureReturn: number | null;
}

export interface FactorResult {
  factorType: FactorType;
  lookback: number;
  horizon: number;
  computedAt: string;
  values: FactorValue[];
  ic: number | null;
}

function rankArray(arr: number[]): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  return arr.map(v => sorted.indexOf(v) + 1);
}

function spearmanIC(pairs: { value: number; futureReturn: number }[]): number | null {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const rankValue = rankArray(pairs.map(p => p.value));
  const rankFuture = rankArray(pairs.map(p => p.futureReturn));
  const meanR = (n + 1) / 2;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const dA = rankValue[i] - meanR;
    const dB = rankFuture[i] - meanR;
    num += dA * dB;
    denomA += dA * dA;
    denomB += dB * dB;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

function computeSampleStd(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeFactor(
  instruments: InstrumentBars[],
  factorType: FactorType,
  lookback: number,
  horizon: number,
): FactorResult {
  const values: FactorValue[] = instruments.map(inst => {
    const bars = [...inst.bars].sort((a, b) => a.ts_event - b.ts_event);
    // When horizon > 0, "now" is horizon bars before the last bar so that future data exists.
    const n = horizon > 0 ? bars.length - 1 - horizon : bars.length - 1;
    let value: number | null = null;
    let futureReturn: number | null = null;

    if (n < 0) return { instrumentId: inst.instrumentId, value: null, futureReturn: null };

    if (factorType === "momentum") {
      if (n >= lookback) {
        const px0 = bars[n - lookback].close;
        const pxN = bars[n].close;
        value = px0 !== 0 ? (pxN - px0) / px0 : null;
      }
    } else {
      // volatility
      if (n >= lookback) {
        const dailyReturns: number[] = [];
        for (let i = n - lookback + 1; i <= n; i++) {
          const prev = bars[i - 1].close;
          if (prev !== 0) dailyReturns.push((bars[i].close - prev) / prev);
        }
        if (dailyReturns.length > 0) {
          value = computeSampleStd(dailyReturns) * Math.sqrt(252);
        }
      }
    }

    if (horizon > 0 && n + horizon < bars.length) {
      const pxNow = bars[n].close;
      const pxFut = bars[n + horizon].close;
      futureReturn = pxNow !== 0 ? (pxFut - pxNow) / pxNow : null;
    } else if (horizon === 0) {
      futureReturn = null;
    }

    return { instrumentId: inst.instrumentId, value, futureReturn };
  });

  // Sort descending by value (nulls last)
  values.sort((a, b) => {
    if (a.value === null && b.value === null) return 0;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  // IC
  const pairs = values
    .filter((v): v is { instrumentId: string; value: number; futureReturn: number } =>
      v.value !== null && v.futureReturn !== null
    );
  const ic = spearmanIC(pairs);

  const computedAt = new Date().toISOString().slice(0, 10);
  return { factorType, lookback, horizon, computedAt, values, ic };
}
