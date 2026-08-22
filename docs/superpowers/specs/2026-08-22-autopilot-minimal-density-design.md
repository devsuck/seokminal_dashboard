# Autopilot 미니멀 밀도 리디자인 — 설계 스펙

**작성일:** 2026-08-22
**선행 작업:** `docs/superpowers/specs/2026-08-22-autopilot-light-redesign-design.md` (Phase 222, 색상/Card 전환 완료·SHIPPED)
**이번 작업 범위:** 위 색상 전환이 이미 끝난 6개 파일 위에, 컴포넌트 종류 축소 + 정보 밀도 감소 패스.

## 배경

Phase 222에서 CommandRail + `/hud` 5탭 + `/agents`를 다크→라이트(`ap-` 토큰)로 전환했다. 색상만 바뀐 상태라, 사용자가 참조하는 Autopilot 앱의 "미니멀·심플" 느낌과는 거리가 있다. 사용자 요청(2026-08-22, AskUserQuestion 응답): **"컴포넌트 종류 축소, 정보 밀도 줄이기, 오토파일럿 느낌이 나게"**.

둘러본 결과 두 가지 구체적 문제를 확인:
1. **`hud-frame`** (`app/globals.css:207-213`) — 코너 브래킷 장식 CSS (`::before`/`::after` 의사요소, `var(--color-accent)` 레거시 다크 토큰 사용). `ExecutionTab.tsx`(2곳), `LabTab.tsx`(1곳), `PortfolioTab.tsx`(2곳)에 남아있음. 순수 장식(`position: relative`만 부여, 레이아웃에 관여 안 함) — 라이트 카드 톤과 안 맞고, 이미 색상이 레거시 accent라 시각적으로도 어긋남.
2. **Home 탭 정보 과밀** (`app/hud/page.tsx` `HomeTab()`, 219-568행) — 카드 8개(시스템상태/판단필요/유닛로스터/수집기함대/정합성감시/계좌잔액/돈길/최근3분할)가 세로로 나열. Autopilot 참조 앱 대비 위젯 종류·개수가 많음.

## 범위

**수정 파일 (4개):**
- `app/globals.css` — `.hud-frame` 규칙 삭제
- `components/hud/ExecutionTab.tsx` — `hud-frame` 클래스 토큰 제거 (2곳)
- `components/hud/LabTab.tsx` — `hud-frame` 클래스 토큰 제거 (1곳)
- `components/hud/PortfolioTab.tsx` — `hud-frame` 클래스 토큰 제거 (2곳)
- `app/hud/page.tsx` — `HomeTab()` 8카드 → 5블록 재구성

**무수정:** `app/agents/page.tsx`, `components/hud/TasksTab.tsx`, `components/console/CommandRail.tsx` (grep 결과 `hud-frame` 없음), `components/ui/Card.tsx`, `components/ui/SegmentedToggle.tsx` (재사용만, 수정 없음), 기존 `ap-` 토큰 세트, Panel.tsx, 미전환 라우트 전부.

## A. hud-frame 장식 제거

**방식:** 각 위치에서 클래스 문자열의 `hud-frame ` 토큰만 삭제. 나머지 클래스(`rounded-lg border ...`)는 그대로 유지 — 자체 테두리·배경이 이미 있어 시각적 손실 없음. `Card` 컴포넌트로 감싸지 않는다 (일부는 `<Link>`, `<div className="text-center">`처럼 `Card`의 고정 마크업과 안 맞아 리스크만 커짐 — 클래스 토큰 삭제가 최소 diff).

`app/globals.css`에서 `.hud-frame`, `.hud-frame::before`, `.hud-frame::after` 규칙(207-213행) 전체 삭제. 사용처가 사라지므로 죽은 CSS로 남기지 않는다.

**정확한 위치:**
- `components/hud/ExecutionTab.tsx:66` — ``className={`hud-frame rounded-lg p-4 border ${...}`}`` → `hud-frame ` 제거
- `components/hud/ExecutionTab.tsx:105` — ``className={`hud-frame rounded-lg border p-4 ${...}`}`` → `hud-frame ` 제거
- `components/hud/LabTab.tsx:112` — `className="hud-frame flex items-center justify-between gap-4 flex-wrap rounded-lg border border-hud/20 bg-ap-surface px-4 py-3"` → `hud-frame ` 제거
- `components/hud/PortfolioTab.tsx:120` — `className="hud-frame flex items-center gap-3 bg-ap-surface border border-ap-brand/25 rounded-lg px-4 py-2.5 no-underline hover:bg-ap-brand/5 transition-colors flex-wrap"` → `hud-frame ` 제거
- `components/hud/PortfolioTab.tsx:294` — `className="hud-frame bg-ap-surface border border-ap-line rounded-lg px-3 py-2.5 text-center"` (`Summary` 내부 헬퍼) → `hud-frame ` 제거

## B. Home 탭 — 8카드 → 5블록

`app/hud/page.tsx`의 `HomeTab()` 리턴 JSX(363-566행)를 재구성. 데이터 로딩 로직(`useEffect`, `Feed`/`Unit` 타입, 핸들러)은 무수정 — JSX 마크업만 병합.

### B-1. 시스템개요 (시스템상태 + 정합성감시 병합)

기존 "시스템 상태" 카드(365-385행)와 "정합성 감시" 카드(447-479행)를 하나의 `Card`로 합친다. 헤더는 "시스템개요" 하나, 그 아래 두 서브섹션을 세로로 배치:

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
        <Link key={i} href={violationHref(v.entity)}
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

`(health?.n_errors ?? 0) > 0` 배지(기존 381-383행)는 정합성 요약 줄(우측 `ml-auto` 스팬)에 이미 오류 카운트가 표시되므로 중복 — 삭제. 위반 리스트(`health.violations`)는 있을 때만 렌더(기존 동작 유지), 정상일 때 "이상 없음" 별도 줄은 요약 줄이 대체하므로 만들지 않는다.

### B-2. 판단 필요 — 무수정

기존 387-407행 그대로 유지. 액션 아이템이라 축소하지 않는다.

### B-3. 인프라상태 (유닛로스터 + 수집기함대 병합)

기존 "유닛 로스터 · 전략" 카드(410-419행)와 "수집기 함대" 카드(422-444행)를 하나의 `Card`로 합친다. 카드 안에서 두 그룹을 서브헤더로 구분(완전한 `CardHeader` 대신 얇은 라벨 줄):

```tsx
<Card className="mb-1">
  <CardHeader right={<span className="tabular-nums">{nRunning}/{units.length} 가동 · 수집 {collectorUnits.length > 0 ? `${nHealthy}/${collectorUnits.length}` : "…"}</span>}>
    인프라상태
  </CardHeader>
  <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-ap-ink-3">전략</div>
  <div className="grid grid-cols-1 sm:grid-cols-2">
    {units.map((u, i) => <UnitCard key={`${u.name}-${i}`} u={u} />)}
  </div>
  <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-ap-ink-3 border-t border-ap-line">
    수집기 {nDegraded > 0 && <span className="text-ap-caution normal-case">· 이상 {nDegraded}</span>}
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2">
    {collectorUnits.map((u, i) => (
      <UnitCard key={`${u.name}-${i}`} u={u} onRestart={handleRestart}
        restarting={u.collectorKey ? !!restarting[u.collectorKey] : false} />
    ))}
  </div>
  {collectorUnits.length === 0 && (
    <div className="px-2 py-1.5 text-ap-ink-3 text-[11px]">수집기 상태 로딩 중…</div>
  )}
</Card>
```

`UnitCard`, `formatAge`, `violationHref` 등 헬퍼 함수는 무수정.

### B-4. 돈길 — 무수정

기존 "돈길" 카드(486-503행) 그대로. 이미 독립된 스테퍼라 병합 대상 아님. 계좌 잔액(`<Balances>`, 483-485행) 옆 그리드 배치도 무수정.

### B-5. 최근활동 (알림/로그/체결 → 토글 1카드)

기존 3개 `Card`(507-565행, 최근 알림/AI LAB 로그/최근 페이퍼 체결)를 `SegmentedToggle`로 전환하는 1개 `Card`로 교체. `SegmentedToggle`은 `components/ui/SegmentedToggle.tsx`에 이미 있는 컴포넌트 — 신규 컴포넌트 추가 없음.

`HomeTab()` 함수 내부에 상태 추가:
```tsx
const [activityView, setActivityView] = useState<"alerts" | "log" | "trades">("alerts");
```

렌더 부분:
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
        {(alerts?.length ?? 0) === 0 && <div className="px-2 py-3 text-ap-ink-3 text-[11px]">알림 없음</div>}
      </>
    )}
    {activityView === "log" && (
      <>
        {(lab?.log ?? []).slice(-14).reverse().map((l, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
            <span className="text-ap-ink-3 shrink-0 w-16 truncate">{l.ts?.slice(11, 19) ?? "--:--:--"}</span>
            <span className={`shrink-0 w-12 truncate ${l.level === "error" ? "text-ap-down" : l.level === "warn" ? "text-ap-caution" : "text-ap-ink-3"}`}>{l.stage}</span>
            <span className="text-ap-ink-2 truncate flex-1">{l.msg}</span>
          </div>
        ))}
        {(lab?.log?.length ?? 0) === 0 && <div className="px-2 py-3 text-ap-ink-3 text-[11px]">로그 없음</div>}
      </>
    )}
    {activityView === "trades" && (
      <>
        {(exec?.paper?.recent_closed ?? []).slice(0, 14).map((t, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
            <span className="text-ap-ink-1 truncate flex-1">{t.corp}</span>
            <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.entry_date}</span>
            <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.exit_date ?? "보유중"}</span>
            <span className={`shrink-0 w-14 text-right px-1 font-bold ${(t.pnl_pct ?? 0) > 0 ? "bg-ap-up/20 text-ap-up" : (t.pnl_pct ?? 0) < 0 ? "bg-ap-down/20 text-ap-down" : "text-ap-ink-3"}`}>
              {t.pnl_pct != null ? `${t.pnl_pct.toFixed(2)}%` : "—"}
            </span>
          </div>
        ))}
        {(exec?.paper?.recent_closed?.length ?? 0) === 0 && <div className="px-2 py-3 text-ap-ink-3 text-[11px]">체결 없음</div>}
      </>
    )}
  </div>
</Card>
```

**`activeClass` 필수 이유:** `SegmentedToggle`의 `DEFAULT_ACTIVE_CLASS`(`components/ui/SegmentedToggle.tsx:1`)는 레거시 다크 토큰(`border-accent text-accent bg-accent/10`)이다. Home은 이미 `ap-` 라이트 토큰으로 전환된 화면이라, `activeClass` 오버라이드 없이 쓰면 레거시 accent 색이 라이트 카드 위에 섞여 나온다 — Phase 222의 잔여 버그(min-h-full 누락)와 같은 종류의 실수를 여기서 미리 차단.

### 결과

Home 탭: 8카드 → **5블록** (시스템개요/판단필요/인프라상태/돈길/최근활동) + `Balances` 위젯(카드 아님, 그대로).

## C. 집행 콘솔(ExecutionTab) — 밀도 변경 없음, hud-frame만 제거

`Kv` 18개는 그대로 둔다. 이 탭의 목적이 "ARM GO/KILL 판정의 근거 전부 보여주기"이므로, 숫자를 줄이면 판단 근거가 사라져 탭 존재 이유가 훼손된다. A항의 `hud-frame` 제거만 적용.

## D. Lab 탭 — hud-frame만 제거, 구조 무수정

이미 `Card` + 그리드로 정리돼 있어 추가 병합 실익 없음. A항 적용만.

## E. Portfolio 탭 — hud-frame만 제거, 구조 무수정

A항 적용만 (2곳).

## 테스트

- `npx tsc --noEmit` — 타입 에러 0
- `npm test` — 기존 스위트 통과 (Home 탭 대상 유닛 테스트 있으면 갱신, 없으면 신규 작성 불필요 — 로직 무변경, 마크업만 재배치)
- 브라우저 라이브 확인 (claude-in-chrome): `/hud` Home 탭 5블록 정상 렌더, "최근활동" 토글 3개 전환 동작, `activeClass`가 `ap-brand`로 뜨는지(레거시 accent 색 안 섞이는지) 확인. `/hud?tab=execution`, `?tab=lab`, `?tab=portfolio`에서 코너 브래킷 장식 사라졌는지 확인.

## Global Constraints (플랜에 전달)

- 디자인 토큰만 사용 (`ap-` 세트), 신규 arbitrary hex 금지
- Raw `fetch` 금지 — 기존 `lib/api.ts`/`lib/console-api.ts` 함수만 사용 (이번 작업은 신규 API 호출 없음 — 기존 훅 재사용)
- `style={{}}` 금지 (해당 없음 — 이번 변경엔 인라인 스타일 없음)
- `SegmentedToggle` 사용 시 `activeClass`를 `ap-` 토큰으로 명시 지정 (레거시 accent 색 유입 방지)
- 브랜치: `main` 직접 커밋
