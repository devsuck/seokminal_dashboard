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

export type OrderflowDeltaMsg = FootprintDeltaMsg | HeatmapDeltaMsg | StatusMsg;

export interface OrderflowState {
  footprint: Map<string, FootprintCell>;
  heatmap: Map<string, HeatmapCell>;
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
  return { footprint: new Map(), heatmap: new Map() };
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
  return { footprint: evictOldestFootprintBuckets(footprint), heatmap: evictOldestHeatmapBuckets(heatmap) };
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

export function applyOrderflowMessage(state: OrderflowState, msg: OrderflowDeltaMsg): OrderflowState {
  if (msg.type === "footprint_delta") return applyFootprintDelta(state, msg);
  if (msg.type === "heatmap_delta") return applyHeatmapDelta(state, msg);
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
