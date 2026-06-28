# Phase 18: Universal Search + Real-time Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search any KR/US listed stock by name or ticker, load its OHLCV chart on demand, and receive real-time KIS WebSocket price ticks in the browser.

**Architecture:** A new `kr_universe` module downloads the full KRX stock list from KIND (no API key) and caches it in memory for 24 hours; name/code search is a local filter on the cache. KR OHLCV is fetched on-demand via the existing `KISClient.get_daily_price()`. US symbol search calls IB `reqMatchingSymbolsAsync`; US OHLCV uses the existing `/ib/bars` endpoint. A FastAPI `@app.websocket` endpoint (`/ws/live/{code}`) relays KIS WebSocket ticks from the existing `KISWebSocketClient` to the browser as JSON. The frontend `/search` page ties search, chart, and live ticker together.

**Tech Stack:** Python `requests` + `pandas.read_html` for KIND scrape, `KISClient` (existing), `KISWebSocketClient` (existing), IB `reqMatchingSymbols`, FastAPI WebSocket, lw-charts v5, browser `WebSocket` API.

## Global Constraints

- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- Backend repo root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/`
- Frontend repo root: `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/`
- Run backend tests: `cd seokminal-multi-venue && pytest tests/test_kr_universe.py tests/test_api_server.py -v`
- Run frontend tests: `cd seokminal-dashboard && npm test`
- `asyncio_mode = "auto"` — **never** add `@pytest.mark.asyncio` on any test function
- Design tokens only in className: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info` — **no hex values in className**
- Active element: `border-accent text-accent bg-accent/10`; primary action button: `bg-accent text-black`
- No `style={{}}` except chart-lib JS config (`createChart` options) and `style={{ height: "320px" }}` on the chart container div
- lw-charts v5: `chart.addSeries(CandlestickSeries, {...})`, timestamps as `Math.floor(epochMs / 1000) as UTCTimestamp`
- AbortController pattern: abort prev → new ctrl → assign to ref → run fetch → catch AbortError silently → finally guard with `abortRef.current === ctrl` → `useEffect(() => () => abortRef.current?.abort(), [])` unmount cleanup
- API calls in components: use only functions from `lib/api.ts` — no raw `fetch` in page files
- `KISClient` constructor signature: `KISClient(app_key: str, app_secret: str)`
- `KISClient.get_daily_price(code, start, end)` returns `list[dict]` with keys: `stck_bsop_date` (YYYYMMDD), `stck_oprc` (open str), `stck_hgpr` (high str), `stck_lwpr` (low str), `stck_clpr` (close str), `acml_vol` (volume str)
- IB reqMatchingSymbols: `await ib.reqMatchingSymbolsAsync(q)` returns `list[ContractDescription]`; each `.contract` has `.symbol` (str), `.description` (str|None), `.secType` (str), `.primaryExch` (str), `.currency` (str)
- KIS H0STCNT0 tick message format: pipe-delimited header + caret-delimited data fields
  - JSON messages (start with `{`): subscription ack/ping — skip
  - Data messages: `"0|H0STCNT0|001|{data}"`; data split by `^`: [0]=code, [1]=time(HHMMSS), [2]=price, [3]=change_abs, [4]=change_sign(2=up,5=down,3=flat), [5]=change_rate_pct, [12]=trade_volume, [13]=total_volume
- `import os` must be added to the top-level imports in `api_server/main.py` (currently only inlined inside functions)
- WebSocket URL in browser: replace `http://` → `ws://` in API_BASE (`http://localhost:8000` → `ws://localhost:8000`)
- KIND URL: `https://kind.krx.co.kr/corpgeneral/corpList.do` with POST params `method=download&searchType=13`, header `Referer: https://kind.krx.co.kr/`

---

### Task 1: KR Universe Cache Module

**Files:**
- Create: `kr_universe/__init__.py`
- Create: `kr_universe/client.py`
- Create: `tests/test_kr_universe.py`
- Modify: `pyproject.toml` — add `"kr_universe*"` to `[tool.setuptools.packages.find] include`

**Interfaces:**
- Produces: `get_universe(session?, kind_url?) -> list[dict]` — each dict `{"code": str (6-char zero-padded), "name": str, "market": str}`
- Produces: `search_universe(q: str, max_results: int = 20) -> list[dict]`
- Internal module state: `_cache: list[dict] = []`, `_cache_ts: float = 0.0` — tests reset these to avoid cross-test pollution

- [ ] **Step 1: Write the failing tests**

Create `tests/test_kr_universe.py`:

```python
from unittest.mock import MagicMock
import kr_universe.client as kru

_SAMPLE_HTML = """<html><body><table>
<tr><th>회사명</th><th>시장구분</th><th>종목코드</th><th>업종</th><th>주요제품</th><th>상장일</th><th>결산월</th><th>대표자명</th><th>홈페이지</th><th>지역</th></tr>
<tr><td>삼성전자</td><td>유가증권</td><td>005930</td><td>전자</td><td>반도체</td><td>1975-06-11</td><td>12월</td><td>이재용</td><td>www.samsung.com</td><td>경기도</td></tr>
<tr><td>삼성SDI</td><td>유가증권</td><td>006400</td><td>화학</td><td>배터리</td><td>1979-06-14</td><td>12월</td><td>최윤호</td><td>www.samsungsdi.com</td><td>경기도</td></tr>
<tr><td>카카오</td><td>코스닥</td><td>35720</td><td>IT</td><td>플랫폼</td><td>2006-01-31</td><td>12월</td><td>홍은택</td><td>www.kakao.com</td><td>제주도</td></tr>
</table></body></html>"""


def _mock_session(html: str = _SAMPLE_HTML) -> MagicMock:
    resp = MagicMock()
    resp.text = html
    resp.raise_for_status = MagicMock()
    session = MagicMock()
    session.get.return_value = resp
    return session


def setup_function():
    kru._cache = []
    kru._cache_ts = 0.0


def test_get_universe_returns_all_stocks():
    universe = kru.get_universe(session=_mock_session())
    assert len(universe) == 3


def test_get_universe_structure():
    universe = kru.get_universe(session=_mock_session())
    assert universe[0] == {"code": "005930", "name": "삼성전자", "market": "유가증권"}


def test_get_universe_zero_pads_short_code():
    universe = kru.get_universe(session=_mock_session())
    kakao = next(u for u in universe if u["name"] == "카카오")
    assert kakao["code"] == "035720"


def test_get_universe_uses_memory_cache():
    kru._cache = [{"code": "999999", "name": "캐시전용", "market": "X"}]
    kru._cache_ts = float("inf")
    universe = kru.get_universe()  # no session arg — must NOT make HTTP call
    assert universe[0]["code"] == "999999"


def test_get_universe_refreshes_stale_cache():
    kru._cache = [{"code": "OLD", "name": "구버전", "market": "X"}]
    kru._cache_ts = 0.0  # stale
    universe = kru.get_universe(session=_mock_session())
    assert len(universe) == 3


def test_search_by_name():
    kru.get_universe(session=_mock_session())
    results = kru.search_universe("삼성")
    assert len(results) == 2
    assert all("삼성" in r["name"] for r in results)


def test_search_by_code():
    kru.get_universe(session=_mock_session())
    results = kru.search_universe("005930")
    assert results[0]["name"] == "삼성전자"


def test_search_empty_query_returns_empty():
    kru._cache = [{"code": "005930", "name": "삼성전자", "market": "유가증권"}]
    kru._cache_ts = float("inf")
    assert kru.search_universe("") == []


def test_search_max_results():
    kru._cache = [{"code": f"{i:06d}", "name": f"종목{i}", "market": "유가증권"} for i in range(50)]
    kru._cache_ts = float("inf")
    results = kru.search_universe("종목", max_results=10)
    assert len(results) == 10
```

- [ ] **Step 2: Run tests — expect ImportError (module doesn't exist yet)**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_kr_universe.py -v 2>&1 | head -10
```
Expected: `ModuleNotFoundError: No module named 'kr_universe'`

- [ ] **Step 3: Create `kr_universe/__init__.py`**

```python
```
(empty file)

- [ ] **Step 4: Create `kr_universe/client.py`**

```python
"""Korean stock universe from KIND (kind.krx.co.kr).

Downloads full KRX-listed stock list (KOSPI + KOSDAQ + KONEX) via
KIND's public HTML page, caches in memory for 24 hours.
No API key required.
"""
from __future__ import annotations

import io
import time

import pandas as pd
import requests

_KIND_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do"
_CACHE_TTL_SECONDS = 86400  # 24 hours

_cache: list[dict] = []
_cache_ts: float = 0.0


def get_universe(
    session: requests.Session | None = None,
    kind_url: str = _KIND_URL,
) -> list[dict]:
    """Return full KRX stock list, refreshing from KIND if cache is stale.

    Each item: {"code": "005930", "name": "삼성전자", "market": "유가증권"}
    """
    global _cache, _cache_ts
    if _cache and time.time() - _cache_ts < _CACHE_TTL_SECONDS:
        return _cache

    active_session = session or requests.Session()
    r = active_session.get(
        kind_url,
        params={"method": "download", "searchType": 13},
        headers={"Referer": "https://kind.krx.co.kr/"},
        timeout=15,
    )
    r.raise_for_status()
    df = pd.read_html(io.StringIO(r.text), encoding="euc-kr")[0]
    df["종목코드"] = df["종목코드"].astype(str).str.zfill(6)
    _cache = [
        {
            "code": str(row["종목코드"]),
            "name": str(row["회사명"]),
            "market": str(row["시장구분"]),
        }
        for _, row in df.iterrows()
    ]
    _cache_ts = time.time()
    return _cache


def search_universe(q: str, max_results: int = 20) -> list[dict]:
    """Search cache by name or code (case-insensitive contains).

    Returns up to max_results matching items. Returns [] for empty query.
    """
    q_stripped = q.strip()
    if not q_stripped:
        return []
    universe = get_universe()
    q_lower = q_stripped.lower()
    matches = [
        item
        for item in universe
        if q_lower in item["name"].lower() or q_lower in item["code"]
    ]
    return matches[:max_results]
```

- [ ] **Step 5: Add `kr_universe*` to `pyproject.toml`**

In `pyproject.toml`, find the `include` list under `[tool.setuptools.packages.find]` and add `"kr_universe*"`:

```toml
include = ["backends*", "adapters*", "tests*", "api_server*", "backtest_runner*", "condition_engine*", "strategy_spawner*", "correlation_analysis*", "beta_analysis*", "risk_analysis*", "fred*", "ecos*", "corp_finance*", "live_engine*", "monte_carlo*", "regime_filter*", "krx*", "sec_edgar*", "ksd*", "options*", "futures*", "forex*", "hyperliquid*", "kr_universe*"]
```

- [ ] **Step 6: Run tests — expect all 9 PASS**

```bash
pytest tests/test_kr_universe.py -v
```
Expected: `9 passed`

- [ ] **Step 7: Commit**

```bash
git add kr_universe/__init__.py kr_universe/client.py tests/test_kr_universe.py pyproject.toml
git commit -m "feat(kr-universe): add KRX stock universe cache module"
```

---

### Task 2: KR Search + OHLCV API Endpoints

**Files:**
- Modify: `api_server/main.py` — add `import os` at top; add `KRSearchResult`, `KRSearchResponse`, `KRBar`, `KRBarsResponse` models; add `GET /search/kr` and `GET /kr/bars` endpoints
- Modify: `tests/test_api_server.py` — append 4 new tests

**Interfaces:**
- Consumes (Task 1): `from kr_universe.client import search_universe, get_universe`
- Consumes (existing): `from backends.kis.client import KISClient`
- Produces: `GET /search/kr?q=...` → `KRSearchResponse`
- Produces: `GET /kr/bars?code=005930&days=365` → `KRBarsResponse`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_api_server.py`:

```python
# ── /search/kr ─────────────────────────────────────────────────────────────────

def test_search_kr_returns_results():
    with patch("api_server.main.search_universe") as mock_search:
        mock_search.return_value = [
            {"code": "005930", "name": "삼성전자", "market": "유가증권"},
            {"code": "006400", "name": "삼성SDI", "market": "유가증권"},
        ]
        r = client.get("/search/kr?q=삼성")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 2
    assert data["results"][0]["code"] == "005930"
    assert data["results"][0]["name"] == "삼성전자"


def test_search_kr_missing_q_returns_422():
    r = client.get("/search/kr")
    assert r.status_code == 422


# ── /kr/bars ───────────────────────────────────────────────────────────────────

def _make_kis_row(date: str = "20250102") -> dict:
    return {
        "stck_bsop_date": date,
        "stck_oprc": "70000",
        "stck_hgpr": "71000",
        "stck_lwpr": "69500",
        "stck_clpr": "70500",
        "acml_vol": "5000000",
    }


@patch("api_server.main.KISClient")
def test_get_kr_bars_structure(mock_cls):
    inst = MagicMock()
    inst.get_daily_price.return_value = [_make_kis_row()]
    mock_cls.return_value = inst
    with patch.dict("os.environ", {"KIS_APP_KEY": "key", "KIS_APP_SECRET": "secret"}):
        r = client.get("/kr/bars?code=005930&days=365")
    assert r.status_code == 200
    data = r.json()
    assert data["code"] == "005930"
    assert len(data["bars"]) == 1
    bar = data["bars"][0]
    assert bar["date"] == "20250102"
    assert bar["open"] == 70000
    assert bar["close"] == 70500
    assert bar["volume"] == 5000000


def test_get_kr_bars_no_credentials_returns_503():
    with patch.dict("os.environ", {"KIS_APP_KEY": "", "KIS_APP_SECRET": ""}):
        r = client.get("/kr/bars?code=005930")
    assert r.status_code == 503
```

- [ ] **Step 2: Run — expect 4 failures**

```bash
pytest tests/test_api_server.py::test_search_kr_returns_results tests/test_api_server.py::test_search_kr_missing_q_returns_422 tests/test_api_server.py::test_get_kr_bars_structure tests/test_api_server.py::test_get_kr_bars_no_credentials_returns_503 -v
```
Expected: 4 FAILED (endpoints don't exist yet)

- [ ] **Step 3: Add `import os` to top of `api_server/main.py`**

Find the first line of imports at the top of `api_server/main.py`:
```python
import datetime as dt
import json
import random
import uuid
```

Change to:
```python
import datetime as dt
import json
import os
import random
import uuid
```

- [ ] **Step 4: Add KR search + OHLCV endpoints to `api_server/main.py`**

Append at the end of `api_server/main.py`:

```python
# ── KR Universe Search ──────────────────────────────────────────────────────────

from kr_universe.client import search_universe, get_universe as _get_kr_universe
from backends.kis.client import KISClient


class KRSearchResult(BaseModel):
    code: str
    name: str
    market: str


class KRSearchResponse(BaseModel):
    query: str
    results: list[KRSearchResult]
    count: int


@app.get("/search/kr", response_model=KRSearchResponse)
def search_kr(q: str = Query(..., min_length=1)):
    try:
        results = search_universe(q.strip())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return KRSearchResponse(
        query=q,
        results=[KRSearchResult(**r) for r in results],
        count=len(results),
    )


# ── KR On-demand OHLCV ──────────────────────────────────────────────────────────


class KRBar(BaseModel):
    date: str
    open: int
    high: int
    low: int
    close: int
    volume: int


class KRBarsResponse(BaseModel):
    code: str
    name: str
    bars: list[KRBar]
    count: int


@app.get("/kr/bars", response_model=KRBarsResponse)
def get_kr_bars(
    code: str = Query(..., min_length=1, max_length=6),
    days: int = Query(default=365, ge=1, le=3650),
):
    code = code.strip().zfill(6)
    app_key = os.environ.get("KIS_APP_KEY", "")
    app_secret = os.environ.get("KIS_APP_SECRET", "")
    if not app_key or not app_secret:
        raise HTTPException(status_code=503, detail="KIS credentials not configured")

    end_date = dt.date.today().strftime("%Y%m%d")
    start_date = (dt.date.today() - dt.timedelta(days=days)).strftime("%Y%m%d")

    try:
        kis_client = KISClient(app_key=app_key, app_secret=app_secret)
        rows = kis_client.get_daily_price(code, start_date, end_date)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not rows:
        raise HTTPException(status_code=404, detail=f"no bars found for code={code!r}")

    name = code
    try:
        universe = _get_kr_universe()
        match = next((item for item in universe if item["code"] == code), None)
        if match:
            name = match["name"]
    except Exception:
        pass

    bars = [
        KRBar(
            date=row["stck_bsop_date"],
            open=int(row["stck_oprc"]),
            high=int(row["stck_hgpr"]),
            low=int(row["stck_lwpr"]),
            close=int(row["stck_clpr"]),
            volume=int(row["acml_vol"]),
        )
        for row in rows
    ]
    return KRBarsResponse(code=code, name=name, bars=bars, count=len(bars))
```

- [ ] **Step 5: Run tests — expect 4 new tests PASS + all prior tests still PASS**

```bash
pytest tests/test_kr_universe.py tests/test_api_server.py -v 2>&1 | tail -15
```
Expected: all pass except the pre-existing `test_backtest_happy_path_returns_all_metric_keys` failure (known, unrelated).

- [ ] **Step 6: Commit**

```bash
git add api_server/main.py tests/test_api_server.py
git commit -m "feat(api): add /search/kr and /kr/bars endpoints"
```

---

### Task 3: US Symbol Search Endpoint

**Files:**
- Modify: `api_server/main.py` — add `USSearchResult`, `USSearchResponse` models; add `GET /search/us` endpoint
- Modify: `tests/test_api_server.py` — append 2 new tests

**Interfaces:**
- Consumes: `IB` from `ib_async`, `random` (already imported at top of main.py)
- Produces: `GET /search/us?q=Apple` → `USSearchResponse`

**Note:** This endpoint creates a raw `IB()` instance directly (not via `IBClient`) because `reqMatchingSymbolsAsync` is called on `IB` directly.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_api_server.py`:

```python
# ── /search/us ─────────────────────────────────────────────────────────────────

@patch("api_server.main.IB")
def test_search_us_structure(mock_ib_cls):
    mock_ib = MagicMock()
    mock_ib.connectAsync = AsyncMock()
    mock_ib.isConnected.return_value = False

    desc = MagicMock()
    desc.contract.symbol = "AAPL"
    desc.contract.description = "Apple Inc"
    desc.contract.secType = "STK"
    desc.contract.primaryExch = "NASDAQ"
    desc.contract.exchange = "SMART"
    desc.contract.currency = "USD"
    mock_ib.reqMatchingSymbolsAsync = AsyncMock(return_value=[desc])
    mock_ib_cls.return_value = mock_ib

    r = client.get("/search/us?q=Apple")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    assert data["results"][0]["symbol"] == "AAPL"
    assert data["results"][0]["name"] == "Apple Inc"
    assert data["results"][0]["sec_type"] == "STK"


def test_search_us_missing_q_returns_422():
    r = client.get("/search/us")
    assert r.status_code == 422
```

- [ ] **Step 2: Run — expect 2 failures**

```bash
pytest tests/test_api_server.py::test_search_us_structure tests/test_api_server.py::test_search_us_missing_q_returns_422 -v
```
Expected: 2 FAILED

- [ ] **Step 3: Add US search endpoint to `api_server/main.py`**

Append at the end of `api_server/main.py`:

```python
# ── US Symbol Search ────────────────────────────────────────────────────────────

from ib_async import IB


class USSearchResult(BaseModel):
    symbol: str
    name: str
    sec_type: str
    exchange: str
    currency: str


class USSearchResponse(BaseModel):
    query: str
    results: list[USSearchResult]
    count: int


@app.get("/search/us", response_model=USSearchResponse)
async def search_us(q: str = Query(..., min_length=1)):
    q = q.strip()
    ib = IB()
    try:
        await ib.connectAsync("127.0.0.1", 7497, clientId=random.randint(1, 899))
        descs = await ib.reqMatchingSymbolsAsync(q)
        results = [
            USSearchResult(
                symbol=d.contract.symbol,
                name=d.contract.description or "",
                sec_type=d.contract.secType,
                exchange=d.contract.primaryExch or d.contract.exchange,
                currency=d.contract.currency,
            )
            for d in descs
        ]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if ib.isConnected():
            ib.disconnect()
    return USSearchResponse(query=q, results=results, count=len(results))
```

- [ ] **Step 4: Run tests — expect 2 new PASS + all prior PASS**

```bash
pytest tests/test_kr_universe.py tests/test_api_server.py -v 2>&1 | tail -15
```

- [ ] **Step 5: Commit**

```bash
git add api_server/main.py tests/test_api_server.py
git commit -m "feat(api): add /search/us endpoint via IB reqMatchingSymbols"
```

---

### Task 4: WebSocket Live Streaming Endpoint

**Files:**
- Modify: `api_server/main.py` — add `_parse_kis_tick()` helper and `WS /ws/live/{code}` endpoint
- Modify: `tests/test_api_server.py` — append 4 tests (3 unit tests for `_parse_kis_tick`, 1 WS credential test)

**Interfaces:**
- Consumes (existing): `KISWebSocketClient` from `backends.kis.ws_client`, `get_approval_key` from `backends.kis.ws_auth`
- Consumes: `WebSocket`, `WebSocketDisconnect` (already imported at main.py line 13)
- Produces: `WS /ws/live/{code}` — sends `{"code", "time", "price", "change", "change_rate", "trade_volume", "total_volume"}` JSON per tick
- Produces: `_parse_kis_tick(message: str) -> dict | None` — importable by tests as `from api_server.main import _parse_kis_tick`

**KIS tick format reference:**
```
"0|H0STCNT0|001|005930^161430^70100^400^5^-0.57^70156^70500^70600^69700^70100^70100^3520^20547350^..."
 ^  ^        ^   ^fields[0..N] separated by ^
 |  TR_ID   count  data block
ctrl
```
- JSON messages (start with `{`): return `None`
- Non-H0STCNT0 TR_ID: return `None`
- Field indices (0-based after splitting data by `^`): [0]=code, [1]=time, [2]=price, [3]=change_abs, [4]=change_sign, [5]=change_rate, [12]=trade_volume, [13]=total_volume
- change_sign: `"2"` or `"1"` → positive; `"4"` or `"5"` → negative; `"3"` → zero

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_api_server.py`:

```python
# ── _parse_kis_tick ─────────────────────────────────────────────────────────────

from api_server.main import _parse_kis_tick

_SAMPLE_TICK = (
    "0|H0STCNT0|001|"
    "005930^161430^70100^400^5^-0.57^70156^70500^70600^69700^70100^70100^3520^20547350"
)


def test_parse_kis_tick_parses_data():
    result = _parse_kis_tick(_SAMPLE_TICK)
    assert result is not None
    assert result["code"] == "005930"
    assert result["time"] == "161430"
    assert result["price"] == 70100
    assert result["change"] == -400      # sign=5 (down) → negative
    assert result["trade_volume"] == 3520
    assert result["total_volume"] == 20547350


def test_parse_kis_tick_skips_json():
    assert _parse_kis_tick('{"header": {"tr_id": "PINGPONG"}, "body": {}}') is None


def test_parse_kis_tick_skips_wrong_tr_id():
    assert _parse_kis_tick("0|OTHER_TR|001|data^more") is None


# ── WS /ws/live/{code} — credential guard ─────────────────────────────────────

def test_ws_live_no_credentials_sends_error():
    with patch.dict("os.environ", {"KIS_APP_KEY": "", "KIS_APP_SECRET": ""}):
        with client.websocket_connect("/ws/live/005930") as ws:
            data = ws.receive_json()
    assert data.get("error") == "KIS credentials not configured"
```

- [ ] **Step 2: Run — expect ImportError or 4 failures**

```bash
pytest tests/test_api_server.py::test_parse_kis_tick_parses_data tests/test_api_server.py::test_parse_kis_tick_skips_json tests/test_api_server.py::test_parse_kis_tick_skips_wrong_tr_id tests/test_api_server.py::test_ws_live_no_credentials_sends_error -v
```
Expected: `ImportError: cannot import name '_parse_kis_tick'` or 4 FAILED

- [ ] **Step 3: Add `_parse_kis_tick` and WS endpoint to `api_server/main.py`**

Append at the end of `api_server/main.py`:

```python
# ── KIS Live Streaming ──────────────────────────────────────────────────────────

from backends.kis.ws_client import KISWebSocketClient
from backends.kis.ws_auth import get_approval_key


def _parse_kis_tick(message: str) -> dict | None:
    """Parse KIS H0STCNT0 real-time trade message into a JSON-serialisable dict.

    Returns None for JSON ack/ping messages and non-trade TR IDs.

    KIS sends two message types over the WebSocket:
    - JSON objects (start with '{'): subscription acks and heartbeats — skip.
    - Pipe-delimited strings: "{ctrl}|{tr_id}|{count}|{data_block}"
      where data_block fields are '^'-separated.

    H0STCNT0 data field indices (0-based):
      0=code, 1=time(HHMMSS), 2=price, 3=change_abs, 4=change_sign,
      5=change_rate_pct, 12=trade_volume, 13=total_volume
    change_sign: '1'/'2'=up (+), '4'/'5'=down (-), '3'=flat (0)
    """
    if message.startswith("{"):
        return None

    parts = message.split("|")
    if len(parts) < 4:
        return None

    tr_id = parts[1]
    if tr_id != "H0STCNT0":
        return None

    fields = parts[3].split("^")
    if len(fields) < 14:
        return None

    try:
        change_sign = fields[4]
        sign = 1 if change_sign in ("1", "2") else (-1 if change_sign in ("4", "5") else 0)
        return {
            "code": fields[0],
            "time": fields[1],
            "price": int(fields[2]),
            "change": int(fields[3]) * sign,
            "change_rate": float(fields[5]),
            "trade_volume": int(fields[12]),
            "total_volume": int(fields[13]),
        }
    except (ValueError, IndexError):
        return None


@app.websocket("/ws/live/{code}")
async def ws_live(websocket: WebSocket, code: str) -> None:
    await websocket.accept()

    app_key = os.environ.get("KIS_APP_KEY", "")
    app_secret = os.environ.get("KIS_APP_SECRET", "")
    if not app_key or not app_secret:
        await websocket.send_json({"error": "KIS credentials not configured"})
        await websocket.close()
        return

    code = code.strip().upper()
    try:
        approval_key = get_approval_key(app_key, app_secret)
        kis_ws_client = KISWebSocketClient(approval_key)
        async for message in kis_ws_client.stream_trades(code):
            parsed = _parse_kis_tick(message)
            if parsed:
                await websocket.send_json(parsed)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"error": str(exc)})
            await websocket.close()
        except Exception:
            pass
```

- [ ] **Step 4: Run tests — expect 4 new PASS + all prior PASS**

```bash
pytest tests/test_kr_universe.py tests/test_api_server.py -v 2>&1 | tail -20
```
Expected: all pass except the pre-existing `test_backtest_happy_path_returns_all_metric_keys` failure.

- [ ] **Step 5: Commit**

```bash
git add api_server/main.py tests/test_api_server.py
git commit -m "feat(api): add /ws/live/{code} KIS WebSocket relay and _parse_kis_tick"
```

---

### Task 5: Frontend Search Page

**Files:**
- Modify: `lib/api.ts` — append KR/US search + KR bars types and functions
- Create: `app/search/page.tsx`
- Modify: `components/NavBar.tsx` — add Search link
- Modify: `docs/roadmap.md` — update HEAD
- Modify: `docs/progress.md` — prepend Phase 18 entry

**Interfaces:**
- Consumes (Task 2): `GET /search/kr`, `GET /kr/bars`
- Consumes (Task 3): `GET /search/us`
- Consumes (existing): `getIBBars` from `lib/api.ts` for US OHLCV
- Consumes: `WS /ws/live/{code}` via browser `WebSocket`

**KR date → UTCTimestamp conversion:**
```typescript
// "20250102" → epoch seconds
const ts = Math.floor(
  new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`).getTime() / 1000
) as UTCTimestamp;
```

**WS base URL:**
```typescript
const WS_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000")
  .replace(/^http/, "ws");
// → "ws://localhost:8000"
```

**NavBar:** The NavBar uses a `NAV_GROUPS` array in `components/NavBar.tsx`. Add `{ href: "/search", label: "Search" }` to the group that contains Market, Bots, or Data (whichever is most appropriate — check the existing groups and add to "Data" or as its own entry in the "Market" group).

- [ ] **Step 1: Append to `lib/api.ts`**

```typescript
// ── KR Universe Search ──────────────────────────────────────────────────────────

export interface KRSearchResult {
  code: string;
  name: string;
  market: string;
}

export interface KRSearchResponse {
  query: string;
  results: KRSearchResult[];
  count: number;
}

export interface USSearchResult {
  symbol: string;
  name: string;
  sec_type: string;
  exchange: string;
  currency: string;
}

export interface USSearchResponse {
  query: string;
  results: USSearchResult[];
  count: number;
}

export interface KRBar {
  date: string; // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KRBarsResponse {
  code: string;
  name: string;
  bars: KRBar[];
  count: number;
}

export interface KISTick {
  code: string;
  time: string; // HHMMSS
  price: number;
  change: number;
  change_rate: number;
  trade_volume: number;
  total_volume: number;
}

export async function searchKR(
  q: string,
  signal?: AbortSignal,
): Promise<KRSearchResponse> {
  const r = await fetch(
    `${API_BASE}/search/kr?q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function searchUS(
  q: string,
  signal?: AbortSignal,
): Promise<USSearchResponse> {
  const r = await fetch(
    `${API_BASE}/search/us?q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getKRBars(
  code: string,
  days: number,
  signal?: AbortSignal,
): Promise<KRBarsResponse> {
  const r = await fetch(
    `${API_BASE}/kr/bars?code=${encodeURIComponent(code)}&days=${days}`,
    { signal },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

- [ ] **Step 2: Check NavBar structure**

Read `components/NavBar.tsx` and find the `NAV_GROUPS` array. Locate the group labeled "Data" or "Market". Add `{ href: "/search", label: "Search" }` as the first item in whichever group contains IB Data or Crypto (the live data pages).

The entry format matches the existing pattern in `NAV_GROUPS` — each group has a `label` and `items: Array<{ href, label }>`.

- [ ] **Step 3: Create `app/search/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, UTCTimestamp } from "lightweight-charts";
import {
  searchKR, searchUS, getKRBars, getIBBars,
  KRSearchResult, USSearchResult, KRBar, KISTick,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const DURATIONS = [30, 90, 180, 365, 730] as const;
type Duration = (typeof DURATIONS)[number];

type Market = "KR" | "US";
type AnyResult = { label: string; sub: string; code: string };

function toAnyResult(r: KRSearchResult): AnyResult {
  return { label: r.name, sub: r.code + " · " + r.market, code: r.code };
}
function usAnyResult(r: USSearchResult): AnyResult {
  return { label: r.symbol, sub: (r.name || r.sec_type) + " · " + r.exchange, code: r.symbol };
}

function krDateToTs(date: string): UTCTimestamp {
  return Math.floor(
    new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`).getTime() / 1000,
  ) as UTCTimestamp;
}

type ChartBar = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

function CandleChart({ bars }: { bars: ChartBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      timeScale: { borderColor: "#374151" },
      rightPriceScale: { borderColor: "#374151" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    series.setData(bars);
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [bars]);

  return (
    <div ref={containerRef} style={{ height: "320px" }} className="w-full" />
  );
}

export default function SearchPage() {
  const [market, setMarket] = useState<Market>("KR");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnyResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [days, setDays] = useState<Duration>(365);
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState<KISTick | null>(null);
  const [wsStatus, setWsStatus] = useState<"off" | "connecting" | "live">("off");

  const searchAbortRef = useRef<AbortController | null>(null);
  const barsAbortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowResults(false); return; }
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      try {
        if (market === "KR") {
          const res = await searchKR(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(toAnyResult));
        } else {
          const res = await searchUS(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(usAnyResult));
        }
        setShowResults(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, market]);

  // Cleanup on unmount
  useEffect(() => () => {
    searchAbortRef.current?.abort();
    barsAbortRef.current?.abort();
    wsRef.current?.close();
  }, []);

  function connectWS(code: string) {
    wsRef.current?.close();
    setLiveTick(null);
    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_BASE}/ws/live/${code}`);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("off");
    ws.onerror = () => setWsStatus("off");
    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data) as KISTick;
        if (!tick.error) setLiveTick(tick);
      } catch { /* ignore */ }
    };
  }

  async function loadBars(code: string, name: string) {
    setSelected({ code, name });
    setShowResults(false);
    setError(null);
    setBars([]);

    barsAbortRef.current?.abort();
    const ctrl = new AbortController();
    barsAbortRef.current = ctrl;
    setLoadingBars(true);

    try {
      if (market === "KR") {
        const res = await getKRBars(code, days, ctrl.signal);
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map((b: KRBar) => ({
          time: krDateToTs(b.date),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
        connectWS(code);
      } else {
        const res = await getIBBars(
          { symbol: code, asset_type: "stock", duration: `${days} D` },
          ctrl.signal,
        );
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map(b => ({
          time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (barsAbortRef.current === ctrl) setError(e instanceof Error ? e.message : "Failed to load bars");
    } finally {
      if (barsAbortRef.current === ctrl) setLoadingBars(false);
    }
  }

  const changeCls = liveTick
    ? liveTick.change > 0 ? "text-pos" : liveTick.change < 0 ? "text-neg" : "text-text-3"
    : "text-text-3";

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Search</h1>
        <p className="text-text-3 text-sm mt-0.5">Search any KR/US listed instrument and load OHLCV chart.</p>
      </div>

      {/* Market toggle + search bar */}
      <div className="flex gap-2">
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(["KR", "US"] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => { setMarket(m); setQuery(""); setResults([]); setSelected(null); setBars([]); setLiveTick(null); wsRef.current?.close(); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${market === m ? "bg-accent/10 text-accent border-accent" : "text-text-2 hover:text-text-1"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder={market === "KR" ? "종목명 또는 코드 (예: 삼성전자, 005930)" : "Symbol or name (e.g. AAPL, Apple)"}
            className="w-full px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-panel border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.code}
                  onMouseDown={() => loadBars(r.code, r.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-panel-2 text-left"
                >
                  <span className="text-text-1 font-medium">{r.label}</span>
                  <span className="text-text-3 text-xs">{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value) as Duration)}
          className="px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 focus:outline-none focus:border-accent"
        >
          {DURATIONS.map(d => (
            <option key={d} value={d}>{d}D</option>
          ))}
        </select>
      </div>

      {/* Selected header + live ticker */}
      {selected && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-text-1 font-semibold">{selected.name}</span>
            <span className="text-text-3 text-sm ml-2">{selected.code}</span>
          </div>
          <div className="flex items-center gap-3">
            {liveTick && (
              <>
                <span className="text-text-1 font-data text-lg">{liveTick.price.toLocaleString()}</span>
                <span className={`text-sm font-data ${changeCls}`}>
                  {liveTick.change > 0 ? "+" : ""}{liveTick.change.toLocaleString()} ({liveTick.change_rate.toFixed(2)}%)
                </span>
                <span className="text-text-3 text-xs">Vol {liveTick.trade_volume.toLocaleString()}</span>
              </>
            )}
            {market === "KR" && (
              <span className={`text-xs px-2 py-0.5 rounded border ${wsStatus === "live" ? "border-pos/40 text-pos bg-pos/5" : wsStatus === "connecting" ? "border-warn/40 text-warn bg-warn/5" : "border-border text-text-3"}`}>
                {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "CONNECTING" : "OFFLINE"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loadingBars && (
          <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">Loading chart...</div>
        )}
        {error && !loadingBars && (
          <div className="flex items-center justify-center h-[320px] text-neg text-sm">{error}</div>
        )}
        {!loadingBars && !error && bars.length > 0 && (
          <CandleChart bars={bars} />
        )}
        {!loadingBars && !error && bars.length === 0 && !selected && (
          <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">
            Search a stock above to load the chart
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Search to NavBar**

Read `components/NavBar.tsx`. Find the `NAV_GROUPS` array. Locate the group containing the IB Data link (`{ href: "/ib", label: "IB Data" }`). Add `{ href: "/search", label: "Search" }` as the first item in that same group (before IB Data).

- [ ] **Step 5: Run frontend tests and type check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -6
npx tsc --noEmit 2>&1 | head -10
```
Expected: 127/127 PASS, tsc 0 errors.

- [ ] **Step 6: Update docs**

In `docs/roadmap.md`, update `**HEAD:**` to the latest commit hash.

In `docs/progress.md`, prepend a Phase 18 section above Phase 17:

```markdown
## Phase 18 — Universal Search + Real-time Streaming (2026-06-28) ✅ SHIPPED

### 완료된 작업
- KR universe cache (`kr_universe/client.py`) — KIND scrape, 24h TTL, name/code search
- `/search/kr?q=...` — KR 종목 검색 (최대 20개)
- `/kr/bars?code=...&days=...` — KIS on-demand OHLCV
- `/search/us?q=...` — IB reqMatchingSymbols
- `/ws/live/{code}` — KIS WS → FastAPI WS relay, `_parse_kis_tick`
- Frontend: `/search` 페이지 — KR/US 검색, 캔들차트, 실시간 틱 오버레이
- NavBar: Search 링크 추가

### 변경된 파일
**Backend:** `kr_universe/`, `api_server/main.py`, `tests/test_kr_universe.py`, `tests/test_api_server.py`, `pyproject.toml`
**Frontend:** `lib/api.ts`, `app/search/page.tsx`, `components/NavBar.tsx`, `docs/`

### 다음 할 일
- Phase 19: Strategy Spawner UI
```

- [ ] **Step 7: Commit frontend**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/search/page.tsx components/NavBar.tsx docs/roadmap.md docs/progress.md
git commit -m "feat(search): add universal KR/US search page with live streaming"
```

---

## Self-Review

**Spec coverage:**
- ✅ KR universe download from KIND, cached 24h — Task 1
- ✅ KR name/code search → `/search/kr` — Task 2
- ✅ KR on-demand OHLCV → `/kr/bars` — Task 2
- ✅ US symbol search → `/search/us` — Task 3
- ✅ KIS WS relay → `/ws/live/{code}` — Task 4
- ✅ Frontend search bar + market toggle — Task 5
- ✅ Candlestick chart from OHLCV — Task 5
- ✅ Live tick overlay (price, change, volume) — Task 5
- ✅ WS status badge (LIVE / CONNECTING / OFFLINE) — Task 5
- ✅ NavBar Search link — Task 5

**Placeholder scan:** None found — all steps have complete code.

**Type consistency:**
- `KRBar` defined in Task 2 backend, `KRBar` in Task 5 `lib/api.ts` — same shape ✅
- `KISTick` in Task 5 `lib/api.ts` matches `_parse_kis_tick` return in Task 4 ✅
- `getKRBars` in Task 5 api.ts calls `GET /kr/bars` defined in Task 2 ✅
- `searchKR` / `searchUS` in api.ts call endpoints from Tasks 2/3 ✅
- `getIBBars` called with `{ symbol, asset_type: "stock", duration: "365 D" }` — matches existing `IBBarsParams` in lib/api.ts (optional fields `exchange`, `expiry`, etc.) ✅

**Edge cases covered:**
- Empty search query returns empty results (no API call) ✅
- KIS credentials not configured → 503 on `/kr/bars`, error JSON on WS ✅
- IB not running → 400 on `/search/us` ✅
- WS disconnect from browser: `WebSocketDisconnect` caught ✅
- AbortController cleanup on unmount ✅
