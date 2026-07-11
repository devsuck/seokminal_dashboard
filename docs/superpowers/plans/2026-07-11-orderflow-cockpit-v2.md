# Orderflow Cockpit v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 5 missing Bookmap-parity features (Volume Profile SVP+CVP, Iceberg refill detector, Stop-run detector, Book%/Volume% imbalance bar, COB numeric ladder) on the `/orderflow` cockpit, per `docs/superpowers/specs/2026-07-11-orderflow-cockpit-v2-design.md`.

**Architecture:** All 5 features are pure-function derivations from data already flowing to the client (`footprint`, `book`) — zero backend changes. New pure functions land in `lib/orderflow-data.ts` and a new column-layout helper in `lib/orderflow-chart-coords.ts`; new visuals are two new canvas `ISeriesPrimitive`s (`VolumeProfilePrimitive`, `ImbalanceBarPrimitive`) plus extensions to the existing `OrderBookPrimitive` (iceberg highlight + numeric ladder) and `CandlestickChart` (stop-run markers). `OrderflowChart.tsx` wires everything together.

**Tech Stack:** No new dependencies. Raw Canvas 2D via `lightweight-charts`' `ISeriesPrimitive` — same pattern as `FootprintPrimitive.ts`/`HeatmapPrimitive.ts`/`OrderBookPrimitive.ts`.

## Global Constraints

- Canvas primitives use hardcoded `rgb(...)`/`rgba(...)` color strings with a `// --color-X #HEX` comment noting the matching design token (existing convention in `OrderBookPrimitive.ts`/`HeatmapPrimitive.ts` — canvas `fillStyle` cannot consume CSS custom properties directly).
- `style={{}}` forbidden in JSX (no JSX changes in this plan besides a new prop pass-through).
- Follow the exact existing primitive pattern: class implements `ISeriesPrimitive<Time>`, `attached()` captures `chart`/`series`/`requestUpdate`, `updateData()` stores data and calls `requestUpdate()`, `draw()` re-reads live `timeToCoordinate`/`priceToCoordinate` every repaint.
- No new WebSocket message types, no backend/`orderflow/aggregator.py`/`orderflow/manager.py` changes.
- New canvas primitives (`VolumeProfilePrimitive.ts`, `ImbalanceBarPrimitive.ts`) get no dedicated unit test — matches existing convention (`FootprintPrimitive.ts` etc. are untested; coordinate/aggregation math is tested via the pure functions it calls). Pure functions in `lib/orderflow-data.ts` and `lib/orderflow-chart-coords.ts` DO get unit tests — matches existing convention for those files.
- Fail-closed philosophy for new detectors: `detectIcebergLevels`/`detectStopRuns` return `[]` when `rollingMedian <= 0` (cold start), matching `detectAbsorption`.
- Test commands: `npm test -- <file>` for targeted runs, `npm test` for full suite, `npx tsc --noEmit` for type-checking — run from `seokminal-dashboard/`.

---

### Task 1: `computeVolumeProfile` (Volume Profile data layer)

**Files:**
- Modify: `lib/orderflow-data.ts` (append to end of file)
- Test: `tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Produces: `SVP_WINDOW_SEC: number`, `interface VolumeProfileLevel { price: number; buyVol: number; sellVol: number }`, `function computeVolumeProfile(cells: FootprintCell[], sinceTs?: number): VolumeProfileLevel[]`

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/orderflow-data.test.ts`. First add `computeVolumeProfile` and `type VolumeProfileLevel` to the existing import block (the `import { ... } from "../../lib/orderflow-data";` at the top):

```typescript
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
  applyLargeTradeTracking,
  emptyLargeTradeTracker,
  computeCvdSeries,
  detectAbsorption,
  computeVolumeProfile,
  type FootprintCell,
  type VolumeProfileLevel,
} from "../../lib/orderflow-data";
```

Then append this block at the end of the file:

```typescript
describe("computeVolumeProfile", () => {
  it("sums buyVol/sellVol per price across all cells with no filter", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 3, sellVol: 1 },
      { bucketTs: 60, price: 100, buyVol: 2, sellVol: 0 },
      { bucketTs: 60, price: 101, buyVol: 0, sellVol: 5 },
    ];
    const result = computeVolumeProfile(cells);
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { price: 100, buyVol: 5, sellVol: 1 },
        { price: 101, buyVol: 0, sellVol: 5 },
      ])
    );
  });

  it("filters cells before sinceTs when given", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 3, sellVol: 1 },
      { bucketTs: 60, price: 100, buyVol: 2, sellVol: 0 },
    ];
    const result: VolumeProfileLevel[] = computeVolumeProfile(cells, 60);
    expect(result).toEqual([{ price: 100, buyVol: 2, sellVol: 0 }]);
  });

  it("returns an empty array for no cells", () => {
    expect(computeVolumeProfile([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderflow-data`
Expected: FAIL — `computeVolumeProfile is not a function` (or TS compile error, since it's not exported yet)

- [ ] **Step 3: Write the implementation**

Append to `lib/orderflow-data.ts`:

```typescript
export const SVP_WINDOW_SEC = 1800;

export interface VolumeProfileLevel {
  price: number;
  buyVol: number;
  sellVol: number;
}

/** 가격대별 누적 매수/매도 체결량. sinceTs 없으면 보유 중인 footprint 전체(CVP), 있으면 그 이후만(SVP). */
export function computeVolumeProfile(cells: FootprintCell[], sinceTs?: number): VolumeProfileLevel[] {
  const filtered = sinceTs === undefined ? cells : cells.filter((c) => c.bucketTs >= sinceTs);
  const byPrice = new Map<number, VolumeProfileLevel>();
  for (const c of filtered) {
    const existing = byPrice.get(c.price) ?? { price: c.price, buyVol: 0, sellVol: 0 };
    existing.buyVol += c.buyVol;
    existing.sellVol += c.sellVol;
    byPrice.set(c.price, existing);
  }
  return Array.from(byPrice.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderflow-data`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts
git commit -m "feat: add computeVolumeProfile for SVP/CVP volume profile"
```

---

### Task 2: Extend `LargeTradeTrackerState` with `recentSides` + `computeImbalance`

**Files:**
- Modify: `lib/orderflow-data.ts`
- Test: `tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `OrderBookState` (existing), `FootprintDeltaMsg` (existing)
- Produces: `LargeTradeTrackerState.recentSides: { side: "buy" | "sell"; size: number }[]`, `function computeImbalance(book: OrderBookState, tracker: LargeTradeTrackerState): { bookBidPct: number; volBuyPct: number } | null`

- [ ] **Step 1: Write the failing tests**

Add `computeImbalance` and `type LargeTradeTrackerState`, `type OrderBookState` to the top import block in `tests/lib/orderflow-data.test.ts`:

```typescript
  computeVolumeProfile,
  computeImbalance,
  type FootprintCell,
  type VolumeProfileLevel,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "../../lib/orderflow-data";
```

Append to the end of the file:

```typescript
describe("applyLargeTradeTracking recentSides", () => {
  it("tracks side alongside size for each trade", () => {
    let tracker = emptyLargeTradeTracker();
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 60, price: 100, side: "sell", delta_vol: 3,
    });
    expect(tracker.recentSides).toEqual([
      { side: "buy", size: 2 },
      { side: "sell", size: 3 },
    ]);
  });
});

describe("computeImbalance", () => {
  function trackerWith(sides: { side: "buy" | "sell"; size: number }[]): LargeTradeTrackerState {
    return { recentSizes: [], recentSides: sides, largeTrades: [] };
  }

  it("computes book bid% and recent-trade buy% ratios", () => {
    const book: OrderBookState = {
      bids: [{ price: 100, size: 6 }],
      asks: [{ price: 101, size: 2 }],
      venues: [],
    };
    const tracker = trackerWith([{ side: "buy", size: 3 }, { side: "sell", size: 1 }]);
    expect(computeImbalance(book, tracker)).toEqual({ bookBidPct: 0.75, volBuyPct: 0.75 });
  });

  it("returns null when the book has no resting size on either side", () => {
    const book: OrderBookState = { bids: [], asks: [], venues: [] };
    const tracker = trackerWith([{ side: "buy", size: 3 }]);
    expect(computeImbalance(book, tracker)).toBeNull();
  });

  it("returns null when there are no recent trades", () => {
    const book: OrderBookState = {
      bids: [{ price: 100, size: 6 }],
      asks: [{ price: 101, size: 2 }],
      venues: [],
    };
    expect(computeImbalance(book, emptyLargeTradeTracker())).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderflow-data`
Expected: FAIL — `computeImbalance is not a function`, and `recentSides` assertions fail (`undefined`)

- [ ] **Step 3: Write the implementation**

In `lib/orderflow-data.ts`, modify the `LargeTradeTrackerState` interface:

```typescript
export interface LargeTradeTrackerState {
  recentSizes: number[];
  recentSides: { side: "buy" | "sell"; size: number }[];
  largeTrades: LargeTrade[];
}
```

Modify `emptyLargeTradeTracker`:

```typescript
export function emptyLargeTradeTracker(): LargeTradeTrackerState {
  return { recentSizes: [], recentSides: [], largeTrades: [] };
}
```

In `applyLargeTradeTracking`, change the final two lines (leave everything above them, including the large-trade-flagging block, untouched):

```typescript
  const recentSizes = [...tracker.recentSizes, msg.delta_vol].slice(-ROLLING_WINDOW);
  const recentSides = [...tracker.recentSides, { side: msg.side, size: msg.delta_vol }].slice(-ROLLING_WINDOW);

  return { recentSizes, recentSides, largeTrades };
```

Append `computeImbalance` after `applyLargeTradeTracking`:

```typescript
/** 현재 COB 매수/매도 잔량 비율(book) + 최근 체결 매수/매도 비율(volume) — 임밸런스 바용. */
export function computeImbalance(
  book: OrderBookState,
  tracker: LargeTradeTrackerState
): { bookBidPct: number; volBuyPct: number } | null {
  const bidSum = book.bids.reduce((s, l) => s + l.size, 0);
  const askSum = book.asks.reduce((s, l) => s + l.size, 0);
  const buyVol = tracker.recentSides.filter((t) => t.side === "buy").reduce((s, t) => s + t.size, 0);
  const sellVol = tracker.recentSides.filter((t) => t.side === "sell").reduce((s, t) => s + t.size, 0);
  if (bidSum + askSum <= 0 || buyVol + sellVol <= 0) return null;
  return { bookBidPct: bidSum / (bidSum + askSum), volBuyPct: buyVol / (buyVol + sellVol) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderflow-data`
Expected: PASS (full file — this also re-verifies the pre-existing `applyLargeTradeTracking` tests still pass unchanged)

- [ ] **Step 5: Commit**

```bash
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts
git commit -m "feat: track trade side in LargeTradeTrackerState, add computeImbalance"
```

---

### Task 3: `detectIcebergLevels`

**Files:**
- Modify: `lib/orderflow-data.ts`
- Test: `tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `VolumeProfileLevel[]` (Task 1), `OrderBookState`/`BookLevel` (existing)
- Produces: `interface IcebergLevel { price: number; side: "bid" | "ask"; ratio: number }`, `function detectIcebergLevels(volumeProfile: VolumeProfileLevel[], book: OrderBookState, rollingMedian: number): IcebergLevel[]`

- [ ] **Step 1: Write the failing tests**

Add `detectIcebergLevels` to the import block in `tests/lib/orderflow-data.test.ts`:

```typescript
  computeVolumeProfile,
  computeImbalance,
  detectIcebergLevels,
  type FootprintCell,
  type VolumeProfileLevel,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "../../lib/orderflow-data";
```

Append to the end of the file:

```typescript
describe("detectIcebergLevels", () => {
  it("flags a price whose cumulative traded volume far exceeds current resting size", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 80, sellVol: 20 }]; // traded 100
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [] };
    // rollingMedian=1.0 -> noiseFloor=20; traded 100 >= 20; ratio 100/10=10 >= 5x threshold
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([{ price: 100, side: "bid", ratio: 10 }]);
  });

  it("does not flag when traded volume at that price is below the noise floor", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 101, buyVol: 5, sellVol: 5 }]; // traded 10
    const book: OrderBookState = { bids: [], asks: [{ price: 101, size: 1 }], venues: [] };
    // noiseFloor = 1.0 * 20 = 20; traded 10 < 20
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([]);
  });

  it("does not flag when the refill ratio is below the threshold", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 30, sellVol: 0 }]; // traded 30
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [] };
    // noiseFloor=20, traded 30>=20 passes floor, but ratio 30/10=3 < 5x threshold
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([]);
  });

  it("fails closed (returns []) when rollingMedian is 0 (not warmed up)", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 80, sellVol: 20 }];
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [] };
    expect(detectIcebergLevels(volumeProfile, book, 0)).toEqual([]);
  });

  it("checks both bid and ask sides independently", () => {
    const volumeProfile: VolumeProfileLevel[] = [
      { price: 100, buyVol: 80, sellVol: 20 }, // traded 100
      { price: 105, buyVol: 10, sellVol: 90 }, // traded 100
    ];
    const book: OrderBookState = {
      bids: [{ price: 100, size: 10 }],
      asks: [{ price: 105, size: 10 }],
      venues: [],
    };
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual(
      expect.arrayContaining([
        { price: 100, side: "bid", ratio: 10 },
        { price: 105, side: "ask", ratio: 10 },
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderflow-data`
Expected: FAIL — `detectIcebergLevels is not a function`

- [ ] **Step 3: Write the implementation**

Append to `lib/orderflow-data.ts`:

```typescript
const ICEBERG_REFILL_RATIO = 5;
const ICEBERG_NOISE_FLOOR_MULTIPLIER = 20;

export interface IcebergLevel {
  price: number;
  side: "bid" | "ask";
  ratio: number;
}

/**
 * 어떤 가격에서 누적 체결량(volumeProfile)이 현재 COB 잔량(book)보다 훨씬 많으면
 * 반복 리필된 숨은 물량(iceberg)으로 추정한다. rollingMedian<=0(워밍업 전)이면 fail closed.
 */
export function detectIcebergLevels(
  volumeProfile: VolumeProfileLevel[],
  book: OrderBookState,
  rollingMedian: number
): IcebergLevel[] {
  if (rollingMedian <= 0) return [];
  const profileByPrice = new Map(volumeProfile.map((v) => [v.price, v.buyVol + v.sellVol]));
  const noiseFloor = rollingMedian * ICEBERG_NOISE_FLOOR_MULTIPLIER;
  const results: IcebergLevel[] = [];
  const checkSide = (levels: BookLevel[], side: "bid" | "ask") => {
    for (const lvl of levels) {
      const traded = profileByPrice.get(lvl.price) ?? 0;
      if (traded < noiseFloor || lvl.size <= 0) continue;
      const ratio = traded / lvl.size;
      if (ratio >= ICEBERG_REFILL_RATIO) results.push({ price: lvl.price, side, ratio });
    }
  };
  checkSide(book.bids, "bid");
  checkSide(book.asks, "ask");
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderflow-data`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts
git commit -m "feat: add detectIcebergLevels for hidden refill detection"
```

---

### Task 4: `detectStopRuns`

**Files:**
- Modify: `lib/orderflow-data.ts`
- Test: `tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: `FootprintCell[]` (existing), bars shaped `{ ts_event, high, low, open, close }` (matches `BarOut` from `lib/api.ts`)
- Produces: `function detectStopRuns(bars, cells: FootprintCell[], rollingMedian: number): { time: number; side: "buy" | "sell" }[]`

- [ ] **Step 1: Write the failing tests**

Add `detectStopRuns` to the import block in `tests/lib/orderflow-data.test.ts`:

```typescript
  computeVolumeProfile,
  computeImbalance,
  detectIcebergLevels,
  detectStopRuns,
  type FootprintCell,
  type VolumeProfileLevel,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "../../lib/orderflow-data";
```

Append to the end of the file:

```typescript
describe("detectStopRuns", () => {
  type Bar = { ts_event: number; high: number; low: number; open: number; close: number };

  function makeBars(n: number): Bar[] {
    const bars: Bar[] = [];
    for (let i = 0; i < n; i++) {
      bars.push({ ts_event: i * 60_000_000_000, high: 110, low: 90, open: 100, close: 100 });
    }
    return bars;
  }

  it("flags a sell stop-run: breakout above the 20-bar high with a close-back-below reversal", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, open: 108, close: 105 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 110, buyVol: 5, sellVol: 6 }]; // total 11 >= 10x median(1.0)
    expect(detectStopRuns(bars, cells, 1.0)).toEqual([{ time: 1200, side: "sell" }]);
  });

  it("flags a buy stop-run: breakdown below the 20-bar low with a close-back-above reversal", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 100, low: 85, open: 92, close: 95 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 90, buyVol: 6, sellVol: 5 }]; // total 11
    expect(detectStopRuns(bars, cells, 1.0)).toEqual([{ time: 1200, side: "buy" }]);
  });

  it("does not flag when volume at that bucket is below the noise floor", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, open: 108, close: 105 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 110, buyVol: 1, sellVol: 1 }]; // total 2 < 10x median(1.0)=10
    expect(detectStopRuns(bars, cells, 1.0)).toEqual([]);
  });

  it("does not flag a breakout that closes beyond the level (no reversal)", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 108, open: 109, close: 113 }; // close stays above recentHigh(110)
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 110, buyVol: 5, sellVol: 6 }];
    expect(detectStopRuns(bars, cells, 1.0)).toEqual([]);
  });

  it("fails closed (returns []) when rollingMedian is 0 (not warmed up)", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, open: 108, close: 105 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 110, buyVol: 5, sellVol: 6 }];
    expect(detectStopRuns(bars, cells, 0)).toEqual([]);
  });

  it("fails closed (returns []) when there are not enough bars for the lookback window", () => {
    const bars = makeBars(20);
    expect(detectStopRuns(bars, [], 1.0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderflow-data`
Expected: FAIL — `detectStopRuns is not a function`

- [ ] **Step 3: Write the implementation**

Append to `lib/orderflow-data.ts`:

```typescript
const STOP_RUN_LOOKBACK_BARS = 20;
const STOP_RUN_NOISE_FLOOR_MULTIPLIER = 10;

/**
 * 최근 20봉 고점/저점을 이탈했다가 거래량 스파이크와 함께 그 레벨 안쪽으로 되돌림 마감하는
 * 캔들(stop-run)을 표시. rollingMedian<=0(워밍업 전) 또는 lookback 확보 전이면 fail closed.
 */
export function detectStopRuns(
  bars: { ts_event: number; high: number; low: number; open: number; close: number }[],
  cells: FootprintCell[],
  rollingMedian: number
): { time: number; side: "buy" | "sell" }[] {
  if (rollingMedian <= 0 || bars.length <= STOP_RUN_LOOKBACK_BARS) return [];

  const volByBucket = new Map<number, number>();
  for (const c of cells) {
    volByBucket.set(c.bucketTs, (volByBucket.get(c.bucketTs) ?? 0) + c.buyVol + c.sellVol);
  }
  const noiseFloor = rollingMedian * STOP_RUN_NOISE_FLOOR_MULTIPLIER;
  const results: { time: number; side: "buy" | "sell" }[] = [];

  for (let i = STOP_RUN_LOOKBACK_BARS; i < bars.length; i++) {
    const bar = bars[i];
    const bucketTs = Math.floor(bar.ts_event / 1e9);
    const vol = volByBucket.get(bucketTs) ?? 0;
    if (vol < noiseFloor) continue;

    const window = bars.slice(i - STOP_RUN_LOOKBACK_BARS, i);
    const recentHigh = Math.max(...window.map((b) => b.high));
    const recentLow = Math.min(...window.map((b) => b.low));

    if (bar.high > recentHigh && bar.close < recentHigh) {
      results.push({ time: bucketTs, side: "sell" });
    } else if (bar.low < recentLow && bar.close > recentLow) {
      results.push({ time: bucketTs, side: "buy" });
    }
  }
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderflow-data`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts
git commit -m "feat: add detectStopRuns for stop-run wick-rejection detection"
```

---

### Task 5: 3-column inset layout helper (`stackedInsetColumns`)

**Files:**
- Modify: `lib/orderflow-chart-coords.ts`
- Test: `tests/lib/orderflow-chart-coords.test.ts`

**Interfaces:**
- Produces: `SVP_COLUMN_WIDTH_PX = 50`, `CVP_COLUMN_WIDTH_PX = 50`, `COB_COLUMN_WIDTH_PX = 90`, `function stackedInsetColumns(chartWidth: number, widths: number[]): { left: number; right: number }[]`

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/orderflow-chart-coords.test.ts` — extend the top import line:

```typescript
import { heatmapCellRect, footprintColumnX, footprintCellRect, bookBarLayout, stackedInsetColumns } from "../../lib/orderflow-chart-coords";
```

Append to the end of the file:

```typescript
describe("stackedInsetColumns", () => {
  it("lays out columns left-to-right, the last column flush with the right edge of the chart", () => {
    const cols = stackedInsetColumns(500, [50, 50, 90]);
    expect(cols).toEqual([
      { left: 310, right: 360 },
      { left: 360, right: 410 },
      { left: 410, right: 500 },
    ]);
  });

  it("handles a single column", () => {
    expect(stackedInsetColumns(200, [90])).toEqual([{ left: 110, right: 200 }]);
  });

  it("handles an empty widths array", () => {
    expect(stackedInsetColumns(200, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orderflow-chart-coords`
Expected: FAIL — `stackedInsetColumns is not a function`

- [ ] **Step 3: Write the implementation**

Append to `lib/orderflow-chart-coords.ts`:

```typescript
// 우측 인셋 컬럼 스택 폭. OrderBookPrimitive의 기존 인셋 폭(90px)을 COB 컬럼 폭으로 유지한다.
export const SVP_COLUMN_WIDTH_PX = 50;
export const CVP_COLUMN_WIDTH_PX = 50;
export const COB_COLUMN_WIDTH_PX = 90;

/**
 * 우측 인셋 컬럼 스택(SVP/CVP/COB 등)의 좌우 x좌표를 계산한다. widths는 왼쪽→오른쪽 순서,
 * 마지막 컬럼의 오른쪽 끝이 차트 우측(플롯 영역 끝, native price axis 직전)에 붙는다.
 */
export function stackedInsetColumns(chartWidth: number, widths: number[]): { left: number; right: number }[] {
  const totalWidth = widths.reduce((s, w) => s + w, 0);
  let left = chartWidth - totalWidth;
  return widths.map((w) => {
    const col = { left, right: left + w };
    left += w;
    return col;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orderflow-chart-coords`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/orderflow-chart-coords.ts tests/lib/orderflow-chart-coords.test.ts
git commit -m "feat: add stackedInsetColumns for SVP/CVP/COB 3-column inset layout"
```

---

### Task 6: `VolumeProfilePrimitive` canvas primitive

**Files:**
- Create: `components/orderflow/VolumeProfilePrimitive.ts`

**Interfaces:**
- Consumes: `VolumeProfileLevel` from `lib/orderflow-data.ts` (Task 1), `stackedInsetColumns`/`SVP_COLUMN_WIDTH_PX`/`CVP_COLUMN_WIDTH_PX`/`COB_COLUMN_WIDTH_PX` from `lib/orderflow-chart-coords.ts` (Task 5)
- Produces: `class VolumeProfilePrimitive implements ISeriesPrimitive<Time>` with `constructor(columnIndex: 0 | 1)` (0=SVP, 1=CVP — matches `stackedInsetColumns` left-to-right order) and `updateData(levels: VolumeProfileLevel[]): void`

- [ ] **Step 1: Write the implementation**

Create `components/orderflow/VolumeProfilePrimitive.ts`:

```typescript
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { stackedInsetColumns, SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX } from "@/lib/orderflow-chart-coords";
import type { VolumeProfileLevel } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const COLUMN_WIDTHS = [SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX];

class VolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: VolumeProfilePrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, series, columnIndex } = this.primitive;
      if (levels.length === 0) return;

      const col = stackedInsetColumns(mediaSize.width, COLUMN_WIDTHS)[columnIndex];
      const columnWidth = col.right - col.left;

      const sortedPrices = Array.from(new Set(levels.map((l) => l.price))).sort((a, b) => b - a);
      if (sortedPrices.length === 0) return;

      const priceToY = (price: number) => series.priceToCoordinate(price);
      const maxVol = Math.max(1, ...levels.map((l) => l.buyVol + l.sellVol));
      const byPrice = new Map(levels.map((l) => [l.price, l]));

      sortedPrices.forEach((price, idx) => {
        const y = priceToY(price);
        if (y === null) return;
        const neighborIdx = idx < sortedPrices.length - 1 ? idx + 1 : idx - 1;
        const neighborY = priceToY(sortedPrices[neighborIdx]);
        if (neighborY === null) return;
        const height = Math.max(1, Math.abs(neighborY - y));
        const top = y - height / 2;

        const level = byPrice.get(price);
        if (!level) return;
        const total = level.buyVol + level.sellVol;
        const width = Math.min(columnWidth, (total / maxVol) * columnWidth);
        const buyWidth = total > 0 ? (level.buyVol / total) * width : 0;

        ctx.fillStyle = `rgba(${NEG_RGB}, 0.5)`;
        ctx.fillRect(col.right - width, top, width - buyWidth, height - 1);
        ctx.fillStyle = `rgba(${POS_RGB}, 0.5)`;
        ctx.fillRect(col.right - buyWidth, top, buyWidth, height - 1);
      });

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(col.left, 0, columnWidth, mediaSize.height);
    });
  }
}

class VolumeProfilePaneView implements IPrimitivePaneView {
  constructor(private primitive: VolumeProfilePrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new VolumeProfilePaneRenderer(this.primitive);
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  levels: VolumeProfileLevel[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  readonly columnIndex: 0 | 1;
  private requestUpdate: (() => void) | null = null;
  private paneView = new VolumeProfilePaneView(this);

  constructor(columnIndex: 0 | 1) {
    this.columnIndex = columnIndex;
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(levels: VolumeProfileLevel[]): void {
    this.levels = levels;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (file is not wired into `OrderflowChart.tsx` yet, so it's dead code but must still compile clean)

- [ ] **Step 3: Commit**

```bash
git add components/orderflow/VolumeProfilePrimitive.ts
git commit -m "feat: add VolumeProfilePrimitive canvas renderer for SVP/CVP columns"
```

---

### Task 7: `OrderBookPrimitive` — 3-column layout, iceberg highlight, numeric ladder

**Files:**
- Modify: `components/orderflow/OrderBookPrimitive.ts` (full replacement — layout, highlight, and ladder changes touch most of the file)

**Interfaces:**
- Consumes: `IcebergLevel` from `lib/orderflow-data.ts` (Task 3), `stackedInsetColumns`/`SVP_COLUMN_WIDTH_PX`/`CVP_COLUMN_WIDTH_PX`/`COB_COLUMN_WIDTH_PX` from `lib/orderflow-chart-coords.ts` (Task 5)
- Produces: `OrderBookPrimitive.updateIcebergLevels(icebergLevels: IcebergLevel[]): void` (new method, alongside existing `updateData`)

- [ ] **Step 1: Write the implementation**

Replace the full contents of `components/orderflow/OrderBookPrimitive.ts`:

```typescript
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { bookBarLayout, stackedInsetColumns, SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX } from "@/lib/orderflow-chart-coords";
import type { BookLevel, OrderBookState, IcebergLevel } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const WARN_RGB = "255, 159, 10"; // --color-warn #FF9F0A
const COLUMN_WIDTHS = [SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX];
const MIN_ROW_HEIGHT_FOR_TEXT = 9;

const VENUE_LABELS: Record<string, string> = {
  hyperliquid: "HL",
  "binance-depth": "BIN",
  "okx-depth": "OKX",
};

class OrderBookPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: OrderBookPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { book, icebergLevels } = this.primitive;
      if (book.bids.length === 0 && book.asks.length === 0) return;

      const chartHeight = mediaSize.height;
      const col = stackedInsetColumns(mediaSize.width, COLUMN_WIDTHS)[2];
      const { left, right } = col;
      const insetWidth = right - left;

      const maxVisibleSize = Math.max(
        1,
        ...book.bids.map((l) => l.size),
        ...book.asks.map((l) => l.size)
      );
      const rowHeight = chartHeight / 2 / this.primitive.levels;
      const icebergByKey = new Map(icebergLevels.map((lv) => [`${lv.side}:${lv.price}`, lv]));

      const drawSide = (levels: BookLevel[], side: "bid" | "ask", rgb: string) => {
        levels.slice(0, this.primitive.levels).forEach((lvl, i) => {
          const layout = bookBarLayout(i, maxVisibleSize, lvl.size, chartHeight, side, this.primitive.levels);
          if (!layout) return;
          const barWidth = layout.widthFrac * insetWidth;
          const y = layout.yFrac * chartHeight;
          ctx.fillStyle = `rgba(${rgb}, 0.35)`;
          ctx.fillRect(right - barWidth, y, barWidth, rowHeight - 1);

          if (icebergByKey.has(`${side}:${lvl.price}`)) {
            ctx.strokeStyle = `rgba(${WARN_RGB}, 0.9)`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(right - barWidth, y, barWidth, rowHeight - 1);
          }

          if (rowHeight >= MIN_ROW_HEIGHT_FOR_TEXT) {
            ctx.save();
            ctx.font = "9px monospace";
            ctx.fillStyle = "rgba(255,255,255,0.65)";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(lvl.size.toFixed(2), left + 2, y + rowHeight / 2);
            ctx.restore();
          }
        });
      };

      drawSide(book.asks, "ask", NEG_RGB);
      drawSide(book.bids, "bid", POS_RGB);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(left, 0, insetWidth, chartHeight);

      if (book.venues.length > 0) {
        ctx.save();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(book.venues.map((v) => VENUE_LABELS[v] ?? v).join(" "), right - 4, 2);
        ctx.restore();
      }
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
  book: OrderBookState = { bids: [], asks: [], venues: [] };
  icebergLevels: IcebergLevel[] = [];
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

  updateIcebergLevels(icebergLevels: IcebergLevel[]): void {
    this.icebergLevels = icebergLevels;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 2: Type-check and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no new type errors; full suite still passes (this file has no dedicated tests per project convention — `OrderBookPrimitive`'s coordinate math is covered by `bookBarLayout`/`stackedInsetColumns` unit tests)

- [ ] **Step 3: Commit**

```bash
git add components/orderflow/OrderBookPrimitive.ts
git commit -m "feat: OrderBookPrimitive - 3-column inset layout, iceberg highlight, numeric ladder"
```

---

### Task 8: `ImbalanceBarPrimitive` canvas primitive

**Files:**
- Create: `components/orderflow/ImbalanceBarPrimitive.ts`

**Interfaces:**
- Produces: `interface ImbalanceData { bookBidPct: number; volBuyPct: number }`, `class ImbalanceBarPrimitive implements ISeriesPrimitive<Time>` with `updateData(data: ImbalanceData | null): void`

- [ ] **Step 1: Write the implementation**

Create `components/orderflow/ImbalanceBarPrimitive.ts`:

```typescript
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const BAR_WIDTH = 120;
const BAR_HEIGHT = 8;
const BAR_GAP = 4;
const OFFSET_X = 12;
const OFFSET_Y = 12;

export interface ImbalanceData {
  bookBidPct: number;
  volBuyPct: number;
}

class ImbalanceBarPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: ImbalanceBarPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { data } = this.primitive;
      if (!data) return;

      const drawBar = (y: number, pct: number) => {
        const posWidth = pct * BAR_WIDTH;
        ctx.fillStyle = `rgba(${NEG_RGB}, 0.6)`;
        ctx.fillRect(OFFSET_X, y, BAR_WIDTH, BAR_HEIGHT);
        ctx.fillStyle = `rgba(${POS_RGB}, 0.85)`;
        ctx.fillRect(OFFSET_X, y, posWidth, BAR_HEIGHT);
      };

      drawBar(OFFSET_Y, data.bookBidPct);
      drawBar(OFFSET_Y + BAR_HEIGHT + BAR_GAP, data.volBuyPct);
    });
  }
}

class ImbalanceBarPaneView implements IPrimitivePaneView {
  constructor(private primitive: ImbalanceBarPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new ImbalanceBarPaneRenderer(this.primitive);
  }
}

export class ImbalanceBarPrimitive implements ISeriesPrimitive<Time> {
  data: ImbalanceData | null = null;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new ImbalanceBarPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(data: ImbalanceData | null): void {
    this.data = data;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/orderflow/ImbalanceBarPrimitive.ts
git commit -m "feat: add ImbalanceBarPrimitive for book%/volume% imbalance overlay"
```

---

### Task 9: `CandlestickChart` — merge stop-run markers

**Files:**
- Modify: `components/CandlestickChart.tsx`

**Interfaces:**
- Consumes: `{ time: UTCTimestamp; side: "buy" | "sell" }[]` (shape matches `absorptionMarkers`, produced by Task 4's `detectStopRuns` mapped to `UTCTimestamp` by the caller)
- Produces: new prop `stopRunMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[]`

- [ ] **Step 1: Write the implementation**

In `components/CandlestickChart.tsx`, add the new prop to the interface (after the existing `absorptionMarkers` line):

```typescript
  /** 흡수(absorption) 캔들 — 우세 물량이 가격을 못 밀어낸 지점. 오더플로우 심볼에서만 전달됨. */
  absorptionMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
  /** 스탑런(stop-run) 캔들 — 최근 고점/저점 이탈 후 반전 마감. 오더플로우 심볼에서만 전달됨. */
  stopRunMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
```

Add `stopRunMarkers` to the destructured props in the component signature:

```typescript
export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specs, cvdSeries, absorptionMarkers, stopRunMarkers, onSeriesReady, height = 480 }: CandlestickChartProps) {
```

Replace the marker-merging block (currently `const absorptionMarkerList = ...` through `const allMarkers = [...tradeMarkers, ...absorptionMarkerList]...`):

```typescript
    const absorptionMarkerList: SeriesMarker<UTCTimestamp>[] = (absorptionMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: "#3B9CFF",
      shape: m.side === "buy" ? "arrowUp" : "arrowDown",
      text: "흡수",
    }));

    const stopRunMarkerList: SeriesMarker<UTCTimestamp>[] = (stopRunMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: "#FF9F0A",
      shape: "square",
      text: "스탑런",
    }));

    const allMarkers = [...tradeMarkers, ...absorptionMarkerList, ...stopRunMarkerList].sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
```

Add `stopRunMarkers` to the data-effect's dependency array (the `// eslint-disable-next-line react-hooks/exhaustive-deps` line right before `}, [bars, trades, ...`):

```typescript
  }, [bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specsKey, cvdSeries, absorptionMarkers, stopRunMarkers]);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/CandlestickChart.tsx
git commit -m "feat: CandlestickChart - merge stop-run markers alongside absorption markers"
```

---

### Task 10: Wire everything into `OrderflowChart.tsx`

**Files:**
- Modify: `components/orderflow/OrderflowChart.tsx` (full replacement)

**Interfaces:**
- Consumes: everything produced by Tasks 1–9 (`computeVolumeProfile`, `SVP_WINDOW_SEC`, `computeImbalance`, `detectIcebergLevels`, `detectStopRuns` from `lib/orderflow-data.ts`; `VolumeProfilePrimitive` from Task 6; `OrderBookPrimitive.updateIcebergLevels` from Task 7; `ImbalanceBarPrimitive` from Task 8; `CandlestickChart`'s `stopRunMarkers` prop from Task 9)

- [ ] **Step 1: Write the implementation**

Replace the full contents of `components/orderflow/OrderflowChart.tsx`:

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { CandlestickChart } from "@/components/CandlestickChart";
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { OrderBookPrimitive } from "@/components/orderflow/OrderBookPrimitive";
import { LargeLotPrimitive } from "@/components/orderflow/LargeLotPrimitive";
import { GexLevelsPrimitive } from "@/components/orderflow/GexLevelsPrimitive";
import { VolumeProfilePrimitive } from "@/components/orderflow/VolumeProfilePrimitive";
import { ImbalanceBarPrimitive } from "@/components/orderflow/ImbalanceBarPrimitive";
import { OptionsFlowPanel } from "@/components/orderflow/OptionsFlowPanel";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import {
  applyLargeTradeTracking,
  computeCvdSeries,
  computeImbalance,
  computeVolumeProfile,
  currencyForSymbol,
  detectAbsorption,
  detectIcebergLevels,
  detectStopRuns,
  diffFootprintCells,
  emptyLargeTradeTracker,
  SVP_WINDOW_SEC,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
import type { BarOut, GexSnapshot } from "@/lib/api";

const REFRESH_INTERVAL_MS = 30_000;

interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
  gex: GexSnapshot | null;
}

export function OrderflowChart({ symbol, footprint, heatmap, book, gex }: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const bookPrimitiveRef = useRef<OrderBookPrimitive | null>(null);
  const largeLotPrimitiveRef = useRef<LargeLotPrimitive | null>(null);
  const gexLevelsPrimitiveRef = useRef<GexLevelsPrimitive | null>(null);
  const svpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const cvpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const imbalancePrimitiveRef = useRef<ImbalanceBarPrimitive | null>(null);
  const currency = currencyForSymbol(symbol);
  const gexRef = useRef(gex);
  gexRef.current = gex;
  const prevFootprintRef = useRef<FootprintCell[]>([]);
  const largeTradeTrackerRef = useRef<LargeTradeTrackerState>(emptyLargeTradeTracker());
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  const bookRef = useRef(book);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;
  bookRef.current = book;

  const [absorptionMarkers, setAbsorptionMarkers] = useState<
    { time: UTCTimestamp; side: "buy" | "sell" }[]
  >([]);
  const [trackerSnapshot, setTrackerSnapshot] = useState<LargeTradeTrackerState>(emptyLargeTradeTracker());

  const cvdSeries = useMemo(
    () => computeCvdSeries(footprint).map((pt) => ({ time: pt.time as UTCTimestamp, value: pt.value })),
    [footprint]
  );

  // 대량체결 트래커의 이동중앙값 — Iceberg/Stop-run 노이즈플로어, 임밸런스 volBuyPct의 표본원으로 재사용.
  const medianSize = useMemo(() => {
    const sizes = trackerSnapshot.recentSizes;
    return sizes.length > 0 ? [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] : 0;
  }, [trackerSnapshot]);

  const cvpProfile = useMemo(() => computeVolumeProfile(footprint), [footprint]);
  const svpProfile = useMemo(() => {
    const latestBucketTs = footprint.reduce((max, c) => Math.max(max, c.bucketTs), 0);
    return computeVolumeProfile(footprint, latestBucketTs - SVP_WINDOW_SEC);
  }, [footprint]);

  const icebergLevels = useMemo(
    () => detectIcebergLevels(cvpProfile, book, medianSize),
    [cvpProfile, book, medianSize]
  );

  const stopRunMarkers = useMemo(
    () =>
      detectStopRuns(bars, footprint, medianSize).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      })),
    [bars, footprint, medianSize]
  );

  const imbalance = useMemo(() => computeImbalance(book, trackerSnapshot), [book, trackerSnapshot]);

  // 심볼 전환 시 이전 심볼의 롤링 중앙값/대형 트레이드 상태가 새 심볼에 섞이지 않도록 초기화.
  useEffect(() => {
    largeTradeTrackerRef.current = emptyLargeTradeTracker();
    prevFootprintRef.current = [];
    largeLotPrimitiveRef.current?.updateData([], 0);
    setAbsorptionMarkers([]);
    setTrackerSnapshot(emptyLargeTradeTracker());
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const result = await fetchBarsForSymbol(symbol, "1m", ctrl.signal);
        if (!cancelled) { setBars(result); setError(null); }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [symbol]);

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
    const localMedianSize =
      tracker.recentSizes.length > 0
        ? [...tracker.recentSizes].sort((a, b) => a - b)[Math.floor(tracker.recentSizes.length / 2)]
        : 0;
    largeLotPrimitiveRef.current?.updateData(tracker.largeTrades, localMedianSize);
    setAbsorptionMarkers(
      detectAbsorption(footprint, bars, localMedianSize).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      }))
    );
    setTrackerSnapshot(tracker);
  }, [heatmap, footprint, book, bars]);

  useEffect(() => {
    if (currency && gex) {
      gexLevelsPrimitiveRef.current?.updateData(gex.levels);
    } else {
      gexLevelsPrimitiveRef.current?.updateData([]);
    }
  }, [currency, gex]);

  useEffect(() => {
    svpPrimitiveRef.current?.updateData(svpProfile);
    cvpPrimitiveRef.current?.updateData(cvpProfile);
  }, [svpProfile, cvpProfile]);

  useEffect(() => {
    bookPrimitiveRef.current?.updateIcebergLevels(icebergLevels);
  }, [icebergLevels]);

  useEffect(() => {
    imbalancePrimitiveRef.current?.updateData(imbalance);
  }, [imbalance]);

  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    const gp = new GexLevelsPrimitive();
    const svp = new VolumeProfilePrimitive(0);
    const cvp = new VolumeProfilePrimitive(1);
    const ip = new ImbalanceBarPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(svp);
    series.attachPrimitive(cvp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    series.attachPrimitive(gp);
    series.attachPrimitive(ip);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    gp.updateData(currency && gexRef.current ? gexRef.current.levels : []);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
    gexLevelsPrimitiveRef.current = gp;
    svpPrimitiveRef.current = svp;
    cvpPrimitiveRef.current = cvp;
    imbalancePrimitiveRef.current = ip;
  }

  if (error) {
    return <div className="border border-border bg-panel text-neg text-sm p-4">{error}</div>;
  }

  return (
    <div className="border border-border bg-panel">
      <CandlestickChart
        bars={bars}
        cvdSeries={cvdSeries}
        absorptionMarkers={absorptionMarkers}
        stopRunMarkers={stopRunMarkers}
        onSeriesReady={handleSeriesReady}
        height={720}
      />
      {currency && (
        <div className="border-t border-border">
          <OptionsFlowPanel currency={currency} gex={gex} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; full suite passes (this file has no dedicated tests — it's a wiring component, matching the existing convention for `OrderflowChart.tsx`)

- [ ] **Step 3: Commit**

```bash
git add components/orderflow/OrderflowChart.tsx
git commit -m "feat: wire volume profile, iceberg, stop-run, imbalance bar into OrderflowChart"
```

- [ ] **Step 4: Browser spot-check**

With `npm run dev` running, navigate to `http://localhost:3000/orderflow` with symbol `BTC.HL` and visually confirm:
- SVP/CVP columns render to the left of the COB inset (3-column stack on the chart's right edge)
- COB inset bars show numeric size labels when zoomed in enough for `rowHeight >= 9px`
- No console errors

---

## Self-Review

**Spec coverage:** All 5 features from `2026-07-11-orderflow-cockpit-v2-design.md` are covered — Volume Profile (Tasks 1, 6), Iceberg (Tasks 3, 7), Stop-run (Tasks 4, 9), Imbalance bar (Tasks 2, 8), COB numeric ladder (Task 7). The 3-column inset layout from the spec's Architecture section is Task 5 + the layout portion of Task 7.

**Placeholder scan:** No TBD/TODO markers; every step has complete code and exact commands.

**Type consistency:** `VolumeProfileLevel` (Task 1) is the type consumed by `detectIcebergLevels` (Task 3) and `VolumeProfilePrimitive` (Task 6) — same shape throughout. `IcebergLevel` (Task 3) is consumed by `OrderBookPrimitive.updateIcebergLevels` (Task 7) — same shape. `LargeTradeTrackerState.recentSides` (Task 2) is consumed by `computeImbalance` (Task 2) and populated via `trackerSnapshot` state in `OrderflowChart.tsx` (Task 10) — same shape. `stackedInsetColumns`/column-width constants (Task 5) are consumed identically by `VolumeProfilePrimitive` (Task 6) and `OrderBookPrimitive` (Task 7) — same column-index convention (0=SVP, 1=CVP, 2=COB).
