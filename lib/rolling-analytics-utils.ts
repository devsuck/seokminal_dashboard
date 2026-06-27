export interface RollingPoint {
  ts_ns: number;
  value: number | null;
}

export function computeRollingVolatility(
  dailyReturns: number[],
  window: number,
): (number | null)[] {
  const n = dailyReturns.length;
  const result: (number | null)[] = Array(n).fill(null);
  for (let i = window - 1; i < n; i++) {
    const slice = dailyReturns.slice(i - window + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / window;
    const variance =
      window <= 1
        ? 0
        : slice.reduce((s, v) => s + (v - mean) ** 2, 0) / (window - 1);
    result[i] = Math.sqrt(variance) * Math.sqrt(252);
  }
  return result;
}

export function zipRollingPoints(
  tsNsArray: number[],
  values: (number | null)[],
): RollingPoint[] {
  return tsNsArray.map((ts_ns, i) => ({ ts_ns, value: values[i] ?? null }));
}
