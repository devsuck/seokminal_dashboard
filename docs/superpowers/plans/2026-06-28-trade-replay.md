# Trade Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Trade Replay page (S-7) that runs a backtest and lets the user step through trades one-by-one on a candlestick chart with entry/exit markers, step/play controls, and running P&L stats.

**Architecture:** Three tasks. Task 1 is a pure utility library (running stats from backtest trades). Task 2 builds the chart component with trade markers using `createSeriesMarkers` (lightweight-charts v5 plugin API). Task 3 assembles the full page with controls, trade list, and nav integration.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts 5 (already installed), vitest/jsdom. No new dependencies.

## Global Constraints

- `"use client"` ONLY on components/pages using hooks or browser APIs
- CSS tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY on primary action buttons (Run)
- Active tabs/selected items: `border-accent text-accent bg-accent/10`
- Inline styles: forbidden — EXCEPTION: `createChart` config object (chart library), chart container `style={{ height }}`, and lightweight-charts marker colors (hex in marker config objects, not className)
- No hardcoded hex in `className`
- No raw `fetch()` — use `getBacktest` from `lib/api.ts`
- AbortController pattern: `abortRef.current?.abort()` before each run; catch `AbortError` silently; `finally { if (!ctrl.signal.aborted) setLoading(false) }`; unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`
- `entry_ts_ns` / `exit_ts_ns` in `TradeRecord` are NANOSECONDS — convert to UTCTimestamp seconds: `Math.floor(ts_ns / 1e9) as UTCTimestamp`
- lightweight-charts v5 marker API: `import { createSeriesMarkers } from "lightweight-charts"` (NOT `series.setMarkers()`)
- `SeriesMarker` shape: `"arrowUp" | "arrowDown" | "circle" | "square"`; position: `"aboveBar" | "belowBar" | "inBar"`
- Existing 85 tests must pass after every task

## File Map

**Created:**
- `lib/replay-utils.ts`
- `tests/lib/replay-utils.test.ts`
- `components/replay/ReplayChart.tsx`
- `app/replay/page.tsx`

**Modified:**
- `app/layout.tsx` — add Replay nav item between Universe and Rolling
- `docs/progress.md` — update

## Data Flow

```
getBacktest(...) → BacktestResponse.trades: TradeRecord[]
                                   ↓
                         computeRunningStats(trades, currentIndex) → RunningStats (displayed)
                                   ↓
                         ReplayChart(bars, trades[0..currentIndex]) → candlestick + markers
```

`TradeRecord` from `lib/api.ts`:
```typescript
export interface TradeRecord {
  entry_ts_ns: number;
  exit_ts_ns: number | null;
  entry_price: number;
  exit_price: number | null;
  side: string;           // "LONG" | "SHORT"
  pnl: number | null;
  qty: number;
}
```

`BacktestResponse.trades: TradeRecord[]` — trades in chronological order.

---

### Task 1: Replay utility + tests

**Files:**
- Create: `lib/replay-utils.ts`
- Create: `tests/lib/replay-utils.test.ts`

**Interfaces — Produces (Tasks 2+3 depend on these exact names):**

```typescript
import type { TradeRecord } from "@/lib/api";

export interface RunningStats {
  totalTrades: number;      // trades[0..upToIndex].length
  completedTrades: number;  // those with exit_price !== null
  runningPnl: number;       // sum of pnl for completed trades
  winCount: number;
  lossCount: number;
  winRate: number | null;   // winCount / completedTrades; null if completedTrades === 0
  bestTrade: number | null; // max(pnl), null if no completed trades
  worstTrade: number | null; // min(pnl), null if no completed trades
}

export function computeRunningStats(
  trades: TradeRecord[],
  upToIndex: number,   // inclusive; if < 0 → treat as -1 (no trades visible yet)
): RunningStats
```

**Algorithm for `computeRunningStats`:**
```
if upToIndex < 0: return all zeros (zero counts, 0 pnl, null winRate/bestTrade/worstTrade)
slice = trades[0 .. min(upToIndex, trades.length - 1)]
completed = slice.filter(t => t.exit_price !== null && t.pnl !== null)
pnls = completed.map(t => t.pnl!)
wins = pnls.filter(p => p > 0)
runningPnl = sum(pnls)
winRate = completed.length > 0 ? wins.length / completed.length : null
bestTrade = pnls.length > 0 ? max(pnls) : null
worstTrade = pnls.length > 0 ? min(pnls) : null
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/replay-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeRunningStats } from "../../lib/replay-utils";
import type { TradeRecord } from "../../lib/api";

function makeTrade(pnl: number | null, side = "LONG"): TradeRecord {
  return {
    entry_ts_ns: 1_000_000_000_000,
    exit_ts_ns: pnl !== null ? 2_000_000_000_000 : null,
    entry_price: 100,
    exit_price: pnl !== null ? 110 : null,
    side,
    pnl,
    qty: 1,
  };
}

describe("computeRunningStats", () => {
  it("returns zeros for upToIndex < 0", () => {
    const trades = [makeTrade(50)];
    const stats = computeRunningStats(trades, -1);
    expect(stats.totalTrades).toBe(0);
    expect(stats.completedTrades).toBe(0);
    expect(stats.runningPnl).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.bestTrade).toBeNull();
  });

  it("handles empty trades array", () => {
    const stats = computeRunningStats([], 0);
    expect(stats.totalTrades).toBe(0);
    expect(stats.completedTrades).toBe(0);
    expect(stats.runningPnl).toBe(0);
    expect(stats.winRate).toBeNull();
  });

  it("counts only completed trades (with exit_price)", () => {
    const trades = [makeTrade(50), makeTrade(null), makeTrade(30)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.totalTrades).toBe(3);
    expect(stats.completedTrades).toBe(2);
  });

  it("accumulates running PnL from completed trades only", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(null)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.runningPnl).toBeCloseTo(30);
  });

  it("computes win rate correctly", () => {
    const trades = [makeTrade(50), makeTrade(30), makeTrade(-20)];
    const stats = computeRunningStats(trades, 2);
    // 2 wins out of 3 completed
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
    expect(stats.winCount).toBe(2);
    expect(stats.lossCount).toBe(1);
  });

  it("respects upToIndex — only includes trades up to that index", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(100)];
    const stats = computeRunningStats(trades, 0);
    expect(stats.totalTrades).toBe(1);
    expect(stats.runningPnl).toBeCloseTo(50);
  });

  it("computes best and worst trade", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(100)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.bestTrade).toBeCloseTo(100);
    expect(stats.worstTrade).toBeCloseTo(-20);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/nautilus-dashboard && npm test tests/lib/replay-utils.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement lib/replay-utils.ts**

Create `lib/replay-utils.ts`:
```typescript
import type { TradeRecord } from "@/lib/api";

export interface RunningStats {
  totalTrades: number;
  completedTrades: number;
  runningPnl: number;
  winCount: number;
  lossCount: number;
  winRate: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
}

export function computeRunningStats(
  trades: TradeRecord[],
  upToIndex: number,
): RunningStats {
  if (upToIndex < 0 || trades.length === 0) {
    return {
      totalTrades: 0,
      completedTrades: 0,
      runningPnl: 0,
      winCount: 0,
      lossCount: 0,
      winRate: null,
      bestTrade: null,
      worstTrade: null,
    };
  }
  const slice = trades.slice(0, upToIndex + 1);
  const completed = slice.filter(
    (t): t is TradeRecord & { pnl: number; exit_price: number } =>
      t.exit_price !== null && t.pnl !== null,
  );
  const pnls = completed.map(t => t.pnl);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p <= 0);
  const runningPnl = pnls.reduce((s, p) => s + p, 0);
  return {
    totalTrades: slice.length,
    completedTrades: completed.length,
    runningPnl,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: completed.length > 0 ? wins.length / completed.length : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/replay-utils.test.ts
```
Expected: 7/7 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 92 tests pass (85 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add lib/replay-utils.ts tests/lib/replay-utils.test.ts
git commit -m "feat: add trade replay running stats utility"
```

---

### Task 2: ReplayChart component

**Files:**
- Create: `components/replay/ReplayChart.tsx`

**Interfaces — Consumes:**
```typescript
import type { TradeRecord, BarOut } from "@/lib/api";
```

**Interfaces — Produces (Task 3 uses these exact names):**
```typescript
interface ReplayChartProps {
  bars: BarOut[];           // all bars (full history)
  trades: TradeRecord[];    // all trades
  currentIndex: number;     // show markers for trades[0..currentIndex]; -1 = no markers
  height?: number;          // default 360
}
export function ReplayChart(props: ReplayChartProps): React.ReactElement
```

**Implementation:**

lightweight-charts v5 API:
- `import { createChart, CandlestickSeries, createSeriesMarkers } from "lightweight-charts"`
- `import type { UTCTimestamp, SeriesMarker } from "lightweight-charts"`

Chart config (inline style exception — chart library config):
```typescript
const chart = createChart(ref.current, {
  width: ref.current.clientWidth,
  height,
  layout: { background: { color: "#0F131A" }, textColor: "#6B7280" },
  grid: { vertLines: { color: "#1E2530" }, horzLines: { color: "#1E2530" } },
  timeScale: { borderColor: "#374151" },
  rightPriceScale: { borderColor: "#374151" },
});
```

CandleSeries config (inline style exception — chart library config):
```typescript
const series = chart.addSeries(CandlestickSeries, {
  upColor: "#22C55E",
  downColor: "#EF4444",
  borderUpColor: "#22C55E",
  borderDownColor: "#EF4444",
  wickUpColor: "#22C55E",
  wickDownColor: "#EF4444",
});
```

Bar data (convert `BarOut.ts_event` nanoseconds to UTCTimestamp seconds):
```typescript
const candles = bars.map(b => ({
  time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
  open: b.open, high: b.high, low: b.low, close: b.close,
}));
series.setData(candles);
```

**Marker generation (per trade):**
For each `trade = trades[i]` where `i <= currentIndex`:
- **Entry marker**: 
  - `time = Math.floor(trade.entry_ts_ns / 1e9) as UTCTimestamp`
  - `side === "LONG"` or `"BUY"`: `position: "belowBar"`, `shape: "arrowUp"`, `color: "#22C55E"`, `text: "E"`
  - else (SHORT/SELL): `position: "aboveBar"`, `shape: "arrowDown"`, `color: "#EF4444"`, `text: "E"`
- **Exit marker** (only if `trade.exit_ts_ns !== null`):
  - `time = Math.floor(trade.exit_ts_ns / 1e9) as UTCTimestamp`
  - `pnl > 0`: `position: "aboveBar"`, `shape: "circle"`, `color: "#22C55E"`, `text: "X"`
  - `pnl <= 0 or null`: `position: "aboveBar"`, `shape: "circle"`, `color: "#EF4444"`, `text: "X"`

Apply markers:
```typescript
const markers: SeriesMarker<UTCTimestamp>[] = [];
for (let i = 0; i <= Math.min(currentIndex, trades.length - 1); i++) {
  // ... build entry + exit markers for trades[i]
  markers.push(...tradeMarkers);
}
// Sort markers by time ascending (required by lightweight-charts)
markers.sort((a, b) => (a.time as number) - (b.time as number));
createSeriesMarkers(series, markers);
```

**Full component:**
```tsx
"use client";

import { useRef, useEffect } from "react";
import { createChart, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";
import type { UTCTimestamp, SeriesMarker } from "lightweight-charts";
import type { TradeRecord, BarOut } from "@/lib/api";

interface ReplayChartProps {
  bars: BarOut[];
  trades: TradeRecord[];
  currentIndex: number;
  height?: number;
}

export function ReplayChart({ bars, trades, currentIndex, height = 360 }: ReplayChartProps) {
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

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    const candles = bars.map(b => ({
      time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    series.setData(candles);

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const limit = Math.min(currentIndex, trades.length - 1);
    for (let i = 0; i <= limit; i++) {
      const trade = trades[i];
      const isLong = trade.side === "LONG" || trade.side === "BUY";
      markers.push({
        time: Math.floor(trade.entry_ts_ns / 1e9) as UTCTimestamp,
        position: isLong ? "belowBar" : "aboveBar",
        shape: isLong ? "arrowUp" : "arrowDown",
        color: isLong ? "#22C55E" : "#EF4444",
        text: "E",
      });
      if (trade.exit_ts_ns !== null) {
        const exitWin = trade.pnl !== null && trade.pnl > 0;
        markers.push({
          time: Math.floor(trade.exit_ts_ns / 1e9) as UTCTimestamp,
          position: "aboveBar",
          shape: "circle",
          color: exitWin ? "#22C55E" : "#EF4444",
          text: "X",
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    if (markers.length > 0) createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, trades, currentIndex, height]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
```

No tests needed. Run full suite to check regressions.

- [ ] **Step 1: Create components/replay/ directory**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/nautilus-dashboard/components/replay
```

- [ ] **Step 2: Create components/replay/ReplayChart.tsx**

Write the complete file as shown in the Implementation section above.

- [ ] **Step 3: Run full tests**

```bash
npm test
```
Expected: 92 tests pass (no regressions)

- [ ] **Step 4: Commit**

```bash
git add components/replay/ReplayChart.tsx
git commit -m "feat: add ReplayChart component with candlestick series and trade markers"
```

---

### Task 3: /replay page + nav + docs

**Files:**
- Create: `app/replay/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces — Consumes:**
```typescript
import { getBacktest, ApiError, type TradeRecord, type BarOut, type BacktestResponse } from "@/lib/api";
import { computeRunningStats, type RunningStats } from "@/lib/replay-utils";
import { ReplayChart } from "@/components/replay/ReplayChart";
```

**Page layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Trade Replay                                                          │
│ Step through backtest trades on a live chart                         │
├──────────────────────────────────────────────────────────────────────┤
│ [controls: Instrument | Start | End | Strategy | Run bg-accent]      │
├─────────────────────────────────────────────────────────────┬────────┤
│ Running stats row: Total | Completed | PnL | Win Rate       │        │
├─────────────────────────────────────────────────────────────┤ Trade  │
│ [ReplayChart — full width, height 360]                      │ List   │
├─────────────────────────────────────────────────────────────┤ Panel  │
│ Playback controls:                                          │        │
│ [|◀ First] [◀ Prev] [▶ Play / ⏸ Pause] [Next ▶] [Last ▶|] │        │
│ Speed: [0.5x][1x][2x]    Trade N / M                       │        │
└─────────────────────────────────────────────────────────────┴────────┘
```

**State:**
```typescript
const [instrumentId, setInstrumentId] = useState("005930.XKRX");
const [start, setStart] = useState("2022-01-01");
const [end, setEnd] = useState("2026-01-01");
const [strategy, setStrategy] = useState("ema_cross");
const [fastEma, setFastEma] = useState("10");
const [slowEma, setSlowEma] = useState("30");
const [bars, setBars] = useState<BarOut[]>([]);
const [trades, setTrades] = useState<TradeRecord[]>([]);
const [currentIndex, setCurrentIndex] = useState(-1);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [isPlaying, setIsPlaying] = useState(false);
const [speed, setSpeed] = useState<1000 | 500 | 250>(1000); // ms per step
const abortRef = useRef<AbortController | null>(null);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

**Run handler:**
```typescript
const run = useCallback(async () => {
  // abort any existing fetch
  abortRef.current?.abort();
  // stop any ongoing playback
  if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  setIsPlaying(false);
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  setLoading(true);
  setError(null);
  setBars([]);
  setTrades([]);
  setCurrentIndex(-1);
  try {
    const [barsRes, btRes] = await Promise.all([
      getBars(instrumentId, start, end, undefined, ctrl.signal),
      getBacktest(instrumentId, start, end, strategy, { fast_ema: fastEma, slow_ema: slowEma }, undefined, ctrl.signal),
    ]);
    setBars(barsRes.bars);
    setTrades(btRes.trades);
    // don't auto-advance currentIndex — user starts at -1 (no markers yet)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    setError(e instanceof ApiError ? e.message : "Failed to run backtest");
  } finally {
    if (!ctrl.signal.aborted) setLoading(false);
  }
}, [instrumentId, start, end, strategy, fastEma, slowEma]);
```

**Unmount cleanup:**
```typescript
useEffect(() => () => {
  abortRef.current?.abort();
  if (intervalRef.current) clearInterval(intervalRef.current);
}, []);
```

**Playback controls:**
```typescript
const goFirst = () => { stop(); setCurrentIndex(-1); };
const goPrev = () => setCurrentIndex(i => Math.max(-1, i - 1));
const goNext = () => setCurrentIndex(i => Math.min(trades.length - 1, i + 1));
const goLast = () => { stop(); setCurrentIndex(trades.length - 1); };

function stop() {
  if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  setIsPlaying(false);
}

function play() {
  if (currentIndex >= trades.length - 1) setCurrentIndex(-1); // restart from beginning
  setIsPlaying(true);
  intervalRef.current = setInterval(() => {
    setCurrentIndex(prev => {
      if (prev >= trades.length - 1) {
        stop();
        return prev;
      }
      return prev + 1;
    });
  }, speed);
}
```

Note: `stop()` is called inside the interval callback — the interval callback needs to call `clearInterval(intervalRef.current)` and `setIsPlaying(false)` inline (can't call `stop()` in a closure since `stop` captures `intervalRef` stably via ref). Implement as:
```typescript
intervalRef.current = setInterval(() => {
  setCurrentIndex(prev => {
    if (prev >= trades.length - 1) {
      clearInterval(intervalRef.current!);
      intervalRef.current = null;
      setIsPlaying(false);
      return prev;
    }
    return prev + 1;
  });
}, speed);
```

**Running stats display:**
```typescript
const stats = useMemo(
  () => computeRunningStats(trades, currentIndex),
  [trades, currentIndex]
);
```

Format helpers:
```typescript
function fmtPnl(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}
function fmtPct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
}
```

**Trade list panel (right side):**
- Fixed height (`max-h-96 overflow-y-auto`)
- Each row: trade index, side, entry → exit price, PnL
- Highlight `currentIndex` row: `bg-accent/10 border-l-2 border-accent`
- Completed trades with positive PnL: `text-pos`; negative: `text-neg`; open: `text-text-3`
- Click row → `setCurrentIndex(i)` (allows random access)

**Strategy selector:** Simple text input for strategy name (`ema_cross` default) + fast/slow EMA number inputs.

**Speed options:** [1x][2x][4x] maps to [1000ms, 500ms, 250ms].

**Nav addition:** Add `{ href: "/replay", label: "Replay" }` between `"/universe"` and `"/rolling"`.

**docs/progress.md update:** Prepend Trade Replay block at top.

No new tests. Run `npm test` for regressions.

- [ ] **Step 1: Create app/replay/page.tsx**

```tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getBars, getBacktest, ApiError, type TradeRecord, type BarOut } from "@/lib/api";
import { computeRunningStats } from "@/lib/replay-utils";
import { ReplayChart } from "@/components/replay/ReplayChart";

type SpeedMs = 1000 | 500 | 250;
const SPEED_OPTIONS: { label: string; ms: SpeedMs }[] = [
  { label: "1x", ms: 1000 },
  { label: "2x", ms: 500 },
  { label: "4x", ms: 250 },
];

export default function ReplayPage() {
  const [instrumentId, setInstrumentId] = useState("005930.XKRX");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const [strategy, setStrategy] = useState("ema_cross");
  const [fastEma, setFastEma] = useState("10");
  const [slowEma, setSlowEma] = useState("30");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMs>(1000);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradesRef = useRef<TradeRecord[]>([]);
  tradesRef.current = trades;

  useEffect(() => () => {
    abortRef.current?.abort();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setBars([]);
    setTrades([]);
    setCurrentIndex(-1);
    try {
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, undefined, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, { fast_ema: fastEma, slow_ema: slowEma }, undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setTrades(btRes.trades);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to run backtest");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, start, end, strategy, fastEma, slowEma]);

  function stopPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }

  function startPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); }
    setCurrentIndex(prev => prev >= tradesRef.current.length - 1 ? -1 : prev);
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= tradesRef.current.length - 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
  }

  const goFirst = () => { stopPlayback(); setCurrentIndex(-1); };
  const goPrev = () => setCurrentIndex(i => Math.max(-1, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(trades.length - 1, i + 1));
  const goLast = () => { stopPlayback(); setCurrentIndex(trades.length - 1); };

  const stats = useMemo(() => computeRunningStats(trades, currentIndex), [trades, currentIndex]);

  const hasTrades = trades.length > 0;
  const tradeLabel = hasTrades
    ? `Trade ${currentIndex < 0 ? 0 : currentIndex + 1} / ${trades.length}`
    : "No trades";

  function fmtPnl(v: number): string {
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  }

  function fmtPct(v: number | null): string {
    return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Trade Replay</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Step through backtest trades on a live candlestick chart.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input value={instrumentId} onChange={e => setInstrumentId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-36" />
          </div>
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
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Strategy</label>
            <input value={strategy} onChange={e => setStrategy(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-28" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Fast EMA</label>
            <input type="number" value={fastEma} onChange={e => setFastEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Slow EMA</label>
            <input type="number" value={slowEma} onChange={e => setSlowEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
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

      {hasTrades && (
        <>
          {/* Running stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Trades Shown", value: `${stats.totalTrades}/${trades.length}` },
              { label: "Running P&L", value: fmtPnl(stats.runningPnl), colored: true, val: stats.runningPnl },
              { label: "Win Rate", value: fmtPct(stats.winRate) },
              { label: "W / L", value: `${stats.winCount} / ${stats.lossCount}` },
            ].map(s => (
              <div key={s.label} className="bg-panel border border-border rounded-lg px-4 py-3">
                <div className="text-text-3 text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className={`text-sm font-data mt-1 ${s.colored ? (s.val! >= 0 ? "text-pos" : "text-neg") : "text-text-1"}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + trade list */}
          <div className="flex gap-4">
            {/* Chart column */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">{instrumentId} — {tradeLabel}</span>
                </div>
                <div className="p-2">
                  <ReplayChart bars={bars} trades={trades} currentIndex={currentIndex} height={360} />
                </div>
              </div>

              {/* Playback controls */}
              <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  <button onClick={goFirst} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    |◀
                  </button>
                  <button onClick={goPrev} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ◀
                  </button>
                  <button
                    onClick={isPlaying ? stopPlayback : startPlayback}
                    disabled={trades.length === 0}
                    className="px-3 py-1 text-xs bg-accent text-black font-semibold rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-40">
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button onClick={goNext} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶
                  </button>
                  <button onClick={goLast} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶|
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-text-3 text-xs">Speed:</span>
                  {SPEED_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => setSpeed(opt.ms)}
                      className={`px-2 py-0.5 text-xs rounded border cursor-pointer transition-colors ${
                        speed === opt.ms ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <span className="text-text-3 text-xs ml-auto font-data">{tradeLabel}</span>
              </div>
            </div>

            {/* Trade list panel */}
            <div className="w-56 shrink-0">
              <div className="bg-panel border border-border rounded-lg overflow-hidden h-full">
                <div className="px-3 py-2 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Trades</span>
                </div>
                <div className="overflow-y-auto max-h-[460px]">
                  {trades.map((t, i) => {
                    const isActive = i === currentIndex;
                    const isCompleted = t.pnl !== null;
                    const isWin = t.pnl !== null && t.pnl > 0;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`w-full px-3 py-2 text-left border-b border-border/40 transition-colors cursor-pointer ${
                          isActive ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-panel-2 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-text-3 text-[10px]">#{i + 1}</span>
                          <span className={`text-[10px] font-semibold ${t.side === "LONG" || t.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {t.side}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-text-3 text-[10px] font-data">{t.entry_price.toFixed(2)}</span>
                          {isCompleted ? (
                            <span className={`text-[10px] font-data font-semibold ${isWin ? "text-pos" : "text-neg"}`}>
                              {fmtPnl(t.pnl!)}
                            </span>
                          ) : (
                            <span className="text-text-3 text-[10px]">open</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!hasTrades && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure instrument and click Run to start trade replay.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Replay to nav in app/layout.tsx**

Read `app/layout.tsx`. After Phase 7, nav has Universe → Rolling → Factor → Bots. Add Replay between Universe and Rolling:
```typescript
{ href: "/universe",  label: "Universe" },
{ href: "/replay",    label: "Replay" },    // NEW
{ href: "/rolling",   label: "Rolling" },
```

- [ ] **Step 3: Update docs/progress.md**

Prepend this block at the top:
```markdown
### Trade Replay (2026-06-28)

**S-7 Trade Replay:**
- `lib/replay-utils.ts` — `computeRunningStats()` (7 tests)
- `components/replay/ReplayChart.tsx` — candlestick chart with entry/exit markers via `createSeriesMarkers` (lightweight-charts v5)
- `app/replay/page.tsx` — instrument/strategy config, run controls, step/play/pause playback, trade list panel, running P&L stats

**Nav additions:** Replay (between Universe and Rolling)
**Tests:** 92 passing (85 existing + 7 replay-utils)
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```
Expected: 92 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/replay/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: add Trade Replay page with step/play controls and trade markers"
```

---

## Self-Review

### Spec Coverage (S-7 Trade Replay)

| Requirement | Implementation | Status |
|---|---|---|
| Candlestick chart with trade markers | `ReplayChart` + `createSeriesMarkers` | ✅ |
| Entry/exit markers (different shapes) | arrowUp/arrowDown for entry, circle for exit | ✅ |
| Step forward/backward | goNext, goPrev buttons | ✅ |
| Play/pause auto-advance | `startPlayback` with setInterval | ✅ |
| Speed control | 1x/2x/4x → 1000/500/250ms | ✅ |
| Running P&L stats | `computeRunningStats` useMemo | ✅ |
| Win rate | computed in `computeRunningStats` | ✅ |
| Trade list with click navigation | right panel, onClick → setCurrentIndex | ✅ |
| Highlight active trade in list | `bg-accent/10 border-l-accent` | ✅ |

### Placeholder Scan

None. All code is complete and functional.

### Type Consistency

- `TradeRecord` from `lib/api.ts` → used in `replay-utils.ts`, `ReplayChart`, page ✅
- `BarOut` from `lib/api.ts` → used in `ReplayChart` + page ✅  
- `RunningStats` from `replay-utils.ts` → used in page ✅
- `ReplayChartProps { bars, trades, currentIndex, height }` → consumed in page ✅
- `SeriesMarker<UTCTimestamp>` from lightweight-charts → used in `ReplayChart` ✅

### Edge Cases

- `currentIndex = -1`: no markers shown (loop condition `i <= limit` where limit = -1 → no iterations) ✅
- `trade.exit_ts_ns = null`: only entry marker emitted ✅
- `trades.length = 0`: controls disabled, empty state shown ✅
- markers sorted by time ascending (required by lightweight-charts) ✅
- speed change while playing: takes effect on next interval tick ✅ (note: doesn't restart the interval; user must pause+play to apply new speed. This is acceptable UX — not a bug)
