# STEP4-D 5-Tab Source-of-Truth

`investment-os/page.tsx`를 5-tab consolidation shell로 확장하기 전, 탭별 정확히 어떤 API 함수의 어떤 필드를 그대로 렌더링하는지 고정. 전부 `lib/console-api.ts`에 **이미 존재하는** 함수/타입 — 신규 API 0개, 신규 계산 0개. 값은 백엔드가 이미 계산해 내려주는 필드를 그대로 표시만 한다(파생 로직 없음).

로딩 전략: 초기 로드는 기존 4개 호출(`getInvestmentOs`/`getForwardLearning`/`getDataConnection`/`getResearchAccountability`)만 유지. 나머지 병합 섹션은 **탭 최초 활성화 시 lazy fetch**(한 번 fetch 후 캐시) — 5탭 동시 로드 시 18개 API 콜이 한번에 뜨는 걸 피함(과거 동시성 버그 교훈).

## Tab 1 · Overview — "Portfolio 상태 · 전체 Risk · System Health"

| 섹션 | API (기존) | 표시 필드 |
|---|---|---|
| System Health | `getResearchOrganization()` | `strategy_health.strategies[].{strategy,health_score,grade,review_needed}`, `knowledge_health.grade`, `operational_status.operational` |
| Portfolio 상태(추천 배분) | 기존 `getInvestmentOs().portfolio.weights` (변경 없음) + `getAllocation().derived_proposal[].{strategy_id,factor,status,target_weight}` | 기존 weights 바 그대로 유지, derived_proposal은 보조 카드로 추가 |
| Positions | `getPositions()` | `count`, `positions[]`(테이블, 필드는 응답 그대로 — 타입이 `Record<string,unknown>[]`라 키 목록을 동적으로 렌더) |

유지 링크: `research-os/cockpit` ("Research Home ↗")

## Tab 2 · Strategy Intelligence — "Strategy registry · Lifecycle · Forward status · Validation"

| 섹션 | API | 표시 필드 |
|---|---|---|
| Forward Learning(기존 패널 이동) | `getForwardLearning()` | 기존 구현 그대로(로직 무변경, 위치만 이동) |
| Validation Loop | `getValidationLoop()` | `lifecycle_board.strategies[].{strategy,current_state}`, `quality_panel.{quality_score,grade}`, `validation_panel.{status,divergence_detected}` |
| Validation Gates | `getValidation()` | `gates[]`, `experiment_status`, `redteam.{n,human_redteam_agree}` |

유지 링크: `research-os/strategy-lab`, `research-os/committee`, `research-os/validation`(전체 loop), `quant/validation`(전체 게이트 리포트)

## Tab 3 · Research Evidence — "autoresearch 결과 · hypothesis history · prediction coverage"

| 섹션 | API | 표시 필드 |
|---|---|---|
| Market/Research Intelligence | `getMarketCockpit()` | `market_state.{regime,labels}`, `top_opportunities[]`, `health_score`, `risk.top_category` |
| Institutional Intelligence | `getInstitutionalIntelligence()` | `data_production_health.{overall_status,average_quality}`, `sector_intelligence.{sector,key_entities}`, `macro_context.macro_state` |
| Prediction Coverage(기존 재사용) | 기존 `getDataConnection().prediction_coverage` (변경 없음) | 이미 fetch 중인 값 그대로 표시만 추가 |

유지 링크: `research-os/discovery`, `research-os/brain`, `research-os/agents`, `research-os/workflow`, `research-os/explain`, `research-os/graph`, `research-os/timeline`, `research-os/chat`

## Tab 4 · Risk & Governance — "RiskGovernor · permissions · audit · approvals"

| 섹션 | API | 표시 필드 |
|---|---|---|
| Risk & Scenario(기존 패널 이동) | 기존 `getInvestmentOs()`의 `risk_budget`/`exposure`/`scenarios` (변경 없음) | 위치만 이동 |
| Separation Invariants(기존 패널 이동) | 기존 `getInvestmentOs().separation` (변경 없음) | 위치만 이동 |
| Risk Governor | `getRisk()` | `governor`, `limits`, `execution_risk_events`, `autonomy.{level,live_execution_enabled}` |
| Governance | `getProductionReadiness()` | `governance_status.{governance,passed,checks}`, `production_health.{overall_severity,components}` |
| Council / Approvals | `getAgents()`, `getConsoleCouncil(40)` | `AgentsResp.{council,live_execution_enabled}`, `decisions[]`(최근 항목만) |
| Audit Log | `getLogs(80)` | `logs[]`(최근 항목만), `count` |

유지 링크: `research-os/committee`(debate), `research-os/production`(full tabs)

## Tab 5 · Operations — "data ingestion · execution status · system logs"

| 섹션 | API | 표시 필드 |
|---|---|---|
| Execution Ladder(기존 패널 이동) | 기존 `advanceLadder`/ladder state (변경 없음, write action 유지) | 위치만 이동 |
| Pipeline Monitor | `getMonitor()` | `stages[].{key,label,count}`, `capital`, `proposals`, `approvals` |
| Orders | `getOrders()` | `lifecycle_events`, `requests.length`, `responses.length` |
| Live Data Sources | `getLiveIntelligence()` | `data_sources.{count,available_count,by_category}`, `data_health.{overall_status,issue_count}` |

유지 링크: `research-os/console`(Operating Console, 세션 제어), `research-os/workflow`(sessionAction, write)

## 변경 없음 확인

- 신규 backend endpoint: 0
- 신규 계산/파생 로직: 0 — 위 표의 모든 필드는 소스 페이지가 이미 그대로 표시하던 필드
- write action 페이지(`workflow`의 `sessionAction`, `committee`의 memo 생성): 링크만, merge 대상 아님 — 그대로 유지
- 기존 Investment OS 패널(Forward Learning/Execution Ladder/Portfolio/Risk/Separation) 로직 전부 무변경, 탭 배치만 변경
