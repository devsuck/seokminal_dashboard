# Orderflow Trading Cockpit v2 — Design Spec

**Status:** Approved by user delegation ("다 붙여줘, 순서 상관없어" — Bookmap 레퍼런스 스크린샷과 비교해서 빠진 지표 전부 요청, 선후 무관). Same delegation pattern as `2026-07-10-orderflow-trading-cockpit-design.md`: all UX/architecture calls in this doc are Claude's judgment, documented here for later review, not independently re-confirmed one-by-one.

## Goal

`2026-07-10-orderflow-trading-cockpit-design.md`(COB/Large-Lot/CVD/Absorption/GEX)로 v1 Bookmap-스타일 코크핏을 구현했으나, 사용자가 실제 Bookmap 레퍼런스와 비교 후 5개 지표가 빠졌다고 지적:

6. **Volume Profile (SVP + CVP)** — 가격대별 매수/매도 누적 볼륨 히스토그램, 세션 단위(SVP)와 전체 보유 윈도우 단위(CVP) 두 종류.
7. **Iceberg 리필 디텍터** — 특정 가격에서 현재 COB 잔량 대비 훨씬 많은 물량이 체결된 경우(반복 리필 추정) 표시. v1의 "Iceberg/Large-Lot tracker"는 사실 단발성 대량체결(large single print)만 잡고 진짜 iceberg 리필 패턴은 안 잡음 — 이름만 겹치고 다른 지표.
8. **Stop-run 디텍터** — 최근 N봉 고점/저점을 이탈했다가 거래량 스파이크와 함께 반전 마감(wick rejection)하는 캔들 표시.
9. **Book%/Volume% 임밸런스 바** — 현재 COB 매수/매도 잔량 비율 + 최근 체결 매수/매도 비율.
10. **COB 숫자 래더** — 인셋 바 옆에 실제 잔량 숫자 표기(현재는 바 길이로만 표시).

## Architecture

**핵심 결정: 5개 전부 백엔드 변경 없이 프론트엔드만으로 구현 가능.** 이미 흐르고 있는 두 스트림만으로 전부 유도됨:
- `footprint_delta`(체결 테이프, 가격×시간 버킷) — Volume Profile(6), Iceberg(7)의 "누적 체결량" 절반, Stop-run(8)의 거래량 스파이크 판정에 재사용.
- `book_snapshot`(COB, Feature 1) — Volume Profile 비교 대상인 "현재 잔량", Iceberg(7)의 "현재 잔량" 절반, 임밸런스(9)의 book 쪽 절반.

새 WS 메시지 타입 없음, `orderflow/aggregator.py`/`orderflow/manager.py` 변경 없음. v1 스펙의 Rationale(캔버스 primitive가 pan/zoom 동기화를 native repaint로 공짜로 얻는다)을 그대로 계승 — 6/7/8/10은 `ISeriesPrimitive` 캔버스 primitive, 9만 예외적으로 고정 위치 오버레이(플롯 영역 기준 고정 픽셀 오프셋, 시간/가격 좌표 불필요)이지만 이것도 DOM이 아니라 같은 캔버스 primitive로 그린다(v1 스펙이 이미 "DOM 사이드바 대신 canvas primitive" 이유로 명시한 좌표 드리프트 문제를 여기도 동일 적용 — 고정 오버레이라 드리프트는 없지만, DOM을 하나 더 얹으면 `style={{}}` 금지 컨벤션과 디자인 토큰 제약을 canvas 쪽 `var(--color-*)` 패턴 대신 새로 신경 써야 해서 일관성 차원에서 canvas 유지).

**우측 인셋 레이아웃 재구성:** 기존 COB 인셋(90px, 차트 우측 도킹)에 SVP/CVP 컬럼을 추가해 3-컬럼 스택으로 확장한다: `[SVP 50px][CVP 50px][COB 90px]`(왼쪽→오른쪽, 오른쪽 끝이 native price axis에 가장 가깝게 — Bookmap 레퍼런스와 동일한 좌→우 순서). `OrderBookPrimitive.ts`의 `INSET_WIDTH_PX` 상수를 인셋 전체 폭 계산에 재사용할 수 있도록 `lib/orderflow-chart-coords.ts`에 컬럼 오프셋 계산 헬퍼를 추가한다.

**Tech stack:** 새 의존성 없음. 전부 기존 `FootprintPrimitive`/`HeatmapPrimitive`/`OrderBookPrimitive` 패턴(raw Canvas 2D, `attached()`/`updateData()`/`requestUpdate()`) 그대로.

## Global Constraints

v1 스펙(`2026-07-10-orderflow-trading-cockpit-design.md`)의 Global Constraints 전부 동일 적용:
- 디자인 토큰만(DOM/CSS 쪽, 이번 스펙은 DOM 신규 없음이라 해당 없음).
- Canvas primitive는 `var(--color-*)` CSS 커스텀 프로퍼티 문자열 패턴.
- `style={{}}` 금지(차트 컨테이너 height 예외).
- 기존 primitive 패턴(`ISeriesPrimitive`, `attached()`, `updateData()`, `requestUpdate()`) 그대로 따를 것 — 새 스타일 도입 금지.
- 백엔드 무변경이므로 asyncio/CORS/Python 인터프리터 제약은 해당 사항 없음.

## Feature 6 — Volume Profile (SVP + CVP)

**No backend change needed.** `lib/orderflow-data.ts`가 이미 들고 있는 `OrderflowState.footprint`(Map, 버킷×가격) 그대로 재사용.

**정의(문서화된 근사치, v1의 Absorption 임계값처럼 튜닝 가능한 1차 버전):**
- **SVP(세션)**: 최근 30분(`SVP_WINDOW_SEC = 1800`) 버킷만 집계.
- **CVP(누적)**: 현재 클라이언트가 들고 있는 footprint 전체(백엔드 rolling 7200s 윈도우 + 프론트 `MAX_TIME_BUCKETS=300` 버킷 캡 이내) 집계 — 진짜 "무제한 히스토리"는 아니고 기존 CVD와 동일한 제약(재연결 시 그 시점 보유분부터 다시 쌓임)을 그대로 상속. Out of Scope에 명시.

**Frontend — `lib/orderflow-data.ts`:**
```typescript
export interface VolumeProfileLevel {
  price: number;
  buyVol: number;
  sellVol: number;
}

export function computeVolumeProfile(
  cells: FootprintCell[],
  sinceTs?: number
): VolumeProfileLevel[] {
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
`OrderflowChart.tsx`에서 `computeVolumeProfile(footprintCells)`(CVP)와 `computeVolumeProfile(footprintCells, latestBucketTs - 1800)`(SVP) 두 번 호출.

**Frontend — 새 primitive `components/orderflow/VolumeProfilePrimitive.ts`:** `HeatmapPrimitive.ts`와 동일 패턴. `updateData(levels: VolumeProfileLevel[])`. `draw()`: 각 price level마다 `priceToCoordinate`로 y 구하고, buy/sell을 각각 좌/우 절반(또는 stacked bar, buy=`var(--color-pos)` sell=`var(--color-neg)`) 폭 ∝ `vol / maxVol`(전체 레벨 중 최댓값)로 컬럼 폭(50px) 내에 그림. 인스턴스 2개(SVP/CVP), `columnRightEdgePx` 생성자 파라미터로 좌표 오프셋만 다르게.

## Feature 7 — Iceberg 리필 디텍터

**No backend change needed.** Feature 6의 CVP(`computeVolumeProfile(footprintCells)`, 무필터)와 Feature 1의 `book`(현재 COB) 조합.

**정의:** 어떤 가격에서 "누적 체결량(CVP) / 현재 COB 잔량" 비율이 임계치 이상이면 그 가격에 반복 리필된 숨은 물량이 있었다고 추정(현재 눈에 보이는 잔량보다 훨씬 많이 체결됐다는 뜻 — 단발성이면 불가능한 양).

```typescript
const ICEBERG_REFILL_RATIO = 5;
const ICEBERG_NOISE_FLOOR_MULTIPLIER = 20; // rollingMedian(Feature 2 트래커) 재사용

export interface IcebergLevel {
  price: number;
  side: "bid" | "ask";
  ratio: number;
}

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

**Frontend — `OrderBookPrimitive.ts` 확장:** `icebergLevels: IcebergLevel[]` prop 추가. 매칭되는 가격의 바를 그릴 때 `var(--color-warn)` 1.5px 스트로크 테두리 추가 + 오른쪽에 작은 "ICE" 라벨(Feature 10의 숫자 래더 옆, 공간 없으면 숫자 대신 ICE 라벨 우선 표시).

## Feature 8 — Stop-run 디텍터

**No backend change needed.** `bars`(캔들, 이미 `CandlestickChart`에 존재) + `footprint`(거래량 스파이크 판정용) + Feature 2의 rollingMedian.

**정의(Absorption과 동일한 fail-closed/노이즈플로어 철학 적용, 튜닝 가능한 1차 버전):**
```typescript
const STOP_RUN_LOOKBACK_BARS = 20;
const STOP_RUN_NOISE_FLOOR_MULTIPLIER = 10; // Absorption과 동일 배수 재사용

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

    // 매도 스탑런: 저항 돌파 후 그 레벨 아래로 되돌림 마감 (숏 트리거 -> 되돌림)
    if (bar.high > recentHigh && bar.close < recentHigh) {
      results.push({ time: bucketTs, side: "sell" });
    } else if (bar.low < recentLow && bar.close > recentLow) {
      // 매수 스탑런: 지지 이탈 후 그 레벨 위로 되돌림 마감 (롱 트리거 -> 되돌림)
      results.push({ time: bucketTs, side: "buy" });
    }
  }
  return results;
}
```

**Frontend — `CandlestickChart.tsx` 마커 통합:** 기존 Absorption 마커(`markersRef`, `var(--color-info)` 삼각형)와 병합해 `setMarkers()` 한 번에 호출(시리즈당 마커셋은 1개만 유효하므로 병합 필요). Stop-run은 `var(--color-warn)` "X" 모양으로 Absorption과 시각적으로 구분. `time` 겹치면(같은 봉에 둘 다 감지) 두 마커 다 유지(위/아래 다른 위치라 안 겹침 — absorption은 `belowBar`/`aboveBar`, stop-run은 반대쪽에 배치해 겹침 방지: 매도 stop-run은 `aboveBar`, 매수는 `belowBar` — absorption 배치 규칙(매도 흡수=`aboveBar`, 매수 흡수=`belowBar`)과 동일 극성이라 둘 다 뜨면 같은 자리에 겹칠 수 있음. 겹침 시 stop-run을 살짝 바깥쪽(추가 오프셋)에 그리도록 `CandlestickChart.tsx`에서 두 배열 병합 시 좌표 오프셋 처리.

## Feature 9 — Book%/Volume% 임밸런스 바

**No backend change needed.** `book`(Feature 1) + Feature 2 트래커 확장.

**Book 임밸런스:** 현재 COB 매수/매도 잔량 합 비율.
**Volume 임밸런스:** 최근 체결 매수/매도 비율 — Feature 2의 `LargeTradeTrackerState.recentSizes`는 크기만 들고 side를 안 들고 있어서 확장 필요.

```typescript
export interface LargeTradeTrackerState {
  recentSizes: number[];
  recentSides: { side: "buy" | "sell"; size: number }[]; // NEW, 같은 ROLLING_WINDOW(200)로 캡
  largeTrades: LargeTrade[];
}

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
`applyLargeTradeTracking`이 `recentSides`도 같은 슬라이스 윈도우로 채우도록 수정(기존 `recentSizes` 갱신 로직 옆에 한 줄 추가, 워밍업 게이트는 이미 `recentSizes`가 갖고 있으므로 그대로 재사용).

**Frontend — 새 primitive `components/orderflow/ImbalanceBarPrimitive.ts`:** `HeatmapPrimitive.ts` 패턴. 차트 플롯 영역 좌상단 고정 오프셋(예: `(12, 12)`)에 폭 120px 높이 8px 바 2줄(book/volume) — green(`var(--color-pos)`) 구간 폭 ∝ `*Pct`, 나머지 red(`var(--color-neg)`). `zOrder: "top"`.

## Feature 10 — COB 숫자 래더

**No backend change needed.** `OrderBookPrimitive.ts` 기존 바 렌더링에 텍스트만 추가.

**Frontend:** `drawSide()` 루프 안, row 높이(`rowHeight`)가 `MIN_ROW_HEIGHT_FOR_TEXT = 9`px 이상일 때만(좁으면 안 그림 — `FootprintPrimitive.ts`의 `MIN_BAR_SPACING_FOR_TEXT` 게이트와 동일 철학) 바 왼쪽 끝에 `lvl.size`를 `toFixed(2)` 텍스트로 표기(`ctx.save/restore`로 폰트/정렬 격리, Feature 5(현재 세션에서 구현한 벤뉴 뱃지)와 동일 패턴).

## Data Flow Summary

```
footprint (existing)  -> computeVolumeProfile()        -> SVP/CVP (Feature 6, NEW derived)
                       -> detectStopRuns()               -> Stop-run markers (Feature 8, NEW derived)
                       -> applyLargeTradeTracking()       -> recentSides (Feature 9 절반, EXTENDED)

book (Feature 1, existing) -> computeImbalance()          -> Book% (Feature 9 절반, NEW derived)
                            -> OrderBookPrimitive 숫자 래더 (Feature 10, EXTENDED)

CVP(Feature 6) + book(Feature 1) -> detectIcebergLevels()  -> Iceberg 하이라이트 (Feature 7, NEW derived)

전부 OrderflowChart.tsx에서 조합 -> 신규 primitive 3개(VolumeProfilePrimitive x2, ImbalanceBarPrimitive) attach
                                  -> OrderBookPrimitive/CandlestickChart 기존 primitive 확장
```

## Error Handling

- **Feature 6:** footprint가 비어있으면 `computeVolumeProfile([])`이 자연스럽게 `[]` 반환 — 별도 분기 불필요, `HeatmapPrimitive`와 동일한 empty-guard.
- **Feature 7:** `rollingMedian <= 0`(워밍업 전) 시 fail closed(빈 배열) — Absorption과 동일 패턴.
- **Feature 8:** `rollingMedian <= 0` 또는 `bars.length <= LOOKBACK` 시 fail closed.
- **Feature 9:** `bidSum+askSum<=0`이거나 `buyVol+sellVol<=0`(데이터 없음) 시 `null` 반환, primitive는 그리지 않음.
- **Feature 10:** row 높이 부족 시 텍스트만 스킵, 바는 그대로 그림(기존 동작 유지).

## Testing

- 전부 순수함수라 `lib/orderflow-data.ts` 기존 컨벤션 그대로 유닛 테스트: `computeVolumeProfile`(필터 있음/없음, 중복 가격 합산), `detectIcebergLevels`(임계치 경계값, 워밍업 전 빈 배열), `detectStopRuns`(고점/저점 돌파+되돌림 케이스, 워밍업/노이즈플로어 게이트), `computeImbalance`(0으로 나누기 가드, 정상 비율 계산), `applyLargeTradeTracking`의 `recentSides` 확장(기존 대량체결 테스트 스위트 옆에 추가).
- 신규 canvas primitive 3개(`VolumeProfilePrimitive.ts`, `ImbalanceBarPrimitive.ts`)는 v1 컨벤션대로 전용 테스트 없음 — 좌표/집계 로직은 위 순수함수 테스트로 커버.
- 프론트 전체 스위트 + `npx tsc --noEmit` 그린 확인, 브라우저 스팟체크(`/orderflow`, BTC.HL)로 5개 지표 전부 렌더링 확인.

## Out of Scope (explicit)

- CVP의 "진짜 무제한 히스토리"(서버 재시작/재연결 이후에도 유지) — v1 CVD와 동일한 제약을 그대로 상속, 별도 영속 저장소 없음.
- Iceberg/Stop-run 임계값(`ICEBERG_REFILL_RATIO=5`, `STOP_RUN_LOOKBACK_BARS=20` 등) 백테스트/튜닝 — Absorption과 동일하게 문서화된 1차 휴리스틱만 제공, 실거래 피드백 후 조정.
- 레이어 개별 토글 UI(SVP/CVP/Iceberg/Stop-run/Imbalance on/off) — v1과 동일하게 이번에도 범위 밖, 데이터 있으면 항상 렌더링.
- Book%/Volume% 임밸런스의 "최근" 윈도우를 시간 기준(예: 최근 60초)이 아니라 체결 건수 기준(최근 200건, 기존 ROLLING_WINDOW 재사용)으로 정의 — 거래량이 뜸한 심볼에서는 오래된 체결까지 섞일 수 있음, 시간 기준 전환은 후속 조정 대상.
