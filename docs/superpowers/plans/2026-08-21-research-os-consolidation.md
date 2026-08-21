# Research OS 4-Shell Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse `research-os`'s 16 independent `page.tsx` routes into 4 nav items (파이프라인/검증·실전준비/거버넌스/어시스턴트) by porting the investment-os tab-shell UX pattern, with zero backend changes and old routes preserved as redirects.

**Architecture:** Three new shell pages (`pipeline`, `validation`, `governance`) each render a `?tab=`-driven tab bar over N sub-tab components. **Deviation from the spec's illustrative pseudocode:** instead of forcing every sub-tab through one shared `useTabFetch(enabled, fetcher)` hook, each sub-tab keeps its **own original fetch/form/interval state exactly as it exists today**, wrapped in its own top-level function component and gated by conditional render (`{tab === "x" && <XTab />}`). This is a resolved architectural decision, not an open question — reasons:

1. Most research-os pages have interactive re-fetch (search forms, refresh buttons, `Promise.all` dual-fetch) that `useTabFetch`'s one-shot `fetchedRef` guard cannot support without rewriting logic — which the spec explicitly forbids ("로직 재작성 없음").
2. `cockpit`/`console` use a *different* existing hook (`useConsole(fetcher, deps, 60000)`, 60s poll) — conditional-render naturally starts/stops this via mount/unmount, preserving current polling behavior with zero hook changes.
3. Conditional mount/unmount already gives "inactive tab issues no request" (the spec's actual invariant) for free — a tab's `useEffect` only runs once it mounts, i.e., once its tab is selected.

Only `validation` (of all 15 candidate tabs) would have cleanly fit the shared hook (plain mount-only fetch, no form) — not enough to justify introducing a second hook pattern for one tab.

**Tech Stack:** Next.js 16 App Router (`next/navigation`: `redirect`, `useRouter`, `useSearchParams`), React 19, Vitest (`npm test` → `vitest run`), existing `lib/console-api.ts` fetchers, existing `components/console/primitives` (`Panel`, `PanelHead`, `StatTile`, `Badge`) and `components/console/widgets` (`PageHeader`, `useConsole`).

**Spec:** `/Users/seokhun/seokminal/seokminal-dashboard/docs/superpowers/specs/2026-08-21-research-os-consolidation-design.md`

**Spec correction (documented, not asked back to user):** spec prose says "13개(chat 제외)" routes get redirected, but its own mapping table lists 15 rows and 16 total pages − 1 (`chat`, unchanged) = 15. The table is authoritative; this plan redirects all 15.

## Global Constraints

- Raw `fetch` forbidden in frontend code — use `lib/console-api.ts` functions only.
- Design tokens only. Research-os/investment-os components use the existing `var(--c-*)` CSS-custom-property system via Tailwind arbitrary values (`text-[var(--c-text-1)]`, `border-[var(--c-border)]`, `bg-[var(--c-hud)]`, etc.) — this is the established convention throughout every file this plan touches; match it exactly, do not introduce new color values.
- `style={{}}` forbidden except chart-container height.
- AbortController convention: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup. Every ported tab already follows this — preserve verbatim.
- No backend changes. No changes to `lib/console-api.ts`, `investment-os/*`, or `chat/*`.
- Branch convention: commit directly to `main`.
- `npx tsc --noEmit` and `npm test` must both pass before any task is considered done.

---

## File Structure

**Create:**
- `app/(console)/research-os/pipeline/page.tsx` — new 8-tab shell (workflow/discovery/strategy-generation/strategy-lab/agents/brain/cockpit/console)
- `app/(console)/research-os/validation/page.tsx` — new 3-tab shell (validation/production/intelligence-plus)
- `app/(console)/research-os/governance/page.tsx` — new 4-tab shell (committee/explain/graph/timeline)
- `lib/researchOsRedirects.ts` — `OLD_TO_NEW` mapping constant, single source of truth for both the stub pages and the test
- `__tests__/researchOsRedirects.test.ts` — Vitest unit test asserting the 15-entry mapping

**Modify (overwrite with a redirect stub, after their bodies are ported into the shells above):**
- `app/(console)/research-os/{workflow,discovery,strategy-generation,strategy-lab,agents,brain,cockpit,console}/page.tsx` (8)
- `app/(console)/research-os/{validation,production,intelligence-plus}/page.tsx` (3)
- `app/(console)/research-os/{committee,explain,graph,timeline}/page.tsx` (4)

**Modify:**
- `components/console/CommandRail.tsx` — replace 4 scattered `Research · *` groups with one `Research OS` group; fix `OPERATOR_GROUP_LABELS` and `GroupGlyph`'s icon map

**Unchanged:** `app/(console)/research-os/chat/page.tsx`, `lib/console-api.ts`, everything under `investment-os/`.

Ordering matters: the three shell tasks (2–4) must run **before** the redirect-stub task (5), since the shells port bodies out of the original 15 files that task 5 then overwrites.

---

### Task 1: `OLD_TO_NEW` redirect map + test

**Files:**
- Create: `lib/researchOsRedirects.ts`
- Test: `__tests__/researchOsRedirects.test.ts`

**Interfaces:**
- Produces: `OLD_TO_NEW: Record<string, string>` — 15 entries, old route → new route with `?tab=`. Consumed by Task 5's stub pages and by this task's own test.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/researchOsRedirects.test.ts
import { describe, it, expect } from "vitest";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

describe("OLD_TO_NEW research-os redirect map", () => {
  it("has exactly 15 entries", () => {
    expect(Object.keys(OLD_TO_NEW)).toHaveLength(15);
  });

  it("maps every old route to a shell route with a matching ?tab=", () => {
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
    };
    expect(OLD_TO_NEW).toEqual(expected);
  });

  it("every target route starts with a known shell path", () => {
    const shells = ["/research-os/pipeline?tab=", "/research-os/validation?tab=", "/research-os/governance?tab="];
    for (const target of Object.values(OLD_TO_NEW)) {
      expect(shells.some((s) => target.startsWith(s))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- researchOsRedirects`
Expected: FAIL — `Cannot find module '@/lib/researchOsRedirects'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/researchOsRedirects.ts
export const OLD_TO_NEW: Record<string, string> = {
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
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- researchOsRedirects`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/researchOsRedirects.ts __tests__/researchOsRedirects.test.ts
git commit -m "feat(research-os): add OLD_TO_NEW redirect map"
```

---

### Task 2: Pipeline shell (`/research-os/pipeline`, 8 tabs)

**Files:**
- Create: `app/(console)/research-os/pipeline/page.tsx`
- Reference (read, do not modify yet — Task 5 overwrites these later): `app/(console)/research-os/{workflow,discovery,strategy-generation,strategy-lab,agents,brain,cockpit,console}/page.tsx`

**Interfaces:**
- Consumes: `getResearchWorkflow`, `sessionAction`, `getAutonomousResearch`, `getResearchStrategyGeneration`, `getStrategyLab`, `getAgentWorkspace`, `getResearchBrain`, `getCockpit`, `getOperatingConsole` from `lib/console-api.ts` (unchanged signatures); `useConsole` from `@/components/console/widgets`; `Panel`, `PanelHead`, `StatTile`, `Badge` from `@/components/console/primitives`; `PageHeader` from `@/components/console/widgets`.
- Produces: default export `Pipeline` mounted at route `/research-os/pipeline`, reads `?tab=` (default `"workflow"`).

- [ ] **Step 1: Write the shell skeleton (tab state, tab bar, Suspense wrapper) with all 8 tab bodies stubbed to a one-line placeholder marker, then verify each stub renders**

Create the file with this exact outer structure — the 8 `XxxTab` function bodies get filled in Step 2, one at a time, each immediately followed by a manual tsc/browser check so a mistake in one tab's port is caught before starting the next:

```tsx
"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, useConsole } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
import {
  getResearchWorkflow, sessionAction, type ResearchWorkflowResp, type SessionLite,
  getAutonomousResearch, type AutonomousResearchResp,
  getResearchStrategyGeneration, type ResearchStrategyGenerationResp,
  getStrategyLab, type StrategyLabResp,
  getAgentWorkspace, type AgentWorkspaceResp, type AgentRow,
  getResearchBrain, type ResearchBrainResp, type BrainNode, type BrainEdge,
  getCockpit, type CockpitResp,
  getOperatingConsole, type OperatingConsoleResp,
} from "@/lib/console-api";

type TabKey = "workflow" | "discovery" | "strategy-generation" | "strategy-lab" | "agents" | "brain" | "cockpit" | "console";
const TABS: { key: TabKey; label: string }[] = [
  { key: "workflow", label: "워크플로우" },
  { key: "discovery", label: "자율 발굴" },
  { key: "strategy-generation", label: "전략 후보 생성" },
  { key: "strategy-lab", label: "전략 랩" },
  { key: "agents", label: "리서치 에이전트" },
  { key: "brain", label: "리서치 브레인" },
  { key: "cockpit", label: "경영진 콕핏" },
  { key: "console", label: "운영 콘솔" },
];

function num(n: number | undefined | null, d = 0) {
  return typeof n === "number" && !Number.isNaN(n) ? n : d;
}

function PipelineInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "workflow";
  const setTab = (k: TabKey) => router.push(`/research-os/pipeline?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "workflow" && <WorkflowTab />}
      {tab === "discovery" && <DiscoveryTab />}
      {tab === "strategy-generation" && <StrategyGenerationTab />}
      {tab === "strategy-lab" && <StrategyLabTab />}
      {tab === "agents" && <AgentsTab />}
      {tab === "brain" && <BrainTab />}
      {tab === "cockpit" && <CockpitTab />}
      {tab === "console" && <ConsoleTab />}
    </div>
  );
}

export default function Pipeline() {
  return (
    <Suspense fallback={null}>
      <PipelineInner />
    </Suspense>
  );
}
```

For Step 1, define each of the 8 `XxxTab` functions as a temporary one-liner (`function WorkflowTab() { return <div className="p-5 text-[11px] text-[var(--c-text-3)]">TODO workflow</div>; }`) so the file compiles, then run `npx tsc --noEmit` to confirm the skeleton itself is sound before porting real bodies in Step 2.

- [ ] **Step 2: Port each tab body verbatim from its source file, applying the exact rename listed, one tab at a time**

For each of the 8 original files, open it, copy its full JSX/logic body (everything the default-exported function currently returns and every hook/const/helper it declares) into the corresponding `XxxTab` function in `pipeline/page.tsx`, replacing that tab's Step-1 placeholder. Do not alter behavior — only apply these exact mechanical renames, needed because 8 files are now co-located in one module:

| Source file | New function name | Required renames (collision avoidance) |
|---|---|---|
| `workflow/page.tsx` | `WorkflowTab` | none — its local `STATUS_TONE`, `StagePipeline`, `SBtn`, `act()` are unique in this file |
| `discovery/page.tsx` | `DiscoveryTab` | its local `EXAMPLES` → `DISCOVERY_EXAMPLES` (collides with agents' `EXAMPLES`); `LIFECYCLE` stays |
| `strategy-generation/page.tsx` | `StrategyGenerationTab` | its local `STATE_TONE` stays (unique in this file); drop its own `run()`-triggered refresh button and effect exactly as written — keep verbatim |
| `strategy-lab/page.tsx` | `StrategyLabTab` | drop the `Panel as P, PanelHead as PH, Badge as B` import aliasing — use the shared `Panel`/`PanelHead`/`Badge` imported once at the top of `pipeline/page.tsx`; replace every `<P`/`<PH`/`<B` JSX usage with `<Panel`/`<PanelHead`/`<Badge` |
| `agents/page.tsx` | `AgentsTab` | its local `EXAMPLES` → `AGENTS_EXAMPLES`; `ROLE_TONE`, `VERDICT_TONE`, `Caption()` stay (unique) |
| `brain/page.tsx` | `BrainTab` | its local `TYPE_TONE` → `BRAIN_TYPE_TONE` (collides with governance's `graph` tab's own `TYPE_TONE`, but that lives in a different shell file so this rename is precautionary only if reused later — apply it anyway for clarity); `HEALTH_TONE`, `COL`, `MemoryList()` stay |
| `cockpit/page.tsx` | `CockpitTab` | its local `num()` → deleted; use the single `num()` defined once near the top of `pipeline/page.tsx` (Step 1) instead of a per-tab copy; `CONF`, `bandTone()`, `STAGE_TONE` stay |
| `console/page.tsx` | `ConsoleTab` | its local `num()` → deleted, same as cockpit — use the shared top-level `num()`; `CONF_TONE` stays |

`cockpit/page.tsx` and `console/page.tsx` both call `useConsole<T>((s) => getX(s), [], 60000)` — keep this exact call in each ported tab. Because each tab is its own component, mounting/unmounting via the conditional render in `PipelineInner` naturally starts/stops the interval — no behavior change beyond "only polls while its tab is active", which is strictly better than before (previously polled even when the user was on a different old-route page entirely, that's now impossible since standalone routes are gone).

After porting each tab, run `npx tsc --noEmit` before moving to the next tab in the table — this isolates which tab's port introduced a type error.

- [ ] **Step 3: Verify full type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `pipeline/page.tsx`

- [ ] **Step 4: Manual browser check**

Start the dev server (or use the already-running one per project convention), open `http://localhost:3000/research-os/pipeline`, click through all 8 tabs, confirm each renders its data and the `workflow` tab's session action buttons (pause/resume/archive) still call `sessionAction` successfully. Take 1 screenshot of the tab bar with `workflow` active.

- [ ] **Step 5: Commit**

```bash
git add "app/(console)/research-os/pipeline/page.tsx"
git commit -m "feat(research-os): add pipeline shell (8 tabs, ported unchanged)"
```

---

### Task 3: Validation shell (`/research-os/validation`, 3 tabs)

**Files:**
- Create: `app/(console)/research-os/validation/page.tsx`
- Reference (read, do not modify yet): `app/(console)/research-os/{validation,production,intelligence-plus}/page.tsx`

**Interfaces:**
- Consumes: `getValidationLoop`, `getProductionReadiness`, `getResearchIntelligence` from `lib/console-api.ts` (unchanged signatures).
- Produces: default export `ValidationShell` mounted at route `/research-os/validation`, reads `?tab=` (default `"validation"`).

- [ ] **Step 1: Write the shell skeleton**

```tsx
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
import {
  getValidationLoop, type ValidationLoopResp, type LifecycleStep, type LifecycleRow,
  getProductionReadiness, type ProductionReadinessResp,
  getResearchIntelligence, type ResearchIntelligenceResp, type CreativeHypothesis,
} from "@/lib/console-api";

type TabKey = "validation" | "production" | "intelligence-plus";
const TABS: { key: TabKey; label: string }[] = [
  { key: "validation", label: "검증 루프" },
  { key: "production", label: "위원회·프로덕션" },
  { key: "intelligence-plus", label: "인텔리전스+" },
];

function ValidationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "validation";
  const setTab = (k: TabKey) => router.push(`/research-os/validation?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "validation" && <ValidationTab />}
      {tab === "production" && <ProductionTab />}
      {tab === "intelligence-plus" && <IntelligencePlusTab />}
    </div>
  );
}

export default function ValidationShell() {
  return (
    <Suspense fallback={null}>
      <ValidationInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Port each tab body verbatim**

| Source file | New function name | Required renames |
|---|---|---|
| `validation/page.tsx` | `ValidationTab` | none — its local `STATE_TONE`, `EV_TONE`, `fmt()` are unique in this file |
| `production/page.tsx` | `ProductionTab` | none — its local `SEV_TONE`, `CONV_TONE` are unique in this file |
| `intelligence-plus/page.tsx` | `IntelligencePlusTab` | none — its local `PRIO_TONE` is unique in this file |

No cross-tab name collisions in this group — copy each body in as-is, only renaming the top-level function itself (per the table) and its export from `default export` to a plain named function.

Run `npx tsc --noEmit` after each tab port.

- [ ] **Step 3: Verify full type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `validation/page.tsx`

- [ ] **Step 4: Manual browser check**

Open `http://localhost:3000/research-os/validation`, click through all 3 tabs, confirm each renders (production/intelligence-plus auto-run their default query on mount — confirm that still happens once their tab is first selected).

- [ ] **Step 5: Commit**

```bash
git add "app/(console)/research-os/validation/page.tsx"
git commit -m "feat(research-os): add validation shell (3 tabs, ported unchanged)"
```

---

### Task 4: Governance shell (`/research-os/governance`, 4 tabs)

**Files:**
- Create: `app/(console)/research-os/governance/page.tsx`
- Reference (read, do not modify yet): `app/(console)/research-os/{committee,explain,graph,timeline}/page.tsx`

**Interfaces:**
- Consumes: `getCouncilExpanded`, `getDecisionMemo`, `getExplainability`, `getResearchGraph`, `getResearchTimeline` from `lib/console-api.ts` (unchanged signatures).
- Produces: default export `Governance` mounted at route `/research-os/governance`, reads `?tab=` (default `"committee"`).

- [ ] **Step 1: Write the shell skeleton**

```tsx
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
import {
  getCouncilExpanded, type CouncilExpandedResp,
  getDecisionMemo, type DecisionMemoResp,
  getExplainability, type ExplainabilityResp, type EvidenceNode,
  getResearchGraph, type ResearchGraphResp, type KGraphNode, type KGraphEdge,
  getResearchTimeline, type TimelineResp, type TimelineEntry,
} from "@/lib/console-api";

type TabKey = "committee" | "explain" | "graph" | "timeline";
const TABS: { key: TabKey; label: string }[] = [
  { key: "committee", label: "투자위원회" },
  { key: "explain", label: "설명가능성" },
  { key: "graph", label: "지식 그래프" },
  { key: "timeline", label: "타임라인" },
];

function GovernanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "committee";
  const setTab = (k: TabKey) => router.push(`/research-os/governance?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "committee" && <CommitteeTab />}
      {tab === "explain" && <ExplainTab />}
      {tab === "graph" && <GraphTab />}
      {tab === "timeline" && <TimelineTab />}
    </div>
  );
}

export default function Governance() {
  return (
    <Suspense fallback={null}>
      <GovernanceInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Port each tab body verbatim**

| Source file | New function name | Required renames |
|---|---|---|
| `committee/page.tsx` | `CommitteeTab` | none — its local `STANCE`, `CONF`, `EXAMPLES` are unique in this file; keep its `Promise.all([getCouncilExpanded(q), getDecisionMemo(q)])` dual-fetch `run()` exactly as written |
| `explain/page.tsx` | `ExplainTab` | none — its local `CONF_C()` and `sel` state are unique in this file |
| `graph/page.tsx` | `GraphTab` | none — its local `TYPE_COL`, `TYPE_TONE`, `W`/`COLW`/`ROWH`/`PAD` are unique in this file |
| `timeline/page.tsx` | `TimelineTab` | none — its local `STAGE_TONE` is unique in this file (distinct object from `pipeline/page.tsx`'s cockpit `STAGE_TONE` — different files, no collision) |

No cross-tab name collisions in this group — copy each body in as-is, only renaming the top-level function itself and its export.

Run `npx tsc --noEmit` after each tab port.

- [ ] **Step 3: Verify full type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `governance/page.tsx`

- [ ] **Step 4: Manual browser check**

Open `http://localhost:3000/research-os/governance`, click through all 4 tabs, confirm `graph` and `timeline`'s auto-run-on-mount query and node-click interactions still work, and `committee`'s form submits both fetchers together.

- [ ] **Step 5: Commit**

```bash
git add "app/(console)/research-os/governance/page.tsx"
git commit -m "feat(research-os): add governance shell (4 tabs, ported unchanged)"
```

---

### Task 5: Replace 15 old routes with redirect stubs

**Files:**
- Modify: `app/(console)/research-os/{workflow,discovery,strategy-generation,strategy-lab,agents,brain,cockpit,console,validation,production,intelligence-plus,committee,explain,graph,timeline}/page.tsx` (15 files, same one-line shape)

**Interfaces:**
- Consumes: `OLD_TO_NEW` from `lib/researchOsRedirects.ts` (Task 1).
- Produces: nothing further downstream — this is the last task that touches routing.

This task only starts after Tasks 2–4 are committed (their tab bodies are now safely duplicated into the shells; overwriting the originals here is non-destructive to the ported logic).

- [ ] **Step 1: Overwrite each of the 15 files with its stub**

Each file becomes exactly this shape (only the two `OLD_TO_NEW[...]` key strings differ per file, matching the file's own old route):

```tsx
// app/(console)/research-os/workflow/page.tsx
import { redirect } from "next/navigation";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

export default function Redirect() {
  redirect(OLD_TO_NEW["/research-os/workflow"]);
}
```

Apply this to all 15, substituting the key each time:

| File | Key |
|---|---|
| `workflow/page.tsx` | `/research-os/workflow` |
| `discovery/page.tsx` | `/research-os/discovery` |
| `strategy-generation/page.tsx` | `/research-os/strategy-generation` |
| `strategy-lab/page.tsx` | `/research-os/strategy-lab` |
| `agents/page.tsx` | `/research-os/agents` |
| `brain/page.tsx` | `/research-os/brain` |
| `cockpit/page.tsx` | `/research-os/cockpit` |
| `console/page.tsx` | `/research-os/console` |
| `validation/page.tsx` | `/research-os/validation` |
| `production/page.tsx` | `/research-os/production` |
| `intelligence-plus/page.tsx` | `/research-os/intelligence-plus` |
| `committee/page.tsx` | `/research-os/committee` |
| `explain/page.tsx` | `/research-os/explain` |
| `graph/page.tsx` | `/research-os/graph` |
| `timeline/page.tsx` | `/research-os/timeline` |

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors (each stub is a valid server component; `"use client"` must NOT be present in any of these 15 files — `redirect()` from `next/navigation` in a page component works server-side without it)

- [ ] **Step 3: Manual browser check**

Visit `http://localhost:3000/research-os/workflow` directly and confirm it 302s to `/research-os/pipeline?tab=workflow` with content rendering. Spot-check one more (e.g. `/research-os/committee` → `/research-os/governance?tab=committee`).

- [ ] **Step 4: Commit**

```bash
git add "app/(console)/research-os/workflow/page.tsx" "app/(console)/research-os/discovery/page.tsx" \
  "app/(console)/research-os/strategy-generation/page.tsx" "app/(console)/research-os/strategy-lab/page.tsx" \
  "app/(console)/research-os/agents/page.tsx" "app/(console)/research-os/brain/page.tsx" \
  "app/(console)/research-os/cockpit/page.tsx" "app/(console)/research-os/console/page.tsx" \
  "app/(console)/research-os/validation/page.tsx" "app/(console)/research-os/production/page.tsx" \
  "app/(console)/research-os/intelligence-plus/page.tsx" "app/(console)/research-os/committee/page.tsx" \
  "app/(console)/research-os/explain/page.tsx" "app/(console)/research-os/graph/page.tsx" \
  "app/(console)/research-os/timeline/page.tsx"
git commit -m "refactor(research-os): replace 15 old routes with redirect stubs"
```

---

### Task 6: CommandRail.tsx — collapse 4 groups into 1

**Files:**
- Modify: `components/console/CommandRail.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing downstream — final nav-visible change.

- [ ] **Step 1: Replace the 4 `Research · *` groups with 1 `Research OS` group**

In `CONSOLE_GROUPS`, delete the 4 existing entries labeled `"Research · 모니터링"`, `"Research · 파이프라인"`, `"Research · 거버넌스"`, `"Research · 랩"` in full, and insert this single group in their place (keep its position — first among the research-related groups, same as before):

```tsx
{ label: "Research OS", items: [
  { href: "/research-os/pipeline", label: "파이프라인" },
  { href: "/research-os/validation", label: "검증·실전준비" },
  { href: "/research-os/governance", label: "거버넌스" },
  { href: "/research-os/chat", label: "어시스턴트" },
] },
```

Leave the separate `"Investment OS"` group untouched — it is out of scope. The old `"Research · 랩"` group's `/investment-os?tab=research` "Jarvis 라이브뷰" link is dropped entirely (it pointed at investment-os's own tab, not a research-os route being consolidated here — investment-os itself already links to it internally, so this was a redundant cross-link, not a route being removed).

- [ ] **Step 2: Fix `OPERATOR_GROUP_LABELS`**

Find the line `const OPERATOR_GROUP_LABELS = [...]` that currently includes `"Research · 모니터링"`. Replace that entry with `"Research OS"`, so operator mode still shows the consolidated research nav (closest preservation of prior behavior — `cockpit`/`console`, previously the operator-visible subset, now live inside this one group alongside the rest of the pipeline).

- [ ] **Step 3: Fix `GroupGlyph`'s icon map**

In `GroupGlyph`'s `g: Record<string, ReactNode>` map, find the existing entry keyed `"Research · 파이프라인"`. Copy its exact SVG value verbatim into a new entry keyed `"Research OS"` (added alongside, not replacing, since the old key is now unused and can be left or removed — removing it is cleaner since no group will ever look it up again, so delete the old `"Research · 파이프라인"` key once its value has been copied to `"Research OS"`). Also delete the now-dead `"Research · 모니터링"`, `"Research · 거버넌스"`, `"Research · 랩"` entries from `g` if present, since no group label will ever match them again.

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `CommandRail.tsx`

- [ ] **Step 5: Manual browser check**

Open any console page, confirm the sidebar shows one "Research OS" group with 4 items, confirm operator mode (if there's a UI toggle for it) still shows the group, confirm the group's icon isn't the default fallback circle.

- [ ] **Step 6: Commit**

```bash
git add components/console/CommandRail.tsx
git commit -m "refactor(research-os): collapse CommandRail nav to single Research OS group"
```

---

## Self-Review

**1. Spec coverage:**
- Goal (16→4 nav items, no backend change, redirects preserved) → Tasks 2–6. ✅
- 그룹 매핑 table (8/3/4/1 split) → Tasks 2, 3, 4 (chat untouched, no task needed). ✅
- Architecture (investment-os pattern reuse) → Tasks 2–4's tab-bar/Suspense/`?tab=` structure mirrors investment-os's UX; fetch-hook choice explicitly deviated and justified in the plan header. ✅
- 구 라우트 리다이렉트 (15-entry map + stub shape) → Tasks 1, 5. ✅
- CommandRail.tsx 변경 → Task 6 (plus the two spec-silent gaps — `OPERATOR_GROUP_LABELS`, `GroupGlyph` — resolved explicitly, not left dangling). ✅
- 데이터 흐름·에러 처리 (AbortController convention, no new logic) → satisfied by verbatim porting in Tasks 2–4. ✅
- 경계 확인 (separation.py unaffected) → no task touches backend or `investment_os/separation.py`; nothing to add. ✅
- 테스트 계획 (tsc, redirect unit test, manual browser check, no pytest impact) → Task 1's test, `tsc --noEmit` in every task, manual checks in every task's Step 4. ✅
- Out of Scope (58 routes, 11 dead fetchers, investment-os structure, chat internals) → no task touches any of these. ✅

**2. Placeholder scan:** No "TBD"/"similar to Task N without code"/vague error-handling instructions found. Tab-body porting instructions reference exact existing files with a concrete rename table rather than inventing content — verified against the No-Placeholders rule's intent (missing/invented logic), not literal duplication, given the source bodies are 90–230 lines each and already exist verbatim in the repo for the implementer to open.

**3. Type consistency:** `OLD_TO_NEW` (Task 1) used identically in Task 5's stubs. All `getX`/type imports across Tasks 2–4 match the exact export names confirmed by reading `lib/console-api.ts` this session (`getResearchWorkflow`, `sessionAction`, `getAutonomousResearch`, `getResearchStrategyGeneration`, `getStrategyLab`, `getAgentWorkspace`, `getResearchBrain`, `getCockpit`, `getOperatingConsole`, `getValidationLoop`, `getProductionReadiness`, `getResearchIntelligence`, `getCouncilExpanded`, `getDecisionMemo`, `getExplainability`, `getResearchGraph`, `getResearchTimeline`, and their response/row types) — no invented names. `TabKey` unions in Tasks 2–4 match each group's route-mapping keys in Task 1's `OLD_TO_NEW`.

---

Plan complete and saved to `docs/superpowers/plans/2026-08-21-research-os-consolidation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
