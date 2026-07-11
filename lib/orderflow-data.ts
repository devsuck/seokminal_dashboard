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
  venues: string[];
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
  venues: string[];
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
  return { footprint: new Map(), heatmap: new Map(), book: { bids: [], asks: [], venues: [] } };
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
    book: { bids: [], asks: [], venues: [] },
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
  return { ...state, book: { bids: msg.bids, asks: msg.asks, venues: msg.venues } };
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
  recentSides: { side: "buy" | "sell"; size: number }[];
  largeTrades: LargeTrade[];
}

const ROLLING_WINDOW = 200;
const MIN_WARMUP_SAMPLES = 20;
const LARGE_TRADE_PERCENTILE = 0.95;
const MAX_LARGE_TRADES = 50;

export function emptyLargeTradeTracker(): LargeTradeTrackerState {
  return { recentSizes: [], recentSides: [], largeTrades: [] };
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

/**
 * 최근 200건 체결 크기 중 상위 5%(p95) 넘는 체결을 "대량 체결"로 표시.
 * 표본 20건 미만(워밍업 전)은 오탐 방지를 위해 아무것도 표시하지 않는다.
 *
 * median×3 고정배수였던 이전 버전은 실제 HL 체결 사이즈 분포(극단 우편향 — p50과 p90이
 * 수십 배 차이)에서 "대량 체결은 표본 제외" 로직과 맞물려 median이 최솟값 근처로 폭주
 * 붕괴, 정상 체결 70%가 오탐되는 버그가 있었다(2026-07-11 백테스트로 확인). percentile은
 * 표본 제외 없이도 창(window) 자체가 항상 상위 5%를 가리키므로 분포 모양과 무관하게 안정적.
 */
export function applyLargeTradeTracking(
  tracker: LargeTradeTrackerState,
  msg: FootprintDeltaMsg
): LargeTradeTrackerState {
  let largeTrades = tracker.largeTrades;

  if (tracker.recentSizes.length >= MIN_WARMUP_SAMPLES) {
    const sorted = [...tracker.recentSizes].sort((a, b) => a - b);
    const threshold = percentile(sorted, LARGE_TRADE_PERCENTILE);
    if (threshold > 0 && msg.delta_vol > threshold) {
      largeTrades = [
        ...largeTrades,
        { bucketTs: msg.bucket_ts, price: msg.price, side: msg.side, size: msg.delta_vol },
      ].slice(-MAX_LARGE_TRADES);
    }
  }

  const recentSizes = [...tracker.recentSizes, msg.delta_vol].slice(-ROLLING_WINDOW);
  const recentSides = [...tracker.recentSides, { side: msg.side, size: msg.delta_vol }].slice(-ROLLING_WINDOW);

  return { recentSizes, recentSides, largeTrades };
}

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
