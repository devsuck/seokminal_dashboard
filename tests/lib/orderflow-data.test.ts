import { describe, it, expect } from "vitest";
import {
  applySnapshot,
  applyFootprintDelta,
  applyHeatmapDelta,
  applyBookSnapshot,
  applySpoofAlert,
  applyOrderflowMessage,
  applyOrderflowMessageBatch,
  emptyOrderflowState,
  diffFootprintCells,
  diffHeatmapCells,
  computeFootprintLayout,
  computeHeatmapLayout,
  aggregateHeatmapByCandle,
  MAX_TIME_BUCKETS,
  MAX_HEATMAP_TIME_BUCKETS,
  currencyForSymbol,
  applyLargeTradeTracking,
  emptyLargeTradeTracker,
  computeCvdSeries,
  detectAbsorption,
  computeVolumeProfile,
  computeImbalance,
  detectIcebergLevels,
  detectStopRuns,
  computeValueArea,
  computeTpoProfile,
  splitFootprintByUtcDay,
  computeCompositeValueArea,
  computeVwapBands,
  computeDeltaSeries,
  detectDeltaDivergence,
  computeSessionLevels,
  hlCoinForSymbol,
  estimateLiquidationLevels,
  LIQUIDATION_LEVERAGE_TIERS,
  detectImbalanceCells,
  detectStackedImbalances,
  computeColumnPoc,
  computeFootprintAbsorptionLevels,
  computeNakedPocs,
  computeVolumeByBucket,
  computeFibLevels,
  estimateLiquidationHeatmap,
  applyLiquidation,
  type FootprintCell,
  type VolumeProfileLevel,
  type LargeTradeTrackerState,
  type OrderBookState,
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

describe("applyOrderflowMessageBatch", () => {
  it("produces the same result as applying each message sequentially via applyOrderflowMessage", () => {
    const msgs: Parameters<typeof applyOrderflowMessage>[1][] = [
      { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2 },
      { type: "heatmap_delta", ts: 0, price: 99, size: 5 },
      { type: "footprint_delta", bucket_ts: 0, price: 100, side: "sell", delta_vol: 1 },
      { type: "heatmap_delta", ts: 0, price: 99, size: 8 },
      { type: "book_snapshot", bids: [{ price: 99, size: 8 }], asks: [{ price: 101, size: 3 }], venues: ["HL"] },
    ];

    let sequential = emptyOrderflowState();
    for (const msg of msgs) sequential = applyOrderflowMessage(sequential, msg);

    const batched = applyOrderflowMessageBatch(emptyOrderflowState(), msgs);

    expect(Array.from(batched.footprint.entries())).toEqual(Array.from(sequential.footprint.entries()));
    expect(Array.from(batched.heatmap.entries())).toEqual(Array.from(sequential.heatmap.entries()));
    expect(batched.book).toEqual(sequential.book);
  });

  it("only touches footprint/heatmap Map references for message types present in the batch (avoids invalidating downstream useMemo for untouched slices)", () => {
    const state = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    const next = applyOrderflowMessageBatch(state, [
      { type: "heatmap_delta", ts: 0, price: 99, size: 5 },
    ]);
    expect(next.footprint).toBe(state.footprint); // footprint untouched by this batch -> same reference
    expect(next.heatmap).not.toBe(state.heatmap);
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

  it("applyHeatmapDelta drops the oldest ts once distinct buckets exceed MAX_HEATMAP_TIME_BUCKETS", () => {
    let state = emptyOrderflowState();
    for (let ts = 0; ts < MAX_HEATMAP_TIME_BUCKETS; ts++) {
      state = applyHeatmapDelta(state, { type: "heatmap_delta", ts, price: 99, size: 5 });
    }
    expect(state.heatmap.get("0:99")).toBeDefined();
    expect(state.heatmap.size).toBe(MAX_HEATMAP_TIME_BUCKETS);

    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: MAX_HEATMAP_TIME_BUCKETS, price: 99, size: 5 });
    expect(state.heatmap.get("0:99")).toBeUndefined();
    expect(state.heatmap.get("1:99")).toBeDefined();
    expect(state.heatmap.get(`${MAX_HEATMAP_TIME_BUCKETS}:99`)).toBeDefined();
    expect(state.heatmap.size).toBe(MAX_HEATMAP_TIME_BUCKETS);
  });

  it("applySnapshot caps footprint to the newest MAX_TIME_BUCKETS and heatmap to MAX_HEATMAP_TIME_BUCKETS distinct buckets", () => {
    const footprint = [];
    for (let i = 0; i < MAX_TIME_BUCKETS + 5; i++) {
      footprint.push({ bucket_ts: i, price: 100, buy_vol: 1, sell_vol: 0 });
    }
    const heatmap = [];
    for (let i = 0; i < MAX_HEATMAP_TIME_BUCKETS + 5; i++) {
      heatmap.push({ ts: i, price: 99, size: 5 });
    }
    const state = applySnapshot({ footprint, heatmap });
    expect(state.footprint.size).toBe(MAX_TIME_BUCKETS);
    expect(state.heatmap.size).toBe(MAX_HEATMAP_TIME_BUCKETS);
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

describe("hlCoinForSymbol", () => {
  it("COIN.HL -> COIN, BTC/ETH 한정 아님", () => {
    expect(hlCoinForSymbol("BTC.HL")).toBe("BTC");
    expect(hlCoinForSymbol("SOL.HL")).toBe("SOL");
  });

  it("HL 접미사 없는 심볼은 null", () => {
    expect(hlCoinForSymbol("NQ")).toBeNull();
    expect(hlCoinForSymbol("AAPL.NASDAQ")).toBeNull();
  });

  it("접미사만 있는 빈 코인은 null", () => {
    expect(hlCoinForSymbol(".HL")).toBeNull();
  });
});

describe("applyBookSnapshot", () => {
  it("full-replaces book state (not a merge) on each snapshot", () => {
    let state = emptyOrderflowState();
    state = applyBookSnapshot(state, {
      type: "book_snapshot",
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 2 }],
      venues: ["hyperliquid"],
    });
    expect(state.book).toEqual({
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 2 }],
      venues: ["hyperliquid"],
      byVenue: {},
    });

    state = applyBookSnapshot(state, {
      type: "book_snapshot",
      bids: [{ price: 99, size: 5 }],
      asks: [],
      venues: [],
    });
    expect(state.book).toEqual({ bids: [{ price: 99, size: 5 }], asks: [], venues: [], byVenue: {} });
  });

  it("leaves footprint/heatmap untouched", () => {
    let state = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    state = applyBookSnapshot(state, { type: "book_snapshot", bids: [], asks: [], venues: [] });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 2, sellVol: 0 });
  });

  it("keeps the same footprint/heatmap Map reference (not just equal content) — book_snapshot fires every 150ms and downstream useMemo relies on reference stability to avoid recomputing on every tick", () => {
    const before = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    const after = applyBookSnapshot(before, { type: "book_snapshot", bids: [], asks: [], venues: [] });
    expect(after.footprint).toBe(before.footprint);
    expect(after.heatmap).toBe(before.heatmap);
  });
});

describe("applyOrderflowMessage with book_snapshot", () => {
  it("routes book_snapshot to applyBookSnapshot", () => {
    const next = applyOrderflowMessage(emptyOrderflowState(), {
      type: "book_snapshot",
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 101, size: 1 }],
      venues: ["binance-depth", "hyperliquid"],
    });
    expect(next.book.bids).toEqual([{ price: 100, size: 1 }]);
    expect(next.book.venues).toEqual(["binance-depth", "hyperliquid"]);
  });
});

describe("emptyOrderflowState", () => {
  it("starts with an empty book", () => {
    expect(emptyOrderflowState().book).toEqual({ bids: [], asks: [], venues: [], byVenue: {} });
  });

  it("starts with tapeSpeed null", () => {
    expect(emptyOrderflowState().tapeSpeed).toBeNull();
  });

  it("starts with an empty spoofAlerts list", () => {
    expect(emptyOrderflowState().spoofAlerts).toEqual([]);
  });
});

describe("applySpoofAlert", () => {
  function alertMsg(overrides: Partial<Parameters<typeof applySpoofAlert>[1]> = {}) {
    return {
      type: "spoof_alert" as const,
      ts: 100,
      side: "bid" as const,
      price: 65000,
      peak_size: 12.5,
      lifetime_sec: 1.2,
      confidence: "low" as const,
      note: "휴리스틱 신호",
      ...overrides,
    };
  }

  it("maps snake_case msg fields onto a camelCase SpoofAlert and prepends it (most recent first)", () => {
    const state = applySpoofAlert(emptyOrderflowState(), alertMsg());
    expect(state.spoofAlerts).toEqual([
      { ts: 100, side: "bid", price: 65000, peakSize: 12.5, lifetimeSec: 1.2, note: "휴리스틱 신호" },
    ]);
  });

  it("keeps most recent alert first across multiple appends", () => {
    let state = applySpoofAlert(emptyOrderflowState(), alertMsg({ ts: 1, price: 100 }));
    state = applySpoofAlert(state, alertMsg({ ts: 2, price: 200 }));
    expect(state.spoofAlerts.map((a) => a.price)).toEqual([200, 100]);
  });

  it("caps the feed at SPOOF_ALERT_FEED_MAX entries", () => {
    let state = emptyOrderflowState();
    for (let i = 0; i < 40; i++) {
      state = applySpoofAlert(state, alertMsg({ ts: i, price: i }));
    }
    expect(state.spoofAlerts.length).toBe(30);
    expect(state.spoofAlerts[0].price).toBe(39); // 가장 최근이 맨 앞
  });

  it("is reachable via applyOrderflowMessage", () => {
    const state = applyOrderflowMessage(emptyOrderflowState(), alertMsg());
    expect(state.spoofAlerts).toHaveLength(1);
  });
});

describe("applyFootprintDelta tapeSpeed tracking", () => {
  it("adopts tape_trades_per_sec from a real backend delta", () => {
    const state = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 1, tape_trades_per_sec: 0.7,
    });
    expect(state.tapeSpeed).toBe(0.7);
  });

  it("keeps the previous tapeSpeed when a delta omits it (locally synthesized reconcile delta)", () => {
    let state = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 1, tape_trades_per_sec: 0.5,
    });
    state = applyFootprintDelta(state, {
      type: "footprint_delta", bucket_ts: 0, price: 101, side: "sell", delta_vol: 1,
    });
    expect(state.tapeSpeed).toBe(0.5);
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

  it("caps largeTrades at 20 entries, dropping the oldest", () => {
    // 대량 체결끼리 연달아 오면 그 자체가 p98 문턱을 밀어올려 더 이상 "대량"으로
    // 안 잡힘(적응형 임계값의 정상 동작). 캡(20) 자체를 검증하려면 대량 체결
    // 밀도를 창(200)의 2%(p98) 밑으로 유지해야 한다 — 정상 체결 150건마다 1건 비율로
    // 충분히 신뢰성 있게 매번 플래그됨(2026-07-19 0.95→0.98/50→20 변경 후 갱신,
    // 옛 24건 비율은 새 2% 문턱을 넘겨 while 루프가 무한 대기하는 회귀가 있었음).
    let tracker = feedNormalTrades(20, 1.0);
    let ts = 3000;
    for (let round = 0; round < 25; round++) {
      for (let j = 0; j < 150; j++) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: ts++, price: 100, side: "buy", delta_vol: 1.0,
        });
      }
      tracker = applyLargeTradeTracking(tracker, {
        type: "footprint_delta", bucket_ts: ts++, price: 100, side: "buy", delta_vol: 10.0,
      });
    }
    expect(tracker.largeTrades).toHaveLength(20);
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
      venues: [], byVenue: {},
    };
    const tracker = trackerWith([{ side: "buy", size: 3 }, { side: "sell", size: 1 }]);
    expect(computeImbalance(book, tracker)).toEqual({ bookBidPct: 0.75, volBuyPct: 0.75 });
  });

  it("returns null when the book has no resting size on either side", () => {
    const book: OrderBookState = { bids: [], asks: [], venues: [], byVenue: {} };
    const tracker = trackerWith([{ side: "buy", size: 3 }]);
    expect(computeImbalance(book, tracker)).toBeNull();
  });

  it("returns null when there are no recent trades", () => {
    const book: OrderBookState = {
      bids: [{ price: 100, size: 6 }],
      asks: [{ price: 101, size: 2 }],
      venues: [], byVenue: {},
    };
    expect(computeImbalance(book, emptyLargeTradeTracker())).toBeNull();
  });
});

describe("detectIcebergLevels", () => {
  it("flags a price whose cumulative traded volume far exceeds current resting size", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 80, sellVol: 20 }]; // traded 100
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [], byVenue: {} };
    // rollingMedian=1.0 -> noiseFloor=20; traded 100 >= 20; ratio 100/10=10 >= 5x threshold
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([{ price: 100, side: "bid", ratio: 10 }]);
  });

  it("does not flag when traded volume at that price is below the noise floor", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 101, buyVol: 5, sellVol: 5 }]; // traded 10
    const book: OrderBookState = { bids: [], asks: [{ price: 101, size: 1 }], venues: [], byVenue: {} };
    // noiseFloor = 1.0 * 20 = 20; traded 10 < 20
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([]);
  });

  it("does not flag when the refill ratio is below the threshold", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 30, sellVol: 0 }]; // traded 30
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [], byVenue: {} };
    // noiseFloor=20, traded 30>=20 passes floor, but ratio 30/10=3 < 5x threshold
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual([]);
  });

  it("fails closed (returns []) when rollingMedian is 0 (not warmed up)", () => {
    const volumeProfile: VolumeProfileLevel[] = [{ price: 100, buyVol: 80, sellVol: 20 }];
    const book: OrderBookState = { bids: [{ price: 100, size: 10 }], asks: [], venues: [], byVenue: {} };
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
      venues: [], byVenue: {},
    };
    expect(detectIcebergLevels(volumeProfile, book, 1.0)).toEqual(
      expect.arrayContaining([
        { price: 100, side: "bid", ratio: 10 },
        { price: 105, side: "ask", ratio: 10 },
      ])
    );
  });
});

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

describe("computeValueArea", () => {
  it("returns null for empty or zero-volume profiles", () => {
    expect(computeValueArea([])).toBeNull();
    expect(computeValueArea([{ price: 100, buyVol: 0, sellVol: 0 }])).toBeNull();
  });

  it("finds POC and expands to cover 70% of total volume", () => {
    const levels: VolumeProfileLevel[] = [
      { price: 100, buyVol: 1, sellVol: 0 }, // 1
      { price: 101, buyVol: 2, sellVol: 1 }, // 3
      { price: 102, buyVol: 5, sellVol: 5 }, // 10 <- POC
      { price: 103, buyVol: 2, sellVol: 2 }, // 4
      { price: 104, buyVol: 1, sellVol: 1 }, // 2
    ];
    // total 20, target 14: POC(10) + above(4) = 14 → VAH 103, VAL 102
    expect(computeValueArea(levels)).toEqual({ poc: 102, vah: 103, val: 102 });
  });

  it("covers the whole range when volume is uniform", () => {
    const levels: VolumeProfileLevel[] = [
      { price: 1, buyVol: 1, sellVol: 0 },
      { price: 2, buyVol: 1, sellVol: 0 },
      { price: 3, buyVol: 1, sellVol: 0 },
    ];
    const va = computeValueArea(levels);
    expect(va?.poc).toBe(1);
    expect(va && va.vah >= va.val).toBe(true);
  });
});

describe("computeTpoProfile", () => {
  it("returns empty profile when no cells have volume", () => {
    expect(computeTpoProfile([{ bucketTs: 0, price: 100, buyVol: 0, sellVol: 0 }])).toEqual({
      levels: [],
      valueArea: null,
    });
  });

  it("assigns one letter per period and accumulates letters for prices touched across periods", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, // period 0 = 'A'
      { bucketTs: 1800, price: 100, buyVol: 1, sellVol: 0 }, // period 1 = 'B'
      { bucketTs: 1800, price: 101, buyVol: 1, sellVol: 0 }, // period 1 only
    ];
    const profile = computeTpoProfile(cells);
    const at100 = profile.levels.find((l) => l.price === 100);
    const at101 = profile.levels.find((l) => l.price === 101);
    expect(at100).toEqual({ price: 100, letters: "AB", periodsTouched: 2 });
    expect(at101).toEqual({ price: 101, letters: "B", periodsTouched: 1 });
  });

  it("wraps to lowercase letters past the 26th period", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 200, buyVol: 1, sellVol: 0 }, // anchors period 0 at ts=0
      { bucketTs: 26 * 1800, price: 100, buyVol: 1, sellVol: 0 }, // period 26 -> wraps to 'a'
    ];
    const profile = computeTpoProfile(cells);
    const at100 = profile.levels.find((l) => l.price === 100);
    expect(at100?.letters).toBe("a");
  });

  it("POC is the price touched in the most periods, reusing computeValueArea's greedy expansion", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 },
      { bucketTs: 1800, price: 100, buyVol: 1, sellVol: 0 },
      { bucketTs: 3600, price: 100, buyVol: 1, sellVol: 0 },
      { bucketTs: 0, price: 101, buyVol: 1, sellVol: 0 },
    ];
    const profile = computeTpoProfile(cells);
    expect(profile.valueArea?.poc).toBe(100);
  });

  it("honors a custom periodSec", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 },
      { bucketTs: 60, price: 100, buyVol: 1, sellVol: 0 }, // 60s period -> distinct period from ts=0
    ];
    const profile = computeTpoProfile(cells, 60);
    expect(profile.levels[0].letters).toBe("AB");
  });
});

describe("splitFootprintByUtcDay", () => {
  it("groups cells by UTC calendar day derived from bucketTs", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, // 1970-01-01
      { bucketTs: 3600, price: 101, buyVol: 1, sellVol: 0 }, // 1970-01-01
      { bucketTs: 86_400, price: 100, buyVol: 1, sellVol: 0 }, // 1970-01-02
    ];
    const days = splitFootprintByUtcDay(cells);
    expect(days).toHaveLength(2);
    expect(days[0]).toHaveLength(2);
    expect(days[1]).toHaveLength(1);
  });

  it("returns [] for no cells", () => {
    expect(splitFootprintByUtcDay([])).toEqual([]);
  });
});

describe("computeCompositeValueArea", () => {
  it("returns null when fewer than two session profiles are given", () => {
    const single: VolumeProfileLevel[] = [{ price: 100, buyVol: 5, sellVol: 0 }];
    expect(computeCompositeValueArea([single])).toBeNull();
    expect(computeCompositeValueArea([])).toBeNull();
  });

  it("merges volume across sessions by price and reuses computeValueArea's POC/VA, tagging sessionCount", () => {
    const day1: VolumeProfileLevel[] = [
      { price: 100, buyVol: 1, sellVol: 0 },
      { price: 101, buyVol: 1, sellVol: 0 },
    ];
    const day2: VolumeProfileLevel[] = [
      { price: 100, buyVol: 5, sellVol: 0 }, // pushes 100 to the heaviest price once merged
    ];
    const composite = computeCompositeValueArea([day1, day2]);
    const merged = computeValueArea([
      { price: 100, buyVol: 6, sellVol: 0 },
      { price: 101, buyVol: 1, sellVol: 0 },
    ]);
    expect(composite).toEqual({ ...merged, sessionCount: 2 });
  });

  it("returns null when merged sessions have zero total volume", () => {
    const empty: VolumeProfileLevel[] = [{ price: 100, buyVol: 0, sellVol: 0 }];
    expect(computeCompositeValueArea([empty, empty])).toBeNull();
  });
});

describe("computeVwapBands", () => {
  it("returns [] when all volume is zero", () => {
    expect(
      computeVwapBands([{ ts_event: 0, high: 10, low: 10, close: 10, volume: 0 }])
    ).toEqual([]);
  });

  it("vwap equals typical price for a single bar and bands collapse to zero width", () => {
    const pts = computeVwapBands([
      { ts_event: 60_000_000_000, high: 12, low: 8, close: 10, volume: 5 },
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].time).toBe(60);
    expect(pts[0].vwap).toBeCloseTo(10);
    expect(pts[0].up1).toBeCloseTo(10);
    expect(pts[0].dn2).toBeCloseTo(10);
  });

  it("weights vwap by volume and orders bands up2 > up1 > vwap > dn1 > dn2", () => {
    const pts = computeVwapBands([
      { ts_event: 0, high: 10, low: 10, close: 10, volume: 1 },
      { ts_event: 60_000_000_000, high: 20, low: 20, close: 20, volume: 3 },
    ]);
    const last = pts[pts.length - 1];
    expect(last.vwap).toBeCloseTo(17.5); // (10*1 + 20*3) / 4
    expect(last.up2).toBeGreaterThan(last.up1);
    expect(last.up1).toBeGreaterThan(last.vwap);
    expect(last.dn1).toBeLessThan(last.vwap);
    expect(last.dn2).toBeLessThan(last.dn1);
  });

  it("skips leading zero-volume bars but includes later ones", () => {
    const pts = computeVwapBands([
      { ts_event: 0, high: 10, low: 10, close: 10, volume: 0 },
      { ts_event: 60_000_000_000, high: 20, low: 20, close: 20, volume: 2 },
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].vwap).toBeCloseTo(20);
  });

  it("defaults to daily UTC reset — a bar past midnight starts a fresh accumulation", () => {
    const day1 = Date.UTC(2026, 0, 1, 23, 0, 0) * 1e6; // 2026-01-01 23:00 UTC
    const day2 = Date.UTC(2026, 0, 2, 0, 5, 0) * 1e6; // 2026-01-02 00:05 UTC
    const pts = computeVwapBands([
      { ts_event: day1, high: 10, low: 10, close: 10, volume: 1 },
      { ts_event: day2, high: 20, low: 20, close: 20, volume: 1 },
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[1].vwap).toBeCloseTo(20); // 하루 넘어가면서 리셋 — day1 안 섞임
  });

  it("period='week' does not reset across a same-week day boundary", () => {
    const day1 = Date.UTC(2026, 0, 1, 23, 0, 0) * 1e6;
    const day2 = Date.UTC(2026, 0, 2, 0, 5, 0) * 1e6;
    const pts = computeVwapBands(
      [
        { ts_event: day1, high: 10, low: 10, close: 10, volume: 1 },
        { ts_event: day2, high: 20, low: 20, close: 20, volume: 1 },
      ],
      "week"
    );
    expect(pts).toHaveLength(2);
    expect(pts[1].vwap).toBeCloseTo(15); // (10*1+20*1)/2 — 같은 주라 안 리셋
  });

  it("period='month' resets across a month boundary but not within it", () => {
    const midMonth = Date.UTC(2026, 0, 15, 12, 0, 0) * 1e6;
    const nextMonth = Date.UTC(2026, 1, 1, 0, 0, 0) * 1e6;
    const laterSameMonth = Date.UTC(2026, 0, 20, 0, 0, 0) * 1e6;
    const pts = computeVwapBands(
      [
        { ts_event: midMonth, high: 10, low: 10, close: 10, volume: 1 },
        { ts_event: laterSameMonth, high: 20, low: 20, close: 20, volume: 1 },
        { ts_event: nextMonth, high: 30, low: 30, close: 30, volume: 1 },
      ],
      "month"
    );
    expect(pts).toHaveLength(3);
    expect(pts[1].vwap).toBeCloseTo(15); // 같은 달, 안 리셋
    expect(pts[2].vwap).toBeCloseTo(30); // 다음 달, 리셋
  });
});

describe("computeDeltaSeries", () => {
  it("sums net delta per bucket in time order", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 120, price: 101, buyVol: 1, sellVol: 4 },
      { bucketTs: 60, price: 100, buyVol: 5, sellVol: 2 },
      { bucketTs: 60, price: 101, buyVol: 1, sellVol: 1 },
    ];
    expect(computeDeltaSeries(cells)).toEqual([
      { time: 60, value: 3 },
      { time: 120, value: -3 },
    ]);
  });

  it("returns [] for no cells", () => {
    expect(computeDeltaSeries([])).toEqual([]);
  });
});

describe("detectDeltaDivergence", () => {
  type Bar = { ts_event: number; high: number; low: number; close: number };

  function makeBars(n: number): Bar[] {
    const bars: Bar[] = [];
    for (let i = 0; i < n; i++) {
      bars.push({ ts_event: i * 60_000_000_000, high: 110, low: 90, close: 100 });
    }
    return bars;
  }

  it("flags a sell divergence: new 20-bar high with clearly negative delta", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, close: 112 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 112, buyVol: 2, sellVol: 8 }]; // net -6, total 10
    expect(detectDeltaDivergence(bars, cells)).toEqual([{ time: 1200, side: "sell" }]);
  });

  it("flags a buy divergence: new 20-bar low with clearly positive delta", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 100, low: 85, close: 88 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 88, buyVol: 8, sellVol: 2 }];
    expect(detectDeltaDivergence(bars, cells)).toEqual([{ time: 1200, side: "buy" }]);
  });

  it("ignores weak delta skew below the 25% ratio gate", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, close: 112 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 112, buyVol: 4.5, sellVol: 5.5 }]; // net -1, total 10 → 10% < 25%
    expect(detectDeltaDivergence(bars, cells)).toEqual([]);
  });

  it("ignores a new high whose delta agrees with the move (positive)", () => {
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, close: 112 };
    const cells: FootprintCell[] = [{ bucketTs: 1200, price: 112, buyVol: 8, sellVol: 2 }];
    expect(detectDeltaDivergence(bars, cells)).toEqual([]);
  });

  it("fails closed without enough bars or without footprint data for the bucket", () => {
    expect(detectDeltaDivergence(makeBars(20), [])).toEqual([]);
    const bars = makeBars(21);
    bars[20] = { ts_event: 20 * 60_000_000_000, high: 115, low: 100, close: 112 };
    expect(detectDeltaDivergence(bars, [])).toEqual([]);
  });
});

describe("computeSessionLevels", () => {
  const DAY = 86_400;

  it("returns null for empty bars", () => {
    expect(computeSessionLevels([])).toBeNull();
  });

  it("splits session and previous day by the UTC midnight of the last bar", () => {
    const bars = [
      { ts_event: (DAY - 120) * 1e9, high: 105, low: 95 }, // 전일
      { ts_event: (DAY - 60) * 1e9, high: 108, low: 98 }, // 전일
      { ts_event: DAY * 1e9, high: 110, low: 100 }, // 금일
      { ts_event: (DAY + 60) * 1e9, high: 112, low: 99 }, // 금일
    ];
    expect(computeSessionLevels(bars)).toEqual({
      sessionHigh: 112,
      sessionLow: 99,
      prevHigh: 108,
      prevLow: 95,
    });
  });

  it("returns null prev levels when no previous-day bars are held", () => {
    const bars = [{ ts_event: DAY * 1e9, high: 110, low: 100 }];
    expect(computeSessionLevels(bars)).toEqual({
      sessionHigh: 110,
      sessionLow: 100,
      prevHigh: null,
      prevLow: null,
    });
  });
});

describe("estimateLiquidationLevels", () => {
  it("price<=0 또는 OI<=0이면 빈 배열", () => {
    expect(estimateLiquidationLevels(0, 100, 0)).toEqual([]);
    expect(estimateLiquidationLevels(100, 0, 0)).toEqual([]);
    expect(estimateLiquidationLevels(-10, 100, 0)).toEqual([]);
  });

  it("funding=0이면 레버리지 구간 수 x 2(롱/숏)개 레벨, 롱/숏 비중 동일", () => {
    const levels = estimateLiquidationLevels(100, 100, 0);
    expect(levels).toHaveLength(LIQUIDATION_LEVERAGE_TIERS.length * 2);
    for (const lv of levels) {
      expect(lv.weight).toBeCloseTo(100 / LIQUIDATION_LEVERAGE_TIERS.length, 6);
    }
  });

  it("가격 오름차순 정렬 — 롱 청산가는 진입가 아래, 숏 청산가는 진입가 위", () => {
    const levels = estimateLiquidationLevels(100, 100, 0);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].price).toBeGreaterThanOrEqual(levels[i - 1].price);
    }
    for (const lv of levels) {
      if (lv.side === "long") expect(lv.price).toBeLessThan(100);
      else expect(lv.price).toBeGreaterThan(100);
    }
  });

  it("레버리지 3배 롱 청산가 = entry * (1 - 1/3 + 0.005)", () => {
    const levels = estimateLiquidationLevels(100, 100, 0);
    const lv3long = levels.find((l) => l.leverage === 3 && l.side === "long");
    expect(lv3long?.price).toBeCloseTo(100 * (1 - 1 / 3 + 0.005), 6);
  });

  it("funding 양수(롱 우위 프록시)면 롱 비중이 숏 비중보다 커진다", () => {
    const levels = estimateLiquidationLevels(100, 100, 0.0001);
    const long3 = levels.find((l) => l.leverage === 3 && l.side === "long")!;
    const short3 = levels.find((l) => l.leverage === 3 && l.side === "short")!;
    expect(long3.weight).toBeGreaterThan(short3.weight);
  });

  it("funding 극단값도 비중 스큐가 ±50%로 클램프된다(음수 weight 없음)", () => {
    const levels = estimateLiquidationLevels(100, 100, 10);
    for (const lv of levels) {
      expect(lv.weight).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("detectImbalanceCells", () => {
  it("flags a cell whose buy volume is >=3x the sell volume as a buy imbalance", () => {
    const cells: FootprintCell[] = [{ bucketTs: 0, price: 100, buyVol: 90, sellVol: 10 }];
    expect(detectImbalanceCells(cells)).toEqual([{ bucketTs: 0, price: 100, side: "buy", ratio: 9 }]);
  });

  it("flags a cell whose sell volume is >=3x the buy volume as a sell imbalance", () => {
    const cells: FootprintCell[] = [{ bucketTs: 0, price: 100, buyVol: 10, sellVol: 90 }];
    expect(detectImbalanceCells(cells)).toEqual([{ bucketTs: 0, price: 100, side: "sell", ratio: 9 }]);
  });

  it("does not flag a roughly balanced cell", () => {
    const cells: FootprintCell[] = [{ bucketTs: 0, price: 100, buyVol: 10, sellVol: 10 }];
    expect(detectImbalanceCells(cells)).toEqual([]);
  });

  it("skips cells with no volume on either side", () => {
    const cells: FootprintCell[] = [{ bucketTs: 0, price: 100, buyVol: 0, sellVol: 0 }];
    expect(detectImbalanceCells(cells)).toEqual([]);
  });
});

describe("detectStackedImbalances", () => {
  it("groups 3+ consecutive same-side imbalanced price levels in a bucket into a stack", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 90, sellVol: 10 },
      { bucketTs: 0, price: 101, buyVol: 90, sellVol: 10 },
      { bucketTs: 0, price: 102, buyVol: 90, sellVol: 10 },
    ];
    expect(detectStackedImbalances(cells)).toEqual([
      { bucketTs: 0, priceLow: 100, priceHigh: 102, side: "buy", count: 3 },
    ]);
  });

  it("does not form a stack from fewer than 3 consecutive levels", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 90, sellVol: 10 },
      { bucketTs: 0, price: 101, buyVol: 90, sellVol: 10 },
    ];
    expect(detectStackedImbalances(cells)).toEqual([]);
  });

  it("breaks the run when the side flips", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 90, sellVol: 10 },
      { bucketTs: 0, price: 101, buyVol: 90, sellVol: 10 },
      { bucketTs: 0, price: 102, buyVol: 10, sellVol: 90 },
      { bucketTs: 0, price: 103, buyVol: 10, sellVol: 90 },
    ];
    expect(detectStackedImbalances(cells)).toEqual([]);
  });
});

describe("computeColumnPoc", () => {
  it("picks the highest-volume price per bucket", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 3, sellVol: 2 }, // 5
      { bucketTs: 0, price: 101, buyVol: 4, sellVol: 5 }, // 9 <- poc
      { bucketTs: 60, price: 100, buyVol: 1, sellVol: 1 }, // 2 <- poc (only level)
    ];
    const poc = computeColumnPoc(cells);
    expect(poc.get(0)).toBe(101);
    expect(poc.get(60)).toBe(100);
  });
});

describe("computeFootprintAbsorptionLevels", () => {
  it("keeps only high-volume, low-net-delta price levels", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 50, sellVol: 50 }, // total 100, net 0 -> absorption
      { bucketTs: 0, price: 101, buyVol: 90, sellVol: 10 }, // total 100, net 80 -> too directional
      { bucketTs: 0, price: 102, buyVol: 20, sellVol: 20 }, // total 40 -> below 50% of maxVol
    ];
    expect(computeFootprintAbsorptionLevels(cells)).toEqual([{ price: 100, totalVol: 100, netDelta: 0 }]);
  });

  it("returns [] for empty input", () => {
    expect(computeFootprintAbsorptionLevels([])).toEqual([]);
  });
});

describe("computeVolumeByBucket", () => {
  it("sums buy/sell volume across price levels within each bucket, sorted ascending", () => {
    const cells: FootprintCell[] = [
      { bucketTs: 60, price: 100, buyVol: 1, sellVol: 2 },
      { bucketTs: 0, price: 100, buyVol: 3, sellVol: 1 },
      { bucketTs: 0, price: 101, buyVol: 2, sellVol: 0 },
    ];
    expect(computeVolumeByBucket(cells)).toEqual([
      { bucketTs: 0, buyVol: 5, sellVol: 1 },
      { bucketTs: 60, buyVol: 1, sellVol: 2 },
    ]);
  });
});

describe("computeNakedPocs", () => {
  it("returns [] when fewer than two days of footprint are held", () => {
    const cells: FootprintCell[] = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }];
    expect(computeNakedPocs(cells, [])).toEqual([]);
  });

  it("flags a prior day's POC as naked when no later bar retraded through it", () => {
    const footprint: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 10, sellVol: 0 }, // day 1 (1970-01-01), poc=100
      { bucketTs: 86_400, price: 200, buyVol: 5, sellVol: 0 }, // day 2 (1970-01-02, "today")
    ];
    expect(computeNakedPocs(footprint, [])).toEqual([{ price: 100, ageDays: 1 }]);
  });

  it("excludes a prior day's POC once a later bar's range covers it", () => {
    const footprint: FootprintCell[] = [
      { bucketTs: 0, price: 100, buyVol: 10, sellVol: 0 },
      { bucketTs: 86_400, price: 200, buyVol: 5, sellVol: 0 },
    ];
    const bars = [{ ts_event: 43_200 * 1e9, high: 105, low: 95 }];
    expect(computeNakedPocs(footprint, bars)).toEqual([]);
  });
});

describe("computeFibLevels", () => {
  it("returns [] when high<=low or non-finite", () => {
    expect(computeFibLevels(100, 100)).toEqual([]);
    expect(computeFibLevels(90, 100)).toEqual([]);
    expect(computeFibLevels(NaN, 100)).toEqual([]);
  });

  it("computes retracement prices from low to high, flagging the 61.8/78.6% OTE band", () => {
    const levels = computeFibLevels(110, 100);
    const byRatio = new Map(levels.map((l) => [l.ratio, l]));
    expect(byRatio.get(0)?.price).toBeCloseTo(100, 6);
    expect(byRatio.get(0.5)?.price).toBeCloseTo(105, 6);
    expect(byRatio.get(1)?.price).toBeCloseTo(110, 6);
    expect(byRatio.get(0.618)?.isOte).toBe(true);
    expect(byRatio.get(0.786)?.isOte).toBe(true);
    expect(byRatio.get(0.5)?.isOte).toBe(false);
  });
});

describe("estimateLiquidationHeatmap", () => {
  it("returns [] when price<=0 or OI<=0", () => {
    expect(estimateLiquidationHeatmap(0, 100, 0)).toEqual([]);
    expect(estimateLiquidationHeatmap(100, 0, 0)).toEqual([]);
  });

  it("places long samples below entry price and short samples above it", () => {
    const samples = estimateLiquidationHeatmap(100, 100, 0);
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      if (s.side === "long") expect(s.price).toBeLessThan(100);
      else expect(s.price).toBeGreaterThan(100);
      expect(s.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it("skews weight toward longs when funding is positive, without going negative", () => {
    const samples = estimateLiquidationHeatmap(100, 100, 10);
    const long = samples.find((s) => s.side === "long")!;
    const short = samples.find((s) => s.side === "short")!;
    expect(long.weight).toBeGreaterThan(short.weight);
    expect(short.weight).toBeGreaterThanOrEqual(0);
  });
});

describe("applyLiquidation / applyOrderflowMessage liquidation routing", () => {
  it("prepends a liquidation event to state.liquidations", () => {
    const state = applyLiquidation(emptyOrderflowState(), {
      type: "liquidation",
      ts: 1,
      price: 100,
      size: 5,
      side: "long",
      source: "binance",
    });
    expect(state.liquidations).toEqual([{ ts: 1, price: 100, size: 5, side: "long", source: "binance" }]);
  });

  it("applyOrderflowMessage routes type=liquidation to applyLiquidation", () => {
    const state = applyOrderflowMessage(emptyOrderflowState(), {
      type: "liquidation",
      ts: 1,
      price: 100,
      size: 5,
      side: "short",
      source: "binance",
    });
    expect(state.liquidations).toEqual([{ ts: 1, price: 100, size: 5, side: "short", source: "binance" }]);
  });

  it("caps the feed at LIQUIDATION_FEED_MAX, keeping the newest first", () => {
    let state = emptyOrderflowState();
    for (let i = 0; i < 105; i++) {
      state = applyLiquidation(state, { type: "liquidation", ts: i, price: 100, size: 1, side: "long", source: "binance" });
    }
    expect(state.liquidations).toHaveLength(100);
    expect(state.liquidations[0].ts).toBe(104);
  });
});
