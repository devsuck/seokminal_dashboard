# 오더플로우(풋프린트) + 유동성 히트맵 — 프론트엔드

**상태:** 설계 승인됨, 플랜 작성 대기
**관련 스펙:** `seokminal-multi-venue/docs/superpowers/specs/2026-07-09-orderflow-heatmap-design.md` (백엔드, 이 스펙이 소비하는 WS/REST 계약 정의)
**의존:** 백엔드 스펙의 `/ws/orderflow/{symbol}` 구현 완료 후 착수

## 목적

백엔드가 스트리밍하는 풋프린트/히트맵 델타를 신규 전용 페이지에서 캔버스로 렌더링. 기존 `/crypto`, `/ib` 페이지는 건드리지 않음 — 이 기능이 죽어도 기존 차트 페이지 영향 없음.

## 파일럿 스코프 (v1)

- 심볼 선택: `BTC.HL`, `NQ` 두 개만 (기존 `InstrumentSelect`/심볼 접미사 컨벤션 재사용 — `.HL`=Hyperliquid, 그 외=IBKR)
- 한 번에 심볼 1개 뷰

## 파일 구조

```
app/orderflow/page.tsx                          신규 페이지. 심볼 셀렉터 + FootprintChart + LiquidityHeatmap
components/orderflow/FootprintChart.tsx          캔버스 커스텀 렌더 (lightweight-charts 미사용 — 풋프린트 시리즈 타입 없음)
components/orderflow/LiquidityHeatmap.tsx        캔버스 커스텀 렌더, 가격(y)×시간(x), 색=잔량
hooks/useOrderflowSocket.ts                      WS 연결 훅 (프로젝트 표준 패턴)
components/NavBar.tsx                            "오더플로우" 링크 1줄 추가 (기존 파일 수정)
```

## WS 연결 패턴

`useOrderflowSocket(symbol)` 훅, 프로젝트 표준 라이프사이클(`abort→create→assign ref→연결→onmessage/onerror→backoff 재연결→unmount cleanup`, `CLAUDE.md` AbortController 컨벤션의 WS 버전):

```ts
function useOrderflowSocket(symbol: string) {
  // ws: `${WS_BASE}/ws/orderflow/${symbol}` 연결
  // snapshot 수신 -> 로컬 버퍼 초기화
  // footprint_delta / heatmap_delta -> 버퍼 in-place merge (풀 리렌더 없음)
  // status:reconnecting -> UI에 "재연결 중" 배지
  // onclose -> 지수 백오프 재연결
  // unmount -> ws.close(), 재연결 타이머 clear
  return { footprint, heatmap, connectionState };
}
```

`lib/api.ts`에 raw `fetch`/WS 호출을 직접 넣지 않고 (WS는 컴포넌트/훅 내부 `new WebSocket()` — 기존 `ChartTab.tsx`의 WS 사용 패턴과 동일), REST 상태 조회(`GET /orderflow/symbols`)만 `lib/api.ts`에 함수로 추가.

## FootprintChart

- 캔버스 2D. x축=시간 버킷(1분), y축=가격 레벨. 각 셀에 매수/매도량 텍스트 + 배경 강도(매수=`pos` 톤, 매도=`neg` 톤, 디자인 토큰만 사용).
- delta 수신 시 해당 셀만 다시 그림 (전체 캔버스 clear+redraw 아님 — dirty-rect만 갱신).
- 디자인 토큰: `bg-panel/panel-2`, `border-border`, `text-pos/neg`만 사용. `style={{}}` 인라인 금지 (캔버스 자체 크기 지정은 `<canvas width/height>` 속성으로, `style={{ height: "Npx" }}`류 예외 규칙에 해당 안 함 — 속성으로 처리).

## LiquidityHeatmap

- 캔버스 2D. x축=시간, y축=가격. 셀 색 = 잔량 크기 (accent 톤 opacity 스케일).
- delta 수신 시 새 컬럼만 그려 넣고 오래된 컬럼은 스크롤 아웃 (풀 리렌더 없음).

## 상태 표시

- `connectionState`: `"connecting" | "live" | "reconnecting" | "error"` — 페이지 상단에 `LivePulse`(`components/Jarvis.tsx`, 기존 컴포넌트 재사용) 톤 매핑으로 표시.

## 에러 처리

- WS 끊김 → 훅이 자동 재연결(백오프), 화면엔 히트맵/풋프린트 유지한 채 배지만 "재연결 중"으로 전환 (데이터 초기화 안 함 — 재연결 후 snapshot으로 정합).
- 심볼 전환 시 이전 WS 정리 후 새 WS 연결 (AbortController 패턴).

## 테스트 계획

- `useOrderflowSocket`의 delta merge 로직 — 순수 함수로 분리해 단위 테스트 (snapshot 적용, delta 누적, out-of-order 처리 안 함을 명시 — 백엔드가 순서 보장).
- 캔버스 렌더 자체는 자동 테스트 스코프 아님 — 브라우저로 직접 확인 (`npm run dev` 후 `/orderflow`에서 BTC.HL, NQ 두 심볼 확인).
- `npx tsc --noEmit`, `npm test` 통과.

## 스코프 아웃 (v1)

- 멀티 심볼 동시 뷰 (탭/그리드 비교 없음)
- 히스토리 재생/타임슬라이더
- 풋프린트/히트맵 파라미터(버킷 크기 등) UI 설정 — 백엔드 상수로 고정
