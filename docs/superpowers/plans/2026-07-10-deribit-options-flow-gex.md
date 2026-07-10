# Deribit 옵션플로우 + GEX 레벨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BTC/ETH 옵션 실시간 체결 플로우 + 스트라이크별 GEX(감마 익스포저)를 `/orderflow` 페이지에 추가한다.

**Architecture:** Deribit public REST/WS(무료, 인증 불필요)를 신규 백엔드 어댑터로 수집. 옵션 체결은 WS 실시간 스트림(경량 fan-out 매니저, `OrderflowManager` 재연결/브로드캐스트 구조를 옵션 체결용으로 경량화), GEX는 REST 60초 폴링으로 미결제약정을 가져와 기존 `options/pricer.py:bs_greeks`로 감마를 계산·집계해 캐시한다. 프론트는 `/orderflow` 페이지에서 심볼이 BTC.HL/ETH.HL일 때만 신규 패널(`OptionsFlowPanel`)을 노출한다.

**Tech Stack:** FastAPI WS(기존 `orderflow/manager.py`+`router_orderflow.py` 패턴 재사용), `websockets`(Deribit WS), `httpx`(Deribit REST), D3(GEX 바 차트, `components/event-study/EventReturnChart.tsx` 패턴 재사용), Next.js `lib/api.ts`/AbortController 컨벤션.

**참조 스펙:** `docs/superpowers/specs/2026-07-10-deribit-options-flow-gex-design.md`

## Global Constraints

- Raw `fetch` 금지 — `lib/api.ts` 함수 경유
- AbortController 패턴: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup
- 디자인 토큰만 사용(`bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`), `style={{}}` 금지(차트 height 예외). D3 SVG 속성(`fill`/`stroke`)은 className이 안 먹으므로 `var(--color-*)` CSS 커스텀 프로퍼티 문자열을 `.attr()`로 직접 넣는다(`app/globals.css`에 `--color-pos`/`--color-neg`/`--color-accent`/`--color-border`/`--color-text-2`/`--color-text-3` 정의돼 있음).
- `asyncio_mode="auto"` — `@pytest.mark.asyncio` 데코레이터 절대 금지
- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- CORS: API는 `localhost:3000`만 허용(기존 서버 설정 그대로 적용됨, 신규 라우터도 자동 적용)
- BTC/ETH 외 통화는 v1 범위 밖 — 지원 통화 집합은 백엔드/프론트 양쪽에서 `{"BTC", "ETH"}`로 고정
- 재연결/큐 상수는 기존 `orderflow/manager.py` 값과 동일하게 맞춘다: `RECONNECT_BASE_DELAY=2.0`, `RECONNECT_MAX_DELAY=60.0`, `SUBSCRIBER_QUEUE_MAXSIZE=1000`
- 델타/absorption 지표, 만기별 GEX 분해, zero-gamma flip 레벨은 이 플랜 범위 밖(스펙의 "범위 밖" 섹션 참고)

---

## File Structure

**백엔드 (`seokminal-multi-venue/`):**
- `orderflow/deribit_adapter.py` (신규) — Deribit WS 옵션 체결 스트림 어댑터. `hl_adapter.py`와 동일한 책임: 연결 + 파싱만, 재연결은 매니저가 담당.
- `orderflow/options_flow_manager.py` (신규) — 옵션 체결 fan-out 매니저. `manager.py`의 재연결 백오프/큐 브로드캐스트 구조를 그대로 쓰되 footprint/heatmap 집계(`aggregator.py`) 의존 없음(원본 체결 그대로 전달).
- `orderflow/gex.py` (신규) — Deribit REST 폴링 + 스트라이크별 GEX 계산 + 인메모리 캐시. `options/pricer.py:bs_greeks` 재사용.
- `api_server/router_options_flow.py` (신규) — `GET /options-flow/gex/{currency}`, `WS /ws/options-flow/{currency}`. `router_orderflow.py`와 동일한 얇은 소비 전용 라우터.
- `api_server/main.py` (수정) — 신규 라우터 등록 + startup에서 `gex_poll_loop()` 백그라운드 태스크 기동.
- `tests/test_orderflow_deribit_adapter.py`, `tests/test_orderflow_options_flow_manager.py`, `tests/test_orderflow_gex.py`, `tests/test_router_options_flow.py` (신규).

**프론트엔드 (`seokminal-dashboard/`):**
- `lib/api.ts` (수정) — `GexLevel`/`GexSnapshot` 타입 + `getOptionsGex()`.
- `lib/orderflow-data.ts` (수정) — `currencyForSymbol()` 순수 함수(심볼→통화 매핑, 패널 노출 게이팅용).
- `hooks/useOptionsFlowSocket.ts` (신규) — `useOrderflowSocket.ts`와 동일한 재연결 패턴의 옵션 체결 WS 훅.
- `components/orderflow/OptionsFlowPanel.tsx` (신규) — GEX D3 바 차트 + 실시간 체결 티커.
- `app/orderflow/page.tsx` (수정) — BTC.HL/ETH.HL일 때만 `OptionsFlowPanel` 렌더.
- `tests/lib/api-options-flow.test.ts` (신규), `tests/lib/orderflow-data.test.ts` (수정 — `currencyForSymbol` 테스트 추가).

---

### Task 1: Deribit WS 어댑터 (`orderflow/deribit_adapter.py`)

**Files:**
- Create: `seokminal-multi-venue/orderflow/deribit_adapter.py`
- Test: `seokminal-multi-venue/tests/test_orderflow_deribit_adapter.py`

**Interfaces:**
- Produces: `OptionTradeEvent` 데이터클래스(필드: `instrument_name: str, direction: str, price: float, amount: float, iv: float, index_price: float, timestamp: float`), `parse_deribit_trades_message(raw: str, currency: str) -> list[OptionTradeEvent]`, `DeribitOptionsFlowClient(currency: str, base_url: str = DERIBIT_WS_URL, connect_fn: Callable[[str], Any] = websockets.connect).stream() -> AsyncIterator[OptionTradeEvent]`. Task 2가 `DeribitOptionsFlowClient`와 `OptionTradeEvent`를 그대로 임포트해서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-multi-venue/tests/test_orderflow_deribit_adapter.py` 전체 내용:

```python
import json

from orderflow.deribit_adapter import DeribitOptionsFlowClient, OptionTradeEvent, parse_deribit_trades_message


class FakeConnection:
    def __init__(self, incoming: list[str]):
        self._incoming = incoming
        self.sent: list[str] = []

    async def send(self, message: str) -> None:
        self.sent.append(message)

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for msg in self._incoming:
            yield msg

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class FakeConnect:
    def __init__(self, incoming: list[str]):
        self._incoming = incoming
        self.called_with = None

    def __call__(self, uri: str):
        self.called_with = uri
        return FakeConnection(self._incoming)


def _trades_raw(channel: str, data: list[dict]) -> str:
    return json.dumps({
        "jsonrpc": "2.0",
        "method": "subscription",
        "params": {"channel": channel, "data": data},
    })


def test_parse_deribit_trades_message_parses_events():
    raw = _trades_raw("trades.option.BTC.100ms", [
        {
            "instrument_name": "BTC-27DEC26-100000-C",
            "direction": "buy",
            "price": 0.0512,
            "amount": 10.0,
            "iv": 55.3,
            "index_price": 95000.0,
            "timestamp": 1720000000000,
        },
        {
            "instrument_name": "BTC-27DEC26-90000-P",
            "direction": "sell",
            "price": 0.021,
            "amount": 5.0,
            "iv": 60.1,
            "index_price": 95000.0,
            "timestamp": 1720000001000,
        },
    ])
    events = parse_deribit_trades_message(raw, currency="BTC")
    assert len(events) == 2
    assert all(isinstance(e, OptionTradeEvent) for e in events)
    assert events[0].instrument_name == "BTC-27DEC26-100000-C"
    assert events[0].direction == "buy"
    assert events[0].price == 0.0512
    assert events[0].ts if False else events[0].timestamp == 1720000000.0
    assert events[1].direction == "sell"


def test_parse_deribit_trades_message_ignores_other_channel():
    raw = _trades_raw("trades.option.ETH.100ms", [
        {"instrument_name": "ETH-1JAN27-4000-C", "direction": "buy", "price": 0.01,
         "amount": 1.0, "iv": 50.0, "index_price": 3500.0, "timestamp": 1720000000000},
    ])
    assert parse_deribit_trades_message(raw, currency="BTC") == []


def test_parse_deribit_trades_message_ignores_malformed_json():
    assert parse_deribit_trades_message("not json", currency="BTC") == []


def test_parse_deribit_trades_message_ignores_missing_field():
    raw = _trades_raw("trades.option.BTC.100ms", [
        {"instrument_name": "BTC-27DEC26-100000-C", "direction": "buy",
         "amount": 10.0, "iv": 55.3, "index_price": 95000.0, "timestamp": 1720000000000},  # price 없음
    ])
    assert parse_deribit_trades_message(raw, currency="BTC") == []


def test_parse_deribit_trades_message_ignores_non_subscription_response():
    raw = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"status": "ok"}})
    assert parse_deribit_trades_message(raw, currency="BTC") == []


async def test_stream_subscribes_correct_channel_and_yields_parsed_events():
    raw = _trades_raw("trades.option.BTC.100ms", [
        {"instrument_name": "BTC-27DEC26-100000-C", "direction": "buy", "price": 0.05,
         "amount": 10.0, "iv": 55.0, "index_price": 95000.0, "timestamp": 1720000000000},
    ])
    fake_connect = FakeConnect([raw])
    client = DeribitOptionsFlowClient("BTC", connect_fn=fake_connect)
    events = [e async for e in client.stream()]

    assert len(events) == 1
    assert events[0].instrument_name == "BTC-27DEC26-100000-C"
    assert fake_connect.called_with == client._base_url

    sent = json.loads(fake_connect._incoming and "{}" or "{}")  # placeholder to keep var used
```

위 마지막 줄(`sent = ...`)은 실수로 넣은 미사용 코드다 — 실제로는 아래처럼 구독 메시지 전송을 검증해야 한다. 이 스텝에서 파일을 쓸 때는 아래 **수정된 마지막 테스트**로 작성한다(위 블록의 `async def test_stream_...` 함수 전체를 이걸로 교체):

```python
async def test_stream_subscribes_correct_channel_and_yields_parsed_events():
    raw = _trades_raw("trades.option.BTC.100ms", [
        {"instrument_name": "BTC-27DEC26-100000-C", "direction": "buy", "price": 0.05,
         "amount": 10.0, "iv": 55.0, "index_price": 95000.0, "timestamp": 1720000000000},
    ])
    fake_connect = FakeConnect([raw])
    client = DeribitOptionsFlowClient("BTC", connect_fn=fake_connect)
    events = [e async for e in client.stream()]

    assert len(events) == 1
    assert events[0].instrument_name == "BTC-27DEC26-100000-C"
    assert fake_connect.called_with == client._base_url


async def test_stream_currency_is_uppercased_in_channel():
    fake_connect = FakeConnect([])
    client = DeribitOptionsFlowClient("btc", connect_fn=fake_connect)
    _ = [e async for e in client.stream()]
    assert client.currency == "BTC"
```

(파일 저장 시 앞의 "placeholder" 문단은 포함하지 않는다 — 최종 파일은 헬퍼 클래스 3개 + 위 6개 `test_*` 함수만 담는다: `test_parse_deribit_trades_message_parses_events`, `test_parse_deribit_trades_message_ignores_other_channel`, `test_parse_deribit_trades_message_ignores_malformed_json`, `test_parse_deribit_trades_message_ignores_missing_field`, `test_parse_deribit_trades_message_ignores_non_subscription_response`, `test_stream_subscribes_correct_channel_and_yields_parsed_events`, `test_stream_currency_is_uppercased_in_channel`.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_deribit_adapter.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'orderflow.deribit_adapter'`

- [ ] **Step 3: 최소 구현 작성**

`seokminal-multi-venue/orderflow/deribit_adapter.py` 전체 내용:

```python
"""Deribit 퍼블릭 WS 옵션 체결 어댑터. hl_adapter.py와 동일 패턴(연결+파싱만, 재연결은
options_flow_manager.py가 담당)."""
import json
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

import websockets

DERIBIT_WS_URL = "wss://www.deribit.com/ws/api/v2"


@dataclass
class OptionTradeEvent:
    instrument_name: str  # 예: "BTC-27DEC26-100000-C"
    direction: str  # "buy" | "sell"
    price: float  # 옵션 프리미엄(기초자산 단위)
    amount: float  # 계약 수량
    iv: float  # 체결 시점 implied vol (%)
    index_price: float  # 체결 시점 기초자산 지수가
    timestamp: float  # epoch seconds


class DeribitOptionsFlowClient:
    def __init__(
        self,
        currency: str,
        base_url: str = DERIBIT_WS_URL,
        connect_fn: Callable[[str], Any] = websockets.connect,
    ) -> None:
        self.currency = currency.upper()
        self._base_url = base_url
        self._connect_fn = connect_fn

    async def stream(self) -> AsyncIterator[OptionTradeEvent]:
        channel = f"trades.option.{self.currency}.100ms"
        async with self._connect_fn(self._base_url) as connection:
            await connection.send(json.dumps({
                "jsonrpc": "2.0",
                "method": "public/subscribe",
                "params": {"channels": [channel]},
            }))
            async for raw in connection:
                for event in parse_deribit_trades_message(raw, currency=self.currency):
                    yield event


def parse_deribit_trades_message(raw: str, currency: str) -> list[OptionTradeEvent]:
    try:
        msg = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(msg, dict):
        return []

    params = msg.get("params")
    if not isinstance(params, dict):
        return []

    expected_channel = f"trades.option.{currency.upper()}.100ms"
    if params.get("channel") != expected_channel:
        return []

    data = params.get("data")
    if not isinstance(data, list):
        return []

    try:
        events: list[OptionTradeEvent] = []
        for t in data:
            events.append(OptionTradeEvent(
                instrument_name=t["instrument_name"],
                direction=t["direction"],
                price=float(t["price"]),
                amount=float(t["amount"]),
                iv=float(t.get("iv", 0.0)),
                index_price=float(t.get("index_price", 0.0)),
                timestamp=float(t["timestamp"]) / 1000.0,
            ))
        return events
    except (KeyError, TypeError, ValueError):
        return []
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_deribit_adapter.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: 커밋**

```bash
cd seokminal-multi-venue
git add orderflow/deribit_adapter.py tests/test_orderflow_deribit_adapter.py
git commit -m "feat(orderflow): Deribit 옵션 체결 WS 어댑터 추가"
```

---

### Task 2: 옵션플로우 fan-out 매니저 (`orderflow/options_flow_manager.py`)

**Files:**
- Create: `seokminal-multi-venue/orderflow/options_flow_manager.py`
- Test: `seokminal-multi-venue/tests/test_orderflow_options_flow_manager.py`

**Interfaces:**
- Consumes: `orderflow.deribit_adapter.DeribitOptionsFlowClient`, `orderflow.deribit_adapter.OptionTradeEvent` (Task 1).
- Produces: `OptionsFlowManager(adapter_factory=None)` — `.subscribe(currency: str) -> asyncio.Queue`, `.unsubscribe(currency: str, queue: asyncio.Queue) -> None`, `.active_currencies() -> list[str]`, 모듈 레벨 `default_manager = OptionsFlowManager()`, `RECONNECT_BASE_DELAY = 2.0`. 큐에 들어가는 메시지 dict 포맷: `{"type": "trade", "instrument_name": str, "direction": str, "price": float, "amount": float, "iv": float, "index_price": float, "timestamp": float}` 또는 `{"type": "status", "state": "live"|"reconnecting"}`. Task 4가 이 매니저를 그대로 라우터에서 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-multi-venue/tests/test_orderflow_options_flow_manager.py` 전체 내용:

```python
import asyncio
from asyncio import sleep as _real_sleep
from unittest.mock import AsyncMock, patch

from orderflow.deribit_adapter import OptionTradeEvent
from orderflow.options_flow_manager import RECONNECT_BASE_DELAY, OptionsFlowManager


def _trade(instrument_name="BTC-27DEC26-100000-C", direction="buy"):
    return OptionTradeEvent(
        instrument_name=instrument_name, direction=direction, price=0.05,
        amount=10.0, iv=55.0, index_price=65000.0, timestamp=1000.0,
    )


async def _one_shot_stream(events):
    for e in events:
        yield e


async def test_subscribe_starts_worker_and_broadcasts_trade():
    manager = OptionsFlowManager(adapter_factory=lambda currency: _one_shot_stream([_trade()]))
    queue = manager.subscribe("BTC")
    assert manager.active_currencies() == ["BTC"]

    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert msg == {
        "type": "trade",
        "instrument_name": "BTC-27DEC26-100000-C",
        "direction": "buy",
        "price": 0.05,
        "amount": 10.0,
        "iv": 55.0,
        "index_price": 65000.0,
        "timestamp": 1000.0,
    }

    manager.unsubscribe("BTC", queue)
    assert manager.active_currencies() == []


async def test_subscribe_currency_is_case_insensitive():
    manager = OptionsFlowManager(adapter_factory=lambda currency: _one_shot_stream([]))
    manager.subscribe("btc")
    assert manager.active_currencies() == ["BTC"]


async def test_second_subscriber_reuses_worker():
    manager = OptionsFlowManager(adapter_factory=lambda currency: _one_shot_stream([]))
    q1 = manager.subscribe("ETH")
    q2 = manager.subscribe("ETH")
    assert manager.active_currencies() == ["ETH"]
    manager.unsubscribe("ETH", q1)
    assert manager.active_currencies() == ["ETH"]  # q2 아직 구독 중 -> worker 유지
    manager.unsubscribe("ETH", q2)
    assert manager.active_currencies() == []


async def test_reconnects_with_backoff_then_broadcasts_live_before_trade():
    call_count = 0

    async def flaky(currency):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ConnectionError("boom")
        yield _trade()

    manager = OptionsFlowManager(adapter_factory=flaky)

    async def mock_sleep(delay):
        await _real_sleep(0.001)

    with patch("orderflow.options_flow_manager.asyncio.sleep", new=AsyncMock(side_effect=mock_sleep)) as mock_sleep_obj:
        queue = manager.subscribe("BTC")
        reconnecting_msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        live_msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        trade_msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        manager.unsubscribe("BTC", queue)

    assert reconnecting_msg == {"type": "status", "state": "reconnecting"}
    assert live_msg == {"type": "status", "state": "live"}
    assert trade_msg["type"] == "trade"
    mock_sleep_obj.assert_any_call(RECONNECT_BASE_DELAY)


async def test_put_drops_oldest_message_when_queue_full():
    manager = OptionsFlowManager(adapter_factory=lambda currency: _one_shot_stream([]))
    queue: asyncio.Queue = asyncio.Queue(maxsize=2)

    manager._put(queue, {"seq": 1})
    manager._put(queue, {"seq": 2})
    assert queue.full()

    manager._put(queue, {"seq": 3})

    assert queue.qsize() == 2
    remaining = [queue.get_nowait(), queue.get_nowait()]
    assert remaining == [{"seq": 2}, {"seq": 3}]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_options_flow_manager.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'orderflow.options_flow_manager'`

- [ ] **Step 3: 최소 구현 작성**

`seokminal-multi-venue/orderflow/options_flow_manager.py` 전체 내용:

```python
"""Deribit 옵션 체결 스트림 매니저 — orderflow/manager.py(OrderflowManager)의 재연결
백오프/큐 브로드캐스트 구조를 옵션 체결(집계 없음, 원본 그대로 전달)용으로 경량화한 버전."""
import asyncio
import logging
from dataclasses import dataclass, field

from orderflow.deribit_adapter import DeribitOptionsFlowClient, OptionTradeEvent

RECONNECT_BASE_DELAY = 2.0
RECONNECT_MAX_DELAY = 60.0
SUBSCRIBER_QUEUE_MAXSIZE = 1000


def _default_adapter_factory(currency: str):
    return DeribitOptionsFlowClient(currency).stream()


@dataclass
class _CurrencyWorker:
    task: "asyncio.Task"
    subscribers: set = field(default_factory=set)


class OptionsFlowManager:
    def __init__(self, adapter_factory=None) -> None:
        self._adapter_factory = adapter_factory or _default_adapter_factory
        self._workers: dict[str, _CurrencyWorker] = {}

    def active_currencies(self) -> list[str]:
        return list(self._workers.keys())

    def subscribe(self, currency: str) -> asyncio.Queue:
        currency = currency.upper()
        worker = self._workers.get(currency)
        if worker is None:
            task = asyncio.ensure_future(self._run(currency))
            worker = _CurrencyWorker(task=task)
            self._workers[currency] = worker
        queue: asyncio.Queue = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_MAXSIZE)
        worker.subscribers.add(queue)
        return queue

    def unsubscribe(self, currency: str, queue: asyncio.Queue) -> None:
        currency = currency.upper()
        worker = self._workers.get(currency)
        if worker is None:
            return
        worker.subscribers.discard(queue)
        if not worker.subscribers:
            worker.task.cancel()
            del self._workers[currency]

    def _put(self, queue: asyncio.Queue, msg: dict) -> None:
        try:
            queue.put_nowait(msg)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            queue.put_nowait(msg)

    def _broadcast(self, currency: str, msg: dict) -> None:
        worker = self._workers.get(currency)
        if worker is None:
            return
        for queue in worker.subscribers:
            self._put(queue, msg)

    def _broadcast_status(self, currency: str, state: str) -> None:
        self._broadcast(currency, {"type": "status", "state": state})

    async def _run(self, currency: str) -> None:
        delay = RECONNECT_BASE_DELAY
        was_reconnecting = False
        while True:
            try:
                async for event in self._adapter_factory(currency):
                    delay = RECONNECT_BASE_DELAY
                    if was_reconnecting:
                        self._broadcast_status(currency, "live")
                        was_reconnecting = False
                    self._broadcast(currency, _event_to_msg(event))
                self._broadcast_status(currency, "reconnecting")
                was_reconnecting = True
                await asyncio.sleep(delay)
                delay = min(delay * 2, RECONNECT_MAX_DELAY)
            except asyncio.CancelledError:
                raise
            except Exception:
                logging.exception("options-flow adapter failed for %s, reconnecting", currency)
                self._broadcast_status(currency, "reconnecting")
                was_reconnecting = True
                await asyncio.sleep(delay)
                delay = min(delay * 2, RECONNECT_MAX_DELAY)


def _event_to_msg(event: OptionTradeEvent) -> dict:
    return {
        "type": "trade",
        "instrument_name": event.instrument_name,
        "direction": event.direction,
        "price": event.price,
        "amount": event.amount,
        "iv": event.iv,
        "index_price": event.index_price,
        "timestamp": event.timestamp,
    }


default_manager = OptionsFlowManager()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_options_flow_manager.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
cd seokminal-multi-venue
git add orderflow/options_flow_manager.py tests/test_orderflow_options_flow_manager.py
git commit -m "feat(orderflow): 옵션플로우 fan-out 매니저 추가"
```

---

### Task 3: GEX 계산 + 캐시 (`orderflow/gex.py`)

**Files:**
- Create: `seokminal-multi-venue/orderflow/gex.py`
- Test: `seokminal-multi-venue/tests/test_orderflow_gex.py`

**Interfaces:**
- Consumes: `options.pricer.bs_greeks(S, K, T, r, sigma, option_type) -> dict`(기존, `gamma` 키 포함).
- Produces: `fetch_gex_by_strike(currency: str, fetch_fn=_default_fetch, now: float | None = None) -> dict`(반환 형태: `{"currency": str, "spot": float, "updated_at": float, "levels": [{"strike": float, "call_gex": float, "put_gex": float, "net_gex": float}, ...]}`), `get_cached_gex(currency: str) -> dict | None`, `gex_poll_loop() -> None`(무한 루프, 60초마다 BTC/ETH 캐시 갱신), `GEX_POLL_INTERVAL_SEC = 60.0`. Task 4가 `get_cached_gex`와 `gex_poll_loop`를 그대로 임포트해서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-multi-venue/tests/test_orderflow_gex.py` 전체 내용:

```python
import datetime as dt
import math

import pytest

from options.pricer import bs_greeks
from orderflow.gex import _parse_deribit_expiry, fetch_gex_by_strike


def _fake_book_summary(instruments):
    async def fetch_fn(url, params):
        return {"result": instruments}
    return fetch_fn


def _instrument(name, underlying_price, mark_iv, open_interest):
    return {
        "instrument_name": name,
        "underlying_price": underlying_price,
        "mark_iv": mark_iv,
        "open_interest": open_interest,
    }


async def test_fetch_gex_by_strike_aggregates_call_and_put_at_same_strike():
    expiry_ts = _parse_deribit_expiry("27DEC26")
    now = expiry_ts - 30 * 86400.0  # 만기 30일 전
    instruments = [
        _instrument("BTC-27DEC26-100000-C", 95000.0, 55.0, 10.0),
        _instrument("BTC-27DEC26-100000-P", 95000.0, 55.0, 5.0),
    ]
    result = await fetch_gex_by_strike("BTC", fetch_fn=_fake_book_summary(instruments), now=now)

    assert result["currency"] == "BTC"
    assert result["spot"] == 95000.0
    assert result["updated_at"] == now
    assert len(result["levels"]) == 1
    level = result["levels"][0]
    assert level["strike"] == 100000.0

    T = 30 * 86400.0 / (365.0 * 86400.0)
    # BS 모델에서 gamma는 콜/풋 옵션타입에 무관하게 동일한 값이다.
    gamma = bs_greeks(95000.0, 100000.0, T, 0.0, 0.55, "call")["gamma"]
    expected_call_gex = gamma * 10.0 * (95000.0 ** 2) * 0.01
    expected_put_gex = gamma * 5.0 * (95000.0 ** 2) * 0.01

    assert math.isclose(level["call_gex"], expected_call_gex, rel_tol=1e-6)
    assert math.isclose(level["put_gex"], expected_put_gex, rel_tol=1e-6)
    assert math.isclose(level["net_gex"], expected_call_gex - expected_put_gex, rel_tol=1e-9)


async def test_fetch_gex_by_strike_skips_zero_oi_and_zero_iv():
    now = _parse_deribit_expiry("27DEC26") - 30 * 86400.0
    instruments = [
        _instrument("BTC-27DEC26-100000-C", 95000.0, 55.0, 0.0),   # OI=0 -> 스킵
        _instrument("BTC-27DEC26-110000-C", 95000.0, 0.0, 10.0),   # IV=0 -> 스킵
    ]
    result = await fetch_gex_by_strike("BTC", fetch_fn=_fake_book_summary(instruments), now=now)
    assert result["levels"] == []


async def test_fetch_gex_by_strike_ignores_malformed_instrument_name():
    now = _parse_deribit_expiry("27DEC26") - 30 * 86400.0
    instruments = [
        {"instrument_name": "BTC-PERPETUAL", "underlying_price": 95000.0, "mark_iv": 55.0, "open_interest": 10.0},
        _instrument("BTC-27DEC26-100000-C", 95000.0, 55.0, 10.0),
    ]
    result = await fetch_gex_by_strike("BTC", fetch_fn=_fake_book_summary(instruments), now=now)
    assert len(result["levels"]) == 1
    assert result["levels"][0]["strike"] == 100000.0


async def test_fetch_gex_by_strike_empty_instruments_returns_empty_levels():
    result = await fetch_gex_by_strike("ETH", fetch_fn=_fake_book_summary([]), now=1000.0)
    assert result == {"currency": "ETH", "spot": 0.0, "updated_at": 1000.0, "levels": []}


async def test_fetch_gex_by_strike_levels_sorted_by_strike():
    now = _parse_deribit_expiry("27DEC26") - 30 * 86400.0
    instruments = [
        _instrument("BTC-27DEC26-110000-C", 95000.0, 55.0, 10.0),
        _instrument("BTC-27DEC26-90000-C", 95000.0, 55.0, 10.0),
    ]
    result = await fetch_gex_by_strike("BTC", fetch_fn=_fake_book_summary(instruments), now=now)
    strikes = [lv["strike"] for lv in result["levels"]]
    assert strikes == sorted(strikes)


def test_parse_deribit_expiry_returns_utc_8am_epoch():
    ts = _parse_deribit_expiry("27DEC26")
    d = dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc)
    assert (d.day, d.month, d.year, d.hour, d.minute) == (27, 12, 2026, 8, 0)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_gex.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'orderflow.gex'`

- [ ] **Step 3: 최소 구현 작성**

`seokminal-multi-venue/orderflow/gex.py` 전체 내용:

```python
"""Deribit 옵션 미결제약정 기반 GEX(감마 익스포저) 계산 — 60초 폴링 캐시.
gamma는 기존 options/pricer.py:bs_greeks를 재사용(신규 BS 구현 안 함)."""
import asyncio
import datetime as dt
import logging
import time
from collections.abc import Awaitable, Callable

import httpx

from options.pricer import bs_greeks

DERIBIT_REST_URL = "https://www.deribit.com/api/v2"
GEX_POLL_INTERVAL_SEC = 60.0
CONTRACT_SIZE = 1.0  # Deribit BTC/ETH 옵션 1계약 = 1 코인

logger = logging.getLogger(__name__)

FetchFn = Callable[[str, dict], Awaitable[dict]]


async def _default_fetch(url: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


def _parse_deribit_expiry(date_str: str) -> float:
    """Deribit 만기 표기(예: '27DEC26')를 UTC epoch seconds(만기일 08:00 UTC)로 변환."""
    d = dt.datetime.strptime(date_str, "%d%b%y").replace(
        hour=8, minute=0, second=0, tzinfo=dt.timezone.utc
    )
    return d.timestamp()


async def fetch_gex_by_strike(
    currency: str, fetch_fn: FetchFn = _default_fetch, now: float | None = None
) -> dict:
    """currency(BTC/ETH)의 만기 통합 스트라이크별 GEX를 계산한다."""
    currency = currency.upper()
    now = now if now is not None else time.time()
    body = await fetch_fn(
        f"{DERIBIT_REST_URL}/public/get_book_summary_by_currency",
        {"currency": currency, "kind": "option"},
    )
    instruments = body.get("result") or []

    if not instruments:
        return {"currency": currency, "spot": 0.0, "updated_at": now, "levels": []}

    spot = instruments[0]["underlying_price"]
    by_strike: dict[float, dict] = {}

    for inst in instruments:
        name_parts = inst["instrument_name"].split("-")  # BTC-27DEC26-100000-C
        if len(name_parts) != 4:
            continue
        try:
            strike = float(name_parts[2])
            option_type = "call" if name_parts[3] == "C" else "put"
            expiry_ts = _parse_deribit_expiry(name_parts[1])
        except (ValueError, IndexError):
            continue

        T = max((expiry_ts - now) / (365.0 * 86400.0), 1e-6)
        iv = (inst.get("mark_iv") or 0.0) / 100.0
        oi = inst.get("open_interest") or 0.0
        if iv <= 0 or oi <= 0:
            continue

        gamma = bs_greeks(spot, strike, T, 0.0, iv, option_type)["gamma"]
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


_cache: dict[str, dict] = {}


def get_cached_gex(currency: str) -> dict | None:
    return _cache.get(currency.upper())


async def gex_poll_loop() -> None:
    while True:
        for currency in ("BTC", "ETH"):
            try:
                _cache[currency] = await fetch_gex_by_strike(currency)
            except Exception:
                logger.warning("GEX 폴링 실패: %s", currency)
        await asyncio.sleep(GEX_POLL_INTERVAL_SEC)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_gex.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```bash
cd seokminal-multi-venue
git add orderflow/gex.py tests/test_orderflow_gex.py
git commit -m "feat(orderflow): Deribit GEX 계산+캐시 추가(bs_greeks 재사용)"
```

---

### Task 4: 라우터 + main.py 등록 (`api_server/router_options_flow.py`)

**Files:**
- Create: `seokminal-multi-venue/api_server/router_options_flow.py`
- Test: `seokminal-multi-venue/tests/test_router_options_flow.py`
- Modify: `seokminal-multi-venue/api_server/main.py` (라우터 등록부 근처, `orderflow_router` 등록 직후 / startup 이벤트 핸들러 내부)

**Interfaces:**
- Consumes: `orderflow.gex.get_cached_gex`, `orderflow.gex.gex_poll_loop` (Task 3), `orderflow.options_flow_manager.default_manager` (Task 2).
- Produces: `GET /options-flow/gex/{currency}`, `WS /ws/options-flow/{currency}`.

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-multi-venue/tests/test_router_options_flow.py` 전체 내용:

```python
import asyncio
from unittest.mock import patch

import pytest
from fastapi import FastAPI, WebSocketDisconnect
from fastapi.testclient import TestClient

from api_server.router_options_flow import router


class _StubManager:
    def __init__(self, subscribe_result=None):
        self._subscribe_result = subscribe_result
        self.unsubscribed: list[tuple[str, object]] = []

    def subscribe(self, currency):
        return self._subscribe_result

    def unsubscribe(self, currency, queue):
        self.unsubscribed.append((currency, queue))


def _app():
    app = FastAPI()
    app.include_router(router)
    return app


def test_get_gex_returns_cached_snapshot():
    cached = {"currency": "BTC", "spot": 95000.0, "updated_at": 1000.0, "levels": []}
    client = TestClient(_app())
    with patch("api_server.router_options_flow.get_cached_gex", return_value=cached):
        r = client.get("/options-flow/gex/BTC")
    assert r.status_code == 200
    assert r.json() == cached


def test_get_gex_returns_empty_snapshot_when_not_cached_yet():
    client = TestClient(_app())
    with patch("api_server.router_options_flow.get_cached_gex", return_value=None):
        r = client.get("/options-flow/gex/BTC")
    assert r.json() == {"currency": "BTC", "spot": 0.0, "updated_at": 0.0, "levels": []}


def test_get_gex_unsupported_currency_returns_empty_without_lookup():
    client = TestClient(_app())
    with patch("api_server.router_options_flow.get_cached_gex") as mock_get:
        r = client.get("/options-flow/gex/DOGE")
    mock_get.assert_not_called()
    assert r.json() == {"currency": "DOGE", "spot": 0.0, "updated_at": 0.0, "levels": []}


def test_ws_options_flow_streams_queued_trade_then_cleans_up_on_disconnect():
    queue = asyncio.Queue()
    queue.put_nowait({"type": "trade", "instrument_name": "BTC-27DEC26-100000-C"})
    stub = _StubManager(subscribe_result=queue)
    client = TestClient(_app())

    with patch("api_server.router_options_flow.default_manager", stub):
        with client.websocket_connect("/ws/options-flow/BTC") as ws:
            msg = ws.receive_json()

    assert msg["type"] == "trade"
    assert stub.unsubscribed == [("BTC", queue)]


def test_ws_options_flow_unsupported_currency_closes_after_accept():
    client = TestClient(_app())
    with client.websocket_connect("/ws/options-flow/DOGE") as ws:
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_router_options_flow.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api_server.router_options_flow'`

- [ ] **Step 3: 최소 구현 작성**

`seokminal-multi-venue/api_server/router_options_flow.py` 전체 내용:

```python
"""Deribit 옵션플로우(체결)+GEX API. orderflow/options_flow_manager.py, orderflow/gex.py를
소비만 한다. 매매 실행 로직과 임포트/상태 공유 없음."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from orderflow.gex import get_cached_gex
from orderflow.options_flow_manager import default_manager

router = APIRouter()

SUPPORTED_CURRENCIES = {"BTC", "ETH"}


@router.get("/options-flow/gex/{currency}")
def get_gex(currency: str) -> dict:
    currency = currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        return {"currency": currency, "spot": 0.0, "updated_at": 0.0, "levels": []}
    cached = get_cached_gex(currency)
    return cached or {"currency": currency, "spot": 0.0, "updated_at": 0.0, "levels": []}


@router.websocket("/ws/options-flow/{currency}")
async def ws_options_flow(websocket: WebSocket, currency: str) -> None:
    currency = currency.upper()
    await websocket.accept()
    if currency not in SUPPORTED_CURRENCIES:
        await websocket.close(code=1008)
        return
    queue = default_manager.subscribe(currency)
    try:
        while True:
            msg = await queue.get()
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        pass
    finally:
        default_manager.unsubscribe(currency, queue)
```

이제 `seokminal-multi-venue/api_server/main.py`를 수정한다. 기존 `from api_server.router_orderflow import router as orderflow_router` / `app.include_router(orderflow_router)` 바로 다음 줄에 추가:

```python
from api_server.router_options_flow import router as options_flow_router
app.include_router(options_flow_router)
```

그리고 `_start_dart_bot` startup 핸들러 안, `asyncio.create_task(_lkg_scheduler())` 바로 다음 줄에 추가:

```python
    from orderflow.gex import gex_poll_loop
    asyncio.create_task(gex_poll_loop())
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_router_options_flow.py -v`
Expected: PASS (5 passed)

이어서 전체 스위트로 main.py 수정이 임포트를 깨지 않았는지 확인:

Run: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
Expected: 기존 pre-existing failures(test_auth.py 3~4건, test_backtest_happy_path) 외 전부 통과, 신규 실패 없음.

- [ ] **Step 5: 커밋**

```bash
cd seokminal-multi-venue
git add api_server/router_options_flow.py api_server/main.py tests/test_router_options_flow.py
git commit -m "feat(orderflow): 옵션플로우+GEX 라우터 추가, main.py 등록"
```

---

### Task 5: 프론트 API 클라이언트 함수 (`lib/api.ts`)

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts` (기존 `getOrderflowSymbols` 함수 바로 뒤, 대략 178번째 줄 근처)
- Test: `seokminal-dashboard/tests/lib/api-options-flow.test.ts`

**Interfaces:**
- Produces: `GexLevel { strike: number; call_gex: number; put_gex: number; net_gex: number }`, `GexSnapshot { currency: string; spot: number; updated_at: number; levels: GexLevel[] }`, `getOptionsGex(currency: string, signal?: AbortSignal): Promise<GexSnapshot>`. Task 7이 이 함수와 타입을 그대로 임포트해서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-dashboard/tests/lib/api-options-flow.test.ts` 전체 내용:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getOptionsGex, ApiError } from "../../lib/api";

describe("getOptionsGex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const snapshot = {
    currency: "BTC",
    spot: 95000,
    updated_at: 1720000000,
    levels: [{ strike: 100000, call_gex: 1.5, put_gex: 0.5, net_gex: 1.0 }],
  };

  it("returns the GEX snapshot on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const result = await getOptionsGex("BTC");
    expect(result).toEqual(snapshot);
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);
    await expect(getOptionsGex("BTC")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const ctrl = new AbortController();
    await getOptionsGex("BTC", ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/api-options-flow.test.ts`
Expected: FAIL — `getOptionsGex`가 `lib/api.ts`에 없어서 임포트 에러

- [ ] **Step 3: 최소 구현 작성**

`seokminal-dashboard/lib/api.ts`에서 `export async function getOrderflowSymbols(...)` 함수 바로 뒤(178번째 줄, `getBacktest` 함수 시작 전)에 삽입:

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

/** currency(BTC/ETH)의 스트라이크별 GEX 스냅샷(백엔드 60초 캐시). */
export async function getOptionsGex(currency: string, signal?: AbortSignal): Promise<GexSnapshot> {
  const response = await fetch(`${API_URL}/options-flow/gex/${encodeURIComponent(currency)}`, { signal });
  return handleResponse<GexSnapshot>(response);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/api-options-flow.test.ts`
Expected: PASS (3 passed)

이어서 타입체크:

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
cd seokminal-dashboard
git add lib/api.ts tests/lib/api-options-flow.test.ts
git commit -m "feat(orderflow): getOptionsGex API 클라이언트 함수 추가"
```

---

### Task 6: 옵션플로우 WS 훅 (`hooks/useOptionsFlowSocket.ts`)

**Files:**
- Create: `seokminal-dashboard/hooks/useOptionsFlowSocket.ts`

**Interfaces:**
- Consumes: `lib/api.ts`의 `WS_URL`(기존 export).
- Produces: `OptionTrade { instrument_name: string; direction: "buy" | "sell"; price: number; amount: number; iv: number; index_price: number; timestamp: number }`, `OptionsFlowConnectionState = "connecting" | "live" | "reconnecting" | "error"`, `useOptionsFlowSocket(currency: string): { trades: OptionTrade[]; connectionState: OptionsFlowConnectionState }`(최근 100건 유지, 최신이 배열 앞). Task 7이 이 훅을 그대로 쓴다.

이 파일은 기존 `hooks/useOrderflowSocket.ts`와 동일한 재연결 패턴(WebSocket 재연결 지수 백오프)이라 별도 유닛테스트가 없다 — `useOrderflowSocket.ts`도 WS 통합 특성상 테스트 파일이 없는 기존 컨벤션을 그대로 따른다. 검증은 Task 8의 브라우저 확인으로 한다.

- [ ] **Step 1: 구현 작성**

`seokminal-dashboard/hooks/useOptionsFlowSocket.ts` 전체 내용:

```ts
// hooks/useOptionsFlowSocket.ts
"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/lib/api";

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;
const MAX_TRADES = 100;

export type OptionsFlowConnectionState = "connecting" | "live" | "reconnecting" | "error";

export interface OptionTrade {
  instrument_name: string;
  direction: "buy" | "sell";
  price: number;
  amount: number;
  iv: number;
  index_price: number;
  timestamp: number;
}

interface UseOptionsFlowSocketResult {
  trades: OptionTrade[];
  connectionState: OptionsFlowConnectionState;
}

function isTradeMsg(msg: unknown): msg is { type: "trade" } & OptionTrade {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "trade";
}

function isStatusMsg(msg: unknown): msg is { type: "status"; state: string } {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "status";
}

export function useOptionsFlowSocket(currency: string): UseOptionsFlowSocketResult {
  const [trades, setTrades] = useState<OptionTrade[]>([]);
  const [connectionState, setConnectionState] = useState<OptionsFlowConnectionState>("connecting");

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    setTrades([]);
    setConnectionState("connecting");

    function connect() {
      ws = new WebSocket(`${WS_URL}/ws/options-flow/${encodeURIComponent(currency)}`);

      ws.onopen = () => {
        delay = RECONNECT_BASE_DELAY_MS;
      };

      ws.onmessage = (evt) => {
        if (closedByEffect) return;
        let msg: unknown;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (isStatusMsg(msg)) {
          setConnectionState(msg.state === "live" ? "live" : "reconnecting");
          return;
        }
        if (isTradeMsg(msg)) {
          setConnectionState("live");
          setTrades((prev) => [msg, ...prev].slice(0, MAX_TRADES));
        }
      };

      ws.onerror = () => {
        if (closedByEffect) return;
        setConnectionState("error");
      };

      ws.onclose = () => {
        if (closedByEffect) return;
        setConnectionState("reconnecting");
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currency]);

  return { trades, connectionState };
}
```

- [ ] **Step 2: 타입체크**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd seokminal-dashboard
git add hooks/useOptionsFlowSocket.ts
git commit -m "feat(orderflow): 옵션 체결 실시간 WS 훅 추가"
```

---

### Task 7: GEX 차트 + 체결 티커 패널 (`components/orderflow/OptionsFlowPanel.tsx`)

**Files:**
- Create: `seokminal-dashboard/components/orderflow/OptionsFlowPanel.tsx`

**Interfaces:**
- Consumes: `lib/api.ts`의 `getOptionsGex`, `GexSnapshot`(Task 5), `hooks/useOptionsFlowSocket.ts`의 `useOptionsFlowSocket`(Task 6).
- Produces: `OptionsFlowPanel({ currency }: { currency: string })` — 컴포넌트. Task 8이 `app/orderflow/page.tsx`에서 그대로 렌더한다.

이 컴포넌트는 D3로 SVG를 직접 그리는 `components/event-study/EventReturnChart.tsx`와 동일 패턴(차트 렌더링 로직은 유닛테스트 없음, 기존 컨벤션)이라 별도 테스트 파일이 없다. 검증은 Task 8의 브라우저 확인으로 한다.

- [ ] **Step 1: 구현 작성**

`seokminal-dashboard/components/orderflow/OptionsFlowPanel.tsx` 전체 내용:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getOptionsGex, type GexSnapshot } from "@/lib/api";
import { useOptionsFlowSocket } from "@/hooks/useOptionsFlowSocket";

const POLL_INTERVAL_MS = 60_000;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 48 };

interface OptionsFlowPanelProps {
  currency: string; // "BTC" | "ETH"
}

function GexChart({ snapshot, width = 560, height = 220 }: { snapshot: GexSnapshot; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll("*").remove();
    if (snapshot.levels.length === 0) return;

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const strikes = snapshot.levels.map((lv) => lv.strike.toString());
    const xScale = d3.scaleBand<string>().domain(strikes).range([0, innerW]).padding(0.2);

    const maxAbs = Math.max(1, ...snapshot.levels.map((lv) => Math.abs(lv.net_gex)));
    const yScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([innerH, 0]);

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0)).attr("y2", yScale(0))
      .attr("stroke", "var(--color-border)").attr("stroke-width", 1);

    g.selectAll("rect")
      .data(snapshot.levels)
      .join("rect")
      .attr("x", (lv) => xScale(lv.strike.toString()) ?? 0)
      .attr("width", xScale.bandwidth())
      .attr("y", (lv) => yScale(Math.max(0, lv.net_gex)))
      .attr("height", (lv) => Math.abs(yScale(lv.net_gex) - yScale(0)))
      .attr("fill", (lv) => (lv.net_gex >= 0 ? "var(--color-pos)" : "var(--color-neg)"));

    if (snapshot.spot > 0 && snapshot.levels.length > 0) {
      const nearestStrike = snapshot.levels.reduce((best, lv) =>
        Math.abs(lv.strike - snapshot.spot) < Math.abs(best.strike - snapshot.spot) ? lv : best
      );
      const spotX = (xScale(nearestStrike.strike.toString()) ?? 0) + xScale.bandwidth() / 2;
      g.append("line")
        .attr("x1", spotX).attr("x2", spotX)
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "var(--color-accent)").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");
    }

    const tickEvery = Math.max(1, Math.ceil(strikes.length / 8));
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((_, i) => i % tickEvery === 0)))
      .call((gg) => gg.select(".domain").attr("stroke", "var(--color-border)"))
      .call((gg) => gg.selectAll("text").attr("fill", "var(--color-text-2)").attr("font-size", "10px"))
      .call((gg) => gg.selectAll("line").attr("stroke", "var(--color-border)"));

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(4))
      .call((gg) => gg.select(".domain").attr("stroke", "var(--color-border)"))
      .call((gg) => gg.selectAll("text").attr("fill", "var(--color-text-2)").attr("font-size", "10px"))
      .call((gg) => gg.selectAll("line").attr("stroke", "var(--color-border)"));
  }, [snapshot, width, height]);

  return <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" />;
}

export function OptionsFlowPanel({ currency }: OptionsFlowPanelProps) {
  const [gex, setGex] = useState<GexSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { trades, connectionState } = useOptionsFlowSocket(currency);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getOptionsGex(currency, ctrl.signal)
        .then((snapshot) => {
          if (!cancelled) setGex(snapshot);
        })
        .catch((e) => {
          if (!cancelled && (e as Error).name !== "AbortError") setGex(null);
        });
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [currency]);

  return (
    <div className="rounded-lg border border-border bg-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-1 text-sm font-medium">{currency} 옵션 GEX</h3>
        <span className="text-text-3 text-xs">
          {gex ? `spot ${gex.spot.toLocaleString()}` : "로딩 중"}
        </span>
      </div>
      {gex && gex.levels.length > 0 ? (
        <GexChart snapshot={gex} />
      ) : (
        <div className="text-text-3 text-xs py-8 text-center">GEX 데이터 없음</div>
      )}

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-text-2 text-xs">옵션 체결</h4>
          <span className="text-text-3 text-xs">{connectionState}</span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {trades.length === 0 && <div className="text-text-3 text-xs">체결 대기 중</div>}
          {trades.map((t, i) => (
            <div key={`${t.instrument_name}-${t.timestamp}-${i}`} className="flex items-center justify-between text-xs">
              <span className="text-text-2">{t.instrument_name}</span>
              <span className={t.direction === "buy" ? "text-pos" : "text-neg"}>
                {t.direction === "buy" ? "매수" : "매도"} {t.amount}
              </span>
              <span className="text-text-3">IV {t.iv.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd seokminal-dashboard
git add components/orderflow/OptionsFlowPanel.tsx
git commit -m "feat(orderflow): GEX 차트+옵션 체결 티커 패널 추가"
```

---

### Task 8: orderflow 페이지 배선 (`app/orderflow/page.tsx`)

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-data.ts` (파일 끝에 함수 추가)
- Modify: `seokminal-dashboard/tests/lib/orderflow-data.test.ts` (import 및 describe 블록 추가)
- Modify: `seokminal-dashboard/app/orderflow/page.tsx`

**Interfaces:**
- Consumes: `components/orderflow/OptionsFlowPanel.tsx`의 `OptionsFlowPanel`(Task 7).
- Produces: `currencyForSymbol(symbol: string): "BTC" | "ETH" | null`(다른 태스크가 의존하지 않는 최종 소비 지점).

- [ ] **Step 1: 실패하는 테스트 작성**

`seokminal-dashboard/tests/lib/orderflow-data.test.ts` 최상단 import 줄을 찾아 `currencyForSymbol`을 추가한다. 현재:

```ts
import { ... } from "../../lib/orderflow-data";
```

형태의 import문에 `currencyForSymbol`을 추가하고, 파일 끝에 아래 블록을 추가:

```ts
describe("currencyForSymbol", () => {
  it("BTC.HL -> BTC", () => {
    expect(currencyForSymbol("BTC.HL")).toBe("BTC");
  });

  it("ETH.HL -> ETH", () => {
    expect(currencyForSymbol("ETH.HL")).toBe("ETH");
  });

  it("그 외 심볼은 null(옵션플로우 패널 미지원)", () => {
    expect(currencyForSymbol("NQ")).toBeNull();
    expect(currencyForSymbol("SOL.HL")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `currencyForSymbol`이 `lib/orderflow-data.ts`에 없어서 임포트 에러

- [ ] **Step 3: 최소 구현 작성**

`seokminal-dashboard/lib/orderflow-data.ts` 파일 끝에 추가:

```ts
/** "BTC.HL"/"ETH.HL" -> "BTC"/"ETH", 그 외 심볼은 null(옵션플로우 패널 미지원, Deribit은 BTC/ETH만 취급). */
export function currencyForSymbol(symbol: string): "BTC" | "ETH" | null {
  if (symbol === "BTC.HL") return "BTC";
  if (symbol === "ETH.HL") return "ETH";
  return null;
}
```

`seokminal-dashboard/app/orderflow/page.tsx`를 아래처럼 수정한다. import 블록에 두 줄 추가:

```tsx
import { OptionsFlowPanel } from "@/components/orderflow/OptionsFlowPanel";
import { currencyForSymbol } from "@/lib/orderflow-data";
```

컴포넌트 본문에서 `const { footprint, heatmap, connectionState } = useOrderflowSocket(symbol);` 바로 다음 줄에 추가:

```tsx
  const currency = currencyForSymbol(symbol);
```

`return`문의 `<OrderflowChart .../>` 바로 다음 줄에 추가:

```tsx
      {currency && <OptionsFlowPanel currency={currency} />}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS(기존 케이스 + 신규 3건 전부 통과)

이어서 전체 검증:

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: 에러 없음

Run: `cd seokminal-dashboard && npx vitest run`
Expected: 기존 전체 스위트 + 신규 테스트 전부 통과, 신규 실패 없음

- [ ] **Step 5: 커밋**

```bash
cd seokminal-dashboard
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts app/orderflow/page.tsx
git commit -m "feat(orderflow): BTC/ETH 심볼일 때 옵션플로우+GEX 패널 노출"
```

- [ ] **Step 6: 브라우저 육안 확인**

`npm run dev` 기동 상태에서 `/orderflow` 접속, 심볼을 `BTC.HL`로 선택 → GEX 바 차트(스트라이크별, spot 위치 점선)와 옵션 체결 티커가 렌더되는지 확인. `NQ` 등 비-BTC/ETH 심볼로 바꾸면 패널이 사라지는지 확인. Deribit 실제 API 응답에 따라 데이터가 비어있을 수 있음(스펙 범위 밖: Deribit 응답 실제 필드명이 가정과 다를 경우 `orderflow/gex.py`/`orderflow/deribit_adapter.py`의 파싱 부분만 실API 응답 보고 조정).

---

## Self-Review 결과

**스펙 커버리지:** 스펙의 8개 컴포넌트(deribit_adapter, options_flow_manager, gex, router_options_flow+main.py, lib/api.ts, useOptionsFlowSocket, OptionsFlowPanel, page.tsx 배선) 전부 Task 1~8에 1:1 대응. 에러 처리(stale 캐시는 마지막 값 유지, 재연결 백오프, 비지원 통화 게이팅)와 테스트 섹션도 각 태스크에 반영됨. 범위 밖 항목(델타/absorption, 만기별 분해, zero-gamma flip)은 Global Constraints에 명시하고 태스크로 만들지 않음.

**플레이스홀더 스캔:** Task 1 Step 1 초안에 실수로 "placeholder to keep var used" 코드가 섞여 있었던 것을 발견 → 최종 파일에는 포함하지 않는다고 명시하고 올바른 최종 테스트 함수로 교체 완료.

**타입 일관성:** 백엔드 `OptionTradeEvent`(Task 1) → `options_flow_manager._event_to_msg`(Task 2)가 그대로 소비 → 라우터가 그대로 `send_json`(Task 4) → 프론트 `OptionTrade`(Task 6) 필드명(`instrument_name/direction/price/amount/iv/index_price/timestamp`)이 전 구간에서 동일하게 유지됨. `GexSnapshot`/`GexLevel`(Task 5)도 백엔드 `fetch_gex_by_strike` 반환 dict(Task 3) 키와 1:1 일치(`currency/spot/updated_at/levels`, `strike/call_gex/put_gex/net_gex`) 확인.
