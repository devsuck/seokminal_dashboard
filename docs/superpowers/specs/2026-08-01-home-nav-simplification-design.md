# 홈/네비 단순화 (1단계: IA/UX, 삭제 없음) — Design Spec

**Status:** 사용자 승인 완료(섹션별 확인: 아키텍처→"맞음, 넘어가도 됨" / 신호매핑→"맞음, 계속" / 나브 재사용→"ㅇㅇ 그래라" / 데이터흐름·테스트→"진행").

## Goal

플랫폼이 "심플하지 않다"는 사용자 피드백. 원인: (1) `/hud`와 `/command` 두 개의 경쟁하는 홈/다이제스트 페이지 존재, 둘 다 "리서치가 알아서 고려해야 할 것"을 사람이 판단해야 하는 것과 구분 없이 뒤섞어 보여줌. (2) `CommandRail.tsx` 나브가 9개 그룹(54개 항목) 헤더를 항상 노출 — 접힘 아코디언은 있지만 그룹 자체를 숨기지는 않음.

**2단계 중 1단계만.** 실제 기능/페이지 삭제(2단계, Approach B)는 이번 스코프 아님 — 상세 페이지 52개는 그대로 존재, drill-down으로만 접근.

## Architecture

핵심 결정: **백엔드 변경 없음.** 기존 `/console/*` 엔드포인트(`console-api.ts`)와 `/hud`가 이미 쓰는 레거시 상태 API(`lib/api.ts`) 조합만으로 전부 구현 가능. 새 엔드포인트, 새 상태 개념 서버에 안 만듦.

1. **홈 통합**: `/command`(Command Center) 페이지 폐기, 그 신호를 `/hud`가 흡수. `/` 리다이렉트는 그대로 `/hud` 유지.
2. **"판단 필요" 큐**: `/hud`에 새 섹션 — 사람 판단이 실제로 걸리는 신호만 필터링해서 보여줌. 0건이면 "전부 정상" 한 줄로 접힘.
3. **나브 Operator 모드**: `CommandRail.tsx`에 그룹 화이트리스트 필터 얹음. 접기/펼치기 아코디언은 그대로 두고, 그 위에 "보이는 그룹 자체"를 줄이는 레이어 추가.

## "판단 필요" 큐 — 신호 매핑

| 신호 | 소스(기존 API) | 조건 |
|---|---|---|
| 승격 대기 | `getInvestmentOs()` — `gates.passed` + `execution_ladder.human_approval_mandatory` | 게이트 통과 + 승인 필수 → "다음 단계 승격 가능" 카드 |
| 파이프라인 승인 대기 | `getConsolePipeline().proposals` | `proposals > 0` → "제안 N건 대기" |
| 리스크 이벤트 | `getRisk().execution_risk_events` + `by_status` | breach/warn 상태 카운트 > 0 |
| 리서치 후보 | `getAutoResearch().n_candidates`(기존 `/hud`에 이미 있음) | 그대로 승계, "판단 필요" 섹션으로 위치만 이동 |
| 유닛 다운 | 기존 `/hud` 유닛 로스터 stopped 카드 | 그대로 승계 |

`deriveAttentionItems(pipeline, risk, investmentOs, autoResearch, units)` 순수함수 하나로 위 5개 입력 받아 조건 걸리는 항목만 배열 반환. `/command`가 쓰던 `getConsoleRegime`/`getConsoleCouncil`(추세/로그, 능동 판단 대상 아님)은 "참고" 섹션으로 격하 — 기본 접힘, "판단 필요" 아래 별도 배치.

## 나브 Operator 모드

`CommandRail.tsx`는 이미 아코디언 접힘 보유(`OPEN_GROUPS_KEY`, 현재 위치 그룹만 자동 펼침) — 그룹 헤더 9개는 항상 노출되는 게 문제. 그 위에 얇은 필터만 추가:

- `operatorMode` bool state, `localStorage`(`commandRailOperatorMode`) 저장, 기본값 `true`.
- Operator일 때 렌더 그룹 화이트리스트: `트레이딩 데스크`, `봇 · 에이전트`, `Research · 모니터링` 3개 그룹만.
- Footer collapse 버튼 위에 토글 버튼 "전체보기" — 누르면 `ALL_GROUPS` 전체 렌더(기존 동작).
- 브랜드 로고 `Link href="/command"` + "커맨드 센터" nav 항목 → `/hud`로 변경.
- `/command` 라우트(`app/(console)/command/page.tsx`) 삭제.

새 컴포넌트 없음 — 기존 `renderGroups()` 호출 전에 groups 배열만 필터링. 그룹 필터 로직은 순수함수로 분리해 유닛테스트 가능하게.

## 데이터 흐름 · 에러 처리

- `/hud` 기존 `Promise.all([...]).catch(() => null)` 블록(app/hud/page.tsx:138-161)에 fetch 3개 추가: `getConsolePipeline`, `getRisk`, `getInvestmentOs`. 기존 `AbortController` 패턴(abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup) 그대로 따름 — 프로젝트 컨벤션 위반 없음.
- 각 fetch 개별 `.catch(() => null)` — 하나 죽어도 나머지 카드 정상 렌더(기존 패턴 승계).
- `deriveAttentionItems()`는 입력 중 일부가 null이어도 해당 신호만 조용히 skip(에러 카드 안 띄움, 후보에서만 제외) — 페이지 자체는 유닛 로스터가 살아있는 한 안 죽음.
- `/console/*`는 이미 `lib/api.ts`와 같은 `get()` 헬퍼 계열(`console-api.ts`) — CORS/베이스 URL 별도 설정 불필요.

## 테스트

- `deriveAttentionItems()` 순수함수 — `__tests__/deriveAttentionItems.test.ts` 신규, 입력 5종 null/불리언 조합별 기대 배열 assert. 기존 `npm test` 러너 그대로, 신규 설정 없음.
- `CommandRail.tsx`의 그룹 필터 로직도 `renderGroups` 밖으로 분리해 같은 방식으로 유닛테스트.
- `/command` 삭제 + 리다이렉트 변경분은 `npx tsc --noEmit` + 수동 브라우저 확인(네비 클릭 1회)으로 충분 — 신규 E2E 추가 안 함.
- 백엔드 변경 없음 → `pytest` 영향 없음.

## Out of Scope (2단계로 넘김)

- 52개 상세 페이지 중 실사용 안 하는 것 삭제(Approach B, "둘 다인데 A 먼저" 결정에 따라 이후 별도 스펙).
- `/command`가 흡수 안 한 나머지 console-api 확장 엔드포인트(Validation/Council/Knowledge/Portfolio/Execution) 정리 — 이번엔 `/hud` 흡수 대상만 건드림.
