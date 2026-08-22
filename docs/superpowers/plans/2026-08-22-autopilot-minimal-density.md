# Autopilot 미니멀 밀도 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hud-frame 장식 CSS 제거 + Home 탭 8카드→5블록 재구성으로 컴포넌트 종류·정보 밀도를 줄인다.

**Architecture:** 순수 마크업/클래스 재배치. 데이터 로딩 로직, API 호출, 타입 정의는 무변경. 신규 컴포넌트 추가 없음(기존 `Card`/`CardHeader`/`SegmentedToggle`만 재사용).

**Tech Stack:** Next.js (App Router), React, Tailwind v4 (`ap-` 토큰), TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-22-autopilot-minimal-density-design.md`

## Global Constraints

- 디자인 토큰만 사용 (`ap-` 세트) — 신규 arbitrary hex 금지
- Raw `fetch` 금지 — 기존 `lib/api.ts`/`lib/console-api.ts` 함수만 사용 (신규 API 호출 없음)
- `style={{}}` 금지
- `SegmentedToggle` 사용 시 `activeClass`를 `ap-` 토큰(`border-ap-brand text-ap-brand bg-ap-brand/10`)으로 명시 지정 — 레거시 `accent` 토큰 유입 방지
- 브랜치: `main` 직접 커밋
- 검증: 각 태스크 후 `npx tsc --noEmit` 통과 필수

---

### Task 1: hud-frame 장식 제거

**Files:**
- Modify: `app/globals.css:207-213`
- Modify: `components/hud/ExecutionTab.tsx:66,105`
- Modify: `components/hud/LabTab.tsx:112`
- Modify: `components/hud/PortfolioTab.tsx:120,294`

**Interfaces:**
- Consumes: 없음 (클래스 토큰 삭제만)
- Produces: 없음 (외부에서 참조하는 export 없음)

**컨텍스트:** `.hud-frame`은 코너 브래킷 장식 CSS다(`position: relative` + `::before`/`::after` 의사요소, `var(--color-accent)` 레거시 다크 토큰 사용). 순수 장식이라 클래스 토큰만 지우면 레이아웃 영향 없음. 사용처가 이 5곳이 전부이므로 CSS 규칙 자체도 삭제한다(죽은 CSS로 남기지 않음).

- [ ] **Step 1: `app/globals.css`에서 `.hud-frame` 규칙 삭제**

207-213행 전체(`.hud-frame { position: relative; }` 부터 `.hud-frame::after { ... }`까지) 삭제.

- [ ] **Step 2: `components/hud/ExecutionTab.tsx`에서 `hud-frame ` 토큰 제거 (2곳)**

66행:
```tsx
// before
<div className={`hud-frame rounded-lg p-4 border ${
// after
<div className={`rounded-lg p-4 border ${
```

105행:
```tsx
// before
<div className={`hud-frame rounded-lg border p-4 ${
// after
<div className={`rounded-lg border p-4 ${
```

- [ ] **Step 3: `components/hud/LabTab.tsx`에서 `hud-frame ` 토큰 제거 (1곳)**

112행:
```tsx
// before
<div className="hud-frame flex items-center justify-between gap-4 flex-wrap rounded-lg border border-hud/20 bg-ap-surface px-4 py-3">
// after
<div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-hud/20 bg-ap-surface px-4 py-3">
```

- [ ] **Step 4: `components/hud/PortfolioTab.tsx`에서 `hud-frame ` 토큰 제거 (2곳)**

120행:
```tsx
// before
className="hud-frame flex items-center gap-3 bg-ap-surface border border-ap-brand/25 rounded-lg px-4 py-2.5 no-underline hover:bg-ap-brand/5 transition-colors flex-wrap">
// after
className="flex items-center gap-3 bg-ap-surface border border-ap-brand/25 rounded-lg px-4 py-2.5 no-underline hover:bg-ap-brand/5 transition-colors flex-wrap">
```

294행:
```tsx
// before
<div className="hud-frame bg-ap-surface border border-ap-line rounded-lg px-3 py-2.5 text-center">
// after
<div className="bg-ap-surface border border-ap-line rounded-lg px-3 py-2.5 text-center">
```

- [ ] **Step 5: grep 확인 — `hud-frame` 참조 완전히 사라졌는지**

Run: `grep -rn "hud-frame" app/ components/`
Expected: 결과 없음 (empty)

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/hud/ExecutionTab.tsx components/hud/LabTab.tsx components/hud/PortfolioTab.tsx
git commit -m "style: hud-frame 코너브래킷 장식 제거 — 라이트 카드 톤 통일

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Home 탭 8카드 → 5블록 재구성

**Files:**
- Modify: `app/hud/page.tsx` (`HomeTab()` 함수, 219-568행 — 정확한 라인은 Task 1 이후 재확인 필요, 함수명으로 위치 찾을 것)

**Interfaces:**
- Consumes: `Card`, `CardHeader` (`@/components/ui/Card`), `SegmentedToggle`, `SegmentedOption` (`@/components/ui/SegmentedToggle` — 신규 import 추가), `StatusDot`, `UnitCard`, `WorldClock`, `LadderStep`, `formatAge`, `violationHref` (파일 내 기존 헬퍼, 무수정), `Balances` (`@/components/AccountBalances`)
- Produces: 없음 (default export `HudShell` 시그니처 무변경)

**컨텍스트:** `HomeTab()`의 데이터 로딩(`useEffect` 2개, `Feed`/`Unit` 타입, `handleRestart`)은 전혀 건드리지 않는다. JSX 리턴문(현재 8개 `Card`)만 5개 블록으로 재구성한다. 정확한 목표 마크업은 스펙 문서 B절에 있다 — 그대로 옮긴다.

- [ ] **Step 1: `HomeTab()` 상단에 activityView 상태 추가**

기존 `const [restarting, ...] = useState(...)` 다음 줄에 추가:
```tsx
const [activityView, setActivityView] = useState<"alerts" | "log" | "trades">("alerts");
```

- [ ] **Step 2: import에 `SegmentedToggle` 추가**

파일 상단 import 블록에 추가:
```tsx
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
```

- [ ] **Step 3: "시스템 상태" 카드와 "정합성 감시" 카드를 "시스템개요" 하나로 병합**

기존 두 `<Card>` 블록(시스템 상태: `<CardHeader right={<WorldClock now={now} />}>시스템 상태</CardHeader>...`, 정합성 감시: `<CardHeader ...>정합성 감시</CardHeader>...`)을 아래로 교체:

```tsx
<Card className="mb-1">
  <CardHeader right={<WorldClock now={now} />}>시스템개요</CardHeader>
  <div className="flex items-center gap-3 px-2 py-1 border-b border-ap-line">
    <StatusDot tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "처리 중" : active ? "가동 중" : "대기"} />
    {arm && (
      <Link href="/lab/execution"
        className={`no-underline text-[11px] px-2 py-0.5 border font-data font-bold tracking-wider ${
          arm.decision === "GO" ? "border-ap-up/50 text-ap-up bg-ap-up/15" :
          arm.decision === "KILL" ? "border-ap-down/50 text-ap-down bg-ap-down/15 animate-blink" :
          "border-ap-note/40 text-ap-note bg-ap-note/15"}`}>
        ARM {arm.decision}
      </Link>
    )}
    {wd?.critical && (
      <span className="text-[9px] px-1.5 py-0.5 border border-ap-down/50 text-ap-down bg-ap-down/15 animate-blink font-data font-bold">감시견 경보</span>
    )}
    <span className={`ml-auto tabular-nums text-[10px] font-data ${(health?.n_errors ?? 0) > 0 ? "text-ap-down" : health ? "text-ap-up" : "text-ap-ink-3"}`}>
      {health ? (health.ok ? "정합성 이상 없음" : `정합성 오류 ${health.n_errors} · 위반 ${health.n_violations}`) : "정합성 로딩 중…"}
    </span>
  </div>
  {health && health.violations.length > 0 && (
    <div className="max-h-56 overflow-y-auto">
      {health.violations.map((v, i) => (
        <Link
          key={i}
          href={violationHref(v.entity)}
          className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px] hover:bg-ap-bg transition-colors">
          <StatusDot tone={v.severity === "error" ? "neg" : "accent"} />
          <span className="text-ap-ink-3 shrink-0 w-32 truncate">{v.entity}</span>
          <span className={`shrink-0 w-40 truncate font-bold font-data ${v.severity === "error" ? "text-ap-down" : "text-ap-caution"}`}>{v.code}</span>
          <span className="text-ap-ink-2 truncate flex-1">{v.detail}</span>
          <span className="text-ap-ink-3 shrink-0">→</span>
        </Link>
      ))}
    </div>
  )}
</Card>
```

기존 "감시견 경보"/"정합성 오류 N" 개별 배지 코드(옛 시스템 상태 카드 안에 있던 것)는 위 블록에 흡수됐으므로 중복 생성하지 않는다.

- [ ] **Step 4: "판단 필요" 카드는 그대로 둔다 (수정 없음)**

위치만 시스템개요 다음으로 유지.

- [ ] **Step 5: "유닛 로스터 · 전략" 카드와 "수집기 함대" 카드를 "인프라상태" 하나로 병합**

두 `<Card>` 블록을 아래로 교체:

```tsx
<Card className="mb-1">
  <CardHeader right={
    <span className="tabular-nums">
      {nRunning}/{units.length} 가동 · 수집 {collectorUnits.length > 0 ? `${nHealthy}/${collectorUnits.length}` : "…"}
    </span>
  }>
    인프라상태
  </CardHeader>
  <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-ap-ink-3">전략</div>
  <div className="grid grid-cols-1 sm:grid-cols-2">
    {units.map((u, i) => (
      <UnitCard key={`${u.name}-${i}`} u={u} />
    ))}
  </div>
  <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-ap-ink-3 border-t border-ap-line">
    수집기{nDegraded > 0 && <span className="text-ap-caution normal-case"> · 이상 {nDegraded}</span>}
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2">
    {collectorUnits.map((u, i) => (
      <UnitCard
        key={`${u.name}-${i}`}
        u={u}
        onRestart={handleRestart}
        restarting={u.collectorKey ? !!restarting[u.collectorKey] : false}
      />
    ))}
  </div>
  {collectorUnits.length === 0 && (
    <div className="px-2 py-1.5 text-ap-ink-3 text-[11px]">수집기 상태 로딩 중…</div>
  )}
</Card>
```

- [ ] **Step 6: "돈길" 카드(및 옆의 `Balances`)는 그대로 둔다 (수정 없음)**

- [ ] **Step 7: "최근 알림"/"AI LAB 로그"/"최근 페이퍼 체결" 3카드 그리드를 "최근활동" 토글 1카드로 교체**

기존 `<div className="grid grid-cols-1 lg:grid-cols-3 gap-1 items-start mt-1">...3개 Card...</div>` 블록 전체를 아래로 교체:

```tsx
<Card className="mt-1">
  <CardHeader right={
    <span className="tabular-nums">
      {activityView === "alerts" ? `${alerts?.length ?? 0}건`
        : activityView === "log" ? `${lab?.log?.length ?? 0}줄`
        : `${exec?.paper?.recent_closed?.length ?? 0}건`}
    </span>
  }>
    최근활동
  </CardHeader>
  <div className="px-2 pt-2">
    <SegmentedToggle
      size="sm"
      value={activityView}
      onChange={setActivityView}
      options={[
        { value: "alerts", label: "알림", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
        { value: "log", label: "LAB 로그", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
        { value: "trades", label: "페이퍼 체결", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
      ]}
    />
  </div>
  <div className="max-h-64 overflow-y-auto mt-1">
    {activityView === "alerts" && (
      <>
        {(alerts ?? []).slice(0, 14).map((a, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
            <span className="text-ap-ink-3 shrink-0 w-16 truncate">{a.triggered_at?.slice(11, 19) ?? "--:--:--"}</span>
            <span className="text-ap-caution truncate flex-1">{a.rule_label}</span>
            <span className="text-ap-ink-2 shrink-0 truncate max-w-[40%]">{a.detail}</span>
          </div>
        ))}
        {(alerts?.length ?? 0) === 0 && (
          <div className="px-2 py-3 text-ap-ink-3 text-[11px]">알림 없음</div>
        )}
      </>
    )}
    {activityView === "log" && (
      <>
        {(lab?.log ?? []).slice(-14).reverse().map((l, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
            <span className="text-ap-ink-3 shrink-0 w-16 truncate">{l.ts?.slice(11, 19) ?? "--:--:--"}</span>
            <span className={`shrink-0 w-12 truncate ${
              l.level === "error" ? "text-ap-down" : l.level === "warn" ? "text-ap-caution" : "text-ap-ink-3"}`}>{l.stage}</span>
            <span className="text-ap-ink-2 truncate flex-1">{l.msg}</span>
          </div>
        ))}
        {(lab?.log?.length ?? 0) === 0 && (
          <div className="px-2 py-3 text-ap-ink-3 text-[11px]">로그 없음</div>
        )}
      </>
    )}
    {activityView === "trades" && (
      <>
        {(exec?.paper?.recent_closed ?? []).slice(0, 14).map((t, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
            <span className="text-ap-ink-1 truncate flex-1">{t.corp}</span>
            <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.entry_date}</span>
            <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.exit_date ?? "보유중"}</span>
            <span className={`shrink-0 w-14 text-right px-1 font-bold ${
              (t.pnl_pct ?? 0) > 0 ? "bg-ap-up/20 text-ap-up" : (t.pnl_pct ?? 0) < 0 ? "bg-ap-down/20 text-ap-down" : "text-ap-ink-3"}`}>
              {t.pnl_pct != null ? `${t.pnl_pct.toFixed(2)}%` : "—"}
            </span>
          </div>
        ))}
        {(exec?.paper?.recent_closed?.length ?? 0) === 0 && (
          <div className="px-2 py-3 text-ap-ink-3 text-[11px]">체결 없음</div>
        )}
      </>
    )}
  </div>
</Card>
```

- [ ] **Step 8: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 9: 유닛 테스트**

Run: `npm test`
Expected: 기존 스위트 전부 통과 (로직 무변경이므로 실패하는 테스트가 있으면 마크업 재배치가 로직을 건드렸다는 신호 — 원인 조사)

- [ ] **Step 10: Commit**

```bash
git add app/hud/page.tsx
git commit -m "refactor: Home 탭 8카드 → 5블록 (시스템개요/판단필요/인프라상태/돈길/최근활동)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 최종 검증 (전체 태스크 완료 후, 최종 리뷰와 별개로 컨트롤러가 직접 수행)

- [ ] `npx tsc --noEmit` 전체 통과
- [ ] `npm test` 전체 통과
- [ ] 브라우저 라이브 확인(claude-in-chrome): `/hud` Home 탭 5블록 렌더 확인, "최근활동" 토글 3개 전환 시 `ap-brand` 색으로 활성 표시되는지(레거시 `accent` 색 안 섞이는지) 확인. `/hud?tab=execution`, `?tab=lab`, `?tab=portfolio`에서 코너 브래킷 장식 사라졌는지 확인.
