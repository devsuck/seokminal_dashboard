# Phase 16 — Crypto Analytics (Hyperliquid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Crypto Analytics page that pulls live perpetual futures data from Hyperliquid's public API — no authentication required — showing a markets overview table, OHLCV candlestick chart, and L2 order book depth chart.

**Architecture:** Backend adds a `hyperliquid/` package that wraps the Hyperliquid public REST API (`POST https://api.hyperliquid.xyz/info`) and exposes three FastAPI endpoints: `/crypto/assets`, `/crypto/candles`, `/crypto/book`. Frontend has a single `/crypto` page with three tabs: Markets (auto-loads live data), Chart (lightweight-charts v5 candlestick), Book (D3 cumulative depth chart). Unlike Phases 13-15 (pure math models), this phase fetches real external data — API calls in tests are mocked with `unittest.mock.patch`.

**Tech Stack:**
- Backend: Python 3.14, FastAPI, `requests` (already installed), `unittest.mock` for tests
- Frontend: Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts v5, D3 v7

## Global Constraints

- Backend root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue`
- Frontend root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard`
- Backend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue && pytest tests/test_hyperliquid_client.py -v`
- Frontend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test`
- Hyperliquid API: `POST https://api.hyperliquid.xyz/info`, JSON body, no auth needed
- API base URL: `http://127.0.0.1:8000` — CORS allows `localhost:3000` only
- Design tokens: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `font-data`
- No hex codes in React `className` (D3 `.attr()` and lightweight-charts config object excepted)
- `bg-accent text-black` only on primary action buttons (Compute/Load)
- Active tabs: `border-b-2 border-accent text-accent font-bold -mb-px`; inactive: `border-transparent text-text-3 font-normal hover:text-text-1`
- No inline `style={}` except data-driven SVG attrs and chart container height
- All API calls via `lib/api.ts` functions only (no raw `fetch` in components)
- AbortController pattern: abort existing → create new → assign → try/catch AbortError silently → finally guard
- No new npm dependencies (lightweight-charts and D3 already installed)
- Frontend tests: 127 currently passing — do not break
- All Hyperliquid HTTP calls mocked in tests — no live network calls in test suite

---

## File Structure

### Backend (seokminal-multi-venue/)
| File | Action | Responsibility |
|---|---|---|
| `hyperliquid/__init__.py` | Create | Package init (empty) |
| `hyperliquid/client.py` | Create | HTTP wrapper: `get_all_mids`, `get_meta_and_ctxs`, `get_candles`, `get_l2_book` |
| `tests/test_hyperliquid_client.py` | Create | 9 unit tests, all mock `requests.post` |
| `api_server/main.py` | Modify | Append 3 endpoints + 5 Pydantic models; add import at line 39 |
| `pyproject.toml` | Modify | Add `"hyperliquid*"` to packages.find.include |
| `tests/test_api_server.py` | Modify | Append 3 new tests (mocked) |

### Frontend (seokminal-dashboard/)
| File | Action | Responsibility |
|---|---|---|
| `lib/api.ts` | Modify | Append 5 interfaces + 3 API functions |
| `app/crypto/page.tsx` | Create | Crypto page: Markets + Chart + Book (placeholder) in Task 3; full Book in Task 4 |
| `components/NavBar.tsx` | Modify | Add Crypto to Research group (after Forex, before Report) |

---

### Task 1: Hyperliquid HTTP Client + Tests

**Files:**
- Create: `seokminal-multi-venue/hyperliquid/__init__.py`
- Create: `seokminal-multi-venue/hyperliquid/client.py`
- Create: `seokminal-multi-venue/tests/test_hyperliquid_client.py`

**Interfaces:**
- Produces (consumed by Task 2):
  - `get_all_mids() -> dict[str, str]` — `{"BTC": "94500.0", "ETH": "3200.0", ...}`
  - `get_meta_and_ctxs() -> tuple[list[dict], list[dict]]` — `(universe_list, asset_ctx_list)`
  - `get_candles(coin: str, interval: str, start_ms: int, end_ms: int) -> list[dict]`
  - `get_l2_book(coin: str) -> dict`

- [ ] **Step 1: Create package init**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/hyperliquid
touch /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/hyperliquid/__init__.py
```

- [ ] **Step 2: Write failing tests**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/tests/test_hyperliquid_client.py`:

```python
"""Tests for Hyperliquid public API client — all HTTP calls mocked."""
from unittest.mock import MagicMock, patch

import pytest

from hyperliquid.client import get_all_mids, get_candles, get_l2_book, get_meta_and_ctxs

HL_URL = "https://api.hyperliquid.xyz/info"

MOCK_MIDS = {"BTC": "94500.0", "ETH": "3200.0", "SOL": "180.0"}

MOCK_META = {
    "universe": [
        {"name": "BTC", "szDecimals": 5, "maxLeverage": 50},
        {"name": "ETH", "szDecimals": 4, "maxLeverage": 25},
    ]
}

MOCK_CTXS = [
    {
        "funding": "0.0001",
        "openInterest": "5000.0",
        "prevDayPx": "93000.0",
        "dayNtlVlm": "500000000.0",
        "markPx": "94500.0",
        "midPx": "94500.0",
    },
    {
        "funding": "-0.00005",
        "openInterest": "20000.0",
        "prevDayPx": "3100.0",
        "dayNtlVlm": "200000000.0",
        "markPx": "3200.0",
        "midPx": "3200.0",
    },
]

MOCK_CANDLES = [
    {
        "t": 1700000000000,
        "T": 1700086399000,
        "s": "BTC",
        "i": "1d",
        "o": "93000.0",
        "c": "94500.0",
        "h": "95000.0",
        "l": "92000.0",
        "v": "123.45",
        "n": 5678,
    }
]

MOCK_BOOK = {
    "coin": "BTC",
    "time": 1700000000000,
    "levels": [
        [{"px": "94490.0", "sz": "0.5", "n": 3}, {"px": "94480.0", "sz": "1.0", "n": 5}],
        [{"px": "94510.0", "sz": "0.3", "n": 2}, {"px": "94520.0", "sz": "0.8", "n": 4}],
    ],
}


def _mock_response(json_data):
    mock = MagicMock()
    mock.json.return_value = json_data
    mock.raise_for_status.return_value = None
    return mock


# ── get_all_mids ──────────────────────────────────────────────────────────────

def test_get_all_mids_returns_dict():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_MIDS)
        result = get_all_mids()
    assert isinstance(result, dict)
    assert "BTC" in result
    assert result["BTC"] == "94500.0"


def test_get_all_mids_posts_correct_payload():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_MIDS)
        get_all_mids()
    mock_post.assert_called_once_with(HL_URL, json={"type": "allMids"}, timeout=10)


# ── get_meta_and_ctxs ─────────────────────────────────────────────────────────

def test_get_meta_and_ctxs_returns_lists():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response([MOCK_META, MOCK_CTXS])
        universe, ctxs = get_meta_and_ctxs()
    assert isinstance(universe, list)
    assert isinstance(ctxs, list)
    assert universe[0]["name"] == "BTC"


def test_get_meta_and_ctxs_equal_lengths():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response([MOCK_META, MOCK_CTXS])
        universe, ctxs = get_meta_and_ctxs()
    assert len(universe) == len(ctxs)


# ── get_candles ───────────────────────────────────────────────────────────────

def test_get_candles_returns_list():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_CANDLES)
        result = get_candles("BTC", "1d", 1699000000000, 1700000000000)
    assert isinstance(result, list)
    assert len(result) == 1


def test_get_candles_required_keys():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_CANDLES)
        result = get_candles("BTC", "1d", 1699000000000, 1700000000000)
    required = {"t", "o", "c", "h", "l", "v", "n"}
    assert required <= set(result[0].keys())


def test_get_candles_posts_correct_payload():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_CANDLES)
        get_candles("BTC", "1d", 1699000000000, 1700000000000)
    call_kwargs = mock_post.call_args
    payload = call_kwargs[1]["json"]
    assert payload["type"] == "candleSnapshot"
    assert payload["req"]["coin"] == "BTC"
    assert payload["req"]["interval"] == "1d"
    assert payload["req"]["startTime"] == 1699000000000
    assert payload["req"]["endTime"] == 1700000000000


# ── get_l2_book ───────────────────────────────────────────────────────────────

def test_get_l2_book_returns_dict_with_coin():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_BOOK)
        result = get_l2_book("BTC")
    assert isinstance(result, dict)
    assert result["coin"] == "BTC"


def test_get_l2_book_has_two_sides():
    with patch("hyperliquid.client.requests.post") as mock_post:
        mock_post.return_value = _mock_response(MOCK_BOOK)
        result = get_l2_book("BTC")
    assert "levels" in result
    assert len(result["levels"]) == 2
    assert len(result["levels"][0]) > 0   # bids
    assert len(result["levels"][1]) > 0   # asks
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_hyperliquid_client.py -v 2>&1 | head -10
```
Expected: `ModuleNotFoundError: No module named 'hyperliquid'`

- [ ] **Step 4: Implement `hyperliquid/client.py`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/hyperliquid/client.py`:

```python
"""Hyperliquid public REST API client — no authentication required."""
import requests

HL_URL = "https://api.hyperliquid.xyz/info"


def get_all_mids() -> dict[str, str]:
    """Return current mid prices for all perpetual markets.

    Returns dict mapping coin name to mid price string, e.g. {"BTC": "94500.0"}.
    """
    resp = requests.post(HL_URL, json={"type": "allMids"}, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_meta_and_ctxs() -> tuple[list[dict], list[dict]]:
    """Return (universe_list, asset_ctx_list) for all perpetual markets.

    universe_list: [{"name": "BTC", "szDecimals": 5, "maxLeverage": 50}, ...]
    asset_ctx_list: [{"funding": "0.0001", "openInterest": "5000.0",
                      "prevDayPx": "93000.0", "dayNtlVlm": "5e8",
                      "markPx": "94500.0", "midPx": "94500.0"}, ...]
    Lists are parallel — index i in universe corresponds to index i in ctxs.
    """
    resp = requests.post(HL_URL, json={"type": "metaAndAssetCtxs"}, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data[0]["universe"], data[1]


def get_candles(coin: str, interval: str, start_ms: int, end_ms: int) -> list[dict]:
    """Return OHLCV candle snapshots for a coin over a time range.

    Args:
        coin: Market name e.g. "BTC"
        interval: One of "1d", "4h", "1h", "15m"
        start_ms: Start time in milliseconds (Unix epoch)
        end_ms: End time in milliseconds (Unix epoch)

    Each returned dict has keys: t (open time ms), T (close time ms), s (coin),
    i (interval), o, c, h, l (OHLC strings), v (volume string), n (trade count int).
    """
    payload = {
        "type": "candleSnapshot",
        "req": {
            "coin": coin,
            "interval": interval,
            "startTime": start_ms,
            "endTime": end_ms,
        },
    }
    resp = requests.post(HL_URL, json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_l2_book(coin: str) -> dict:
    """Return L2 order book for a coin.

    Returns dict with keys:
        coin (str), time (ms), levels (list of [bids, asks]):
            bids: list of {"px": str, "sz": str, "n": int} sorted best (highest) first
            asks: list of {"px": str, "sz": str, "n": int} sorted best (lowest) first
    """
    resp = requests.post(HL_URL, json={"type": "l2Book", "coin": coin}, timeout=10)
    resp.raise_for_status()
    return resp.json()
```

- [ ] **Step 5: Run tests — verify all pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_hyperliquid_client.py -v
```
Expected: 9/9 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add hyperliquid/__init__.py hyperliquid/client.py tests/test_hyperliquid_client.py
git commit -m "feat(hyperliquid): add public API client — mids, meta, candles, book"
```

---

### Task 2: FastAPI Endpoints + pyproject.toml

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py` (add import at line 39; append models + endpoints at end)
- Modify: `seokminal-multi-venue/pyproject.toml` (add `"hyperliquid*"`)
- Modify: `seokminal-multi-venue/tests/test_api_server.py` (append 3 mocked tests)

**Interfaces:**
- Consumes (Task 1): `get_all_mids`, `get_meta_and_ctxs`, `get_candles`, `get_l2_book`
- Produces (Task 3):
  - `GET /crypto/assets` → `CryptoAssetsResponse`
  - `GET /crypto/candles?coin=BTC&interval=1d&days=90` → `CryptoCandlesResponse`
  - `GET /crypto/book?coin=BTC` → `CryptoBookResponse`

- [ ] **Step 1: Write failing API tests**

Append to the END of `seokminal-multi-venue/tests/test_api_server.py`:

```python
# ── Crypto (Hyperliquid) endpoints ────────────────────────────────────────────

MOCK_HL_MIDS = {"BTC": "94500.0", "ETH": "3200.0"}

MOCK_HL_META = [
    {"name": "BTC", "szDecimals": 5, "maxLeverage": 50},
    {"name": "ETH", "szDecimals": 4, "maxLeverage": 25},
]

MOCK_HL_CTXS = [
    {
        "funding": "0.0001",
        "openInterest": "5000.0",
        "prevDayPx": "93000.0",
        "dayNtlVlm": "500000000.0",
        "markPx": "94500.0",
        "midPx": "94500.0",
    },
    {
        "funding": "-0.00005",
        "openInterest": "20000.0",
        "prevDayPx": "3100.0",
        "dayNtlVlm": "200000000.0",
        "markPx": "3200.0",
        "midPx": "3200.0",
    },
]

MOCK_HL_CANDLES = [
    {
        "t": 1700000000000, "T": 1700086399000, "s": "BTC", "i": "1d",
        "o": "93000.0", "c": "94500.0", "h": "95000.0", "l": "92000.0",
        "v": "123.45", "n": 5678,
    }
]

MOCK_HL_BOOK = {
    "coin": "BTC",
    "time": 1700000000000,
    "levels": [
        [{"px": "94490.0", "sz": "0.5", "n": 3}, {"px": "94480.0", "sz": "1.0", "n": 5}],
        [{"px": "94510.0", "sz": "0.3", "n": 2}, {"px": "94520.0", "sz": "0.8", "n": 4}],
    ],
}


@patch("api_server.main.get_meta_and_ctxs")
@patch("api_server.main.get_all_mids")
def test_crypto_assets_structure(mock_mids, mock_meta_ctxs):
    mock_mids.return_value = MOCK_HL_MIDS
    mock_meta_ctxs.return_value = (MOCK_HL_META, MOCK_HL_CTXS)
    r = client.get("/crypto/assets")
    assert r.status_code == 200
    data = r.json()
    assert "assets" in data and data["count"] == 2
    asset = data["assets"][0]
    assert asset["name"] == "BTC"
    assert "mid_price" in asset and "funding_rate_8h" in asset and "day_change_pct" in asset


@patch("api_server.main.get_candles")
def test_crypto_candles_structure(mock_candles):
    mock_candles.return_value = MOCK_HL_CANDLES
    r = client.get("/crypto/candles?coin=BTC&interval=1d&days=30")
    assert r.status_code == 200
    data = r.json()
    assert data["coin"] == "BTC" and data["interval"] == "1d"
    assert len(data["candles"]) == 1
    candle = data["candles"][0]
    assert "time_ms" in candle and "open" in candle and "close" in candle


@patch("api_server.main.get_l2_book")
def test_crypto_book_structure(mock_book):
    mock_book.return_value = MOCK_HL_BOOK
    r = client.get("/crypto/book?coin=BTC")
    assert r.status_code == 200
    data = r.json()
    assert "bids" in data and "asks" in data and "mid_price" in data and "spread" in data
    assert data["bids"][0]["price"] == pytest.approx(94490.0)
    assert data["asks"][0]["price"] == pytest.approx(94510.0)
```

Note: `patch` and `pytest` are already imported at the top of `test_api_server.py`. If `patch` is not imported, add `from unittest.mock import patch` at the top of the file.

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_crypto_assets_structure -v 2>&1 | tail -5
```
Expected: FAILED with 404 or AttributeError

- [ ] **Step 3: Update `pyproject.toml`**

In `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/pyproject.toml`, line 24 — add `"hyperliquid*"` at the end of the include list:

Find:
```toml
include = ["backends*", "adapters*", "tests*", "api_server*", "backtest_runner*", "condition_engine*", "strategy_spawner*", "correlation_analysis*", "beta_analysis*", "risk_analysis*", "fred*", "ecos*", "corp_finance*", "live_engine*", "monte_carlo*", "regime_filter*", "krx*", "sec_edgar*", "ksd*", "options*", "futures*", "forex*"]
```

Replace with:
```toml
include = ["backends*", "adapters*", "tests*", "api_server*", "backtest_runner*", "condition_engine*", "strategy_spawner*", "correlation_analysis*", "beta_analysis*", "risk_analysis*", "fred*", "ecos*", "corp_finance*", "live_engine*", "monte_carlo*", "regime_filter*", "krx*", "sec_edgar*", "ksd*", "options*", "futures*", "forex*", "hyperliquid*"]
```

- [ ] **Step 4: Add top-level import to `api_server/main.py`**

Line 38 currently has `from forex.pricer import fx_forward, fx_curve, fx_carry`. Add the hyperliquid import on line 39:

Find:
```python
from forex.pricer import fx_forward, fx_curve, fx_carry
```

Replace with:
```python
from forex.pricer import fx_forward, fx_curve, fx_carry
from hyperliquid.client import get_all_mids, get_meta_and_ctxs, get_candles, get_l2_book
```

- [ ] **Step 5: Append Pydantic models and endpoints to `api_server/main.py`**

At the very END of `api_server/main.py`, append:

```python
# ═══════════════════════════════════════════════════════════════════════════════
# Crypto Analytics (Hyperliquid)
# ═══════════════════════════════════════════════════════════════════════════════

import time as _time


class CryptoAsset(BaseModel):
    name: str
    mid_price: float
    mark_price: float
    funding_rate_8h: float    # % per 8h (e.g. 0.01 = 0.01% per 8h)
    funding_rate: float       # annualized % (funding_rate_8h * 3 * 365)
    open_interest: float
    day_change_pct: float
    day_volume: float


class CryptoAssetsResponse(BaseModel):
    assets: list[CryptoAsset]
    count: int


class CryptoCandle(BaseModel):
    time_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    num_trades: int


class CryptoCandlesResponse(BaseModel):
    coin: str
    interval: str
    candles: list[CryptoCandle]


class BookLevel(BaseModel):
    price: float
    size: float
    num_orders: int


class CryptoBookResponse(BaseModel):
    coin: str
    bids: list[BookLevel]   # top 20, best (highest) first
    asks: list[BookLevel]   # top 20, best (lowest) first
    mid_price: float
    spread: float
    spread_pct: float


@app.get("/crypto/assets", response_model=CryptoAssetsResponse)
def get_crypto_assets() -> CryptoAssetsResponse:
    mids = get_all_mids()
    universe, ctxs = get_meta_and_ctxs()
    assets = []
    for meta, ctx in zip(universe, ctxs):
        name = meta["name"]
        mid_price = float(mids.get(name) or ctx.get("midPx") or "0")
        prev_day_px = float(ctx.get("prevDayPx") or "0")
        day_change_pct = ((mid_price - prev_day_px) / prev_day_px * 100) if prev_day_px else 0.0
        funding_8h = float(ctx.get("funding") or "0")
        assets.append(CryptoAsset(
            name=name,
            mid_price=round(mid_price, 6),
            mark_price=round(float(ctx.get("markPx") or "0"), 6),
            funding_rate_8h=round(funding_8h * 100, 6),
            funding_rate=round(funding_8h * 100 * 3 * 365, 4),
            open_interest=round(float(ctx.get("openInterest") or "0"), 4),
            day_change_pct=round(day_change_pct, 4),
            day_volume=round(float(ctx.get("dayNtlVlm") or "0"), 2),
        ))
    return CryptoAssetsResponse(assets=assets, count=len(assets))


@app.get("/crypto/candles", response_model=CryptoCandlesResponse)
def get_crypto_candles(
    coin: str = Query("BTC"),
    interval: str = Query("1d"),
    days: int = Query(90, ge=1, le=365),
) -> CryptoCandlesResponse:
    end_ms = int(_time.time() * 1000)
    start_ms = end_ms - days * 24 * 3600 * 1000
    raw = get_candles(coin.upper(), interval, start_ms, end_ms)
    candles = [
        CryptoCandle(
            time_ms=c["t"],
            open=float(c["o"]),
            high=float(c["h"]),
            low=float(c["l"]),
            close=float(c["c"]),
            volume=float(c["v"]),
            num_trades=int(c["n"]),
        )
        for c in raw
    ]
    return CryptoCandlesResponse(coin=coin.upper(), interval=interval, candles=candles)


@app.get("/crypto/book", response_model=CryptoBookResponse)
def get_crypto_book(
    coin: str = Query("BTC"),
) -> CryptoBookResponse:
    raw = get_l2_book(coin.upper())
    levels = raw.get("levels", [[], []])
    bid_raw = levels[0] if len(levels) > 0 else []
    ask_raw = levels[1] if len(levels) > 1 else []
    bids = [BookLevel(price=float(l["px"]), size=float(l["sz"]), num_orders=int(l["n"])) for l in bid_raw[:20]]
    asks = [BookLevel(price=float(l["px"]), size=float(l["sz"]), num_orders=int(l["n"])) for l in ask_raw[:20]]
    mid_price = (bids[0].price + asks[0].price) / 2 if bids and asks else 0.0
    spread = asks[0].price - bids[0].price if bids and asks else 0.0
    spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0.0
    return CryptoBookResponse(
        coin=coin.upper(),
        bids=bids,
        asks=asks,
        mid_price=round(mid_price, 6),
        spread=round(spread, 6),
        spread_pct=round(spread_pct, 4),
    )
```

- [ ] **Step 6: Verify `patch` is importable in test file**

Check the top of `tests/test_api_server.py`. If `from unittest.mock import patch` is not there, add it after the existing imports:

```python
from unittest.mock import patch
```

- [ ] **Step 7: Run the 3 new API tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_crypto_assets_structure tests/test_api_server.py::test_crypto_candles_structure tests/test_api_server.py::test_crypto_book_structure -v
```
Expected: 3/3 PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py pyproject.toml tests/test_api_server.py
git commit -m "feat(api): add /crypto/assets, /crypto/candles, /crypto/book endpoints"
```

---

### Task 3: Frontend API Client + Markets Tab + Chart Tab

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts` (append 5 interfaces + 3 functions)
- Create: `seokminal-dashboard/app/crypto/page.tsx`

**Interfaces:**
- Consumes (Task 2):
  - `GET /crypto/assets` → `CryptoAssetsResponse`
  - `GET /crypto/candles?coin=&interval=&days=` → `CryptoCandlesResponse`
  - `GET /crypto/book?coin=` → `CryptoBookResponse`
- Produces (Task 4): page at `/crypto` with Markets, Chart, and Book placeholder tabs

- [ ] **Step 1: Append to `lib/api.ts`**

At the END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/lib/api.ts`, append:

```typescript
// ── Crypto (Hyperliquid) ──────────────────────────────────────────────────────

export interface CryptoAsset {
  name: string;
  mid_price: number;
  mark_price: number;
  funding_rate_8h: number;   // % per 8h
  funding_rate: number;      // annualized %
  open_interest: number;
  day_change_pct: number;
  day_volume: number;
}

export interface CryptoAssetsResponse {
  assets: CryptoAsset[];
  count: number;
}

export interface CryptoCandle {
  time_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  num_trades: number;
}

export interface CryptoCandlesResponse {
  coin: string;
  interval: string;
  candles: CryptoCandle[];
}

export interface BookLevel {
  price: number;
  size: number;
  num_orders: number;
}

export interface CryptoBookResponse {
  coin: string;
  bids: BookLevel[];
  asks: BookLevel[];
  mid_price: number;
  spread: number;
  spread_pct: number;
}

export async function getCryptoAssets(
  signal?: AbortSignal
): Promise<CryptoAssetsResponse> {
  return handleResponse<CryptoAssetsResponse>(
    await fetch(`${API_URL}/crypto/assets`, { signal })
  );
}

export async function getCryptoCandles(
  coin: string,
  interval: string,
  days: number,
  signal?: AbortSignal
): Promise<CryptoCandlesResponse> {
  const params = new URLSearchParams({
    coin,
    interval,
    days: String(days),
  });
  return handleResponse<CryptoCandlesResponse>(
    await fetch(`${API_URL}/crypto/candles?${params}`, { signal })
  );
}

export async function getCryptoBook(
  coin: string,
  signal?: AbortSignal
): Promise<CryptoBookResponse> {
  const params = new URLSearchParams({ coin });
  return handleResponse<CryptoBookResponse>(
    await fetch(`${API_URL}/crypto/book?${params}`, { signal })
  );
}
```

- [ ] **Step 2: Run frontend tests — verify still passing**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero TypeScript errors

- [ ] **Step 3: Create `app/crypto/page.tsx`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/crypto/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import {
  ApiError,
  getCryptoAssets, getCryptoCandles,
  type CryptoAssetsResponse, type CryptoCandlesResponse,
} from "@/lib/api";

type Tab = "markets" | "chart" | "book";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(v: number): string { return v.toFixed(2); }
function fmt4(v: number): string { return v.toFixed(4); }
function fmt6(v: number): string { return v.toFixed(6); }

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

function fmtVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function changeCls(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function fundingCls(v: number): string {
  return v > 0 ? "text-warn" : v < 0 ? "text-info" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mb-3">ERR: {msg}</p> : null;
}

// ── Markets Tab ───────────────────────────────────────────────────────────────

function MarketsTab() {
  const [result, setResult]   = useState<CryptoAssetsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getCryptoAssets(ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch markets");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-text-3 text-xs uppercase tracking-wider">
          {result ? `${result.count} markets · Hyperliquid Perps` : "Hyperliquid Perps"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="h-7 px-4 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <Err msg={error} />
      {loading && !result && (
        <div className="text-center py-16 text-text-3 text-sm">Loading markets…</div>
      )}
      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border text-text-3">
                <th className="px-3 py-2 text-left font-medium">Coin</th>
                <th className="px-3 py-2 text-right font-medium">Mid Price</th>
                <th className="px-3 py-2 text-right font-medium">24h Change</th>
                <th className="px-3 py-2 text-right font-medium">Funding 8h %</th>
                <th className="px-3 py-2 text-right font-medium">Funding Ann %</th>
                <th className="px-3 py-2 text-right font-medium">OI</th>
                <th className="px-3 py-2 text-right font-medium">24h Vol</th>
              </tr>
            </thead>
            <tbody>
              {result.assets.map(asset => (
                <tr key={asset.name} className="border-b border-border hover:bg-panel-2">
                  <td className="px-3 py-1.5 text-accent font-semibold">{asset.name}</td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmtPrice(asset.mid_price)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${changeCls(asset.day_change_pct)}`}>
                    {asset.day_change_pct >= 0 ? "+" : ""}{fmt2(asset.day_change_pct)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${fundingCls(asset.funding_rate_8h)}`}>
                    {asset.funding_rate_8h >= 0 ? "+" : ""}{fmt4(asset.funding_rate_8h)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${fundingCls(asset.funding_rate)}`}>
                    {asset.funding_rate >= 0 ? "+" : ""}{fmt2(asset.funding_rate)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt2(asset.open_interest)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmtVolume(asset.day_volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Chart Tab ─────────────────────────────────────────────────────────────────

const INTERVALS = ["1d", "4h", "1h", "15m"] as const;

function ChartTab() {
  const [coin, setCoin]       = useState("BTC");
  const [interval, setInterval] = useState<typeof INTERVALS[number]>("1d");
  const [days, setDays]       = useState("90");
  const [result, setResult]   = useState<CryptoCandlesResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);
  const chartRef              = useRef<HTMLDivElement | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getCryptoCandles(
        coin.toUpperCase(), interval, parseInt(days, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !chartRef.current) return;

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
      result.candles.map(c => ({
        time: Math.floor(c.time_ms / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    chart.timeScale().fitContent();

    return () => { chart.remove(); };
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Coin</label>
            <input
              type="text"
              value={coin}
              onChange={e => setCoin(e.target.value.toUpperCase())}
              placeholder="BTC"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20 uppercase"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Interval</label>
            <select
              value={interval}
              onChange={e => setInterval(e.target.value as typeof INTERVALS[number])}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent cursor-pointer"
            >
              {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Days</label>
            <input
              type="number"
              value={days}
              onChange={e => setDays(e.target.value)}
              min={1}
              max={365}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </div>
      <Err msg={error} />
      {result && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {result.coin} · {result.interval} · {result.candles.length} candles
            </span>
          </div>
          <div className="p-3">
            <div ref={chartRef} style={{ height: "320px" }} />
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Enter a coin and click Load to view the chart.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "markets", label: "Markets" },
  { id: "chart",   label: "Chart" },
  { id: "book",    label: "Book" },
];

export default function CryptoPage() {
  const [tab, setTab] = useState<Tab>("markets");

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Crypto Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Live perpetual futures data from Hyperliquid — no authentication required.
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

      {tab === "markets" && <MarketsTab />}
      {tab === "chart"   && <ChartTab />}
      {tab === "book"    && (
        <div className="text-center py-16 text-text-3 text-sm">
          Order book depth — implemented in Task 4.
        </div>
      )}
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
Expected: 127/127 passing, zero errors

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/crypto/page.tsx
git commit -m "feat(crypto): add Crypto page (Markets + Chart tabs) and API client types"
```

---

### Task 4: Order Book Depth (D3) + NavBar + Docs

**Files:**
- Modify: `seokminal-dashboard/app/crypto/page.tsx` (add `BookTab`, replace placeholder)
- Modify: `seokminal-dashboard/components/NavBar.tsx` (add Crypto after Forex, before Report)
- Modify: `seokminal-dashboard/docs/roadmap.md` (mark Phase 16 complete)
- Modify: `seokminal-dashboard/docs/progress.md` (prepend Phase 16 section)

**Interfaces:**
- Consumes: `getCryptoBook`, `CryptoBookResponse`, `BookLevel` from `lib/api.ts`
- Consumes: D3 v7 (already installed)

- [ ] **Step 1: Run baseline tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 127/127 passing

- [ ] **Step 2: Update imports in `app/crypto/page.tsx`**

Change the import block at the top:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import {
  ApiError,
  getCryptoAssets, getCryptoCandles, getCryptoBook,
  type CryptoAssetsResponse, type CryptoCandlesResponse,
  type CryptoBookResponse, type BookLevel,
} from "@/lib/api";
```

- [ ] **Step 3: Add `BookTab` component before `const TABS`**

Insert this function immediately above `const TABS: ...`:

```tsx
// ── Book Tab ──────────────────────────────────────────────────────────────────

function BookTab() {
  const [coin, setCoin]       = useState("BTC");
  const [result, setResult]   = useState<CryptoBookResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);
  const svgRef                = useRef<SVGSVGElement | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getCryptoBook(coin.toUpperCase(), ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = 600, H = 280;
    const margin = { top: 20, right: 30, bottom: 40, left: 80 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const N = 15;
    const bids = result.bids.slice(0, N);
    const asks = result.asks.slice(0, N);

    // Cumulative bid depth (bids sorted best=highest first → cumulate left to right)
    const bidCum: { price: number; cumSize: number }[] = [];
    bids.forEach((l, i) => {
      bidCum.push({ price: l.price, cumSize: (bidCum[i - 1]?.cumSize ?? 0) + l.size });
    });

    // Cumulative ask depth (asks sorted best=lowest first → cumulate left to right)
    const askCum: { price: number; cumSize: number }[] = [];
    asks.forEach((l, i) => {
      askCum.push({ price: l.price, cumSize: (askCum[i - 1]?.cumSize ?? 0) + l.size });
    });

    const allPrices = [...bidCum.map(d => d.price), ...askCum.map(d => d.price)];
    const maxCum = Math.max(...bidCum.map(d => d.cumSize), ...askCum.map(d => d.cumSize));

    const xScale = d3.scaleLinear()
      .domain([d3.min(allPrices)! * 0.9995, d3.max(allPrices)! * 1.0005])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, maxCum * 1.05])
      .range([innerH, 0]);

    // Bid area (green, prices from worst to best = left to right)
    const bidArea = d3.area<{ price: number; cumSize: number }>()
      .x(d => xScale(d.price))
      .y0(innerH)
      .y1(d => yScale(d.cumSize))
      .curve(d3.curveStepAfter);

    g.append("path")
      .datum([...bidCum].reverse())   // worst bid first for step chart
      .attr("d", bidArea)
      .attr("fill", "#44cc88")
      .attr("opacity", 0.3);

    g.append("path")
      .datum([...bidCum].reverse())
      .attr("d",
        d3.line<{ price: number; cumSize: number }>()
          .x(d => xScale(d.price))
          .y(d => yScale(d.cumSize))
          .curve(d3.curveStepAfter)
      )
      .attr("fill", "none")
      .attr("stroke", "#44cc88")
      .attr("stroke-width", 1.5);

    // Ask area (red, prices from best to worst = left to right)
    const askArea = d3.area<{ price: number; cumSize: number }>()
      .x(d => xScale(d.price))
      .y0(innerH)
      .y1(d => yScale(d.cumSize))
      .curve(d3.curveStepBefore);

    g.append("path")
      .datum(askCum)
      .attr("d", askArea)
      .attr("fill", "#ff4444")
      .attr("opacity", 0.3);

    g.append("path")
      .datum(askCum)
      .attr("d",
        d3.line<{ price: number; cumSize: number }>()
          .x(d => xScale(d.price))
          .y(d => yScale(d.cumSize))
          .curve(d3.curveStepBefore)
      )
      .attr("fill", "none")
      .attr("stroke", "#ff4444")
      .attr("stroke-width", 1.5);

    // Mid price vertical dashed line
    g.append("line")
      .attr("x1", xScale(result.mid_price)).attr("x2", xScale(result.mid_price))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#9AA4B2")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    g.append("text")
      .attr("x", xScale(result.mid_price))
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#9AA4B2")
      .attr("font-size", 10)
      .text(`Mid ${result.mid_price.toFixed(2)}`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => String(+d)))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 10))
      .call(ax => ax.selectAll(".tick line").remove());

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 10))
      .call(ax => ax.selectAll(".tick line").attr("stroke", "#2a3040").attr("x2", innerW));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 32)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Price");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -62)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Cumulative Size");

  }, [result]);

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Coin</label>
            <input
              type="text"
              value={coin}
              onChange={e => setCoin(e.target.value.toUpperCase())}
              placeholder="BTC"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20 uppercase"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </div>
      <Err msg={error} />
      {result && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-4">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {result.coin} · Order Book Depth
            </span>
            <span className="text-text-2 text-[11px]">
              Spread: <span className="text-text-1 font-data">{result.spread.toFixed(4)}</span>
              {" "}(<span className="text-text-1 font-data">{result.spread_pct.toFixed(4)}%</span>)
            </span>
          </div>
          <div className="p-4">
            <svg ref={svgRef} width={600} height={280} className="block" />
          </div>
          <div className="px-4 pb-3 flex gap-6 text-[11px] text-text-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#44cc88", opacity: 0.7 }} />
              Bids
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ff4444", opacity: 0.7 }} />
              Asks
            </span>
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Enter a coin and click Load to view the order book depth.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace the Book placeholder**

Find:
```tsx
      {tab === "book"    && (
        <div className="text-center py-16 text-text-3 text-sm">
          Order book depth — implemented in Task 4.
        </div>
      )}
```

Replace with:
```tsx
      {tab === "book"    && <BookTab />}
```

- [ ] **Step 5: Add Crypto to NavBar**

In `seokminal-dashboard/components/NavBar.tsx`, find:
```tsx
      { href: "/forex",       label: "Forex" },
      { href: "/report",      label: "Report" },
```

Replace with:
```tsx
      { href: "/forex",       label: "Forex" },
      { href: "/crypto",      label: "Crypto" },
      { href: "/report",      label: "Report" },
```

- [ ] **Step 6: Run tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero errors

- [ ] **Step 7: Update docs**

In `seokminal-dashboard/docs/roadmap.md`:
1. Get current commit hash: `git -C /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard log --oneline -1 --format="%h"`
2. Update `**HEAD:**` to that hash
3. Add Phase 16 row to the completed table (after Phase 15):
   ```
   | 16 | Crypto Analytics | `hyperliquid/client.py`, `app/crypto/page.tsx`, order book depth | — |
   ```
4. Remove the entire `## 향후 계획 — Asset Class 확장 (Phase 16)` section and everything under it (Phase 16 and Phase 17 IB integration are now handled separately)

In `seokminal-dashboard/docs/progress.md`, prepend this section at the very top:

```markdown
## Phase 16 — Crypto Analytics (2026-06-28)

### 완료된 작업
- Hyperliquid 클라이언트: `get_all_mids`, `get_meta_and_ctxs`, `get_candles`, `get_l2_book` (`hyperliquid/client.py`)
- API: `/crypto/assets`, `/crypto/candles`, `/crypto/book` endpoints (`api_server/main.py`)
- Frontend: `/crypto` 페이지 — Markets 테이블 (라이브 데이터), Chart (lightweight-charts v5 캔들), Order Book Depth (D3 누적 depth chart)
- NavBar: Crypto 추가 (Forex↔Report 사이)

### 변경된 파일
**Backend (seokminal-multi-venue):**
- `hyperliquid/__init__.py` (new)
- `hyperliquid/client.py` (new)
- `tests/test_hyperliquid_client.py` (new, 9 tests, mocked)
- `api_server/main.py` (+~80 lines)
- `pyproject.toml` (+hyperliquid*)

**Frontend (seokminal-dashboard):**
- `lib/api.ts` (+3 functions, +5 types)
- `app/crypto/page.tsx` (new)
- `components/NavBar.tsx` (Crypto link added)

### 다음 할 일
- Phase 17: IB 실제 데이터 연결 (Options/Forex/Futures 기존 페이지 업그레이드)

```

- [ ] **Step 8: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/crypto/page.tsx components/NavBar.tsx docs/roadmap.md docs/progress.md
git commit -m "feat(crypto): add order book depth D3 chart, Crypto NavBar link, docs update"
```
