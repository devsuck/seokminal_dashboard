# Dashboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add institutional Dashboard as the platform home screen with 5 data-driven widgets: Market Overview (KRX live), Today's Events (KSD rights), Research Activity (localStorage), Portfolio Snapshot (stub), and System Status (API health pings).

**Architecture:** New `/dashboard` page replaces root; current Market page moves to `/market`. Five widget components in `components/dashboard/`, each self-contained with their own data fetching. localStorage tracks Research Activity across sessions. Only existing `lib/api.ts` endpoints used — no new backend work required.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4 (existing). Add: `vitest` + `jsdom` for unit tests on utility functions.

## Global Constraints

- Colors: CSS tokens only (`bg-bg`, `bg-panel`, `bg-panel-2`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `border-border`) — never hardcode hex values
- Accent (`#FF9F1C`): reserve for primary action buttons and active states only; widget headers/labels use `text-text-3`
- Inline styles: forbidden — TailwindCSS utility classes only
- API calls: only through existing `lib/api.ts` exported functions — no raw `fetch()` in components
- New npm packages: only `vitest` and `jsdom` added to `devDependencies`
- Existing routes `/backtest`, `/quant`, `/bots`, `/ai-trader` must remain unchanged
- Font: `font-data` class for all numeric/data values; `font-ui` (default) for labels

---

## File Map

**Created:**
- `app/dashboard/page.tsx` — composes all 5 widgets in grid layout
- `app/market/page.tsx` — current Market page content, moved here
- `components/dashboard/MarketOverviewWidget.tsx` — KRX KOSPI/KOSDAQ live + global stubs
- `components/dashboard/SystemStatusWidget.tsx` — API health pings every 30s
- `components/dashboard/TodayEventsWidget.tsx` — KSD rights schedule (14-day window)
- `components/dashboard/ResearchActivityWidget.tsx` — reads localStorage activity log
- `components/dashboard/PortfolioSnapshotWidget.tsx` — stub with Portfolio CTA
- `lib/dashboard-storage.ts` — localStorage R/W for research activity log
- `lib/system-status-utils.ts` — pure utility functions for status display
- `tests/lib/dashboard-storage.test.ts`
- `tests/lib/system-status-utils.test.ts`
- `vitest.config.ts`

**Modified:**
- `app/page.tsx` — replaced with Next.js redirect to `/dashboard`
- `app/layout.tsx` — NAV_ITEMS updated (Dashboard added, Market → `/market`, Quant → Research)

---

### Task 1: Test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/lib/sanity.test.ts`
- Modify: `package.json` (add test scripts + devDeps)

**Interfaces:**
- Produces: `npm test` runs vitest, exits 0

- [ ] **Step 1: Install vitest + jsdom**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm install --save-dev vitest jsdom
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write sanity test**

Create `tests/lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test**

```bash
npm test
```

Expected output:
```
✓ tests/lib/sanity.test.ts (1)
Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/lib/sanity.test.ts package.json package-lock.json
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: Dashboard types + localStorage storage

**Files:**
- Create: `lib/dashboard-storage.ts`
- Create: `tests/lib/dashboard-storage.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  type ActivityType = "backtest" | "strategy" | "experiment" | "portfolio" | "bot";
  interface ResearchActivity {
    id: string;
    type: ActivityType;
    label: string;
    timestamp: number;
    href: string;
  }
  function logActivity(entry: Omit<ResearchActivity, "id" | "timestamp">): void
  function getRecentActivity(limit?: number): ResearchActivity[]
  function clearActivity(): void
  ```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/dashboard-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { logActivity, getRecentActivity, clearActivity } from "../../lib/dashboard-storage";

describe("dashboard-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves an activity entry", () => {
    logActivity({ type: "backtest", label: "AAPL EMA 10/20", href: "/backtest" });
    const result = getRecentActivity();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("backtest");
    expect(result[0].label).toBe("AAPL EMA 10/20");
    expect(result[0].href).toBe("/backtest");
    expect(typeof result[0].id).toBe("string");
    expect(result[0].id.length).toBeGreaterThan(0);
    expect(typeof result[0].timestamp).toBe("number");
  });

  it("returns entries newest-first", () => {
    logActivity({ type: "backtest", label: "First", href: "/backtest" });
    logActivity({ type: "strategy", label: "Second", href: "/quant" });
    const result = getRecentActivity();
    expect(result[0].label).toBe("Second");
    expect(result[1].label).toBe("First");
  });

  it("caps stored entries at 50", () => {
    for (let i = 0; i < 55; i++) {
      logActivity({ type: "backtest", label: `Run ${i}`, href: "/backtest" });
    }
    expect(getRecentActivity().length).toBe(50);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      logActivity({ type: "backtest", label: `Run ${i}`, href: "/backtest" });
    }
    expect(getRecentActivity(3)).toHaveLength(3);
  });

  it("clearActivity empties the log", () => {
    logActivity({ type: "backtest", label: "X", href: "/backtest" });
    clearActivity();
    expect(getRecentActivity()).toHaveLength(0);
  });

  it("returns empty array when localStorage is empty", () => {
    expect(getRecentActivity()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/lib/dashboard-storage.test.ts
```

Expected: FAIL — "Cannot find module '../../lib/dashboard-storage'"

- [ ] **Step 3: Implement dashboard-storage.ts**

Create `lib/dashboard-storage.ts`:
```typescript
const STORAGE_KEY = "seokminal:research_activity";
const MAX_ENTRIES = 50;

export type ActivityType = "backtest" | "strategy" | "experiment" | "portfolio" | "bot";

export interface ResearchActivity {
  id: string;
  type: ActivityType;
  label: string;
  timestamp: number;
  href: string;
}

export function logActivity(entry: Omit<ResearchActivity, "id" | "timestamp">): void {
  const next: ResearchActivity = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const updated = [next, ...readRaw()].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getRecentActivity(limit = MAX_ENTRIES): ResearchActivity[] {
  return readRaw().slice(0, limit);
}

export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function readRaw(): ResearchActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResearchActivity[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/lib/dashboard-storage.test.ts
```

Expected:
```
✓ tests/lib/dashboard-storage.test.ts (6)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-storage.ts tests/lib/dashboard-storage.test.ts
git commit -m "feat: add research activity localStorage storage"
```

---

### Task 3: System status utilities + SystemStatus widget

**Files:**
- Create: `lib/system-status-utils.ts`
- Create: `tests/lib/system-status-utils.test.ts`
- Create: `components/dashboard/SystemStatusWidget.tsx`

**Interfaces:**
- Produces:
  ```typescript
  type StatusState = "online" | "error" | "checking";
  function statusColor(state: StatusState): string  // returns Tailwind class
  function formatLatency(ms: number | null): string  // "123ms" or "—"
  ```
- Produces: `<SystemStatusWidget />` — no props, auto-refreshes every 30s

**Health check endpoints (using existing API routes):**
| Label | URL | Why this endpoint |
|---|---|---|
| API Server | `GET /bars?instrument_id=AAPL.NASDAQ&start=2025-01-01&end=2025-01-02` | Core data endpoint |
| KRX Data | `GET /krx/index?bas_dd={today}&index_type=KOSPI` | Korean market feed |
| FRED/Macro | `GET /fred/catalog` | Macro data feed |
| Bot Engine | `GET /bots` | Bot management |

- [ ] **Step 1: Write failing utility tests**

Create `tests/lib/system-status-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { statusColor, formatLatency } from "../../lib/system-status-utils";

describe("statusColor", () => {
  it("returns text-pos for online", () => {
    expect(statusColor("online")).toBe("text-pos");
  });
  it("returns text-neg for error", () => {
    expect(statusColor("error")).toBe("text-neg");
  });
  it("returns text-warn for checking", () => {
    expect(statusColor("checking")).toBe("text-warn");
  });
});

describe("formatLatency", () => {
  it("formats ms value", () => {
    expect(formatLatency(123)).toBe("123ms");
    expect(formatLatency(0)).toBe("0ms");
  });
  it("returns dash for null", () => {
    expect(formatLatency(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/system-status-utils.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement system-status-utils.ts**

Create `lib/system-status-utils.ts`:
```typescript
export type StatusState = "online" | "error" | "checking";

export function statusColor(state: StatusState): string {
  if (state === "online") return "text-pos";
  if (state === "error") return "text-neg";
  return "text-warn";
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/system-status-utils.test.ts
```

Expected: 4 tests pass

- [ ] **Step 5: Create SystemStatusWidget.tsx**

Create `components/dashboard/SystemStatusWidget.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { statusColor, formatLatency, type StatusState } from "@/lib/system-status-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function todayKrx(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

const CHECKS = [
  { label: "API Server", url: () => `${API_URL}/bars?instrument_id=AAPL.NASDAQ&start=2025-01-01&end=2025-01-02` },
  { label: "KRX Data",   url: () => `${API_URL}/krx/index?bas_dd=${todayKrx()}&index_type=KOSPI` },
  { label: "FRED/Macro", url: () => `${API_URL}/fred/catalog` },
  { label: "Bot Engine", url: () => `${API_URL}/bots` },
] as const;

interface ServiceStatus {
  label: string;
  state: StatusState;
  latencyMs: number | null;
}

async function ping(url: string): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

export function SystemStatusWidget() {
  const [services, setServices] = useState<ServiceStatus[]>(
    CHECKS.map(c => ({ label: c.label, state: "checking" as StatusState, latencyMs: null }))
  );

  useEffect(() => {
    let alive = true;

    async function runChecks() {
      const results = await Promise.all(
        CHECKS.map(async c => {
          const { ok, ms } = await ping(c.url());
          return { label: c.label, state: (ok ? "online" : "error") as StatusState, latencyMs: ms };
        })
      );
      if (alive) setServices(results);
    }

    runChecks();
    const id = setInterval(runChecks, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const anyChecking = services.some(s => s.state === "checking");
  const allOnline   = services.every(s => s.state === "online");

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          System Status
        </span>
        <span className={`text-[10px] font-data ${anyChecking ? "text-warn" : allOnline ? "text-pos" : "text-neg"}`}>
          {anyChecking ? "Checking…" : allOnline ? "All Operational" : "Degraded"}
        </span>
      </div>

      <div className="space-y-2.5">
        {services.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                s.state === "online"   ? "bg-pos" :
                s.state === "error"    ? "bg-neg" :
                                         "bg-warn animate-pulse"
              }`} />
              <span className="text-text-2 text-xs">{s.label}</span>
            </div>
            <span className={`text-[11px] font-data ${statusColor(s.state)}`}>
              {s.state === "checking" ? "…" :
               s.state === "online"   ? formatLatency(s.latencyMs) :
                                        "Error"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/system-status-utils.ts tests/lib/system-status-utils.test.ts components/dashboard/SystemStatusWidget.tsx
git commit -m "feat: add SystemStatus widget with API health pings"
```

---

### Task 4: ResearchActivity widget

**Files:**
- Create: `components/dashboard/ResearchActivityWidget.tsx`

**Interfaces:**
- Consumes: `getRecentActivity`, `ResearchActivity`, `ActivityType` from `lib/dashboard-storage`
- Produces: `<ResearchActivityWidget />` — no props

- [ ] **Step 1: Create ResearchActivityWidget.tsx**

Create `components/dashboard/ResearchActivityWidget.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentActivity, type ResearchActivity, type ActivityType } from "@/lib/dashboard-storage";

const TYPE_LABEL: Record<ActivityType, string> = {
  backtest:   "Backtest",
  strategy:   "Strategy",
  experiment: "Experiment",
  portfolio:  "Portfolio",
  bot:        "Bot",
};

const TYPE_COLOR: Record<ActivityType, string> = {
  backtest:   "text-info",
  strategy:   "text-warn",
  experiment: "text-text-2",
  portfolio:  "text-pos",
  bot:        "text-text-3",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ResearchActivityWidget() {
  const [activities, setActivities] = useState<ResearchActivity[]>([]);

  useEffect(() => {
    setActivities(getRecentActivity(8));
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Research Activity
      </span>

      {activities.length === 0 ? (
        <div className="text-text-3 text-xs py-6 text-center leading-relaxed">
          No recent activity.<br />
          Run a backtest or experiment to see it here.
        </div>
      ) : (
        <div className="space-y-0.5">
          {activities.map(a => (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 no-underline group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${TYPE_COLOR[a.type]}`}>
                  {TYPE_LABEL[a.type]}
                </span>
                <span className="text-text-2 text-xs truncate group-hover:text-text-1 transition-colors">
                  {a.label}
                </span>
              </div>
              <span className="text-text-3 text-[10px] font-data shrink-0 ml-3">{timeAgo(a.timestamp)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/ResearchActivityWidget.tsx
git commit -m "feat: add ResearchActivity widget"
```

---

### Task 5: MarketOverview widget

**Files:**
- Create: `components/dashboard/MarketOverviewWidget.tsx`

**Interfaces:**
- Consumes: `getKRXIndex`, `KRXIndexRow` from `lib/api`
- Produces: `<MarketOverviewWidget />` — no props

**Data availability:**
- KOSPI, KOSDAQ: `getKRXIndex(todayKrx, "KOSPI" | "KOSDAQ")` — real data, `rows[0]` has `clpr` (close), `vs` (change), `flt_rt` (% change)
- S&P 500, NASDAQ, USD/KRW, BTC/USD, VIX, Gold: no backend endpoint → displayed as `—` with "No feed" annotation

- [ ] **Step 1: Create MarketOverviewWidget.tsx**

Create `components/dashboard/MarketOverviewWidget.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { getKRXIndex, type KRXIndexRow } from "@/lib/api";

interface MarketRow {
  label: string;
  value: string;
  changePct: string;
  positive: boolean | null;
  noFeed: boolean;
}

function todayKrx(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function krxToRow(label: string, row: KRXIndexRow | undefined): MarketRow {
  if (!row || row.clpr == null) {
    return { label, value: "—", changePct: "—", positive: null, noFeed: false };
  }
  const pos = (row.vs ?? 0) >= 0;
  return {
    label,
    value: row.clpr.toLocaleString("ko-KR"),
    changePct: row.flt_rt != null ? `${pos ? "+" : ""}${row.flt_rt.toFixed(2)}%` : "—",
    positive: pos,
    noFeed: false,
  };
}

const STUB_ROWS: MarketRow[] = [
  { label: "S&P 500",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "NASDAQ",   value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "USD/KRW",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "BTC/USD",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "VIX",      value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "Gold",     value: "—", changePct: "No feed", positive: null, noFeed: true },
];

const LOADING_ROWS: MarketRow[] = [
  { label: "KOSPI",  value: "…", changePct: "—", positive: null, noFeed: false },
  { label: "KOSDAQ", value: "…", changePct: "—", positive: null, noFeed: false },
  ...STUB_ROWS,
];

export function MarketOverviewWidget() {
  const [rows, setRows] = useState<MarketRow[]>(LOADING_ROWS);

  useEffect(() => {
    const basDd = todayKrx();
    Promise.all([
      getKRXIndex(basDd, "KOSPI").catch(() => null),
      getKRXIndex(basDd, "KOSDAQ").catch(() => null),
    ]).then(([kospi, kosdaq]) => {
      setRows([
        krxToRow("KOSPI",  kospi?.rows[0]),
        krxToRow("KOSDAQ", kosdaq?.rows[0]),
        ...STUB_ROWS,
      ]);
    });
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Market Overview
      </span>

      <div className="grid grid-cols-2 gap-x-8 gap-y-0">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
            <span className="text-text-2 text-xs">{row.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-text-1 text-xs font-data">{row.value}</span>
              <span className={`text-[11px] font-data w-[72px] text-right ${
                row.noFeed     ? "text-text-3 italic" :
                row.positive === null ? "text-text-3" :
                row.positive   ? "text-pos" : "text-neg"
              }`}>
                {row.changePct}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/MarketOverviewWidget.tsx
git commit -m "feat: add MarketOverview widget with KRX live data"
```

---

### Task 6: TodayEvents widget

**Files:**
- Create: `components/dashboard/TodayEventsWidget.tsx`

**Interfaces:**
- Consumes: `getKSDRightsSchedule`, `KSDRightsRow` from `lib/api`
- Produces: `<TodayEventsWidget />` — no props

**Data availability:**
- Rights events: `getKSDRightsSchedule(undefined, beginDt, endDt)` with 14-day window — real data
- Earnings, Economic Calendar, Dividends: no backend endpoint — stubs with honest label

- [ ] **Step 1: Create TodayEventsWidget.tsx**

Create `components/dashboard/TodayEventsWidget.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { getKSDRightsSchedule, type KSDRightsRow } from "@/lib/api";

function getWindow(): { begin: string; end: string } {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { begin: fmt(today), end: fmt(future) };
}

function formatKsdDate(s: string | null): string {
  if (!s || s.length < 8) return "—";
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

export function TodayEventsWidget() {
  const [rights, setRights] = useState<KSDRightsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { begin, end } = getWindow();
    getKSDRightsSchedule(undefined, begin, end)
      .then(res => setRights(res.rows.slice(0, 6)))
      .catch(() => setRights([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Today's Events
      </span>

      <div className="space-y-4">
        {/* Rights Schedule — real KSD data */}
        <section>
          <span className="text-[10px] text-text-3 uppercase tracking-wide">Rights Events (14d)</span>
          {loading ? (
            <p className="text-text-3 text-xs mt-1.5">Loading…</p>
          ) : rights.length === 0 ? (
            <p className="text-text-3 text-xs mt-1.5">No upcoming rights events</p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {rights.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text-2 text-xs truncate max-w-[160px]">
                    {r.stck_issu_cmpy_nm ?? r.crno ?? "—"}
                  </span>
                  <span className="text-text-3 text-[10px] font-data shrink-0 ml-2">
                    {formatKsdDate(r.rgt_exert_rcd)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stubs — honest about missing data sources */}
        {[
          { label: "Earnings Calendar" },
          { label: "Economic Calendar" },
          { label: "Dividends" },
        ].map(stub => (
          <section key={stub.label}>
            <span className="text-[10px] text-text-3 uppercase tracking-wide">{stub.label}</span>
            <p className="text-[10px] text-text-3 mt-1 italic">No feed — data source needed</p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/TodayEventsWidget.tsx
git commit -m "feat: add TodayEvents widget with KSD rights schedule"
```

---

### Task 7: PortfolioSnapshot stub widget

**Files:**
- Create: `components/dashboard/PortfolioSnapshotWidget.tsx`

**Interfaces:**
- Produces: `<PortfolioSnapshotWidget />` — no props, no data fetching

**Note:** Portfolio tracking backend doesn't exist yet. This is an honest stub that guides users to the Quant page until Portfolio Lab (Phase 6) is built.

- [ ] **Step 1: Create PortfolioSnapshotWidget.tsx**

Create `components/dashboard/PortfolioSnapshotWidget.tsx`:
```tsx
import Link from "next/link";

const METRICS = [
  { label: "Daily PnL" },
  { label: "Total Exposure" },
  { label: "Max Drawdown" },
  { label: "Portfolio Beta" },
  { label: "Open Positions" },
] as const;

export function PortfolioSnapshotWidget() {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Portfolio Snapshot
      </span>

      <div className="space-y-2 flex-1">
        {METRICS.map(m => (
          <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">{m.label}</span>
            <span className="text-text-3 text-xs font-data">—</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-text-3 text-[10px] text-center">
          Portfolio tracking available in Phase 6
        </p>
        <Link
          href="/quant"
          className="block text-center text-xs text-accent hover:text-accent/80 transition-colors no-underline border border-accent/30 rounded-md py-2"
        >
          Open Portfolio Optimizer →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/PortfolioSnapshotWidget.tsx
git commit -m "feat: add PortfolioSnapshot stub widget"
```

---

### Task 8: Dashboard page composition

**Files:**
- Create: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: all 5 widgets from `components/dashboard/`
- Produces: Dashboard page at route `/dashboard`

**Grid layout:**
```
Row 1 (2/3 + 1/3): MarketOverview | SystemStatus
Row 2 (1/3 each):  TodayEvents | ResearchActivity | PortfolioSnapshot
```

- [ ] **Step 1: Create dashboard page**

Create `app/dashboard/page.tsx`:
```tsx
import { MarketOverviewWidget }    from "@/components/dashboard/MarketOverviewWidget";
import { SystemStatusWidget }      from "@/components/dashboard/SystemStatusWidget";
import { TodayEventsWidget }       from "@/components/dashboard/TodayEventsWidget";
import { ResearchActivityWidget }  from "@/components/dashboard/ResearchActivityWidget";
import { PortfolioSnapshotWidget } from "@/components/dashboard/PortfolioSnapshotWidget";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-text-3 text-sm mt-0.5">Institutional Quant Research Terminal</p>
      </div>

      {/* Row 1: Market Overview + System Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MarketOverviewWidget />
        </div>
        <SystemStatusWidget />
      </div>

      {/* Row 2: Today's Events + Research Activity + Portfolio Snapshot */}
      <div className="grid grid-cols-3 gap-4">
        <TodayEventsWidget />
        <ResearchActivityWidget />
        <PortfolioSnapshotWidget />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass (sanity + dashboard-storage + system-status-utils)

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: compose Dashboard page from 5 widgets"
```

---

### Task 9: Navigation + routing update

**Files:**
- Create: `app/market/page.tsx` — current Market content moved here
- Modify: `app/page.tsx` — replaced with Next.js redirect
- Modify: `app/layout.tsx` — NAV_ITEMS updated

**Goal:**
- `/` → redirect to `/dashboard`
- `/market` → price chart page (previously at `/`)
- Nav: Dashboard | Market | Backtest | Research | Bots | AI Trader

- [ ] **Step 1: Copy current Market page to /market**

Create `app/market/page.tsx` with the EXACT content currently in `app/page.tsx` (the full MarketPage component with CandlestickChart, InstrumentSelect, DateRangePicker).

Read `app/page.tsx` first, then create `app/market/page.tsx` with identical content.

- [ ] **Step 2: Replace app/page.tsx with redirect**

Replace entire content of `app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Update layout.tsx NAV_ITEMS**

In `app/layout.tsx`, find:
```typescript
const NAV_ITEMS = [
  { href: "/",          label: "Market" },
  { href: "/backtest",  label: "Backtest" },
  { href: "/quant",     label: "Quant" },
  { href: "/bots",      label: "Bots" },
  { href: "/ai-trader", label: "AI Trader" },
];
```

Replace with:
```typescript
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/market",    label: "Market" },
  { href: "/backtest",  label: "Backtest" },
  { href: "/quant",     label: "Research" },
  { href: "/bots",      label: "Bots" },
  { href: "/ai-trader", label: "AI Trader" },
];
```

- [ ] **Step 4: Verify dev server**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm run dev
```

Manual checks:
- `http://localhost:3000` → redirects to `/dashboard`
- `/dashboard` shows 5 widgets (Market Overview, System Status, Today's Events, Research Activity, Portfolio Snapshot)
- `/market` shows price chart (identical to old `/`)
- Nav links: Dashboard, Market, Backtest, Research, Bots, AI Trader all navigate correctly
- `/backtest`, `/quant`, `/bots`, `/ai-trader` — no regressions

- [ ] **Step 5: Commit**

```bash
git add app/market/page.tsx app/page.tsx app/layout.tsx
git commit -m "feat: restructure nav — Dashboard as home, Market moved to /market"
```

---

### Task 10: Update progress.md

- [ ] **Step 1: Update docs/progress.md**

Append to the "완료된 작업" section:

```
### Dashboard Foundation (2026-06-27)

- `/dashboard` 신규 페이지 (5개 위젯 구성)
- Market 페이지 `/market`으로 이동, `/` → `/dashboard` 리다이렉트
- Nav 업데이트: Dashboard 추가, Quant → Research 리네임
- vitest + jsdom 테스트 인프라 추가
- `lib/dashboard-storage.ts` — Research Activity localStorage
- `lib/system-status-utils.ts` — Status 유틸리티
- 5개 위젯: MarketOverview (KRX 실데이터), SystemStatus (API health 30s poll), TodayEvents (KSD rights 14일), ResearchActivity (localStorage), PortfolioSnapshot (stub)
```

Update "다음 할 일":
```
2. Phase 2: Market Discovery Workspace — `/market` 페이지 업그레이드
   (Watchlist, Market Movers, Relative Strength, Volume Spike, Sector Heatmap, Multi-symbol Comparison)
   계획 문서: docs/superpowers/plans/2026-06-27-institutional-upgrade-roadmap.md 참고
```

- [ ] **Step 2: Commit**

```bash
git add docs/progress.md
git commit -m "docs: update progress with Dashboard Foundation completion"
```

---

## Self-Review Checklist

### Spec Coverage

| Upgrade 1 항목 | 구현 여부 |
|---|---|
| Market Overview (Index, Watchlist, Futures, FX, Crypto, VIX) | ✅ KOSPI/KOSDAQ real, 나머지 "No feed" stub (정직한 표시) |
| Today's Events (Earnings, Economic, Dividend, Split, Rights) | ✅ Rights real (KSD), 나머지 "No feed" stub |
| Research Activity (Backtest, Strategy, Experiment, Portfolio, Bot) | ✅ localStorage 구현 |
| Portfolio Snapshot (PnL, Exposure, Drawdown, Beta, Positions) | ✅ Stub (backend 없음, 정직하게 표시) |
| System Status (Data Provider, Broker, API, WebSocket) | ✅ API/KRX/FRED/Bot engine 헬스체크 |

**미구현 항목 이유:**
- S&P 500, NASDAQ, FX, Crypto, VIX: 백엔드 피드 없음 → "No feed" 표시가 스텁보다 정직
- Earnings/Economic Calendar: 외부 데이터 소스 계약 필요 — Phase 2/7에서 처리
- Portfolio Snapshot 실데이터: Phase 6 Portfolio Lab에서 구현

### Placeholder Scan
- "No feed — data source needed" 문구: 의도적 (스텁 아님, 실제 상태 표시)
- PortfolioSnapshot "Phase 6": 의도적 (사용자에게 로드맵 안내)
- 코드 내 TBD/TODO/placeholder 없음 ✅

### Type Consistency
- `ActivityType` — `dashboard-storage.ts`에서 정의, `ResearchActivityWidget`에서 import ✅
- `StatusState` — `system-status-utils.ts`에서 정의, `SystemStatusWidget`에서 import ✅
- `KRXIndexRow` — `lib/api.ts`에서 정의, `MarketOverviewWidget`에서 import ✅
- `KSDRightsRow` — `lib/api.ts`에서 정의, `TodayEventsWidget`에서 import ✅
