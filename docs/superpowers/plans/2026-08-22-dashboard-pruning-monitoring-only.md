# 대시보드 가지치기(감시 전용 피벗) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 68라우트 → 20라우트로 축소. `/hud`를 진짜 탭쉘로 구축(lab/lab-execution/lab-tasks/overview/auto-research 흡수), `/investment-os`(이미 5탭 통합 완료)로 council/exec/portfolio-os 8라우트 리다이렉트, calendar/insider/macro/news는 `/agents` 컨텍스트 탭으로 흡수, 나머지 17개 순수 CUT.

**Architecture:** 기존 `lib/researchOsRedirects.ts`의 `OLD_TO_NEW` 맵 + `?tab=` 패턴(research-os 선례)을 그대로 확장 재사용. 병합 타겟(`/hud`)에 탭 라우팅이 없으면 `research-os/validation` 셸 패턴(useSearchParams 기반 TabKey)을 복제해 새로 만든다. 병합되는 옛 페이지는 디렉토리를 지우지 않고 `page.tsx` 내용만 5줄 `redirect()` 스텁으로 교체(기존 committee/explain 등 선례와 동일). 순수 CUT 라우트는 디렉토리 통째로 삭제.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-22-dashboard-pruning-monitoring-only-design.md`

## Global Constraints

- 디자인 토큰만 사용: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`. `style={{}}` 금지(차트 컨테이너 height 예외).
- Raw `fetch` 금지 — `lib/api.ts`/`lib/console-api.ts` 함수만 사용.
- AbortController 패턴: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup (기존 포팅 대상 코드는 이미 이 패턴을 따르므로 그대로 이식하면 자동 준수).
- 각 task 끝에 `npx tsc --noEmit` 통과 필수.
- 감시 전용 원칙: 수동 "지금 실행" 트리거 버튼은 이식하지 않는다(설정/토글 버튼은 유지).

---

## Task 1: 리다이렉트 맵 확장 + 테스트 갱신

**Files:**
- Modify: `lib/researchOsRedirects.ts`
- Modify: `__tests__/researchOsRedirects.test.ts`

**Interfaces:**
- Produces: `OLD_TO_NEW: Record<string,string>` 32개 키(기존 15 + 신규 17) — Task 3~12가 이 맵의 키를 참조.

- [ ] **Step 1: `lib/researchOsRedirects.ts` 끝에 신규 키 추가**

기존 파일 마지막 `};` 바로 앞에 추가(기존 15개 키는 그대로 둠):

```typescript
  // ── HUD 탭쉘 흡수(2026-08-22 가지치기) ──
  "/lab": "/hud?tab=lab",
  "/lab/execution": "/hud?tab=execution",
  "/lab/tasks": "/hud?tab=tasks",
  "/overview": "/hud?tab=portfolio",
  "/auto-research": "/hud?tab=lab",
  // ── Investment OS 흡수(이미 5탭 통합 완료, 리다이렉트만) ──
  "/council/agents": "/investment-os?tab=risk",
  "/council/decisions": "/investment-os?tab=risk",
  "/council/logs": "/investment-os?tab=risk",
  "/exec/monitor": "/investment-os?tab=ops",
  "/exec/orders": "/investment-os?tab=ops",
  "/portfolio-os/allocation": "/investment-os?tab=overview",
  "/portfolio-os/positions": "/investment-os?tab=overview",
  "/portfolio-os/risk": "/investment-os?tab=risk",
  // ── 컨텍스트 드릴다운(/agents 흡수). agents 탭은 URL 동기화 안 하므로 쿼리 없이 이동 ──
  "/calendar": "/agents",
  "/insider": "/agents",
  "/macro": "/agents",
  "/news": "/agents",
```

- [ ] **Step 2: `__tests__/researchOsRedirects.test.ts` 전체 교체**

```typescript
import { describe, it, expect } from "vitest";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

describe("OLD_TO_NEW redirect map", () => {
  it("has exactly 32 entries", () => {
    expect(Object.keys(OLD_TO_NEW)).toHaveLength(32);
  });

  it("maps every old route to a shell route with a matching ?tab= (or /agents)", () => {
    const expected: Record<string, string> = {
      "/research-os/workflow": "/research-os/pipeline?tab=workflow",
      "/research-os/discovery": "/research-os/pipeline?tab=discovery",
      "/research-os/strategy-generation": "/research-os/pipeline?tab=strategy-generation",
      "/research-os/strategy-lab": "/research-os/pipeline?tab=strategy-lab",
      "/research-os/agents": "/research-os/pipeline?tab=agents",
      "/research-os/brain": "/research-os/pipeline?tab=brain",
      "/research-os/cockpit": "/research-os/pipeline?tab=cockpit",
      "/research-os/console": "/research-os/pipeline?tab=console",
      "/research-os/validation": "/research-os/validation?tab=validation",
      "/research-os/production": "/research-os/validation?tab=production",
      "/research-os/intelligence-plus": "/research-os/validation?tab=intelligence-plus",
      "/research-os/committee": "/research-os/governance?tab=committee",
      "/research-os/explain": "/research-os/governance?tab=explain",
      "/research-os/graph": "/research-os/governance?tab=graph",
      "/research-os/timeline": "/research-os/governance?tab=timeline",
      "/lab": "/hud?tab=lab",
      "/lab/execution": "/hud?tab=execution",
      "/lab/tasks": "/hud?tab=tasks",
      "/overview": "/hud?tab=portfolio",
      "/auto-research": "/hud?tab=lab",
      "/council/agents": "/investment-os?tab=risk",
      "/council/decisions": "/investment-os?tab=risk",
      "/council/logs": "/investment-os?tab=risk",
      "/exec/monitor": "/investment-os?tab=ops",
      "/exec/orders": "/investment-os?tab=ops",
      "/portfolio-os/allocation": "/investment-os?tab=overview",
      "/portfolio-os/positions": "/investment-os?tab=overview",
      "/portfolio-os/risk": "/investment-os?tab=risk",
      "/calendar": "/agents",
      "/insider": "/agents",
      "/macro": "/agents",
      "/news": "/agents",
    };
    expect(OLD_TO_NEW).toEqual(expected);
  });

  it("every target route starts with a known shell path", () => {
    const shells = [
      "/research-os/pipeline?tab=", "/research-os/validation?tab=", "/research-os/governance?tab=",
      "/hud?tab=", "/investment-os?tab=", "/agents",
    ];
    for (const target of Object.values(OLD_TO_NEW)) {
      expect(shells.some((s) => target.startsWith(s))).toBe(true);
    }
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `npm test -- researchOsRedirects`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/researchOsRedirects.ts __tests__/researchOsRedirects.test.ts
git commit -m "feat: 가지치기 리다이렉트 맵 확장(hud/investment-os/agents 32키)"
```

---

## Task 2: `/hud`를 탭쉘로 전환(기존 콘텐츠 = home 탭)

**Files:**
- Modify: `app/hud/page.tsx` (516줄 전체를 아래 구조로 재배치)
- Test: 수동 브라우저 확인(`npm run dev` → `/hud`가 기존과 동일하게 렌더)

**Interfaces:**
- Produces: `TabKey = "home" | "portfolio" | "lab" | "execution" | "tasks"`, `HudShell`(default export, 기존 default export 이름 대체), `HomeTab()`(기존 `HudPage` 함수 바디를 통째로 옮긴 컴포넌트). Task 3~6이 각각 `PortfolioTab`/`LabTab`/`ExecutionTab`/`TasksTab`을 만들어 이 파일에서 import해 탭으로 끼워 넣는다.

- [ ] **Step 1: 기존 `export default function HudPage() { ... }` 를 `function HomeTab() { ... }` 로 이름만 변경(바디 무수정)**

`app/hud/page.tsx`에서 현재 default export 함수 시그니처를 찾아(516줄 파일의 본체 컴포넌트) `export default function` → `function`, 함수명을 `HomeTab`으로 바꾼다. 나머지 바디(상태/훅/JSX) 전부 그대로 둔다.

- [ ] **Step 2: 파일 맨 위 import 블록 바로 아래에 탭 인프라 추가**

기존 `"use client";` + import 블록 다음, `HomeTab` 함수 정의 이전에 삽입:

```typescript
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortfolioTab from "@/components/hud/PortfolioTab";
import LabTab from "@/components/hud/LabTab";
import ExecutionTab from "@/components/hud/ExecutionTab";
import TasksTab from "@/components/hud/TasksTab";

type TabKey = "home" | "portfolio" | "lab" | "execution" | "tasks";
const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "HOME" },
  { key: "portfolio", label: "AI 자본" },
  { key: "lab", label: "AI LAB" },
  { key: "execution", label: "집행 콘솔" },
  { key: "tasks", label: "페이퍼 모니터" },
];

function HudInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "home";
  const setTab = (k: TabKey) => router.push(k === "home" ? "/hud" : `/hud?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-border px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-accent text-accent bg-accent/10"
                : "border-transparent text-text-2 hover:text-text-1"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "home" && <HomeTab />}
      {tab === "portfolio" && <PortfolioTab />}
      {tab === "lab" && <LabTab />}
      {tab === "execution" && <ExecutionTab />}
      {tab === "tasks" && <TasksTab />}
    </div>
  );
}

export default function HudShell() {
  return (
    <Suspense fallback={null}>
      <HudInner />
    </Suspense>
  );
}
```

이 시점에는 `components/hud/{PortfolioTab,LabTab,ExecutionTab,TasksTab}.tsx`가 아직 없으므로 tsc는 실패한다 — Task 3~6에서 만든 뒤 통과. 이 task는 스캐폴딩만.

- [ ] **Step 3: Commit**

```bash
git add app/hud/page.tsx
git commit -m "refactor: /hud를 탭쉘로 전환(home 탭 = 기존 콘텐츠), 나머지 탭은 후속 task"
```

(tsc 에러 있는 채로 커밋 — Task 3~6에서 즉시 해소되는 중간 상태. subagent-driven 실행 시 Task 3까지 묶어서 리뷰해도 됨.)

---

## Task 3: `/overview` → `PortfolioTab` 포팅

**Files:**
- Create: `components/hud/PortfolioTab.tsx`
- Modify: `app/overview/page.tsx` (312줄 → 5줄 리다이렉트 스텁)

**Interfaces:**
- Consumes: `OLD_TO_NEW` from Task 1.
- Produces: `export default function PortfolioTab()` — Task 2가 이미 import 중.

- [ ] **Step 1: `app/overview/page.tsx` 전체 내용을 `components/hud/PortfolioTab.tsx`로 복사**

복사 후 두 곳만 수정:
1. `export default function OverviewPage()` (또는 현재 함수명) → `export default function PortfolioTab()`
2. import 경로는 그대로(둘 다 `app/` 최상위 기준 `@/lib/api`, `@/components/...`라 상대경로 영향 없음 — `components/hud/`로 옮겨도 `@/` alias라 변경 불필요)

나머지 바디(interfaces, WIDTHS, useEffect, JSX) 전부 그대로.

- [ ] **Step 2: `app/overview/page.tsx` 내용 전체를 리다이렉트 스텁으로 교체**

```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function OverviewRedirect() {
  redirect(OLD_TO_NEW["/overview"]);
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: `components/hud/PortfolioTab.tsx` 관련 에러 없음(다른 미완 탭 관련 에러는 Task 4~6에서 해소)

- [ ] **Step 4: Commit**

```bash
git add components/hud/PortfolioTab.tsx app/overview/page.tsx
git commit -m "refactor: /overview → hud PortfolioTab 포팅, 구 라우트는 리다이렉트"
```

---

## Task 4: `/lab` → `LabTab` 포팅(수동 실행 버튼 제거)

**Files:**
- Create: `components/hud/LabTab.tsx`
- Modify: `app/lab/page.tsx` (544줄 → 5줄 리다이렉트 스텁)

**Interfaces:**
- Produces: `export default function LabTab()` — Task 2가 이미 import 중.

- [ ] **Step 1: `app/lab/page.tsx` 전체를 `components/hud/LabTab.tsx`로 복사, 함수명 `LabPage` → `LabTab`**

- [ ] **Step 2: 수동 실행 버튼 제거 — 감시 전용 원칙**

`runLab` import 제거(`getLabState, runLab, setLabAutopilot, ...` → `getLabState, setLabAutopilot, ...`).
`onRunNext` 함수 정의 삭제.
헤더의 버튼 블록:
```tsx
<div className="flex items-center gap-2">
  <Button variant="primary" size="md" onClick={onRunNext} disabled={busy}>
    ▶ 다음 가설 검토
  </Button>
  <button onClick={onToggleAuto}
    className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors cursor-pointer ${
      st?.autopilot ? "border-pos/50 text-pos bg-pos/10" : "border-border text-text-2 hover:text-text-1 bg-transparent"}`}>
    {st?.autopilot ? "⏸ 오토파일럿 ON" : " 오토파일럿"}
  </button>
</div>
```
→ "▶ 다음 가설 검토" `<Button>` 블록만 삭제, 오토파일럿 토글 버튼(`onToggleAuto`, 설정 스위치이지 실행 트리거 아님)은 유지:
```tsx
<div className="flex items-center gap-2">
  <button onClick={onToggleAuto}
    className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors cursor-pointer ${
      st?.autopilot ? "border-pos/50 text-pos bg-pos/10" : "border-border text-text-2 hover:text-text-1 bg-transparent"}`}>
    {st?.autopilot ? "⏸ 오토파일럿 ON" : " 오토파일럿"}
  </button>
</div>
```
`Button` import(`@/components/ui`에서 온 것)가 이 파일에서 더 안 쓰이면 import에서 제거(다른 곳에서 `Button` 안 쓰면 `import { Button, LoadingState } from "@/components/ui";` → `import { LoadingState } from "@/components/ui";`; 파일 전체 grep해서 확인).

- [ ] **Step 3: `app/lab/page.tsx` 내용 전체를 리다이렉트 스텁으로 교체**

```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function LabRedirect() {
  redirect(OLD_TO_NEW["/lab"]);
}
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 관련 에러 없음(`onRunNext`/`runLab` 참조 잔존 여부 확인)

- [ ] **Step 5: Commit**

```bash
git add components/hud/LabTab.tsx app/lab/page.tsx
git commit -m "refactor: /lab → hud LabTab 포팅, 수동 실행버튼 제거(감시전용 원칙)"
```

---

## Task 5: `/lab/execution` → `ExecutionTab` 포팅

**Files:**
- Create: `components/hud/ExecutionTab.tsx`
- Modify: `app/lab/execution/page.tsx` (219줄 → 5줄 리다이렉트 스텁)

**Interfaces:**
- Produces: `export default function ExecutionTab()` — Task 2가 이미 import 중.

- [ ] **Step 1: `app/lab/execution/page.tsx` 전체를 `components/hud/ExecutionTab.tsx`로 복사, 함수명을 `ExecutionTab`으로 변경**

버튼/수동 트리거 없음(Task 계획 조사 시 확인 완료) — 바디 그대로 이식.

- [ ] **Step 2: `app/lab/execution/page.tsx` 리다이렉트 스텁으로 교체**

```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function LabExecutionRedirect() {
  redirect(OLD_TO_NEW["/lab/execution"]);
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 관련 에러 없음

- [ ] **Step 4: Commit**

```bash
git add components/hud/ExecutionTab.tsx app/lab/execution/page.tsx
git commit -m "refactor: /lab/execution → hud ExecutionTab 포팅"
```

---

## Task 6: `/lab/tasks` → `TasksTab` 포팅

**Files:**
- Create: `components/hud/TasksTab.tsx`
- Modify: `app/lab/tasks/page.tsx` (414줄 → 5줄 리다이렉트 스텁)

**Interfaces:**
- Produces: `export default function TasksTab()` — Task 2가 이미 import 중.

- [ ] **Step 1: `app/lab/tasks/page.tsx` 전체를 `components/hud/TasksTab.tsx`로 복사, 함수명을 `TasksTab`으로 변경**

버튼/수동 트리거 없음 — 바디 그대로 이식.

- [ ] **Step 2: `app/lab/tasks/page.tsx` 리다이렉트 스텁으로 교체**

```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function LabTasksRedirect() {
  redirect(OLD_TO_NEW["/lab/tasks"]);
}
```

- [ ] **Step 3: 타입체크 — 이 시점에 Task 2의 스캐폴딩 에러까지 전부 해소되어야 함**

Run: `npx tsc --noEmit`
Expected: PASS, 에러 0

- [ ] **Step 4: Commit**

```bash
git add components/hud/TasksTab.tsx app/lab/tasks/page.tsx
git commit -m "refactor: /lab/tasks → hud TasksTab 포팅, hud 탭쉘 완성"
```

---

## Task 7: `/auto-research` 리다이렉트 스텁화

**Files:**
- Modify: `app/auto-research/page.tsx` (8줄 → 5줄, 이미 `AutoResearchPanel`만 렌더하던 legacy alias)

**Interfaces:**
- Consumes: `OLD_TO_NEW["/auto-research"]`(Task 1).

`LabTab`(Task 4 포팅본)이 이미 `<AutoResearchPanel embedded />`를 그대로 포함하고 있으므로 콘텐츠 유실 없음.

- [ ] **Step 1: 파일 전체 교체**

```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function AutoResearchRedirect() {
  redirect(OLD_TO_NEW["/auto-research"]);
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/auto-research/page.tsx
git commit -m "refactor: /auto-research 리다이렉트 스텁화(콘텐츠는 이미 hud LabTab에 포함)"
```

---

## Task 8: CommandRail 네비 정리 — hud 흡수 반영 + CUT 라우트 제거

**Files:**
- Modify: `components/console/CommandRail.tsx:19-73` (`CONSOLE_GROUPS`/`TERMINAL_GROUPS` 정의부)

**Interfaces:**
- Consumes: 없음(정적 배열 리터럴 수정).
- Produces: `TERMINAL_GROUPS` 최종 3개 그룹 — 이후 어떤 task도 이 배열을 다시 읽지 않음(터미널 task).

`CONSOLE_GROUPS`는 이미 최종 형태(Research OS 4개 + Investment OS 1개) — 무수정.
`TERMINAL_GROUPS`는 아래로 전체 교체(마켓/검증·백테스트 그룹 축소·삭제, 리서치 랩 그룹 삭제 후 `/infra`는 트레이딩 데스크로 이동, hud 흡수 라우트 전부 제거, CUT 대상인 macro/insider/buyback-doctor/edges 제거):

- [ ] **Step 1: `components/console/CommandRail.tsx`의 `TERMINAL_GROUPS` 전체를 아래로 교체**

기존 (line 32-70, "// 레거시 트레이딩 터미널 그룹" 주석부터 `];`까지) 를:

```typescript
// 레거시 트레이딩 터미널 그룹 — 감시 전용 피벗(2026-08) 이후 20라우트로 축소
const TERMINAL_GROUPS: RailGroup[] = [
  { label: "마켓", items: [
    { href: "/orderflow", label: "오더플로우" },
  ] },
  { label: "트레이딩 데스크", items: [
    { href: "/portfolio", label: "포트폴리오" },
    { href: "/infra", label: "공급망 그래프" },
  ] },
  { label: "봇 · 에이전트", items: [
    { href: "/agents", label: "에이전트" },
    { href: "/performance", label: "성과" },
    { href: "/risk-guard", label: "리스크 가드" },
    { href: "/dart-auto", label: "DART 오토파일럿" },
    { href: "/copytrade", label: "카피트레이딩" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
];
```

로 교체한다.

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS(빌드 단계에서 CUT 예정 라우트로의 dangling `<Link>`가 있으면 Next는 에러 내지 않지만, 이 시점엔 아직 CUT 라우트 디렉토리를 지우지 않았으므로 100% 안전 — Task 10~11에서 실제 삭제 전 inbound 링크를 마저 정리)

- [ ] **Step 3: `commandRailGroups` 테스트 확인**

Run: `npm test -- commandRailGroups`
Expected: PASS 그대로 — `tests/lib/commandRailGroups.test.ts`는 `filterGroupsForOperator`를 자체 mock `GROUPS` fixture로 검증(실제 `CONSOLE_GROUPS`/`TERMINAL_GROUPS`를 import하지 않음), 이 task의 배열 변경과 무관해 수정 불필요. 이 스텝은 그 사실을 실행 시점에 재확인만 한다(스펙이 "업데이트 필수"라 명시했으나 코드 확인 결과 대상 테스트가 실제 배열에 의존하지 않아 변경 불필요 — fail하면 이 판단이 틀린 것이므로 즉시 원인 조사).

- [ ] **Step 4: Commit**

```bash
git add components/console/CommandRail.tsx
git commit -m "refactor: CommandRail 네비 20라우트로 축소(hud 흡수분/CUT 대상 제거)"
```

---

## Task 9: Investment OS 흡수 — 8개 구 라우트 리다이렉트 스텁화

**Files:**
- Modify: `app/(console)/council/agents/page.tsx`
- Modify: `app/(console)/council/decisions/page.tsx`
- Modify: `app/(console)/council/logs/page.tsx`
- Modify: `app/(console)/exec/monitor/page.tsx`
- Modify: `app/(console)/exec/orders/page.tsx`
- Modify: `app/(console)/portfolio-os/allocation/page.tsx`
- Modify: `app/(console)/portfolio-os/positions/page.tsx`
- Modify: `app/(console)/portfolio-os/risk/page.tsx`

**Interfaces:**
- Consumes: `OLD_TO_NEW`(Task 1) 8개 키.

`/investment-os`(`app/(console)/investment-os/page.tsx`)는 이미 이 8개 라우트가 쓰던 `getAgents`/`getConsoleCouncil`/`getLogs`/`getMonitor`/`getOrders`/`getAllocation`/`getPositions`/`getRisk`를 각각 `risk`/`risk`/`risk`/`ops`/`ops`/`overview`/`overview`/`risk` 탭에서 이미 렌더 중(STEP4-D 통합 완료, 코드 확인함) — 신규 UI 작업 없이 스텁 교체만.

- [ ] **Step 1: 8개 파일을 각각 아래 패턴으로 전체 교체(경로별 `OLD_TO_NEW` 키만 다름)**

`app/(console)/council/agents/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function CouncilAgentsRedirect() {
  redirect(OLD_TO_NEW["/council/agents"]);
}
```

`app/(console)/council/decisions/page.tsx`: 동일 패턴, 함수명 `CouncilDecisionsRedirect`, 키 `"/council/decisions"`.
`app/(console)/council/logs/page.tsx`: 함수명 `CouncilLogsRedirect`, 키 `"/council/logs"`.
`app/(console)/exec/monitor/page.tsx`: 함수명 `ExecMonitorRedirect`, 키 `"/exec/monitor"`.
`app/(console)/exec/orders/page.tsx`: 함수명 `ExecOrdersRedirect`, 키 `"/exec/orders"`.
`app/(console)/portfolio-os/allocation/page.tsx`: 함수명 `PortfolioOsAllocationRedirect`, 키 `"/portfolio-os/allocation"`.
`app/(console)/portfolio-os/positions/page.tsx`: 함수명 `PortfolioOsPositionsRedirect`, 키 `"/portfolio-os/positions"`.
`app/(console)/portfolio-os/risk/page.tsx`: 함수명 `PortfolioOsRiskRedirect`, 키 `"/portfolio-os/risk"`.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS(각 파일이 쓰던 `getConsoleCouncil`/`getLogs`/`getMonitor`/`getOrders`/`getAllocation`/`getPositions`/`getRisk`/`getAgents` import 제거로 인한 미사용 에러 없어야 함 — 파일 전체 교체이므로 자동 해소)

- [ ] **Step 3: Commit**

```bash
git add "app/(console)/council" "app/(console)/exec" "app/(console)/portfolio-os"
git commit -m "refactor: council/exec/portfolio-os 8라우트 → investment-os 리다이렉트(콘텐츠 이미 통합됨)"
```

---

## Task 10: `/agents`에 컨텍스트 탭 추가(calendar/insider/macro/news 흡수)

**Files:**
- Create: `components/agents/ContextTab.tsx`
- Modify: `app/agents/page.tsx:455` (tab 타입), `:847-850`(탭 버튼), `:859`/`:912` 부근(탭 콘텐츠 분기)

**Interfaces:**
- Produces: `export default function ContextTab()` — Task 10 Step 3에서 `app/agents/page.tsx`가 import.
- Consumes: `getEconomicCalendar`, `getMarketNews`, `getInsiderKRRecent`, `getFREDSeries`(모두 기존 `@/lib/api`, 시그니처 변경 없음), `NewsPanel`(`@/components/news/NewsPanel`, 기존 컴포넌트 재사용).

의도적 단순화(ponytail): 에이전트별 티커 필터링은 하지 않는다 — 전역 피드(경제캘린더 이번주/일반뉴스/KR 최근 insider/매크로 스냅샷)를 그대로 노출. 티커별 필터가 필요해지면 이 컴포넌트에 `agentId`/`symbol` prop을 추가해 업그레이드.

- [ ] **Step 1: `components/agents/ContextTab.tsx` 신규 작성**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import {
  getEconomicCalendar, getInsiderKRRecent, getFREDSeries,
  type EconomicEvent, type InsiderTrade, type FREDObservation,
} from "@/lib/api";
import { NewsPanel } from "@/components/news/NewsPanel";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui";

export default function ContextTab() {
  const [calendar, setCalendar] = useState<EconomicEvent[] | null>(null);
  const [insider, setInsider] = useState<InsiderTrade[] | null>(null);
  const [fred, setFred] = useState<FREDObservation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    (async () => {
      try {
        const [cal, ins] = await Promise.all([
          getEconomicCalendar("this", ctrl.signal),
          getInsiderKRRecent(7, 20, ctrl.signal),
        ]);
        if (!ctrl.signal.aborted) { setCalendar(cal); setInsider(ins); setErr(null); }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : String(e));
      }
      try {
        const f = await getFREDSeries("DGS10", ctrl.signal);
        if (!ctrl.signal.aborted) setFred(f);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) { /* 매크로는 보조 정보 — 실패해도 나머지는 표시 */ }
      }
    })();
    return () => { abortRef.current?.abort(); };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel>
        <PanelHeader>이번주 경제캘린더</PanelHeader>
        {!calendar && !err && <LoadingState message="로딩 중…" />}
        {err && <div className="text-xs text-neg px-3 py-2">연결 오류: {err}</div>}
        <div className="divide-y divide-border">
          {(calendar ?? []).slice(0, 12).map((e, i) => (
            <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
              <span className="text-text-2">{e.event}</span>
              <span className="text-text-3 font-data">{e.date}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelHeader>KR 최근 내부자거래</PanelHeader>
        <div className="divide-y divide-border">
          {(insider ?? []).slice(0, 12).map((t, i) => (
            <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
              <span className="text-text-2">{t.corp_name ?? t.ticker}</span>
              <span className="text-text-3 font-data">{t.report_date ?? ""}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="lg:col-span-2">
        <PanelHeader>매크로(US 10Y) 최근값</PanelHeader>
        <div className="px-3 py-2 text-xs text-text-2 font-data">
          {fred && fred.length > 0 ? `${fred[fred.length - 1].date}: ${fred[fred.length - 1].value}` : "—"}
        </div>
      </Panel>
      <div className="lg:col-span-2">
        <NewsPanel category="general" />
      </div>
    </div>
  );
}
```

`InsiderTrade`/`EconomicEvent`/`FREDObservation`의 정확한 필드명(`corp_name`/`ticker`/`report_date`/`event`/`date`/`value`)은 `lib/api.ts`의 해당 interface 정의를 열어 실제 필드명과 대조 후 필요시 이 스텝에서 맞춰 고친다(타입 불일치는 다음 스텝의 tsc가 잡아준다).

- [ ] **Step 2: `app/agents/page.tsx:455` 탭 타입 확장**

```typescript
// before
const [tab, setTab] = useState<"dashboard" | "cycles">("dashboard");
// after
const [tab, setTab] = useState<"dashboard" | "cycles" | "context">("dashboard");
```

파일 상단 import 블록에 추가:
```typescript
import ContextTab from "@/components/agents/ContextTab";
```

- [ ] **Step 3: `app/agents/page.tsx:847-850` 탭 버튼 배열에 "context" 추가**

```typescript
// before
{(["dashboard", "cycles"] as const).map(t => (
  <button key={t} onClick={() => setTab(t)} ...>
    {t === "dashboard" ? "대시보드" : "사이클"}
  </button>
))}
// after
{(["dashboard", "cycles", "context"] as const).map(t => (
  <button key={t} onClick={() => setTab(t)} ...>
    {t === "dashboard" ? "대시보드" : t === "cycles" ? "사이클" : "컨텍스트"}
  </button>
))}
```
(`className` 삼항식은 기존 그대로 — `tab === t` 비교라 타입 확장에 자동 대응됨)

- [ ] **Step 4: `app/agents/page.tsx`의 `tab === "cycles"` 블록(약 912번째 줄) 바로 뒤에 추가**

```tsx
{tab === "context" && <ContextTab />}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS(Step 1에서 필드명 안 맞으면 여기서 잡힘 — `lib/api.ts`의 실제 필드명으로 수정)

- [ ] **Step 6: 개발 서버로 수동 확인**

Run: `npm run dev`, 브라우저에서 `/agents` → 임의 에이전트 선택 → "컨텍스트" 탭 클릭 → 4개 패널(캘린더/insider/매크로/뉴스) 렌더 확인.

- [ ] **Step 7: Commit**

```bash
git add components/agents/ContextTab.tsx app/agents/page.tsx
git commit -m "feat: /agents 컨텍스트 탭 추가(calendar/insider/macro/news 드릴다운 흡수)"
```

---

## Task 11: calendar/insider/macro/news 구 라우트 삭제

**Files:**
- Delete: `app/calendar/`, `app/insider/`, `app/macro/`, `app/news/`

**Interfaces:**
- Consumes: Task 10 완료(콘텐츠 이식 확인됨), Task 1의 리다이렉트 맵(`/calendar`·`/insider`·`/macro`·`/news` → `/agents`).

**주의:** `app/(console)`이 아닌 최상위 라우트라 리다이렉트 스텁 패턴(디렉토리 유지) 대신 완전 삭제 — 스펙상 CUT 취급이지만 콘텐츠가 `/agents`로 이전됐으므로 즉시 삭제해도 사용자 관점 정보 유실 없음(리다이렉트 맵에 이미 등록돼 있어 outbound 딥링크는 계속 `/agents`로 감; 단 이 4개는 Next 파일시스템 라우트가 사라지므로 실제로 `/calendar` 접속 시 404 — 리다이렉트가 필요하면 4개 디렉토리에 Task 3처럼 stub을 남기는 편이 안전. 아래 Step 1을 stub 방식으로 수행한다).

- [ ] **Step 1: 4개 디렉토리의 `page.tsx`를 각각 리다이렉트 스텁으로 교체(디렉토리는 유지, 삭제 아님 — 딥링크 보존)**

`app/calendar/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function CalendarRedirect() {
  redirect(OLD_TO_NEW["/calendar"]);
}
```
동일 패턴으로 `app/insider/page.tsx`(함수명 `InsiderRedirect`, 키 `/insider`), `app/macro/page.tsx`(`MacroRedirect`, `/macro`), `app/news/page.tsx`(`NewsRedirect`, `/news`).

- [ ] **Step 2: 이 4개 페이지가 쓰던 하위 전용 컴포넌트 중 다른 곳에서 안 쓰는 것 확인**

Run: `grep -rn "GroqSummaryPanel" app/ components/ | grep -v "app/calendar\|app/news"`
`GroqSummaryPanel`을 calendar/news 말고 다른 곳도 쓰면 그대로 둔다(공용 컴포넌트, 삭제 대상 아님). 이 스텝은 확인만, 코드 변경 없음.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/calendar app/insider app/macro app/news
git commit -m "refactor: calendar/insider/macro/news 리다이렉트 스텁화(콘텐츠는 agents 컨텍스트 탭)"
```

---

## Task 12: 순수 CUT — 백테스트/검증 클러스터 삭제

**Files:**
- Delete: `app/backtest/`(하위 `heatmap/` 포함), `app/ict/`, `app/event-study/`, `app/signal/`, `app/experiments/`, `app/data-quality/`, `app/validation/`

**Interfaces:** 없음(터미널 삭제, 다른 task가 이 파일들을 참조하지 않음 — Task 8에서 CommandRail 항목은 이미 제거됨).

- [ ] **Step 1: 인바운드 링크 확인**

Run: `grep -rln 'href="/backtest\|href="/ict\|href="/event-study\|href="/signal"\|href="/experiments\|href="/data-quality\|href="/validation"' app components lib --include="*.tsx" --include="*.ts"`

결과에 나온 파일이 있으면(CommandRail은 Task 8에서 이미 처리됐으므로 안 나와야 함) 해당 `<Link>`/문자열을 제거하거나 대체 라우트로 바꾼다 — 결과 없으면 스킵.

- [ ] **Step 2: 디렉토리 삭제**

```bash
git rm -r app/backtest app/ict app/event-study app/signal app/experiments app/data-quality app/validation
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: 백테스트/검증 클러스터 7라우트 삭제(수동 리서치 도구, 감시전용 원칙상 불필요)"
```

---

## Task 13: 순수 CUT — 시세뷰어 + 잡다 클러스터 삭제

**Files:**
- Delete: `app/crypto/`, `app/forex/`, `app/futures/`, `app/options/`, `app/market/`, `app/buyback-doctor/`, `app/edges/`, `app/search/`, `app/design-system/`

**Interfaces:** 없음(터미널 삭제).

- [ ] **Step 1: 인바운드 링크 확인**

Run: `grep -rln 'href="/crypto\|href="/forex\|href="/futures\|href="/options\|href="/market"\|href="/buyback-doctor\|href="/edges\|href="/search"\|href="/design-system' app components lib --include="*.tsx" --include="*.ts"`

나온 파일의 `<Link>`를 제거/대체. `app/polymarket/page.tsx`의 `POLY_HYP_LINK`(`/mlb` 링크)는 이 그룹과 무관 — 건드리지 않는다.

- [ ] **Step 2: 디렉토리 삭제**

```bash
git rm -r app/crypto app/forex app/futures app/options app/market app/buyback-doctor app/edges app/search app/design-system
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: 시세뷰어/잡다 클러스터 9라우트 삭제(수동 리서치 도구, 감시전용 원칙상 불필요)"
```

---

## Task 14: 전체 검증 + progress.md 갱신

**Files:**
- Modify: `docs/progress.md`(Phase 항목 추가)

**Interfaces:** 없음(마무리 task).

- [ ] **Step 1: 전체 테스트 + 빌드**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 전부 PASS. 라우트 수 확인: `find app -maxdepth 3 -name page.tsx | wc -l`이 최상위 20개 + `(console)` 그룹 내부 파일 포함해서 이전 대비 약 30개 감소했는지 육안 확인.

- [ ] **Step 2: 개발 서버로 32개 리다이렉트 전수 스모크 확인**

Run: `npm run dev`, 새 터미널에서:
```bash
for p in lab lab/execution lab/tasks overview auto-research calendar insider macro news \
  council/agents council/decisions council/logs exec/monitor exec/orders \
  portfolio-os/allocation portfolio-os/positions portfolio-os/risk \
  research-os/workflow research-os/committee; do
  echo -n "/$p -> "; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/$p"
done
```
Expected: 전부 30x 또는 200(리다이렉트 최종 목적지가 200이면 그것도 정상 — Next `redirect()`는 서버컴포넌트에서 307을 내는데 client fetch로 따라가면 최종 200으로 보일 수 있음). 4xx/5xx 나오면 해당 task로 돌아가 수정.

- [ ] **Step 3: `docs/progress.md`에 Phase 항목 추가**

기존 최상단 Phase 항목(가장 최근 Phase) 바로 위에 삽입 — 실제 내용은 이 plan 실행 완료 시점에 최종 커밋 수/실제 발견 이슈를 반영해 작성(placeholder 아님, 실행자가 채워 넣는 표준 세션 인수인계 항목):

```markdown
## Phase 221 — 대시보드 가지치기: 68→20 라우트, 감시 전용 피벗 (날짜는 실행일로)

### 배경
seokminal v2 웹 오버홀 1단계(가지치기→리디자인→PWA). 대시보드 미래 역할 = 감시 전용(에이전트가 리서치/매매 다 함).

### 완료된 작업
- `/hud`를 진짜 탭쉘로 전환(home/portfolio/lab/execution/tasks 5탭), lab/lab-execution/lab-tasks/overview/auto-research 5라우트 흡수
- `/lab`의 수동 "다음 가설 검토" 실행버튼 제거(감시전용 원칙)
- council/exec/portfolio-os 8라우트 → investment-os 리다이렉트(콘텐츠 이미 STEP4-D로 통합되어 있었음, 신규 UI 불필요)
- calendar/insider/macro/news 4라우트 → `/agents` 컨텍스트 탭으로 흡수(전역 피드, 에이전트별 필터링은 안 함 — 후속 업그레이드 지점)
- backtest(+heatmap)/ict/event-study/signal/experiments/data-quality/validation/crypto/forex/futures/options/market/buyback-doctor/edges/search/design-system 총 16라우트 CUT
- `lib/researchOsRedirects.ts`의 `OLD_TO_NEW` 맵 15→32키로 확장(단일 맵 재사용, 신규 파일 없음)
- CommandRail 네비: TERMINAL_GROUPS 5그룹→3그룹으로 축소

### 변경된 파일
`app/hud/page.tsx`, `components/hud/{PortfolioTab,LabTab,ExecutionTab,TasksTab}.tsx`(신규),
`components/agents/ContextTab.tsx`(신규), `app/agents/page.tsx`, `lib/researchOsRedirects.ts`,
`__tests__/researchOsRedirects.test.ts`, `components/console/CommandRail.tsx`,
+ merge/cut 대상 각 라우트의 `page.tsx`(스텁 교체 또는 삭제)

### 다음 할 일
2단계 리디자인(autopilot 스타일 비주얼), 3단계 PWA화 — 둘 다 별도 스펙/플랜 필요(이 plan 스코프 아님).

### 막힌 부분/결정사항
- ContextTab은 에이전트별 티커 필터링 없이 전역 피드만 노출(YAGNI) — 필요해지면 `agentId`/`symbol` prop 추가.
- `app/(console)/intel/research-os/page.tsx`(nav 미연결 미사용 페이지로 보임) — 이번 스펙 범위 밖이라 손대지 않음, 후속 정리 후보로 기록만.
```

- [ ] **Step 4: Commit**

```bash
git add docs/progress.md
git commit -m "docs: Phase 221 가지치기 완료 기록"
```
