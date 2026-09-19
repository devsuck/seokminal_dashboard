# Investment OS IA 재정리 + 카드 시스템 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ApHeroCard`(다크히어로)를 폐기하고 새 라이트카드(`ApLightHero`)로 전 앱 카드 시스템을 통일하며, `/hud`+`/hud/summary` 중복 제거, capital-claims/게이트-용어/리스크정보/추천출처/사이클드릴다운까지 스펙에 명시된 8개 목표를 프론트엔드만으로 구현한다.

**Architecture:** 기존 데스크톱-다크(`hidden md:block`, `var(--c-*)`) / 모바일-라이트(`md:hidden`, `ap-*`) 분기 패턴을 그대로 유지한다. 이번 작업은 전부 모바일 라이트 경로 + `ApPrimitives.tsx` 프리미티브 레벨에서만 이뤄지며, 데스크톱 마크업은 목표 1(카드 통일)에 필요한 최소 변경(리스크탭 히어로 1곳)만 건드린다.

**Tech Stack:** Next.js (App Router) + React + TypeScript + Tailwind(`ap-*` 커스텀 토큰). 백엔드(`seokminal-multi-venue`) 변경 없음 — 모든 필요 필드(`fulfillment_mode`, `status`, `getLiveAgentCycles`의 `limit` 파라미터)는 이미 API에 존재함.

**Spec:** `docs/superpowers/specs/2026-09-20-investment-os-ia-consolidation-design.md` (커밋 `53fbdbf`, 사용자 승인 완료)

## Global Constraints

- 백엔드(`seokminal-multi-venue/**`) 파일은 일절 수정하지 않는다 — 프론트엔드(`seokminal-dashboard/**`)만.
- 데스크톱(`hidden md:block`, `var(--c-*)` 다크 토큰) 마크업의 레이아웃/정보구조는 변경하지 않는다. 예외: Task 1의 `investment-os/page.tsx:1277` 히어로 카드 교체(카드 시스템 통일에 필요한 최소 변경).
- 라이브 사이클링 에이전트 로직(`agent_loop.sh`)이나 오프라인 리서치 파이프라인 연동은 이 스펙의 비목표 — 절대 건드리지 않는다.
- 모든 신규/변경 UI는 `ap-*` Tailwind 토큰만 사용한다(`app/(console)/investment-os/capital-claims/page.tsx`, `app/(console)/investment-os/ai-portfolio/page.tsx`처럼 기존에 `var(--c-*)`만 쓰는 페이지는 이번에도 텍스트/배지 추가 수준으로만 건드리고 토큰 전체 마이그레이션은 하지 않는다 — 별도 스코프).
- Raw `fetch` 금지 — `lib/api.ts`/`lib/console-api.ts` 함수만 사용.
- `style={{}}` 금지(차트 컨테이너 높이 등 기존 예외만 유지).
- 각 태스크 후 `npx tsc --noEmit` 클린 확인.
- 이 레포는 브랜치/워크트리 없이 **main에 직접 커밋**한다(`/Users/seokhun/seokminal/CLAUDE.md` 컨벤션). 각 태스크는 그 자체로 독립 배포 가능한 커밋 단위.

---

### Task 1: `ApHeroCard` → `ApLightHero` 카드 시스템 통일

**Files:**
- Modify: `components/ui/ApPrimitives.tsx:224-252` (`ApHeroCard` 정의부 전체 교체)
- Modify: `app/(console)/investment-os/page.tsx:1277-1282`
- Modify: `app/performance/page.tsx:6,20-24,102-106`
- Modify: `app/portfolio/page.tsx:12,307`
- Modify: `app/hud/summary/page.tsx:8,126-134` (Task 3에서 이 파일 전체를 리다이렉트 스텁으로 교체하므로, 이 변경은 Task 3 실행 전까지만 유효 — 순서대로 진행하면 자연스럽게 소멸)
- Modify: `components/hud/PortfolioTab.tsx:10,146-151`
- Test: 없음(순수 프레젠테이션 컴포넌트 교체, 기존 각 페이지의 수동 스크린샷 확인으로 대체 — Task 1 Step 마지막에 기술)

**Interfaces:**
- Consumes: 없음(이번 태스크가 최초 진입점)
- Produces: `ApLightHero({label, value, valueCls?, sub?, rows?}): JSX.Element` — export from `components/ui/ApPrimitives.tsx`. 이후 모든 태스크가 카드 UI를 만들 때 이 컴포넌트를 사용한다.

- [ ] **Step 1: `ApPrimitives.tsx`에서 `ApHeroCard`를 `ApLightHero`로 교체**

`components/ui/ApPrimitives.tsx:224-252`의 기존 `ApHeroCard` 전체를 아래로 교체:

```tsx
export function ApLightHero({
  label, value, valueCls, sub, rows,
}: {
  label: string;
  value: string;
  valueCls?: string;
  sub?: string;
  rows?: { label: string; value: string; cls?: string }[];
}) {
  return (
    <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm overflow-hidden">
      <div className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-ap-ink-3">{label}</div>
        <div className={`text-2xl font-bold font-data mt-1 ${valueCls ?? "text-ap-ink-1"}`}>{value}</div>
        {sub && <div className="text-xs text-ap-ink-3 mt-0.5">{sub}</div>}
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

- [ ] **Step 2: `investment-os/page.tsx:1277` 교체**

`app/(console)/investment-os/page.tsx:31`의 import에서 `ApHeroCard`를 `ApLightHero`로 바꾼다:

```tsx
import { ApPanel, ApPanelHead, ApDot, ApStatTile, ApBadge, ApSkeleton, ApSkeletonStatTile, ApSkeletonLines, ApMeter, ApBottomSheet, ApLightHero } from "@/components/ui/ApPrimitives";
```

`app/(console)/investment-os/page.tsx:1277-1282`를 아래로 교체(다크칩 전제였던 `text-white/60`을 라이트카드용 `text-ap-ink-3`으로 수정):

```tsx
                  <ApLightHero
                    label="집행 상태"
                    value={agents.data ? (liveOn ? "라이브 집행 중" : "집행 대기") : "—"}
                    valueCls={liveOn ? "text-ap-up" : "text-ap-ink-3"}
                    sub={`게이트 ${data.gates.passed ? "통과" : "차단"} · 컴플라이언스 ${data.compliance.compliant ? "통과" : "실패"}`}
                  />
```

- [ ] **Step 3: `performance/page.tsx` 교체 + `pnlCls`의 `onDark` 파라미터 제거**

`app/performance/page.tsx:6`:

```tsx
import { ApLightHero } from "@/components/ui/ApPrimitives";
```

`app/performance/page.tsx:20-24`(주석 + `pnlCls` 함수)를 아래로 교체:

```tsx
function pnlCls(v: number | null | undefined) {
  if (v == null) return "text-ap-ink-1";
  return v > 0 ? "text-ap-up" : v < 0 ? "text-ap-down" : "text-ap-ink-2";
}
```

`app/performance/page.tsx:102-106`을 아래로 교체:

```tsx
            <ApLightHero
              label="수익률"
              value={`${data.return_pct > 0 ? "+" : ""}${data.return_pct}%`}
              valueCls={pnlCls(data.return_pct)}
            />
```

- [ ] **Step 4: `portfolio/page.tsx` 교체**

`app/portfolio/page.tsx:12`의 import에서 `ApHeroCard`를 `ApLightHero`로 바꾼다:

```tsx
import { ApPanel, ApPanelHead, ApTickerBadge, ApGainBar, ApListRow, ApBottomSheet, ApLightHero } from "@/components/ui/ApPrimitives";
```

`app/portfolio/page.tsx:307`:

```tsx
        <ApLightHero label={title} value={fmt(total, ccy)} />
```

- [ ] **Step 5: `hud/summary/page.tsx` 교체**

`app/hud/summary/page.tsx:8`:

```tsx
import { ApPanel, ApPanelHead, ApLightHero } from "@/components/ui/ApPrimitives";
```

`app/hud/summary/page.tsx:126-134`를 아래로 교체(다크칩 전제였던 `text-white/60`을 `text-ap-ink-3`으로 수정):

```tsx
          <ApLightHero
            label="SEOKMINAL"
            value={`실거래 ${liveLabel}`}
            valueCls={liveOn ? "text-ap-up" : "text-ap-ink-3"}
            rows={[
              { label: "상태", value: busy ? "처리 중" : active ? "가동 중" : "대기", cls: busy ? "text-ap-brand" : active ? "text-ap-up" : "text-ap-ink-2" },
              { label: "정합성", value: health ? (health.ok ? "이상없음" : `오류 ${health.n_errors}`) : "로딩 중", cls: (health?.n_errors ?? 0) > 0 ? "text-ap-down" : health ? "text-ap-up" : "text-ap-ink-3" },
            ]}
          />
```

(이 파일 전체는 Task 3에서 리다이렉트 스텁으로 완전히 교체된다. 이 Step은 Task 1이 Task 3보다 먼저 실행될 때 타입 에러 없이 빌드를 유지하기 위한 중간 단계다.)

- [ ] **Step 6: `PortfolioTab.tsx` 교체**

`components/hud/PortfolioTab.tsx:10`:

```tsx
import { ApLightHero } from "@/components/ui/ApPrimitives";
```

`components/hud/PortfolioTab.tsx:146-151`:

```tsx
      <ApLightHero
        label="USD 환산 총액"
        value={heroValue}
        sub={missingClass ? "일부 자산군 조회 실패 — 총액 과소 표시" : fxError ? "환율 조회 실패 — 자산군별 개별 표시" : undefined}
        rows={heroRows}
      />
```

- [ ] **Step 7: 타입체크 + 잔여 참조 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. 이어서 `grep -rn "ApHeroCard" app components`로 잔여 참조가 0건인지 확인.

- [ ] **Step 8: 수동 확인**

`npm run dev` 후 Chrome에서 5개 페이지(`/investment-os?tab=risk`, `/performance`, `/portfolio`, `/hud/summary`, `/hud?tab=portfolio`)를 모바일 너비(390px)로 열어 카드가 흰 배경(검은 칩 없이)으로 렌더되는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add components/ui/ApPrimitives.tsx "app/(console)/investment-os/page.tsx" app/performance/page.tsx app/portfolio/page.tsx app/hud/summary/page.tsx components/hud/PortfolioTab.tsx
git commit -m "refactor: ApHeroCard를 라이트카드 ApLightHero로 통일"
```

---

### Task 2: `/portfolio` "거래소별 분포" 기본 접힘

**Files:**
- Modify: `app/portfolio/page.tsx:528-548`
- Test: 없음(순수 UI 상태 토글, 수동 확인으로 대체)

**Interfaces:**
- Consumes: `compositionRows: {venue: string; ccy: string; balance: number; share: number}[]`(이미 파일 상단에서 계산됨, 변경 없음), `Bar` 컴포넌트(이미 파일 내 정의됨, 변경 없음)
- Produces: 없음(다른 태스크가 참조하지 않는 말단 UI)

- [ ] **Step 1: 모바일 "계좌 내 거래소 비중" 패널을 `<details>` 기본-접힘으로 교체**

`app/portfolio/page.tsx:528-548`을 아래로 교체:

```tsx
      {compositionRows.length > 0 && (
        <details className="group rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden">
          <summary className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ap-line cursor-pointer list-none">
            <span className="text-sm font-semibold text-ap-ink-1">계좌 내 거래소 비중</span>
            <span className="text-ap-ink-3 text-xs group-open:hidden">펼치기 ▾</span>
            <span className="text-ap-ink-3 text-xs hidden group-open:inline">접기 ▴</span>
          </summary>
          <div className="divide-y divide-ap-line/60 p-1">
            {[...compositionRows].sort((a, b) => b.balance - a.balance).map(r => (
              <div key={`${r.venue}-${r.ccy}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-ap-ink-1 text-sm truncate">{r.venue}</p>
                  <p className="text-ap-ink-3 text-xs">{r.ccy} · {fmt(r.balance, r.ccy, true)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <Bar ratio={r.share} tone="bg-ap-brand/70" trackClass="bg-ap-bg border-ap-line" />
                  <span className="tabular-nums text-ap-ink-2 text-xs">{(r.share * 100).toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
```

주의: `<summary>`에 두 개의 `<span>`(펼치기/접기)를 두고 `group-open:hidden`/`group-open:inline`으로 토글하는 방식이므로 `details`에 `group` 클래스가 반드시 있어야 한다(위 코드에 포함됨).

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 확인**

`/portfolio`를 390px 너비로 열어 "계좌 내 거래소 비중" 패널이 기본 접힌 상태로 보이는지, 탭하면 펼쳐지는지 확인. 데스크톱 너비(≥768px)에서는 우측 "거래소별 분포" `ApPanel`(라인 490-517)이 기존과 동일하게 항상 펼쳐진 상태로 보이는지 확인(이 태스크가 건드리지 않은 부분).

- [ ] **Step 4: 커밋**

```bash
git add app/portfolio/page.tsx
git commit -m "feat: 포트폴리오 모바일 거래소별 분포를 기본 접힘으로"
```

---

### Task 3: `/hud/summary` 제거, `/hud`로 리다이렉트

**배경 확인(구현 전 필수 선행 조사 결과, 스펙 대비 정정):** 스펙은 "`/hud`를 기존 `hidden md:block`/`md:hidden` 분기 패턴 그대로 써서 반응형 하나로 합친다"고 가정했으나, 실제 `app/hud/page.tsx`를 확인한 결과 이 파일은 **이미 `var(--c-*)` 다크 토큰을 전혀 쓰지 않고 `ap-*` 토큰만으로 작성된 단일 반응형 페이지**이며, `HomeTab()`(`app/hud/page.tsx:180-346`)은 이미 시스템개요 → **판단 필요(즉시 2번째 섹션, 0건이면 한 줄로 접힘)** → 인프라상태 → 계좌+돈길 → 최근활동 순으로 목표 2("판단 필요 큐 + 정상여부 배지 중심")를 상당 부분 이미 만족하고 있다. 반면 `app/hud/summary/page.tsx`가 데스크톱 브랜치(`hidden md:flex`, 라인 49-111)에 옛 다크 토큰(`var(--c-*)`가 아니라 `text-text-3`/`border-border`/`bg-panel` 같은 레거시 토큰)을 쓰는 축소판 요약 페이지로, `/hud`와 같은 `useHudFeed()` 데이터를 중복 렌더링하고 있다. 따라서 이 태스크는 "두 파일의 마크업을 병합"하는 게 아니라 **`/hud/summary`를 완전히 제거하고 기존 리다이렉트 스텁 패턴으로 교체**하는 것으로 충분하다. `/hud`의 `HomeTab()` 구조 자체는 이 태스크에서 변경하지 않는다.

**Files:**
- Modify: `lib/researchOsRedirects.ts:1-31` (`OLD_TO_NEW`에 1개 엔트리 추가)
- Modify: `app/hud/summary/page.tsx` (전체 내용을 리다이렉트 스텁으로 교체 — Task 1 Step 5에서 만든 `ApLightHero` 버전은 이 교체로 사라짐)
- Test: `__tests__/researchOsRedirects.test.ts`에 케이스 추가

**Interfaces:**
- Consumes: `redirect` from `next/navigation`, `OLD_TO_NEW` from `lib/researchOsRedirects.ts`
- Produces: 없음(말단)

- [ ] **Step 1: 리다이렉트 테스트 먼저 작성(실패 확인)**

`__tests__/researchOsRedirects.test.ts`를 열어 기존 테스트 패턴(다른 키에 대한 `expect(OLD_TO_NEW["/xxx"]).toBe("/yyy")` 형태)을 따라 아래 케이스를 추가:

```ts
  it("hud/summary는 /hud로 매핑된다", () => {
    expect(OLD_TO_NEW["/hud/summary"]).toBe("/hud");
  });
```

Run: `npm test -- researchOsRedirects`
Expected: FAIL(`OLD_TO_NEW["/hud/summary"]`가 `undefined`이므로 `toBe("/hud")` 불일치).

- [ ] **Step 2: `OLD_TO_NEW`에 엔트리 추가**

`lib/researchOsRedirects.ts:29-30`(`"/calendar": "/hud",` / `"/insider": "/hud",` 바로 다음) 뒤에 추가:

```ts
  "/hud/summary": "/hud",
```

- [ ] **Step 3: 테스트 재실행(통과 확인)**

Run: `npm test -- researchOsRedirects`
Expected: PASS.

- [ ] **Step 4: `app/hud/summary/page.tsx` 전체를 리다이렉트 스텁으로 교체**

`app/overview/page.tsx`(기존 리다이렉트 스텁 패턴)와 동일한 형태로 `app/hud/summary/page.tsx` 전체 내용을 아래로 교체:

```tsx
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function HudSummaryRedirect() {
  redirect(OLD_TO_NEW["/hud/summary"]);
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 수동 확인**

`npm run dev` 후 `/hud/summary`로 접속 시 `/hud`로 리다이렉트되는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add lib/researchOsRedirects.ts app/hud/summary/page.tsx __tests__/researchOsRedirects.test.ts
git commit -m "feat: /hud/summary 제거, /hud로 리다이렉트 통합"
```

---

### Task 4: "돈길"/"준비도 사다리" 게이트 시각 통일 + 리스크 정보 단일화

**배경 확인(구현 전 필수 선행 조사 결과, 스펙 대비 정정):** 두 용어를 실제로 비교한 결과, **하나의 이름으로 합치는 것은 부정확하다** — "돈길"(`app/hud/page.tsx:330-345`, `LadderStep` 컴포넌트, 엣지→페이퍼→ARM→LIVE)은 실제 시스템 상태(엣지 생존 확인 여부, 페이퍼 운용 경과월, ARM 결정, LIVE 스위치)를 반영하는 **진짜 게이트**이고, "준비도 사다리"(`app/(console)/investment-os/page.tsx:780`/`1343`, `RUNGS` = PAPER→SHADOW→SMALL_CAPITAL→PRODUCTION_CANDIDATE→AUTO_EXECUTION)는 새로고침하면 리셋되는 **자문용 시뮬레이션**(코드 주석 자체가 "승인해도 새로고침하면 PAPER로 리셋되고, 실제로 바뀌는 건 없습니다"라고 명시)이다. 서로 다른 스코프(에이전트/시스템 레벨 vs 포트폴리오 시뮬레이션)를 하나의 이름으로 합치면 오히려 혼란을 키운다. 따라서 이 태스크는 **이름은 유지하되 시각적 스테퍼 컴포넌트를 공유**하는 것으로 목표 5("같은 배지 컴포넌트 사용")를 달성한다: `LadderStep`을 `ApPrimitives.tsx`로 승격해 양쪽이 같은 4단계 톤 체계(done/current/blocked/pending)를 쓰게 하고, 각 헤더에 스코프를 명확히 하는 부제를 추가한다.

**Files:**
- Modify: `components/ui/ApPrimitives.tsx` (파일 끝에 `ApGateStep` 추가)
- Modify: `app/hud/page.tsx:118-133,330-345` (`LadderStep` 로컬 정의 제거, `ApGateStep` 사용 + 부제 추가)
- Modify: `app/(console)/investment-os/page.tsx:1343-1365` (모바일 RUNGS 렌더링을 `ApGateStep` 기반으로 교체 + 부제 추가. 데스크톱 780-806은 비목표라 변경하지 않음)
- Modify: `app/hud/page.tsx` 리스크 관련 섹션(아래 Step에서 특정), `app/(console)/investment-os/capital-claims/page.tsx` 리스크 관련 섹션 — 있다면 investment-os 리스크탭 링크로 축소
- Test: 없음(순수 UI, 수동 확인)

**Interfaces:**
- Consumes: 없음
- Produces: `ApGateStep({label, value, title?, state}: {label: string; value: string; title?: string; state: "done"|"current"|"blocked"|"pending"}): JSX.Element` — export from `components/ui/ApPrimitives.tsx`.

- [ ] **Step 1: `ApGateStep`을 `ApPrimitives.tsx`에 추가**

`components/ui/ApPrimitives.tsx` 파일 끝(Task 1에서 만든 `ApLightHero` 다음)에 추가:

```tsx
export function ApGateStep({ label, value, title, state }: {
  label: string; value: string; title?: string; state: "done" | "current" | "blocked" | "pending";
}) {
  const tone = state === "done" ? "text-ap-up" : state === "blocked" ? "text-ap-down"
    : state === "current" ? "text-ap-brand" : "text-ap-ink-3";
  const bar = state === "done" ? "bg-ap-up" : state === "blocked" ? "bg-ap-down"
    : state === "current" ? "bg-ap-brand" : "bg-ap-line";
  return (
    <div className="flex-1 min-w-0 px-1.5 pb-1.5">
      <div className={`h-0.5 mb-1 ${bar}`} />
      <p className="text-ap-ink-3 text-[9px] uppercase tracking-wider truncate">{label}</p>
      <p className={`font-data text-xs font-bold truncate ${tone}`} title={title}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: `app/hud/page.tsx`에서 로컬 `LadderStep` 제거, `ApGateStep` 사용 + 부제 추가**

`app/hud/page.tsx:118-133`(로컬 `LadderStep` 함수 전체와 그 위 주석)을 삭제한다.

`app/hud/page.tsx` 상단 import 블록에 `ApGateStep`을 추가한다(기존에 `ApPanel`, `ApPanelHead` 등을 이미 `@/components/ui/ApPrimitives`에서 import하고 있으므로 그 목록에 `ApGateStep` 추가).

`app/hud/page.tsx:330-345`를 아래로 교체(부제 한 줄 추가, `LadderStep` → `ApGateStep` 이름 교체):

```tsx
        <ApPanel>
          <ApPanelHead title="돈길" right={<Link href="/hud?tab=ops" className="no-underline uppercase tracking-wider hover:underline">집행 콘솔 →</Link>} />
          <p className="px-2 pt-1 text-[10px] text-ap-ink-3">시스템 실제 상태 — 라이브 전환 게이트</p>
          {/* 엣지 → 페이퍼 → ARM → LIVE 순서. 앞 관문이 안 끝나면 뒤는 pending으로 흐림 */}
          <div className="flex pt-1">
            <ApGateStep label="1 엣지" value={edgeLabel}
              state={edge?.status === "confirmed" ? "done" : edge?.status === "drifting" ? "blocked" : "current"} />
            <ApGateStep label="2 페이퍼" value={`${paperMo}/${paperMin}mo`}
              state={paperMo >= paperMin ? "done" : edge?.status === "confirmed" ? "current" : "pending"} />
            <ApGateStep label="3 ARM" value={armLabel} title={arm?.decision}
              state={arm?.decision === "GO" ? "done" : arm?.decision === "KILL" ? "blocked"
                : paperMo >= paperMin ? "current" : "pending"} />
            <ApGateStep label="4 LIVE" value={liveLabel} title={jarvis?.live_execution}
              state={jarvis?.live_execution === "disabled" ? "blocked"
                : jarvis?.live_execution === "enabled" ? "done" : "pending"} />
          </div>
        </ApPanel>
```

- [ ] **Step 3: `investment-os/page.tsx` 모바일 준비도 사다리를 `ApGateStep` 기반으로 교체 + 부제 추가**

`app/(console)/investment-os/page.tsx` 상단 import에 `ApGateStep` 추가.

`app/(console)/investment-os/page.tsx:1343-1365`를 아래로 교체(부제 추가, 칩 스타일 → `ApGateStep` 스테퍼로 교체, `AUTO_EXECUTION`의 잠금 표시는 `value`에 `🔒` 접두 유지):

```tsx
                  <ApPanelHead kicker="실행 레이어 · 승인 워크플로" title="준비도 사다리" right={<ApBadge tone="neg">자동 실행: {ladder?.auto_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] text-ap-ink-3">포트폴리오 시뮬레이션(자문용) — 새로고침하면 리셋, 실제 상태 아님</p>
                    <div className="text-xs text-ap-ink-2 leading-relaxed bg-ap-bg rounded-ap-md px-3 py-2">
                      전략 개별이 아니라 <b>포트폴리오 전체</b>가 다음 준비도 단계로 넘어가도 되는지 보여주는 자문용 시뮬레이션입니다.
                      승인해도 새로고침하면 PAPER로 리셋되고, 실제로 바뀌는 건 없습니다(AUTO_EXECUTION은 영구 비활성).
                      특정 전략을 실제 페이퍼 운용으로 올리는 "승격"은 여기가 아니라 <span className="text-ap-ink-1 font-semibold">Auto-Research</span>의 "🚀 페이퍼로 올리기" 버튼입니다.
                    </div>
                    <div className="flex">
                      {RUNGS.map((r) => {
                        const isAuto = r === "AUTO_EXECUTION";
                        const isCurrent = r === currentRung;
                        const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                        return (
                          <ApGateStep key={r} label={RUNG_LABEL[r] ?? r}
                            value={isAuto ? "🔒 잠김" : isCurrent ? "▶ 현재" : isPast ? "완료" : "대기"}
                            state={isAuto ? "blocked" : isCurrent ? "current" : isPast ? "done" : "pending"} />
                        );
                      })}
                    </div>
```

(이 블록 다음의 "필수 게이트" `ApBox`(라인 1367부터)는 이 태스크가 건드리지 않는다.)

- [ ] **Step 4: 리스크 정보 단일화 확인**

`grep -n "리스크" app/hud/page.tsx`로 `/hud` 안에 리스크 관련 섹션이 있는지 확인한다. 조사 결과(이 플랜 작성 시점) `/hud`의 `HomeTab()`에는 "판단 필요" 큐가 `risk.by_status.BLOCK` 카운트를 `lib/attention.ts:31-37`에서 이미 배지 1건("리스크 차단 이벤트")+링크(`/hud`, 원래 `/investment-os` 리스크탭이어야 하나 현재 `/hud`로 잘못 링크됨)로만 요약되어 있고, 별도의 리스크 상세 섹션은 없다 — 이미 목표 6("나머지는 요약+링크만")을 만족한다. 다만 `lib/attention.ts:35`의 `href: "/hud"`가 스펙 의도(investment-os 리스크탭 단일 소스)와 맞지 않으므로 `/investment-os?tab=risk`로 수정한다:

`lib/attention.ts:31-37`을 아래로 교체:

```ts
  const blocked = input.risk?.by_status?.BLOCK ?? 0;
  if (blocked > 0) {
    items.push({
      id: "risk-block", label: "리스크 차단 이벤트",
      detail: `${blocked}건`, href: "/investment-os?tab=risk", tone: "neg",
    });
  }
```

`app/(console)/investment-os/capital-claims/page.tsx`에는 리스크 관련 섹션이 없음을 `grep -n "리스크" "app/(console)/investment-os/capital-claims/page.tsx"`로 확인한다(결과 0건이면 이 파일은 변경하지 않는다).

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 수동 확인**

`/hud`(390px)와 `/investment-os?tab=ops`(390px)를 열어 "돈길"과 "준비도 사다리" 둘 다 같은 스테퍼 시각(바+라벨+값)으로 보이되 부제로 스코프가 구분되는지 확인. `/hud`에서 리스크 차단 이벤트 배지 클릭 시 `/investment-os?tab=risk`로 이동하는지 확인(재현: `risk.by_status.BLOCK > 0`인 상태를 만들기 어려우면 `lib/attention.ts`의 `deriveAttentionItems` 단위 테스트가 있는지 `find . -iname "attention*.test.ts"`로 확인하고, 있으면 그 테스트로 href 값만 검증).

- [ ] **Step 7: 커밋**

```bash
git add components/ui/ApPrimitives.tsx app/hud/page.tsx "app/(console)/investment-os/page.tsx" lib/attention.ts
git commit -m "refactor: 돈길/준비도 사다리 게이트 스테퍼 시각 통일, 리스크 배지 라우팅 수정"
```

---

### Task 5: capital-claims 흐름 UX — 승인 피드백 + 3진입점 배지 + 페이지 부제

**Files:**
- Modify: `app/(console)/investment-os/live-agents/page.tsx:109-158` (`ApprovalFeed`에 결과 배너 추가)
- Modify: `app/(console)/investment-os/capital-claims/page.tsx:90-97` (부제 텍스트)
- Modify: `components/hud/useHudFeed.ts` (god_mode/자본청구 후보 카운트를 홈 판단 큐가 참조할 수 있게 폴링 추가)
- Modify: `lib/attention.ts` (새 항목 2개 추가)
- Modify: `app/(console)/investment-os/page.tsx:1049-1051` (모바일 "추천 비중" 헤더에 자본청구 대기열 배지+링크 추가)
- Test: 없음(백엔드 `capital_claims.jsonl`이 비어있어 실제 두 분기 재현은 스펙의 "테스트" 섹션에 별도 스크립트로 위임됨 — 이 태스크는 UI만)

**Interfaces:**
- Consumes: `submitCapitalClaim(strategyId, requestedAmount?, s?): Promise<CapitalClaim>`(`lib/console-api.ts:878-881`, 이미 `fulfillment_mode`/`status` 포함 — 타입 확장 불필요), `getGodModeCandidates(s?)`, `getCapitalClaimCandidates(s?)`, `getCapitalClaimQueue(s?): Promise<CapitalClaimQueueResp>`(이미 `lib/console-api.ts`에 존재)
- Produces: `HudFeed`에 `godCandidates: GodModeCandidatesResp | null`, `claimCandidates: CapitalClaimCandidatesResp | null` 필드 추가(Task 완료 후 다른 코드가 `useHudFeed()`의 `feed.godCandidates`/`feed.claimCandidates`로 접근 가능)

- [ ] **Step 1: `ApprovalFeed`에 승인 결과 배너 추가**

`app/(console)/investment-os/live-agents/page.tsx:109-116`(`ApprovalFeed` 함수 시작부의 state 선언들)에 `lastResult` state와 타임아웃 ref를 추가:

```tsx
function ApprovalFeed({ onActed }: { onActed: () => void }) {
  const [god, setGod] = useState<GodModeCandidatesResp | null>(null);
  const [claims, setClaims] = useState<CapitalClaimCandidatesResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

`app/(console)/investment-os/live-agents/page.tsx:147-158`의 `claim` 함수를 아래로 교체:

```tsx
  const claim = async (strategyId: string, amount?: number) => {
    setBusy(strategyId);
    try {
      const res = await submitCapitalClaim(strategyId, amount);
      const msg = res.status === "approved"
        ? `자동 승인됨 · ${res.fulfillment_mode === "live" ? "live" : "paper"}`
        : res.status === "queued"
        ? "한도 초과 · 승인 대기열 등록됨"
        : res.status === "rejected"
        ? "거부됨"
        : res.status;
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      setLastResult(msg);
      resultTimerRef.current = setTimeout(() => setLastResult(null), 4000);
      await run();
      onActed();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(null);
    }
  };
```

`app/(console)/investment-os/live-agents/page.tsx:132`(`useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);`) 다음에 타이머 정리용 `useEffect`를 추가:

```tsx
  useEffect(() => () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); }, []);
```

`app/(console)/investment-os/live-agents/page.tsx:168`(`{err && <div className="text-[11px] text-ap-down px-1">{err}</div>}` 다음)에 결과 배너를 추가:

```tsx
      {lastResult && <div className="text-[11px] text-ap-brand px-1">{lastResult}</div>}
```

- [ ] **Step 2: capital-claims 페이지 부제 변경**

`app/(console)/investment-os/capital-claims/page.tsx:94-96`을 아래로 교체:

```tsx
          <div className="text-[9px] font-semibold tracking-[0.24em] uppercase text-[var(--c-text-3)]">
            초과분 승인대기 · 한도관리 · 이력
          </div>
```

- [ ] **Step 3: `useHudFeed`에 god_mode/자본청구 후보 폴링 추가**

`components/hud/useHudFeed.ts:1-15`의 import 블록을 아래로 교체(`getGodModeCandidates`, `getCapitalClaimCandidates`, 관련 타입 추가):

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge, getAccountBalances, getTriggeredAlerts,
  getLabHealth, getFleet,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
  type AccountBalances, type TriggeredAlert, type LabHealth, type FleetResponse,
} from "@/lib/api";
import {
  getConsolePipeline, getRisk, getInvestmentOs, getGodModeCandidates, getCapitalClaimCandidates,
  type ConsolePipeline, type RiskResp, type InvestmentOsResp,
  type GodModeCandidatesResp, type CapitalClaimCandidatesResp,
} from "@/lib/console-api";
```

`components/hud/useHudFeed.ts:17-23`(`HudFeed` 인터페이스)의 마지막 필드 줄을 아래로 교체:

```ts
  pipeline: ConsolePipeline | null; risk: RiskResp | null; ios: InvestmentOsResp | null;
  godCandidates: GodModeCandidatesResp | null; claimCandidates: CapitalClaimCandidatesResp | null;
}
```

`components/hud/useHudFeed.ts:27`의 `useState<HudFeed>` 초기값에 두 필드를 추가:

```ts
  const [f, setF] = useState<HudFeed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null, alerts: null, health: null, fleet: null, pipeline: null, risk: null, ios: null, godCandidates: null, claimCandidates: null });
```

`components/hud/useHudFeed.ts:73-78`(느린 30초 폴링 블록)을 아래로 교체:

```ts
      const [pipeline, risk, ios, godCandidates, claimCandidates] = await Promise.all([
        getConsolePipeline().catch(() => null),
        getRisk().catch(() => null),
        getInvestmentOs(1_000_000).catch(() => null),
        getGodModeCandidates().catch(() => null),
        getCapitalClaimCandidates().catch(() => null),
      ]);
      if (mounted) setF((prev) => ({ ...prev, pipeline, risk, ios, godCandidates, claimCandidates }));
```

- [ ] **Step 4: `lib/attention.ts`에 god_mode/자본청구 항목 추가**

`lib/attention.ts:11-19`(`AttentionInput` 인터페이스)를 아래로 교체:

```ts
export interface AttentionInput {
  pipeline: { proposals: number } | null;
  risk: { by_status: Record<string, number> } | null;
  investmentOs: {
    gates: { passed?: boolean };
    execution_ladder: { human_approval_mandatory: boolean };
  } | null;
  autoResearch: { n_candidates: number } | null;
  godCandidates: { promotable: unknown[]; reverted: unknown[] } | null;
  claimCandidates: { candidates: unknown[] } | null;
}
```

`lib/attention.ts:46-51`(`autoResearch` 항목 추가 블록) 다음에 아래 두 블록을 추가:

```ts
  const godPending = (input.godCandidates?.promotable.length ?? 0);
  if (godPending > 0) {
    items.push({
      id: "god-mode-promotable", label: "god_mode 승급 후보",
      detail: `${godPending}건`, href: "/investment-os/live-agents", tone: "warn",
    });
  }

  const claimPending = (input.claimCandidates?.candidates.length ?? 0);
  if (claimPending > 0) {
    items.push({
      id: "capital-claim-candidates", label: "자본배정 승인 대기",
      detail: `${claimPending}건`, href: "/investment-os/live-agents", tone: "warn",
    });
  }
```

`app/hud/page.tsx:227-232`와 `app/hud/summary/page.tsx`(Task 3에서 이미 리다이렉트 스텁으로 교체됨, 해당 없음)의 `deriveAttentionItems` 호출부를 아래로 교체(각 파일에서 `pipeline`, `risk`, `investmentOs`, `autoResearch` 뒤에 두 필드 추가):

`app/hud/page.tsx:227-232`:

```ts
  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
    godCandidates: f.godCandidates ? { promotable: f.godCandidates.promotable, reverted: f.godCandidates.reverted } : null,
    claimCandidates: f.claimCandidates ? { candidates: f.claimCandidates.candidates } : null,
  });
```

(`f`는 `HomeTab()` 내부에서 이미 `const { feed: f, bal } = useHudFeed();`로 구조분해된 변수이므로 위 코드는 추가 import 없이 그대로 사용 가능.)

- [ ] **Step 5: investment-os 모바일 "추천 비중" 헤더에 자본청구 대기열 배지 추가**

`app/(console)/investment-os/page.tsx`에서 `InvestmentOsInner` 컴포넌트(또는 overview 탭을 렌더링하는 함수) 내부에 `getCapitalClaimQueue`를 폴링하는 로직이 없으므로 추가한다. 먼저 상단 import에 추가:

```tsx
import { getCapitalClaimQueue, type CapitalClaimQueueResp } from "@/lib/console-api";
```

(이미 `lib/console-api.ts`에서 다른 함수들을 import하고 있다면 그 목록에 합친다.)

overview 탭 데이터를 로드하는 `useEffect`/`useState` 블록 근처에 상태를 추가(정확한 위치는 overview 탭 컴포넌트의 기존 `useState` 선언 바로 아래):

```tsx
  const [claimQueue, setClaimQueue] = useState<CapitalClaimQueueResp | null>(null);
  useEffect(() => {
    let mounted = true;
    getCapitalClaimQueue().then((q) => { if (mounted) setClaimQueue(q); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
```

`app/(console)/investment-os/page.tsx:1049-1051`을 아래로 교체:

```tsx
                <ApPanel>
                  <ApPanelHead kicker="포트폴리오 구성" title="추천 비중" right={
                    <div className="flex items-center gap-2">
                      <ApBadge tone="mute">규칙 기반 · 실배분 아님</ApBadge>
                      {claimQueue && claimQueue.count > 0 && (
                        <Link href="/investment-os/capital-claims" className="no-underline">
                          <ApBadge tone="warn">승인 대기 {claimQueue.count}</ApBadge>
                        </Link>
                      )}
                    </div>
                  } />
```

(`Link`는 이미 이 파일 상단에서 `next/link`로 import되어 있으므로 추가 import 불필요 — `grep -n "^import Link" "app/(console)/investment-os/page.tsx"`로 확인한다. 없다면 `import Link from "next/link";`를 추가한다.)

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 7: 수동 확인**

`/investment-os/live-agents`에서 "예"/"아니오" 버튼을 눌러 결과 배너("자동 승인됨 · paper" 등)가 4초간 보이다 사라지는지 확인. `/investment-os/capital-claims` 페이지 헤더 부제가 "초과분 승인대기 · 한도관리 · 이력"으로 바뀌었는지 확인. `/hud`(390px)에서 god_mode/자본청구 후보가 있을 때 "판단 필요" 큐에 새 항목이 뜨고 클릭 시 `/investment-os/live-agents`로 이동하는지 확인(백엔드에 후보 데이터가 없으면 `getGodModeCandidates`/`getCapitalClaimCandidates` 응답을 브라우저 devtools에서 mock하거나, 있는 그대로 0건 렌더 확인만으로 충분).

- [ ] **Step 8: 커밋**

```bash
git add "app/(console)/investment-os/live-agents/page.tsx" "app/(console)/investment-os/capital-claims/page.tsx" components/hud/useHudFeed.ts lib/attention.ts "app/(console)/investment-os/page.tsx"
git commit -m "feat: capital-claims 승인 피드백 + 3진입점 배지 통일 + 페이지 부제 변경"
```

---

### Task 6: 추천비중/최신추천 바 차트 출처 배지

**Files:**
- Modify: `app/(console)/investment-os/ai-portfolio/page.tsx:62-68` (Claude AI/규칙 기반 폴백 배지를 헤더로 이동)
- Modify: `app/(console)/investment-os/page.tsx:1050` (이미 목표 7 텍스트가 부분 반영돼 있음 — "추천 · 실배분 아님"을 "규칙 기반 · 실배분 아님"으로 텍스트만 수정, Task 5 Step 5에서 이미 이 라인을 건드렸으므로 이 태스크는 그 결과 위에서 시작함)
- Test: 없음(순수 텍스트/배지, 수동 확인)

**Interfaces:**
- Consumes: `latest: AiPortfolioLatest | null`(이미 `ai-portfolio/page.tsx`에 존재, `fallback_used: boolean` 필드 포함 — 정확한 타입명은 파일 내 기존 선언을 그대로 사용)
- Produces: 없음(말단)

- [ ] **Step 1: `ai-portfolio/page.tsx` "최신 추천" 헤더에 출처 배지 이동**

`app/(console)/investment-os/ai-portfolio/page.tsx:62`를 아래로 교체:

```tsx
        <ApPanelHead kicker="ai_portfolio · Claude CLI 배분 추천" title="최신 추천"
          right={<ApBadge tone="mute">{latest?.fallback_used ? "규칙 기반 폴백" : "Claude AI"}</ApBadge>} />
```

`app/(console)/investment-os/ai-portfolio/page.tsx:66-68`(기존 인라인 `fallback_used` 배지)을 삭제한다(헤더로 이동했으므로 중복):

```tsx
          {!loading && !err && latest?.fallback_used && (
            <ApBadge tone="warn">AI 응답 실패 — 규칙 기반(evidence_weighted) 폴백</ApBadge>
          )}
```

이 3줄을 제거한다.

- [ ] **Step 2: investment-os 모바일 추천 비중 배지 텍스트 확인**

Task 5 Step 5에서 이미 `app/(console)/investment-os/page.tsx:1050` 부근의 `ApBadge tone="mute"` 텍스트를 `"규칙 기반 · 실배분 아님"`으로 바꿔뒀는지 `grep -n "규칙 기반 · 실배분 아님" "app/(console)/investment-os/page.tsx"`로 확인한다. 이미 되어 있으면 이 Step은 스킵. 안 되어 있으면(Task 5를 건너뛰고 이 태스크만 단독 실행한 경우) 아래처럼 직접 수정:

```tsx
                  <ApPanelHead kicker="포트폴리오 구성" title="추천 비중" right={<ApBadge tone="mute">규칙 기반 · 실배분 아님</ApBadge>} />
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

`/investment-os/ai-portfolio`를 열어 "최신 추천" 헤더 우측에 "Claude AI"(또는 폴백 시 "규칙 기반 폴백") 배지가 보이는지 확인. `/investment-os?tab=overview`(390px)에서 "추천 비중" 헤더에 "규칙 기반 · 실배분 아님" 배지가 보이는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add "app/(console)/investment-os/ai-portfolio/page.tsx" "app/(console)/investment-os/page.tsx"
git commit -m "feat: 추천비중/최신추천 바 차트에 출처 배지(규칙기반 vs Claude AI) 추가"
```

---

### Task 7: live-agents 사이클 타임라인 압축 + 전체이력 드릴다운

**Files:**
- Modify: `app/(console)/investment-os/live-agents/page.tsx:12,276-397` (`AgentCardBody`)
- Test: 없음(순수 UI, 수동 확인)

**Interfaces:**
- Consumes: `getLiveAgentCycles(agentId: string, limit = 50, s?: AbortSignal): Promise<AgentCyclesResp>`(`lib/console-api.ts:153-154`, 이미 존재), `ApBottomSheet({open, onClose, title, children}): JSX.Element`(`components/ui/ApPrimitives.tsx:197-222`, 이미 존재)
- Produces: 없음(말단)

- [ ] **Step 1: import에 `ApBottomSheet` 추가**

`app/(console)/investment-os/live-agents/page.tsx:12`를 아래로 교체:

```tsx
import { ApBadge, ApSkeletonLines, ApDot, ApBottomSheet } from "@/components/ui/ApPrimitives";
```

- [ ] **Step 2: `AgentCardBody`에서 최초 fetch limit을 50으로 올리고, 인라인은 3개만, 전체는 시트로**

`app/(console)/investment-os/live-agents/page.tsx:276-283`(`AgentCardBody` 함수 시그니처 + state 선언)을 아래로 교체:

```tsx
function AgentCardBody({
  agentId, perf, onPromoted,
}: { agentId: string; perf?: AgentPerformance; onPromoted: () => void }) {
  const [cycles, setCycles] = useState<AgentCycle[] | null>(null);
  const [god, setGod] = useState<GodModeEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
```

`app/(console)/investment-os/live-agents/page.tsx:294`의 `getLiveAgentCycles(agentId, 8, ctrl.signal)`을 아래로 교체:

```tsx
        getLiveAgentCycles(agentId, 50, ctrl.signal),
```

`app/(console)/investment-os/live-agents/page.tsx:319`(`const recentCycles = cycles ? [...cycles].reverse() : [];`) 다음에 압축 표시용 변수를 추가:

```tsx
  const recentCycles = cycles ? [...cycles].reverse() : [];
  const previewCycles = recentCycles.slice(0, 3);
```

`app/(console)/investment-os/live-agents/page.tsx:379-394`(현재 "최근 사이클" 섹션 전체)를 아래로 교체:

```tsx
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-semibold text-ap-ink-3 uppercase tracking-wide">최근 사이클</div>
          {recentCycles.length > 3 && (
            <button onClick={() => setHistoryOpen(true)}
              className="text-[11px] text-ap-brand border-0 bg-transparent cursor-pointer">
              전체 이력 보기 ({recentCycles.length})
            </button>
          )}
        </div>
        {!loading && previewCycles.length === 0 && (
          <div className="text-[11px] text-ap-ink-3">기록된 사이클 없음.</div>
        )}
        <div className="space-y-1">
          {!loading && previewCycles.map((c) => (
            <div key={c.cycle} className="flex items-center gap-2 text-[11px]">
              <span className="text-ap-ink-3 font-data w-9 shrink-0">{fmtCycleTime(c.ts)}</span>
              <ApBadge tone={DECISION_TONE[c.decision] ?? "mute"}>{c.decision}</ApBadge>
              {c.symbol && <span className="text-ap-ink-1 font-semibold shrink-0">{c.symbol}</span>}
            </div>
          ))}
        </div>
      </div>

      <ApBottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="전체 사이클 이력">
        <div className="space-y-1.5">
          {recentCycles.map((c) => (
            <div key={c.cycle} className="flex items-center gap-2 text-[11px]">
              <span className="text-ap-ink-3 font-data w-9 shrink-0">{fmtCycleTime(c.ts)}</span>
              <ApBadge tone={DECISION_TONE[c.decision] ?? "mute"}>{c.decision}</ApBadge>
              {c.symbol && <span className="text-ap-ink-1 font-semibold shrink-0">{c.symbol}</span>}
              {c.note && <span className="text-ap-ink-2 truncate" title={c.note}>{c.note}</span>}
            </div>
          ))}
        </div>
      </ApBottomSheet>
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

`/investment-os/live-agents`에서 에이전트 카드를 펼쳐 "최근 사이클"이 최대 3개만 보이는지, `note`가 인라인에는 안 보이는지 확인. "전체 이력 보기" 클릭 시 바텀시트가 열리고 전체(최대 50개) 사이클이 `note` 포함해서 보이는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add "app/(console)/investment-os/live-agents/page.tsx"
git commit -m "feat: live-agents 사이클 타임라인 3개 압축 + 전체이력 바텀시트 드릴다운"
```

---

## 실행 순서 요약

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 (스펙의 마이그레이션 순서와 동일, Task 1이 다른 태스크가 쓰는 카드 프리미티브를 만들므로 반드시 먼저). Task 2, 6, 7은 서로 완전히 독립적이라 병렬 실행 가능하지만 이 플랜은 순차 실행을 기본으로 한다.

## 최종 검증(전체 태스크 완료 후)

- [ ] `npx tsc --noEmit` 클린.
- [ ] `npm test` 전건 통과.
- [ ] `grep -rn "ApHeroCard" app components`가 0건.
- [ ] Chrome에서 데스크톱(1280px)+모바일(390px) 스크린샷으로 5개 카드 호출부 + `/hud/summary` 리다이렉트 + `/portfolio` 접힘 + 게이트 스테퍼 2곳 + capital-claims 부제 + 바차트 배지 2곳 + live-agents 드릴다운을 한 번씩 시각 확인.
