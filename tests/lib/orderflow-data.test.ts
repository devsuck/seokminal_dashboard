import { describe, it, expect } from "vitest";
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
  type FootprintCell,
} from "../../lib/orderflow-data";

describe("applySnapshot", () => {
  it("converts snapshot arrays into keyed maps with camelCase fields", () => {
    const state = applySnapshot({
      footprint: [{ bucket_ts: 0, price: 100, buy_vol: 1, sell_vol: 0.5 }],
      heatmap: [{ ts: 0, price: 99, size: 5 }],
    });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0.5 });
    expect(state.heatmap.get("0:99")).toEqual({ ts: 0, price: 99, size: 5 });
  });
});

describe("applyFootprintDelta", () => {
  it("creates a new cell on first delta for a price/bucket", () => {
    const next = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    expect(next.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 2, sellVol: 0 });
  });

  it("accumulates buy_vol and sell_vol independently across repeated deltas", () => {
    let state = emptyOrderflowState();
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2 });
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "sell", delta_vol: 1 });
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 3 });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 5, sellVol: 1 });
  });

  it("does not mutate the previous state (returns a new map)", () => {
    const state = emptyOrderflowState();
    const next = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2 });
    expect(state.footprint.size).toBe(0);
    expect(next.footprint.size).toBe(1);
  });
});

describe("applyHeatmapDelta", () => {
  it("replaces size for an existing ts/price key rather than accumulating", () => {
    let state = emptyOrderflowState();
    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: 0, price: 99, size: 5 });
    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: 0, price: 99, size: 8 });
    expect(state.heatmap.get("0:99")).toEqual({ ts: 0, price: 99, size: 8 });
  });
});

describe("time bucket eviction", () => {
  it("applyFootprintDelta drops the oldest bucket_ts once distinct buckets exceed MAX_TIME_BUCKETS", () => {
    let state = emptyOrderflowState();
    for (let bucketTs = 0; bucketTs < MAX_TIME_BUCKETS; bucketTs++) {
      state = applyFootprintDelta(state, {
        type: "footprint_delta", bucket_ts: bucketTs, price: 100, side: "buy", delta_vol: 1,
      });
    }
    expect(state.footprint.get("0:100")).toBeDefined();
    expect(state.footprint.size).toBe(MAX_TIME_BUCKETS);

    // one more distinct bucket pushes count to MAX_TIME_BUCKETS + 1 -> oldest (bucket 0) evicted
    state = applyFootprintDelta(state, {
      type: "footprint_delta", bucket_ts: MAX_TIME_BUCKETS, price: 100, side: "buy", delta_vol: 1,
    });
    expect(state.footprint.get("0:100")).toBeUndefined();
    expect(state.footprint.get("1:100")).toBeDefined();
    expect(state.footprint.get(`${MAX_TIME_BUCKETS}:100`)).toBeDefined();
    expect(state.footprint.size).toBe(MAX_TIME_BUCKETS);
  });

  it("applyHeatmapDelta drops the oldest ts once distinct buckets exceed MAX_TIME_BUCKETS", () => {
    let state = emptyOrderflowState();
    for (let ts = 0; ts < MAX_TIME_BUCKETS; ts++) {
      state = applyHeatmapDelta(state, { type: "heatmap_delta", ts, price: 99, size: 5 });
    }
    expect(state.heatmap.get("0:99")).toBeDefined();
    expect(state.heatmap.size).toBe(MAX_TIME_BUCKETS);

    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: MAX_TIME_BUCKETS, price: 99, size: 5 });
    expect(state.heatmap.get("0:99")).toBeUndefined();
    expect(state.heatmap.get("1:99")).toBeDefined();
    expect(state.heatmap.get(`${MAX_TIME_BUCKETS}:99`)).toBeDefined();
    expect(state.heatmap.size).toBe(MAX_TIME_BUCKETS);
  });

  it("applySnapshot caps footprint and heatmap to the newest MAX_TIME_BUCKETS distinct buckets", () => {
    const footprint = [];
    const heatmap = [];
    for (let i = 0; i < MAX_TIME_BUCKETS + 5; i++) {
      footprint.push({ bucket_ts: i, price: 100, buy_vol: 1, sell_vol: 0 });
      heatmap.push({ ts: i, price: 99, size: 5 });
    }
    const state = applySnapshot({ footprint, heatmap });
    expect(state.footprint.size).toBe(MAX_TIME_BUCKETS);
    expect(state.heatmap.size).toBe(MAX_TIME_BUCKETS);
    expect(state.footprint.get("0:100")).toBeUndefined();
    expect(state.footprint.get("4:100")).toBeUndefined();
    expect(state.footprint.get("5:100")).toBeDefined();
    expect(state.heatmap.get("0:99")).toBeUndefined();
    expect(state.heatmap.get("5:99")).toBeDefined();
  });
});

describe("applyOrderflowMessage", () => {
  it("routes footprint_delta and heatmap_delta, ignores status (returns same reference)", () => {
    let state = emptyOrderflowState();
    state = applyOrderflowMessage(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 1 });
    state = applyOrderflowMessage(state, { type: "heatmap_delta", ts: 0, price: 99, size: 5 });
    const beforeStatus = state;
    state = applyOrderflowMessage(state, { type: "status", state: "reconnecting" });
    expect(state).toBe(beforeStatus);
    expect(state.footprint.size).toBe(1);
    expect(state.heatmap.size).toBe(1);
  });
});

describe("diffFootprintCells", () => {
  it("returns only cells whose buyVol/sellVol changed vs prev", () => {
    const prev = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, { bucketTs: 0, price: 101, buyVol: 2, sellVol: 0 }];
    const next = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, { bucketTs: 0, price: 101, buyVol: 3, sellVol: 0 }];
    expect(diffFootprintCells(prev, next)).toEqual([{ bucketTs: 0, price: 101, buyVol: 3, sellVol: 0 }]);
  });

  it("treats a brand new cell (not in prev) as changed", () => {
    const prev: ReturnType<typeof emptyOrderflowState>["footprint"] extends Map<string, infer C> ? C[] : never = [];
    const next = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }];
    expect(diffFootprintCells(prev, next)).toEqual(next);
  });
});

describe("diffHeatmapCells", () => {
  it("returns only cells whose size changed vs prev", () => {
    const prev = [{ ts: 0, price: 99, size: 5 }];
    const next = [{ ts: 0, price: 99, size: 8 }];
    expect(diffHeatmapCells(prev, next)).toEqual(next);
  });
});

describe("computeFootprintLayout", () => {
  it("returns distinct sorted buckets (ascending) and prices (descending)", () => {
    const cells = [
      { bucketTs: 60, price: 99, buyVol: 1, sellVol: 0 },
      { bucketTs: 0, price: 101, buyVol: 1, sellVol: 0 },
      { bucketTs: 60, price: 101, buyVol: 1, sellVol: 0 },
    ];
    expect(computeFootprintLayout(cells)).toEqual({ buckets: [0, 60], prices: [101, 99] });
  });
});

describe("computeHeatmapLayout", () => {
  it("returns distinct sorted buckets (ascending) and prices (descending)", () => {
    const cells = [
      { ts: 2, price: 99, size: 5 },
      { ts: 0, price: 101, size: 5 },
    ];
    expect(computeHeatmapLayout(cells)).toEqual({ buckets: [0, 2], prices: [101, 99] });
  });
});

describe("aggregateHeatmapByCandle", () => {
  it("collapses multiple raw buckets within one candle into a single cell per price", () => {
    const cells = [
      { ts: 0, price: 100, size: 3 },
      { ts: 2, price: 100, size: 7 },
      { ts: 58, price: 100, size: 4 },
    ];
    expect(aggregateHeatmapByCandle(cells, 60)).toEqual([{ ts: 0, price: 100, size: 7 }]);
  });

  it("takes the max size seen, not the sum (avoids double-counting the same resting order)", () => {
    const cells = [
      { ts: 0, price: 100, size: 10 },
      { ts: 2, price: 100, size: 10 },
    ];
    expect(aggregateHeatmapByCandle(cells, 60)).toEqual([{ ts: 0, price: 100, size: 10 }]);
  });

  it("keeps separate candles and prices as distinct cells", () => {
    const cells = [
      { ts: 0, price: 100, size: 5 },
      { ts: 60, price: 100, size: 6 },
      { ts: 0, price: 101, size: 2 },
    ];
    const result = aggregateHeatmapByCandle(cells, 60);
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { ts: 0, price: 100, size: 5 },
        { ts: 60, price: 100, size: 6 },
        { ts: 0, price: 101, size: 2 },
      ])
    );
  });
});

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

  it("flags a trade above the rolling p95 once warmed up", () => {
    let tracker = feedNormalTrades(20, 1.0);
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 2000, price: 105, side: "sell", delta_vol: 10.0,
    });
    expect(tracker.largeTrades).toHaveLength(1);
    expect(tracker.largeTrades[0]).toEqual({ bucketTs: 2000, price: 105, side: "sell", size: 10.0 });
  });

  it("does not flag a trade at or below the rolling p95", () => {
    let tracker = feedNormalTrades(20, 1.0);
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 2000, price: 105, side: "buy", delta_vol: 1.0,
    });
    expect(tracker.largeTrades).toHaveLength(0);
  });

  it("does not collapse toward the sample minimum when large trades keep arriving (regression: 2026-07-11 median-exclusion bug)", () => {
    // 이전 버전은 대량 체결을 표본에서 제외해 median이 최솟값 근처로 폭주 붕괴,
    // 이후 정상 체결 대부분이 오탐되는 버그가 있었다. 대량 체결이 반복돼도
    // p95 문턱은 표본 전체(대량 포함) 기준으로 안정적으로 유지돼야 한다.
    let tracker = feedNormalTrades(20, 1.0);
    for (let i = 0; i < 30; i++) {
      tracker = applyLargeTradeTracking(tracker, {
        type: "footprint_delta", bucket_ts: 2000 + i, price: 100, side: "buy", delta_vol: 10.0,
      });
    }
    // 대량 체결(10.0)이 표본의 상당 비중을 차지하면 이후 정상 체결(1.0)은 더 이상
    // p95 문턱을 넘지 못해야 한다(문턱이 1.0 근처로 폭주 붕괴하지 않았다는 증거).
    tracker = applyLargeTradeTracking(tracker, {
      type: "footprint_delta", bucket_ts: 5000, price: 100, side: "buy", delta_vol: 1.0,
    });
    expect(tracker.largeTrades.at(-1)?.size).not.toBe(1.0);
  });

  it("caps largeTrades at 50 entries, dropping the oldest", () => {
    // 대량 체결끼리 연달아 오면 그 자체가 p95 문턱을 밀어올려 더 이상 "대량"으로
    // 안 잡힘(적응형 임계값의 정상 동작). 캡(50) 자체를 검증하려면 대량 체결
    // 밀도를 창(200)의 5% 밑으로 유지해야 한다 — 정상 체결 24건마다 1건 비율.
    let tracker = feedNormalTrades(20, 1.0);
    let ts = 3000;
    let flagged = 0;
    while (flagged < 55) {
      for (let j = 0; j < 24; j++) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: ts++, price: 100, side: "buy", delta_vol: 1.0,
        });
      }
      const largeTs = ts++;
      tracker = applyLargeTradeTracking(tracker, {
        type: "footprint_delta", bucket_ts: largeTs, price: 100, side: "buy", delta_vol: 10.0,
      });
      // 캡(50)에 도달하면 length는 안 늘어도 최신 항목은 갱신되므로,
      // length 대신 방금 넣은 체결이 실제로 마지막 항목인지로 판정한다.
      if (tracker.largeTrades.at(-1)?.bucketTs === largeTs) flagged++;
    }
    expect(tracker.largeTrades).toHaveLength(50);
  });
});

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
