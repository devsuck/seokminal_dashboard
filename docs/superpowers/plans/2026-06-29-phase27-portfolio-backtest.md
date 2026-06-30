# Phase 27: Portfolio Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one strategy (EMA Cross, MACD, or RSI) across N instruments simultaneously, aggregate per-instrument results into a summary table and a combined portfolio equity curve.

**Architecture:** Add `_ema_signals` + "ema_cross" branch to `simple_runner.py` so all three strategies route through the pure-Python runner. A new `GET /backtest/portfolio` endpoint (registered BEFORE `GET /backtest`) runs `run_simple_backtest` per instrument, merges trades chronologically into a portfolio equity curve, and returns per-instrument stats plus portfolio-level totals. Frontend adds a "Portfolio" third mode tab in the backtest page.

**Tech Stack:** FastAPI, Python statistics module, Next.js/React, RollingChart (lightweight-charts)

## Global Constraints

- Python bin: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- Test command: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
- Frontend test command: `cd seokminal-dashboard && npm test`
- TypeScript check: `npx tsc --noEmit`
- `@pytest.mark.asyncio` forbidden (asyncio_mode="auto")
- Pre-existing failures to ignore: `test_auth.py` ×3, `test_backtest_happy_path` ×1
- Design tokens only in className: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- `style={{}}` forbidden except `style={{ height: "Npx" }}` chart containers
- Number inputs: `className="w-12"` or `className="w-14"` — not `style={{ width }}`
- Active tab/button: `border-accent text-accent bg-accent/10`
- Raw `fetch` in components forbidden — must use `lib/api.ts` functions
- AbortController pattern: abort→create→assign ref→fetch→catch AbortError silently→`if (!ctrl.signal.aborted) setLoading(false)` in finally→unmount cleanup
- `GET /backtest/portfolio` MUST be registered BEFORE `GET /backtest` in main.py (FastAPI matches paths in registration order)
- Hex codes allowed in chart `color:` fields (not in className)
- Commit to main directly; no feature branches
- Co-Authored-By: no model names or internal context info

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `seokminal-multi-venue/backtest_runner/simple_runner.py` | Modify | Add `_ema_signals()`; extend `run_simple_backtest` for "ema_cross" |
| `seokminal-multi-venue/api_server/main.py` | Modify | Add 3 Pydantic models + `GET /backtest/portfolio` endpoint (before `/backtest`) |
| `seokminal-multi-venue/tests/test_portfolio_backtest.py` | Create | 5 tests |
| `seokminal-dashboard/lib/api.ts` | Modify | Add 3 types + `runPortfolioBacktest()` |
| `seokminal-dashboard/tests/lib/api-portfolio-backtest.test.ts` | Create | 4 tests |
| `seokminal-dashboard/lib/backtest-types.ts` | Modify | Extend `Mode` to include `"portfolio"` |
| `seokminal-dashboard/components/ui/StrategyModeTabs.tsx` | Modify | Add "Portfolio" tab |
| `seokminal-dashboard/app/backtest/page.tsx` | Modify | Portfolio mode state, `runPortfolio()`, results UI |

---

### Task 1: Backend — EMA signals + portfolio endpoint

**Files:**
- Modify: `seokminal-multi-venue/backtest_runner/simple_runner.py`
- Modify: `seokminal-multi-venue/api_server/main.py`
- Create: `seokminal-multi-venue/tests/test_portfolio_backtest.py`

**Interfaces:**
- Consumes: `_ema_series(values, period)` already in simple_runner.py; `run_simple_backtest(bars, strategy, params)` already exists; existing mock pattern from `tests/test_backtest_optimize.py`
- Produces:
  - `_ema_signals(closes: list[float], fast: int, slow: int) -> list[str]` (private, importable for tests)
  - `run_simple_backtest` extended to accept `strategy="ema_cross"`
  - `GET /backtest/portfolio` returning `PortfolioBacktestResponse`

- [ ] **Step 1: Write failing tests**

Create `seokminal-multi-venue/tests/test_portfolio_backtest.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backtest_runner.simple_runner import _ema_signals, run_simple_backtest
from api_server.main import app

client = TestClient(app)


def _fake_report(bars, strategy, params):
    return {
        "bar_count": len(bars),
        "sharpe_ratio": 1.0, "sortino_ratio": None, "max_drawdown": -0.1,
        "volatility": 0.2, "total_pnl": 100.0, "total_pnl_pct": 0.05,
        "win_rate": 0.6, "profit_loss_ratio": 1.5, "avg_win": 100.0, "avg_loss": -50.0,
        "trades": [
            {
                "entry_ts_ns": 1_704_067_200_000_000_000,
                "exit_ts_ns": 1_704_153_600_000_000_000,
                "side": "LONG", "entry_price": 100.0, "exit_price": 110.0,
                "qty": 10, "pnl": 100.0,
            }
        ],
    }


def _fake_bars(n=50):
    bar = MagicMock()
    bar.close = 100.0
    bar.ts_event = 1_704_067_200_000_000_000  # 2024-01-01 UTC in nanoseconds
    return [bar] * n


def test_ema_signals_constant_closes_all_hold():
    closes = [100.0] * 30
    signals = _ema_signals(closes, fast=5, slow=10)
    assert len(signals) == 30
    assert set(signals) == {"HOLD"}


def test_ema_signals_golden_cross():
    # Sharp price jump: fast EMA will cross above slow EMA
    closes = [100.0] * 30 + [200.0] * 30
    signals = _ema_signals(closes, fast=12, slow=26)
    assert "BUY" in signals
    assert "SELL" not in signals


def test_ema_signals_death_cross():
    # Sharp price drop: fast EMA will cross below slow EMA
    closes = [200.0] * 30 + [100.0] * 30
    signals = _ema_signals(closes, fast=12, slow=26)
    assert "SELL" in signals


def test_run_simple_backtest_ema_cross_returns_all_keys():
    bars = _fake_bars(50)
    report = run_simple_backtest(bars, "ema_cross", {"fast": 5, "slow": 10})
    for key in [
        "sharpe_ratio", "sortino_ratio", "max_drawdown", "volatility",
        "total_pnl", "total_pnl_pct", "win_rate", "profit_loss_ratio",
        "avg_win", "avg_loss", "bar_count", "trades",
    ]:
        assert key in report


def test_portfolio_backtest_equity_starts_at_zero_and_grows():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.run_simple_backtest", side_effect=_fake_report),
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
    ):
        mock_cat.return_value.bars.return_value = _fake_bars(1)
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()

        r = client.get(
            "/backtest/portfolio"
            "?instrument_ids=AAPL.NASDAQ,SPY.ARCA"
            "&start=2024-01-01&end=2024-12-31&strategy=macd"
        )

    assert r.status_code == 200
    data = r.json()
    assert data["portfolio_equity"][0]["equity"] == 0.0
    assert data["portfolio_equity"][-1]["equity"] > 0.0
    assert data["portfolio_total_pnl"] > 0.0
    assert len(data["results"]) == 2
    assert data["results"][0]["instrument_id"] in {"AAPL.NASDAQ", "SPY.ARCA"}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_portfolio_backtest.py -v
```

Expected: ImportError or NameError — `_ema_signals` not defined, `/backtest/portfolio` not found.

- [ ] **Step 3: Add `_ema_signals` to simple_runner.py**

In `backtest_runner/simple_runner.py`, add right after the `_rsi_signals` function (around line 119, before `_simulate_trades`):

```python
# ── EMA Cross signals ─────────────────────────────────────────────────────────

def _ema_signals(closes: list[float], fast: int, slow: int) -> list[str]:
    """BUY on golden cross (fast crosses above slow), SELL on death cross, else HOLD."""
    fast_ema = _ema_series(closes, fast)
    slow_ema = _ema_series(closes, slow)
    signals: list[str] = []
    for i in range(len(closes)):
        f = fast_ema[i]
        s = slow_ema[i]
        if f is None or s is None:
            signals.append("HOLD")
            continue
        if i == 0:
            signals.append("HOLD")
            continue
        pf = fast_ema[i - 1]
        ps = slow_ema[i - 1]
        if pf is None or ps is None:
            signals.append("HOLD")
        elif f > s and pf <= ps:
            signals.append("BUY")
        elif f < s and pf >= ps:
            signals.append("SELL")
        else:
            signals.append("HOLD")
    return signals
```

- [ ] **Step 4: Extend `run_simple_backtest` for "ema_cross"**

In `backtest_runner/simple_runner.py`, find the `run_simple_backtest` function (line ~255). After the `elif strategy == "rsi":` block and before the `else: raise ValueError`, add:

```python
    elif strategy == "ema_cross":
        signals = _ema_signals(
            closes,
            fast=int(params.get("fast", 12)),
            slow=int(params.get("slow", 26)),
        )
```

The full function body after the change:

```python
def run_simple_backtest(bars: list, strategy: str, params: dict) -> dict:
    """Run MACD, RSI, or EMA Cross backtest on the given bars. Returns same dict format as run_backtest."""
    closes = [float(b.close) for b in bars]
    ts_events = [b.ts_event for b in bars]
    trade_size = int(params.get("trade_size", 10))

    if strategy == "macd":
        signals = _macd_signals(
            closes,
            fast=int(params.get("fast", 12)),
            slow=int(params.get("slow", 26)),
            signal_period=int(params.get("signal_period", 9)),
        )
    elif strategy == "rsi":
        signals = _rsi_signals(
            closes,
            period=int(params.get("period", 14)),
            oversold=float(params.get("oversold", 30)),
            overbought=float(params.get("overbought", 70)),
        )
    elif strategy == "ema_cross":
        signals = _ema_signals(
            closes,
            fast=int(params.get("fast", 12)),
            slow=int(params.get("slow", 26)),
        )
    else:
        raise ValueError(f"unknown strategy {strategy!r}")

    trades = _simulate_trades(closes, ts_events, signals, trade_size)
    return _compute_stats(closes, ts_events, trades)
```

- [ ] **Step 5: Add Pydantic models + endpoint to main.py**

In `api_server/main.py`, locate the block that ends with the `optimize_backtest` function (ends around line 213, the closing `)`). Insert the following IMMEDIATELY AFTER that closing line and BEFORE the `@app.get("/backtest", ...)` decorator at line 216.

Add models before the endpoint:

```python
PORTFOLIO_STRATEGIES = {"ema_cross", "macd", "rsi"}


class PortfolioInstrumentResult(BaseModel):
    instrument_id: str
    sharpe_ratio: float | None
    total_pnl: float | None
    total_pnl_pct: float | None
    max_drawdown: float | None
    win_rate: float | None
    trade_count: int
    bar_count: int


class EquityPoint(BaseModel):
    ts_ns: int
    equity: float


class PortfolioBacktestResponse(BaseModel):
    results: list[PortfolioInstrumentResult]
    portfolio_equity: list[EquityPoint]
    portfolio_total_pnl: float | None
    portfolio_max_drawdown: float | None
    portfolio_sharpe: float | None = None


@app.get("/backtest/portfolio", response_model=PortfolioBacktestResponse)
def get_portfolio_backtest(
    instrument_ids: str = Query(..., description="Comma-separated instrument IDs"),
    start: dt.date = Query(...),
    end: dt.date = Query(...),
    strategy: str = Query(...),
    fast: int = Query(12),
    slow: int = Query(26),
    signal_period: int = Query(9),
    period: int = Query(14),
    oversold: float = Query(30.0),
    overbought: float = Query(70.0),
    trade_size: int = Query(10),
) -> PortfolioBacktestResponse:
    ids = [i.strip() for i in instrument_ids.split(",") if i.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="instrument_ids must not be empty")
    if strategy not in PORTFOLIO_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail=f"portfolio-backtest only supports {sorted(PORTFOLIO_STRATEGIES)}",
        )

    start_ns = date_to_ns(start.isoformat())
    end_ns = date_to_ns(end.isoformat())

    if strategy == "macd":
        params = {"fast": fast, "slow": slow, "signal_period": signal_period, "trade_size": trade_size}
    elif strategy == "rsi":
        params = {"period": period, "oversold": oversold, "overbought": overbought, "trade_size": trade_size}
    else:  # ema_cross
        params = {"fast": fast, "slow": slow, "trade_size": trade_size}

    catalog = ParquetDataCatalog(CATALOG_PATH)
    results: list[PortfolioInstrumentResult] = []
    all_trades: list[dict] = []

    for iid in ids:
        try:
            bar_type_str = str(bar_type_for(InstrumentId.from_str(iid)))
        except Exception:
            continue
        all_iid_bars = catalog.bars(bar_types=[bar_type_str])
        bars = [b for b in all_iid_bars if start_ns <= b.ts_event <= end_ns]
        if not bars:
            continue
        try:
            report = run_simple_backtest(bars, strategy, params)
        except Exception:
            continue
        results.append(PortfolioInstrumentResult(
            instrument_id=iid,
            sharpe_ratio=report.get("sharpe_ratio"),
            total_pnl=report.get("total_pnl"),
            total_pnl_pct=report.get("total_pnl_pct"),
            max_drawdown=report.get("max_drawdown"),
            win_rate=report.get("win_rate"),
            trade_count=len(report.get("trades", [])),
            bar_count=report["bar_count"],
        ))
        for t in report.get("trades", []):
            if t.get("exit_ts_ns") is not None and t.get("pnl") is not None:
                all_trades.append({"ts_ns": t["exit_ts_ns"], "pnl": t["pnl"]})

    # Build portfolio equity curve sorted by trade exit timestamp
    all_trades.sort(key=lambda t: t["ts_ns"])
    equity = 0.0
    equity_series: list[EquityPoint] = [EquityPoint(ts_ns=start_ns, equity=0.0)]
    for t in all_trades:
        equity += t["pnl"]
        equity_series.append(EquityPoint(ts_ns=t["ts_ns"], equity=equity))

    # Portfolio-level stats
    pnls = [r.total_pnl for r in results if r.total_pnl is not None]
    portfolio_total_pnl: float | None = sum(pnls) if pnls else None

    portfolio_max_drawdown: float | None = None
    if len(equity_series) >= 2:
        peak = equity_series[0].equity
        worst = 0.0
        for ep in equity_series:
            if ep.equity > peak:
                peak = ep.equity
            dd = (ep.equity - peak) / peak if peak > 0 else 0.0
            if dd < worst:
                worst = dd
        portfolio_max_drawdown = worst if worst != 0.0 else None

    return PortfolioBacktestResponse(
        results=results,
        portfolio_equity=equity_series,
        portfolio_total_pnl=portfolio_total_pnl,
        portfolio_max_drawdown=portfolio_max_drawdown,
        portfolio_sharpe=None,
    )
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: 5 new tests pass; pre-existing 4 failures unchanged; no regressions.

- [ ] **Step 7: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add backtest_runner/simple_runner.py api_server/main.py tests/test_portfolio_backtest.py
git commit -m "feat: add EMA cross signals to simple_runner and portfolio backtest endpoint"
```

---

### Task 2: Frontend API types + function

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts`
- Create: `seokminal-dashboard/tests/lib/api-portfolio-backtest.test.ts`

**Interfaces:**
- Consumes: `handleResponse<T>()` and `API_URL` already in `lib/api.ts`; `getBacktest` pattern for reference
- Produces:
  - `PortfolioInstrumentResult` (exported interface)
  - `EquityPoint` (exported interface)
  - `PortfolioBacktestResponse` (exported interface)
  - `runPortfolioBacktest(instrumentIds, start, end, strategy, strategyParams, signal?) → Promise<PortfolioBacktestResponse>`

- [ ] **Step 1: Write failing tests**

Create `seokminal-dashboard/tests/lib/api-portfolio-backtest.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { runPortfolioBacktest, ApiError } from "@/lib/api";

const MOCK_RESPONSE = {
  results: [
    {
      instrument_id: "AAPL.NASDAQ",
      sharpe_ratio: 1.2,
      total_pnl: 500.0,
      total_pnl_pct: 0.05,
      max_drawdown: -0.1,
      win_rate: 0.6,
      trade_count: 5,
      bar_count: 250,
    },
  ],
  portfolio_equity: [
    { ts_ns: 1704067200000000000, equity: 0.0 },
    { ts_ns: 1704153600000000000, equity: 500.0 },
  ],
  portfolio_total_pnl: 500.0,
  portfolio_max_drawdown: null,
  portfolio_sharpe: null,
};

afterEach(() => vi.restoreAllMocks());

describe("runPortfolioBacktest", () => {
  it("parses a successful response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const result = await runPortfolioBacktest(
      ["AAPL.NASDAQ"],
      "2024-01-01",
      "2024-12-31",
      "macd",
      { fast: "12", slow: "26", signal_period: "9" }
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].instrument_id).toBe("AAPL.NASDAQ");
    expect(result.portfolio_equity[0].equity).toBe(0.0);
    expect(result.portfolio_total_pnl).toBe(500.0);
  });

  it("joins instrumentIds with comma in URL", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    await runPortfolioBacktest(
      ["AAPL.NASDAQ", "SPY.ARCA"],
      "2024-01-01",
      "2024-12-31",
      "rsi",
      {}
    );
    const url = (spy.mock.calls[0][0] as string);
    expect(url).toContain("instrument_ids=AAPL.NASDAQ%2CSPY.ARCA");
    expect(url).toContain("strategy=rsi");
  });

  it("throws ApiError on non-2xx response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "bad strategy" }), { status: 400 })
    );
    await expect(
      runPortfolioBacktest(["AAPL.NASDAQ"], "2024-01-01", "2024-12-31", "gated", {})
    ).rejects.toThrow(ApiError);
  });

  it("passes AbortSignal to fetch", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const ctrl = new AbortController();
    await runPortfolioBacktest(["AAPL.NASDAQ"], "2024-01-01", "2024-12-31", "macd", {}, ctrl.signal);
    expect((spy.mock.calls[0][1] as RequestInit).signal).toBe(ctrl.signal);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test -- --reporter=verbose 2>&1 | grep "api-portfolio"
```

Expected: `runPortfolioBacktest is not a function` or import error.

- [ ] **Step 3: Add types and function to lib/api.ts**

Find the section in `lib/api.ts` after `runBacktestOptimize` (around line 195). Add the following immediately after the `runBacktestOptimize` function's closing `}`:

```typescript
export interface PortfolioInstrumentResult {
  instrument_id: string;
  sharpe_ratio: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  trade_count: number;
  bar_count: number;
}

export interface EquityPoint {
  ts_ns: number;
  equity: number;
}

export interface PortfolioBacktestResponse {
  results: PortfolioInstrumentResult[];
  portfolio_equity: EquityPoint[];
  portfolio_total_pnl: number | null;
  portfolio_max_drawdown: number | null;
  portfolio_sharpe: number | null;
}

export async function runPortfolioBacktest(
  instrumentIds: string[],
  start: string,
  end: string,
  strategy: string,
  strategyParams: Record<string, string>,
  signal?: AbortSignal,
): Promise<PortfolioBacktestResponse> {
  const params = new URLSearchParams({
    instrument_ids: instrumentIds.join(","),
    start,
    end,
    strategy,
    ...strategyParams,
  });
  return handleResponse<PortfolioBacktestResponse>(
    await fetch(`${API_URL}/backtest/portfolio?${params.toString()}`, { signal })
  );
}
```

- [ ] **Step 4: Run tests and TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test && npx tsc --noEmit
```

Expected: 4 new tests pass; all prior tests still pass; 0 TS errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts tests/lib/api-portfolio-backtest.test.ts
git commit -m "feat: add PortfolioBacktestResponse types and runPortfolioBacktest API function"
```

---

### Task 3: Frontend — Portfolio mode UI

**Files:**
- Modify: `seokminal-dashboard/lib/backtest-types.ts`
- Modify: `seokminal-dashboard/components/ui/StrategyModeTabs.tsx`
- Modify: `seokminal-dashboard/app/backtest/page.tsx`

**Interfaces:**
- Consumes:
  - `runPortfolioBacktest` from `@/lib/api` (Task 2)
  - `PortfolioBacktestResponse`, `EquityPoint` from `@/lib/api` (Task 2)
  - `RollingChart`, `RollingSeries` from `@/components/rolling/RollingChart`
  - `RollingPoint` from `@/lib/rolling-analytics-utils`
  - Existing state: `strategyType`, `macdFast`, `macdSlow`, `macdSignal`, `rsiPeriod`, `rsiOversold`, `rsiOverbought`, `fast`, `slow`, `start`, `end`
- Produces: "Portfolio" mode tab visible in backtest page; portfolio results rendered

- [ ] **Step 1: Extend Mode type**

In `seokminal-dashboard/lib/backtest-types.ts`, change:

```typescript
export type Mode = "single" | "composite";
```

to:

```typescript
export type Mode = "single" | "composite" | "portfolio";
```

- [ ] **Step 2: Add Portfolio tab to StrategyModeTabs**

In `seokminal-dashboard/components/ui/StrategyModeTabs.tsx`, change the TABS array:

```typescript
const TABS: { value: Mode; label: string }[] = [
  { value: "single",    label: "Single Strategy" },
  { value: "composite", label: "Composite / Gated" },
  { value: "portfolio", label: "Portfolio" },
];
```

- [ ] **Step 3: Add portfolio state and imports to page.tsx**

Read `app/backtest/page.tsx` fully first. Then make these additions:

**New imports** (add to the existing import from `@/lib/api`):
```typescript
import {
  ApiError, getBars, getBacktest, runBacktestOptimize, runPortfolioBacktest,
  type BarOut, type BacktestResponse, type OptimizeResponse,
  type PortfolioBacktestResponse,
} from "@/lib/api";
```

**New import for RollingChart** (add after existing component imports):
```typescript
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
```

**New state variables** (add after `optimizeResult` state around line 69):
```typescript
const [portfolioInstruments, setPortfolioInstruments] = useState("AAPL.NASDAQ,SPY.ARCA");
const [portfolioResult, setPortfolioResult]           = useState<PortfolioBacktestResponse | null>(null);
const [portfolioLoading, setPortfolioLoading]         = useState(false);
const [portfolioError, setPortfolioError]             = useState<string | null>(null);
const portfolioCtrlRef = useRef<AbortController | null>(null);
```

**Add portfolioCtrlRef to unmount cleanup useEffect** — find the existing `useEffect(() => { return () => { abortRef.current?.abort(); ... }; }, [])` and add:
```typescript
portfolioCtrlRef.current?.abort();
```
inside the cleanup function.

- [ ] **Step 4: Add runPortfolio() function**

Add the following function to `app/backtest/page.tsx` after the `optimize()` function:

```typescript
async function runPortfolio() {
  portfolioCtrlRef.current?.abort();
  const ctrl = new AbortController();
  portfolioCtrlRef.current = ctrl;
  setPortfolioLoading(true);
  setPortfolioError(null);
  setPortfolioResult(null);

  const ids = portfolioInstruments.split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    setPortfolioError("Enter at least one instrument ID");
    if (!ctrl.signal.aborted) setPortfolioLoading(false);
    return;
  }

  const params: Record<string, string> = {};
  if (strategyType === "macd") {
    params.fast = String(macdFast);
    params.slow = String(macdSlow);
    params.signal_period = String(macdSignal);
  } else if (strategyType === "rsi") {
    params.period = String(rsiPeriod);
    params.oversold = String(rsiOversold);
    params.overbought = String(rsiOverbought);
  } else {
    params.fast = String(fast);
    params.slow = String(slow);
  }

  try {
    const res = await runPortfolioBacktest(ids, start, end, strategyType, params, ctrl.signal);
    if (!ctrl.signal.aborted) setPortfolioResult(res);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    if (!ctrl.signal.aborted) {
      setPortfolioError(err instanceof ApiError ? err.message : "Portfolio backtest failed");
    }
  } finally {
    if (!ctrl.signal.aborted) setPortfolioLoading(false);
  }
}
```

- [ ] **Step 5: Add Portfolio mode UI in JSX**

Find where `{mode === "composite" && ( ... )}` ends in the JSX. After its closing `)}`, add the portfolio panel:

```tsx
{mode === "portfolio" && (
  <div className="space-y-4">
    {/* Instruments */}
    <div className="flex flex-col gap-1">
      <label className="text-text-3 text-xs">Instrument IDs (comma-separated)</label>
      <input
        value={portfolioInstruments}
        onChange={e => setPortfolioInstruments(e.target.value)}
        className="bg-panel border border-border rounded px-2 py-1 text-text-1 text-sm w-full"
        placeholder="AAPL.NASDAQ,SPY.ARCA"
      />
    </div>

    {/* Strategy type selector — reuse same pill style as single mode */}
    <div className="flex gap-2">
      {(["ema_cross", "macd", "rsi"] as const).map(s => (
        <button
          key={s}
          onClick={() => setStrategyType(s)}
          className={[
            "px-3 py-1 text-xs rounded border transition-colors cursor-pointer",
            strategyType === s
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-text-3 hover:text-text-2",
          ].join(" ")}
        >
          {s === "ema_cross" ? "EMA Cross" : s.toUpperCase()}
        </button>
      ))}
    </div>

    {/* Strategy params */}
    {strategyType === "macd" && (
      <div className="flex gap-3 items-center flex-wrap">
        <label className="text-text-3 text-xs">Fast</label>
        <input type="number" value={macdFast} onChange={e => setMacdFast(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
        <label className="text-text-3 text-xs">Slow</label>
        <input type="number" value={macdSlow} onChange={e => setMacdSlow(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
        <label className="text-text-3 text-xs">Signal</label>
        <input type="number" value={macdSignal} onChange={e => setMacdSignal(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
      </div>
    )}
    {strategyType === "rsi" && (
      <div className="flex gap-3 items-center flex-wrap">
        <label className="text-text-3 text-xs">Period</label>
        <input type="number" value={rsiPeriod} onChange={e => setRsiPeriod(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
        <label className="text-text-3 text-xs">Oversold</label>
        <input type="number" value={rsiOversold} onChange={e => setRsiOversold(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
        <label className="text-text-3 text-xs">Overbought</label>
        <input type="number" value={rsiOverbought} onChange={e => setRsiOverbought(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
      </div>
    )}
    {strategyType === "ema_cross" && (
      <div className="flex gap-3 items-center flex-wrap">
        <label className="text-text-3 text-xs">Fast</label>
        <input type="number" value={fast} onChange={e => setFast(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
        <label className="text-text-3 text-xs">Slow</label>
        <input type="number" value={slow} onChange={e => setSlow(Number(e.target.value))}
          className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
      </div>
    )}

    {/* Run button */}
    <button
      onClick={runPortfolio}
      disabled={portfolioLoading}
      className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {portfolioLoading ? "Running…" : "Run Portfolio Backtest"}
    </button>

    {portfolioError && (
      <p className="text-neg text-sm">{portfolioError}</p>
    )}

    {/* Results */}
    {portfolioResult && (
      <div className="space-y-4 mt-4">
        {/* Portfolio stats */}
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-text-3 text-xs">Total PnL</p>
            <p className="text-text-1 text-sm font-medium">
              {portfolioResult.portfolio_total_pnl != null
                ? `$${portfolioResult.portfolio_total_pnl.toFixed(2)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-text-3 text-xs">Max Drawdown</p>
            <p className="text-neg text-sm font-medium">
              {portfolioResult.portfolio_max_drawdown != null
                ? `${(portfolioResult.portfolio_max_drawdown * 100).toFixed(2)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-text-3 text-xs">Sharpe</p>
            <p className="text-text-1 text-sm font-medium">
              {portfolioResult.portfolio_sharpe != null
                ? portfolioResult.portfolio_sharpe.toFixed(2)
                : "—"}
            </p>
          </div>
        </div>

        {/* Equity curve */}
        <div className="bg-panel border border-border rounded-lg p-3">
          <p className="text-text-3 text-xs mb-2">Portfolio Equity Curve</p>
          <div style={{ height: "200px" }}>
            <RollingChart
              series={[{
                label: "Portfolio Equity",
                color: "#22C55E",
                points: portfolioResult.portfolio_equity.map(ep => ({
                  ts_ns: ep.ts_ns,
                  value: ep.equity,
                })),
              }]}
              yFormat={v => `$${v.toFixed(2)}`}
              height={200}
            />
          </div>
        </div>

        {/* Per-instrument summary table */}
        <div className="bg-panel border border-border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-3 text-xs">
                <th className="px-3 py-2 text-left">Instrument</th>
                <th className="px-3 py-2 text-right">Sharpe</th>
                <th className="px-3 py-2 text-right">Total PnL</th>
                <th className="px-3 py-2 text-right">PnL%</th>
                <th className="px-3 py-2 text-right">Max DD</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Bars</th>
              </tr>
            </thead>
            <tbody>
              {portfolioResult.results.map(r => (
                <tr key={r.instrument_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-text-1">{r.instrument_id}</td>
                  <td className="px-3 py-2 text-right text-text-2">
                    {r.sharpe_ratio != null ? r.sharpe_ratio.toFixed(2) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right ${r.total_pnl != null && r.total_pnl >= 0 ? "text-pos" : "text-neg"}`}>
                    {r.total_pnl != null ? `$${r.total_pnl.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right ${r.total_pnl_pct != null && r.total_pnl_pct >= 0 ? "text-pos" : "text-neg"}`}>
                    {r.total_pnl_pct != null ? `${(r.total_pnl_pct * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-neg">
                    {r.max_drawdown != null ? `${(r.max_drawdown * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-2">
                    {r.win_rate != null ? `${(r.win_rate * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-2">{r.trade_count}</td>
                  <td className="px-3 py-2 text-right text-text-2">{r.bar_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Run TypeScript check and tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npx tsc --noEmit && npm test
```

Expected: 0 TS errors; all prior tests pass (no new tests added for UI task).

- [ ] **Step 7: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/backtest-types.ts components/ui/StrategyModeTabs.tsx app/backtest/page.tsx
git commit -m "feat: add Portfolio mode to backtest page with multi-instrument equity curve"
```
