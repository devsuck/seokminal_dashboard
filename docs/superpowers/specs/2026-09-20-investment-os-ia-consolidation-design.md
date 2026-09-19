# Investment OS IA 재정리 + 카드 시스템 통일

## 배경

2026-09-19 live-agents 페이지 라이트 리디자인 후 사용자 피드백: "전체적으로 디자인 톤이 안
맞다. 모든 페이지가 같은 디자인가이드를 따라야한다." 조사 결과 두 가지 원인이 겹쳐 있음.

**원인 A — 카드 시스템 분기.** 2026-09-17 `2026-09-17-mobile-design-system-overhaul` 스펙에서
`ApHeroCard`("다크히어로": 상단 `bg-ap-ink-1` 검은 칩에 라벨+값, 아래 흰 행)를 모바일 히어로
카드 표준으로 확정하고 4곳(`app/hud/summary`, `app/portfolio`, `investment-os` 리스크탭,
`app/performance`)에 이미 롤아웃·커밋 완료함. 그런데 2026-09-19 live-agents 페이지를 만들 때
이 표준을 모르고(또는 배제하고) 검은 칩 없는 새 카드(순백 배경 + 굵은 컬러 값 + 주황 버튼)를
독자적으로 만들어버림 — 카드 "브랜드"가 두 개로 쪼개진 상태. 사용자가 두 스타일을 비교
검토한 결과 **새 라이트카드(검은 칩 없는 쪽)로 통일**하기로 결정함(본 세션
`AskUserQuestion` 응답).

**원인 B — 정보구조(IA) 중복/불명확.** 사용자가 직접 지목한 항목:
- `/hud`(홈)와 `/investment-os/live-agents`의 자본청구 승인 UI가 별도로 존재 — 실제로는
  `capital_claims.py`의 봉투(envelope) 자동승인 대(對) 초과분 대기열이라는 서로 다른 단계라
  구조는 맞지만, 두 진입점 사이 피드백/네이밍이 없어 중복처럼 보임.
- `/hud` 홈 상단 요약(총 포폴/실거래 비활성/판단필요)이 "내가 왜 봐야 하는지" 불분명.
- `/portfolio`의 "거래소별 분포"가 왜 필요한지 불분명 — 이미 2026-09-17 스펙 목표 3에서
  `accounts` 탭 바디로 흡수하기로 계획됐으나 이번 점검 시점에 실제 반영 여부 미확인.
- live-agents 카드 펼쳤을 때 텍스트 정리가 약함, 최근 사이클을 한 뎁스 더 파고들 수 있게
  하면 좋겠음(플랫 8개 나열 대신 요약+드릴다운).
- investment-os "추천비중"(규칙 기반)과 ai-portfolio "최신추천"(Claude AI)이 시각적으로
  동일한 바 차트라 혼동 소지.
- "돈길"(`/hud`)과 "준비도 사다리"(investment-os ops탭)가 같은 게이트 개념을 다른 용어로
  표현.

별개로, "에이전트가 논문/공급망/거시경제/경제지표/경제캘린더/재무제표/다트/내부자매매
파이프라인을 실제로 쓰는지" 확인 요청은 이미 조사 완료·보고됨(본 스펙 범위 아님, 결론만
요약): `swing` 프로필(기본, 라이브 사이클링 에이전트 전부가 씀)은 `POSITION_CHECK` +
`score_stock.py` + `news.sh` + `memory.py` 4가지만 매 사이클 주입하고, 8개 리서치
파이프라인 산출물은 연결 안 돼 있음(`autopilot/agent_loop.sh:284-318`). 라이브 사이클링
에이전트↔오프라인 리서치 연동은 별도 후속 스펙 대상(`docs/progress.md` Phase 35 "다음
후보" 참조).

## 목표

1. `ApHeroCard`(다크히어로)를 폐기하고 live-agents 카드 레시피로 4개 목적지 전부 재통일.
2. `/hud`를 "판단 필요 큐 + 전체 정상여부"로 재정의하고 `/hud/summary`를 흡수(중복 페이지
   제거).
3. `/portfolio` "거래소별 분포"를 `accounts` 탭 바디로 접어 넣기(기본 접힘).
4. capital-claims 흐름: 페이지 병합은 안 함(백엔드 2단계 구조가 실제로 다름) — 대신
   live-agents의 승인 버튼에 결과 피드백(자동승인 vs 대기열 등록) 추가, capital-claims
   페이지 제목/설명으로 "초과분 승인대기 + 한도관리 + 이력" 역할 명확화, 3개 진입점(홈 판단
   큐/live-agents/investment-os 개요)을 하나의 배지 경로로 통일.
5. "돈길"과 "준비도 사다리" 용어를 하나로 통일.
6. 리스크 정보(홈/investment-os 리스크탭/capital-claims 봉투)를 investment-os 리스크탭
   단일 소스로 모으고, 나머지는 요약+링크만.
7. investment-os "추천비중"과 ai-portfolio "최신추천" 바 차트에 출처 라벨(규칙 기반 vs
   Claude AI) 명시.
8. live-agents 카드의 사이클 타임라인: 아코디언 안에는 최근 3개 압축 요약만, 전체 이력은
   별도 드릴다운(바텀시트)에서 태그+짧은 근거로 재구성.

## 비목표

- 라이브 사이클링 에이전트 자체 로직(`agent_loop.sh`) 변경 — 프론트/IA 작업만.
- 오프라인 리서치 파이프라인(논문/공급망/거시경제 등)을 라이브 에이전트 사이클에 연결하는
  작업 — `docs/progress.md` Phase 35 "다음 후보"에 이미 별도 후속 항목으로 있음, 이 스펙은
  건드리지 않음.
- god_mode↔agent_gate 불일치 버그, capital_claims 자동 트리거 연결 — 같은 "다음 후보"
  목록의 별개 항목, 이 스펙 범위 아님.
- `investment-os/page.tsx` 데스크톱(`hidden md:block`) 마크업의 다크 톤 자체 — 2026-09-17
  스펙에서 사용자가 이미 "데스크톱 다크 콘솔 톤 보존은 우선순위 아님"이라고 확인했지만
  손대는 순서를 별도로 정하지 않았음. 이 스펙에서도 데스크톱 마크업 레이아웃은 건드리지
  않고, 목표 1(카드 시스템 재통일)에 한해서만 필요한 최소 변경(risk탭 히어로 부분)만 다룸.

## 아키텍처

기존 패턴(데스크톱 다크 `hidden md:block` / 모바일 라이트 `md:hidden` 분기) 유지. 변경은
전부 모바일(`ap-*` 토큰) 경로 + `ApPrimitives.tsx` 프리미티브 레벨에서 이뤄짐.

## 컴포넌트

### 1. `ApHeroCard` → 신규 라이트카드 프리미티브로 대체

`components/ui/ApPrimitives.tsx`의 `ApHeroCard`(라인 224-252, 검은 칩 헤더)를 제거하고, 같은
자리에 live-agents에서 검증된 레시피를 프리미티브로 승격:

```tsx
export function ApLightHero({
  label, value, valueCls, sub, rows,
}: {
  label: string;
  value: string;
  valueCls?: string;
  sub?: string;
  rows?: { label: string; value: string; cls?: string }[];
}) {
  return (
    <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm overflow-hidden">
      <div className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-ap-ink-3">{label}</div>
        <div className={`text-2xl font-bold font-data mt-1 ${valueCls ?? "text-ap-ink-1"}`}>{value}</div>
        {sub && <div className="text-xs text-ap-ink-3 mt-0.5">{sub}</div>}
      </div>
      {rows && rows.length > 0 && (
        <div className="divide-y divide-ap-line px-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ap-ink-3">{r.label}</span>
              <span className={`font-data ${r.cls ?? "text-ap-ink-1"}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

동일한 `{label, value, valueCls, sub, rows}` 인터페이스 유지 — 호출부(5곳) 시그니처 변경
없이 import/컴포넌트명만 교체:
- `app/(console)/investment-os/page.tsx:1277` (리스크탭 히어로)
- `app/performance/page.tsx:102`
- `app/portfolio/page.tsx:307`
- `app/hud/summary/page.tsx:126`
- `components/hud/PortfolioTab.tsx:146`

`app/performance/page.tsx:20`의 `onDark` 주석(다크 칩 배경 전제)은 이 교체로 의미 없어지므로
같이 제거.

### 2. `/hud` + `/hud/summary` 병합

- `/hud`(데스크톱 홈)를 "판단 필요 큐 + 전체 정상여부 배지" 중심으로 재구성. 현재 최상단의
  총 포폴/실거래 비활성 등 정적 상태 타일은 판단이 필요 없는 정보이므로 배지 1줄로 축소하고,
  실제로 사람 판단이 필요한 항목(승인 대기 자본청구, god_mode 승급 후보, 리스크 경고)을
  큐 형태로 상단에 노출.
- `/hud/summary`(모바일 홈)는 이미 같은 데이터(`useHudFeed()`)를 쓰므로 별도 라우트를
  없애고 `/hud`를 반응형 하나로 합침(기존 `hidden md:block`/`md:hidden` 분기 패턴 그대로
  써서 레이아웃만 갈라지게).
- `lib/researchOsRedirects.ts`의 `OLD_TO_NEW`에 `/hud/summary` → `/hud` 리다이렉트 추가.

### 3. `/portfolio` "거래소별 분포" 접기

`accounts` 탭 안에 이미 렌더링되는 거래소별 분포 섹션을 기본 접힌 `<details>`(또는 로컬
`expanded` state) 안으로 이동. 상단에는 계좌현황+포지션만 기본 노출.

### 4. capital-claims 흐름 UX

- live-agents `ApprovalFeed`의 "예"/"아니오"/"내가 마음대로 주기" 버튼 액션 후,
  `submitCapitalClaim()` 응답의 `fulfillment_mode`(live/paper)와 승인 여부를 토스트나
  인라인 배지로 즉시 표시("자동 승인됨 · paper" / "한도 초과 · 승인 대기열 등록됨" 등).
  `submitCapitalClaim` 반환 타입에 이미 이 정보가 있는지 `lib/console-api.ts` 확인 후,
  없으면 타입 확장.
- `/investment-os/capital-claims` 페이지 헤더 부제를 "초과분 승인대기 · 한도관리 · 이력"으로
  명시적으로 바꿔 live-agents의 즉시-승인 흐름과 역할이 다름을 드러냄.
- 3개 진입점(홈 판단 큐, live-agents 승인피드, investment-os 개요 링크) 모두 같은 배지
  스타일("승인 대기 N")로 통일 — 클릭 시 각자 맥락에 맞는 곳(홈→live-agents, investment-os
  개요→capital-claims)으로 이동.

### 5. "돈길"/"준비도 사다리" 용어 통일

두 용어가 가리키는 실체(승인 단계별 게이트)를 확인해 하나의 이름으로 통일하고, 양쪽 페이지
헤더에 같은 용어+같은 배지 컴포넌트 사용. (실제 통일 명칭은 구현 단계에서 두 화면의 게이트
단계 목록을 나란히 비교한 뒤 확정 — 이 스펙은 통일 방향만 확정.)

### 6. 리스크 정보 단일화

investment-os 리스크탭을 리스크 정보의 단일 소스로 삼고, `/hud`와 capital-claims 페이지의
리스크 관련 섹션은 핵심 배지 1개(예: "리스크: 정상/주의")와 "자세히 보기 → investment-os
리스크탭" 링크로 축소.

### 7. 추천비중 출처 라벨

`investment-os` 개요 탭의 "추천비중" 바 차트와 `ai-portfolio`의 "최신추천" 바 차트 각각에
작은 배지 추가: `ApBadge tone="mute"`로 "규칙 기반" / "Claude AI" 표시.

### 8. live-agents 사이클 드릴다운

`AgentCardBody`의 "최근 사이클" 목록을 3개로 줄이고, 각 항목을 `decision` 배지 + 한 줄
요약(현재 note 전체 대신 종목/사유 태그 1-2개)으로 재구성. 하단에 "전체 이력 보기" 버튼 →
`ApBottomSheet`(이미 임포트돼 있는 프리미티브)로 전체 8개+ 사이클을 펼쳐서 보여줌(현재
`getLiveAgentCycles(agentId, 8)` 호출을 시트 오픈 시 더 큰 limit으로 재요청하거나, 최초
호출부터 더 많이 가져와서 시트에서만 전체를 보여주는 방식 — 구현 단계에서 API 페이지네이션
여부 확인 후 결정).

## 마이그레이션 순서

1. `ApLightHero` 프리미티브 추가 + 5개 호출부 교체 + `ApHeroCard` 제거 (목표 1) — 다른
   목표들이 이 카드 레시피 위에서 작업하므로 먼저.
2. `/portfolio` 거래소별 분포 접기 (목표 3) — 독립적, 빠름.
3. `/hud`+`/hud/summary` 병합 (목표 2) — 리스크/게이트 단일화(목표 5, 6)가 참조할 최종
   홈 구조를 먼저 확정.
4. 게이트 용어 통일(목표 5) + 리스크 단일화(목표 6) — 홈 구조 확정 후.
5. capital-claims UX 피드백/네이밍(목표 4).
6. 추천비중 라벨(목표 7) — 독립적.
7. live-agents 사이클 드릴다운(목표 8) — 독립적.

## 테스트

- `npx tsc --noEmit` 클린.
- 각 마이그레이션 단계 후 Chrome으로 데스크톱+모바일(390px) 스크린샷 비교.
- `/hud/summary` 리다이렉트 동작 확인.
- capital-claims 자동승인/대기열 두 경로 모두 실제 백엔드 응답으로 확인(현재
  `capital_claims.jsonl` 비어있어 실제 트리거가 없으므로, `submit_claim()`을 직접 호출하는
  임시 스크립트나 `pytest` 픽스처로 두 분기 모두 재현).
