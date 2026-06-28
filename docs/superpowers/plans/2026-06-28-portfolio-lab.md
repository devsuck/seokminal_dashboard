# Portfolio Lab + Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build S-9 Portfolio Lab — a two-tab page covering Markowitz mean-variance Optimizer (efficient frontier chart + weight tables) and Performance Attribution (per-instrument contribution to portfolio return).

**Architecture:** Three tasks. Task 1 builds pure attribution computation utilities (tested). Task 2 builds the EfficientFrontierChart SVG component (D3 v7, already installed). Task 3 assembles the two-tab portfolio page with nav integration.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, D3 v7 (installed), vitest/jsdom. No new dependencies.

## Global Constraints

- `"use client"` ONLY on components/pages using hooks or browser APIs
- CSS tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY primary action buttons (Run/Optimize)
- Active tabs: `border-accent text-accent bg-accent/10`
- Inline styles: forbidden — EXCEPTION: D3 `.attr()` hex colors on SVG elements (chart library); dynamic data-driven `style={{ width: \`${pct}%\` }}` on weight/contribution bars
- No hardcoded hex in `className`
- No raw `fetch()` — use `getPortfolioOptimize`, `getTimeSeries` from `lib/api.ts`
- AbortController full pattern: abort→run→catch AbortError→finally guard→unmount cleanup
- `cumulative_return` in `TimeSeriesPoint` is already a ratio (e.g. 0.15 = 15%) — multiply by 100 for display
- Existing 92 tests must pass after every task

## File Map

**Created:**
- `lib/portfolio-utils.ts`
- `tests/lib/portfolio-utils.test.ts`
- `components/portfolio/EfficientFrontierChart.tsx`
- `app/portfolio/page.tsx`

**Modified:**
- `app/layout.tsx` — add Portfolio nav item between Replay and Rolling
- `docs/progress.md` — update

## Backend API (already in lib/api.ts)

```typescript
// Markowitz optimizer
getPortfolioOptimize(instrumentIds: string[], start: string, end: string, signal?: AbortSignal)
  → PortfolioOptimizeResponse {
    instruments: string[];
    min_variance: PortfolioWeights;   // { weights: Record<string,number>; expected_return; volatility; sharpe? }
    max_sharpe: PortfolioWeights;
    efficient_frontier: FrontierPoint[];  // { expected_return; volatility }[]
  }

// Per-instrument time series (for attribution)
getTimeSeries(instrumentId, start, end, benchmarkId?, rollingWindow?, signal?)
  → TimeSeriesResponse { points: TimeSeriesPoint[] }
  // TimeSeriesPoint.cumulative_return: ratio (e.g. 0.15 = +15%)
```

---

### Task 1: Portfolio attribution utility + tests

**Files:**
- Create: `lib/portfolio-utils.ts`
- Create: `tests/lib/portfolio-utils.test.ts`

**Interfaces — Produces (Tasks 2+3 depend on these exact names):**

```typescript
import type { TimeSeriesPoint } from "@/lib/api";

export interface AttributionInput {
  instrumentId: string;
  weight: number;    // fraction 0-1, weights must sum to 1.0
}

export interface InstrumentAttribution {
  instrumentId: string;
  weight: number;            // 0-1
  totalReturn: number;       // cumulative_return of last point (ratio)
  contribution: number;      // weight × totalReturn
}

export interface PortfolioAttribution {
  portfolioReturn: number;              // sum of contributions
  instruments: InstrumentAttribution[]; // sorted by |contribution| descending
}

// seriesMap: instrumentId → TimeSeriesPoint[] (must include at least 1 point)
export function computeAttribution(
  inputs: AttributionInput[],
  seriesMap: Record<string, TimeSeriesPoint[]>,
): PortfolioAttribution
```

**Algorithm for `computeAttribution`:**
```
For each input { instrumentId, weight }:
  points = seriesMap[instrumentId] ?? []
  if points.length === 0: totalReturn = 0
  else: totalReturn = points[points.length - 1].cumulative_return
  contribution = weight * totalReturn

Sort instruments by Math.abs(contribution) descending.
portfolioReturn = sum(contribution for all instruments)
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/portfolio-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeAttribution } from "../../lib/portfolio-utils";
import type { AttributionInput } from "../../lib/portfolio-utils";
import type { TimeSeriesPoint } from "../../lib/api";

function makePoint(cumulative_return: number): TimeSeriesPoint {
  return {
    ts_ns: 1_000_000_000_000,
    daily_return: 0.01,
    cumulative_return,
    drawdown: 0,
    rolling_sharpe: null,
    benchmark_cumulative: null,
  };
}

function makePoints(cumRet: number): TimeSeriesPoint[] {
  return [makePoint(0), makePoint(cumRet * 0.5), makePoint(cumRet)];
}

describe("computeAttribution", () => {
  it("computes contribution = weight × totalReturn", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "A", weight: 0.6 }];
    const seriesMap = { A: makePoints(0.2) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].totalReturn).toBeCloseTo(0.2, 5);
    expect(result.instruments[0].contribution).toBeCloseTo(0.12, 5);
  });

  it("sums contributions for portfolioReturn", () => {
    const inputs: AttributionInput[] = [
      { instrumentId: "A", weight: 0.5 },
      { instrumentId: "B", weight: 0.5 },
    ];
    const seriesMap = { A: makePoints(0.2), B: makePoints(0.1) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.portfolioReturn).toBeCloseTo(0.15, 5);
  });

  it("handles missing series (contribution = 0)", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "MISSING", weight: 1.0 }];
    const seriesMap = {};
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].totalReturn).toBe(0);
    expect(result.instruments[0].contribution).toBe(0);
    expect(result.portfolioReturn).toBe(0);
  });

  it("sorts by absolute contribution descending", () => {
    const inputs: AttributionInput[] = [
      { instrumentId: "A", weight: 0.1 },
      { instrumentId: "B", weight: 0.5 },
      { instrumentId: "C", weight: 0.4 },
    ];
    const seriesMap = {
      A: makePoints(0.5),    // contribution = 0.05
      B: makePoints(-0.3),   // contribution = -0.15 → abs 0.15
      C: makePoints(0.4),    // contribution = 0.16
    };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].instrumentId).toBe("C");  // |0.16|
    expect(result.instruments[1].instrumentId).toBe("B");  // |−0.15|
    expect(result.instruments[2].instrumentId).toBe("A");  // |0.05|
  });

  it("handles negative returns (short portfolio)", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "A", weight: 1.0 }];
    const seriesMap = { A: makePoints(-0.3) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].contribution).toBeCloseTo(-0.3, 5);
    expect(result.portfolioReturn).toBeCloseTo(-0.3, 5);
  });

  it("handles empty inputs", () => {
    const result = computeAttribution([], {});
    expect(result.portfolioReturn).toBe(0);
    expect(result.instruments).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test tests/lib/portfolio-utils.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement lib/portfolio-utils.ts**

Create `lib/portfolio-utils.ts`:
```typescript
import type { TimeSeriesPoint } from "@/lib/api";

export interface AttributionInput {
  instrumentId: string;
  weight: number;
}

export interface InstrumentAttribution {
  instrumentId: string;
  weight: number;
  totalReturn: number;
  contribution: number;
}

export interface PortfolioAttribution {
  portfolioReturn: number;
  instruments: InstrumentAttribution[];
}

export function computeAttribution(
  inputs: AttributionInput[],
  seriesMap: Record<string, TimeSeriesPoint[]>,
): PortfolioAttribution {
  if (inputs.length === 0) {
    return { portfolioReturn: 0, instruments: [] };
  }
  const instruments: InstrumentAttribution[] = inputs.map(({ instrumentId, weight }) => {
    const points = seriesMap[instrumentId] ?? [];
    const totalReturn = points.length > 0 ? points[points.length - 1].cumulative_return : 0;
    return { instrumentId, weight, totalReturn, contribution: weight * totalReturn };
  });
  instruments.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const portfolioReturn = instruments.reduce((s, i) => s + i.contribution, 0);
  return { portfolioReturn, instruments };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/portfolio-utils.test.ts
```
Expected: 6/6 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 98 tests pass (92 existing + 6 new)

- [ ] **Step 6: Commit**

```bash
git add lib/portfolio-utils.ts tests/lib/portfolio-utils.test.ts
git commit -m "feat: add portfolio attribution computation utility"
```

---

### Task 2: EfficientFrontierChart component

**Files:**
- Create: `components/portfolio/EfficientFrontierChart.tsx`

**Interfaces — Consumes:**
```typescript
import type { FrontierPoint, PortfolioWeights } from "@/lib/api";
```

**Interfaces — Produces (Task 3 uses):**
```typescript
interface EfficientFrontierChartProps {
  frontier: FrontierPoint[];       // { expected_return, volatility }[]
  minVariance: PortfolioWeights;   // { weights, expected_return, volatility, sharpe? }
  maxSharpe: PortfolioWeights;
  width?: number;                  // default 560
  height?: number;                 // default 320
}
export function EfficientFrontierChart(props: EfficientFrontierChartProps): React.ReactElement
```

**Implementation with D3 v7:**

SVG layout:
```
MARGIN = { top: 20, right: 24, bottom: 40, left: 52 }
innerW = width - MARGIN.left - MARGIN.right
innerH = height - MARGIN.top - MARGIN.bottom
```

Scales:
```typescript
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { axisBottom, axisLeft } from "d3-axis";
import { select } from "d3-selection";

// X: volatility (%), Y: expected_return (%)
// Pad domain by 10% on each side
const xMin = Math.min(...frontier.map(p => p.volatility), minVariance.volatility, maxSharpe.volatility);
const xMax = Math.max(...frontier.map(p => p.volatility), minVariance.volatility, maxSharpe.volatility);
const yMin = Math.min(...frontier.map(p => p.expected_return), minVariance.expected_return, maxSharpe.expected_return);
const yMax = Math.max(...frontier.map(p => p.expected_return), minVariance.expected_return, maxSharpe.expected_return);
const xPad = (xMax - xMin) * 0.1 || 0.01;
const yPad = (yMax - yMin) * 0.1 || 0.01;

const xScale = scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, innerW]);
const yScale = scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);
```

D3 rendering (useEffect, svgRef):
```typescript
// Grid lines
svg.selectAll(".grid-x").data(xScale.ticks(5)).enter()
  .append("line").attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
  .attr("y1", 0).attr("y2", innerH).attr("stroke", "#1E2530").attr("stroke-width", 1);
// same for y-axis

// Frontier line
const lineGen = line<FrontierPoint>()
  .x(d => xScale(d.volatility))
  .y(d => yScale(d.expected_return));
svg.append("path")
  .datum(frontier)
  .attr("fill", "none")
  .attr("stroke", "#6B7280")
  .attr("stroke-width", 1.5)
  .attr("d", lineGen);

// Min-variance point (blue circle)
svg.append("circle")
  .attr("cx", xScale(minVariance.volatility))
  .attr("cy", yScale(minVariance.expected_return))
  .attr("r", 6)
  .attr("fill", "#3B82F6");

// Max-sharpe point (orange diamond via transform)
svg.append("path")
  .attr("d", "M0,-7 L7,0 L0,7 L-7,0 Z")   // diamond
  .attr("transform", `translate(${xScale(maxSharpe.volatility)},${yScale(maxSharpe.expected_return)})`)
  .attr("fill", "#FF9F1C");

// Axes
svg.append("g")
  .attr("transform", `translate(0,${innerH})`)
  .call(axisBottom(xScale).ticks(5).tickFormat(d => `${(+d * 100).toFixed(1)}%`))
  .call(g => g.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10"))
  .call(g => g.select(".domain").attr("stroke", "#374151"))
  .call(g => g.selectAll(".tick line").attr("stroke", "#374151"));

svg.append("g")
  .call(axisLeft(yScale).ticks(5).tickFormat(d => `${(+d * 100).toFixed(1)}%`))
  .call(g => g.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10"))
  .call(g => g.select(".domain").attr("stroke", "#374151"))
  .call(g => g.selectAll(".tick line").attr("stroke", "#374151"));

// Axis labels
svg.append("text").attr("x", innerW / 2).attr("y", innerH + 35)
  .attr("text-anchor", "middle").attr("fill", "#6B7280").attr("font-size", "11")
  .text("Volatility (annualized)");

svg.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -innerH / 2).attr("y", -40)
  .attr("text-anchor", "middle").attr("fill", "#6B7280").attr("font-size", "11")
  .text("Expected Return");
```

Cleanup: `return () => { select(svgRef.current).selectAll("*").remove(); }`

Return:
```tsx
return (
  <svg
    ref={svgRef}
    viewBox={`0 0 ${width} ${height}`}
    className="w-full"
    style={{ height }}
  >
    <g transform={`translate(${MARGIN.left},${MARGIN.top})`} ref={gRef} />
  </svg>
);
```

Wait — the SVG approach: render inside `<g ref={gRef}>` using D3 select, not `svgRef`. Simpler: use a `<svg ref={svgRef}>` and render `<g>` via D3 `select(svgRef.current).append("g")`. But that conflicts with declarative JSX. Better: just use one ref on the SVG element and let D3 append everything.

Correct approach (simpler):
```tsx
const svgRef = useRef<SVGSVGElement>(null);

useEffect(() => {
  if (!svgRef.current || frontier.length === 0) return;
  const svg = select(svgRef.current);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  // ... all rendering via g
  return () => { svg.selectAll("*").remove(); };
}, [frontier, minVariance, maxSharpe, width, height]);

return (
  <svg
    ref={svgRef}
    viewBox={`0 0 ${width} ${height}`}
    className="w-full rounded-lg"
  />
);
```

No `style={{ height }}` on SVG — use `viewBox` + `className="w-full"` for responsive sizing.

Note: The `style={{ height }}` on SVG IS allowed per the plan's inline style exceptions (chart container), but since `viewBox` + `className="w-full"` works without it, prefer to omit.

Legend (JSX below the SVG, no D3 needed):
```tsx
<div className="flex gap-4 justify-center text-xs text-text-3 mt-2">
  <span className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] inline-block" />
    Min Variance
  </span>
  <span className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rotate-45 bg-[#FF9F1C] inline-block" />
    Max Sharpe
  </span>
  <span className="flex items-center gap-1.5">
    <span className="w-4 h-0.5 bg-[#6B7280] inline-block" />
    Efficient Frontier
  </span>
</div>
```

Note: `bg-[#3B82F6]`, `bg-[#FF9F1C]`, `bg-[#6B7280]` are ACCEPTED in legend color swatches (matching D3 colors — same exception as CorrelationNetwork.tsx and EventReturnChart.tsx).

No new tests required. Run `npm test` for regression check.

- [ ] **Step 1: Create components/portfolio/ directory**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/components/portfolio
```

- [ ] **Step 2: Create components/portfolio/EfficientFrontierChart.tsx**

Write the complete file as described above. Use the exact D3 approach: `useRef<SVGSVGElement>`, `select(svgRef.current)` in useEffect, append `g` with translate, all rendering inside `g`.

Full implementation:
```tsx
"use client";

import { useRef, useEffect } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { axisBottom, axisLeft } from "d3-axis";
import type { FrontierPoint, PortfolioWeights } from "@/lib/api";

interface EfficientFrontierChartProps {
  frontier: FrontierPoint[];
  minVariance: PortfolioWeights;
  maxSharpe: PortfolioWeights;
  width?: number;
  height?: number;
}

const MARGIN = { top: 20, right: 24, bottom: 40, left: 52 };

export function EfficientFrontierChart({
  frontier,
  minVariance,
  maxSharpe,
  width = 560,
  height = 320,
}: EfficientFrontierChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || frontier.length === 0) return;
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const allVols = [...frontier.map(p => p.volatility), minVariance.volatility, maxSharpe.volatility];
    const allRets = [...frontier.map(p => p.expected_return), minVariance.expected_return, maxSharpe.expected_return];
    const xMin = Math.min(...allVols);
    const xMax = Math.max(...allVols);
    const yMin = Math.min(...allRets);
    const yMax = Math.max(...allRets);
    const xPad = (xMax - xMin) * 0.1 || 0.01;
    const yPad = (yMax - yMin) * 0.1 || 0.01;

    const xScale = scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, innerW]);
    const yScale = scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);

    // Grid lines
    g.selectAll(".gx").data(xScale.ticks(5)).enter().append("line")
      .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#1E2530").attr("stroke-width", 1);
    g.selectAll(".gy").data(yScale.ticks(5)).enter().append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
      .attr("stroke", "#1E2530").attr("stroke-width", 1);

    // Frontier line
    const lineGen = line<FrontierPoint>()
      .x(d => xScale(d.volatility))
      .y(d => yScale(d.expected_return));
    g.append("path")
      .datum(frontier)
      .attr("fill", "none")
      .attr("stroke", "#6B7280")
      .attr("stroke-width", 1.5)
      .attr("d", lineGen);

    // Min-variance circle
    g.append("circle")
      .attr("cx", xScale(minVariance.volatility))
      .attr("cy", yScale(minVariance.expected_return))
      .attr("r", 6)
      .attr("fill", "#3B82F6");

    // Max-sharpe diamond
    g.append("path")
      .attr("d", "M0,-7 L7,0 L0,7 L-7,0 Z")
      .attr("transform", `translate(${xScale(maxSharpe.volatility)},${yScale(maxSharpe.expected_return)})`)
      .attr("fill", "#FF9F1C");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(axisBottom(xScale).ticks(5).tickFormat(d => `${((+d) * 100).toFixed(1)}%`))
      .call(ax => ax.select(".domain").attr("stroke", "#374151"))
      .call(ax => ax.selectAll(".tick line").attr("stroke", "#374151"))
      .call(ax => ax.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10"));

    // Y axis
    g.append("g")
      .call(axisLeft(yScale).ticks(5).tickFormat(d => `${((+d) * 100).toFixed(1)}%`))
      .call(ax => ax.select(".domain").attr("stroke", "#374151"))
      .call(ax => ax.selectAll(".tick line").attr("stroke", "#374151"))
      .call(ax => ax.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10"));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 35)
      .attr("text-anchor", "middle").attr("fill", "#6B7280").attr("font-size", "11")
      .text("Volatility (annualized)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -42)
      .attr("text-anchor", "middle").attr("fill", "#6B7280").attr("font-size", "11")
      .text("Expected Return");

    return () => { svg.selectAll("*").remove(); };
  }, [frontier, minVariance, maxSharpe, width, height]);

  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg" />
      <div className="flex gap-4 justify-center text-xs text-text-3 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] inline-block shrink-0" />
          Min Variance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-[#FF9F1C] inline-block shrink-0" />
          Max Sharpe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#6B7280] inline-block shrink-0" />
          Efficient Frontier
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run full suite**

```bash
npm test
```
Expected: 98 tests pass (no new tests, no regressions)

- [ ] **Step 4: Commit**

```bash
git add components/portfolio/EfficientFrontierChart.tsx
git commit -m "feat: add EfficientFrontierChart D3 scatter component"
```

---

### Task 3: /portfolio page + nav + docs

**Files:**
- Create: `app/portfolio/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces — Consumes:**
```typescript
import { getPortfolioOptimize, getTimeSeries, ApiError,
         type PortfolioOptimizeResponse, type TimeSeriesPoint } from "@/lib/api";
import { computeAttribution, type AttributionInput, type PortfolioAttribution } from "@/lib/portfolio-utils";
import { EfficientFrontierChart } from "@/components/portfolio/EfficientFrontierChart";
```

**Page tabs:**
- `"optimizer"` — Markowitz efficient frontier
- `"attribution"` — per-instrument P&L attribution

**Optimizer tab UI:**
```
Instruments (comma/newline textarea) | Start | End | [Optimize bg-accent]
─────────────────────────────────────────────────────────────────────────
[EfficientFrontierChart  width fills container]
─────────────────────────────────────────────────────────────────────────
Min Variance weights          │  Max Sharpe weights
[horizontal weight bars]      │  [horizontal weight bars]
Ret: +X.XX%  Vol: X.XX%       │  Ret: +X.XX%  Vol: X.XX%  Sharpe: X.XX
```

**Attribution tab UI:**
```
Instruments + weights input (one per row: ticker | weight%)
[+ Add row button]
Start | End | [Run bg-accent]
─────────────────────────────────────────────────────────────────────────
Portfolio Return: +X.XX%  (text-pos or text-neg)
─────────────────────────────────────────────────────────────────────────
Contribution bar chart (div-based, like factor lab):
  Instrument | [bar] | Contribution | Weight | Total Return
```

**Attribution instrument input:**
```typescript
interface WeightRow { instrumentId: string; weightStr: string; }
const [weightRows, setWeightRows] = useState<WeightRow[]>([
  { instrumentId: "005930.XKRX", weightStr: "40" },
  { instrumentId: "000660.XKRX", weightStr: "30" },
  { instrumentId: "035420.XKRX", weightStr: "30" },
]);
```

Parsed weights: `weightRows.map(r => ({ instrumentId: r.instrumentId, weight: parseFloat(r.weightStr) / 100 }))`

**Optimizer concurrent fetch:** Single `getPortfolioOptimize` call — no batching needed.

**Attribution concurrent fetch:** Use `Promise.all` for `getTimeSeries` per instrument (max 5 concurrent, same pattern as factor lab):
```typescript
async function fetchAllTimeSeries(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<Record<string, TimeSeriesPoint[]>> {
  const result: Record<string, TimeSeriesPoint[]> = {};
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getTimeSeries(id, start, end, undefined, undefined, signal);
        return { id, points: res.points };
      }),
    );
    for (const { id, points } of batchResults) result[id] = points;
  }
  return result;
}
```

**Weight validation (attribution tab):**
- All weights must be numbers ≥ 0
- Sum must be between 99.5 and 100.5 (allow rounding error)
- If invalid: `setError("Weights must sum to 100%")` and return early

**Contribution bar chart (div-based, same pattern as factor lab):**
```tsx
const maxAbsContrib = Math.max(...result.instruments.map(i => Math.abs(i.contribution)), 0.001);
// For each instrument:
const pct = (Math.abs(inst.contribution) / maxAbsContrib) * 100;
<div style={{ width: `${pct}%` }}
  className={`h-4 rounded-sm ${inst.contribution >= 0 ? "bg-pos/50" : "bg-neg/50"}`} />
```

**Weight bars (optimizer tab, same pattern):**
```tsx
const maxWeight = Math.max(...Object.values(weights.weights), 0.001);
// For each instrument:
const pct = (w / maxWeight) * 100;
<div style={{ width: `${pct}%` }}
  className="h-4 rounded-sm bg-accent/40" />
```

**State:**
```typescript
// Shared
const [tab, setTab] = useState<"optimizer" | "attribution">("optimizer");
const [start, setStart] = useState("2022-01-01");
const [end, setEnd] = useState("2026-01-01");
const abortRef = useRef<AbortController | null>(null);

// Optimizer
const [optimizerText, setOptimizerText] = useState("005930.XKRX, 000660.XKRX, 035420.XKRX, 051910.XKRX");
const [optimizerResult, setOptimizerResult] = useState<PortfolioOptimizeResponse | null>(null);
const [optimizerLoading, setOptimizerLoading] = useState(false);
const [optimizerError, setOptimizerError] = useState<string | null>(null);

// Attribution
const [weightRows, setWeightRows] = useState<WeightRow[]>([...defaults...]);
const [attrResult, setAttrResult] = useState<PortfolioAttribution | null>(null);
const [attrLoading, setAttrLoading] = useState(false);
const [attrError, setAttrError] = useState<string | null>(null);
```

**Nav:** Add `{ href: "/portfolio", label: "Portfolio" }` between `"/replay"` and `"/rolling"`.

**docs/progress.md:** Prepend Portfolio Lab block at top.

No new tests. Run `npm test` for regressions.

- [ ] **Step 1: Create app/portfolio/page.tsx**

Full implementation (all code complete, no placeholders):

```tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getPortfolioOptimize, getTimeSeries, ApiError,
  type PortfolioOptimizeResponse, type TimeSeriesPoint, type PortfolioWeights,
} from "@/lib/api";
import { computeAttribution, type AttributionInput, type PortfolioAttribution } from "@/lib/portfolio-utils";
import { EfficientFrontierChart } from "@/components/portfolio/EfficientFrontierChart";

type Tab = "optimizer" | "attribution";

interface WeightRow { instrumentId: string; weightStr: string; }

async function fetchAllTimeSeries(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<Record<string, TimeSeriesPoint[]>> {
  const result: Record<string, TimeSeriesPoint[]> = {};
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getTimeSeries(id, start, end, undefined, undefined, signal);
        return { id, points: res.points };
      }),
    );
    for (const { id, points } of batchResults) result[id] = points;
  }
  return result;
}

function WeightBars({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const maxW = Math.max(...entries.map(([, w]) => w), 0.001);
  return (
    <div className="space-y-1">
      {entries.map(([id, w]) => (
        <div key={id} className="flex items-center gap-2">
          <span className="text-text-3 text-xs font-data w-28 shrink-0 truncate">{id.split(".")[0]}</span>
          <div className="flex-1">
            <div className="h-4 rounded-sm bg-accent/40" style={{ width: `${(w / maxW) * 100}%` }} />
          </div>
          <span className="text-text-2 text-xs font-data w-12 text-right">{(w * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("optimizer");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const abortRef = useRef<AbortController | null>(null);

  // Optimizer state
  const [optimizerText, setOptimizerText] = useState(
    "005930.XKRX, 000660.XKRX, 035420.XKRX, 051910.XKRX"
  );
  const [optimizerResult, setOptimizerResult] = useState<PortfolioOptimizeResponse | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);

  // Attribution state
  const [weightRows, setWeightRows] = useState<WeightRow[]>([
    { instrumentId: "005930.XKRX", weightStr: "40" },
    { instrumentId: "000660.XKRX", weightStr: "30" },
    { instrumentId: "035420.XKRX", weightStr: "30" },
  ]);
  const [attrResult, setAttrResult] = useState<PortfolioAttribution | null>(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrError, setAttrError] = useState<string | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const runOptimizer = useCallback(async () => {
    const ids = optimizerText.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (ids.length < 2) { setOptimizerError("Enter at least 2 instruments"); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setOptimizerLoading(true);
    setOptimizerError(null);
    setOptimizerResult(null);
    try {
      const res = await getPortfolioOptimize(ids, start, end, ctrl.signal);
      setOptimizerResult(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setOptimizerError(e instanceof ApiError ? e.message : "Failed to optimize portfolio");
    } finally {
      if (!ctrl.signal.aborted) setOptimizerLoading(false);
    }
  }, [optimizerText, start, end]);

  const runAttribution = useCallback(async () => {
    // Validate weights
    const parsedWeights = weightRows.map(r => ({
      instrumentId: r.instrumentId.trim(),
      weight: parseFloat(r.weightStr) / 100,
    })).filter(r => r.instrumentId);
    const totalWeight = parsedWeights.reduce((s, r) => s + r.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.005) {
      setAttrError(`Weights sum to ${(totalWeight * 100).toFixed(1)}% — must equal 100%`);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAttrLoading(true);
    setAttrError(null);
    setAttrResult(null);
    try {
      const seriesMap = await fetchAllTimeSeries(
        parsedWeights.map(r => r.instrumentId),
        start, end, ctrl.signal,
      );
      const result = computeAttribution(parsedWeights, seriesMap);
      setAttrResult(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAttrError(e instanceof ApiError ? e.message : "Failed to compute attribution");
    } finally {
      if (!ctrl.signal.aborted) setAttrLoading(false);
    }
  }, [weightRows, start, end]);

  const maxAbsContrib = useMemo(() => {
    if (!attrResult) return 0.001;
    return Math.max(...attrResult.instruments.map(i => Math.abs(i.contribution)), 0.001);
  }, [attrResult]);

  function fmtPct(v: number): string {
    return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
  }

  function updateRow(i: number, field: keyof WeightRow, value: string) {
    setWeightRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setWeightRows(rows => [...rows, { instrumentId: "", weightStr: "0" }]);
  }

  function removeRow(i: number) {
    setWeightRows(rows => rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Portfolio Lab</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Markowitz mean-variance optimization and performance attribution.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1">
        {(["optimizer", "attribution"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded border cursor-pointer capitalize transition-colors ${
              tab === t ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
            }`}>
            {t === "optimizer" ? "Optimizer" : "Attribution"}
          </button>
        ))}
      </div>

      {/* Shared date range */}
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

      {/* ── OPTIMIZER TAB ── */}
      {tab === "optimizer" && (
        <div className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Instruments (comma or newline)</label>
              <textarea rows={2} value={optimizerText} onChange={e => setOptimizerText(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data" />
            </div>
            <button onClick={runOptimizer} disabled={optimizerLoading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {optimizerLoading ? "Optimizing…" : "Optimize"}
            </button>
          </div>

          {optimizerError && (
            <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{optimizerError}</div>
          )}

          {optimizerResult && (
            <>
              {/* Efficient frontier chart */}
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Efficient Frontier</span>
                </div>
                <div className="p-4">
                  <EfficientFrontierChart
                    frontier={optimizerResult.efficient_frontier}
                    minVariance={optimizerResult.min_variance}
                    maxSharpe={optimizerResult.max_sharpe}
                  />
                </div>
              </div>

              {/* Weight tables side by side */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Min Variance", pw: optimizerResult.min_variance },
                  { label: "Max Sharpe", pw: optimizerResult.max_sharpe },
                ].map(({ label, pw }) => (
                  <div key={label} className="bg-panel border border-border rounded-lg p-4 space-y-3">
                    <div className="text-text-2 text-xs font-semibold">{label}</div>
                    <WeightBars weights={pw.weights} />
                    <div className="flex gap-4 text-xs pt-1 border-t border-border/40 flex-wrap">
                      <span className="text-text-3">Return: <span className={`font-data ${pw.expected_return >= 0 ? "text-pos" : "text-neg"}`}>{fmtPct(pw.expected_return)}</span></span>
                      <span className="text-text-3">Vol: <span className="font-data text-text-2">{(pw.volatility * 100).toFixed(2)}%</span></span>
                      {pw.sharpe !== null && pw.sharpe !== undefined && (
                        <span className="text-text-3">Sharpe: <span className="font-data text-text-2">{pw.sharpe.toFixed(2)}</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!optimizerResult && !optimizerLoading && !optimizerError && (
            <div className="text-center py-12 text-text-3 text-sm">
              Enter instruments and click Optimize to compute the efficient frontier.
            </div>
          )}
        </div>
      )}

      {/* ── ATTRIBUTION TAB ── */}
      {tab === "attribution" && (
        <div className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument Weights</label>
              <div className="space-y-1.5">
                {weightRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={row.instrumentId}
                      onChange={e => updateRow(i, "instrumentId", e.target.value)}
                      placeholder="005930.XKRX"
                      className="h-8 flex-1 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"
                    />
                    <input
                      type="number"
                      value={row.weightStr}
                      onChange={e => updateRow(i, "weightStr", e.target.value)}
                      className="h-8 w-20 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data text-right"
                    />
                    <span className="text-text-3 text-xs">%</span>
                    <button onClick={() => removeRow(i)}
                      className="text-text-3 hover:text-neg text-sm cursor-pointer bg-transparent border-0 px-1">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addRow}
                className="text-xs text-text-3 hover:text-text-2 border border-border rounded px-3 py-1 cursor-pointer bg-transparent mt-1">
                + Add
              </button>
            </div>
            <button onClick={runAttribution} disabled={attrLoading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {attrLoading ? "Computing…" : "Run"}
            </button>
          </div>

          {attrError && (
            <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{attrError}</div>
          )}

          {attrResult && (
            <>
              {/* Portfolio total return */}
              <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                <span className="text-text-3 text-xs uppercase tracking-wider">Portfolio Return</span>
                <span className={`text-lg font-data font-semibold ${attrResult.portfolioReturn >= 0 ? "text-pos" : "text-neg"}`}>
                  {fmtPct(attrResult.portfolioReturn)}
                </span>
              </div>

              {/* Attribution bar chart */}
              <div className="bg-panel border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Return Attribution</span>
                </div>
                <div className="px-4 py-3 space-y-0.5">
                  {/* Header */}
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40 mb-1">
                    <span className="text-text-3 text-[10px] uppercase w-28 shrink-0">Instrument</span>
                    <span className="flex-1 text-text-3 text-[10px] uppercase">Contribution</span>
                    <span className="text-text-3 text-[10px] uppercase w-20 text-right">Contrib</span>
                    <span className="text-text-3 text-[10px] uppercase w-16 text-right">Weight</span>
                    <span className="text-text-3 text-[10px] uppercase w-20 text-right">Total Ret</span>
                  </div>
                  {attrResult.instruments.map(inst => {
                    const pct = (Math.abs(inst.contribution) / maxAbsContrib) * 100;
                    const isPos = inst.contribution >= 0;
                    return (
                      <div key={inst.instrumentId} className="flex items-center gap-2 py-0.5">
                        <span className="text-text-3 font-data text-xs w-28 shrink-0 truncate">
                          {inst.instrumentId.split(".")[0]}
                        </span>
                        <div className="flex-1">
                          <div
                            className={`h-4 rounded-sm ${isPos ? "bg-pos/50" : "bg-neg/50"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-data w-20 text-right ${isPos ? "text-pos" : "text-neg"}`}>
                          {fmtPct(inst.contribution)}
                        </span>
                        <span className="text-text-3 text-xs font-data w-16 text-right">
                          {(inst.weight * 100).toFixed(0)}%
                        </span>
                        <span className={`text-xs font-data w-20 text-right ${inst.totalReturn >= 0 ? "text-pos" : "text-neg"}`}>
                          {fmtPct(inst.totalReturn)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!attrResult && !attrLoading && !attrError && (
            <div className="text-center py-12 text-text-3 text-sm">
              Set instrument weights (must sum to 100%) and click Run to compute attribution.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Portfolio to nav in app/layout.tsx**

Read `app/layout.tsx`. After Phase 8, nav has:
```typescript
{ href: "/universe",   label: "Universe" },
{ href: "/replay",     label: "Replay" },
{ href: "/rolling",    label: "Rolling" },
```
Add `{ href: "/portfolio", label: "Portfolio" }` between `/replay` and `/rolling`:
```typescript
{ href: "/universe",   label: "Universe" },
{ href: "/replay",     label: "Replay" },
{ href: "/portfolio",  label: "Portfolio" },   // NEW
{ href: "/rolling",    label: "Rolling" },
```

- [ ] **Step 3: Update docs/progress.md**

Read first, then prepend this block at the top:
```markdown
### Portfolio Lab (2026-06-28)

**S-9 Portfolio Lab:**
- `lib/portfolio-utils.ts` — `computeAttribution()` (6 tests)
- `components/portfolio/EfficientFrontierChart.tsx` — D3 scatter chart for efficient frontier
- `app/portfolio/page.tsx` — Optimizer tab (Markowitz + frontier chart + weight bars) + Attribution tab (weight input + contribution bar chart)

**Nav additions:** Portfolio (between Replay and Rolling)
**Tests:** 98 passing (92 existing + 6 portfolio-utils)
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```
Expected: 98 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/portfolio/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: add Portfolio Lab page with Markowitz optimizer and attribution analysis"
```

---

## Self-Review

### Spec Coverage

| Requirement | Implementation | Status |
|---|---|---|
| Markowitz optimization | `getPortfolioOptimize` → efficient frontier chart + min-var/max-sharpe weights | ✅ |
| Efficient frontier scatter chart | `EfficientFrontierChart` D3 component | ✅ |
| Weight visualization | `WeightBars` div-based horizontal bars | ✅ |
| Min-variance portfolio | Blue circle on chart + weight bars | ✅ |
| Max-sharpe portfolio | Orange diamond on chart + weight bars | ✅ |
| Performance attribution | `computeAttribution` + contribution bar chart | ✅ |
| Weight validation (sum to 100%) | Pre-run check with ±0.5% tolerance | ✅ |
| Per-instrument contribution | sorted by `|contribution|` descending | ✅ |
| Portfolio total return display | sum of all contributions | ✅ |

### Inline Style Exceptions

- `style={{ width: \`${pct}%\` }}` on WeightBars divs — data-driven dynamic width, ACCEPTED
- `style={{ width: \`${pct}%\` }}` on contribution bars — same, ACCEPTED
- `style={{ width: \`${(w / maxW) * 100}%\` }}` on WeightBars component — same, ACCEPTED

### Type Consistency

- `AttributionInput { instrumentId, weight }` — Task 1 → page ✅
- `PortfolioAttribution { portfolioReturn, instruments }` — Task 1 → page ✅
- `InstrumentAttribution { instrumentId, weight, totalReturn, contribution }` — Task 1 → page ✅
- `FrontierPoint, PortfolioWeights` from `lib/api.ts` → Task 2 + page ✅
- `EfficientFrontierChartProps { frontier, minVariance, maxSharpe, width?, height? }` — Task 2 → Task 3 ✅
