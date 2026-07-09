# 오더플로우 차트 오버레이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/orderflow` 페이지의 풋프린트/히트맵을 독립 캔버스 패널이 아니라, 실시간 캔들차트(lightweight-charts) 위 오버레이로 렌더링한다.

**Architecture:** lightweight-charts v5.2.0의 Series Primitives API(`series.attachPrimitive`, `zOrder: "bottom"|"top"`)로 두 레이어를 캔들 시리즈에 붙인다. 캔들 렌더링 자체(기존 `CandlestickChart.tsx`)는 건드리지 않고, series 참조를 밖으로 꺼낼 수 있게 최소 콜백 prop 하나만 추가한다. 캔들 타임프레임은 footprint 버킷(60초 고정, 백엔드 `orderflow/aggregator.py`)과 1:1 맞추기 위해 1분 고정.

**Tech Stack:** Next.js/React, TypeScript, lightweight-charts 5.2.0(Series Primitives + fancy-canvas `useMediaCoordinateSpace`), vitest.

## Global Constraints

- 디자인 토큰만 사용: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info` (프로젝트 `CLAUDE.md`)
- Raw `fetch` 금지 — 반드시 `lib/api.ts` 함수 사용
- AbortController 컨벤션: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup
- `style={{}}` 금지 (예외: `style={{ height: "Npx" }}` 차트 컨테이너)
- 캔들 타임프레임 1분 고정 (footprint_bucket_sec=60과 1:1 매칭, 스펙 확정 사항)
- heatmap은 캔들과 1:1 아님(heatmap_bucket_sec=2), 연속 배경 텍스처로 렌더
- footprint 텍스트는 `barSpacing < 40px`일 때 렌더 스킵 (스펙 확정)
- 신규 백엔드 작업 없음 — 기존 `getBars`/`getCryptoCandles`/`getIBBars`/`getKRBars`만 사용
- `bucket_ts`/`ts`/캔들 bar time 전부 초 단위 UTC epoch (백엔드 `_bucket()` 확인, `getBars`류 `ts_event`는 나노초라 `/1e9` 필요 — 기존 `CandlestickChart.tsx` 컨벤션과 동일)

---

### Task 1: 캔들 데이터 fetch 로직 공유 헬퍼로 추출

**Files:**
- Create: `lib/chart-bars.ts`
- Modify: `components/market/ChartTab.tsx:15-137` (기존 venue 분기 로직을 `fetchBarsForSymbol` 호출로 교체, 에러 메시지 분기는 그대로 유지)
- Test: `tests/lib/chart-bars.test.ts`

**Interfaces:**
- Consumes: `lib/api.ts`의 `getBars`, `getKRBars`, `getIBBars`, `getCryptoCandles`, 타입 `BarOut`, `KRBar`, `IBBar`, `CryptoCandle`, `IBBarSize`
- Produces: `fetchBarsForSymbol(symbol: string, tfId: string, signal: AbortSignal): Promise<BarOut[]>` — Task 6(`OrderflowChart`)이 그대로 소비. 실패 시 `Error` throw(메시지 포함) 또는 `AbortError` DOMException throw(그대로 전파).
- Produces: `CRYPTO_DAYS: Record<string, number>`, `IB_INTRADAY_CONFIG: Record<string, { bar: IBBarSize; dur: string }>` — 둘 다 export, Task 6에서는 쓰지 않지만 `ChartTab.tsx`가 계속 참조.

이 태스크는 `ChartTab.tsx:15-137`에 있는 심볼 접미사별(`.HL`=Hyperliquid, `.XKRX`=한국, 나머지=IB) 캔들 fetch 분기 로직을 그대로 옮기는 리팩터다. 동작을 하나도 바꾸지 않는다 — 지금 `ChartTab.tsx`가 하는 그대로.

- [ ] **Step 1: 실패하는 테스트부터 작성**

```typescript
// tests/lib/chart-bars.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBarsForSymbol } from "../../lib/chart-bars";

describe("fetchBarsForSymbol", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("HL 심볼은 getCryptoCandles를 호출하고 BarOut으로 변환한다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        coin: "BTC",
        interval: "1m",
        candles: [{ time_ms: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, num_trades: 3 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("BTC.HL", "1m", new AbortController().signal);
    expect(bars).toEqual([{ ts_event: 1000 * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
  });

  it("XKRX 심볼 + 인트라데이 타임프레임은 에러를 던진다", async () => {
    await expect(
      fetchBarsForSymbol("005930.XKRX", "1m", new AbortController().signal)
    ).rejects.toThrow("KR 인트라데이는 아직 미지원");
  });

  it("XKRX 심볼 + 일봉은 getKRBars를 호출하고 BarOut으로 변환한다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "005930",
        bars: [{ date: "20260101", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("005930.XKRX", "1d", new AbortController().signal);
    expect(bars).toEqual([
      { ts_event: new Date("2026-01-01").getTime() * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    ]);
  });

  it("빈 응답이면 에러를 던진다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ coin: "BTC", interval: "1m", candles: [] }),
    } as Response);
    await expect(
      fetchBarsForSymbol("BTC.HL", "1m", new AbortController().signal)
    ).rejects.toThrow("빈 응답");
  });

  it("일봉이 아닌 IB 심볼(NQ)은 getIBBars를 asset_type=stock으로 호출한다", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "NQ",
        bars: [{ ts_ms: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("NQ", "1m", new AbortController().signal);
    expect(bars).toEqual([{ ts_event: 1000 * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("asset_type=stock");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/lib/chart-bars.test.ts`
Expected: FAIL — `lib/chart-bars.ts`가 없어서 import 에러

- [ ] **Step 3: `lib/chart-bars.ts` 구현**

`ChartTab.tsx:15-67`(변환 헬퍼 3개 + `CRYPTO_DAYS`)와 `ChartTab.tsx:80-137`(`loadBars`의 venue 분기 본문)을 그대로 옮긴다.

```typescript
// lib/chart-bars.ts
import {
  getBars, getKRBars, getIBBars, getCryptoCandles,
  type BarOut, type KRBar, type IBBar, type CryptoCandle, type IBBarSize,
} from "@/lib/api";

export const CRYPTO_DAYS: Record<string, number> = { "1m": 1, "15m": 5, "1h": 30, "4h": 90, "1d": 180, "1M": 365 };

export const IB_INTRADAY_CONFIG: Record<string, { bar: IBBarSize; dur: string }> = {
  "1m": { bar: "1 min", dur: "2 D" },
  "15m": { bar: "15 mins", dur: "5 D" },
  "1h": { bar: "1 hour", dur: "1 M" },
  "4h": { bar: "4 hours", dur: "3 M" },
  "1d": { bar: "1 day", dur: "2 Y" },
  "1M": { bar: "1 month", dur: "10 Y" },
};

function krBarToBarOut(bar: KRBar): BarOut {
  const d = bar.date;
  const tsMs = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).getTime();
  return { ts_event: tsMs * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}

function ibBarToBarOut(bar: IBBar): BarOut {
  return { ts_event: bar.ts_ms * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}

function cryptoCandleToBarOut(c: CryptoCandle): BarOut {
  return { ts_event: c.time_ms * 1_000_000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 심볼 접미사(.HL=Hyperliquid, .XKRX=한국, 나머지=IB)별로 알맞은 캔들 API를 호출해 BarOut[]으로 정규화한다. */
export async function fetchBarsForSymbol(symbol: string, tfId: string, signal: AbortSignal): Promise<BarOut[]> {
  const venue = symbol.split(".").slice(1).join(".");
  const isDaily = tfId === "1d";
  const isIntraday = ["1m", "15m", "1h", "4h"].includes(tfId);
  const cfg = IB_INTRADAY_CONFIG[tfId] ?? IB_INTRADAY_CONFIG["1d"];

  if (venue === "HL") {
    const code = symbol.split(".")[0];
    const res = await getCryptoCandles(code, tfId, CRYPTO_DAYS[tfId] ?? 90, signal);
    if (res.candles.length === 0) throw new Error("빈 응답");
    return res.candles.map(cryptoCandleToBarOut);
  }

  if (venue === "XKRX") {
    if (isIntraday) {
      throw new Error("KR 인트라데이는 아직 미지원 — 하루/1달만 (미국은 IB로 분봉 지원)");
    }
    const code = symbol.split(".")[0];
    const res = await getKRBars(code, tfId === "1M" ? 1800 : 730, signal);
    if (res.bars.length === 0) throw new Error("빈 응답");
    return res.bars.map(krBarToBarOut);
  }

  if (isDaily) {
    try {
      const res = await getBars(symbol, oneYearAgo(), today(), undefined, signal);
      if (res.bars.length > 0) return res.bars;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
    const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: "2 Y", bar_size: "1 day" }, signal);
    if (res.bars.length === 0) throw new Error("빈 응답");
    return res.bars.map(ibBarToBarOut);
  }

  const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: cfg.dur, bar_size: cfg.bar }, signal);
  if (res.bars.length === 0) throw new Error("빈 응답 (IB 연결·구독 확인)");
  return res.bars.map(ibBarToBarOut);
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run tests/lib/chart-bars.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: `ChartTab.tsx`가 새 헬퍼를 쓰도록 교체**

`components/market/ChartTab.tsx`에서 `krBarToBarOut`/`ibBarToBarOut`/`cryptoCandleToBarOut`/`CRYPTO_DAYS` 정의(1-30행)를 삭제하고 import로 교체, `loadBars`의 try 블록 본문(91-124행)을 `fetchBarsForSymbol` 호출로 교체한다. **에러 메시지 분기(catch 블록, 125-136행)는 그대로 둔다** — venue/isDaily는 이미 계산돼 있으니 그대로 쓴다.

```typescript
// components/market/ChartTab.tsx 상단 import 교체
import { fetchBarsForSymbol } from "@/lib/chart-bars";
```

`ChartTab.tsx:15-30`(변환 헬퍼 3개 + `CRYPTO_DAYS` 선언) 삭제.

`loadBars` 함수 본문 교체:

```typescript
  async function loadBars(tfId: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null); setBars([]);

    const cfg = TIMEFRAMES.find(t => t.id === tfId) ?? TIMEFRAMES[4];
    const venue = symbol.split(".").slice(1).join(".");
    const isDaily = tfId === "1d";

    try {
      const bars = await fetchBarsForSymbol(symbol, tfId, ctrl.signal);
      setBars(bars);
    } catch (err2) {
      if (err2 instanceof DOMException && err2.name === "AbortError") return;
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      if (!isDaily && venue !== "XKRX" && venue !== "HL") {
        setError(`미국 ${cfg.label} 차트는 IB(TWS) 연결이 필요합니다. TWS를 켜고 다시 선택하세요. (하루봉은 TWS 없이도 표시)`);
      } else {
        setError(`'${symbol}' ${cfg.label} 로드 실패: ${msg2}`);
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }
```

- [ ] **Step 6: 전체 테스트 + 타입체크**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전체 PASS, 타입 에러 없음

- [ ] **Step 7: 브라우저에서 `/crypto`, `/ib`, `/market` 등 `ChartTab` 쓰는 페이지 하나 열어서 캔들 그대로 뜨는지 수동 확인**

- [ ] **Step 8: 커밋**

```bash
git add lib/chart-bars.ts tests/lib/chart-bars.test.ts components/market/ChartTab.tsx
git commit -m "refactor: extract fetchBarsForSymbol shared helper from ChartTab"
```

---

### Task 2: 좌표 매핑 순수함수

**Files:**
- Create: `lib/orderflow-chart-coords.ts`
- Test: `tests/lib/orderflow-chart-coords.test.ts`

**Interfaces:**
- Consumes: 없음 (좌표 변환 함수는 인자로 주입받음 — lightweight-charts 객체에 의존하지 않아 순수 테스트 가능)
- Produces:
  - `heatmapCellRect(cell: { ts: number; price: number }, sortedBuckets: number[], sortedPrices: number[], timeToX: (ts: number) => number | null, priceToY: (price: number) => number | null): { x: number; y: number; width: number; height: number } | null`
  - `footprintColumnX(bucketTs: number, timeToX: (ts: number) => number | null, barSpacing: number): { left: number; right: number; center: number } | null`
  - Task 3(`HeatmapPrimitive`)이 `heatmapCellRect` 소비, Task 4(`FootprintPrimitive`)가 `footprintColumnX` 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/lib/orderflow-chart-coords.test.ts
import { describe, it, expect } from "vitest";
import { heatmapCellRect, footprintColumnX } from "../../lib/orderflow-chart-coords";

describe("heatmapCellRect", () => {
  const timeToX = (ts: number) => (ts === -1 ? null : ts * 10); // 1초=10px
  const priceToY = (p: number) => (p === -1 ? null : 100 - p);  // 가격 낮을수록 y 큼

  it("이웃 버킷/가격으로 폭/높이를 계산한다", () => {
    const rect = heatmapCellRect({ ts: 2, price: 50 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY);
    expect(rect).toEqual({ x: 20 - 20 / 2, y: 50 - 10 / 2, width: 20, height: 10 });
  });

  it("버킷이 sortedBuckets에 없으면 null", () => {
    expect(heatmapCellRect({ ts: 99, price: 50 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("가격이 sortedPrices에 없으면 null", () => {
    expect(heatmapCellRect({ ts: 2, price: 999 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("timeToX가 null을 반환하면 null (범위 밖)", () => {
    expect(heatmapCellRect({ ts: -1, price: 50 }, [-1, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("버킷이 1개뿐이면(이웃 없음) null", () => {
    expect(heatmapCellRect({ ts: 2, price: 50 }, [2], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("마지막 버킷/가격은 이전 이웃과의 거리로 계산한다", () => {
    const rect = heatmapCellRect({ ts: 4, price: 40 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY);
    expect(rect).toEqual({ x: 40 - 20 / 2, y: 60 - 10 / 2, width: 20, height: 10 });
  });
});

describe("footprintColumnX", () => {
  const timeToX = (ts: number) => (ts === -1 ? null : ts * 10);

  it("center ± barSpacing/2로 left/right 계산", () => {
    expect(footprintColumnX(5, timeToX, 8)).toEqual({ left: 46, right: 54, center: 50 });
  });

  it("timeToX가 null이면 null", () => {
    expect(footprintColumnX(-1, timeToX, 8)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run tests/lib/orderflow-chart-coords.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```typescript
// lib/orderflow-chart-coords.ts

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function neighborDistance(
  sorted: number[],
  idx: number,
  toCoord: (v: number) => number | null
): number | null {
  if (sorted.length < 2) return null;
  const neighborIdx = idx < sorted.length - 1 ? idx + 1 : idx - 1;
  const c0 = toCoord(sorted[idx]);
  const c1 = toCoord(sorted[neighborIdx]);
  if (c0 === null || c1 === null) return null;
  return Math.abs(c1 - c0);
}

/** heatmap 셀 1개를 캔들차트 좌표계의 사각형(x,y,width,height)으로 변환. 좌표 못 구하면 null. */
export function heatmapCellRect(
  cell: { ts: number; price: number },
  sortedBuckets: number[],
  sortedPrices: number[],
  timeToX: (ts: number) => number | null,
  priceToY: (price: number) => number | null
): CellRect | null {
  const bucketIdx = sortedBuckets.indexOf(cell.ts);
  const priceIdx = sortedPrices.indexOf(cell.price);
  if (bucketIdx === -1 || priceIdx === -1) return null;

  const x = timeToX(cell.ts);
  const y = priceToY(cell.price);
  if (x === null || y === null) return null;

  const width = neighborDistance(sortedBuckets, bucketIdx, timeToX);
  const height = neighborDistance(sortedPrices, priceIdx, priceToY);
  if (width === null || height === null) return null;

  return { x: x - width / 2, y: y - height / 2, width, height };
}

/** footprint 버킷(=캔들 1개) 하나의 x범위. barSpacing은 chart.timeScale().options().barSpacing. */
export function footprintColumnX(
  bucketTs: number,
  timeToX: (ts: number) => number | null,
  barSpacing: number
): { left: number; right: number; center: number } | null {
  const center = timeToX(bucketTs);
  if (center === null) return null;
  return { left: center - barSpacing / 2, right: center + barSpacing / 2, center };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run tests/lib/orderflow-chart-coords.test.ts`
Expected: PASS (8/8)

- [ ] **Step 5: 커밋**

```bash
git add lib/orderflow-chart-coords.ts tests/lib/orderflow-chart-coords.test.ts
git commit -m "feat(orderflow): add pure coordinate mapping helpers for chart overlay"
```

---

### Task 3: `CandlestickChart`에 series 참조 콜백 추가

**Files:**
- Modify: `components/CandlestickChart.tsx:16-27` (props interface), `:139`, `:167-176` (series 생성 직후)

**Interfaces:**
- Consumes: 없음 (기존 컴포넌트 확장)
- Produces: `CandlestickChartProps.onSeriesReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick">) => void` — chart/series 생성 직후 매번(= `bars` 등 deps 바뀔 때마다 차트 전체 재생성되는 기존 동작 그대로, 그때마다) 호출됨. Task 6(`OrderflowChart`)이 소비.

기존 `ChartTab.tsx` 등 다른 소비자는 이 prop을 안 넘기므로 동작 변화 없음(옵셔널, 기본 undefined).

- [ ] **Step 1: props 인터페이스에 콜백 추가**

`components/CandlestickChart.tsx:16-27`:

```typescript
import type { IChartApi, ISeriesApi, UTCTimestamp, SeriesMarker } from "lightweight-charts";

interface CandlestickChartProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
  sma?: number;
  bollingerPeriod?: number;
  bollingerStd?: number;
  /** 조건식에서 추출한 지표 스펙 — 오버레이(MA/BB/EMA)는 가격 페인,
      오실레이터(RSI/MACD/CCI/OBV)는 하단 서브페인에 렌더. */
  specs?: ChartIndicatorSpec[];
  /** 차트/캔들시리즈 생성 직후 호출 — 외부에서 series primitive를 attach하려는 소비자용.
      bars 등이 바뀌어 차트가 통째로 재생성될 때마다 다시 호출된다. */
  onSeriesReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick">) => void;
}
```

(기존 `import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries, type IChartApi, type UTCTimestamp, type SeriesMarker } from "lightweight-charts";`에 `type ISeriesApi`만 추가하면 됨 — 위 코드블록은 최종 상태.)

- [ ] **Step 2: 함수 시그니처에 prop 추가**

`components/CandlestickChart.tsx:139`:

```typescript
export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specs, onSeriesReady }: CandlestickChartProps) {
```

- [ ] **Step 3: series 생성 직후 콜백 호출**

`components/CandlestickChart.tsx:178-183`(`candleSeries.setData(...)` 호출) 바로 뒤에 추가:

```typescript
    candleSeries.setData(
      bars.map((b) => ({
        time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    onSeriesReady?.(chart, candleSeries);
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add components/CandlestickChart.tsx
git commit -m "feat: expose onSeriesReady callback from CandlestickChart for primitive attachment"
```

---

### Task 4: `HeatmapPrimitive` — 배경 레이어

**Files:**
- Create: `components/orderflow/HeatmapPrimitive.ts`

**Interfaces:**
- Consumes: `lib/orderflow-chart-coords.ts`(Task 2)의 `heatmapCellRect`; `lib/orderflow-data.ts`의 `HeatmapCell`, `computeHeatmapLayout`; lightweight-charts의 `ISeriesPrimitive`, `SeriesAttachedParameter`, `IPrimitivePaneView`, `IPrimitivePaneRenderer`, `Time`
- Produces: `class HeatmapPrimitive implements ISeriesPrimitive<Time>` — `updateData(cells: HeatmapCell[]): void` 메서드. Task 6이 인스턴스화해서 `series.attachPrimitive(instance)`.

Task 4/5(v1 `LiquidityHeatmap.tsx`/`FootprintChart.tsx`)와 동일한 이유로 캔버스 렌더링 자체는 자동 테스트 스코프 아님 — 타입체크 + Task 6에서 수동 브라우저 확인.

- [ ] **Step 1: 구현**

```typescript
// components/orderflow/HeatmapPrimitive.ts
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { heatmapCellRect } from "@/lib/orderflow-chart-coords";
import { computeHeatmapLayout, type HeatmapCell } from "@/lib/orderflow-data";

class HeatmapPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: HeatmapPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series } = this.primitive;
      if (cells.length === 0) return;

      const layout = computeHeatmapLayout(cells);
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);
      const maxSize = Math.max(1, ...cells.map((c) => c.size));

      for (const cell of cells) {
        const rect = heatmapCellRect(cell, layout.buckets, layout.prices, timeToX, priceToY);
        if (!rect) continue;
        const intensity = Math.min(1, cell.size / maxSize);
        ctx.fillStyle = `rgba(255, 159, 10, ${0.1 + intensity * 0.6})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    });
  }
}

class HeatmapPaneView implements IPrimitivePaneView {
  constructor(private primitive: HeatmapPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new HeatmapPaneRenderer(this.primitive);
  }
}

export class HeatmapPrimitive implements ISeriesPrimitive<Time> {
  cells: HeatmapCell[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new HeatmapPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(cells: HeatmapCell[]): void {
    this.cells = cells;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add components/orderflow/HeatmapPrimitive.ts
git commit -m "feat(orderflow): add HeatmapPrimitive background layer"
```

---

### Task 5: `FootprintPrimitive` — 전경 레이어

**Files:**
- Create: `components/orderflow/FootprintPrimitive.ts`

**Interfaces:**
- Consumes: `lib/orderflow-chart-coords.ts`(Task 2)의 `footprintColumnX`; `lib/orderflow-data.ts`의 `FootprintCell`, `computeFootprintLayout`
- Produces: `class FootprintPrimitive implements ISeriesPrimitive<Time>` — `updateData(cells: FootprintCell[]): void`. Task 6이 소비.

**Global Constraint 적용**: `barSpacing < 40px`면 텍스트 렌더 스킵.

- [ ] **Step 1: 구현**

```typescript
// components/orderflow/FootprintPrimitive.ts
import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import { computeFootprintLayout, type FootprintCell } from "@/lib/orderflow-data";

const MIN_BAR_SPACING_FOR_TEXT = 40;

class FootprintPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: FootprintPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series } = this.primitive;
      if (cells.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      if (barSpacing < MIN_BAR_SPACING_FOR_TEXT) return;

      const layout = computeFootprintLayout(cells);
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      ctx.font = "10px monospace";
      ctx.textBaseline = "middle";

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
      }
    });
  }
}

class FootprintPaneView implements IPrimitivePaneView {
  constructor(private primitive: FootprintPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new FootprintPaneRenderer(this.primitive);
  }
}

export class FootprintPrimitive implements ISeriesPrimitive<Time> {
  cells: FootprintCell[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new FootprintPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(cells: FootprintCell[]): void {
    this.cells = cells;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add components/orderflow/FootprintPrimitive.ts
git commit -m "feat(orderflow): add FootprintPrimitive foreground layer with zoom threshold"
```

---

### Task 6: `OrderflowChart` 조합 컴포넌트

**Files:**
- Create: `components/orderflow/OrderflowChart.tsx`

**Interfaces:**
- Consumes: `components/CandlestickChart.tsx`(Task 3)의 `CandlestickChart`(`onSeriesReady` prop); `components/orderflow/HeatmapPrimitive.ts`(Task 4); `components/orderflow/FootprintPrimitive.ts`(Task 5); `lib/chart-bars.ts`(Task 1)의 `fetchBarsForSymbol`; `lib/orderflow-data.ts`의 `FootprintCell`, `HeatmapCell`; `lib/api.ts`의 `BarOut`
- Produces: `OrderflowChart({ symbol: string; footprint: FootprintCell[]; heatmap: HeatmapCell[] }): JSX.Element`. Task 7(`page.tsx`)이 `useOrderflowSocket()`의 `footprint`/`heatmap`을 그대로 넘긴다.

캔들은 1분 고정, 30초마다 `fetchBarsForSymbol(symbol, "1m", signal)` 재조회(AbortController 컨벤션: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup). footprint/heatmap은 prop이 바뀔 때마다 primitive에 반영.

- [ ] **Step 1: 구현**

```tsx
// components/orderflow/OrderflowChart.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { CandlestickChart } from "@/components/CandlestickChart";
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import type { FootprintCell, HeatmapCell } from "@/lib/orderflow-data";
import type { BarOut } from "@/lib/api";

const REFRESH_INTERVAL_MS = 30_000;

interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
}

export function OrderflowChart({ symbol, footprint, heatmap }: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;

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
  }, [heatmap, footprint]);

  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
  }

  if (error) {
    return <div className="border border-border bg-panel text-neg text-sm p-4">{error}</div>;
  }

  return (
    <div className="border border-border bg-panel">
      <CandlestickChart bars={bars} onSeriesReady={handleSeriesReady} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add components/orderflow/OrderflowChart.tsx
git commit -m "feat(orderflow): add OrderflowChart composing candles + primitive overlays"
```

---

### Task 7: `/orderflow` 페이지 교체 + v1 컴포넌트 제거

**Files:**
- Modify: `app/orderflow/page.tsx`
- Delete: `components/orderflow/FootprintChart.tsx`
- Delete: `components/orderflow/LiquidityHeatmap.tsx`

**Interfaces:**
- Consumes: `components/orderflow/OrderflowChart.tsx`(Task 6)

- [ ] **Step 1: `page.tsx` 교체**

```tsx
// app/orderflow/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { LivePulse } from "@/components/Jarvis";
import { OrderflowChart } from "@/components/orderflow/OrderflowChart";
import { useOrderflowSocket, type OrderflowConnectionState } from "@/hooks/useOrderflowSocket";
import { getOrderflowSymbols } from "@/lib/api";

const CONNECTION_TONE: Record<OrderflowConnectionState, "pos" | "accent" | "neg"> = {
  connecting: "accent",
  live: "pos",
  reconnecting: "accent",
  error: "neg",
};

const CONNECTION_LABEL: Record<OrderflowConnectionState, string> = {
  connecting: "연결 중",
  live: "라이브",
  reconnecting: "재연결 중",
  error: "오류",
};

export default function OrderflowPage() {
  const [symbol, setSymbol] = useState("BTC.HL");
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { footprint, heatmap, connectionState } = useOrderflowSocket(symbol);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let cancelled = false;
    getOrderflowSymbols(ctrl.signal)
      .then((res) => {
        if (!cancelled) setActiveSymbols(res.symbols);
      })
      .catch((e) => {
        if (!cancelled && (e as Error).name !== "AbortError") setActiveSymbols([]);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <InstrumentSelect value={symbol} onChange={setSymbol} />
        <LivePulse tone={CONNECTION_TONE[connectionState]} label={CONNECTION_LABEL[connectionState]} />
        {activeSymbols.length > 0 && (
          <span className="text-text-3 text-xs">현재 수집 중: {activeSymbols.join(", ")}</span>
        )}
      </div>
      <OrderflowChart symbol={symbol} footprint={footprint} heatmap={heatmap} />
    </div>
  );
}
```

- [ ] **Step 2: v1 컴포넌트 삭제**

```bash
git rm components/orderflow/FootprintChart.tsx components/orderflow/LiquidityHeatmap.tsx
```

- [ ] **Step 3: 전체 테스트 + 타입체크**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 전체 PASS, 에러 없음

- [ ] **Step 4: 브라우저 수동 확인**

`npm run dev` → `/orderflow` 접속:
- 캔들차트 뜨는지 (BTC.HL, 1분봉)
- 히트맵이 캔들 뒤 배경으로 보이는지
- 줌인(스크롤로 barSpacing 40px 이상 확대) 시 풋프린트 매수/매도 숫자가 캔들 옆에 뜨는지, 줌아웃 시 사라지는지
- **풋프린트 숫자가 정확히 그 캔들 안에 찍히는지(옆 캔들로 밀려 보이지 않는지)** — `bucket_ts`(초단위, 60초 floor)와 캔들 open time 컨벤션이 실제로 일치하는지의 직접 검증. 밀려 보이면 `lib/chart-bars.ts`가 반환하는 `ts_event`(나노초) 변환이나 백엔드 bucket floor 기준이 어긋난 것 — 스펙의 알려진 리스크
- 심볼을 NQ로 바꿨을 때 이전 심볼 오버레이 잔상 없이 깨끗이 전환되는지
- WS 연결 상태 배지(`LivePulse`)가 정상 동작하는지

- [ ] **Step 5: 커밋**

```bash
git add app/orderflow/page.tsx
git commit -m "feat(orderflow): replace stacked panels with candlestick chart overlay"
```

---

## 실행 순서 요약

Task 1(공유 헬퍼 추출) → Task 2(좌표 순수함수) → Task 3(CandlestickChart 콜백) → Task 4/5(primitives, 서로 독립이라 순서 무관하나 순차 권장) → Task 6(조합 컴포넌트, 1-5 전부 필요) → Task 7(페이지 교체 + v1 삭제, 6 필요).
