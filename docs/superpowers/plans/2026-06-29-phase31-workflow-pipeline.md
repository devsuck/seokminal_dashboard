# Phase 31: Workflow Pipeline Connection Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the three main workflow steps: AI Trader recommends a strategy → "Open Backtest" pre-fills backtest form with those params → Backtest runs and auto-saves result to workflow storage + ResearchActivity log.

**Architecture:** URL query params carry strategy context from AI Trader to Backtest. Backtest reads `useSearchParams()` on mount and pre-fills form. After each backtest run, `updateWorkflow()` and `logActivity()` are called automatically.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, localStorage (workflow-storage, dashboard-storage)

## Global Constraints

- Raw `fetch` forbidden — use `lib/api.ts` functions only
- Design tokens only: `bg-panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`
- `style={{}}` forbidden except `style={{ height: "Npx" }}` chart containers
- No new dependencies
- `"use client"` already on all modified pages

---

### Task 1: AI Trader → Backtest URL Pre-fill

**Files:**
- Modify: `app/ai-trader/page.tsx`
- Modify: `app/backtest/page.tsx`

**Context:**
- AI Trader `result` object has: `strategy: string` ("ema_cross" | "macd" | "rsi"), `params: object`, `instrument_id: string`, `reasoning: string`
- Current "Open Backtest →" link: `<a href="/backtest">Open Backtest →</a>`
- Backtest page has `useSearchParams` available (it's already `"use client"`)
- Backtest already imports `useRouter` and `useSearchParams` or will need to

**URL format to build:**
- For `strategy=macd`, `params={fast:12, slow:26, signal_period:9}`:
  `/backtest?strategy=macd&fast=12&slow=26&signal_period=9`
- For `strategy=rsi`, `params={period:14, oversold:30, overbought:70}`:
  `/backtest?strategy=rsi&period=14&oversold=30&overbought=70`
- For `strategy=ema_cross`, `params={fast:12, slow:26}`:
  `/backtest?strategy=ema_cross&fast=12&slow=26`

**Backtest URL param → state mapping:**
- `?strategy=macd` → `setStrategyType("macd")`
- `?strategy=rsi` → `setStrategyType("rsi")`
- `?strategy=ema_cross` → `setStrategyType("ema_cross")`
- `?fast=12` → `setFast(12)` / `setMacdFast(12)` (check actual state names in file)
- `?slow=26` → `setSlow(26)` / `setMacdSlow(26)`
- `?signal_period=9` → `setMacdSignal(9)`
- `?period=14` → `setRsiPeriod(14)`
- `?oversold=30` → `setRsiOversold(30)`
- `?overbought=70` → `setRsiOverbought(70)`

**Important:** Read `app/backtest/page.tsx` carefully before implementing to find the exact state setter names.

- [ ] **Step 1: Read both files to understand exact state names**

Read `app/ai-trader/page.tsx` to find the "Open Backtest →" link section.
Read `app/backtest/page.tsx` to find exact state names for: fast, slow, macdFast, macdSlow, macdSignal, rsiPeriod, rsiOversold, rsiOverbought.

- [ ] **Step 2: Update AI Trader page — build backtest URL from result**

In `app/ai-trader/page.tsx`, find the "Open Backtest →" link:
```tsx
<a
  href={`/backtest`}
  className="inline-flex text-accent text-xs border border-accent/30 rounded px-3 py-1.5 hover:bg-accent/10 transition-colors"
>
  Open Backtest →
</a>
```

Replace with a helper function + updated link:

```tsx
function buildBacktestUrl(strategy: string, params: Record<string, unknown>): string {
  const q = new URLSearchParams({ strategy });
  for (const [k, v] of Object.entries(params)) {
    q.set(k, String(v));
  }
  return `/backtest?${q.toString()}`;
}
```

And change the link to:
```tsx
<a
  href={buildBacktestUrl(result.strategy, result.params)}
  className="inline-flex text-accent text-xs border border-accent/30 rounded px-3 py-1.5 hover:bg-accent/10 transition-colors"
>
  Open Backtest →
</a>
```

The helper function should be defined outside the component (module-level).

- [ ] **Step 3: Update Backtest page — read URL params on mount**

In `app/backtest/page.tsx`:

1. Add `useSearchParams` import from `"next/navigation"` if not already imported.

2. Add inside the component (after state declarations):
```tsx
const searchParams = useSearchParams();

useEffect(() => {
  const strategy = searchParams.get("strategy");
  if (!strategy) return;
  if (strategy === "macd") {
    setStrategyType("macd");
    const fast = searchParams.get("fast");
    const slow = searchParams.get("slow");
    const signal = searchParams.get("signal_period");
    if (fast) setMacdFast(parseInt(fast));
    if (slow) setMacdSlow(parseInt(slow));
    if (signal) setMacdSignal(parseInt(signal));
  } else if (strategy === "rsi") {
    setStrategyType("rsi");
    const period = searchParams.get("period");
    const oversold = searchParams.get("oversold");
    const overbought = searchParams.get("overbought");
    if (period) setRsiPeriod(parseInt(period));
    if (oversold) setRsiOversold(parseFloat(oversold));
    if (overbought) setRsiOverbought(parseFloat(overbought));
  } else if (strategy === "ema_cross") {
    setStrategyType("ema_cross");
    const fast = searchParams.get("fast");
    const slow = searchParams.get("slow");
    if (fast) setFast(parseInt(fast));
    if (slow) setSlow(parseInt(slow));
  }
}, []); // run once on mount only
```

**Important:** Use the actual state setter names from the file. The variable names above (`setMacdFast`, `setMacdSlow`, etc.) must match exactly what exists in the file.

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Run tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --passWithNoTests
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/ai-trader/page.tsx app/backtest/page.tsx
git commit -m "feat: AI Trader passes strategy params to Backtest via URL pre-fill"
```

---

### Task 2: Auto-save Workflow + ResearchActivity Log After Backtest

**Files:**
- Modify: `app/backtest/page.tsx`

**Context:**
- `updateWorkflow` is already imported (line 6): `import { updateWorkflow } from "@/lib/workflow-storage";`
- `logActivity` is in `lib/dashboard-storage`: `import { logActivity } from "@/lib/dashboard-storage";`
- `logActivity` signature: `logActivity(entry: { type: ActivityType, label: string, href: string }): void`
- `ActivityType` = `"backtest" | "strategy" | "experiment" | "portfolio" | "bot"`
- Current `updateWorkflow` only called in `handleWorkflowNext()` (after user clicks "Next" button)
- `result` state holds backtest result after run: `result.sharpe_ratio`, `result.total_pnl_pct`
- `instrumentId` state holds current instrument

**Goal:** After every successful backtest `run()`, automatically:
1. Call `updateWorkflow({ backtestSharpe: result.sharpe_ratio, backtestPnlPct: result.total_pnl_pct, strategyId: strategy })`
2. Call `logActivity({ type: "backtest", label: `${instrumentId} — ${strategy}`, href: "/backtest" })`

- [ ] **Step 1: Add logActivity import**

In `app/backtest/page.tsx`, add to existing import section:
```tsx
import { logActivity } from "@/lib/dashboard-storage";
```

- [ ] **Step 2: Add auto-save calls in `run()` function**

Find the `run()` function. After the successful backtest result is set (after `setResult(data)`), add:

```tsx
updateWorkflow({
  backtestSharpe: data.sharpe_ratio ?? null,
  backtestPnlPct: data.total_pnl_pct ?? null,
  strategyId: strategy,
});
logActivity({
  type: "backtest",
  label: `${instrumentId} — ${strategy}`,
  href: "/backtest",
});
```

Read the `run()` function carefully to find the exact location where `setResult(data)` is called, then add directly after it.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Run tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --passWithNoTests
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/backtest/page.tsx
git commit -m "feat: auto-save workflow state and log activity after backtest run"
```

Write report to: `seokminal-dashboard/.superpowers/sdd/task-2-workflow-report.md`
