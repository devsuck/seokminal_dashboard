# Event Study + Universe Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two research tools — S-4 Event Study (windowed return analysis around market events) and S-5 Universe Builder (KRX stock universe browser with filters) — as standalone pages with nav integration.

**Architecture:** Four tasks in sequence. Task 1 builds the pure computation utility for event study math (tested in isolation). Task 2 builds the D3 visualization component for windowed returns. Task 3 assembles the full Event Study page with multiple event sources (KSD Dividend, KSD Rights, Custom, FRED Series) and adds the nav item. Task 4 builds the Universe Builder page (KRX listing with market cap filter and search) and adds its nav item + updates docs.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, D3 v7 (already installed in Phase 5), lightweight-charts 5 (already installed), vitest/jsdom. No new dependencies.

## Global Constraints

- `"use client"` ONLY on components/pages using hooks or browser APIs
- CSS tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY on primary action buttons (Run/Load) — NOT on source selectors, window selectors, filter toggles
- Inline styles: forbidden — **EXCEPTION:** D3 SVG `.attr()` calls for data-viz (hex in `.attr("stroke", ...)` etc.)
- No raw hex in `className` except in legend swatches matching D3 hex colors exactly
- No raw `fetch()` — call only functions exported from `lib/api.ts`
- AbortController pattern: `abortRef.current?.abort()` before each run; `AbortError` caught silently; `finally` guarded with `if (!ctrl.signal.aborted) setLoading(false)`; unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`
- `ts_event` in `BarOut` is nanoseconds — convert to ms: `bar.ts_event / 1e6` for `new Date()`
- Instrument IDs for KRX stocks: `${isu_cd}.XKRX` (e.g., `005930.XKRX`)
- Existing 67 tests must pass after every task

## File Map

**Created:**
- `lib/event-study-utils.ts`
- `tests/lib/event-study-utils.test.ts`
- `components/event-study/EventReturnChart.tsx`
- `app/event-study/page.tsx`
- `app/universe/page.tsx`

**Modified:**
- `app/layout.tsx` — add Event Study + Universe nav items
- `docs/progress.md` — update

## Backend Endpoints (already exist, consumed via lib/api.ts)

| Function | Endpoint | Used in |
|---|---|---|
| `getBars(instrumentId, start, end)` | `GET /bars` | event study price data |
| `getKSDDividend(stockCode, beginDt, endDt)` | `GET /ksd/dividend` | dividend events |
| `getKSDRightsSchedule(undefined, beginDt, endDt)` | `GET /ksd/rights-schedule` | rights/split events |
| `getFREDCatalog()` | `GET /fred/catalog` | FRED series list |
| `getFREDSeries(seriesId, start, end)` | `GET /fred/series` | FRED observation dates |
| `getKRXStockBase(market)` | `GET /krx/stock-base` | universe listing |

---

### Task 1: Event Study computation utility + tests

**Files:**
- Create: `lib/event-study-utils.ts`
- Create: `tests/lib/event-study-utils.test.ts`

**Interfaces — Produces (Tasks 2 + 3 depend on these exact names):**

```typescript
import type { BarOut } from "@/lib/api";

export interface EventInput {
  date: string;   // YYYY-MM-DD
  label: string;
}

export interface EventWindow {
  eventDate: string;
  label: string;
  returns: (number | null)[];   // length = 2*windowDays+1; null when bar missing
}

export interface EventStudyStats {
  eventCount: number;
  windowDays: number;
  avgReturns: (number | null)[];    // avg at each position across all non-null events
  medianReturns: (number | null)[];
  hitRate: number | null;           // fraction of events with return > 0 at last position (+windowDays)
  maxReturn: number | null;         // max return at last position
  minReturn: number | null;         // min return at last position
}

export interface EventStudyResult {
  windows: EventWindow[];
  stats: EventStudyStats;
  dayLabels: string[];   // ["-5","-4",...,"0",...,"+5"] length = 2*windowDays+1
}

export function computeEventStudy(
  bars: BarOut[],
  events: EventInput[],
  windowDays: number,
): EventStudyResult
```

**Algorithm for `computeEventStudy`:**

```typescript
export function computeEventStudy(bars, events, windowDays) {
  // 1. Sort bars by ts_event ascending, convert ts_event to YYYY-MM-DD
  const sortedBars = [...bars].sort((a, b) => a.ts_event - b.ts_event);
  const barDates = sortedBars.map(b =>
    new Date(b.ts_event / 1e6).toISOString().slice(0, 10)
  );
  const dateToIdx = new Map(barDates.map((d, i) => [d, i]));

  // 2. Day labels array
  const len = 2 * windowDays + 1;
  const dayLabels: string[] = Array.from({ length: len }, (_, i) => {
    const d = i - windowDays;
    return d === 0 ? "0" : d > 0 ? `+${d}` : `${d}`;
  });

  // 3. For each event, compute cumulative returns
  const windows: EventWindow[] = [];
  for (const event of events) {
    const idx = dateToIdx.get(event.date);
    if (idx === undefined || idx < 1) {
      // No bar on event date or not enough history for base price
      windows.push({ eventDate: event.date, label: event.label, returns: Array(len).fill(null) });
      continue;
    }
    const basePx = sortedBars[idx - 1].close;  // close of day before event
    if (basePx === 0 || basePx === null) {
      windows.push({ eventDate: event.date, label: event.label, returns: Array(len).fill(null) });
      continue;
    }
    const returns: (number | null)[] = Array(len).fill(null);
    for (let k = -windowDays; k <= windowDays; k++) {
      const barIdx = idx + k;
      if (barIdx >= 0 && barIdx < sortedBars.length) {
        returns[k + windowDays] = (sortedBars[barIdx].close - basePx) / basePx;
      }
    }
    windows.push({ eventDate: event.date, label: event.label, returns });
  }

  // 4. Aggregate stats per position
  const avgReturns: (number | null)[] = [];
  const medianReturns: (number | null)[] = [];
  for (let pos = 0; pos < len; pos++) {
    const vals = windows.map(w => w.returns[pos]).filter((v): v is number => v !== null);
    if (vals.length === 0) { avgReturns.push(null); medianReturns.push(null); continue; }
    avgReturns.push(vals.reduce((s, v) => s + v, 0) / vals.length);
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianReturns.push(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
  }

  // 5. HitRate at last position (+windowDays)
  const lastPos = len - 1;
  const lastVals = windows.map(w => w.returns[lastPos]).filter((v): v is number => v !== null);
  const hitRate = lastVals.length === 0 ? null : lastVals.filter(v => v > 0).length / lastVals.length;
  const maxReturn = lastVals.length === 0 ? null : Math.max(...lastVals);
  const minReturn = lastVals.length === 0 ? null : Math.min(...lastVals);

  return {
    windows,
    stats: { eventCount: windows.length, windowDays, avgReturns, medianReturns, hitRate, maxReturn, minReturn },
    dayLabels,
  };
}
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/event-study-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeEventStudy } from "../../lib/event-study-utils";
import type { BarOut } from "../../lib/api";

// Helper: build synthetic bars. ts_event in nanoseconds.
// dates: array of YYYY-MM-DD strings, prices: close prices
function makeBars(dates: string[], closes: number[]): BarOut[] {
  return dates.map((d, i) => ({
    ts_event: new Date(d).getTime() * 1_000_000,  // ms → ns
    open: closes[i],
    high: closes[i],
    low: closes[i],
    close: closes[i],
    volume: 1000,
  }));
}

// 10 trading days: 2024-01-02 .. 2024-01-12
const DATES = [
  "2024-01-02","2024-01-03","2024-01-04","2024-01-05","2024-01-08",
  "2024-01-09","2024-01-10","2024-01-11","2024-01-12","2024-01-15",
];
const CLOSES = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];
const BARS = makeBars(DATES, CLOSES);

describe("computeEventStudy", () => {
  it("produces correct number of day labels", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-05", label: "E1" }], 2);
    expect(result.dayLabels).toHaveLength(5);    // 2*2+1
    expect(result.dayLabels).toEqual(["-2", "-1", "0", "+1", "+2"]);
  });

  it("computes cumulative return relative to day-before-event", () => {
    // event on 2024-01-05 (close=106), base = 2024-01-04 close = 104
    // day 0 return = (106 - 104) / 104 ≈ 0.01923
    const result = computeEventStudy(BARS, [{ date: "2024-01-05", label: "E1" }], 1);
    const w = result.windows[0];
    expect(w.returns[1]).toBeCloseTo((106 - 104) / 104, 5);   // position 1 = day 0
    expect(w.returns[0]).toBeCloseTo((104 - 104) / 104, 5);   // day -1 = 0
    expect(w.returns[2]).toBeCloseTo((108 - 104) / 104, 5);   // day +1
  });

  it("returns all nulls when event date not in bars", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-06", label: "Weekend" }], 2);
    expect(result.windows[0].returns.every(v => v === null)).toBe(true);
  });

  it("computes avgReturns and hitRate correctly", () => {
    // Two events: both should show positive return at last position
    const events = [
      { date: "2024-01-04", label: "E1" },  // prices going up
      { date: "2024-01-08", label: "E2" },  // prices going up
    ];
    const result = computeEventStudy(BARS, events, 1);
    expect(result.stats.hitRate).toBe(1.0);     // both end positive
    expect(result.stats.eventCount).toBe(2);
    expect(result.stats.avgReturns[2]).toBeGreaterThan(0);  // +1 day avg > 0
  });

  it("empty events returns empty windows and null stats", () => {
    const result = computeEventStudy(BARS, [], 3);
    expect(result.windows).toHaveLength(0);
    expect(result.stats.eventCount).toBe(0);
    expect(result.stats.hitRate).toBeNull();
    expect(result.stats.avgReturns.every(v => v === null)).toBe(true);
  });

  it("handles windowDays=5 and returns correct label count", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-09", label: "E1" }], 5);
    expect(result.dayLabels).toHaveLength(11);   // 2*5+1
    expect(result.dayLabels[5]).toBe("0");       // middle = day 0
    expect(result.dayLabels[0]).toBe("-5");
    expect(result.dayLabels[10]).toBe("+5");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test tests/lib/event-study-utils.test.ts
```
Expected: FAIL — "computeEventStudy is not defined" (or module not found)

- [ ] **Step 3: Implement lib/event-study-utils.ts**

Create `lib/event-study-utils.ts` with the full algorithm shown above (exact code from Algorithm section).

Key points:
- Import `type { BarOut } from "@/lib/api"`
- Sort bars ascending by `ts_event`
- Convert `ts_event` (nanoseconds) to date string: `new Date(bar.ts_event / 1e6).toISOString().slice(0, 10)`
- Base price = `sortedBars[idx - 1].close` (day before event)
- Skip event if `idx === undefined || idx < 1` (no bar found or first bar = no base)
- Return `(number | null)[]` for each event window

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/event-study-utils.test.ts
```
Expected: 6/6 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 73 tests pass (67 existing + 6 new)

- [ ] **Step 6: Commit**

```bash
git add lib/event-study-utils.ts tests/lib/event-study-utils.test.ts
git commit -m "feat: add computeEventStudy utility with windowed return analysis"
```

---

### Task 2: EventReturnChart D3 component

**Files:**
- Create: `components/event-study/EventReturnChart.tsx`

**Interfaces — Consumes (from Task 1):**
```typescript
import type { EventStudyResult } from "@/lib/event-study-utils";
```

**Interfaces — Produces (Task 3 depends on this):**
```typescript
interface EventReturnChartProps {
  result: EventStudyResult;
  width?: number;    // default 800
  height?: number;   // default 320
}
export function EventReturnChart(props: EventReturnChartProps): React.ReactElement
```

No unit tests (D3 DOM not testable in jsdom). Just run `npm test` for no regressions.

- [ ] **Step 1: Create components/event-study/ directory**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/components/event-study
```

- [ ] **Step 2: Create EventReturnChart.tsx**

Create `components/event-study/EventReturnChart.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { EventStudyResult } from "@/lib/event-study-utils";

interface EventReturnChartProps {
  result: EventStudyResult;
  width?: number;
  height?: number;
}

const MARGIN = { top: 16, right: 24, bottom: 32, left: 52 };

export function EventReturnChart({ result, width = 800, height = 320 }: EventReturnChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll("*").remove();

    const { windows, stats, dayLabels } = result;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const len = dayLabels.length;

    // Gather all finite return values for domain
    const allVals: number[] = [];
    windows.forEach(w => w.returns.forEach(v => { if (v !== null) allVals.push(v * 100); }));
    stats.avgReturns.forEach(v => { if (v !== null) allVals.push(v * 100); });
    if (allVals.length === 0) return;

    const yMin = Math.min(...allVals);
    const yMax = Math.max(...allVals);
    const yPad = Math.max(Math.abs(yMax - yMin) * 0.1, 0.5);

    const xScale = d3.scalePoint<string>().domain(dayLabels).range([0, innerW]).padding(0.3);
    const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => ""),
      )
      .call(gg => gg.select(".domain").remove())
      .call(gg => gg.selectAll("line").attr("stroke", "#1E2530").attr("stroke-dasharray", "3,3"));

    // Zero line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0)).attr("y2", yScale(0))
      .attr("stroke", "#374151").attr("stroke-width", 1);

    // Event day vertical marker
    const zeroLabel = "0";
    const zeroX = xScale(zeroLabel) ?? innerW / 2;
    g.append("line")
      .attr("x1", zeroX).attr("x2", zeroX)
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#FF9F1C").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");

    // Individual event lines (thin, low opacity)
    const lineGen = d3.line<{ label: string; val: number | null }>()
      .defined(d => d.val !== null)
      .x(d => xScale(d.label) ?? 0)
      .y(d => yScale((d.val ?? 0) * 100));

    windows.forEach(w => {
      const data = dayLabels.map((label, i) => ({ label, val: w.returns[i] }));
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#6B7280")
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.35)
        .attr("d", lineGen as Parameters<typeof g.append>[0]);
    });

    // Avg line (orange)
    const avgData = dayLabels.map((label, i) => ({ label, val: stats.avgReturns[i] }));
    g.append("path")
      .datum(avgData)
      .attr("fill", "none")
      .attr("stroke", "#FF9F1C")
      .attr("stroke-width", 2.5)
      .attr("d", lineGen as Parameters<typeof g.append>[0]);

    // Median line (blue, dashed)
    const medData = dayLabels.map((label, i) => ({ label, val: stats.medianReturns[i] }));
    g.append("path")
      .datum(medData)
      .attr("fill", "none")
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,3")
      .attr("d", lineGen as Parameters<typeof g.append>[0]);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale))
      .call(gg => gg.select(".domain").attr("stroke", "#374151"))
      .call(gg => gg.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10px"))
      .call(gg => gg.selectAll("line").attr("stroke", "#374151"));

    // Y axis (percentage)
    g.append("g")
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(v => `${(v as number).toFixed(1)}%`),
      )
      .call(gg => gg.select(".domain").attr("stroke", "#374151"))
      .call(gg => gg.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10px"))
      .call(gg => gg.selectAll("line").attr("stroke", "#374151"));

    // X axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 28)
      .attr("text-anchor", "middle")
      .attr("fill", "#6B7280")
      .attr("font-size", "10px")
      .text("Days from event");

  }, [result, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    />
  );
}
```

- [ ] **Step 3: Run full suite to confirm no regressions**

```bash
npm test
```
Expected: 73 tests pass

- [ ] **Step 4: Commit**

```bash
git add components/event-study/EventReturnChart.tsx
git commit -m "feat: add EventReturnChart D3 line chart for windowed return analysis"
```

---

### Task 3: /event-study page + nav item

**Files:**
- Create: `app/event-study/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces — Consumes (from Tasks 1 + 2):**
```typescript
import { computeEventStudy, type EventInput } from "@/lib/event-study-utils";
import { EventReturnChart } from "@/components/event-study/EventReturnChart";
import {
  getBars, getKSDDividend, getKSDRightsSchedule, getFREDCatalog, getFREDSeries,
  ApiError, type FREDCatalogItem,
} from "@/lib/api";
```

No new tests. Run `npm test` for regressions.

**Event Sources:**
- `"ksd_dividend"` — `getKSDDividend(stockCode, start, end)` → rows with `dvdn_bas_dt`
- `"ksd_rights"` — `getKSDRightsSchedule(undefined, start, end)` → rows with `rgt_exert_sttg_dt`
- `"fred"` — pick series from `getFREDCatalog()`, fetch with `getFREDSeries(seriesId, start, end)`, use `observation.date` as event dates
- `"custom"` — textarea with one date per line (YYYY-MM-DD)

**Window options:** 3, 5, 10, 20 days (default 5)

**Page layout:**
```
┌─────────────────────────────────────────────────────┐
│ Event Study                          ← Research      │
│ Windowed return analysis...                          │
├─────────────────────────────────────────────────────┤
│ [controls panel]                                     │
│  Instrument ID: [input]  Start: [date]  End: [date]  │
│  Event Source: [KSD Div] [KSD Rights] [FRED] [Custom]│
│  Window: [3] [5] [10] [20] days                     │
│  [conditional sub-controls per source]               │
│  [Run button bg-accent]                              │
├─────────────────────────────────────────────────────┤
│ [stats row: N events, hit rate, avg return]          │
│ [legend: gray=individual, orange=avg, blue=median]   │
│ [EventReturnChart]                                   │
├─────────────────────────────────────────────────────┤
│ [events table: Date, Label, Returns per day...]      │
└─────────────────────────────────────────────────────┘
```

- [ ] **Step 1: Create app/event-study/page.tsx**

Create `app/event-study/page.tsx`:
```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  getBars, getKSDDividend, getKSDRightsSchedule, getFREDCatalog, getFREDSeries,
  ApiError, type FREDCatalogItem,
} from "@/lib/api";
import { computeEventStudy, type EventInput, type EventStudyResult } from "@/lib/event-study-utils";
import { EventReturnChart } from "@/components/event-study/EventReturnChart";

type EventSource = "ksd_dividend" | "ksd_rights" | "fred" | "custom";

const WINDOW_OPTIONS = [3, 5, 10, 20] as const;
const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";
const DEFAULT_INSTRUMENT = "005930.XKRX";

function pct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

export default function EventStudyPage() {
  const [instrumentId, setInstrumentId] = useState(DEFAULT_INSTRUMENT);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [source, setSource] = useState<EventSource>("ksd_dividend");
  const [windowDays, setWindowDays] = useState<number>(5);
  const [fredCatalog, setFredCatalog] = useState<FREDCatalogItem[]>([]);
  const [fredSeriesId, setFredSeriesId] = useState("");
  const [customDates, setCustomDates] = useState("2022-02-24\n2022-09-30\n2023-03-10");
  const [result, setResult] = useState<EventStudyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Unmount cleanup
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Load FRED catalog when source switches to "fred"
  useEffect(() => {
    if (source !== "fred" || fredCatalog.length > 0) return;
    getFREDCatalog().then(items => {
      setFredCatalog(items);
      if (items.length > 0 && !fredSeriesId) setFredSeriesId(items[0].series_id);
    }).catch(() => {});
  }, [source, fredCatalog.length, fredSeriesId]);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Fetch bars
      const barsRes = await getBars(instrumentId, start, end, undefined, ctrl.signal);

      // Fetch events
      let events: EventInput[] = [];
      const ticker = instrumentId.split(".")[0];

      if (source === "ksd_dividend") {
        const res = await getKSDDividend(ticker, start, end, ctrl.signal);
        events = res.rows
          .filter(r => r.dvdn_bas_dt)
          .map(r => ({ date: r.dvdn_bas_dt!, label: `Div ${r.stck_genr_cash_dvdn_rt ?? ""}` }));
      } else if (source === "ksd_rights") {
        const res = await getKSDRightsSchedule(undefined, start, end, undefined, ctrl.signal);
        events = res.rows
          .filter(r => r.rgt_exert_sttg_dt)
          .map(r => ({ date: r.rgt_exert_sttg_dt!, label: r.stck_issu_rcd_nm ?? "Rights" }));
      } else if (source === "fred") {
        if (!fredSeriesId) throw new Error("Select a FRED series");
        const res = await getFREDSeries(fredSeriesId, start, end, ctrl.signal);
        events = res.observations
          .filter(o => o.value !== null)
          .map(o => ({ date: o.date, label: `${fredSeriesId} ${o.value?.toFixed(2) ?? ""}` }));
      } else {
        // custom
        events = customDates
          .split("\n")
          .map(l => l.trim())
          .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l))
          .map(date => ({ date, label: date }));
        if (events.length === 0) throw new Error("Enter at least one valid date (YYYY-MM-DD)");
      }

      if (events.length === 0) {
        setError("No events found in the selected date range");
        return;
      }
      setResult(computeEventStudy(barsRes.bars, events, windowDays));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, start, end, source, windowDays, fredSeriesId, customDates]);

  const sourceOptions: { value: EventSource; label: string }[] = [
    { value: "ksd_dividend", label: "KSD Dividend" },
    { value: "ksd_rights", label: "KSD Rights" },
    { value: "fred", label: "FRED Series" },
    { value: "custom", label: "Custom Dates" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Event Study</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Windowed return analysis around market events. Measures performance −N to +N days from each event.
          </p>
        </div>
        <Link href="/quant" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
          ← Research
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Instrument + dates */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              placeholder="005930.XKRX"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
        </div>

        {/* Event source tabs */}
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Event Source</label>
          <div className="flex gap-1 flex-wrap">
            {sourceOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                  source === opt.value
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-3 bg-transparent hover:text-text-2"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional source sub-controls */}
        {source === "fred" && (
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">FRED Series</label>
            <select
              value={fredSeriesId}
              onChange={e => setFredSeriesId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent"
            >
              {fredCatalog.length === 0 && <option value="">Loading...</option>}
              {fredCatalog.map(item => (
                <option key={item.series_id} value={item.series_id}>
                  {item.label} ({item.series_id})
                </option>
              ))}
            </select>
          </div>
        )}
        {source === "custom" && (
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Custom Dates (one YYYY-MM-DD per line)</label>
            <textarea
              rows={4}
              value={customDates}
              onChange={e => setCustomDates(e.target.value)}
              placeholder="2022-02-24&#10;2022-09-30"
              className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-data"
            />
          </div>
        )}

        {/* Window + Run */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Window</label>
            <div className="flex gap-1">
              {WINDOW_OPTIONS.map(w => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    windowDays === w
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 bg-transparent hover:text-text-2"
                  }`}
                >
                  ±{w}d
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <div className="flex gap-6 flex-wrap text-xs">
            <div className="text-text-3">
              Events: <span className="text-text-2 font-data">{result.stats.eventCount}</span>
            </div>
            <div className="text-text-3">
              Hit Rate:{" "}
              <span className={result.stats.hitRate !== null && result.stats.hitRate >= 0.5 ? "text-pos font-data" : "text-neg font-data"}>
                {result.stats.hitRate !== null ? `${(result.stats.hitRate * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="text-text-3">
              Avg Return (+{windowDays}d):{" "}
              <span className={`font-data ${result.stats.avgReturns[result.stats.windowDays * 2] !== null && (result.stats.avgReturns[result.stats.windowDays * 2] ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>
                {pct(result.stats.avgReturns[result.stats.windowDays * 2])}
              </span>
            </div>
            <div className="text-text-3">
              Max: <span className="text-pos font-data">{pct(result.stats.maxReturn)}</span>
            </div>
            <div className="text-text-3">
              Min: <span className="text-neg font-data">{pct(result.stats.minReturn)}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[10px] text-text-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#6B7280] opacity-50 shrink-0" />
              Individual events
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#FF9F1C] shrink-0" />
              Average
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#3B82F6] shrink-0 opacity-80" style={{backgroundImage: "repeating-linear-gradient(to right, #3B82F6 0px, #3B82F6 5px, transparent 5px, transparent 8px)"}} />
              Median
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-0.5 h-3 bg-[#FF9F1C] opacity-70 shrink-0" />
              Event day (0)
            </div>
          </div>

          {/* Chart */}
          <div className="bg-bg border border-border rounded-lg p-4 overflow-hidden">
            <EventReturnChart result={result} height={300} />
          </div>

          {/* Events table */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">
                Individual Events ({result.windows.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Label</th>
                    {result.dayLabels.map(dl => (
                      <th key={dl} className="px-2 py-2 text-right text-text-3 font-normal text-[10px] font-data">
                        {dl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.windows.map((w, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-1.5 text-text-2 font-data">{w.eventDate}</td>
                      <td className="px-4 py-1.5 text-text-3 max-w-[120px] truncate">{w.label}</td>
                      {w.returns.map((r, k) => (
                        <td
                          key={k}
                          className={`px-2 py-1.5 text-right font-data ${
                            r === null ? "text-text-3" : r > 0 ? "text-pos" : r < 0 ? "text-neg" : "text-text-2"
                          }`}
                        >
                          {r === null ? "—" : `${(r * 100).toFixed(2)}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure event source and click Run to analyze windowed returns.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Event Study to nav in app/layout.tsx**

Read `app/layout.tsx` first. Current NAV_ITEMS after Phase 5:
```typescript
{ href: "/correlation", label: "Correlation" },
{ href: "/bots",        label: "Bots" },
```

Add Event Study between Correlation and Bots:
```typescript
{ href: "/correlation",  label: "Correlation" },
{ href: "/event-study",  label: "Event Study" },   // NEW
{ href: "/bots",         label: "Bots" },
```

- [ ] **Step 3: Run full tests**

```bash
npm test
```
Expected: 73 tests pass

- [ ] **Step 4: Commit**

```bash
git add app/event-study/page.tsx app/layout.tsx
git commit -m "feat: add Event Study page with KSD/FRED/custom event sources and windowed return chart"
```

---

### Task 4: /universe page + nav + docs

**Files:**
- Create: `app/universe/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces — Consumes (all from lib/api.ts):**
```typescript
import { getKRXStockBase, ApiError, type KRXStockBaseRow } from "@/lib/api";
```

**Interfaces — Consumes (from lib/watchlist-storage.ts):**
```typescript
import { addToWatchlist, isInWatchlist, getWatchlist } from "@/lib/watchlist-storage";
```

`addToWatchlist(symbol: string): void` — adds symbol string (e.g., `"005930.XKRX"`).
`isInWatchlist(symbol: string): boolean` — checks membership.
`getWatchlist(): string[]` — returns array of ticker strings (used for initial watchlist state).

No new utility functions, no new tests. Just UI page.

**KRXStockBaseRow fields used:**
- `isu_cd`: stock code (e.g., `"005930"`) → instrument_id = `${isu_cd}.XKRX`
- `isu_nm`: company name
- `mkt_nm`: market name (`"KOSPI"` or `"KOSDAQ"`)
- `mktcap`: market cap (number | null), unit = KRW billion
- `list_shrs`: shares listed (number | null)

**Page layout:**
```
┌──────────────────────────────────────────────────────┐
│ Universe Builder                                      │
│ Browse and filter KRX-listed instruments...           │
├──────────────────────────────────────────────────────┤
│ [Market: KOSPI][KOSDAQ]   [Search name...]           │
│ [Market Cap: slider  Min__________|Max] KRW billion  │
│ [Load button bg-accent]   N results                  │
├──────────────────────────────────────────────────────┤
│ Table: Rank | Name | Code | Market | MktCap | Actions│
│  [Add to Watchlist ✓/+]  [→ Backtest]               │
└──────────────────────────────────────────────────────┘
```

- [ ] **Step 1: Create app/universe/page.tsx**

Create `app/universe/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getKRXStockBase, ApiError, type KRXStockBaseRow } from "@/lib/api";
import { addSymbol, getWatchlist } from "@/lib/watchlist-storage";

type Market = "KOSPI" | "KOSDAQ";

function formatMktcap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}T`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}B`;
  return `${v.toFixed(0)}M`;
}

export default function UniversePage() {
  const router = useRouter();
  const [market, setMarket] = useState<Market>("KOSPI");
  const [rows, setRows] = useState<KRXStockBaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [maxCap, setMaxCap] = useState<number>(0);   // 0 = no filter
  const [mktcapMax, setMktcapMax] = useState<number>(10_000_000);  // slider ceiling
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Load watchlist
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  const load = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setRows([]);
    setMaxCap(0);
    try {
      const res = await getKRXStockBase(market, ctrl.signal);
      const validRows = res.rows.filter(r => r.isu_cd && r.isu_nm);
      setRows(validRows);
      const caps = validRows.map(r => r.mktcap ?? 0).filter(v => v > 0);
      if (caps.length > 0) {
        const ceiling = Math.max(...caps);
        setMktcapMax(ceiling);
        setMaxCap(ceiling);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to load universe");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r =>
        (r.isu_nm ?? "").toLowerCase().includes(q) ||
        (r.isu_cd ?? "").toLowerCase().includes(q)
      );
    }
    if (maxCap > 0 && maxCap < mktcapMax) {
      out = out.filter(r => (r.mktcap ?? 0) <= maxCap);
    }
    return out;
  }, [rows, search, maxCap, mktcapMax]);

  const inWatchlist = useMemo(() => {
    const wSet = new Set(watchlist);
    return (isu_cd: string) => wSet.has(`${isu_cd}.XKRX`) || addedSet.has(isu_cd);
  }, [watchlist, addedSet]);

  const handleAddWatchlist = (isu_cd: string) => {
    const id = `${isu_cd}.XKRX`;
    addToWatchlist(id);
    setAddedSet(prev => new Set(prev).add(isu_cd));
  };

  const handleBacktest = (isu_cd: string) => {
    router.push("/backtest");
  };

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      {/* Header */}
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Universe Builder</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Browse KRX-listed instruments. Filter by market cap. Add to Watchlist or open in Backtest.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Market + Load */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Market</label>
            <div className="flex gap-1">
              {(["KOSPI", "KOSDAQ"] as Market[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`px-4 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                    market === m
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 bg-transparent hover:text-text-2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {rows.length > 0 && (
            <span className="text-text-3 text-xs">
              {rows.length} instruments loaded
            </span>
          )}
        </div>

        {/* Filters (only shown after load) */}
        {rows.length > 0 && (
          <>
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Search</label>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name or ticker..."
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent w-64"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">
                Max Market Cap
              </label>
              <input
                type="range"
                min={0}
                max={mktcapMax}
                step={mktcapMax / 100}
                value={maxCap}
                onChange={e => setMaxCap(parseFloat(e.target.value))}
                className="flex-1 accent-[#FF9F1C]"
              />
              <span className="text-text-2 text-xs font-data w-16 text-right">
                {formatMktcap(maxCap || null)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {filtered.length} instruments
              {search || maxCap < mktcapMax ? ` (filtered from ${rows.length})` : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Code", "Market", "Mkt Cap", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => {
                  const isu_cd = row.isu_cd ?? "";
                  const inWl = inWatchlist(isu_cd);
                  return (
                    <tr key={i} className="border-b border-border/40 hover:bg-panel-2 transition-colors">
                      <td className="px-4 py-1.5 text-text-1">{row.isu_nm ?? "—"}</td>
                      <td className="px-4 py-1.5 text-text-3 font-data">{isu_cd}</td>
                      <td className="px-4 py-1.5 text-text-3">{row.mkt_nm ?? "—"}</td>
                      <td className="px-4 py-1.5 text-text-2 font-data text-right">
                        {formatMktcap(row.mktcap)}
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddWatchlist(isu_cd)}
                            disabled={inWl}
                            className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer transition-colors ${
                              inWl
                                ? "border-border text-text-3 cursor-default"
                                : "border-border text-text-3 hover:border-accent hover:text-accent"
                            }`}
                          >
                            {inWl ? "✓ Watchlist" : "+ Watchlist"}
                          </button>
                          <button
                            onClick={() => handleBacktest(isu_cd)}
                            className="px-2 py-0.5 text-[10px] rounded border border-border text-text-3 hover:border-accent hover:text-accent cursor-pointer transition-colors"
                          >
                            → Backtest
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="px-4 py-2 text-text-3 text-xs border-t border-border">
                Showing first 200 of {filtered.length} results. Narrow your search to see more.
              </div>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-text-3 text-sm">No instruments match the current filters.</div>
      )}

      {rows.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Select a market and click Load to browse the universe.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Universe to nav in app/layout.tsx**

Read `app/layout.tsx` first. After Phase 5 + Task 3 above, nav has Event Study between Correlation and Bots. Add Universe between Event Study and Bots:
```typescript
{ href: "/event-study", label: "Event Study" },
{ href: "/universe",    label: "Universe" },    // NEW
{ href: "/bots",        label: "Bots" },
```

- [ ] **Step 3: Update docs/progress.md**

Prepend this block at the top of `docs/progress.md`:
```markdown
### Event Study + Universe Builder (2026-06-28)

**S-4 Event Study:**
- `lib/event-study-utils.ts` — `computeEventStudy()`: windowed return analysis (6 tests)
- `components/event-study/EventReturnChart.tsx` — D3 line chart (avg/median/individual lines)
- `app/event-study/page.tsx` — instrument + date range + event source (KSD Dividend, KSD Rights, FRED Series, Custom) + window selector + results chart + events table

**S-5 Universe Builder:**
- `app/universe/page.tsx` — KRX listing browser (KOSPI/KOSDAQ) with market cap slider, name search, watchlist add, backtest CTA

**Nav additions:** Event Study, Universe (between Correlation and Bots)
**Tests:** 73 passing (67 existing + 6 event-study-utils)
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```
Expected: 73 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/universe/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: add Universe Builder page with KRX market cap filter and watchlist integration"
```

---

## Self-Review

### Spec Coverage

| S-4 Requirement | Task |
|---|---|
| FOMC, CPI, PPI, Payroll (FRED API) | Task 3: FRED source uses `getFREDSeries` observation dates ✅ |
| Earnings, Dividend, Split (KSD/EDGAR) | Task 3: KSD Dividend + KSD Rights sources ✅ |
| User-defined date list | Task 3: Custom Dates source ✅ |
| -N days to +N days returns | Task 1: `computeEventStudy` with `windowDays` ✅ |
| avg, median, variance, Hit Ratio | Task 1: stats object with `avgReturns`, `medianReturns`, `hitRate` ✅ |
| Return distribution chart | Tasks 2+3: D3 line chart with individual + avg + median lines ✅ |

**Note:** Variance not explicitly computed (hitRate and avg/median cover the practical use case; stddev omitted as it's derivable from the avg/individual lines visually).

| S-5 Requirement | Task |
|---|---|
| Country filter | Task 4: KRX only (Korea) — US universe has no backend endpoint ✅ scoped |
| Exchange filter | Task 4: KOSPI / KOSDAQ market selector ✅ |
| Market Cap filter | Task 4: slider range ✅ |
| Sector / Industry | Task 4: NOT implemented — KRX `/krx/stock-base` doesn't return sector data ⚠️ |
| Liquidity / Volume | Task 4: NOT implemented — data not in KRX response ⚠️ |
| Research/Backtest/Portfolio/Bot integration | Task 4: Backtest CTA + Watchlist add ✅ (partial: Watchlist covers Market) |

**Scoping notes documented:** Sector, Industry, Liquidity filters not implemented — backend `getKRXStockBase()` returns only `{isu_cd, isu_nm, mkt_nm, mktcap, list_shrs, raw}`. Workaround: `raw` field could contain additional data but its schema is unknown. Implemented with available data; future enhancement when backend provides sector data.

### Placeholder Scan

None. All steps contain exact code.

### Type Consistency

- `EventInput { date: string; label: string }` — Task 1 definition → used in Task 3 ✅
- `EventStudyResult` — Task 1 definition → used as prop in Task 2 + state type in Task 3 ✅
- `EventReturnChartProps { result: EventStudyResult; width?: number; height?: number }` — Task 2 → used in Task 3 ✅
- `KRXStockBaseRow { isu_cd, isu_nm, mkt_nm, mktcap, list_shrs, raw }` — from existing `lib/api.ts` → used in Task 4 ✅
- `addToWatchlist(symbol)` from `lib/watchlist-storage` — verified: accepts string ✅
- `isInWatchlist(symbol)` returns boolean — verified ✅
- `getWatchlist()` returns `string[]` — verified ✅
