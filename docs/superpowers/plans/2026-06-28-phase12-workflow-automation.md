# Phase 12: Workflow Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the six research pages (Universe → Factor → Strategy → Backtest → Portfolio → Bots) into a guided workflow with persistent state and next-step CTAs on each page.

**Architecture:** `lib/workflow-storage.ts` holds a single `WorkflowState` object in localStorage and exposes pure CRUD + step-detection functions. `app/workflow/page.tsx` renders a read-only 6-step stepper that reads that state and links to each page. Four existing pages (Universe, Strategies, Backtest, Portfolio) each get a conditional CTA panel at the bottom that saves relevant data to workflow state and navigates to the next step. The Workflow page is added as a standalone top-level nav item between Market and Research.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4 design tokens, vitest + jsdom for tests. No new npm dependencies.

## Global Constraints

- Design tokens only — no hex codes in className, no inline `style={}` except data-driven `width: ${pct}%`
- `bg-accent text-black` — only on primary action buttons (CTA "→ Next Step" buttons)
- Active tabs/filters — `border-accent text-accent bg-accent/10`
- `"use client"` required at top of all page files
- No raw `fetch` in components — use functions from `@/lib/api`
- No new npm dependencies — no package.json changes
- Tests in `tests/lib/workflow-storage.test.ts`, import from `../../lib/workflow-storage`
- NavBar change: add `{ label: "Workflow", href: "/workflow" }` as standalone item between Market and Research▾
- Run full test suite (`npm test`) after every task — current baseline: 115 passing
- Commit after every passing task

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/workflow-storage.ts` | Create | WorkflowState CRUD + step detection (pure, no I/O) |
| `tests/lib/workflow-storage.test.ts` | Create | 10 unit tests |
| `app/workflow/page.tsx` | Create | 6-step stepper UI + Reset button |
| `components/NavBar.tsx` | Modify | Add Workflow standalone nav item |
| `app/universe/page.tsx` | Modify | CTA: save watchlist → workflow, link to /factor |
| `app/strategies/page.tsx` | Modify | CTA: save strategyId → workflow, link to /backtest |
| `app/backtest/page.tsx` | Modify | CTA: save backtest summary → workflow, link to /portfolio |
| `app/portfolio/page.tsx` | Modify | CTA: save portfolio weights → workflow, link to /bots |
| `docs/progress.md` | Modify | Prepend Phase 12 section |
| `docs/roadmap.md` | Modify | Mark Phase 12 complete, remove from 남은 Phase |

---

### Task 1: `lib/workflow-storage.ts` + tests

**Files:**
- Create: `lib/workflow-storage.ts`
- Create: `tests/lib/workflow-storage.test.ts`

**Interfaces:**
- Produces (used by Tasks 2 and 3):
  - `WorkflowState` interface
  - `WorkflowStep` type
  - `getWorkflow(): WorkflowState | null`
  - `updateWorkflow(patch: Partial<Omit<WorkflowState, "updatedAt">>): WorkflowState`
  - `clearWorkflow(): void`
  - `getWorkflowStep(state: WorkflowState | null): WorkflowStep`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/workflow-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkflow,
  updateWorkflow,
  clearWorkflow,
  getWorkflowStep,
  type WorkflowState,
} from "../../lib/workflow-storage";

describe("getWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns null when storage is empty", () => {
    expect(getWorkflow()).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem("nautilus:workflow", "NOT{JSON");
    expect(getWorkflow()).toBeNull();
  });
});

describe("updateWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("creates new state with instrumentIds when nothing exists", () => {
    const state = updateWorkflow({ instrumentIds: ["005930.XKRX"] });
    expect(state.instrumentIds).toEqual(["005930.XKRX"]);
    expect(state.strategyId).toBeNull();
    expect(state.backtestSharpe).toBeNull();
    expect(state.backtestPnlPct).toBeNull();
    expect(state.portfolioWeights).toBeNull();
    expect(state.updatedAt).toBeGreaterThan(0);
  });

  it("patches existing state without overwriting other fields", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01" });
    const patched = updateWorkflow({ strategyId: "strat_1_abc12" });
    expect(patched.instrumentIds).toEqual(["AAPL.NASDAQ"]);
    expect(patched.strategyId).toBe("strat_1_abc12");
  });

  it("updates updatedAt on every call", () => {
    const s1 = updateWorkflow({ instrumentIds: [] });
    const s2 = updateWorkflow({ strategyId: "x" });
    expect(s2.updatedAt).toBeGreaterThanOrEqual(s1.updatedAt);
  });

  it("persists to storage (getWorkflow returns it)", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01" });
    const stored = getWorkflow();
    expect(stored?.instrumentIds).toEqual(["AAPL.NASDAQ"]);
  });
});

describe("clearWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("removes state from storage", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"] });
    clearWorkflow();
    expect(getWorkflow()).toBeNull();
  });
});

describe("getWorkflowStep", () => {
  it("returns 'universe' when state is null", () => {
    expect(getWorkflowStep(null)).toBe("universe");
  });

  it("returns 'universe' when instrumentIds is empty", () => {
    const state: WorkflowState = {
      instrumentIds: [], start: "2023-01-01", end: "2025-01-01",
      strategyId: null, backtestSharpe: null, backtestPnlPct: null,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("universe");
  });

  it("returns 'strategy' when has instruments but no backtest result", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: null, backtestSharpe: null, backtestPnlPct: null,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("strategy");
  });

  it("returns 'portfolio' when has backtestSharpe but no portfolioWeights", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: "strat_1", backtestSharpe: 1.2, backtestPnlPct: 0.15,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("portfolio");
  });

  it("returns 'bots' when portfolioWeights are present", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ", "MSFT.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: "strat_1", backtestSharpe: 1.2, backtestPnlPct: 0.15,
      portfolioWeights: { "AAPL.NASDAQ": 0.6, "MSFT.NASDAQ": 0.4 }, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("bots");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test -- tests/lib/workflow-storage.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../../lib/workflow-storage'"

- [ ] **Step 3: Implement `lib/workflow-storage.ts`**

```typescript
const STORAGE_KEY = "nautilus:workflow";

export interface WorkflowState {
  instrumentIds: string[];
  start: string;
  end: string;
  strategyId: string | null;
  backtestSharpe: number | null;
  backtestPnlPct: number | null;
  portfolioWeights: Record<string, number> | null;
  updatedAt: number;
}

export type WorkflowStep = "universe" | "strategy" | "portfolio" | "bots";

const DEFAULTS: Omit<WorkflowState, "updatedAt"> = {
  instrumentIds: [],
  start: "2022-01-01",
  end: new Date().toISOString().slice(0, 10),
  strategyId: null,
  backtestSharpe: null,
  backtestPnlPct: null,
  portfolioWeights: null,
};

export function getWorkflow(): WorkflowState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkflowState;
  } catch {
    return null;
  }
}

export function updateWorkflow(patch: Partial<Omit<WorkflowState, "updatedAt">>): WorkflowState {
  const existing = getWorkflow();
  const next: WorkflowState = {
    ...DEFAULTS,
    ...(existing ?? {}),
    ...patch,
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearWorkflow(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getWorkflowStep(state: WorkflowState | null): WorkflowStep {
  if (!state || state.instrumentIds.length === 0) return "universe";
  if (state.backtestSharpe === null && state.backtestPnlPct === null) return "strategy";
  if (state.portfolioWeights === null) return "portfolio";
  return "bots";
}
```

- [ ] **Step 4: Run target tests — verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test -- tests/lib/workflow-storage.test.ts 2>&1 | tail -10
```

Expected: 10 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -6
```

Expected: 125 passing (115 + 10).

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add lib/workflow-storage.ts tests/lib/workflow-storage.test.ts && git commit -m "feat: add workflow-storage — WorkflowState CRUD and step detection"
```

---

### Task 2: `app/workflow/page.tsx` + NavBar Workflow link

**Files:**
- Create: `app/workflow/page.tsx`
- Modify: `components/NavBar.tsx`

**Interfaces:**
- Consumes: `getWorkflow`, `clearWorkflow`, `getWorkflowStep`, `WorkflowState`, `WorkflowStep` from `@/lib/workflow-storage`
- Produces: `/workflow` route

- [ ] **Step 1: Create `app/workflow/page.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { getWorkflow, clearWorkflow, getWorkflowStep } from "@/lib/workflow-storage";
import type { WorkflowState, WorkflowStep } from "@/lib/workflow-storage";

interface StepDef {
  id: WorkflowStep | "factor";
  label: string;
  description: string;
  href: string;
  actionLabel: string;
}

const STEP_DEFS: StepDef[] = [
  {
    id: "universe",
    label: "1. Universe",
    description: "Browse KRX and US listings. Add instruments to your watchlist to define the trading universe.",
    href: "/universe",
    actionLabel: "Browse Universe →",
  },
  {
    id: "factor",
    label: "2. Factor Analysis",
    description: "Analyse momentum, volatility, and Spearman IC across instruments. Optional — skip to strategy if ready.",
    href: "/factor",
    actionLabel: "Analyse Factors →",
  },
  {
    id: "strategy",
    label: "3. Strategy",
    description: "Select a saved strategy and proceed to backtest it against your universe.",
    href: "/strategies",
    actionLabel: "Select Strategy →",
  },
  {
    id: "portfolio",
    label: "4. Backtest",
    description: "Run the strategy over historical data. Results are saved to the workflow automatically.",
    href: "/backtest",
    actionLabel: "Run Backtest →",
  },
  {
    id: "portfolio",
    label: "5. Portfolio",
    description: "Optimise weights using Markowitz / Max-Sharpe across the universe instruments.",
    href: "/portfolio",
    actionLabel: "Optimise Portfolio →",
  },
  {
    id: "bots",
    label: "6. Deploy Bot",
    description: "Deploy an automated trading bot using the optimised strategy and weights.",
    href: "/bots",
    actionLabel: "Deploy Bot →",
  },
];

function stepIndex(step: WorkflowStep): number {
  switch (step) {
    case "universe": return 0;
    case "strategy": return 2;
    case "portfolio": return 4;
    case "bots": return 5;
  }
}

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState | null>(() => getWorkflow());

  const currentStep = getWorkflowStep(state);
  const currentIdx = stepIndex(currentStep);

  const handleReset = useCallback(() => {
    clearWorkflow();
    setState(null);
  }, []);

  function stepStatus(defIdx: number): "done" | "current" | "pending" {
    if (defIdx < currentIdx) return "done";
    if (defIdx === currentIdx) return "current";
    return "pending";
  }

  return (
    <div className="p-6 space-y-6 max-w-[760px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Workflow</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Guided pipeline: Universe → Factor → Strategy → Backtest → Portfolio → Bot.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 text-xs text-text-3 hover:text-neg border border-border hover:border-neg/40 px-3 py-1.5 rounded transition-colors bg-transparent cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* Current state summary */}
      {state && (
        <div className="bg-panel border border-border rounded-lg p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Instruments</div>
            <div className="text-text-1 text-sm font-data mt-1">{state.instrumentIds.length}</div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Strategy</div>
            <div className="text-text-1 text-sm font-data mt-1 truncate">{state.strategyId ? "Selected" : "—"}</div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Backtest Sharpe</div>
            <div className={`text-sm font-data mt-1 ${state.backtestSharpe !== null ? (state.backtestSharpe >= 1 ? "text-pos" : "text-neg") : "text-text-3"}`}>
              {state.backtestSharpe !== null ? state.backtestSharpe.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Portfolio</div>
            <div className="text-text-1 text-sm font-data mt-1">
              {state.portfolioWeights ? `${Object.keys(state.portfolioWeights).length} assets` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {STEP_DEFS.map((def, idx) => {
          const status = stepStatus(idx);
          return (
            <div
              key={idx}
              className={`bg-panel border rounded-lg p-4 transition-colors ${
                status === "current" ? "border-accent/40" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                    status === "done"
                      ? "bg-pos/20 text-pos"
                      : status === "current"
                      ? "bg-accent/20 text-accent"
                      : "bg-panel-2 text-text-3"
                  }`}
                >
                  {status === "done" ? "✓" : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${status === "pending" ? "text-text-3" : "text-text-1"}`}>
                      {def.label}
                    </span>
                    {status === "done" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pos/10 text-pos">Done</span>
                    )}
                    {status === "current" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Current</span>
                    )}
                  </div>
                  <p className="text-text-3 text-xs mt-1 leading-relaxed">{def.description}</p>
                </div>

                <Link
                  href={def.href}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded no-underline transition-colors whitespace-nowrap ${
                    status === "current"
                      ? "bg-accent text-black font-semibold hover:brightness-110"
                      : "border border-border text-text-3 hover:text-text-1 hover:border-accent/50"
                  }`}
                >
                  {def.actionLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {!state && (
        <div className="text-center py-4 text-text-3 text-sm">
          Start by browsing the Universe and adding instruments to your watchlist.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Workflow to NavBar as standalone top-level item**

In `components/NavBar.tsx`, modify `NAV_GROUPS` to add `{ label: "Workflow", href: "/workflow" }` between Market and Research:

```typescript
const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Market",    href: "/market" },
  { label: "Workflow",  href: "/workflow" },
  {
    label: "Research",
    items: [
      { href: "/notebooks",   label: "Notebooks" },
      { href: "/strategies",  label: "Strategies" },
      { href: "/experiments", label: "Experiments" },
      { href: "/quant",       label: "Quant" },
      { href: "/report",      label: "Report" },
    ],
  },
  // ... rest unchanged
];
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -6
```

Expected: 125 passing.

- [ ] **Step 4: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add app/workflow/page.tsx components/NavBar.tsx && git commit -m "feat: add Workflow stepper page + nav item"
```

---

### Task 3: CTAs on existing pages + docs

**Files:**
- Modify: `app/universe/page.tsx`
- Modify: `app/strategies/page.tsx`
- Modify: `app/backtest/page.tsx`
- Modify: `app/portfolio/page.tsx`
- Modify: `docs/progress.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: `updateWorkflow`, `getWorkflow` from `@/lib/workflow-storage`
- Each CTA calls `updateWorkflow(...)` then navigates via `useRouter`

**CTA component pattern (copy verbatim into each page, not a shared component):**

```tsx
{/* Workflow CTA — appears conditionally */}
{<CONDITION> && (
  <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
    <div>
      <div className="text-text-3 text-[10px] uppercase tracking-wider">Workflow</div>
      <p className="text-text-1 text-sm font-medium mt-0.5"><MESSAGE></p>
    </div>
    <button
      onClick={<HANDLER>}
      className="px-4 py-1.5 text-xs font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0 whitespace-nowrap flex-shrink-0"
    >
      <LABEL>
    </button>
  </div>
)}
```

---

#### 3a. `app/universe/page.tsx`

**Condition:** `watchlist.length > 0` (at least one instrument in watchlist)

**Handler:** saves watchlist instrument IDs to workflow, navigates to `/factor`

```typescript
// Add import at top
import { updateWorkflow } from "@/lib/workflow-storage";
import { useRouter } from "next/navigation";

// Add inside component (after existing state):
const router = useRouter();

function handleWorkflowNext() {
  updateWorkflow({
    instrumentIds: watchlist,
    start: "2022-01-01",
    end: new Date().toISOString().slice(0, 10),
  });
  router.push("/factor");
}
```

**CTA values:**
- CONDITION: `watchlist.length > 0`
- MESSAGE: `${watchlist.length} instrument${watchlist.length !== 1 ? "s" : ""} in watchlist — ready for Factor Analysis`
- HANDLER: `handleWorkflowNext`
- LABEL: `→ Factor Analysis`

**Placement:** after the closing `</div>` of the filter/table section, at the very bottom of the returned JSX (inside the outer `<div className="p-6 ...">`)

---

#### 3b. `app/strategies/page.tsx`

**Condition:** `selected.length === 1` (exactly one strategy selected — checkbox UI)

**Handler:** saves strategyId to workflow, navigates to `/backtest`

```typescript
// Add import at top
import { updateWorkflow } from "@/lib/workflow-storage";
import { useRouter } from "next/navigation"; // already imported

// Replace existing handleRun:
function handleRun(_strategy: Strategy) {
  updateWorkflow({ strategyId: _strategy.id });
  router.push("/backtest");
}
```

**CTA values:**
- CONDITION: `selected.length === 1`
- MESSAGE: `Strategy selected — run a backtest to continue the workflow`
- HANDLER: `() => { const s = strategies.find(st => st.id === selected[0]); if (s) handleRun(s); }`
- LABEL: `→ Run Backtest`

**Placement:** at the very bottom of the returned JSX (inside the outer `<div>`), after all existing panels.

---

#### 3c. `app/backtest/page.tsx`

**Condition:** `result !== null`

**Handler:** saves backtest summary to workflow, navigates to `/portfolio`

```typescript
// Add import at top
import { updateWorkflow } from "@/lib/workflow-storage";
import { useRouter } from "next/navigation";

// Add inside component:
const router = useRouter();

function handleWorkflowNext() {
  updateWorkflow({
    backtestSharpe: result?.sharpe_ratio ?? null,
    backtestPnlPct: result?.total_pnl_pct ?? null,
  });
  router.push("/portfolio");
}
```

**CTA values:**
- CONDITION: `result !== null`
- MESSAGE: `Backtest complete — optimise your portfolio weights next`
- HANDLER: `handleWorkflowNext`
- LABEL: `→ Optimise Portfolio`

**Placement:** at the very bottom of the returned JSX, inside the outer `<div className="p-4 ...">`.

---

#### 3d. `app/portfolio/page.tsx`

**Condition:** `optimizerResult !== null && tab === "optimizer"`

**Handler:** saves max_sharpe weights to workflow, navigates to `/bots`

```typescript
// Add import at top
import { updateWorkflow } from "@/lib/workflow-storage";
import { useRouter } from "next/navigation";

// Add inside component:
const router = useRouter();

function handleWorkflowNext() {
  if (!optimizerResult) return;
  updateWorkflow({ portfolioWeights: optimizerResult.max_sharpe.weights });
  router.push("/bots");
}
```

**CTA values:**
- CONDITION: `optimizerResult !== null && tab === "optimizer"`
- MESSAGE: `Portfolio optimised — deploy a bot with the Max-Sharpe weights`
- HANDLER: `handleWorkflowNext`
- LABEL: `→ Deploy Bot`

**Placement:** at the very bottom of the returned JSX.

---

#### 3e. docs updates

**`docs/progress.md` — prepend at top:**

```markdown
### Phase 12 — Workflow Automation (2026-06-28)

**S-15 Workflow Automation:**
- `lib/workflow-storage.ts` — `WorkflowState` CRUD + `getWorkflowStep()` step detection (pure, 10 tests)
- `app/workflow/page.tsx` — 6-step stepper: status indicators, summary cards, Reset button
- CTAs on 4 existing pages:
  - `/universe`: saves watchlist instrumentIds → workflow, navigates to /factor
  - `/strategies`: saves strategyId → workflow, navigates to /backtest  
  - `/backtest`: saves backtestSharpe + backtestPnlPct → workflow, navigates to /portfolio
  - `/portfolio`: saves max_sharpe weights → workflow, navigates to /bots
- NavBar: Workflow added as standalone top-level item (between Market and Research)

**Tests:** 125 passing (115 existing + 10 workflow-storage)

---
```

**`docs/roadmap.md` changes:**
- In the completed phase table, add after `| 11 | ...`:
  `| 12 | Workflow Automation | \`app/workflow/page.tsx\`, \`lib/workflow-storage.ts\` | — |`
- Remove the entire `### Phase 12: Workflow Automation (S-15)` section from "남은 Phase"

---

#### Implementation steps for Task 3:

- [ ] **Step 1: Add workflow CTA to `app/universe/page.tsx`**

Read the file, add `updateWorkflow` import + `useRouter` import + `handleWorkflowNext` function + CTA panel at bottom.

- [ ] **Step 2: Add workflow CTA to `app/strategies/page.tsx`**

Read the file, add `updateWorkflow` import, update `handleRun` to call `updateWorkflow({ strategyId: _strategy.id })`, add CTA panel at bottom.

- [ ] **Step 3: Add workflow CTA to `app/backtest/page.tsx`**

Read the file, add `updateWorkflow` import + `useRouter` import + `handleWorkflowNext` + CTA panel at bottom.

- [ ] **Step 4: Add workflow CTA to `app/portfolio/page.tsx`**

Read the file, add `updateWorkflow` import + `useRouter` import + `handleWorkflowNext` + CTA panel at bottom.

- [ ] **Step 5: Update docs**

- Prepend Phase 12 section to `docs/progress.md`
- Add row to completed table in `docs/roadmap.md`
- Remove Phase 12 section from "남은 Phase" in `docs/roadmap.md`

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -6
```

Expected: 125 passing.

- [ ] **Step 7: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add app/universe/page.tsx app/strategies/page.tsx app/backtest/page.tsx app/portfolio/page.tsx docs/progress.md docs/roadmap.md && git commit -m "feat: add workflow CTAs to universe/strategies/backtest/portfolio pages + docs"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| `lib/workflow-storage.ts` + step detection | Task 1 |
| Tests for workflow-storage | Task 1 |
| `app/workflow/page.tsx` — 6-step stepper + status | Task 2 |
| Nav: Workflow standalone top-level item | Task 2 |
| Universe CTA: save instruments → workflow | Task 3 |
| Strategy CTA: save strategyId → workflow | Task 3 |
| Backtest CTA: save result summary → workflow | Task 3 |
| Portfolio CTA: save weights → workflow | Task 3 |
| Docs updated | Task 3 |

### Placeholder Scan
None. All steps have complete code.

### Type Consistency
- `WorkflowState.instrumentIds: string[]` — watchlist is already `string[]` (`"005930.XKRX"` format) ✓
- `WorkflowState.backtestSharpe: number | null` — `BacktestResponse.sharpe_ratio: number | null` ✓
- `WorkflowState.portfolioWeights: Record<string, number> | null` — `PortfolioOptimizeResponse.max_sharpe.weights: Record<string, number>` ✓
- `getWorkflowStep` returns `WorkflowStep` which is `"universe" | "strategy" | "portfolio" | "bots"` — `STEP_DEFS` uses `id: WorkflowStep | "factor"` to allow non-step ids ✓
- Note: in `app/workflow/page.tsx`, `stepIndex()` handles the 4 `WorkflowStep` values; the `"factor"` step def (index 1) always shows as pending/current relative to `universe`/`strategy` but is never the returned step from `getWorkflowStep`. This is intentional — factor is informational only.
