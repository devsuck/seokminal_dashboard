# Market Discovery Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/market` from a single-symbol price chart to an institutional discovery workspace with a persistent watchlist sidebar, multi-symbol comparison, corporate events data, and cross-navigation CTAs.

**Architecture:** 2-panel layout — fixed-width `WatchlistSidebar` (left) + tabbed content area (right). Watchlist state is owned by `MarketWorkspace` and persisted to localStorage via `lib/watchlist-storage.ts`. Three tabs: Chart (single symbol), Compare (multi-symbol normalized return), Events (KSD corporate actions). `app/market/page.tsx` becomes a thin Server Component that renders `<MarketWorkspace />`.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts 5.2.0 (all existing — no new packages).

## Global Constraints

- Colors: CSS tokens only — `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info` — **no hardcoded hex in CSS classes**
- Accent (`text-accent`, `bg-accent`, `border-accent/*`): only for primary action buttons (Load/Compare RUN) and active tab underline
- Inline styles: forbidden in all components **except** chart library config and the series color legend dot (lightweight-charts requires explicit hex strings; `SERIES_CONFIG` exports both `color: hex` for chart and `bgClass: Tailwind` for legend)
- `"use client"`: required on `WatchlistSidebar`, `ChartTab`, `ComparisonTab`, `ComparisonChart`, `EventsTab`, `MarketWorkspace` — all use hooks/browser APIs. `app/market/page.tsx` must NOT have it.
- API calls: only through `lib/api.ts` exported functions — no raw `fetch()` in components
- localStorage key for watchlist: `"nautilus:watchlist"`
- Default watchlist: `["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX", "000660.XKRX"]`
- `logActivity` from `lib/dashboard-storage.ts`: call on Compare load with `type: "experiment"`
- lightweight-charts v5 series API: `chart.addSeries(LineSeries, options)` — NOT `addLineSeries()`
- Timestamp conversion: `Math.floor(bar.ts_event / 1e9) as UTCTimestamp`

## File Map

**Created:**
- `lib/watchlist-storage.ts` — localStorage CRUD for watchlist symbols
- `tests/lib/watchlist-storage.test.ts`
- `components/market/WatchlistSidebar.tsx` — watchlist list + price fetch + add/remove + CTAs
- `components/market/ChartTab.tsx` — single-symbol candlestick chart (extracted from old page.tsx)
- `components/market/ComparisonChart.tsx` — lightweight-charts multi-line normalized return chart
- `components/market/ComparisonTab.tsx` — date range + ComparisonChart + legend
- `components/market/EventsTab.tsx` — KSD rights schedule + borrow rank + stubs
- `components/market/MarketWorkspace.tsx` — 2-panel layout, owns watchlist + tab state

**Modified:**
- `app/market/page.tsx` — replaced with thin Server Component rendering `<MarketWorkspace />`

---

### Task 1: watchlist-storage.ts + tests

**Files:**
- Create: `lib/watchlist-storage.ts`
- Create: `tests/lib/watchlist-storage.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const DEFAULT_SYMBOLS: string[]  // ["AAPL.NASDAQ","MSFT.NASDAQ","005930.XKRX","000660.XKRX"]
  export function getWatchlist(): string[]
  export function addToWatchlist(symbol: string): void
  export function removeFromWatchlist(symbol: string): void
  export function isInWatchlist(symbol: string): boolean
  ```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/watchlist-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, DEFAULT_SYMBOLS,
} from "../../lib/watchlist-storage";

describe("watchlist-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns DEFAULT_SYMBOLS when storage is empty", () => {
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("returns DEFAULT_SYMBOLS on corrupt JSON", () => {
    localStorage.setItem("nautilus:watchlist", "NOT_JSON{{");
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("returns DEFAULT_SYMBOLS when stored array is empty", () => {
    localStorage.setItem("nautilus:watchlist", "[]");
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("adds a symbol to the list", () => {
    addToWatchlist("TSLA.NASDAQ");
    expect(getWatchlist()).toContain("TSLA.NASDAQ");
  });

  it("prevents duplicate symbols", () => {
    addToWatchlist("TSLA.NASDAQ");
    addToWatchlist("TSLA.NASDAQ");
    expect(getWatchlist().filter(s => s === "TSLA.NASDAQ")).toHaveLength(1);
  });

  it("removes a symbol", () => {
    addToWatchlist("TSLA.NASDAQ");
    removeFromWatchlist("TSLA.NASDAQ");
    expect(getWatchlist()).not.toContain("TSLA.NASDAQ");
  });

  it("isInWatchlist: true when present", () => {
    addToWatchlist("TSLA.NASDAQ");
    expect(isInWatchlist("TSLA.NASDAQ")).toBe(true);
  });

  it("isInWatchlist: false when absent", () => {
    expect(isInWatchlist("UNKNOWN.XYZ")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test tests/lib/watchlist-storage.test.ts
```

Expected: FAIL — "Cannot find module '../../lib/watchlist-storage'"

- [ ] **Step 3: Implement watchlist-storage.ts**

Create `lib/watchlist-storage.ts`:
```typescript
const STORAGE_KEY = "nautilus:watchlist";

export const DEFAULT_SYMBOLS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
];

export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SYMBOLS];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_SYMBOLS];
  } catch {
    return [...DEFAULT_SYMBOLS];
  }
}

export function addToWatchlist(symbol: string): void {
  const list = getWatchlist();
  if (list.includes(symbol)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, symbol]));
}

export function removeFromWatchlist(symbol: string): void {
  const updated = getWatchlist().filter(s => s !== symbol);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test tests/lib/watchlist-storage.test.ts
```

Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/watchlist-storage.ts tests/lib/watchlist-storage.test.ts
git commit -m "feat: add watchlist localStorage storage"
```

---

### Task 2: WatchlistSidebar

**Files:**
- Create: `components/market/WatchlistSidebar.tsx`

**Interfaces:**
- Consumes: `getBars` from `@/lib/api`; `addToWatchlist`, `removeFromWatchlist` from `@/lib/watchlist-storage`
- Props:
  ```typescript
  interface WatchlistSidebarProps {
    symbols: string[];
    activeSymbol: string;
    onSymbolSelect: (symbol: string) => void;
    onCompare: () => void;
    onAdd: (symbol: string) => void;
    onRemove: (symbol: string) => void;
  }
  ```
- Produces: `<WatchlistSidebar />` — left sidebar, 208px wide

**Price fetch logic:** For each symbol, fetch `getBars(symbol, 14-days-ago, today)` → use last 2 bars → `changePct = (last.close - prev.close) / prev.close * 100`

- [ ] **Step 1: Create WatchlistSidebar.tsx**

Create `components/market/WatchlistSidebar.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBars } from "@/lib/api";

interface SymbolPrice {
  close: number | null;
  changePct: number | null;
  loading: boolean;
}

interface WatchlistSidebarProps {
  symbols: string[];
  activeSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  onCompare: () => void;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function getRecentWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function WatchlistSidebar({
  symbols, activeSymbol, onSymbolSelect, onCompare, onAdd, onRemove,
}: WatchlistSidebarProps) {
  const [prices, setPrices] = useState<Record<string, SymbolPrice>>({});
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (symbols.length === 0) return;
    let alive = true;
    const { start, end } = getRecentWindow();

    setPrices(prev => {
      const init: Record<string, SymbolPrice> = {};
      for (const s of symbols) init[s] = prev[s] ?? { close: null, changePct: null, loading: true };
      return init;
    });

    symbols.forEach(async symbol => {
      try {
        const { bars } = await getBars(symbol, start, end);
        if (!alive) return;
        const last = bars[bars.length - 1] ?? null;
        const prev = bars[bars.length - 2] ?? null;
        const changePct = last && prev
          ? ((last.close - prev.close) / prev.close) * 100
          : null;
        setPrices(p => ({ ...p, [symbol]: { close: last?.close ?? null, changePct, loading: false } }));
      } catch {
        if (!alive) return;
        setPrices(p => ({ ...p, [symbol]: { close: null, changePct: null, loading: false } }));
      }
    });

    return () => { alive = false; };
  }, [symbols]);

  function handleAdd() {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (!/^[A-Z0-9]+\.[A-Z]+$/.test(sym)) {
      setAddError("Format: SYMBOL.VENUE");
      return;
    }
    onAdd(sym);
    setAddInput("");
    setAddError(null);
  }

  return (
    <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-panel h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">Watchlist</span>
        <button
          onClick={onCompare}
          className="text-[10px] text-text-3 hover:text-text-1 transition-colors px-1.5 py-0.5 border border-border rounded bg-transparent cursor-pointer"
        >
          Compare
        </button>
      </div>

      {/* Symbol list */}
      <div className="flex-1 overflow-y-auto">
        {symbols.map(symbol => {
          const price = prices[symbol];
          const isActive = symbol === activeSymbol;
          const pos = price?.changePct != null ? price.changePct >= 0 : null;
          return (
            <div
              key={symbol}
              className={`px-3 py-2 border-b border-border/40 cursor-pointer group ${
                isActive ? "bg-panel-2" : "hover:bg-panel-2/50"
              }`}
              onClick={() => onSymbolSelect(symbol)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-semibold truncate max-w-[110px] ${isActive ? "text-text-1" : "text-text-2"}`}>
                  {symbol.split(".")[0]}
                  <span className="text-text-3 font-normal text-[9px] ml-1">{symbol.split(".")[1]}</span>
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(symbol); }}
                  className="text-text-3 hover:text-neg text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer p-0 leading-none"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-3 font-data">
                  {price?.loading ? "…" : price?.close != null ? price.close.toFixed(2) : "—"}
                </span>
                {price?.changePct != null && (
                  <span className={`text-[10px] font-data ${pos ? "text-pos" : "text-neg"}`}>
                    {pos ? "+" : ""}{price.changePct.toFixed(2)}%
                  </span>
                )}
              </div>
              {/* Cross-nav CTAs */}
              <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href="/backtest"
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors"
                >
                  Backtest
                </Link>
                <Link
                  href="/quant"
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors"
                >
                  Research
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add symbol input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-1">
          <input
            type="text"
            value={addInput}
            onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(null); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="AAPL.NASDAQ"
            className="flex-1 h-7 text-[11px] px-2 bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            className="h-7 px-2.5 text-sm bg-accent text-black font-bold rounded-md hover:brightness-110 border-0 cursor-pointer"
          >
            +
          </button>
        </div>
        {addError && <p className="text-neg text-[10px] mt-1">{addError}</p>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/market/WatchlistSidebar.tsx
git commit -m "feat: add WatchlistSidebar with price fetch and cross-nav CTAs"
```

---

### Task 3: ChartTab

**Files:**
- Create: `components/market/ChartTab.tsx`

**Interfaces:**
- Consumes: `getBars`, `ApiError`, `BarOut` from `@/lib/api`; `DateRangePicker` from `@/components/DateRangePicker`; `CandlestickChart` from `@/components/CandlestickChart`; `EmptyState` from `@/components/ui`
- Props: `interface ChartTabProps { symbol: string; }`
- Produces: `<ChartTab symbol="AAPL.NASDAQ" />`

**Note:** This extracts the existing chart functionality from the old `app/market/page.tsx` (before it was replaced in Phase 1 Task 9). Default date range: 1 year back to today.

- [ ] **Step 1: Create ChartTab.tsx**

Create `components/market/ChartTab.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import { ApiError, getBars, type BarOut } from "@/lib/api";

interface ChartTabProps {
  symbol: string;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChartTab({ symbol }: ChartTabProps) {
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadBars() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const res = await getBars(symbol, start, end, undefined, ctrl.signal);
      setBars(res.bars);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setBars([]);
      setError(e instanceof ApiError ? e.message : "Failed to load bars");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadBars();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button
          onClick={loadBars}
          className="px-4 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        {!loading && bars.length > 0 && (
          <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
        )}
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
        </div>
        {bars.length > 0 ? (
          <CandlestickChart bars={bars} />
        ) : (
          <div className="h-[480px] flex items-center justify-center">
            <EmptyState message="No chart data" hint={error ? "" : "Click Load to fetch bars"} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/market/ChartTab.tsx
git commit -m "feat: add ChartTab component"
```

---

### Task 4: ComparisonChart

**Files:**
- Create: `components/market/ComparisonChart.tsx`

**Interfaces:**
- Consumes: `createChart`, `LineSeries`, `IChartApi`, `UTCTimestamp` from `lightweight-charts`; `BarOut` from `@/lib/api`
- Exports:
  ```typescript
  export const SERIES_CONFIG: { color: string; bgClass: string }[]
  // bgClass uses Tailwind token classes for legend dots
  ```
- Props:
  ```typescript
  interface ComparisonChartProps {
    data: Record<string, BarOut[]>;
    symbols: string[];
  }
  ```

**Normalization:** `value = ((bar.close - bars[0].close) / bars[0].close) * 100`

**Chart config:** matches CandlestickChart color tokens — `#0F131A` bg, `#5F6B7A` text, `#151A23` grid, `#FF9F1C` crosshair, `#242A35` borders.

**Exception note:** Chart series and config use explicit hex strings — required by lightweight-charts API, not CSS. `SERIES_CONFIG.bgClass` provides the Tailwind equivalent for use in the legend.

- [ ] **Step 1: Create ComparisonChart.tsx**

Create `components/market/ComparisonChart.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BarOut } from "@/lib/api";

// Hex values match design tokens; bgClass is the Tailwind equivalent for legend use
export const SERIES_CONFIG = [
  { color: "#3B82F6", bgClass: "bg-info" },
  { color: "#22C55E", bgClass: "bg-pos" },
  { color: "#F59E0B", bgClass: "bg-warn" },
  { color: "#EF4444", bgClass: "bg-neg" },
  { color: "#8B5CF6", bgClass: "bg-[#8B5CF6]" },
  { color: "#06B6D4", bgClass: "bg-[#06B6D4]" },
] as const;

interface ComparisonChartProps {
  data: Record<string, BarOut[]>;
  symbols: string[];
}

function normalize(bars: BarOut[]): { time: UTCTimestamp; value: number }[] {
  if (bars.length === 0) return [];
  const base = bars[0].close;
  return bars.map(b => ({
    time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
    value: ((b.close - base) / base) * 100,
  }));
}

export function ComparisonChart({ data, symbols }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || symbols.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { color: "#0F131A" },
        textColor: "#5F6B7A",
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#151A23" },
        horzLines: { color: "#151A23" },
      },
      crosshair: {
        vertLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },
        horzLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },
      },
      rightPriceScale: { borderColor: "#242A35" },
      timeScale: { borderColor: "#242A35", timeVisible: true },
    });
    chartRef.current = chart;

    symbols.forEach((symbol, i) => {
      const bars = data[symbol];
      if (!bars || bars.length === 0) return;
      const cfg = SERIES_CONFIG[i % SERIES_CONFIG.length];
      const series = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: 2,
        priceLineVisible: false,
        title: symbol.split(".")[0],
      });
      series.setData(normalize(bars));
    });

    chart.timeScale().fitContent();

    return () => { chart.remove(); chartRef.current = null; };
  }, [data, symbols]);

  return <div ref={containerRef} className="w-full rounded-b-lg" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/market/ComparisonChart.tsx
git commit -m "feat: add ComparisonChart multi-symbol normalized return"
```

---

### Task 5: ComparisonTab

**Files:**
- Create: `components/market/ComparisonTab.tsx`

**Interfaces:**
- Consumes: `ComparisonChart`, `SERIES_CONFIG` from `./ComparisonChart`; `getBars`, `ApiError`, `BarOut` from `@/lib/api`; `logActivity` from `@/lib/dashboard-storage`; `DateRangePicker` from `@/components/DateRangePicker`
- Props: `interface ComparisonTabProps { symbols: string[]; }`

- [ ] **Step 1: Create ComparisonTab.tsx**

Create `components/market/ComparisonTab.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ComparisonChart, SERIES_CONFIG } from "@/components/market/ComparisonChart";
import { ApiError, getBars, type BarOut } from "@/lib/api";
import { logActivity } from "@/lib/dashboard-storage";

interface ComparisonTabProps {
  symbols: string[];
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ComparisonTab({ symbols }: ComparisonTabProps) {
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<Record<string, BarOut[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadData() {
    if (symbols.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);

    try {
      const results = await Promise.all(
        symbols.map(s =>
          getBars(s, start, end, undefined, ctrl.signal)
            .then(r => [s, r.bars] as const)
            .catch(() => [s, [] as BarOut[]] as const)
        )
      );
      if (ctrl.signal.aborted) return;
      const newData: Record<string, BarOut[]> = {};
      for (const [s, bars] of results) newData[s] = bars;
      setData(newData);
      const labels = symbols.map(s => s.split(".")[0]).join(", ");
      logActivity({ type: "experiment", label: `Compare: ${labels}`, href: "/market" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to load comparison data");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols]);

  const chartSymbols = symbols.filter(s => (data[s]?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button
          onClick={loadData}
          disabled={loading || symbols.length === 0}
          className="px-4 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Loading…" : "Compare"}
        </button>
      </div>

      {/* Legend */}
      {symbols.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {symbols.map((s, i) => {
            const cfg = SERIES_CONFIG[i % SERIES_CONFIG.length];
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-4 h-0.5 inline-block rounded ${cfg.bgClass}`} />
                <span className="text-text-2 text-xs font-data">{s.split(".")[0]}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {symbols.length === 0 ? (
        <div className="bg-panel border border-border rounded-lg h-[480px] flex items-center justify-center">
          <p className="text-text-3 text-sm">Add symbols to your watchlist to compare</p>
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Normalized Return (%)</span>
          </div>
          <ComparisonChart data={data} symbols={chartSymbols} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/market/ComparisonTab.tsx
git commit -m "feat: add ComparisonTab with multi-symbol normalized return"
```

---

### Task 6: EventsTab

**Files:**
- Create: `components/market/EventsTab.tsx`

**Interfaces:**
- Consumes: `getKSDRightsSchedule`, `getKSDBorrowRank`, `KSDRightsRow`, `KSDBorrowRow` from `@/lib/api`
- Props: none

**Data sources:**
- Rights: `getKSDRightsSchedule(undefined, today, today+30)` — shows upcoming 30-day window, max 10 rows
- Borrow Rank: `getKSDBorrowRank(todayStr, 20)` — max 10 rows shown
- Earnings, News: stubs with "No feed — data source needed"

- [ ] **Step 1: Create EventsTab.tsx**

Create `components/market/EventsTab.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getKSDRightsSchedule, getKSDBorrowRank,
  type KSDRightsRow, type KSDBorrowRow,
} from "@/lib/api";

function toKsdDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function fmtKsdDate(s: string | null): string {
  if (!s || s.length < 8) return "—";
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

export function EventsTab() {
  const [rights, setRights] = useState<KSDRightsRow[]>([]);
  const [borrows, setBorrows] = useState<KSDBorrowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const today = toKsdDate(0);
    const future = toKsdDate(30);

    Promise.all([
      getKSDRightsSchedule(undefined, today, future).catch(() => ({ rows: [] as KSDRightsRow[] })),
      getKSDBorrowRank(today, 20).catch(() => ({ bas_dt: today, rows: [] as KSDBorrowRow[] })),
    ]).then(([rightsRes, borrowRes]) => {
      if (!alive) return;
      setRights(rightsRes.rows.slice(0, 10));
      setBorrows(borrowRes.rows.slice(0, 10));
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  return (
    <div className="p-4 space-y-6 max-w-[900px]">

      {/* Rights Schedule */}
      <section>
        <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-3">
          Rights Events (30d)
        </h3>
        {loading ? (
          <p className="text-text-3 text-xs">Loading…</p>
        ) : rights.length === 0 ? (
          <p className="text-text-3 text-xs">No upcoming rights events</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Company</th>
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Type</th>
                  <th className="text-right px-3 py-2 text-text-3 font-normal">Record Date</th>
                </tr>
              </thead>
              <tbody>
                {rights.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-panel-2/50">
                    <td className="px-3 py-2 text-text-2 truncate max-w-[200px]">
                      {r.stck_issu_cmpy_nm ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-3">{r.rgt_exert_rcd_nm ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-data text-text-2">
                      {fmtKsdDate(r.rgt_exert_rcd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Short Interest / Borrow Rank */}
      <section>
        <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-3">
          Top Short Interest (KSD Borrow Rank)
        </h3>
        {loading ? (
          <p className="text-text-3 text-xs">Loading…</p>
        ) : borrows.length === 0 ? (
          <p className="text-text-3 text-xs">No borrow data for today</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-3 font-normal">#</th>
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Symbol</th>
                  <th className="text-right px-3 py-2 text-text-3 font-normal">Borrow Balance</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map((b, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-panel-2/50">
                    <td className="px-3 py-2 text-text-3 font-data">{b.rank ?? i + 1}</td>
                    <td className="px-3 py-2 text-text-2">{b.isin_cd_nm ?? b.isin_cd ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-data text-text-2">{b.lnb_bal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stubs */}
      {[{ label: "Earnings Calendar" }, { label: "News Feed" }].map(stub => (
        <section key={stub.label}>
          <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-1">{stub.label}</h3>
          <p className="text-text-3 text-[10px] italic">No feed — data source needed</p>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/market/EventsTab.tsx
git commit -m "feat: add EventsTab with KSD rights schedule and borrow rank"
```

---

### Task 7: MarketWorkspace

**Files:**
- Create: `components/market/MarketWorkspace.tsx`

**Interfaces:**
- Consumes: all 4 components above; `getWatchlist`, `addToWatchlist`, `removeFromWatchlist` from `@/lib/watchlist-storage`
- Props: none (root component)
- State: `watchlist: string[]`, `activeSymbol: string`, `activeTab: "chart" | "compare" | "events"`

- [ ] **Step 1: Create MarketWorkspace.tsx**

Create `components/market/MarketWorkspace.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { WatchlistSidebar } from "@/components/market/WatchlistSidebar";
import { ChartTab } from "@/components/market/ChartTab";
import { ComparisonTab } from "@/components/market/ComparisonTab";
import { EventsTab } from "@/components/market/EventsTab";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  DEFAULT_SYMBOLS,
} from "@/lib/watchlist-storage";

type Tab = "chart" | "compare" | "events";

const TABS: { id: Tab; label: string }[] = [
  { id: "chart",   label: "Chart" },
  { id: "compare", label: "Compare" },
  { id: "events",  label: "Events" },
];

export function MarketWorkspace() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_SYMBOLS);
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOLS[0]);
  const [activeTab, setActiveTab] = useState<Tab>("chart");

  useEffect(() => {
    const list = getWatchlist();
    setWatchlist(list);
    setActiveSymbol(list[0] ?? DEFAULT_SYMBOLS[0]);
  }, []);

  function handleSymbolSelect(symbol: string) {
    setActiveSymbol(symbol);
    setActiveTab("chart");
  }

  function handleAdd(symbol: string) {
    addToWatchlist(symbol);
    setWatchlist(getWatchlist());
  }

  function handleRemove(symbol: string) {
    removeFromWatchlist(symbol);
    const updated = getWatchlist();
    setWatchlist(updated);
    if (activeSymbol === symbol) {
      setActiveSymbol(updated[0] ?? DEFAULT_SYMBOLS[0]);
    }
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Left: Watchlist sidebar */}
      <WatchlistSidebar
        symbols={watchlist}
        activeSymbol={activeSymbol}
        onSymbolSelect={handleSymbolSelect}
        onCompare={() => setActiveTab("compare")}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />

      {/* Right: Tab header + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab navigation */}
        <div className="flex items-center border-b border-border px-4 bg-panel shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-text-3 hover:text-text-1"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {activeTab === "chart" && (
            <span className="ml-auto text-text-3 text-xs font-data">{activeSymbol}</span>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-bg">
          {activeTab === "chart"   && <ChartTab symbol={activeSymbol} />}
          {activeTab === "compare" && <ComparisonTab symbols={watchlist} />}
          {activeTab === "events"  && <EventsTab />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass (20 tests across 4 files)

- [ ] **Step 3: Commit**

```bash
git add components/market/MarketWorkspace.tsx
git commit -m "feat: assemble MarketWorkspace 2-panel layout with tabs"
```

---

### Task 8: Update app/market/page.tsx + progress.md

**Files:**
- Modify: `app/market/page.tsx`
- Modify: `docs/progress.md`

**Goal:** Replace `app/market/page.tsx` with a thin Server Component. The full page content moves into `MarketWorkspace`.

- [ ] **Step 1: Replace app/market/page.tsx**

Read `app/market/page.tsx` first, then replace its entire content with:

```tsx
import { MarketWorkspace } from "@/components/market/MarketWorkspace";

export default function MarketPage() {
  return <MarketWorkspace />;
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 3: Update docs/progress.md**

Append to the "완료된 작업" section:

```
### Market Discovery Workspace (2026-06-27)

- `app/market/page.tsx` → thin Server Component rendering `<MarketWorkspace />`
- `lib/watchlist-storage.ts` — localStorage watchlist CRUD (8 tests)
- `components/market/WatchlistSidebar.tsx` — symbol list + price fetch + add/remove + Backtest/Research CTAs
- `components/market/ChartTab.tsx` — single-symbol candlestick chart
- `components/market/ComparisonChart.tsx` — lightweight-charts multi-line normalized % return
- `components/market/ComparisonTab.tsx` — date range + ComparisonChart + legend + logActivity
- `components/market/EventsTab.tsx` — KSD rights schedule (30d), borrow rank, stub sections
- `components/market/MarketWorkspace.tsx` — 2-panel layout (WatchlistSidebar + Chart/Compare/Events tabs)
```

- [ ] **Step 4: Commit**

```bash
git add app/market/page.tsx docs/progress.md
git commit -m "feat: upgrade /market to Market Discovery Workspace"
```

---

## Self-Review

### Spec Coverage (Upgrade 2)

| Feature | Implemented | Notes |
|---|---|---|
| Watchlist | ✅ | localStorage, add/remove, default 4 symbols |
| Market Movers | ❌ stub | No price-change API (KRX stock base has mktcap, not % change) |
| Relative Strength Ranking | ❌ stub | Needs multi-symbol return data — Phase 5 |
| Volume Spike | ❌ stub | Needs multi-symbol bar data — expensive |
| 52W High/Low | ❌ stub | Needs 52-week bar per symbol — Phase 5 |
| Sector Heatmap | ❌ stub | No backend sector data |
| News | ❌ stub | No feed — honest label |
| Economic Events | ❌ partial | FRED catalog exists but not surfaced here (→ Quant page) |
| Corporate Actions | ✅ | KSD rights schedule (30d) + borrow rank |
| Multiple Symbol Comparison | ✅ | ComparisonTab with normalized % return |
| Cross-navigation CTAs | ✅ | Backtest + Research links on every watchlist symbol |

**Stubs are honest:** All unimplemented features show "No feed — data source needed" or are simply absent, not pretending to show data.

### Placeholder Scan
- No TBD or TODO in code ✅
- Stubs in EventsTab are intentional, honest labels ✅

### Type Consistency
- `WatchlistSidebarProps.onAdd: (symbol: string) => void` → MarketWorkspace `handleAdd(symbol: string)` ✅
- `WatchlistSidebarProps.onRemove: (symbol: string) => void` → MarketWorkspace `handleRemove(symbol: string)` ✅
- `ComparisonTabProps.symbols: string[]` → MarketWorkspace passes `watchlist` ✅
- `ChartTabProps.symbol: string` → MarketWorkspace passes `activeSymbol` ✅
- `SERIES_CONFIG` exported from ComparisonChart, imported in ComparisonTab ✅
- `BarOut[]` type from `@/lib/api` used consistently across ComparisonChart and ComparisonTab ✅
