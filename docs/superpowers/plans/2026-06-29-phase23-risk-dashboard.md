# Phase 23 — Risk Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/risk` page that visualizes portfolio risk metrics (VaR, drawdown, Sharpe, beta) using existing backend endpoints with a D3 drawdown chart and lightweight-charts rolling beta chart.

**Architecture:** Pure frontend — all 4 required API endpoints (`/risk`, `/beta`, `/timeseries`, `/rolling-beta`) already exist in the backend and `lib/api.ts`. A new `DrawdownChart` D3 component handles the drawdown visualization; the existing `RollingChart` reuses for rolling beta. The page runs all 4 fetches in parallel on button click.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / TailwindCSS 4 / D3 v7 (already installed) / lightweight-charts v5 (already installed)

## Global Constraints

- Design tokens ONLY: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black` — Run button only
- Active tab: `border-accent text-accent bg-accent/10`
- Raw `fetch` FORBIDDEN — must use `lib/api.ts` functions
- `style={{}}` FORBIDDEN except `style={{ height }}` chart containers
- Hex codes in className FORBIDDEN (exception: D3 `.attr()` calls and chart series `color` string prop)
- AbortController: abort → create → assign ref → fetch → catch AbortError silently → unmount cleanup
- `@pytest.mark.asyncio` N/A (frontend-only)
- No new backend endpoints — all APIs exist
- `npm test` must stay at 155/155 (no new pure functions to test)
- TypeScript: `npx tsc --noEmit` must pass with 0 errors

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `seokminal-dashboard/components/risk/DrawdownChart.tsx` | D3 two-panel SVG: cumulative return line + benchmark line (top) + drawdown area (bottom) |
| Create | `seokminal-dashboard/app/risk/page.tsx` | 3-tab Risk Dashboard page: Metrics (KPI cards) + Drawdown chart + Rolling Beta chart |
| Modify | `seokminal-dashboard/components/NavBar.tsx` | Add Risk to Analyze group |

---

## Task 1: DrawdownChart + Risk Page

**Files:**
- Create: `seokminal-dashboard/components/risk/DrawdownChart.tsx`
- Create: `seokminal-dashboard/app/risk/page.tsx`

**Interfaces:**
- Consumes from `lib/api.ts`:
  - `getRisk(instrumentId, start, end, benchmarkId?, signal?) → Promise<RiskMetricsResponse>`
  - `getBeta(instrumentId, benchmarkId, start, end, signal?) → Promise<BetaResponse>`
  - `getTimeSeries(instrumentId, start, end, benchmarkId?, rollingWindow?, signal?) → Promise<TimeSeriesResponse>`
  - `getRollingBeta(instrumentId, benchmarkId, start, end, window?, signal?) → Promise<RollingBetaResponse>`
  - Types: `RiskMetricsResponse`, `BetaResponse`, `TimeSeriesPoint`, `RollingBetaResponse`, `ApiError`
- Consumes from existing components:
  - `{ MetricCard }` from `@/components/ui/MetricCard` — props: `label: string, value: string, colorClass?: string`
  - `{ RollingChart, RollingSeries }` from `@/components/rolling/RollingChart` — props: `series: RollingSeries[], height?: number, yFormat?: (v:number)=>string`
  - `{ InstrumentSelect }` from `@/components/InstrumentSelect` — props: `value: string, onChange: (v:string)=>void`
  - `{ DateRangePicker }` from `@/components/DateRangePicker` — props: `start, end, onStartChange, onEndChange`
- Produces: `DrawdownChart` component (`points: TimeSeriesPoint[], height?: number`)

- [ ] **Step 1: Create components/risk/DrawdownChart.tsx**

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TimeSeriesPoint } from "@/lib/api";

interface DrawdownChartProps {
  points: TimeSeriesPoint[];
  height?: number;
}

export function DrawdownChart({ points, height = 320 }: DrawdownChartProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const W = ref.current.clientWidth || 640;
    const topH = Math.floor(height * 0.62);
    const botH = height - topH;
    const ml = 52, mr = 16, mt = 8, mb = 24;
    const innerW = W - ml - mr;

    const dates = points.map((p) => new Date(p.ts_ns / 1_000_000));
    const xScale = d3.scaleTime()
      .domain([dates[0], dates[dates.length - 1]])
      .range([0, innerW]);

    // ── Top panel: cumulative return ──────────────────────────────────
    const cumVals = points.map((p) => p.cumulative_return);
    const benchVals = points
      .filter((p) => p.benchmark_cumulative !== null)
      .map((p) => p.benchmark_cumulative as number);
    const allYVals = [...cumVals, ...benchVals];
    const yRet = d3
      .scaleLinear()
      .domain([
        Math.min(0, d3.min(allYVals) ?? 0) * 1.1,
        (d3.max(allYVals) ?? 0.01) * 1.1 || 0.01,
      ])
      .range([topH - mb, mt]);

    const g1 = svg.append("g").attr("transform", `translate(${ml},0)`);

    g1.append("g")
      .call(
        d3.axisLeft(yRet)
          .ticks(4)
          .tickFormat((v) => `${((v as number) * 100).toFixed(0)}%`)
          .tickSize(-innerW),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#1E2530");
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });

    // Zero line
    g1.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yRet(0)).attr("y2", yRet(0))
      .attr("stroke", "#374151").attr("stroke-width", 1);

    // Benchmark line
    const benchPoints = points.filter((p) => p.benchmark_cumulative !== null);
    if (benchPoints.length > 1) {
      const benchDates = benchPoints.map((p) => new Date(p.ts_ns / 1_000_000));
      const benchLine = d3
        .line<TimeSeriesPoint>()
        .x((_, i) => xScale(benchDates[i]))
        .y((p) => yRet(p.benchmark_cumulative as number));
      g1.append("path")
        .datum(benchPoints)
        .attr("fill", "none")
        .attr("stroke", "#4B5563")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,2")
        .attr("d", benchLine);
    }

    // Instrument cumulative return line
    const cumLine = d3
      .line<TimeSeriesPoint>()
      .x((_, i) => xScale(dates[i]))
      .y((p) => yRet(p.cumulative_return));
    g1.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#FF9F1C")
      .attr("stroke-width", 1.5)
      .attr("d", cumLine);

    // ── Bottom panel: drawdown ────────────────────────────────────────
    const maxDD = d3.max(points, (p) => p.drawdown) ?? 0.01;
    const yDD = d3
      .scaleLinear()
      .domain([maxDD * 1.1 || 0.01, 0])
      .range([botH - mb, mt]);

    const g2 = svg.append("g").attr("transform", `translate(${ml},${topH})`);

    g2.append("g")
      .call(
        d3.axisLeft(yDD)
          .ticks(3)
          .tickFormat((v) => `${((v as number) * 100).toFixed(0)}%`)
          .tickSize(-innerW),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#1E2530");
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });

    const ddArea = d3
      .area<TimeSeriesPoint>()
      .x((_, i) => xScale(dates[i]))
      .y0(yDD(0))
      .y1((p) => yDD(p.drawdown));
    g2.append("path")
      .datum(points)
      .attr("fill", "rgba(239,68,68,0.15)")
      .attr("stroke", "#EF4444")
      .attr("stroke-width", 1)
      .attr("d", ddArea);

    // X axis at bottom of lower panel
    g2.append("g")
      .attr("transform", `translate(0,${botH - mb})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => d3.timeFormat("%b %y")(d as Date)),
      )
      .call((g) => {
        g.selectAll(".domain").attr("stroke", "#374151");
        g.selectAll(".tick line").remove();
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });
  }, [points, height]);

  return (
    <svg
      ref={ref}
      width="100%"
      style={{ height }}
      className="block"
    />
  );
}
```

- [ ] **Step 2: Create app/risk/page.tsx**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  getRisk,
  getBeta,
  getTimeSeries,
  getRollingBeta,
  ApiError,
  type RiskMetricsResponse,
  type BetaResponse,
  type TimeSeriesPoint,
  type RollingBetaResponse,
} from "@/lib/api";
import { MetricCard } from "@/components/ui/MetricCard";
import { DrawdownChart } from "@/components/risk/DrawdownChart";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";

const BENCHMARKS = [
  { value: "SPY.ARCA", label: "SPY" },
  { value: "QQQ.NASDAQ", label: "QQQ" },
  { value: "KOSPI.KRX", label: "KOSPI" },
];

const TABS = ["Metrics", "Drawdown", "Rolling Beta"] as const;
type Tab = (typeof TABS)[number];

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}
function colCls(v: number | null | undefined): string {
  if (v == null) return "text-text-3";
  return v >= 0 ? "text-pos" : "text-neg";
}

export default function RiskPage() {
  const [tab, setTab] = useState<Tab>("Metrics");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [benchmarkId, setBenchmarkId] = useState("SPY.ARCA");
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2026-06-01");
  const [betaWindow, setBetaWindow] = useState(30);

  const [riskData, setRiskData] = useState<RiskMetricsResponse | null>(null);
  const [betaData, setBetaData] = useState<BetaResponse | null>(null);
  const [tsPoints, setTsPoints] = useState<TimeSeriesPoint[]>([]);
  const [rollingData, setRollingData] = useState<RollingBetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const [risk, beta, ts, rolling] = await Promise.all([
        getRisk(instrumentId, start, end, benchmarkId, ctrl.signal),
        getBeta(instrumentId, benchmarkId, start, end, ctrl.signal),
        getTimeSeries(instrumentId, start, end, benchmarkId, 60, ctrl.signal),
        getRollingBeta(instrumentId, benchmarkId, start, end, betaWindow, ctrl.signal),
      ]);
      setRiskData(risk);
      setBetaData(beta);
      setTsPoints(ts.points);
      setRollingData(rolling);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }

  const betaSeries: RollingSeries[] = rollingData
    ? [
        {
          label: "Beta",
          color: "#FF9F1C",
          points: rollingData.points.map((p) => ({ ts_ns: p.ts_ns, value: p.beta })),
        },
        {
          label: "Correlation",
          color: "#60A5FA",
          points: rollingData.points.map((p) => ({ ts_ns: p.ts_ns, value: p.correlation })),
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-bg p-6">
      <h1 className="text-text-1 text-2xl font-semibold mb-4">Risk Dashboard</h1>

      {/* Config panel */}
      <div className="bg-panel border border-border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-text-3 text-xs uppercase tracking-wider">Instrument</span>
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-text-3 text-xs uppercase tracking-wider">Benchmark</span>
        <select
          value={benchmarkId}
          onChange={(e) => setBenchmarkId(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
        >
          {BENCHMARKS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <span className="text-text-3 text-xs uppercase tracking-wider">β Window</span>
        <input
          type="number"
          value={betaWindow}
          min={5}
          onChange={(e) => setBetaWindow(Number(e.target.value))}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm font-data w-16"
        />
        <button
          onClick={run}
          disabled={loading}
          className="bg-accent text-black rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {error && <p className="text-neg text-sm mb-3">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-accent bg-accent/10"
                : "border-transparent text-text-3 hover:text-text-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Metrics tab ── */}
      {tab === "Metrics" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            <MetricCard
              label="Ann. Return"
              value={fmtPct(riskData?.annualized_return)}
              colorClass={colCls(riskData?.annualized_return)}
            />
            <MetricCard
              label="Volatility"
              value={fmtPct(riskData?.volatility)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Sharpe"
              value={fmtNum(riskData?.sharpe_ratio)}
              colorClass={colCls(riskData?.sharpe_ratio)}
            />
            <MetricCard
              label="Sortino"
              value={fmtNum(riskData?.sortino_ratio)}
              colorClass={colCls(riskData?.sortino_ratio)}
            />
            <MetricCard
              label="Max Drawdown"
              value={fmtPct(riskData?.max_drawdown)}
              colorClass={riskData?.max_drawdown != null ? "text-neg" : "text-text-3"}
            />
            <MetricCard
              label="VaR 95% (1d)"
              value={fmtPct(riskData?.var_95, 3)}
              colorClass={riskData?.var_95 != null ? "text-neg" : "text-text-3"}
            />
            <MetricCard
              label="Calmar"
              value={fmtNum(riskData?.calmar_ratio)}
              colorClass={colCls(riskData?.calmar_ratio)}
            />
            <MetricCard
              label="Alpha (Ann.)"
              value={fmtPct(riskData?.alpha)}
              colorClass={colCls(riskData?.alpha)}
            />
            <MetricCard
              label="Beta"
              value={fmtNum(betaData?.beta)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Correlation"
              value={fmtNum(betaData?.correlation)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="R²"
              value={fmtNum(riskData?.r_squared)}
              colorClass="text-text-2"
            />
            <MetricCard
              label="Observations"
              value={riskData ? String(riskData.observation_count) : "—"}
              colorClass="text-text-3"
            />
          </div>
          {!riskData && !loading && (
            <p className="text-text-3 text-sm">
              Configure inputs above and click Run to see metrics.
            </p>
          )}
        </div>
      )}

      {/* ── Drawdown tab ── */}
      {tab === "Drawdown" && (
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-accent inline-block rounded" />
              <span className="text-text-2 text-xs">Instrument</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-border inline-block" />
              <span className="text-text-2 text-xs">Benchmark</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-2.5 bg-neg/20 border border-neg inline-block rounded-sm" />
              <span className="text-text-2 text-xs">Drawdown</span>
            </span>
          </div>
          {tsPoints.length >= 2 ? (
            <DrawdownChart points={tsPoints} height={320} />
          ) : (
            <div
              className="flex items-center justify-center text-text-3 text-sm border border-border rounded"
              style={{ height: 320 }}
            >
              {loading ? "Loading…" : "Click Run to load chart."}
            </div>
          )}
        </div>
      )}

      {/* ── Rolling Beta tab ── */}
      {tab === "Rolling Beta" && (
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-accent inline-block rounded" />
              <span className="text-text-2 text-xs">Beta</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-info inline-block rounded" />
              <span className="text-text-2 text-xs">Correlation</span>
            </span>
          </div>
          {betaSeries.length > 0 && betaSeries[0].points.length > 0 ? (
            <RollingChart
              series={betaSeries}
              height={300}
              yFormat={(v) => v.toFixed(3)}
            />
          ) : (
            <div
              className="flex items-center justify-center text-text-3 text-sm border border-border rounded"
              style={{ height: 300 }}
            >
              {loading ? "Loading…" : "Click Run to load chart."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```

Expected: 0 errors. If you see errors about `InstrumentSelect` or `DateRangePicker` imports: they are named exports — use `import { InstrumentSelect }` and `import { DateRangePicker }`.

- [ ] **Step 4: Run test suite**

```bash
npm test
```

Expected: 155/155 pass (unchanged — no new pure functions added)

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add components/risk/DrawdownChart.tsx app/risk/page.tsx
git commit -m "feat: add risk dashboard with drawdown chart and rolling beta (phase 23)"
```

---

## Task 2: NavBar — Add Risk to Analyze Group

**Files:**
- Modify: `seokminal-dashboard/components/NavBar.tsx`

**Interfaces:**
- Consumes: existing `NAV_GROUPS` array, existing Analyze group items
- Produces: `/risk` nav link in Analyze group (after Factor, before Data Quality)

- [ ] **Step 1: Add Risk entry to Analyze group**

In `components/NavBar.tsx`, find the Analyze group items array:

```typescript
    items: [
      { href: "/correlation",  label: "Correlation" },
      { href: "/event-study",  label: "Event Study" },
      { href: "/rolling",      label: "Rolling" },
      { href: "/factor",       label: "Factor" },
      { href: "/data-quality", label: "Data Quality" },
    ],
```

Change to:

```typescript
    items: [
      { href: "/correlation",  label: "Correlation" },
      { href: "/event-study",  label: "Event Study" },
      { href: "/rolling",      label: "Rolling" },
      { href: "/factor",       label: "Factor" },
      { href: "/risk",         label: "Risk" },
      { href: "/data-quality", label: "Data Quality" },
    ],
```

- [ ] **Step 2: Type-check + test**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit && npm test
```

Expected: 0 TS errors, 155/155 pass

- [ ] **Step 3: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: add Risk nav link to Analyze group (phase 23)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] VaR visualization — MetricCard "VaR 95% (1d)" in Metrics tab
- [x] Drawdown visualization — D3 two-panel chart in Drawdown tab
- [x] Beta visualization — RollingChart (beta + correlation) in Rolling Beta tab + MetricCard
- [x] Sharpe visible — MetricCard in Metrics tab
- [x] NavBar link added

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `DrawdownChart` props: `points: TimeSeriesPoint[], height?: number` — matches usage in page ✓
- `RollingChart` props: `series: RollingSeries[], height?: number, yFormat?` — matches usage ✓
- `RollingSeries` from `components/rolling/RollingChart` — `{ label, color, points: RollingPoint[] }` where `RollingPoint = { ts_ns, value: number | null }` ✓
- `betaSeries` mapping `rollingData.points.map(p => ({ ts_ns: p.ts_ns, value: p.beta }))` — matches `RollingPoint` interface ✓
- `InstrumentSelect` and `DateRangePicker` are named exports ✓
- `MetricCard` is named export ✓
- All API functions (`getRisk`, `getBeta`, `getTimeSeries`, `getRollingBeta`) exist in `lib/api.ts` ✓
- `ApiError` exported from `lib/api.ts` ✓
