# Portfolio 모바일 네이티브 디자인 — Phase 1

**Spec 상태:** 브레인스토밍 완료, 사용자 검토 대기
**선행 스펙:** `docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md` (investment-os·research-os 4라우트 카드화, 완료됨)

## 배경

2026-09-15~16 세션에서 investment-os, research-os/validation, research-os/governance, research-os/chat 4라우트를 데스크톱 구조 위에 `md:hidden` 카드 마크업을 얹는 방식으로 모바일 리디자인했다. 그 직후 사용자가 결과물이 "디자인을 모바일 크기에 욱여넣은 것 같다"고 피드백 — 카드만 단조롭게 쌓여있고 그래프/로고/리스트 같은 정보 밀도 있는 컴포넌트가 전혀 없다는 지적이었다.

조사 결과 두 가지가 드러났다:

1. **네비게이션 셸은 이미 존재한다.** `components/console/BottomTabBar.tsx`가 2026-09-13에 만들어져 `app/layout.tsx`에 전역 마운트돼 있다 — 하단 고정 탭바(홈/포트폴리오/Investment OS) + "더보기" 시트(스와이프로 닫기 지원) + `/hud/summary` 모바일 홈. 즉 앱 셸 구조 자체를 새로 만들 필요는 없다.
2. **진짜 손 안 댄 곳은 `/portfolio`다.** 실제 보유종목이 뜨는 페이지(하단탭바 2번째 탭)는 이번 세션 4라우트 작업에 포함되지 않았다. `md:hidden`/`hidden md:block` 분기 자체가 없고, 보유종목은 `PositionRow`(이름 + PnL 배지 + 텍스트 한 줄) 형태로만 렌더된다 — 로고도 그래프도 없이 순수 텍스트.

사용자가 원하는 방향은 Toss·Robinhood·자체 autopilot 프로젝트 계열의 소비자 핀테크 앱 — 카드 일변도가 아니라 그래프/로고뱃지/리스트가 섞인 정보 디자인.

## 목표 (이번 Phase)

1. 하단 탭바 1뎁스 구성을 앱에 맞게 확장 (3개 → 5개), Research OS(AI 판단 근거)를 primary 탭으로 승격.
2. 재사용 가능한 시각 프리미티브 4종을 `ApPrimitives.tsx`에 추가: 티커뱃지, 손익 막대, 리스트 로우, 바텀시트.
3. `/portfolio`를 이 프리미티브로 신규 모바일 렌더링 — 보유종목 리스트를 로고뱃지+손익막대 리스트로우로, 탭하면 바텀시트로 상세 확인 → "AI 판단 보러가기"로 리서치 챗 딥링크.
4. `research-os/chat`이 URL 쿼리 파라미터로 진입 시 질문을 미리 채우고 자동 전송하도록 소폭 확장 (③의 딥링크를 받기 위해).

## 비목표 (이번 Phase에서 안 함)

- **4라우트(investment-os, research-os/validation·governance·chat) 콘텐츠 재작업** — 그쪽은 게이트/표결/타임라인처럼 "리스트+그래프" 모양이 아닌 콘텐츠가 많아 다른 처방이 필요하다. 이번 프리미티브가 실전 검증되면 별도 스펙으로 진행.
- **진짜 시계열 가격 스파크라인** — 백엔드에 종목별 가격 히스토리 endpoint가 없다(Alpaca/KIS/HL 포지션 응답 모두 현재가 스냅샷 한 점뿐). 새 backend endpoint는 다른 레포/세션 작업이라 이번 스코프 밖. 대신 평단가→현재가 손익폭을 막대로 보여주는 것으로 "그래프" 요구를 충족한다.
- **데스크톱 라이트 전환/다크모드 토글** — 상위 스펙과 동일하게 out of scope.
- **AI 판단 데이터를 바텀시트 안에서 직접 fetch** — 시트는 이미 로드된 포지션 데이터만 보여주고, AI 판단은 버튼으로 연결된 `research-os/chat`에서 조회한다 (시트 열 때마다 `/console/decision-memo` 호출하는 N+1 부담과 실패 케이스를 피하기 위함).

## 1. 하단 탭바 확장

`components/console/BottomTabBar.tsx`의 `PRIMARY_TABS`를 3개 → 5개로:

```
홈(/hud/summary) · 포트폴리오(/portfolio) · Research OS(/research-os/chat) · Investment OS(/investment-os) · 성과(/performance)
```

- `Research OS` 탭의 기본 랜딩은 `/research-os/chat`(어시스턴트) — AI와 바로 대화 시작하는 진입점이 자연스럽다는 판단. 검증·거버넌스는 그 안에서 세그먼트 전환(2뎁스, 새 정보구조 아님 — 기존 3라우트 구조 유지, chat 페이지 상단에 세그먼트 스위처만 추가하는 건 이번 스펙 범위 밖. 세그먼트 없이 우선 chat만 primary화하고, 검증/거버넌스는 지금처럼 "더보기" 시트에서도 계속 접근 가능하게 둔다 — 3-way 세그먼트 스위처 추가는 Phase 2 후보로 남긴다).
- `isActivePath`가 `/research-os`로 시작하는 모든 경로(validation/governance/chat)를 "Research OS" 탭 활성 상태로 잡도록 처리 — 검증/거버넌스 페이지를 더보기에서 들어가도 하단탭 하이라이트가 맞게 나오도록.
- 새 탭 2개(`/research-os/chat`, `/performance`)에 대한 `TabIcon` SVG 케이스 추가 필요 — 기존 3개(홈/포트폴리오/Investment OS)와 동일한 스타일(21x21, `stroke`, `strokeWidth=1.3`)로.
- "더보기" 시트(`ALL_GROUPS` 렌더링)는 그대로 유지 — 이제 5개 중 일부가 시트에도 중복으로 뜨지만(기존에도 포트폴리오/Investment OS가 그랬음) 해가 없다.
- 5개 탭이 `flex-1`로 균등 분할되면 라벨이 좁아질 수 있음 — 라벨 텍스트는 현재 `text-[11px]`이라 "Investment OS"처럼 긴 라벨은 줄바꿈되거나 잘릴 위험. 구현 시 라벨을 더 짧게 조정할지(`text-[10px]` 축소 등)는 구현자 재량.

## 2. 신규 시각 프리미티브 (`components/ui/ApPrimitives.tsx`)

기존 `ApPanel`/`ApBadge`/`ApDot` 옆에 추가. 색상은 전부 `AP_TONE`(기존 `var(--color-ap-*)`) 경유 — `lib/chart-colors.ts`의 `TOKEN`(다크 리터럴 hex, 데스크톱 차트용)은 쓰지 않는다.

### `ApTickerBadge`

```ts
function ApTickerBadge({ symbol, size = 32 }: { symbol: string; size?: number }): JSX.Element
```

- 원형 뱃지, 배경색은 `symbol` 문자열을 해싱해 고정된 hue로 결정(HSL, 예: `hue = hashCode(symbol) % 360`, 고정 saturation/lightness로 라이트 테마에 어울리는 파스텔톤 — 같은 티커는 항상 같은 색, 외부 자산/네트워크 요청 없음).
- 안에 텍스트: 티커 앞 1~2글자 대문자(`symbol.slice(0, 2).toUpperCase()` — 단, 한글 종목명이 오는 KIS holdings의 경우 `name`에서 첫 글자만 쓰는 등 호출부에서 적절히 넘김).
- 글자색은 배경 lightness에 맞춰 고정 다크/라이트 텍스트(가독성 대비 확보 — 배경이 파스텔이라 어두운 텍스트 고정으로 충분할 가능성 높음, 구현 시 대비 확인).

### `ApGainBar`

```ts
function ApGainBar({ pct, maxAbs }: { pct: number; maxAbs: number }): JSX.Element
```

- `BarChart.tsx`와 동일한 시각 문법(가로 트랙 + 채워진 막대, `rx` 라운드) — 단 이건 리스트 로우 안에 인라인으로 들어가는 소형 버전이라 라벨/툴팁 없이 순수 막대만. `pct`가 양수면 `text-ap-up`/`var(--color-ap-up)`, 음수면 `text-ap-down`/`var(--color-ap-down)`.
- `maxAbs`는 호출부(리스트 전체)에서 `Math.max(1, ...allPct.map(Math.abs))`로 계산해 넘긴다 — 같은 리스트 안 막대 길이가 서로 비교 가능하도록.

### `ApListRow`

```ts
function ApListRow({
  leading, title, subtitle, trailing, trailingSub, onClick,
}: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode;
  trailing?: ReactNode; trailingSub?: ReactNode; onClick?: () => void;
}): JSX.Element
```

- `min-h-11` 터치 타겟, `onClick` 있으면 `<button>` 래핑 + `active:bg-ap-bg` 피드백, 없으면 `<div>`.
- 레이아웃: `[leading] [title/subtitle 세로 스택, flex-1 min-w-0] [trailing/trailingSub 세로 스택, 우측 정렬]`.
- 범용 컴포넌트 — `/portfolio` 말고도 다른 리스트형 화면에서 재사용 가능하게 설계 (알림, 뉴스 등 향후 후보 — 지금 당장 다른 호출부를 만들 필요는 없음, YAGNI).

### `ApBottomSheet`

```ts
function ApBottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }): JSX.Element
```

- `BottomTabBar.tsx`의 "더보기" 시트가 이미 구현해둔 패턴(백드롭 + 슬라이드업 + `onTouchStart`/`onTouchEnd`로 아래로 80px 이상 스와이프하면 닫힘)을 그대로 재사용 — 새로 설계하지 않고 그 코드를 범용 컴포넌트로 추출.
- `md:hidden`은 이 컴포넌트 자체엔 넣지 않는다(호출부가 모바일에서만 렌더 트리거하도록 관리) — 컴포넌트는 순수 UI.

## 3. `/portfolio` 모바일 렌더링

**파일:** `app/portfolio/page.tsx` (현재 749줄, `hidden md:block`/`md:hidden` 분기 없음)

- 데스크톱(`AccountsTab`의 현재 3열 그리드 + `AccountCard` 아코디언 + `PositionRow`)은 **그대로 유지** — `hidden md:block`으로 감싼다. 다른 3개 라우트에서 이미 검증된 패턴.
- `md:hidden` 신규 분기: `AccountsTab`이 이미 로드해둔 state(`alpacaPositions`, `hlTestnetPositions`, `hlMainnetPositions`, `kisMockHoldings`, `kisLiveHoldings`)를 재사용 — 새 fetch 없음. 통화/자산군 섹션 구분(국내주식/해외주식/코인)은 유지하되, 각 종목을 `ApListRow`로:
  - `leading` = `ApTickerBadge`
  - `title` = 종목명/티커
  - `subtitle` = 수량 · 평단가
  - `trailing` = `ApGainBar` + 손익률(%)
  - `trailingSub` = 현재가
  - `onClick` = 해당 종목으로 바텀시트 오픈
- 바텀시트 내용: 매입가/현재가/평가손익(금액+%) · 보유수량 · venue 라벨. 맨 아래 "AI 판단 보러가기" 버튼 → `router.push(`/research-os/chat?q=${encodeURIComponent(symbol)}`)`.
- `OrdersTab`/`PnlTab`은 이번 스펙 범위 밖(건드리지 않음) — 상위 프로젝트 메모에 있던 "dark-token audit" 항목과 겹치지 않게 별도로 남겨둔다.

## 4. `research-os/chat` 쿼리 파라미터 지원

**파일:** `app/(console)/research-os/chat/page.tsx`

- `useSearchParams()`로 `?q=` 읽기. 값이 있으면 마운트 시 입력창에 채우고 기존 제출 로직을 1회 자동 트리거(사용자가 다시 타이핑/탭할 필요 없이 바로 결과가 뜨도록).
- 데스크톱/모바일 두 분기 모두에 적용(공유 로직이라 분기 위가 아니라 컴포넌트 최상단 로직에 둔다).
- 기존 채팅 흐름(수동 입력)은 그대로 — `?q=` 없으면 지금과 동일하게 빈 입력 상태로 시작.

## 검증

- `npx tsc --noEmit` 클린.
- 신규 컴포넌트: ponytail 관례대로 최소 1개 smoke check(예: `ApTickerBadge`가 같은 심볼에 항상 같은 색 내는지 assert 기반 간단 체크) — 프레임워크 없이.
- UI 동작은 브라우저로 수동 확인 필요(devtools 모바일 뷰 또는 실기기) — 하단탭 5개 탭 전환, `/portfolio` 리스트 탭→시트→"AI 판단 보러가기"→chat 페이지 자동질문 흐름까지 end-to-end.

## 다음 단계

승인되면 `superpowers:writing-plans`로 구현 계획 작성 → `superpowers:subagent-driven-development`로 실행.
