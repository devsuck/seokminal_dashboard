# Autopilot 라이트 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CommandRail(전 라우트 공유 좌측 나브) + `/hud`(5탭) + `/agents`를 다크 Bloomberg 톤에서 라이트 카드형(Autopilot 스타일)으로 전환한다.

**Architecture:** `app/globals.css`의 `@theme` 블록에 신규 `ap-` 접두 토큰 세트를 additive로 추가(기존 `--color-*` 무수정). 신규 `Card`/`CardHeader` 프리미티브를 `Panel`/`PanelHeader`와 병렬로 작성. CommandRail은 기존 `.console-shell`이 정의하는 스코프드 CSS 커스텀 프로퍼티(`--c-*`) 패턴을 그대로 재사용해 `<nav>`에 로컬 오버라이드 클래스 하나만 추가(JSX 구조·로직 무변경). `/hud`의 홈 탭 + 4개 하위 탭 컴포넌트, `/agents`는 `Panel`→`Card` 태그 치환 + 결정론적 토큰명 매핑 규칙을 그대로 적용한다.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4 (`@theme` 기반 토큰→유틸리티 자동 생성), TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-22-autopilot-light-redesign-design.md`

## Global Constraints

- 기존 `--color-bg/panel/panel-2/border/text-1/2/3/accent/pos/neg/warn/info` 토큰은 절대 수정 금지 — 13개 미전환 라우트가 의존.
- `components/ui/Panel.tsx`(`Panel`/`PanelHeader`)는 무수정 — 13개 미전환 라우트가 계속 사용.
- `style={{}}` 금지 (예외: 차트 컨테이너 `style={{ height: "Npx" }}` — 이번 스코프엔 해당 파일 없음).
- Raw `fetch` 금지 — `lib/api.ts`/`lib/console-api.ts` 함수만 사용(이번 작업은 비주얼 전용이라 API 호출부는 건드리지 않음).
- 각 태스크 완료 시 `npx tsc --noEmit` 통과 필수(exit 0, 에러 0).
- 마지막 태스크(Task 9) 완료 후 `npm run build` 1회 필수 통과 — 53개+ 라우트 전부 빌드 성공, 미전환 13개 라우트 렌더링 회귀 없음.
- 커밋 메시지 `Co-Authored-By`에 모델명/컨텍스트모드 정보 금지. 브랜치: `main` 직접 커밋.

### 토큰명 매핑 규칙 (Task 4~9 공통, 정확히 이 표만 적용)

파일 내 모든 `{bg,text,border}-{OLD}` 또는 `{bg,text,border}-{OLD}/{opacity}` 형태의 Tailwind 클래스에서, 접두사(`bg-`/`text-`/`border-`)와 `/opacity` 접미사는 그대로 두고 `{OLD}` 이름만 아래 표대로 치환한다. 표에 없는 이름(레이아웃/간격/폰트 등 비색상 클래스, `chart-*`, `seq-*`, `hud` 등)은 손대지 않는다.

| OLD (다크) | NEW (라이트, `ap-`) |
|---|---|
| `panel` | `ap-surface` |
| `panel-2` | `ap-bg` |
| `border` | `ap-line` |
| `text-1` | `ap-ink-1` |
| `text-2` | `ap-ink-2` |
| `text-3` | `ap-ink-3` |
| `accent` | `ap-brand` |
| `pos` | `ap-up` |
| `neg` | `ap-down` |
| `warn` | `ap-caution` |
| `info` | `ap-note` |

예: `text-text-3` → `text-ap-ink-3`, `bg-neg/20` → `bg-ap-down/20`, `border-accent/40` → `border-ap-brand/40`, `bg-text-3` → `bg-ap-ink-3`.

### Panel→Card 치환 규칙 (Task 4~9 공통)

- import 문에서 `import { Panel, PanelHeader } from "@/components/ui/Panel";` → `import { Card, CardHeader } from "@/components/ui/Card";`로 교체.
- 파일 내 모든 `<Panel`/`</Panel>` → `<Card`/`</Card>`, `<PanelHeader`/`</PanelHeader>` → `<CardHeader`/`</CardHeader>`로 태그명만 교체. props(`children`, `className`, `right`)는 그대로 — `Card`/`CardHeader`는 `Panel`/`PanelHeader`와 동일 시그니처(Task 2 참고).
- Panel/PanelHeader 외 JSX 구조, 컴포넌트 로직, 데이터 페칭, non-color 클래스는 변경하지 않는다.

---

### Task 1: globals.css에 `ap-` 토큰 추가

**Files:**
- Modify: `app/globals.css:63-64`

**Interfaces:**
- Produces: Tailwind 유틸리티 `bg-ap-bg`, `bg-ap-surface`, `border-ap-line`, `text-ap-ink-1/2/3`, `bg-ap-brand`/`text-ap-brand`/`border-ap-brand`, `bg-ap-up/down/caution/note`(+ `text-`/`border-` 변형), `rounded-ap-sm/md/lg/xl`, `shadow-ap-sm/md`. 이후 모든 태스크가 이 유틸리티를 사용.

- [ ] **Step 1: `@theme` 블록 끝(63번째 줄 `--animate-blink` 다음, 64번째 줄 `}` 앞)에 신규 토큰 블록 삽입**

`app/globals.css`의 63번째 줄(`  --animate-blink:      blink 1.2s steps(1) infinite;`) 바로 다음, 64번째 줄(`}`) 바로 앞에 아래를 삽입:

```css

  /* ── Autopilot 라이트 토큰 (ap-) ── additive, 위 다크 토큰과 별개 네임스페이스.
     CommandRail + /hud + /agents 전용. 13개 미전환 라우트는 위 다크 토큰만 계속 사용. */
  --color-ap-bg:       #FAFAFB;
  --color-ap-surface:  #FFFFFF;
  --color-ap-line:     #E5E7EB;
  --color-ap-ink-1:    #111827;
  --color-ap-ink-2:    #6B7280;
  --color-ap-ink-3:    #9CA3AF;
  --color-ap-brand:    #FF9F0A;
  --color-ap-up:       #059669;
  --color-ap-down:     #DC2626;
  --color-ap-caution:  #D97706;
  --color-ap-note:     #2563EB;

  --radius-ap-sm: 8px;
  --radius-ap-md: 12px;
  --radius-ap-lg: 16px;
  --radius-ap-xl: 20px;

  --shadow-ap-sm: 0 1px 3px rgba(0,0,0,.06);
  --shadow-ap-md: 0 4px 12px rgba(0,0,0,.08);
```

- [ ] **Step 2: 타입체크로 문법 오류 여부 확인**

Run: `npx tsc --noEmit`
Expected: exit 0 (CSS 파싱 오류는 tsc가 안 잡으므로, 이어서 `npm run dev`를 잠깐 띄워 콘솔에 CSS 파싱 에러가 없는지 확인 — 이미 떠 있으면 재사용).

- [ ] **Step 3: 유틸리티 생성 확인**

Run: `grep -c "ap-surface\|ap-ink-1\|ap-brand" .next/static/css/*.css 2>/dev/null || (npm run build >/tmp/ap-build.log 2>&1; grep -c "ap-surface" .next/static/css/*.css)`
Expected: 0보다 큰 카운트 — 새 유틸리티 클래스가 실제 생성된 CSS에 존재.

- [ ] **Step 4: 커밋**

```bash
git add app/globals.css
git commit -m "feat: Autopilot 라이트 토큰(ap-) 추가"
```

---

### Task 2: `Card`/`CardHeader` 프리미티브 신규 작성

**Files:**
- Create: `components/ui/Card.tsx`

**Interfaces:**
- Consumes: Task 1의 `ap-` 유틸리티 클래스.
- Produces: `Card({ children: ReactNode; className?: string })`, `CardHeader({ children: ReactNode; right?: ReactNode })` — `components/ui/Panel.tsx`의 `Panel`/`PanelHeader`와 동일 시그니처. Task 4~9가 import.

- [ ] **Step 1: `components/ui/Card.tsx` 작성**

```tsx
import type { ReactNode } from "react";

export function CardHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-ap-surface border-b border-ap-line px-3 py-2">
      <span className="text-ap-ink-1 text-[13px] font-semibold">{children}</span>
      {right && <span className="text-ap-ink-2 text-[11px] font-data">{right}</span>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: 커밋**

```bash
git add components/ui/Card.tsx
git commit -m "feat: Card/CardHeader 라이트 프리미티브 추가"
```

---

### Task 3: CommandRail + ShutdownButton 라이트 전환

**Files:**
- Modify: `components/console/CommandRail.tsx:182` (className에 `rail-ap` 추가 1곳만)
- Modify: `app/globals.css` (Task 1에서 추가한 블록 뒤에 스코프드 오버라이드 추가)
- Modify: `components/ShutdownButton.tsx` (토큰명 매핑 규칙 적용)

**Interfaces:**
- Consumes: Task 1의 `--color-ap-*` 토큰, Global Constraints의 토큰명 매핑 규칙.
- Produces: 없음(리프 태스크) — `/hud`, `/agents` 등 다른 라우트에 영향 없음.

CommandRail은 `var(--c-hud)`, `var(--c-text-1/2/3)`, `var(--c-border)`, `var(--c-panel)`, `var(--c-panel-2)`, `var(--c-warn)`라는 CSS 커스텀 프로퍼티를 인라인 arbitrary-value로 참조한다(`text-[var(--c-hud)]` 등). 이 변수들은 `app/globals.css`의 `.console-shell` 클래스(루트 레이아웃 최상위 div, `app/layout.tsx:28`)가 전역 정의한다. `CommandRail`이 렌더하는 `CommandPalette`도 동일하게 `--c-*`만 참조한다 — 둘 다 JSX 무변경으로 아래 스코프드 오버라이드만으로 라이트 전환된다. `ShutdownButton`은 `--c-*`가 아니라 일반 Tailwind 다크 토큰 클래스(`bg-panel`, `text-text-1` 등)를 직접 쓰므로 별도로 토큰명 매핑이 필요하다.

- [ ] **Step 1: `app/globals.css`에 `.rail-ap` 스코프드 오버라이드 추가**

Task 1에서 삽입한 블록(`--shadow-ap-md` 줄) 바로 다음, `@theme` 블록을 닫는 `}` 앞이 아니라 `}` **다음**(즉 `@theme` 블록 바깥, 파일의 다른 최상위 CSS 규칙들과 같은 레벨)에 아래를 추가:

```css

/* CommandRail 라이트 전환 — .console-shell이 정의한 --c-* 를 이 서브트리에서만
   ap- 값으로 로컬 오버라이드. CommandRail/CommandPalette의 JSX·로직은 무변경. */
.rail-ap {
  --c-bg:      var(--color-ap-bg);
  --c-panel:   var(--color-ap-surface);
  --c-panel-2: var(--color-ap-bg);
  --c-border:  var(--color-ap-line);
  --c-text-1:  var(--color-ap-ink-1);
  --c-text-2:  var(--color-ap-ink-2);
  --c-text-3:  var(--color-ap-ink-3);
  --c-hud:     var(--color-ap-brand);
  --c-warn:    var(--color-ap-caution);
}
```

- [ ] **Step 2: `CommandRail.tsx`의 `<nav>`에 `rail-ap` 클래스 추가**

`components/console/CommandRail.tsx:182`, 현재:

```tsx
    <nav className={`console-rail relative flex flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
```

다음으로 교체(맨 앞에 `rail-ap` 추가):

```tsx
    <nav className={`rail-ap console-rail relative flex flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
```

- [ ] **Step 3: `ShutdownButton.tsx`에 토큰명 매핑 규칙 적용**

`components/ShutdownButton.tsx` 전체를 Read한 뒤, Global Constraints의 "토큰명 매핑 규칙" 표를 파일 내 모든 `bg-panel`, `text-text-1`, `text-text-2`, `text-text-3`, `border-border`, `text-accent`, `border-accent`, `text-pos`, `bg-pos`, `text-neg`(+ `/opacity` 변형 포함 `text-neg/60`, `text-neg/70`, `bg-neg/10`, `bg-neg/8`, `border-neg/30`, `border-neg/50`) 클래스에 그대로 적용 — 접두사/opacity 유지, 색상명만 매핑 표대로 치환. 비색상 클래스·로직·JSX 구조는 무변경.

- [ ] **Step 4: 개발 서버에서 육안 확인**

`components/console/CommandRail.tsx`, `components/ShutdownButton.tsx`가 아직 dev 서버에 반영 안 됐으면 `bash scripts/restart_api.sh`는 백엔드용이므로 무관 — 프론트는 `npm run dev`가 떠 있으면 HMR로 자동 반영. `/hud` 접속해 좌측 레일이 흰 배경 + 회색 보더 + 다크 텍스트로 바뀌었는지, 접기/펼치기·검색·"전체보기" 토글·Shutdown 버튼이 여전히 동작하는지 확인.

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: 커밋**

```bash
git add app/globals.css components/console/CommandRail.tsx components/ShutdownButton.tsx
git commit -m "feat: CommandRail 라이트 전환 (rail-ap 스코프드 오버라이드)"
```

---

### Task 4: `/hud` 홈 탭 (`app/hud/page.tsx`) 라이트 전환

**Files:**
- Modify: `app/hud/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 토큰명 매핑 규칙 + Panel→Card 치환 규칙.
- Produces: 없음(리프 태스크).

**주의:** 이 파일은 `PortfolioTab`/`LabTab`/`ExecutionTab`/`TasksTab`을 import해서 탭으로 렌더하지만(Task 5~8에서 별도 전환), 이 파일 자체가 소유한 JSX(HOME 탭 콘텐츠, 상단 탭바)만 이 태스크의 대상이다. import문·라우팅 로직(`TabKey`, `TABS`, `setTab` 등)은 무변경.

- [ ] **Step 1: `app/hud/page.tsx` 전체를 Read**

- [ ] **Step 2: import문에서 Panel→Card 치환**

`import { Panel, PanelHeader } from "@/components/ui/Panel";` → `import { Card, CardHeader } from "@/components/ui/Card";`

- [ ] **Step 3: 파일 내 모든 `<Panel>`/`<PanelHeader>` 사용처를 `<Card>`/`<CardHeader>`로 치환**

Panel→Card 치환 규칙(Global Constraints) 그대로. 이 파일엔 36곳의 Panel/PanelHeader 참조가 있다(`grep -c "Panel\b\|PanelHeader" app/hud/page.tsx`로 사전 확인됨) — 전수 치환.

- [ ] **Step 4: 파일 내 모든 색상 토큰 클래스에 토큰명 매핑 규칙 적용**

이 파일에서 실측된 대상 클래스(전수, 아래 목록 기준으로 빠짐없이): `text-text-3`, `text-neg`, `border-border`, `text-pos`, `text-warn`, `text-text-2`, `text-accent`, `text-text-1`, `border-neg/50`, `bg-neg/15`, `text-info`, `bg-pos/20`, `bg-pos`, `bg-neg/10`, `bg-neg`, `bg-accent`, `border-pos/50`, `border-info/40`, `border-accent/40`, `border-accent`, `bg-warn/5`, `bg-warn`, `bg-text-3`, `bg-pos/5`, `bg-pos/15`, `bg-panel-2`, `bg-panel`, `bg-neg/25`, `bg-neg/20`, `bg-info/15`, `bg-info`, `bg-border`, `bg-accent/10`.

`bg-border`는 매핑 표에 직접 없지만 규칙상 `border`→`ap-line`이므로 `bg-border`→`bg-ap-line`(도트/디바이더를 border색으로 채우는 용도). 나머지는 매핑 표 그대로 적용.

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: 개발 서버에서 `/hud` HOME 탭 육안 확인**

카드 배경 흰색, 페이지 배경 오프화이트, 텍스트 다크, 손익 색상(초록/빨강)이 라이트 배경에서도 잘 보이는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add app/hud/page.tsx
git commit -m "feat: /hud HOME 탭 라이트 전환"
```

---

### Task 5: `components/hud/PortfolioTab.tsx` 라이트 전환

**Files:**
- Modify: `components/hud/PortfolioTab.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 매핑/치환 규칙.
- Produces: 없음.

- [ ] **Step 1: 전체 Read**
- [ ] **Step 2: import Panel→Card 치환** (Task 4 Step 2와 동일 규칙)
- [ ] **Step 3: 모든 `<Panel>`/`<PanelHeader>` → `<Card>`/`<CardHeader>` 치환**
- [ ] **Step 4: 실측 대상 클래스 전수 매핑**: `text-text-3`, `text-neg`, `text-pos`, `border-border`, `bg-pos/20`, `bg-neg/20`, `text-text-1`, `text-accent`, `bg-panel`, `text-text-2`, `text-info`, `border-info/40`, `text-warn`, `border-warn/40`, `border-pos/50`, `border-neg/50`, `border-neg/30`, `border-accent/30`, `border-accent/25`, `bg-warn/70`, `bg-warn/10`, `bg-pos/70`, `bg-pos/10`, `bg-panel-2`, `bg-neg/60`, `bg-neg/10`, `bg-info/70`, `bg-info/10`, `bg-accent/70`, `bg-accent/5`, `bg-accent/10`.
- [ ] **Step 5: 타입체크** — Run: `npx tsc --noEmit`, Expected: exit 0
- [ ] **Step 6: 개발 서버에서 `/hud?tab=portfolio` 육안 확인**
- [ ] **Step 7: 커밋**

```bash
git add components/hud/PortfolioTab.tsx
git commit -m "feat: hud PortfolioTab 라이트 전환"
```

---

### Task 6: `components/hud/LabTab.tsx` 라이트 전환

**Files:**
- Modify: `components/hud/LabTab.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 매핑/치환 규칙.
- Produces: 없음.

- [ ] **Step 1: 전체 Read**
- [ ] **Step 2: import Panel→Card 치환**
- [ ] **Step 3: 모든 `<Panel>`/`<PanelHeader>` → `<Card>`/`<CardHeader>` 치환**
- [ ] **Step 4: 실측 대상 클래스 전수 매핑**: `text-text-3`, `text-pos`, `text-text-2`, `text-neg`, `border-border`, `text-warn`, `text-accent`, `text-text-1`, `text-info`, `bg-panel-2`, `border-info/40`, `border-accent/40`, `bg-pos/20`, `bg-panel`, `bg-neg/20`, `bg-info/10`, `border-warn/40`, `border-pos/40`, `bg-pos/10`, `bg-accent/5`, `bg-accent/10`, `border-pos/50`, `border-neg/30`, `bg-neg/5`, `bg-accent`, `border-text-3/30`, `border-pos/30`, `border-neg/40`, `border-accent`, `bg-warn/5`, `bg-warn/10`, `bg-pos/5`.
- [ ] **Step 5: 타입체크** — Run: `npx tsc --noEmit`, Expected: exit 0
- [ ] **Step 6: 개발 서버에서 `/hud?tab=lab` 육안 확인**
- [ ] **Step 7: 커밋**

```bash
git add components/hud/LabTab.tsx
git commit -m "feat: hud LabTab 라이트 전환"
```

---

### Task 7: `components/hud/ExecutionTab.tsx` 라이트 전환

**Files:**
- Modify: `components/hud/ExecutionTab.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 매핑/치환 규칙.
- Produces: 없음.

- [ ] **Step 1: 전체 Read**
- [ ] **Step 2: import Panel→Card 치환**
- [ ] **Step 3: 모든 `<Panel>`/`<PanelHeader>` → `<Card>`/`<CardHeader>` 치환**
- [ ] **Step 4: 실측 대상 클래스 전수 매핑**: `text-neg`, `text-text-3`, `text-pos`, `text-text-1`, `text-warn`, `border-neg/40`, `border-pos/50`, `border-pos/40`, `border-border`, `bg-pos/5`, `bg-pos/10`, `bg-neg/5`, `bg-neg/20`, `bg-neg/10`, `text-text-2`, `text-info`, `border-warn/30`, `border-warn/20`, `border-neg/50`, `border-neg/30`, `border-border/50`, `bg-warn/5`, `bg-pos/20`, `bg-panel-2`, `bg-panel`.
- [ ] **Step 5: 타입체크** — Run: `npx tsc --noEmit`, Expected: exit 0
- [ ] **Step 6: 개발 서버에서 `/hud?tab=execution` 육안 확인**
- [ ] **Step 7: 커밋**

```bash
git add components/hud/ExecutionTab.tsx
git commit -m "feat: hud ExecutionTab 라이트 전환"
```

---

### Task 8: `components/hud/TasksTab.tsx` 라이트 전환

**Files:**
- Modify: `components/hud/TasksTab.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 매핑/치환 규칙.
- Produces: 없음.

- [ ] **Step 1: 전체 Read**
- [ ] **Step 2: import Panel→Card 치환**
- [ ] **Step 3: 모든 `<Panel>`/`<PanelHeader>` → `<Card>`/`<CardHeader>` 치환**
- [ ] **Step 4: 실측 대상 클래스 전수 매핑**: `text-text-3`, `text-pos`, `text-text-1`, `border-border`, `text-text-2`, `text-neg`, `bg-pos/20`, `bg-neg/20`, `text-warn`, `bg-panel-2`, `text-info`, `text-accent`, `border-pos/40`, `border-accent/40`, `bg-pos/60`, `bg-pos/10`, `bg-neg/60`, `bg-accent/10`, `border-pos/25`, `border-neg/30`, `border-info/40`, `border-info/25`, `bg-warn/20`, `bg-pos/5`, `bg-panel`, `bg-info/5`, `bg-info/10`.
- [ ] **Step 5: 타입체크** — Run: `npx tsc --noEmit`, Expected: exit 0
- [ ] **Step 6: 개발 서버에서 `/hud?tab=tasks` 육안 확인**
- [ ] **Step 7: 커밋**

```bash
git add components/hud/TasksTab.tsx
git commit -m "feat: hud TasksTab 라이트 전환"
```

---

### Task 9: `app/agents/page.tsx` 라이트 전환

**Files:**
- Modify: `app/agents/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `Card`/`CardHeader`, Global Constraints의 매핑/치환 규칙.
- Produces: 없음. 이 태스크가 스코프의 마지막 태스크 — 완료 후 전체 빌드 검증.

- [ ] **Step 1: 전체 Read**
- [ ] **Step 2: import Panel→Card 치환**
- [ ] **Step 3: 모든 `<Panel>`/`<PanelHeader>` → `<Card>`/`<CardHeader>` 치환**
- [ ] **Step 4: 실측 대상 클래스 전수 매핑**: `text-text-3`, `text-text-2`, `text-neg`, `border-border`, `text-pos`, `text-text-1`, `bg-panel-2`, `bg-panel`, `border-accent`, `bg-pos/20`, `bg-neg/20`, `text-accent`, `border-neg/40`, `bg-neg/15`, `bg-accent/10`, `text-warn`, `border-pos/40`, `bg-warn/10`, `bg-pos/10`, `bg-pos`, `border-warn/40`, `border-text-3`, `bg-text-3`, `bg-pos/15`, `bg-neg/10`, `bg-neg`, `text-text-3/60`, `text-text-3/40`, `border-warn/30`, `border-pos/30`, `border-pos`, `border-neg/30`, `border-neg`, `border-border/50`, `border-border/40`, `border-accent/50`, `border-accent/40`, `bg-accent`.
- [ ] **Step 5: 타입체크** — Run: `npx tsc --noEmit`, Expected: exit 0
- [ ] **Step 6: 개발 서버에서 `/agents` 육안 확인**
- [ ] **Step 7: 커밋**

```bash
git add app/agents/page.tsx
git commit -m "feat: agents 페이지 라이트 전환"
```

- [ ] **Step 8: 전체 빌드 검증 (스코프 전체 완료 후 1회)**

Run: `npm run build`
Expected: 성공, 53개+ 라우트 전부 빌드. 미전환 13개 라우트(`portfolio`, `polymarket`, `copytrade`, `infra`, `orderflow`, `mlb`, `performance`, `vrp`, `dart-auto`, `risk-guard`, `quant/validation`, `research-os/*`, `investment-os`)는 여전히 다크 톤으로 정상 렌더링되는지 개발 서버에서 샘플 2~3개 라우트 육안 확인(레일만 라이트, 본문은 다크인 의도된 전환기 불일치 — 스펙에 명시된 대로).
