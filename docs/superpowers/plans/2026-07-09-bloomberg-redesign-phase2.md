# Bloomberg 리디자인 Phase 2 — 전 페이지 롤아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1(`/hud`, `/market`)에서 확립·검증된 블룸버그 터미널 톤(순흑 배경, `<Panel>`/`<PanelHeader>`, 히트맵 틴트 셀)을 나머지 전 페이지에 롤아웃한다.

**Architecture:** 디자인 토큰(`app/globals.css`)과 `--radius-*`=0은 이미 전역 적용되어 모든 페이지가 순흑/각짐을 상속받고 있다(Phase 1에서 검증 완료). Phase 2에서 남은 작업은 각 페이지의 임시방편(ad-hoc) 섹션 래퍼를 공유 `<Panel>`/`<PanelHeader>` 컴포넌트로 교체하고, 손익/등락 등 숫자 표시를 텍스트색상 방식에서 배경틴트 히트맵 셀로 전환하는 것. 새 디자인 결정 없음 — 기존에 승인된 패턴을 그대로 복제.

**Tech Stack:** Next.js App Router, React, TypeScript, TailwindCSS 4 (`@theme` 토큰), `components/ui/Panel.tsx`.

## Global Constraints

- 디자인 토큰만 사용: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`. 원시 hex/rgb 색상 직접 사용 금지.
- `style={{}}` 금지. 예외: 차트 컨테이너 `style={{ height: "Npx" }}`류.
- Raw `fetch` 금지 — 반드시 `lib/api.ts` 함수 사용(이미 각 페이지가 이렇게 되어 있음 — 그대로 유지, 신규 fetch 추가 금지).
- **기존 동작·API 호출·상태 로직·AbortController 패턴은 절대 변경 금지.** 이 Phase는 순수 시각적 리스킨이다. 데이터 흐름, 조건문, 계산 로직은 한 글자도 건드리지 않는다.
- 각 태스크 착수 전, implementer는 대상 파일 전체를 반드시 읽는다(부분 읽기로 구조 파악 없이 편집 금지).
- 변환 대상 판별 기준: 섹션을 감싸는 `<div className="... bg-panel ... border ...">` + 그 안의 헤더용 `<div>`/`<h2>`/`<h3>` 텍스트 — 이 조합이 곧 `<Panel>`+`<PanelHeader>`로 교체될 대상이다. 이미 `<Panel>`/`<PanelHeader>`를 쓰고 있는 부분은 건드리지 않는다.
- 카드 그리드(패딩 큰 카드가 격자로 나열된 형태)는 이번 Phase 범위 밖이다 — 테이블/로우 밀도 전환은 하지 않는다(Phase 1의 `/hud` UnitCard 밀도 전환처럼 레이아웃 자체를 바꾸는 것은 별도 Phase 3 후보). 이번엔 헤더/래퍼 교체 + 숫자 셀 히트맵 틴트만.
- 손익/등락률(%), P&L 등 양/음 부호로 색이 바뀌는 숫자 표시부는 히트맵 틴트로 전환한다(아래 패턴 B).
- 매 태스크 끝에 `npx tsc --noEmit`, `npm test -- --run`(151/151 유지 확인 후 태스크별 증분 확인) 실행, 통과해야 커밋.
- 커밋은 태스크(그룹)별로 1개씩, `main`에 직접.

### 패턴 A — 섹션 래퍼 → `<Panel>`/`<PanelHeader>`

**Before (전형적인 기존 형태 — 파일마다 클래스 디테일은 다를 수 있음, 요지만 동일):**
```tsx
<div className="bg-panel border border-border rounded-lg overflow-hidden">
  <div className="bg-panel-2 px-4 py-2 border-b border-border">
    <h3 className="text-sm font-semibold text-text-1">섹션 제목</h3>
  </div>
  <div className="p-4">
    {/* 기존 콘텐츠 — 절대 변경 금지 */}
  </div>
</div>
```

**After:**
```tsx
import { Panel, PanelHeader } from "@/components/ui/Panel";
// ...
<Panel>
  <PanelHeader>섹션 제목</PanelHeader>
  <div className="p-4">
    {/* 기존 콘텐츠 — 절대 변경 금지 */}
  </div>
</Panel>
```

헤더 우측에 배지/링크/타임스탬프 등 보조 요소가 있었다면 `PanelHeader`의 `right` prop으로 옮긴다:
```tsx
<PanelHeader right={<span className="tabular-nums">{count}건</span>}>섹션 제목</PanelHeader>
```

`PanelHeader`의 `right` 슬롯은 이미 `text-black`이 기본값이라 별도 색상 지정 불필요(오렌지 바탕 대비 확보됨 — `components/ui/Panel.tsx` 참고).

### 패턴 B — 손익/등락 숫자 → 히트맵 틴트 셀

**Before:**
```tsx
<span className={pnl > 0 ? "text-pos" : pnl < 0 ? "text-neg" : "text-text-3"}>
  {pnl.toFixed(2)}%
</span>
```

**After (참고: `app/hud/page.tsx`의 "최근 페이퍼 체결" pnl% 셀, 커밋 `7ba987b`):**
```tsx
<span className={`px-1 font-bold ${
  pnl > 0 ? "bg-pos/20 text-pos" : pnl < 0 ? "bg-neg/20 text-neg" : "text-text-3"}`}>
  {pnl.toFixed(2)}%
</span>
```

ON/OFF, 가동/정지 같은 상태 배지도 동일 원리(참고: `app/hud/page.tsx` `UnitCard`의 ON/OFF 뱃지):
```tsx
<span className={`px-1 font-bold ${running ? "bg-pos/20 text-pos" : "bg-neg/10 text-text-3"}`}>
  {running ? "ON" : "OFF"}
</span>
```

기존 코드에서 이미 조건부로 `text-pos`/`text-neg`/`text-warn`를 쓰고 있는 모든 손익·등락·상태 표시부에 이 틴트 배경을 추가한다. 색상 자체(pos/neg/warn 어느 걸 쓸지)는 기존 조건문 그대로 — 배경 클래스만 덧붙인다.

---

## Task 1: 집행 그룹 (4 파일)

**Files:**
- Modify: `app/lab/execution/page.tsx`
- Modify: `app/lab/tasks/page.tsx`
- Modify: `app/overview/page.tsx`
- Modify: `app/portfolio/page.tsx`

**Interfaces:**
- Consumes: `components/ui/Panel.tsx`(`Panel`, `PanelHeader`) — 이미 존재, import만 하면 됨.

- [ ] **Step 1**: 4개 파일 각각 전체 읽기.
- [ ] **Step 2**: 각 파일에서 패턴 A 대상(섹션 래퍼) 전부 `<Panel>`/`<PanelHeader>`로 교체.
- [ ] **Step 3**: 각 파일에서 패턴 B 대상(손익/등락/상태 숫자) 전부 히트맵 틴트 적용. 이 그룹은 "돈길"이라 특히 꼼꼼히 — 집행 콘솔/포트폴리오의 손익 표시가 핵심.
- [ ] **Step 4**: `npx tsc --noEmit` 통과 확인.
- [ ] **Step 5**: `npm test -- --run` 통과 확인 (151/151 유지).
- [ ] **Step 6**: 커밋.
```bash
git add app/lab/execution/page.tsx app/lab/tasks/page.tsx app/overview/page.tsx app/portfolio/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — 집행 그룹 4페이지"
```

## Task 2: AI 에이전트 그룹 (7 파일)

**Files:**
- Modify: `app/agents/page.tsx`
- Modify: `app/performance/page.tsx`
- Modify: `app/risk-guard/page.tsx`
- Modify: `app/dart-auto/page.tsx`
- Modify: `app/copytrade/page.tsx`
- Modify: `app/vrp/page.tsx`
- Modify: `app/polymarket/page.tsx`

- [ ] **Step 1**: 7개 파일 각각 전체 읽기.
- [ ] **Step 2**: 패턴 A 적용.
- [ ] **Step 3**: 패턴 B 적용 (에이전트별 성과/리스크 숫자 다수 — 꼼꼼히).
- [ ] **Step 4**: `npx tsc --noEmit` 통과.
- [ ] **Step 5**: `npm test -- --run` 통과 (151/151).
- [ ] **Step 6**: 커밋.
```bash
git add app/agents/page.tsx app/performance/page.tsx app/risk-guard/page.tsx app/dart-auto/page.tsx app/copytrade/page.tsx app/vrp/page.tsx app/polymarket/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — AI 에이전트 그룹 7페이지"
```

## Task 3: 리서치 그룹 (5 파일)

**Files:**
- Modify: `app/lab/page.tsx` (⚠️ Jarvis 모션 유지 페이지 — `hud-frame`/`tech-grid`/`scanline-host`/`text-hud`/`hud-glow` 등 시안색 HUD 이펙트는 **절대 제거하지 말 것**. 이 페이지는 Phase 1에서도 의도적으로 손대지 않았음. 이번에도 섹션 래퍼가 순수 `bg-panel`/`border` 조합으로 된 부분만 `<Panel>` 교체 대상이고, Jarvis 이펙트가 걸린 부분은 그대로 둔다.)
- Modify: `app/macro/page.tsx`
- Modify: `app/infra/page.tsx`
- Modify: `app/buyback-doctor/page.tsx`
- Modify: `app/insider/page.tsx`

- [ ] **Step 1**: 5개 파일 각각 전체 읽기.
- [ ] **Step 2**: 패턴 A 적용 (단, `/lab`은 위 경고 준수).
- [ ] **Step 3**: 패턴 B 적용.
- [ ] **Step 4**: `npx tsc --noEmit` 통과.
- [ ] **Step 5**: `npm test -- --run` 통과 (151/151).
- [ ] **Step 6**: 커밋.
```bash
git add app/lab/page.tsx app/macro/page.tsx app/infra/page.tsx app/buyback-doctor/page.tsx app/insider/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — 리서치 그룹 5페이지"
```

## Task 4: 검증 그룹 (10 파일)

**Files:**
- Modify: `app/validation/page.tsx`
- Modify: `app/backtest/page.tsx`
- Modify: `app/backtest/compare/page.tsx`
- Modify: `app/backtest/heatmap/page.tsx`
- Modify: `app/ict/page.tsx`
- Modify: `app/event-study/page.tsx`
- Modify: `app/signal/page.tsx`
- Modify: `app/data-quality/page.tsx`
- Modify: `app/universe/page.tsx`
- Modify: `app/pairs/page.tsx`

- [ ] **Step 1**: 10개 파일 각각 전체 읽기.
- [ ] **Step 2**: 패턴 A 적용.
- [ ] **Step 3**: 패턴 B 적용 (백테스트 수익률/샤프 등 숫자 다수).
- [ ] **Step 4**: `npx tsc --noEmit` 통과.
- [ ] **Step 5**: `npm test -- --run` 통과 (151/151).
- [ ] **Step 6**: 커밋.
```bash
git add app/validation/page.tsx app/backtest/page.tsx app/backtest/compare/page.tsx app/backtest/heatmap/page.tsx app/ict/page.tsx app/event-study/page.tsx app/signal/page.tsx app/data-quality/page.tsx app/universe/page.tsx app/pairs/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — 검증 그룹 10페이지"
```

## Task 5: 마켓 잔여 + 자산군 워크스페이스 그룹 (7 파일)

**Files:**
- Modify: `app/news/page.tsx`
- Modify: `app/calendar/page.tsx`
- Modify: `app/ib/page.tsx`
- Modify: `app/crypto/page.tsx`
- Modify: `app/forex/page.tsx`
- Modify: `app/futures/page.tsx`
- Modify: `app/options/page.tsx`

**참고:** `app/market/page.tsx`와 그 하위 `components/market/ComparisonTab.tsx`는 Phase 1에서 이미 전환 완료 — 손대지 않는다. `crypto`/`forex`/`futures`/`options`는 `/market`과 유사한 자산군 워크스페이스 구조이므로 `ComparisonTab.tsx`의 `<Panel>`/`<PanelHeader>` 적용 방식을 참고 패턴으로 삼는다.

- [ ] **Step 1**: 7개 파일 각각 전체 읽기.
- [ ] **Step 2**: 패턴 A 적용.
- [ ] **Step 3**: 패턴 B 적용.
- [ ] **Step 4**: `npx tsc --noEmit` 통과.
- [ ] **Step 5**: `npm test -- --run` 통과 (151/151).
- [ ] **Step 6**: 커밋.
```bash
git add app/news/page.tsx app/calendar/page.tsx app/ib/page.tsx app/crypto/page.tsx app/forex/page.tsx app/futures/page.tsx app/options/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — 마켓/자산군 그룹 7페이지"
```

## Task 6: 교육 + 기타 그룹 (6 파일)

**Files:**
- Modify: `app/quant/page.tsx`
- Modify: `app/notebooks/page.tsx`
- Modify: `app/learn/options/page.tsx`
- Modify: `app/report/page.tsx`
- Modify: `app/search/page.tsx`
- Modify: `app/experiments/page.tsx`

**참고:** 교육 페이지는 설명/튜토리얼 텍스트 비중이 높다 — 패턴 A(헤더/래퍼)는 그대로 적용하되, 패턴 B(히트맵 틴트)는 실제 손익/등락 숫자가 있는 예제/실습 위젯에만 적용하고 순수 설명 텍스트에는 적용하지 않는다.

- [ ] **Step 1**: 6개 파일 각각 전체 읽기.
- [ ] **Step 2**: 패턴 A 적용.
- [ ] **Step 3**: 해당하는 곳에 패턴 B 적용.
- [ ] **Step 4**: `npx tsc --noEmit` 통과.
- [ ] **Step 5**: `npm test -- --run` 통과 (151/151).
- [ ] **Step 6**: 커밋.
```bash
git add app/quant/page.tsx app/notebooks/page.tsx app/learn/options/page.tsx app/report/page.tsx app/search/page.tsx app/experiments/page.tsx
git commit -m "style: 블룸버그 리디자인 Phase2 — 교육/기타 그룹 6페이지"
```

## Task 7: 최종 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1**: `npx tsc --noEmit` — 전체 에러 없음.
- [ ] **Step 2**: `npm run build` — 전체 라우트 정상 생성.
- [ ] **Step 3**: `npm test -- --run` — 151/151 유지.
- [ ] **Step 4**: 브라우저 샘플 점검 — 그룹당 1페이지씩 최소 6개(`/lab/execution`, `/agents`, `/lab`(Jarvis 모션 살아있는지 필수 확인), `/backtest`, `/crypto`, `/quant`) 오렌지 헤더바 렌더링·레이아웃 정상 확인.
- [ ] **Step 5**: 필요시 최종 수정 커밋.

---

## 범위 밖 (Phase 3 후보)

- 카드그리드 → 테이블 로우 밀도 전환 (Phase 1 `/hud` UnitCard처럼).
- 월드클락 스트립 등 `/hud` 전용 위젯을 다른 페이지로 확장.
- 헤더 색상 다양화(현재 전 패널 오렌지 단색 — 실제 블룸버그는 카테고리별 색 혼합).
- 스파크라인 인라인 삽입 (`app/infra/page.tsx`의 `sparklinePath` 재사용 후보).
