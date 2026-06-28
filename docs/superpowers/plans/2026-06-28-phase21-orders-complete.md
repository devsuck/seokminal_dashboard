# Phase 21: Orders Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IB manual order endpoints, bot P&L tracking, and complete the Orders UI with US form, cancel/status buttons, and P&L columns.

**Architecture:** Three sequential tasks: (1) IB order endpoints in FastAPI using async IBOrderClient; (2) `entry_price` tracking in the live engine + `unrealized_pnl` in the all-bots-status API; (3) frontend rewrite of the orders page with KR/US tabs, cancel/status actions in the order log, and P&L columns in the bot table.

**Tech Stack:** Python 3.14 / FastAPI (backend), Next.js 16 / React 19 / TypeScript / TailwindCSS 4 (frontend), vitest (frontend tests)

## Global Constraints

- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- `asyncio_mode = "auto"` in pyproject.toml — **never** add `@pytest.mark.asyncio` to any test
- Backend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest <test-file> -v`
- Full suite: `... pytest tests/ -q 2>&1 | tail -5`
- Pre-existing failures (always ignore): `test_backtest_happy_path_returns_all_metric_keys`, `test_auth.py::test_get_access_token_reuses_cached_token`, `test_auth.py::test_get_access_token_refreshes_when_near_expiry`
- Frontend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test`
- Frontend tsc check: `npx tsc --noEmit`
- Design tokens only — no hex in `className`. Tokens: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black` only for primary action buttons (Place Order, Refresh, Cancel, Check)
- Active/selected toggle: `border-accent text-accent bg-accent/10`
- No `style={{}}` except `style={{ height: "Npx" }}` on chart containers
- No raw `fetch` in page files — all API calls via `lib/api.ts` functions
- AbortController pattern: abort prev → new ctrl → assign ref → fetch → catch AbortError silently → finally guard `abortRef.current === ctrl` → unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`
- Backend in `seokminal-multi-venue/`; frontend in `seokminal-dashboard/`
- Git: commit after each subtask completes

---

## Task 1: Backend — IB Order Endpoints

**Repo:** `seokminal-multi-venue/`

**Files:**
- Modify: `api_server/main.py` — add 1 import + 3 models + 3 async endpoints
- Create: `tests/test_orders_us_api.py` — 6 tests

**Interfaces:**
- Produces:
  - `POST /orders/us` body `USOrderRequest` → `USOrderResponse`
  - `POST /orders/us/{order_id}/cancel` (no body, path param `order_id: int`) → `USOrderResponse`
  - `GET /orders/us/{order_id}/status` (path param `order_id: int`) → `USOrderResponse`
  - `USOrderRequest`: `symbol: str`, `side: str`, `quantity: int`, `order_type: str`, `limit_price: float | None = None`
  - `USOrderResponse`: `order_id: int`, `status: str`, `filled: float`, `remaining: float`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/test_orders_us_api.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from api_server.main import app

client = TestClient(app)


def test_place_us_order_invalid_side_returns_400():
    r = client.post("/orders/us", json={
        "symbol": "AAPL", "side": "HOLD", "quantity": 1, "order_type": "MARKET",
    })
    assert r.status_code == 400


def test_place_us_order_limit_without_price_returns_400():
    r = client.post("/orders/us", json={
        "symbol": "AAPL", "side": "BUY", "quantity": 1, "order_type": "LIMIT",
    })
    assert r.status_code == 400


@patch("api_server.main.IBOrderClient")
def test_place_us_order_success(mock_cls):
    mock_inst = MagicMock()
    mock_inst.place_order = AsyncMock(return_value={
        "order_id": 42, "status": "PendingSubmit", "filled": 0.0, "remaining": 1.0,
    })
    mock_cls.return_value = mock_inst

    r = client.post("/orders/us", json={
        "symbol": "AAPL", "side": "BUY", "quantity": 1, "order_type": "MARKET",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["order_id"] == 42
    assert body["status"] == "PendingSubmit"
    assert body["filled"] == 0.0
    assert body["remaining"] == 1.0


@patch("api_server.main.IBOrderClient")
def test_cancel_us_order_success(mock_cls):
    mock_inst = MagicMock()
    mock_inst.cancel_order = AsyncMock(return_value={
        "order_id": 42, "status": "ApiCancelled", "filled": 0.0, "remaining": 1.0,
    })
    mock_cls.return_value = mock_inst

    r = client.post("/orders/us/42/cancel")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ApiCancelled"
    assert body["order_id"] == 42


@patch("api_server.main.IBOrderClient")
def test_get_us_order_status_found(mock_cls):
    mock_inst = MagicMock()
    mock_inst.get_order_status = AsyncMock(return_value={
        "order_id": 42, "status": "Filled", "filled": 1.0, "remaining": 0.0,
    })
    mock_cls.return_value = mock_inst

    r = client.get("/orders/us/42/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "Filled"
    assert body["filled"] == 1.0


@patch("api_server.main.IBOrderClient")
def test_get_us_order_status_not_found_returns_404(mock_cls):
    mock_inst = MagicMock()
    mock_inst.get_order_status = AsyncMock(return_value=None)
    mock_cls.return_value = mock_inst

    r = client.get("/orders/us/9999/status")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orders_us_api.py -v 2>&1 | tail -12
```
Expected: 6 failures (404 or import errors — `IBOrderClient` not in main.py yet).

- [ ] **Step 3: Add import to `api_server/main.py`**

Find the line `from backends.kis.order_client import KISOrderClient` (around line 44) and add **immediately after** it:

```python
from backends.ib.order_client import IBOrderClient
```

- [ ] **Step 4: Add Pydantic models to `api_server/main.py`**

Find the `# ── Orders` section (around line 2295 where `KROrderRequest` lives) and **append after** the existing `KRCancelRequest` class:

```python
class USOrderRequest(BaseModel):
    symbol: str           # e.g. "AAPL"
    side: str             # "BUY" | "SELL"
    quantity: int
    order_type: str       # "MARKET" | "LIMIT"
    limit_price: float | None = None  # required for LIMIT


class USOrderResponse(BaseModel):
    order_id: int
    status: str
    filled: float
    remaining: float
```

- [ ] **Step 5: Add `POST /orders/us` endpoint**

Append after the `get_kr_order_status` endpoint (before the `/bots/all-live-status` comment block):

```python
@app.post("/orders/us", response_model=USOrderResponse)
async def place_us_order(req: USOrderRequest) -> USOrderResponse:
    if req.side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail=f"invalid side: {req.side!r}")
    if req.order_type not in ("MARKET", "LIMIT"):
        raise HTTPException(status_code=400, detail=f"invalid order_type: {req.order_type!r}")
    if req.order_type == "LIMIT" and req.limit_price is None:
        raise HTTPException(status_code=400, detail="limit_price required for LIMIT order")
    try:
        ib_client = IBOrderClient(
            host=os.environ.get("IB_HOST", "127.0.0.1"),
            port=int(os.environ.get("IB_PORT", "7497")),
            client_id=int(os.environ.get("IB_MANUAL_ORDER_CLIENT_ID", "10")),
        )
        result = await ib_client.place_order(
            req.symbol, req.side, req.quantity, req.order_type, req.limit_price
        )
        return USOrderResponse(**result)
    except (ConnectionRefusedError, OSError) as exc:
        raise HTTPException(status_code=503, detail="IB TWS not reachable") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 6: Add `POST /orders/us/{order_id}/cancel` endpoint**

```python
@app.post("/orders/us/{order_id}/cancel", response_model=USOrderResponse)
async def cancel_us_order(order_id: int) -> USOrderResponse:
    try:
        ib_client = IBOrderClient(
            host=os.environ.get("IB_HOST", "127.0.0.1"),
            port=int(os.environ.get("IB_PORT", "7497")),
            client_id=int(os.environ.get("IB_MANUAL_ORDER_CLIENT_ID", "10")),
        )
        result = await ib_client.cancel_order(order_id)
        return USOrderResponse(**result)
    except (ConnectionRefusedError, OSError) as exc:
        raise HTTPException(status_code=503, detail="IB TWS not reachable") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 7: Add `GET /orders/us/{order_id}/status` endpoint**

```python
@app.get("/orders/us/{order_id}/status", response_model=USOrderResponse)
async def get_us_order_status(order_id: int) -> USOrderResponse:
    try:
        ib_client = IBOrderClient(
            host=os.environ.get("IB_HOST", "127.0.0.1"),
            port=int(os.environ.get("IB_PORT", "7497")),
            client_id=int(os.environ.get("IB_MANUAL_ORDER_CLIENT_ID", "10")),
        )
        result = await ib_client.get_order_status(order_id)
    except (ConnectionRefusedError, OSError) as exc:
        raise HTTPException(status_code=503, detail="IB TWS not reachable") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail=f"IB order {order_id!r} not found")
    return USOrderResponse(**result)
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orders_us_api.py -v 2>&1 | tail -12
```
Expected: 6/6 pass.

Full suite regression:
```bash
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q 2>&1 | tail -5
```
Expected: same pre-existing failures only.

- [ ] **Step 9: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_orders_us_api.py
git commit -m "feat(api): add /orders/us endpoints (place/cancel/status)"
```

---

## Task 2: Backend — Bot P&L (Engine + API)

**Repo:** `seokminal-multi-venue/`

**Files:**
- Modify: `live_engine/broker_interface.py` — add `entry_price` field to `BotStatus`
- Modify: `live_engine/engine.py` — add `entry_price` to `_BotRunState`, track in `_run`, expose in `get_status`
- Modify: `api_server/main.py` — add `entry_price`/`unrealized_pnl` to `BotLiveEntry`, add `_compute_unrealized_pnl` helper, update `get_all_bots_live_status`
- Create: `tests/test_live_engine_pnl.py` — 5 tests

**Interfaces:**
- Consumes (from Task 1): unchanged `api_server/main.py` structure
- Produces:
  - `BotStatus.entry_price: float | None` (from `broker_interface.py`)
  - `BotLiveEntry.entry_price: float | None` and `BotLiveEntry.unrealized_pnl: float | None` (from `main.py`)
  - `_compute_unrealized_pnl(position, qty, last_price, entry_price) -> float | None`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/test_live_engine_pnl.py`:

```python
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from live_engine.engine import LiveBotEngine, _BotRunState
from api_server.main import app, _compute_unrealized_pnl

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


def test_get_status_entry_price_none_by_default():
    eng = LiveBotEngine()
    state = _make_state()
    eng._running["b1"] = state
    status = eng.get_status("b1")
    assert status.entry_price is None


def test_get_status_returns_entry_price_when_set():
    eng = LiveBotEngine()
    state = _make_state()
    state.entry_price = 150.0
    state.position = 1
    state.last_price = 155.0
    eng._running["b1"] = state
    status = eng.get_status("b1")
    assert status.entry_price == 150.0


def test_compute_unrealized_pnl_long():
    # entry=100, last=110, qty=5, LONG → (110-100)*5*1 = 50
    pnl = _compute_unrealized_pnl("LONG", 5.0, 110.0, 100.0)
    assert pnl == pytest.approx(50.0)


def test_compute_unrealized_pnl_short():
    # entry=100, last=90, qty=5, SHORT → (90-100)*5*(-1) = 50
    pnl = _compute_unrealized_pnl("SHORT", 5.0, 90.0, 100.0)
    assert pnl == pytest.approx(50.0)


def test_compute_unrealized_pnl_flat_returns_none():
    assert _compute_unrealized_pnl("FLAT", 0.0, 100.0, 100.0) is None


def test_compute_unrealized_pnl_missing_entry_returns_none():
    assert _compute_unrealized_pnl("LONG", 5.0, 110.0, None) is None


def test_compute_unrealized_pnl_missing_last_returns_none():
    assert _compute_unrealized_pnl("LONG", 5.0, None, 100.0) is None
```

Add `import pytest` at the top of the file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_live_engine_pnl.py -v 2>&1 | tail -12
```
Expected: failures — `entry_price` not yet in `BotStatus` or `_BotRunState`.

- [ ] **Step 3: Add `entry_price` to `BotStatus` in `broker_interface.py`**

File: `live_engine/broker_interface.py`

Find the `BotStatus` dataclass (currently ends with `error: str | None = None`) and add one field after `error`:

```python
@dataclass
class BotStatus:
    bot_id: str
    instrument_id: str
    running: bool
    position: str = "FLAT"
    qty: float = 0.0
    last_price: float | None = None
    last_signal: str | None = None
    orders: list[OrderResult] = field(default_factory=list)
    error: str | None = None
    entry_price: float | None = None  # price when current position was opened
```

- [ ] **Step 4: Add `entry_price` to `_BotRunState` in `engine.py`**

File: `live_engine/engine.py`

Find the `_BotRunState` dataclass (currently ends with `subscribers: set = field(default_factory=set)`) and add one field:

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
    entry_price: float | None = None  # price when position was entered
```

- [ ] **Step 5: Track `entry_price` in `engine.py`'s `_run` method**

In the `_run` method, find the two `state.position = 1` and `state.position = -1` assignment lines inside the `try` blocks. Add `state.entry_price = tick.price` immediately **before** each position assignment:

```python
                    if fast > slow:
                        signal = "EMA_BUY"
                        if state.position <= 0:
                            try:
                                result = await state.broker.place_order(
                                    state.instrument_id, "BUY", state.trade_size, "MARKET"
                                )
                                state.orders.append(result)
                                state.entry_price = tick.price  # record entry
                                state.position = 1
                                log.info("bot %s: BUY %s @ %.2f", state.bot_id, state.instrument_id, tick.price)
                            except Exception as exc:
                                log.error("bot %s: order error: %s", state.bot_id, exc)
                                state.error = str(exc)
                    elif fast < slow:
                        signal = "EMA_SELL"
                        if state.position >= 0:
                            try:
                                result = await state.broker.place_order(
                                    state.instrument_id, "SELL", state.trade_size, "MARKET"
                                )
                                state.orders.append(result)
                                state.entry_price = tick.price  # record entry
                                state.position = -1
                                log.info("bot %s: SELL %s @ %.2f", state.bot_id, state.instrument_id, tick.price)
                            except Exception as exc:
                                log.error("bot %s: order error: %s", state.bot_id, exc)
                                state.error = str(exc)
```

- [ ] **Step 6: Expose `entry_price` in `engine.py`'s `get_status`**

Find the `get_status` method. The `return BotStatus(...)` call currently lists all fields. Add `entry_price=state.entry_price` to it:

```python
    def get_status(self, bot_id: str) -> BotStatus | None:
        state = self._running.get(bot_id)
        if state is None:
            return None
        return BotStatus(
            bot_id=bot_id,
            instrument_id=state.instrument_id,
            running=True,
            position="LONG" if state.position > 0 else "SHORT" if state.position < 0 else "FLAT",
            qty=abs(state.position * state.trade_size),
            last_price=state.last_price,
            last_signal=state.last_signal,
            orders=list(state.orders[-20:]),
            error=state.error,
            entry_price=state.entry_price,
        )
```

- [ ] **Step 7: Add `_compute_unrealized_pnl` helper to `api_server/main.py`**

Add this function near the top of the "Orders" section (around where `KROrderRequest` is defined):

```python
def _compute_unrealized_pnl(
    position: str,
    qty: float,
    last_price: float | None,
    entry_price: float | None,
) -> float | None:
    if entry_price is None or last_price is None or position == "FLAT":
        return None
    return (last_price - entry_price) * qty * (1.0 if position == "LONG" else -1.0)
```

- [ ] **Step 8: Update `BotLiveEntry` in `api_server/main.py`**

Find `class BotLiveEntry(BaseModel):` and add two fields:

```python
class BotLiveEntry(BaseModel):
    bot_id: str
    name: str
    instrument_id: str
    running: bool
    position: str
    qty: float
    last_price: float | None
    last_signal: str | None
    error: str | None
    entry_price: float | None = None
    unrealized_pnl: float | None = None
```

- [ ] **Step 9: Update `get_all_bots_live_status` to compute and include P&L**

Find the `get_all_bots_live_status` function and update the running-bot branch to include `entry_price` and `unrealized_pnl`:

```python
@app.get("/bots/all-live-status", response_model=AllBotsStatusResponse)
def get_all_bots_live_status() -> AllBotsStatusResponse:
    bots = _load_bots()
    all_statuses = live_engine.get_all_statuses()
    entries = []
    for bot_id, bot_data in bots.items():
        status = all_statuses.get(bot_id)
        if status is not None:
            pnl = _compute_unrealized_pnl(
                status.position, status.qty, status.last_price, status.entry_price
            )
            entries.append(
                BotLiveEntry(
                    bot_id=bot_id,
                    name=bot_data["name"],
                    instrument_id=bot_data["instrument_id"],
                    running=True,
                    position=status.position,
                    qty=status.qty,
                    last_price=status.last_price,
                    last_signal=status.last_signal,
                    error=status.error,
                    entry_price=status.entry_price,
                    unrealized_pnl=pnl,
                )
            )
        else:
            entries.append(
                BotLiveEntry(
                    bot_id=bot_id,
                    name=bot_data["name"],
                    instrument_id=bot_data["instrument_id"],
                    running=False,
                    position="FLAT",
                    qty=0.0,
                    last_price=None,
                    last_signal=None,
                    error=None,
                    entry_price=None,
                    unrealized_pnl=None,
                )
            )
    return AllBotsStatusResponse(bots=entries)
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_live_engine_pnl.py -v 2>&1 | tail -12
```
Expected: 7/7 pass.

Full suite regression:
```bash
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q 2>&1 | tail -5
```
Expected: same pre-existing failures only.

- [ ] **Step 11: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add live_engine/broker_interface.py live_engine/engine.py api_server/main.py tests/test_live_engine_pnl.py
git commit -m "feat(engine): track entry_price, expose unrealized_pnl in /bots/all-live-status"
```

---

## Task 3: Frontend — Orders Page Complete

**Repo:** `seokminal-dashboard/`

**Files:**
- Modify: `lib/order-storage.ts` — add `venue` field to `OrderLogEntry`, add `updateOrderStatus`
- Modify: `tests/lib/order-storage.test.ts` — 6 new tests (total ~13)
- Modify: `lib/api.ts` — add US order types + functions, update `BotLiveEntry`
- Modify: `app/orders/page.tsx` — full rewrite: KR/US tabs, cancel/status buttons, P&L columns
- Modify: `docs/progress.md` — prepend Phase 21 section
- Modify: `docs/roadmap.md` — update HEAD + Phase 21 commit range

**Interfaces:**
- Consumes (from Tasks 1+2):
  - `POST /orders/us` body `{ symbol, side, quantity, order_type, limit_price? }` → `{ order_id: number, status, filled, remaining }`
  - `POST /orders/us/{order_id}/cancel` → same shape
  - `BotLiveEntry` now includes `entry_price: number | null`, `unrealized_pnl: number | null`

---

### Subtask A: `lib/order-storage.ts` + tests

- [ ] **Step 1: Write the new failing tests**

Append to `tests/lib/order-storage.test.ts` (after existing tests, before closing brace of file):

```typescript
describe("venue field", () => {
  it("addOrderEntry stores venue KR", () => {
    const result = addOrderEntry({
      venue: "KR",
      code: "005930", side: "BUY", qty: 1, order_type: "MARKET",
      order_id: "001", status: "SUBMITTED",
    });
    expect(result[0].venue).toBe("KR");
  });

  it("addOrderEntry stores venue US", () => {
    const result = addOrderEntry({
      venue: "US",
      code: "AAPL", side: "BUY", qty: 1, order_type: "MARKET",
      order_id: "42", status: "PendingSubmit",
    });
    expect(result[0].venue).toBe("US");
  });
});

describe("updateOrderStatus", () => {
  it("updates status of matching entry", () => {
    const entries = addOrderEntry({
      venue: "KR", code: "005930", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "001", status: "SUBMITTED",
    });
    const id = entries[0].id;
    const updated = updateOrderStatus(id, "CANCELLED");
    expect(updated.find(e => e.id === id)?.status).toBe("CANCELLED");
  });

  it("is a no-op if id not found", () => {
    addOrderEntry({
      venue: "KR", code: "005930", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "001", status: "SUBMITTED",
    });
    const result = updateOrderStatus("nonexistent", "CANCELLED");
    expect(result[0].status).toBe("SUBMITTED");
  });

  it("persists update across getOrderLog calls", () => {
    const entries = addOrderEntry({
      venue: "US", code: "AAPL", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "42", status: "PendingSubmit",
    });
    const id = entries[0].id;
    updateOrderStatus(id, "Filled");
    expect(getOrderLog().find(e => e.id === id)?.status).toBe("Filled");
  });

  it("returns updated list", () => {
    addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    const entries = addOrderEntry({ venue: "KR", code: "000660", side: "SELL", qty: 2, order_type: "MARKET", order_id: "002", status: "SUBMITTED" });
    const id = entries[0].id;
    const updated = updateOrderStatus(id, "CANCELLED");
    expect(updated).toHaveLength(2);
  });
});
```

Also update the existing tests in `tests/lib/order-storage.test.ts` that call `addOrderEntry` without `venue` to add `venue: "KR"` — they will fail if `venue` becomes required. Update each existing call like:

```typescript
addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/order-storage.test.ts 2>&1 | tail -15
```
Expected: failures on `venue` and `updateOrderStatus` missing.

- [ ] **Step 3: Update `lib/order-storage.ts`**

Replace the entire file contents:

```typescript
export interface OrderLogEntry {
  id: string;
  venue: "KR" | "US";
  code: string;
  side: "BUY" | "SELL";
  qty: number;
  order_type: "MARKET" | "LIMIT";
  price?: number;
  order_id: string;
  status: string;
  submitted_at: string;
}

export const STORAGE_KEY = "nautilus_order_log";

export function getOrderLog(): OrderLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as OrderLogEntry[];
  } catch {
    return [];
  }
}

export function addOrderEntry(
  entry: Omit<OrderLogEntry, "id" | "submitted_at">,
): OrderLogEntry[] {
  const log = getOrderLog();
  const full: OrderLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    submitted_at: new Date().toISOString(),
  };
  log.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function updateOrderStatus(id: string, newStatus: string): OrderLogEntry[] {
  const log = getOrderLog();
  const entry = log.find(e => e.id === id);
  if (entry) entry.status = newStatus;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function clearOrderLog(): void {
  localStorage.setItem(STORAGE_KEY, "[]");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/order-storage.test.ts 2>&1 | tail -15
```
Expected: all pass (7 original + 6 new = 13 total in this file).

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/order-storage.ts tests/lib/order-storage.test.ts
git commit -m "feat(orders): add venue + updateOrderStatus to order-storage"
```

---

### Subtask B: `lib/api.ts` additions

- [ ] **Step 6: Append US order types + functions to `lib/api.ts`**

Append after the existing `getAllBotsLiveStatus` function at the bottom of `lib/api.ts`:

```typescript
// ── US Orders ─────────────────────────────────────────────────────────────────

export interface USOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  order_type: "MARKET" | "LIMIT";
  limit_price?: number;
}

export interface USOrderResponse {
  order_id: number;
  status: string;
  filled: number;
  remaining: number;
}

export async function placeUSOrder(
  req: USOrderRequest,
  signal?: AbortSignal,
): Promise<USOrderResponse> {
  const r = await fetch(`${API_URL}/orders/us`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<USOrderResponse>(r);
}

export async function cancelUSOrder(
  orderId: number,
  signal?: AbortSignal,
): Promise<USOrderResponse> {
  const r = await fetch(`${API_URL}/orders/us/${orderId}/cancel`, {
    method: "POST",
    signal,
  });
  return handleResponse<USOrderResponse>(r);
}
```

- [ ] **Step 7: Update `BotLiveEntry` in `lib/api.ts`**

Find the `export interface BotLiveEntry` block (currently ends with `error: string | null`) and add two fields:

```typescript
export interface BotLiveEntry {
  bot_id: string;
  name: string;
  instrument_id: string;
  running: boolean;
  position: string;
  qty: number;
  last_price: number | null;
  last_signal: string | null;
  error: string | null;
  entry_price: number | null;
  unrealized_pnl: number | null;
}
```

- [ ] **Step 8: Verify tsc passes**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -5
```
Expected: 0 errors.

---

### Subtask C: `app/orders/page.tsx`

- [ ] **Step 9: Replace `app/orders/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  placeKROrder,
  cancelKROrder,
  getKROrderStatus,
  placeUSOrder,
  cancelUSOrder,
  getAllBotsLiveStatus,
  type KROrderResponse,
  type USOrderResponse,
  type BotLiveEntry,
} from "@/lib/api";
import {
  getOrderLog,
  addOrderEntry,
  updateOrderStatus,
  clearOrderLog,
  type OrderLogEntry,
} from "@/lib/order-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

type Venue = "KR" | "US";
type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPnl(pnl: number | null): string {
  if (pnl === null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}`;
}

function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-text-3";
  return pnl >= 0 ? "text-pos" : "text-neg";
}

function canCancel(status: string): boolean {
  return ["SUBMITTED", "OPEN", "PendingSubmit", "PreSubmitted"].includes(status);
}

function toKRDate(isoStr: string): string {
  return isoStr.slice(0, 10).replace(/-/g, "");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Venue tab
  const [venue, setVenue] = useState<Venue>("KR");

  // Shared form
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");

  // KR form
  const [krCode, setKrCode] = useState("005930");
  const [krPrice, setKrPrice] = useState("");

  // US form
  const [usSymbol, setUsSymbol] = useState("AAPL");
  const [usLimitPrice, setUsLimitPrice] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Per-order action state: { [entryId]: { loading, error } }
  const [actionState, setActionState] = useState<Record<string, { loading: boolean; error: string | null }>>({});

  // Bot positions
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(true);
  const botsAbortRef = useRef<AbortController | null>(null);

  // Order log
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);

  useEffect(() => {
    setOrderLog(getOrderLog());
  }, []);

  useEffect(() => () => {
    submitAbortRef.current?.abort();
    botsAbortRef.current?.abort();
  }, []);

  // ── Place order ───────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    const qtyNum = parseInt(qty);
    if (qtyNum <= 0 || isNaN(qtyNum)) { setSubmitError("Qty must be > 0."); return; }

    if (venue === "KR") {
      if (!krCode.trim()) { setSubmitError("Code required."); return; }
      if (orderType === "LIMIT" && (!krPrice || isNaN(parseInt(krPrice)))) {
        setSubmitError("Price required for LIMIT."); return;
      }
    } else {
      if (!usSymbol.trim()) { setSubmitError("Symbol required."); return; }
      if (orderType === "LIMIT" && (!usLimitPrice || isNaN(parseFloat(usLimitPrice)))) {
        setSubmitError("Limit price required for LIMIT."); return;
      }
    }

    submitAbortRef.current?.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setSubmitting(true); setSubmitResult(null); setSubmitError(null);

    try {
      let resultStr: string;
      if (venue === "KR") {
        const res: KROrderResponse = await placeKROrder({
          code: krCode.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "KR", code: krCode.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
          order_id: res.order_id, status: res.status,
        });
        setOrderLog(updated);
      } else {
        const res: USOrderResponse = await placeUSOrder({
          symbol: usSymbol.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { limit_price: parseFloat(usLimitPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "US", code: usSymbol.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseFloat(usLimitPrice) } : {}),
          order_id: String(res.order_id), status: res.status,
        });
        setOrderLog(updated);
      }
      setSubmitResult(resultStr);
    } catch (e) {
      if (submitAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      if (submitAbortRef.current === ctrl) setSubmitting(false);
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────

  async function handleCancel(entry: OrderLogEntry) {
    const ctrl = new AbortController();
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      if (entry.venue === "KR") {
        const res = await cancelKROrder(entry.order_id, { code: entry.code, quantity: entry.qty }, ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      } else {
        const res = await cancelUSOrder(Number(entry.order_id), ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      }
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  }

  // ── Check status (KR only) ─────────────────────────────────────────────────

  async function handleCheckStatus(entry: OrderLogEntry) {
    const ctrl = new AbortController();
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      const date = toKRDate(entry.submitted_at);
      const res = await getKROrderStatus(entry.order_id, date, ctrl.signal);
      const updated = updateOrderStatus(entry.id, res.status);
      setOrderLog(updated);
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  }

  // ── Refresh bots ──────────────────────────────────────────────────────────

  async function handleRefreshBots() {
    botsAbortRef.current?.abort();
    const ctrl = new AbortController();
    botsAbortRef.current = ctrl;
    setBotsLoading(true); setBotsError(null);
    try {
      const res = await getAllBotsLiveStatus(ctrl.signal);
      if (botsAbortRef.current !== ctrl) return;
      setBots(res.bots);
    } catch (e) {
      if (botsAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setBotsError(e instanceof Error ? e.message : String(e));
    } finally {
      if (botsAbortRef.current === ctrl) setBotsLoading(false);
    }
  }

  useEffect(() => { handleRefreshBots(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClearLog() { clearOrderLog(); setOrderLog([]); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <h1 className="text-xl font-bold mb-6">Live Order Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Order Form + Log ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">

            {/* Venue tabs */}
            <div className="flex rounded overflow-hidden border border-border w-fit mb-4">
              {(["KR", "US"] as Venue[]).map(v => (
                <button
                  key={v}
                  className={`px-5 py-1.5 text-sm font-medium ${
                    venue === v
                      ? "border-accent text-accent bg-accent/10"
                      : "bg-panel-2 text-text-2 hover:bg-panel"
                  }`}
                  onClick={() => { setVenue(v); setSubmitResult(null); setSubmitError(null); }}
                >
                  {v}
                </button>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              {venue === "KR" ? "KR Manual Order" : "US Manual Order"}
            </h2>

            <div className="space-y-3">
              {/* Code / Symbol */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">
                  {venue === "KR" ? "Code" : "Symbol"}
                </label>
                {venue === "KR" ? (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="005930"
                    value={krCode}
                    onChange={e => setKrCode(e.target.value)}
                  />
                ) : (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono uppercase"
                    placeholder="AAPL"
                    value={usSymbol}
                    onChange={e => setUsSymbol(e.target.value.toUpperCase())}
                  />
                )}
              </div>

              {/* Side */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["BUY", "SELL"] as Side[]).map(s => (
                    <button
                      key={s}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        side === s
                          ? s === "BUY" ? "bg-pos text-bg" : "bg-neg text-bg"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setSide(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Qty</label>
                <input
                  type="number"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>

              {/* Order type */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Type</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["MARKET", "LIMIT"] as OrderType[]).map(t => (
                    <button
                      key={t}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        orderType === t
                          ? "border-accent text-accent bg-accent/10"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setOrderType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (LIMIT only) */}
              {orderType === "LIMIT" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Price</label>
                  {venue === "KR" ? (
                    <input
                      type="number"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (KRW)"
                      value={krPrice}
                      onChange={e => setKrPrice(e.target.value)}
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (USD)"
                      value={usLimitPrice}
                      onChange={e => setUsLimitPrice(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-5 py-2 disabled:opacity-40"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? "Placing…" : "Place Order"}
              </button>
              {submitResult && <span className="text-sm text-pos font-mono">{submitResult}</span>}
              {submitError && <span className="text-sm text-neg">{submitError}</span>}
            </div>
          </div>

          {/* Order Log */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Order Log</h2>
              {orderLog.length > 0 && (
                <button className="text-xs text-neg hover:underline" onClick={handleClearLog}>
                  Clear
                </button>
              )}
            </div>
            {orderLog.length === 0 ? (
              <p className="text-sm text-text-3">No orders placed yet.</p>
            ) : (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Venue</th>
                      <th className="py-1 text-left font-medium">Code</th>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-left font-medium">ID</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderLog].reverse().map(entry => {
                      const act = actionState[entry.id];
                      return (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="py-1.5 text-text-3">{entry.venue}</td>
                          <td className="py-1.5 text-text-1 font-mono">{entry.code}</td>
                          <td className={`py-1.5 font-medium ${entry.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {entry.side}
                          </td>
                          <td className="py-1.5 text-text-1 text-right">{entry.qty}</td>
                          <td className="py-1.5 text-text-2 font-mono">{entry.order_id}</td>
                          <td className="py-1.5 text-text-2">{entry.status}</td>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1">
                              {canCancel(entry.status) && (
                                <button
                                  className="text-xs bg-accent text-black rounded px-2 py-0.5 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCancel(entry)}
                                >
                                  {act?.loading ? "…" : "Cancel"}
                                </button>
                              )}
                              {entry.venue === "KR" && (
                                <button
                                  className="text-xs border border-border text-text-2 rounded px-2 py-0.5 hover:bg-panel-2 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCheckStatus(entry)}
                                >
                                  {act?.loading ? "…" : "Check"}
                                </button>
                              )}
                              {act?.error && (
                                <span className="text-neg text-xs ml-1">{act.error}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Bot Positions ── */}
        <section>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Bot Positions</h2>
              <button
                className="bg-accent text-black text-xs font-medium rounded px-3 py-1 disabled:opacity-40"
                onClick={handleRefreshBots}
                disabled={botsLoading}
              >
                {botsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {botsError && <p className="text-sm text-neg mb-2">{botsError}</p>}

            {bots.length === 0 && !botsLoading && !botsError ? (
              <p className="text-sm text-text-3">No bots found.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Bot</th>
                      <th className="py-1 text-left font-medium">Instrument</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Pos</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Entry</th>
                      <th className="py-1 text-right font-medium">Unr. PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.bot_id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono text-xs">{bot.bot_id}</td>
                        <td className="py-1.5 text-text-2">{bot.instrument_id}</td>
                        <td className="py-1.5">
                          <span className={`font-medium ${bot.running ? "text-pos" : "text-text-3"}`}>
                            {bot.running ? "RUNNING" : "STOPPED"}
                          </span>
                        </td>
                        <td className={`py-1.5 font-medium ${
                          bot.position === "LONG" ? "text-pos"
                            : bot.position === "SHORT" ? "text-neg"
                            : "text-text-3"
                        }`}>
                          {bot.position}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{bot.qty}</td>
                        <td className="py-1.5 text-text-1 text-right font-mono">
                          {bot.last_price != null ? bot.last_price.toFixed(2) : "—"}
                        </td>
                        <td className="py-1.5 text-text-2 text-right font-mono">
                          {bot.entry_price != null ? bot.entry_price.toFixed(2) : "—"}
                        </td>
                        <td className={`py-1.5 text-right font-mono font-medium ${pnlColor(bot.unrealized_pnl)}`}>
                          {fmtPnl(bot.unrealized_pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bots.some(b => b.error) && (
              <div className="mt-3 space-y-1">
                {bots.filter(b => b.error).map(b => (
                  <p key={b.bot_id} className="text-xs text-neg">{b.bot_id}: {b.error}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Verify tsc passes**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -5
```
Expected: 0 errors.

- [ ] **Step 11: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 147/147 passed (141 existing + 6 new order-storage tests), 0 failures.

---

### Subtask D: Docs + Final Commit

- [ ] **Step 12: Update docs**

Prepend to `docs/progress.md`:

```markdown
## Phase 21 — Orders Complete (2026-06-28) ✅ SHIPPED

### 완료된 작업
- Backend: `POST /orders/us` (IB 수동 주문), `POST /orders/us/{id}/cancel`, `GET /orders/us/{id}/status`
- Backend: `live_engine` entry_price 추적 + `unrealized_pnl` 계산
- Frontend: KR/US 탭, cancel/status 버튼, Entry + Unr. PnL 컬럼
- order-storage: venue 필드 + updateOrderStatus 추가

### 변경된 파일
**Backend:** `api_server/main.py`, `live_engine/broker_interface.py`, `live_engine/engine.py`, `tests/test_orders_us_api.py`, `tests/test_live_engine_pnl.py`
**Frontend:** `lib/order-storage.ts`, `lib/api.ts`, `app/orders/page.tsx`, `tests/lib/order-storage.test.ts`

### 다음 할 일
- Phase 22: Notifications + Alert System

---
```

Update `docs/roadmap.md`:
- Change `**HEAD:**` to the new frontend HEAD commit hash
- Add Phase 21 row in the completed phase table:
  ```
  | 21 | Orders Complete | IB 주문, cancel/status UI, Bot P&L 표시 | <commit-range> |
  ```

- [ ] **Step 13: Final commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/orders/page.tsx docs/progress.md docs/roadmap.md
git commit -m "feat(orders): US form tab, cancel/status buttons, entry_price + P&L columns"
```

Note: `lib/order-storage.ts` and `tests/lib/order-storage.test.ts` were committed in Step 5. Commit only the remaining modified files here. Check `git status` before committing to confirm exactly which files are staged.
