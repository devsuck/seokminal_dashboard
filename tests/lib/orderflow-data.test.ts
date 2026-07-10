import { describe, it, expect } from "vitest";
import {
  applySnapshot,
  applyFootprintDelta,
  applyHeatmapDelta,
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
