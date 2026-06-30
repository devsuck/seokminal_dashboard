# Phase 26 — Backtest v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MACD-cross and RSI mean-revert strategy types to the backtest engine, add a grid-search parameter optimization endpoint, and surface both in the frontend backtest UI.

**Architecture:** New `backtest_runner/simple_runner.py` implements pure-Python MACD and RSI backtesting (no NautilusTrader dependency beyond catalog reads); `run_simple_backtest(bars, strategy, params)` returns the same dict format as `run_backtest`. Two new strategies added to `SUPPORTED_STRATEGIES` in `api_server/main.py` with a new `GET /backtest/optimize` endpoint for grid search. Frontend backtest page gains a strategy type selector (EMA Cross | MACD | RSI) within "single" mode and an Optimize button for MACD/RSI.

**Tech Stack:** Python 3.14 · FastAPI · pytest · Next.js 16 · React 19 · TypeScript · TailwindCSS 4 · vitest

## Global Constraints

- Python bin: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- pytest run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
- Frontend test run: `cd seokminal-dashboard && npm test`
- TypeScript check: `cd seokminal-dashboard && npx tsc --noEmit`
- Design tokens only: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- `bg-accent text-black`: primary action buttons only (Run, Save, Optimize)
- Active tab / mode toggle: `border-accent text-accent bg-accent/10`
- `style={{}}` forbidden except `style={{ height: "Npx" }}` chart containers
- Hex codes in `className` forbidden
- Raw `fetch` forbidden in page components — use functions from `lib/api.ts`
- AbortController: abort → create → assign ref → fetch → catch AbortError silently → `if (!ctrl.signal.aborted) setLoading(false)` in finally → unmount cleanup
- `@pytest.mark.asyncio` forbidden (`asyncio_mode="auto"` already set)
- Branch: commit directly to main (no feature branches)
- Co-Authored-By: no model names or internal context info
- Pre-existing test failures to ignore (do NOT fix): `test_auth.py` ×3, `test_backtest_happy_path` ×1

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `seokminal-multi-venue/backtest_runner/simple_runner.py` | Create | Pure-Python MACD + RSI backtester; produces same dict format as `run_backtest` |
| `seokminal-multi-venue/tests/test_simple_runner.py` | Create | 9 tests for simple_runner helpers and strategies |
| `seokminal-multi-venue/api_server/main.py` | Modify | Add `"macd"`, `"rsi"` to `SUPPORTED_STRATEGIES`; route them to `run_simple_backtest`; add `GET /backtest/optimize` |
| `seokminal-multi-venue/tests/test_backtest_optimize.py` | Create | 4 tests for the optimize endpoint |
| `seokminal-dashboard/lib/api.ts` | Modify | Add `OptimizeResponse` type + `runBacktestOptimize()` |
| `seokminal-dashboard/tests/lib/api-backtest-optimize.test.ts` | Create | 4 vitest tests for `runBacktestOptimize` |
| `seokminal-dashboard/app/backtest/page.tsx` | Modify | Strategy type selector (EMA/MACD/RSI) within "single" mode; MACD/RSI param inputs; Optimize button + result display |

---

### Task 1: Backend — `simple_runner.py` + tests

**Files:**
- Create: `seokminal-multi-venue/backtest_runner/simple_runner.py`
- Create: `seokminal-multi-venue/tests/test_simple_runner.py`

**Interfaces:**
- Produces:
  ```python
  def run_simple_backtest(
      bars: list,        # NautilusTrader Bar objects (duck-typed, need .close, .ts_event)
      strategy: str,     # "macd" | "rsi"
      params: dict,
  ) -> dict:
      # Returns same keys as run_backtest:
      # sharpe_ratio, sortino_ratio, max_drawdown, volatility, total_pnl,
      # total_pnl_pct, win_rate, profit_loss_ratio, avg_win, avg_loss,
      # bar_count, trades (list of dicts with same TradeRecord fields)
  ```

- [ ] **Step 1: Create `backtest_runner/simple_runner.py`**

Create `seokminal-multi-venue/backtest_runner/simple_runner.py` with this exact implementation:

```python
"""Pure-Python MACD and RSI backtester. Produces the same dict format as run_backtest."""
from __future__ import annotations

import math
import statistics as _st


# ── EMA helper ────────────────────────────────────────────────────────────────

def _ema_series(values: list[float], period: int) -> list[float | None]:
    """Return EMA for each index; None for warmup period (index < period - 1)."""
    result: list[float | None] = [None] * len(values)
    if len(values) < period:
        return result
    ema = sum(values[:period]) / period
    result[period - 1] = ema
    k = 2 / (period + 1)
    for i in range(period, len(values)):
        ema = values[i] * k + ema * (1 - k)
        result[i] = ema
    return result


# ── MACD signals ──────────────────────────────────────────────────────────────

def _macd_signals(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> list[str]:
    """Return "BUY", "SELL", or "HOLD" per bar index based on MACD crossover."""
    fast_emas = _ema_series(closes, fast)
    slow_emas = _ema_series(closes, slow)

    macd_line: list[float | None] = [
        (fast_emas[i] - slow_emas[i])  # type: ignore[operator]
        if fast_emas[i] is not None and slow_emas[i] is not None
        else None
        for i in range(len(closes))
    ]

    # Extract non-None MACD values to compute signal line EMA
    valid: list[tuple[int, float]] = [(i, v) for i, v in enumerate(macd_line) if v is not None]
    signal_line: list[float | None] = [None] * len(closes)
    if len(valid) >= signal_period:
        raw_vals = [v for _, v in valid]
        sig_emas = _ema_series(raw_vals, signal_period)
        for j, (orig_i, _) in enumerate(valid):
            if sig_emas[j] is not None:
                signal_line[orig_i] = sig_emas[j]

    signals = ["HOLD"] * len(closes)
    for i in range(1, len(closes)):
        m = macd_line[i]
        s = signal_line[i]
        m_prev = macd_line[i - 1]
        s_prev = signal_line[i - 1]
        if None in (m, s, m_prev, s_prev):
            continue
        # Crossover: MACD crosses above signal → BUY; crosses below → SELL
        if m_prev <= s_prev and m > s:  # type: ignore[operator]
            signals[i] = "BUY"
        elif m_prev >= s_prev and m < s:  # type: ignore[operator]
            signals[i] = "SELL"
    return signals


# ── RSI signals ───────────────────────────────────────────────────────────────

def _rsi_series(closes: list[float], period: int) -> list[float | None]:
    """Return RSI value per bar index using Wilder's smoothing."""
    result: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return result

    diffs = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0.0) for d in diffs]
    losses = [max(-d, 0.0) for d in diffs]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def _rsi_val(ag: float, al: float) -> float:
        return 100.0 if al == 0.0 else 100.0 - 100.0 / (1 + ag / al)

    result[period] = _rsi_val(avg_gain, avg_loss)

    for i in range(period, len(diffs)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        result[i + 1] = _rsi_val(avg_gain, avg_loss)

    return result


def _rsi_signals(
    closes: list[float],
    period: int = 14,
    oversold: float = 30.0,
    overbought: float = 70.0,
) -> list[str]:
    """Return "BUY" when RSI crosses up from oversold; "SELL" when crosses down from overbought."""
    rsi = _rsi_series(closes, period)
    signals = ["HOLD"] * len(closes)
    for i in range(1, len(closes)):
        r = rsi[i]
        r_prev = rsi[i - 1]
        if r is None or r_prev is None:
            continue
        if r_prev <= oversold and r > oversold:
            signals[i] = "BUY"
        elif r_prev >= overbought and r < overbought:
            signals[i] = "SELL"
    return signals


# ── Trade simulation ──────────────────────────────────────────────────────────

def _simulate_trades(
    closes: list[float],
    ts_events: list[int],
    signals: list[str],
    trade_size: int,
) -> list[dict]:
    """Simulate long/short trades based on BUY/SELL signals. Returns closed trade dicts."""
    position = 0  # 0=flat, 1=long, -1=short
    entry_price: float | None = None
    entry_ts_ns: int | None = None
    trades: list[dict] = []

    for price, ts, signal in zip(closes, ts_events, signals):
        if signal == "BUY" and position <= 0:
            if position < 0 and entry_price is not None:
                pnl = (entry_price - price) * trade_size
                trades.append({
                    "entry_ts_ns": entry_ts_ns,
                    "exit_ts_ns": ts,
                    "side": "SHORT",
                    "entry_price": entry_price,
                    "exit_price": price,
                    "qty": float(trade_size),
                    "pnl": round(pnl, 6),
                })
            entry_price = price
            entry_ts_ns = ts
            position = 1
        elif signal == "SELL" and position >= 0:
            if position > 0 and entry_price is not None:
                pnl = (price - entry_price) * trade_size
                trades.append({
                    "entry_ts_ns": entry_ts_ns,
                    "exit_ts_ns": ts,
                    "side": "LONG",
                    "entry_price": entry_price,
                    "exit_price": price,
                    "qty": float(trade_size),
                    "pnl": round(pnl, 6),
                })
            entry_price = price
            entry_ts_ns = ts
            position = -1

    # Close any open position at last bar
    if position != 0 and entry_price is not None and closes:
        last_price = closes[-1]
        last_ts = ts_events[-1]
        pnl = (last_price - entry_price) * trade_size if position > 0 else (entry_price - last_price) * trade_size
        trades.append({
            "entry_ts_ns": entry_ts_ns,
            "exit_ts_ns": last_ts,
            "side": "LONG" if position > 0 else "SHORT",
            "entry_price": entry_price,
            "exit_price": last_price,
            "qty": float(trade_size),
            "pnl": round(pnl, 6),
        })

    return trades


# ── Stats ─────────────────────────────────────────────────────────────────────

def _compute_stats(closes: list[float], ts_events: list[int], trades: list[dict]) -> dict:
    """Compute performance stats from trades and bar returns."""
    bar_returns = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(1, len(closes))
        if closes[i - 1] > 0
    ]

    sharpe: float | None = None
    sortino: float | None = None
    volatility: float | None = None
    if len(bar_returns) >= 2:
        vol_daily = _st.stdev(bar_returns)
        volatility = vol_daily * math.sqrt(252)
        mean_r = _st.mean(bar_returns)
        if vol_daily > 1e-10:
            sharpe = mean_r / vol_daily * math.sqrt(252)
        downside = [r for r in bar_returns if r < 0]
        if len(downside) >= 2:
            dd_std = _st.stdev(downside)
            if dd_std > 1e-10:
                sortino = mean_r / dd_std * math.sqrt(252)

    # Max drawdown from cumulative PnL series
    max_drawdown: float | None = None
    if trades:
        cum = 0.0
        peak = 0.0
        worst = 0.0
        for t in trades:
            cum += t["pnl"] or 0.0
            if cum > peak:
                peak = cum
            dd = (cum - peak) / peak if peak > 0 else 0.0
            if dd < worst:
                worst = dd
        max_drawdown = worst if worst != 0.0 else None

    pnls = [t["pnl"] for t in trades if t["pnl"] is not None]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    total_pnl = sum(pnls) if pnls else None
    win_rate = len(wins) / len(pnls) if pnls else None
    avg_win = sum(wins) / len(wins) if wins else None
    avg_loss = sum(losses) / len(losses) if losses else None
    pl_ratio = (avg_win / abs(avg_loss)) if (avg_win and avg_loss) else None

    # total_pnl_pct relative to first bar price (proxy for starting capital unit)
    total_pnl_pct: float | None = None
    if total_pnl is not None and closes:
        total_pnl_pct = total_pnl / closes[0] if closes[0] > 0 else None

    return {
        "bar_count": len(closes),
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "max_drawdown": max_drawdown,
        "volatility": volatility,
        "total_pnl": total_pnl,
        "total_pnl_pct": total_pnl_pct,
        "win_rate": win_rate,
        "profit_loss_ratio": pl_ratio,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "trades": trades,
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def run_simple_backtest(bars: list, strategy: str, params: dict) -> dict:
    """Run MACD or RSI backtest on the given bars. Returns same dict format as run_backtest."""
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
    else:
        raise ValueError(f"unknown strategy {strategy!r}")

    trades = _simulate_trades(closes, ts_events, signals, trade_size)
    return _compute_stats(closes, ts_events, trades)
```

- [ ] **Step 2: Write the failing tests in `tests/test_simple_runner.py`**

```python
import pytest
from backtest_runner.simple_runner import (
    _ema_series,
    _macd_signals,
    _rsi_series,
    _rsi_signals,
    _simulate_trades,
    run_simple_backtest,
)


class _FakeBar:
    def __init__(self, close: float, ts_event: int):
        self.close = close
        self.ts_event = ts_event


def test_ema_series_warmup_is_none():
    vals = [1.0, 2.0, 3.0, 4.0, 5.0]
    emas = _ema_series(vals, period=3)
    assert emas[0] is None
    assert emas[1] is None
    assert emas[2] == pytest.approx(2.0)  # (1+2+3)/3


def test_ema_series_too_short_returns_all_none():
    emas = _ema_series([1.0, 2.0], period=5)
    assert all(v is None for v in emas)


def test_macd_signals_length_matches_input():
    closes = [float(i) for i in range(50)]
    sigs = _macd_signals(closes, fast=5, slow=10, signal_period=3)
    assert len(sigs) == 50


def test_macd_signals_only_valid_values():
    closes = [float(i) for i in range(50)]
    sigs = _macd_signals(closes, fast=5, slow=10, signal_period=3)
    assert all(s in {"BUY", "SELL", "HOLD"} for s in sigs)


def test_rsi_series_range():
    """RSI values must be in [0, 100]."""
    closes = [100 + ((-1) ** i) * (i % 5) for i in range(30)]
    rsi = _rsi_series(closes, period=14)
    for v in rsi:
        if v is not None:
            assert 0 <= v <= 100


def test_rsi_signals_buy_on_oversold_cross():
    """Force RSI to rise above 30 — expect BUY signal."""
    # Create a sequence: declining prices (pushes RSI low), then strong recovery
    closes = [100 - i * 2 for i in range(20)] + [70 + i * 5 for i in range(10)]
    signals = _rsi_signals(closes, period=14, oversold=30, overbought=70)
    assert any(s == "BUY" for s in signals)


def test_simulate_trades_long_exit_pnl():
    closes = [100.0, 100.0, 110.0]
    ts = [1_000_000, 2_000_000, 3_000_000]
    signals = ["BUY", "HOLD", "SELL"]
    trades = _simulate_trades(closes, ts, signals, trade_size=5)
    # BUY at 100, SELL at 110 → PnL = (110-100)*5 = 50
    assert len(trades) == 1
    assert trades[0]["pnl"] == pytest.approx(50.0)
    assert trades[0]["side"] == "LONG"


def test_simulate_trades_open_position_closed_at_last_bar():
    closes = [100.0, 105.0]
    ts = [1_000_000, 2_000_000]
    signals = ["BUY", "HOLD"]
    trades = _simulate_trades(closes, ts, signals, trade_size=10)
    # BUY at 100, auto-closed at 105 → PnL = (105-100)*10 = 50
    assert len(trades) == 1
    assert trades[0]["exit_price"] == 105.0


def test_run_simple_backtest_macd_returns_dict():
    bars = [_FakeBar(100 + i % 10, i * 1_000_000) for i in range(60)]
    result = run_simple_backtest(bars, "macd", {"fast": 5, "slow": 10, "signal_period": 3, "trade_size": 5})
    assert "sharpe_ratio" in result
    assert "trades" in result
    assert result["bar_count"] == 60


def test_run_simple_backtest_rsi_returns_dict():
    bars = [_FakeBar(100 + ((-1) ** i) * (i % 8), i * 1_000_000) for i in range(60)]
    result = run_simple_backtest(bars, "rsi", {"period": 14, "oversold": 30, "overbought": 70, "trade_size": 5})
    assert "sharpe_ratio" in result
    assert result["bar_count"] == 60
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_simple_runner.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` — `simple_runner.py` doesn't exist yet.

- [ ] **Step 4: Run tests with the implementation**

After creating the file in Step 1:

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_simple_runner.py -v
```

Expected: 9/9 PASS.

- [ ] **Step 5: Run full test suite**

```bash
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: all previously passing tests still pass + 9 new.

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add backtest_runner/simple_runner.py tests/test_simple_runner.py
git commit -m "feat: add pure-Python MACD and RSI backtester (simple_runner)"
```

---

### Task 2: Backend — main.py MACD/RSI routing + optimize endpoint + tests

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py`
- Create: `seokminal-multi-venue/tests/test_backtest_optimize.py`

**Interfaces:**
- Consumes from Task 1:
  ```python
  from backtest_runner.simple_runner import run_simple_backtest
  # run_simple_backtest(bars, strategy, params) -> dict
  ```
- Produces:
  - `GET /backtest?strategy=macd&fast=12&slow=26&signal_period=9&trade_size=10&...` → `BacktestResponse`
  - `GET /backtest?strategy=rsi&period=14&oversold=30&overbought=70&trade_size=10&...` → `BacktestResponse`
  - `GET /backtest/optimize?instrument_id=...&start=...&end=...&strategy=macd` → `BestParamsResponse`
  - MACD query params: `fast: int = 12`, `slow: int = 26`, `signal_period: int = 9`
  - RSI query params: `period: int = 14`, `oversold: float = 30`, `overbought: float = 70`

- [ ] **Step 1: Write failing tests**

Create `seokminal-multi-venue/tests/test_backtest_optimize.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api_server.main import app

client = TestClient(app)


def _fake_simple_backtest(bars, strategy, params):
    sharpe = sum(p for p in params.values() if isinstance(p, (int, float))) / 100.0
    return {
        "bar_count": len(bars), "sharpe_ratio": sharpe, "sortino_ratio": None,
        "max_drawdown": None, "volatility": None, "total_pnl": 0.0,
        "total_pnl_pct": 0.0, "win_rate": None, "profit_loss_ratio": None,
        "avg_win": None, "avg_loss": None, "trades": [],
    }


def _fake_bars(n=50):
    bar = MagicMock()
    bar.close = 100.0
    bar.ts_event = 1_000_000_000
    return [bar] * n


def test_backtest_optimize_macd_returns_best_params():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.run_simple_backtest", side_effect=_fake_simple_backtest),
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
    ):
        mock_cat.return_value.bars.return_value = _fake_bars()
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()

        r = client.get("/backtest/optimize?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2024-12-31&strategy=macd")
    assert r.status_code == 200
    data = r.json()
    assert "best_params" in data
    assert "best_sharpe" in data
    assert data["combinations_tested"] > 0


def test_backtest_optimize_rsi_returns_best_params():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.run_simple_backtest", side_effect=_fake_simple_backtest),
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
    ):
        mock_cat.return_value.bars.return_value = _fake_bars()
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()

        r = client.get("/backtest/optimize?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2024-12-31&strategy=rsi")
    assert r.status_code == 200
    data = r.json()
    assert "best_params" in data
    assert data["combinations_tested"] > 0


def test_backtest_optimize_invalid_strategy_returns_400():
    r = client.get("/backtest/optimize?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2024-12-31&strategy=ema_cross")
    assert r.status_code == 400


def test_backtest_macd_strategy_returns_200():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.run_simple_backtest") as mock_run,
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
    ):
        mock_cat.return_value.bars.return_value = _fake_bars()
        mock_run.return_value = {
            "bar_count": 50, "sharpe_ratio": 0.5, "sortino_ratio": None,
            "max_drawdown": -0.1, "volatility": 0.2, "total_pnl": 100.0,
            "total_pnl_pct": 0.1, "win_rate": 0.6, "profit_loss_ratio": 1.5,
            "avg_win": 20.0, "avg_loss": -10.0, "trades": [],
        }
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()

        r = client.get("/backtest?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2024-12-31&strategy=macd&fast=12&slow=26&signal_period=9")
    assert r.status_code == 200
    data = r.json()
    assert "sharpe_ratio" in data
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_backtest_optimize.py -v
```

Expected: 3 FAIL (optimize endpoint doesn't exist; MACD strategy not supported).

- [ ] **Step 3: Add to `api_server/main.py`**

**3a — Add import at top of file (find the existing imports section):**
```python
from backtest_runner.simple_runner import run_simple_backtest
```

**3b — Extend `SUPPORTED_STRATEGIES` (around line 151):**
```python
SUPPORTED_STRATEGIES = {"ema_cross", "gated", "macd", "rsi"}
```

**3c — Add query params to `get_backtest` function signature (after `spawn_rules` param):**
```python
    # MACD params
    signal_period: int = Query(9, description="MACD signal EMA period"),
    # RSI params
    period: int = Query(14, description="RSI period"),
    oversold: float = Query(30.0, description="RSI oversold threshold"),
    overbought: float = Query(70.0, description="RSI overbought threshold"),
```

**3d — Add MACD/RSI routing in `get_backtest` body (add before the `try: report = run_backtest(...)` block):**

```python
    # Route MACD and RSI to the pure-Python simple runner
    if strategy in {"macd", "rsi"}:
        catalog = ParquetDataCatalog(CATALOG_PATH)
        all_bars = catalog.bars(bar_types=[bar_type_str])
        simple_bars = [b for b in all_bars if start_ns <= b.ts_event <= end_ns]
        if not simple_bars:
            raise HTTPException(status_code=400, detail=f"no bars found for {instrument_id!r}")
        if strategy == "macd":
            simple_params = {"fast": fast, "slow": slow, "signal_period": signal_period, "trade_size": trade_size}
        else:
            simple_params = {"period": period, "oversold": oversold, "overbought": overbought, "trade_size": trade_size}
        try:
            report = run_simple_backtest(simple_bars, strategy, simple_params)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return BacktestResponse(
            sharpe_ratio=report["sharpe_ratio"],
            sortino_ratio=report.get("sortino_ratio"),
            max_drawdown=report.get("max_drawdown"),
            volatility=report.get("volatility"),
            beta=None,
            total_pnl=report.get("total_pnl"),
            total_pnl_pct=report.get("total_pnl_pct"),
            win_rate=report.get("win_rate"),
            profit_loss_ratio=report.get("profit_loss_ratio"),
            avg_win=report.get("avg_win"),
            avg_loss=report.get("avg_loss"),
            bar_count=report["bar_count"],
            trades=[TradeRecord(**t) for t in report.get("trades", [])],
        )
```

**3e — Add `BestParamsResponse` model and `GET /backtest/optimize` endpoint.**

Add the model near the other response models (e.g., after `BacktestResponse`):
```python
class BestParamsResponse(BaseModel):
    best_params: dict
    best_sharpe: float | None
    combinations_tested: int
```

Add the endpoint. **IMPORTANT: it must be placed BEFORE `GET /backtest` (line ~154) in the file, or at minimum not after a catch-all.** Place it right before the existing `@app.get("/backtest", ...)` decorator:

```python
@app.get("/backtest/optimize", response_model=BestParamsResponse)
def optimize_backtest(
    instrument_id: str = Query(...),
    start: dt.date = Query(...),
    end: dt.date = Query(...),
    strategy: str = Query(..., description="'macd' or 'rsi'"),
) -> BestParamsResponse:
    if strategy not in {"macd", "rsi"}:
        raise HTTPException(status_code=400, detail="optimize only supports 'macd' or 'rsi'")

    start_ns = date_to_ns(start.isoformat())
    end_ns = date_to_ns(end.isoformat())
    bar_type_str = str(bar_type_for(InstrumentId.from_str(instrument_id)))
    catalog = ParquetDataCatalog(CATALOG_PATH)
    all_bars = catalog.bars(bar_types=[bar_type_str])
    bars = [b for b in all_bars if start_ns <= b.ts_event <= end_ns]
    if not bars:
        raise HTTPException(status_code=400, detail=f"no bars found for {instrument_id!r}")

    if strategy == "macd":
        grid = [
            {"fast": f, "slow": s, "signal_period": sig, "trade_size": 10}
            for f in [8, 10, 12]
            for s in [20, 24, 26]
            for sig in [7, 9, 11]
            if f < s
        ]
    else:  # rsi
        grid = [
            {"period": p, "oversold": float(os), "overbought": float(ob), "trade_size": 10}
            for p in [10, 14, 18]
            for os in [25, 30, 35]
            for ob in [65, 70, 75]
        ]

    best_sharpe: float | None = None
    best_params: dict = grid[0]

    for params in grid:
        try:
            report = run_simple_backtest(bars, strategy, params)
            sh = report.get("sharpe_ratio")
            if sh is not None and (best_sharpe is None or sh > best_sharpe):
                best_sharpe = sh
                best_params = dict(params)
        except Exception:
            continue

    return BestParamsResponse(
        best_params=best_params,
        best_sharpe=best_sharpe,
        combinations_tested=len(grid),
    )
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_backtest_optimize.py -v
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: 4 new tests pass; all previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_backtest_optimize.py
git commit -m "feat: add MACD/RSI backtest support and grid-search optimize endpoint"
```

---

### Task 3: Frontend — api.ts additions + tests

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts`
- Create: `seokminal-dashboard/tests/lib/api-backtest-optimize.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface OptimizeResponse {
    best_params: Record<string, number>;
    best_sharpe: number | null;
    combinations_tested: number;
  }
  export async function runBacktestOptimize(
    instrumentId: string,
    start: string,
    end: string,
    strategy: "macd" | "rsi",
    signal?: AbortSignal,
  ): Promise<OptimizeResponse>
  ```

- [ ] **Step 1: Write failing tests**

Create `seokminal-dashboard/tests/lib/api-backtest-optimize.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { runBacktestOptimize, ApiError } from "../../lib/api";

describe("runBacktestOptimize", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns OptimizeResponse on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        best_params: { fast: 10, slow: 24, signal_period: 9, trade_size: 10 },
        best_sharpe: 0.83,
        combinations_tested: 27,
      }),
    } as Response);
    const result = await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "macd");
    expect(result.best_sharpe).toBe(0.83);
    expect(result.combinations_tested).toBe(27);
    expect(result.best_params.fast).toBe(10);
  });

  it("throws ApiError on 400", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ detail: "optimize only supports 'macd' or 'rsi'" }),
    } as Response);
    await expect(runBacktestOptimize("X", "2024-01-01", "2024-12-31", "rsi")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ best_params: {}, best_sharpe: null, combinations_tested: 0 }),
    } as Response);
    const ctrl = new AbortController();
    await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "macd", ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });

  it("includes strategy in URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ best_params: {}, best_sharpe: null, combinations_tested: 0 }),
    } as Response);
    await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "rsi");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("strategy=rsi");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- tests/lib/api-backtest-optimize.test.ts
```

Expected: FAIL — `runBacktestOptimize` not exported.

- [ ] **Step 3: Add to `lib/api.ts`**

Add after the existing `getBacktest` function (around line 172):

```typescript
export interface OptimizeResponse {
  best_params: Record<string, number>;
  best_sharpe: number | null;
  combinations_tested: number;
}

export async function runBacktestOptimize(
  instrumentId: string,
  start: string,
  end: string,
  strategy: "macd" | "rsi",
  signal?: AbortSignal,
): Promise<OptimizeResponse> {
  const params = new URLSearchParams({
    instrument_id: instrumentId,
    start,
    end,
    strategy,
  });
  return handleResponse<OptimizeResponse>(
    await fetch(`${API_URL}/backtest/optimize?${params.toString()}`, { signal })
  );
}
```

- [ ] **Step 4: Run tests + tsc**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test
npx tsc --noEmit
```

Expected: 169 + 4 = 173 tests pass, 0 TS errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts tests/lib/api-backtest-optimize.test.ts
git commit -m "feat: add OptimizeResponse type and runBacktestOptimize API function"
```

---

### Task 4: Frontend — backtest page UI (MACD/RSI selector + Optimize button)

**Files:**
- Modify: `seokminal-dashboard/app/backtest/page.tsx`

**Interfaces:**
- Consumes from Task 3: `runBacktestOptimize`, `OptimizeResponse` from `@/lib/api`
- Consumes existing: `getBacktest` (unchanged signature), `BacktestResponse`
- No new tests for this task (UI-only, no logic to unit-test)

**Context — read before editing:**
- Current "single" mode shows `<SingleStrategyForm fast={fast} slow={slow} .../>` 
- Current strategy sent to API: `mode === "single" ? "ema_cross" : "gated"`
- Current params sent: `{ fast, slow }` or `{ spawn_rules }`
- Read the full file before modifying to understand all state variables and how `run()` is called

**Changes needed:**

1. Add state: `const [strategyType, setStrategyType] = useState<"ema_cross" | "macd" | "rsi">("ema_cross")`
2. Add MACD params state: `const [macdFast, setMacdFast] = useState(12)`, `const [macdSlow, setMacdSlow] = useState(26)`, `const [macdSignal, setMacdSignal] = useState(9)`
3. Add RSI params state: `const [rsiPeriod, setRsiPeriod] = useState(14)`, `const [rsiOversold, setRsiOversold] = useState(30)`, `const [rsiOverbought, setRsiOverbought] = useState(70)`
4. Add optimize state: `const [optimizing, setOptimizing] = useState(false)`, `const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null)`
5. Update `run()` to pass the right strategy/params based on `strategyType`
6. Add `optimize()` function using AbortController + `runBacktestOptimize`
7. UI additions within `mode === "single"` section:
   - Strategy type selector: 3 pill buttons "EMA Cross" | "MACD" | "RSI" — active style `border-accent text-accent bg-accent/10`
   - When MACD: 3 number inputs (Fast, Slow, Signal Period) using `className="w-12"` or `className="w-14"`
   - When RSI: 3 number inputs (Period, Oversold, Overbought) using `className="w-12"`
   - Optimize button (below params, only for MACD/RSI): `bg-accent text-black px-3 py-1 rounded text-sm`
   - Optimize result display: "Best: Sharpe 0.83 | Fast=10 Slow=24 Signal=9 (27 combos)" in `text-text-3 text-xs`
   - "Apply" small button next to optimize result to auto-fill params from best_params

**`optimize()` function (AbortController pattern):**
```typescript
const optimizeCtrlRef = useRef<AbortController | null>(null);

async function optimize() {
  if (optimizeCtrlRef.current) optimizeCtrlRef.current.abort();
  const ctrl = new AbortController();
  optimizeCtrlRef.current = ctrl;
  setOptimizing(true);
  setOptimizeResult(null);
  try {
    const res = await runBacktestOptimize(instrumentId, start, end, strategyType as "macd" | "rsi", ctrl.signal);
    if (!ctrl.signal.aborted) setOptimizeResult(res);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") return;
  } finally {
    if (!ctrl.signal.aborted) setOptimizing(false);
  }
}
```

**Update `run()` function:**
In the `if (mode === "single")` block, replace the hardcoded `"ema_cross"` strategy and `{ fast, slow }` params:
```typescript
if (mode === "single") {
  let strategy: string;
  let strategyParams: Record<string, string>;
  if (strategyType === "macd") {
    strategy = "macd";
    strategyParams = { fast: String(macdFast), slow: String(macdSlow), signal_period: String(macdSignal) };
  } else if (strategyType === "rsi") {
    strategy = "rsi";
    strategyParams = { period: String(rsiPeriod), oversold: String(rsiOversold), overbought: String(rsiOverbought) };
  } else {
    strategy = "ema_cross";
    strategyParams = { fast: String(fast), slow: String(slow) };
  }
  // ... rest of run() unchanged, use strategy and strategyParams instead of hardcoded
}
```

**"Apply best params" onClick:**
```typescript
function applyBestParams() {
  if (!optimizeResult) return;
  const p = optimizeResult.best_params;
  if (strategyType === "macd") {
    if (p.fast) setMacdFast(p.fast);
    if (p.slow) setMacdSlow(p.slow);
    if (p.signal_period) setMacdSignal(p.signal_period);
  } else if (strategyType === "rsi") {
    if (p.period) setRsiPeriod(p.period);
    if (p.oversold) setRsiOversold(p.oversold);
    if (p.overbought) setRsiOverbought(p.overbought);
  }
}
```

**Unmount cleanup** (add to existing `useEffect` cleanup):
```typescript
return () => {
  // ... existing cleanup
  if (optimizeCtrlRef.current) optimizeCtrlRef.current.abort();
};
```

- [ ] **Step 1: Read `app/backtest/page.tsx` fully before modifying**

```bash
cat -n /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/backtest/page.tsx
```

Understand all existing state, imports, and the `run()` function logic before making changes.

- [ ] **Step 2: Make the changes to `app/backtest/page.tsx`**

Add all new state, `optimize()`, `applyBestParams()`, update `run()`, add UI within the `{mode === "single" && (...)}` block.

- [ ] **Step 3: Run tsc + tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
npm test
```

Expected: 0 TS errors, 173/173 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/backtest/page.tsx
git commit -m "feat: add MACD/RSI strategy selector and parameter optimizer to backtest page"
```

---

## Self-Review

**Spec coverage:**
- ✅ MACD strategy: `_macd_signals` with fast/slow/signal_period (Task 1)
- ✅ RSI strategy: `_rsi_signals` with period/oversold/overbought (Task 1)
- ✅ `run_simple_backtest` returns same dict format as `run_backtest` (Task 1)
- ✅ `GET /backtest?strategy=macd` and `?strategy=rsi` (Task 2)
- ✅ `GET /backtest/optimize` grid search → `BestParamsResponse` (Task 2)
- ✅ Optimize endpoint 400 for non-macd/rsi strategies (Task 2)
- ✅ `runBacktestOptimize` in `lib/api.ts` (Task 3)
- ✅ Strategy type selector in backtest page (Task 4)
- ✅ MACD/RSI param inputs (Task 4)
- ✅ Optimize button + apply best params (Task 4)

**Routing:** `GET /backtest/optimize` must be placed BEFORE `GET /backtest` in main.py. FastAPI uses registration order and `/backtest/optimize` is more specific, but explicit ordering is safest.

**Type consistency:**
- `OptimizeResponse.best_params: Record<string, number>` ↔ backend `dict` (JSON object with number values) ✅
- `applyBestParams()` reads `p.fast`, `p.signal_period` — these match the keys set by the backend grid ✅
- `strategyType as "macd" | "rsi"` cast in `optimize()` is safe because the button only shows when strategyType is "macd" or "rsi" ✅
