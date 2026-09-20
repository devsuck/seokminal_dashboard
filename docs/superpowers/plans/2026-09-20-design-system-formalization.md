# 디자인 시스템 정식화 (버튼/타이포) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ApButton` 프리미티브(4 variant × 2 size + loading) + 타이포 스케일 토큰(7단계) 신설, 대상 8개 라이트 페이지의 손코딩 버튼/매직넘버 폰트크기를 여기로 교체.

**Architecture:** 순수 스타일 리팩터. 새 로직 없음 — `components/ui/ApPrimitives.tsx`에 컴포넌트 추가, `app/globals.css` `@theme`에 토큰 추가, 그 다음 대상 파일들의 `className` 문자열만 치환.

**Tech Stack:** Next.js, Tailwind v4 (`@theme` 자동 유틸리티 생성), React.

**Spec:** `docs/superpowers/specs/2026-09-20-design-system-formalization-design.md` (커밋 `04584fb`)

## Global Constraints

- **버튼 variant 4종:** primary(`bg-ap-brand text-white`) / secondary(`bg-ap-bg text-ap-ink-1`) / danger(`border border-ap-down/30 text-ap-down/70 hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 bg-transparent`) / ghost(`bg-transparent text-ap-ink-2`).
- **사이즈 2종:** sm(`h-9 text-ap-label px-3`) / md(`h-11 text-ap-title px-4`). lg 없음 (YAGNI).
- **타이포 토큰 7단계:** 9px=`ap-micro`, 10px=`ap-caption`, 11px=`ap-body`, 12px=`ap-label`, 13px=`ap-title`, 16px=`ap-stat`, 26px=`ap-hero`. 단독 14px(`live-agents:276`)은 `ap-title`(13px)로 흡수.
- **데스크톱 콘솔은 다크 유지 — 이번 스코프 밖.** `app/(console)/investment-os/page.tsx`, `research-os/chat`, `research-os/governance`, `research-os/validation` 4개 파일은 내부에 `hidden md:block`(데스크톱, 다크 `var(--c-*)`)과 `md:hidden`(모바일, 라이트 `ap-*`) 이중 분기가 있음. **버튼/매직넘버 치환은 `md:hidden` 블록 안(또는 분기 없는 코드)에만 적용한다. `hidden md:block` 블록 안은 절대 건들지 않는다.** 분기 없는 파일(`app/hud/page.tsx`, `app/performance/page.tsx`, `components/hud/*Tab.tsx`)과 데스크톱/모바일 둘 다 라이트인 `app/portfolio/page.tsx`는 파일 전체가 스코프.
- **버튼 변환 판단 기준:** 탭 선택자(`key={t.key} onClick={() => setTab(t.key)}` 류), 세그먼트 필터 토글(활성/비활성 색만 바뀌는 상태 버튼), 리스트 행 전체를 감싸는 네비게이션 버튼, 칩/태그형 버튼(SUGGESTIONS 등)은 **변환 제외** — variant 4종에 억지로 끼워맞추면 className override가 원본보다 커짐. 제출/승인/거부/리셋처럼 단일 목적의 solid 또는 outline 액션 버튼만 변환.
- 검증은 항상: `npx tsc --noEmit` → `npm run build`. 순수 className 치환이라 별도 유닛테스트 불필요(레포 컨벤션: `npm test`는 로직 테스트라 무관, 그린 유지만 확인).
- 레포 컨벤션: main 직접 커밋, 브랜치 없음.

---

### Task 1: 타이포 토큰 + ApButton 프리미티브 추가

**Files:**
- Modify: `app/globals.css` (`@theme` 블록, 기존 `--color-ap-*`/`--radius-ap-*` 옆에 추가)
- Modify: `components/ui/ApPrimitives.tsx` (파일 끝에 추가)

**Interfaces:**
- Produces: `ApButton` (props: `variant?: "primary"|"secondary"|"danger"|"ghost"` 기본 `"primary"`, `size?: "sm"|"md"` 기본 `"sm"`, `loading?: boolean` 기본 `false`, 나머지는 `React.ButtonHTMLAttributes<HTMLButtonElement>`), `ApButtonVariant`, `ApButtonSize` 타입. Tailwind 유틸리티 `text-ap-micro/caption/body/label/title/stat/hero`.

- [ ] **Step 1: `app/globals.css`에 타이포 토큰 추가**

`--color-ap-*` 정의부 바로 아래에 추가:

```css
--text-ap-micro:   9px;
--text-ap-caption: 10px;
--text-ap-body:    11px;
--text-ap-label:   12px;
--text-ap-title:   13px;
--text-ap-stat:    16px;
--text-ap-hero:    26px;
```

- [ ] **Step 2: `components/ui/ApPrimitives.tsx` 파일 끝에 `ApButton` 추가**

```tsx
export type ApButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ApButtonSize = "sm" | "md";

const AP_BUTTON_VARIANT: Record<ApButtonVariant, string> = {
  primary:   "bg-ap-brand text-white",
  secondary: "bg-ap-bg text-ap-ink-1",
  danger:    "border border-ap-down/30 text-ap-down/70 hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 bg-transparent",
  ghost:     "bg-transparent text-ap-ink-2",
};

const AP_BUTTON_SIZE: Record<ApButtonSize, string> = {
  sm: "h-9 text-ap-label px-3",
  md: "h-11 text-ap-title px-4",
};

export function ApButton({
  variant = "primary",
  size = "sm",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: {
  variant?: ApButtonVariant;
  size?: ApButtonSize;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-ap-md font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${AP_BUTTON_VARIANT[variant]} ${AP_BUTTON_SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}
```

- [ ] **Step 3: 검증**

```bash
npx tsc --noEmit
npm run build
```
Expected: 둘 다 에러 없음. `ApButton` 아직 아무 데서도 안 쓰지만 export만 추가된 상태라 빌드는 그대로 통과해야 함.

- [ ] **Step 4: 커밋**

```bash
git add app/globals.css components/ui/ApPrimitives.tsx
git commit -m "feat: add ApButton primitive and typography scale tokens"
```

---

### Task 2: `live-agents.tsx` + `ShutdownButton.tsx` 버튼 교체

**Files:**
- Modify: `app/(console)/investment-os/live-agents/page.tsx:191-253`
- Modify: `components/ShutdownButton.tsx:115`

**Interfaces:**
- Consumes: `ApButton` from Task 1 (`components/ui/ApPrimitives.tsx`).

- [ ] **Step 1: `live-agents/page.tsx`의 6개 버튼 교체**

기존(라인 191-197):
```tsx
<button onClick={() => promote(c.agent_id)} disabled={busy === c.agent_id}
  className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
  {busy === c.agent_id ? "승급 중…" : "승인"}
</button>
<button className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer bg-ap-bg text-ap-ink-1">
  보류
</button>
```
교체 후:
```tsx
<ApButton onClick={() => promote(c.agent_id)} loading={busy === c.agent_id} className="flex-1">
  승인
</ApButton>
<ApButton variant="secondary" className="flex-1">
  보류
</ApButton>
```

기존(라인 228-240):
```tsx
<button onClick={() => claim(sid, c.suggested_amount ?? undefined)} disabled={busy === sid}
  className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
  예
</button>
<button onClick={() => claim(sid, 0)} disabled={busy === sid}
  className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-bg text-ap-ink-1">
  아니오
</button>
<button onClick={() => setManualMode((prev) => ({ ...prev, [sid]: true }))} disabled={busy === sid}
  className="flex-[1.3] h-9 rounded-ap-md text-[11px] font-medium border-0 cursor-pointer disabled:opacity-50 bg-transparent text-ap-ink-2">
  내가 마음대로 주기
</button>
```
교체 후:
```tsx
<ApButton onClick={() => claim(sid, c.suggested_amount ?? undefined)} loading={busy === sid} className="flex-1">
  예
</ApButton>
<ApButton variant="secondary" onClick={() => claim(sid, 0)} loading={busy === sid} className="flex-1">
  아니오
</ApButton>
<ApButton variant="ghost" onClick={() => setManualMode((prev) => ({ ...prev, [sid]: true }))} loading={busy === sid} className="flex-[1.3]">
  내가 마음대로 주기
</ApButton>
```

기존(라인 249-252):
```tsx
<button onClick={() => claim(sid, amounts[sid] ? Number(amounts[sid]) : undefined)} disabled={busy === sid}
  className="h-9 px-4 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
  {busy === sid ? "제출 중…" : "제출"}
</button>
```
교체 후:
```tsx
<ApButton onClick={() => claim(sid, amounts[sid] ? Number(amounts[sid]) : undefined)} loading={busy === sid}>
  제출
</ApButton>
```

파일 상단 import에 `ApButton` 추가 (기존 `ApPrimitives.tsx` import 구문에 이어붙임).

같은 파일 라인 276의 `text-[14px]`를 `text-ap-title`로 치환 (단일 케이스, Global Constraints 참고).

- [ ] **Step 2: `ShutdownButton.tsx` danger 버튼 교체**

기존(라인 115):
```tsx
className="w-full py-2 rounded border border-ap-down/30 text-ap-down/70 text-[11px] font-medium hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent"
```
이 `<button>`을 `<ApButton variant="danger" className="w-full py-2 text-ap-body font-medium">`로 교체 — 기존 `disabled`/`onClick` prop은 그대로 유지.

- [ ] **Step 3: 검증**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add "app/(console)/investment-os/live-agents/page.tsx" components/ShutdownButton.tsx
git commit -m "refactor: replace hand-rolled buttons with ApButton in live-agents and ShutdownButton"
```

---

### Task 3: 나머지 7개 파일 버튼 스윕 (모바일 브랜치만)

**Files:**
- Modify: `app/hud/page.tsx` (분기 없음, 전체 스코프)
- Modify: `app/portfolio/page.tsx` (분기 없음, 전체 스코프)
- Modify: `app/performance/page.tsx` (분기 없음, 전체 스코프)
- Modify: `app/(console)/investment-os/page.tsx` (모바일 브랜치만: `md:hidden` 시작 지점부터 파일 끝. 데스크톱 `hidden md:block` 블록은 건들지 않음)
- Modify: `app/(console)/research-os/chat/page.tsx` (모바일 브랜치만: `md:hidden` 시작 지점부터 파일 끝)
- Modify: `app/(console)/research-os/governance/page.tsx` (모바일 브랜치만 — 파일 안에 데스크톱/모바일 쌍이 여러 번 반복됨. 각 쌍에서 `hidden md:block`으로 감싸인 블록은 skip, `md:hidden`으로 감싸인 블록만 대상)
- Modify: `app/(console)/research-os/validation/page.tsx` (모바일 브랜치만, governance와 동일 패턴)
- (스캔 대상이나 버튼 없음 확인됨 — 수정 불필요: `components/hud/PortfolioTab.tsx`, `components/hud/ExecutionTab.tsx`, `components/hud/TasksTab.tsx`)

**Interfaces:**
- Consumes: `ApButton` from Task 1.

- [ ] **Step 1: 분기 없는 3개 파일 스캔**

```bash
grep -n "<button" app/hud/page.tsx app/portfolio/page.tsx app/performance/page.tsx
```

`app/hud/page.tsx`의 유일한 버튼은 `key={t.key} onClick={() => setTab(t.key)}` 탭 선택자 — 변환 제외, 수정 없음.

`app/performance/page.tsx`의 유일한 버튼은 `key={p} onClick={() => setPeriod(p)}` 기간 선택자 — 변환 제외, 수정 없음.

`app/portfolio/page.tsx` 6개 중 1개만 변환 대상:
```tsx
<button
  onClick={() => router.push(`/research-os/chat?q=${encodeURIComponent(selected.symbol)}`)}
  className="w-full h-11 rounded-ap-md text-sm font-semibold text-white bg-ap-brand mt-2"
>
  AI 판단 보러가기 →
</button>
```
교체 후:
```tsx
<ApButton size="md" className="w-full mt-2" onClick={() => router.push(`/research-os/chat?q=${encodeURIComponent(selected.symbol)}`)}>
  AI 판단 보러가기 →
</ApButton>
```
나머지 5개(스크롤 토글, 상태 필터 세그먼트, 주문 행 확장 토글 2곳, "더보기" 토글)는 탭/세그먼트/행-네비게이션 패턴이라 변환 제외.

- [ ] **Step 2: `investment-os/page.tsx` 모바일 브랜치 스캔**

```bash
grep -n "md:hidden" "app/(console)/investment-os/page.tsx" | head -1
grep -n "<button" "app/(console)/investment-os/page.tsx"
```
첫 줄 출력(모바일 브랜치 시작 라인) 이후에 나오는 `<button>`만 대상. 그 이전(데스크톱 블록)은 전부 skip.

알려진 대상 3개(모바일 브랜치 내):
```tsx
// 조회 버튼
<button type="submit" disabled={finLoading || !finQuery.trim()}
  className="bg-ap-brand text-white text-[13px] font-semibold px-4 py-2 rounded-ap-md disabled:opacity-50 shrink-0">
  {finLoading ? "조회 중…" : "조회"}
</button>
```
→ `<ApButton type="submit" disabled={!finQuery.trim()} loading={finLoading} className="shrink-0">조회</ApButton>`

approveAndAdvance 버튼과 "페이퍼로 리셋" 버튼(모바일 브랜치 쪽, `rounded-ap-md`/`ap-*` 토큰 사용하는 인스턴스)도 같은 방식으로 각각 `primary`(approveAndAdvance), `secondary`(페이퍼로 리셋, className `"px-3 h-11 rounded-ap-md text-xs uppercase text-ap-ink-3 border-ap-line"` → outline 톤이라 `variant="secondary"` + 필요하면 `border border-ap-line` 유지)로 교체.

탭 선택자 및 "상세 지표 보기" 네비게이션 버튼(`onClick={() => setShowDetail(true)}`, plain text row)은 변환 제외.

- [ ] **Step 3: `research-os/chat/page.tsx` 모바일 브랜치 스캔**

```bash
grep -n "md:hidden" "app/(console)/research-os/chat/page.tsx" | head -1
grep -n "<button" "app/(console)/research-os/chat/page.tsx"
```
모바일 브랜치 시작 라인 이후만 대상. 알려진 변환 대상:
```tsx
<button
  type="submit" disabled={loading || !q.trim()}
  className="flex items-center justify-center gap-2 w-full h-11 rounded-ap-md text-sm font-semibold text-white bg-ap-brand disabled:opacity-50 disabled:cursor-wait"
>
  {loading && <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
  {loading ? "생각 중…" : "질문"}
</button>
```
교체 후:
```tsx
<ApButton type="submit" size="md" className="w-full gap-2" disabled={!q.trim()} loading={loading}>
  질문
</ApButton>
```
(`loading` prop이 이미 `…`로 스피너 대체 텍스트를 보여주므로 커스텀 spinner span은 제거.)

SUGGESTIONS 칩 버튼과 "다음 액션 제안" 리스트 링크 버튼은 칩/링크 패턴이라 변환 제외.

- [ ] **Step 4: `research-os/governance/page.tsx`, `research-os/validation/page.tsx` 모바일 브랜치 스캔**

이 두 파일은 데스크톱/모바일 쌍이 파일 안에서 여러 번(각 3번) 반복됨:
```bash
grep -n "hidden md:block\|md:hidden\|<button" "app/(console)/research-os/governance/page.tsx"
grep -n "hidden md:block\|md:hidden\|<button" "app/(console)/research-os/validation/page.tsx"
```
출력을 라인 번호 순으로 읽어서, 각 `<button>`이 가장 가깝게 앞서 열린 `hidden md:block`과 `md:hidden` 중 어느 쪽 블록 안에 있는지 판단(그 사이에 대응하는 닫는 지점이 없다고 가정 — 각 블록은 해당 탭/섹션이 끝날 때까지 이어짐, 다음 `hidden md:block` 또는 `md:hidden`이 다시 나오기 전까지가 그 블록).

`hidden md:block` 안 → skip. `md:hidden` 안(또는 두 마커 밖의 공통 코드) → 아래 기준으로 변환 판단:
- 제출/승인/거부/리셋/필터-적용처럼 단일 목적 액션이고 solid(`bg-ap-brand` 등) 또는 outline(`border-ap-*` + 텍스트 색) 스타일 → 변환. solid면 `primary`, outline이면서 브랜드색이면 `secondary`, 위험/파괴적 액션이면 `danger`, 톤 없는 plain 텍스트면 `ghost`.
- 탭 선택자, 세그먼트 토글, 칩/태그, 리스트 행 전체를 감싸는 네비게이션 버튼 → skip.

이 두 파일은 판단이 갈릴 수 있는 버튼이 많으므로(각 14개, 5개), 변환한 각 버튼마다 원본 className과 새 `<ApButton variant=... size=...>` 매핑을 커밋 메시지 본문 또는 PR 설명에 한 줄씩 남길 것 — 리뷰어가 판단 기준 적용이 맞았는지 확인할 수 있게.

- [ ] **Step 5: 검증**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: 커밋**

```bash
git add app/hud/page.tsx app/portfolio/page.tsx app/performance/page.tsx "app/(console)/investment-os/page.tsx" "app/(console)/research-os/chat/page.tsx" "app/(console)/research-os/governance/page.tsx" "app/(console)/research-os/validation/page.tsx"
git commit -m "refactor: replace action buttons with ApButton across mobile-light pages"
```

---

### Task 4: 매직넘버 타이포 스윕 (모바일 브랜치만)

**Files:**
- Modify: 위 8개 대상 파일 + `components/ui/ApPrimitives.tsx` + `components/hud/PortfolioTab.tsx`, `ExecutionTab.tsx`, `TasksTab.tsx`

**Interfaces:**
- Consumes: `--text-ap-*` 토큰 유틸리티 from Task 1.

- [ ] **Step 1: 매핑대로 기계적 치환**

| 매직넘버 | 토큰 |
|---|---|
| `text-[9px]` | `text-ap-micro` |
| `text-[10px]` | `text-ap-caption` |
| `text-[11px]` | `text-ap-body` |
| `text-[12px]` | `text-ap-label` |
| `text-[13px]` | `text-ap-title` |
| `text-[16px]` | `text-ap-stat` |
| `text-[26px]` | `text-ap-hero` |
| `text-[14px]` (단독, `live-agents:276` — Task 2에서 이미 처리됨) | `text-ap-title` |

분기 없는 파일(`app/hud/page.tsx`, `app/portfolio/page.tsx`, `app/performance/page.tsx`, `components/ui/ApPrimitives.tsx`, `components/hud/PortfolioTab.tsx`/`ExecutionTab.tsx`/`TasksTab.tsx`)은 파일 전체에서 치환.

분기 있는 파일(`investment-os/page.tsx`, `research-os/{chat,governance,validation}/page.tsx`)은 **`hidden md:block` 블록 안의 매직넘버는 그대로 둔다** — 데스크톱은 다크 톤 자체 스케일(`--color-*` 계열)을 쓰므로 이 ap- 타이포 토큰과 무관. `md:hidden` 블록 및 분기 밖 공통 코드만 치환.

각 파일에서:
```bash
sed -i '' 's/text-\[9px\]/text-ap-micro/g; s/text-\[10px\]/text-ap-caption/g; s/text-\[11px\]/text-ap-body/g; s/text-\[12px\]/text-ap-label/g; s/text-\[13px\]/text-ap-title/g; s/text-\[16px\]/text-ap-stat/g; s/text-\[26px\]/text-ap-hero/g' <file>
```
분기 있는 4개 파일은 위 일괄 `sed` 대신, 모바일 브랜치 라인 범위를 확인한 뒤(Task 3 Step 2-4에서 이미 확인한 시작 라인 사용) `sed -n '<시작>,$p'` 또는 에디터로 해당 범위만 치환. 데스크톱 블록에 실수로 적용됐는지는 `git diff`로 `hidden md:block` 블록 안에 `text-ap-*`가 새로 생겼는지 확인해서 검증.

- [ ] **Step 2: 검증**

```bash
npx tsc --noEmit
npm run build
git diff --stat
```
`git diff`에서 `hidden md:block` 블록 내부에 diff가 없는지(분기 파일 4개) 눈으로 확인.

- [ ] **Step 3: 커밋**

```bash
git add app/hud/page.tsx app/portfolio/page.tsx app/performance/page.tsx "app/(console)/investment-os/page.tsx" "app/(console)/research-os/chat/page.tsx" "app/(console)/research-os/governance/page.tsx" "app/(console)/research-os/validation/page.tsx" components/ui/ApPrimitives.tsx components/hud/PortfolioTab.tsx components/hud/ExecutionTab.tsx components/hud/TasksTab.tsx
git commit -m "refactor: replace magic-number font sizes with ap- typography tokens (mobile branches only)"
```

---

### Task 5: 기존 2026-09-17 스펙/플랜 문서 정리

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-mobile-design-system-overhaul.md` (커밋 안 된 addendum 있음)
- Delete: `docs/superpowers/plans/2026-09-17-mobile-design-system-overhaul.md` (untracked, 1804줄, 태스크 1-10 전부 git 이력상 완료 확인됨)

**Interfaces:** 없음 (문서 정리, 코드 변경 없음).

- [ ] **Step 1: 기존 spec 파일 상단에 계승 문구 추가**

`docs/superpowers/specs/2026-09-17-mobile-design-system-overhaul.md` 최상단(제목 바로 아래)에 추가:
```markdown
> **계승됨:** 이 스펙의 태스크 1~10은 완료·커밋됨. 잔여 항목(버튼/타이포 미시스템화)은
> `docs/superpowers/specs/2026-09-20-design-system-formalization-design.md`로 계승·대체됨.
```
기존 커밋 안 된 addendum 내용은 그대로 두고 이 문구만 추가.

- [ ] **Step 2: untracked plan 파일 삭제**

```bash
rm "docs/superpowers/plans/2026-09-17-mobile-design-system-overhaul.md"
```

- [ ] **Step 3: 커밋**

```bash
git add "docs/superpowers/specs/2026-09-17-mobile-design-system-overhaul.md"
git commit -m "docs: mark 2026-09-17 mobile design system spec as superseded, remove stale untracked plan"
```
(삭제된 untracked 파일은 `git add`로 스테이징되지 않으므로 별도 언급 불필요 — 애초에 git이 추적한 적 없음.)

---

## Self-Review 결과

- **스펙 커버리지:** ApButton(Task 1,2,3) ✓, 타이포 토큰(Task 1,4) ✓, 검증 방법(각 태스크 Step) ✓, 기존 문서 정리(Task 5) ✓. 스펙의 "비범위"(데스크톱 25페이지, 차트 색상, lg 사이즈)는 어느 태스크에도 포함 안 됨 — 의도대로.
- **플레이스홀더 스캔:** Task 3 Step 4(governance/validation)만 완전 사전 열거가 아니라 "판단 기준 + 스캔 절차"로 남김 — 두 파일 각 14개/5개 버튼 전부를 사전에 분류하기엔 근거 데이터 부족. 대신 기준을 구체적 규칙(solid→primary, outline+브랜드색→secondary, 파괴적→danger, plain→ghost, skip 조건 명시)으로 못박아 "add appropriate handling" 류 모호함과는 다름. 리스크 낮음 — 리뷰어가 diff에서 기준 적용 검증 가능.
- **타입/시그니처 일관성:** `ApButton` props가 Task 1 정의(`variant`/`size`/`loading`) 그대로 Task 2, 3에서 사용됨 — 일치.
