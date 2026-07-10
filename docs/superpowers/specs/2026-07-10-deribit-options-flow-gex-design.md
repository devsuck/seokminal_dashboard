# Deribit 옵션플로우 + GEX 레벨 설계

**목표:** BTC/ETH 옵션 실시간 체결 플로우 + 스트라이크별 감마 익스포저(GEX)를 `/orderflow` 페이지에 추가한다. 델타/absorption(기존 footprint 데이터로 바로 가능)은 이 스펙 범위 밖 — 별도 소규모 작업.

**아키텍처:** Deribit public REST/WS(무료, 인증 불필요)를 신규 백엔드 어댑터로 수집. 옵션 체결은 WS 실시간 스트림(경량 fan-out 매니저), GEX는 REST 폴링(60초)으로 스트라이크별 미결제약정을 가져와 기존 `options/pricer.py:bs_greeks`로 감마를 계산해 집계·캐시한다. 프론트는 `/orderflow` 페이지에 BTC.HL/ETH.HL 심볼일 때만 노출되는 신규 패널을 추가한다.

**기술스택:** FastAPI WS(기존 패턴 재사용), Deribit `wss://www.deribit.com/ws/api/v2` + REST `https://www.deribit.com/api/v2`, D3(GEX 바 차트, 기존 risk-dashboard 패턴), 기존 `lib/api.ts`/AbortController 컨벤션.

## Global Constraints

- Raw `fetch` 금지 — `lib/api.ts` 함수 경유
- AbortController 패턴: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup
- 디자인 토큰만 사용(`bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`), `style={{}}` 금지(차트 height 예외)
- `asyncio_mode="auto"` — `@pytest.mark.asyncio` 데코레이터 금지
- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- CORS: API는 `localhost:3000`만 허용(기존 서버 설정 그대로, 신규 라우터도 동일 적용)
- BTC/ETH 외 통화는 다루지 않는다(Deribit이 지원하는 다른 통화 있어도 v1은 BTC/ETH만)

---

## 배경 조사 결과

- 기존 `orderflow/hl_adapter.py`: `HyperliquidOrderflowClient.stream(coin) -> AsyncIterator[OrderBookSnapshot | TradeEvent]` 어댑터 패턴.
- 기존 `orderflow/manager.py`: `OrderflowManager`가 심볼별 수집 태스크 감독, 재연결 백오프(`RECONNECT_BASE_DELAY=2.0`, `RECONNECT_MAX_DELAY=60.0`), 구독자 큐 브로드캐스트(`SUBSCRIBER_QUEUE_MAXSIZE=1000`). 이건 footprint/heatmap 집계(`aggregator.py`)를 전제로 설계되어 있어 옵션 체결(스트라이크/만기/IV 필드 보유)엔 구조가 안 맞음 → 재사용 대신 **경량 버전을 별도로 둔다** (아래 `OptionsFlowManager`).
- 기존 `options/pricer.py:bs_greeks(S, K, T, r, sigma, option_type) -> dict`가 gamma를 포함한 그릭스를 이미 계산함 — GEX 계산에 그대로 재사용, 신규 BS 구현 불필요.
- 기존 `lib/api.ts`에 `getOptionsGreeks/getOptionsChain/getOptionsIvSurface`가 있지만 이건 사용자가 spot/strike/vol을 입력하는 이론가 계산기(우리가 이미 있는 것)이지 실제 마켓 데이터가 아님 — 이번 스펙과 무관, 건드리지 않는다.
- `/orderflow` 페이지(`app/orderflow/page.tsx`)는 현재 탭 시스템이 없음 — 신규 패널 UI를 새로 만든다(크립토 페이지의 탭 패턴과는 다른 화면이라 그대로 재사용 안 함).

---

## 백엔드

### 1. `orderflow/deribit_adapter.py` (신규)

```python
"""Deribit 옵션 체결 실시간 스트림 어댑터."""
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass

import websockets

DERIBIT_WS_URL = "wss://www.deribit.com/ws/api/v2"


@dataclass
class OptionTradeEvent:
    instrument_name: str  # 예: "BTC-27DEC26-100000-C"
    direction: str  # "buy" | "sell"
    price: float  # 옵션 프리미엄(기초자산 단위, 예: 0.0512 BTC)
    amount: float  # 계약 수량
    iv: float  # 체결 시점 implied vol (%)
    index_price: float  # 체결 시점 기초자산 지수가
    timestamp: float  # epoch seconds


class DeribitOptionsFlowClient:
    """currency(BTC/ETH)의 옵션 체결을 실시간으로 스트리밍한다."""

    def __init__(self, currency: str):
        self.currency = currency.upper()

    async def stream(self) -> AsyncIterator[OptionTradeEvent]:
        channel = f"trades.option.{self.currency}.100ms"
        async with websockets.connect(DERIBIT_WS_URL) as ws:
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "method": "public/subscribe",
                "params": {"channels": [channel]},
            }))
            async for raw in ws:
                msg = json.loads(raw)
                params = msg.get("params")
                if not params or params.get("channel") != channel:
                    continue
                for t in params["data"]:
                    yield OptionTradeEvent(
                        instrument_name=t["instrument_name"],
                        direction=t["direction"],
                        price=float(t["price"]),
                        amount=float(t["amount"]),
                        iv=float(t.get("iv", 0.0)),
                        index_price=float(t.get("index_price", 0.0)),
                        timestamp=float(t["timestamp"]) / 1000.0,
                    )
```

- 연결 끊기면 `async with` 블록이 예외로 빠져나가며 제너레이터 종료 — 재연결은 아래 `OptionsFlowManager`가 담당(hl_adapter와 동일 책임 분리).

### 2. `orderflow/options_flow_manager.py` (신규)

`OrderflowManager`(`orderflow/manager.py`)의 재연결 백오프 + 구독자 큐 브로드캐스트 로직을 그대로 가져오되, footprint/heatmap 집계(`aggregator.py`) 의존성 없이 `OptionTradeEvent`를 그대로 구독자에게 전달하는 경량 버전.

```python
"""Deribit 옵션 체결 스트림 매니저 — OrderflowManager의 재연결/브로드캐스트 로직을
옵션 체결(집계 없음, 원본 그대로 전달)용으로 경량화한 버전."""
import asyncio
import logging

from orderflow.deribit_adapter import DeribitOptionsFlowClient, OptionTradeEvent

logger = logging.getLogger(__name__)

RECONNECT_BASE_DELAY = 2.0
RECONNECT_MAX_DELAY = 60.0
SUBSCRIBER_QUEUE_MAXSIZE = 1000


class OptionsFlowManager:
    def __init__(self):
        self._subscribers: dict[str, set[asyncio.Queue]] = {}
        self._tasks: dict[str, asyncio.Task] = {}

    def subscribe(self, currency: str) -> asyncio.Queue:
        currency = currency.upper()
        q: asyncio.Queue = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_MAXSIZE)
        self._subscribers.setdefault(currency, set()).add(q)
        if currency not in self._tasks or self._tasks[currency].done():
            self._tasks[currency] = asyncio.create_task(self._run(currency))
        return q

    def unsubscribe(self, currency: str, q: asyncio.Queue) -> None:
        currency = currency.upper()
        subs = self._subscribers.get(currency)
        if not subs:
            return
        subs.discard(q)
        if not subs:
            self._tasks.pop(currency, None)  # 태스크는 다음 루프 turn에 스스로 종료

    async def _run(self, currency: str) -> None:
        delay = RECONNECT_BASE_DELAY
        client = DeribitOptionsFlowClient(currency)
        while self._subscribers.get(currency):
            try:
                async for event in client.stream():
                    delay = RECONNECT_BASE_DELAY
                    self._broadcast(currency, event)
                    if not self._subscribers.get(currency):
                        return
            except Exception:
                logger.warning("Deribit options-flow %s 연결 끊김, %.1fs 후 재연결", currency, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, RECONNECT_MAX_DELAY)

    def _broadcast(self, currency: str, event: OptionTradeEvent) -> None:
        for q in list(self._subscribers.get(currency, ())):
            if q.full():
                continue  # 느린 구독자는 드롭(footprint/heatmap과 동일 정책)
            q.put_nowait(event)


default_manager = OptionsFlowManager()
```

### 3. `orderflow/gex.py` (신규)

REST 폴링으로 스트라이크별 GEX를 계산·캐시.

```python
"""Deribit 옵션 체결 기반 GEX(감마 익스포저) 계산 — 60초 폴링 캐시."""
import math
import time

import httpx

from options.pricer import bs_greeks

DERIBIT_REST_URL = "https://www.deribit.com/api/v2"
GEX_POLL_INTERVAL_SEC = 60.0
CONTRACT_SIZE = 1.0  # Deribit BTC/ETH 옵션은 1계약 = 1 코인


async def fetch_gex_by_strike(currency: str) -> dict:
    """currency(BTC/ETH)의 만기 통합 스트라이크별 GEX를 계산한다.

    반환: {"currency": str, "spot": float, "updated_at": float,
           "levels": [{"strike": float, "call_gex": float, "put_gex": float, "net_gex": float}, ...]}
    """
    currency = currency.upper()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{DERIBIT_REST_URL}/public/get_book_summary_by_currency",
            params={"currency": currency, "kind": "option"},
        )
        resp.raise_for_status()
        instruments = resp.json()["result"]

    if not instruments:
        return {"currency": currency, "spot": 0.0, "updated_at": time.time(), "levels": []}

    spot = instruments[0]["underlying_price"]
    now = time.time()
    by_strike: dict[float, dict] = {}

    for inst in instruments:
        name_parts = inst["instrument_name"].split("-")  # BTC-27DEC26-100000-C
        if len(name_parts) != 4:
            continue
        strike = float(name_parts[2])
        option_type = "call" if name_parts[3] == "C" else "put"
        expiry_ts = _parse_deribit_expiry(name_parts[1])
        T = max((expiry_ts - now) / (365.0 * 86400.0), 1e-6)
        iv = (inst.get("mark_iv") or 0.0) / 100.0
        oi = inst.get("open_interest") or 0.0
        if iv <= 0 or oi <= 0:
            continue

        gamma = bs_greeks(spot, strike, T, 0.0, iv, option_type)["gamma"]
        # 표준 GEX 컨벤션: 콜은 딜러 숏 가정(양수), 풋은 딜러 롱 가정(음수 반영해 표시만 분리)
        gex = gamma * oi * CONTRACT_SIZE * (spot ** 2) * 0.01

        level = by_strike.setdefault(strike, {"strike": strike, "call_gex": 0.0, "put_gex": 0.0})
        if option_type == "call":
            level["call_gex"] += gex
        else:
            level["put_gex"] += gex

    levels = sorted(by_strike.values(), key=lambda lv: lv["strike"])
    for lv in levels:
        lv["net_gex"] = lv["call_gex"] - lv["put_gex"]

    return {"currency": currency, "spot": spot, "updated_at": now, "levels": levels}


def _parse_deribit_expiry(date_str: str) -> float:
    """Deribit 만기 표기(예: '27DEC26')를 UTC epoch seconds(만기일 08:00 UTC)로 변환."""
    import datetime as dt
    d = dt.datetime.strptime(date_str, "%d%b%y").replace(
        hour=8, minute=0, second=0, tzinfo=dt.timezone.utc
    )
    return d.timestamp()
```

**캐시:** 매 60초 백그라운드 태스크가 `fetch_gex_by_strike`를 BTC/ETH 각각 호출해 모듈 전역 `_cache: dict[str, dict]`에 저장. 라우터는 캐시만 읽는다(요청마다 Deribit REST 왕복 안 함).

```python
_cache: dict[str, dict] = {}

async def gex_poll_loop() -> None:
    while True:
        for currency in ("BTC", "ETH"):
            try:
                _cache[currency] = await fetch_gex_by_strike(currency)
            except Exception:
                logger.warning("GEX 폴링 실패: %s", currency)
        await asyncio.sleep(GEX_POLL_INTERVAL_SEC)

def get_cached_gex(currency: str) -> dict | None:
    return _cache.get(currency.upper())
```

`api_server/main.py`의 기존 startup 이벤트(다른 백그라운드 태스크가 이미 등록돼 있을 것)에 `asyncio.create_task(gex_poll_loop())` 추가.

### 4. `api_server/router_options_flow.py` (신규)

`router_orderflow.py` 패턴 그대로.

```python
"""Deribit 옵션플로우 + GEX API."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from orderflow.gex import get_cached_gex
from orderflow.options_flow_manager import default_manager

router = APIRouter()

SUPPORTED_CURRENCIES = {"BTC", "ETH"}


@router.get("/options-flow/gex/{currency}")
async def get_gex(currency: str):
    currency = currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        return {"currency": currency, "spot": 0.0, "updated_at": 0.0, "levels": []}
    cached = get_cached_gex(currency)
    return cached or {"currency": currency, "spot": 0.0, "updated_at": 0.0, "levels": []}


@router.websocket("/ws/options-flow/{currency}")
async def ws_options_flow(websocket: WebSocket, currency: str):
    currency = currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    q = default_manager.subscribe(currency)
    try:
        while True:
            event = await q.get()
            await websocket.send_json({
                "instrument_name": event.instrument_name,
                "direction": event.direction,
                "price": event.price,
                "amount": event.amount,
                "iv": event.iv,
                "index_price": event.index_price,
                "timestamp": event.timestamp,
            })
    except WebSocketDisconnect:
        pass
    finally:
        default_manager.unsubscribe(currency, q)
```

`api_server/main.py`에 `app.include_router(router_options_flow.router)` 추가(기존 라우터 등록부에 한 줄).

---

## 프론트엔드

### 5. `lib/api.ts` (수정 — 함수 추가)

```ts
export interface GexLevel {
  strike: number;
  call_gex: number;
  put_gex: number;
  net_gex: number;
}

export interface GexSnapshot {
  currency: string;
  spot: number;
  updated_at: number;
  levels: GexLevel[];
}

export async function getOptionsGex(currency: string, signal: AbortSignal): Promise<GexSnapshot> {
  return apiGet(`/options-flow/gex/${currency}`, signal); // 기존 apiGet 헬퍼 재사용
}
```

(기존 파일의 fetch 래퍼 헬퍼 이름은 실제 파일 확인 후 그대로 맞춘다 — 이미 `getOrderflowSymbols` 등이 쓰는 패턴 따름.)

### 6. `hooks/useOptionsFlowSocket.ts` (신규)

`hooks/useOrderflowSocket.ts`와 동일한 재연결/상태 관리 패턴으로 `/ws/options-flow/{currency}` 구독, 최근 N건(예: 100건) 옵션 체결을 배열로 유지.

### 7. `components/orderflow/OptionsFlowPanel.tsx` (신규)

- GEX 바 차트(D3, 기존 risk-dashboard drawdown 차트 패턴 재사용): x축 스트라이크, y축 `net_gex`, 현재 spot 위치에 세로 기준선.
- 옵션 체결 티커: 최근 체결 리스트(스크롤), 콜/풋+매수/매도 색 구분(`text-pos`/`text-neg`), instrument_name/IV/가격 표시.
- `getOptionsGex` 폴링(30~60초 간격, AbortController 패턴 준수) + `useOptionsFlowSocket`로 실시간 체결.

### 8. `app/orderflow/page.tsx` (수정)

심볼이 `BTC.HL` 또는 `ETH.HL`일 때만 `OptionsFlowPanel` 렌더(코인 심볼에서 `BTC`/`ETH` 접두어 추출). 차트 아래 또는 우측에 배치(레이아웃은 구현 시 화면 확인하며 결정 — 디자인 토큰만 사용).

---

## 에러 처리

- Deribit REST/WS 접근 실패(네트워크, 레이트리밋) → GEX는 마지막 캐시값 유지 + `updated_at` 기준 stale 배지(예: 5분 이상 오래되면 "데이터 지연" 표시), 옵션플로우 WS는 기존 `OrderflowManager`와 동일한 지수 백오프로 재연결.
- BTC/ETH 외 심볼 → 패널 자체 미노출(백엔드도 400 대신 빈 스냅샷 반환해 프론트 에러 UI 불필요하게 만들지 않음).
- Deribit instrument_name 파싱 실패(예상 밖 포맷) → 해당 종목 skip, 전체 요청 실패시키지 않음.

## 테스트

- `tests/test_gex.py`: 알려진 OI/gamma/spot 값으로 `fetch_gex_by_strike`의 스트라이크별 집계가 올바른지(httpx 응답 mock), `_parse_deribit_expiry` 포맷 파싱.
- `tests/test_deribit_adapter.py`: WS 메시지 mock → `OptionTradeEvent` 파싱 정확성(hl_adapter 테스트 패턴 참고).
- `tests/lib/orderflow-gex.test.ts` (프론트, 있다면 GEX 차트 데이터 변환 순수함수 분리해 테스트): strike 정렬, net_gex 부호.
- `lib/api.ts` 신규 함수는 기존 API 함수 테스트 패턴(있다면) 따름 — 없으면 타입 체크(`tsc --noEmit`)로 충분(YAGNI, 얇은 fetch 래퍼).

## 범위 밖(후속 작업)

- 델타/absorption 지표(기존 footprint 데이터로 바로 가능, 별도 소규모 작업)
- 만기별 GEX 분해(v1은 전체 만기 통합만)
- zero-gamma flip 레벨 자동 계산/알림
- BTC/ETH 외 통화
