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

export interface VenueBook {
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface OrderBookState {
  bids: BookLevel[];
  asks: BookLevel[];
  venues: string[];
  /** 거래소별 원장(풀링 전, 반올림/합산 없음) — 3분할 래더(BIN/BYBIT/HL) 컬럼용. 없는 거래소 키는 미도착. */
  byVenue: Record<string, VenueBook>;
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
  /** 백엔드 aggregator가 실제 체결 이벤트마다 계산해 보냄(10s 롤링 건수/초). 프론트에서
   * 합성한 footprint_delta(폴링 리컨실 등)에는 대응하는 실체결이 없으므로 optional. */
  tape_trades_per_sec?: number;
  /** 실제 체결 시각(unix seconds) — tape_trades_per_sec과 동일 사유로 optional, 있으면 체결 테이프용 개별 프린트로 취급. */
  ts?: number;
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
  by_venue?: Record<string, VenueBook>;
}

/** 실제 강제청산 체결 이벤트(추정치 estimateLiquidationLevels와 다름) — 현재 유일한 소스는
 * Binance 선물 forceOrder 퍼블릭 스트림. HL 자체 청산 아님, 프론트에서 반드시 출처 라벨과 함께 노출. */
export interface LiquidationMsg {
  type: "liquidation";
  ts: number;
  price: number;
  size: number;
  side: "long" | "short";
  source: "binance";
}

/** 스푸핑 의심 휴리스틱 — L2 스냅샷(가격×잔량)만으로 만든 패턴 매칭, order-id 기반 진짜
 * 스푸핑 탐지가 아니다. 항상 confidence:"low" + note 문구와 함께 취급할 것(backend orderflow/aggregator.py 참고). */
export interface SpoofAlertMsg {
  type: "spoof_alert";
  ts: number;
  side: "bid" | "ask";
  price: number;
  peak_size: number;
  lifetime_sec: number;
  confidence: "low";
  note: string;
}

export type OrderflowDeltaMsg =
  | FootprintDeltaMsg
  | HeatmapDeltaMsg
  | BookSnapshotMsg
  | SpoofAlertMsg
  | LiquidationMsg
  | StatusMsg;

export interface SpoofAlert {
  ts: number;
  side: "bid" | "ask";
  price: number;
  peakSize: number;
  lifetimeSec: number;
  note: string;
}

/** 패널 이벤트 피드에 표시할 최근 스푸핑 의심 알림 개수 상한. */
export const SPOOF_ALERT_FEED_MAX = 30;

export interface RecentTrade {
  ts: number;
  price: number;
  side: "buy" | "sell";
  size: number;
}

/** 체결 테이프에 들고 있을 최근 개별 체결 건수 상한 — snapshot에 과거분 없음(라이브 이벤트 전용). */
export const TRADE_TAPE_MAX = 100;

export interface LiqEvent {
  ts: number;
  price: number;
  size: number;
  side: "long" | "short";
  source: "binance";
}

/** "Liq Bubbles" 피드에 들고 있을 최근 청산 이벤트 건수 상한 — snapshot에 과거분 없음(라이브 이벤트 전용). */
export const LIQUIDATION_FEED_MAX = 100;

export interface OrderflowState {
  footprint: Map<string, FootprintCell>;
  heatmap: Map<string, HeatmapCell>;
  book: OrderBookState;
  /** 체결속도(건/초) — 최근 실체결 footprint_delta의 tape_trades_per_sec. 웜업 전(첫 실체결
   * 도착 전)엔 null, snapshot()만으로는 채워지지 않음(과거 벌크 데이터엔 실시간 속도 개념 없음). */
  tapeSpeed: number | null;
  /** 최근 스푸핑 의심 알림(최신순, 최대 SPOOF_ALERT_FEED_MAX개) — snapshot에 과거분 없음(라이브 이벤트 전용). */
  spoofAlerts: SpoofAlert[];
  /** 최근 개별 체결(최신순, 최대 TRADE_TAPE_MAX건) — footprint_delta 중 ts 있는(실체결) 것만 누적. */
  recentTrades: RecentTrade[];
  /** 실제 청산 체결(최신순, 최대 LIQUIDATION_FEED_MAX건) — Binance 소스, snapshot에 과거분 없음(라이브 전용). */
  liquidations: LiqEvent[];
}

export const MAX_TIME_BUCKETS = 300;
// heatmap은 footprint(60s 버킷)보다 30배 촘촘한 2s 버킷이라 같은 버킷 개수 캡을 쓰면
// 10분밖에 안 쌓인다(구 MAX_TIME_BUCKETS 공용 캡의 한계). 실시간 매매용 유동성 풀 시야를
// 확보하려면 기본 차트 가시 범위(~90분)만큼은 클라이언트에 누적돼야 한다 — 백엔드가
// 이제(diff+연결당 최근 슬라이스만 스냅샷) 스트림 비용을 줄여놨으므로 접속 유지 중인 클라는
// 계속 들어오는 delta로 이 캡까지 자연스럽게 채워진다.
export const MAX_HEATMAP_TIME_BUCKETS = 2700; // 2s * 2700 = 5400s = 90min

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
  if (distinctBuckets.length <= MAX_HEATMAP_TIME_BUCKETS) return heatmap;
  const toEvict = new Set(distinctBuckets.slice(0, distinctBuckets.length - MAX_HEATMAP_TIME_BUCKETS));
  const next = new Map<string, HeatmapCell>();
  for (const [key, cell] of heatmap) {
    if (!toEvict.has(cell.ts)) next.set(key, cell);
  }
  return next;
}

export function emptyOrderflowState(): OrderflowState {
  return {
    footprint: new Map(),
    heatmap: new Map(),
    book: { bids: [], asks: [], venues: [], byVenue: {} },
    tapeSpeed: null,
    spoofAlerts: [],
    recentTrades: [],
    liquidations: [],
  };
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
    book: { bids: [], asks: [], venues: [], byVenue: {} },
    tapeSpeed: null,
    spoofAlerts: [],
    recentTrades: [],
    liquidations: [],
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
  const recentTrades =
    msg.ts !== undefined
      ? [{ ts: msg.ts, price: msg.price, side: msg.side, size: msg.delta_vol }, ...state.recentTrades].slice(
          0,
          TRADE_TAPE_MAX
        )
      : state.recentTrades;
  return {
    ...state,
    footprint,
    tapeSpeed: msg.tape_trades_per_sec ?? state.tapeSpeed,
    recentTrades,
  };
}

export function applyHeatmapDelta(state: OrderflowState, msg: HeatmapDeltaMsg): OrderflowState {
  const key = heatmapKey(msg.ts, msg.price);
  let heatmap = new Map(state.heatmap);
  heatmap.set(key, { ts: msg.ts, price: msg.price, size: msg.size });
  heatmap = evictOldestHeatmapBuckets(heatmap);
  return { ...state, heatmap };
}

export function applyBookSnapshot(state: OrderflowState, msg: BookSnapshotMsg): OrderflowState {
  return { ...state, book: { bids: msg.bids, asks: msg.asks, venues: msg.venues, byVenue: msg.by_venue ?? {} } };
}

export function applyLiquidation(state: OrderflowState, msg: LiquidationMsg): OrderflowState {
  const event: LiqEvent = { ts: msg.ts, price: msg.price, size: msg.size, side: msg.side, source: msg.source };
  return { ...state, liquidations: [event, ...state.liquidations].slice(0, LIQUIDATION_FEED_MAX) };
}

export function applySpoofAlert(state: OrderflowState, msg: SpoofAlertMsg): OrderflowState {
  const alert: SpoofAlert = {
    ts: msg.ts,
    side: msg.side,
    price: msg.price,
    peakSize: msg.peak_size,
    lifetimeSec: msg.lifetime_sec,
    note: msg.note,
  };
  return { ...state, spoofAlerts: [alert, ...state.spoofAlerts].slice(0, SPOOF_ALERT_FEED_MAX) };
}

export function applyOrderflowMessage(state: OrderflowState, msg: OrderflowDeltaMsg): OrderflowState {
  if (msg.type === "footprint_delta") return applyFootprintDelta(state, msg);
  if (msg.type === "heatmap_delta") return applyHeatmapDelta(state, msg);
  if (msg.type === "book_snapshot") return applyBookSnapshot(state, msg);
  if (msg.type === "spoof_alert") return applySpoofAlert(state, msg);
  if (msg.type === "liquidation") return applyLiquidation(state, msg);
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

const FOOTPRINT_IMBALANCE_RATIO = 3; // 한쪽이 반대쪽의 300% 이상이면 임밸런스로 간주(표준 풋프린트 기준)
const FOOTPRINT_STACK_MIN_RUN = 3; // 연속 3개 가격 레벨 이상 같은 방향 임밸런스면 "스택"

export interface FootprintImbalanceCell {
  bucketTs: number;
  price: number;
  side: "buy" | "sell";
  ratio: number;
}

/** 같은 가격 셀에서 매수/매도 한쪽이 압도적으로 우세한 지점(임밸런스) 탐지 — 공격적 일방향 체결 신호. */
export function detectImbalanceCells(cells: FootprintCell[]): FootprintImbalanceCell[] {
  const out: FootprintImbalanceCell[] = [];
  for (const c of cells) {
    if (c.buyVol <= 0 && c.sellVol <= 0) continue;
    const buyRatio = c.buyVol / Math.max(c.sellVol, 1e-9);
    const sellRatio = c.sellVol / Math.max(c.buyVol, 1e-9);
    if (buyRatio >= FOOTPRINT_IMBALANCE_RATIO) out.push({ bucketTs: c.bucketTs, price: c.price, side: "buy", ratio: buyRatio });
    else if (sellRatio >= FOOTPRINT_IMBALANCE_RATIO) out.push({ bucketTs: c.bucketTs, price: c.price, side: "sell", ratio: sellRatio });
  }
  return out;
}

function inferFootprintTickSize(cells: FootprintCell[]): number {
  const prices = Array.from(new Set(cells.map((c) => c.price))).sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0 && d < min) min = d;
  }
  return Number.isFinite(min) ? min : 0.01;
}

export interface StackedImbalance {
  bucketTs: number;
  priceLow: number;
  priceHigh: number;
  side: "buy" | "sell";
  count: number;
}

/** 한 캔들 안에서 연속된 가격 레벨이 같은 방향으로 임밸런스나면 "스택" — 추세 지속/흡수 반전의 핵심 근거. */
export function detectStackedImbalances(cells: FootprintCell[]): StackedImbalance[] {
  const imbalances = detectImbalanceCells(cells);
  if (imbalances.length === 0) return [];
  const tickSize = inferFootprintTickSize(cells);
  const byBucket = new Map<number, FootprintImbalanceCell[]>();
  for (const im of imbalances) {
    const arr = byBucket.get(im.bucketTs) ?? [];
    arr.push(im);
    byBucket.set(im.bucketTs, arr);
  }
  const out: StackedImbalance[] = [];
  for (const [bucketTs, arr] of byBucket) {
    arr.sort((a, b) => a.price - b.price);
    let runStart = 0;
    for (let i = 1; i <= arr.length; i++) {
      const broke =
        i === arr.length ||
        arr[i].side !== arr[i - 1].side ||
        Math.abs(arr[i].price - arr[i - 1].price - tickSize) > tickSize * 0.5;
      if (broke) {
        const runLen = i - runStart;
        if (runLen >= FOOTPRINT_STACK_MIN_RUN) {
          out.push({
            bucketTs,
            priceLow: arr[runStart].price,
            priceHigh: arr[i - 1].price,
            side: arr[runStart].side,
            count: runLen,
          });
        }
        runStart = i;
      }
    }
  }
  return out;
}

/** 캔들(bucketTs)별 최대 체결량 가격 — 그 캔들의 "중심"으로 풋프린트에서 굵게 강조. */
export function computeColumnPoc(cells: FootprintCell[]): Map<number, number> {
  const best = new Map<number, { price: number; vol: number }>();
  for (const c of cells) {
    const vol = c.buyVol + c.sellVol;
    const cur = best.get(c.bucketTs);
    if (!cur || vol > cur.vol) best.set(c.bucketTs, { price: c.price, vol });
  }
  return new Map(Array.from(best.entries()).map(([bucketTs, v]) => [bucketTs, v.price]));
}

export interface FootprintAbsorptionLevel {
  price: number;
  totalVol: number;
  netDelta: number;
}

/** 세션 누적 기준 거래량은 많은데 순델타 비중은 낮은 가격대 — 양쪽이 맞붙어 못 밀린 "흡수" 레벨. */
export function computeFootprintAbsorptionLevels(cells: FootprintCell[], topN = 5): FootprintAbsorptionLevel[] {
  const byPrice = new Map<number, { buy: number; sell: number }>();
  for (const c of cells) {
    const e = byPrice.get(c.price) ?? { buy: 0, sell: 0 };
    e.buy += c.buyVol;
    e.sell += c.sellVol;
    byPrice.set(c.price, e);
  }
  const rows = Array.from(byPrice.entries())
    .map(([price, { buy, sell }]) => ({ price, totalVol: buy + sell, netDelta: buy - sell }))
    .filter((r) => r.totalVol > 0);
  if (rows.length === 0) return [];
  const maxVol = Math.max(...rows.map((r) => r.totalVol));
  return rows
    .filter((r) => r.totalVol >= maxVol * 0.5 && Math.abs(r.netDelta) / r.totalVol < 0.2)
    .sort((a, b) => b.totalVol - a.totalVol)
    .slice(0, topN);
}

export interface NakedPoc {
  price: number;
  ageDays: number;
}

/**
 * 지난 UTC일들의 POC 중 그날 이후로 한 번도 재테스트(가격이 다시 지나감) 안 된 레벨 — "네이키드 POC".
 * 시장이 아직 안 갚은 빚처럼 강하게 끌어당기는 자석 레벨로 취급된다.
 */
export function computeNakedPocs(
  footprint: FootprintCell[],
  bars: { ts_event: number; high: number; low: number }[]
): NakedPoc[] {
  const days = splitFootprintByUtcDay(footprint);
  if (days.length < 2) return [];

  const dayPocs = days
    .map((cells) => {
      if (cells.length === 0) return null;
      const va = computeValueArea(computeVolumeProfile(cells));
      if (!va) return null;
      const dayEndTs = Math.max(...cells.map((c) => c.bucketTs));
      return { price: va.poc, dayEndTs };
    })
    .filter((p): p is { price: number; dayEndTs: number } => p !== null)
    .sort((a, b) => a.dayEndTs - b.dayEndTs);

  if (dayPocs.length < 2) return [];
  const latestTs = dayPocs[dayPocs.length - 1].dayEndTs;
  const completedDayPocs = dayPocs.slice(0, -1); // 진행 중인 오늘은 제외

  return completedDayPocs
    .filter(
      (p) =>
        !bars.some((b) => {
          const sec = Math.floor(b.ts_event / 1e9);
          return sec > p.dayEndTs && b.low <= p.price && b.high >= p.price;
        })
    )
    .map((p) => ({ price: p.price, ageDays: Math.max(1, Math.round((latestTs - p.dayEndTs) / 86400)) }));
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

/** "COIN.HL" -> "COIN", 그 외 심볼은 null. 펀딩비+OI는 Hyperliquid 전 종목 지원(BTC/ETH 한정 아님). */
export function hlCoinForSymbol(symbol: string): string | null {
  if (!symbol.endsWith(".HL")) return null;
  const coin = symbol.slice(0, -".HL".length);
  return coin.length > 0 ? coin : null;
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
export const MIN_WARMUP_SAMPLES = 20;
// 0.95면 캔들 하나에 여러 가격행이 동시에 걸려 버블이 겹쳐 노이즈가 심해짐 — 0.98(상위 2%)로 좁힘.
const LARGE_TRADE_PERCENTILE = 0.98;
const MAX_LARGE_TRADES = 20;

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

const VALUE_AREA_PCT = 0.7;

export interface ValueArea {
  poc: number;
  vah: number;
  val: number;
}

/**
 * 볼륨 프로파일에서 POC(최다 체결가)와 Value Area(체결량 70% 구간)를 계산.
 * POC에서 시작해 위/아래 인접 행 중 체결량이 큰 쪽을 탐욕적으로 편입한다.
 */
export function computeValueArea(levels: VolumeProfileLevel[]): ValueArea | null {
  if (levels.length === 0) return null;
  const rows = [...levels]
    .map((l) => ({ price: l.price, vol: l.buyVol + l.sellVol }))
    .sort((a, b) => a.price - b.price);
  const total = rows.reduce((s, r) => s + r.vol, 0);
  if (total <= 0) return null;

  let pocIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].vol > rows[pocIdx].vol) pocIdx = i;
  }

  let lo = pocIdx;
  let hi = pocIdx;
  let covered = rows[pocIdx].vol;
  const target = total * VALUE_AREA_PCT;
  while (covered < target && (lo > 0 || hi < rows.length - 1)) {
    const below = lo > 0 ? rows[lo - 1].vol : -1;
    const above = hi < rows.length - 1 ? rows[hi + 1].vol : -1;
    if (above >= below) {
      hi += 1;
      covered += rows[hi].vol;
    } else {
      lo -= 1;
      covered += rows[lo].vol;
    }
  }
  return { poc: rows[pocIdx].price, vah: rows[hi].price, val: rows[lo].price };
}

export interface CompositeValueArea extends ValueArea {
  sessionCount: number;
}

/** bucketTs(초) 기준 UTC 캘린더 일자 키 — 크립토 24/7이라 거래소 세션 개념 없음, VWAP의 day 앵커와 동일 규칙. */
function footprintDayKey(bucketTs: number): string {
  return new Date(bucketTs * 1000).toISOString().slice(0, 10);
}

/** footprint 셀을 UTC 일자별로 분리 — Composite VA(다중 세션 합성)의 세션 단위. */
export function splitFootprintByUtcDay(cells: FootprintCell[]): FootprintCell[][] {
  const byDay = new Map<string, FootprintCell[]>();
  for (const c of cells) {
    const key = footprintDayKey(c.bucketTs);
    const arr = byDay.get(key);
    if (arr) arr.push(c);
    else byDay.set(key, [c]);
  }
  return Array.from(byDay.values());
}

/**
 * 여러 세션(day)의 볼륨 프로파일을 가격대별로 합산한 뒤 computeValueArea를 그대로 재사용
 * (TPO와 동일 패턴 — 신규 POC/VA 로직 없음). 세션이 1개뿐이면 "합성"의 의미가 없어 null —
 * 클라 버퍼가 MAX_TIME_BUCKETS=300*60s≈5시간이라 실제로는 버퍼가 UTC 자정을 걸치는 구간에서만
 * 세션 2개 이상이 잡힌다(정직한 게이트: 데이터 없으면 표시 안 함).
 */
export function computeCompositeValueArea(dayProfiles: VolumeProfileLevel[][]): CompositeValueArea | null {
  if (dayProfiles.length < 2) return null;
  const merged = new Map<number, VolumeProfileLevel>();
  for (const profile of dayProfiles) {
    for (const lvl of profile) {
      const existing = merged.get(lvl.price) ?? { price: lvl.price, buyVol: 0, sellVol: 0 };
      existing.buyVol += lvl.buyVol;
      existing.sellVol += lvl.sellVol;
      merged.set(lvl.price, existing);
    }
  }
  const va = computeValueArea(Array.from(merged.values()));
  return va ? { ...va, sessionCount: dayProfiles.length } : null;
}

// Market Profile(TPO) — 30분 구간을 알파벳 1글자에 대응(전통적 CBOT 관례), 결과 보고 튜닝 안 함.
export const TPO_PERIOD_SEC = 1800;
const TPO_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 26개(대문자 A-Z) 넘는 구간(13시간+)은 소문자로 이어감 — 대문자 다 쓰면 소문자로 wrap하는 일반적 TPO 관례. */
function tpoLetterForPeriod(periodIdx: number): string {
  const letter = TPO_ALPHABET[periodIdx % 26];
  return periodIdx < 26 ? letter : letter.toLowerCase();
}

export interface TpoLevel {
  price: number;
  letters: string;
  periodsTouched: number;
}

export interface TpoProfile {
  levels: TpoLevel[];
  valueArea: ValueArea | null;
}

/**
 * 시간대별(TPO_PERIOD_SEC) 가격 분포 — 체결량이 아니라 "이 가격이 몇 개 구간에서 찍혔는가"로
 * POC/VA를 판정(전통적 Market Profile). computeValueArea를 그대로 재사용(periodsTouched를
 * buyVol 자리에 넣어 동일 그리디 확장 알고리즘 적용) — 신규 POC/VA 로직 없음.
 */
export function computeTpoProfile(cells: FootprintCell[], periodSec: number = TPO_PERIOD_SEC): TpoProfile {
  const traded = cells.filter((c) => c.buyVol + c.sellVol > 0);
  if (traded.length === 0) return { levels: [], valueArea: null };

  const anchor = Math.min(...traded.map((c) => c.bucketTs));
  const periodsByPrice = new Map<number, Set<number>>();
  for (const c of traded) {
    const periodIdx = Math.floor((c.bucketTs - anchor) / periodSec);
    const periods = periodsByPrice.get(c.price) ?? new Set<number>();
    periods.add(periodIdx);
    periodsByPrice.set(c.price, periods);
  }

  const levels: TpoLevel[] = Array.from(periodsByPrice.entries())
    .map(([price, periods]) => {
      const sorted = Array.from(periods).sort((a, b) => a - b);
      return { price, letters: sorted.map(tpoLetterForPeriod).join(""), periodsTouched: periods.size };
    })
    .sort((a, b) => b.price - a.price);

  const valueArea = computeValueArea(levels.map((l) => ({ price: l.price, buyVol: l.periodsTouched, sellVol: 0 })));
  return { levels, valueArea };
}

export interface VwapPoint {
  time: number;
  vwap: number;
  up1: number;
  dn1: number;
  up2: number;
  dn2: number;
}

export type VwapPeriod = "day" | "week" | "month";

/** UTC 캘린더 기준 앵커 키 — 크립토는 24/7이라 거래소 세션 개념 없음, UTC로 통일.
 * week는 ISO 주(월요일 시작) 대신 UTC epoch/7일 버킷으로 단순화 — 앵커 경계 일관성만 있으면 되고
 * 실제 ISO 주 경계 여부는 중요하지 않음(밴드 anchor 재설정 타이밍 문제일 뿐). */
function vwapPeriodKey(tsEventNs: number, period: VwapPeriod): string {
  const d = new Date(Math.floor(tsEventNs / 1e6));
  if (period === "day") return d.toISOString().slice(0, 10);
  if (period === "month") return d.toISOString().slice(0, 7);
  const dayBucket = Math.floor(d.getTime() / 86_400_000 / 7);
  return `w${dayBucket}`;
}

/**
 * period 경계(일/주/월, UTC)마다 리셋되는 VWAP과 ±1σ/±2σ 밴드. 거래량 가중 분산은
 * σ² = Σ(v·tp²)/Σv − vwap² 증분식으로 계산. 누적 거래량 0인 선두 구간은 건너뜀.
 */
export function computeVwapBands(
  bars: { ts_event: number; high: number; low: number; close: number; volume: number }[],
  period: VwapPeriod = "day"
): VwapPoint[] {
  const out: VwapPoint[] = [];
  let cumV = 0;
  let cumPV = 0;
  let cumPV2 = 0;
  let curKey: string | null = null;
  for (const b of bars) {
    const key = vwapPeriodKey(b.ts_event, period);
    if (key !== curKey) {
      curKey = key;
      cumV = 0;
      cumPV = 0;
      cumPV2 = 0;
    }
    const tp = (b.high + b.low + b.close) / 3;
    const v = b.volume > 0 ? b.volume : 0;
    cumV += v;
    cumPV += tp * v;
    cumPV2 += tp * tp * v;
    if (cumV <= 0) continue;
    const vwap = cumPV / cumV;
    const variance = Math.max(0, cumPV2 / cumV - vwap * vwap);
    const sd = Math.sqrt(variance);
    out.push({
      time: Math.floor(b.ts_event / 1e9),
      vwap,
      up1: vwap + sd,
      dn1: vwap - sd,
      up2: vwap + 2 * sd,
      dn2: vwap - 2 * sd,
    });
  }
  return out;
}

export interface VolumeBucket {
  bucketTs: number;
  buyVol: number;
  sellVol: number;
}

/** 버킷(캔들)별 매수/매도 체결량 합계 — 차트 배경 전체폭 Volume 바용(OI 아님, 가격대별 OI 분포 데이터 없어
 * 정직성 원칙상 체결량만 표시). 가격 레벨 무관하게 그 캔들에서 일어난 전체 체결량. */
export function computeVolumeByBucket(cells: FootprintCell[]): VolumeBucket[] {
  const byBucket = new Map<number, VolumeBucket>();
  for (const c of cells) {
    const e = byBucket.get(c.bucketTs) ?? { bucketTs: c.bucketTs, buyVol: 0, sellVol: 0 };
    e.buyVol += c.buyVol;
    e.sellVol += c.sellVol;
    byBucket.set(c.bucketTs, e);
  }
  return Array.from(byBucket.values()).sort((a, b) => a.bucketTs - b.bucketTs);
}

/** 버킷(캔들)별 순델타(매수량-매도량) — CVD의 비누적 버전, 델타 히스토그램 서브페인용. */
export function computeDeltaSeries(cells: FootprintCell[]): { time: number; value: number }[] {
  const netByBucket = new Map<number, number>();
  for (const c of cells) {
    netByBucket.set(c.bucketTs, (netByBucket.get(c.bucketTs) ?? 0) + (c.buyVol - c.sellVol));
  }
  return Array.from(netByBucket.keys())
    .sort((a, b) => a - b)
    .map((time) => ({ time, value: netByBucket.get(time) as number }));
}

const DIVERGENCE_LOOKBACK_BARS = 20;
/** 다이버전스로 인정할 최소 델타 편향 — |델타| ≥ 버킷 총 체결량의 25%. */
const DIVERGENCE_MIN_DELTA_RATIO = 0.25;

/**
 * 델타 다이버전스: 최근 20봉 신고가인데 그 캔들 델타가 뚜렷하게 매도 우위면 sell(약한 고점),
 * 신저가인데 매수 우위면 buy(약한 저점). 델타 편향이 총량의 25% 미만이면 노이즈로 보고 무시.
 */
export function detectDeltaDivergence(
  bars: { ts_event: number; high: number; low: number; close: number }[],
  cells: FootprintCell[]
): { time: number; side: "buy" | "sell" }[] {
  if (bars.length <= DIVERGENCE_LOOKBACK_BARS) return [];

  const deltaByBucket = new Map<number, { net: number; total: number }>();
  for (const c of cells) {
    const cur = deltaByBucket.get(c.bucketTs) ?? { net: 0, total: 0 };
    cur.net += c.buyVol - c.sellVol;
    cur.total += c.buyVol + c.sellVol;
    deltaByBucket.set(c.bucketTs, cur);
  }

  const results: { time: number; side: "buy" | "sell" }[] = [];
  for (let i = DIVERGENCE_LOOKBACK_BARS; i < bars.length; i++) {
    const bar = bars[i];
    const bucketTs = Math.floor(bar.ts_event / 1e9);
    const delta = deltaByBucket.get(bucketTs);
    if (!delta || delta.total <= 0) continue;
    if (Math.abs(delta.net) < delta.total * DIVERGENCE_MIN_DELTA_RATIO) continue;

    const window = bars.slice(i - DIVERGENCE_LOOKBACK_BARS, i);
    const recentHigh = Math.max(...window.map((b) => b.high));
    const recentLow = Math.min(...window.map((b) => b.low));

    if (bar.high > recentHigh && delta.net < 0) {
      results.push({ time: bucketTs, side: "sell" });
    } else if (bar.low < recentLow && delta.net > 0) {
      results.push({ time: bucketTs, side: "buy" });
    }
  }
  return results;
}

export interface SessionLevels {
  sessionHigh: number;
  sessionLow: number;
  prevHigh: number | null;
  prevLow: number | null;
}

const DAY_SEC = 86_400;

/**
 * 마지막 bar가 속한 UTC 일 기준의 세션 고저 + 전일 고저. 크립토 관례(UTC 자정 세션 경계)를 따른다.
 * 전일 bar가 보유 구간에 없으면 prev는 null.
 */
export function computeSessionLevels(
  bars: { ts_event: number; high: number; low: number }[]
): SessionLevels | null {
  if (bars.length === 0) return null;
  const lastSec = Math.floor(bars[bars.length - 1].ts_event / 1e9);
  const dayStart = Math.floor(lastSec / DAY_SEC) * DAY_SEC;
  const prevDayStart = dayStart - DAY_SEC;

  let sessionHigh = -Infinity;
  let sessionLow = Infinity;
  let prevHigh = -Infinity;
  let prevLow = Infinity;
  for (const b of bars) {
    const sec = Math.floor(b.ts_event / 1e9);
    if (sec >= dayStart) {
      sessionHigh = Math.max(sessionHigh, b.high);
      sessionLow = Math.min(sessionLow, b.low);
    } else if (sec >= prevDayStart) {
      prevHigh = Math.max(prevHigh, b.high);
      prevLow = Math.min(prevLow, b.low);
    }
  }
  if (!Number.isFinite(sessionHigh)) return null;
  return {
    sessionHigh,
    sessionLow,
    prevHigh: Number.isFinite(prevHigh) ? prevHigh : null,
    prevLow: Number.isFinite(prevLow) ? prevLow : null,
  };
}

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
  /** ICT OTE(Optimal Trade Entry, 61.8~78.6%) 구간 강조용. */
  isOte: boolean;
}

const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * 세션 고저(sessionLevels) 구간의 피보나치 되돌림 — ICT 프리미엄(50% 위, 매도 관점)/디스카운트(50% 아래, 매수 관점) 판단용.
 * 방향성(상승/하락) 추세 판정 없이 항상 저→고 기준으로 그림 — 어느 쪽이 "되돌림 목표"인지는 현재가 위치로 유저가 해석.
 */
export function computeFibLevels(high: number, low: number): FibLevel[] {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) return [];
  const range = high - low;
  return FIB_RATIOS.map((ratio) => ({
    ratio,
    price: low + ratio * range,
    label: `Fib ${(ratio * 100).toFixed(1)}%`,
    isOte: ratio === 0.618 || ratio === 0.786,
  }));
}

export interface LiqLevel {
  price: number;
  side: "long" | "short";
  weight: number;
  leverage: number;
}

/** HL 주요 코인 실제 최대 레버리지 상한(40x, BTC 기준) 이내 구간만 사용 — 50x는 실제로 열 수 없는 포지션이라 제외. */
export const LIQUIDATION_LEVERAGE_TIERS = [3, 5, 10, 20, 40] as const;
const LIQUIDATION_MAINTENANCE_MARGIN_RATE = 0.005;
const LIQUIDATION_FUNDING_SKEW_SCALE = 1000;

/**
 * OI(미결제약정)+funding 부호로 청산가 클러스터를 추정한다 — 실제 청산 데이터가 아닌 근사치.
 * 레버리지 구간별로 OI를 균등 분산하고, funding 부호(롱/숏 우위 프록시)로 롱/숏 비중만 약하게 보정한다.
 * 각 구간의 청산가는 `entry * (1 - 1/leverage + maintenance_margin_rate)`(롱)로 근사한다.
 */
export function estimateLiquidationLevels(price: number, openInterest: number, funding: number): LiqLevel[] {
  if (price <= 0 || openInterest <= 0) return [];

  const skew = Math.max(-0.5, Math.min(0.5, funding * LIQUIDATION_FUNDING_SKEW_SCALE));
  const baseWeight = openInterest / LIQUIDATION_LEVERAGE_TIERS.length;
  const longWeight = baseWeight * (1 + skew);
  const shortWeight = baseWeight * (1 - skew);

  const levels: LiqLevel[] = [];
  for (const leverage of LIQUIDATION_LEVERAGE_TIERS) {
    const dist = 1 / leverage - LIQUIDATION_MAINTENANCE_MARGIN_RATE;
    if (dist <= 0) continue;
    levels.push({ price: price * (1 - dist), side: "long", weight: longWeight, leverage });
    levels.push({ price: price * (1 + dist), side: "short", weight: shortWeight, leverage });
  }
  return levels.sort((a, b) => a.price - b.price);
}

export interface LiqHeatmapSample {
  price: number;
  side: "long" | "short";
  weight: number;
}

const LIQUIDATION_HEATMAP_MIN_LEVERAGE = 2;
const LIQUIDATION_HEATMAP_MAX_LEVERAGE = 40;
const LIQUIDATION_HEATMAP_SAMPLES = 48;

/**
 * estimateLiquidationLevels와 같은 가정(OI 균등분산, funding 부호로 롱/숏만 약보정)을 5개 이산
 * 레버리지 대신 로그간격 연속 샘플(레버리지 2~40x)로 확장 — 매끈한 그라디언트 렌더 전용.
 * 레버리지별 실제 OI 분포는 알 수 없으므로 특정 분포 형태(정규분포 등)를 지어내지 않고
 * 로그축 균등을 중립 가정으로 유지한다 — estimateLiquidationLevels의 5-tier 라인이 여전히
 * 정확한 참조 레벨이고, 이 함수는 그 사이를 시각적으로 이어주는 배경일 뿐이다.
 */
export function estimateLiquidationHeatmap(price: number, openInterest: number, funding: number): LiqHeatmapSample[] {
  if (price <= 0 || openInterest <= 0) return [];

  const skew = Math.max(-0.5, Math.min(0.5, funding * LIQUIDATION_FUNDING_SKEW_SCALE));
  const baseWeight = openInterest / LIQUIDATION_HEATMAP_SAMPLES;
  const longWeight = baseWeight * (1 + skew);
  const shortWeight = baseWeight * (1 - skew);

  const logMin = Math.log(LIQUIDATION_HEATMAP_MIN_LEVERAGE);
  const logMax = Math.log(LIQUIDATION_HEATMAP_MAX_LEVERAGE);
  const samples: LiqHeatmapSample[] = [];
  for (let i = 0; i < LIQUIDATION_HEATMAP_SAMPLES; i++) {
    const t = i / (LIQUIDATION_HEATMAP_SAMPLES - 1);
    const leverage = Math.exp(logMin + t * (logMax - logMin));
    const dist = 1 / leverage - LIQUIDATION_MAINTENANCE_MARGIN_RATE;
    if (dist <= 0) continue;
    samples.push({ price: price * (1 - dist), side: "long", weight: longWeight });
    samples.push({ price: price * (1 + dist), side: "short", weight: shortWeight });
  }
  return samples;
}
