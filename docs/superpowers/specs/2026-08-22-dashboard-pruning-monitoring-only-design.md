# 대시보드 가지치기 — 감시(모니터링) 전용 피벗

## 배경
seokminal v2 웹 오버홀(가지치기 → 리디자인 → PWA화) 중 1단계. 대시보드의 미래 역할은
**"감시 전용 — 리서치/백테스트/매매는 에이전트가 다 함"**(사용자 확정). 지향점은
Bloomberg Terminal형 다기능 UI가 아니라 autopilot형 단순 UI. 현재 `app/*` 68개 라우트 중
수동 리서치/시세뷰어류를 제거하고 20개로 축소한다.

## 최종 IA (20개)
CommandRail(`components/console/CommandRail.tsx`) 그룹 재편:

- **감시 허브**: `/`(→`/hud` redirect 유지), `/hud`, `/agents`, `/infra`, `/performance`, `/portfolio`, `/risk-guard`
- **봇 감시**(수동 실행 버튼 전부 제거): `/copytrade`, `/dart-auto`, `/polymarket`, `/vrp`, `/research-os/pipeline`
- **리서치 거버넌스**: `/investment-os`, `/quant/validation`, `/research-os/validation`, `/research-os/governance`, `/research-os/chat`
- **기타**: `/orderflow`, `/mlb`

## CUT (17개, 라우트+페이지 삭제)
`backtest`(+`backtest/heatmap`), `buyback-doctor`, `crypto`, `data-quality`, `edges`,
`event-study`, `experiments`, `forex`, `futures`, `ict`, `market`, `options`, `search`,
`signal`, `design-system`, `validation`.

## MERGE (14개, 라우트 삭제 + redirect stub)
- `/lab`, `/lab/execution`, `/lab/tasks`, `/overview`, `/auto-research` → `/hud`
  (nav 주석상 이미 "AI LAB에 흡수됨"으로 취급되던 `/auto-research`도 `/lab`과 함께 `/hud`로 합류)
- `/council/agents`, `/council/decisions`, `/council/logs`, `/exec/monitor`, `/exec/orders`,
  `/portfolio-os/allocation`, `/portfolio-os/positions`, `/portfolio-os/risk` → `/investment-os`

기존 `lib/researchOsRedirects.ts`의 `OLD_TO_NEW` + `?tab=` 패턴 재사용. 신규 페이지는
tab query param 없이 만들지 않고 동일 패턴으로 `lib/*Redirects.ts` 확장(신규 맵 파일 대신
기존 맵에 키 추가 — 파일 하나로 관리).

## 신규: 컨텍스트 드릴다운
`calendar`/`insider`/`macro`/`news` 4개 독립 페이지 제거. 콘텐츠는 `/agents` 개별 에이전트
상세 화면(에이전트가 왜 이 판단을 했는지 보여줄 때 근거로 뉴스/캘린더/매크로/insider 컨텍스트
같이 노출)에 흡수. 기존 4개 페이지가 쓰던 API 클라이언트(`lib/api.ts` 함수)는 그대로 재사용,
UI만 `/agents` 상세 컴포넌트 하위 탭/패널로 이식.

## 삭제 메커니즘
- CUT: `app/<route>/` 디렉토리 삭제 + `CommandRail.tsx`에서 항목 제거.
- MERGE: `app/<route>/` 디렉토리 삭제 + `CommandRail.tsx`에서 항목 제거 + redirect 맵에
  `<old> → <target>?tab=<slug>` 추가(패턴은 `research-os` 선례와 동일). 병합 타겟 페이지가
  아직 tab 라우팅을 지원 안 하면(예: `/hud`, `/investment-os`) 해당 페이지에 탭 셸 추가 필요
  — 이건 병합 작업 자체에 포함(별도 후속 작업 아님).
- 드릴다운: `/agents/[id]` 상세 컴포넌트에 4개 패널 추가, 독립 라우트는 CUT과 동일하게 삭제.

## 테스트
`tests/lib/commandRailGroups.test.ts`가 이미 그룹 구조를 스냅샷 검증 중 — 이 파일 업데이트
필수(그룹 축소 반영). redirect 맵 신규 키는 `researchOsRedirects` 기존 테스트 패턴 따라
케이스 추가. `npx tsc --noEmit`으로 삭제 후 dangling import 잡기.

## 스코프 밖
- 리디자인(비주얼/톤) — 2단계, 이 스펙 아님.
- PWA화 — 3단계, 이 스펙 아님.
- `/hud`, `/investment-os` 자체의 탭 UI 세부 디자인 — 이번엔 "탭 셸 추가해서 병합 라우트
  수용 가능하게" 까지만, 탭 내부 레이아웃/비주얼은 2단계 리디자인에서.
