# 오더플로우 차트 통합 — 캔들 오버레이 설계

**상태:** 설계 확정, 플랜 작성 대기
**선행 스펙:** `2026-07-09-orderflow-heatmap-design.md` (독립 캔버스 패널 v1, 이미 구현/배포됨)
**이 스펙의 위치:** v1 후속 리디자인. `/orderflow` 페이지의 `FootprintChart`/`LiquidityHeatmap`를 별도 스택 패널로 보여주던 것을, 실시간 캔들차트(lightweight-charts) 위에 오버레이하는 방식으로 교체.

## 배경

v1은 캔들차트 없이 풋프린트/히트맵 캔버스 두 개를 세로로 쌓아서 보여줬음. 가격 움직임 맥락 없이 숫자/열지도만 봐야 해서 실사용성 낮음 — "따로 보여주면 어떻게 쓰냐"는 피드백으로 리디자인 착수.

## 목표

같은 lightweight-charts 캔들 패널 안에서:
- 히트맵을 캔들 뒤 배경 레이어로
- 풋프린트(매수/매도 물량)를 캔들 위 전경 레이어로

둘 다 확대/축소/팬에 자동 동기화.

## 확정 사항 (브레인스토밍에서 합의)

1. **오버레이 방식** — lightweight-charts v5.2.0의 Series Primitives API(`series.attachPrimitive`, `zOrder: "bottom"|"top"`) 사용. 캔들 자체 렌더링(검증된 라이브러리 엔진)은 안 건드림.
2. **캔들-풋프린트 버킷 1:1 매칭** — 백엔드 `footprint_bucket_sec=60`(고정, `orderflow/aggregator.py:8-18`) 확인됨. 캔들 타임프레임 **1분 고정**으로 맞춤. 히트맵은 `heatmap_bucket_sec=2`(더 촘촘함) — 캔들과 1:1 아니고 연속 배경 텍스처로 취급, 정렬 문제 없음.
3. 기존 `getBars(instrumentId, start, end, "1m")` API 그대로 재사용 (신규 백엔드 작업 없음).

## 파일 구조

```
components/orderflow/
  OrderflowChart.tsx          신규 — CandlestickChart 조합, primitive attach/detach 라이프사이클 관리
  HeatmapPrimitive.ts         신규 — ISeriesPrimitive 구현, zOrder "bottom"
  FootprintPrimitive.ts       신규 — ISeriesPrimitive 구현, zOrder "top"
  FootprintChart.tsx          삭제 — OrderflowChart로 대체
  LiquidityHeatmap.tsx        삭제 — OrderflowChart로 대체

lib/
  orderflow-data.ts           수정 없음 — 버킷 병합/축출 로직(MAX_TIME_BUCKETS 등) 그대로 재사용
  orderflow-chart-coords.ts   신규 — 순수함수: 버킷ts→x좌표, price→y좌표 헬퍼. 유닛테스트 대상

app/orderflow/page.tsx        수정 — 스택 패널 2개 → OrderflowChart 하나. 캔들 데이터(getBars "1m") fetch 추가
```

## 컴포넌트 책임

**`OrderflowChart`**
- 내부적으로 기존 `CandlestickChart`(안 건드림) 생성, candlestick series 참조 획득
- `useEffect`: mount 시 `HeatmapPrimitive`/`FootprintPrimitive` 인스턴스 생성 → `series.attachPrimitive()` 두 번, unmount 시 `series.detachPrimitive()` 양쪽 + `chart.remove()`
- `footprint`/`heatmap` prop(from `useOrderflowSocket`) 바뀔 때마다 `primitive.updateData(...)` 호출 후 primitive가 attach 시 받은 `requestUpdate`로 재렌더 예약
- `symbol` prop 바뀌면: primitive `updateData([], [])`로 즉시 클리어 → 새 `getBars` fetch + WS 재연결(기존 `useOrderflowSocket` 훅이 심볼 변경 처리)

**`HeatmapPrimitive`** (zOrder `"bottom"`)
- `paneViews()[0].renderer().draw(target)` — `target.useBitmapCoordinateSpace(scope => ...)` 패턴(v5 표준)
- x: `timeScale.timeToCoordinate(cell.ts)`, 셀 폭 = 인접 heatmap 타임스탬프(2초 간격) 좌표 차
- y: `series.priceToCoordinate(cell.price)`, row 높이 = 인접 price level 좌표 차 (기존 `computeHeatmapLayout`의 distinct price 리스트 재사용)
- 색상: 기존 `LiquidityHeatmap.tsx`의 강도→rgba 오렌지 로직 그대로 포팅
- 좌표가 null(범위 밖)인 셀은 스킵

**`FootprintPrimitive`** (zOrder `"top"`)
- 캔들 1개 = footprint 버킷 1개. x범위 = `timeToCoordinate(bucketTs)` ± `barSpacing/2`
- 버킷 내 가격레벨(row)마다 좌측=매도(빨강)/우측=매수(초록) 텍스트
- **줌 임계치**: `timeScale.options().barSpacing < 40px`면 텍스트 렌더링 스킵(겹쳐서 못 읽음) — 줌아웃 상태에선 캔들+히트맵만, 풋프린트 숫자는 자동 숨김

## 에러/엣지케이스

| 상황 | 처리 |
|---|---|
| 심볼 전환 시 이전 데이터 잔상 | primitive `updateData([], [])` 즉시 클리어 후 재fetch/재연결 |
| `timeToCoordinate`/`priceToCoordinate`가 null | 해당 셀 렌더 스킵, throw 금지 |
| `bucket_ts`(footprint, 초단위 UTC 60초 floor) vs `getBars` bar open time 컨벤션 불일치 가능성 | 구현 단계에서 실제 응답 찍어서 검증 — 다르면 즉시 버그 소스, 플랜에 명시적 검증 스텝 필요 |
| 최신 진행중 캔들 vs 실시간 footprint 버킷 | footprint는 WS 실시간, 캔들은 기존 ChartTab 폴링 패턴 그대로(지연 허용, 신규 처리 없음) |
| 가격 틱(heatmap/footprint) vs 캔들 오토스케일 가격축 불일치 | 둘 다 같은 `series.priceToCoordinate` 사용 — 자동 정합, 별도 처리 불필요 |
| unmount/리사이즈 | `detachPrimitive` 양쪽 + `chart.remove()` 기존 cleanup 패턴 그대로 |

## 테스팅

- `lib/orderflow-chart-coords.ts` 순수함수 — 유닛테스트(빈 배열/단일 버킷/범위밖 null 케이스), `orderflow-data.test.ts` 패턴 따름
- `OrderflowChart`/`HeatmapPrimitive`/`FootprintPrimitive` 캔버스 렌더링 자체 — 기존 v1 컨벤션 그대로 자동테스트 스코프 아님(`npx tsc --noEmit` + 수동 브라우저 확인: 캔들+히트맵 배경, 줌인 시 풋프린트 숫자, 심볼전환 시 클리어, WS 재연결 안정성)
- `app/orderflow/page.tsx` 통합 — 수동 브라우저 확인

## 스코프 밖 (이번 작업 아님)

- 신규 백엔드 API/버킷 간격 변경 없음
- 다중 타임프레임 선택(1분 고정) — footprint_bucket_sec 자체가 configurable 아니므로 스코프 밖
- Phase 2 HUD 프로세스 재기동 버튼(별건, 이미 보류 중)
