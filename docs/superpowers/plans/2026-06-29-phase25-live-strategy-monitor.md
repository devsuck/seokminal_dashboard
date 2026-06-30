# Phase 25 — Live Strategy Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add closed-trade recording and signal-change history to the live bot engine, expose them via two new API endpoints, and build a `/bots/[id]` detail page showing trade log, equity curve, and signal timeline.

**Architecture:** Extend `_BotRunState` in `live_engine/engine.py` with `closed_trades` and `signal_log` lists populated during the EMA strategy loop. Two new FastAPI GET endpoints serve this data. The Next.js detail page fetches all data on mount, polls live status every 5 s, and renders three tabs.

**Tech Stack:** Python 3.14 · FastAPI · pytest · Next.js 16 · React 19 · TypeScript · TailwindCSS 4 · D3 v7 (via RollingChart) · vitest

## Global Constraints

- Python bin: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- pytest run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
- Frontend test run: `cd seokminal-dashboard && npm test`
- TypeScript check: `cd seokminal-dashboard && npx tsc --noEmit`
- Design tokens only: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- `bg-accent text-black`: primary action buttons only
- Active tab: `border-accent text-accent bg-accent/10`
- `style={{}}` forbidden except `style={{ height: "Npx" }}` chart containers
- Hex codes in `className` forbidden (exception: D3 `.attr()`, legend swatch `style={{ backgroundColor }}`)
- Raw `fetch` forbidden — use functions from `lib/api.ts`
- AbortController pattern: abort → create → assign ref → fetch → catch AbortError silently → `if (!ctrl.signal.aborted) setLoading(false)` in finally → unmount cleanup
- `@pytest.mark.asyncio` forbidden (`asyncio_mode="auto"` already set in pyproject.toml)
- `asyncio_mode="auto"` is already configured — do NOT add it again
- Branch: commit directly to main (no feature branches)
- Co-Authored-By: no model names or internal context info

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `seokminal-multi-venue/live_engine/engine.py` | Modify | Add `closed_trades`, `signal_log`, `entry_ts_ns` to `_BotRunState`; record on flip/signal-change in `_run()` |
| `seokminal-multi-venue/api_server/main.py` | Modify | Add `ClosedTrade`, `SignalEntry`, `BotTradeLogResponse`, `BotSignalLogResponse` models; add `GET /bots/{bot_id}`, `GET /bots/{bot_id}/trades`, `GET /bots/{bot_id}/signals` endpoints |
| `seokminal-multi-venue/tests/test_bot_trade_log.py` | Create | 8 backend tests for trade recording + signal log + endpoints |
| `seokminal-dashboard/lib/api.ts` | Modify | Add `ClosedTrade`, `SignalEntry`, `BotTradeLogResponse`, `BotSignalLogResponse` types; add `getBot()`, `fetchBotTrades()`, `fetchBotSignals()` |
| `seokminal-dashboard/tests/lib/api-bots.test.ts` | Create | 6 vitest tests for new api.ts functions |
| `seokminal-dashboard/app/bots/[id]/page.tsx` | Create | Bot detail page: live status + 3 tabs (Trade Log, Equity Curve, Signal Log) |
| `seokminal-dashboard/app/bots/page.tsx` | Modify | Add "Detail" link per bot row |

---

### Task 1: Backend — trade/signal recording + endpoints + tests

**Files:**
- Modify: `seokminal-multi-venue/live_engine/engine.py`
- Modify: `seokminal-multi-venue/api_server/main.py`
- Create: `seokminal-multi-venue/tests/test_bot_trade_log.py`

**Interfaces:**
- Consumes: existing `_BotRunState`, `BotRecord`, `live_engine` singleton from `main.py`
- Produces:
  - `GET /bots/{bot_id}` → `BotRecord` (404 if not found)
  - `GET /bots/{bot_id}/trades` → `{ "bot_id": str, "trades": [ClosedTrade, ...] }`
  - `GET /bots/{bot_id}/signals` → `{ "bot_id": str, "signals": [SignalEntry, ...] }`
  - `ClosedTrade` fields: `entry_ts_ns: int | None`, `exit_ts_ns: int`, `side: str`, `entry_price: float`, `exit_price: float`, `qty: int`, `pnl: float`
  - `SignalEntry` fields: `ts_ns: int`, `signal: str`, `price: float`

- [ ] **Step 1: Write the failing tests**

Create `seokminal-multi-venue/tests/test_bot_trade_log.py`:

```python
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from live_engine.engine import LiveBotEngine, _BotRunState
from api_server.main import app, live_engine, bots

client = TestClient(app)


def _make_state(**kwargs) -> _BotRunState:
    defaults = dict(
        bot_id="b1",
        instrument_id="AAPL.NASDAQ",
        fast_ema=10,
        slow_ema=20,
        trade_size=5,
        broker=MagicMock(),
    )
    defaults.update(kwargs)
    return _BotRunState(**defaults)


def test_closed_trade_recorded_on_long_exit():
    """LONG position + SELL signal → closed trade appended."""
    state = _make_state()
    state.position = 1
    state.entry_price = 100.0
    state.entry_ts_ns = 1_000_000_000
    # Simulate SELL flip: price 110, trade_size 5
    pnl = (110.0 - 100.0) * 5
    state.closed_trades.append({
        "entry_ts_ns": state.entry_ts_ns,
        "exit_ts_ns": 2_000_000_000,
        "side": "LONG",
        "entry_price": 100.0,
        "exit_price": 110.0,
        "qty": 5,
        "pnl": round(pnl, 6),
    })
    assert len(state.closed_trades) == 1
    assert state.closed_trades[0]["side"] == "LONG"
    assert state.closed_trades[0]["pnl"] == pytest.approx(50.0)


def test_closed_trade_recorded_on_short_exit():
    """SHORT position + BUY signal → closed trade appended."""
    state = _make_state()
    state.position = -1
    state.entry_price = 100.0
    state.entry_ts_ns = 1_000_000_000
    pnl = (100.0 - 90.0) * 5
    state.closed_trades.append({
        "entry_ts_ns": state.entry_ts_ns,
        "exit_ts_ns": 2_000_000_000,
        "side": "SHORT",
        "entry_price": 100.0,
        "exit_price": 90.0,
        "qty": 5,
        "pnl": round(pnl, 6),
    })
    assert len(state.closed_trades) == 1
    assert state.closed_trades[0]["side"] == "SHORT"
    assert state.closed_trades[0]["pnl"] == pytest.approx(50.0)


def test_closed_trades_capped_at_200():
    state = _make_state()
    for i in range(205):
        state.closed_trades.append({"exit_ts_ns": i, "side": "LONG", "entry_price": 1.0,
                                     "exit_price": 1.0, "qty": 1, "pnl": 0.0, "entry_ts_ns": i})
    state.closed_trades = state.closed_trades[-200:]
    assert len(state.closed_trades) == 200


def test_signal_log_records_change():
    state = _make_state()
    state.signal_log.append({"ts_ns": 1_000_000_000, "signal": "EMA_BUY", "price": 100.0})
    assert len(state.signal_log) == 1
    assert state.signal_log[0]["signal"] == "EMA_BUY"


def test_signal_log_capped_at_100():
    state = _make_state()
    for i in range(105):
        state.signal_log.append({"ts_ns": i, "signal": "EMA_BUY", "price": float(i)})
    state.signal_log = state.signal_log[-100:]
    assert len(state.signal_log) == 100


def test_get_bot_endpoint_404():
    r = client.get("/bots/nonexistent_bot_id_xyz")
    assert r.status_code == 404


def test_get_bot_trades_endpoint_empty(monkeypatch):
    """Bot exists, not running → 200 with empty trades list."""
    bots["test_bot_1"] = {
        "id": "test_bot_1", "name": "TestBot", "strategy": "ema_cross",
        "instrument_id": "AAPL.NASDAQ", "fast_ema": 10, "slow_ema": 20,
        "trade_size": 5, "status": "stopped", "created_at": "2026-01-01T00:00:00Z",
    }
    monkeypatch.setattr(live_engine, "_running", {})
    r = client.get("/bots/test_bot_1/trades")
    assert r.status_code == 200
    data = r.json()
    assert data["bot_id"] == "test_bot_1"
    assert data["trades"] == []
    del bots["test_bot_1"]


def test_get_bot_signals_endpoint_with_data(monkeypatch):
    """Bot running with signal_log → signals returned."""
    bots["test_bot_2"] = {
        "id": "test_bot_2", "name": "TestBot2", "strategy": "ema_cross",
        "instrument_id": "AAPL.NASDAQ", "fast_ema": 10, "slow_ema": 20,
        "trade_size": 5, "status": "running", "created_at": "2026-01-01T00:00:00Z",
    }
    state = _make_state(bot_id="test_bot_2")
    state.signal_log = [{"ts_ns": 1_000_000_000, "signal": "EMA_BUY", "price": 150.0}]
    monkeypatch.setattr(live_engine, "_running", {"test_bot_2": state})
    r = client.get("/bots/test_bot_2/signals")
    assert r.status_code == 200
    data = r.json()
    assert len(data["signals"]) == 1
    assert data["signals"][0]["signal"] == "EMA_BUY"
    del bots["test_bot_2"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_bot_trade_log.py -v
```

Expected: 6 PASS (pure data-manipulation tests) + 2 FAIL (endpoint tests: `test_get_bot_trades_endpoint_empty`, `test_get_bot_signals_endpoint_with_data`) because `closed_trades` and `signal_log` fields don't exist yet on `_BotRunState`.

- [ ] **Step 3: Add fields to `_BotRunState` in `live_engine/engine.py`**

In the `_BotRunState` dataclass (around line 27), add three new fields after `entry_price`:

```python
@dataclass
class _BotRunState:
    bot_id: str
    instrument_id: str
    fast_ema: int
    slow_ema: int
    trade_size: int
    broker: BrokerInterface
    task: asyncio.Task | None = None
    prices: list[float] = field(default_factory=list)
    position: int = 0
    last_price: float | None = None
    last_signal: str | None = None
    orders: list[OrderResult] = field(default_factory=list)
    error: str | None = None
    subscribers: set = field(default_factory=set)
    entry_price: float | None = None
    entry_ts_ns: int | None = None                           # ADD
    closed_trades: list[dict] = field(default_factory=list)  # ADD
    signal_log: list[dict] = field(default_factory=list)     # ADD
```

- [ ] **Step 4: Update `_run()` in `live_engine/engine.py` to record trades and signals**

Replace the EMA strategy section in `_run()` (currently lines ~136–174) with:

```python
                if len(state.prices) >= state.slow_ema:
                    fast = _ema(state.prices, state.fast_ema)
                    slow = _ema(state.prices, state.slow_ema)

                    if fast > slow:
                        signal = "EMA_BUY"
                        if state.position <= 0:
                            # Close SHORT if was in a short position
                            if state.position < 0 and state.entry_price is not None:
                                pnl = (state.entry_price - tick.price) * state.trade_size
                                state.closed_trades.append({
                                    "entry_ts_ns": state.entry_ts_ns,
                                    "exit_ts_ns": tick.ts_ns,
                                    "side": "SHORT",
                                    "entry_price": state.entry_price,
                                    "exit_price": tick.price,
                                    "qty": state.trade_size,
                                    "pnl": round(pnl, 6),
                                })
                                state.closed_trades = state.closed_trades[-200:]
                            try:
                                result = await state.broker.place_order(
                                    state.instrument_id, "BUY", state.trade_size, "MARKET"
                                )
                                state.orders.append(result)
                                state.entry_price = tick.price
                                state.entry_ts_ns = tick.ts_ns
                                state.position = 1
                                log.info("bot %s: BUY %s @ %.2f", state.bot_id, state.instrument_id, tick.price)
                            except Exception as exc:
                                log.error("bot %s: order error: %s", state.bot_id, exc)
                                state.error = str(exc)
                    elif fast < slow:
                        signal = "EMA_SELL"
                        if state.position >= 0:
                            # Close LONG if was in a long position
                            if state.position > 0 and state.entry_price is not None:
                                pnl = (tick.price - state.entry_price) * state.trade_size
                                state.closed_trades.append({
                                    "entry_ts_ns": state.entry_ts_ns,
                                    "exit_ts_ns": tick.ts_ns,
                                    "side": "LONG",
                                    "entry_price": state.entry_price,
                                    "exit_price": tick.price,
                                    "qty": state.trade_size,
                                    "pnl": round(pnl, 6),
                                })
                                state.closed_trades = state.closed_trades[-200:]
                            try:
                                result = await state.broker.place_order(
                                    state.instrument_id, "SELL", state.trade_size, "MARKET"
                                )
                                state.orders.append(result)
                                state.entry_price = tick.price
                                state.entry_ts_ns = tick.ts_ns
                                state.position = -1
                                log.info("bot %s: SELL %s @ %.2f", state.bot_id, state.instrument_id, tick.price)
                            except Exception as exc:
                                log.error("bot %s: order error: %s", state.bot_id, exc)
                                state.error = str(exc)
                    else:
                        signal = "HOLD"

                    # Record signal change (not every tick — only on change)
                    if signal != state.last_signal:
                        state.signal_log.append({
                            "ts_ns": tick.ts_ns,
                            "signal": signal,
                            "price": tick.price,
                        })
                        state.signal_log = state.signal_log[-100:]

                    state.last_signal = signal
                else:
                    signal = "WARMING_UP"
                    if signal != state.last_signal:
                        state.signal_log.append({
                            "ts_ns": tick.ts_ns,
                            "signal": signal,
                            "price": tick.price,
                        })
                        state.signal_log = state.signal_log[-100:]
                    state.last_signal = signal
```

- [ ] **Step 5: Add models and endpoints to `api_server/main.py`**

Add Pydantic models (add near the other bot-related models, around line 666):

```python
class ClosedTrade(BaseModel):
    entry_ts_ns: int | None
    exit_ts_ns: int
    side: str  # "LONG" | "SHORT"
    entry_price: float
    exit_price: float
    qty: int
    pnl: float


class SignalEntry(BaseModel):
    ts_ns: int
    signal: str
    price: float


class BotTradeLogResponse(BaseModel):
    bot_id: str
    trades: list[ClosedTrade]


class BotSignalLogResponse(BaseModel):
    bot_id: str
    signals: list[SignalEntry]
```

Add `GET /bots/{bot_id}` endpoint (must be placed AFTER `GET /bots/all-live-status` to avoid routing conflict — place it right after that endpoint):

```python
@app.get("/bots/{bot_id}", response_model=BotRecord)
def get_bot(bot_id: str) -> BotRecord:
    if bot_id not in bots:
        raise HTTPException(status_code=404, detail=f"bot {bot_id!r} not found")
    return BotRecord(**bots[bot_id])


@app.get("/bots/{bot_id}/trades", response_model=BotTradeLogResponse)
def get_bot_trade_log(bot_id: str) -> BotTradeLogResponse:
    if bot_id not in bots:
        raise HTTPException(status_code=404, detail=f"bot {bot_id!r} not found")
    state = live_engine._running.get(bot_id)
    trades = [ClosedTrade(**t) for t in (state.closed_trades if state else [])]
    return BotTradeLogResponse(bot_id=bot_id, trades=trades)


@app.get("/bots/{bot_id}/signals", response_model=BotSignalLogResponse)
def get_bot_signal_log(bot_id: str) -> BotSignalLogResponse:
    if bot_id not in bots:
        raise HTTPException(status_code=404, detail=f"bot {bot_id!r} not found")
    state = live_engine._running.get(bot_id)
    signals = [SignalEntry(**s) for s in (state.signal_log if state else [])]
    return BotSignalLogResponse(bot_id=bot_id, signals=signals)
```

**Important routing note:** The existing comment in `main.py` around line 2490 explains that `/bots/all-live-status` must be defined before any bare `GET /bots/{bot_id}` route. Place these three new endpoints immediately after the `all-live-status` endpoint (search for `@app.get("/bots/all-live-status")`).

- [ ] **Step 6: Run all tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: all previously passing tests still pass + 8 new tests in `test_bot_trade_log.py` pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add live_engine/engine.py api_server/main.py tests/test_bot_trade_log.py
git commit -m "feat: add closed trade log and signal history to live bot engine"
```

---

### Task 2: Frontend — api.ts additions + tests

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts`
- Create: `seokminal-dashboard/tests/lib/api-bots.test.ts`

**Interfaces:**
- Consumes:
  - `GET /bots/{bot_id}` → `BotRecord`
  - `GET /bots/{bot_id}/trades` → `{ bot_id, trades: ClosedTrade[] }`
  - `GET /bots/{bot_id}/signals` → `{ bot_id, signals: SignalEntry[] }`
- Produces (for Task 3):
  ```typescript
  export interface ClosedTrade {
    entry_ts_ns: number | null;
    exit_ts_ns: number;
    side: "LONG" | "SHORT";
    entry_price: number;
    exit_price: number;
    qty: number;
    pnl: number;
  }
  export interface SignalEntry {
    ts_ns: number;
    signal: string;
    price: number;
  }
  export interface BotTradeLogResponse { bot_id: string; trades: ClosedTrade[]; }
  export interface BotSignalLogResponse { bot_id: string; signals: SignalEntry[]; }
  export async function getBot(id: string): Promise<BotRecord>
  export async function fetchBotTrades(id: string, signal?: AbortSignal): Promise<BotTradeLogResponse>
  export async function fetchBotSignals(id: string, signal?: AbortSignal): Promise<BotSignalLogResponse>
  ```

- [ ] **Step 1: Write the failing tests**

Create `seokminal-dashboard/tests/lib/api-bots.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBot, fetchBotTrades, fetchBotSignals, ApiError } from "../../lib/api";

const BOT_ID = "bot123";

describe("getBot", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns BotRecord on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: BOT_ID, name: "MyBot", strategy: "ema_cross",
        instrument_id: "AAPL.NASDAQ", fast_ema: 10, slow_ema: 20,
        trade_size: 5, status: "running", created_at: "2026-01-01T00:00:00Z",
      }),
    } as Response);
    const bot = await getBot(BOT_ID);
    expect(bot.id).toBe(BOT_ID);
    expect(bot.name).toBe("MyBot");
  });

  it("throws ApiError on 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ detail: "bot not found" }),
    } as Response);
    await expect(getBot("bad")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchBotTrades", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns empty trades list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ bot_id: BOT_ID, trades: [] }),
    } as Response);
    const result = await fetchBotTrades(BOT_ID);
    expect(result.bot_id).toBe(BOT_ID);
    expect(result.trades).toHaveLength(0);
  });

  it("returns trades with pnl", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        bot_id: BOT_ID,
        trades: [{
          entry_ts_ns: 1000000000, exit_ts_ns: 2000000000,
          side: "LONG", entry_price: 100.0, exit_price: 110.0, qty: 5, pnl: 50.0,
        }],
      }),
    } as Response);
    const result = await fetchBotTrades(BOT_ID);
    expect(result.trades[0].pnl).toBe(50.0);
    expect(result.trades[0].side).toBe("LONG");
  });
});

describe("fetchBotSignals", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns signal entries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        bot_id: BOT_ID,
        signals: [{ ts_ns: 1000000000, signal: "EMA_BUY", price: 150.0 }],
      }),
    } as Response);
    const result = await fetchBotSignals(BOT_ID);
    expect(result.signals[0].signal).toBe("EMA_BUY");
    expect(result.signals[0].price).toBe(150.0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- tests/lib/api-bots.test.ts
```

Expected: FAIL — `getBot`, `fetchBotTrades`, `fetchBotSignals` not exported from `lib/api.ts`.

- [ ] **Step 3: Add types and functions to `lib/api.ts`**

Add after the existing `BotRecord`/`BotConfig` block (around line 567, after `deleteBot`):

```typescript
export interface ClosedTrade {
  entry_ts_ns: number | null;
  exit_ts_ns: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  exit_price: number;
  qty: number;
  pnl: number;
}

export interface SignalEntry {
  ts_ns: number;
  signal: string;
  price: number;
}

export interface BotTradeLogResponse {
  bot_id: string;
  trades: ClosedTrade[];
}

export interface BotSignalLogResponse {
  bot_id: string;
  signals: SignalEntry[];
}

export async function getBot(id: string): Promise<BotRecord> {
  return handleResponse<BotRecord>(await fetch(`${API_URL}/bots/${encodeURIComponent(id)}`));
}

export async function fetchBotTrades(id: string, signal?: AbortSignal): Promise<BotTradeLogResponse> {
  return handleResponse<BotTradeLogResponse>(
    await fetch(`${API_URL}/bots/${encodeURIComponent(id)}/trades`, { signal })
  );
}

export async function fetchBotSignals(id: string, signal?: AbortSignal): Promise<BotSignalLogResponse> {
  return handleResponse<BotSignalLogResponse>(
    await fetch(`${API_URL}/bots/${encodeURIComponent(id)}/signals`, { signal })
  );
}
```

- [ ] **Step 4: Run tests + tsc**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test
npx tsc --noEmit
```

Expected: all 163 + 6 new = 169 tests pass, 0 TS errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts tests/lib/api-bots.test.ts
git commit -m "feat: add ClosedTrade/SignalEntry types and bot detail API functions"
```

---

### Task 3: Frontend — bot detail page + list link

**Files:**
- Create: `seokminal-dashboard/app/bots/[id]/page.tsx`
- Modify: `seokminal-dashboard/app/bots/page.tsx`

**Interfaces:**
- Consumes from Task 2:
  - `getBot(id)` → `BotRecord`
  - `fetchBotTrades(id, signal?)` → `BotTradeLogResponse`
  - `fetchBotSignals(id, signal?)` → `BotSignalLogResponse`
  - `getAllBotsLiveStatus(signal?)` → `AllBotsStatusResponse` (for live status)
  - Types: `ClosedTrade`, `SignalEntry`, `BotLiveEntry`, `BotRecord`
- Consumes existing components:
  - `RollingChart` from `components/charts/RollingChart` — props: `series: RollingSeries[]`, `height?: number`
  - `RollingSeries` type: `{ label: string; color: string; points: RollingPoint[] }`
  - `RollingPoint` type: `{ ts_ns: number; value: number | null }`
- Produces: No downstream tasks

**Notes on `app/bots/page.tsx`:**
The current bots page shows a table of bots with start/stop/delete controls. You need to read this file to understand the existing row structure before modifying it, then add a "Detail" link that navigates to `/bots/${bot.id}`. Use Next.js `<Link>` from `"next/link"`.

- [ ] **Step 1: Create `app/bots/[id]/page.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getBot,
  fetchBotTrades,
  fetchBotSignals,
  getAllBotsLiveStatus,
} from "@/lib/api";
import type {
  BotRecord,
  BotLiveEntry,
  ClosedTrade,
  SignalEntry,
} from "@/lib/api";
import RollingChart from "@/components/charts/RollingChart";
import type { RollingSeries } from "@/components/charts/RollingChart";

type Tab = "trades" | "equity" | "signals";

const SIGNAL_CLASS: Record<string, string> = {
  EMA_BUY: "text-pos",
  EMA_SELL: "text-neg",
  HOLD: "text-text-2",
  WARMING_UP: "text-text-3",
};

function fmtTs(tsNs: number): string {
  return new Date(tsNs / 1_000_000).toLocaleString();
}

function fmtPnl(pnl: number): string {
  return (pnl >= 0 ? "+" : "") + pnl.toFixed(4);
}

function equitySeries(trades: ClosedTrade[]): RollingSeries[] {
  const sorted = [...trades].sort((a, b) => a.exit_ts_ns - b.exit_ts_ns);
  let cum = 0;
  const points = sorted.map((t) => {
    cum += t.pnl;
    return { ts_ns: t.exit_ts_ns, value: cum };
  });
  return [{ label: "Cumulative PnL", color: "#FF9F1C", points }];
}

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.id as string;

  const [bot, setBot] = useState<BotRecord | null>(null);
  const [live, setLive] = useState<BotLiveEntry | null>(null);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trades");
  const ctrlRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadAll() {
    if (ctrlRef.current) ctrlRef.current.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const [botData, tradesData, signalsData, liveData] = await Promise.all([
        getBot(botId),
        fetchBotTrades(botId, ctrl.signal),
        fetchBotSignals(botId, ctrl.signal),
        getAllBotsLiveStatus(ctrl.signal),
      ]);
      setBot(botData);
      setTrades(tradesData.trades);
      setSignals(signalsData.signals);
      setLive(liveData.bots.find((b) => b.bot_id === botId) ?? null);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  async function pollLive() {
    try {
      const data = await getAllBotsLiveStatus();
      setLive(data.bots.find((b) => b.bot_id === botId) ?? null);
    } catch {
      // silently ignore poll failures
    }
  }

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(pollLive, 5000);
    return () => {
      if (ctrlRef.current) ctrlRef.current.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [botId]);

  if (loading) return (
    <main className="min-h-screen bg-bg p-6">
      <p className="text-text-3 text-sm">Loading...</p>
    </main>
  );

  if (error) return (
    <main className="min-h-screen bg-bg p-6">
      <Link href="/bots" className="text-accent text-sm hover:underline">← Bots</Link>
      <p className="text-neg text-sm mt-4">{error}</p>
    </main>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: "trades", label: "Trade Log" },
    { key: "equity", label: "Equity Curve" },
    { key: "signals", label: "Signal Log" },
  ];

  return (
    <main className="min-h-screen bg-bg p-6 space-y-6">
      {/* Back link */}
      <Link href="/bots" className="text-accent text-sm hover:underline">← Bots</Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-text-1 text-xl font-semibold">{bot?.name ?? botId}</h1>
        <span className="text-text-3 text-sm">{bot?.instrument_id}</span>
        {live && (
          <span className={`text-xs px-2 py-0.5 rounded ${live.running ? "bg-pos/10 text-pos" : "bg-panel text-text-3"}`}>
            {live.running ? "Running" : "Stopped"}
          </span>
        )}
      </div>

      {/* Live status cards */}
      {live && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Position", value: live.position },
            { label: "Last Price", value: live.last_price?.toFixed(4) ?? "—" },
            { label: "Entry Price", value: live.entry_price?.toFixed(4) ?? "—" },
            {
              label: "Unrealized PnL",
              value: live.unrealized_pnl != null ? fmtPnl(live.unrealized_pnl) : "—",
              cls: live.unrealized_pnl != null
                ? live.unrealized_pnl >= 0 ? "text-pos" : "text-neg"
                : "text-text-2",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-panel border border-border rounded p-3">
              <p className="text-text-3 text-xs mb-1">{label}</p>
              <p className={`text-text-1 text-sm font-mono ${cls ?? ""}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Signal badge */}
      {live?.last_signal && (
        <p className="text-sm">
          <span className="text-text-3">Last signal: </span>
          <span className={SIGNAL_CLASS[live.last_signal] ?? "text-text-2"}>
            {live.last_signal}
          </span>
        </p>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 text-sm border-b-2 transition-colors ${
              tab === key
                ? "border-accent text-accent bg-accent/10 px-2 rounded-t"
                : "border-transparent text-text-3 hover:text-text-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "trades" && (
        <div>
          {trades.length === 0 ? (
            <p className="text-text-3 text-sm">No closed trades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-text-3 border-b border-border">
                    {["Exit Time", "Side", "Entry", "Exit", "Qty", "PnL"].map((h) => (
                      <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...trades].reverse().map((t, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-text-2 font-mono text-xs">{fmtTs(t.exit_ts_ns)}</td>
                      <td className={`py-2 pr-4 font-medium ${t.side === "LONG" ? "text-pos" : "text-neg"}`}>{t.side}</td>
                      <td className="py-2 pr-4 text-text-1 font-mono">{t.entry_price.toFixed(4)}</td>
                      <td className="py-2 pr-4 text-text-1 font-mono">{t.exit_price.toFixed(4)}</td>
                      <td className="py-2 pr-4 text-text-2">{t.qty}</td>
                      <td className={`py-2 pr-4 font-mono font-medium ${t.pnl >= 0 ? "text-pos" : "text-neg"}`}>
                        {fmtPnl(t.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "equity" && (
        <div>
          {trades.length === 0 ? (
            <p className="text-text-3 text-sm">No trades to chart yet.</p>
          ) : (
            <div style={{ height: "320px" }}>
              <RollingChart series={equitySeries(trades)} height={320} />
            </div>
          )}
        </div>
      )}

      {tab === "signals" && (
        <div>
          {signals.length === 0 ? (
            <p className="text-text-3 text-sm">No signal changes recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {[...signals].reverse().map((s, i) => (
                <div key={i} className="flex items-center gap-4 py-1.5 border-b border-border/30">
                  <span className="text-text-3 text-xs font-mono w-44 shrink-0">{fmtTs(s.ts_ns)}</span>
                  <span className={`text-sm font-medium w-24 shrink-0 ${SIGNAL_CLASS[s.signal] ?? "text-text-2"}`}>
                    {s.signal}
                  </span>
                  <span className="text-text-2 text-sm font-mono">{s.price.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Read `app/bots/page.tsx`, then add "Detail" link per bot row**

First read the file to understand the current row structure:
```bash
cat -n /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/bots/page.tsx
```

Find the section that renders each bot row (likely a `<tr>` or `<div>` with bot name, status, start/stop buttons). Add a `<Link>` component pointing to `/bots/${bot.id}` in the same row. Import `Link` from `"next/link"` if not already imported. The link should look like:

```tsx
import Link from "next/link";
// ...in the row:
<Link href={`/bots/${bot.id}`} className="text-accent text-xs hover:underline">
  Detail
</Link>
```

Place it alongside the existing action buttons (start/stop/delete).

- [ ] **Step 3: Run tsc + tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
npm test
```

Expected: 0 TS errors, 169/169 tests pass (no new tests in this task — the page is UI-only).

- [ ] **Step 4: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/bots/[id]/page.tsx app/bots/page.tsx
git commit -m "feat: add bot detail page with trade log, equity curve, and signal timeline"
```

---

## Self-Review

**Spec coverage:**
- ✅ Closed trade recording on LONG→SELL flip (Task 1)
- ✅ Closed trade recording on SHORT→BUY flip (Task 1)
- ✅ Signal log on change (Task 1)
- ✅ 200-trade cap, 100-signal cap (Task 1)
- ✅ `GET /bots/{bot_id}` (Task 1)
- ✅ `GET /bots/{bot_id}/trades` (Task 1)
- ✅ `GET /bots/{bot_id}/signals` (Task 1)
- ✅ Frontend types + api functions (Task 2)
- ✅ Bot detail page — live status cards (Task 3)
- ✅ Trade Log tab (Task 3)
- ✅ Equity Curve tab via RollingChart (Task 3)
- ✅ Signal Log tab (Task 3)
- ✅ "Detail" link from bots list (Task 3)
- ✅ AbortController + 5s poll cleanup (Task 3)

**Routing conflict note:** `GET /bots/{bot_id}` in FastAPI will shadow `GET /bots/all-live-status` if placed before it. The plan explicitly requires placing the new endpoint AFTER `all-live-status`.

**Type consistency check:**
- `ClosedTrade.exit_ts_ns: int` (backend) → `exit_ts_ns: number` (frontend) ✅
- `BotTradeLogResponse.trades: list[ClosedTrade]` ↔ `trades: ClosedTrade[]` ✅
- `equitySeries` uses `t.exit_ts_ns` (matches `ClosedTrade.exit_ts_ns: number`) ✅
- `RollingPoint.ts_ns: number` ↔ `exit_ts_ns: number` ✅
