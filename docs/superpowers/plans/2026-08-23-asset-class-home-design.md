# 자산군 홈 재구조 (Project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/agents`(죽은 라우트)와 `/risk-guard`(독립 페이지)를 정리하고, `/portfolio`의 계좌현황 탭과 `/hud`의 PORTFOLIO 탭을 통화축이 아닌 자산군축(국내주식/해외주식/코인/폴리마켓)으로 재편한다.

**Architecture:** 백엔드·데이터소스는 무변경, 기존 API 재사용만. `AccountsTab()`의 `CcySection`을 통화 그룹핑에서 자산군 라벨링으로 바꾸고, 신규 `PolymarketBots` 프레젠테이셔널 컴포넌트를 추가한다. `/hud`의 `PortfolioTab.tsx`는 죽은 에이전트 중심 뷰를 자산군 4타일 요약으로 전면 재작성한다. `/risk-guard`는 `components/console/SettingsDrawer.tsx`라는 슬라이드오버로 흡수하고 CommandRail/BottomTabBar가 각자 로컬 open-state로 트리거한다(전역 마운트 없음). `/agents`가 다른 5곳(리다이렉트맵/AlertPoller/hud violationHref/CommandRail/BottomTabBar)에서 참조되므로 전부 `/hud`로 정리한다.

**Tech Stack:** Next.js (App Router) + React + TypeScript, Tailwind(`ap-` 디자인 토큰), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-23-asset-class-home-design.md`

## Global Constraints

- 디자인 토큰만 사용: `app/portfolio/page.tsx`와 신규 `SettingsDrawer.tsx`는 `bg-ap-*`, `border-ap-line`, `text-ap-ink-1/2/3`, `text-ap-brand/up/down/caution` 등 `ap-` 토큰만. `components/console/CommandRail.tsx`/`BottomTabBar.tsx`는 이미 `--c-*` CSS 변수 체계를 쓰는 기존 파일이므로 그 파일 안의 신규 코드는 기존 파일 컨벤션(`--c-*` 변수)을 그대로 따른다 — 새 컨벤션을 섞지 않는다.
- Raw `fetch` 금지 — 반드시 `lib/api.ts`의 기존 함수만 사용 (`getDashboardPnlAll`, `getRiskStatus`, `setKillSwitch` 등 이미 존재하는 함수 재사용, 신규 API 함수 추가 없음).
- AbortController 패턴: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup.
- `style={{}}` 금지.
- `npx tsc --noEmit` + `npm test`(vitest) 각 태스크 끝에 통과 필수.
- 백엔드는 무변경 — `seokminal-multi-venue/` 쪽 파일은 이 플랜에서 건드리지 않는다.

---

### Task 1: `/agents` 라우트 삭제 + 5곳 dangling reference 정리

**Files:**
- Delete: `app/agents/page.tsx`
- Modify: `lib/researchOsRedirects.ts:38-41`
- Modify: `components/AlertPoller.tsx:13`
- Modify: `app/hud/page.tsx:165`
- Modify: `components/console/CommandRail.tsx:41`
- Modify: `components/console/BottomTabBar.tsx:16,29-30`
- Modify: `__tests__/researchOsRedirects.test.ts:39-42,49-51`
- Test (verify, no edit needed): `tests/lib/commandRailGroups.test.ts` — synthetic `GROUPS` fixture 안 씀, 무변경으로 계속 통과해야 함

**Interfaces:**
- Consumes: 없음(순수 리팩터, 신규 인터페이스 없음)
- Produces: `lib/researchOsRedirects.ts`의 `OLD_TO_NEW` 맵 4개 키(`/calendar`,`/insider`,`/macro`,`/news`)가 `/hud`를 가리킴 — Task 2~4는 이 값을 그대로 둔다.

- [ ] **Step 1: `app/agents/page.tsx` 삭제**

```bash
rm app/agents/page.tsx
rmdir app/agents 2>/dev/null || true
```

- [ ] **Step 2: `lib/researchOsRedirects.ts`의 4개 키 리타겟**

`lib/researchOsRedirects.ts:38-41`을 다음으로 교체:

```ts
  // ── 컨텍스트 드릴다운(옛 /agents 흡수, 지금은 /agents 자체가 없어져 /hud로) ──
  "/calendar": "/hud",
  "/insider": "/hud",
  "/macro": "/hud",
  "/news": "/hud",
```

- [ ] **Step 3: `components/AlertPoller.tsx`의 기본 분기 수정**

`components/AlertPoller.tsx:13`을 다음으로 교체:

```ts
  return { href: "/hud", label: "홈" };
```

- [ ] **Step 4: `app/hud/page.tsx`의 `violationHref()` agent 케이스 삭제**

`app/hud/page.tsx:165` 삭제(`if (entity.startsWith("agent:")) return "/agents";` 한 줄). 삭제 후 함수는:

```ts
function violationHref(entity: string): string {
  if (entity.includes("polymarket")) return "/polymarket";
  if (entity.includes("copytrade")) return "/copytrade";
  if (entity.includes("dart")) return "/dart-auto";
  return "/lab";
}
```

- [ ] **Step 5: `CommandRail.tsx`의 "봇 · 에이전트" 그룹에서 에이전트 항목 제거**

`components/console/CommandRail.tsx:40-47`의 `TERMINAL_GROUPS`에서 `{ href: "/agents", label: "에이전트" },` 줄(41번) 삭제. 결과:

```ts
  { label: "봇 · 에이전트", items: [
    { href: "/performance", label: "성과" },
    { href: "/risk-guard", label: "리스크 가드" },
    { href: "/dart-auto", label: "DART 오토파일럿" },
    { href: "/copytrade", label: "카피트레이딩" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
```

(`/risk-guard` 항목은 Task 2에서 마저 제거 — 이 태스크에서는 손대지 않음.)

- [ ] **Step 6: `BottomTabBar.tsx`의 PRIMARY_TABS + TabIcon 교체**

`components/console/BottomTabBar.tsx:12-17`을 다음으로 교체:

```ts
const PRIMARY_TABS = [
  { href: "/hud", label: "홈" },
  { href: "/orderflow", label: "오더플로우" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/research-os/pipeline", label: "Research OS" },
];
```

`components/console/BottomTabBar.tsx:29-30`(`case "/agents":` 블록)을 다음으로 교체:

```ts
    case "/research-os/pipeline":
      return <svg {...props}><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></svg>;
```

(글리프는 `CommandRail.tsx`의 `GroupGlyph`에서 "Research OS" 케이스가 쓰는 것과 같은 path — viewBox `0 0 16 16` 이미 호환.)

- [ ] **Step 7: `__tests__/researchOsRedirects.test.ts` 갱신**

`__tests__/researchOsRedirects.test.ts:39-42`(expected 객체의 마지막 4줄)를 다음으로 교체:

```ts
      "/calendar": "/hud",
      "/insider": "/hud",
      "/macro": "/hud",
      "/news": "/hud",
```

`__tests__/researchOsRedirects.test.ts:48-51`(`shells` 배열)를 다음으로 교체 — `/hud?tab=` → 그냥 `/hud`(startsWith로 여전히 `/hud?tab=lab` 등도 매칭됨), `/agents` 엔트리 삭제:

```ts
    const shells = [
      "/research-os/pipeline?tab=", "/research-os/validation?tab=", "/research-os/governance?tab=",
      "/hud", "/investment-os?tab=",
    ];
```

- [ ] **Step 8: 검증**

```bash
npx tsc --noEmit
npx vitest run __tests__/researchOsRedirects.test.ts tests/lib/commandRailGroups.test.ts
```

Expected: 둘 다 PASS. `grep -rn '"/agents"' app components lib` 실행해 잔여 참조 없는지 확인(있으면 이 태스크가 놓친 곳).

- [ ] **Step 9: Commit**

```bash
git add app/agents app/hud/page.tsx lib/researchOsRedirects.ts components/AlertPoller.tsx components/console/CommandRail.tsx components/console/BottomTabBar.tsx __tests__/researchOsRedirects.test.ts
git commit -m "remove dead /agents route, retarget dangling references to /hud"
```

---

### Task 2: `/risk-guard` 라우트 삭제 → `SettingsDrawer` 슬라이드오버

**Files:**
- Delete: `app/risk-guard/page.tsx`
- Create: `components/console/SettingsDrawer.tsx`
- Modify: `components/console/CommandRail.tsx` (risk-guard 항목 제거 + ⚙ 트리거 + 로컬 drawer state)
- Modify: `components/console/BottomTabBar.tsx` (더보기 시트에 ⚙ 트리거 + 로컬 drawer state)
- Modify: `lib/attention.ts:35`
- Modify: `tests/lib/attention.test.ts:31`

**Interfaces:**
- Consumes: `getRiskStatus`, `setKillSwitch`, `type RiskStatus` from `@/lib/api`(기존, 무변경) — 정확히 옛 `app/risk-guard/page.tsx`가 쓰던 것.
- Produces: `SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void })` — Task 이후 CommandRail/BottomTabBar가 각자 이 컴포넌트를 마운트. 전역 mount 없음(각 nav가 자기 인스턴스 소유).

- [ ] **Step 1: `components/console/SettingsDrawer.tsx` 생성**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRiskStatus, setKillSwitch, type RiskStatus } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, LoadingState, Bar } from "@/components/ui";

const won = (n: number) => `₩${n.toLocaleString()}`;

function KVRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[11.5px] font-data border-b border-ap-line/60 last:border-0">
      <span className="text-ap-ink-3">{k}</span>
      <span className="text-ap-ink-1 text-right truncate tabular-nums">{v}</span>
    </div>
  );
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    getRiskStatus(c.signal)
      .then((d) => { if (!c.signal.aborted) { setData(d); setLoading(false); } })
      .catch((e) => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 30_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [open, load]);

  async function toggleKill() {
    if (!data) return;
    const next = !data.kill_engaged;
    if (next && !confirm("⚠ 킬스위치 ON — 모든 자동봇/주문 즉시 차단. 계속?")) return;
    setBusy(true);
    try { await setKillSwitch(next, "manual"); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!open) return null;

  const dd = data?.current_drawdown_pct ?? null;
  const limit = data?.max_drawdown_limit_pct ?? 15;
  const ddFrac = dd != null ? Math.min(Math.abs(dd) / limit, 1) : 0;
  const killed = data?.kill_engaged;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-[420px] h-full bg-ap-bg border-l border-ap-line overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-ap-ink-1 text-lg font-semibold tracking-tight">설정 · 리스크 가드</h2>
          <button onClick={onClose} className="text-ap-ink-3 text-xs border-0 bg-transparent cursor-pointer px-2 py-1">닫기</button>
        </div>

        {loading ? (
          <LoadingState message="리스크 상태 로딩 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
        ) : error ? (
          <div className="p-4 rounded-ap-lg border border-ap-down/40 bg-ap-down/5 text-ap-down text-xs">
            백엔드 연결 실패: {error} <span className="text-ap-ink-3">· api_server(:8000) 기동 확인</span>
          </div>
        ) : !data ? (
          <EmptyState message="데이터 없음" textClass="text-ap-ink-3" />
        ) : (
          <div className="space-y-4">
            <Card className={killed ? "border-ap-down/40" : ""}>
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${killed ? "bg-ap-down animate-pulse" : "bg-ap-up"}`} />
                  <div>
                    <div className={`text-[13px] font-semibold ${killed ? "text-ap-down" : "text-ap-ink-1"}`}>
                      킬스위치 {killed ? "ON — 거래 차단됨" : "OFF — 정상"}
                    </div>
                    <div className="text-[11px] text-ap-ink-3 mt-0.5">
                      {killed ? `사유: ${data.kill_reason || "manual"}` : "모든 자동봇/주문 즉시 중단 스위치"}
                    </div>
                  </div>
                </div>
                <button onClick={toggleKill} disabled={busy}
                  className={`text-[12px] font-semibold px-4 py-2 border rounded-ap-sm cursor-pointer disabled:opacity-40 transition-colors bg-transparent ${
                    killed ? "border-ap-up/50 text-ap-up hover:bg-ap-up/10"
                           : "border-ap-down/50 text-ap-down hover:bg-ap-down/10"}`}>
                  {killed ? "해제" : "긴급 정지"}
                </button>
              </div>
            </Card>

            <Card>
              <CardHeader right={
                <span className={data.drawdown_breached ? "text-ap-down" : dd != null && dd < 0 ? "text-ap-caution" : "text-ap-ink-2"}>
                  {dd != null ? `${dd}%` : "—"} / 한도 -{limit}%
                </span>
              }>
                최대 낙폭 (고점 대비)
              </CardHeader>
              <div className="p-4">
                <Bar
                  ratio={ddFrac}
                  tone={data.drawdown_breached ? "bg-ap-down" : ddFrac > 0.6 ? "bg-ap-caution" : "bg-ap-up"}
                  width="w-full"
                  trackClass="bg-ap-bg border-ap-line"
                />
                {data.drawdown_breached && (
                  <p className="text-ap-down text-[11px] mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-ap-down shrink-0" /> 낙폭 한도 초과 — 자동 킬 발동. 원인 점검 후 수동 해제.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>주문 한도 (서버 강제)</CardHeader>
              <div className="p-4">
                <KVRow k="1회 주문 최대 수량" v={data.limits.max_order_qty.toLocaleString()} />
                <KVRow k="1회 주문 최대 금액" v={won(data.limits.max_order_notional)} />
                <KVRow k="종목당 최대 보유수량" v={data.limits.max_position_qty.toLocaleString()} />
                <KVRow k="일일 손실 한도" v={won(data.limits.daily_loss_limit)} />
                <div className="pt-2 mt-1 text-[10px] text-ap-ink-3">※ 한도는 .env(MAX_ORDER_*, DAILY_LOSS_LIMIT, MAX_DRAWDOWN_PCT)에서 조정.</div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `app/risk-guard/page.tsx` 삭제**

```bash
rm app/risk-guard/page.tsx
rmdir app/risk-guard 2>/dev/null || true
```

- [ ] **Step 3: `CommandRail.tsx`에서 risk-guard 항목 제거 + ⚙ 트리거 추가**

`components/console/CommandRail.tsx`의 `TERMINAL_GROUPS`에서 (Task 1 이후 상태) `{ href: "/risk-guard", label: "리스크 가드" },` 줄 삭제. 결과:

```ts
  { label: "봇 · 에이전트", items: [
    { href: "/performance", label: "성과" },
    { href: "/dart-auto", label: "DART 오토파일럿" },
    { href: "/copytrade", label: "카피트레이딩" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
```

파일 상단 import에 추가:

```ts
import { SettingsDrawer } from "@/components/console/SettingsDrawer";
```

`export function CommandRail()` 함수 본문의 state 선언부(기존 `const [open, setOpen] = useState(true);` 등 근처)에 추가:

```ts
  const [settingsOpen, setSettingsOpen] = useState(false);
```

풋터의 operatorMode 토글 버튼(`{open ? (operatorMode ? "전체보기" : "간단히 보기") : (operatorMode ? "전체" : "간단")}` 버튼) 바로 다음, 접기 토글 버튼 이전에 삽입:

```tsx
        <button onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors text-[10px] tracking-wide">
          {open ? "⚙ 설정" : "⚙"}
        </button>
```

`CommandRail()`의 `return (<nav ...>...</nav>);`를 `<>...</>` 프래그먼트로 감싸고 `SettingsDrawer`를 형제로 추가:

```tsx
  return (
    <>
      <nav className={`rail-ap console-rail hidden md:flex relative flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
        {/* ... 기존 nav 내용 전부 그대로 ... */}
      </nav>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
```

- [ ] **Step 4: `BottomTabBar.tsx` 더보기 시트에 ⚙ 트리거 추가**

파일 상단 import에 추가:

```ts
import { SettingsDrawer } from "./SettingsDrawer";
```

`export function BottomTabBar()` 함수 본문에 추가:

```ts
  const [settingsOpen, setSettingsOpen] = useState(false);
```

더보기 시트의 sticky 헤더(`<div className="sticky top-0 ...">전체 메뉴...닫기</div>`) 바로 다음, `{ALL_GROUPS.map(...)}` 이전에 삽입:

```tsx
            <button onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
              className="flex items-center h-10 px-4 w-full text-left border-0 border-b border-[var(--c-border)] bg-transparent cursor-pointer text-[13px] text-[var(--c-text-2)] active:bg-[var(--c-panel-2)]">
              ⚙ 설정 · 리스크 가드
            </button>
```

최상위 반환문의 `<> ... </>` 프래그먼트 안, `{moreOpen && (...)}` 블록 다음에 형제로 추가:

```tsx
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

(`/risk-guard` 항목은 CommandRail의 `TERMINAL_GROUPS`에서 이미 제거됐으므로 `ALL_GROUPS`를 그대로 렌더하는 "더보기" 시트에서도 자동으로 사라짐 — 별도 편집 불필요, Step 3 확인으로 충분.)

- [ ] **Step 5: `lib/attention.ts`의 리스크 알림 href 수정**

`lib/attention.ts:35`를 `detail: \`${blocked}건\`, href: "/hud", tone: "neg",`로 교체(기존 `href: "/risk-guard"` → `/hud`).

- [ ] **Step 6: `tests/lib/attention.test.ts` 갱신**

`tests/lib/attention.test.ts:31`을 다음으로 교체:

```ts
      id: "risk-block", label: "리스크 차단 이벤트", detail: "2건", href: "/hud", tone: "neg",
```

- [ ] **Step 7: 검증**

```bash
npx tsc --noEmit
npx vitest run tests/lib/attention.test.ts tests/lib/commandRailGroups.test.ts
```

Expected: PASS. `grep -rn '"/risk-guard"' app components lib` 실행해 잔여 참조 없는지 확인.

- [ ] **Step 8: Commit**

```bash
git add app/risk-guard components/console/SettingsDrawer.tsx components/console/CommandRail.tsx components/console/BottomTabBar.tsx lib/attention.ts tests/lib/attention.test.ts
git commit -m "replace /risk-guard page with SettingsDrawer slide-over"
```

---

### Task 3: `app/portfolio/page.tsx` `AccountsTab()` — 통화축 → 자산군축 + 폴리마켓 카드

**Files:**
- Modify: `app/portfolio/page.tsx` (imports, `CcySection`, `AccountsTab()`. `OrdersTab`/`PnlTab`/`VenueCard`/`PortfolioPage` 본체는 무변경)

**Interfaces:**
- Consumes: `getDashboardPnlAll`, `type DashboardBotRow` from `@/lib/api`(기존, `lib/api.ts:1603-1611`) — `DashboardBotRow { id, name, realized_pnl, note? }`.
- Produces: `CcySection`에 옵셔널 `label?: string` prop 추가(다른 소비자 없음, 이 파일 내부 전용). `fmt()`/`CcyTotalTile`은 시그니처 무변경.

- [ ] **Step 1: import 추가**

`app/portfolio/page.tsx:1-14`의 import 블록을 다음으로 교체(2줄 추가: `next/link`, `getDashboardPnlAll`+타입):

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, getDashboardPnlAll, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl, type DashboardBotRow,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedToggle, LoadingState, EmptyState, Bar } from "@/components/ui";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";
```

- [ ] **Step 2: `CcySection`에 옵셔널 `label` prop 추가**

`app/portfolio/page.tsx:226-241`을 다음으로 교체:

```tsx
function CcySection({ ccy, total, label, children }: { ccy: string; total: number | null; label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {label && <span className="text-ap-ink-1 text-sm font-semibold">{label}</span>}
        <span className="text-ap-ink-1 text-xs font-bold font-mono tracking-widest bg-ap-bg border border-ap-line rounded px-2 py-1">
          {ccy}
        </span>
        {total != null && (
          <span className="text-ap-brand text-base font-mono font-bold">{fmt(total, ccy)}</span>
        )}
        <div className="flex-1 h-px bg-ap-line" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: `PolymarketBots` 프레젠테이셔널 컴포넌트 추가**

`CcyTotalTile`(현재 `app/portfolio/page.tsx:247-254`) 정의 바로 다음에 삽입:

```tsx
// ── 폴리마켓 봇 카드 (getDashboardPnlAll의 bots 배열 재사용, 별도 API 없음) ──────

function PolymarketBots({ bots }: { bots: DashboardBotRow[] }) {
  const total = bots.length > 0 ? bots.reduce((s, b) => s + (b.realized_pnl ?? 0), 0) : null;
  return (
    <div className="bg-ap-surface border border-ap-line rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-ap-ink-1 text-sm font-semibold">폴리마켓 봇 실현손익</span>
        <span className={`font-mono text-sm font-bold px-1 ${total != null && total >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
          {total != null ? `${total >= 0 ? "+" : "-"}$${Math.abs(total).toFixed(2)}` : "—"}
        </span>
      </div>
      {bots.length > 0 ? (
        <div className="divide-y divide-ap-line/60 text-[11px] px-4 pb-2">
          {bots.map(b => (
            <div key={b.id} className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-ap-ink-2">{b.name}</span>
              <span className={`font-mono px-1 font-bold ${b.realized_pnl == null ? "text-ap-ink-3" : b.realized_pnl >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
                {b.realized_pnl == null ? "—" : `${b.realized_pnl >= 0 ? "+" : "-"}$${Math.abs(b.realized_pnl).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ap-ink-3 text-xs px-4 pb-3">봇 데이터 없음</p>
      )}
      <Link href="/polymarket" className="block text-center py-2 border-t border-ap-line text-ap-ink-3 text-xs hover:text-ap-ink-2 no-underline">
        /polymarket에서 자세히 →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: `AccountsTab()`의 state + `load()`에 폴리마켓 봇 fetch 추가**

`app/portfolio/page.tsx:259-267`(state 선언부)의 `const [loading, setLoading] = useState(true);` 줄 앞에 추가:

```tsx
  const [polymarketBots, setPolymarketBots] = useState<DashboardBotRow[]>([]);
```

`app/portfolio/page.tsx:271-296`의 `load()`를 다음으로 교체(fast Promise.allSettled 배열에 `getDashboardPnlAll()` 추가, 나머지 로직 무변경):

```tsx
  const load = useCallback(() => {
    // Fast: Alpaca + LKG paper + Polymarket bots — show UI immediately
    Promise.allSettled([
      getAlpacaAccount(),
      getAlpacaPositions(),
      getPaperState(),
      getHLPositions(true),
      getHLPositions(false),
      getDashboardPnlAll(),
    ]).then(([acctRes, posRes, paperRes, hlTestRes, hlMainRes, pnlRes]) => {
      if (acctRes.status === "fulfilled") setAlpacaAcct(acctRes.value);
      if (posRes.status === "fulfilled") setAlpacaPositions(posRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);
      if (hlTestRes.status === "fulfilled") setHlTestnetPositions(hlTestRes.value.asset_positions);
      if (hlMainRes.status === "fulfilled") setHlMainnetPositions(hlMainRes.value.asset_positions);
      if (pnlRes.status === "fulfilled") setPolymarketBots(pnlRes.value.bots.filter(b => b.id.startsWith("polymarket")));
      setLoading(false);
    });
    // Slow: full balances (KIS can take 30s+) — abort after 20s
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 20_000);
    getAccountBalances(ctrl.signal)
      .then(r => setAccounts(r.accounts))
      .catch(() => {})
      .finally(() => { clearTimeout(tid); setBalancesPending(false); });
    getKisHoldings(true, ctrl.signal).then(r => setKisMockHoldings(r.holdings)).catch(() => {});
    getKisHoldings(false, ctrl.signal).then(r => setKisLiveHoldings(r.holdings)).catch(() => {});
  }, []);
```

- [ ] **Step 5: 폴리마켓 합계 계산 추가**

`app/portfolio/page.tsx`의 `compositionRows` 계산(구 320-327줄) 바로 다음에 추가:

```tsx
  const polymarketTotal = polymarketBots.length > 0
    ? polymarketBots.reduce((s, b) => s + (b.realized_pnl ?? 0), 0)
    : null;
```

- [ ] **Step 6: 좌측 컬럼(LEFT) 타일 자산군 라벨로 교체**

`app/portfolio/page.tsx`(구 337-343줄, `{/* LEFT — currency totals, quick nav */}` div 내부)를 다음으로 교체:

```tsx
      {/* LEFT — 자산군별 합계, quick nav */}
      <div className="space-y-3">
        {krwTotal != null && <CcyTotalTile label="국내주식 합계" value={krwTotal} ccy="KRW" />}
        <CcyTotalTile label="해외주식 합계" value={usdTotal} ccy="USD" />
        {eurTotal != null && <CcyTotalTile label="해외주식 합계 (EUR)" value={eurTotal} ccy="EUR" />}
        {usdcTotal != null && <CcyTotalTile label="코인 합계" value={usdcTotal} ccy="USDC" />}
        {polymarketTotal != null && <CcyTotalTile label="폴리마켓 합계" value={polymarketTotal} ccy="USD" />}
      </div>
```

- [ ] **Step 7: 중앙 컬럼(CENTER) 섹션을 자산군 순서(국내주식→해외주식→코인→폴리마켓)로 재배치**

`app/portfolio/page.tsx`(구 345-398줄, `{/* CENTER — account cards by currency, main workspace */}` div 전체)를 다음으로 교체:

```tsx
      {/* CENTER — 자산군별 계좌 카드, main workspace */}
      <div className="space-y-8 min-w-0">
        <CcySection ccy="KRW" total={krwTotal} label="국내주식">
          {krwAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="KRW"
              balance={a.balance} mode={a.mode} error={a.error}>
              <KISHoldings holdings={a.venue === "kis_mock" ? kisMockHoldings : kisLiveHoldings} />
            </AccountCard>
          ))}
          {krwAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "한투 잔고 조회 중… (최대 30초)" : "국내주식 계좌 없음"}</p>
          )}
        </CcySection>

        <CcySection ccy="USD" total={usdTotal > 0 ? usdTotal : null} label="해외주식">
          {alpacaAcct && (
            <AccountCard label="Alpaca · 미국주식" ccy="USD"
              balance={alpacaAcct.portfolio_value} paper={alpacaAcct.paper}>
              <AlpacaPositions positions={alpacaPositions} />
            </AccountCard>
          )}
          {usdAccounts.filter(a => a.venue !== "alpaca").map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USD"
              balance={a.balance} mode={a.mode} error={a.error} />
          ))}
          {paper && (
            <AccountCard label="LKG 페이퍼 트레이딩" ccy="USD"
              balance={lkgBalance} paper={true}>
              <LkgPaperDetail paper={paper} />
            </AccountCard>
          )}
        </CcySection>

        {eurAccounts.length > 0 && (
          <CcySection ccy="EUR" total={eurTotal} label="해외주식">
            {eurAccounts.map(a => (
              <AccountCard key={a.venue} label={a.label} ccy="EUR"
                balance={a.balance} mode={a.mode} error={a.error} />
            ))}
          </CcySection>
        )}

        <CcySection ccy="USDC" total={usdcTotal} label="코인">
          {usdcAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USDC"
              balance={a.balance} mode={a.mode} error={a.error}>
              <HLPositions positions={a.venue === "hl_testnet" ? hlTestnetPositions : hlMainnetPositions} />
            </AccountCard>
          ))}
          {usdcAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "HL 잔고 조회 중…" : "Hyperliquid 계좌 없음"}</p>
          )}
        </CcySection>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-ap-ink-1 text-sm font-semibold">폴리마켓</span>
            <div className="flex-1 h-px bg-ap-line" />
          </div>
          <PolymarketBots bots={polymarketBots} />
        </div>
      </div>
```

(우측 RIGHT "거래소별 분포" `Card` — 구 400-426줄 — 은 무변경. 통화별 venue 구성비 표는 그대로 유지, 자산군 재편 스코프 밖.)

- [ ] **Step 8: 검증**

```bash
npx tsc --noEmit
npm run dev
```

브라우저로 `http://localhost:3000/portfolio` 열어 확인: 좌측 타일이 국내주식/해외주식/코인/폴리마켓 순, 중앙이 같은 순서의 섹션(국내주식=KRW/KIS, 해외주식=USD+EUR/Alpaca, 코인=USDC/HL, 폴리마켓=새 카드+`/polymarket` 링크), 주문/손익/최적화 탭 정상 동작. dev 서버 확인 후 `Ctrl+C`로 종료.

- [ ] **Step 9: Commit**

```bash
git add app/portfolio/page.tsx
git commit -m "reorganize portfolio AccountsTab from currency axis to asset-class axis"
```

---

### Task 4: `components/hud/PortfolioTab.tsx` 전면 재작성 — 자산군 4타일 요약

**Files:**
- Modify(전면 재작성): `components/hud/PortfolioTab.tsx`

**Interfaces:**
- Consumes: `getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings, getDashboardPnlAll` — 전부 `@/lib/api`의 기존 함수. 타입 `AccountRow, AlpacaPosition, AlpacaAccount, PaperState, HLAssetPosition, KISHolding, DashboardBotRow`(전부 기존, Task 3과 동일 타입 재사용).
- Produces: 없음(리프 컴포넌트, `PortfolioTab` 기본 export만 유지).

- [ ] **Step 1: 파일 전체를 다음으로 교체**

`components/hud/PortfolioTab.tsx` 전체 내용을 다음으로 교체:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getDashboardPnlAll,
  type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type DashboardBotRow,
} from "@/lib/api";
import { LoadingState } from "@/components/ui";

/* 자산군 4타일 요약(국내주식/해외주식/코인/폴리마켓) — 에이전트 전부 미가동 상태라
   에이전트 중심 뷰(listAgents) 대신 실제 보유자산 기준으로 재작성. 상세 종목 리스트는
   여기 안 넣음(그건 /portfolio가 이미 함) — 타일은 합계·수익률만. */

function fmt(v: number | null, ccy: string): string {
  if (v == null) return "—";
  const locale = ccy === "KRW" ? "ko-KR" : "en-US";
  const symbol = ccy === "KRW" ? "₩" : ccy === "USDC" ? "" : "$";
  const suffix = ccy === "USDC" ? " USDC" : "";
  return `${symbol}${v.toLocaleString(locale, { maximumFractionDigits: 0 })}${suffix}`;
}

interface WeightedPart { weight: number; pct: number }
/** 포지션별 return%/P&L%를 포지션 가치로 가중평균 — 계좌 레벨 return% 필드가 없는 벤더 대응 */
function weightedReturnPct(parts: WeightedPart[]): number | null {
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) return null;
  return parts.reduce((s, p) => s + p.pct * p.weight, 0) / totalWeight;
}

function pctLabel(p: number | null): string {
  return p == null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

interface AssetTileData {
  label: string;
  value: number | null;
  ccy: string;
  returnPct: number | null;
  href: string;
}

function AssetTile({ data }: { data: AssetTileData }) {
  const pos = data.returnPct != null && data.returnPct >= 0;
  return (
    <Link href={data.href}
      className="block bg-ap-surface border border-ap-line rounded-xl p-4 no-underline hover:border-ap-ink-3 transition-colors">
      <p className="text-ap-ink-3 text-[10px] uppercase tracking-wide">{data.label}</p>
      <p className="text-ap-ink-1 text-xl font-mono font-bold mt-1">{fmt(data.value, data.ccy)}</p>
      <p className={`text-xs font-mono mt-1 ${data.returnPct == null ? "text-ap-ink-3" : pos ? "text-ap-up" : "text-ap-down"}`}>
        {pctLabel(data.returnPct)}
      </p>
    </Link>
  );
}

export default function PortfolioTab() {
  const [krwHoldings, setKrwHoldings] = useState<KISHolding[]>([]);
  const [krwTotal, setKrwTotal] = useState<number | null>(null);
  const [alpacaAcct, setAlpacaAcct] = useState<AlpacaAccount | null>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [hlPositions, setHlPositions] = useState<HLAssetPosition[]>([]);
  const [usdcTotal, setUsdcTotal] = useState<number | null>(null);
  const [polymarketBots, setPolymarketBots] = useState<DashboardBotRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.allSettled([
      getAlpacaAccount(),
      getAlpacaPositions(),
      getPaperState(),
      getHLPositions(true),
      getHLPositions(false),
      getKisHoldings(true),
      getKisHoldings(false),
      getAccountBalances(),
      getDashboardPnlAll(),
    ]).then(([acctRes, posRes, paperRes, hlTestRes, hlMainRes, kisMockRes, kisLiveRes, balRes, pnlRes]) => {
      if (acctRes.status === "fulfilled") setAlpacaAcct(acctRes.value);
      if (posRes.status === "fulfilled") setAlpacaPositions(posRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);

      const hlAll = [
        ...(hlTestRes.status === "fulfilled" ? hlTestRes.value.asset_positions : []),
        ...(hlMainRes.status === "fulfilled" ? hlMainRes.value.asset_positions : []),
      ];
      setHlPositions(hlAll);

      const krwAll = [
        ...(kisMockRes.status === "fulfilled" ? kisMockRes.value.holdings : []),
        ...(kisLiveRes.status === "fulfilled" ? kisLiveRes.value.holdings : []),
      ];
      setKrwHoldings(krwAll);

      if (balRes.status === "fulfilled") {
        const krwAccounts = balRes.value.accounts.filter(a => a.ccy === "KRW");
        setKrwTotal(krwAccounts.every(a => a.balance == null) ? null
          : krwAccounts.reduce((s, a) => s + (a.balance ?? 0), 0));
        const usdcAccounts = balRes.value.accounts.filter(a => a.ccy === "USDC");
        setUsdcTotal(usdcAccounts.every(a => a.balance == null) ? null
          : usdcAccounts.reduce((s, a) => s + (a.balance ?? 0), 0));
      }

      if (pnlRes.status === "fulfilled") {
        setPolymarketBots(pnlRes.value.bots.filter(b => b.id.startsWith("polymarket")));
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <LoadingState message="포트폴리오 로딩 중…" hint="자산군별 보유내역 집계 — 5~10초 걸립니다" />
      </div>
    );
  }

  const lkgValue = paper ? paper.cash + paper.positions.reduce((s, p) => s + p.value, 0) : null;
  const usdValue = (alpacaAcct?.portfolio_value ?? 0) + (lkgValue ?? 0);
  const usdReturn = weightedReturnPct(
    alpacaPositions.map(p => ({ weight: p.market_value, pct: p.unrealized_plpc * 100 })),
  );

  const krwReturn = weightedReturnPct(
    krwHoldings.filter(h => h.return_pct != null).map(h => ({ weight: h.qty * h.current, pct: h.return_pct as number })),
  );

  const hlReturn = weightedReturnPct(
    hlPositions.map(p => ({
      weight: parseFloat(p.position.positionValue),
      pct: parseFloat(p.position.returnOnEquity) * 100,
    })),
  );

  const polymarketTotal = polymarketBots.length > 0
    ? polymarketBots.reduce((s, b) => s + (b.realized_pnl ?? 0), 0)
    : null;

  const tiles: AssetTileData[] = [
    { label: "국내주식", value: krwTotal, ccy: "KRW", returnPct: krwReturn, href: "/portfolio" },
    { label: "해외주식", value: usdValue, ccy: "USD", returnPct: usdReturn, href: "/portfolio" },
    { label: "코인", value: usdcTotal, ccy: "USDC", returnPct: hlReturn, href: "/portfolio" },
    { label: "폴리마켓", value: polymarketTotal, ccy: "USD", returnPct: null, href: "/polymarket" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-ap-ink-1 tracking-wide">총 포트폴리오</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(t => <AssetTile key={t.label} data={t} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 검증**

```bash
npx tsc --noEmit
npm run dev
```

브라우저로 `http://localhost:3000/hud` 열어 PORTFOLIO 탭(또는 홈 화면 해당 섹션) 확인: 4타일(국내주식/해외주식/코인/폴리마켓)이 합계+수익률 표시, 국내/해외/코인 클릭 시 `/portfolio`, 폴리마켓 클릭 시 `/polymarket`으로 이동. `/agents`로 가는 링크가 이 페이지에 더 이상 없는지 확인(에이전트 카드·"에이전트 상세 →" 버튼 전부 삭제됐어야 함). dev 서버 확인 후 종료.

- [ ] **Step 3: Commit**

```bash
git add components/hud/PortfolioTab.tsx
git commit -m "rewrite hud PortfolioTab from agent-centric view to asset-class summary tiles"
```

---

## 최종 검증 (모든 태스크 완료 후)

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 PASS, pre-existing failure 없음(2026-07-30 기준 전부 수정된 상태 유지). 브라우저 스팟체크: `/hud`(4타일), `/portfolio`(자산군 4섹션 + 주문/손익/최적화 탭), `/agents` 접속 시 404, CommandRail·BottomTabBar에서 ⚙ 버튼으로 SettingsDrawer 열림/킬스위치 토글 정상.
