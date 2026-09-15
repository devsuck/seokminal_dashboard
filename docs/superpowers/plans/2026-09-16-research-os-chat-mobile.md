# research-os/chat 모바일 카드 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/research-os/chat` (P69 리서치 챗 — 질문 → Decision Memo + Evidence + Memory Recall + Suggested actions) 모바일(`<768px`) 뷰를 라이트 카드 기반으로 재구성한다. 데스크톱(`≥768px`)은 완전히 무변경.

**Architecture:** 이 라우트는 탭이 없는 단일 컴포넌트(`ResearchChat`)이며 이미 논리적으로 단일 컬럼 흐름(입력 → 결과)이다. 기존 최상위 `<div className="min-h-full">...</div>`(데스크톱 전체)를 `hidden md:block`으로 감싸고, 형제로 `md:hidden` 신규 모바일 브랜치를 추가한다. 데스크톱의 `lg:grid-cols-3` 2단 레이아웃(메모+히스토리 / 회상+증거+액션+불확실성)을 모바일에서는 세로 스택 카드 리스트로 재구성한다 — 동일한 `turn`/`history`/`q`/`loading`/`err` 상태와 `run()` 콜백을 재사용하며 새 상태는 만들지 않는다.

**Tech Stack:** Next.js (App Router), React, Tailwind, `components/ui/ApPrimitives.tsx` (`ApPanel`, `ApPanelHead`, `ApBadge`, `ApSkeletonLines`).

**Spec:** `docs/superpowers/specs/2026-09-15-mobile-fintech-home-design.md`

## Global Constraints

- `.rail-ap` 스코프: `app/(console)/layout.tsx`가 `(console)` 라우트 전체를 이미 `rail-ap min-h-screen bg-[var(--c-bg)]`로 감싸 라이트 테마로 리매핑한다. 페이지 레벨에서 배경색을 다시 칠할 필요 없음 — `investment-os`가 중복으로 `bg-ap-bg`를 추가했던 것과 달리, `research-os/governance`·`validation`은 페이지 최상위 모바일 wrapper에 배경 클래스를 추가하지 않았다(리뷰에서 "중복 없음"으로 칭찬받은 컨벤션). 이 라우트도 동일하게 배경 클래스 생략.
- Ap 프리미티브 재사용은 실제 쓰는 것만 import: `ApPanel, ApPanelHead, ApBadge, ApSkeletonLines`. 미사용 프리미티브(`ApDot`, `ApStatTile`, `ApMeter`, `ApSkeleton`, `ApSkeletonStatTile`) import 금지.
- **원자 색상 클래스는 `text-ap-up`(긍정) / `text-ap-down`(부정) / `text-ap-caution`(경고) 이다.** `text-ap-pos`/`text-ap-neg`/`text-ap-warn`은 존재하지 않는 클래스이므로 절대 쓰지 말 것(`ApDot`/`ApBadge`/`ApStatTile` 내부의 `tone` prop 값인 `"pos"|"neg"|"warn"`과 실제 렌더되는 CSS 클래스명은 다르다 — `components/ui/ApPrimitives.tsx:54-56` 참조).
- `ApBadge`의 `tone` prop은 `"pos"|"neg"|"warn"|"hud"|"info"|"mute"` 중 하나만 허용(raw CSS 문자열 불가) — `CONF_TONE` 맵(`HIGH:"pos", MEDIUM:"hud", LOW:"warn"`)은 이미 이 타입과 정확히 일치하므로 그대로 재사용.
- `ApSkeletonLines`는 `rows` prop을 받는다(`lines` 아님) — `components/ui/ApPrimitives.tsx:98`. 기존 라우트 컨벤션대로 `<ApPanel className="p-4"><ApSkeletonLines rows={N} /></ApPanel>`로 감싸서 사용.
- 데스크톱 바이트 단위 무변경: 기존 최상위 `<div className="min-h-full">` 블록 전체를 `<div className="hidden md:block min-h-full">`로 한 줄만 바꾸고, 그 안의 내용은 재인덴트를 포함해 한 글자도 바꾸지 않는다.
- 터치 타겟: 스텝형 상호작용 버튼(제안 질문 칩, "다음 액션" 리스트 버튼)은 최소 `min-h-11`(44px) 확보. 폼 제출 버튼은 데스크톱과 동일하게 이미 `h-11`이므로 모바일에서도 `h-11` 유지.
- 텍스트 크기 기본값은 `text-xs`(12px) — 숫자/`font-data` 필드에 `text-[11px]` 같은 임의값 금지(이전 라우트에서 반복된 minor finding 패턴).
- 리스트 행 컨벤션: `bg-ap-bg rounded-ap-md p-2.5`.
- main 브랜치 직접 커밋(워크트리 없음).
- 구현 후 `npx tsc --noEmit` 0 errors 확인.

---

### Task 1: research-os/chat 모바일 카드 마크업 추가

**Files:**
- Modify: `app/(console)/research-os/chat/page.tsx`

**Interfaces:**
- Consumes: 컴포넌트 자체 상태(`q`, `turn`, `history`, `loading`, `err`, `run`) — 새 상태 없음. `CONF_TONE`(파일 상단, `Record<string, "pos"|"hud"|"warn">`), `SUGGESTIONS`(문자열 배열) 그대로 재사용.
- Produces: 없음(리프 페이지 컴포넌트, 다른 태스크가 소비할 인터페이스 없음).

- [ ] **Step 1: import 추가**

`app/(console)/research-os/chat/page.tsx` 상단 import 블록(현재 4번째 줄 `import { useState, useCallback } from "react";` 다음, `PageHeader`/`Panel` import들과 나란히)에 추가:

```tsx
import { ApPanel, ApPanelHead, ApBadge, ApSkeletonLines } from "@/components/ui/ApPrimitives";
```

- [ ] **Step 2: 데스크톱 블록을 `hidden md:block`으로 감싸기**

파일의 최상위 return 블록 시작을:

```tsx
    <div className="min-h-full">
```

다음으로 변경(그 뒤 `</div>`까지 이어지는 내용은 재인덴트 포함 한 글자도 바꾸지 않음):

```tsx
    <div className="hidden md:block min-h-full">
```

- [ ] **Step 3: 모바일 브랜치 추가**

Step 2에서 바꾼 `<div className="hidden md:block min-h-full">...</div>` 블록이 끝나는 최상위 닫는 `</div>` 바로 다음(현재 파일의 163번째 줄, `return (` 블록 내부, 최종 `);` 이전)에 형제 div로 아래 마크업을 추가한다:

```tsx
        <div className="md:hidden min-h-full">
          <div className="p-4">
            <div className="mb-2">
              <span className="text-xs tracking-wide text-ap-ink-3 uppercase">P69 · 리서치 챗 · 주요 인터페이스</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex flex-col gap-2 mb-3">
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="연구 질문… (예: 어제 리서치 이어서 진행해줘)"
                className="w-full bg-ap-surface border border-ap-line rounded-ap-md px-3.5 h-11 text-sm text-ap-ink-1 outline-none focus:border-ap-brand"
              />
              <button
                type="submit" disabled={loading || !q.trim()}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-ap-md text-sm font-semibold text-white bg-ap-brand disabled:opacity-50 disabled:cursor-wait"
              >
                {loading && <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {loading ? "생각 중…" : "질문"}
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s} onClick={() => { setQ(s); run(s); }} disabled={loading}
                  className="min-h-11 px-3 rounded-ap-md text-xs text-ap-ink-2 border border-ap-line bg-ap-surface disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            {err && (
              <ApPanel className="p-3 mb-4">
                <div className="text-xs text-ap-down">백엔드 연결 실패: {err}</div>
              </ApPanel>
            )}

            {loading && !turn && (
              <ApPanel className="p-4"><ApSkeletonLines rows={4} /></ApPanel>
            )}

            {turn && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead
                    kicker="추천" title={turn.q}
                    right={turn.memo.confidence && (
                      <ApBadge tone={CONF_TONE[turn.memo.confidence] ?? "mute"}>{turn.memo.confidence}</ApBadge>
                    )}
                  />
                  <div className="p-3 space-y-3">
                    <div className="text-sm font-medium text-ap-brand">{turn.memo.recommendation ?? turn.recall.answer}</div>
                    {turn.memo.rationale && (
                      <div className="text-xs text-ap-ink-2 leading-relaxed">{turn.memo.rationale}</div>
                    )}
                    <div className="space-y-2 pt-1">
                      <div>
                        <div className="text-xs tracking-wide text-ap-up uppercase mb-1.5">지지 근거</div>
                        {(turn.memo.supporting_arguments ?? []).map((a, i) => (
                          <div key={i} className="text-xs text-ap-ink-2 mb-1">· <b className="text-ap-ink-1">{a.lens}</b> {a.rationale}</div>
                        ))}
                        {(turn.memo.supporting_arguments ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                      </div>
                      <div>
                        <div className="text-xs tracking-wide text-ap-caution uppercase mb-1.5">반대 근거</div>
                        {(turn.memo.counter_arguments ?? []).map((a, i) => (
                          <div key={i} className="text-xs text-ap-ink-2 mb-1">· <b className="text-ap-ink-1">{a.lens}</b> {a.rationale}</div>
                        ))}
                        {(turn.memo.counter_arguments ?? []).length === 0 && <div className="text-xs text-ap-ink-3">—</div>}
                      </div>
                    </div>
                  </div>
                </ApPanel>

                {history.length > 1 && (
                  <ApPanel>
                    <ApPanelHead kicker="대화" title="히스토리" />
                    <div className="p-3 space-y-1.5">
                      {history.map((h, i) => (
                        <div key={i} className="bg-ap-bg rounded-ap-md p-2.5 text-xs">
                          <div><span className="text-ap-ink-3">질문:</span> <span className="text-ap-ink-1">{h.q}</span></div>
                          <div className="text-ap-brand mt-0.5">→ {h.a}</div>
                        </div>
                      ))}
                    </div>
                  </ApPanel>
                )}

                <ApPanel>
                  <ApPanelHead kicker="메모리" title="회상" />
                  <div className="p-3">
                    <div className="text-xs text-ap-ink-2">{turn.recall.answer}</div>
                    {turn.recall.topic && <div className="text-xs text-ap-ink-3 mt-1">주제: {turn.recall.topic}</div>}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead
                    kicker="설명가능성" title="참조 실험"
                    right={<ApBadge tone={CONF_TONE[turn.ev.confidence] ?? "mute"}>{turn.ev.confidence}</ApBadge>}
                  />
                  <div className="p-3 space-y-1">
                    {(turn.ev.references_experiments ?? []).length === 0 && (
                      <div className="text-xs text-ap-ink-3">참조된 과거 실험 없음.</div>
                    )}
                    {(turn.ev.references_experiments ?? []).map((r, i) => (
                      <div key={i} className="text-xs font-data text-ap-ink-2">· {r}</div>
                    ))}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="제안" title="다음 액션" />
                  <div className="p-3 space-y-1">
                    {(turn.memo.suggested_next_research ?? []).length === 0 && (
                      <div className="text-xs text-ap-ink-3">제안 없음.</div>
                    )}
                    {(turn.memo.suggested_next_research ?? []).map((s, i) => (
                      <button
                        key={i} onClick={() => { setQ(s); run(s); }}
                        className="block w-full text-left min-h-11 py-2.5 px-0 text-xs text-ap-ink-2 bg-transparent border-0"
                      >
                        → {s}
                      </button>
                    ))}
                  </div>
                </ApPanel>

                {(turn.memo.remaining_unknowns ?? []).length > 0 && (
                  <ApPanel>
                    <ApPanelHead kicker="공백" title="남은 불확실성" />
                    <div className="p-3 space-y-1">
                      {turn.memo.remaining_unknowns!.map((u, i) => (
                        <div key={i} className="text-xs text-ap-caution">· {u}</div>
                      ))}
                    </div>
                  </ApPanel>
                )}
              </div>
            )}

            {!turn && !loading && (
              <ApPanel className="p-6 text-center">
                <div className="text-xs text-ap-ink-2">
                  질문을 입력하면 Decision Memo · 증거 · 메모리 회상 · 다음 액션을 함께 보여줍니다.
                </div>
                <div className="text-xs text-ap-ink-3 mt-1.5">분석·회상만 — 투자 결정·집행은 사람이 합니다.</div>
              </ApPanel>
            )}
          </div>
        </div>
```

- [ ] **Step 4: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: 빌드 검증**

Run: `npm run build`
Expected: 성공, `/research-os/chat` 라우트 정적 프리렌더.

- [ ] **Step 6: 데스크톱 무변경 확인**

Run: `git diff -w --ignore-blank-lines app/(console)/research-os/chat/page.tsx`
Expected: `hidden md:block` 한 줄 추가를 제외하면 기존 데스크톱 라인에 실질 diff 없음(공백/재인덴트만 있다면 무시, 텍스트/속성 변경은 없어야 함).

- [ ] **Step 7: Commit**

```bash
git add "app/(console)/research-os/chat/page.tsx"
git commit -m "feat(research-os/chat): 모바일 카드 마크업 추가"
```
