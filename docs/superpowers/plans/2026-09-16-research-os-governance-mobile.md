# research-os/governance 모바일 카드 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app/(console)/research-os/governance/page.tsx`의 4개 탭(투자위원회/설명가능성/지식그래프/타임라인)에 모바일(`<768px`) 전용 라이트 카드 마크업을 추가한다. 데스크톱(`≥768px`)은 완전히 무변경.

**Architecture:** `GovernanceInner`는 기존 `TabBar`를 `hidden md:block`으로 감싸고, `ValidationInner`(이전 라우트)와 동일한 sticky 탭필 셸을 `md:hidden`으로 신규 추가한다. 4개 탭 컴포넌트(`CommitteeTab`/`ExplainTab`/`GraphTab`/`TimelineTab`) 각각 기존 `return`을 `hidden md:block`으로 감싸고, `md:hidden` 형제 브랜치에 `ApPanel`/`ApPanelHead`/`ApBadge`/`ApDot`/`ApSkeleton*` 기반 카드 마크업을 추가한다.

`GraphTab`만 구조적 재해석이 필요하다: 데스크톱의 SVG 노드-엣지 다이어그램은 좁은 모바일 폭에 맞지 않는다. 모바일 브랜치는 SVG를 그리지 않고 노드를 타입별 색 점 + 라벨의 세로 리스트로 렌더한다. 노드 탭 시 연결된 노드를 배경 틴트로 강조(숨기지 않음 — 정보 손실 방지). 이 재해석은 스펙의 "각자 필요한 카드 형태로 개별 작성, 억지 추상화 금지" 원칙에 따른 것이며 스펙 자체가 명시한 내용은 아니므로 Task 3에서 결정한 것으로 기록한다.

**Tech Stack:** Next.js (App Router), React, Tailwind, `components/ui/ApPrimitives.tsx`(기존, 무변경), `lib/console-api.ts`(기존, 무변경).

**Spec:** `docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md`

## Global Constraints

- `components/ui/ApPrimitives.tsx`가 유일한 모바일 프리미티브 소스. `ApPanel`/`ApPanelHead`/`ApDot`/`ApStatTile`/`ApBadge`/`ApSkeleton`/`ApSkeletonStatTile`/`ApSkeletonLines`/`ApMeter`만 사용, 신규 프리미티브 만들지 않음.
- 데스크톱 브랜치(`hidden md:block`)는 기존 코드를 감싸기만 한다 — 내부 JSX/로직 단 한 글자도 바꾸지 않는다.
- `app/(console)/layout.tsx`가 `(console)` 라우트 전체를 이미 `.rail-ap`로 감싸고 있어(`app/globals.css:88-107`) `--c-*` → `--color-ap-*` 리맵이 전역 적용됨. 즉 데스크톱도 이미 라이트로 렌더된다 — 이번 작업은 dark→light 변환이 아니라 레이아웃/밀도 재구성이다. 따라서 기존 raw `var(--c-*)` 톤맵(`STANCE`, `CONF`, `TYPE_TONE`, `STAGE_TONE`, `CONF_C`)은 새 정의 없이 모바일 브랜치에서 그대로 재사용 가능 — `ApDot`의 `tone` prop은 `keyof AP_TONE | string`이라 raw `var(--c-pos)` 같은 값을 그대로 받아 렌더한다(`AP_TONE[tone] ?? tone` 폴백). `ApBadge`의 `tone`은 `keyof AP_TONE`으로 제한되므로 `"pos"|"neg"|"warn"|"hud"|"info"|"mute"` 중 하나만 넘긴다 — `CONF`(`HIGH→pos,MEDIUM→hud,LOW→warn`)와 `data.confidence` 3분기 삼항식은 이미 이 값들만 반환하므로 그대로 재사용.
- 터치 타겟: 폼 제출 버튼·탭필 버튼은 `h-11` 최소.
- 텍스트 스케일: 숫자/`font-data` 필드 포함 리스트 행은 기본 `text-xs`(11px) 이상. **이전 라우트(research-os/validation)에서 `text-[11px]`를 브리프에 반복 사용해 리뷰에서 9건 마이너 파킹이 누적됐다 — 이번 플랜은 처음부터 `text-xs` 유틸리티 클래스를 쓴다(임의 `text-[11px]` 금지, 캡션/케이스 필요 시만 예외).**
- 리스트 행 컨테이너: `bg-ap-bg rounded-ap-md p-2.5` 컨벤션(해당하는 곳에).
- `main` 브랜치에 직접 커밋 (프로젝트 컨벤션 — worktree 없음).
- 각 태스크 종료 시 `npx tsc --noEmit` 통과 확인.

---

## Task 1: `GovernanceInner` 모바일 탭필 셸 + `CommitteeTab` 모바일 카드 브랜치

**Files:**
- Modify: `app/(console)/research-os/governance/page.tsx:1` (import 추가)
- Modify: `app/(console)/research-os/governance/page.tsx:33-135` (`CommitteeTab`)
- Modify: `app/(console)/research-os/governance/page.tsx:424-440` (`GovernanceInner`)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 파일 상단 `Ap*` import — Task 2·3의 `ExplainTab`/`GraphTab`/`TimelineTab` 모바일 브랜치가 동일 import를 재사용한다.

- [ ] **Step 1: Ap* import 추가**

`app/(console)/research-os/governance/page.tsx:1-12` 상단 import 블록에 아래를 추가한다 (기존 import 순서/내용 무변경, 새 줄만 삽입):

```tsx
import {
  ApPanel, ApPanelHead, ApDot, ApBadge,
  ApSkeletonStatTile, ApSkeletonLines,
} from "@/components/ui/ApPrimitives";
```

(플랜 전체 3개 태스크에서 실제로 쓰는 프리미티브만 임포트한다 — `ApStatTile`/`ApMeter`/`ApSkeleton`은 이 라우트에 쓰이지 않으므로 넣지 않는다.)

- [ ] **Step 2: `CommitteeTab` 데스크톱 반환을 `hidden md:block`으로 감싸고 모바일 브랜치 추가**

`app/(console)/research-os/governance/page.tsx:46-134`의 `return ( <div className="min-h-full"> ... </div> );` 전체를 아래로 교체한다 (기존 `<div className="min-h-full">...</div>` 내부는 원문 그대로, 바깥 래핑만 추가):

```tsx
  return (
    <>
      <div className="hidden md:block min-h-full">
        {/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}
      </div>

      <div className="md:hidden min-h-full">
        <div className="px-4 py-3 space-y-3">
          <ApPanel className="p-4">
            <div className="text-[13px] font-semibold text-ap-ink-1">어떤 논제를 심의할까요?</div>
            <div className="mt-1 text-xs text-ap-ink-2 leading-relaxed">
              투자 논제를 입력하면 7관점 협의체가 찬반 근거를 조직하고 Decision Memo 패킷을 만듭니다. 위원회는 증거만 조직할 뿐, 최종 결정·집행은 사람이 합니다.
            </div>
            <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="mt-3 flex flex-col gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 모멘텀 전략을 배포해야 하는가?"
                className="w-full bg-ap-bg border border-ap-line rounded-ap-md px-3.5 h-11 text-[13px] text-ap-ink-1 outline-none focus:border-ap-brand" />
              <button type="submit" disabled={loading}
                className="h-11 rounded-ap-md text-[13px] font-semibold text-white bg-ap-brand disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2">
                {loading && <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {loading ? "소집 중…" : "소집"}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-xs text-ap-ink-3 uppercase tracking-[0.14em] mr-1 self-center">예시</span>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => submit(ex)} disabled={loading}
                  className="px-2.5 py-1.5 rounded-ap-sm text-xs text-ap-ink-2 border border-ap-line bg-ap-bg disabled:opacity-40">
                  {ex}
                </button>
              ))}
            </div>
          </ApPanel>

          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {loading && !council && (
            <div className="space-y-3">
              <ApSkeletonStatTile />
              <ApPanel className="p-4"><ApSkeletonLines rows={4} /></ApPanel>
            </div>
          )}

          {council && memo && (
            <div className="space-y-3">
              <ApPanel>
                <ApPanelHead kicker="P90 · 7가지 관점" title="협의회" right={<ApBadge tone="hud">{council.recommendation?.split("—")[0]?.trim()}</ApBadge>} />
                <div className="p-4 space-y-2">
                  {(council.lenses ?? []).map((ln, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5 border-b border-ap-line last:border-0">
                      <ApDot tone={STANCE[ln.stance] ?? "var(--c-text-3)"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-ap-ink-1">{ln.lens}</span>
                          <span className="text-xs font-data uppercase text-ap-ink-3" title={ln.stance}>{STANCE_LABEL[ln.stance] ?? ln.stance}</span>
                        </div>
                        <div className="text-xs text-ap-ink-2">{ln.rationale}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ApPanel>

              <ApPanel>
                <ApPanelHead kicker="위원회 패킷" title={q} />
                <div className="p-4 space-y-3">
                  <div className="text-[13px] font-medium text-ap-brand">{memo.recommendation}</div>
                  <div className="space-y-1">
                    <div className="text-xs tracking-[0.2em] text-ap-up uppercase">지지 근거</div>
                    {(memo.supporting_arguments ?? []).map((a, i) => <div key={i} className="text-xs text-ap-ink-2">· <b>{a.lens}</b> {a.rationale}</div>)}
                    {(memo.supporting_arguments ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs tracking-[0.2em] text-ap-caution uppercase">반박 근거</div>
                    {(memo.counter_arguments ?? []).map((a, i) => <div key={i} className="text-xs text-ap-ink-2">· <b>{a.lens}</b> {a.rationale}</div>)}
                    {(memo.counter_arguments ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                  </div>
                </div>
              </ApPanel>

              <ApPanel>
                <ApPanelHead kicker="리스크" title="분석" />
                <div className="p-4 space-y-1">
                  <div className="text-xs text-ap-ink-1">{memo.risk_summary?.label}</div>
                  <div className="text-xs text-ap-ink-2">주요 리스크: {memo.risk_summary?.main_risk} · 신뢰도 {memo.risk_summary?.confidence}</div>
                </div>
              </ApPanel>

              <ApPanel>
                <ApPanelHead kicker="공백" title="남은 미지수" />
                <div className="p-4 space-y-1">
                  {(memo.remaining_unknowns ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                  {(memo.remaining_unknowns ?? []).map((u, i) => <div key={i} className="text-xs text-ap-caution">· {u}</div>)}
                </div>
              </ApPanel>

              <div className="rounded-ap-md bg-ap-bg border border-ap-line p-3 text-xs text-ap-ink-3 leading-relaxed">
                위원회는 증거를 조직합니다. 결정·이유·시각은 사람이 입력하고 기존 감사(rwf_runs)에 기록됩니다. 엔진은 승인/집행하지 않습니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
```

`{/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}` 자리에는 원본 `page.tsx:47-132`의 `<PageHeader .../>`부터 `{loading && !council && (...)}` 블록까지 전체를 그대로 붙여넣는다 (한 글자도 바꾸지 않음).

- [ ] **Step 3: `GovernanceInner` — `TabBar`를 `hidden md:block`으로 감싸고 모바일 탭필 셸 추가**

`app/(console)/research-os/governance/page.tsx:431-439`를 아래로 교체:

```tsx
    <div className="min-h-full">
      <div className="hidden md:block">
        <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      </div>
      <div className="md:hidden sticky top-0 z-10 bg-ap-bg/90 backdrop-blur border-b border-ap-line px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`h-11 px-4 rounded-ap-md text-xs font-semibold whitespace-nowrap border shrink-0 ${
                tab === t.key ? "bg-ap-brand text-white border-ap-brand" : "bg-ap-surface text-ap-ink-2 border-ap-line"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "committee" && <CommitteeTab />}
      {tab === "explain" && <ExplainTab />}
      {tab === "graph" && <GraphTab />}
      {tab === "timeline" && <TimelineTab />}
    </div>
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(console)/research-os/governance/page.tsx"
git commit -m "feat(research-os/governance): 모바일 셸 + 투자위원회 탭 카드 마크업 추가"
```

---

## Task 2: `ExplainTab` 모바일 카드 브랜치

**Files:**
- Modify: `app/(console)/research-os/governance/page.tsx:140-270` (`ExplainTab`)

**Interfaces:**
- Consumes: Task 1의 `Ap*` import.
- Produces: 없음 (독립 탭).

- [ ] **Step 1: `ExplainTab` 데스크톱 반환을 `hidden md:block`으로 감싸고 모바일 브랜치 추가**

`app/(console)/research-os/governance/page.tsx:156-269`의 `return ( <div className="min-h-full"> ... </div> );`를 아래로 교체 (내부는 원문 그대로 유지):

```tsx
  return (
    <>
      <div className="hidden md:block min-h-full">
        {/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}
      </div>

      <div className="md:hidden min-h-full">
        <div className="px-4 py-3 space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="결론을 설명할 주제… (예: momentum)"
              className="flex-1 bg-ap-bg border border-ap-line rounded-ap-md px-3.5 h-11 text-[13px] text-ap-ink-1 outline-none focus:border-ap-brand" />
            <button type="submit" disabled={loading || !q.trim()}
              className="px-4 h-11 rounded-ap-md text-xs font-semibold tracking-wide uppercase text-ap-brand border border-ap-brand/40 bg-ap-brand/10 disabled:opacity-40">
              {loading ? "…" : "설명"}
            </button>
          </form>

          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {loading && !data && (
            <div className="space-y-3">
              <ApSkeletonStatTile />
              <ApPanel className="p-4"><ApSkeletonLines rows={4} /></ApPanel>
            </div>
          )}

          {data && data.chain.length > 0 && (
            <div className="space-y-3">
              <ApPanel>
                <ApPanelHead kicker="증거 사슬" title="질문 → 권고"
                  right={<ApBadge tone={data.confidence === "HIGH" ? "pos" : data.confidence === "LOW" ? "warn" : "hud"} title={data.confidence}>신뢰도 {CONF_LABEL[data.confidence ?? ""] ?? data.confidence}</ApBadge>} />
                <div className="p-3">
                  {data.chain.map((n, i) => {
                    const active = i === sel;
                    const isLast = i === data.chain.length - 1;
                    const c = isLast ? CONF_C(data.confidence) : "var(--c-hud)";
                    return (
                      <div key={i} className="relative">
                        <button onClick={() => setSel(i)}
                          className={`w-full text-left flex items-start gap-3 p-2.5 rounded-ap-md border ${active ? "" : "border-transparent"}`}
                          style={active ? { borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` } : undefined}>
                          <ApDot tone={c} pulse={active} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold" style={{ color: active ? c : "var(--color-ap-ink-1)" }}>{n.stage}</div>
                            <div className="text-xs text-ap-ink-3 truncate">{n.label}</div>
                          </div>
                        </button>
                        {!isLast && <div className="ml-6 h-3 w-px bg-ap-line" />}
                      </div>
                    );
                  })}
                </div>
              </ApPanel>

              {node && (
                <ApPanel>
                  <ApPanelHead kicker={`노드 ${sel + 1}/${data.chain.length}`} title={node.stage} />
                  <div className="p-4 space-y-2">
                    <div className="text-[13px] text-ap-ink-1">{node.label}</div>
                    {(node.refs ?? []).length > 0 && (
                      <div className="pt-1">
                        <div className="text-xs tracking-[0.2em] text-ap-ink-3 uppercase mb-1">참조</div>
                        {node.refs!.map((r, i) => <span key={i} className="inline-block mr-1.5 mb-1 text-xs font-data text-ap-brand">{r}</span>)}
                      </div>
                    )}
                  </div>
                </ApPanel>
              )}

              <ApPanel>
                <ApPanelHead kicker="신뢰도" title="분해" />
                <div className="p-4 space-y-1.5">
                  {Object.entries(data.confidence_breakdown ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-ap-line last:border-0">
                      <span className="text-xs text-ap-ink-3">{k.replace(/_/g, " ")}</span>
                      <span className="text-xs font-data text-ap-ink-1">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </ApPanel>

              <ApPanel>
                <ApPanelHead kicker="이유" title="이 결론인 이유" />
                <div className="p-4 text-xs text-ap-ink-2 leading-relaxed">{data.why_this_conclusion}</div>
              </ApPanel>
              <ApPanel>
                <ApPanelHead kicker="이유" title="틀릴 수 있는 이유" />
                <div className="p-4 space-y-1">
                  {(data.why_it_may_be_wrong ?? []).map((w, i) => <div key={i} className="text-xs text-ap-caution">· {w}</div>)}
                </div>
              </ApPanel>
              <ApPanel>
                <ApPanelHead kicker="대안" title="대안적 관점" />
                <div className="p-4 space-y-1">
                  {(data.alternative_interpretations ?? []).map((a, i) => <div key={i} className="text-xs text-ap-ink-2">· {a}</div>)}
                </div>
              </ApPanel>
              <ApPanel>
                <ApPanelHead kicker="공백" title="누락된 증거" />
                <div className="p-4 space-y-1">
                  {(data.missing_evidence ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                  {(data.missing_evidence ?? []).map((m, i) => <div key={i} className="text-xs text-ap-down">· {m}</div>)}
                </div>
              </ApPanel>
              <div className="text-xs text-ap-ink-3 px-1">증거 사슬 — 블랙박스 결정이 아니라 추적 가능한 근거. 최종 결정은 사람.</div>
            </div>
          )}

          {!data && !loading && (
            <ApPanel className="p-8 text-center text-[13px] text-ap-ink-3">
              주제를 입력하면 Experiment → Validation → Failure → Memory → Council → Portfolio → Risk → Recommendation 증거 사슬을 시각화합니다.
            </ApPanel>
          )}
        </div>
      </div>
    </>
  );
```

`{/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}` 자리에는 원본 `page.tsx:157-267`을 그대로 붙여넣는다.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(console)/research-os/governance/page.tsx"
git commit -m "feat(research-os/governance): 설명가능성 탭 카드 마크업 추가"
```

---

## Task 3: `GraphTab` (리스트 재해석) + `TimelineTab` 모바일 카드 브랜치

**Files:**
- Modify: `app/(console)/research-os/governance/page.tsx:281-353` (`GraphTab`)
- Modify: `app/(console)/research-os/governance/page.tsx:370-422` (`TimelineTab`)

**Interfaces:**
- Consumes: Task 1의 `Ap*` import.
- Produces: 없음 (마지막 태스크).

**설계 결정 (구현자는 그대로 따를 것, 재판단 불필요):** 데스크톱 `GraphTab`은 SVG로 노드-엣지를 좌표 배치해 그린다 — 좁은 모바일 폭에서 가독 불가. 모바일 브랜치는 SVG를 그리지 않고 `data.nodes`를 타입 점 색상 + 라벨의 세로 리스트로 렌더한다. 행 탭 시 `sel` 상태(기존 desktop과 동일한 `useState`)를 갱신 — 선택된 노드와 연결된 노드는 `bg-ap-brand/10` 틴트로 강조, 나머지는 그대로 둔다(숨기거나 흐리게 하지 않음 — 리스트에서 항목을 지우면 필터링과 혼동되므로 강조만).

- [ ] **Step 1: `GraphTab` 데스크톱 반환을 `hidden md:block`으로 감싸고 모바일 브랜치 추가**

`app/(console)/research-os/governance/page.tsx:302-352`의 `return ( <div className="min-h-full"> ... </div> );`를 아래로 교체 (내부는 원문 그대로 유지):

```tsx
  return (
    <>
      <div className="hidden md:block min-h-full">
        {/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}
      </div>

      <div className="md:hidden min-h-full">
        <div className="px-4 py-3 space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주제로 필터…"
              className="flex-1 bg-ap-bg border border-ap-line rounded-ap-md px-3.5 h-11 text-[13px] text-ap-ink-1 outline-none focus:border-ap-brand" />
            <button type="submit" className="px-4 h-11 rounded-ap-md text-xs font-semibold uppercase text-ap-brand border border-ap-brand/40 bg-ap-brand/10">필터</button>
          </form>

          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {data && (
            <div className="space-y-3">
              <ApPanel className="p-3">
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {Object.entries(data.node_types).map(([t, n]) => (
                    <span key={t} className="inline-flex items-center gap-1.5 text-xs text-ap-ink-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_TONE[t] ?? "var(--c-text-3)" }} />{t} {n}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-xs text-ap-ink-3">엣지: {Object.entries(data.edge_kinds).map(([k, n]) => `${k}(${n})`).join(" · ")}</div>
              </ApPanel>

              <ApPanel>
                <ApPanelHead kicker="읽기 전용" title="노드" right={<ApBadge tone="hud">{data.node_count} · {data.edge_count}</ApBadge>} />
                <div className="p-2">
                  {data.nodes.map((n) => {
                    const c = TYPE_TONE[n.type] ?? "var(--c-text-3)";
                    const highlighted = adj && adj.has(n.id);
                    const isSel = sel === n.id;
                    return (
                      <button key={n.id} onClick={() => setSel(isSel ? null : n.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-ap-md ${
                          isSel ? "bg-ap-brand/10" : highlighted ? "bg-ap-brand/5" : ""
                        }`}>
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c }} />
                        <span className="text-xs text-ap-ink-1 flex-1 truncate">{n.label}</span>
                        <span className="text-xs font-data text-ap-ink-3">{n.type}</span>
                      </button>
                    );
                  })}
                </div>
              </ApPanel>

              <div className="text-xs text-ap-ink-3 px-1">{data.note} · 노드 탭 → 연결 강조.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
```

`{/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}` 자리에는 원본 `page.tsx:303-350`을 그대로 붙여넣는다.

- [ ] **Step 2: `TimelineTab` 데스크톱 반환을 `hidden md:block`으로 감싸고 모바일 브랜치 추가**

`app/(console)/research-os/governance/page.tsx:374-421`의 `return ( <div className="min-h-full"> ... </div> );`를 아래로 교체 (내부는 원문 그대로 유지):

```tsx
  return (
    <>
      <div className="hidden md:block min-h-full">
        {/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}
      </div>

      <div className="md:hidden min-h-full">
        <div className="px-4 py-3 space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전략/주제로 필터…"
              className="flex-1 bg-ap-bg border border-ap-line rounded-ap-md px-3.5 h-11 text-[13px] text-ap-ink-1 outline-none focus:border-ap-brand" />
            <button type="submit" className="px-4 h-11 rounded-ap-md text-xs font-semibold uppercase text-ap-brand border border-ap-brand/40 bg-ap-brand/10">필터</button>
          </form>

          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {loading && !data && (
            <div className="space-y-3">
              <ApSkeletonStatTile />
              <ApPanel className="p-4"><ApSkeletonLines rows={5} /></ApPanel>
            </div>
          )}

          {data && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {data.stage_order.filter((s) => data.by_stage[s]).map((s) => (
                  <ApBadge key={s} tone="mute" title={s}>{STAGE_LABEL[s] ?? s} · {data.by_stage[s]}</ApBadge>
                ))}
              </div>
              <ApPanel>
                <ApPanelHead kicker="재구성됨" title="아이디어 → … → 아카이브" />
                <div className="p-4">
                  {data.count === 0 && !loading && <div className="text-xs text-ap-ink-3 py-8 text-center">원장에서 재구성할 이벤트 없음 — 연구가 기록되면 타임라인이 채워집니다.</div>}
                  <div className="relative pl-4">
                    {(data.entries ?? []).map((e, i) => {
                      const c = STAGE_TONE[e.stage] ?? "var(--c-text-3)";
                      return (
                        <div key={i} className="relative pb-3">
                          <span className="absolute left-[-11px] top-1 h-2 w-2 rounded-full" style={{ background: c }} />
                          {i < data.entries.length - 1 && <span className="absolute left-[-7px] top-3 bottom-0 w-px bg-ap-line" />}
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: c }} title={e.stage}>{STAGE_LABEL[e.stage] ?? e.stage}</span>
                            <span className="text-xs text-ap-ink-1">{e.label || e.ref}</span>
                          </div>
                          <div className="text-xs font-data text-ap-ink-3">{e.source} · {e.timestamp}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ApPanel>
              <div className="text-xs text-ap-ink-3 px-1">{data.note}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
```

`{/* 기존 데스크톱 마크업 — 무변경, 원문 그대로 */}` 자리에는 원본 `page.tsx:375-419`를 그대로 붙여넣는다.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 성공, `/research-os/governance` 라우트 목록에 포함.

- [ ] **Step 5: Commit**

```bash
git add "app/(console)/research-os/governance/page.tsx"
git commit -m "feat(research-os/governance): 지식그래프(리스트 재해석)·타임라인 탭 카드 마크업 추가"
```
