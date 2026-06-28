# Phase 11: Data Quality Center + Report Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Report Builder that converts Experiments/Strategies/Notebooks to Markdown+PDF, and a Data Quality Center that visualises per-source data coverage and per-instrument missing-bar ratios.

**Architecture:** Pure-frontend. `lib/report-utils.ts` is a set of pure functions (no I/O, no external deps) that serialise localStorage objects to Markdown. `app/report/page.tsx` is a client component that reads localStorage, renders a preview, and uses `navigator.clipboard` + `window.print()` for output. `app/data-quality/page.tsx` is a client component that calls the existing `/bars` FastAPI endpoint to compute per-instrument coverage and shows static metadata for macro/event sources. Both pages are added to `components/NavBar.tsx`.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4 design tokens, vitest + jsdom for tests. No new npm dependencies.

## Global Constraints

- Design tokens only — no hex codes in className, no inline `style={}` except `style={{ width: \`${pct}%\` }}` for data-driven bars and `style={{ height }}` for chart containers
- `bg-accent text-black` — only for primary action buttons (Copy, Print, Check Coverage, Generate)
- Active tabs/filters — `border-accent text-accent bg-accent/10`
- No raw `fetch` in components — use `getBars` from `@/lib/api`
- AbortController pattern: abort→create→run→catch AbortError silently→finally guard→unmount cleanup
- Test file location: `tests/lib/<name>.test.ts`
- NavBar additions: modify `NAV_GROUPS` array in `components/NavBar.tsx`
- Run full test suite after every task: `npm test` from `seokminal-dashboard/`
- Commit after every passing task

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/report-utils.ts` | Create | Pure functions: Experiment/Strategy/Notebook → Markdown string |
| `tests/lib/report-utils.test.ts` | Create | Unit tests for all report-utils functions |
| `app/report/page.tsx` | Create | Report Builder UI: source picker, markdown preview, copy/print |
| `app/data-quality/page.tsx` | Create | Data Quality Center UI: source table + instrument coverage checker |
| `components/NavBar.tsx` | Modify | Add "Report" to Research group, "Data Quality" to Analyze group |
| `docs/progress.md` | Modify | Session handoff notes |
| `docs/roadmap.md` | Modify | Mark Phase 11 complete |

---

### Task 1: `lib/report-utils.ts` + tests

**Files:**
- Create: `lib/report-utils.ts`
- Create: `tests/lib/report-utils.test.ts`

**Interfaces:**
- Consumes: `Experiment` from `@/lib/experiment-storage`, `Strategy`/`StrategyParams` from `@/lib/strategy-storage`, `Notebook`/`NotebookBlock` from `@/lib/notebook-storage`
- Produces:
  - `experimentToMarkdown(exp: Experiment): string`
  - `strategyToMarkdown(strategy: Strategy): string`
  - `notebookToMarkdown(notebook: Notebook): string`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/report-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  experimentToMarkdown,
  strategyToMarkdown,
  notebookToMarkdown,
} from "../../lib/report-utils";
import type { Experiment } from "../../lib/experiment-storage";
import type { Strategy } from "../../lib/strategy-storage";
import type { Notebook } from "../../lib/notebook-storage";

const BASE_EXP: Experiment = {
  id: "exp_1_abc12",
  timestamp: 1750000000000,
  label: "005930.XKRX EMA 10/20",
  notes: "Good result",
  params: {
    strategy: "ema_cross",
    instrumentId: "005930.XKRX",
    start: "2024-01-01",
    end: "2025-01-01",
    timeframe: "1D",
    benchmarkId: "KOSPI.XKRX",
    fast: 10,
    slow: 20,
  },
  metrics: {
    sharpe: 1.42,
    sortino: 2.1,
    maxDrawdown: -0.12,
    winRate: 0.55,
    totalPnlPct: 0.22,
    totalTrades: 43,
    volatility: 0.18,
  },
};

const BASE_STRATEGY: Strategy = {
  id: "strat_1_xyz99",
  name: "EMA Cross 10/20",
  description: "Simple EMA crossover",
  tags: ["ema", "trend"],
  favorite: true,
  archived: false,
  params: { type: "ema_cross", fast: 10, slow: 20 },
  versions: [
    { params: { type: "ema_cross", fast: 5, slow: 15 }, savedAt: 1749000000000, note: "v1" },
  ],
  createdAt: 1749000000000,
  updatedAt: 1750000000000,
};

const BASE_NOTEBOOK: Notebook = {
  id: "nb_1_aaa11",
  title: "My Research Notes",
  tags: ["research", "ema"],
  experimentIds: ["exp_1_abc12"],
  entries: [
    { id: "blk_1", block: { type: "comment", markdown: "# Intro\nThis is a test." } },
    { id: "blk_2", block: { type: "metric", label: "Sharpe", value: 1.42, unit: "" } },
    { id: "blk_3", block: { type: "table", headers: ["Year", "Return"], rows: [["2024", "22%"]] } },
    { id: "blk_4", block: { type: "chart", title: "Equity Curve", data: [] } },
    { id: "blk_5", block: { type: "image", src: "https://example.com/img.png", alt: "Chart" } },
  ],
  createdAt: 1749000000000,
  updatedAt: 1750000000000,
};

describe("experimentToMarkdown", () => {
  it("includes the experiment label as h1", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("# 005930.XKRX EMA 10/20");
  });

  it("includes instrument, start, end from params", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("005930.XKRX");
    expect(md).toContain("2024-01-01");
    expect(md).toContain("2025-01-01");
  });

  it("includes sharpe and winRate metrics", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("1.42");
    expect(md).toContain("0.55");
  });

  it("includes notes when non-empty", () => {
    const md = experimentToMarkdown(BASE_EXP);
    expect(md).toContain("Good result");
  });

  it("handles null metrics gracefully", () => {
    const exp: Experiment = {
      ...BASE_EXP,
      metrics: { ...BASE_EXP.metrics, sharpe: null, sortino: null },
    };
    const md = experimentToMarkdown(exp);
    expect(md).toContain("—");
  });
});

describe("strategyToMarkdown", () => {
  it("includes strategy name as h1", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("# EMA Cross 10/20");
  });

  it("includes description and tags", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("Simple EMA crossover");
    expect(md).toContain("ema");
    expect(md).toContain("trend");
  });

  it("includes EMA params for ema_cross type", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("10");
    expect(md).toContain("20");
  });

  it("includes version count", () => {
    const md = strategyToMarkdown(BASE_STRATEGY);
    expect(md).toContain("1");
  });
});

describe("notebookToMarkdown", () => {
  it("includes notebook title as h1", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("# My Research Notes");
  });

  it("includes tags", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("research");
    expect(md).toContain("ema");
  });

  it("renders comment blocks as raw markdown", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("# Intro");
    expect(md).toContain("This is a test.");
  });

  it("renders metric blocks as bold label: value", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("**Sharpe**");
    expect(md).toContain("1.42");
  });

  it("renders table blocks as markdown table", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("| Year | Return |");
    expect(md).toContain("| 2024 | 22% |");
  });

  it("renders chart block as placeholder text", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("Equity Curve");
  });

  it("renders image blocks as markdown image syntax", () => {
    const md = notebookToMarkdown(BASE_NOTEBOOK);
    expect(md).toContain("![Chart](https://example.com/img.png)");
  });

  it("handles empty notebook (no entries)", () => {
    const nb: Notebook = { ...BASE_NOTEBOOK, entries: [], tags: [], experimentIds: [] };
    const md = notebookToMarkdown(nb);
    expect(md).toContain("# My Research Notes");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test -- tests/lib/report-utils.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '../../lib/report-utils'"

- [ ] **Step 3: Implement `lib/report-utils.ts`**

Create `lib/report-utils.ts`:

```typescript
import type { Experiment } from "@/lib/experiment-storage";
import type { Strategy } from "@/lib/strategy-storage";
import type { Notebook, NotebookBlock } from "@/lib/notebook-storage";

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function experimentToMarkdown(exp: Experiment): string {
  const p = exp.params;
  const m = exp.metrics;
  const lines: string[] = [
    `# ${exp.label}`,
    ``,
    `**Run date:** ${isoDate(exp.timestamp)}`,
    ``,
    `## Parameters`,
    ``,
    `| Key | Value |`,
    `|-----|-------|`,
    `| Instrument | ${p.instrumentId} |`,
    `| Strategy | ${p.strategy} |`,
    `| Start | ${p.start} |`,
    `| End | ${p.end} |`,
    `| Timeframe | ${p.timeframe} |`,
    `| Benchmark | ${p.benchmarkId || "—"} |`,
  ];

  if (p.strategy === "ema_cross") {
    lines.push(`| Fast EMA | ${p.fast ?? "—"} |`);
    lines.push(`| Slow EMA | ${p.slow ?? "—"} |`);
  } else {
    lines.push(`| Rules | ${p.rulesCount ?? "—"} |`);
  }

  lines.push(
    ``,
    `## Metrics`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Sharpe Ratio | ${fmt(m.sharpe, 4)} |`,
    `| Sortino Ratio | ${fmt(m.sortino, 4)} |`,
    `| Max Drawdown | ${fmt(m.maxDrawdown, 4)} |`,
    `| Win Rate | ${fmt(m.winRate, 4)} |`,
    `| Total PnL % | ${fmt(m.totalPnlPct, 4)} |`,
    `| Volatility | ${fmt(m.volatility, 4)} |`,
    `| Total Trades | ${m.totalTrades} |`,
  );

  if (exp.notes) {
    lines.push(``, `## Notes`, ``, exp.notes);
  }

  return lines.join("\n");
}

export function strategyToMarkdown(strategy: Strategy): string {
  const p = strategy.params;
  const lines: string[] = [
    `# ${strategy.name}`,
    ``,
    `**Created:** ${isoDate(strategy.createdAt)}  `,
    `**Updated:** ${isoDate(strategy.updatedAt)}  `,
    `**Tags:** ${strategy.tags.length > 0 ? strategy.tags.join(", ") : "—"}`,
    ``,
  ];

  if (strategy.description) {
    lines.push(strategy.description, ``);
  }

  lines.push(`## Parameters`, ``);

  if (p.type === "ema_cross") {
    lines.push(
      `| Key | Value |`,
      `|-----|-------|`,
      `| Type | EMA Cross |`,
      `| Fast EMA | ${p.fast} |`,
      `| Slow EMA | ${p.slow} |`,
    );
  } else {
    lines.push(
      `| Key | Value |`,
      `|-----|-------|`,
      `| Type | Gated |`,
      `| Rules | ${p.rules.length} |`,
    );
  }

  lines.push(
    ``,
    `## Version History`,
    ``,
    `${strategy.versions.length} saved version${strategy.versions.length !== 1 ? "s" : ""}.`,
  );

  if (strategy.versions.length > 0) {
    lines.push(``, `| # | Date | Note |`, `|---|------|------|`);
    strategy.versions.forEach((v, i) => {
      lines.push(`| ${i + 1} | ${isoDate(v.savedAt)} | ${v.note || "—"} |`);
    });
  }

  return lines.join("\n");
}

function blockToMarkdown(block: NotebookBlock): string {
  switch (block.type) {
    case "comment":
      return block.markdown;
    case "metric": {
      const val = block.value !== null ? `${block.value}${block.unit ? " " + block.unit : ""}` : "—";
      return `**${block.label}**: ${val}`;
    }
    case "table": {
      const header = `| ${block.headers.join(" | ")} |`;
      const sep = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map(r => `| ${r.map(c => String(c ?? "")).join(" | ")} |`).join("\n");
      return [header, sep, rows].join("\n");
    }
    case "chart":
      return `_[Chart: ${block.title}]_`;
    case "image":
      return `![${block.alt}](${block.src})`;
  }
}

export function notebookToMarkdown(notebook: Notebook): string {
  const lines: string[] = [
    `# ${notebook.title}`,
    ``,
    `**Tags:** ${notebook.tags.length > 0 ? notebook.tags.join(", ") : "—"}  `,
    `**Linked Experiments:** ${notebook.experimentIds.length > 0 ? notebook.experimentIds.join(", ") : "—"}`,
    ``,
    `---`,
    ``,
  ];

  for (const entry of notebook.entries) {
    lines.push(blockToMarkdown(entry.block), ``);
  }

  return lines.join("\n").trimEnd();
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test -- tests/lib/report-utils.test.ts 2>&1 | tail -20
```

Expected: all 16 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -10
```

Expected: 114 passing (98 existing + 16 new).

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add lib/report-utils.ts tests/lib/report-utils.test.ts && git commit -m "feat: add report-utils — Experiment/Strategy/Notebook to Markdown"
```

---

### Task 2: `app/report/page.tsx` + NavBar update

**Files:**
- Create: `app/report/page.tsx`
- Modify: `components/NavBar.tsx`

**Interfaces:**
- Consumes:
  - `experimentToMarkdown`, `strategyToMarkdown`, `notebookToMarkdown` from `@/lib/report-utils`
  - `getExperiments` from `@/lib/experiment-storage`
  - `getStrategies` from `@/lib/strategy-storage`
  - `getNotebooks` from `@/lib/notebook-storage`
- Produces: `/report` route accessible from Research nav group

- [ ] **Step 1: Create `app/report/page.tsx`**

```tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getExperiments, type Experiment } from "@/lib/experiment-storage";
import { getStrategies, type Strategy } from "@/lib/strategy-storage";
import { getNotebooks, type Notebook } from "@/lib/notebook-storage";
import {
  experimentToMarkdown,
  strategyToMarkdown,
  notebookToMarkdown,
} from "@/lib/report-utils";

type SourceType = "experiment" | "strategy" | "notebook";

export default function ReportPage() {
  const [sourceType, setSourceType] = useState<SourceType>("experiment");
  const [selectedId, setSelectedId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const experiments = useMemo(() => getExperiments(), []);
  const strategies = useMemo(() => getStrategies(), []);
  const notebooks = useMemo(() => getNotebooks(), []);

  // Reset selection when source type changes
  useEffect(() => {
    setSelectedId("");
    setCopied(false);
  }, [sourceType]);

  const items = useMemo(() => {
    if (sourceType === "experiment") return experiments.map(e => ({ id: e.id, label: e.label }));
    if (sourceType === "strategy")  return strategies.map(s => ({ id: s.id, label: s.name }));
    return notebooks.map(n => ({ id: n.id, label: n.title }));
  }, [sourceType, experiments, strategies, notebooks]);

  const markdown = useMemo((): string => {
    if (!selectedId) return "";
    if (sourceType === "experiment") {
      const exp = experiments.find((e: Experiment) => e.id === selectedId);
      return exp ? experimentToMarkdown(exp) : "";
    }
    if (sourceType === "strategy") {
      const strat = strategies.find((s: Strategy) => s.id === selectedId);
      return strat ? strategyToMarkdown(strat) : "";
    }
    const nb = notebooks.find((n: Notebook) => n.id === selectedId);
    return nb ? notebookToMarkdown(nb) : "";
  }, [selectedId, sourceType, experiments, strategies, notebooks]);

  const copy = useCallback(async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  const print = useCallback(() => {
    if (!markdown) return;
    window.print();
  }, [markdown]);

  const SOURCE_TYPES: { value: SourceType; label: string }[] = [
    { value: "experiment", label: "Experiment" },
    { value: "strategy",   label: "Strategy" },
    { value: "notebook",   label: "Notebook" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Report Builder</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Export research objects as Markdown or PDF.
        </p>
      </div>

      {/* Source picker */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Source Type</label>
          <div className="flex gap-1">
            {SOURCE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSourceType(t.value)}
                className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                  sourceType === t.value
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-3 hover:text-text-2 bg-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Select Item</label>
          {items.length === 0 ? (
            <p className="text-text-3 text-xs py-1">
              No {sourceType}s saved yet.
            </p>
          ) : (
            <select
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setCopied(false); }}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent w-full max-w-sm"
            >
              <option value="">— choose —</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          )}
        </div>

        {markdown && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={copy}
              className="h-8 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
            >
              {copied ? "Copied!" : "Copy Markdown"}
            </button>
            <button
              onClick={print}
              className="h-8 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
            >
              Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      {markdown ? (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Markdown Preview</span>
            <span className="text-text-3 text-[11px] font-data">{markdown.length} chars</span>
          </div>
          <pre className="p-4 text-text-2 text-xs font-data leading-relaxed overflow-auto max-h-[600px] whitespace-pre-wrap">
            {markdown}
          </pre>
        </div>
      ) : (
        <div className="text-center py-12 text-text-3 text-sm">
          Select a source above to preview the report.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Report" to Research group in `components/NavBar.tsx`**

In `components/NavBar.tsx`, find the Research group items array and add `{ href: "/report", label: "Report" }`:

```typescript
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
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -10
```

Expected: 114 passing (same count — no new tests for the page).

- [ ] **Step 4: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add app/report/page.tsx components/NavBar.tsx && git commit -m "feat: add Report Builder page + nav"
```

---

### Task 3: `app/data-quality/page.tsx` + NavBar update + docs

**Files:**
- Create: `app/data-quality/page.tsx`
- Modify: `components/NavBar.tsx`
- Modify: `docs/progress.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: `getBars` from `@/lib/api`
- Produces: `/data-quality` route accessible from Analyze nav group

- [ ] **Step 1: Create `app/data-quality/page.tsx`**

```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getBars, ApiError } from "@/lib/api";

interface SourceMeta {
  source: string;
  type: string;
  coverageFrom: string;
  coverageTo: string;
  updateFreq: string;
  corpActions: string;
  notes: string;
}

const STATIC_SOURCES: SourceMeta[] = [
  {
    source: "KIS (KRX)",
    type: "Price / OHLCV",
    coverageFrom: "2020-01-01",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "No",
    notes: "Korean equities. Requires KIS token.",
  },
  {
    source: "IB (US)",
    type: "Price / OHLCV",
    coverageFrom: "2020-01-01",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "No",
    notes: "US equities via Interactive Brokers.",
  },
  {
    source: "FRED",
    type: "Macro",
    coverageFrom: "1960+",
    coverageTo: "Present",
    updateFreq: "Monthly / Weekly",
    corpActions: "N/A",
    notes: "14 US macro series.",
  },
  {
    source: "ECOS",
    type: "Macro",
    coverageFrom: "1960+",
    coverageTo: "Present",
    updateFreq: "Monthly",
    corpActions: "N/A",
    notes: "14 Korean macro series (Bank of Korea).",
  },
  {
    source: "SEC EDGAR",
    type: "Fundamentals",
    coverageFrom: "2000+",
    coverageTo: "Present",
    updateFreq: "Annual / Quarterly",
    corpActions: "N/A",
    notes: "US company XBRL filings. Free, no key.",
  },
  {
    source: "FSC (Corp Finance)",
    type: "Fundamentals",
    coverageFrom: "2015+",
    coverageTo: "Present",
    updateFreq: "Annual",
    corpActions: "N/A",
    notes: "Korean corp finance via 금융위원회. crno required.",
  },
  {
    source: "KSD",
    type: "Corporate Events",
    coverageFrom: "Rolling 30d",
    coverageTo: "Present",
    updateFreq: "Daily",
    corpActions: "N/A",
    notes: "Dividend, rights schedule, borrow rank.",
  },
  {
    source: "KRX OpenAPI",
    type: "Market Data",
    coverageFrom: "—",
    coverageTo: "—",
    updateFreq: "Daily",
    corpActions: "N/A",
    notes: "KRX listing, index data. Requires API key approval.",
  },
];

interface CoverageResult {
  instrumentId: string;
  barCount: number;
  firstDate: string | null;
  lastDate: string | null;
  expectedBars: number;
  missingPct: number;
  error: string | null;
}

const COVERAGE_START = "2020-01-01";
const COVERAGE_END = new Date().toISOString().slice(0, 10);
const EXPECTED_BARS = 1300; // ~252 trading days * ~5 years

function calcExpected(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const years = ms / (365.25 * 24 * 3600 * 1000);
  return Math.round(years * 252);
}

export default function DataQualityPage() {
  const [instrumentsInput, setInstrumentsInput] = useState("005930.XKRX, AAPL.NASDAQ");
  const [results, setResults] = useState<CoverageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const check = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const ids = instrumentsInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (ids.length === 0) return;

    setLoading(true);
    setChecked(false);
    setResults([]);

    const expected = calcExpected(COVERAGE_START, COVERAGE_END);

    const settled = await Promise.allSettled(
      ids.map(id => getBars(id, COVERAGE_START, COVERAGE_END, undefined, ctrl.signal))
    );

    if (ctrl.signal.aborted) return;

    const rows: CoverageResult[] = settled.map((r, i) => {
      const id = ids[i];
      if (r.status === "rejected") {
        const err = r.reason;
        return {
          instrumentId: id,
          barCount: 0,
          firstDate: null,
          lastDate: null,
          expectedBars: expected,
          missingPct: 100,
          error: err instanceof ApiError ? err.message : "Failed",
        };
      }
      const bars = r.value.bars;
      const firstDate = bars.length > 0
        ? new Date(Math.floor(bars[0].ts_event / 1e6)).toISOString().slice(0, 10)
        : null;
      const lastDate = bars.length > 0
        ? new Date(Math.floor(bars[bars.length - 1].ts_event / 1e6)).toISOString().slice(0, 10)
        : null;
      const missing = Math.max(0, expected - bars.length);
      const missingPct = expected > 0 ? (missing / expected) * 100 : 0;
      return {
        instrumentId: id,
        barCount: bars.length,
        firstDate,
        lastDate,
        expectedBars: expected,
        missingPct,
        error: null,
      };
    });

    setResults(rows);
    setChecked(true);
    setLoading(false);
  }, [instrumentsInput]);

  function missingColor(pct: number): string {
    if (pct === 0) return "bg-pos";
    if (pct < 10) return "bg-warn";
    return "bg-neg";
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Data Quality Center</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Source metadata and per-instrument bar coverage.
        </p>
      </div>

      {/* Source metadata table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Data Sources</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["Source", "Type", "From", "To", "Freq", "Corp Actions", "Notes"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-text-3 text-[10px] uppercase tracking-wider font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STATIC_SOURCES.map((s, i) => (
                <tr
                  key={s.source}
                  className={`border-b border-border/50 ${i % 2 === 0 ? "bg-transparent" : "bg-panel-2/30"}`}
                >
                  <td className="px-4 py-2.5 text-text-1 font-medium whitespace-nowrap">{s.source}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.type}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data whitespace-nowrap">{s.coverageFrom}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data whitespace-nowrap">{s.coverageTo}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.updateFreq}</td>
                  <td className="px-4 py-2.5 text-text-2 whitespace-nowrap">{s.corpActions}</td>
                  <td className="px-4 py-2.5 text-text-3">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument coverage checker */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">
            Instrument Coverage Check
          </label>
          <p className="text-text-3 text-[11px]">
            Checks {COVERAGE_START} → {COVERAGE_END}. Expected ~{calcExpected(COVERAGE_START, COVERAGE_END)} trading days.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1 flex-1 min-w-[260px]">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">
              Instrument IDs (comma-separated)
            </label>
            <input
              value={instrumentsInput}
              onChange={e => setInstrumentsInput(e.target.value)}
              placeholder="005930.XKRX, AAPL.NASDAQ"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-full"
            />
          </div>
          <button
            onClick={check}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Check Coverage"}
          </button>
        </div>
      </div>

      {checked && results.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Coverage Results</span>
          </div>
          <div className="divide-y divide-border/50">
            {results.map(r => (
              <div key={r.instrumentId} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-text-1 text-xs font-data font-medium">{r.instrumentId}</span>
                  {r.error ? (
                    <span className="text-neg text-xs">{r.error}</span>
                  ) : (
                    <div className="flex gap-4 text-xs font-data text-text-3 flex-wrap">
                      <span><span className="text-text-2">{r.barCount}</span> bars</span>
                      <span>Expected <span className="text-text-2">{r.expectedBars}</span></span>
                      <span>
                        Missing{" "}
                        <span className={r.missingPct === 0 ? "text-pos" : r.missingPct < 10 ? "text-warn" : "text-neg"}>
                          {r.missingPct.toFixed(1)}%
                        </span>
                      </span>
                      {r.firstDate && (
                        <span>{r.firstDate} → {r.lastDate}</span>
                      )}
                    </div>
                  )}
                </div>
                {!r.error && (
                  <div className="h-2 bg-panel-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${missingColor(r.missingPct)}`}
                      style={{ width: `${Math.min(r.missingPct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!checked && !loading && (
        <div className="text-center py-8 text-text-3 text-sm">
          Enter instrument IDs and click Check Coverage to audit bar data completeness.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Data Quality" to Analyze group in `components/NavBar.tsx`**

Find the Analyze group and add `{ href: "/data-quality", label: "Data Quality" }`:

```typescript
{
  label: "Analyze",
  items: [
    { href: "/correlation",  label: "Correlation" },
    { href: "/event-study",  label: "Event Study" },
    { href: "/rolling",      label: "Rolling" },
    { href: "/factor",       label: "Factor" },
    { href: "/data-quality", label: "Data Quality" },
  ],
},
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test 2>&1 | tail -10
```

Expected: 114 passing.

- [ ] **Step 4: Update `docs/progress.md`**

Prepend to `seokminal-dashboard/docs/progress.md`:

```markdown
### Phase 11 — Data Quality Center + Report Builder (2026-06-28)

**S-13 Data Quality Center:**
- `app/data-quality/page.tsx` — static source metadata table (8 sources) + instrument bar coverage checker
  - Calls `getBars` for each instrument ID, computes missing bar % vs expected (~252/yr)
  - div-based missing ratio bar (bg-pos/warn/neg), AbortController cleanup

**S-14 Report Builder:**
- `lib/report-utils.ts` — `experimentToMarkdown()`, `strategyToMarkdown()`, `notebookToMarkdown()` (pure, no deps)
- `tests/lib/report-utils.test.ts` — 16 tests
- `app/report/page.tsx` — source type picker, item selector from localStorage, markdown preview, Copy + Print/PDF

**Nav additions:**
- Research group: Report
- Analyze group: Data Quality

**Tests:** 114 passing (98 existing + 16 report-utils)
```

- [ ] **Step 5: Update `docs/roadmap.md`**

Move Phase 11 row in the completed table and remove it from "남은 Phase":

In the completed phase table, add:
```markdown
| 11 | Data Quality Center + Report Builder | `app/data-quality/page.tsx`, `app/report/page.tsx`, `lib/report-utils.ts` | — |
```

Remove the entire `### Phase 11: Data Quality Center + Report Builder (S-13 + S-14)` section from "남은 Phase".

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && git add app/data-quality/page.tsx components/NavBar.tsx docs/progress.md docs/roadmap.md && git commit -m "feat: add Data Quality Center + update nav and docs"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| `lib/report-utils.ts` — Experiment/Strategy/Notebook → Markdown | Task 1 |
| `tests/lib/report-utils.test.ts` | Task 1 |
| `app/report/page.tsx` — source picker, preview, Markdown copy, HTML, print→PDF | Task 2 |
| Nav: Report in Research group | Task 2 |
| `app/data-quality/page.tsx` — source metadata table | Task 3 |
| Coverage check via `/bars` | Task 3 |
| Missing ratio visualization (div-based bar) | Task 3 |
| Nav: Data Quality in Analyze group | Task 3 |
| docs update | Task 3 |

### Placeholder Scan
None. All steps include complete code.

### Type Consistency
- `Experiment`, `Strategy`, `Notebook` types imported from their respective storage modules — matches exact interfaces.
- `getBars` imported from `@/lib/api` — matches existing signature `getBars(id, start, end, timeframe?, signal?)`.
- `ts_event` on `BarOut` is nanoseconds — divided by `1e6` to get milliseconds for `new Date()`. ✓
- `missingColor()` returns Tailwind class strings — `bg-pos`, `bg-warn`, `bg-neg` are valid design tokens. ✓
