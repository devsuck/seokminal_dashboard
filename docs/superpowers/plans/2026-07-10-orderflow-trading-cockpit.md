# Orderflow Trading Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer 5 real-time indicators (COB depth inset, Iceberg/Large-Lot tracker, CVD sub-pane + per-cell delta, Absorption highlighting, GEX levels) onto the existing `/orderflow` candlestick chart so a trader can read entry/exit signals from one view.

**Architecture:** All 5 features are additive `ISeriesPrimitive` canvas layers on the existing candlestick series, except CVD which is a second chart pane (reusing the existing oscillator-pane pattern). No new dependencies. Backend gets one small additive change (throttled `book_snapshot` broadcast); everything else (large-lot tracking, CVD, absorption, GEX-on-chart) is computed client-side from data already flowing over the existing WebSocket/REST endpoints.

**Tech Stack:** `lightweight-charts` 5.2.0 (existing), Canvas 2D primitives matching `FootprintPrimitive.ts`/`HeatmapPrimitive.ts` style. No d3 in primitives (d3 stays confined to `OptionsFlowPanel.tsx`'s SVG GEX bar chart).

## Global Constraints

- Design tokens only in DOM/SVG (`var(--color-*)`). **Correction from spec:** Canvas 2D `fillStyle`/`strokeStyle` cannot resolve CSS custom properties (`ctx.fillStyle = "var(--color-pos)"` silently fails) — confirmed by reading `FootprintPrimitive.ts`/`HeatmapPrimitive.ts`, which hardcode hex/rgba. All 3 new canvas primitives follow that same established pattern: hardcode hex copied verbatim from `app/globals.css`'s `--color-*` values (`--color-pos:#00D964`, `--color-neg:#FF3B30`, `--color-accent:#FF9F0A`, `--color-info:#3B9CFF`, `--color-text-3:#6B6B6B`), not CSS var strings.
- No raw `fetch` — `lib/api.ts` only (n/a for primitives — no new fetches; `useGexSnapshot.ts` reuses existing `getOptionsGex`).
- AbortController pattern: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup (applies to `useGexSnapshot.ts`, copied unchanged from `OptionsFlowPanel.tsx`'s existing polling effect).
- `style={{}}` banned except chart-container height (no new inline styles introduced by this plan).
- Backend: `asyncio_mode="auto"`, never `@pytest.mark.asyncio`. Python interpreter: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`.
- CORS: `localhost:3000` only (unchanged, no new endpoints).
- Every new primitive follows the established `ISeriesPrimitive` pattern exactly: `attached(param)` captures `chart`/`series`/`requestUpdate`; `updateData(...)` stores data + calls `requestUpdate()`; a `PrimitivePaneView`/`PrimitivePaneRenderer` pair re-reads `chart.timeScale().timeToCoordinate()`/`series.priceToCoordinate()` live inside `draw()`.
- **Phase 156 lesson (binding):** the new `book_snapshot` broadcast must be size- and rate-bounded from the first line of code — capped at `levels` per side (default 20) and throttled to ≥150ms between broadcasts per symbol. Never send unbounded/unthrottled data.
- No dedicated test file for canvas-drawing primitives or for `useGexSnapshot.ts` (matches established convention — `FootprintPrimitive.ts`, `HeatmapPrimitive.ts`, `useOrderflowSocket.ts`, `useOptionsFlowSocket.ts` all have zero tests). Pure data/coordinate functions get unit tests matching `tests/lib/orderflow-data.test.ts` / `tests/lib/orderflow-chart-coords.test.ts` conventions.
- Absorption/large-lot thresholds (`ABSORPTION_DOMINANCE_RATIO = 0.7`, `LARGE_TRADE_MULTIPLIER = 3`, noise-floor `10×`) are first-pass tunable constants, explicitly **not** backtested/tuned in v1 — out of scope.
- Single selected symbol only (matches existing footprint/heatmap behavior) — no multi-symbol COB.
- No show/hide toggle UI for individual layers in v1 — all layers always render when their data is available.

---

### Task 1: Backend — `OrderflowAggregator.latest_book()`

**Files:**
- Modify: `seokminal-multi-venue/orderflow/aggregator.py`
- Test: `seokminal-multi-venue/tests/test_orderflow_aggregator.py`

**Interfaces:**
- Consumes: `orderflow.models.OrderBookSnapshot`, `OrderBookLevel` (existing, unchanged).
- Produces: `OrderflowAggregator.latest_book(book: OrderBookSnapshot, levels: int = 20) -> dict` — return shape `{"type": "book_snapshot", "bids": [{"price": float, "size": float}, ...], "asks": [...]}`, each side sorted best-first (bids descending by price, asks ascending by price), capped at `levels` entries per side, **raw unrounded prices** (unlike footprint/heatmap which round via `_round_price`). Task 2 depends on this exact signature and return shape.

- [ ] **Step 1: Write the failing tests**

Append to `seokminal-multi-venue/tests/test_orderflow_aggregator.py` (file already imports `OrderBookLevel`, `OrderBookSnapshot`, `TradeEvent` at the top — reuse those):

```python
def _level(price, size):
    return OrderBookLevel(price=price, size=size)


def test_latest_book_sorts_best_first_and_caps_each_side():
    agg = OrderflowAggregator()
    book = OrderBookSnapshot(
        symbol="BTC.HL",
        ts=1000.0,
        bids=[_level(99, 1), _level(101, 2), _level(100, 3)],
        asks=[_level(105, 1), _level(103, 2), _level(104, 3)],
    )
    result = agg.latest_book(book, levels=2)
    assert result == {
        "type": "book_snapshot",
        "bids": [{"price": 101, "size": 2}, {"price": 100, "size": 3}],
        "asks": [{"price": 103, "size": 2}, {"price": 104, "size": 3}],
    }


def test_latest_book_uses_raw_unrounded_prices():
    agg = OrderflowAggregator(tick_size=5.0)
    book = OrderBookSnapshot(
        symbol="BTC.HL",
        ts=1000.0,
        bids=[_level(100.37, 1)],
        asks=[_level(100.81, 1)],
    )
    result = agg.latest_book(book)
    assert result["bids"][0]["price"] == 100.37
    assert result["asks"][0]["price"] == 100.81


def test_latest_book_defaults_to_20_levels_per_side():
    agg = OrderflowAggregator()
    book = OrderBookSnapshot(
        symbol="BTC.HL",
        ts=1000.0,
        bids=[_level(100 - i, 1) for i in range(30)],
        asks=[_level(101 + i, 1) for i in range(30)],
    )
    result = agg.latest_book(book)
    assert len(result["bids"]) == 20
    assert len(result["asks"]) == 20
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_aggregator.py -q`
Expected: FAIL — `AttributeError: 'OrderflowAggregator' object has no attribute 'latest_book'`

- [ ] **Step 3: Implement `latest_book`**

Add to `seokminal-multi-venue/orderflow/aggregator.py`, as a new method on `OrderflowAggregator` (place after `on_book_snapshot`, before `snapshot`):

```python
    def latest_book(self, book: OrderBookSnapshot, levels: int = 20) -> dict:
        bids = sorted(book.bids, key=lambda lvl: lvl.price, reverse=True)[:levels]
        asks = sorted(book.asks, key=lambda lvl: lvl.price)[:levels]
        return {
            "type": "book_snapshot",
            "bids": [{"price": lvl.price, "size": lvl.size} for lvl in bids],
            "asks": [{"price": lvl.price, "size": lvl.size} for lvl in asks],
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_aggregator.py -q`
Expected: PASS (all existing + 3 new cases)

- [ ] **Step 5: Commit**

```bash
cd seokminal-multi-venue
git add orderflow/aggregator.py tests/test_orderflow_aggregator.py
git commit -m "feat(orderflow): OrderflowAggregator.latest_book() for COB depth snapshots"
```

---

### Task 2: Backend — throttled `book_snapshot` broadcast in `OrderflowManager`

**Files:**
- Modify: `seokminal-multi-venue/orderflow/manager.py`
- Test: `seokminal-multi-venue/tests/test_orderflow_manager.py`

**Interfaces:**
- Consumes: `OrderflowAggregator.latest_book(book, levels=20) -> dict` (Task 1).
- Produces: `OrderflowManager.__init__(self, adapter_factory=None, now_fn: Callable[[], float] = time.time)` — new `now_fn` constructor parameter (DI for deterministic testing, no fake-clock pattern existed before this task). Book-snapshot messages appear on subscriber queues at most once per 150ms per symbol, additive alongside existing `footprint_delta`/`heatmap_delta`/`status` messages. No router change needed — `api_server/router_orderflow.py`'s `ws_orderflow` already forwards any dict from the queue verbatim via `send_json`.

- [ ] **Step 1: Write the failing tests**

Append to `seokminal-multi-venue/tests/test_orderflow_manager.py`. First, extend the top-of-file imports to add `OrderBookLevel`, `OrderBookSnapshot`:

```python
from orderflow.models import OrderBookLevel, OrderBookSnapshot, TradeEvent
```

(replaces the existing `from orderflow.models import TradeEvent` line — same import statement, one more name.)

Add a book-snapshot helper near `_trade`:

```python
def _book(ts=1000.0, symbol="BTC.HL"):
    return OrderBookSnapshot(
        symbol=symbol,
        ts=ts,
        bids=[OrderBookLevel(price=100.0, size=1.0)],
        asks=[OrderBookLevel(price=101.0, size=1.0)],
    )
```

Add test cases at the end of the file:

```python
async def test_book_snapshot_broadcast_on_first_book_event():
    manager = OrderflowManager(adapter_factory=lambda symbol: _one_shot_stream([_book(ts=1000.0)]))
    queue, _ = manager.subscribe("BTC.HL")

    msgs = []
    for _ in range(2):
        msgs.append(await asyncio.wait_for(queue.get(), timeout=1.0))
    types = {m["type"] for m in msgs}
    assert "book_snapshot" in types
    book_msg = next(m for m in msgs if m["type"] == "book_snapshot")
    assert book_msg["bids"] == [{"price": 100.0, "size": 1.0}]
    assert book_msg["asks"] == [{"price": 101.0, "size": 1.0}]

    manager.unsubscribe("BTC.HL", queue)


async def test_book_snapshot_throttled_within_150ms_window():
    clock = {"t": 1000.0}

    def now_fn():
        return clock["t"]

    manager = OrderflowManager(
        adapter_factory=lambda symbol: _one_shot_stream([_book(ts=1000.0), _book(ts=1000.05)]),
        now_fn=now_fn,
    )
    queue, _ = manager.subscribe("BTC.HL")

    msgs = []
    try:
        while True:
            msgs.append(await asyncio.wait_for(queue.get(), timeout=0.2))
    except asyncio.TimeoutError:
        pass

    book_msgs = [m for m in msgs if m["type"] == "book_snapshot"]
    assert len(book_msgs) == 1  # 두 번째 이벤트는 150ms 이내라 스로틀됨(now_fn이 고정이므로)

    manager.unsubscribe("BTC.HL", queue)


async def test_book_snapshot_broadcast_again_after_throttle_window_elapses():
    clock = {"t": 1000.0}

    def now_fn():
        return clock["t"]

    events = [_book(ts=1000.0), _book(ts=1000.2)]
    call_count = {"n": 0}

    async def stream(symbol):
        for e in events:
            call_count["n"] += 1
            if call_count["n"] == 2:
                clock["t"] = 1000.2  # 150ms 스로틀 윈도우 경과 시뮬레이션
            yield e

    manager = OrderflowManager(adapter_factory=stream, now_fn=now_fn)
    queue, _ = manager.subscribe("BTC.HL")

    msgs = []
    try:
        while True:
            msgs.append(await asyncio.wait_for(queue.get(), timeout=0.2))
    except asyncio.TimeoutError:
        pass

    book_msgs = [m for m in msgs if m["type"] == "book_snapshot"]
    assert len(book_msgs) == 2

    manager.unsubscribe("BTC.HL", queue)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_manager.py -q`
Expected: FAIL — `TypeError: OrderflowManager.__init__() got an unexpected keyword argument 'now_fn'` (and the first new test fails on missing `book_snapshot` type)

- [ ] **Step 3: Implement the throttled broadcast**

Modify `seokminal-multi-venue/orderflow/manager.py`. Add `time` to imports:

```python
import asyncio
import logging
import time
from dataclasses import dataclass, field
```

Add `Callable` to the typing import (new line under existing imports):

```python
from typing import Callable
```

Add a throttle field to `_SymbolWorker`:

```python
@dataclass
class _SymbolWorker:
    task: "asyncio.Task"
    aggregator: OrderflowAggregator
    subscribers: set = field(default_factory=set)
    last_book_broadcast_ts: float = 0.0
```

Add the throttle window constant near the other module constants:

```python
BOOK_SNAPSHOT_THROTTLE_SEC = 0.15
```

Change `OrderflowManager.__init__` to accept `now_fn`:

```python
    def __init__(self, adapter_factory=None, now_fn: Callable[[], float] = time.time) -> None:
        self._adapter_factory = adapter_factory or _default_adapter_factory
        self._now_fn = now_fn
        self._workers: dict[str, _SymbolWorker] = {}
```

Change `_run`'s book-snapshot branch (currently `deltas = aggregator.on_book_snapshot(event)`) to also conditionally append a throttled `book_snapshot` message:

```python
                       if isinstance(event, TradeEvent):
                           deltas = [aggregator.on_trade(event)]
                       else:
                           deltas = aggregator.on_book_snapshot(event)
                           worker = self._workers.get(symbol)
                           now = self._now_fn()
                           if worker is not None and now - worker.last_book_broadcast_ts >= BOOK_SNAPSHOT_THROTTLE_SEC:
                               worker.last_book_broadcast_ts = now
                               deltas = [*deltas, aggregator.latest_book(event)]
                       self._broadcast(symbol, deltas)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_orderflow_manager.py -q`
Expected: PASS (all existing + 3 new cases)

Then run the full backend suite to confirm no regressions:

Run: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
Expected: same pass count as before this task plus 6 new passes (3 in `test_orderflow_aggregator.py` from Task 1, 3 here); pre-existing `test_auth.py` (×3-4) and `test_backtest_happy_path` failures are known-ignorable and unrelated to this change.

- [ ] **Step 5: Commit**

```bash
cd seokminal-multi-venue
git add orderflow/manager.py tests/test_orderflow_manager.py
git commit -m "feat(orderflow): throttled book_snapshot broadcast (150ms/symbol) via now_fn-injectable clock"
```

---

### Task 3: Frontend — `book_snapshot` reducer + `useOrderflowSocket` book field

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-data.ts`
- Modify: `seokminal-dashboard/hooks/useOrderflowSocket.ts`
- Test: `seokminal-dashboard/tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: backend `book_snapshot` message shape from Task 2: `{"type": "book_snapshot", "bids": [{"price": number, "size": number}, ...], "asks": [...]}`.
- Produces: `BookSnapshotMsg` type; `OrderflowState.book: { bids: BookLevel[]; asks: BookLevel[] }`; `applyBookSnapshot(state, msg): OrderflowState` (full replace); `useOrderflowSocket` return value gains `book: { bids: BookLevel[]; asks: BookLevel[] }`. Task 4 (`OrderBookPrimitive`) consumes `state.book`/the hook's `book` field directly.

- [ ] **Step 1: Write the failing tests**

Add to the top import block of `seokminal-dashboard/tests/lib/orderflow-data.test.ts`:

```ts
import {
  applySnapshot,
  applyFootprintDelta,
  applyHeatmapDelta,
  applyBookSnapshot,
  applyOrderflowMessage,
  emptyOrderflowState,
  diffFootprintCells,
  diffHeatmapCells,
  computeFootprintLayout,
  computeHeatmapLayout,
  aggregateHeatmapByCandle,
  MAX_TIME_BUCKETS,
  currencyForSymbol,
} from "../../lib/orderflow-data";
```

Add a new describe block:

```ts
describe("applyBookSnapshot", () => {
  it("full-replaces book state (not a merge) on each snapshot", () => {
    let state = emptyOrderflowState();
    state = applyBookSnapshot(state, {
      type: "book_snapshot",
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 2 }],
    });
    expect(state.book).toEqual({
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 2 }],
    });

    state = applyBookSnapshot(state, {
      type: "book_snapshot",
      bids: [{ price: 99, size: 5 }],
      asks: [],
    });
    expect(state.book).toEqual({ bids: [{ price: 99, size: 5 }], asks: [] });
  });

  it("leaves footprint/heatmap untouched", () => {
    let state = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    state = applyBookSnapshot(state, { type: "book_snapshot", bids: [], asks: [] });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 2, sellVol: 0 });
  });
});

describe("applyOrderflowMessage with book_snapshot", () => {
  it("routes book_snapshot to applyBookSnapshot", () => {
    const next = applyOrderflowMessage(emptyOrderflowState(), {
      type: "book_snapshot",
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 1 }],
    });
    expect(next.book.bids).toEqual([{ price: 100, size: 1 }]);
  });
});

describe("emptyOrderflowState", () => {
  it("starts with an empty book", () => {
    expect(emptyOrderflowState().book).toEqual({ bids: [], asks: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `applyBookSnapshot` not exported, `state.book` undefined

- [ ] **Step 3: Implement**

In `seokminal-dashboard/lib/orderflow-data.ts`, add a `BookLevel` interface and `BookSnapshotMsg` type near the top (after `HeatmapCell`):

```ts
export interface BookLevel {
  price: number;
  size: number;
}

export interface OrderBookState {
  bids: BookLevel[];
  asks: BookLevel[];
}
```

Add `BookSnapshotMsg` to the message union block:

```ts
export interface BookSnapshotMsg {
  type: "book_snapshot";
  bids: BookLevel[];
  asks: BookLevel[];
}
```

Update the delta union:

```ts
export type OrderflowDeltaMsg = FootprintDeltaMsg | HeatmapDeltaMsg | BookSnapshotMsg | StatusMsg;
```

Extend `OrderflowState`:

```ts
export interface OrderflowState {
  footprint: Map<string, FootprintCell>;
  heatmap: Map<string, HeatmapCell>;
  book: OrderBookState;
}
```

Update `emptyOrderflowState`:

```ts
export function emptyOrderflowState(): OrderflowState {
  return { footprint: new Map(), heatmap: new Map(), book: { bids: [], asks: [] } };
}
```

Update `applySnapshot` to preserve the `book` field (REST/WS snapshot payload has no book data yet — Task 2 confirmed a freshly-subscribing client only gets `book_snapshot` on the next live book event, not in the initial `snapshot()`):

```ts
export function applySnapshot(snapshot: OrderflowSnapshot): OrderflowState {
  const footprint = new Map<string, FootprintCell>();
  for (const c of snapshot.footprint) {
    footprint.set(footprintKey(c.bucket_ts, c.price), {
      bucketTs: c.bucket_ts,
      price: c.price,
      buyVol: c.buy_vol,
      sellVol: c.sell_vol,
    });
  }
  const heatmap = new Map<string, HeatmapCell>();
  for (const c of snapshot.heatmap) {
    heatmap.set(heatmapKey(c.ts, c.price), { ts: c.ts, price: c.price, size: c.size });
  }
  return {
    footprint: evictOldestFootprintBuckets(footprint),
    heatmap: evictOldestHeatmapBuckets(heatmap),
    book: { bids: [], asks: [] },
  };
}
```

Add `applyBookSnapshot` after `applyHeatmapDelta`:

```ts
export function applyBookSnapshot(state: OrderflowState, msg: BookSnapshotMsg): OrderflowState {
  return { ...state, book: { bids: msg.bids, asks: msg.asks } };
}
```

Update `applyOrderflowMessage`:

```ts
export function applyOrderflowMessage(state: OrderflowState, msg: OrderflowDeltaMsg): OrderflowState {
  if (msg.type === "footprint_delta") return applyFootprintDelta(state, msg);
  if (msg.type === "heatmap_delta") return applyHeatmapDelta(state, msg);
  if (msg.type === "book_snapshot") return applyBookSnapshot(state, msg);
  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS

- [ ] **Step 5: Expose `book` from `useOrderflowSocket`**

Modify `seokminal-dashboard/hooks/useOrderflowSocket.ts`. Update the import block:

```ts
import {
  applyOrderflowMessage,
  applySnapshot,
  emptyOrderflowState,
  type FootprintCell,
  type HeatmapCell,
  type OrderBookState,
  type OrderflowDeltaMsg,
  type OrderflowSnapshot,
  type OrderflowState,
} from "@/lib/orderflow-data";
```

Update the result interface:

```ts
interface UseOrderflowSocketResult {
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
  connectionState: OrderflowConnectionState;
}
```

Update the return statement at the bottom of `useOrderflowSocket`:

```ts
  return {
    footprint: Array.from(state.footprint.values()),
    heatmap: Array.from(state.heatmap.values()),
    book: state.book,
    connectionState,
  };
```

No other changes needed — `state.book` is already threaded through by the reducer from Step 3, and `isSnapshotMsg`/the `ws.onmessage` handler already route non-snapshot messages through `applyOrderflowMessage`, which now handles `book_snapshot`.

- [ ] **Step 6: Type-check and run full frontend suite**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full existing suite + new cases pass, no new failures

- [ ] **Step 7: Commit**

```bash
cd seokminal-dashboard
git add lib/orderflow-data.ts hooks/useOrderflowSocket.ts tests/lib/orderflow-data.test.ts
git commit -m "feat(orderflow): book_snapshot reducer + expose live order book from useOrderflowSocket"
```

---

### Task 4: Frontend — COB depth inset (`OrderBookPrimitive`)

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-chart-coords.ts`
- Create: `seokminal-dashboard/components/orderflow/OrderBookPrimitive.ts`
- Modify: `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`
- Modify: `seokminal-dashboard/app/orderflow/page.tsx`
- Test: `seokminal-dashboard/tests/lib/orderflow-chart-coords.test.ts`

**Interfaces:**
- Consumes: `OrderBookState` (Task 3), `OrderflowChart`'s existing `onSeriesReady`/primitive-attach pattern (see `HeatmapPrimitive`/`FootprintPrimitive` wiring in `OrderflowChart.tsx`).
- Produces: `bookBarLayout(index: number, maxVisibleSize: number, size: number, chartHeight: number, side: "bid" | "ask", levels: number): { widthFrac: number; yFrac: number } | null` (pure, testable coordinate helper) and `OrderBookPrimitive` class (canvas-only, no dedicated test). `OrderflowChart` gains a `book: OrderBookState` prop.

- [ ] **Step 1: Write the failing test for the layout helper**

Append to `seokminal-dashboard/tests/lib/orderflow-chart-coords.test.ts`. First check its existing import line and extend it — add `bookBarLayout`:

```ts
import { heatmapCellRect, footprintColumnX, footprintCellRect, bookBarLayout } from "../../lib/orderflow-chart-coords";
```

Add:

```ts
describe("bookBarLayout", () => {
  it("scales bar width by size relative to the max visible size", () => {
    const half = bookBarLayout(0, 10, 5, 480, "ask", 20);
    expect(half).not.toBeNull();
    expect(half!.widthFrac).toBeCloseTo(0.5);
  });

  it("returns null for a size of 0", () => {
    expect(bookBarLayout(0, 10, 0, 480, "ask", 20)).toBeNull();
  });

  it("asks stack downward from the top, bids stack upward from the bottom", () => {
    const ask0 = bookBarLayout(0, 10, 5, 480, "ask", 20);
    const ask1 = bookBarLayout(1, 10, 5, 480, "ask", 20);
    expect(ask1!.yFrac).toBeGreaterThan(ask0!.yFrac);

    const bid0 = bookBarLayout(0, 10, 5, 480, "bid", 20);
    const bid1 = bookBarLayout(1, 10, 5, 480, "bid", 20);
    expect(bid1!.yFrac).toBeLessThan(bid0!.yFrac);
  });

  it("clamps widthFrac to 1 when size exceeds maxVisibleSize", () => {
    const over = bookBarLayout(0, 10, 999, 480, "ask", 20);
    expect(over!.widthFrac).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-chart-coords.test.ts`
Expected: FAIL — `bookBarLayout` not exported

- [ ] **Step 3: Implement `bookBarLayout`**

Append to `seokminal-dashboard/lib/orderflow-chart-coords.ts`:

```ts
/**
 * COB(현재 오더북) 사이드 인셋 바 1개의 레이아웃을 차트 플롯 영역 기준 비율(0~1)로 계산.
 * asks는 위에서 아래로, bids는 아래에서 위로 쌓는다(스프레드가 중앙에 오도록).
 * size가 0이면 그릴 게 없으므로 null.
 */
export function bookBarLayout(
  index: number,
  maxVisibleSize: number,
  size: number,
  chartHeight: number,
  side: "bid" | "ask",
  levels: number
): { widthFrac: number; yFrac: number } | null {
  if (size <= 0 || maxVisibleSize <= 0) return null;
  const widthFrac = Math.min(1, size / maxVisibleSize);
  const rowHeight = chartHeight / 2 / levels;
  const yFrac =
    side === "ask"
      ? (index * rowHeight) / chartHeight
      : 1 - ((index + 1) * rowHeight) / chartHeight;
  return { widthFrac, yFrac };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-chart-coords.test.ts`
Expected: PASS

- [ ] **Step 5: Create `OrderBookPrimitive`**

Create `seokminal-dashboard/components/orderflow/OrderBookPrimitive.ts`:

```ts
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { bookBarLayout } from "@/lib/orderflow-chart-coords";
import type { BookLevel, OrderBookState } from "@/lib/orderflow-data";

const INSET_WIDTH_PX = 90;
const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

class OrderBookPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: OrderBookPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { book } = this.primitive;
      if (book.bids.length === 0 && book.asks.length === 0) return;

      const chartHeight = mediaSize.height;
      const chartWidth = mediaSize.width;
      const right = chartWidth;
      const left = chartWidth - INSET_WIDTH_PX;

      const maxVisibleSize = Math.max(
        1,
        ...book.bids.map((l) => l.size),
        ...book.asks.map((l) => l.size)
      );
      const rowHeight = chartHeight / 2 / this.primitive.levels;

      const drawSide = (levels: BookLevel[], side: "bid" | "ask", rgb: string) => {
        levels.slice(0, this.primitive.levels).forEach((lvl, i) => {
          const layout = bookBarLayout(i, maxVisibleSize, lvl.size, chartHeight, side, this.primitive.levels);
          if (!layout) return;
          const barWidth = layout.widthFrac * INSET_WIDTH_PX;
          const y = layout.yFrac * chartHeight;
          ctx.fillStyle = `rgba(${rgb}, 0.35)`;
          ctx.fillRect(right - barWidth, y, barWidth, rowHeight - 1);
        });
      };

      drawSide(book.asks, "ask", NEG_RGB);
      drawSide(book.bids, "bid", POS_RGB);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(left, 0, INSET_WIDTH_PX, chartHeight);
    });
  }
}

class OrderBookPaneView implements IPrimitivePaneView {
  constructor(private primitive: OrderBookPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new OrderBookPaneRenderer(this.primitive);
  }
}

export class OrderBookPrimitive implements ISeriesPrimitive<Time> {
  book: OrderBookState = { bids: [], asks: [] };
  readonly levels = 20;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new OrderBookPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(book: OrderBookState): void {
    this.book = book;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 6: Wire into `OrderflowChart.tsx`**

Modify `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`. Update imports:

```tsx
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { OrderBookPrimitive } from "@/components/orderflow/OrderBookPrimitive";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import type { FootprintCell, HeatmapCell, OrderBookState } from "@/lib/orderflow-data";
```

Update the props interface:

```tsx
interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
}
```

Update the component signature and add a ref + tracking ref, mirroring the existing `heatmap`/`footprint` pattern exactly:

```tsx
export function OrderflowChart({ symbol, footprint, heatmap, book }: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const bookPrimitiveRef = useRef<OrderBookPrimitive | null>(null);
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  const bookRef = useRef(book);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;
  bookRef.current = book;
```

Update the data-refresh effect:

```tsx
  useEffect(() => {
    heatmapPrimitiveRef.current?.updateData(heatmap);
    footprintPrimitiveRef.current?.updateData(footprint);
    bookPrimitiveRef.current?.updateData(book);
  }, [heatmap, footprint, book]);
```

Update `handleSeriesReady`:

```tsx
  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(bp);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
  }
```

- [ ] **Step 7: Pass `book` through `app/orderflow/page.tsx`**

Modify `seokminal-dashboard/app/orderflow/page.tsx`. Update the destructure:

```tsx
  const { footprint, heatmap, book, connectionState } = useOrderflowSocket(symbol);
```

Update the `OrderflowChart` usage:

```tsx
      <OrderflowChart symbol={symbol} footprint={footprint} heatmap={heatmap} book={book} />
```

- [ ] **Step 8: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 9: Commit**

```bash
cd seokminal-dashboard
git add lib/orderflow-chart-coords.ts tests/lib/orderflow-chart-coords.test.ts \
  components/orderflow/OrderBookPrimitive.ts components/orderflow/OrderflowChart.tsx app/orderflow/page.tsx
git commit -m "feat(orderflow): COB depth inset primitive (live bid/ask bars docked to chart edge)"
```

- [ ] **Step 10: Browser visual check**

`npm run dev`, open `/orderflow`, select `BTC.HL`. Confirm a vertical bar inset appears docked to the right edge of the candlestick chart, green bars below the spot area (bids), red bars above (asks), width growing with size. Confirm switching to `NQ` still renders the chart with an empty/thin inset (no book data yet, no crash).

---

### Task 5: Frontend — Iceberg/Large-Lot Tracker (`applyLargeTradeTracking` + `LargeLotPrimitive`)

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-data.ts`
- Create: `seokminal-dashboard/components/orderflow/LargeLotPrimitive.ts`
- Modify: `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`
- Test: `seokminal-dashboard/tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `FootprintDeltaMsg` (existing — already carries one message per individual trade, `delta_vol = trade.size`, confirmed via `orderflow/aggregator.py:on_trade`).
- Produces: `LargeTrade` type; `LargeTradeTrackerState` type; `emptyLargeTradeTracker(): LargeTradeTrackerState`; `applyLargeTradeTracking(tracker: LargeTradeTrackerState, msg: FootprintDeltaMsg): LargeTradeTrackerState`. `OrderflowChart` maintains this tracker internally (fed from the `footprint` prop's deltas — see wiring note in Step 5) and passes `tracker.largeTrades` to `LargeLotPrimitive`.

- [ ] **Step 1: Write the failing tests**

Add to the import block of `seokminal-dashboard/tests/lib/orderflow-data.test.ts`:

```ts
  applyLargeTradeTracking,
  emptyLargeTradeTracker,
```

(inserted alongside the other named imports from `"../../lib/orderflow-data"`.)

Add:

```ts
describe("applyLargeTradeTracking", () => {
  function feedNormalTrades(n: number, size = 1.0) {
    let tracker = emptyLargeTradeTracker();
    for (let i = 0; i < n; i++) {
      tracker = applyLargeTradeTracking(tracker, {
        type: "footprint_delta", bucket_ts: i * 60, price: 100, side: "buy", delta_vol: size,
      });
    }
    return tracker;
  }

  it("does not flag anything before the rolling window has 20 samples", () => {
    const tracker = feedNormalTrades(19, 1.0);
    expect(tracker.largeTrades).toHaveLength(0);
  });

  it("flags a trade more than 3x the rolling median once warmed up", () => {
    let tracker = feedNormalTrades(20, 1.0);
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 2000, price: 105, side: "sell", delta_vol: 10.0,
    });
    expect(tracker.largeTrades).toHaveLength(1);
    expect(tracker.largeTrades[0]).toEqual({ bucketTs: 2000, price: 105, side: "sell", size: 10.0 });
  });

  it("does not flag a trade at or below 3x the rolling median", () => {
    let tracker = feedNormalTrades(20, 1.0);
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 2000, price: 105, side: "buy", delta_vol: 3.0,
    });
    expect(tracker.largeTrades).toHaveLength(0);
  });

  it("caps largeTrades at 50 entries, dropping the oldest", () => {
    let tracker = feedNormalTrades(20, 1.0);
    for (let i = 0; i < 55; i++) {
      tracker = applyLargeTradeTracking(tracker, {
        type: "footprint_delta", bucket_ts: 3000 + i, price: 100, side: "buy", delta_vol: 10.0,
      });
    }
    expect(tracker.largeTrades).toHaveLength(50);
    expect(tracker.largeTrades[0].bucketTs).toBe(3005); // 처음 5개(3000~3004)는 밀려나감
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `applyLargeTradeTracking`/`emptyLargeTradeTracker` not exported

- [ ] **Step 3: Implement**

Append to `seokminal-dashboard/lib/orderflow-data.ts`:

```ts
export interface LargeTrade {
  bucketTs: number;
  price: number;
  side: "buy" | "sell";
  size: number;
}

export interface LargeTradeTrackerState {
  recentSizes: number[];
  largeTrades: LargeTrade[];
}

const ROLLING_WINDOW = 200;
const MIN_WARMUP_SAMPLES = 20;
const LARGE_TRADE_MULTIPLIER = 3;
const MAX_LARGE_TRADES = 50;

export function emptyLargeTradeTracker(): LargeTradeTrackerState {
  return { recentSizes: [], largeTrades: [] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 최근 200건 체결 크기의 이동중앙값 대비 3배 넘는 체결을 "대량 체결"로 표시.
 * 표본 20건 미만(워밍업 전)은 오탐 방지를 위해 아무것도 표시하지 않는다.
 */
export function applyLargeTradeTracking(
  tracker: LargeTradeTrackerState,
  msg: FootprintDeltaMsg
): LargeTradeTrackerState {
  const recentSizes = [...tracker.recentSizes, msg.delta_vol].slice(-ROLLING_WINDOW);
  let largeTrades = tracker.largeTrades;

  if (tracker.recentSizes.length >= MIN_WARMUP_SAMPLES) {
    const m = median(tracker.recentSizes);
    if (m > 0 && msg.delta_vol > m * LARGE_TRADE_MULTIPLIER) {
      largeTrades = [
        ...largeTrades,
        { bucketTs: msg.bucket_ts, price: msg.price, side: msg.side, size: msg.delta_vol },
      ].slice(-MAX_LARGE_TRADES);
    }
  }

  return { recentSizes, largeTrades };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS

- [ ] **Step 5: Create `LargeLotPrimitive`**

Create `seokminal-dashboard/components/orderflow/LargeLotPrimitive.ts`:

```ts
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import type { LargeTrade } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

function radiusFor(size: number, medianSize: number): number {
  if (medianSize <= 0) return 6;
  const scaled = 6 + Math.log2(size / medianSize) * 3;
  return Math.min(24, Math.max(6, scaled));
}

class LargeLotPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: LargeLotPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { trades, medianSize, chart, series } = this.primitive;
      if (trades.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      for (const trade of trades) {
        const col = footprintColumnX(trade.bucketTs, timeToX, barSpacing);
        const y = priceToY(trade.price);
        if (!col || y === null) continue;

        const radius = radiusFor(trade.size, medianSize);
        const rgb = trade.side === "buy" ? POS_RGB : NEG_RGB;
        ctx.beginPath();
        ctx.arc(col.center, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, 0.4)`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.stroke();
      }
    });
  }
}

class LargeLotPaneView implements IPrimitivePaneView {
  constructor(private primitive: LargeLotPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new LargeLotPaneRenderer(this.primitive);
  }
}

export class LargeLotPrimitive implements ISeriesPrimitive<Time> {
  trades: LargeTrade[] = [];
  medianSize = 0;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new LargeLotPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(trades: LargeTrade[], medianSize: number): void {
    this.trades = trades;
    this.medianSize = medianSize;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 6: Wire into `OrderflowChart.tsx`**

`OrderflowChart` currently receives the *materialized* `footprint: FootprintCell[]` array (post-reduction), not individual deltas — the tracker needs raw per-trade deltas. Rather than re-deriving deltas from the materialized array (lossy — repeated trades at the same bucket/price merge), feed the tracker from the same source `page.tsx` already has: extend `useOrderflowSocket` is out of scope for a delta feed (it only exposes materialized state by design, matching the footprint/heatmap pattern). Instead, approximate large-lot detection directly from footprint cell deltas *as they change* between renders, which is sufficient because Bookmap-style iceberg tracking only needs to flag unusually large individual prints, and consecutive same-bucket same-price accumulation from repeated icebergs is itself the signal.

Modify `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`. Add imports:

```tsx
import { LargeLotPrimitive } from "@/components/orderflow/LargeLotPrimitive";
import {
  applyLargeTradeTracking,
  diffFootprintCells,
  emptyLargeTradeTracker,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
```

Add a ref for the previous footprint snapshot (to diff against) and the tracker state, plus the primitive ref, alongside the existing refs:

```tsx
  const largeLotPrimitiveRef = useRef<LargeLotPrimitive | null>(null);
  const prevFootprintRef = useRef<FootprintCell[]>([]);
  const largeTradeTrackerRef = useRef<LargeTradeTrackerState>(emptyLargeTradeTracker());
```

Update the data-refresh effect to diff incoming footprint cells into synthetic per-cell deltas and feed the tracker (a changed cell's `buyVol`/`sellVol` delta approximates the newest trade at that bucket/price — consistent with this component only ever receiving materialized snapshots, never raw per-trade events):

```tsx
  useEffect(() => {
    heatmapPrimitiveRef.current?.updateData(heatmap);
    footprintPrimitiveRef.current?.updateData(footprint);
    bookPrimitiveRef.current?.updateData(book);

    const changed = diffFootprintCells(prevFootprintRef.current, footprint);
    let tracker = largeTradeTrackerRef.current;
    for (const cell of changed) {
      const prevCell = prevFootprintRef.current.find(
        (c) => c.bucketTs === cell.bucketTs && c.price === cell.price
      );
      const buyDelta = cell.buyVol - (prevCell?.buyVol ?? 0);
      const sellDelta = cell.sellVol - (prevCell?.sellVol ?? 0);
      if (buyDelta > 0) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: cell.bucketTs, price: cell.price, side: "buy", delta_vol: buyDelta,
        });
      }
      if (sellDelta > 0) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: cell.bucketTs, price: cell.price, side: "sell", delta_vol: sellDelta,
        });
      }
    }
    largeTradeTrackerRef.current = tracker;
    prevFootprintRef.current = footprint;
    const medianSize =
      tracker.recentSizes.length > 0
        ? [...tracker.recentSizes].sort((a, b) => a - b)[Math.floor(tracker.recentSizes.length / 2)]
        : 0;
    largeLotPrimitiveRef.current?.updateData(tracker.largeTrades, medianSize);
  }, [heatmap, footprint, book]);
```

Update `handleSeriesReady` to attach the new primitive:

```tsx
  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
  }
```

- [ ] **Step 7: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 8: Commit**

```bash
cd seokminal-dashboard
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts \
  components/orderflow/LargeLotPrimitive.ts components/orderflow/OrderflowChart.tsx
git commit -m "feat(orderflow): iceberg/large-lot tracker (bubble markers on outsized prints)"
```

- [ ] **Step 9: Browser visual check**

`npm run dev`, open `/orderflow` on `BTC.HL`, let it run live for a minute or two. Confirm occasional colored circle markers appear on the footprint at large trades (green=buy, red=sell), sized roughly by relative volume. Absence of markers during quiet periods is expected (no large prints yet, or still warming up the 20-sample window).

---

### Task 6: Frontend — CVD sub-pane + per-cell delta numbers

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-data.ts`
- Modify: `seokminal-dashboard/components/orderflow/FootprintPrimitive.ts`
- Modify: `seokminal-dashboard/components/CandlestickChart.tsx`
- Modify: `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`
- Test: `seokminal-dashboard/tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `FootprintCell[]` (existing).
- Produces: `computeCvdSeries(cells: FootprintCell[]): { time: number; value: number }[]` (grouped by `bucketTs`, cumulative sum ascending by time). `CandlestickChart` gains an optional `cvdSeries?: { time: UTCTimestamp; value: number }[]` prop rendered as a histogram sub-pane. `FootprintPrimitive`'s renderer draws a signed delta number below the existing buy/sell numbers.

- [ ] **Step 1: Write the failing test for `computeCvdSeries`**

Add `computeCvdSeries` to the import block of `seokminal-dashboard/tests/lib/orderflow-data.test.ts`.

Add:

```ts
describe("computeCvdSeries", () => {
  it("returns an empty array for no cells", () => {
    expect(computeCvdSeries([])).toEqual([]);
  });

  it("sums buy-sell per bucket and cumulates ascending by time", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 60, price: 100, buyVol: 3, sellVol: 1 }, // net +2
      { bucketTs: 60, price: 101, buyVol: 1, sellVol: 1 }, // net 0 (same bucket, different price)
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 4 },  // net -3 (earlier bucket)
    ];
    const series = computeCvdSeries(cells);
    expect(series).toEqual([
      { time: 0, value: -3 },
      { time: 60, value: -1 }, // -3 + (2 + 0)
    ]);
  });
});
```

(`FootprintCell` is already imported as a type in this test file via the existing type-only usages — if not already imported, add `type FootprintCell` to the import block.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `computeCvdSeries` not exported

- [ ] **Step 3: Implement `computeCvdSeries`**

Append to `seokminal-dashboard/lib/orderflow-data.ts`:

```ts
/** 버킷(캔들)별 (매수량-매도량) 순델타를 시간순 누적합으로 변환 — CVD 서브페인용. */
export function computeCvdSeries(cells: FootprintCell[]): { time: number; value: number }[] {
  const netByBucket = new Map<number, number>();
  for (const c of cells) {
    netByBucket.set(c.bucketTs, (netByBucket.get(c.bucketTs) ?? 0) + (c.buyVol - c.sellVol));
  }
  const buckets = Array.from(netByBucket.keys()).sort((a, b) => a - b);
  let cumulative = 0;
  return buckets.map((time) => {
    cumulative += netByBucket.get(time) as number;
    return { time, value: cumulative };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS

- [ ] **Step 5: Extend `FootprintPrimitive` to draw per-cell delta**

Modify `seokminal-dashboard/components/orderflow/FootprintPrimitive.ts`. Replace the number-drawing loop at the bottom of `draw()`:

```ts
      for (const cell of cells) {
        const col = footprintColumnX(cell.bucketTs, timeToX, barSpacing);
        const y = priceToY(cell.price);
        if (!col || y === null) continue;

        ctx.fillStyle = "#EF4444";
        ctx.textAlign = "right";
        ctx.fillText(cell.sellVol.toFixed(1), col.center - 2, y);

        ctx.fillStyle = "#22C55E";
        ctx.textAlign = "left";
        ctx.fillText(cell.buyVol.toFixed(1), col.center + 2, y);

        const delta = cell.buyVol - cell.sellVol;
        ctx.fillStyle = delta >= 0 ? "#00D964" : "#FF3B30";
        ctx.textAlign = "center";
        ctx.fillText((delta >= 0 ? "+" : "") + delta.toFixed(1), col.center, y + 11);
      }
```

- [ ] **Step 6: Add CVD sub-pane to `CandlestickChart.tsx`**

Modify `seokminal-dashboard/components/CandlestickChart.tsx`. Add `HistogramSeries` to the lightweight-charts import:

```tsx
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
```

Add a `cvdSeries` prop to `CandlestickChartProps`:

```tsx
  /** CVD(누적 볼륨 델타) 서브페인 데이터 — 오더플로우 심볼에서만 전달됨. */
  cvdSeries?: { time: UTCTimestamp; value: number }[];
```

Add it to the component's destructured props:

```tsx
export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specs, cvdSeries, onSeriesReady }: CandlestickChartProps) {
```

Add a ref for the CVD series near `overlaySeriesRef`:

```tsx
  const cvdSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
```

Reset it in the unmount cleanup alongside the other refs:

```tsx
    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = [];
      markersRef.current = null;
      cvdSeriesRef.current = null;
    };
```

In the data-refresh effect, after the existing `specs` block and its pane-stretch-factor correction (right after the `if (paneIdx > 1) { ... }` block), add CVD pane wiring — CVD always takes the *next* available pane index after any spec-driven oscillator panes, tracked by continuing to increment the same `paneIdx` counter:

```tsx
    // ── CVD(누적 볼륨 델타) 서브페인 — 오더플로우 전용, specs 오실레이터 다음 페인 ──
    if (cvdSeries && cvdSeries.length > 0) {
      const cvdPane = paneIdx++;
      const cvdSeriesApi = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: true },
        cvdPane
      );
      let prevValue = 0;
      cvdSeriesApi.setData(
        cvdSeries.map((pt) => {
          const color = pt.value >= prevValue ? "#00D964" : "#FF3B30";
          prevValue = pt.value;
          return { time: pt.time, value: pt.value, color };
        })
      );
      cvdSeriesRef.current = cvdSeriesApi;
    } else if (cvdSeriesRef.current) {
      chart.removeSeries(cvdSeriesRef.current);
      cvdSeriesRef.current = null;
    }

    if (paneIdx > 1) {
      const panes = chart.panes();
      panes[0]?.setStretchFactor(3);
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    }
```

This duplicates the existing `if (paneIdx > 1) { ... }` stretch-factor block — remove the earlier occurrence (the one currently right after the `specs` for-loop) since this new one, placed after CVD wiring, supersedes it and correctly accounts for CVD's pane too. The existing block reads:

```tsx
    // 서브페인이 생기면 가격 페인이 눌리지 않게 전체 높이 보정
    if (paneIdx > 1) {
      const panes = chart.panes();
      panes[0]?.setStretchFactor(3);
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    }
```

Delete that block (it sat right after the `for (const spec of specs ?? []) { ... }` loop) and keep only the copy placed after the new CVD block in this step.

Update the effect's dependency array to include `cvdSeries`:

```tsx
  }, [bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specsKey, cvdSeries]);
```

- [ ] **Step 7: Wire `computeCvdSeries` output from `OrderflowChart.tsx`**

Modify `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`. Add `computeCvdSeries` to the `lib/orderflow-data` import, and compute the series with `useMemo` (avoids recomputing on every unrelated re-render):

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

```tsx
import {
  applyLargeTradeTracking,
  computeCvdSeries,
  diffFootprintCells,
  emptyLargeTradeTracker,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
```

Add inside the component body, near the other derived state:

```tsx
  const cvdSeries = useMemo(
    () => computeCvdSeries(footprint).map((pt) => ({ time: pt.time as UTCTimestamp, value: pt.value })),
    [footprint]
  );
```

This requires `UTCTimestamp` — add it to the lightweight-charts import:

```tsx
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
```

Pass it to `CandlestickChart`:

```tsx
      <CandlestickChart bars={bars} cvdSeries={cvdSeries} onSeriesReady={handleSeriesReady} />
```

- [ ] **Step 8: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 9: Commit**

```bash
cd seokminal-dashboard
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts \
  components/orderflow/FootprintPrimitive.ts components/CandlestickChart.tsx components/orderflow/OrderflowChart.tsx
git commit -m "feat(orderflow): CVD sub-pane + per-cell delta numbers on footprint"
```

- [ ] **Step 10: Browser visual check**

`npm run dev`, open `/orderflow` on `BTC.HL`. Confirm a histogram sub-pane appears below the candles showing cumulative volume delta (green when rising, red when falling). Zoom in on the footprint until numbers show (`barSpacing >= 40`) and confirm a third signed number (delta, colored) appears below each cell's buy/sell pair.

---

### Task 7: Frontend — Absorption highlighting

**Files:**
- Modify: `seokminal-dashboard/lib/orderflow-data.ts`
- Modify: `seokminal-dashboard/components/CandlestickChart.tsx`
- Modify: `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`
- Test: `seokminal-dashboard/tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `FootprintCell[]`, `BarOut[]` (existing), and the rolling-median state from Task 5's `LargeTradeTrackerState` (reused as the noise floor — "if Feature 2's rolling median isn't warmed up, skip" per spec).
- Produces: `detectAbsorption(cells: FootprintCell[], bars: { ts_event: number; open: number; close: number }[], rollingMedian: number): { time: number; side: "buy" | "sell" }[]`. `CandlestickChart` renders these via the existing `createSeriesMarkers`/`markersRef` pattern, merged with (not replacing) trade entry/exit markers.

- [ ] **Step 1: Write the failing tests**

Add `detectAbsorption` to the import block of `seokminal-dashboard/tests/lib/orderflow-data.test.ts`.

Add:

```ts
describe("detectAbsorption", () => {
  const bars = [
    { ts_event: 0, open: 100, close: 100.5 },   // 60s bucket in ns: 0
    { ts_event: 60_000_000_000, open: 100.5, close: 100.2 }, // bucket 60
  ];

  it("flags sell-dominant absorption when price fails to drop (close >= open)", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 20 }, // sell dominance 20/21 = 95%
    ];
    const result = detectAbsorption(cells, bars, 1.0); // total 21 >= 10x median(1.0)
    expect(result).toEqual([{ time: 0, side: "sell" }]);
  });

  it("flags buy-dominant absorption when price fails to rise (close <= open)", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 60, price: 100, buyVol: 20, sellVol: 1 }, // buy dominance, bar closes down
    ];
    const result = detectAbsorption(cells, bars, 1.0);
    expect(result).toEqual([{ time: 60, side: "buy" }]);
  });

  it("does not flag when dominant side pushed price the same direction (no absorption)", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 20, sellVol: 1 }, // buy-dominant, and close > open (price DID rise)
    ];
    expect(detectAbsorption(cells, bars, 1.0)).toEqual([]);
  });

  it("does not flag when dominance ratio is below 70%", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 8, sellVol: 6 }, // 8/14 = 57%
    ];
    expect(detectAbsorption(cells, bars, 1.0)).toEqual([]);
  });

  it("does not flag when total volume is below the 10x noise floor", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 0.5, sellVol: 5 }, // dominance ok, but total 5.5 < 10x median(1.0)=10
    ];
    expect(detectAbsorption(cells, bars, 1.0)).toEqual([]);
  });

  it("fails closed (returns []) when rollingMedian is 0 (not warmed up)", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 20 },
    ];
    expect(detectAbsorption(cells, bars, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `detectAbsorption` not exported

- [ ] **Step 3: Implement `detectAbsorption`**

Append to `seokminal-dashboard/lib/orderflow-data.ts`:

```ts
const ABSORPTION_DOMINANCE_RATIO = 0.7;
const ABSORPTION_NOISE_FLOOR_MULTIPLIER = 10;

/**
 * 캔들(바) 하나에서 우세한 매수/매도 물량이 가격을 밀어내지 못한 경우(흡수)를 표시.
 * rollingMedian(대량체결 트래커의 이동중앙값, Feature 2 재사용)이 0이면 워밍업 전이므로
 * fail closed — 오탐 방지를 위해 아무것도 표시하지 않는다.
 */
export function detectAbsorption(
  cells: FootprintCell[],
  bars: { ts_event: number; open: number; close: number }[],
  rollingMedian: number
): { time: number; side: "buy" | "sell" }[] {
  if (rollingMedian <= 0) return [];

  const barByBucket = new Map(bars.map((b) => [Math.floor(b.ts_event / 1e9), b]));
  const totalsByBucket = new Map<number, { buy: number; sell: number }>();
  for (const c of cells) {
    const t = totalsByBucket.get(c.bucketTs) ?? { buy: 0, sell: 0 };
    t.buy += c.buyVol;
    t.sell += c.sellVol;
    totalsByBucket.set(c.bucketTs, t);
  }

  const noiseFloor = rollingMedian * ABSORPTION_NOISE_FLOOR_MULTIPLIER;
  const results: { time: number; side: "buy" | "sell" }[] = [];

  const buckets = Array.from(totalsByBucket.keys()).sort((a, b) => a - b);
  for (const bucketTs of buckets) {
    const { buy, sell } = totalsByBucket.get(bucketTs) as { buy: number; sell: number };
    const total = buy + sell;
    if (total < noiseFloor) continue;

    const bar = barByBucket.get(bucketTs);
    if (!bar) continue;

    const sellRatio = sell / total;
    const buyRatio = buy / total;

    if (sellRatio >= ABSORPTION_DOMINANCE_RATIO && bar.close >= bar.open) {
      results.push({ time: bucketTs, side: "sell" });
    } else if (buyRatio >= ABSORPTION_DOMINANCE_RATIO && bar.close <= bar.open) {
      results.push({ time: bucketTs, side: "buy" });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd seokminal-dashboard && npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS

- [ ] **Step 5: Render absorption markers in `CandlestickChart.tsx`**

Modify `seokminal-dashboard/components/CandlestickChart.tsx`. Add an `absorptionMarkers` prop:

```tsx
  /** 흡수(absorption) 캔들 — 우세 물량이 가격을 못 밀어낸 지점. 오더플로우 심볼에서만 전달됨. */
  absorptionMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
```

Add it to the destructured props:

```tsx
export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specs, cvdSeries, absorptionMarkers, onSeriesReady }: CandlestickChartProps) {
```

Modify the existing markers block so absorption markers merge with trade markers instead of only running when `trades.length > 0`:

```tsx
    const tradeMarkers: SeriesMarker<UTCTimestamp>[] = [];
    for (const t of trades) {
      if (t.entry_ts_ns) {
        tradeMarkers.push({
          time: Math.floor(t.entry_ts_ns / 1e9) as UTCTimestamp,
          position: "belowBar",
          color: "#22C55E",
          shape: "arrowUp",
          text: `BUY ${t.entry_price.toFixed(2)}`,
        });
      }
      if (t.exit_ts_ns && t.exit_price != null) {
        tradeMarkers.push({
          time: Math.floor(t.exit_ts_ns / 1e9) as UTCTimestamp,
          position: "aboveBar",
          color: "#EF4444",
          shape: "arrowDown",
          text: `SELL ${t.exit_price.toFixed(2)}`,
        });
      }
    }

    const absorptionMarkerList: SeriesMarker<UTCTimestamp>[] = (absorptionMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: "#3B9CFF",
      shape: m.side === "buy" ? "arrowUp" : "arrowDown",
      text: "흡수",
    }));

    const allMarkers = [...tradeMarkers, ...absorptionMarkerList].sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
    if (allMarkers.length > 0) {
      if (markersRef.current) markersRef.current.setMarkers(allMarkers);
      else markersRef.current = createSeriesMarkers(candleSeries, allMarkers);
    } else if (markersRef.current) {
      markersRef.current.setMarkers([]);
    }
```

This replaces the existing block that starts with `if (trades.length > 0) { const markers: SeriesMarker<UTCTimestamp>[] = []; ... } else if (markersRef.current) { markersRef.current.setMarkers([]); }`.

Update the effect's dependency array:

```tsx
  }, [bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specsKey, cvdSeries, absorptionMarkers]);
```

- [ ] **Step 6: Wire `detectAbsorption` from `OrderflowChart.tsx`**

Modify `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`. Add `detectAbsorption` to the `lib/orderflow-data` import.

Compute the rolling median once per data-refresh (mirroring Step 6 of Task 5, which already computes `medianSize` inline in the effect — hoist it to a ref so it's available outside that effect for the memo below):

```tsx
  const medianSizeRef = useRef(0);
```

Inside the existing data-refresh `useEffect` (from Task 5), after `largeTradeTrackerRef.current = tracker;`, update:

```tsx
    largeTradeTrackerRef.current = tracker;
    prevFootprintRef.current = footprint;
    const medianSize =
      tracker.recentSizes.length > 0
        ? [...tracker.recentSizes].sort((a, b) => a - b)[Math.floor(tracker.recentSizes.length / 2)]
        : 0;
    medianSizeRef.current = medianSize;
    largeLotPrimitiveRef.current?.updateData(tracker.largeTrades, medianSize);
```

Add a memoized absorption computation:

```tsx
  const absorptionMarkers = useMemo(
    () => detectAbsorption(footprint, bars, medianSizeRef.current).map((m) => ({
      time: m.time as UTCTimestamp,
      side: m.side,
    })),
    [footprint, bars]
  );
```

Pass it to `CandlestickChart`:

```tsx
      <CandlestickChart bars={bars} cvdSeries={cvdSeries} absorptionMarkers={absorptionMarkers} onSeriesReady={handleSeriesReady} />
```

- [ ] **Step 7: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 8: Commit**

```bash
cd seokminal-dashboard
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts \
  components/CandlestickChart.tsx components/orderflow/OrderflowChart.tsx
git commit -m "feat(orderflow): absorption highlighting (dominant volume that failed to move price)"
```

- [ ] **Step 9: Browser visual check**

`npm run dev`, open `/orderflow` on `BTC.HL`. Confirm blue up/down arrow markers with "흡수" label occasionally appear on candles (may take a while live — this is inherently a rare pattern). Confirm chart doesn't crash/flicker when `absorptionMarkers` is empty (typical case).

---

### Task 8: Frontend — Extract `useGexSnapshot` hook (refactor)

**Files:**
- Create: `seokminal-dashboard/hooks/useGexSnapshot.ts`
- Modify: `seokminal-dashboard/components/orderflow/OptionsFlowPanel.tsx`

**Interfaces:**
- Consumes: `getOptionsGex(currency, signal)` from `lib/api.ts` (existing, unchanged).
- Produces: `useGexSnapshot(currency: string): { gex: GexSnapshot | null; isStale: boolean }`. Task 9's `GexLevelsPrimitive` wiring in `OrderflowChart.tsx` consumes this same hook. Pure extraction — no behavior change to `OptionsFlowPanel`.

This task has no new automated tests (matches the established convention that `useOrderflowSocket.ts`/`useOptionsFlowSocket.ts` have none) — verification is the unchanged existing test suite passing plus a browser check that `OptionsFlowPanel`'s behavior is bit-for-bit identical.

- [ ] **Step 1: Create `useGexSnapshot.ts`**

Create `seokminal-dashboard/hooks/useGexSnapshot.ts`, moving the polling `useEffect` and stale-check logic out of `OptionsFlowPanel.tsx` verbatim:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { getOptionsGex, type GexSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

interface UseGexSnapshotResult {
  gex: GexSnapshot | null;
  isStale: boolean;
}

/** currency(BTC/ETH)의 스트라이크별 GEX 스냅샷을 60초마다 폴링. 실패 시 마지막 값 유지. */
export function useGexSnapshot(currency: string): UseGexSnapshotResult {
  const [gex, setGex] = useState<GexSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
        .catch(() => {
          // 일시적 폴링 실패는 조용히 무시 — 마지막 캐시값(gex)을 그대로 유지한다.
          // (백엔드 orderflow/gex.py의 _cache가 upstream 실패 시 마지막 값을 보존하는 것과 동일한 동작)
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

  const isStale = gex != null && Date.now() - gex.updated_at * 1000 > 5 * 60_000;

  return { gex, isStale };
}
```

- [ ] **Step 2: Refactor `OptionsFlowPanel.tsx` to consume the hook**

Modify `seokminal-dashboard/components/orderflow/OptionsFlowPanel.tsx`. Replace the imports:

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GexSnapshot } from "@/lib/api";
import { useOptionsFlowSocket } from "@/hooks/useOptionsFlowSocket";
import { useGexSnapshot } from "@/hooks/useGexSnapshot";
```

(`getOptionsGex` and `useState` are no longer used directly in this file — removed.)

Replace the component body's data-fetching section. Delete the `const [gex, setGex] = useState<GexSnapshot | null>(null);`, `const abortRef = useRef<AbortController | null>(null);`, the entire polling `useEffect`, and the `const isStale = ...` line. Replace with:

```tsx
export function OptionsFlowPanel({ currency }: OptionsFlowPanelProps) {
  const { gex, isStale } = useGexSnapshot(currency);
  const { trades, connectionState } = useOptionsFlowSocket(currency);

  return (
```

The rest of the JSX (the `<div className="rounded-lg border...">...` return block) stays byte-for-byte identical — it already only reads `gex`, `isStale`, `trades`, `connectionState`, `currency`.

- [ ] **Step 3: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors (confirms `GexChart` component below — unaffected — still resolves `GexSnapshot` type correctly, since it's still imported for that usage)

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 4: Commit**

```bash
cd seokminal-dashboard
git add hooks/useGexSnapshot.ts components/orderflow/OptionsFlowPanel.tsx
git commit -m "refactor(orderflow): extract useGexSnapshot hook from OptionsFlowPanel (shared with chart GEX levels)"
```

- [ ] **Step 5: Browser visual check**

`npm run dev`, open `/orderflow` on `BTC.HL`. Confirm the GEX panel below the chart looks and behaves exactly as before this refactor (bar chart renders, spot dashed line, options trade ticker, stale badge logic unchanged).

---

### Task 9: Frontend — GEX levels on the main chart (`GexLevelsPrimitive`)

**Files:**
- Create: `seokminal-dashboard/components/orderflow/GexLevelsPrimitive.ts`
- Modify: `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`

**Interfaces:**
- Consumes: `useGexSnapshot(currency)` (Task 8), `currencyForSymbol(symbol)` (existing, `lib/orderflow-data.ts`).
- Produces: `GexLevelsPrimitive` class — horizontal strike lines with the max-|net_gex| strike ("gamma wall") highlighted.

No dedicated test file for this primitive (canvas-drawing primitives are untested per Global Constraints).

- [ ] **Step 1: Create `GexLevelsPrimitive`**

Create `seokminal-dashboard/components/orderflow/GexLevelsPrimitive.ts`:

```ts
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import type { GexLevel } from "@/lib/api";

const ACCENT = "255, 159, 10"; // --color-accent #FF9F0A
const TEXT_3 = "107, 107, 107"; // --color-text-3 #6B6B6B

class GexLevelsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: GexLevelsPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, series } = this.primitive;
      if (levels.length === 0) return;

      const maxAbs = Math.max(1, ...levels.map((lv) => Math.abs(lv.net_gex)));
      const wallStrike = levels.reduce((best, lv) =>
        Math.abs(lv.net_gex) > Math.abs(best.net_gex) ? lv : best
      ).strike;

      for (const lv of levels) {
        const y = series.priceToCoordinate(lv.strike);
        if (y === null) continue;

        const intensity = Math.abs(lv.net_gex) / maxAbs;
        const isWall = lv.strike === wallStrike;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mediaSize.width, y);
        if (isWall) {
          ctx.strokeStyle = `rgba(${ACCENT}, 0.9)`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = `rgba(${TEXT_3}, ${0.1 + intensity * 0.3})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
}

class GexLevelsPaneView implements IPrimitivePaneView {
  constructor(private primitive: GexLevelsPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new GexLevelsPaneRenderer(this.primitive);
  }
}

export class GexLevelsPrimitive implements ISeriesPrimitive<Time> {
  levels: GexLevel[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new GexLevelsPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(levels: GexLevel[]): void {
    this.levels = levels;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

Note: `priceToCoordinate` naturally returns `null` for strikes outside the visible price range — satisfies the spec's "only draw strikes within the visible range" requirement with no extra filtering code needed.

- [ ] **Step 2: Wire into `OrderflowChart.tsx`**

Modify `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`. Add imports:

```tsx
import { GexLevelsPrimitive } from "@/components/orderflow/GexLevelsPrimitive";
import { useGexSnapshot } from "@/hooks/useGexSnapshot";
import {
  applyLargeTradeTracking,
  computeCvdSeries,
  currencyForSymbol,
  detectAbsorption,
  diffFootprintCells,
  emptyLargeTradeTracker,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
```

Add inside the component body:

```tsx
  const gexLevelsPrimitiveRef = useRef<GexLevelsPrimitive | null>(null);
  const currency = currencyForSymbol(symbol);
  const { gex } = useGexSnapshot(currency ?? "");
  const gexRef = useRef(gex);
  gexRef.current = gex;
```

`useGexSnapshot` requires a non-null `currency` string arg by its signature from Task 8 — passing `""` when `currency` is null is safe: `getOptionsGex("", signal)` would 404, but the primitive only renders when `gex` has levels, and an empty-string currency never resolves BTC/ETH data, so no incorrect levels are ever drawn for non-crypto symbols. Guard the primitive update instead of the hook call, in the effect below.

Add a new effect to push `gex` into the primitive whenever it changes or the symbol's currency changes:

```tsx
  useEffect(() => {
    if (currency && gex) {
      gexLevelsPrimitiveRef.current?.updateData(gex.levels);
    } else {
      gexLevelsPrimitiveRef.current?.updateData([]);
    }
  }, [currency, gex]);
```

Update `handleSeriesReady`:

```tsx
  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    const gp = new GexLevelsPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    series.attachPrimitive(gp);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    gp.updateData(currency && gexRef.current ? gexRef.current.levels : []);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
    gexLevelsPrimitiveRef.current = gp;
  }
```

- [ ] **Step 3: Type-check and full test run**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: no errors

Run: `cd seokminal-dashboard && npx vitest run`
Expected: full suite passes, no new failures

- [ ] **Step 4: Commit**

```bash
cd seokminal-dashboard
git add components/orderflow/GexLevelsPrimitive.ts components/orderflow/OrderflowChart.tsx
git commit -m "feat(orderflow): GEX strike levels overlaid on main chart, gamma wall highlighted"
```

- [ ] **Step 5: Browser visual check**

`npm run dev`, open `/orderflow` on `BTC.HL`. Confirm faint horizontal lines appear at option strike prices within the visible candle range, with one distinctly thicker dashed orange line at the max-|GEX| strike (the gamma wall). Switch to `NQ` (non-crypto) and confirm the lines disappear (no `currency`, no GEX data). Confirm this doesn't visually conflict with the heatmap (`zOrder: "bottom"` on both — GEX lines and heatmap coexist under the footprint/COB/large-lot layers).

---

## Final Verification

After all 9 tasks: run both full suites once more from repo roots.

```bash
cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
cd seokminal-dashboard && npx vitest run && npx tsc --noEmit
```

Then do one full end-to-end browser pass on `/orderflow` with `BTC.HL` selected, live for a few minutes, confirming all 5 features render together without visual collision or console errors: COB inset, iceberg bubbles, CVD sub-pane + per-cell delta, absorption markers (may not fire in a short window), GEX strike lines.
