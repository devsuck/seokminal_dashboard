# 모바일 디자인 시스템 통일 + 정보 밀도 정리

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

## 목표

- 모바일 4대 주요 목적지(홈/포트폴리오/에이전트/성과 — `BottomTabBar`의 `PRIMARY_TABS`)의
  카드 언어를 "다크히어로" 레시피 하나로 통일
- 자산군별 수익률 위젯을 통합 비중 바 1개로 교체 (KRW/USD/USDC 환산 필요 — 경량 FX fetch 추가)
- 포트폴리오 상단 탭을 pill 형태로 재스타일, "거래소별 분포"를 `accounts` 탭 바디로 흡수
- investment-os 리스크탭의 `AgentTree` 정보 과다·토큰 불일치 해소

## 비목표 (Out of scope)

- 데스크톱(`hidden md:block`) 마크업 — 이번 스펙은 `md:hidden` 모바일 경로만 다룸
- 다크 콘솔 토큰 자체(`--radius:0` 등 "Bloomberg 무드") 변경 — 건드리지 않음
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

**`components/hud/PortfolioTab.tsx` 수정:**

기존 `returnBars`(수익률 % 기준 개별 바 3개) 대신, KRW 자산을 USD로 환산해 비중(%) 1개
통합 바로 표시:

```tsx
const fx = useTabFetch(true, (sig) => getFxRate(sig)); // 기존 useTabFetch 훅 재사용
const usdEquiv = fx.data
  ? krwTotal / fx.data.usdkrw + usdValue + usdcTotal
  : null;
const weightBars: BarItem[] = usdEquiv && usdEquiv > 0
  ? [
      { label: "국내주식", value: (krwTotal / fx.data!.usdkrw) / usdEquiv * 100, href: "/portfolio" },
      { label: "해외주식", value: usdValue / usdEquiv * 100, href: "/portfolio" },
      { label: "코인", value: usdcTotal / usdEquiv * 100, href: "/portfolio" },
    ].filter((b) => b.value > 0)
  : [];
```

`BarChart`의 `valueFmt`를 `${v.toFixed(0)}%`로 변경(수익률 %가 아닌 비중 %). 수익률은
`ApHeroCard`의 `rows`로 각 자산군 행에 병기(`{ label: "국내주식", value: "+2.3%", cls:
pnlCls(krwReturn) }`) — 정보 손실 없이 카드 1개로 통합.

`fx.loading`/`fx.error` 시 기존 return-bar 방식으로 폴백(FX API 장애 시에도 화면이 비지
않게).

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

## 마이그레이션 순서

1. `ApHeroCard` 프리미티브 추가 (독립적, 선행 가능)
2. `SegmentedToggle` `variant` prop 추가 (독립적)
3. `AgentTree` tone prop + depth 접힘 추가 (독립적)
4. `getFxRate()` + `PortfolioTab` 비중 바 교체 (2, 3과 독립)
5. 4대 페이지 모바일 카드를 `ApHeroCard`로 교체 (1 선행 필요)
6. `investment-os` 리스크탭 `AgentTree` 호출부 `tone="ap"` 적용 (3 선행 필요)
7. 포트폴리오 상단 pill 적용 + 거래소별 분포 이동 (2 선행 필요)

각 단계 독립 커밋 가능 — 순서 안 지켜도 동작하나, 1/2/3을 먼저 넣어야 5/6/7이 참조 가능.
