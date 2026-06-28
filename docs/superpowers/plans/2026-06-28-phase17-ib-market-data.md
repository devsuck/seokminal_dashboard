# Phase 17 — IB Market Data Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the IB (Interactive Brokers) backend to support Forex, Future, Option, and Crypto contract types in addition to the existing Stock contract, expose a `/ib/bars` API endpoint, and add a frontend `/ib` page where users can browse historical OHLCV data for any IB asset type.

**Architecture:** `IBClient` gains 4 new async methods, one per new contract type. A new `GET /ib/bars` async FastAPI endpoint routes to the correct method based on `asset_type` query param. The frontend `/ib` page has 5 tabs (Stock, Forex, Future, Option, Crypto), each with the relevant input fields, and renders the result as a lightweight-charts v5 candlestick chart. This phase is data-browser only — no modifications to existing Options/Futures/Forex analytics pages.

**Tech Stack:**
- Backend: Python 3.14, `ib_async` (already installed), `pytest-asyncio` in `auto` mode
- Frontend: Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts v5

## Global Constraints

- Backend root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue`
- Frontend root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard`
- Backend test command: `cd .../seokminal-multi-venue && pytest tests/test_ib_client.py tests/test_api_server.py -v`
- Frontend test command: `cd .../seokminal-dashboard && npm test`
- `asyncio_mode = "auto"` in pyproject.toml — NO `@pytest.mark.asyncio` decorators on tests
- `IBClient(ib=<FakeIB>)` pattern for injection — FakeIB class already exists in `tests/test_ib_client.py`
- All new IBClient methods must raise `ValueError` when IB returns empty bars
- `Literal` is already imported (`from typing import Literal`) at line 5 of `api_server/main.py`
- `datetime` is already imported as `dt` at line 1 of `api_server/main.py`
- Design tokens: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `font-data`
- `bg-accent text-black` only on primary action buttons (Load/Compute)
- Active tab: `border-b-2 border-accent text-accent font-bold -mb-px`; inactive: `border-transparent text-text-3 font-normal hover:text-text-1`
- No hex codes in `className` (lw-charts config objects excepted)
- No inline `style={}` except chart container height
- AbortController pattern: abort → create → assign → try/catch AbortError silently → finally guard
- No new npm dependencies
- Frontend tests: 127 passing — do not break
- `FakeIB.qualifyContractsAsync` captures `(contract.symbol, contract.exchange, contract.currency)` — all new tests use this assertion style
- **Roadmap HEAD self-reference:** always one commit behind — accepted, not a defect

---

## File Structure

### Backend (seokminal-multi-venue/)
| File | Action | Responsibility |
|---|---|---|
| `backends/ib/client.py` | Modify | Add 4 new methods: `get_daily_bars_forex`, `get_daily_bars_future`, `get_daily_bars_option`, `get_daily_bars_crypto` |
| `tests/test_ib_client.py` | Modify | Append 9 new async tests using existing FakeIB |
| `api_server/main.py` | Modify | Add `from backends.ib.client import IBClient`; append `IBBarOut`, `IBBarsResponse`, `_bar_date_to_ms`, `get_ib_bars` endpoint |
| `tests/test_api_server.py` | Modify | Append 4 mocked tests for `/ib/bars` |

### Frontend (seokminal-dashboard/)
| File | Action | Responsibility |
|---|---|---|
| `lib/api.ts` | Modify | Append `IBBar`, `IBBarsResponse`, `IBBarsParams`, `getIBBars` |
| `app/ib/page.tsx` | Create | 5-tab IB data browser: Stock, Forex, Future, Option, Crypto + lw-charts candlestick |
| `components/NavBar.tsx` | Modify | Add "IB Data" after Crypto, before Report |
| `docs/roadmap.md` | Modify | Add Phase 17 row; update HEAD |
| `docs/progress.md` | Modify | Prepend Phase 17 section |

---

### Task 1: Extend IBClient + Tests

**Files:**
- Modify: `seokminal-multi-venue/backends/ib/client.py`
- Modify: `seokminal-multi-venue/tests/test_ib_client.py`

**Interfaces:**
- Consumes: existing `FakeIB`, `BarData`, `asyncio_mode=auto`
- Produces (consumed by Task 2):
  - `client.get_daily_bars_forex(pair: str, end_date: str, duration: str) -> list[BarData]`
  - `client.get_daily_bars_future(symbol: str, exchange: str, expiry: str, end_date: str, duration: str) -> list[BarData]`
  - `client.get_daily_bars_option(symbol: str, expiry: str, strike: float, right: str, end_date: str, duration: str) -> list[BarData]`
  - `client.get_daily_bars_crypto(symbol: str, end_date: str, duration: str) -> list[BarData]`

- [ ] **Step 1: Verify baseline tests pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_ib_client.py -v 2>&1 | tail -5
```
Expected: 3/3 PASS

- [ ] **Step 2: Write failing tests**

Append to the END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/tests/test_ib_client.py`:

```python
# ── New contract type tests ───────────────────────────────────────────────────

async def test_get_daily_bars_forex_returns_bars():
    bar = BarData(date=dt.date(2025, 1, 2), open=1.09, high=1.095, low=1.088, close=1.092, volume=0.0)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    bars = await client.get_daily_bars_forex("EURUSD", end_date="", duration="1 Y")
    assert bars == [bar]
    assert fake_ib.qualify_calls == [("EUR", "IDEALPRO", "USD")]


async def test_get_daily_bars_forex_raises_on_empty():
    fake_ib = FakeIB(historical_bars=[])
    client = IBClient(ib=fake_ib)
    with pytest.raises(ValueError, match="EURUSD"):
        await client.get_daily_bars_forex("EURUSD", end_date="", duration="1 Y")


async def test_get_daily_bars_forex_uses_midpoint():
    bar = BarData(date=dt.date(2025, 1, 2), open=1.09, high=1.095, low=1.088, close=1.092, volume=0.0)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    await client.get_daily_bars_forex("EURUSD", end_date="", duration="1 Y")
    # historical_calls tuple index 6 is whatToShow
    assert fake_ib.historical_calls[0][6] == "MIDPOINT"


async def test_get_daily_bars_future_returns_bars():
    bar = BarData(date=dt.date(2025, 1, 2), open=5900.0, high=5920.0, low=5880.0, close=5910.0, volume=12345.0)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    bars = await client.get_daily_bars_future("ES", "CME", "202509", end_date="", duration="1 Y")
    assert bars == [bar]
    assert fake_ib.qualify_calls == [("ES", "CME", "")]


async def test_get_daily_bars_future_raises_on_empty():
    fake_ib = FakeIB(historical_bars=[])
    client = IBClient(ib=fake_ib)
    with pytest.raises(ValueError, match="ES"):
        await client.get_daily_bars_future("ES", "CME", "202509", end_date="", duration="1 Y")


async def test_get_daily_bars_option_returns_bars():
    bar = BarData(date=dt.date(2025, 1, 2), open=5.5, high=6.0, low=5.0, close=5.8, volume=500.0)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    bars = await client.get_daily_bars_option("SPY", "20251219", 500.0, "C", end_date="", duration="90 D")
    assert bars == [bar]
    assert fake_ib.qualify_calls == [("SPY", "SMART", "USD")]


async def test_get_daily_bars_option_raises_on_empty():
    fake_ib = FakeIB(historical_bars=[])
    client = IBClient(ib=fake_ib)
    with pytest.raises(ValueError, match="SPY"):
        await client.get_daily_bars_option("SPY", "20251219", 500.0, "C", end_date="", duration="90 D")


async def test_get_daily_bars_crypto_returns_bars():
    bar = BarData(date=dt.date(2025, 1, 2), open=94000.0, high=95500.0, low=93000.0, close=95000.0, volume=1234.5)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    bars = await client.get_daily_bars_crypto("BTC", end_date="", duration="1 Y")
    assert bars == [bar]
    assert fake_ib.qualify_calls == [("BTC", "PAXOS", "USD")]


async def test_get_daily_bars_crypto_uses_rth_false():
    bar = BarData(date=dt.date(2025, 1, 2), open=94000.0, high=95500.0, low=93000.0, close=95000.0, volume=1234.5)
    fake_ib = FakeIB(historical_bars=[bar])
    client = IBClient(ib=fake_ib)
    await client.get_daily_bars_crypto("BTC", end_date="", duration="1 Y")
    # historical_calls tuple index 7 is useRTH
    assert fake_ib.historical_calls[0][7] is False
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_ib_client.py -v 2>&1 | tail -5
```
Expected: 9 FAILED (`AttributeError: 'IBClient' object has no attribute 'get_daily_bars_forex'`)

- [ ] **Step 4: Implement the 4 new methods in `backends/ib/client.py`**

Change the import at the top of the file:

Find:
```python
from ib_async.contract import Stock
```

Replace with:
```python
from ib_async.contract import Crypto, Forex, Future, Option, Stock
```

Then append the 4 new methods to the `IBClient` class (after `get_daily_bars`):

```python
    async def get_daily_bars_forex(self, pair: str, end_date: str, duration: str) -> list[BarData]:
        await self._ib.connectAsync(self._host, self._port, self._client_id)
        contract = Forex(pair)
        await self._ib.qualifyContractsAsync(contract)
        bars = await self._ib.reqHistoricalDataAsync(
            contract,
            endDateTime=end_date,
            durationStr=duration,
            barSizeSetting=DAILY_BAR_SIZE,
            whatToShow="MIDPOINT",
            useRTH=True,
        )
        if not bars:
            raise ValueError(
                f"no historical daily bars returned for {pair!r} forex pair -- "
                "check IB market data permissions"
            )
        return bars

    async def get_daily_bars_future(
        self, symbol: str, exchange: str, expiry: str, end_date: str, duration: str
    ) -> list[BarData]:
        await self._ib.connectAsync(self._host, self._port, self._client_id)
        contract = Future(symbol, expiry, exchange)
        await self._ib.qualifyContractsAsync(contract)
        bars = await self._ib.reqHistoricalDataAsync(
            contract,
            endDateTime=end_date,
            durationStr=duration,
            barSizeSetting=DAILY_BAR_SIZE,
            whatToShow=DAILY_WHAT_TO_SHOW,
            useRTH=True,
        )
        if not bars:
            raise ValueError(
                f"no historical daily bars returned for {symbol!r} future "
                f"(exchange={exchange!r}, expiry={expiry!r}) -- "
                "check IB market data permissions"
            )
        return bars

    async def get_daily_bars_option(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        right: str,
        end_date: str,
        duration: str,
    ) -> list[BarData]:
        await self._ib.connectAsync(self._host, self._port, self._client_id)
        contract = Option(
            symbol=symbol,
            lastTradeDateOrContractMonth=expiry,
            strike=strike,
            right=right,
            exchange="SMART",
            currency="USD",
        )
        await self._ib.qualifyContractsAsync(contract)
        bars = await self._ib.reqHistoricalDataAsync(
            contract,
            endDateTime=end_date,
            durationStr=duration,
            barSizeSetting=DAILY_BAR_SIZE,
            whatToShow=DAILY_WHAT_TO_SHOW,
            useRTH=True,
        )
        if not bars:
            raise ValueError(
                f"no historical daily bars returned for {symbol!r} {right} option "
                f"(expiry={expiry!r}, strike={strike}) -- "
                "check IB market data permissions"
            )
        return bars

    async def get_daily_bars_crypto(self, symbol: str, end_date: str, duration: str) -> list[BarData]:
        await self._ib.connectAsync(self._host, self._port, self._client_id)
        contract = Crypto(symbol=symbol, exchange="PAXOS", currency="USD")
        await self._ib.qualifyContractsAsync(contract)
        bars = await self._ib.reqHistoricalDataAsync(
            contract,
            endDateTime=end_date,
            durationStr=duration,
            barSizeSetting=DAILY_BAR_SIZE,
            whatToShow=DAILY_WHAT_TO_SHOW,
            useRTH=False,
        )
        if not bars:
            raise ValueError(
                f"no historical daily bars returned for {symbol!r} crypto -- "
                "check IB market data permissions (BTC/ETH/LTC/BCH/XRP/SOL supported via PAXOS)"
            )
        return bars
```

- [ ] **Step 5: Run all IB client tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_ib_client.py -v
```
Expected: 12/12 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add backends/ib/client.py tests/test_ib_client.py
git commit -m "feat(ib): add Forex/Future/Option/Crypto contract support to IBClient"
```

---

### Task 2: FastAPI `/ib/bars` Endpoint + Tests

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py` (add import + append endpoint)
- Modify: `seokminal-multi-venue/tests/test_api_server.py` (append 4 mocked tests)

**Interfaces:**
- Consumes (Task 1): `IBClient` with all 5 `get_daily_bars_*` methods
- Produces (Task 3):
  - `GET /ib/bars?symbol=&asset_type=stock|forex|future|option|crypto&end_date=&duration=&exchange=&expiry=&strike=&right=`
  - Returns `IBBarsResponse { symbol, asset_type, bars[{ts_ms, open, high, low, close, volume}], count }`

- [ ] **Step 1: Write failing API tests**

Append to the END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/tests/test_api_server.py`:

```python
# ── IB bars endpoint ─────────────────────────────────────────────────────────

from unittest.mock import AsyncMock, MagicMock


def _make_mock_ib_bar(date_str="20250102"):
    bar = MagicMock()
    bar.date = date_str
    bar.open = 150.0
    bar.high = 155.0
    bar.low = 148.0
    bar.close = 152.0
    bar.volume = 1_000_000.0
    return bar


@patch("api_server.main.IBClient")
def test_ib_bars_stock_structure(mock_cls):
    inst = MagicMock()
    inst.get_daily_bars = AsyncMock(return_value=[_make_mock_ib_bar()])
    inst._ib.isConnected.return_value = False
    mock_cls.return_value = inst
    r = client.get("/ib/bars?symbol=AAPL&asset_type=stock")
    assert r.status_code == 200
    data = r.json()
    assert data["symbol"] == "AAPL.STOCK"
    assert data["asset_type"] == "stock"
    assert data["count"] == 1
    bar = data["bars"][0]
    assert "ts_ms" in bar and "open" in bar and "close" in bar


@patch("api_server.main.IBClient")
def test_ib_bars_forex_structure(mock_cls):
    inst = MagicMock()
    inst.get_daily_bars_forex = AsyncMock(return_value=[_make_mock_ib_bar()])
    inst._ib.isConnected.return_value = False
    mock_cls.return_value = inst
    r = client.get("/ib/bars?symbol=EURUSD&asset_type=forex")
    assert r.status_code == 200
    data = r.json()
    assert data["symbol"] == "EURUSD.FOREX"
    assert data["asset_type"] == "forex"


def test_ib_bars_invalid_asset_type_returns_422():
    r = client.get("/ib/bars?symbol=AAPL&asset_type=bond")
    assert r.status_code == 422


@patch("api_server.main.IBClient")
def test_ib_bars_ib_error_returns_400(mock_cls):
    inst = MagicMock()
    inst.get_daily_bars = AsyncMock(side_effect=ValueError("no bars returned for FAKE"))
    inst._ib.isConnected.return_value = False
    mock_cls.return_value = inst
    r = client.get("/ib/bars?symbol=FAKE&asset_type=stock")
    assert r.status_code == 400
```

Note: `patch` is already imported at the top of `test_api_server.py`; `AsyncMock` and `MagicMock` are imported inline here to avoid conflicts.

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_ib_bars_stock_structure -v 2>&1 | tail -5
```
Expected: FAILED with 404 or AttributeError

- [ ] **Step 3: Add `IBClient` import to `api_server/main.py`**

Find line 38 (last of the existing imports block):
```python
from hyperliquid.client import get_all_mids, get_meta_and_ctxs, get_candles, get_l2_book
```

Replace with:
```python
from hyperliquid.client import get_all_mids, get_meta_and_ctxs, get_candles, get_l2_book
from backends.ib.client import IBClient
```

- [ ] **Step 4: Append models + helper + endpoint to `api_server/main.py`**

At the very END of the file, append:

```python
# ═══════════════════════════════════════════════════════════════════════════════
# IB Market Data
# ═══════════════════════════════════════════════════════════════════════════════

class IBBarOut(BaseModel):
    ts_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class IBBarsResponse(BaseModel):
    symbol: str
    asset_type: str
    bars: list[IBBarOut]
    count: int


def _bar_date_to_ms(date) -> int:
    if isinstance(date, str):
        fmt = "%Y%m%d" if len(date) == 8 and date.isdigit() else "%Y-%m-%d"
        d = dt.datetime.strptime(date, fmt)
    elif isinstance(date, dt.datetime):
        d = date
    else:
        d = dt.datetime.combine(date, dt.time.min)
    return int(d.timestamp() * 1000)


@app.get("/ib/bars", response_model=IBBarsResponse)
async def get_ib_bars(
    symbol: str = Query(...),
    asset_type: Literal["stock", "forex", "future", "option", "crypto"] = Query("stock"),
    end_date: str = Query(""),
    duration: str = Query("1 Y"),
    exchange: str = Query(""),
    expiry: str = Query(""),
    strike: float = Query(0.0),
    right: Literal["C", "P"] = Query("C"),
) -> IBBarsResponse:
    ib_client = IBClient()
    try:
        sym = symbol.strip().upper()
        if asset_type == "stock":
            raw = await ib_client.get_daily_bars(sym, end_date, duration)
            label = f"{sym}.STOCK"
        elif asset_type == "forex":
            raw = await ib_client.get_daily_bars_forex(sym, end_date, duration)
            label = f"{sym}.FOREX"
        elif asset_type == "future":
            raw = await ib_client.get_daily_bars_future(
                sym, exchange.strip().upper(), expiry.strip(), end_date, duration
            )
            label = f"{sym}.{exchange.strip().upper()}.FUTURE"
        elif asset_type == "option":
            raw = await ib_client.get_daily_bars_option(
                sym, expiry.strip(), strike, right, end_date, duration
            )
            label = f"{sym}.{expiry.strip()}.{strike}.{right}.OPTION"
        else:
            raw = await ib_client.get_daily_bars_crypto(sym, end_date, duration)
            label = f"{sym}.CRYPTO"
        bars = [
            IBBarOut(
                ts_ms=_bar_date_to_ms(b.date),
                open=float(b.open),
                high=float(b.high),
                low=float(b.low),
                close=float(b.close),
                volume=float(b.volume),
            )
            for b in raw
        ]
        return IBBarsResponse(symbol=label, asset_type=asset_type, bars=bars, count=len(bars))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if ib_client._ib.isConnected():
            ib_client._ib.disconnect()
```

- [ ] **Step 5: Run all 4 new API tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_ib_bars_stock_structure tests/test_api_server.py::test_ib_bars_forex_structure tests/test_api_server.py::test_ib_bars_invalid_asset_type_returns_422 tests/test_api_server.py::test_ib_bars_ib_error_returns_400 -v
```
Expected: 4/4 PASS

- [ ] **Step 6: Run full backend test suite (IB client + API server)**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_ib_client.py tests/test_api_server.py -v 2>&1 | tail -10
```
Expected: IB client 12/12 PASS, API server all new tests PASS (pre-existing `test_backtest_happy_path_returns_all_metric_keys` failure is unrelated)

- [ ] **Step 7: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_api_server.py
git commit -m "feat(api): add /ib/bars endpoint for multi-asset IB historical data"
```

---

### Task 3: Frontend — API Client + `/ib` Page

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts` (append 3 types + 1 function)
- Create: `seokminal-dashboard/app/ib/page.tsx`

**Interfaces:**
- Consumes (Task 2):
  - `GET /ib/bars?symbol=&asset_type=&end_date=&duration=&exchange=&expiry=&strike=&right=`
  - Response: `IBBarsResponse { symbol, asset_type, bars[{ts_ms, open, high, low, close, volume}], count }`
- Produces (Task 4): page at `/ib` route with 5-tab form + candlestick chart

- [ ] **Step 1: Append to `lib/api.ts`**

At the END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/lib/api.ts`, append:

```typescript
// ── IB Market Data ────────────────────────────────────────────────────────────

export interface IBBar {
  ts_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IBBarsResponse {
  symbol: string;
  asset_type: string;
  bars: IBBar[];
  count: number;
}

export interface IBBarsParams {
  symbol: string;
  asset_type: "stock" | "forex" | "future" | "option" | "crypto";
  end_date?: string;
  duration?: string;
  exchange?: string;
  expiry?: string;
  strike?: number;
  right?: "C" | "P";
}

export async function getIBBars(
  params: IBBarsParams,
  signal?: AbortSignal
): Promise<IBBarsResponse> {
  const p = new URLSearchParams({ symbol: params.symbol, asset_type: params.asset_type });
  if (params.end_date)  p.set("end_date",  params.end_date);
  if (params.duration)  p.set("duration",  params.duration);
  if (params.exchange)  p.set("exchange",  params.exchange);
  if (params.expiry)    p.set("expiry",    params.expiry);
  if (params.strike !== undefined && params.strike !== 0) p.set("strike", String(params.strike));
  if (params.right)     p.set("right",     params.right);
  return handleResponse<IBBarsResponse>(
    await fetch(`${API_URL}/ib/bars?${p}`, { signal })
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -5
```
Expected: zero errors

- [ ] **Step 3: Create `app/ib/page.tsx`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/ib/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import { ApiError, getIBBars, type IBBarsResponse } from "@/lib/api";

type AssetTab = "stock" | "forex" | "future" | "option" | "crypto";

const TABS: { id: AssetTab; label: string }[] = [
  { id: "stock",  label: "Stock"  },
  { id: "forex",  label: "Forex"  },
  { id: "future", label: "Future" },
  { id: "option", label: "Option" },
  { id: "crypto", label: "Crypto" },
];

const DURATIONS = ["1 W", "1 M", "3 M", "6 M", "1 Y", "2 Y", "5 Y"] as const;

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mb-3">ERR: {msg}</p> : null;
}

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

// ── Shared chart component ────────────────────────────────────────────────────

function CandleChart({ result }: { result: IBBarsResponse }) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current || !result.bars.length) return;
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9AA4B2",
      },
      grid: {
        vertLines: { color: "#2a3040" },
        horzLines: { color: "#2a3040" },
      },
      width: chartRef.current.clientWidth,
      height: 320,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#44cc88",
      downColor: "#ff4444",
      borderVisible: false,
      wickUpColor: "#44cc88",
      wickDownColor: "#ff4444",
    });
    series.setData(
      result.bars.map(b => ({
        time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [result]);

  const last = result.bars.at(-1);

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-4">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">
          {result.symbol} · {result.count} bars
        </span>
        {last && (
          <span className="text-text-2 text-xs font-data">
            Last: <span className="text-text-1 font-semibold">{fmtPrice(last.close)}</span>
          </span>
        )}
      </div>
      <div className="p-3">
        <div ref={chartRef} style={{ height: "320px" }} />
      </div>
    </div>
  );
}

// ── Tab forms ─────────────────────────────────────────────────────────────────

interface FormShellProps {
  children: React.ReactNode;
  onLoad: () => void;
  loading: boolean;
}

function FormShell({ children, onLoad, loading }: FormShellProps) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {children}
        <button
          onClick={onLoad}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-text-3 text-[11px] uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data";

function DurationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Duration">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} cursor-pointer`}
      >
        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </Field>
  );
}

function EndDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="End Date (optional)">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="20250101"
        className={`${inputCls} w-28`}
      />
    </Field>
  );
}

// ── Per-tab load hooks ─────────────────────────────────────────────────────────

function useIBBars() {
  const [result, setResult]   = useState<IBBarsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function load(params: Parameters<typeof getIBBars>[0]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getIBBars(params, ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { result, error, loading, load };
}

// ── Tab implementations ───────────────────────────────────────────────────────

function StockTab() {
  const [symbol, setSymbol]   = useState("AAPL");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => load({ symbol, asset_type: "stock", end_date: endDate, duration })} loading={loading}>
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-20 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function ForexTab() {
  const [pair, setPair]       = useState("EURUSD");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => load({ symbol: pair, asset_type: "forex", end_date: endDate, duration })} loading={loading}>
        <Field label="Pair (e.g. EURUSD)">
          <input type="text" value={pair} onChange={e => setPair(e.target.value.toUpperCase())} className={`${inputCls} w-24 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function FutureTab() {
  const [symbol, setSymbol]   = useState("ES");
  const [exchange, setExchange] = useState("CME");
  const [expiry, setExpiry]   = useState("202509");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => load({ symbol, asset_type: "future", exchange, expiry, end_date: endDate, duration })}
        loading={loading}
      >
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Exchange">
          <input type="text" value={exchange} onChange={e => setExchange(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Expiry (YYYYMM)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function OptionTab() {
  const [symbol, setSymbol]   = useState("SPY");
  const [expiry, setExpiry]   = useState("20251219");
  const [strike, setStrike]   = useState("500");
  const [right, setRight]     = useState<"C" | "P">("C");
  const [duration, setDuration] = useState("90 D");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() =>
          load({
            symbol,
            asset_type: "option",
            expiry,
            strike: parseFloat(strike),
            right,
            end_date: endDate,
            duration,
          })
        }
        loading={loading}
      >
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Expiry (YYYYMMDD)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <Field label="Strike">
          <input type="number" value={strike} onChange={e => setStrike(e.target.value)} className={`${inputCls} w-20`} />
        </Field>
        <Field label="Right">
          <select
            value={right}
            onChange={e => setRight(e.target.value as "C" | "P")}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="C">Call</option>
            <option value="P">Put</option>
          </select>
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function CryptoTab() {
  const [symbol, setSymbol]   = useState("BTC");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => load({ symbol, asset_type: "crypto", end_date: endDate, duration })}
        loading={loading}
      >
        <Field label="Symbol (BTC/ETH/SOL…)">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <p className="text-text-3 text-[11px]">
        Supported via PAXOS: BTC · ETH · LTC · BCH · XRP · SOL
      </p>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IBPage() {
  const [tab, setTab] = useState<AssetTab>("stock");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">IB Market Data</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Historical OHLCV bars from Interactive Brokers — requires TWS or IB Gateway running locally.
        </p>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              tab === t.id
                ? "border-accent text-accent font-bold"
                : "border-transparent text-text-3 font-normal hover:text-text-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock"  && <StockTab />}
      {tab === "forex"  && <ForexTab />}
      {tab === "future" && <FutureTab />}
      {tab === "option" && <OptionTab />}
      {tab === "crypto" && <CryptoTab />}
    </div>
  );
}
```

- [ ] **Step 4: Run frontend tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 PASS, zero errors

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/ib/page.tsx
git commit -m "feat(ib): add IB Market Data browser page (5-tab OHLCV chart) and API client"
```

---

### Task 4: NavBar + Docs

**Files:**
- Modify: `seokminal-dashboard/components/NavBar.tsx`
- Modify: `seokminal-dashboard/docs/roadmap.md`
- Modify: `seokminal-dashboard/docs/progress.md`

**Interfaces:**
- Consumes: `/ib` page exists (Task 3)
- Produces: Crypto→**IB Data**→Report in NavBar; roadmap/progress updated

- [ ] **Step 1: Run baseline tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 127/127 PASS

- [ ] **Step 2: Add "IB Data" to NavBar**

In `components/NavBar.tsx`, find:
```tsx
      { href: "/crypto",      label: "Crypto" },
      { href: "/report",      label: "Report" },
```

Replace with:
```tsx
      { href: "/crypto",      label: "Crypto" },
      { href: "/ib",          label: "IB Data" },
      { href: "/report",      label: "Report" },
```

- [ ] **Step 3: Update `docs/roadmap.md`**

1. Get current commit hash: `git log --oneline -1 --format="%h"`
2. Update `**HEAD:**` to that hash
3. Add Phase 17 row to the completed table (after Phase 16):

```
| 17 | IB Market Data | `backends/ib/client.py`, `app/ib/page.tsx`, 5 contract types | — |
```

- [ ] **Step 4: Prepend Phase 17 section to `docs/progress.md`**

At the very top of `docs/progress.md`, prepend:

```markdown
## Phase 17 — IB Market Data (2026-06-28)

### 완료된 작업
- IBClient 확장: `get_daily_bars_forex`, `get_daily_bars_future`, `get_daily_bars_option`, `get_daily_bars_crypto`
- API: `/ib/bars` async endpoint (5 asset types, input validation, try/except)
- Frontend: `/ib` 페이지 — Stock/Forex/Future/Option/Crypto 5탭, lightweight-charts v5 캔들차트
- NavBar: IB Data 추가 (Crypto↔Report 사이)

### 변경된 파일
**Backend (seokminal-multi-venue):**
- `backends/ib/client.py` (+4 methods)
- `tests/test_ib_client.py` (+9 tests)
- `api_server/main.py` (+IBBarsResponse, +_bar_date_to_ms, +/ib/bars)

**Frontend (seokminal-dashboard):**
- `lib/api.ts` (+IBBar, IBBarsResponse, IBBarsParams, getIBBars)
- `app/ib/page.tsx` (new — 5-tab IB data browser)
- `components/NavBar.tsx` (IB Data link added)

### 다음 할 일
- Phase 18: TBD (discuss with user)
- Note: IB page requires TWS/Gateway running locally — no live data without IB connection

---

```

- [ ] **Step 5: Run tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 PASS, zero errors

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add components/NavBar.tsx docs/roadmap.md docs/progress.md
git commit -m "feat(ib): add IB Data NavBar link, roadmap, progress docs"
```
