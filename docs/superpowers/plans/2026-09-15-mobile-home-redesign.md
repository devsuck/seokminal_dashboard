# 모바일 홈(`/hud/summary`) 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/hud/summary`(모바일 홈)를 다크 터미널 톤에서 라이트 핀테크 카드 톤으로 재작성하고, 우선순위를 "실거래 상태 먼저"에서 "계좌 성과 요약 먼저"로 재배치한다. 데스크톱(`md:` 이상) 렌더링은 무변경.

**Architecture:** `app/hud/summary/page.tsx`를 `hidden md:block`(기존 다크 마크업 그대로) / `md:hidden`(신규 라이트 마크업) 두 갈래로 분기한다. 신규 마크업은 새 컴포넌트를 만들지 않고 기존 `components/hud/PortfolioTab.tsx`(자산군 3타일+수익률 바차트, 이미 `ap-` 토큰)를 그대로 렌더링하고, 기존 `components/ui/Card.tsx`(`Card`/`CardHeader`)로 실거래 상태·주의 항목 카드를 감싼다. 데이터 페칭은 `useHudFeed()`/`deriveAttentionItems()` 그대로 재사용 — 새 fetch 로직 없음.

**Tech Stack:** Next.js(App Router), React, Tailwind(커스텀 `ap-` 디자인 토큰), TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md`

## Spec과의 차이 (계획 작성 중 발견, 이 계획이 우선)

스펙 §"`/hud/summary`(홈) — 신규 IA"는 "일/주/월 토글 + `lightweight-charts` 누적 수익률 라인차트"를 언급했으나, 실제 코드 조사 결과:

- `lightweight-charts`는 설치돼 있고(`package.json`, `^5.2.1`) `components/charts/TimeSeries.tsx`에서 쓰이지만, 이 컴포넌트는 배경색을 `lib/chart-colors.ts`의 `TOKEN.panel2`(다크 hex 리터럴) 등으로 하드코딩 — 라이트 페이지에 넣으면 "다크 섬"이 됨(스펙이 막으려던 "흰 섬" 문제의 반대 버전). ap- 라이트 변형이 존재하지 않음.
- 누적 수익률(시계열 equity curve)을 위한 과거 스냅샷 데이터 소스가 프론트/백엔드 어디에도 없음(`lib/api.ts` 전수 조사 — `getDashboardPnlAll`은 실현손익 합계일 뿐 시계열 아님, 사용처 0곳).
- 반면 `components/hud/PortfolioTab.tsx`는 이미 자산군별(국내주식/해외주식/코인) 타일 + `BarChart`(수평 막대, `ap-` 토큰 기반, `/hud` 페이지에서 이미 검증됨)로 "자산군별 수익률" 비교를 제공 — spec이 요구한 "전체 계좌 성과 요약(그래프)"을 새 코드 없이 이미 만족.

**결정(룰링):** 신규 라인차트/토글 만들지 않음. `<PortfolioTab />`을 그대로 렌더링해 "성과 요약" 섹션으로 쓴다. 시계열 누적 그래프는 백엔드에 과거 스냅샷 저장이 생기면 별도 계획으로 추가 — 이번 계획 범위 밖.

또한 스펙의 "`.rail-ap` 전체 페이지 래핑"은 `.rail-ap`가 실제로는 `--c-*` CSS 변수 네임스페이스만 리매핑(`CommandRail`/`BottomTabBar`가 `var(--c-*)`를 직접 쓰는 경우용, `app/globals.css:90-106`)하고, `bg-ap-surface` 등 `ap-` Tailwind 유틸리티는 `--color-ap-*`가 `@theme` 최상위에 선언돼 있어 이미 무조건 라이트 — 새로 작성하는 마크업이 `ap-` 유틸만 쓴다면 `.rail-ap` 래핑은 불필요(무해하지만 아무 효과 없음). 이 계획은 `.rail-ap`를 쓰지 않는다.

## Global Constraints

- 디자인 토큰: 신규 마크업은 `ap-` 계열만 사용(`bg-ap-bg/surface`, `border-ap-line`, `text-ap-ink-1/2/3`, `text-ap-brand/up/down/caution/note`) — `bg-panel`/`text-text-*`/`border-border` 등 다크 토큰 신규 마크업에 쓰지 말 것.
- 기존 다크 마크업(데스크톱 브랜치)은 한 글자도 바꾸지 않음 — 그대로 `hidden md:block`에 옮기기만.
- Raw `fetch` 금지, `lib/api.ts`/`lib/attention.ts` 기존 함수만 사용 — 이 태스크는 새 API 호출을 추가하지 않음(전부 재사용).
- `style={{}}` 금지(차트 컨테이너 height 예외 — 이 태스크는 새 차트를 만들지 않으므로 해당 없음).
- Python/백엔드 무관 — 이 계획은 프론트엔드 전용, 백엔드 변경 없음.
- 테스트: `npx tsc --noEmit`, `npm run build`, `npm test`(vitest) 모두 통과. 이 태스크는 새 순수 로직 함수를 추가하지 않으므로(기존 `deriveAttentionItems`/`useHudFeed` 그대로 재사용) 신규 vitest 테스트 파일은 불필요 — 기존 `tests/lib/attention.test.ts`가 이미 그 로직을 커버함. 시각 검증은 수동(devtools 모바일 뷰포트).

---

### Task 1: `/hud/summary` 모바일 라이트 IA 재작성

**Files:**
- Modify: `app/hud/summary/page.tsx` (전체 95줄 재작성 — 기존 로직 보존, JSX만 분기)

**Interfaces:**
- Consumes:
  - `useHudFeed()` — `@/components/hud/useHudFeed`, 반환 `{ feed: HudFeed, bal: AccountBalances | null }`. `HudFeed`는 `lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, health, fleet, pipeline, risk, ios` 필드(전부 nullable) — 기존 파일 그대로 구조분해해서 씀, 타입 변경 없음.
  - `deriveAttentionItems(input: AttentionInput): AttentionItem[]` — `@/lib/attention`. `AttentionItem = { id: string; label: string; detail: string; href: string; tone: "neg"|"warn"|"info" }`.
  - `PortfolioTab` — `@/components/hud/PortfolioTab` default export, props 없음(`<PortfolioTab />`), 내부에서 자체 폴링(30초 간격, 8개 엔드포인트) — 이 태스크에서 호출부만 추가, 컴포넌트 자체는 무변경.
  - `Card`, `CardHeader` — `@/components/ui/Card`named export. `Card({children, className?})`, `CardHeader({children, right?})`.
- Produces: 없음(리프 페이지, 다른 태스크가 이 파일을 import하지 않음).

- [ ] **Step 1: 현재 파일 백업 확인 후 새 내용으로 교체**

`app/hud/summary/page.tsx` 전체를 아래 내용으로 교체한다(주석의 다크 토큰 전용 설명 문구는 이제 데스크톱 브랜치에만 해당하므로 갱신):

```tsx
"use client";

import Link from "next/link";
import { useHudFeed } from "@/components/hud/useHudFeed";
import { deriveAttentionItems } from "@/lib/attention";
import PortfolioTab from "@/components/hud/PortfolioTab";
import { Card, CardHeader } from "@/components/ui/Card";

/* 폰 전용 요약 — 에이전틱 트레이딩 AI가 아는 걸 전부 보여주지 않고,
   사람이 봐야만 하는 것만: 성과 요약, 가동 여부, 실거래(LIVE) 게이트, 판단 필요 항목, 정합성 에러.
   나머지(유닛 로스터, 계좌 상세, 로그)는 /hud 전체 대시보드로 위임.
   데스크톱(md: 이상)은 기존 Dark Institutional 마크업 그대로(hidden md:block).
   모바일(md:hidden)은 ap-* 라이트 카드 토큰 — 2026-09-15 모바일 리디자인. */
export default function HudSummaryPage() {
  const { feed: f } = useHudFeed();
  const { lab, jarvis, sys, exec, health, pipeline, risk, ar, ios } = f;

  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);
  const liveOn = jarvis?.live_execution === "enabled";
  const liveLabel = jarvis?.live_execution === "enabled" ? "가동" : jarvis?.live_execution === "disabled" ? "비활성" : "—";
  const wd = sys?.research_service?.watchdog;
  const critical = wd?.critical || exec?.arm_decision?.decision === "KILL";

  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
  });

  return (
    <>
      {/* ── 데스크톱(md 이상): 기존 다크 마크업, 무변경 ── */}
      <div className="hidden md:block flex-col gap-3 p-4 pt-8 max-w-md mx-auto">
        <div className="px-1 text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">SEOKMINAL · 요약</div>

        <div className={`flex flex-col items-center justify-center gap-2 py-8 border ${
          liveOn ? "border-pos/50 bg-pos/10" : "border-border bg-panel"}`}>
          <span className={`w-3 h-3 rounded-full ${liveOn ? "bg-pos" : "bg-text-3"}`} />
          <span className={`text-3xl font-bold tracking-wide ${liveOn ? "text-pos" : "text-text-2"}`}>
            실거래 {liveLabel}
          </span>
        </div>

        {critical && (
          <div className="flex items-center gap-2 px-3 py-2.5 border border-neg/50 bg-neg/10">
            <span className="w-2 h-2 rounded-full bg-neg shrink-0" />
            <span className="text-sm font-bold text-neg">
              {wd?.critical && exec?.arm_decision?.decision === "KILL" ? "감시견 경보 · ARM 중단" : wd?.critical ? "감시견 경보" : "ARM 중단"}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 px-1 text-xs text-text-3">
          <span>
            상태 ▸ <span className={busy ? "text-accent" : active ? "text-pos" : "text-text-2"}>
              {busy ? "처리 중" : active ? "가동 중" : "대기"}
            </span>
          </span>
          <span className="text-text-3">·</span>
          <span>
            정합성 ▸ <span className={(health?.n_errors ?? 0) > 0 ? "text-neg" : health ? "text-pos" : "text-text-3"}>
              {health ? (health.ok ? "이상없음" : `오류 ${health.n_errors}`) : "로딩 중"}
            </span>
          </span>
        </div>

        <div className="border border-border bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-text-2">판단 필요</span>
            <span className="text-[11px] text-text-3 tabular-nums">{attentionItems.length}건</span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="px-3 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pos shrink-0" />
              <span className="text-sm text-text-2">판단 대기 항목 없음</span>
            </div>
          ) : (
            <div>
              {attentionItems.map((it) => (
                <Link key={it.id} href={it.href} className="flex items-start gap-2.5 border-b border-border px-3 py-3 no-underline last:border-b-0 active:opacity-70">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${it.tone === "neg" ? "bg-neg" : it.tone === "warn" ? "bg-warn" : "bg-info"}`} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-text-1">{it.label}</span>
                    <span className="text-xs text-text-3">{it.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/hud" className="block text-center text-sm text-text-3 no-underline active:opacity-70">
          전체 대시보드 →
        </Link>
      </div>

      {/* ── 모바일(md:hidden): 신규 라이트 카드 IA ── */}
      <div className="md:hidden bg-ap-bg min-h-screen">
        <div className="px-4 pt-8 pb-1 max-w-md mx-auto">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-ap-ink-3">SEOKMINAL · 요약</span>
        </div>

        <PortfolioTab />

        <div className="flex flex-col gap-3 px-4 pb-4 max-w-md mx-auto">
          <div className={`flex flex-col items-center justify-center gap-2 py-8 rounded-ap-lg border ${
            liveOn ? "border-ap-up/50 bg-ap-up/10" : "border-ap-line bg-ap-surface"}`}>
            <span className={`w-3 h-3 rounded-full ${liveOn ? "bg-ap-up" : "bg-ap-ink-3"}`} />
            <span className={`text-3xl font-bold tracking-wide ${liveOn ? "text-ap-up" : "text-ap-ink-2"}`}>
              실거래 {liveLabel}
            </span>
          </div>

          {critical && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-ap-lg border border-ap-down/50 bg-ap-down/10">
              <span className="w-2 h-2 rounded-full bg-ap-down shrink-0" />
              <span className="text-sm font-bold text-ap-down">
                {wd?.critical && exec?.arm_decision?.decision === "KILL" ? "감시견 경보 · ARM 중단" : wd?.critical ? "감시견 경보" : "ARM 중단"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 px-1 text-xs text-ap-ink-3">
            <span>
              상태 ▸ <span className={busy ? "text-ap-brand" : active ? "text-ap-up" : "text-ap-ink-2"}>
                {busy ? "처리 중" : active ? "가동 중" : "대기"}
              </span>
            </span>
            <span className="text-ap-ink-3">·</span>
            <span>
              정합성 ▸ <span className={(health?.n_errors ?? 0) > 0 ? "text-ap-down" : health ? "text-ap-up" : "text-ap-ink-3"}>
                {health ? (health.ok ? "이상없음" : `오류 ${health.n_errors}`) : "로딩 중"}
              </span>
            </span>
          </div>

          <Card>
            <CardHeader right={`${attentionItems.length}건`}>판단 필요</CardHeader>
            {attentionItems.length === 0 ? (
              <div className="px-3 py-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ap-up shrink-0" />
                <span className="text-sm text-ap-ink-2">판단 대기 항목 없음</span>
              </div>
            ) : (
              <div>
                {attentionItems.map((it) => (
                  <Link key={it.id} href={it.href} className="flex items-start gap-2.5 border-b border-ap-line px-3 py-3 no-underline last:border-b-0 active:opacity-70">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${it.tone === "neg" ? "bg-ap-down" : it.tone === "warn" ? "bg-ap-caution" : "bg-ap-note"}`} />
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm text-ap-ink-1">{it.label}</span>
                      <span className="text-xs text-ap-ink-3">{it.detail}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Link href="/hud" className="block text-center text-sm text-ap-ink-3 no-underline active:opacity-70">
            전체 대시보드 →
          </Link>
        </div>
      </div>
    </>
  );
}
```

주의: 데스크톱 브랜치 최상위 div의 `hidden md:block`은 Tailwind에서 `display`를 `none`→`block`으로만 바꾸고 `flex`는 무시된다 — 원본이 `flex flex-col gap-3 ...`였던 걸 `hidden md:block flex-col gap-3 ...`로 옮기면 `md:` 접두 없는 `flex-col`/`gap-3`가 여전히 적용되지만 `display: flex`가 빠져 `flex-col`(= `flex-direction: column`)이 효과 없어진다. 고쳐서: 데스크톱 브랜치는 `hidden md:flex md:flex-col gap-3 p-4 pt-8 max-w-md mx-auto`로 쓸 것(위 코드 블록의 실제 className을 이렇게 수정해서 적용 — 이 단락이 코드 블록보다 우선, Step 2에서 재확인).

- [ ] **Step 2: className 정정 재확인**

Step 1에서 작성한 파일을 열어 데스크톱 브랜치 최상위 `<div>`의 className이
`"hidden md:flex md:flex-col gap-3 p-4 pt-8 max-w-md mx-auto"`인지 확인하고
아니면 고친다(`hidden md:block flex-col ...`으로 잘못 썼다면 수정).

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건. `PortfolioTab`/`Card`/`CardHeader` import 경로 오타나 props 불일치가 있으면 여기서 잡힘.

- [ ] **Step 4: 빌드**

Run: `npm run build`
Expected: 빌드 성공, `/hud/summary` 라우트 정상 생성.

- [ ] **Step 5: 기존 테스트 회귀 확인**

Run: `npm test`
Expected: 전부 PASS(`tests/lib/attention.test.ts` 포함) — 이 태스크가 `lib/attention.ts` 로직 자체는 건드리지 않았으므로 그대로 통과해야 함.

- [ ] **Step 6: 수동 뷰포트 확인**

```bash
npm run dev
```
브라우저(또는 Chrome devtools 디바이스 툴바, iPhone 12/SE 폭)에서 `http://localhost:3000/hud/summary` 접속:
- 모바일 폭(< 768px): 흰 배경, 상단에 "SEOKMINAL·요약" 라벨 → `PortfolioTab`의 자산군 3타일+막대차트 → 실거래 상태 카드 → (critical 있으면 경보) → 상태/정합성 텍스트 → "판단 필요" 카드 → "전체 대시보드 →" 링크 순으로 보이는지 확인. 어두운 배경/카드가 하나도 없어야 함(=구 다크 토큰 잔존 없음).
- 데스크톱 폭(≥ 768px): 기존과 완전히 동일한 다크 레이아웃인지 확인(diff 없이 그대로).
- 브라우저 콘솔에 새 에러 없는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add app/hud/summary/page.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): rebuild /hud/summary as light fintech-card home

모바일 홈 우선순위를 실거래상태→성과요약에서 성과요약(PortfolioTab 재사용)
우선으로 재배치. ap- 토큰 기반 라이트 카드 UI로 전환, 데스크톱은 무변경
(hidden md:flex 분기). 신규 fetch/컴포넌트 없음 — 전부 기존 자산 재사용.

Spec: docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md
EOF
)"
```

---

## 남은 라우트 (별도 계획)

스펙의 나머지 6개 라우트(`/portfolio`, `/investment-os`, `/performance`,
`/research-os/{validation,governance,chat}`)는 각각 독립적인 서브프로젝트로
분리한다 — `investment-os`(905줄), `validation`(532줄), `governance`(448줄)는
파일당 조사·설계량이 이 홈 태스크 하나와 맞먹거나 커서, 한 계획에 묶으면
플레이스홀더 없이 정확한 마크업을 다 박아넣기 어렵다. 이 홈 계획이
구현·리뷰까지 끝난 뒤, 라우트별로(또는 "이미 ap- 토큰이라 감사만 필요한
portfolio/performance" 묶음 하나 + "다크→라이트 신규 카드화가 필요한
investment-os/research-os 3개" 각각) writing-plans를 다시 돌려 계획을
따로 쓴다.
