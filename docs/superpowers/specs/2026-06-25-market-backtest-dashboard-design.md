# Market & Backtest Dashboard (Sub-project 12)

**Goal:** A standalone Next.js web dashboard that consumes the `/bars` and
`/backtest` endpoints of `nautilus-multi-venue`'s `api_server` (sub-project
11) to show price charts and run backtests interactively. This is the
first slice of the platform roadmap's frontend layer — the "general
financial information/market data viewing" and part of the "quant
trading/research tooling" pillars of the eventual Bloomberg-Terminal-like
platform vision. Correlation/quant-research visualization (`/correlation`)
is explicitly deferred to its own later sub-project, as is any agentic
LLM-trading UI (Phase 4 work, deferred indefinitely per direct user
instruction).

## Scope

In scope:
- A new, independent repository (`~/nautilus-dashboard`) with no code
  dependency on `nautilus-multi-venue` — communicates with it purely over
  HTTP, preserving the headless/API-first boundary established in
  `nautilus-multi-venue`'s Phase 1 standing constraints.
- Next.js (App Router) + TypeScript + Tailwind CSS.
- Two pages:
  1. **Market (`/`)**: instrument selector (the four instruments known to
     exist in the current catalog: `AAPL.NASDAQ`, `MSFT.NASDAQ`,
     `005930.XKRX`, `000660.XKRX`), a date range picker, and a candlestick
     chart (via `lightweight-charts`) rendering the result of `GET
     /bars`.
  2. **Backtest (`/backtest`)**: a form (instrument dropdown, date range
     picker, fast/slow EMA number inputs, strategy fixed to `"ema_cross"`
     since that's the only value `api_server` currently accepts) with a
     "Run" button that calls `GET /backtest` and displays the returned
     metrics (`sharpe_ratio`, `max_drawdown`, `total_pnl`,
     `total_pnl_pct`, `bar_count`) as result cards.
- A small CORS patch to `nautilus-multi-venue`'s `api_server/main.py`
  (sub-project 11's API had no CORS configuration, since it had no
  browser client yet) — add FastAPI's `CORSMiddleware` allowing
  `http://localhost:3000` so the dashboard's browser-side `fetch` calls
  succeed. This is the one piece of this sub-project's work that touches
  the other repo.
- A typed API client module (`lib/api.ts` or similar) wrapping `fetch`
  calls to both endpoints, parsing JSON responses into TypeScript types
  matching `api_server`'s Pydantic response models
  (`BarsResponse`/`BacktestResponse`).
- Client-side error handling: non-2xx responses (400/422/500 from
  `api_server`) are caught and rendered as an inline error message on the
  relevant page — never thrown uncaught to the user as a blank
  error screen.
- `NEXT_PUBLIC_API_URL` environment variable (default
  `http://127.0.0.1:8000`) configuring where the dashboard expects
  `api_server` to be running. No deployment/hosting setup beyond local
  dev (`next dev`) in this sub-project.

Out of scope (deferred to later sub-projects):
- The `/correlation` (Quant/Correlation) page — separate sub-project,
  since correlation belongs conceptually to the platform's quant-research
  pillar, not the market/backtest pillar this sub-project covers.
- Any trading-bot configuration UI, agentic AI trading UI, or
  TradingAgents (Tauric Research) integration — Phase 4 work, explicitly
  deferred by the user ("엄청 나중의 일") until the engine and UI/dashboard
  phases are both complete.
- Authentication/authorization on the dashboard or the API — both are
  local-development-only at this stage (`api_server` itself has no auth
  per sub-project 11's scope).
- Automated component/page tests — manual browser verification only,
  given the front-end-presentational nature of this sub-project's scope.
- Production deployment, CI/CD, hosting — local `next dev` only.
- Any new `api_server` endpoints beyond the CORS patch — `/bars` and
  `/backtest` are consumed as-is.

## Architecture

`nautilus-dashboard/` is a standalone Next.js project:

```
nautilus-dashboard/
  app/
    page.tsx              # Market page ("/")
    backtest/page.tsx     # Backtest page ("/backtest")
    layout.tsx            # Shared layout (nav between the two pages)
    globals.css           # Tailwind base
  lib/
    api.ts                # Typed fetch wrappers: getBars(), getBacktest()
  components/
    InstrumentSelect.tsx  # Shared dropdown (4 known instruments)
    DateRangePicker.tsx   # Shared date range input
    CandlestickChart.tsx  # lightweight-charts wrapper, takes BarsResponse
    BacktestResultCard.tsx # Renders BacktestResponse metrics
  .env.local.example       # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

**Data flow (Market page):** user picks instrument + date range ->
`lib/api.ts`'s `getBars()` calls `GET {API_URL}/bars?instrument_id=...&start=...&end=...`
-> response parsed into `BarsResponse` type -> `CandlestickChart` renders
it via `lightweight-charts`'s `addCandlestickSeries().setData(...)`,
mapping each `BarOut` (`ts_event` in nanoseconds, `open/high/low/close`)
to `lightweight-charts`'s expected `{time, open, high, low, close}` shape
(`time` = `ts_event / 1e9`, since nanoseconds need converting to Unix
seconds for the chart library).

**Data flow (Backtest page):** user fills the form, clicks "Run" ->
`getBacktest()` calls `GET {API_URL}/backtest?instrument_id=...&start=...&end=...&strategy=ema_cross&fast=...&slow=...`
-> response parsed into `BacktestResponse` type -> `BacktestResultCard`
renders the five metrics as labeled cards (e.g. "Sharpe Ratio: 0.474").

**CORS patch (in `nautilus-multi-venue`):** `api_server/main.py` adds:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

This is additive only — no existing route logic in `api_server` changes.

## Error Handling

- `lib/api.ts`'s wrappers check `response.ok`; on failure, they parse the
  JSON error body (`{"detail": "..."}` — FastAPI's standard
  `HTTPException` shape) and throw a typed `ApiError` carrying the status
  code and detail message, rather than a generic `Error`.
- Each page's data-fetching logic (a client component using `useState` +
  an async handler, not a Next.js Server Component, since both pages are
  fully interactive/client-driven) catches `ApiError` and stores it in
  local state, rendering an inline red-text message near the form instead
  of letting it propagate to Next.js's default error boundary.
- Loading state: a simple "Loading..." text/spinner shown while a request
  is in flight, replacing the previous result (no stale-while-loading
  pattern needed at this scope).

## Testing

No automated test suite in this sub-project (explicit scope decision —
this is a presentational frontend slice, manual verification is
sufficient at this stage). Verification is manual browser testing per
the plan's tasks:
- Market page: select each of the 4 known instruments with a date range
  covering existing catalog data, confirm a non-empty candlestick chart
  renders; select a date range with no data and confirm the inline error
  message appears instead of a crash.
- Backtest page: run with `AAPL.NASDAQ`, matching sub-9's manually
  verified parameters, confirm the five result cards show values
  consistent with sub-9/sub-11's previously verified numbers
  (`sharpe_ratio≈0.47`, `bar_count=250`); run with an invalid date format
  and confirm the inline error message appears (mapping to `api_server`'s
  422 response).
- CORS patch: confirm the dashboard's browser `fetch` calls succeed
  against a locally running `api_server` (no CORS console errors).
