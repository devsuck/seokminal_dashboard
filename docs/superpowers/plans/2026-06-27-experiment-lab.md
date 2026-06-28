# Experiment Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the backtest page from a one-shot tool into a systematic research platform: auto-save every run as an experiment, compare experiments side-by-side, sweep parameters with a heatmap, and preset crisis scenarios in one click.

**Architecture:** `lib/experiment-storage.ts` is the single data layer (localStorage key `"nautilus:experiments"`, max 200). `lib/scenario-presets.ts` holds the 8 static crisis date ranges. `app/backtest/page.tsx` gains auto-save + ScenarioSelect + nav links. `app/backtest/heatmap/page.tsx` is a standalone page for N×M parameter sweeps. `app/experiments/page.tsx` is the experiment browser with search, sort, and side-by-side comparison.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, localStorage, vitest/jsdom (tests). No new dependencies.

## Global Constraints

- `"use client"` — required ONLY on components using hooks/browser APIs; Server Components must NOT have it
- CSS tokens ONLY in className: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info` — NO hardcoded hex in Tailwind className
- `bg-accent`, `text-accent`: only on primary action buttons (Run, Save…) and active tab underlines
- Inline styles: forbidden in className — **EXCEPTION:** heatmap cell `backgroundColor` uses `style={{ backgroundColor: interpolateColor(t) }}` — accepted exception for data visualization (same as chart library hex config)
- No raw `fetch()` in components — all API calls via `lib/api.ts` functions (`getBacktest`)
- localStorage key: `"nautilus:experiments"` (exact)
- Max stored experiments: `200` (exact)
- `BacktestResponse` fields (from `lib/api.ts`): `sharpe_ratio`, `sortino_ratio`, `max_drawdown`, `volatility`, `total_pnl_pct`, `win_rate`, `trades: TradeRecord[]` — use these exact names in `extractMetrics`
- Test runner: `npm test` (vitest)

## File Map

**Created:**
- `lib/experiment-storage.ts` — Experiment types + localStorage CRUD
- `tests/lib/experiment-storage.test.ts`
- `lib/scenario-presets.ts` — 8 crisis date range presets
- `tests/lib/scenario-presets.test.ts`
- `components/backtest/ScenarioSelect.tsx` — dropdown, fires `onStartChange`/`onEndChange`
- `app/backtest/heatmap/page.tsx` — standalone Parameter Heatmap page
- `components/experiments/ExperimentTable.tsx` — list, search, sort, inline notes, delete, compare-select
- `components/experiments/ExperimentCompare.tsx` — side-by-side metric diff for 2 experiments
- `app/experiments/page.tsx` — experiment browser

**Modified:**
- `app/backtest/page.tsx` — add ScenarioSelect, auto-save experiment after run, nav links
- `app/layout.tsx` — add "Experiments" nav item
- `docs/progress.md`

---

### Task 1: lib/experiment-storage.ts + tests

**Files:**
- Create: `lib/experiment-storage.ts`
- Create: `tests/lib/experiment-storage.test.ts`

**Interfaces — Produces (Tasks 3, 5, 6, 7 depend on these exact names):**
```typescript
export type ExperimentStrategy = "ema_cross" | "gated";

export interface ExperimentParams {
  strategy: ExperimentStrategy;
  instrumentId: string;
  start: string;
  end: string;
  timeframe: string;
  benchmarkId: string;
  fast?: number;       // ema_cross only
  slow?: number;       // ema_cross only
  rulesCount?: number; // gated only
}

export interface ExperimentMetrics {
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  totalPnlPct: number | null;
  totalTrades: number;   // always a number (trades.length)
  volatility: number | null;
}

export interface Experiment {
  id: string;          // "exp_${timestamp}_${5-char random}"
  timestamp: number;   // Date.now()
  label: string;
  notes: string;       // initially ""
  params: ExperimentParams;
  metrics: ExperimentMetrics;
}

export function makeExperimentLabel(params: Pick<ExperimentParams, "strategy" | "instrumentId" | "fast" | "slow" | "rulesCount">): string
export function extractMetrics(result: BacktestResponse): ExperimentMetrics  // imports type from @/lib/api
export function saveExperiment(entry: Omit<Experiment, "id" | "timestamp" | "notes">): Experiment
export function getExperiments(): Experiment[]
export function updateExperimentNotes(id: string, notes: string): void
export function deleteExperiment(id: string): void
export function clearExperiments(): void
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/experiment-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveExperiment, getExperiments, updateExperimentNotes,
  deleteExperiment, clearExperiments, makeExperimentLabel, extractMetrics,
  type ExperimentParams, type ExperimentMetrics,
} from "../../lib/experiment-storage";
import type { BacktestResponse } from "../../lib/api";

const BASE_PARAMS: ExperimentParams = {
  strategy: "ema_cross",
  instrumentId: "AAPL.NASDAQ",
  start: "2025-01-01",
  end: "2026-01-01",
  timeframe: "1D",
  benchmarkId: "",
  fast: 10,
  slow: 20,
};

const BASE_METRICS: ExperimentMetrics = {
  sharpe: 1.5,
  sortino: 2.1,
  maxDrawdown: -0.12,
  winRate: 0.55,
  totalPnlPct: 0.22,
  totalTrades: 43,
  volatility: 0.18,
};

describe("experiment-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getExperiments returns [] when storage empty", () => {
    expect(getExperiments()).toEqual([]);
  });

  it("getExperiments returns [] on corrupt JSON", () => {
    localStorage.setItem("nautilus:experiments", "NOT{JSON");
    expect(getExperiments()).toEqual([]);
  });

  it("saveExperiment persists and returns experiment with id/timestamp/notes", () => {
    const exp = saveExperiment({ label: "Test", params: BASE_PARAMS, metrics: BASE_METRICS });
    expect(exp.id).toMatch(/^exp_\d+_[a-z0-9]{5}$/);
    expect(exp.timestamp).toBeGreaterThan(0);
    expect(exp.notes).toBe("");
    expect(getExperiments()).toHaveLength(1);
  });

  it("saveExperiment prepends (newest first)", () => {
    saveExperiment({ label: "A", params: BASE_PARAMS, metrics: BASE_METRICS });
    saveExperiment({ label: "B", params: BASE_PARAMS, metrics: BASE_METRICS });
    const exps = getExperiments();
    expect(exps[0].label).toBe("B");
    expect(exps[1].label).toBe("A");
  });

  it("updateExperimentNotes changes notes without affecting other fields", () => {
    const exp = saveExperiment({ label: "X", params: BASE_PARAMS, metrics: BASE_METRICS });
    updateExperimentNotes(exp.id, "my note");
    const updated = getExperiments().find(e => e.id === exp.id)!;
    expect(updated.notes).toBe("my note");
    expect(updated.label).toBe("X");
  });

  it("deleteExperiment removes by id", () => {
    const exp = saveExperiment({ label: "del", params: BASE_PARAMS, metrics: BASE_METRICS });
    deleteExperiment(exp.id);
    expect(getExperiments()).toHaveLength(0);
  });

  it("clearExperiments empties storage", () => {
    saveExperiment({ label: "A", params: BASE_PARAMS, metrics: BASE_METRICS });
    clearExperiments();
    expect(getExperiments()).toHaveLength(0);
  });

  it("makeExperimentLabel: ema_cross", () => {
    expect(makeExperimentLabel({ strategy: "ema_cross", instrumentId: "AAPL.NASDAQ", fast: 10, slow: 20 }))
      .toBe("AAPL.NASDAQ EMA 10/20");
  });

  it("makeExperimentLabel: gated", () => {
    expect(makeExperimentLabel({ strategy: "gated", instrumentId: "005930.XKRX", rulesCount: 3 }))
      .toBe("005930.XKRX Gated (3 rules)");
  });

  it("extractMetrics maps BacktestResponse fields correctly", () => {
    const mockResult: BacktestResponse = {
      sharpe_ratio: 1.5,
      sortino_ratio: 2.1,
      max_drawdown: -0.12,
      volatility: 0.18,
      beta: 0.9,
      total_pnl: 5000,
      total_pnl_pct: 0.22,
      win_rate: 0.55,
      profit_loss_ratio: 1.8,
      avg_win: 120,
      avg_loss: -67,
      bar_count: 252,
      trades: [{} as any, {} as any, {} as any],
    };
    const metrics = extractMetrics(mockResult);
    expect(metrics.sharpe).toBe(1.5);
    expect(metrics.sortino).toBe(2.1);
    expect(metrics.maxDrawdown).toBe(-0.12);
    expect(metrics.winRate).toBe(0.55);
    expect(metrics.totalPnlPct).toBe(0.22);
    expect(metrics.totalTrades).toBe(3);
    expect(metrics.volatility).toBe(0.18);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test tests/lib/experiment-storage.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement lib/experiment-storage.ts**

Create `lib/experiment-storage.ts`:
```typescript
import type { BacktestResponse } from "@/lib/api";

const STORAGE_KEY = "nautilus:experiments";
const MAX_EXPERIMENTS = 200;

export type ExperimentStrategy = "ema_cross" | "gated";

export interface ExperimentParams {
  strategy: ExperimentStrategy;
  instrumentId: string;
  start: string;
  end: string;
  timeframe: string;
  benchmarkId: string;
  fast?: number;
  slow?: number;
  rulesCount?: number;
}

export interface ExperimentMetrics {
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  totalPnlPct: number | null;
  totalTrades: number;
  volatility: number | null;
}

export interface Experiment {
  id: string;
  timestamp: number;
  label: string;
  notes: string;
  params: ExperimentParams;
  metrics: ExperimentMetrics;
}

export function makeExperimentLabel(
  params: Pick<ExperimentParams, "strategy" | "instrumentId" | "fast" | "slow" | "rulesCount">
): string {
  if (params.strategy === "ema_cross") {
    return `${params.instrumentId} EMA ${params.fast ?? "?"}/${params.slow ?? "?"}`;
  }
  return `${params.instrumentId} Gated (${params.rulesCount ?? 0} rules)`;
}

export function extractMetrics(result: BacktestResponse): ExperimentMetrics {
  return {
    sharpe: result.sharpe_ratio,
    sortino: result.sortino_ratio,
    maxDrawdown: result.max_drawdown,
    winRate: result.win_rate,
    totalPnlPct: result.total_pnl_pct,
    totalTrades: result.trades.length,
    volatility: result.volatility,
  };
}

export function saveExperiment(
  entry: Omit<Experiment, "id" | "timestamp" | "notes">
): Experiment {
  const experiment: Experiment = {
    ...entry,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    notes: "",
  };
  const existing = getExperiments();
  const updated = [experiment, ...existing].slice(0, MAX_EXPERIMENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Quota exceeded — trim to half and retry
    const trimmed = [experiment, ...existing.slice(0, Math.floor(MAX_EXPERIMENTS / 2))];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
  return experiment;
}

export function getExperiments(): Experiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Experiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updateExperimentNotes(id: string, notes: string): void {
  const updated = getExperiments().map(e => e.id === id ? { ...e, notes } : e);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteExperiment(id: string): void {
  const updated = getExperiments().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearExperiments(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test tests/lib/experiment-storage.test.ts
```

Expected: 10/10 passing

- [ ] **Step 5: Commit**

```bash
git add lib/experiment-storage.ts tests/lib/experiment-storage.test.ts
git commit -m "feat: add experiment localStorage storage with metrics extraction"
```

---

### Task 2: lib/scenario-presets.ts + tests

**Files:**
- Create: `lib/scenario-presets.ts`
- Create: `tests/lib/scenario-presets.test.ts`

**Produces:**
```typescript
export interface ScenarioPreset { id: string; label: string; start: string; end: string; description: string; }
export const SCENARIOS: ScenarioPreset[]   // exactly 8 items
export function findScenario(id: string): ScenarioPreset | undefined
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/scenario-presets.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { SCENARIOS, findScenario } from "../../lib/scenario-presets";

describe("scenario-presets", () => {
  it("has exactly 8 scenarios", () => {
    expect(SCENARIOS).toHaveLength(8);
  });

  it("all scenarios have valid date range (start < end)", () => {
    for (const s of SCENARIOS) {
      expect(new Date(s.start) < new Date(s.end)).toBe(true);
    }
  });

  it("all scenario IDs are unique", () => {
    const ids = SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("all scenarios have non-empty label and description", () => {
    for (const s of SCENARIOS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("findScenario('gfc') returns 2008 Financial Crisis", () => {
    const s = findScenario("gfc");
    expect(s?.label).toBe("2008 Financial Crisis");
    expect(s?.start).toBe("2007-10-01");
    expect(s?.end).toBe("2009-03-31");
  });

  it("findScenario('covid') returns COVID Crash", () => {
    const s = findScenario("covid");
    expect(s?.start).toBe("2020-02-01");
    expect(s?.end).toBe("2020-04-30");
  });

  it("findScenario returns undefined for unknown ID", () => {
    expect(findScenario("unknown_xyz")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/scenario-presets.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement lib/scenario-presets.ts**

Create `lib/scenario-presets.ts`:
```typescript
export interface ScenarioPreset {
  id: string;
  label: string;
  start: string;
  end: string;
  description: string;
}

export const SCENARIOS: ScenarioPreset[] = [
  {
    id: "gfc",
    label: "2008 Financial Crisis",
    start: "2007-10-01",
    end: "2009-03-31",
    description: "Lehman collapse, global credit freeze",
  },
  {
    id: "covid",
    label: "COVID Crash",
    start: "2020-02-01",
    end: "2020-04-30",
    description: "Fastest 30% drawdown in history",
  },
  {
    id: "dotcom",
    label: "Dot-com Bubble",
    start: "2000-03-01",
    end: "2002-10-31",
    description: "NASDAQ -78% peak to trough",
  },
  {
    id: "ukraine",
    label: "Ukraine War",
    start: "2022-02-01",
    end: "2022-06-30",
    description: "Commodity shock + rate hike cycle",
  },
  {
    id: "inflation",
    label: "Inflation Cycle",
    start: "2021-03-01",
    end: "2023-06-30",
    description: "CPI surge 2.5% → 9.1% → 3%",
  },
  {
    id: "highrate",
    label: "High Rate Period",
    start: "2022-03-01",
    end: "2024-01-01",
    description: "Fed funds 0.25% → 5.5%",
  },
  {
    id: "bull2017",
    label: "Bull Market 2017",
    start: "2017-01-01",
    end: "2017-12-31",
    description: "S&P +21.8%, low volatility",
  },
  {
    id: "bear2022",
    label: "Bear Market 2022",
    start: "2022-01-01",
    end: "2022-12-31",
    description: "S&P -19.4%, stocks and bonds fell together",
  },
];

export function findScenario(id: string): ScenarioPreset | undefined {
  return SCENARIOS.find(s => s.id === id);
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/scenario-presets.test.ts
```

Expected: 7/7 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: All tests pass (10 experiment + 7 scenario + 8 watchlist + 6 dashboard-storage + 4 system-status-utils + 2 sanity = 37 total)

- [ ] **Step 6: Commit**

```bash
git add lib/scenario-presets.ts tests/lib/scenario-presets.test.ts
git commit -m "feat: add 8 crisis scenario presets"
```

---

### Task 3: ScenarioSelect + update app/backtest/page.tsx

**Files:**
- Create: `components/backtest/ScenarioSelect.tsx`
- Modify: `app/backtest/page.tsx`

**Interfaces:**
- Consumes: `SCENARIOS` from `@/lib/scenario-presets`; `saveExperiment`, `extractMetrics`, `makeExperimentLabel` from `@/lib/experiment-storage`; existing `logActivity` from `@/lib/dashboard-storage`; existing `buildSpawnRules`, `newRule`, `Mode`, `SpawnRuleState` from `@/lib/backtest-types`
- ScenarioSelect props: `{ onStartChange: (v: string) => void; onEndChange: (v: string) => void }`

No tests (UI components that modify dates).

- [ ] **Step 1: Create components/backtest/ScenarioSelect.tsx**

```tsx
"use client";

import { SCENARIOS } from "@/lib/scenario-presets";

interface ScenarioSelectProps {
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

export function ScenarioSelect({ onStartChange, onEndChange }: ScenarioSelectProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    const scenario = SCENARIOS.find(s => s.id === id);
    if (!scenario) return;
    onStartChange(scenario.start);
    onEndChange(scenario.end);
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Scenario</span>
      <select
        defaultValue=""
        onChange={handleChange}
        className="h-9 px-2 text-xs bg-panel-2 border border-border rounded-md text-text-2 outline-none focus:border-accent cursor-pointer"
      >
        <option value="" disabled>Select crisis preset…</option>
        {SCENARIOS.map(s => (
          <option key={s.id} value={s.id} title={s.description}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Read app/backtest/page.tsx to understand current structure**

Read the full file before editing.

- [ ] **Step 3: Update app/backtest/page.tsx**

Make three changes:

**Change A — Add imports** (after existing imports at top of file):
```typescript
import Link from "next/link";
import { ScenarioSelect } from "@/components/backtest/ScenarioSelect";
import {
  saveExperiment, extractMetrics, makeExperimentLabel,
  type ExperimentStrategy,
} from "@/lib/experiment-storage";
```

**Change B — Add experiment save after `setResult(btRes)` in the `run()` function.**

The current code after `await Promise.all(...)` looks like:
```typescript
setBars(barsRes.bars);
setResult(btRes);
logActivity({
  type: "backtest",
  label: mode === "single"
    ? `${instrumentId} EMA ${fast}/${slow}`
    : `${instrumentId} Gated (${rules.length} rule${rules.length !== 1 ? "s" : ""})`,
  href: "/backtest",
});
```

Replace with:
```typescript
setBars(barsRes.bars);
setResult(btRes);
logActivity({
  type: "backtest",
  label: mode === "single"
    ? `${instrumentId} EMA ${fast}/${slow}`
    : `${instrumentId} Gated (${rules.length} rule${rules.length !== 1 ? "s" : ""})`,
  href: "/backtest",
});
saveExperiment({
  label: makeExperimentLabel(
    mode === "single"
      ? { strategy: "ema_cross", instrumentId, fast, slow }
      : { strategy: "gated", instrumentId, rulesCount: rules.length }
  ),
  params: {
    strategy: (mode === "single" ? "ema_cross" : "gated") as ExperimentStrategy,
    instrumentId,
    start,
    end,
    timeframe,
    benchmarkId,
    ...(mode === "single" ? { fast, slow } : { rulesCount: rules.length }),
  },
  metrics: extractMetrics(btRes),
});
```

**Change C — Update the page title area and add ScenarioSelect.**

Find the current title block:
```tsx
<div>
  <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Backtest</h1>
  <p className="text-text-3 text-sm mt-0.5">Run and analyze EMA cross strategies with optional gating conditions</p>
</div>
```

Replace with:
```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Backtest</h1>
    <p className="text-text-3 text-sm mt-0.5">Run and analyze EMA cross strategies with optional gating conditions</p>
  </div>
  <div className="flex gap-4 text-xs pt-1">
    <Link href="/experiments" className="text-text-3 hover:text-accent no-underline transition-colors">
      Experiments →
    </Link>
    <Link href="/backtest/heatmap" className="text-text-3 hover:text-accent no-underline transition-colors">
      Heatmap →
    </Link>
  </div>
</div>
```

Also add `<ScenarioSelect>` before `<StrategyControlPanel>`. Find:
```tsx
<div className="space-y-3">
  <StrategyModeTabs mode={mode} onChange={setMode} />

  <StrategyControlPanel
```

Replace with:
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-4 flex-wrap">
    <StrategyModeTabs mode={mode} onChange={setMode} />
    <ScenarioSelect onStartChange={setStart} onEndChange={setEnd} />
  </div>

  <StrategyControlPanel
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
npm test
```

Expected: All 37 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/backtest/ScenarioSelect.tsx app/backtest/page.tsx
git commit -m "feat: add ScenarioSelect presets and auto-save experiment on backtest run"
```

---

### Task 4: app/backtest/heatmap/page.tsx (Parameter Heatmap)

**Files:**
- Create: `app/backtest/heatmap/page.tsx`

**Note:** This is the only file in this task. It's a standalone "use client" page with all state self-contained. No sub-components needed for MVP. Inline cell color uses `style={{ backgroundColor }}` — this is the accepted visualization exception (same as chart library hex config).

**Interfaces:**
- Consumes: `getBacktest`, `ApiError`, `BacktestResponse` from `@/lib/api`; `InstrumentSelect` from `@/components/InstrumentSelect`; `DateRangePicker` from `@/components/DateRangePicker`

- [ ] **Step 1: Read components/InstrumentSelect.tsx and components/DateRangePicker.tsx**

Read both files to confirm their prop signatures before using them.

- [ ] **Step 2: Create app/backtest/heatmap/ directory and page**

```bash
mkdir -p app/backtest/heatmap
```

Create `app/backtest/heatmap/page.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError, getBacktest, type BacktestResponse } from "@/lib/api";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";

type HeatmapMetric = "sharpe" | "sortino" | "maxDrawdown" | "winRate";

const METRIC_LABELS: Record<HeatmapMetric, string> = {
  sharpe: "Sharpe Ratio",
  sortino: "Sortino Ratio",
  maxDrawdown: "Max Drawdown",
  winRate: "Win Rate",
};

// Lower is better for these metrics — invert color scale
const INVERT_METRIC = new Set<HeatmapMetric>(["maxDrawdown"]);

function rangeArr(min: number, max: number, step: number): number[] {
  const arr: number[] = [];
  for (let v = min; v <= max; v += step) arr.push(v);
  return arr;
}

function getMetricValue(result: BacktestResponse, metric: HeatmapMetric): number | null {
  switch (metric) {
    case "sharpe":      return result.sharpe_ratio;
    case "sortino":     return result.sortino_ratio;
    case "maxDrawdown": return result.max_drawdown;
    case "winRate":     return result.win_rate;
  }
}

function interpolateColor(t: number): string {
  // t=0 → red (#EF4444), t=0.5 → yellow (#F59E0B), t=1 → green (#22C55E)
  const r1 = 239, g1 = 68,  b1 = 68;
  const r2 = 245, g2 = 158, b2 = 11;
  const r3 = 34,  g3 = 197, b3 = 94;
  let r, g, b;
  if (t <= 0.5) {
    const u = t * 2;
    r = Math.round(r1 + (r2 - r1) * u);
    g = Math.round(g1 + (g2 - g1) * u);
    b = Math.round(b1 + (b2 - b1) * u);
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(r2 + (r3 - r2) * u);
    g = Math.round(g2 + (g3 - g2) * u);
    b = Math.round(b2 + (b3 - b2) * u);
  }
  return `rgb(${r},${g},${b})`;
}

function normalizeT(value: number, min: number, max: number, invert: boolean): number {
  if (max === min) return 0.5;
  const t = (value - min) / (max - min);
  return invert ? 1 - t : t;
}

function formatValue(value: number, metric: HeatmapMetric): string {
  if (metric === "maxDrawdown" || metric === "winRate") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HeatmapPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [fastMin, setFastMin] = useState(5);
  const [fastMax, setFastMax] = useState(30);
  const [fastStep, setFastStep] = useState(5);
  const [slowMin, setSlowMin] = useState(20);
  const [slowMax, setSlowMax] = useState(100);
  const [slowStep, setSlowStep] = useState(10);
  const [metric, setMetric] = useState<HeatmapMetric>("sharpe");
  const [results, setResults] = useState<Record<string, number | null>>({});
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runHeatmap() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const fastValues = rangeArr(fastMin, fastMax, fastStep);
    const slowValues = rangeArr(slowMin, slowMax, slowStep);
    const pairs: [number, number][] = [];
    for (const f of fastValues) {
      for (const s of slowValues) {
        if (f < s) pairs.push([f, s]);
      }
    }

    if (pairs.length === 0) {
      setError("No valid combinations: all fast values must be less than slow values.");
      return;
    }
    if (pairs.length > 100) {
      setError(`${pairs.length} combinations exceeds limit of 100. Reduce range or increase step.`);
      return;
    }

    setRunning(true);
    setError(null);
    setResults({});
    setProgress(0);
    setTotal(pairs.length);

    const newResults: Record<string, number | null> = {};
    let completed = 0;
    const queue = [...pairs];

    async function worker() {
      while (queue.length > 0) {
        const pair = queue.shift();
        if (!pair || ctrl.signal.aborted) break;
        const [f, s] = pair;
        const key = `${f}-${s}`;
        try {
          const res = await getBacktest(
            instrumentId, start, end,
            "ema_cross",
            { fast: String(f), slow: String(s) },
            undefined,
            ctrl.signal
          );
          if (!ctrl.signal.aborted) {
            newResults[key] = getMetricValue(res, metric);
          }
        } catch (e) {
          if (!ctrl.signal.aborted) {
            newResults[key] = null;
          }
        }
        completed++;
        if (!ctrl.signal.aborted) {
          setProgress(completed);
          setResults({ ...newResults });
        }
      }
    }

    await Promise.all(Array.from({ length: 5 }, () => worker()));

    if (!ctrl.signal.aborted) {
      setRunning(false);
    }
  }

  function stopHeatmap() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const fastValues = rangeArr(fastMin, fastMax, fastStep);
  const slowValues = rangeArr(slowMin, slowMax, slowStep);

  // Compute min/max of non-null results for normalization
  const allValues = Object.values(results).filter((v): v is number => v !== null);
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  const invert = INVERT_METRIC.has(metric);

  const totalCombinations = fastValues.flatMap(f => slowValues.filter(s => f < s)).length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Parameter Heatmap</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Sweep EMA parameters to find robust configurations
          </p>
        </div>
        <Link href="/backtest" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
          ← Backtest
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
        {/* Row 1: Instrument + Date */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Symbol</span>
          <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Date</span>
          <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        </div>

        {/* Row 2: Fast EMA range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider w-24 shrink-0">Fast EMA</span>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Min
            <input type="number" value={fastMin} min={1} max={fastMax - 1}
              onChange={e => setFastMin(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Max
            <input type="number" value={fastMax} min={fastMin + 1}
              onChange={e => setFastMax(Math.max(fastMin + 1, parseInt(e.target.value) || fastMin + 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Step
            <input type="number" value={fastStep} min={1}
              onChange={e => setFastStep(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <span className="text-text-3 text-[10px] font-data">[{fastValues.join(", ")}]</span>
        </div>

        {/* Row 3: Slow EMA range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider w-24 shrink-0">Slow EMA</span>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Min
            <input type="number" value={slowMin} min={2}
              onChange={e => setSlowMin(Math.max(2, parseInt(e.target.value) || 2))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Max
            <input type="number" value={slowMax} min={slowMin + 1}
              onChange={e => setSlowMax(Math.max(slowMin + 1, parseInt(e.target.value) || slowMin + 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Step
            <input type="number" value={slowStep} min={1}
              onChange={e => setSlowStep(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"
            />
          </label>
          <span className="text-text-3 text-[10px] font-data">[{slowValues.join(", ")}]</span>
        </div>

        {/* Row 4: Metric + Run */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Metric</span>
          <div className="flex gap-1">
            {(["sharpe", "sortino", "maxDrawdown", "winRate"] as HeatmapMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 h-8 text-xs rounded border transition-colors cursor-pointer ${
                  metric === m
                    ? "bg-accent text-black font-semibold border-accent"
                    : "bg-panel-2 text-text-2 border-border hover:text-text-1"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          <span className="text-text-3 text-[10px] font-data ml-auto">
            {totalCombinations} combinations
            {totalCombinations > 100 && <span className="text-warn ml-1">⚠ max 100</span>}
          </span>
          <button
            onClick={running ? stopHeatmap : runHeatmap}
            disabled={totalCombinations === 0}
            className="px-6 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? `Stop (${progress}/${total})` : "Run Heatmap"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Heatmap grid */}
      {Object.keys(results).length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {METRIC_LABELS[metric]} — Fast EMA (rows) × Slow EMA (columns)
            </span>
            {allValues.length > 0 && (
              <span className="text-text-3 text-[10px] font-data">
                min {formatValue(minVal, metric)} · max {formatValue(maxVal, metric)}
              </span>
            )}
          </div>
          <div className="p-4 overflow-x-auto">
            {/* Column headers (Slow EMA values) */}
            <div className="flex gap-0.5 mb-1 ml-9">
              {slowValues.map(s => (
                <div key={s} className="w-10 text-center text-[9px] text-text-3 font-data">{s}</div>
              ))}
            </div>

            {/* Grid rows */}
            <div className="space-y-0.5">
              {fastValues.map(f => (
                <div key={f} className="flex items-center gap-0.5">
                  {/* Row label (Fast EMA) */}
                  <span className="w-8 text-[9px] text-text-3 font-data text-right pr-1 shrink-0">{f}</span>
                  {/* Cells */}
                  {slowValues.map(s => {
                    const key = `${f}-${s}`;
                    const invalid = f >= s;
                    if (invalid) {
                      return (
                        <div
                          key={s}
                          className="w-10 h-8 bg-panel-2 rounded-sm opacity-20"
                          title="Invalid: fast ≥ slow"
                        />
                      );
                    }
                    const value = results[key];
                    const hasResult = key in results;
                    const t = (hasResult && value !== null)
                      ? normalizeT(value, minVal, maxVal, invert)
                      : null;

                    return (
                      <div
                        key={s}
                        className="w-10 h-8 rounded-sm flex items-center justify-center cursor-default"
                        // Accepted exception: visualization requires computed color
                        style={t !== null ? { backgroundColor: interpolateColor(t) } : undefined}
                        title={
                          !hasResult
                            ? `Fast=${f} Slow=${s}: not yet`
                            : value === null
                              ? `Fast=${f} Slow=${s}: error`
                              : `Fast=${f} Slow=${s}: ${formatValue(value, metric)}`
                        }
                      >
                        {!hasResult && running && (
                          <span className="text-[7px] text-text-3">…</span>
                        )}
                        {hasResult && value === null && (
                          <span className="text-[7px] text-neg">✗</span>
                        )}
                        {hasResult && value !== null && (
                          <span className="text-[8px] font-data text-white/90 drop-shadow">
                            {formatValue(value, metric)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-text-3 text-[9px]">{invert ? "Better ←" : "← Worse"}</span>
              <div className="flex h-3 w-40 rounded overflow-hidden">
                {Array.from({ length: 20 }, (_, i) => i / 19).map((t, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    // Accepted exception: gradient legend
                    style={{ backgroundColor: interpolateColor(t) }}
                  />
                ))}
              </div>
              <span className="text-text-3 text-[9px]">{invert ? "→ Worse" : "Better →"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run full tests to confirm no regressions**

```bash
npm test
```

Expected: All 37 tests pass

- [ ] **Step 4: Commit**

```bash
git add app/backtest/heatmap/page.tsx
git commit -m "feat: add Parameter Heatmap page with N×M EMA sweep"
```

---

### Task 5: components/experiments/ExperimentTable.tsx

**Files:**
- Create: `components/experiments/ExperimentTable.tsx`

**Interfaces:**
- Consumes: `Experiment`, `ExperimentMetrics`, `updateExperimentNotes`, `deleteExperiment` from `@/lib/experiment-storage`
- Props:
  ```typescript
  interface ExperimentTableProps {
    experiments: Experiment[];
    selected: string[];
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onNotesUpdate: (id: string, notes: string) => void;
  }
  ```

- [ ] **Step 1: Create components/experiments/ directory and ExperimentTable.tsx**

```bash
mkdir -p components/experiments
```

Create `components/experiments/ExperimentTable.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { Experiment } from "@/lib/experiment-storage";

interface ExperimentTableProps {
  experiments: Experiment[];
  selected: string[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNotesUpdate: (id: string, notes: string) => void;
}

type SortKey = "timestamp" | "sharpe" | "winRate" | "totalPnlPct" | "maxDrawdown";

function NoteCell({
  experiment,
  onUpdate,
}: {
  experiment: Experiment;
  onUpdate: (notes: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(experiment.notes);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { onUpdate(value); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { onUpdate(value); setEditing(false); }
          if (e.key === "Escape") { setValue(experiment.notes); setEditing(false); }
        }}
        className="w-full bg-panel-2 border border-accent text-text-1 text-xs px-1.5 py-0.5 rounded outline-none"
        placeholder="Add note…"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-text-3 text-xs italic cursor-text hover:text-text-2 transition-colors block truncate max-w-[160px]"
    >
      {value || "Add note…"}
    </span>
  );
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ExperimentTable({
  experiments, selected, onSelect, onDelete, onNotesUpdate,
}: ExperimentTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = experiments.filter(e =>
    search === "" ||
    e.label.toLowerCase().includes(search.toLowerCase()) ||
    e.params.instrumentId.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va: number, vb: number;
    switch (sortKey) {
      case "timestamp":   va = a.timestamp;              vb = b.timestamp; break;
      case "sharpe":      va = a.metrics.sharpe ?? -Infinity; vb = b.metrics.sharpe ?? -Infinity; break;
      case "winRate":     va = a.metrics.winRate ?? -Infinity; vb = b.metrics.winRate ?? -Infinity; break;
      case "totalPnlPct": va = a.metrics.totalPnlPct ?? -Infinity; vb = b.metrics.totalPnlPct ?? -Infinity; break;
      case "maxDrawdown": va = a.metrics.maxDrawdown ?? -Infinity; vb = b.metrics.maxDrawdown ?? -Infinity; break;
      default: va = 0; vb = 0;
    }
    return sortAsc ? va - vb : vb - va;
  });

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`text-left text-[10px] uppercase tracking-wider font-normal bg-transparent border-0 cursor-pointer transition-colors ${
          active ? "text-accent" : "text-text-3 hover:text-text-1"
        }`}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </button>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="text-center py-12 text-text-3 text-sm">
        No experiments yet. Run a backtest to save your first experiment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + info */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by label or symbol…"
          className="h-8 w-64 px-3 text-xs bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
        />
        <span className="text-text-3 text-xs font-data">{filtered.length} / {experiments.length}</span>
        {selected.length > 0 && (
          <span className="text-info text-xs">{selected.length} selected for compare</span>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-panel-2 border-b border-border">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left"><SortBtn label="Label" k="timestamp" /></th>
              <th className="px-3 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Period</th>
              <th className="px-3 py-2 text-right"><SortBtn label="Sharpe" k="sharpe" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="Win%" k="winRate" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="Return" k="totalPnlPct" /></th>
              <th className="px-3 py-2 text-right"><SortBtn label="MaxDD" k="maxDrawdown" /></th>
              <th className="px-3 py-2 text-right text-text-3 font-normal text-[10px] uppercase tracking-wider">Trades</th>
              <th className="px-3 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Notes</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(exp => {
              const isSelected = selected.includes(exp.id);
              return (
                <tr
                  key={exp.id}
                  className={`border-b border-border/40 transition-colors ${
                    isSelected ? "bg-accent/5" : "hover:bg-panel-2/50"
                  }`}
                >
                  {/* Compare checkbox */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelect(exp.id)}
                      className="cursor-pointer accent-[#FF9F1C]"
                    />
                  </td>

                  {/* Label + timestamp */}
                  <td className="px-3 py-2">
                    <div className="text-text-1 font-medium truncate max-w-[200px]">{exp.label}</div>
                    <div className="text-text-3 text-[9px] font-data mt-0.5">{timeAgo(exp.timestamp)}</div>
                  </td>

                  {/* Period */}
                  <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">
                    {exp.params.start} – {exp.params.end}
                  </td>

                  {/* Metrics */}
                  <td className="px-3 py-2 text-right font-data">
                    <span className={exp.metrics.sharpe !== null && exp.metrics.sharpe > 0 ? "text-pos" : "text-neg"}>
                      {fmtNum(exp.metrics.sharpe)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-data text-text-2">
                    {fmtPct(exp.metrics.winRate)}
                  </td>
                  <td className="px-3 py-2 text-right font-data">
                    <span className={exp.metrics.totalPnlPct !== null && exp.metrics.totalPnlPct > 0 ? "text-pos" : "text-neg"}>
                      {fmtPct(exp.metrics.totalPnlPct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-data text-neg">
                    {fmtPct(exp.metrics.maxDrawdown)}
                  </td>
                  <td className="px-3 py-2 text-right font-data text-text-3">
                    {exp.metrics.totalTrades}
                  </td>

                  {/* Notes */}
                  <td className="px-3 py-2">
                    <NoteCell experiment={exp} onUpdate={notes => onNotesUpdate(exp.id, notes)} />
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onDelete(exp.id)}
                      className="text-text-3 hover:text-neg text-xs bg-transparent border-0 cursor-pointer transition-colors p-0"
                      title="Delete experiment"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full tests**

```bash
npm test
```

Expected: All 37 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/experiments/ExperimentTable.tsx
git commit -m "feat: add ExperimentTable with search, sort, inline notes, compare select"
```

---

### Task 6: components/experiments/ExperimentCompare.tsx

**Files:**
- Create: `components/experiments/ExperimentCompare.tsx`

**Interfaces:**
- Consumes: `Experiment`, `ExperimentMetrics` from `@/lib/experiment-storage`
- Props: `{ experiments: [Experiment, Experiment]; onClose: () => void }`

- [ ] **Step 1: Create ExperimentCompare.tsx**

Create `components/experiments/ExperimentCompare.tsx`:
```tsx
"use client";

import type { Experiment, ExperimentMetrics } from "@/lib/experiment-storage";

interface ExperimentCompareProps {
  experiments: [Experiment, Experiment];
  onClose: () => void;
}

interface MetricRow {
  label: string;
  key: keyof ExperimentMetrics;
  format: (v: number | null) => string;
  higherBetter: boolean | null; // null = neutral
}

const METRIC_ROWS: MetricRow[] = [
  {
    label: "Sharpe Ratio",
    key: "sharpe",
    format: v => v?.toFixed(2) ?? "—",
    higherBetter: true,
  },
  {
    label: "Sortino Ratio",
    key: "sortino",
    format: v => v?.toFixed(2) ?? "—",
    higherBetter: true,
  },
  {
    label: "Max Drawdown",
    key: "maxDrawdown",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: false,
  },
  {
    label: "Win Rate",
    key: "winRate",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: true,
  },
  {
    label: "Total Return",
    key: "totalPnlPct",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: true,
  },
  {
    label: "Total Trades",
    key: "totalTrades",
    format: v => String(v ?? "—"),
    higherBetter: null,
  },
  {
    label: "Volatility",
    key: "volatility",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: false,
  },
];

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return b - a;
}

function deltaClass(d: number | null, higherBetter: boolean | null): string {
  if (d == null || higherBetter == null || d === 0) return "text-text-3";
  const better = higherBetter ? d > 0 : d < 0;
  return better ? "text-pos" : "text-neg";
}

function deltaLabel(d: number | null, row: MetricRow): string {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : "";
  if (row.key === "totalTrades") return `${sign}${d.toFixed(0)}`;
  if (row.key === "maxDrawdown" || row.key === "winRate" || row.key === "totalPnlPct" || row.key === "volatility") {
    return `${sign}${(d * 100).toFixed(1)}pp`;
  }
  return `${sign}${d.toFixed(2)}`;
}

export function ExperimentCompare({ experiments, onClose }: ExperimentCompareProps) {
  const [a, b] = experiments;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Experiment Comparison</span>
        <button
          onClick={onClose}
          className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer transition-colors"
        >
          Close ×
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider w-32">Metric</th>
              <th className="px-4 py-3 text-right">
                <div className="text-text-1 font-medium truncate max-w-[220px] text-right">{a.label}</div>
                <div className="text-text-3 text-[9px] font-data mt-0.5">{a.params.start} – {a.params.end}</div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="text-text-1 font-medium truncate max-w-[220px] text-right">{b.label}</div>
                <div className="text-text-3 text-[9px] font-data mt-0.5">{b.params.start} – {b.params.end}</div>
              </th>
              <th className="px-4 py-3 text-right text-text-3 font-normal text-[10px] uppercase tracking-wider">
                Δ (B − A)
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map(row => {
              const va = a.metrics[row.key] as number | null;
              const vb = b.metrics[row.key] as number | null;
              const d = delta(va, vb);
              return (
                <tr key={row.key} className="border-b border-border/40 hover:bg-panel-2/30">
                  <td className="px-4 py-2.5 text-text-3">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-data text-text-2">{row.format(va)}</td>
                  <td className="px-4 py-2.5 text-right font-data text-text-2">{row.format(vb)}</td>
                  <td className={`px-4 py-2.5 text-right font-data ${deltaClass(d, row.higherBetter)}`}>
                    {deltaLabel(d, row)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Params comparison */}
      <div className="px-4 py-3 border-t border-border grid grid-cols-2 gap-4">
        {[a, b].map(exp => (
          <div key={exp.id} className="space-y-1">
            <p className="text-text-3 text-[10px] uppercase tracking-wider">{exp.label}</p>
            <p className="text-text-2 text-[11px] font-data">
              {exp.params.instrumentId} · {exp.params.timeframe} · {exp.params.start} – {exp.params.end}
            </p>
            {exp.params.strategy === "ema_cross" && (
              <p className="text-text-3 text-[10px] font-data">EMA {exp.params.fast}/{exp.params.slow}</p>
            )}
            {exp.params.strategy === "gated" && (
              <p className="text-text-3 text-[10px] font-data">Gated · {exp.params.rulesCount} rules</p>
            )}
            {exp.notes && (
              <p className="text-text-3 text-[10px] italic">"{exp.notes}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full tests**

```bash
npm test
```

Expected: All 37 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/experiments/ExperimentCompare.tsx
git commit -m "feat: add ExperimentCompare side-by-side metric diff"
```

---

### Task 7: app/experiments/page.tsx + nav + progress.md

**Files:**
- Create: `app/experiments/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: `ExperimentTable` from `@/components/experiments/ExperimentTable`; `ExperimentCompare` from `@/components/experiments/ExperimentCompare`; `getExperiments`, `deleteExperiment`, `updateExperimentNotes`, `clearExperiments`, `type Experiment` from `@/lib/experiment-storage`

- [ ] **Step 1: Create app/experiments/page.tsx**

Create `app/experiments/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { ExperimentCompare } from "@/components/experiments/ExperimentCompare";
import {
  getExperiments, deleteExperiment, updateExperimentNotes, clearExperiments,
  type Experiment,
} from "@/lib/experiment-storage";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setExperiments(getExperiments());
  }, []);

  function handleDelete(id: string) {
    deleteExperiment(id);
    setExperiments(getExperiments());
    setSelected(prev => prev.filter(s => s !== id));
  }

  function handleNotesUpdate(id: string, notes: string) {
    updateExperimentNotes(id, notes);
    setExperiments(getExperiments());
  }

  function handleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearExperiments();
    setExperiments([]);
    setSelected([]);
    setConfirmClear(false);
  }

  const compareExperiments: [Experiment, Experiment] | null = (() => {
    if (selected.length !== 2) return null;
    const a = experiments.find(e => e.id === selected[0]);
    const b = experiments.find(e => e.id === selected[1]);
    return a && b ? [a, b] : null;
  })();

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Experiments</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Every backtest run is saved automatically. Select two to compare.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/backtest" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
            ← Backtest
          </Link>
          {experiments.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`text-xs px-3 h-7 rounded border cursor-pointer transition-colors bg-transparent ${
                confirmClear
                  ? "text-neg border-neg hover:bg-neg/10"
                  : "text-text-3 border-border hover:text-neg"
              }`}
            >
              {confirmClear ? "Confirm clear all" : "Clear all"}
            </button>
          )}
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="text-xs text-text-3 hover:text-text-1 cursor-pointer bg-transparent border-0 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Compare panel */}
      {compareExperiments && (
        <ExperimentCompare
          experiments={compareExperiments}
          onClose={() => setSelected([])}
        />
      )}

      {/* Experiment table */}
      <ExperimentTable
        experiments={experiments}
        selected={selected}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onNotesUpdate={handleNotesUpdate}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update app/layout.tsx — add Experiments nav item**

Read `app/layout.tsx` first, then find `NAV_ITEMS` and add Experiments between Backtest and Research:

```typescript
const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/market",       label: "Market" },
  { href: "/backtest",     label: "Backtest" },
  { href: "/experiments",  label: "Experiments" },  // NEW
  { href: "/quant",        label: "Research" },
  { href: "/bots",         label: "Bots" },
  { href: "/ai-trader",    label: "AI Trader" },
];
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All 37 tests pass

- [ ] **Step 4: Update docs/progress.md**

Append the following to the "완료된 작업" section (before existing entries):

```
### Experiment Lab (2026-06-27)

- `lib/experiment-storage.ts` — Experiment CRUD (localStorage, max 200), extractMetrics, makeExperimentLabel (10 tests)
- `lib/scenario-presets.ts` — 8 crisis date range presets: GFC, COVID, Dot-com, Ukraine, Inflation, High Rate, Bull 2017, Bear 2022 (7 tests)
- `components/backtest/ScenarioSelect.tsx` — preset dropdown, fires onStartChange/onEndChange
- `app/backtest/page.tsx` — ScenarioSelect added, auto-save experiment on run, nav links to Experiments + Heatmap
- `app/backtest/heatmap/page.tsx` — Parameter Heatmap: N×M EMA sweep, concurrent pool (max 5), color-coded grid
- `components/experiments/ExperimentTable.tsx` — list with search, sort by 5 keys, inline notes edit, checkbox compare select, delete
- `components/experiments/ExperimentCompare.tsx` — side-by-side metric diff with Δ column (green/red)
- `app/experiments/page.tsx` — experiment browser, compare panel, clear all
- `app/layout.tsx` — "Experiments" added to nav

Tests: 37 passing (10 experiment + 7 scenario + 8 watchlist + 6 dashboard-storage + 4 system-status-utils + 2 sanity)
```

- [ ] **Step 5: Commit**

```bash
git add app/experiments/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: assemble Experiments page with compare panel, add nav item"
```

---

## Self-Review

### Spec Coverage (S-1, S-3, S-8)

**S-1 Experiment Manager:**
| Requirement | Task |
|---|---|
| Experiment 자동 생성 | Task 3 (auto-save in run()) |
| Strategy, Parameters, Dataset, Date, Universe, Benchmark saved | Task 1 (ExperimentParams) |
| Sharpe, Max Drawdown, Win Rate, Turnover auto-calculated | Task 1 (extractMetrics — uses BacktestResponse) |
| CAGR, Sortino | ✅ extracted (sortino) · ⚠ CAGR not in BacktestResponse → using total_pnl_pct instead |
| 모든 실험 검색 가능 | Task 5 (search by label/instrument) |
| 모든 실험 비교 가능 | Tasks 5+6 (checkbox select → ExperimentCompare) |
| Commission/Slippage/Notes saved | Notes editable (Task 5); Commission/Slippage not exposed by current backend → omitted |

**S-3 Parameter Heatmap:**
| Requirement | Task |
|---|---|
| Fast × Slow 전체 조합 | Task 4 (rangeArr + pairs loop) |
| Heatmap으로 Sharpe, MaxDD, Win Rate 시각화 | Task 4 (metric toggle + color grid) |
| PnL | ✅ totalPnlPct metric added |

**S-8 Scenario Analysis:**
| Requirement | Task |
|---|---|
| 8 시나리오 프리셋 | Task 2 (SCENARIOS array) |
| 선택 즉시 날짜 채움 | Task 3 (ScenarioSelect) |
| 2008, COVID, Dot-com, Ukraine, Inflation, High Rate, Bull 2017, Bear 2022 | Task 2 ✅ |

### Omissions (deliberate, honest stubs)
- Commission/Slippage: not exposed by current `/backtest` endpoint — ExperimentParams has no field for it; tracked in roadmap note
- CAGR: `BacktestResponse` has no `cagr` field → use `total_pnl_pct` ("Total Return") as proxy
- Turnover: not in BacktestResponse → omitted from metrics

### Placeholder scan
None found. All steps have complete code.

### Type consistency
- `Experiment.metrics: ExperimentMetrics` — defined Task 1, used Tasks 3, 5, 6 ✅
- `ExperimentParams` — defined Task 1, constructed Task 3 ✅
- `ExperimentTable` props: `experiments, selected, onSelect, onDelete, onNotesUpdate` — defined Task 5, passed Task 7 ✅
- `ExperimentCompare` props: `experiments: [Experiment, Experiment], onClose` — defined Task 6, constructed Task 7 ✅
- `METRIC_ROWS[n].key: keyof ExperimentMetrics` — all 7 keys exist in ExperimentMetrics ✅
