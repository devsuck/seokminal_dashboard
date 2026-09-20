# 모바일 디자인 시스템 통일 + 정보 밀도 정리

> **계승됨:** 이 스펙의 태스크 1~10은 완료·커밋됨. 잔여 항목(버튼/타이포 미시스템화)은
> `docs/superpowers/specs/2026-09-20-design-system-formalization-design.md`로 계승·대체됨.

## 배경

Phase 265~268에 걸쳐 홈/포트폴리오/investment-os 리스크탭을 `ap-*` 토큰 기반 모바일 카드로
순차 전환했음. 사용자 재검토 결과 "조잡하다"는 피드백:

1. 카드 디자인에 페이지/섹션 간 통일성 없음
2. 필요 없는 정보가 계속 보임 (Phase 268에서 리스크탭 1차 정리했음에도 재지적)
3. 시각적 포인트(강조 요소) 부재 — 전부 밋밋
4. "자산군별 수익률" 위젯 — 바 그래프 여러 개가 어지러움
5. 포트폴리오 상단 탭(계좌현황/주문/손익/최적화도구) — 각진 박스 디자인
6. 포트폴리오 "거래소별 분포" 섹션 — 존재 이유 불분명
7. 에이전트(investment-os 리스크) 탭 — 정보 과다 재지적

사용자가 제공한 실제 원인 중 하나가 코드로 확인됨: `components/console/widgets.tsx:182`의
`AgentTree`가 다크 콘솔 토큰(`--c-hud`, `--c-border`, `--c-text-*`)을 라이트 `ap-*` 모바일
화면(`app/(console)/investment-os/page.tsx` 1241~1308행) 안에 그대로 섞어 쓰고 있음 — "카드
통일성 없음"의 구체적 증거이자 원인.

세 갈래 카드 시안(A/B/C)을 Artifact로 만들어 사용자가 검토, 선택 완료:
- 카드 스타일 = **C (다크히어로)**: 핵심 수치 1개를 어두운 칩에 담고, 보조 정보는 무테두리 행
- 자산군별 수익률 = **B (비중 바)**: 여러 개 바 대신 통합 비중 바 1개
- 포트폴리오 상단 = **A (탭 전환)**: 기존 `SegmentedToggle` 유지, 시각 스타일만 교체

### Addendum (같은 날, 스펙 보강) — 카드 시스템 중복 2건 + 홈 자산탭 중복 추가 발견

스펙 1차 작성 이후 "페이지별 중복 내용" 점검 중 추가로 확인:

1. **`components/ui/Card.tsx`가 `ApPanel`과 완전 중복** — 스타일 100% 동일(`rounded-ap-lg
   border border-ap-line bg-ap-surface shadow-ap-sm`), 6개 파일(`app/hud/page.tsx`,
   `app/hud/summary/page.tsx`, `app/portfolio/page.tsx`,
   `components/console/SettingsDrawer.tsx`, `components/hud/ExecutionTab.tsx`,
   `components/hud/TasksTab.tsx`)에서 `<Card>`/`<CardHeader>`로 쓰임.
2. **`components/console/primitives.tsx`가 `ApPrimitives.tsx`와 export 이름만 다르고
   구조 100% 동일**(`Panel`/`PanelHead`/`Dot`/`StatTile`/`Badge`/`Skeleton*`/`Meter` ↔
   `ApPanel`/`ApPanelHead`/`ApDot`/`ApStatTile`/`ApBadge`/`ApSkeleton*`/`ApMeter`) — 단
   `var(--c-*)` 다크 콘솔 토큰을 씀. 데스크톱 콘솔 8개 페이지(quant/validation,
   research-os/chat·governance·validation, investment-os/page·ai-portfolio·capital-claims)
   에서 사용 중. 사용자 확인: 데스크톱 다크 콘솔 톤 보존은 더 이상 우선순위 아님 — 그대로
   `ApPrimitives.tsx`로 흡수, 다크→라이트 시각 변화 허용.
3. **홈 "자산" 탭(`components/hud/PortfolioTab.tsx`)이 `/portfolio` 페이지 `AccountsTab`의
   `CcyTotalTile`과 완전 동일한 합계(`krwTotal`/`usdTotal`/`usdcTotal`)를 같은 라벨로
   중복 표시** — `/portfolio`가 이미 상세를 다 커버하므로, 홈 탭은 요약 1장 + 링크로 축소.

이 3건을 아래 컴포넌트 섹션 5~7, 목표/비목표/마이그레이션 순서/테스트에 반영함.

## 목표

- 모바일 4대 주요 목적지(홈/포트폴리오/에이전트/성과 — `BottomTabBar`의 `PRIMARY_TABS`)의
  카드 언어를 "다크히어로" 레시피 하나로 통일
- 자산군별 수익률 위젯을 통합 비중 바 1개로 교체 (KRW/USD/USDC 환산 필요 — 경량 FX fetch 추가)
- 포트폴리오 상단 탭을 pill 형태로 재스타일, "거래소별 분포"를 `accounts` 탭 바디로 흡수
- investment-os 리스크탭의 `AgentTree` 정보 과다·토큰 불일치 해소
- `Card.tsx`/`console/primitives.tsx` 제거, `ApPrimitives.tsx` 하나로 프리미티브 시스템 통일
- 홈 "자산" 탭의 자산 합계 중복(= `/portfolio` `AccountsTab`과 동일 수치 재노출) 제거

## 비목표 (Out of scope)

- 데스크톱(`hidden md:block`) 마크업의 레이아웃/정보구조 변경 — 이번 스펙은 `md:hidden`
  모바일 경로 + 프리미티브 통일(섹션 5~6)만 다룸. **예외**: 섹션 6의 `console/primitives.tsx`
  → `ApPrimitives.tsx` 흡수는 데스크톱 8개 콘솔 페이지의 시각 톤(다크→라이트)에 영향을
  주지만, 레이아웃/정보구조는 그대로 — 사용자 확인 완료(데스크톱 다크 톤 보존 더 이상
  우선순위 아님).
- bottom nav "더보기" 이하 페이지(overview/strategy/research/ops, council/, quant/,
  research-os/*) — 사용자가 아직 검토 안 함, 별도 스펙으로 후속
- SWR 데이터 캐싱 — 승인된 별개 트랙, 이 스펙과 섞지 않음

## 아키텍처

기존 패턴 유지: 페이지마다 `hidden md:flex`(데스크톱, 다크 토큰) / `md:hidden`(모바일,
`ap-*` 토큰) 분기 구조를 그대로 두고, 모바일 쪽 카드 마크업만 새 프리미티브로 교체.
새 프리미티브는 전부 `components/ui/ApPrimitives.tsx`에 추가 — 기존 `ApPanel`,
`ApStatTile` 등과 같은 위치, 같은 스타일.

## 컴포넌트

### 1. `ApHeroCard` (신설, `ApPrimitives.tsx`)

"다크히어로" 레시피의 재사용 프리미티브. 핵심 수치 1개는 어두운 칩, 나머지는 무테두리 행.

```tsx
export function ApHeroCard({
  label, value, valueCls, sub, rows,
}: {
  label: string;
  value: string;
  valueCls?: string;
  sub?: string;
  rows?: { label: string; value: string; cls?: string }[];
}) {
  return (
    <div className="bg-ap-surface rounded-ap-lg shadow-ap-sm overflow-hidden">
      <div className="bg-ap-ink-1 px-4 py-4">
        <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
        <div className={`text-2xl font-bold font-data mt-1 text-white ${valueCls ?? ""}`}>{value}</div>
        {sub && <div className="text-xs text-white/50 mt-0.5">{sub}</div>}
      </div>
      {rows && rows.length > 0 && (
        <div className="divide-y divide-ap-line px-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ap-ink-3">{r.label}</span>
              <span className={`font-data ${r.cls ?? "text-ap-ink-1"}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`valueCls`/`rows[].cls`로 `text-ap-up`/`text-ap-down` 같은 색 토큰 주입 — 손익 등 부호 있는
값에 사용.

**적용 대상 (4대 목적지 모바일 카드 전체 교체):**
- `app/hud/summary/page.tsx` — 홈 요약 카드들
- `app/portfolio/page.tsx` — `md:hidden` 블록의 `CcyTotalTile`/`AccountCard` 계열
- `app/(console)/investment-os/page.tsx` — 리스크탭 상단 상태 블록 (1249~1257행)을
  `ApHeroCard`로 교체 (label: "집행 상태", value: liveOn 여부, sub: 게이트/컴플라이언스)
- `app/performance/page.tsx` — `Metric` 4개 타일 중 핵심 지표(수익률)는 `ApHeroCard`,
  나머지(MDD/Sharpe/vs SPY)는 기존 `Metric` 유지 (전부 히어로화하면 다시 "포인트 없음" 반복)

기존 `ApStatTile`/`ApPanel`은 남겨둔다 — 바텀시트 안 보조 지표, 3단 그리드처럼 "여러 개를
나란히" 보여줘야 하는 곳엔 계속 사용. `ApHeroCard`는 "이 카드의 대표값 1개"를 강조할 때만.

### 2. 자산군별 수익률 — 통합 비중 바

> **주의 (스펙 보강 반영):** 이 섹션의 `PortfolioTab.tsx` 수정 부분(비중 바 렌더링)은
> **섹션 7로 대체됨** — 홈 자산탭 자체를 요약+링크로 축소하면서 비중 바를 아예 제거하기로
> 결정했기 때문. `getFxRate()` 추가(아래)는 그대로 유효 — 섹션 7의 `ApHeroCard` 값 계산에
> 여전히 씀. 즉 이 섹션은 **`lib/api.ts`의 `getFxRate()` 추가만** 적용하고, `PortfolioTab.tsx`
> 관련 코드(`weightBars`/`WeightStackBar`/`BarChart valueFmt` 변경)는 섹션 7로 가서 건너뜀.

**`lib/api.ts`에 FX 조회 추가:**

```ts
export interface FxRate { usdkrw: number; fetched_at: string; }

let fxCache: { rate: FxRate; at: number } | null = null;
const FX_TTL_MS = 24 * 60 * 60 * 1000; // 1일

export async function getFxRate(signal?: AbortSignal): Promise<FxRate> {
  if (fxCache && Date.now() - fxCache.at < FX_TTL_MS) return fxCache.rate;
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const rate: FxRate = { usdkrw: j.rates.KRW, fetched_at: new Date().toISOString() };
  fxCache = { rate, at: Date.now() };
  return rate;
}
```

무료 공개 API(`open.er-api.com`, 키 불필요, 일 1500회 무료 한도), 모듈 스코프 캐시로 1일
1회만 fetch. `lib/api.ts` "raw fetch 금지" 규칙의 예외 — 외부 서드파티 API라 사내
`API_URL` 베이스가 아니므로 이 함수 내부에서만 raw `fetch` 사용, 호출부는 반드시 이 함수를
거친다. USDC는 1:1 USD 고정(스테이블코인, 환율 변동 무시).

**`components/hud/PortfolioTab.tsx` 수정 — (섹션 7로 이동, 여기선 스킵):**

원래 여기 있던 "비중 바 렌더링" 계획(`weightBars`/`WeightStackBar`/`BarChart valueFmt` 변경,
`fx.loading`/`fx.error` 폴백)은 섹션 7의 "홈 자산탭 축소" 결정으로 전부 무효 — 비중 바 자체를
만들지 않고 `ApHeroCard` + 링크로 바로 감. 상세 구현은 섹션 7 참고.

### 3. 포트폴리오 상단 — pill 탭 + 거래소별 분포 흡수

**`SegmentedToggle` — ap 전용 variant 추가** (다크 콘솔 기본값 불변):

```tsx
// SegmentedToggleProps에 추가
variant?: "default" | "ap-pill";
```

```tsx
const AP_PILL_WRAP = "flex gap-1 p-1 bg-ap-bg rounded-full border border-ap-line";
const AP_PILL_ACTIVE = "bg-ap-ink-1 text-white";
const AP_PILL_INACTIVE = "text-ap-ink-3";
```

`variant === "ap-pill"`일 때 바깥 `<div>`에 `AP_PILL_WRAP`, 버튼에
`rounded-full ${active ? AP_PILL_ACTIVE : AP_PILL_INACTIVE}` (border 없음, `flex-1` 유지).
기존 `variant` 미지정 시 현재 동작 100% 동일 — 다크 콘솔 페이지들 회귀 없음.

`app/portfolio/page.tsx`의 `<SegmentedToggle>` 호출(969행 부근)에 `variant="ap-pill"` 추가.
단, 이 페이지는 데스크톱도 같은 `SegmentedToggle` 인스턴스를 공유하므로 — `variant`는
`md:hidden` 래퍼 안에서만 pill을 적용하도록, 모바일 전용 별도 `<SegmentedToggle>` 인스턴스로
분리한다(데스크톱 인스턴스는 `variant` 미지정 유지).

**거래소별 분포 이동:**

- 현재: `AccountsTab()` 데스크톱 RIGHT 컬럼(490~517행)의 상시 노출 `Card`, 모바일
  `md:hidden` 블록(528~548행)의 중복 `ApPanel` — 두 군데 존재
- 변경: 모바일 쪽 거래소별 분포 `ApPanel`을 별도 패널에서 제거하고, `accounts` 탭이 활성일
  때 `MobileGroup` 리스트 아래로 위치만 옮겨 같은 스크롤 흐름에 포함 (탭이 이미
  `accounts`/`orders`/`pnl`/`optimizer`로 분리되어 있으므로, "거래소별 분포"가 계좌 정보와
  분리된 별도 섹션처럼 보이던 문제 = 사실 탭 밖에 있던 게 아니라 탭 존재 자체를 사용자가
  카드 더미 속에서 놓친 것. 위치를 `accounts` 탭 바디 최하단으로 명확히 배치하고, 섹션
  타이틀을 "계좌 내 거래소 비중"으로 구체화해 존재 이유를 명시)
- 데스크톱 RIGHT 컬럼은 변경 없음 (비목표: 데스크톱)

### 4. `AgentTree` 정리 (`components/console/widgets.tsx:182`)

- **토큰**: `--c-hud`/`--c-border`/`--c-text-*` 직접 참조를 지우고, `ap-*` 컨텍스트에서
  호출될 때 쓸 수 있도록 톤을 prop으로 받게 변경:
  ```tsx
  export function AgentTree({
    node, depth = 0, tone = "console",
  }: { node: AgentNode; depth?: number; tone?: "console" | "ap" }) {
  ```
  `tone === "ap"`일 때 색상 클래스를 `text-ap-ink-1`/`text-ap-ink-3`/`border-ap-line`/
  `text-ap-brand`로 스왑. `tone` 미지정 시 기존 `--c-*` 그대로 — 데스크톱(`overview`/`strategy`
  등 다른 탭에서도 재사용됨) 회귀 없음.
- **밀도**: `depth >= 2`인 자식 노드는 기본 접힘. 루트(depth 0)의 자식(depth 1)까지만
  펼쳐서 보여주고, depth 1 노드에 자식이 있으면 "하위 N개 보기" 토글 추가(로컬
  `useState<Set<string>>`로 펼친 노드 id 추적, `node.id` 키 사용 — 이미 `key={ch.id}`로
  id 존재 확인됨).
- `app/(console)/investment-os/page.tsx` 1274행 호출부: `<AgentTree node={agents.data.council}
  tone="ap" />`로 교체.

### 5. `Card.tsx` 제거 → `ApPanel`/`ApPanelHead` 통합

`CardHeader`의 `children`(제목 텍스트)을 `ApPanelHead`의 `title` prop으로 옮기는 게
핵심 차이. 6개 파일 전부 제목이 평문 문자열이라 기계적 치환 가능 — 유일한 예외는
`app/portfolio/page.tsx:492-493`의 `거래소별 분포 <span>(구성)</span>`인데, 섹션 3에서
이미 이 타이틀을 "계좌 내 거래소 비중" 평문 문자열로 바꾸므로 순서만 섹션 3 이후로
잡으면 자연히 해소됨.

```tsx
// Before
import { Card, CardHeader } from "@/components/ui/Card";
<Card className="mb-1">
  <CardHeader right={<WorldClock now={now} />}>시스템개요</CardHeader>
  ...
</Card>

// After
import { ApPanel, ApPanelHead } from "@/components/ui/ApPrimitives";
<ApPanel className="mb-1">
  <ApPanelHead title="시스템개요" right={<WorldClock now={now} />} />
  ...
</ApPanel>
```

**대상 파일**: `app/hud/page.tsx`(5곳), `app/hud/summary/page.tsx`(1곳),
`app/portfolio/page.tsx`(5곳 — "거래소별 분포" 포함), `components/console/SettingsDrawer.tsx`
(3곳), `components/hud/ExecutionTab.tsx`(4곳), `components/hud/TasksTab.tsx`(4곳).

전부 이관 후 `components/ui/Card.tsx` 삭제.

### 6. `console/primitives.tsx` 제거 → `ApPrimitives.tsx` 흡수

export 1:1 대응이라 이름만 바꾸면 됨: `Panel`→`ApPanel`, `PanelHead`→`ApPanelHead`,
`Dot`→`ApDot`, `StatTile`→`ApStatTile`, `Badge`→`ApBadge`, `Skeleton`→`ApSkeleton`,
`SkeletonStatTile`→`ApSkeletonStatTile`, `SkeletonLines`→`ApSkeletonLines`,
`Meter`→`ApMeter`. `tone` prop 값(`"hud"|"pos"|"neg"|"warn"|"text-1"|"mute"|"info"`)도
`ApStatTile`/`ApBadge`/`ApMeter`/`ApDot`가 이미 동일하게 지원 — prop 이름 안 바뀜.

`Panel`에만 있고 `ApPanel`엔 없는 `hud`/`grid` boolean prop 사용처는 2곳뿐
(`app/(console)/quant/validation/page.tsx:27`의 `grid`,
`app/(console)/research-os/governance/page.tsx:55`의 `hud`) — 둘 다 데스크톱 전용
장식(그리드 헤어라인 오버레이, 시안 글로우 테두리)이라 새 prop 추가하지 않고 그냥
드롭, 평범한 `<ApPanel>`로 이관 (데스크톱 톤 보존 비우선순위 방침과 일치).

```tsx
// Before (components/console/primitives.tsx 기반)
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
<Panel hud className="p-5"> ... </Panel>
<StatTile label="컴플라이언스" value="통과" tone="pos" />

// After
import { ApPanel, ApPanelHead, ApStatTile, ApBadge } from "@/components/ui/ApPrimitives";
<ApPanel className="p-5"> ... </ApPanel>
<ApStatTile label="컴플라이언스" value="통과" tone="pos" />
```

**대상 파일(8개)**: `app/(console)/quant/validation/page.tsx`,
`app/(console)/research-os/chat/page.tsx`, `app/(console)/research-os/governance/page.tsx`,
`app/(console)/research-os/validation/page.tsx`, `app/(console)/investment-os/page.tsx`,
`app/(console)/investment-os/ai-portfolio/page.tsx`,
`app/(console)/investment-os/capital-claims/page.tsx`, `components/console/widgets.tsx`
(섹션 4의 `AgentTree`가 이미 이 파일에서 `Panel`/`Dot`를 씀 — 섹션 4 작업과 같이 처리).

전부 이관 후 `components/console/primitives.tsx` 삭제.

### 7. 홈 "자산" 탭 축소 (`components/hud/PortfolioTab.tsx`)

기존 `AssetTile` 3개 그리드 + `computeAssetWeightBars()` 비중 바를 전부 제거하고,
`ApHeroCard` 1개(총자산 요약, 자산군별 값은 `rows`로 병기) + "포트폴리오 상세 보기 →"
링크로 축소. 상세 수치·거래소별 구성은 `/portfolio`가 이미 전부 커버.

```tsx
// PortfolioTab() 리턴부 — AssetTile 그리드 + WeightStackBar/BarChart 블록을 아래로 교체
const usdEquiv = fx.data
  ? krwTotal! / fx.data.usdkrw + usdValue + usdcTotal!
  : null;

return (
  <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
    <h1 className="text-xl font-semibold text-ap-ink-1 tracking-wide">총 포트폴리오</h1>
    <ApHeroCard
      label="총 자산"
      value={usdEquiv != null ? fmt(usdEquiv, "USD") : "—"}
      rows={[
        { label: "국내주식", value: fmt(krwTotal, "KRW") },
        { label: "해외주식", value: fmt(usdValue, "USD") },
        { label: "코인", value: fmt(usdcTotal, "USDC") },
      ]}
    />
    <Link href="/portfolio"
      className="block text-center text-sm text-ap-brand no-underline hover:underline py-2">
      포트폴리오 상세 보기 →
    </Link>
  </div>
);
```

`computeAssetWeightBars()`/`WeightStackBar`/`BarChart` 관련 import·헬퍼는 이 파일에서
더 이상 안 쓰이므로 같이 제거. `AssetTile`도 제거(`PortfolioTab.tsx` 밖에서 참조 없음,
확인 완료). `fx`(`useTabFetch` + `getFxRate()`) 호출은 이 요약 계산에 여전히 필요해 유지.

## 데이터 흐름

- FX: `PortfolioTab`이 마운트 시 `getFxRate()` 1회 호출 → 모듈 캐시 24시간 재사용 →
  페이지 이동 시 재요청 없음 (이번 스펙과 별도 트랙인 SWR 도입 전에도 이 캐시만으로 충분).
- 나머지 컴포넌트는 기존 `useTabFetch`/`AbortController` 패턴 그대로 — 이번 스펙은
  데이터 페칭 레이어를 바꾸지 않는다.

## 에러 처리

- `getFxRate()` 실패(네트워크/API 장애): `PortfolioTab`은 통합 비중 바 대신 기존 수익률
  개별 바로 폴백. 사용자에게 에러 토스트 띄우지 않음(부가 위젯이라 실패해도 페이지 기능에
  영향 없음).
- `AgentTree` 하위 토글: 로컬 state라 실패 케이스 없음.

## 테스트

- `npx tsc --noEmit` — 신규/변경 컴포넌트 타입 체크
- 수동 확인 (Tailscale IP로 폰에서, `docs/progress.md` Phase 269 참고):
  1. 홈/포트폴리오/에이전트/성과 4개 페이지에서 `ApHeroCard` 렌더 확인
  2. 자산군별 수익률 — FX 정상/실패(네트워크 차단 후 재확인) 양쪽 폴백 확인
  3. 포트폴리오 상단 탭 pill 스타일 + 거래소별 분포가 `accounts` 탭 안에서만 보이는지 확인
  4. 에이전트 탭 `AgentTree` — depth 1까지 기본 노출, depth 2+ 접힘/펼침 동작, ap 톤 색상
     확인
  5. 데스크톱(`hidden md:block`)에서 위 4개 페이지 전부 기존과 동일하게 렌더되는지 회귀 확인
     (특히 `SegmentedToggle` 데스크톱 인스턴스, `AgentTree` overview/strategy 탭 호출부)
  6. `Card.tsx`/`console/primitives.tsx` 이관 대상 14개 파일(섹션 5~6) 전부 그대로 렌더되는지
     확인 — 콘솔 8개 페이지는 다크→라이트 톤 변화가 "의도된 변화"이므로 레이아웃/정보만
     깨지지 않았는지 확인(색 변화 자체는 회귀 아님)
  7. 홈 "자산" 탭이 `ApHeroCard` 1장 + 링크로만 보이는지, 링크 클릭 시 `/portfolio`로
     정상 이동하는지 확인
- 삭제 확인: `components/ui/Card.tsx`, `components/console/primitives.tsx` 파일 자체가
  git에서 삭제됐는지, 두 파일을 import하는 곳이 0곳인지 `grep -rl` 확인

## 마이그레이션 순서

1. `ApHeroCard` 프리미티브 추가 (독립적, 선행 가능)
2. `SegmentedToggle` `variant` prop 추가 (독립적)
3. `AgentTree` tone prop + depth 접힘 추가 (독립적)
4. `getFxRate()` + `PortfolioTab` 비중 바 교체 (2, 3과 독립)
5. 4대 페이지 모바일 카드를 `ApHeroCard`로 교체 (1 선행 필요)
6. `investment-os` 리스크탭 `AgentTree` 호출부 `tone="ap"` 적용 (3 선행 필요)
7. 포트폴리오 상단 pill 적용 + 거래소별 분포 이동 (2 선행 필요)
8. `Card.tsx` → `ApPanel`/`ApPanelHead` 이관 6개 파일 (7 선행 필요 — portfolio 페이지
   "거래소별 분포" 타이틀 변경 이후라야 예외 케이스 없이 기계적 치환 가능), 이관 후 `Card.tsx` 삭제
9. `console/primitives.tsx` → `ApPrimitives.tsx` 이관 8개 파일 (3 선행 필요 —
   `components/console/widgets.tsx`의 `AgentTree` 관련 `Panel`/`Dot` 이관을 같이 처리),
   이관 후 `console/primitives.tsx` 삭제
10. 홈 "자산" 탭(`PortfolioTab.tsx`) `ApHeroCard`+링크로 축소 (1 선행 필요)

각 단계 독립 커밋 가능 — 순서 안 지켜도 대부분 동작하나, 1/2/3을 먼저 넣어야 5/6/7/8/9/10이
참조 가능. 8은 7 이후, 9는 3 이후로 순서를 지켜야 예외 케이스가 안 생김.
