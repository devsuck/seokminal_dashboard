# 홈/네비 단순화 (1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/hud`와 `/command` 두 개로 쪼개진 홈을 `/hud` 하나로 합치고, "사람 판단이 실제로 필요한 것"만 골라 보여주는 섹션을 추가하고, `CommandRail.tsx` 나브를 기본 3그룹만 보이는 Operator 모드로 줄인다.

**Architecture:** 백엔드 변경 없음 — 기존 `/console/*` 엔드포인트(`lib/console-api.ts`)와 `/hud`가 이미 쓰는 레거시 상태 API를 조합만 한다. `lib/attention.ts`에 순수함수 `deriveAttentionItems()`를 새로 만들어 5개 신호를 "판단 필요" 배열로 변환하고, `/hud`가 그걸 렌더한다. `CommandRail.tsx`에는 그룹 화이트리스트 필터를 얹은 Operator/Full 토글을 추가한다. `/command` 라우트는 삭제하고 남은 링크를 전부 `/hud`로 되돌린다.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind 4(디자인 토큰만), Vitest(`tests/lib/*.test.ts`).

## Global Constraints

- 디자인 토큰만 사용: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`. `style={{}}` 금지(차트 height 예외, 이번 작업엔 해당 없음).
- Raw `fetch` 금지 — `lib/api.ts`/`lib/console-api.ts`의 `get()` 헬퍼 계열만 사용.
- `AbortController` 라이프사이클: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup. `app/hud/page.tsx`의 기존 `useEffect`(138-162행) 패턴을 그대로 따를 것 — 새 패턴 도입 금지.
- 백엔드 변경 없음 — 이번 계획 전체가 프론트엔드(`seokminal-dashboard/`)로 닫힘.
- 테스트는 Vitest, `tests/lib/<name>.test.ts` 경로 컨벤션(`describe`/`it`/`expect`, 상대경로 import).

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `lib/attention.ts` | 신규 | `AttentionItem` 타입 + `deriveAttentionItems()` 순수함수 — 5개 소스 신호를 "판단 필요" 카드 배열로 변환 |
| `tests/lib/attention.test.ts` | 신규 | `deriveAttentionItems()` 케이스별 단위테스트 |
| `app/hud/page.tsx` | 수정 | fetch 3개 추가(`getConsolePipeline`/`getRisk`/`getInvestmentOs`), "판단 필요" Panel 섹션 추가 |
| `components/console/CommandRail.tsx` | 수정 | Operator/Full 토글, 그룹 필터 순수함수 추출, 브랜드/nav 링크 `/command`→`/hud` |
| `tests/lib/commandRailGroups.test.ts` | 신규 | 그룹 필터 순수함수 단위테스트 |
| `lib/research-os.ts` | 수정 | `/command"` fallback href 5곳 → `/hud"` |
| `app/(console)/command/page.tsx` | 삭제 | `/hud`로 흡수 완료, 중복 홈 제거 |

---

## Task 1: `deriveAttentionItems()` 순수함수 + 테스트

**Files:**
- Create: `lib/attention.ts`
- Test: `tests/lib/attention.test.ts`

**Interfaces:**
- Produces: `AttentionItem { id: string; label: string; detail: string; href: string; tone: "neg" | "warn" | "info" }`, `deriveAttentionItems(input: AttentionInput): AttentionItem[]`, `AttentionInput { pipeline: { proposals: number } | null; risk: { by_status: Record<string, number> } | null; investmentOs: { gates: { passed?: boolean }; execution_ladder: { human_approval_mandatory: boolean } } | null; autoResearch: { n_candidates: number } | null }`
- 이 타입들은 `console-api.ts`의 `ConsolePipeline`/`RiskResp`/`InvestmentOsResp`와 `lib/api.ts`의 `AutoResearchStatus`의 부분집합이라 구조적으로 호환됨(별도 변환 불필요, 그대로 넘기면 됨).

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/lib/attention.test.ts
import { describe, it, expect } from "vitest";
import { deriveAttentionItems } from "../../lib/attention";

describe("deriveAttentionItems", () => {
  it("모든 입력 null이면 빈 배열", () => {
    const items = deriveAttentionItems({ pipeline: null, risk: null, investmentOs: null, autoResearch: null });
    expect(items).toEqual([]);
  });

  it("proposals > 0이면 파이프라인 승인 대기 카드", () => {
    const items = deriveAttentionItems({
      pipeline: { proposals: 3 }, risk: null, investmentOs: null, autoResearch: null,
    });
    expect(items).toContainEqual({
      id: "pipeline-proposals", label: "제안 승인 대기", detail: "3건", href: "/investment-os", tone: "warn",
    });
  });

  it("proposals == 0이면 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: { proposals: 0 }, risk: null, investmentOs: null, autoResearch: null,
    });
    expect(items.find((i) => i.id === "pipeline-proposals")).toBeUndefined();
  });

  it("risk.by_status.BLOCK > 0이면 리스크 차단 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: { by_status: { ALLOW: 10, BLOCK: 2 } }, investmentOs: null, autoResearch: null,
    });
    expect(items).toContainEqual({
      id: "risk-block", label: "리스크 차단 이벤트", detail: "2건", href: "/risk-guard", tone: "neg",
    });
  });

  it("BLOCK 없으면 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: { by_status: { ALLOW: 10 } }, investmentOs: null, autoResearch: null,
    });
    expect(items.find((i) => i.id === "risk-block")).toBeUndefined();
  });

  it("gates.passed && human_approval_mandatory면 승격 대기 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, autoResearch: null,
      investmentOs: { gates: { passed: true }, execution_ladder: { human_approval_mandatory: true } },
    });
    expect(items).toContainEqual({
      id: "ladder-gate", label: "다음 단계 승격 가능", detail: "승인 필요", href: "/investment-os", tone: "info",
    });
  });

  it("gates.passed가 false면 승격 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, autoResearch: null,
      investmentOs: { gates: { passed: false }, execution_ladder: { human_approval_mandatory: true } },
    });
    expect(items.find((i) => i.id === "ladder-gate")).toBeUndefined();
  });

  it("n_candidates > 0이면 리서치 후보 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, investmentOs: null, autoResearch: { n_candidates: 5 },
    });
    expect(items).toContainEqual({
      id: "research-candidates", label: "리서치 후보 검토 대기", detail: "5건", href: "/auto-research", tone: "info",
    });
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run tests/lib/attention.test.ts`
Expected: FAIL — `Cannot find module '../../lib/attention'`

- [ ] **Step 3: 최소 구현 작성**

```typescript
// lib/attention.ts
export type AttentionTone = "neg" | "warn" | "info";

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: AttentionTone;
}

export interface AttentionInput {
  pipeline: { proposals: number } | null;
  risk: { by_status: Record<string, number> } | null;
  investmentOs: {
    gates: { passed?: boolean };
    execution_ladder: { human_approval_mandatory: boolean };
  } | null;
  autoResearch: { n_candidates: number } | null;
}

export function deriveAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.pipeline && input.pipeline.proposals > 0) {
    items.push({
      id: "pipeline-proposals", label: "제안 승인 대기",
      detail: `${input.pipeline.proposals}건`, href: "/investment-os", tone: "warn",
    });
  }

  const blocked = input.risk?.by_status?.BLOCK ?? 0;
  if (blocked > 0) {
    items.push({
      id: "risk-block", label: "리스크 차단 이벤트",
      detail: `${blocked}건`, href: "/risk-guard", tone: "neg",
    });
  }

  if (input.investmentOs?.gates.passed && input.investmentOs.execution_ladder.human_approval_mandatory) {
    items.push({
      id: "ladder-gate", label: "다음 단계 승격 가능",
      detail: "승인 필요", href: "/investment-os", tone: "info",
    });
  }

  if (input.autoResearch && input.autoResearch.n_candidates > 0) {
    items.push({
      id: "research-candidates", label: "리서치 후보 검토 대기",
      detail: `${input.autoResearch.n_candidates}건`, href: "/auto-research", tone: "info",
    });
  }

  return items;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/attention.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/attention.ts tests/lib/attention.test.ts
git commit -m "feat: deriveAttentionItems 순수함수 추가 — 판단 필요 신호 판정"
```

---

## Task 2: `/hud`에 "판단 필요" 섹션 추가

**Files:**
- Modify: `app/hud/page.tsx`

**Interfaces:**
- Consumes: `deriveAttentionItems`, `AttentionInput`, `AttentionItem` (Task 1), `getConsolePipeline`, `getRisk`, `getInvestmentOs`, `ConsolePipeline`, `RiskResp`, `InvestmentOsResp` (기존 `lib/console-api.ts`, 이미 export되어 있음 — 신규 export 불필요)

- [ ] **Step 1: import 추가**

`app/hud/page.tsx` 4-13행(기존 import 블록) 바로 아래에 추가:

```typescript
import {
  getConsolePipeline, getRisk, getInvestmentOs,
  type ConsolePipeline, type RiskResp, type InvestmentOsResp,
} from "@/lib/console-api";
import { deriveAttentionItems } from "@/lib/attention";
```

- [ ] **Step 2: `Feed` 인터페이스 확장**

`app/hud/page.tsx:67-72`의 `Feed` 인터페이스를 아래로 교체:

```typescript
interface Feed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null; alerts: TriggeredAlert[] | null;
  vrp: VrpBotStatus | null; health: LabHealth | null;
  pipeline: ConsolePipeline | null; risk: RiskResp | null; ios: InvestmentOsResp | null;
}
```

- [ ] **Step 3: 초기 state에 필드 3개 추가**

`app/hud/page.tsx:118`을 아래로 교체:

```typescript
  const [f, setF] = useState<Feed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null, alerts: null, vrp: null, health: null, pipeline: null, risk: null, ios: null });
```

- [ ] **Step 4: `Promise.all` fetch 3개 추가**

`app/hud/page.tsx:144-157`을 아래로 교체(기존 abort/mounted 가드 패턴 그대로 유지, 항목만 추가):

```typescript
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge, alerts, vrp, health, pipeline, risk, ios] = await Promise.all([
        getLabState(c.signal).catch(() => null),
        getJarvisStatus(c.signal).catch(() => null),
        getAutoResearch(c.signal).catch(() => null),
        getBuybackBot(c.signal).catch(() => null),
        listAgents(c.signal).catch(() => null),
        getLabStatus(c.signal).catch(() => null),
        getExecutionConsole(c.signal).catch(() => null),
        getExecutionEdge(c.signal).catch(() => null),  // read_only 캐시 — 서버 계산 없음
        getTriggeredAlerts(c.signal).catch(() => null),
        getVrpBotStatus(c.signal).catch(() => null),
        getLabHealth(c.signal).catch(() => null),  // 봇·에이전트 정합성 불변식
        getConsolePipeline(c.signal).catch(() => null),
        getRisk(c.signal).catch(() => null),
        getInvestmentOs(1_000_000, c.signal).catch(() => null),
      ]);
      if (mounted && !c.signal.aborted) setF({ lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge, alerts, vrp, health, pipeline, risk, ios });
```

- [ ] **Step 5: 구조분해 + attention 배열 계산**

`app/hud/page.tsx:189`(`const { lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, vrp, health } = f;`)을 아래로 교체:

```typescript
  const { lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, vrp, health, pipeline, risk, ios } = f;
```

같은 함수 내, `units` 배열 계산이 끝나는 지점(`app/hud/page.tsx:257` 근처, `const nRunning = units.filter(u => u.running).length;` 바로 위)에 추가:

```typescript
  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
  });
```

- [ ] **Step 6: "판단 필요" Panel 렌더**

`app/hud/page.tsx:288`(상단 상태 스트립 `</Panel>` 닫힘) 바로 다음, 유닛 로스터 Panel(291행) 앞에 삽입:

```tsx
      {/* 판단 필요 — 사람 결정 걸리는 것만. 0건이면 한 줄로 접힘 */}
      <Panel className="mb-1">
        <PanelHeader right={<span className="tabular-nums">{attentionItems.length}건</span>}>
          판단 필요
        </PanelHeader>
        {attentionItems.length === 0 ? (
          <div className="px-2 py-1.5">
            <StatusDot tone="pos" label="전부 정상 — 판단 필요한 항목 없음" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {attentionItems.map((it) => (
              <Link key={it.id} href={it.href} className="flex items-center gap-2 border-b border-border px-2 py-1 no-underline hover:opacity-80">
                <StatusDot tone={it.tone === "neg" ? "neg" : it.tone === "warn" ? "accent" : "info"} />
                <span className="text-[11px] font-data text-text-1 truncate flex-1">{it.label}</span>
                <span className="text-[10px] font-data text-text-3 truncate">{it.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

```

- [ ] **Step 7: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: 수동 확인**

`npm run dev` 실행 후 `/hud` 접속 — "판단 필요" 패널이 상단 상태 스트립 아래, 유닛 로스터 위에 뜨는지, 신호 0건일 때 "전부 정상" 한 줄로 접히는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add app/hud/page.tsx
git commit -m "feat: /hud에 판단 필요 섹션 추가 — pipeline/risk/investment-os 신호 통합"
```

---

## Task 3: `CommandRail.tsx` 그룹 필터 순수함수 추출 + 테스트

**Files:**
- Modify: `components/console/CommandRail.tsx`
- Test: `tests/lib/commandRailGroups.test.ts`

**Interfaces:**
- Produces: `filterGroupsForOperator(groups: RailGroup[]): RailGroup[]` — `CommandRail.tsx` 내부에 정의하되 `export`해서 테스트 가능하게 함. `RailGroup`도 함께 export.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/lib/commandRailGroups.test.ts
import { describe, it, expect } from "vitest";
import { filterGroupsForOperator, type RailGroup } from "../../components/console/CommandRail";

const GROUPS: RailGroup[] = [
  { label: "트레이딩 데스크", items: [{ href: "/hud", label: "HUD" }] },
  { label: "봇 · 에이전트", items: [{ href: "/agents", label: "에이전트" }] },
  { label: "Research · 모니터링", items: [{ href: "/research-os/cockpit", label: "콕핏" }] },
  { label: "검증 · 백테스트", items: [{ href: "/backtest", label: "백테스트" }] },
];

describe("filterGroupsForOperator", () => {
  it("화이트리스트 3개 그룹만 남김", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.map((g) => g.label)).toEqual(["트레이딩 데스크", "봇 · 에이전트", "Research · 모니터링"]);
  });

  it("화이트리스트 밖 그룹은 제외", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.find((g) => g.label === "검증 · 백테스트")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run tests/lib/commandRailGroups.test.ts`
Expected: FAIL — `filterGroupsForOperator` is not exported

- [ ] **Step 3: `CommandRail.tsx`에 필터 함수 + Operator 상태 추가**

`components/console/CommandRail.tsx:10-11`(`interface RailItem`/`interface RailGroup` 정의부)을 아래로 교체(export 추가):

```typescript
export interface RailItem { href: string; label: string }
export interface RailGroup { label: string; items: RailItem[] }
```

`components/console/CommandRail.tsx:88`(`const ALL_GROUPS: RailGroup[] = [...CONSOLE_GROUPS, ...TERMINAL_GROUPS];`) 바로 다음에 추가:

```typescript
const OPERATOR_GROUP_LABELS = ["트레이딩 데스크", "봇 · 에이전트", "Research · 모니터링"];
const OPERATOR_MODE_KEY = "commandRailOperatorMode";

export function filterGroupsForOperator(groups: RailGroup[]): RailGroup[] {
  return groups.filter((g) => OPERATOR_GROUP_LABELS.includes(g.label));
}
```

`components/console/CommandRail.tsx:122`(`const [open, setOpen] = useState(true);` 다음 줄)에 상태 추가:

```typescript
  const [operatorMode, setOperatorMode] = useState(true);
```

같은 컴포넌트 내, 기존 `openGroups` localStorage 로딩 `useEffect`(130행 시작) 다음에 별도 `useEffect` 추가:

```typescript
  useEffect(() => {
    const stored = localStorage.getItem(OPERATOR_MODE_KEY);
    if (stored !== null) setOperatorMode(stored === "true");
  }, []);

  function toggleOperatorMode() {
    setOperatorMode((prev) => {
      const next = !prev;
      localStorage.setItem(OPERATOR_MODE_KEY, String(next));
      return next;
    });
  }
```

`components/console/CommandRail.tsx:233-237`(`{renderGroups(CONSOLE_GROUPS)}` / 구분선 / `{renderGroups(TERMINAL_GROUPS)}` 블록)을 아래로 교체:

```tsx
        {renderGroups(operatorMode ? filterGroupsForOperator(CONSOLE_GROUPS) : CONSOLE_GROUPS)}
        {/* divider → 레거시 트레이딩 터미널 */}
        <div className="mt-3 mb-1 mx-3.5 border-t border-[var(--c-border)]" />
        {open && <div className="px-3.5 pt-1 pb-1 text-[8.5px] font-semibold tracking-[0.28em] text-[var(--c-text-3)] uppercase opacity-70">터미널 · 레거시</div>}
        {renderGroups(operatorMode ? filterGroupsForOperator(TERMINAL_GROUPS) : TERMINAL_GROUPS)}
```

footer의 collapse 버튼(255행, `<button onClick={() => setOpen((v) => !v)}`) 바로 위에 Operator 토글 버튼 추가:

```tsx
        <button onClick={toggleOperatorMode}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors text-[10px] tracking-wide">
          {open ? (operatorMode ? "전체보기" : "간단히 보기") : (operatorMode ? "전체" : "간단")}
        </button>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/lib/commandRailGroups.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 타입체크 + 수동 확인**

Run: `npx tsc --noEmit` — 에러 없음.
`npm run dev`로 아무 페이지나 접속, 나브 하단 "전체보기" 버튼 클릭 시 9그룹 다 뜨는지, 다시 누르면 3그룹만 남는지, 새로고침해도 선택 유지되는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add components/console/CommandRail.tsx tests/lib/commandRailGroups.test.ts
git commit -m "feat: CommandRail Operator/Full 토글 추가 — 기본 3그룹만 노출"
```

---

## Task 4: `/command` 라우트 삭제 + 남은 링크 정리

**Files:**
- Delete: `app/(console)/command/page.tsx`
- Modify: `components/console/CommandRail.tsx` (브랜드 로고 + "커맨드 센터" nav 링크)
- Modify: `lib/research-os.ts` (fallback href 5곳)

**Interfaces:**
- 없음(링크 문자열 변경만, 신규 함수/타입 없음)

- [ ] **Step 1: `CommandRail.tsx`의 `/command` 링크 2곳을 `/hud`로 변경**

`components/console/CommandRail.tsx:205`(브랜드 로고 `<Link href="/command" ...>`)를 `<Link href="/hud" ...>`로 교체.

`components/console/CommandRail.tsx:216-219`(`<Link href="/command" className={... isActive("/command") ...}>`) 블록 전체를 아래로 교체 — 목적지와 활성 판정, 라벨을 전부 `/hud`로 정정:

```tsx
      <Link href="/hud" className={`group relative flex items-center gap-3 h-11 px-3.5 no-underline shrink-0 transition-colors ${
        isActive("/hud") ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_9%,transparent)]"
                             : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"}`}>
        {isActive("/hud") && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_10px_var(--c-hud)]" />}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
        </svg>
        {open && <span className="text-[12.5px] font-medium tracking-wide">홈</span>}
      </Link>
```

- [ ] **Step 2: `lib/research-os.ts`의 `/command` fallback 5곳을 `/hud`로 변경**

`lib/research-os.ts:51,76,91,98,112` — `"/command"` 리터럴 5곳 전부 `"/hud"`로 치환. (`grep -n '"/command"' lib/research-os.ts`로 정확한 라인 재확인 후 각각 교체.)

- [ ] **Step 3: `/command` 라우트 파일 삭제**

```bash
git rm "app/(console)/command/page.tsx"
```

- [ ] **Step 4: 남은 참조 확인**

Run: `grep -rn '"/command"' --include="*.tsx" --include="*.ts" . | grep -v node_modules`
Expected: 결과 없음(전부 정리됨)

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 수동 확인**

`npm run dev` 실행, 브랜드 로고 클릭 → `/hud`로 이동하는지, 예전 "커맨드 센터"였던 nav 항목이 이제 "홈"으로 표시되고 `/hud`를 가리키는지, `research-os` 관련 페이지에서 예전에 `/command`로 걸려있던 링크들이 이제 `/hud`로 가는지 확인. `/command` 직접 접속 시 Next.js 404 뜨는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add components/console/CommandRail.tsx lib/research-os.ts
git commit -m "refactor: /command 라우트 제거, /hud로 홈 통합 완료"
```

---

## Self-Review Notes

- **스펙 커버리지:** 스펙의 "홈 통합"(Task 4) / "판단 필요 큐"(Task 1-2, 5개 신호 전부 매핑됨) / "나브 Operator 모드"(Task 3) / "데이터 흐름·에러 처리"(Task 2 Step 4, 기존 abort 패턴 그대로) / "테스트"(Task 1, 3의 vitest 단위테스트) 전부 태스크로 커버됨.
- **스펙과의 정정 사항:** 스펙 초안은 리스크 신호를 "breach/warn 상태"로 서술했으나, 실제 백엔드(`jarvis/execution_risk/models.py:47`) 확인 결과 `overall_status`는 `ALLOW | BLOCK` 2값뿐 — Task 1에서 `by_status.BLOCK > 0` 조건으로 정정. 스펙의 승격 게이트 소스도 초안엔 `advanceLadder`(POST) 언급이 있었으나 읽기 전용 `getInvestmentOs()`(GET)가 이미 `gates.passed`+`human_approval_mandatory`를 제공해 그걸로 대체.
- **플레이스홀더 스캔:** TBD/TODO 없음, 전 스텝에 실제 코드 포함.
- **타입 일관성:** `AttentionItem`/`AttentionInput`(Task 1)이 Task 2에서 그대로 소비됨, `RailGroup`/`filterGroupsForOperator`(Task 3)가 Task 4에서 이름 변경 없이 그대로 유지됨.
