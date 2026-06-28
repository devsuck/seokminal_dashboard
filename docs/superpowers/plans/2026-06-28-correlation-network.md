# Correlation Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive correlation network graph that visualizes pairwise return correlations between instruments as a D3.js force-directed graph with threshold filtering.

**Architecture:** Three tasks in sequence: (1) add `getCorrelation()` to `lib/api.ts` with tests, (2) implement the D3 force graph component, (3) assemble the `/correlation` page with controls and update the nav. The backend `/correlation` endpoint already exists — it accepts `instrument_ids` (comma-separated), `start`, `end` and returns `{ pairs: [{a, b, correlation}] }` with one entry per unique pair (no self-pairs, no duplicates). D3 v7 is a new dependency.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, D3 v7 (`npm install d3 @types/d3`), vitest/jsdom (tests for API function only — D3 DOM manipulation is not unit-testable in jsdom).

## Global Constraints

- `"use client"` ONLY on components/pages that use hooks/browser APIs
- CSS tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY on primary action buttons (Run) — NOT on threshold display or legend
- Inline styles: forbidden — **EXCEPTION:** D3 SVG attribute assignments (`.attr("stroke", ...)`, `.attr("fill", ...)` in JS objects) are accepted data-viz exceptions, identical to the lightweight-charts exception
- Hardcoded hex in D3 JS: ACCEPTED EXCEPTION (D3 requires hex/rgb for SVG attributes)
- No raw `fetch()` — add `getCorrelation()` to `lib/api.ts` and call it from there
- API base URL: `process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"` (copy pattern from existing functions)
- `instrument_ids` query param: comma-joined string (e.g. `"AAPL.NASDAQ,005930.XKRX"`)
- Threshold default: `0.5`; range `[0.0, 1.0]`; step `0.05`
- Node color by venue suffix: `.XKRX` → `#FF9F1C`; `.NASDAQ`/`.NYSE` → `#3B82F6`; other → `#6B7280`
- Edge color: positive correlation → `#22C55E`; negative → `#EF4444`
- Existing 62 tests must pass after every task

## File Map

**Created:**
- `tests/lib/api-correlation.test.ts`
- `components/network/CorrelationNetwork.tsx`
- `app/correlation/page.tsx`

**Modified:**
- `lib/api.ts` — add `CorrelationPair`, `CorrelationResponse`, `getCorrelation`
- `app/layout.tsx` — add Correlation nav item between Research and Bots

---

### Task 1: getCorrelation in lib/api.ts + tests

**Files:**
- Modify: `lib/api.ts`
- Create: `tests/lib/api-correlation.test.ts`

**Interfaces — Produces (Task 3 depends on these exact names):**
```typescript
export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
}

export interface CorrelationResponse {
  pairs: CorrelationPair[];
}

export async function getCorrelation(
  instrumentIds: string[],
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CorrelationResponse>
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/api-correlation.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCorrelation, ApiError } from "../../lib/api";

const MOCK_PAIRS = [
  { a: "AAPL.NASDAQ", b: "MSFT.NASDAQ", correlation: 0.82 },
  { a: "AAPL.NASDAQ", b: "005930.XKRX", correlation: -0.21 },
];

describe("getCorrelation", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: MOCK_PAIRS }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns pairs from API", async () => {
    const result = await getCorrelation(
      ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"],
      "2025-01-01",
      "2026-01-01",
    );
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs[0].correlation).toBe(0.82);
    expect(result.pairs[1].a).toBe("AAPL.NASDAQ");
  });

  it("joins instrument_ids with comma in URL", async () => {
    await getCorrelation(
      ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"],
      "2025-01-01",
      "2026-01-01",
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("instrument_ids=AAPL.NASDAQ%2CMSFT.NASDAQ%2C005930.XKRX");
    expect(url).toContain("start=2025-01-01");
    expect(url).toContain("end=2026-01-01");
  });

  it("passes signal to fetch", async () => {
    const ctrl = new AbortController();
    await getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01", ctrl.signal);
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(opts?.signal).toBe(ctrl.signal);
  });

  it("throws ApiError on 400 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "no bars found for AAPL.NASDAQ" }),
    } as Response);
    await expect(
      getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01"),
    ).rejects.toThrow("no bars found for AAPL.NASDAQ");
  });

  it("throws ApiError on 500 response using statusText fallback", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);
    await expect(
      getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01"),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/api-correlation.test.ts
```

Expected: FAIL — "getCorrelation is not a function" (or "not exported")

- [ ] **Step 3: Add getCorrelation to lib/api.ts**

Add at the end of `lib/api.ts` (after the KSD section, before the Bot section — or at the very end):
```typescript
// ── Correlation ───────────────────────────────────────────────────────────────

export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
}

export interface CorrelationResponse {
  pairs: CorrelationPair[];
}

export async function getCorrelation(
  instrumentIds: string[],
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CorrelationResponse> {
  const params = new URLSearchParams({
    instrument_ids: instrumentIds.join(","),
    start,
    end,
  });
  return handleResponse<CorrelationResponse>(
    await fetch(`${API_URL}/correlation?${params}`, { signal }),
  );
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/api-correlation.test.ts
```

Expected: 5/5 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: 67 tests pass (62 existing + 5 new)

- [ ] **Step 6: Commit**

```bash
git add lib/api.ts tests/lib/api-correlation.test.ts
git commit -m "feat: add getCorrelation API function with tests"
```

---

### Task 2: CorrelationNetwork D3 component

**Files:**
- Create: `components/network/CorrelationNetwork.tsx`

**Interfaces — Consumes (from Task 1):**
```typescript
import type { CorrelationPair } from "@/lib/api";
```

**Interfaces — Produces (Task 3 depends on these exact prop names):**
```typescript
interface CorrelationNetworkProps {
  pairs: CorrelationPair[];
  threshold: number;          // 0.0–1.0, pairs with |correlation| < threshold hidden
  width?: number;             // default 900
  height?: number;            // default 550
}
export function CorrelationNetwork(props: CorrelationNetworkProps): React.ReactElement
```

No unit tests (D3 DOM manipulation requires a real browser; jsdom lacks SVGElement methods).

- [ ] **Step 1: Install D3**

```bash
npm install d3 @types/d3
```

Verify install:
```bash
npm list d3
```
Expected: `d3@7.x.x`

- [ ] **Step 2: Create components/network/ directory and CorrelationNetwork.tsx**

```bash
mkdir -p components/network
```

Create `components/network/CorrelationNetwork.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { CorrelationPair } from "@/lib/api";

interface CorrelationNetworkProps {
  pairs: CorrelationPair[];
  threshold: number;
  width?: number;
  height?: number;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  correlation: number;
}

function nodeColor(instrumentId: string): string {
  const venue = instrumentId.split(".").pop() ?? "";
  if (venue === "XKRX") return "#FF9F1C";
  if (venue === "NASDAQ" || venue === "NYSE") return "#3B82F6";
  return "#6B7280";
}

function edgeColor(correlation: number): string {
  return correlation >= 0 ? "#22C55E" : "#EF4444";
}

export function CorrelationNetwork({
  pairs,
  threshold,
  width = 900,
  height = 550,
}: CorrelationNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const filtered = pairs.filter(p => Math.abs(p.correlation) >= threshold);

    const instrumentSet = new Set<string>();
    filtered.forEach(p => {
      instrumentSet.add(p.a);
      instrumentSet.add(p.b);
    });

    const nodes: NetworkNode[] = Array.from(instrumentSet).map(id => ({ id }));
    const links: NetworkLink[] = filtered.map(p => ({
      source: p.a,
      target: p.b,
      correlation: p.correlation,
    }));

    if (nodes.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "13px")
        .text("No pairs above threshold — lower the threshold or add more instruments");
      return;
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id(d => d.id)
          .distance(130),
      )
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(26));

    const linkGroup = svg.append("g").attr("class", "links");
    const linkEl = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => edgeColor(d.correlation))
      .attr("stroke-opacity", d => 0.3 + Math.abs(d.correlation) * 0.7)
      .attr("stroke-width", d => 1 + Math.abs(d.correlation) * 4);

    const linkLabelEl = svg
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "#6B7280")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .text(d => d.correlation.toFixed(2));

    const nodeEl = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 20)
      .attr("fill", d => nodeColor(d.id))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#0F131A")
      .attr("stroke-width", 2)
      .attr("cursor", "grab")
      .call(
        d3
          .drag<SVGCircleElement, NetworkNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const labelEl = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("fill", "#F9FAFB")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("pointer-events", "none")
      .text(d => d.id.split(".")[0]);

    simulation.on("tick", () => {
      linkEl
        .attr("x1", d => (d.source as NetworkNode).x ?? 0)
        .attr("y1", d => (d.source as NetworkNode).y ?? 0)
        .attr("x2", d => (d.target as NetworkNode).x ?? 0)
        .attr("y2", d => (d.target as NetworkNode).y ?? 0);

      linkLabelEl
        .attr(
          "x",
          d =>
            (((d.source as NetworkNode).x ?? 0) +
              ((d.target as NetworkNode).x ?? 0)) /
            2,
        )
        .attr(
          "y",
          d =>
            (((d.source as NetworkNode).y ?? 0) +
              ((d.target as NetworkNode).y ?? 0)) /
            2,
        );

      nodeEl.attr("cx", d => d.x ?? 0).attr("cy", d => d.y ?? 0);
      labelEl.attr("x", d => d.x ?? 0).attr("y", d => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [pairs, threshold, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full rounded-lg"
    />
  );
}
```

- [ ] **Step 3: Run full suite to confirm no regressions**

```bash
npm test
```

Expected: 67 tests pass (no new tests for this component — D3 DOM not testable in jsdom)

- [ ] **Step 4: Commit**

```bash
git add components/network/CorrelationNetwork.tsx package.json package-lock.json
git commit -m "feat: add D3 force-directed CorrelationNetwork component"
```

---

### Task 3: /correlation page + nav + progress.md

**Files:**
- Create: `app/correlation/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces — Consumes (from Tasks 1 + 2):**
```typescript
import { getCorrelation, ApiError, type CorrelationPair } from "@/lib/api";
import { CorrelationNetwork } from "@/components/network/CorrelationNetwork";
```

No new tests (UI page).

- [ ] **Step 1: Read app/layout.tsx before editing**

Read the file to see current NAV_ITEMS. Current nav (from prior phases):
```typescript
const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/market",      label: "Market" },
  { href: "/backtest",    label: "Backtest" },
  { href: "/experiments", label: "Experiments" },
  { href: "/strategies",  label: "Strategies" },
  { href: "/notebooks",   label: "Notebooks" },
  { href: "/quant",       label: "Research" },
  { href: "/bots",        label: "Bots" },
  { href: "/ai-trader",   label: "AI Trader" },
];
```

Add `{ href: "/correlation", label: "Correlation" }` between Research and Bots.

- [ ] **Step 2: Update app/layout.tsx**

Change `NAV_ITEMS` to:
```typescript
const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/market",       label: "Market" },
  { href: "/backtest",     label: "Backtest" },
  { href: "/experiments",  label: "Experiments" },
  { href: "/strategies",   label: "Strategies" },
  { href: "/notebooks",    label: "Notebooks" },
  { href: "/quant",        label: "Research" },
  { href: "/correlation",  label: "Correlation" },   // NEW
  { href: "/bots",         label: "Bots" },
  { href: "/ai-trader",    label: "AI Trader" },
];
```

- [ ] **Step 3: Create app/correlation/page.tsx**

Create `app/correlation/page.tsx`:
```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getCorrelation, ApiError, type CorrelationPair } from "@/lib/api";
import { CorrelationNetwork } from "@/components/network/CorrelationNetwork";

const DEFAULT_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
  "035420.XKRX",
].join(", ");

const DEFAULT_START = "2024-01-01";
const DEFAULT_END = "2026-01-01";

export default function CorrelationPage() {
  const [instrumentsText, setInstrumentsText] = useState(DEFAULT_INSTRUMENTS);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [threshold, setThreshold] = useState(0.5);
  const [pairs, setPairs] = useState<CorrelationPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const ids = instrumentsText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length < 2) {
      setError("Enter at least 2 instrument IDs (comma-separated)");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setPairs([]);
    try {
      const res = await getCorrelation(ids, start, end, ctrl.signal);
      setPairs(res.pairs);
      setRan(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch correlation data");
    } finally {
      setLoading(false);
    }
  }, [instrumentsText, start, end]);

  const positiveCount = pairs.filter(p => p.correlation >= threshold).length;
  const negativeCount = pairs.filter(p => p.correlation <= -threshold).length;
  const hiddenCount = pairs.filter(p => Math.abs(p.correlation) < threshold).length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">
            Correlation Network
          </h1>
          <p className="text-text-3 text-sm mt-0.5">
            Pairwise return correlations as a force-directed graph. Drag nodes to explore.
          </p>
        </div>
        <Link
          href="/quant"
          className="text-text-3 hover:text-accent text-xs no-underline transition-colors"
        >
          ← Research
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Instruments */}
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">
            Instruments (comma-separated)
          </label>
          <textarea
            rows={2}
            value={instrumentsText}
            onChange={e => setInstrumentsText(e.target.value)}
            placeholder="AAPL.NASDAQ, MSFT.NASDAQ, 005930.XKRX, ..."
            className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data"
          />
        </div>

        {/* Date range */}
        <div className="flex gap-3 flex-wrap">
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
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Computing…" : "Run"}
            </button>
          </div>
        </div>

        {/* Threshold slider */}
        <div className="flex items-center gap-3">
          <label className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">
            Min |correlation|
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="flex-1 accent-[#FF9F1C]"
          />
          <span className="text-text-2 text-xs font-data w-8 text-right">
            {threshold.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Stats */}
      {ran && pairs.length > 0 && (
        <div className="flex gap-4 flex-wrap text-xs">
          <span className="text-text-3 font-data">
            <span className="text-text-2">{pairs.length}</span> total pairs
          </span>
          <span className="text-text-3 font-data">
            <span className="text-pos">{positiveCount}</span> positive ≥ {threshold.toFixed(2)}
          </span>
          <span className="text-text-3 font-data">
            <span className="text-neg">{negativeCount}</span> negative ≤ −{threshold.toFixed(2)}
          </span>
          {hiddenCount > 0 && (
            <span className="text-text-3 font-data">
              <span className="text-text-3">{hiddenCount}</span> hidden (below threshold)
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      {ran && (
        <div className="flex gap-4 flex-wrap text-[10px] text-text-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#FF9F1C] shrink-0" />
            Korean (XKRX)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#3B82F6] shrink-0" />
            US (NASDAQ/NYSE)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#6B7280] shrink-0" />
            Other
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-[#22C55E] shrink-0" />
            Positive correlation
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-[#EF4444] shrink-0" />
            Negative correlation
          </div>
        </div>
      )}

      {/* Network */}
      {ran && (
        <div className="bg-bg border border-border rounded-lg overflow-hidden">
          <CorrelationNetwork pairs={pairs} threshold={threshold} height={560} />
        </div>
      )}

      {/* Correlation table */}
      {ran && pairs.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              All Pairs ({pairs.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Instrument A", "Instrument B", "Correlation"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-text-3 font-normal uppercase tracking-wider text-[10px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pairs]
                  .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
                  .map((p, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-1.5 text-text-2 font-data">{p.a}</td>
                      <td className="px-4 py-1.5 text-text-2 font-data">{p.b}</td>
                      <td
                        className={`px-4 py-1.5 font-data font-semibold ${
                          p.correlation >= 0.5
                            ? "text-pos"
                            : p.correlation <= -0.5
                            ? "text-neg"
                            : "text-text-2"
                        }`}
                      >
                        {p.correlation.toFixed(4)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!ran && !loading && (
        <div className="text-center py-12 text-text-3 text-sm">
          Enter instruments and click Run to generate the correlation network.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```

Expected: 67 tests pass

- [ ] **Step 5: Update docs/progress.md**

Prepend this block at the top of `docs/progress.md`:
```markdown
### Correlation Network (2026-06-28)

- `lib/api.ts` — added `getCorrelation`, `CorrelationPair`, `CorrelationResponse` (5 tests)
- `components/network/CorrelationNetwork.tsx` — D3.js force-directed graph with draggable nodes
- `app/correlation/page.tsx` — instrument input, date range, threshold slider, network + table
- `app/layout.tsx` — Correlation nav item added between Research and Bots
- **New dependency:** `d3@7.x` + `@types/d3`
- **Tests:** 67 passing (62 existing + 5 getCorrelation)

**Features:**
- Nodes colored by venue: orange (XKRX), blue (NASDAQ/NYSE), gray (other)
- Edges: green = positive correlation, red = negative; opacity/width = |correlation|
- Threshold slider filters edges in real-time (no re-fetch)
- Pair table sorted by |correlation| descending, text-pos/text-neg color coding
- Drag nodes to rearrange; simulation re-heats on drag
```

- [ ] **Step 6: Commit**

```bash
git add app/correlation/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: add Correlation Network page with D3 force graph and threshold filter"
```

---

## Self-Review

### Spec Coverage

| S-11 Requirement | Task |
|---|---|
| Correlation Matrix → Network Graph | Task 2 (D3 force graph) + Task 3 (page) ✅ |
| Threshold-based Edge creation | Task 3 (threshold slider + CorrelationNetwork prop) ✅ |
| Cluster by color (venue, not sector — no sector data) | Task 2 (nodeColor by venue suffix) ✅ |
| D3.js force simulation | Task 2 (d3.forceSimulation) ✅ |
| Existing correlation_analysis backend | Task 1 (getCorrelation calls /correlation) ✅ |

**Note:** Spec says "Cluster: Sector 색상 구분" but sector data is not available from the backend. Venue-based coloring is the practical substitute.

### Placeholder Scan

None. All steps contain exact code.

### Type Consistency

- `CorrelationPair { a, b, correlation }` (Task 1) → used in Task 2 prop type and Task 3 state ✅
- `CorrelationResponse { pairs: CorrelationPair[] }` (Task 1) → destructured in Task 3 `run()` ✅
- `CorrelationNetworkProps { pairs, threshold, width?, height? }` (Task 2) → all props passed in Task 3 ✅
- `threshold` is `number` in Task 3 state → matches Task 2 prop type ✅
