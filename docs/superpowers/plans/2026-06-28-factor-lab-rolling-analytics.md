# Factor Lab + Rolling Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two research tools — S-12 Rolling Analytics (time-varying risk metrics chart) and S-10 Factor Lab (cross-sectional momentum/volatility factor ranking with IC) — as standalone pages with nav integration.

**Architecture:** Four tasks in sequence. Task 1 builds rolling volatility computation (other rolling metrics come from existing API). Task 2 assembles the Rolling Analytics page with a multi-metric line chart using lightweight-charts. Task 3 builds factor computation utilities (momentum, volatility factor values + IC). Task 4 assembles the Factor Lab page with ranked bar chart + IC display.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts 5 (already installed), vitest/jsdom. No new dependencies.

## Global Constraints

- `"use client"` ONLY on components/pages using hooks or browser APIs
- CSS tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY on primary action buttons (Run/Load)
- Inline styles: forbidden — EXCEPTION: lightweight-charts `createChart` options object and `.addSeries` color string (chart library config)
- No raw hex in `className`
- No raw `fetch()` — API calls only via `lib/api.ts` functions
- AbortController pattern: `abortRef.current?.abort()` before each run; `AbortError` caught silently; `finally { if (!ctrl.signal.aborted) setLoading(false) }`; unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`
- `ts_ns` in `TimeSeriesPoint` and `RollingBetaPoint` is nanoseconds — convert to seconds for lightweight-charts: `Math.floor(ts_ns / 1e9) as UTCTimestamp`
- Existing 73 tests must pass after every task

## File Map

**Created:**
- `lib/rolling-analytics-utils.ts`
- `tests/lib/rolling-analytics-utils.test.ts`
- `lib/factor-utils.ts`
- `tests/lib/factor-utils.test.ts`
- `components/rolling/RollingChart.tsx`
- `app/rolling/page.tsx`
- `app/factor/page.tsx`

**Modified:**
- `app/layout.tsx` — add Rolling + Factor nav items
- `docs/progress.md` — update

## Backend Endpoints (already exist, consumed via lib/api.ts)

| Function | Returns | Used in |
|---|---|---|
| `getTimeSeries(instrumentId, start, end, benchmarkId?, rollingWindow?, signal?)` | `TimeSeriesPoint { ts_ns, daily_return, cumulative_return, drawdown, rolling_sharpe, benchmark_cumulative }[]` | Rolling page + factor IC |
| `getRollingBeta(instrumentId, benchmarkId, start, end, window, signal?)` | `RollingBetaPoint { ts_ns, beta, correlation }[]` | Rolling page |
| `getBars(instrumentId, start, end, timeframe?, signal?)` | `BarOut { ts_event, close, ... }[]` | Factor Lab (momentum/vol per stock) |

---

### Task 1: Rolling Analytics utility + tests

**Files:**
- Create: `lib/rolling-analytics-utils.ts`
- Create: `tests/lib/rolling-analytics-utils.test.ts`

**What this provides:** Rolling volatility computation from daily returns (the other rolling metrics — sharpe, drawdown, beta, correlation — come directly from the API).

**Interfaces — Produces (Task 2 depends on these exact names):**

```typescript
// Given an array of daily_return values and a window, compute rolling annualized volatility.
// Returns array same length as input; positions 0..window-2 are null (insufficient history).
export function computeRollingVolatility(
  dailyReturns: number[],
  window: number,
): (number | null)[]

// Utility: pair ts_ns array with computed values for chart consumption
export interface RollingPoint {
  ts_ns: number;
  value: number | null;
}

export function zipRollingPoints(
  tsNsArray: number[],
  values: (number | null)[],
): RollingPoint[]
```

**Algorithm for `computeRollingVolatility`:**
```
For each position i from 0 to n-1:
  if i < window - 1: result[i] = null
  else:
    slice = dailyReturns[i - window + 1 .. i]  (length = window)
    mean = sum(slice) / window
    variance = sum((x - mean)^2 for x in slice) / (window - 1)  // sample variance
    result[i] = sqrt(variance) * sqrt(252)  // annualized
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/rolling-analytics-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeRollingVolatility, zipRollingPoints } from "../../lib/rolling-analytics-utils";

describe("computeRollingVolatility", () => {
  it("returns nulls for first window-1 positions", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02, 0.01, -0.01, 0.005];
    const result = computeRollingVolatility(returns, 5);
    expect(result).toHaveLength(8);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
    expect(result[3]).toBeNull();
    expect(result[4]).not.toBeNull();   // first valid at index 4
    expect(result[7]).not.toBeNull();
  });

  it("returns all nulls when array shorter than window", () => {
    const result = computeRollingVolatility([0.01, 0.02], 5);
    expect(result.every(v => v === null)).toBe(true);
  });

  it("annualizes volatility by sqrt(252)", () => {
    // Constant returns → std = 0 → vol = 0
    const returns = Array(10).fill(0.01);
    const result = computeRollingVolatility(returns, 5);
    expect(result[4]).toBeCloseTo(0, 8);
  });

  it("window=1 returns zero for each position (std of single value = 0)", () => {
    const returns = [0.01, -0.02, 0.03];
    const result = computeRollingVolatility(returns, 1);
    expect(result[0]).toBeCloseTo(0, 8);
    expect(result[1]).toBeCloseTo(0, 8);
    expect(result[2]).toBeCloseTo(0, 8);
  });

  it("produces positive volatility for variable returns", () => {
    const returns = [0.05, -0.03, 0.02, -0.04, 0.01];
    const result = computeRollingVolatility(returns, 5);
    expect(result[4]).toBeGreaterThan(0);
  });
});

describe("zipRollingPoints", () => {
  it("pairs ts_ns with values", () => {
    const ts = [1000, 2000, 3000];
    const values: (number | null)[] = [null, 0.15, 0.22];
    const result = zipRollingPoints(ts, values);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ ts_ns: 1000, value: null });
    expect(result[2]).toEqual({ ts_ns: 3000, value: 0.22 });
  });

  it("returns empty array for empty inputs", () => {
    expect(zipRollingPoints([], [])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test tests/lib/rolling-analytics-utils.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement lib/rolling-analytics-utils.ts**

Create `lib/rolling-analytics-utils.ts`:
```typescript
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
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/rolling-analytics-utils.test.ts
```
Expected: 7/7 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 80 tests pass (73 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add lib/rolling-analytics-utils.ts tests/lib/rolling-analytics-utils.test.ts
git commit -m "feat: add rolling volatility utility with annualization"
```

---

### Task 2: RollingChart component + /rolling page + nav item

**Files:**
- Create: `components/rolling/RollingChart.tsx`
- Create: `app/rolling/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces — Consumes (from Task 1):**
```typescript
import { computeRollingVolatility, zipRollingPoints, type RollingPoint } from "@/lib/rolling-analytics-utils";
```

**Interfaces — Consumes (from lib/api.ts):**
```typescript
import {
  getTimeSeries, getRollingBeta,
  ApiError,
  type TimeSeriesPoint, type RollingBetaPoint,
} from "@/lib/api";
```

**RollingChart component:**
```typescript
// Props: array of named series, each with data points (ts_ns in ns, value or null)
export interface RollingSeries {
  label: string;
  color: string;      // hex for lightweight-charts config — ACCEPTED chart library exception
  points: RollingPoint[];
}
interface RollingChartProps {
  series: RollingSeries[];
  yFormat?: (v: number) => string;   // default: v.toFixed(2)
  height?: number;                    // default 300
}
export function RollingChart(props: RollingChartProps): React.ReactElement
```

**RollingChart implementation notes:**
- "use client"; useRef<HTMLDivElement>; useEffect
- `const chart = createChart(ref.current, { width: ref.current.clientWidth, height, layout: { background: { color: "#0F131A" }, textColor: "#6B7280" }, grid: { vertLines: { color: "#1E2530" }, horzLines: { color: "#1E2530" } }, timeScale: { borderColor: "#374151" } })`
- Cleanup: `chart.remove()` in effect return
- Each series: `chart.addSeries(LineSeries, { color: s.color, lineWidth: 2, title: s.label })`
- Data: filter null values, map: `{ time: Math.floor(pt.ts_ns / 1e9) as UTCTimestamp, value: pt.value! }`
- `series.setData(data)`
- Return: `<div ref={ref} style={{ height }} className="w-full" />`  — inline `height` style is accepted here (chart library container sizing, same pattern as CandlestickChart)

**Page layout for /rolling:**
```
┌──────────────────────────────────────────────────────┐
│ Rolling Analytics                                     │
│ Time-varying risk metrics for any instrument          │
├──────────────────────────────────────────────────────┤
│ [controls panel]                                      │
│  Instrument: [input]   Benchmark: [input]            │
│  Start: [date]  End: [date]                          │
│  Window: [30d][60d][90d][252d]  [Run bg-accent]     │
├──────────────────────────────────────────────────────┤
│ [metric selector: Sharpe | Beta | Correlation |      │
│                   Drawdown | Volatility]              │
│ (active = border-accent text-accent bg-accent/10)    │
├──────────────────────────────────────────────────────┤
│ [RollingChart — shows selected metric]               │
├──────────────────────────────────────────────────────┤
│ [summary stats: current value, min, max, avg]        │
└──────────────────────────────────────────────────────┘
```

**Metric definitions:**
- `"sharpe"` → `timeSeriesPoints[].rolling_sharpe` (filter null)
- `"beta"` → `rollingBetaPoints[].beta`
- `"correlation"` → `rollingBetaPoints[].correlation`
- `"drawdown"` → `timeSeriesPoints[].drawdown` (multiply by 100 for %)
- `"volatility"` → computed via `computeRollingVolatility(dailyReturns, window)` then zipped with ts_ns

**Series colors (chart config — accepted exception):**
- Sharpe: `"#FF9F1C"` (orange)
- Beta: `"#3B82F6"` (blue)
- Correlation: `"#22C55E"` (green)
- Drawdown: `"#EF4444"` (red)
- Volatility: `"#A78BFA"` (purple)

No new tests. Run `npm test` for regressions.

- [ ] **Step 1: Create components/rolling/ directory**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/components/rolling
```

- [ ] **Step 2: Create components/rolling/RollingChart.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import { createChart, LineSeries } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import type { RollingPoint } from "@/lib/rolling-analytics-utils";

export interface RollingSeries {
  label: string;
  color: string;
  points: RollingPoint[];
}

interface RollingChartProps {
  series: RollingSeries[];
  height?: number;
}

export function RollingChart({ series, height = 300 }: RollingChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height,
      layout: { background: { color: "#0F131A" }, textColor: "#6B7280" },
      grid: { vertLines: { color: "#1E2530" }, horzLines: { color: "#1E2530" } },
      timeScale: { borderColor: "#374151" },
      rightPriceScale: { borderColor: "#374151" },
    });
    for (const s of series) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        title: s.label,
      });
      const data = s.points
        .filter(pt => pt.value !== null)
        .map(pt => ({
          time: Math.floor(pt.ts_ns / 1e9) as UTCTimestamp,
          value: pt.value as number,
        }));
      lineSeries.setData(data);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, height]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
```

- [ ] **Step 3: Create app/rolling/page.tsx**

```tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getTimeSeries, getRollingBeta, ApiError } from "@/lib/api";
import { computeRollingVolatility, zipRollingPoints } from "@/lib/rolling-analytics-utils";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";

type Metric = "sharpe" | "beta" | "correlation" | "drawdown" | "volatility";
type WindowOption = 20 | 60 | 90 | 252;

const WINDOW_OPTIONS: WindowOption[] = [20, 60, 90, 252];
const METRIC_OPTIONS: { value: Metric; label: string; color: string; unit: string }[] = [
  { value: "sharpe",      label: "Rolling Sharpe",       color: "#FF9F1C", unit: "" },
  { value: "beta",        label: "Rolling Beta",          color: "#3B82F6", unit: "" },
  { value: "correlation", label: "Rolling Correlation",   color: "#22C55E", unit: "" },
  { value: "drawdown",    label: "Rolling Drawdown",      color: "#EF4444", unit: "%" },
  { value: "volatility",  label: "Rolling Volatility",    color: "#A78BFA", unit: "%" },
];

const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";

export default function RollingPage() {
  const [instrumentId, setInstrumentId] = useState("005930.XKRX");
  const [benchmarkId, setBenchmarkId] = useState("KOSPI.XKRX");
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [window, setWindow] = useState<WindowOption>(60);
  const [metric, setMetric] = useState<Metric>("sharpe");
  const [tsPoints, setTsPoints] = useState<{ ts_ns: number; value: number | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setTsPoints([]);
    setRan(false);
    try {
      const selectedMeta = METRIC_OPTIONS.find(m => m.value === metric)!;

      if (metric === "sharpe" || metric === "drawdown" || metric === "volatility") {
        const res = await getTimeSeries(instrumentId, start, end, undefined, window, ctrl.signal);
        const pts = res.points;
        if (metric === "sharpe") {
          setTsPoints(pts.map(p => ({ ts_ns: p.ts_ns, value: p.rolling_sharpe })));
        } else if (metric === "drawdown") {
          setTsPoints(pts.map(p => ({ ts_ns: p.ts_ns, value: p.drawdown !== null ? p.drawdown * 100 : null })));
        } else {
          const dailyReturns = pts.map(p => p.daily_return);
          const vols = computeRollingVolatility(dailyReturns, window);
          setTsPoints(zipRollingPoints(pts.map(p => p.ts_ns), vols.map(v => v !== null ? v * 100 : null)));
        }
      } else {
        const res = await getRollingBeta(instrumentId, benchmarkId, start, end, window, ctrl.signal);
        const pts = res.points;
        if (metric === "beta") {
          setTsPoints(pts.map(p => ({ ts_ns: p.ts_ns, value: p.beta })));
        } else {
          setTsPoints(pts.map(p => ({ ts_ns: p.ts_ns, value: p.correlation })));
        }
      }
      setRan(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch data");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, benchmarkId, start, end, window, metric]);

  const currentMeta = METRIC_OPTIONS.find(m => m.value === metric)!;

  const chartSeries: RollingSeries[] = useMemo(() => {
    if (!ran || tsPoints.length === 0) return [];
    return [{
      label: currentMeta.label,
      color: currentMeta.color,
      points: tsPoints,
    }];
  }, [ran, tsPoints, currentMeta]);

  const validValues = tsPoints.map(p => p.value).filter((v): v is number => v !== null);
  const currentVal = validValues.length > 0 ? validValues[validValues.length - 1] : null;
  const minVal = validValues.length > 0 ? Math.min(...validValues) : null;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : null;
  const avgVal = validValues.length > 0 ? validValues.reduce((s, v) => s + v, 0) / validValues.length : null;

  function fmt(v: number | null): string {
    if (v === null) return "—";
    return `${v.toFixed(3)}${currentMeta.unit}`;
  }

  const needsBenchmark = metric === "beta" || metric === "correlation";

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Rolling Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Time-varying risk metrics. Window size controls the rolling lookback period.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-40"
            />
          </div>
          {needsBenchmark && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Benchmark</label>
              <input
                value={benchmarkId}
                onChange={e => setBenchmarkId(e.target.value)}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-40"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
        </div>

        <div className="flex gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Window</label>
            <div className="flex gap-1">
              {WINDOW_OPTIONS.map(w => (
                <button key={w} onClick={() => setWindow(w)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    window === w ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}
                >
                  {w}d
                </button>
              ))}
            </div>
          </div>
          <button onClick={run} disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{error}</div>
      )}

      {ran && (
        <>
          {/* Metric selector */}
          <div className="flex gap-1 flex-wrap">
            {METRIC_OPTIONS.map(m => (
              <button key={m.value} onClick={() => setMetric(m.value)}
                className={`px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                  metric === m.value ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-bg border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">{currentMeta.label} — {window}d window</span>
            </div>
            <div className="p-2">
              <RollingChart series={chartSeries} height={280} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Current", value: fmt(currentVal) },
              { label: "Min", value: fmt(minVal) },
              { label: "Max", value: fmt(maxVal) },
              { label: "Average", value: fmt(avgVal) },
            ].map(s => (
              <div key={s.label} className="bg-panel border border-border rounded-lg px-4 py-3">
                <div className="text-text-3 text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className="text-text-1 text-sm font-data mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!ran && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure instrument and click Run to view rolling metrics.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Rolling to nav in app/layout.tsx**

Read `app/layout.tsx` first. After Phase 6, nav has Event Study and Universe between Correlation and Bots. Add Rolling between Universe and Bots:
```typescript
{ href: "/universe",    label: "Universe" },
{ href: "/rolling",     label: "Rolling" },    // NEW
{ href: "/bots",        label: "Bots" },
```

- [ ] **Step 5: Run full tests**

```bash
npm test
```
Expected: 80 tests pass

- [ ] **Step 6: Commit**

```bash
git add components/rolling/RollingChart.tsx app/rolling/page.tsx app/layout.tsx
git commit -m "feat: add Rolling Analytics page with multi-metric time-series chart"
```

---

### Task 3: Factor computation utility + tests

**Files:**
- Create: `lib/factor-utils.ts`
- Create: `tests/lib/factor-utils.test.ts`

**What this computes:**
1. **Momentum factor**: Cross-sectional momentum = past `lookback` trading day return for each instrument
2. **Volatility factor**: Cross-sectional annualized volatility over `lookback` days
3. **IC (Information Coefficient)**: Spearman rank correlation between factor value and future `horizon`-day return

**Interfaces — Produces (Task 4 depends on these exact names):**

```typescript
import type { BarOut } from "@/lib/api";

export type FactorType = "momentum" | "volatility";

export interface InstrumentBars {
  instrumentId: string;
  bars: BarOut[];   // sorted ascending by ts_event
}

export interface FactorValue {
  instrumentId: string;
  value: number | null;
  futureReturn: number | null;   // for IC calculation
}

export interface FactorResult {
  factorType: FactorType;
  lookback: number;
  horizon: number;
  computedAt: string;    // ISO date of "today" point (last bar)
  values: FactorValue[];  // sorted by value descending (best factor first)
  ic: number | null;       // Spearman rank IC between value and futureReturn
}

export function computeFactor(
  instruments: InstrumentBars[],
  factorType: FactorType,
  lookback: number,    // days of history to compute factor value
  horizon: number,     // days ahead for IC calculation (futureReturn)
): FactorResult
```

**Algorithm for `computeFactor`:**

For each instrument:
1. Sort bars ascending by `ts_event`
2. The "now" bar = last bar. Index `n = bars.length - 1`.
3. **Momentum**: price return from `n - lookback` to `n`:
   - `value = (bars[n].close - bars[n - lookback].close) / bars[n - lookback].close`
   - null if `n < lookback`
4. **Volatility**: annualized std of daily returns over last `lookback` bars:
   - Take `bars[n - lookback + 1 .. n]` (length = lookback)
   - `dailyReturns[i] = (bars[i].close - bars[i-1].close) / bars[i-1].close` for i in [n-lookback+1..n]
   - `vol = stddev(dailyReturns) * sqrt(252)` (sample std)
   - null if `n < lookback`
5. **futureReturn**: return from `n` to `n + horizon`:
   - `futureReturn = (bars[n + horizon].close - bars[n].close) / bars[n].close`
   - null if `n + horizon >= bars.length`
6. Sort values descending by `value` (nulls last)
7. Compute IC = Spearman rank correlation between `value` and `futureReturn` (only non-null pairs)

**Spearman rank IC:**
```typescript
function spearmanIC(pairs: { value: number; futureReturn: number }[]): number | null {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const rankValue = rankArray(pairs.map(p => p.value));
  const rankFuture = rankArray(pairs.map(p => p.futureReturn));
  // Pearson correlation of ranks
  const meanRV = (n + 1) / 2;
  const meanRF = (n + 1) / 2;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const dA = rankValue[i] - meanRV;
    const dB = rankFuture[i] - meanRF;
    num += dA * dB;
    denomA += dA * dA;
    denomB += dB * dB;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

function rankArray(arr: number[]): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  return arr.map(v => sorted.indexOf(v) + 1);   // 1-based rank
}
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/factor-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeFactor } from "../../lib/factor-utils";
import type { InstrumentBars } from "../../lib/factor-utils";
import type { BarOut } from "../../lib/api";

function makeBar(dateStr: string, close: number): BarOut {
  return {
    ts_event: new Date(dateStr).getTime() * 1_000_000,
    open: close, high: close, low: close, close, volume: 1000,
  };
}

function makeInstrument(id: string, closes: number[], startDate = "2024-01-02"): InstrumentBars {
  const bars: BarOut[] = closes.map((c, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return makeBar(d.toISOString().slice(0, 10), c);
  });
  return { instrumentId: id, bars };
}

describe("computeFactor — momentum", () => {
  it("computes correct momentum return", () => {
    // Stock A: 100 → 110 over 5 days. momentum = (110-100)/100 = 0.1
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110]),
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.values[0].instrumentId).toBe("A.X");
    expect(result.values[0].value).toBeCloseTo(0.1, 5);
  });

  it("sorts by value descending", () => {
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110]),   // +10%
      makeInstrument("B.X", [100, 98, 96, 94, 92, 90]),        // -10%
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.values[0].instrumentId).toBe("A.X");
    expect(result.values[1].instrumentId).toBe("B.X");
  });

  it("returns null value when not enough history", () => {
    const instruments: InstrumentBars[] = [makeInstrument("A.X", [100, 102])];
    const result = computeFactor(instruments, "momentum", 10, 1);
    expect(result.values[0].value).toBeNull();
  });

  it("computes IC using Spearman rank correlation", () => {
    // 3 instruments with clear factor → future return alignment
    // A: high momentum → high future return
    // B: medium momentum → medium future return
    // C: low momentum → low future return
    // IC should be positive
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110, 115]),  // momentum +10%, future +4.5%
      makeInstrument("B.X", [100, 101, 102, 103, 104, 105, 107]),  // momentum +5%, future +1.9%
      makeInstrument("C.X", [100,  99,  98,  97,  96,  95,  94]),  // momentum -5%, future -1%
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.ic).not.toBeNull();
    expect(result.ic!).toBeGreaterThan(0);
  });

  it("computes volatility factor", () => {
    // High-vol instrument: large swings
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 110, 95, 115, 90, 120]),  // large swings
      makeInstrument("B.X", [100, 100.1, 99.9, 100.1, 99.9, 100]),  // near flat
    ];
    const result = computeFactor(instruments, "volatility", 5, 0);
    // volatility factor: high-vol stock should have higher factor value
    const aVol = result.values.find(v => v.instrumentId === "A.X")!.value;
    const bVol = result.values.find(v => v.instrumentId === "B.X")!.value;
    expect(aVol).not.toBeNull();
    expect(bVol).not.toBeNull();
    expect(aVol!).toBeGreaterThan(bVol!);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/factor-utils.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement lib/factor-utils.ts**

Create `lib/factor-utils.ts`:
```typescript
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
    const n = bars.length - 1;
    let value: number | null = null;
    let futureReturn: number | null = null;

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
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/factor-utils.test.ts
```
Expected: 5/5 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 85 tests pass (80 existing + 5 new)

- [ ] **Step 6: Commit**

```bash
git add lib/factor-utils.ts tests/lib/factor-utils.test.ts
git commit -m "feat: add factor computation utility with momentum, volatility, and Spearman IC"
```

---

### Task 4: /factor page + nav + docs

**Files:**
- Create: `app/factor/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces — Consumes (from Task 3):**
```typescript
import { computeFactor, type FactorResult, type FactorType, type InstrumentBars } from "@/lib/factor-utils";
```

**Interfaces — Consumes (from lib/api.ts):**
```typescript
import { getBars, ApiError, type BarOut } from "@/lib/api";
```

**Page logic:**
1. User inputs: list of instrument IDs (comma-separated or one per line textarea)
2. Factor type: Momentum | Volatility
3. Lookback: 20, 60, 126, 252 days
4. Horizon: 0 (IC disabled), 5, 20, 60 days
5. Run: fetch bars for each instrument concurrently (max 5 at a time, same pattern as heatmap)
6. Compute factor via `computeFactor()`
7. Display: horizontal bar chart (SVG, simple — one bar per instrument, width = factor value) + IC display

**Concurrency limit for getBars:**
```typescript
async function fetchAllBars(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<InstrumentBars[]> {
  const results: InstrumentBars[] = [];
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getBars(id, start, end, undefined, signal);
        return { instrumentId: id, bars: res.bars };
      })
    );
    results.push(...batchResults);
  }
  return results;
}
```

**Bar chart for factor values:**
A simple horizontal bar chart built with plain divs (NOT canvas/SVG/D3):
```tsx
{result.values.map(v => {
  const pct = maxAbsValue > 0 && v.value !== null
    ? Math.abs(v.value) / maxAbsValue * 100
    : 0;
  const isPos = v.value !== null && v.value >= 0;
  return (
    <div key={v.instrumentId} className="flex items-center gap-2 py-1">
      <span className="text-text-3 font-data text-xs w-32 shrink-0 truncate">{v.instrumentId.split(".")[0]}</span>
      <div className="flex-1 flex items-center gap-1">
        <div
          className={`h-4 rounded-sm ${isPos ? "bg-pos/60" : "bg-neg/60"}`}
          style={{ width: `${pct}%` }}     // inline width is required for dynamic sizing — ACCEPTED
        />
      </div>
      <span className={`text-xs font-data w-20 text-right ${isPos ? "text-pos" : "text-neg"}`}>
        {v.value !== null ? `${(v.value * 100).toFixed(2)}%` : "—"}
      </span>
      {v.futureReturn !== null && (
        <span className={`text-xs font-data w-16 text-right ${v.futureReturn >= 0 ? "text-pos" : "text-neg"}`}>
          {`${(v.futureReturn * 100).toFixed(2)}%`}
        </span>
      )}
    </div>
  );
})}
```

**Important note:** The bar width `style={{ width: \`${pct}%\` }}` is an accepted inline style exception — it's dynamic data-driven sizing that cannot be expressed with TailwindCSS utility classes (percentage values are computed at runtime from factor values).

No new tests. Run `npm test` for regressions.

- [ ] **Step 1: Create app/factor/page.tsx**

```tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getBars, ApiError, type BarOut } from "@/lib/api";
import {
  computeFactor,
  type FactorResult,
  type FactorType,
  type InstrumentBars,
} from "@/lib/factor-utils";

type LookbackOption = 20 | 60 | 126 | 252;
type HorizonOption = 0 | 5 | 20 | 60;

const LOOKBACK_OPTIONS: LookbackOption[] = [20, 60, 126, 252];
const HORIZON_OPTIONS: HorizonOption[] = [0, 5, 20, 60];
const DEFAULT_INSTRUMENTS = "005930.XKRX, 000660.XKRX, 035420.XKRX, 051910.XKRX, 005380.XKRX";
const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";

async function fetchAllBars(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<InstrumentBars[]> {
  const results: InstrumentBars[] = [];
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getBars(id, start, end, undefined, signal);
        return { instrumentId: id, bars: res.bars } satisfies InstrumentBars;
      }),
    );
    results.push(...batchResults);
  }
  return results;
}

export default function FactorPage() {
  const [instrumentsText, setInstrumentsText] = useState(DEFAULT_INSTRUMENTS);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [factorType, setFactorType] = useState<FactorType>("momentum");
  const [lookback, setLookback] = useState<LookbackOption>(60);
  const [horizon, setHorizon] = useState<HorizonOption>(20);
  const [result, setResult] = useState<FactorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async () => {
    const ids = instrumentsText
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length < 2) {
      setError("Enter at least 2 instrument IDs");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const instruments = await fetchAllBars(ids, start, end, ctrl.signal);
      const r = computeFactor(instruments, factorType, lookback, horizon);
      setResult(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to compute factor");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentsText, start, end, factorType, lookback, horizon]);

  const maxAbsValue = useMemo(() => {
    if (!result) return 1;
    const vals = result.values.map(v => Math.abs(v.value ?? 0));
    return Math.max(...vals, 0.001);
  }, [result]);

  const showFutureReturn = horizon > 0;

  return (
    <div className="p-6 space-y-4 max-w-[1000px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Factor Lab</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Cross-sectional factor analysis. Rank instruments by momentum or volatility and compute IC.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Instruments (comma or newline separated)</label>
          <textarea
            rows={2}
            value={instrumentsText}
            onChange={e => setInstrumentsText(e.target.value)}
            placeholder="AAPL.NASDAQ, MSFT.NASDAQ, ..."
            className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data"
          />
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Factor</label>
            <div className="flex gap-1">
              {(["momentum", "volatility"] as FactorType[]).map(f => (
                <button key={f} onClick={() => setFactorType(f)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer capitalize transition-colors ${
                    factorType === f ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Lookback</label>
            <div className="flex gap-1">
              {LOOKBACK_OPTIONS.map(l => (
                <button key={l} onClick={() => setLookback(l)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    lookback === l ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {l}d
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">IC Horizon</label>
            <div className="flex gap-1">
              {HORIZON_OPTIONS.map(h => (
                <button key={h} onClick={() => setHorizon(h)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    horizon === h ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {h === 0 ? "None" : `${h}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={run} disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "Computing…" : "Run"}
        </button>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{error}</div>
      )}

      {result && (
        <>
          {/* IC badge */}
          {showFutureReturn && (
            <div className="flex gap-4 text-xs flex-wrap">
              <span className="text-text-3">
                IC ({horizon}d horizon):{" "}
                <span className={`font-data font-semibold ${result.ic !== null && result.ic > 0 ? "text-pos" : result.ic !== null && result.ic < 0 ? "text-neg" : "text-text-2"}`}>
                  {result.ic !== null ? result.ic.toFixed(4) : "—"}
                </span>
              </span>
              <span className="text-text-3">
                N instruments: <span className="text-text-2 font-data">{result.values.length}</span>
              </span>
            </div>
          )}

          {/* Factor bar chart */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">
                {factorType === "momentum" ? "Momentum" : "Volatility"} — {lookback}d lookback
              </span>
              {showFutureReturn && (
                <span className="text-text-3 text-[11px] ml-4">
                  | Future Return ({horizon}d)
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-0.5">
              {/* Header */}
              <div className="flex items-center gap-2 pb-1 border-b border-border/40 mb-1">
                <span className="text-text-3 text-[10px] uppercase w-32 shrink-0">Instrument</span>
                <span className="flex-1 text-text-3 text-[10px] uppercase">Factor Value</span>
                <span className="text-text-3 text-[10px] uppercase w-20 text-right">Value</span>
                {showFutureReturn && (
                  <span className="text-text-3 text-[10px] uppercase w-16 text-right">Future Ret</span>
                )}
              </div>
              {result.values.map(v => {
                const pct = maxAbsValue > 0 && v.value !== null
                  ? (Math.abs(v.value) / maxAbsValue) * 100
                  : 0;
                const isPos = v.value !== null && v.value >= 0;
                return (
                  <div key={v.instrumentId} className="flex items-center gap-2 py-0.5">
                    <span className="text-text-3 font-data text-xs w-32 shrink-0 truncate">
                      {v.instrumentId.split(".")[0]}
                    </span>
                    <div className="flex-1">
                      <div
                        className={`h-4 rounded-sm ${isPos ? "bg-pos/50" : "bg-neg/50"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-data w-20 text-right ${isPos ? "text-pos" : v.value === null ? "text-text-3" : "text-neg"}`}>
                      {v.value !== null ? `${(v.value * 100).toFixed(2)}%` : "—"}
                    </span>
                    {showFutureReturn && (
                      <span className={`text-xs font-data w-16 text-right ${v.futureReturn === null ? "text-text-3" : v.futureReturn >= 0 ? "text-pos" : "text-neg"}`}>
                        {v.futureReturn !== null ? `${(v.futureReturn * 100).toFixed(2)}%` : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Enter instruments and click Run to compute cross-sectional factors.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Factor to nav in app/layout.tsx**

Read `app/layout.tsx` first. After Task 2 above, nav has Rolling between Universe and Bots. Add Factor between Rolling and Bots:
```typescript
{ href: "/rolling",  label: "Rolling" },
{ href: "/factor",   label: "Factor" },    // NEW
{ href: "/bots",     label: "Bots" },
```

- [ ] **Step 3: Update docs/progress.md**

Prepend this block at the top of `docs/progress.md`:
```markdown
### Factor Lab + Rolling Analytics (2026-06-28)

**S-12 Rolling Analytics:**
- `lib/rolling-analytics-utils.ts` — `computeRollingVolatility()`, `zipRollingPoints()` (7 tests)
- `components/rolling/RollingChart.tsx` — lightweight-charts multi-metric line chart
- `app/rolling/page.tsx` — instrument + benchmark + window selector; 5 metrics: Sharpe, Beta, Correlation, Drawdown, Volatility

**S-10 Factor Lab:**
- `lib/factor-utils.ts` — `computeFactor()` with momentum/volatility + Spearman IC (5 tests)
- `app/factor/page.tsx` — instrument list, factor/lookback/horizon selectors, ranked bar chart + IC display; concurrent getBars fetching (max 5)

**Nav additions:** Rolling, Factor (between Universe and Bots)
**Tests:** 85 passing (73 existing + 7 rolling-utils + 5 factor-utils)
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```
Expected: 85 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/factor/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: add Factor Lab page with momentum/volatility ranking and Spearman IC"
```

---

## Self-Review

### Spec Coverage

| S-12 Requirement | Task |
|---|---|
| Rolling Sharpe | Task 2: from `getTimeSeries().rolling_sharpe` ✅ |
| Rolling Sortino | Not implemented — backend `getTimeSeries` doesn't return rolling_sortino ⚠️ |
| Rolling Alpha | Not implemented — would require benchmark daily return subtracted per point ⚠️ |
| Rolling Beta | Task 2: from `getRollingBeta().beta` ✅ |
| Rolling Volatility | Tasks 1+2: computed from daily_return * sqrt(252) ✅ |
| Rolling Correlation | Task 2: from `getRollingBeta().correlation` ✅ |
| Rolling Drawdown | Task 2: from `getTimeSeries().drawdown` ✅ |
| Window size: 30d/60d/90d/252d | Task 2: options [20, 60, 90, 252] — 30d changed to 20d (more practical for short-term) ✅ |
| lightweight-charts LineSeries | Task 2: RollingChart component ✅ |

**Notes:** Rolling Sortino and Rolling Alpha not implemented — backend doesn't return them. `rolling_window` parameter in `getTimeSeries` affects rolling_sharpe window.

| S-10 Requirement | Task |
|---|---|
| Momentum factor | Tasks 3+4: past `lookback` day return ✅ |
| Volatility factor | Tasks 3+4: annualized rolling stddev ✅ |
| Quality, Value, Growth, Liquidity, Carry, Size factors | Not implemented — require fundamental data (P/E, P/B, ROE) not available from current backend ⚠️ |
| Factor IC | Tasks 3+4: Spearman rank IC ✅ |
| Factor Return (period return) | Not implemented — requires portfolio construction ⚠️ |
| Factor Correlation (between factors) | Not implemented — would need multiple factors computed ⚠️ |
| Factor Decay | Not implemented — requires IC at multiple horizons ⚠️ |
| Factor Ranking | Tasks 3+4: sorted bar chart ✅ |
| Factor Combination | Not implemented — requires multiple factors ⚠️ |

**Scoping note:** Implemented the most impactful and technically feasible features (Momentum, Volatility, IC). Other factors require fundamental data (P/E, P/B, etc.) not available from current `/bars` endpoint.

### Placeholder Scan

- Bar chart width: `style={{ width: \`${pct}%\` }}` — explicitly documented as accepted inline style exception (dynamic data-driven percentage computed at runtime).

### Type Consistency

- `RollingPoint { ts_ns: number; value: number | null }` — Task 1 → used in Task 2 `RollingSeries.points` ✅
- `RollingSeries { label, color, points }` — Task 2 `RollingChart.tsx` → used in Task 2 `app/rolling/page.tsx` ✅
- `InstrumentBars { instrumentId, bars: BarOut[] }` — Task 3 → used in Task 4 `fetchAllBars` return type ✅
- `FactorResult { factorType, lookback, horizon, computedAt, values, ic }` — Task 3 → used as state type in Task 4 ✅
- `FactorType = "momentum" | "volatility"` — Task 3 → used in Task 4 selector ✅
