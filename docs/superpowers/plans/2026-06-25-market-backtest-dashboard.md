# Market & Backtest Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js dashboard (`~/nautilus-dashboard`) with a Market page (candlestick chart) and a Backtest page (form + result cards), consuming `nautilus-multi-venue`'s `api_server` `/bars` and `/backtest` endpoints over HTTP.

**Architecture:** Two client-rendered Next.js pages under the App Router, a typed `lib/api.ts` fetch client, and shared form components (`InstrumentSelect`, `DateRangePicker`). One small CORS patch lands in the separate `~/nautilus-multi-venue` repo so the browser can call `api_server` from `localhost:3000`.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19.2.7, TypeScript 6.0.3, Tailwind CSS 4.3.1 (CSS-first config, no `tailwind.config.js`), `lightweight-charts` 5.2.0.

## Global Constraints

- `nautilus-dashboard` has no code dependency on `nautilus-multi-venue` — HTTP only.
- No automated test suite in this sub-project (explicit spec decision) — verification is `npm run build` (type/compile correctness) plus manual browser checks in the final task.
- `NEXT_PUBLIC_API_URL` env var configures the API base URL, defaulting to `http://127.0.0.1:8000`.
- Non-2xx API responses must be caught and shown as inline error text — never an uncaught exception / Next.js error boundary.
- The CORS patch in `nautilus-multi-venue` is additive only — no existing `api_server` route logic changes.
- Only the four instruments already in the catalog are offered in `InstrumentSelect`: `AAPL.NASDAQ`, `MSFT.NASDAQ`, `005930.XKRX`, `000660.XKRX`.
- The Backtest page's `strategy` is fixed to `"ema_cross"` (the only value `api_server` accepts).

---

### Task 1: CORS patch in `nautilus-multi-venue`

**Files:**
- Modify: `~/nautilus-multi-venue/api_server/main.py:14` (right after the `app = FastAPI(...)` line)

**Interfaces:**
- Consumes: nothing new.
- Produces: `api_server`'s FastAPI `app` now sends `Access-Control-Allow-Origin: http://localhost:3000` headers on responses to requests from that origin.

- [ ] **Step 1: Add the CORS middleware**

In `~/nautilus-multi-venue/api_server/main.py`, add this import alongside the existing `fastapi` import (line 3):

```python
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
```

Immediately after `app = FastAPI(title="Nautilus Multi-Venue Dashboard API")` (line 14), add:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

- [ ] **Step 2: Verify the existing test suite still passes**

Run (from `~/nautilus-multi-venue`): `pytest -v`
Expected: all tests pass (this change adds middleware, doesn't touch any route logic — should be the same count as before, currently 101).

- [ ] **Step 3: Manually verify the CORS header appears**

Run: `uvicorn api_server.main:app --port 8000 &` (wait ~2s), then:

```bash
curl -s -D - -o /dev/null "http://127.0.0.1:8000/bars?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2026-12-31" -H "Origin: http://localhost:3000"
```

Expected: response headers include `access-control-allow-origin: http://localhost:3000`.

Then: `pkill -f "uvicorn api_server.main:app --port 8000"`

- [ ] **Step 4: Commit**

```bash
cd ~/nautilus-multi-venue
git add api_server/main.py
git commit -m "feat: add CORS middleware for localhost:3000 dashboard"
```

---

### Task 2: Next.js + Tailwind scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder, replaced fully in Task 4)
- Create: `.env.local.example`
- Create: `.env.local`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run dev`/`npm run build` Next.js project with Tailwind active and a two-link nav (`Market` / `Backtest`) in the root layout, ready for Tasks 3-5 to add real content.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "nautilus-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "lightweight-charts": "5.2.0"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "4.3.1",
    "@tailwindcss/postcss": "4.3.1",
    "postcss": "^8"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write `postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Write `app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Write `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nautilus Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <nav className="bg-white border-b border-gray-200 px-8 py-4 flex gap-6">
          <Link href="/" className="font-medium">
            Market
          </Link>
          <Link href="/backtest" className="font-medium">
            Backtest
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Write the placeholder `app/page.tsx`**

```tsx
export default function MarketPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Market</h1>
      <p>Coming in Task 4.</p>
    </main>
  );
}
```

- [ ] **Step 8: Write `.env.local.example` and `.env.local`**

Both files get the same content (`.env.local` is the one Next.js actually reads; `.env.local.example` is the committed template):

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

- [ ] **Step 9: Write `.gitignore`**

```
node_modules/
.next/
.env.local
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 11: Verify the build succeeds**

Run: `npm run build`
Expected: build completes successfully, output shows the `/` route compiled.

- [ ] **Step 12: Verify the dev server serves the placeholder page**

Run: `npm run dev &` (wait ~3s for it to start), then:

```bash
curl -s http://localhost:3000/ | grep -o "Coming in Task 4"
```

Expected output: `Coming in Task 4`

Then: `pkill -f "next dev"`

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs app/ .env.local.example .gitignore package-lock.json
git commit -m "feat: scaffold Next.js + Tailwind project"
```

---

### Task 3: Typed API client (`lib/api.ts`)

**Files:**
- Create: `lib/api.ts`

**Interfaces:**
- Consumes: `api_server`'s `/bars` and `/backtest` endpoints (running locally at `NEXT_PUBLIC_API_URL`, default `http://127.0.0.1:8000`).
- Produces: `ApiError` (class, has `.status: number` and `.message: string`), `BarOut` (interface: `ts_event: number, open: number, high: number, low: number, close: number, volume: number`), `BarsResponse` (interface: `instrument_id: string, bars: BarOut[]`), `BacktestResponse` (interface: `sharpe_ratio: number | null, max_drawdown: number | null, total_pnl: number | null, total_pnl_pct: number | null, bar_count: number`), `getBars(instrumentId: string, start: string, end: string): Promise<BarsResponse>`, `getBacktest(instrumentId: string, start: string, end: string, fast: number, slow: number): Promise<BacktestResponse>` — all used by Tasks 4-5.

- [ ] **Step 1: Write `lib/api.ts`**

```typescript
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export interface BarOut {
  ts_event: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BarsResponse {
  instrument_id: string;
  bars: BarOut[];
}

export interface BacktestResponse {
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  bar_count: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, body.detail ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function getBars(
  instrumentId: string,
  start: string,
  end: string
): Promise<BarsResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
  });
  const response = await fetch(`${API_URL}/bars?${params.toString()}`);
  return handleResponse<BarsResponse>(response);
}

export async function getBacktest(
  instrumentId: string,
  start: string,
  end: string,
  fast: number,
  slow: number
): Promise<BacktestResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy: "ema_cross",
    fast: String(fast),
    slow: String(slow),
  });
  const response = await fetch(`${API_URL}/backtest?${params.toString()}`);
  return handleResponse<BacktestResponse>(response);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify it works against the real running `api_server`**

Run (from `~/nautilus-multi-venue`): `uvicorn api_server.main:app --port 8000 &` (wait ~2s).

Then, from `~/nautilus-dashboard`, use `npx tsx` to run `lib/api.ts` directly (it can execute TypeScript without a separate build step):

```bash
npx --yes tsx -e "
import { getBars, getBacktest } from './lib/api.ts';
const bars = await getBars('AAPL.NASDAQ', '2024-01-01', '2026-12-31');
console.log('bars:', bars.instrument_id, bars.bars.length);
const bt = await getBacktest('AAPL.NASDAQ', '2024-01-01', '2026-12-31', 10, 20);
console.log('backtest:', bt);
"
```

Expected output: `bars: AAPL.NASDAQ 250` (or similar non-zero count) and a `backtest:` line showing the five metric fields with real numbers.

Then: `pkill -f "uvicorn api_server.main:app --port 8000"`

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add typed API client for /bars and /backtest"
```

---

### Task 4: Shared form components + Market page

**Files:**
- Create: `components/InstrumentSelect.tsx`
- Create: `components/DateRangePicker.tsx`
- Create: `components/CandlestickChart.tsx`
- Modify: `app/page.tsx` (replace the Task 2 placeholder)

**Interfaces:**
- Consumes: `getBars`, `BarOut`, `ApiError` from `lib/api.ts` (Task 3).
- Produces: `InstrumentSelect` (props: `value: string, onChange: (value: string) => void`), `DateRangePicker` (props: `start: string, end: string, onStartChange: (value: string) => void, onEndChange: (value: string) => void`), `CandlestickChart` (props: `bars: BarOut[]`) — `DateRangePicker` and `InstrumentSelect` are reused as-is by Task 5's Backtest page.

- [ ] **Step 1: Write `components/InstrumentSelect.tsx`**

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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded px-3 py-2"
    >
      {KNOWN_INSTRUMENTS.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Write `components/DateRangePicker.tsx`**

```tsx
"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function DateRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2"
      />
      <span>to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2"
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `components/CandlestickChart.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface CandlestickChartProps {
  bars: BarOut[];
}

export function CandlestickChart({ bars }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries);
    series.setData(
      bars.map((bar) => ({
        time: Math.floor(bar.ts_event / 1_000_000_000) as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={containerRef} className="w-full" />;
}
```

- [ ] **Step 4: Replace `app/page.tsx` with the real Market page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ApiError, getBars, type BarOut } from "@/lib/api";

export default function MarketPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadBars() {
    setLoading(true);
    setError(null);
    try {
      const response = await getBars(instrumentId, start, end);
      setBars(response.bars);
    } catch (e) {
      setBars([]);
      setError(e instanceof ApiError ? e.message : "Failed to load bars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Market</h1>
      <div className="flex gap-4 items-center">
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <button
          onClick={loadBars}
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          Load
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && bars.length > 0 && (
        <CandlestickChart bars={bars} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 6: Manually verify in the browser**

Run (from `~/nautilus-multi-venue`): `uvicorn api_server.main:app --port 8000 &` (wait ~2s).
Run (from `~/nautilus-dashboard`): `npm run dev &` (wait ~3s).
Open `http://localhost:3000/` in a browser.
Expected: page loads with the instrument dropdown, date pickers, and Load button; a candlestick chart renders automatically on load (since `useEffect` calls `loadBars()` on mount) for `AAPL.NASDAQ`.

Then: `pkill -f "next dev"` and `pkill -f "uvicorn api_server.main:app --port 8000"`

- [ ] **Step 7: Commit**

```bash
git add components/ app/page.tsx
git commit -m "feat: add Market page with candlestick chart"
```

---

### Task 5: Backtest page

**Files:**
- Create: `components/BacktestResultCard.tsx`
- Create: `app/backtest/page.tsx`

**Interfaces:**
- Consumes: `getBacktest`, `BacktestResponse`, `ApiError` from `lib/api.ts` (Task 3); `InstrumentSelect`, `DateRangePicker` from Task 4.
- Produces: `BacktestResultCard` (props: `result: BacktestResponse`), the `/backtest` route.

- [ ] **Step 1: Write `components/BacktestResultCard.tsx`**

```tsx
import type { BacktestResponse } from "@/lib/api";

interface BacktestResultCardProps {
  result: BacktestResponse;
}

const METRICS: { key: keyof BacktestResponse; label: string }[] = [
  { key: "sharpe_ratio", label: "Sharpe Ratio" },
  { key: "max_drawdown", label: "Max Drawdown" },
  { key: "total_pnl", label: "Total PnL" },
  { key: "total_pnl_pct", label: "Total PnL %" },
  { key: "bar_count", label: "Bar Count" },
];

export function BacktestResultCard({ result }: BacktestResultCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {METRICS.map(({ key, label }) => (
        <div key={key} className="border border-gray-300 rounded p-4">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-semibold">
            {result[key] === null ? "N/A" : result[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/backtest/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { BacktestResultCard } from "@/components/BacktestResultCard";
import { ApiError, getBacktest, type BacktestResponse } from "@/lib/api";

export default function BacktestPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const [fast, setFast] = useState(10);
  const [slow, setSlow] = useState(20);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runBacktest() {
    setLoading(true);
    setError(null);
    try {
      const response = await getBacktest(instrumentId, start, end, fast, slow);
      setResult(response);
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Failed to run backtest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Backtest</h1>
      <div className="flex gap-4 items-center flex-wrap">
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <label className="flex items-center gap-2">
          Fast EMA
          <input
            type="number"
            value={fast}
            onChange={(e) => setFast(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20"
          />
        </label>
        <label className="flex items-center gap-2">
          Slow EMA
          <input
            type="number"
            value={slow}
            onChange={(e) => setSlow(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20"
          />
        </label>
        <button
          onClick={runBacktest}
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          Run
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && result && <BacktestResultCard result={result} />}
    </main>
  );
}
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no type errors, `/backtest` route listed in output.

- [ ] **Step 4: Manually verify in the browser**

Run (from `~/nautilus-multi-venue`): `uvicorn api_server.main:app --port 8000 &` (wait ~2s).
Run (from `~/nautilus-dashboard`): `npm run dev &` (wait ~3s).
Open `http://localhost:3000/backtest` in a browser. Click "Run" with the default values.
Expected: five result cards appear (Sharpe Ratio, Max Drawdown, Total PnL, Total PnL %, Bar Count) with real numbers, no console errors.

Then: `pkill -f "next dev"` and `pkill -f "uvicorn api_server.main:app --port 8000"`

- [ ] **Step 5: Commit**

```bash
git add components/BacktestResultCard.tsx app/backtest/
git commit -m "feat: add Backtest page with result cards"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start both servers**

```bash
cd ~/nautilus-multi-venue && uvicorn api_server.main:app --port 8000 &
cd ~/nautilus-dashboard && npm run dev &
```

Wait ~3s for both to start.

- [ ] **Step 2: Walk through the Market page**

Open `http://localhost:3000/`. For each of the 4 known instruments (`AAPL.NASDAQ`, `MSFT.NASDAQ`, `005930.XKRX`, `000660.XKRX`), select it, click "Load", and confirm a candlestick chart renders with no console errors. Then set `start` to a date range outside any catalog data (e.g. `2030-01-01` to `2030-12-31`) and confirm the inline red error message appears instead of a crash.

- [ ] **Step 3: Walk through the Backtest page**

Open `http://localhost:3000/backtest`. Run with the default `AAPL.NASDAQ`/`2024-01-01`–`2026-12-31`/fast=10/slow=20 values and confirm the five result cards show numbers consistent with prior sub-project verifications (`sharpe_ratio≈0.47`, `bar_count=250`). Then change the date field to an invalid value by editing the URL query manually or temporarily typing a malformed value, and confirm the inline error message appears (mapping to `api_server`'s 422).

- [ ] **Step 4: Confirm no CORS errors**

Check the browser devtools console on both pages — confirm no CORS-related errors logged (the Task 1 patch should make all `fetch` calls succeed silently).

- [ ] **Step 5: Stop both servers**

```bash
pkill -f "next dev"
pkill -f "uvicorn api_server.main:app --port 8000"
```

- [ ] **Step 6: Record completion**

Append to `.superpowers/sdd/progress.md` (in `~/nautilus-dashboard`):

```
Manual end-to-end verification: complete (date). Market page renders candlesticks for all 4 known instruments, error message shown for out-of-range dates. Backtest page returns matching metrics for the default AAPL.NASDAQ run, error message shown for malformed dates. No CORS errors observed. Sub-project 12 fully complete.
```

(Fill in the actual date when this step runs.)
