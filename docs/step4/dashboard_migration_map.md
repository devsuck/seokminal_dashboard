# STEP4-D Dashboard Migration Map

범위: `CommandRail.tsx`의 `CONSOLE_GROUPS`(거버넌스 OS 레이어, 32 page.tsx) — research-os 21개 + Investment OS 1 + Quant Lab 1 + Portfolio OS 3 + Execution 2 + AI Council 3.

**범위 밖 (안 건드림):**
- `TERMINAL_GROUPS`(레거시 트레이딩 터미널, 45페이지) — 코드 주석에 이미 "기능 유지, 셸만 통합"이라 명시된 별개 레이어.
- `command/page.tsx` (Command Center landing), `design-system/page.tsx` (내부 토큰 쇼케이스) — 5-view IA 밖 인프라 페이지.

**원칙:** 삭제 없음. 새 계산/새 API 없음. 5개 뷰는 기존 `lib/console-api.ts` 함수를 그대로 재사용하는 projection 레이어일 뿐 — merge된 섹션은 소스 페이지가 부르는 것과 **동일한 함수**를 그대로 부른다.

## 분류 정의

| 분류 | 의미 | route/nav 처리 |
|---|---|---|
| **유지** | 실제 인터랙션·write action·깊은 drill-down 있는 독립 도구 | route/파일 무변경, 새 뷰에서 "↗ 자세히" 링크로만 참조 |
| **병합** | compact read-only 요약, 새 뷰 섹션으로 흡수 가능 | route 유지(직링크 보존), nav 최상위에서 제거(새 뷰 하위로 이동), 데이터는 동일 API 재사용 |
| **숨김** | 다른 유지/병합 페이지와 내용 100%에 가깝게 중복 | route/파일 무변경, nav에서만 제거 |
| **deprecated** | 새 뷰가 나오면 존재 이유가 없어지는 순수 중복 hub | route는 새 뷰로 redirect (STEP4-D 완료 후, 즉시 아님) |

## Mapping Table

| # | Old Page | API (unchanged) | 분류 | New View | 비고 |
|---|---|---|---|---|---|
| 1 | `research-os/organization` | `getResearchOrganization` | 병합 | Overview | System Health 섹션 |
| 2 | `research-os/intelligence` | `getInstitutionalIntelligence` | 병합 | Research Evidence | data/info quality 섹션 |
| 3 | `research-os/market` | `getMarketCockpit` | 병합 | Research Evidence | regime+opportunities 요약, canonical |
| 4 | `research-os/live-intelligence` | `getLiveIntelligence` | 병합 | Operations | data ingestion/source status |
| 5 | `research-os/intel-feed` | `getMarketIntelFeed` | 숨김 | (→market과 중복) | PageHeader title "Market Intelligence" market과 완전 동일, 별도 섹션 불필요 |
| 6 | `research-os/cockpit` | `getCockpit` | 유지 | Overview | "Research Home ↗" 링크, quick-resume 액션 보유 |
| 7 | `research-os/console` | `getOperatingConsole` | 유지 | Operations | "Operating Console ↗" 링크, 세션/paper-trading 상태 |
| 8 | `research-os/agents` | `getAgentWorkspace` | 유지 | Research Evidence | agent DAG + human review 액션 |
| 9 | `research-os/brain` | `getResearchBrain` | 유지 | Research Evidence | knowledge graph/memory 깊이 있음 |
| 10 | `research-os/workflow` | `getResearchWorkflow`, `sessionAction` | 유지 | Research Evidence / Operations | **write action(sessionAction)** — 병합 대상 아님 |
| 11 | `research-os/validation` | `getValidationLoop` | 병합 | Strategy Intelligence | lifecycle board = "Validation" 버킷 그 자체, route는 drill-down으로 유지 |
| 12 | `research-os/autonomous` | `getAutonomousRuntime` | 숨김 | (→discovery 하위집합) | hypothesis ranking+active loop, discovery superset과 중복 |
| 13 | `research-os/discovery` | `getAutonomousResearch` | 유지 | Research Evidence | P181-200 v3.0, 가장 포괄적 — canonical drill-down |
| 14 | `research-os/intelligence-plus` | `getResearchIntelligence` | 숨김 | (→discovery+brain 중복) | ranking은 discovery, reflection은 brain과 중복 |
| 15 | `research-os/committee` | `getCouncilExpanded`, `getDecisionMemo` | 유지 | Risk & Governance / Strategy Intelligence | 7-perspective debate, 실제 생성 기능 |
| 16 | `research-os/production` | `getProductionReadiness` | 병합 | Risk & Governance | production health + review queue 섹션 (committee 탭 중복은 후속 정리 필요, 이번 범위 아님) |
| 17 | `research-os/explain` | `getExplainability` | 유지 | Research Evidence | evidence-chain graph drill-down |
| 18 | `research-os/graph` | `getResearchGraph` | 유지 | Research Evidence | entity graph drill-down |
| 19 | `research-os/timeline` | `getResearchTimeline` | 유지 | Research Evidence | graph와 다른 축(시간순), 둘 다 유효 |
| 20 | `research-os/strategy-lab` | `getStrategyLab` | 유지 | Strategy Intelligence | per-strategy DNA drill-down |
| 21 | `research-os/chat` | `getAssistant`, `getDecisionMemo`, `getExplainability` | 유지 | Research Evidence | 대화형 Q&A, 전역 접근성 유지 |
| 22 | `intel/research-os` | `getResearchOS` | deprecated | Research Evidence | 432줄 허브, strategy-lab/graph/chat로의 링크 모음 — 새 Research Evidence 뷰가 나오면 이 허브 자체가 목적 상실. **STEP4-D 완료 후 redirect**(즉시 아님) |
| 23 | `investment-os` | `getInvestmentOs`, `advanceLadder`, `getForwardLearning`, `getDataConnection`, `getResearchAccountability` | 유지+확장 | (뷰 셸 자체) | 이 route를 5-view 탭 셸로 승격 — STEP4-A/B/C 데이터가 이미 여기 모여있고 "Investment OS" 명칭도 부합 |
| 24 | `quant/validation` | `getValidation` | 병합 | Strategy Intelligence | validation gates/red-team consensus, drill-down 유지 |
| 25 | `portfolio-os/allocation` | `getAllocation`, `getFusion`, `getOverlay` | 병합 | Overview | 추천 배분 = Portfolio 상태 |
| 26 | `portfolio-os/risk` | `getRisk` | 병합 | Risk & Governance | RiskGovernor 한도/노출, canonical |
| 27 | `portfolio-os/positions` | `getPositions` | 병합 | Overview | 포지션 테이블 = Portfolio 상태 |
| 28 | `exec/orders` | `getOrders` | 병합 | Operations | execution status |
| 29 | `exec/monitor` | `getMonitor` | 병합 | Operations | pipeline stage/exposure, canonical |
| 30 | `council/agents` | `getAgents` | 병합 | Risk & Governance | 조직구조 = permissions 문맥 |
| 31 | `council/decisions` | `getConsoleCouncil` | 병합 | Risk & Governance | approvals/decision feed |
| 32 | `council/logs` | `getLogs` | 병합 | Risk & Governance | audit log, canonical |

## New View → Source 요약

| New View | 유지(링크만) | 병합(섹션 흡수) |
|---|---|---|
| **1. Overview** | cockpit | organization, portfolio-os/allocation, portfolio-os/positions |
| **2. Strategy Intelligence** | committee, strategy-lab | validation(research-os), quant/validation |
| **3. Research Evidence** | agents, brain, workflow, discovery, committee, explain, graph, timeline, chat | intelligence, market |
| **4. Risk & Governance** | committee | production, portfolio-os/risk, council/agents, council/decisions, council/logs |
| **5. Operations** | console(operating), workflow | live-intelligence, exec/orders, exec/monitor |

숨김: intel-feed, autonomous, intelligence-plus (전부 다른 유지/병합 페이지의 부분집합).
deprecated(지연 실행): intel/research-os (5-view 완성 후 redirect).

## STEP4-D 완료 조건 체크리스트 (사용자 지정)

- [ ] pytest pass (프론트 전용 변경이라 backend 영향 없음 — 확인만)
- [ ] dashboard build pass (`npx tsc --noEmit`, `npm run build`)
- [ ] existing API routes unchanged (merge는 기존 `lib/console-api.ts` 함수 재사용만, 새 엔드포인트 없음)
- [ ] backend data contracts unchanged (console_api.py 무변경)
- [ ] old URLs redirect or preserved (표 상 deprecated 1건만 redirect, 나머지 31개는 route 그대로 살아있음)
- [ ] 5 views render real data (실브라우저 검증)

## 다음 단계

이 문서는 inventory — 아직 코드 무변경. 승인되면:
1. `investment-os/page.tsx`를 5-tab 셸로 확장(Overview/Strategy Intelligence/Research Evidence/Risk & Governance/Operations) — 각 탭은 위 표의 "병합" 소스가 이미 쓰는 API 함수 그대로 재사용.
2. `CommandRail.tsx` nav 갱신 — 5개 새 링크 추가, 병합/숨김 대상은 최상위 nav에서 제거(route는 유지), 유지 대상은 새 뷰 안에서 "↗" 링크로 참조.
3. `intel/research-os` redirect는 5-tab 셸이 실제로 동등 기능을 갖춘 뒤 별도 커밋으로.
