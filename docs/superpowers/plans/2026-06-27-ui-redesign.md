# UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Seokminal Dashboard from raw terminal UI to professional quant trading platform (Bloomberg Terminal + TradingView aesthetic) — readability, information hierarchy, design system — without changing any API or business logic.

**Architecture:** Tailwind v4 CSS-first config via `@theme {}` in globals.css defines all design tokens; new `components/ui/` directory holds 11 extracted components; backtest/page.tsx is restructured into top-control + bottom-analytics layout using these components; all inline styles replaced with Tailwind classNames.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Tailwind CSS 4.3.1, lightweight-charts 5.2.0, `next/font/google` (built-in, no extra install)

## Global Constraints

- All existing API calls unchanged (`lib/api.ts` not touched)
- All state management logic preserved — only presentation layer changes
- Backtest execution logic (`run()` function, `buildSpawnRules()`, `indToJson()`) preserved exactly
- `next/font/google` for Inter + JetBrains Mono — no new npm packages
- Tailwind v4 uses CSS-first config: tokens go in `globals.css` under `@theme {}`, not `tailwind.config.ts`
- Orange (`--color-accent: #FF9F1C`) used ONLY for: active tab indicator, primary RUN button, selected TF button state
- TypeScript must compile clean: `npx tsc --noEmit` passes after every task
- Working directory for all commands: `seokminal-dashboard/`

---

## File Map

**Modified:**
- `app/globals.css` — full rewrite with @theme tokens + base styles
- `app/layout.tsx` — font setup + nav redesign
- `app/page.tsx` — apply tokens, use shared components
- `app/backtest/page.tsx` — restructure layout, wire up all new components
- `components/CandlestickChart.tsx` — update hardcoded colors to match tokens
- `components/InstrumentSelect.tsx` — Tailwind className replace
- `components/DateRangePicker.tsx` — Tailwind className replace

**Created:**
- `lib/backtest-types.ts` — shared types + builder helpers extracted from backtest/page.tsx
- `components/ui/MetricCard.tsx`
- `components/ui/EmptyState.tsx`
- `components/ui/JsonPreview.tsx`
- `components/ui/StrategyModeTabs.tsx`
- `components/ui/StrategyControlPanel.tsx`
- `components/ui/SingleStrategyForm.tsx`
- `components/ui/ConditionRow.tsx`
- `components/ui/RuleCard.tsx`
- `components/ui/CompositeStrategyBuilder.tsx`
- `components/ui/ChartPanel.tsx`
- `components/ui/MetricGrid.tsx`
- `components/ui/TradeLogTable.tsx`
- `components/ui/index.ts`

---

## Task 1: Design Tokens + globals.css

**Files:**
- Modify: `app/globals.css` (full rewrite)

**Interfaces:**
- Produces: CSS custom properties available globally — `--color-bg`, `--color-panel`, `--color-panel-2`, `--color-border`, `--color-text-1`, `--color-text-2`, `--color-text-3`, `--color-accent`, `--color-pos`, `--color-neg`, `--color-warn`, `--color-info`; Tailwind utilities: `bg-bg`, `bg-panel`, `bg-panel-2`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `border-border`, `font-ui`, `font-data`

- [ ] **Step 1: Replace globals.css entirely**

```css
@import "tailwindcss";

/* ── Design Tokens ───────────────────────────────────────────────── */
@theme {
  /* Colors */
  --color-bg:       #080A0F;
  --color-panel:    #0F131A;
  --color-panel-2:  #151A23;
  --color-border:   #242A35;
  --color-text-1:   #E6EAF0;
  --color-text-2:   #9AA4B2;
  --color-text-3:   #5F6B7A;
  --color-accent:   #FF9F1C;
  --color-pos:      #22C55E;
  --color-neg:      #EF4444;
  --color-warn:     #F59E0B;
  --color-info:     #3B82F6;

  /* Fonts */
  --font-ui:   var(--font-inter), system-ui, sans-serif;
  --font-data: var(--font-mono), 'IBM Plex Mono', monospace;
}

/* ── Base Styles ─────────────────────────────────────────────────── */
@layer base {
  * { box-sizing: border-box; }

  body {
    background-color: var(--color-bg);
    color: var(--color-text-1);
    font-family: var(--font-ui);
    font-size: 14px;
    line-height: 1.55;
  }

  /* Form elements base */
  input[type="date"],
  input[type="number"],
  input[type="text"],
  select {
    background: var(--color-panel-2);
    color: var(--color-text-1);
    border: 1px solid var(--color-border);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 0 10px;
    height: 36px;
    border-radius: 6px;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type="date"]:focus,
  input[type="number"]:focus,
  input[type="text"]:focus,
  select:focus {
    border-color: var(--color-accent);
  }

  input[type="number"].compact,
  select.compact {
    height: 32px;
    font-size: 12px;
    padding: 0 8px;
  }

  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.5);
    opacity: 0.6;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--color-bg); }
  ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
}
```

- [ ] **Step 2: Verify TypeScript and CSS parse**

```bash
npx tsc --noEmit
```

Expected: no errors (globals.css is not type-checked, just needs to not break build)

```bash
npm run dev
```

Open http://localhost:3000 — background should now be `#080A0F` (slightly blue-black vs. previous `#090909`). Font should be system-ui (Inter not loaded yet — that's Task 2).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add design token system to globals.css (Tailwind v4 @theme)"
```

---

## Task 2: Font Setup + Nav Header (layout.tsx)

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `--color-panel`, `--color-border`, `--color-text-1`, `--color-text-3`, `--color-accent` from Task 1
- Produces: `--font-inter` CSS variable (Inter from next/font/google), `--font-mono` CSS variable (JetBrains Mono), nav header with class `nautilus-nav` usable by child pages

- [ ] **Step 1: Rewrite layout.tsx**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NAUTILUS",
};

const NAV_ITEMS = [
  { href: "/",          label: "Market" },
  { href: "/backtest",  label: "Backtest" },
  { href: "/quant",     label: "Quant" },
  { href: "/bots",      label: "Bots" },
  { href: "/ai-trader", label: "AI Trader" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}
      style={{ background: "var(--color-bg)", colorScheme: "dark" }}>
      <body className="bg-bg text-text-1 font-ui antialiased m-0">
        <header className="h-12 border-b border-border bg-panel flex items-center px-6 gap-8 shrink-0">
          <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">
            NAUTILUS
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-sm text-text-3 hover:text-text-1 rounded transition-colors duration-150 no-underline"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-text-3 font-data">
            {new Date().toISOString().slice(0, 10)}
          </div>
        </header>
        <main className="min-h-[calc(100vh-48px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000 — nav should show Inter font, no orange labels, clean horizontal layout.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: load Inter + JetBrains Mono fonts, redesign nav header"
```

---

## Task 3: Shared Types + Builder Helpers (lib/backtest-types.ts)

**Files:**
- Create: `lib/backtest-types.ts`

**Interfaces:**
- Produces: All types and pure functions needed by backtest components:
  - `IndicatorType`, `MAType`, `BBBand`, `CompOp`, `Combinator`, `Mode`
  - `IndicatorOp`, `CompRow`, `SpawnRuleState`
  - `INDICATORS`, `OPS`, `MA_TYPES`, `BB_BANDS`, `TIMEFRAMES`, `BENCHMARKS` constants
  - `defaultInd(indicator: IndicatorType): IndicatorOp`
  - `newComp(): CompRow`
  - `newRule(): SpawnRuleState`
  - `indToJson(op: IndicatorOp, barType: string): object`
  - `buildSpawnRules(rules: SpawnRuleState[], instrumentId: string): object[]`

- [ ] **Step 1: Create lib/backtest-types.ts**

```ts
// ── Constants ──────────────────────────────────────────────────────
export const BENCHMARKS = [
  { value: "",             label: "— None —" },
  { value: "SPY.ARCA",    label: "SPY (S&P 500)" },
  { value: "QQQ.NASDAQ",  label: "QQQ (NASDAQ 100)" },
  { value: "005930.XKRX", label: "Samsung Electronics" },
];

export const TIMEFRAMES = ["1D", "1W", "1M", "1Q"] as const;
export const INDICATORS  = ["RSI", "MA", "BB", "MACD", "CCI", "OBV"] as const;
export const OPS         = ["<", "<=", ">", ">=", "=="] as const;
export const MA_TYPES    = ["SIMPLE", "EXPONENTIAL", "WEIGHTED"] as const;
export const BB_BANDS    = ["upper", "middle", "lower"] as const;

// ── Types ──────────────────────────────────────────────────────────
export type IndicatorType = typeof INDICATORS[number];
export type MAType        = typeof MA_TYPES[number];
export type BBBand        = typeof BB_BANDS[number];
export type CompOp        = typeof OPS[number];
export type Combinator    = "AND" | "OR";
export type Mode          = "single" | "composite";

export interface IndicatorOp {
  indicator:   IndicatorType;
  period:      number;
  ma_type:     MAType;
  k:           number;
  band:        BBBand;
  fast_period: number;
  slow_period: number;
}

export interface CompRow {
  id:             string;
  left:           IndicatorOp;
  op:             CompOp;
  rightType:      "literal" | "indicator";
  rightLiteral:   number;
  rightIndicator: IndicatorOp;
}

export interface SpawnRuleState {
  id:          string;
  combinator:  Combinator;
  comparisons: CompRow[];
  fast:        number;
  slow:        number;
}

// ── Factories ──────────────────────────────────────────────────────
export function defaultInd(indicator: IndicatorType): IndicatorOp {
  return {
    indicator,
    period: 14,
    ma_type: "EXPONENTIAL",
    k: 2,
    band: "middle",
    fast_period: 12,
    slow_period: 26,
  };
}

export function newComp(): CompRow {
  return {
    id: crypto.randomUUID(),
    left: defaultInd("RSI"),
    op: "<",
    rightType: "literal",
    rightLiteral: 30,
    rightIndicator: defaultInd("MA"),
  };
}

export function newRule(): SpawnRuleState {
  return {
    id: crypto.randomUUID(),
    combinator: "AND",
    comparisons: [newComp()],
    fast: 10,
    slow: 20,
  };
}

// ── JSON Serialization (preserved exactly from original) ───────────
export function indToJson(op: IndicatorOp, barType: string) {
  const p: Record<string, unknown> = {};
  if (["RSI", "MA", "BB", "CCI", "OBV"].includes(op.indicator)) p.period = op.period;
  if (["MA", "BB"].includes(op.indicator)) p.ma_type = op.ma_type;
  if (op.indicator === "BB") { p.k = op.k; p.band = op.band; }
  if (op.indicator === "MACD") { p.fast_period = op.fast_period; p.slow_period = op.slow_period; }
  return { indicator: op.indicator, bar_type: barType, params: p };
}

export function buildSpawnRules(rules: SpawnRuleState[], instrumentId: string) {
  const barType = `${instrumentId}-1-DAY-LAST-EXTERNAL`;
  return rules.map(r => ({
    condition: {
      combinator: r.combinator,
      conditions: r.comparisons.map(c => ({
        left: indToJson(c.left, barType),
        op: c.op,
        right: c.rightType === "literal"
          ? { value: c.rightLiteral }
          : indToJson(c.rightIndicator, barType),
      })),
    },
    strategy: {
      class: "backtest_runner.ema_cross_flat:EMACrossFlat",
      params: {
        instrument_id: instrumentId,
        bar_type: barType,
        trade_size: 10,
        fast_ema_period: r.fast,
        slow_ema_period: r.slow,
        request_bars: false,
        subscribe_trade_ticks: false,
      },
    },
  }));
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/backtest-types.ts
git commit -m "refactor: extract backtest types, constants, and builder helpers to lib/"
```

---

## Task 4: Primitive UI Components (MetricCard, EmptyState, JsonPreview)

**Files:**
- Create: `components/ui/MetricCard.tsx`
- Create: `components/ui/EmptyState.tsx`
- Create: `components/ui/JsonPreview.tsx`

**Interfaces:**
- Produces:
  - `MetricCard({ label, value, delta?, colorClass? })` — KPI card
  - `EmptyState({ message, hint? })` — empty placeholder panel
  - `JsonPreview({ label, data })` — collapsible JSON pre block

- [ ] **Step 1: Create components/ui/MetricCard.tsx**

```tsx
interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  colorClass?: string; // e.g. "text-pos", "text-neg", "text-text-1"
}

export function MetricCard({ label, value, delta, colorClass = "text-text-1" }: MetricCardProps) {
  return (
    <div className="bg-panel border border-border rounded-md px-4 py-3 min-w-[90px]">
      <div className="text-text-3 text-[11px] uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`font-data text-[17px] font-semibold leading-none ${colorClass}`}>{value}</div>
      {delta && (
        <div className={`font-data text-xs mt-1 ${colorClass}`}>{delta}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create components/ui/EmptyState.tsx**

```tsx
interface EmptyStateProps {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-center px-8">
      <div className="text-text-3 text-sm">{message}</div>
      {hint && <div className="text-text-3 text-xs opacity-60">{hint}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create components/ui/JsonPreview.tsx**

```tsx
interface JsonPreviewProps {
  label: string;
  data: unknown;
}

export function JsonPreview({ label, data }: JsonPreviewProps) {
  return (
    <details className="mt-3">
      <summary className="text-text-3 text-xs cursor-pointer hover:text-text-2 transition-colors select-none">
        {label}
      </summary>
      <pre className="bg-bg border border-border rounded-md p-3 text-[11px] text-text-3 font-data overflow-auto mt-2 max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/ui/MetricCard.tsx components/ui/EmptyState.tsx components/ui/JsonPreview.tsx
git commit -m "feat: add MetricCard, EmptyState, JsonPreview UI primitives"
```

---

## Task 5: Strategy Mode Tabs + Control Panel + Single Strategy Form

**Files:**
- Create: `components/ui/StrategyModeTabs.tsx`
- Create: `components/ui/StrategyControlPanel.tsx`
- Create: `components/ui/SingleStrategyForm.tsx`

**Interfaces:**
- Consumes: `Mode` from `lib/backtest-types`, `TIMEFRAMES`, `BENCHMARKS` constants
- Produces:
  - `StrategyModeTabs({ mode, onChange })` — segmented Single/Composite control
  - `StrategyControlPanel({ instrumentId, onInstrumentChange, start, end, onStartChange, onEndChange, timeframe, onTimeframeChange, benchmarkId, onBenchmarkChange, onRun, loading, children? })` — shared top control row
  - `SingleStrategyForm({ fast, slow, onFastChange, onSlowChange })` — EMA param inputs

- [ ] **Step 1: Create components/ui/StrategyModeTabs.tsx**

```tsx
import type { Mode } from "@/lib/backtest-types";

interface StrategyModeTabsProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const TABS: { value: Mode; label: string }[] = [
  { value: "single",    label: "Single Strategy" },
  { value: "composite", label: "Composite / Gated" },
];

export function StrategyModeTabs({ mode, onChange }: StrategyModeTabsProps) {
  return (
    <div className="inline-flex bg-panel-2 border border-border rounded-md p-0.5 gap-0.5">
      {TABS.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={[
            "px-4 py-1.5 text-sm rounded transition-all duration-150 cursor-pointer border-0",
            mode === tab.value
              ? "bg-panel text-accent font-medium border border-border shadow-sm"
              : "bg-transparent text-text-3 hover:text-text-2",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create components/ui/StrategyControlPanel.tsx**

```tsx
"use client";

import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { TIMEFRAMES, BENCHMARKS } from "@/lib/backtest-types";

interface StrategyControlPanelProps {
  instrumentId: string;
  onInstrumentChange: (v: string) => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  timeframe: string;
  onTimeframeChange: (v: string) => void;
  benchmarkId: string;
  onBenchmarkChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  children?: React.ReactNode;
}

export function StrategyControlPanel({
  instrumentId, onInstrumentChange,
  start, end, onStartChange, onEndChange,
  timeframe, onTimeframeChange,
  benchmarkId, onBenchmarkChange,
  onRun, loading,
  children,
}: StrategyControlPanelProps) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Symbol</span>
          <InstrumentSelect value={instrumentId} onChange={onInstrumentChange} />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
          <DateRangePicker start={start} end={end} onStartChange={onStartChange} onEndChange={onEndChange} />
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">TF</span>
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={[
                  "px-2.5 py-1 text-xs rounded border cursor-pointer transition-all duration-100",
                  timeframe === tf
                    ? "bg-panel-2 text-accent border-accent/40 font-medium"
                    : "bg-transparent text-text-3 border-border hover:text-text-2 hover:border-border",
                ].join(" ")}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Benchmark */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Bench</span>
          <select value={benchmarkId} onChange={e => onBenchmarkChange(e.target.value)}>
            {BENCHMARKS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        {/* RUN button */}
        <button
          onClick={onRun}
          disabled={loading}
          className="ml-auto px-5 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-0"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {/* Mode-specific extra controls */}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create components/ui/SingleStrategyForm.tsx**

```tsx
interface SingleStrategyFormProps {
  fast: number;
  slow: number;
  onFastChange: (v: number) => void;
  onSlowChange: (v: number) => void;
}

export function SingleStrategyForm({ fast, slow, onFastChange, onSlowChange }: SingleStrategyFormProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Strategy</span>
        <span className="text-text-2 text-xs bg-panel-2 border border-border px-3 py-1 rounded">
          EMA Cross
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Fast</span>
        <input
          type="number" value={fast} min={1}
          className="compact w-14"
          onChange={e => onFastChange(Number(e.target.value))}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Slow</span>
        <input
          type="number" value={slow} min={1}
          className="compact w-14"
          onChange={e => onSlowChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/ui/StrategyModeTabs.tsx components/ui/StrategyControlPanel.tsx components/ui/SingleStrategyForm.tsx
git commit -m "feat: add StrategyModeTabs, StrategyControlPanel, SingleStrategyForm components"
```

---

## Task 6: ConditionRow

**Files:**
- Create: `components/ui/ConditionRow.tsx`

**Interfaces:**
- Consumes: `IndicatorOp`, `CompRow`, `INDICATORS`, `OPS`, `MA_TYPES`, `BB_BANDS`, `defaultInd` from `lib/backtest-types`
- Produces: `ConditionRow({ row, onChange, onRemove, isOnly })` — single condition in pill-row style

- [ ] **Step 1: Create components/ui/ConditionRow.tsx**

```tsx
"use client";

import {
  INDICATORS, OPS, MA_TYPES, BB_BANDS,
  defaultInd,
  type IndicatorOp, type CompRow, type IndicatorType, type MAType, type BBBand, type CompOp,
} from "@/lib/backtest-types";

// ── Internal: indicator select ─────────────────────────────────────
function IndSelect({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  return (
    <select
      className="compact"
      value={op.indicator}
      onChange={e => onChange(defaultInd(e.target.value as IndicatorType))}
    >
      {INDICATORS.map(i => <option key={i}>{i}</option>)}
    </select>
  );
}

// ── Internal: indicator params ─────────────────────────────────────
function IndParams({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  const upd = (patch: Partial<IndicatorOp>) => onChange({ ...op, ...patch });
  return (
    <span className="inline-flex gap-1.5 items-center">
      {["RSI", "MA", "BB", "CCI"].includes(op.indicator) && (
        <>
          <span className="text-text-3 text-[10px]">P</span>
          <input type="number" value={op.period} min={1} className="compact w-12"
            onChange={e => upd({ period: Number(e.target.value) })} />
        </>
      )}
      {["MA", "BB"].includes(op.indicator) && (
        <select className="compact" value={op.ma_type}
          onChange={e => upd({ ma_type: e.target.value as MAType })}>
          <option value="SIMPLE">SMA</option>
          <option value="EXPONENTIAL">EMA</option>
          <option value="WEIGHTED">WMA</option>
        </select>
      )}
      {op.indicator === "BB" && (
        <>
          <span className="text-text-3 text-[10px]">K</span>
          <input type="number" value={op.k} step={0.1} min={0.1} className="compact w-12"
            onChange={e => upd({ k: Number(e.target.value) })} />
          <select className="compact" value={op.band}
            onChange={e => upd({ band: e.target.value as BBBand })}>
            {BB_BANDS.map(b => (
              <option key={b} value={b}>
                {b === "upper" ? "↑ upper" : b === "middle" ? "─ mid" : "↓ lower"}
              </option>
            ))}
          </select>
        </>
      )}
      {op.indicator === "MACD" && (
        <>
          <span className="text-text-3 text-[10px]">F</span>
          <input type="number" value={op.fast_period} min={1} className="compact w-12"
            onChange={e => upd({ fast_period: Number(e.target.value) })} />
          <span className="text-text-3 text-[10px]">S</span>
          <input type="number" value={op.slow_period} min={1} className="compact w-12"
            onChange={e => upd({ slow_period: Number(e.target.value) })} />
        </>
      )}
    </span>
  );
}

// ── Public: ConditionRow ───────────────────────────────────────────
interface ConditionRowProps {
  row: CompRow;
  onChange: (r: CompRow) => void;
  onRemove: () => void;
  isOnly: boolean;
}

export function ConditionRow({ row, onChange, onRemove, isOnly }: ConditionRowProps) {
  const upd = (patch: Partial<CompRow>) => onChange({ ...row, ...patch });
  return (
    <div className="flex flex-wrap gap-2 items-center py-2 border-b border-border/50 last:border-0 group">
      {/* Left operand */}
      <IndSelect op={row.left} onChange={left => upd({ left })} />
      <IndParams op={row.left} onChange={left => upd({ left })} />

      {/* Operator */}
      <select className="compact w-14" value={row.op}
        onChange={e => upd({ op: e.target.value as CompOp })}>
        {OPS.map(o => <option key={o}>{o}</option>)}
      </select>

      {/* Right type toggle */}
      <select className="compact" value={row.rightType}
        onChange={e => upd({ rightType: e.target.value as "literal" | "indicator" })}>
        <option value="literal">Value</option>
        <option value="indicator">Indicator</option>
      </select>

      {/* Right operand */}
      {row.rightType === "literal" ? (
        <input type="number" value={row.rightLiteral} className="compact w-16"
          onChange={e => upd({ rightLiteral: Number(e.target.value) })} />
      ) : (
        <>
          <IndSelect op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
          <IndParams op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
        </>
      )}

      {/* Remove button */}
      {!isOnly && (
        <button
          onClick={onRemove}
          className="ml-auto opacity-0 group-hover:opacity-100 text-text-3 hover:text-neg text-base leading-none cursor-pointer bg-transparent border-0 px-1 transition-all"
          aria-label="Remove condition"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/ui/ConditionRow.tsx
git commit -m "feat: add ConditionRow with IndSelect/IndParams sub-components"
```

---

## Task 7: RuleCard + CompositeStrategyBuilder

**Files:**
- Create: `components/ui/RuleCard.tsx`
- Create: `components/ui/CompositeStrategyBuilder.tsx`

**Interfaces:**
- Consumes: `SpawnRuleState`, `CompRow`, `Combinator`, `newComp` from `lib/backtest-types`; `ConditionRow` from Task 6
- Produces:
  - `RuleCard({ rule, index, onChange, onRemove })` — single rule card with conditions + EMA trigger
  - `CompositeStrategyBuilder({ rules, onChange })` — list of RuleCards + Add Rule button + JSON preview

- [ ] **Step 1: Create components/ui/RuleCard.tsx**

```tsx
"use client";

import { newComp, type SpawnRuleState, type CompRow, type Combinator } from "@/lib/backtest-types";
import { ConditionRow } from "./ConditionRow";

interface RuleCardProps {
  rule: SpawnRuleState;
  index: number;
  onChange: (r: SpawnRuleState) => void;
  onRemove: () => void;
}

export function RuleCard({ rule, index, onChange, onRemove }: RuleCardProps) {
  const upd = (patch: Partial<SpawnRuleState>) => onChange({ ...rule, ...patch });

  function updComp(id: string, updated: CompRow) {
    upd({ comparisons: rule.comparisons.map(c => c.id === id ? updated : c) });
  }
  function removeComp(id: string) {
    upd({ comparisons: rule.comparisons.filter(c => c.id !== id) });
  }

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden mb-3">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-panel-2 border-b border-border">
        <span className="text-xs font-semibold text-text-3 uppercase tracking-wider">
          Rule {index + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[11px]">Logic</span>
          <select
            className="compact"
            value={rule.combinator}
            onChange={e => upd({ combinator: e.target.value as Combinator })}
          >
            <option>AND</option>
            <option>OR</option>
          </select>
        </div>
        <button
          onClick={onRemove}
          className="ml-auto text-xs text-text-3 hover:text-neg border border-border hover:border-neg/40 px-2.5 py-1 rounded cursor-pointer bg-transparent transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Conditions */}
      <div className="px-4 pt-2 pb-0">
        <div className="text-text-3 text-[11px] uppercase tracking-wider mb-2">Conditions</div>
        {rule.comparisons.map((c, i) => (
          <div key={c.id} className="flex items-start gap-2">
            {/* AND/OR pill connector */}
            {i > 0 ? (
              <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 mt-2.5 shrink-0 w-8 text-center">
                {rule.combinator}
              </span>
            ) : (
              <span className="w-8 shrink-0" />
            )}
            <div className="flex-1">
              <ConditionRow
                row={c}
                onChange={r => updComp(c.id, r)}
                onRemove={() => removeComp(c.id)}
                isOnly={rule.comparisons.length === 1}
              />
            </div>
          </div>
        ))}
        <button
          onClick={() => upd({ comparisons: [...rule.comparisons, newComp()] })}
          className="text-xs text-text-3 hover:text-text-2 border border-border hover:border-border px-3 py-1.5 rounded cursor-pointer bg-transparent transition-colors my-3"
        >
          + Add Condition
        </button>
      </div>

      {/* Trigger footer */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-panel-2 border-t border-border">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Trigger</span>
        <span className="text-text-2 text-xs bg-panel border border-border px-2.5 py-1 rounded">
          EMA Cross
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[10px]">Fast</span>
          <input type="number" value={rule.fast} min={1} className="compact w-14"
            onChange={e => upd({ fast: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[10px]">Slow</span>
          <input type="number" value={rule.slow} min={1} className="compact w-14"
            onChange={e => upd({ slow: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create components/ui/CompositeStrategyBuilder.tsx**

```tsx
"use client";

import { newRule, buildSpawnRules, type SpawnRuleState } from "@/lib/backtest-types";
import { RuleCard } from "./RuleCard";
import { JsonPreview } from "./JsonPreview";

interface CompositeStrategyBuilderProps {
  rules: SpawnRuleState[];
  instrumentId: string;
  onChange: (rules: SpawnRuleState[]) => void;
}

export function CompositeStrategyBuilder({ rules, instrumentId, onChange }: CompositeStrategyBuilderProps) {
  function updRule(id: string, updated: SpawnRuleState) {
    onChange(rules.map(r => r.id === id ? updated : r));
  }
  function removeRule(id: string) {
    onChange(rules.filter(r => r.id !== id));
  }

  return (
    <div className="pt-2 border-t border-border">
      <div className="text-text-3 text-xs mb-4">
        Each rule = condition group (AND/OR) + strategy. Strategy fires when conditions are met. Empty conditions = always active.
      </div>

      {rules.map((r, i) => (
        <RuleCard
          key={r.id}
          rule={r}
          index={i}
          onChange={updated => updRule(r.id, updated)}
          onRemove={() => removeRule(r.id)}
        />
      ))}

      <button
        onClick={() => onChange([...rules, newRule()])}
        className="text-sm text-text-2 hover:text-text-1 border border-border hover:border-text-3 px-4 py-2 rounded-md cursor-pointer bg-transparent transition-colors"
      >
        + Add Rule
      </button>

      {rules.length > 0 && (
        <JsonPreview label="spawn_rules JSON preview" data={buildSpawnRules(rules, instrumentId)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/ui/RuleCard.tsx components/ui/CompositeStrategyBuilder.tsx
git commit -m "feat: add RuleCard and CompositeStrategyBuilder components"
```

---

## Task 8: ChartPanel + CandlestickChart Color Update

**Files:**
- Create: `components/ui/ChartPanel.tsx`
- Modify: `components/CandlestickChart.tsx`

**Interfaces:**
- Consumes: `CandlestickChart` props unchanged; `BarOut`, `TradeRecord` from `lib/api`
- Produces: `ChartPanel({ bars, trades, emaFast?, emaSlow?, symbol, timeframe, loading })` — chart wrapper with header row

- [ ] **Step 1: Update CandlestickChart.tsx colors**

Change only the hardcoded color values and height (logic is untouched):

```tsx
// Line 42-61: replace chart options with:
const chart = createChart(containerRef.current, {
  width: containerRef.current.clientWidth,
  height: 480,  // was 420
  layout: {
    background: { color: "#0F131A" },   // was #0d0d0d → match --color-panel
    textColor: "#5F6B7A",               // was #666 → match --color-text-3
    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: "#151A23" },    // was #1a1a1a → match --color-panel-2
    horzLines: { color: "#151A23" },
  },
  crosshair: {
    vertLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },  // was #ff8c00
    horzLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },
  },
  rightPriceScale: { borderColor: "#242A35" },   // was #2a2a2a
  timeScale: { borderColor: "#242A35", timeVisible: true },
});
```

```tsx
// Line 64-71: candleSeries colors — unchanged (pos/neg already correct tone)
// Just update to match new token values:
const candleSeries = chart.addSeries(CandlestickSeries, {
  upColor:        "#22C55E",   // was #00cc44 → match --color-pos
  downColor:      "#EF4444",   // was #ff3333 → match --color-neg
  borderUpColor:  "#22C55E",
  borderDownColor:"#EF4444",
  wickUpColor:    "#22C55E",
  wickDownColor:  "#EF4444",
});
```

```tsx
// Line 109: fast EMA line color (orange accent)
const s = chart.addSeries(LineSeries, { color: "#FF9F1C", lineWidth: 1, ... });
// Line 114: slow EMA line color (info blue — unchanged)
const s = chart.addSeries(LineSeries, { color: "#3B82F6", lineWidth: 1, ... }); // was #4488ff
```

```tsx
// Line 124: container div
return <div ref={containerRef} className="w-full border border-border rounded-b-lg" />;
```

Full updated CandlestickChart.tsx (complete file):

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import type { BarOut, TradeRecord } from "@/lib/api";

interface CandlestickChartProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
}

function computeEMA(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const result: { time: UTCTimestamp; value: number }[] = [];
  let ema = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  result.push({ time: Math.floor(bars[period - 1].ts_event / 1e9) as UTCTimestamp, value: ema });
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: ema });
  }
  return result;
}

export function CandlestickChart({ bars, trades = [], emaFast, emaSlow }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 480,
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    candleSeries.setData(
      bars.map((b) => ({
        time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    if (trades.length > 0) {
      const markers: SeriesMarker<UTCTimestamp>[] = [];
      for (const t of trades) {
        if (t.entry_ts_ns) {
          markers.push({
            time: Math.floor(t.entry_ts_ns / 1e9) as UTCTimestamp,
            position: "belowBar",
            color: "#22C55E",
            shape: "arrowUp",
            text: `BUY ${t.entry_price.toFixed(2)}`,
          });
        }
        if (t.exit_ts_ns && t.exit_price != null) {
          markers.push({
            time: Math.floor(t.exit_ts_ns / 1e9) as UTCTimestamp,
            position: "aboveBar",
            color: "#EF4444",
            shape: "arrowDown",
            text: `SELL ${t.exit_price.toFixed(2)}`,
          });
        }
      }
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    if (emaFast && emaFast > 0) {
      const fastData = computeEMA(bars, emaFast);
      if (fastData.length) {
        const s = chart.addSeries(LineSeries, { color: "#FF9F1C", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(fastData);
      }
    }
    if (emaSlow && emaSlow > 0) {
      const slowData = computeEMA(bars, emaSlow);
      if (slowData.length) {
        const s = chart.addSeries(LineSeries, { color: "#3B82F6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(slowData);
      }
    }

    return () => { chart.remove(); chartRef.current = null; };
  }, [bars, trades, emaFast, emaSlow]);

  return <div ref={containerRef} className="w-full border border-border rounded-b-lg" />;
}
```

- [ ] **Step 2: Create components/ui/ChartPanel.tsx**

```tsx
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "./EmptyState";
import type { BarOut, TradeRecord } from "@/lib/api";

interface ChartPanelProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
  symbol: string;
  timeframe: string;
  mode?: "single" | "composite";
}

export function ChartPanel({ bars, trades = [], emaFast, emaSlow, symbol, timeframe, mode }: ChartPanelProps) {
  const hasData = bars.length > 0;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-panel-2">
        <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
        <span className="text-text-3 text-xs bg-panel border border-border px-2 py-0.5 rounded">{timeframe}</span>
        {mode === "single" && emaFast && emaSlow && (
          <div className="flex items-center gap-3 ml-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-accent" />
              <span className="text-text-3">EMA {emaFast}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-info" />
              <span className="text-text-3">EMA {emaSlow}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-pos text-sm leading-none">▲</span>
              <span className="text-text-3">Buy</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-neg text-sm leading-none">▼</span>
              <span className="text-text-3">Sell</span>
            </span>
          </div>
        )}
      </div>

      {/* Chart or placeholder */}
      {hasData ? (
        <CandlestickChart bars={bars} trades={trades} emaFast={emaFast} emaSlow={emaSlow} />
      ) : (
        <div className="h-[480px] bg-panel flex items-center justify-center">
          <EmptyState message="Run backtest to see chart" hint="Select symbol, date range, and strategy parameters above" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/CandlestickChart.tsx components/ui/ChartPanel.tsx
git commit -m "feat: add ChartPanel wrapper, update CandlestickChart to design token colors"
```

---

## Task 9: MetricGrid + TradeLogTable

**Files:**
- Create: `components/ui/MetricGrid.tsx`
- Create: `components/ui/TradeLogTable.tsx`

**Interfaces:**
- Consumes: `MetricCard` from Task 4; `TradeRecord`, `BacktestResponse` from `lib/api`
- Produces:
  - `MetricGrid({ result })` — grid of KPI MetricCards; `result` is `BacktestResponse | null`
  - `TradeLogTable({ trades })` — styled table with sticky header, hover rows; `trades` is `TradeRecord[]`

- [ ] **Step 1: Create components/ui/MetricGrid.tsx**

```tsx
import { MetricCard } from "./MetricCard";
import type { BacktestResponse } from "@/lib/api";

interface MetricGridProps {
  result: BacktestResponse | null;
}

function fmt(v: number | null | undefined, fn: (n: number) => string): string {
  return v == null ? "—" : fn(v);
}

function pnlClass(v: number | null | undefined): string {
  return v == null ? "text-text-3" : v >= 0 ? "text-pos" : "text-neg";
}

export function MetricGrid({ result }: MetricGridProps) {
  const metrics = [
    {
      label: "Total PnL",
      value: fmt(result?.total_pnl, n => (n >= 0 ? "+" : "") + n.toFixed(2)),
      delta: fmt(result?.total_pnl_pct, n => (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%"),
      colorClass: pnlClass(result?.total_pnl),
    },
    {
      label: "Sharpe",
      value: fmt(result?.sharpe_ratio, n => n.toFixed(3)),
      colorClass: pnlClass(result?.sharpe_ratio),
    },
    {
      label: "Sortino",
      value: fmt(result?.sortino_ratio, n => n.toFixed(3)),
      colorClass: pnlClass(result?.sortino_ratio),
    },
    {
      label: "Volatility",
      value: fmt(result?.volatility, n => (n * 100).toFixed(2) + "%"),
      colorClass: "text-text-1",
    },
    {
      label: "Max DD",
      value: result?.max_drawdown != null
        ? (result.max_drawdown * 100).toFixed(2) + "%"
        : "—",
      colorClass: result?.max_drawdown != null ? "text-neg" : "text-text-3",
    },
    {
      label: "Beta",
      value: fmt(result?.beta, n => n.toFixed(3)),
      colorClass: result?.beta != null ? "text-text-1" : "text-text-3",
    },
    {
      label: "Win Rate",
      value: fmt(result?.win_rate, n => (n * 100).toFixed(1) + "%"),
      colorClass: pnlClass(result?.win_rate ? result.win_rate - 0.5 : null),
    },
    {
      label: "P/L Ratio",
      value: fmt(result?.profit_loss_ratio, n => n.toFixed(2)),
      colorClass: pnlClass(result?.profit_loss_ratio ? result.profit_loss_ratio - 1 : null),
    },
    {
      label: "Avg Win",
      value: fmt(result?.avg_win, n => n.toFixed(2)),
      colorClass: "text-pos",
    },
    {
      label: "Avg Loss",
      value: fmt(result?.avg_loss, n => n.toFixed(2)),
      colorClass: "text-neg",
    },
    {
      label: "Trades",
      value: result ? String(result.trades.length) : "—",
      colorClass: "text-text-1",
    },
    {
      label: "Bars",
      value: result ? String(result.bar_count) : "—",
      colorClass: "text-text-3",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-4">
      {metrics.map(m => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          delta={m.delta}
          colorClass={m.colorClass}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create components/ui/TradeLogTable.tsx**

```tsx
import { EmptyState } from "./EmptyState";
import type { TradeRecord } from "@/lib/api";

interface TradeLogTableProps {
  trades: TradeRecord[];
}

function pnlClass(v: number | null): string {
  return v == null ? "text-text-3" : v >= 0 ? "text-pos" : "text-neg";
}

const HEADERS = ["#", "Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "Qty", "PnL"];

export function TradeLogTable({ trades }: TradeLogTableProps) {
  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Trade Log</span>
        {trades.length > 0 && (
          <span className="text-text-3 text-[11px]">({trades.length})</span>
        )}
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead className="sticky top-0 z-10 bg-panel-2">
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h}
                  className={[
                    "px-4 py-2.5 text-text-3 text-[11px] font-medium uppercase tracking-wider border-b border-border whitespace-nowrap",
                    ["Entry Price", "Exit Price", "Qty", "PnL"].includes(h)
                      ? "text-right"
                      : "text-left",
                  ].join(" ")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState message="No trades" hint="Run backtest to see trade history" />
                </td>
              </tr>
            ) : trades.map((t, i) => {
              const entryDate = new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10);
              const exitDate = t.exit_ts_ns
                ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10)
                : "—";
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-panel-2 transition-colors">
                  <td className="px-4 py-2.5 text-text-3 font-data text-xs">{i + 1}</td>
                  <td className={`px-4 py-2.5 font-data text-xs font-medium ${t.side === "LONG" ? "text-pos" : "text-warn"}`}>
                    {t.side}
                  </td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs">{entryDate}</td>
                  <td className="px-4 py-2.5 text-text-1 font-data text-xs text-right">{t.entry_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs">{exitDate}</td>
                  <td className="px-4 py-2.5 text-text-1 font-data text-xs text-right">{t.exit_price?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs text-right">{t.qty.toFixed(0)}</td>
                  <td className={`px-4 py-2.5 font-data text-xs font-semibold text-right ${pnlClass(t.pnl)}`}>
                    {t.pnl != null ? (t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(2) : "—"}
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

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/ui/MetricGrid.tsx components/ui/TradeLogTable.tsx
git commit -m "feat: add MetricGrid (KPI cards) and TradeLogTable components"
```

---

## Task 10: Barrel Export

**Files:**
- Create: `components/ui/index.ts`

**Interfaces:**
- Produces: single import point for all ui components

- [ ] **Step 1: Create components/ui/index.ts**

```ts
export { MetricCard } from "./MetricCard";
export { EmptyState } from "./EmptyState";
export { JsonPreview } from "./JsonPreview";
export { StrategyModeTabs } from "./StrategyModeTabs";
export { StrategyControlPanel } from "./StrategyControlPanel";
export { SingleStrategyForm } from "./SingleStrategyForm";
export { ConditionRow } from "./ConditionRow";
export { RuleCard } from "./RuleCard";
export { CompositeStrategyBuilder } from "./CompositeStrategyBuilder";
export { ChartPanel } from "./ChartPanel";
export { MetricGrid } from "./MetricGrid";
export { TradeLogTable } from "./TradeLogTable";
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/ui/index.ts
git commit -m "feat: add barrel export for components/ui"
```

---

## Task 11: Backtest Page Assembly

**Files:**
- Modify: `app/backtest/page.tsx` (full rewrite of presentation layer — business logic preserved)

**Interfaces:**
- Consumes: all components from `@/components/ui`, all types/helpers from `@/lib/backtest-types`, `getBars`, `getBacktest`, `ApiError`, `BarOut`, `BacktestResponse` from `@/lib/api`
- Produces: backtest page with top-control + bottom-analytics layout

- [ ] **Step 1: Replace app/backtest/page.tsx**

Replace the entire file. Business logic (state, `run()`, `buildSpawnRules`) is identical to original; only presentation changes.

```tsx
"use client";

import { useRef, useState } from "react";
import { ApiError, getBars, getBacktest, type BarOut, type BacktestResponse } from "@/lib/api";
import {
  newRule,
  type Mode,
  type SpawnRuleState,
} from "@/lib/backtest-types";
import {
  StrategyModeTabs,
  StrategyControlPanel,
  SingleStrategyForm,
  CompositeStrategyBuilder,
  ChartPanel,
  MetricGrid,
  TradeLogTable,
} from "@/components/ui";

export default function BacktestPage() {
  const [mode, setMode]               = useState<Mode>("single");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]             = useState("2025-06-25");
  const [end, setEnd]                 = useState("2026-06-23");
  const [timeframe, setTimeframe]     = useState("1D");
  const [fast, setFast]               = useState(10);
  const [slow, setSlow]               = useState(20);
  const [benchmarkId, setBenchmarkId] = useState("");
  const [rules, setRules]             = useState<SpawnRuleState[]>([newRule()]);
  const [bars, setBars]               = useState<BarOut[]>([]);
  const [result, setResult]           = useState<BacktestResponse | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Business logic (unchanged from original) ─────────────────────
  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      let strategy: string;
      let strategyParams: Record<string, string>;
      if (mode === "single") {
        strategy = "ema_cross";
        strategyParams = { fast: String(fast), slow: String(slow) };
      } else {
        if (rules.length === 0) { setError("최소 1개 이상의 Rule 필요"); setLoading(false); return; }
        strategy = "gated";
        const { buildSpawnRules } = await import("@/lib/backtest-types");
        strategyParams = { spawn_rules: JSON.stringify(buildSpawnRules(rules, instrumentId)) };
      }
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, timeframe, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, strategyParams, benchmarkId || undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setResult(btRes);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setBars([]); setResult(null);
    } finally { setLoading(false); }
  }

  // ── Layout ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      {/* Page title */}
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Backtest</h1>
        <p className="text-text-3 text-sm mt-0.5">Run and analyze EMA cross strategies with optional gating conditions</p>
      </div>

      {/* ── Top Control Panel ─────────────────────────────────────── */}
      <div className="space-y-3">
        <StrategyModeTabs mode={mode} onChange={setMode} />

        <StrategyControlPanel
          instrumentId={instrumentId} onInstrumentChange={setInstrumentId}
          start={start} end={end} onStartChange={setStart} onEndChange={setEnd}
          timeframe={timeframe} onTimeframeChange={setTimeframe}
          benchmarkId={benchmarkId} onBenchmarkChange={setBenchmarkId}
          onRun={run} loading={loading}
        >
          {mode === "single" && (
            <SingleStrategyForm fast={fast} slow={slow} onFastChange={setFast} onSlowChange={setSlow} />
          )}
          {mode === "composite" && (
            <CompositeStrategyBuilder rules={rules} instrumentId={instrumentId} onChange={setRules} />
          )}
        </StrategyControlPanel>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* ── Bottom Analytics (2-col) ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Chart */}
        <ChartPanel
          bars={bars}
          trades={result?.trades ?? []}
          emaFast={mode === "single" ? fast : undefined}
          emaSlow={mode === "single" ? slow : undefined}
          symbol={instrumentId}
          timeframe={timeframe}
          mode={mode}
        />

        {/* Right: Stats + Trade Log */}
        <div className="space-y-4">
          {/* KPI Metrics */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">Performance</span>
            </div>
            <MetricGrid result={result} />
          </div>

          {/* Trade Log */}
          <TradeLogTable trades={result?.trades ?? []} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Visual smoke test**

```bash
npm run dev
```

Open http://localhost:3000/backtest and verify:
- Mode tabs show "Single Strategy" / "Composite / Gated" as segmented pill control
- Control panel has Symbol, Date, TF buttons, Benchmark select, orange RUN button
- Single mode: Fast/Slow inputs appear below controls
- Composite mode: Rule Builder appears below controls (Add Rule, RuleCards)
- Bottom is 2-col: chart left, KPI + trade log right
- No orange labels anywhere — only the RUN button and active TF button
- Fonts: Inter for labels, JetBrains Mono visible for numeric values

- [ ] **Step 4: Commit**

```bash
git add app/backtest/page.tsx
git commit -m "feat: rebuild backtest page with top-control + bottom-analytics layout"
```

---

## Task 12: Market Page + Existing Component Polish

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/InstrumentSelect.tsx`
- Modify: `components/DateRangePicker.tsx`

**Interfaces:**
- No interface changes — style only

- [ ] **Step 1: Update components/InstrumentSelect.tsx**

```tsx
"use client";

const KNOWN_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
];

interface InstrumentSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function InstrumentSelect({ value, onChange }: InstrumentSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {KNOWN_INSTRUMENTS.map((id) => (
        <option key={id} value={id}>{id}</option>
      ))}
    </select>
  );
}
```

(No style inline — global `select` base styles from globals.css apply.)

- [ ] **Step 2: Update components/DateRangePicker.tsx**

```tsx
"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function DateRangePicker({ start, end, onStartChange, onEndChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={start} onChange={(e) => onStartChange(e.target.value)} />
      <span className="text-text-3">–</span>
      <input type="date" value={end} onChange={(e) => onEndChange(e.target.value)} />
    </div>
  );
}
```

- [ ] **Step 3: Update app/page.tsx (Market Data page)**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import { ApiError, getBars, type BarOut } from "@/lib/api";

export default function MarketPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
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
      const res = await getBars(instrumentId, start, end, undefined, ctrl.signal);
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
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Market Data</h1>
        <p className="text-text-3 text-sm mt-0.5">Price history for instruments in the catalog</p>
      </div>

      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Symbol</span>
            <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
            <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
          </div>
          <button
            onClick={loadBars}
            className="ml-auto px-5 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0"
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {!loading && bars.length > 0 && (
            <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
          )}
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="font-data text-sm text-text-1 font-medium">{instrumentId}</span>
        </div>
        {bars.length > 0 ? (
          <CandlestickChart bars={bars} />
        ) : (
          <div className="h-[480px] flex items-center justify-center">
            <EmptyState message="No chart data" hint="Select a symbol and date range, then click Load" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Full visual smoke test**

```bash
npm run dev
```

Check both pages:
- `/` — Market page: clean control panel, chart panel, no inline styles, no orange labels
- `/backtest` — Backtest: full layout works, run a backtest, verify stats appear in KPI cards, trades in table with hover effect

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/InstrumentSelect.tsx components/DateRangePicker.tsx
git commit -m "feat: apply design system to Market page and shared form components"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| Remove all inline styles | Tasks 1–12 (replaced with Tailwind) |
| body font → Inter/system-ui | Task 2 |
| Numbers → JetBrains Mono | Task 1 (`font-data`), used in MetricCard/TradeLogTable |
| Orange only: active tab, CTA, selected state | Tasks 5, 6 (TF buttons), layout.tsx |
| Color token system (#080A0F palette) | Task 1 |
| Button: 36–40px height, border-radius, hover | Tasks 5, 9, 11 |
| Inputs: 36px height, focus state | Task 1 (globals.css base) |
| StrategyModeTabs → segmented control | Task 5 |
| MetricCard KPI cards | Task 4 |
| ChartPanel with header + legend | Task 8 |
| Chart height 480px (up from 420) | Task 8 |
| RuleCard with pill connector AND/OR | Task 7 |
| ConditionRow compact | Task 6 |
| TradeLogTable: sticky header, hover, right-align, PnL color | Task 9 |
| EmptyState | Task 4 |
| JsonPreview | Task 4 |
| Top-control + bottom-analytics layout | Task 11 |
| Barrel export (components/ui) | Task 10 |
| Types extracted | Task 3 |

**Placeholder scan:** None found.

**Type consistency:** `SpawnRuleState`, `CompRow`, `IndicatorOp`, `Mode` all defined once in `lib/backtest-types.ts` and imported everywhere. `BacktestResponse`, `TradeRecord`, `BarOut` stay in `lib/api.ts` unchanged. `buildSpawnRules` imported from `lib/backtest-types` (lazy import in `run()` avoids SSR issues).
