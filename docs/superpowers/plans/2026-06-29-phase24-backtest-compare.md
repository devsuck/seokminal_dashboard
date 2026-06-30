# Phase 24 — Backtesting UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full backtest result save/load + multi-strategy comparison UI (metrics table + cumulative PnL chart) to the existing backtest workflow.

**Architecture:** Pure frontend — the existing `GET /backtest` endpoint is sufficient; no new backend endpoints. A new `lib/backtest-result-storage.ts` persists full `BacktestResponse` (including trades) to localStorage. A "Save Result" button is added to `/backtest` after a run. A new `/backtest/compare` page loads saved results, lets users select up to 4, and renders a side-by-side metrics table plus a cumulative PnL chart built with the existing `RollingChart` component.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / TailwindCSS 4 / vitest (existing test infra)

## Global Constraints

- Design tokens ONLY in className: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black` — primary action buttons only (Run, Save, Create)
- Active tab: `border-accent text-accent bg-accent/10`
- Raw `fetch` FORBIDDEN — all calls via `lib/api.ts` functions
- `style={{}}` FORBIDDEN except `style={{ height }}` chart containers and `style={{ backgroundColor }}` legend/swatch dots that must match D3 hardcoded colors
- Hex codes in className FORBIDDEN (exception: `color:` prop in `RollingSeries` objects and `style={{ backgroundColor }}` for legend swatches)
- AbortController: abort → create → assign ref → fetch → catch AbortError silently → finally guard → unmount cleanup
- `@pytest.mark.asyncio` N/A (frontend-only phase)
- `npm test` must stay at 155/155 before Task 1 — increase by 8 after Task 1's tests pass
- `npx tsc --noEmit` must pass 0 errors after every task

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `seokminal-dashboard/lib/backtest-result-storage.ts` | Save/load/delete full BacktestResponse + metadata to localStorage |
| Create | `seokminal-dashboard/tests/lib/backtest-result-storage.test.ts` | 8 unit tests for storage functions |
| Modify | `seokminal-dashboard/app/backtest/page.tsx` | Add Save Result UX (inline label input + save button) |
| Create | `seokminal-dashboard/app/backtest/compare/page.tsx` | Compare page: result list sidebar + metrics table + cumulative PnL chart |
| Modify | `seokminal-dashboard/components/NavBar.tsx` | Add Compare to Trade group |

---

## Task 1: Backtest Result Storage + Tests

**Files:**
- Create: `seokminal-dashboard/lib/backtest-result-storage.ts`
- Create: `seokminal-dashboard/tests/lib/backtest-result-storage.test.ts`

**Interfaces:**
- Consumes from `lib/api.ts`: `BacktestResponse`, `TradeRecord`
- Produces (used by Tasks 2 and 3):
  ```typescript
  export interface SavedBacktestResult {
    id: string;           // "bt_<timestamp>_<random5>"
    timestamp: number;    // Date.now()
    label: string;
    instrumentId: string;
    start: string;
    end: string;
    strategy: "ema_cross" | "gated";
    fast?: number;
    slow?: number;
    result: BacktestResponse;
  }
  export function saveBacktestResult(entry: Omit<SavedBacktestResult, "id" | "timestamp">): SavedBacktestResult
  export function getBacktestResults(): SavedBacktestResult[]
  export function deleteBacktestResult(id: string): void
  export function clearBacktestResults(): void
  ```

- [ ] **Step 1: Write the failing tests**

```bash
# Verify test suite currently at 155/155
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test
```

Create `tests/lib/backtest-result-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveBacktestResult,
  getBacktestResults,
  deleteBacktestResult,
  clearBacktestResults,
  type SavedBacktestResult,
} from "../../lib/backtest-result-storage";
import type { BacktestResponse } from "../../lib/api";

const BASE_RESULT: BacktestResponse = {
  sharpe_ratio: 1.5,
  sortino_ratio: 2.0,
  max_drawdown: -0.12,
  volatility: 0.18,
  beta: 1.1,
  total_pnl: 150,
  total_pnl_pct: 0.15,
  win_rate: 0.55,
  profit_loss_ratio: 1.8,
  avg_win: 50,
  avg_loss: -28,
  bar_count: 100,
  trades: [],
};

const BASE_ENTRY: Omit<SavedBacktestResult, "id" | "timestamp"> = {
  label: "AAPL EMA 10/20",
  instrumentId: "AAPL.NASDAQ",
  start: "2025-01-01",
  end: "2026-01-01",
  strategy: "ema_cross",
  fast: 10,
  slow: 20,
  result: BASE_RESULT,
};

describe("backtest-result-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getBacktestResults returns [] when storage empty", () => {
    expect(getBacktestResults()).toEqual([]);
  });

  it("getBacktestResults returns [] on corrupt JSON", () => {
    localStorage.setItem("seokminal:backtest-results", "NOT{JSON");
    expect(getBacktestResults()).toEqual([]);
  });

  it("getBacktestResults returns [] when stored value is not an array", () => {
    localStorage.setItem("seokminal:backtest-results", JSON.stringify({ foo: "bar" }));
    expect(getBacktestResults()).toEqual([]);
  });

  it("saveBacktestResult persists and returns entry with id and timestamp", () => {
    const saved = saveBacktestResult(BASE_ENTRY);
    expect(saved.id).toMatch(/^bt_\d+_[a-z0-9]{5}$/);
    expect(saved.timestamp).toBeGreaterThan(0);
    expect(saved.label).toBe("AAPL EMA 10/20");
    expect(getBacktestResults()).toHaveLength(1);
  });

  it("saveBacktestResult prepends so newest is first", () => {
    saveBacktestResult({ ...BASE_ENTRY, label: "First" });
    saveBacktestResult({ ...BASE_ENTRY, label: "Second" });
    const results = getBacktestResults();
    expect(results[0].label).toBe("Second");
    expect(results[1].label).toBe("First");
  });

  it("deleteBacktestResult removes by id", () => {
    const saved = saveBacktestResult(BASE_ENTRY);
    deleteBacktestResult(saved.id);
    expect(getBacktestResults()).toHaveLength(0);
  });

  it("deleteBacktestResult does nothing when id not found", () => {
    saveBacktestResult(BASE_ENTRY);
    deleteBacktestResult("nonexistent");
    expect(getBacktestResults()).toHaveLength(1);
  });

  it("clearBacktestResults empties storage", () => {
    saveBacktestResult(BASE_ENTRY);
    saveBacktestResult({ ...BASE_ENTRY, label: "B" });
    clearBacktestResults();
    expect(getBacktestResults()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/lib/backtest-result-storage.test.ts
```

Expected: FAIL — "backtest-result-storage" module not found

- [ ] **Step 3: Implement `lib/backtest-result-storage.ts`**

```typescript
import type { BacktestResponse } from "@/lib/api";

const STORAGE_KEY = "seokminal:backtest-results";
const MAX_RESULTS = 50;

export interface SavedBacktestResult {
  id: string;
  timestamp: number;
  label: string;
  instrumentId: string;
  start: string;
  end: string;
  strategy: "ema_cross" | "gated";
  fast?: number;
  slow?: number;
  result: BacktestResponse;
}

export function saveBacktestResult(
  entry: Omit<SavedBacktestResult, "id" | "timestamp">
): SavedBacktestResult {
  const saved: SavedBacktestResult = {
    ...entry,
    id: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const existing = getBacktestResults();
  const updated = [saved, ...existing].slice(0, MAX_RESULTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    try {
      const trimmed = [saved, ...existing.slice(0, Math.floor(MAX_RESULTS / 2))];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* storage exhausted */ }
  }
  return saved;
}

export function getBacktestResults(): SavedBacktestResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBacktestResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteBacktestResult(id: string): void {
  const updated = getBacktestResults().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearBacktestResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test
```

Expected: 163/163 pass (155 previous + 8 new)

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/backtest-result-storage.ts tests/lib/backtest-result-storage.test.ts
git commit -m "feat: add backtest result storage (phase 24)"
```

---

## Task 2: Save Result UX in Backtest Page

**Files:**
- Modify: `seokminal-dashboard/app/backtest/page.tsx`

**Interfaces:**
- Consumes from Task 1: `saveBacktestResult`, `SavedBacktestResult` from `@/lib/backtest-result-storage`
- Produces: "Save Result" button + inline label input appearing after a successful backtest run, inside the Performance panel

**What changes in `app/backtest/page.tsx`:**

1. New import at top:
```typescript
import { saveBacktestResult } from "@/lib/backtest-result-storage";
```

2. Three new state variables after the existing `loading` state:
```typescript
const [saveLabel, setSaveLabel]       = useState("");
const [showSaveResult, setShowSaveResult] = useState(false);
const [resultSaved, setResultSaved]   = useState(false);
```

3. Inside `run()`, after `setResult(btRes)` and before `logActivity(...)`:
```typescript
setSaveLabel(
  mode === "single"
    ? `${instrumentId} EMA ${fast}/${slow} ${start}→${end}`
    : `${instrumentId} Gated(${rules.length}R) ${start}→${end}`
);
setShowSaveResult(false);
setResultSaved(false);
```

4. Add save result UI inside the Performance panel `<div>`, right after `<MetricGrid result={result} />`:

```tsx
{/* Save Result */}
{result !== null && !showSaveResult && !resultSaved && (
  <div className="px-4 py-2 border-t border-border">
    <button
      onClick={() => setShowSaveResult(true)}
      className="text-text-3 hover:text-accent text-xs transition-colors"
    >
      Save Result
    </button>
  </div>
)}
{result !== null && resultSaved && (
  <div className="px-4 py-2 border-t border-border">
    <span className="text-pos text-xs">Saved ✓</span>
  </div>
)}
{result !== null && showSaveResult && (
  <div className="px-4 py-2 border-t border-border">
    <div className="flex gap-2 items-center">
      <input
        value={saveLabel}
        onChange={e => setSaveLabel(e.target.value)}
        className="flex-1 bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs min-w-0"
        placeholder="Label"
      />
      <button
        onClick={() => {
          saveBacktestResult({
            label: saveLabel.trim() || `${instrumentId} ${start}`,
            instrumentId,
            start,
            end,
            strategy: mode === "single" ? "ema_cross" : "gated",
            ...(mode === "single" ? { fast, slow } : {}),
            result,
          });
          setShowSaveResult(false);
          setResultSaved(true);
        }}
        className="text-xs text-accent border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 transition-colors whitespace-nowrap"
      >
        Save
      </button>
      <button
        onClick={() => setShowSaveResult(false)}
        className="text-xs text-text-3 hover:text-text-2 transition-colors"
      >
        ✕
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 1: Add import**

Open `app/backtest/page.tsx`. After the existing imports, add:
```typescript
import { saveBacktestResult } from "@/lib/backtest-result-storage";
```

- [ ] **Step 2: Add three state variables**

After `const [loading, setLoading] = useState(false);`, add:
```typescript
const [saveLabel, setSaveLabel]           = useState("");
const [showSaveResult, setShowSaveResult] = useState(false);
const [resultSaved, setResultSaved]       = useState(false);
```

- [ ] **Step 3: Add reset logic in run()**

Inside `run()`, after `setResult(btRes);`, before `logActivity(...)`:
```typescript
setSaveLabel(
  mode === "single"
    ? `${instrumentId} EMA ${fast}/${slow} ${start}→${end}`
    : `${instrumentId} Gated(${rules.length}R) ${start}→${end}`
);
setShowSaveResult(false);
setResultSaved(false);
```

- [ ] **Step 4: Add save result UI in the Performance panel**

Find this block in the JSX (around line 198):
```tsx
<div className="bg-panel border border-border rounded-lg overflow-hidden">
  <div className="px-4 py-2.5 border-b border-border bg-panel-2">
    <span className="text-text-3 text-[11px] uppercase tracking-wider">Performance</span>
  </div>
  <MetricGrid result={result} />
</div>
```

Change it to:
```tsx
<div className="bg-panel border border-border rounded-lg overflow-hidden">
  <div className="px-4 py-2.5 border-b border-border bg-panel-2">
    <span className="text-text-3 text-[11px] uppercase tracking-wider">Performance</span>
  </div>
  <MetricGrid result={result} />
  {result !== null && !showSaveResult && !resultSaved && (
    <div className="px-4 py-2 border-t border-border">
      <button
        onClick={() => setShowSaveResult(true)}
        className="text-text-3 hover:text-accent text-xs transition-colors"
      >
        Save Result
      </button>
    </div>
  )}
  {result !== null && resultSaved && (
    <div className="px-4 py-2 border-t border-border">
      <span className="text-pos text-xs">Saved ✓</span>
    </div>
  )}
  {result !== null && showSaveResult && (
    <div className="px-4 py-2 border-t border-border">
      <div className="flex gap-2 items-center">
        <input
          value={saveLabel}
          onChange={e => setSaveLabel(e.target.value)}
          className="flex-1 bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs min-w-0"
          placeholder="Label"
        />
        <button
          onClick={() => {
            saveBacktestResult({
              label: saveLabel.trim() || `${instrumentId} ${start}`,
              instrumentId,
              start,
              end,
              strategy: mode === "single" ? "ema_cross" : "gated",
              ...(mode === "single" ? { fast, slow } : {}),
              result,
            });
            setShowSaveResult(false);
            setResultSaved(true);
          }}
          className="text-xs text-accent border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 transition-colors whitespace-nowrap"
        >
          Save
        </button>
        <button
          onClick={() => setShowSaveResult(false)}
          className="text-xs text-text-3 hover:text-text-2 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 5: Type-check and test**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit && npm test
```

Expected: 0 TS errors, 163/163 pass

- [ ] **Step 6: Commit**

```bash
git add app/backtest/page.tsx
git commit -m "feat: add save result button to backtest page (phase 24)"
```

---

## Task 3: Compare Page

**Files:**
- Create: `seokminal-dashboard/app/backtest/compare/page.tsx`

**Interfaces:**
- Consumes from Task 1: `getBacktestResults`, `deleteBacktestResult`, `type SavedBacktestResult` from `@/lib/backtest-result-storage`
- Consumes existing components:
  - `{ RollingChart, type RollingSeries }` from `@/components/rolling/RollingChart`
  - `type { TradeRecord }` from `@/lib/api`
- No test file needed (pure UI page)

- [ ] **Step 1: Create `app/backtest/compare/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getBacktestResults,
  deleteBacktestResult,
  type SavedBacktestResult,
} from "@/lib/backtest-result-storage";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import type { TradeRecord } from "@/lib/api";

const SERIES_COLORS = ["#FF9F1C", "#60A5FA", "#34D399", "#F472B6"] as const;
const MAX_SELECTED = 4;

function tradesToCumPnl(
  trades: TradeRecord[]
): { ts_ns: number; value: number | null }[] {
  const closed = trades
    .filter(
      (t): t is TradeRecord & { exit_ts_ns: number; pnl: number } =>
        t.exit_ts_ns !== null && t.pnl !== null
    )
    .sort((a, b) => a.exit_ts_ns - b.exit_ts_ns);
  let cum = 0;
  return closed.map(t => {
    cum += t.pnl;
    return { ts_ns: t.exit_ts_ns, value: cum };
  });
}

interface MetricDef {
  label: string;
  get: (r: SavedBacktestResult) => number | null;
  fmt: (v: number | null) => string;
  higherBetter: boolean | null;
}

const METRICS: MetricDef[] = [
  {
    label: "Sharpe Ratio",
    get: r => r.result.sharpe_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Sortino Ratio",
    get: r => r.result.sortino_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Max Drawdown",
    get: r => r.result.max_drawdown,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: false,
  },
  {
    label: "Win Rate",
    get: r => r.result.win_rate,
    fmt: v => (v != null ? `${(v * 100).toFixed(1)}%` : "—"),
    higherBetter: true,
  },
  {
    label: "Total PnL %",
    get: r => r.result.total_pnl_pct,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: true,
  },
  {
    label: "Volatility",
    get: r => r.result.volatility,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: false,
  },
  {
    label: "P/L Ratio",
    get: r => r.result.profit_loss_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Beta",
    get: r => r.result.beta,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: null,
  },
  {
    label: "Trade Count",
    get: r => r.result.trades.length,
    fmt: v => (v != null ? String(v) : "—"),
    higherBetter: null,
  },
];

function cellColorClass(
  value: number | null,
  values: (number | null)[],
  higherBetter: boolean | null
): string {
  if (higherBetter === null || value === null) return "text-text-2";
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return "text-text-2";
  const best = higherBetter ? Math.max(...valid) : Math.min(...valid);
  const worst = higherBetter ? Math.min(...valid) : Math.max(...valid);
  if (value === best) return "text-pos";
  if (value === worst && best !== worst) return "text-neg";
  return "text-text-2";
}

export default function BacktestComparePage() {
  const [results, setResults] = useState<SavedBacktestResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResults(getBacktestResults());
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTED) {
        next.add(id);
      }
      return next;
    });
  }

  function handleDelete(id: string) {
    deleteBacktestResult(id);
    setResults(prev => prev.filter(r => r.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const selected = results.filter(r => selectedIds.has(r.id));

  const cumPnlSeries: RollingSeries[] = selected.map((r, i) => ({
    label: r.label,
    color: SERIES_COLORS[i],
    points: tradesToCumPnl(r.result.trades),
  }));

  const hasPnlData = cumPnlSeries.some(s => s.points.length > 0);

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-text-1 text-2xl font-semibold">Compare Results</h1>
        <Link
          href="/backtest"
          className="text-text-3 hover:text-accent text-sm transition-colors no-underline"
        >
          ← Backtest
        </Link>
      </div>

      {results.length === 0 ? (
        <div className="bg-panel border border-border rounded-lg p-8 text-center">
          <p className="text-text-3 text-sm mb-2">No saved results yet.</p>
          <Link
            href="/backtest"
            className="text-accent text-sm no-underline hover:brightness-110"
          >
            Run a backtest and save the result →
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Left sidebar: result list */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                <span className="text-text-3 text-[11px] uppercase tracking-wider">
                  Saved Results ({results.length})
                </span>
              </div>
              <div className="divide-y divide-border">
                {results.map(r => {
                  const selIdx = selected.indexOf(r);
                  const isSelected = selIdx >= 0;
                  return (
                    <div key={r.id} className="px-3 py-2.5 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelected && selectedIds.size >= MAX_SELECTED}
                        onChange={() => toggleSelect(r.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block"
                              style={{ backgroundColor: SERIES_COLORS[selIdx] }}
                            />
                          )}
                          <span className="text-text-1 text-xs font-medium truncate">
                            {r.label}
                          </span>
                        </div>
                        <span className="text-text-3 text-[11px]">
                          {r.instrumentId} · {r.start}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-text-3 hover:text-neg text-xs transition-colors flex-shrink-0"
                        aria-label={`Delete ${r.label}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {selectedIds.size >= MAX_SELECTED && (
              <p className="text-text-3 text-xs mt-2 px-1">
                Max {MAX_SELECTED} results selected
              </p>
            )}
          </div>

          {/* Right: comparison content */}
          <div className="flex-1 space-y-4 min-w-0">
            {selected.length === 0 ? (
              <div className="bg-panel border border-border rounded-lg p-6 text-center">
                <p className="text-text-3 text-sm">
                  Select results from the list to compare.
                </p>
              </div>
            ) : (
              <>
                {/* Metrics comparison table */}
                <div className="bg-panel border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                    <span className="text-text-3 text-[11px] uppercase tracking-wider">
                      Metrics
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 text-left text-text-3 font-medium w-36">
                            Metric
                          </th>
                          {selected.map((r, i) => (
                            <th
                              key={r.id}
                              className="px-4 py-2.5 text-right text-text-2 font-medium"
                            >
                              <span className="flex items-center justify-end gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                  style={{ backgroundColor: SERIES_COLORS[i] }}
                                />
                                <span className="truncate max-w-[120px]">{r.label}</span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {METRICS.map(metric => {
                          const vals = selected.map(r => metric.get(r));
                          return (
                            <tr
                              key={metric.label}
                              className="hover:bg-panel-2 transition-colors"
                            >
                              <td className="px-4 py-2 text-text-3">{metric.label}</td>
                              {vals.map((v, i) => (
                                <td
                                  key={selected[i].id}
                                  className={`px-4 py-2 text-right ${cellColorClass(v, vals, metric.higherBetter)}`}
                                >
                                  {metric.fmt(v)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cumulative PnL chart */}
                {hasPnlData && (
                  <div className="bg-panel border border-border rounded-lg p-4">
                    <div className="px-0 pb-3">
                      <span className="text-text-3 text-[11px] uppercase tracking-wider">
                        Cumulative PnL
                      </span>
                    </div>
                    <div className="flex gap-4 mb-3 flex-wrap">
                      {selected.map((r, i) => (
                        <span key={r.id} className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-0.5 rounded inline-block"
                            style={{ backgroundColor: SERIES_COLORS[i] }}
                          />
                          <span className="text-text-2 text-xs">{r.label}</span>
                        </span>
                      ))}
                    </div>
                    <RollingChart
                      series={cumPnlSeries}
                      height={260}
                      yFormat={v => v.toFixed(0)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Run tests (unchanged)**

```bash
npm test
```

Expected: 163/163 pass

- [ ] **Step 4: Commit**

```bash
git add app/backtest/compare/page.tsx
git commit -m "feat: add backtest compare page with metrics table and cumulative PnL chart (phase 24)"
```

---

## Task 4: NavBar — Add Compare to Trade Group

**Files:**
- Modify: `seokminal-dashboard/components/NavBar.tsx`

**Interfaces:**
- Produces: `/backtest/compare` nav link in Trade group after Backtest

- [ ] **Step 1: Add Compare entry to Trade group**

In `components/NavBar.tsx`, find the Trade group items array:

```typescript
    items: [
      { href: "/backtest",  label: "Backtest" },
      { href: "/replay",    label: "Replay" },
      { href: "/portfolio", label: "Portfolio" },
      { href: "/universe",  label: "Universe" },
    ],
```

Change to:

```typescript
    items: [
      { href: "/backtest",         label: "Backtest" },
      { href: "/backtest/compare", label: "Compare" },
      { href: "/replay",           label: "Replay" },
      { href: "/portfolio",        label: "Portfolio" },
      { href: "/universe",         label: "Universe" },
    ],
```

- [ ] **Step 2: Type-check and test**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit && npm test
```

Expected: 0 TS errors, 163/163 pass

- [ ] **Step 3: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: add Compare nav link to Trade group (phase 24)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Multi-strategy comparison — `/backtest/compare` metrics table side-by-side
- [x] Parameter sweep — already exists at `/backtest/heatmap` (no change needed)
- [x] Save/load results — `lib/backtest-result-storage.ts` + Save Result button in backtest page
- [x] Cumulative PnL comparison — RollingChart with tradesToCumPnl series in compare page
- [x] NavBar Compare link added

**Placeholder scan:** None. All steps have complete code.

**Type consistency:**
- `SavedBacktestResult.result: BacktestResponse` — matches `getBacktest()` return type ✓
- `tradesToCumPnl` returns `{ ts_ns: number; value: number | null }[]` — matches `RollingPoint` interface ✓
- `RollingSeries` from `@/components/rolling/RollingChart` — `{ label, color, points: RollingPoint[] }` ✓
- `cumPnlSeries` maps each selected result to `{ label: r.label, color: SERIES_COLORS[i], points: tradesToCumPnl(...) }` ✓
- `saveBacktestResult` in Task 2 uses `result` (the state variable, type `BacktestResponse`) — only called inside `result !== null` guard ✓
- `SERIES_COLORS` is a `readonly` tuple — `SERIES_COLORS[i]` where `i < selected.length ≤ 4` always valid ✓
- `deleteBacktestResult(id: string): void` — matches usage in compare page ✓
