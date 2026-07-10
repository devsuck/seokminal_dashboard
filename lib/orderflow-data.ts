export interface FootprintCell {
  bucketTs: number;
  price: number;
  buyVol: number;
  sellVol: number;
}

export interface HeatmapCell {
  ts: number;
  price: number;
  size: number;
}

export interface BookLevel {
  price: number;
  size: number;
}

export interface OrderBookState {
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface OrderflowSnapshot {
  footprint: { bucket_ts: number; price: number; buy_vol: number; sell_vol: number }[];
  heatmap: { ts: number; price: number; size: number }[];
}

export interface FootprintDeltaMsg {
  type: "footprint_delta";
  bucket_ts: number;
  price: number;
  side: "buy" | "sell";
  delta_vol: number;
}

export interface HeatmapDeltaMsg {
  type: "heatmap_delta";
  ts: number;
  price: number;
  size: number;
}

export interface StatusMsg {
  type: "status";
  state: "reconnecting" | "live";
}

export interface BookSnapshotMsg {
  type: "book_snapshot";
  bids: BookLevel[];
  asks: BookLevel[];
}

export type OrderflowDeltaMsg = FootprintDeltaMsg | HeatmapDeltaMsg | BookSnapshotMsg | StatusMsg;

export interface OrderflowState {
  footprint: Map<string, FootprintCell>;
  heatmap: Map<string, HeatmapCell>;
  book: OrderBookState;
}

export const MAX_TIME_BUCKETS = 300;

function footprintKey(bucketTs: number, price: number): string {
  return `${bucketTs}:${price}`;
}

function heatmapKey(ts: number, price: number): string {
  return `${ts}:${price}`;
}

function evictOldestFootprintBuckets(footprint: Map<string, FootprintCell>): Map<string, FootprintCell> {
  const distinctBuckets = Array.from(new Set(Array.from(footprint.values()).map((c) => c.bucketTs))).sort(
    (a, b) => a - b
  );
  if (distinctBuckets.length <= MAX_TIME_BUCKETS) return footprint;
  const toEvict = new Set(distinctBuckets.slice(0, distinctBuckets.length - MAX_TIME_BUCKETS));
  const next = new Map<string, FootprintCell>();
  for (const [key, cell] of footprint) {
    if (!toEvict.has(cell.bucketTs)) next.set(key, cell);
  }
  return next;
}

function evictOldestHeatmapBuckets(heatmap: Map<string, HeatmapCell>): Map<string, HeatmapCell> {
  const distinctBuckets = Array.from(new Set(Array.from(heatmap.values()).map((c) => c.ts))).sort((a, b) => a - b);
  if (distinctBuckets.length <= MAX_TIME_BUCKETS) return heatmap;
  const toEvict = new Set(distinctBuckets.slice(0, distinctBuckets.length - MAX_TIME_BUCKETS));
  const next = new Map<string, HeatmapCell>();
  for (const [key, cell] of heatmap) {
    if (!toEvict.has(cell.ts)) next.set(key, cell);
  }
  return next;
}

export function emptyOrderflowState(): OrderflowState {
  return { footprint: new Map(), heatmap: new Map(), book: { bids: [], asks: [] } };
}

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

export function applyFootprintDelta(state: OrderflowState, msg: FootprintDeltaMsg): OrderflowState {
  const key = footprintKey(msg.bucket_ts, msg.price);
  const existing = state.footprint.get(key);
  const next: FootprintCell = existing
    ? {
        ...existing,
        buyVol: existing.buyVol + (msg.side === "buy" ? msg.delta_vol : 0),
        sellVol: existing.sellVol + (msg.side === "sell" ? msg.delta_vol : 0),
      }
    : {
        bucketTs: msg.bucket_ts,
        price: msg.price,
        buyVol: msg.side === "buy" ? msg.delta_vol : 0,
        sellVol: msg.side === "sell" ? msg.delta_vol : 0,
      };
  let footprint = new Map(state.footprint);
  footprint.set(key, next);
  footprint = evictOldestFootprintBuckets(footprint);
  return { ...state, footprint };
}

export function applyHeatmapDelta(state: OrderflowState, msg: HeatmapDeltaMsg): OrderflowState {
  const key = heatmapKey(msg.ts, msg.price);
  let heatmap = new Map(state.heatmap);
  heatmap.set(key, { ts: msg.ts, price: msg.price, size: msg.size });
  heatmap = evictOldestHeatmapBuckets(heatmap);
  return { ...state, heatmap };
}

export function applyBookSnapshot(state: OrderflowState, msg: BookSnapshotMsg): OrderflowState {
  return { ...state, book: { bids: msg.bids, asks: msg.asks } };
}

export function applyOrderflowMessage(state: OrderflowState, msg: OrderflowDeltaMsg): OrderflowState {
  if (msg.type === "footprint_delta") return applyFootprintDelta(state, msg);
  if (msg.type === "heatmap_delta") return applyHeatmapDelta(state, msg);
  if (msg.type === "book_snapshot") return applyBookSnapshot(state, msg);
  return state;
}

export function diffFootprintCells(prev: FootprintCell[], next: FootprintCell[]): FootprintCell[] {
  const prevByKey = new Map(prev.map((c) => [footprintKey(c.bucketTs, c.price), c]));
  return next.filter((c) => {
    const p = prevByKey.get(footprintKey(c.bucketTs, c.price));
    return !p || p.buyVol !== c.buyVol || p.sellVol !== c.sellVol;
  });
}

export function diffHeatmapCells(prev: HeatmapCell[], next: HeatmapCell[]): HeatmapCell[] {
  const prevByKey = new Map(prev.map((c) => [heatmapKey(c.ts, c.price), c]));
  return next.filter((c) => {
    const p = prevByKey.get(heatmapKey(c.ts, c.price));
    return !p || p.size !== c.size;
  });
}

export function computeFootprintLayout(cells: FootprintCell[]): { buckets: number[]; prices: number[] } {
  const buckets = Array.from(new Set(cells.map((c) => c.bucketTs))).sort((a, b) => a - b);
  const prices = Array.from(new Set(cells.map((c) => c.price))).sort((a, b) => b - a);
  return { buckets, prices };
}

export function computeHeatmapLayout(cells: HeatmapCell[]): { buckets: number[]; prices: number[] } {
  const buckets = Array.from(new Set(cells.map((c) => c.ts))).sort((a, b) => a - b);
  const prices = Array.from(new Set(cells.map((c) => c.price))).sort((a, b) => b - a);
  return { buckets, prices };
}

/**
 * 원본 heatmap은 캔들(candleIntervalSec)보다 훨씬 촘촘한 버킷(백엔드 기본 2초)이라 캔들당 셀
 * 폭이 1px 미만이 되어 사실상 안 보인다. 캔들 구간별로 (price당) 최고 잔량만 남겨 한 칸 = 캔들
 * 하나가 되도록 합친다. 합(sum)이 아니라 최댓값(max)을 쓰는 이유: 같은 잔량 주문이 여러 2초
 * 스냅샷에 걸쳐 반복 관측되므로 합산하면 중복 계산됨 — 그 구간에 실제로 존재했던 피크 잔량이
 * 의미 있는 값이다.
 */
export function aggregateHeatmapByCandle(cells: HeatmapCell[], candleIntervalSec: number): HeatmapCell[] {
  const byKey = new Map<string, HeatmapCell>();
  for (const c of cells) {
    const barTime = Math.floor(c.ts / candleIntervalSec) * candleIntervalSec;
    const key = heatmapKey(barTime, c.price);
    const existing = byKey.get(key);
    if (!existing || c.size > existing.size) {
      byKey.set(key, { ts: barTime, price: c.price, size: c.size });
    }
  }
  return Array.from(byKey.values());
}

/** "BTC.HL"/"ETH.HL" -> "BTC"/"ETH", 그 외 심볼은 null(옵션플로우 패널 미지원, Deribit은 BTC/ETH만 취급). */
export function currencyForSymbol(symbol: string): "BTC" | "ETH" | null {
  if (symbol === "BTC.HL") return "BTC";
  if (symbol === "ETH.HL") return "ETH";
  return null;
}

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
  let largeTrades = tracker.largeTrades;
  let isLarge = false;

  if (tracker.recentSizes.length >= MIN_WARMUP_SAMPLES) {
    const m = median(tracker.recentSizes);
    if (m > 0 && msg.delta_vol > m * LARGE_TRADE_MULTIPLIER) {
      isLarge = true;
      largeTrades = [
        ...largeTrades,
        { bucketTs: msg.bucket_ts, price: msg.price, side: msg.side, size: msg.delta_vol },
      ].slice(-MAX_LARGE_TRADES);
    }
  }

  // 대량 체결(outlier) 자체는 이동중앙값 표본에서 제외한다 — 안 그러면 연속 대량 체결이
  // 기준선(median)을 끌어올려 이후 대량 체결을 놓치게 된다(아이스버그 반복 체결 시 특히 문제).
  const recentSizes = isLarge
    ? tracker.recentSizes
    : [...tracker.recentSizes, msg.delta_vol].slice(-ROLLING_WINDOW);

  return { recentSizes, largeTrades };
}

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
