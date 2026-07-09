# Bloomberg Terminal 리디자인 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 디자인 토큰 오버홀(각진 모서리 + 더 짙은 배경) + NAUTILUS→SEOKMINAL 리브랜드(조커 로고) + 신규 `<Panel>`/`<PanelHeader>` 공용 컴포넌트 + `/hud`·`/market` 2개 플래그십 페이지를 Bloomberg 무드로 전환.

**Architecture:** Tailwind v4 `@theme`의 `--radius-*` 변수를 0으로 오버라이드해 43페이지 전체 모서리를 파일 수정 없이 전역 각짐 처리. Sidebar 로고를 정적 SVG로 교체. 새 `Panel`/`PanelHeader` 컴포넌트를 만들어 `/hud`, `/market`(의 `ComparisonTab`) 두 곳에만 적용. Jarvis/HUD 모션·색상 서브시스템(`globals.css`의 키프레임, `--color-hud`, `components/Jarvis.tsx`/`Hud.tsx`/`ReactorCore.tsx`)은 **삭제하지 않고** `/hud` 페이지의 사용부만 제거 — Phase 2 대상 페이지(`/lab`, `/lab/execution`, `/agents`, `/overview`, `/buyback-doctor`, `AutoResearchPanel.tsx`)가 같은 키프레임/컴포넌트를 여전히 참조하기 때문.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TailwindCSS 4 (`@theme` 토큰).

## Global Constraints

- 스타일링은 디자인 토큰만 사용 (`bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`) — `style={{}}` 금지(차트 컨테이너 height 등 기존 예외 제외).
- `bg-accent text-black`은 주요 액션 버튼 전용이었으나, 본 플랜에서 Bloomberg 시그니처 헤더바(`PanelHeader`)에도 확장 사용 — 스펙(`docs/superpowers/specs/2026-07-09-bloomberg-redesign-design.md`) 승인된 패턴.
- Raw `fetch` 금지, `lib/api.ts` 경유. (본 플랜은 API 호출 코드 변경 없음 — 스타일/마크업만 건드림.)
- 커밋은 `main`에 직접, 태스크별로 분리.
- **스펙 대비 명시적 축소(deviation)**: 스펙 4절 "전역 키프레임 삭제(사용부 없어지면)"는 문자 그대로 실행하지 않는다. `pulse-glow`/`radar`/`scanline`/`flicker`/`orb`/`ring` 키프레임, `--color-hud` 토큰, `.hud-frame`/`.scanline-host`/`.tech-grid`/`.hud-glow`/`.hud-bg` 유틸리티 클래스, `components/Jarvis.tsx`/`components/Hud.tsx`/`components/ReactorCore.tsx`는 Phase 2 대상 페이지(`/lab`, `/lab/execution`, `/agents`, `/overview`, `/buyback-doctor`, `AutoResearchPanel.tsx`)가 여전히 import/참조하므로 **`globals.css`에 그대로 둔다**. Phase 1은 `/hud` 페이지 자신의 마크업에서 이 클래스들의 *사용*만 제거한다. `animate-blink`는 KILL/워치독 경보 등 정보성 알림이라 스펙의 "정보성 트랜지션 유지" 조항에 따라 그대로 둔다.
- `/market` 트리(`app/market`, `app/crypto`, `app/forex`, `app/futures`, `app/options`, `app/search`)는 grep 확인 결과 Jarvis/HUD 모션 클래스 사용이 전혀 없다 — Phase 1에서 `/market`은 모션 제거 작업이 필요 없고, `<Panel>` 적용 대상은 실제로 헤더바 패턴이 존재하는 `components/market/ComparisonTab.tsx` 하나뿐이다.

---

## File Structure

```
app/globals.css                     - MODIFY: --radius-* 오버라이드, --color-bg 더 짙게
components/JokerLogo.tsx            - CREATE: 정적 원형 조커 SVG 로고
components/Sidebar.tsx              - MODIFY: NAUTILUS→SEOKMINAL, 로고 마크 교체
app/layout.tsx                      - MODIFY: metadata.title
components/ui/Panel.tsx             - CREATE: <Panel>/<PanelHeader>
components/market/ComparisonTab.tsx - MODIFY: 기존 카드 패턴 → <Panel>/<PanelHeader>
app/hud/page.tsx                    - MODIFY: hud-frame/scanline-host/tech-grid/hud-bg/text-hud/border-hud/LivePulse(ring) 제거, <Panel>/<PanelHeader> + 정적 StatusDot로 재작성
```

---

### Task 1: 디자인 토큰 — 모서리 전역 각짐 + 배경 더 짙게

**Files:**
- Modify: `app/globals.css:4-36` (`@theme` 블록)

**Interfaces:**
- Produces: 이후 모든 태스크가 상속받는 전역 토큰. `rounded`/`rounded-md`/`rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-3xl`/`rounded-4xl` 클래스가 앱 전체에서 0px로 렌더링됨. `rounded-full`은 Tailwind v4에서 `--radius-*` 변수를 참조하지 않는 고정 유틸(`calc(infinity*1px)`)이라 영향 없음 — 원형 요소(로고, 상태 점, 아바타)는 그대로 원형 유지.

- [ ] **Step 1: `@theme` 블록에 radius 오버라이드 + 배경색 변경 추가**

`app/globals.css`의 `--color-info: #3B82F6;` 줄 바로 다음, `/* Fonts */` 줄 이전에 삽입:

```css
  --color-info:     #3B82F6;

  /* Corners — Bloomberg 무드: 전역 각짐. rounded-full은 별도 고정 유틸이라 미적용 */
  --radius:     0px;
  --radius-xs:  0px;
  --radius-sm:  0px;
  --radius-md:  0px;
  --radius-lg:  0px;
  --radius-xl:  0px;
  --radius-2xl: 0px;
  --radius-3xl: 0px;
  --radius-4xl: 0px;
```

그리고 `--color-bg:       #080A0F;`를 다음으로 교체:

```css
  --color-bg:       #05070B;
```

- [ ] **Step 2: 타입체크**

Run: `cd seokminal-dashboard && npx tsc --noEmit`
Expected: 에러 없음 (CSS만 변경이므로 영향 없어야 함).

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 43개 라우트 전부 정상 생성.

- [ ] **Step 4: 커밋**

```bash
git add app/globals.css
git commit -m "style: 전역 모서리 각짐 + 배경 더 짙게 (Bloomberg 무드 Phase 1)"
```

---

### Task 2: 조커 로고 SVG 컴포넌트

**Files:**
- Create: `components/JokerLogo.tsx`

**Interfaces:**
- Produces: `JokerLogo({ size?: number })` — `size`는 px, 기본 20. Sidebar가 collapsed/expanded 두 상태 모두에서 이 컴포넌트를 사용.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// components/JokerLogo.tsx
export function JokerLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#E6EAF0" stroke="#242A35" strokeWidth="0.75" />
      <path d="M4 7.5 Q6 4 8 7" fill="none" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7 Q14 4 16 7.5" fill="none" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="9.5" r="1" fill="#0F131A" />
      <circle cx="13" cy="9.5" r="1" fill="#0F131A" />
      <path d="M5.5 12.5 Q10 17 14.5 12.5" fill="none" stroke="#C026D3" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/JokerLogo.tsx
git commit -m "feat: 조커 로고 SVG 컴포넌트 추가"
```

---

### Task 3: Sidebar 리브랜드 — NAUTILUS→SEOKMINAL + 조커 로고

**Files:**
- Modify: `components/Sidebar.tsx:1-8` (import), `components/Sidebar.tsx:215-229` (로고 마크)

**Interfaces:**
- Consumes: `JokerLogo` from `components/JokerLogo.tsx` (Task 2).

- [ ] **Step 1: import 추가**

`components/Sidebar.tsx` 상단, `import { ShutdownButton } from "@/components/ShutdownButton";` 다음 줄에 추가:

```tsx
import { JokerLogo } from "@/components/JokerLogo";
```

- [ ] **Step 2: 로고 마크 교체**

`components/Sidebar.tsx:215-229`의 다음 블록을:

```tsx
        {!collapsed && (
          <span className="flex items-center gap-2 flex-1 select-none">
            <span className="relative inline-flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-accent/60 animate-[ring_2s_ease-out_infinite]" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-accent animate-[orb_3s_ease-in-out_infinite]" />
            </span>
            <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">NAUTILUS</span>
          </span>
        )}
        {collapsed && (
          <span className="relative inline-flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-accent/60 animate-[ring_2s_ease-out_infinite]" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-accent" />
          </span>
        )}
```

다음으로 교체:

```tsx
        {!collapsed && (
          <span className="flex items-center gap-2 flex-1 select-none">
            <JokerLogo size={20} />
            <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">SEOKMINAL</span>
          </span>
        )}
        {collapsed && <JokerLogo size={18} />}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 빌드 후 육안 확인**

Run: `npm run dev` (별도 터미널) → `http://localhost:3000` 접속 → 사이드바 상단에 "SEOKMINAL" 텍스트 + 조커 로고, collapsed 토글 시에도 로고만 정상 표시되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/Sidebar.tsx
git commit -m "feat: Sidebar 리브랜드 NAUTILUS→SEOKMINAL + 조커 로고"
```

---

### Task 4: layout.tsx metadata 타이틀 변경

**Files:**
- Modify: `app/layout.tsx:21-23`

- [ ] **Step 1: 타이틀 교체**

`app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "NAUTILUS",
};
```

를:

```tsx
export const metadata: Metadata = {
  title: "SEOKMINAL",
};
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add app/layout.tsx
git commit -m "feat: 브라우저 탭 타이틀 SEOKMINAL로 변경"
```

---

### Task 5: `<Panel>`/`<PanelHeader>` 공용 컴포넌트

**Files:**
- Create: `components/ui/Panel.tsx`

**Interfaces:**
- Produces:
  - `PanelHeader({ children, right? }: { children: ReactNode; right?: ReactNode })` — 오렌지 솔리드 배경 + 검정 굵은 대문자 텍스트 헤더바. `right`는 같은 헤더 줄 우측에 렌더링(텍스트는 호출부에서 `text-black`으로 지정해야 헤더 배경과 대비됨).
  - `Panel({ children, className? }: { children: ReactNode; className?: string })` — `border border-border bg-panel overflow-hidden` 바디 래퍼.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// components/ui/Panel.tsx
import type { ReactNode } from "react";

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-accent px-3 py-1.5">
      <span className="text-black text-[11px] font-bold uppercase tracking-wider">{children}</span>
      {right && <span className="text-[11px] font-data">{right}</span>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border border-border bg-panel overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/ui/Panel.tsx
git commit -m "feat: Bloomberg 스타일 Panel/PanelHeader 공용 컴포넌트 추가"
```

---

### Task 6: `ComparisonTab.tsx`에 Panel 적용 (`/market` Phase 1 전환)

**Files:**
- Modify: `components/market/ComparisonTab.tsx:1-6` (import), `:104-111` (결과 패널)

**Interfaces:**
- Consumes: `Panel`, `PanelHeader` from `components/ui/Panel.tsx` (Task 5).

- [ ] **Step 1: import 추가**

`components/market/ComparisonTab.tsx` 상단에 추가:

```tsx
import { Panel, PanelHeader } from "@/components/ui/Panel";
```

- [ ] **Step 2: 결과 패널 교체**

`components/market/ComparisonTab.tsx:104-111`의:

```tsx
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Normalized Return (%)</span>
          </div>
          <ComparisonChart data={data} symbols={chartSymbols} />
        </div>
```

를:

```tsx
        <Panel>
          <PanelHeader>Normalized Return (%)</PanelHeader>
          <ComparisonChart data={data} symbols={chartSymbols} />
        </Panel>
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add components/market/ComparisonTab.tsx
git commit -m "refactor: ComparisonTab 결과 패널을 Panel/PanelHeader로 전환"
```

---

### Task 7: `/hud` 페이지 — Jarvis 모션 제거 + Panel 전환

**Files:**
- Modify: `app/hud/page.tsx` (전체 재작성)

**Interfaces:**
- Consumes: `Panel`, `PanelHeader` from `components/ui/Panel.tsx` (Task 5). 기존 `LivePulse` (`@/components/Jarvis`) import 제거 — 대신 이 파일 내부에 정적 `StatusDot` 컴포넌트를 새로 정의(모듈 스코프, export 안 함 — `Jarvis.tsx`는 Phase 2 페이지들이 계속 쓰므로 그대로 둠).
- Produces: 변경 없음 (같은 `HudPage` default export, 같은 데이터 훅 로직).

- [ ] **Step 1: 파일 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge, getAccountBalances,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
  type AccountBalances,
} from "@/lib/api";
import { Balances } from "@/components/AccountBalances";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { displayLevel } from "@/lib/agent-level";

/* HUD 홈 — 미니멀 재설계.
   질문 하나에 답하는 페이지: "지금 뭐가 돌고 있고, 문제 없나?"
   1) 상단 스트립: 시스템 상태 + ARM 판정 + 시계
   2) 유닛 로스터(메인): N/M 가동 + 유닛별 가동/정지 카드
   3) 계좌 잔액 + 돈길 핵심 3줄
   상세 수치는 각 전용 페이지(/lab, /auto-research, /lab/execution)로 위임. */

type Tone = "pos" | "accent" | "info" | "neg" | "text-3";
const TONE: Record<Tone, { solid: string; text: string }> = {
  pos:      { solid: "bg-pos",    text: "text-pos" },
  accent:   { solid: "bg-accent", text: "text-accent" },
  info:     { solid: "bg-info",   text: "text-info" },
  neg:      { solid: "bg-neg",    text: "text-neg" },
  "text-3": { solid: "bg-text-3", text: "text-text-3" },
};

function StatusDot({ tone, label }: { tone: Tone; label?: string }) {
  const c = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${c.solid}`} />
      {label && <span className={`text-[11px] font-data ${c.text}`}>{label}</span>}
    </span>
  );
}

interface Feed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null;
}

interface Unit { kind: "AI" | "BOT"; name: string; running: boolean; detail: string; href: string; }

function UnitCard({ u }: { u: Unit }) {
  return (
    <Link href={u.href}
      className={`block border p-3 no-underline transition-colors ${
        u.running ? "border-pos/40 bg-pos/5 hover:bg-pos/10" : "border-border bg-panel-2/40 hover:bg-panel-2"}`}>
      <div className="flex items-center gap-2">
        <StatusDot tone={u.running ? "pos" : "text-3"} />
        <span className="text-xs font-semibold text-text-1 truncate flex-1">{u.name}</span>
        <span className={`text-[8px] px-1 py-0.5 border font-data ${
          u.kind === "AI" ? "border-accent/40 text-accent" : "border-border text-text-3"}`}>{u.kind}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between font-data text-[10px]">
        <span className="text-text-3 truncate">{u.detail}</span>
        <span className={u.running ? "text-pos" : "text-text-3"}>{u.running ? "가동" : "정지"}</span>
      </div>
    </Link>
  );
}

export default function HudPage() {
  const [f, setF] = useState<Feed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null });
  const [bal, setBal] = useState<AccountBalances | null>(null);
  const [clock, setClock] = useState("--:--:--");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const c = new AbortController();
      abortRef.current = c;
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge] = await Promise.all([
        getLabState(c.signal).catch(() => null),
        getJarvisStatus(c.signal).catch(() => null),
        getAutoResearch(c.signal).catch(() => null),
        getBuybackBot(c.signal).catch(() => null),
        listAgents(c.signal).catch(() => null),
        getLabStatus(c.signal).catch(() => null),
        getExecutionConsole(c.signal).catch(() => null),
        getExecutionEdge(c.signal).catch(() => null),  // read_only 캐시 — 서버 계산 없음
      ]);
      if (mounted && !c.signal.aborted) setF({ lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge });
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  // 계좌 잔액은 KIS/IB 등 외부 브로커 API를 직접 호출해 5~30초씩 걸릴 수 있음 —
  // 4초 주기 메인 피드 루프에 섞으면 abort-then-check 경합으로 상태 갱신 자체가 막힘.
  // 별도의 느린 주기로 독립 폴링.
  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    async function loadBal() {
      if (inFlight) return;
      inFlight = true;
      try {
        const b = await getAccountBalances();
        if (mounted) setBal(b);
      } catch { /* 이전 값 유지 */ }
      finally { inFlight = false; }
    }
    loadBal();
    const iv = setInterval(loadBal, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(t);
  }, []);

  const { lab, jarvis, ar, bot, agents, sys, exec, edge } = f;
  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);

  // 돈길 상태 — 시스템의 №1 신호
  const arm = exec?.arm_decision ?? null;
  const paperMo = exec?.arm_gate?.paper_months ?? 0;
  const paperMin = exec?.arm_gate?.min_paper_months ?? 6;
  const edgeLabel = edge?.status === "confirmed" ? "생존 확인" : edge?.status === "drifting" ? "이탈 경고"
    : edge?.status === "accumulating" ? "누적 중" : edge?.status === "no_oos_yet" ? "OOS 대기" : "워밍 중";
  const edgeTone = edge?.status === "confirmed" ? "text-pos" : edge?.status === "drifting" ? "text-neg"
    : edge?.status === "accumulating" ? "text-accent" : "text-info";

  // 전 유닛 로스터 — 트레이딩 AI + 시스템 봇
  const units: Unit[] = [];
  (agents ?? []).forEach(a => units.push({
    kind: "AI", name: a.name, running: a.status === "running",
    detail: `${a.market} · ${a.paper ? "페이퍼" : "라이브"} · Lv${displayLevel(a)}`,
    href: "/overview",
  }));
  units.push({ kind: "BOT", name: "AI LAB 엔진", running: active, detail: `stage ${lab?.stage ?? "—"}`, href: "/lab" });
  units.push({ kind: "BOT", name: "Auto-Research", running: busy, detail: `검증 ${ar?.n_tested ?? 0} · 후보 ${ar?.n_candidates ?? 0}`, href: "/auto-research" });
  units.push({ kind: "BOT", name: "Buyback 봇", running: (bot?.open ?? 0) > 0, detail: `보유 ${bot?.open ?? 0}`, href: "/lab/tasks" });
  if (sys?.dart_bot) units.push({ kind: "BOT", name: "DART 자동매매", running: !!sys.dart_bot.running, detail: sys.dart_bot.enabled ? "enabled" : "off", href: "/dart-auto" });
  if (sys?.research_service) units.push({ kind: "BOT", name: "리서치 서비스", running: !!sys.research_service.running, detail: `${sys.research_service.ticks ?? 0} tick`, href: "/lab" });

  const nRunning = units.filter(u => u.running).length;
  const allUp = units.length > 0 && nRunning === units.length;
  const wd = sys?.research_service?.watchdog;

  return (
    <div className="min-h-screen p-4 sm:p-6">
      {/* 상단 상태 스트립 */}
      <Panel className="mb-4">
        <PanelHeader right={<span className="tabular-nums tracking-widest">{clock}</span>}>
          시스템 상태
        </PanelHeader>
        <div className="flex items-center gap-3 px-3 py-2">
          <StatusDot tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "PROCESSING" : active ? "ONLINE" : "STANDBY"} />
          {arm && (
            <Link href="/lab/execution"
              className={`no-underline text-[11px] px-2 py-0.5 border font-data tracking-wider ${
                arm.decision === "GO" ? "border-pos/50 text-pos bg-pos/10" :
                arm.decision === "KILL" ? "border-neg/50 text-neg bg-neg/10 animate-blink" :
                "border-info/40 text-info bg-info/10"}`}>
              ARM {arm.decision}
            </Link>
          )}
          {wd?.critical && (
            <span className="text-[9px] px-1.5 py-0.5 border border-neg/50 text-neg bg-neg/10 animate-blink font-data">감시견 경보</span>
          )}
        </div>
      </Panel>

      {/* 유닛 로스터 — 메인. 뭐가 돌고 있는지 한 눈에 */}
      <Panel className="mb-4">
        <PanelHeader right={<span className="tabular-nums">{nRunning}/{units.length} 가동</span>}>
          유닛 로스터
        </PanelHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {units.map((u, i) => <UnitCard key={`${u.name}-${i}`} u={u} />)}
        </div>
      </Panel>

      {/* 계좌 + 돈길 핵심 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {bal ? <Balances bal={bal} /> : (
          <div className="bg-panel border border-border p-3 text-text-3 text-[11px]">계좌 정보 로딩 중…</div>
        )}
        <Panel>
          <PanelHeader right={<Link href="/lab/execution" className="text-black no-underline uppercase tracking-wider hover:underline">집행 콘솔 →</Link>}>
            돈길
          </PanelHeader>
          <div className="grid grid-cols-3 gap-2 text-center p-3">
            <div className="bg-panel-2/40 p-2">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-1">엣지</p>
              <p className={`font-data text-xs ${edgeTone}`}>{edgeLabel}</p>
            </div>
            <div className="bg-panel-2/40 p-2">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-1">페이퍼 기간</p>
              <p className={`font-data text-xs ${paperMo >= paperMin ? "text-pos" : "text-info"}`}>{paperMo}/{paperMin}mo</p>
            </div>
            <div className="bg-panel-2/40 p-2">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-1">Live 집행</p>
              <p className={`font-data text-xs ${jarvis?.live_execution === "blocked" ? "text-neg" : "text-pos"}`}>
                {jarvis?.live_execution ?? "—"}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 빌드**

Run: `npm run build`
Expected: `/hud` 라우트 정상 생성.

- [ ] **Step 4: 육안 확인**

Run: `npm run dev` → `http://localhost:3000/hud` 접속 → 오렌지 헤더바 3개("시스템 상태"/"유닛 로스터"/"돈길") 검정 굵은 대문자, 모서리 각짐, 배경 그리드/스캔라인/글로우 없음, ARM=KILL이거나 감시독 경보일 때만 `animate-blink` 점멸 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/hud/page.tsx
git commit -m "refactor: /hud Jarvis 모션 제거 + Panel/PanelHeader로 전환"
```

---

### Task 8: 최종 검증

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 2: 전체 테스트**

Run: `npm test`
Expected: 기존 스위트 회귀 없음 (Task A 종료 시점 기준 151/151 유지).

- [ ] **Step 3: 전체 빌드**

Run: `npm run build`
Expected: 43개 라우트 전부 정상 생성.

- [ ] **Step 4: 브라우저 육안 확인 — Phase 2 대상 페이지 회귀 없는지 샘플 점검**

`npm run dev` 후 다음 페이지들을 열어 배경/모서리/보더 색만 바뀌고 레이아웃이 깨지지 않았는지, Jarvis 모션(펄스/스캔라인/레이더)이 `/lab`, `/lab/execution`, `/agents`, `/overview`, `/buyback-doctor`에서는 **그대로 남아있는지**(Phase 1이 이들을 건드리지 않았음을 확인) 확인:
- `/backtest` (모서리 각짐만 상속됐는지)
- `/universe` (모서리 각짐만 상속됐는지)
- `/lab` (Jarvis 모션 그대로인지 — 회귀 아님을 확인)
- `/agents` (Jarvis 모션 그대로인지 — 회귀 아님을 확인)
- `/market` → "주식" 탭에서 "Compare" 탭 클릭 → `ComparisonTab`의 "Normalized Return (%)" 패널이 오렌지 헤더바로 보이는지 확인

- [ ] **Step 5: 최종 커밋 (필요 시)**

검증 단계에서 수정이 발생했을 경우에만:

```bash
git add -A
git commit -m "fix: Phase 1 최종 검증 중 발견된 수정"
```

---

## Phase 2 (본 플랜 범위 밖)

나머지 41페이지의 `<Panel>`/`<PanelHeader>` 전환은 별도 세션에서 별도 plan으로 진행. 우선순위는 스펙에 명시된 대로 다음 세션에 재논의(집행→AI에이전트→리서치→검증→마켓→교육 순 아이디어는 미확정).
