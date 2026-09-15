# Investment OS 모바일 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/investment-os` (`app/(console)/investment-os/page.tsx`)의 모바일(`<768px`) 뷰를 라이트 카드형 UI로 신규 작성한다. 데스크톱(`≥768px`)은 완전히 그대로 둔다.

**Architecture:** 파일 최상단 `return`을 두 갈래로 분기: `<div className="hidden md:block">`(기존 다크 마크업, 무변경) / `<div className="md:hidden">`(신규 라이트 마크업). 두 브랜치 모두 파일에 이미 존재하는 동일한 state/hooks(`tab`, `data`, `monthly`, `org`, `alloc`, `positions`, `valLoop`, `val`, `market`, `inst`, `conn`, `acct`, `finQuery`/`finData`/`finLoading`/`finErr`/`runFinLookup`, `riskGov`, `prod`, `agents`, `council`, `logs`, `monitor`, `orders`, `live`, `currentRung`, `reviewed`, `advResult`, `history`, `busy`, `approveAndAdvance`, `resetLadder`, `sep`, `ladder`, `weights`, `sizes`, `nextRung`, `nextIsAuto`)를 공유한다 — fetch 로직 복제 없음, JSX만 두 벌.

**Tech Stack:** Next.js (App Router), React, Tailwind (기존 `--color-ap-*` 토큰 유틸리티), TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md`

## Global Constraints

- 신규 마크업은 `ap-` 유틸리티(`bg-ap-*`, `text-ap-*`, `border-ap-line`, `rounded-ap-*`, `shadow-ap-*`)만 사용. `.rail-ap` 래핑 불필요(이미 `ap-` 유틸만 씀 — `2026-09-15-mobile-home-redesign.md` 선례와 동일 판단).
- 데스크톱(`md:` 이상) 렌더링은 byte-for-byte 무변경 — 기존 JSX를 `hidden md:block`으로 감싸기만 하고 내용은 옮기지 않는다(들여쓰기만 조정).
- Raw `fetch` 금지 — 이미 파일에 있는 `lib/console-api.ts` 함수/훅만 재사용, 신규 API 호출 없음.
- `style={{}}` 금지, 단 런타임 톤(tone) 색상처럼 Tailwind 정적 클래스로 표현 불가능한 동적 CSS 변수 값은 예외(기존 `components/console/primitives.tsx`의 `Badge`/`StatTile`/`Meter`/`Dot`가 이미 이 패턴을 씀 — `ApBadge`/`ApStatTile`/`ApMeter`/`ApDot`도 동일 근거로 예외 적용).
- 테스트: `npx tsc --noEmit` + `npm run build` 통과 필수. 신규 vitest 불필요(로직 무변경, 표시만 추가).
- 백엔드/데이터 로직 무변경 — 프론트엔드 전용.

## Spec과의 차이

- **탭별 외부 딥링크(`TabLink` 행, 예: "전략 랩 ↗", "투자 위원회 ↗") 모바일 미포함.** 데스크톱 전용 참조 네비게이션이며 스코프 밖 라우트로 연결됨(`research-os/strategy-lab`, `research-os/committee` 등은 spec의 "스코프 밖" 목록) — 모바일 IA는 핵심 콘텐츠에 집중.
- **[정정, 최종 브랜치 리뷰에서 발견] Risk 탭의 `AgentTree`는 결국 그대로 재사용한다.** 최초 판단("`AgentTree`가 `var(--c-*)`를 하드코딩해서 라이트 카드 안에서 다크로 오류처럼 보인다")은 틀렸음이 최종 리뷰에서 확인됨 — `app/(console)/layout.tsx`가 모든 콘솔 라우트를 `.rail-ap`로 이미 감싸고 있고, `app/globals.css:90-107`이 `--c-*`를 `--color-ap-*`로 전부 리맵하므로 `AgentTree`는 이 페이지에서 이미 라이트로 렌더된다. Task 5에서 만든 평면 대체 렌더러(`ApDot tone="hud"` + `ApBadge tone="mute"` 고정)는 실제로는 `STATUS_MAP` 기반 빨강/주황 상태색을 전부 중립색으로 뭉개는 정보 손실이었음 — 수정 라운드에서 `<AgentTree node={agents.data.council} />` 재사용으로 교체.
- **Financials 조회 폼의 input/button을 `ap-` 토큰으로 새로 작성.** 데스크톱 원본(`bg-bg border-border text-text-1`, `bg-accent text-black`)은 프로젝트 구(舊) 다크 토큰 컨벤션이 아니라 CLAUDE.md 규정과도 다른 값이 섞여 있던 부분(감사 중 발견) — 데스크톱은 무변경 유지, 모바일만 정확한 `ap-` 토큰으로 작성.
- **`data.disclaimer`는 모바일에서도 탭과 무관하게 항상 표시**(데스크톱과 동일 위치·동일 동작으로 Task 6에서 최종 배치).
- **[최종 브랜치 리뷰 이후 추가] `ApPanel`/`ApPrimitives.tsx`를 기존 `components/ui/Card.tsx`(`Card`/`CardHeader`) 대신 신규 병렬 컴포넌트 계열로 만든 것은 의도된 이탈.** 스펙(`:106`)은 `Card`/`CardHeader` 재사용을 지시했으나, Task 1에서 다크 `components/console/primitives.tsx`를 라이트로 그대로 포팅하는 쪽을 택함 — 콘솔 레이아웃 하위 페이지(investment-os 및 이후 research-os 3개)가 전부 이 다크 프리미티브 패턴을 따르고 있어 구조적 일관성이 더 높다고 판단. 다만 그 결과 형제 모바일 페이지(`/hud/summary`, `Card` 기반)와 타입 스케일이 갈라짐(`text-[9px]`/`text-[11px]` vs `text-xs`/`text-sm`) — 수정 라운드에서 최소 크기를 `text-[11px]`(라벨류) / `text-xs`(본문/수치류)로 상향해 가독성만 보정하고, 컴포넌트 계열 자체는 유지. research-os 3개 플랜은 이 `ApPrimitives.tsx`를 그대로 재사용하며 이 결정을 다시 논의하지 않는다.
- **`.rail-ap`를 모바일 브랜치 래퍼에 적용하지 않은 것도 결과적으로만 무해한 결정이었다.** 최초 근거("이미 `ap-` 유틸만 써서 다크 잔여물 없음")는 사실이 아니었음 — 실제 이유는 `app/(console)/layout.tsx`가 콘솔 라우트 전체를 이미 `.rail-ap`로 감싸고 있어 페이지 레벨에서 다시 적용할 필요가 없었던 것. 결과는 동일(라이트 렌더)이라 재작업 없음.

---

### Task 1: 공용 `ap-` 프리미티브 컴포넌트

**Files:**
- Create: `components/ui/ApPrimitives.tsx`

**Interfaces:**
- Produces: `ApPanel({children, className?})`, `ApPanelHead({title, kicker?, right?})`, `ApDot({tone?, pulse?})`, `ApStatTile({label, value, unit?, sub?, tone?, accent?})`, `ApBadge({children, tone?, title?})`, `ApSkeleton({className?})`, `ApSkeletonStatTile()`, `ApSkeletonLines({rows?, className?})`, `ApMeter({value, tone?})`. Tone union: `"pos" | "neg" | "warn" | "hud" | "info" | "mute"`.
- Consumes: 없음 (신규 독립 파일).

이 파일은 `components/console/primitives.tsx`(다크 `--c-*` 토큰)를 `--color-ap-*` 토큰으로 포팅한 것. Task 2~6에서 investment-os 모바일 마크업이 이 파일을 import한다. 이후 research-os/validation, governance, chat 모바일 플랜도 동일 파일을 재사용(중복 구현 금지).

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

import type { ReactNode } from "react";

// ── Panel ─────────────────────────────────────────────────────────
export function ApPanel({
  children, className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function ApPanelHead({
  title, kicker, right,
}: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-10 py-1.5 px-4 border-b border-ap-line">
      <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
        {kicker && <span className="text-[9px] font-semibold tracking-[0.22em] text-ap-brand uppercase">{kicker}</span>}
        <span className="text-[13px] font-semibold tracking-wide text-ap-ink-1 truncate">{title}</span>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────
const AP_TONE: Record<string, string> = {
  pos: "var(--color-ap-up)", neg: "var(--color-ap-down)", warn: "var(--color-ap-caution)",
  hud: "var(--color-ap-brand)", info: "var(--color-ap-note)", mute: "var(--color-ap-ink-3)",
};
export function ApDot({ tone = "mute", pulse = false }: { tone?: keyof typeof AP_TONE | string; pulse?: boolean }) {
  const c = AP_TONE[tone] ?? tone;
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: c }}
    />
  );
}

// ── Stat tile ─────────────────────────────────────────────────────
export function ApStatTile({
  label, value, unit, sub, tone = "ink-1", accent,
}: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode;
  tone?: "ink-1" | "hud" | "pos" | "neg" | "warn"; accent?: keyof typeof AP_TONE;
}) {
  const valColor =
    tone === "hud" ? "text-ap-brand" :
    tone === "pos" ? "text-ap-up" :
    tone === "neg" ? "text-ap-down" :
    tone === "warn" ? "text-ap-caution" : "text-ap-ink-1";
  return (
    <ApPanel className="relative p-4">
      {accent && <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: AP_TONE[accent] }} />}
      <div className="text-[11px] font-semibold tracking-[0.2em] text-ap-ink-3 uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-data text-[26px] leading-none font-semibold ${valColor}`}>{value}</span>
        {unit && <span className="text-[11px] text-ap-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-ap-ink-2">{sub}</div>}
    </ApPanel>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
export function ApBadge({ children, tone = "mute", title }: { children: ReactNode; tone?: keyof typeof AP_TONE; title?: string }) {
  const c = AP_TONE[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-ap-sm text-[11px] font-semibold tracking-[0.14em] uppercase font-data whitespace-nowrap"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
    >
      {children}
    </span>
  );
}

// ── Skeleton (로딩 placeholder) ────────────────────────────────────
export function ApSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-ap-line ${className}`} />;
}

export function ApSkeletonStatTile() {
  return (
    <ApPanel className="p-4 space-y-2.5">
      <ApSkeleton className="h-2 w-16" />
      <ApSkeleton className="h-5 w-12" />
    </ApPanel>
  );
}

export function ApSkeletonLines({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <ApSkeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

// ── Meter (0..1) ──────────────────────────────────────────────────
export function ApMeter({ value, tone = "hud" }: { value: number; tone?: keyof typeof AP_TONE }) {
  const c = AP_TONE[tone];
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1 w-full bg-ap-line overflow-hidden rounded-full">
      <div className="h-full transition-[width] duration-500 rounded-full" style={{ width: `${pct}%`, background: c }} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (신규 파일만 추가, 다른 파일 미참조 상태).

- [ ] **Step 3: Commit**

```bash
git add components/ui/ApPrimitives.tsx
git commit -m "feat: add shared ap-token console primitives for mobile redesign"
```

---

### Task 2: 모바일 브랜치 분기 + 헤더/세이프티 배너/탭바/Overview 탭

**Files:**
- Modify: `app/(console)/investment-os/page.tsx:29-30` (import 추가), `:248-901` (return 분기)

**Interfaces:**
- Consumes: Task 1의 `ApPanel, ApPanelHead, ApDot, ApStatTile, ApBadge, ApSkeleton, ApSkeletonStatTile, ApSkeletonLines, ApMeter` (from `@/components/ui/ApPrimitives`). 파일에 이미 존재하는 `TABS, tab, setTab, data, err, sep, weights, sizes, monthly, org, alloc, positions, DECISION_TONE, GRADE_LABEL, STATUS_LABEL`.
- Produces: 이후 Task(3~6)가 이어 붙일 `{tab === "..." && (...)}` 형제 블록들의 삽입 위치(모바일 `<div className="p-4 space-y-4">...{data && (<>...</>)}</div>` 안, 탭바 블록 바로 다음).

- [ ] **Step 1: import 추가**

`app/(console)/investment-os/page.tsx:30` 바로 아래에 추가:

```tsx
import { ApPanel, ApPanelHead, ApDot, ApStatTile, ApBadge, ApSkeleton, ApSkeletonStatTile, ApSkeletonLines, ApMeter } from "@/components/ui/ApPrimitives";
```

- [ ] **Step 2: 기존 return을 `hidden md:block`으로 감싸기 (내용 무변경)**

`app/(console)/investment-os/page.tsx:248-249`의

```tsx
  return (
    <div className="min-h-full">
```

를

```tsx
  return (
    <>
    <div className="hidden md:block min-h-full">
```

로 바꾸고, 파일 끝의 (원래 `:898-900`)

```tsx
      </div>
    </div>
  );
}
```

를 아래처럼 바꾼다 — 안쪽 두 `</div>`는 기존 것 그대로 두고, 새 모바일 형제 div를 그 사이/뒤에 추가:

```tsx
      </div>
    </div>

    <div className="md:hidden min-h-screen bg-ap-bg">
      {/* Step 3에서 내용 추가 */}
    </div>
    </>
  );
}
```

`:249`~`:897`(원래 `<div className="min-h-full">` 내부 전체, `PageHeader`부터 `disclaimer` div까지)는 **한 글자도 고치지 않는다** — 바깥 두 줄만 바뀐다.

- [ ] **Step 3: 모바일 헤더 + 세이프티 배너 + 스켈레톤 + 요약 스탯 + 탭바 + Overview 탭**

Step 2에서 남긴 `{/* Step 3에서 내용 추가 */}` 자리에 아래 전체를 채운다:

```tsx
      <div className="sticky top-0 z-10 bg-ap-bg/90 backdrop-blur border-b border-ap-line px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ap-ink-1">Investment OS</span>
        <div className="flex gap-1.5">
          {sep && <ApBadge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</ApBadge>}
          <ApBadge tone="neg">AUTO-EXEC OFF</ApBadge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          <ApBadge tone="pos">연구=생산 · 투자=소비</ApBadge>
          <ApBadge tone="pos">Research OS 무변경</ApBadge>
          <ApBadge tone="neg">AUTO_EXECUTION 영구 OFF</ApBadge>
          <ApBadge tone="warn">사람 승인 필수</ApBadge>
          <ApBadge tone="warn">Risk/Compliance/Portfolio/Kill 우회 불가</ApBadge>
          <ApBadge tone="mute">모두 추천/시뮬레이션 · 실행 없음</ApBadge>
        </div>

        {!data && !err && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
            </div>
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
              {TABS.map((t) => (
                <div key={t.key} className="shrink-0 px-3 h-8 rounded-ap-md border border-ap-line flex items-center">
                  <ApSkeleton className="h-2.5 w-14" />
                </div>
              ))}
            </div>
            <ApPanel>
              <div className="px-4 h-10 border-b border-ap-line flex items-center"><ApSkeleton className="h-2.5 w-32" /></div>
              <div className="p-4"><ApSkeletonLines rows={4} /></div>
            </ApPanel>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ApStatTile label="소비된 리서치" value={String(data.knowledge.consumed_candidates)} sub={`research 무변경: ${!data.knowledge.research_os_modified ? "예" : "아니오"}`} tone="hud" />
              <ApStatTile label="포트폴리오 포지션" value={String(Object.keys(weights).length)} sub={data.portfolio.method} tone="pos" />
              <ApStatTile label="컴플라이언스" value={data.compliance.compliant ? "통과" : "실패"} sub={`override 불가: ${!data.compliance.human_can_override ? "예" : "아니오"}`} tone={data.compliance.compliant ? "pos" : "neg"} />
              <ApStatTile label="필수 게이트" value={data.gates.passed ? "통과" : "차단"} sub={`bypass: ${data.gates.bypass_possible ? "가능" : "불가"}`} tone={data.gates.passed ? "pos" : "warn"} />
            </div>

            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`shrink-0 px-3 h-8 rounded-ap-md text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                    tab === t.key ? "bg-ap-brand text-white border-ap-brand" : "bg-ap-surface text-ap-ink-2 border-ap-line"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="monthly-review" title="월간 의사결정 루프" right={<ApBadge tone="mute">제안 라벨</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {monthly.loading && <ApSkeletonLines rows={3} />}
                    {monthly.data && monthly.data.strategies.length === 0 && (
                      <div className="text-[11px] text-ap-ink-3">추적 대상 전략 없음.</div>
                    )}
                    {(monthly.data?.strategies ?? []).map((s) => {
                      const dr = s.decision_required ?? {};
                      const tone = DECISION_TONE[dr.suggested_label ?? ""] ?? "mute";
                      return (
                        <div key={s.strategy_id} className="bg-ap-bg rounded-ap-md p-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] text-ap-ink-1 font-semibold truncate">{s.strategy_id}</div>
                            <div className="text-[11px] text-ap-ink-3 truncate">{dr.reason}</div>
                          </div>
                          <ApBadge tone={tone}>{dr.suggested_label ?? "—"}</ApBadge>
                        </div>
                      );
                    })}
                    {monthly.data?.prediction_integrity && (
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <ApStatTile label="유효" value={String(monthly.data.prediction_integrity.valid)} tone="pos" />
                        <ApStatTile label="레거시" value={String(monthly.data.prediction_integrity.legacy_capture)} tone="ink-1" />
                        <ApStatTile label="무효화" value={String(monthly.data.prediction_integrity.invalidated)} tone="neg" />
                        <ApStatTile label="재포착 필요" value={String(monthly.data.prediction_integrity.recapture_required)} tone="warn" />
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="research-organization" title="시스템 헬스" />
                  {org.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {org.err && <div className="p-4 text-[11px] text-ap-down">{org.err}</div>}
                  {org.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ApBadge tone={org.data.operational_status.operational ? "pos" : "warn"}>{org.data.operational_status.operational ? "가동 중" : "검토 필요"}</ApBadge>
                        <ApBadge tone="mute">지식 헬스: {GRADE_LABEL[org.data.knowledge_health.grade] ?? org.data.knowledge_health.grade}</ApBadge>
                        {org.data.strategy_health.review_needed_count > 0 && <ApBadge tone="warn">review 필요 {org.data.strategy_health.review_needed_count}</ApBadge>}
                      </div>
                      {org.data.strategy_health.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[11px]">
                          <span className="text-ap-ink-1">{s.strategy}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-data text-ap-ink-2">{s.health_score}</span>
                            <ApBadge tone={s.review_needed ? "warn" : "pos"}>{GRADE_LABEL[s.grade] ?? s.grade}</ApBadge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="포트폴리오 구성" title="추천 비중" right={<ApBadge tone="mute">추천 · 실배분 아님</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {Object.entries(weights).length === 0 && <div className="text-[11px] text-ap-ink-3">소비할 연구 후보 없음 — 지식 축적 필요.</div>}
                    {Object.entries(weights).map(([sid, w]) => (
                      <div key={sid} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-ap-ink-1 truncate">{sid}</span>
                          <span className="font-data text-ap-ink-3">{(w * 100).toFixed(1)}% · {(sizes[sid] ?? 0).toLocaleString()}</span>
                        </div>
                        <ApMeter value={w} tone="hud" />
                      </div>
                    ))}
                    <div className="text-[9px] text-ap-ink-3 pt-1">우측 수치 = position sizing 추천(notional 1M 기준). 자본 배분/집행 아님.</div>
                    {alloc.data && (alloc.data.derived_proposal?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-ap-line space-y-1">
                        <div className="text-[9px] tracking-[0.2em] text-ap-ink-3 uppercase">배분 파생 제안</div>
                        {alloc.data.derived_proposal!.map((a) => (
                          <div key={a.strategy_id} className="flex items-center justify-between text-[11px]">
                            <span className="text-ap-ink-2 truncate">{a.name} · {a.factor}</span>
                            <span className="font-data text-ap-ink-3">{(a.target_weight * 100).toFixed(1)}% · {STATUS_LABEL[a.status] ?? a.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="/console/positions" title="포지션" right={positions.data && <ApBadge tone="mute">{positions.data.count}건</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {positions.loading && <ApSkeletonLines rows={4} />}
                    {positions.data && positions.data.count === 0 && <div className="text-[11px] text-ap-ink-3">{positions.data.note}</div>}
                    {positions.data && positions.data.positions.slice(0, 8).map((p, i) => (
                      <div key={i} className="text-[11px] font-data text-ap-ink-2 border-b border-ap-line last:border-0 py-1.5 space-y-0.5">
                        {Object.entries(p).slice(0, 5).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
                      </div>
                    ))}
                  </div>
                </ApPanel>
              </div>
            )}
          </>
        )}
      </div>
```

- [ ] **Step 4: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음. (전략/리서치/리스크/운영 탭 클릭 시 모바일에서 빈 화면 — 정상, Task 3~6에서 채움.)

- [ ] **Step 5: Commit**

```bash
git add app/\(console\)/investment-os/page.tsx
git commit -m "feat: split investment-os into desktop/mobile branches, add mobile shell + overview tab"
```

---

### Task 3: Strategy Intelligence 탭 모바일

**Files:**
- Modify: `app/(console)/investment-os/page.tsx` (Task 2가 만든 모바일 `{data && (<>...</>)}` 안, Overview 탭 블록 바로 다음)

**Interfaces:**
- Consumes: `sideLoading, acct, conn, fwd, valLoop, val, SCORE_STATUS_LABEL, STATUS_LABEL, evidenceQuality, forwardProgress, riskState` (파일에 이미 존재), Task 1의 `ApPanel, ApPanelHead, ApBadge, ApSkeletonLines`.
- Produces: 없음 (다음 탭과 독립적인 형제 블록).

- [ ] **Step 1: Overview 탭 블록(Task 2, `{tab === "overview" && (...)}`) 바로 다음에 추가**

```tsx
            {tab === "strategy" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="Forward Learning · STEP4" title="전략별 검증 상태" right={<ApBadge tone="mute">조인 · 새 원장 없음</ApBadge>} />
                  <div className="p-4 space-y-3">
                    {sideLoading && <ApSkeletonLines rows={4} />}
                    {!sideLoading && acct && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-[9px] tracking-[0.2em] text-ap-brand uppercase">Edge Score</span>
                        {acct.edge_score.status === "PROVISIONAL"
                          ? <ApBadge tone="mute">미확정 — {acct.edge_score.graded_scorable ?? 0}/{acct.edge_score.needed ?? 20} 채점됨</ApBadge>
                          : <ApBadge tone="pos">계산됨 — {acct.edge_score.graded_scorable ?? 0} 채점됨</ApBadge>}
                        {conn && (
                          <ApBadge tone={conn.validation_score.status === "PROVISIONAL" ? "mute" : "pos"}>
                            Validation Score: {SCORE_STATUS_LABEL[conn.validation_score.status ?? ""] ?? conn.validation_score.status}
                          </ApBadge>
                        )}
                      </div>
                    )}
                    {fwd && fwd.count === 0 && <div className="text-[11px] text-ap-ink-3">추적 대상(paper_active/watchlist/paper_candidate) 전략 없음.</div>}
                    {(fwd?.records ?? []).map((r) => {
                      const eq = evidenceQuality(r); const fp = forwardProgress(r); const rs = riskState(r);
                      return (
                        <div key={r.strategy_id} className="bg-ap-bg rounded-ap-md p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[11px] text-ap-ink-1 font-semibold">{r.strategy_id}</span>
                            <ApBadge tone="hud">{STATUS_LABEL[r.validation_status ?? ""] ?? r.validation_status ?? "—"}</ApBadge>
                          </div>
                          {r.thesis && <div className="text-[11px] text-ap-ink-2">{r.thesis}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            <ApBadge tone={eq.tone}>근거: {eq.label}</ApBadge>
                            <ApBadge tone={fp.tone}>Forward: {fp.label}</ApBadge>
                            <ApBadge tone={rs.tone}>리스크: {rs.label}</ApBadge>
                            {!r.prediction_captured && <ApBadge tone="warn">Thesis 사전등록 안 됨</ApBadge>}
                          </div>
                          {(r.next_possible?.length ?? 0) > 0 && (
                            <div className="text-[11px] text-ap-ink-3">
                              다음 가능 상태: {r.next_possible!.join(", ")}
                              {(r.human_approval_required_next?.length ?? 0) > 0 &&
                                <span className="text-ap-caution"> · 사람 승인 필요: {r.human_approval_required_next!.join(", ")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {fwd && (
                      <div className="text-[11px] text-ap-ink-3 pt-1">
                        커버리지 갭: thesis 없음 {fwd.coverage_gaps.missing_thesis} ·
                        thesis 사전등록 안 됨 {fwd.coverage_gaps.missing_prediction_capture} ·
                        forward 데이터 없음 {fwd.coverage_gaps.missing_forward_data} / {fwd.count}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="validation-loop" title="라이프사이클 보드"
                    right={valLoop.data && <ApBadge tone={valLoop.data.loop_status.release_ready ? "pos" : "mute"}>{valLoop.data.loop_status.release_ready ? "출시 준비 완료" : "진행 중"}</ApBadge>} />
                  {valLoop.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {valLoop.data && (
                    <div className="p-4 space-y-1.5">
                      {valLoop.data.lifecycle_board.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[11px]">
                          <span className="text-ap-ink-1">{s.strategy}</span>
                          <ApBadge tone="hud">{s.current_state}</ApBadge>
                        </div>
                      ))}
                      <div className="pt-1.5 flex items-center gap-2 text-[11px] text-ap-ink-3">
                        <span>품질: {valLoop.data.quality_panel.quality_score ?? "—"} ({valLoop.data.quality_panel.grade})</span>
                        {valLoop.data.validation_panel.divergence_detected && <ApBadge tone="warn">편차 감지됨</ApBadge>}
                      </div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="validation" title="검증 게이트" />
                  {val.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {val.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{val.data.gates.map((g) => <ApBadge key={g} tone="mute">{g}</ApBadge>)}</div>
                      <div className="text-[11px] text-ap-ink-3">레드팀 n={val.data.redteam.n} · 사람 동의={val.data.redteam.human_redteam_agree ?? "—"}</div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-ap-ink-2">
                        {Object.entries(val.data.experiment_status).map(([k, v]) => <span key={k} className="font-data">{k}: {v}</span>)}
                      </div>
                    </div>
                  )}
                </ApPanel>
              </div>
            )}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add app/\(console\)/investment-os/page.tsx
git commit -m "feat: add investment-os mobile strategy intelligence tab"
```

---

### Task 4: Research Evidence 탭 모바일

**Files:**
- Modify: `app/(console)/investment-os/page.tsx` (Strategy 탭 블록 바로 다음)

**Interfaces:**
- Consumes: `market, inst, conn, sideLoading, finQuery, setFinQuery, finData, finLoading, finErr, runFinLookup` (파일에 이미 존재), Task 1의 `ApPanel, ApPanelHead, ApBadge, ApSkeletonLines, ApSkeletonStatTile, ApStatTile`.

- [ ] **Step 1: Strategy 탭 블록(Task 3) 바로 다음에 추가**

```tsx
            {tab === "research" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="market-cockpit" title="마켓 / 리서치 인텔리전스" right={market.data && <ApBadge tone="hud">{market.data.market_state.regime}</ApBadge>} />
                  {market.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {market.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{market.data.market_state.labels.map((l) => <ApBadge key={l} tone="mute">{l}</ApBadge>)}</div>
                      {market.data.top_opportunities.map((o, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-ap-ink-1 truncate">{o.name} <span className="text-ap-ink-3">· {o.kind}</span></span>
                          <span className="font-data text-ap-ink-3 shrink-0">{o.confidence} · EV {o.expected_value}</span>
                        </div>
                      ))}
                      <div className="text-[11px] text-ap-ink-3">헬스 스코어 {market.data.health_score} · 상위 리스크 {market.data.risk.top_category ?? "—"}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="institutional-intelligence" title="기관 인텔리전스" right={inst.data && <ApBadge tone="mute">{inst.data.data_production_health.overall_status}</ApBadge>} />
                  {inst.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {inst.data && (
                    <div className="p-4 space-y-1.5 text-[11px] text-ap-ink-2">
                      <div>데이터 품질 평균: <span className="font-data text-ap-ink-1">{inst.data.data_production_health.average_quality}</span></div>
                      <div>섹터: {inst.data.sector_intelligence.sector} — {inst.data.sector_intelligence.key_entities.join(", ")}</div>
                      <div>매크로 상태: {inst.data.macro_context.macro_state}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="data-connection" title="예측 커버리지" />
                  {sideLoading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {!sideLoading && conn && (
                    <div className="p-4 space-y-1.5 text-[11px] text-ap-ink-2">
                      <div>총 예측 수: <span className="font-data text-ap-ink-1">{conn.prediction_coverage.total ?? 0}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(conn.prediction_coverage.by_source ?? {}).map(([k, v]) => <ApBadge key={k} tone="mute">{k}: {v}</ApBadge>)}
                      </div>
                      <div>Invalidation 누락: {conn.prediction_coverage.missing_invalidation_pct ?? "—"}% · Horizon 누락: {conn.prediction_coverage.missing_horizon_pct ?? "—"}%</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="/console/financials-live" title="재무제표 실측 조회" />
                  <div className="p-4 space-y-3">
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runFinLookup(); }}>
                      <input
                        className="flex-1 min-w-0 bg-ap-bg border border-ap-line text-ap-ink-1 text-[13px] px-3 py-2 rounded-ap-md"
                        placeholder="종목코드 (예: AAPL, 005930)"
                        value={finQuery}
                        onChange={(e) => setFinQuery(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={finLoading || !finQuery.trim()}
                        className="bg-ap-brand text-white text-[13px] font-semibold px-4 py-2 rounded-ap-md disabled:opacity-50 shrink-0"
                      >
                        {finLoading ? "조회 중…" : "조회"}
                      </button>
                    </form>
                    {finErr && <div className="text-[11px] text-ap-down">조회 실패: {finErr}</div>}
                    {finLoading && (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
                      </div>
                    )}
                    {finData && (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(finData)
                          .filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined)
                          .map(([k, v]) => (
                            <ApStatTile key={k} label={k} value={typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)} tone="hud" />
                          ))}
                      </div>
                    )}
                    {finData && Object.entries(finData).filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined).length === 0 && (
                      <div className="text-[11px] text-ap-ink-3">데이터 없음</div>
                    )}
                  </div>
                </ApPanel>
              </div>
            )}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add app/\(console\)/investment-os/page.tsx
git commit -m "feat: add investment-os mobile research evidence tab"
```

---

### Task 5: Risk & Governance 탭 모바일

**Files:**
- Modify: `app/(console)/investment-os/page.tsx` (Research 탭 블록 바로 다음)

**Interfaces:**
- Consumes: `data, riskGov, prod, agents, council, logs, sep` (파일에 이미 존재), Task 1의 `ApPanel, ApPanelHead, ApBadge, ApDot, ApSkeletonLines`.
- `agents.data.council`의 타입은 `AgentNode`(`@/lib/console-api`) — `{id, name, status, role?, detail?, children？: AgentNode[]}` 형태(이미 `components/console/widgets.tsx`의 `AgentTree`가 이 필드들을 사용 중, 동일 필드로 루트+1단계 자식만 평면 렌더).

- [ ] **Step 1: Research 탭 블록(Task 4) 바로 다음에 추가**

```tsx
            {tab === "risk" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="리스크 & 시나리오" title="예산 · 스트레스" right={data?.risk_budget && <ApBadge tone={data.risk_budget.within_budget ? "pos" : "warn"}>{data.risk_budget.within_budget ? "예산 내" : "한도 초과"}</ApBadge>} />
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-ap-bg rounded-ap-md p-2"><div className="text-[9px] tracking-[0.15em] text-ap-ink-3 uppercase">최대 비중</div><div className="text-[13px] font-data text-ap-ink-1">{((data.exposure.max_weight ?? 0) * 100).toFixed(0)}%</div></div>
                      <div className="bg-ap-bg rounded-ap-md p-2"><div className="text-[9px] tracking-[0.15em] text-ap-ink-3 uppercase">포지션</div><div className="text-[13px] font-data text-ap-ink-1">{data.exposure.n_positions ?? 0}</div></div>
                      <div className="bg-ap-bg rounded-ap-md p-2"><div className="text-[9px] tracking-[0.15em] text-ap-ink-3 uppercase">HHI</div><div className="text-[13px] font-data text-ap-ink-1">{(data.exposure.herfindahl ?? 0).toFixed(2)}</div></div>
                    </div>
                    <div className="bg-ap-bg rounded-ap-md p-2.5">
                      <div className="text-[9px] tracking-[0.2em] text-ap-caution uppercase mb-0.5">최악 시나리오</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-ap-ink-1">{data.scenarios.scenario ?? "—"}</span>
                        <span className="text-[11px] font-data text-ap-down">{((data.scenarios.portfolio_impact_pct ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-[9px] font-data text-ap-ink-3">예상 PnL {(data.scenarios.estimated_pnl ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="text-[9px] text-ap-ink-3">{data.risk_budget.summary}</div>
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="risk" title="리스크 거버너" right={riskGov.data && <ApBadge tone="mute">{riskGov.data.governor}</ApBadge>} />
                  {riskGov.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {riskGov.data && (
                    <div className="p-4 space-y-1.5 text-[11px] text-ap-ink-2">
                      <div>실행 리스크 이벤트: <span className="font-data text-ap-ink-1">{riskGov.data.execution_risk_events}</span></div>
                      <div>자율성 레벨 {riskGov.data.autonomy.level} · 라이브 집행 활성화: {riskGov.data.autonomy.live_execution_enabled ? "켜짐" : "꺼짐"}</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(riskGov.data.limits).map(([k, v]) => <ApBadge key={k} tone="mute">{k}: {String(v)}</ApBadge>)}
                      </div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="production-readiness" title="거버넌스" right={prod.data && <ApBadge tone={prod.data.governance_status.passed ? "pos" : "neg"}>{prod.data.governance_status.governance}</ApBadge>} />
                  {prod.loading && <div className="p-4"><ApSkeletonLines rows={4} /></div>}
                  {prod.data && (
                    <div className="p-4 space-y-1.5">
                      {prod.data.governance_status.checks.map((c) => (
                        <div key={c.check} className="flex items-center gap-1.5 text-[11px]">
                          <ApDot tone={c.ok ? "pos" : "neg"} />
                          <span className="text-ap-ink-1">{c.check}</span>
                          <span className="text-ap-ink-3">{c.detail}</span>
                        </div>
                      ))}
                      <div className="text-[11px] text-ap-ink-3 pt-1">프로덕션 헬스: {prod.data.production_health.overall_severity}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="agents + council" title="협의회 / 승인" right={agents.data && <ApBadge tone="neg">라이브 집행: {agents.data.live_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {agents.loading && <ApSkeletonLines rows={3} />}
                    {agents.data && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <ApDot tone="hud" />
                          <span className="text-[13px] font-medium text-ap-ink-1">{agents.data.council.name}</span>
                          <ApBadge tone="mute">{agents.data.council.status}</ApBadge>
                        </div>
                        {(agents.data.council.children ?? []).map((ch) => (
                          <div key={ch.id} className="ml-3.5 pl-3 border-l border-ap-line flex items-center gap-2 py-0.5">
                            <ApDot tone="hud" />
                            <span className="text-[11px] text-ap-ink-1">{ch.name}</span>
                            <ApBadge tone="mute">{ch.status}</ApBadge>
                          </div>
                        ))}
                      </div>
                    )}
                    {council.data && (
                      <div className="pt-2 border-t border-ap-line space-y-1">
                        <div className="text-[9px] tracking-[0.2em] text-ap-ink-3 uppercase">최근 결정</div>
                        {council.data.decisions.slice(0, 5).map((d, i) => (
                          <div key={i} className="text-[11px] font-data text-ap-ink-3 truncate">{JSON.stringify(d)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="logs" title="감사 로그" right={logs.data && <ApBadge tone="mute">{logs.data.count}건</ApBadge>} />
                  <div className="p-4 space-y-1">
                    {logs.loading && <ApSkeletonLines rows={5} />}
                    {logs.data && logs.data.logs.slice(0, 10).map((l, i) => (
                      <div key={i} className="text-[11px] font-data text-ap-ink-3 truncate border-b border-ap-line last:border-0 py-1">{JSON.stringify(l)}</div>
                    ))}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="아키텍처 분리" title="Research OS ⟂ Investment OS ⟂ Execution" right={sep && <ApBadge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {(sep?.invariants ?? []).map((i) => (
                      <div key={i.check} className="flex items-center gap-2">
                        <ApDot tone={i.ok ? "pos" : "neg"} />
                        <span className="text-[11px] text-ap-ink-1">{i.check}</span>
                      </div>
                    ))}
                  </div>
                </ApPanel>
              </div>
            )}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add app/\(console\)/investment-os/page.tsx
git commit -m "feat: add investment-os mobile risk and governance tab"
```

---

### Task 6: Operations 탭 모바일 + disclaimer

**Files:**
- Modify: `app/(console)/investment-os/page.tsx` (Risk 탭 블록 바로 다음, 모바일 `{data && (<>...</>)}` fragment의 마지막 자식으로 disclaimer 추가)

**Interfaces:**
- Consumes: `ladder, RUNGS, RUNG_LABEL, currentRung, nextRung, nextIsAuto, advResult, data, reviewed, setReviewed, busy, approveAndAdvance, resetLadder, history, monitor, orders, live, DATA_HEALTH_LABEL, data.disclaimer` (파일에 이미 존재), Task 1의 `ApPanel, ApPanelHead, ApBadge, ApDot, ApSkeletonLines`.

- [ ] **Step 1: Risk 탭 블록(Task 5) 바로 다음에 Ops 탭 + disclaimer 추가**

```tsx
            {tab === "ops" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="실행 레이어 · 승인 워크플로" title="준비도 사다리" right={<ApBadge tone="neg">자동 실행: {ladder?.auto_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    <div className="text-[11px] text-ap-ink-2 leading-relaxed bg-ap-bg rounded-ap-md px-3 py-2">
                      전략 개별이 아니라 <b>포트폴리오 전체</b>가 다음 준비도 단계로 넘어가도 되는지 보여주는 자문용 시뮬레이션입니다.
                      승인해도 새로고침하면 PAPER로 리셋되고, 실제로 바뀌는 건 없습니다(AUTO_EXECUTION은 영구 비활성).
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {RUNGS.map((r) => {
                        const isAuto = r === "AUTO_EXECUTION";
                        const isCurrent = r === currentRung;
                        const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                        return (
                          <span key={r} className={`text-[11px] px-2 py-1 rounded-ap-sm border ${
                            isAuto ? "border-ap-down text-ap-down line-through"
                            : isCurrent ? "border-ap-brand text-ap-brand font-semibold bg-ap-brand/10"
                            : isPast ? "border-ap-up text-ap-up"
                            : "border-ap-line text-ap-ink-3"}`}>
                            {isAuto && "🔒 "}{isCurrent && "▶ "}{RUNG_LABEL[r] ?? r}
                          </span>
                        );
                      })}
                    </div>

                    <div className="bg-ap-bg rounded-ap-md p-3">
                      <div className="text-[9px] tracking-[0.2em] text-ap-brand uppercase mb-1.5">필수 게이트 (우회 불가)</div>
                      <div className="grid grid-cols-2 gap-2">
                        {(advResult?.gates ?? []).length > 0
                          ? advResult!.gates.map((g) => (
                            <div key={g.gate} className="flex items-center gap-1.5">
                              <ApDot tone={g.ok ? "pos" : "neg"} />
                              <span className="text-[11px] text-ap-ink-1">{g.gate}</span>
                            </div>))
                          : ["risk", "compliance", "portfolio", "kill_switch"].map((g) => (
                            <div key={g} className="flex items-center gap-1.5">
                              <ApDot tone={data.gates.passed ? "pos" : "warn"} />
                              <span className="text-[11px] text-ap-ink-1">{g}</span>
                            </div>))}
                      </div>
                    </div>

                    <div className="bg-ap-bg rounded-ap-md p-3 space-y-2.5">
                      {nextIsAuto ? (
                        <div className="text-[11px] text-ap-down flex items-center gap-2">
                          🔒 <span>다음 단계는 <b>AUTO_EXECUTION</b> — 영구 비활성. 승인·게이트와 무관하게 전진 불가.</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-[11px] text-ap-ink-2">
                            현재 <span className="text-ap-brand font-semibold">{RUNG_LABEL[currentRung]}</span> → 다음 <span className="text-ap-ink-1 font-semibold">{RUNG_LABEL[nextRung]}</span>. 승인은 실행이 아니라 준비도 상태 전이(자문).
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="accent-ap-brand w-4 h-4" />
                            <span className="text-[11px] text-ap-ink-2">Risk·Compliance·Portfolio 게이트와 시나리오를 검토했으며, 이 전진을 승인합니다.</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={approveAndAdvance} disabled={!reviewed || busy}
                              className={`px-4 h-10 rounded-ap-md text-[11px] font-semibold uppercase border ${
                                reviewed && !busy ? "text-ap-up border-ap-up bg-ap-up/10" : "text-ap-ink-3 border-ap-line opacity-50"}`}>
                              {busy ? "검증 중…" : `승인 & 전진 → ${RUNG_LABEL[nextRung]}`}
                            </button>
                            <button onClick={resetLadder} className="px-3 h-10 rounded-ap-md text-[11px] uppercase text-ap-ink-3 border border-ap-line">페이퍼로 리셋</button>
                          </div>
                        </>
                      )}
                      {advResult && (
                        <div className={`text-[11px] ${advResult.advanced ? "text-ap-up" : "text-ap-caution"}`}>
                          {advResult.advanced ? `✓ 승인됨 — ${RUNG_LABEL[advResult.new_rung]} 로 전진(게이트 통과 + 사람 승인).`
                            : `✗ 차단됨 — ${advResult.blocked_reason}`}
                        </div>
                      )}
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] tracking-[0.2em] text-ap-ink-3 uppercase">승인 로그 (이번 세션)</div>
                        {history.map((h, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 text-[11px] font-data text-ap-ink-3">
                            <span>{h.ts}</span>
                            <ApBadge tone={h.advanced ? "pos" : "neg"}>{h.advanced ? "전진함" : "차단됨"}</ApBadge>
                            <span>{RUNG_LABEL[h.from]} → {RUNG_LABEL[h.to]}</span>
                            {!h.advanced && <span className="text-ap-caution truncate">{h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-ap-ink-3">
                      각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-ap-down">AUTO_EXECUTION 은 영구 비활성.</span> Kill switch 시 전부 페이퍼 강제.
                    </div>
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="monitor" title="파이프라인 모니터" />
                  {monitor.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                  {monitor.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        {monitor.data.stages.map((s) => (
                          <div key={s.key} className="bg-ap-bg rounded-ap-md p-2">
                            <div className="text-[9px] tracking-[0.15em] text-ap-ink-3 uppercase">{s.label}</div>
                            <div className="text-[13px] font-data text-ap-ink-1">{s.count}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-ap-ink-3">제안 {monitor.data.proposals} · 승인 {monitor.data.approvals} · 익스포저 {monitor.data.capital.exposure_pct}%</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="orders" title="주문" />
                  {orders.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {orders.data && (
                    <div className="p-4 space-y-1 text-[11px] text-ap-ink-2">
                      <div>라이프사이클 이벤트: <span className="font-data text-ap-ink-1">{orders.data.lifecycle_events}</span></div>
                      <div>요청 {orders.data.requests.length} · 응답 {orders.data.responses.length}</div>
                      <div className="text-ap-ink-3">{orders.data.note}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="live-intelligence" title="라이브 데이터 소스" right={live.data && <ApBadge tone={live.data.data_health.overall_status === "ok" ? "pos" : "warn"}>{DATA_HEALTH_LABEL[live.data.data_health.overall_status] ?? live.data.data_health.overall_status}</ApBadge>} />
                  {live.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                  {live.data && (
                    <div className="p-4 space-y-1 text-[11px] text-ap-ink-2">
                      <div>소스 {live.data.data_sources.available_count}/{live.data.data_sources.count}개 사용 가능</div>
                      <div>이슈: {live.data.data_health.issue_count}</div>
                    </div>
                  )}
                </ApPanel>
              </div>
            )}

            <div className="text-[11px] text-ap-ink-3 leading-relaxed">{data.disclaimer}</div>
```

(위 `disclaimer` 줄은 Task 2 Step 2에서 만든 `{data && (<>...</>)}` fragment의 마지막 자식 — 모든 탭 조건문의 형제, 탭과 무관하게 항상 렌더된다.)

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 3: 전체 테스트**

Run: `npm test`
Expected: 기존 스위트 그대로 통과 (로직 무변경, 신규 vitest 없음).

- [ ] **Step 4: Commit**

```bash
git add app/\(console\)/investment-os/page.tsx
git commit -m "feat: add investment-os mobile operations tab and disclaimer"
```
