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
