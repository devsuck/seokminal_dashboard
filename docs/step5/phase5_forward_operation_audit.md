# Phase 5 — Forward Operation Audit (5-A / 5-D)

읽기전용 감사. 코드 변경 없음. 목적: "시스템을 더 크게 만들지 않고, 실제 투자 판단 운영 환경으로 안정화."

## 5-A. Forward Learning 운영 검증

`jarvis.investment_os.forward_learning.build_forward_learning_records()` (STEP4-A, 읽기전용 projection) 를
실데이터에 그대로 호출. 추적 대상 5개 전략(paper_active 4 + watchlist 1) 전부 Candidate→Paper→Forward
루프에 실제로 들어와 있음 — 등록 안 된 전략, prediction capture 누락 전략 없음.

| strategy_id | lifecycle_status | thesis (현재 값) | forward_start | forward_duration | current_decision(근사) |
|---|---|---|---|---|---|
| futures_tsmom | paper_active | `CONFLICT — HUMAN REVIEW REQUIRED` ⚠️ | 2026-07-31 (⚠️ 오염, 실제 2026-07-03) | 2개월 | next: live_candidate(human-gated) / paper_failed / paper_retired |
| futures_tsmom_32mkt | paper_active | `PROCEED TO VALIDATION (human-gated)` ⚠️ | 2026-07-31 (⚠️ 오염, 실제 2026-07-03) | 2개월 | 〃 |
| kr_dart_buyback_drift_v1 | paper_active | `PROCEED TO VALIDATION (human-gated)` ⚠️ | 2026-07-31 (⚠️ 오염, 실제 2026-07-03) | 0개월(forward report 없음) | 〃 |
| kr_turn_of_month_v1_PORTFOLIO | paper_active | `PROCEED TO VALIDATION (human-gated)` ⚠️ | 2026-07-16(정상) | 0개월(forward report 없음) | 〃 |
| kr_earnings_surprise_pead_v1 | watchlist | `INSUFFICIENT BASIS — form hypothesis / run experiment first` | — | — | next: paper_candidate / rejected / retired |

`current_decision` 은 기존 스키마에 단일 필드로 없음 — `next_possible` + `human_approval_required_next` +
`decision_history` 마지막 항목의 조합으로 이미 답변 가능(신규 필드 없이 read-model 그대로 사용, 5-D 참고).

⚠️ 표시 5건은 아래 문제 목록 P1/P2/P3/P4 로 원인 규명됨.

## 문제 목록 (Phase 5-D)

### P1. `evidence_used` — dict 키가 값으로 오염 (CONFIRMED)

- 위치: `jarvis/research_workflow/prediction_capture_hook.py:44`
- `build_committee_packet()`가 반환하는 `supporting_evidence` 는 `{"evidence":…, "arguments":…, "bull_case":…}`
  형태의 **dict(3개 카테고리)** 인데, `capture_from_committee()` 가 이걸 리스트처럼 순회
  (`[str(e) for e in (p.get("supporting_evidence") or [])]`) — Python은 dict를 순회하면 키를 준다.
  결과: 모든 committee-sourced prediction의 `evidence_used` 가 실제 근거와 무관하게 항상
  `["evidence", "arguments", "bull_case"]`.
- 영향: 완료기준 Q2("각 전략은 왜 살아있는가?")를 `evidence_used`로 답할 수 없음 — 4건 전부 오염.

### P2. `invalidation_condition` — 항상 `"return"` (CONFIRMED)

- 위치: `jarvis/research_workflow/prediction_capture_hook.py:40` (소비) +
  `jarvis/research_workflow/investment_committee.py`(`limitations` 필드, 생산)
- 추적: `limitations[0]` ← `debate.missing_evidence` ← `research_reviewer.review()`'s
  `quality.missing_validations` ← `research_ingestion.models.validate_backtest()`'s
  `[m for m in REQUIRED_VALIDATIONS if m not in metrics]`. `REQUIRED_VALIDATIONS` 자체는 정상 설계
  (백테스트 필수지표 9종 체크리스트) — **그러나 committee 질문 packet에는 `metrics` 가 채워지지 않으므로
  9개 전부 "누락"으로 판정되고, 항상 튜플의 첫 항목("return")이 index-0으로 뽑힘.** 전략이 무엇이든 항상
  동일 문자열 — invalidation_condition으로서 무의미.
- 영향: 완료기준 Q3("실제 결과가 thesis와 일치하는가" 판단의 반증조건)이 비어있는 것과 동일.

### P3. `thesis` — committee packet이 recommendation 라벨을 그대로 사용 (CONFIRMED, 가장 광범위)

- 위치: `jarvis/research_workflow/decision_center.py:29` — `"thesis": memo.get("recommendation")`
- `DecisionSupportEngine.build_memo()` 는 `recommendation`(절차적 라벨: PROCEED/CONFLICT/CAUTION/INSUFFICIENT)
  과 `rationale`(실질 근거 텍스트, 예: `"Confidence LOW · council=CONFLICT... · main risk=REGIME... ·
  historical cases=8 · unknowns=1"`) 를 **별도 필드로 이미 갖고 있는데**, `committee_packet()` 이 `thesis`
  키에 `rationale` 대신 `recommendation` 을 배선 — 실제 논지가 아니라 다음 단계 라벨이 thesis로 저장됨.
- 영향: **4개 paper_active 전략 전부**의 thesis가 "왜 믿는가"가 아니라 "다음에 뭘 해야 하는가" 라벨. 원래
  futures_tsmom만 이상해 보였던 것("CONFLICT")은 이 버그의 한 사례일 뿐 — 전체 committee-sourced 예측에
  구조적으로 적용됨.

### P4. `paper_start_date` — 최신 배포 레코드를 씀, 최초 배포 아님 (CONFIRMED, write-side 이상 동반)

- 위치: `jarvis/investment_os/forward_learning.py` `_deployment()` → `jarvis.paper.deploy.deployment_of()`
  → `rows[-1]`(가장 최근 행).
- `forward_deployments.jsonl` 에 `futures_tsmom`/`futures_tsmom_32mkt`/`kr_dart_buyback_drift_v1` 각각
  **165개** 중복 배포 레코드 존재(2026-07-03 최초 ~ 2026-07-31 today, 파일 mtime과 마지막 행 시각 일치 —
  최근에도 계속 기록되는 중). registry.jsonl에는 해당 3개 전략 모두 `paper_candidate→paper_active` 전이가
  **딱 1회**(2026-07-03T03:28:01Z)만 기록되어 있고 이후 추가 전이 없음 — `deploy()`의 현재 코드는
  `already_paper_active`/`not_registered` 가드가 있어 이미 활성 전략엔 재기록하지 않는데도 계속 새 행이
  붙는 중. 원인 프로세스는 미확정(정적 감사로는 못 찾음 — 코드베이스 전체 grep으로 `forward_deployments.jsonl`
  쓰기 지점은 `deploy()` 단 하나뿐임을 확인했으나, 그 가드를 우회하는 실제 호출 경로를 찾지 못함).
  추가로 registry에 아예 등록된 적 없는 strategy_id 3개(`scan_asset_transfer`, `scan_turn_to_profit`,
  `scan_treasury_disposal`)도 각 144~160개 고아 배포 레코드를 갖고 있어 — `deploy()`의
  `not_registered` 가드도 우회되고 있다는 추가 증거.
- 영향: 대시보드에 표시되는 `paper_start_date` 가 "지금"으로 계속 밀려서, 실제로는 4주 전부터 forward
  추적 중인 전략이 "오늘 막 시작"으로 보임 — forward_duration 왜곡.
- **범위 밖(이번 audit에서 해결 안 함)**: 쓰기측 이상현상의 정확한 호출 경로는 정적 분석으로 확정 불가 —
  런타임 계측(로그 추가)이 필요하나, 이는 "새 인프라 추가 금지" 원칙과 충돌 소지가 있어 별도 후속 논의
  필요. 이번엔 읽기측(투영 함수)만 최소 수정.

### 등록/orphan 체크 (문제 없음)

- 61개 전체 전략: `rejected` 35 / `draft` 15 / `blocked_by_data` 6 / `paper_active` 4 / `watchlist` 1.
- status vs `frozen` 설정 불일치: 0건.
- paper 트랙 전략 중 배포 레코드/prediction capture 누락: 0건.
- registry에 없는 전략을 참조하는 prediction: 0건.
- registry에 없는 전략을 참조하는 배포 레코드: 3건(P4의 orphan 3개, 위에서 다룸).

### P5. 이미 캡처된 committee-sourced prediction 5건 전부 P3 오염 상태로 영구 고정 (CONFIRMED, 사람 결정 필요)

- P1/P2/P3 코드 수정은 **향후 신규 capture부터만** 적용됨. `prediction_registry`는 사전등록 무결성
  원칙(hindsight 방지)상 과거 행을 코드가 임의로 재작성해선 안 됨 — 그래서 고의로 건드리지 않음.
- 확인: `prediction_registry.list_predictions()` 에서 `source == "committee"` 인 5건 전부
  (futures_tsmom / futures_tsmom_32mkt / kr_dart_buyback_drift_v1 / kr_turn_of_month_v1_PORTFOLIO /
  kr_earnings_surprise_pead_v1) `captured_at = 2026-07-29T00:00:00Z`(동일 배치) 로, thesis가
  recommendation 라벨 그대로 저장돼 있음 — P3 버그의 산출물 100%.
- 영향: 코드는 고쳤지만 대시보드 Strategy Intelligence 탭에 표시되는 thesis는 **여전히** 라벨
  그대로임(브라우저로 재확인, 2026-07-31) — `build_record()`가 이미 기록된 prediction을 그대로
  읽기 때문. 재발이 아니라 "이미 있던 오염 데이터가 안 지워짐."
- **사람 결정 필요**: (a) 5건을 그대로 두고 향후 재캡처분부터 정상화 vs (b) 이 5건은 버그로 인한
  오기록임이 명백하므로 예외적으로 재캡처(신규 thesis로 덮어쓰지 않고 **새 행 추가**, 구행은
  audit trail로 보존) — 둘 다 코드가 자동으로 고르면 안 됨. 이번 audit에서는 코드/데이터 어느 쪽도
  임의로 변경하지 않고 이 판단만 인계함.

## 다음 커밋에서 처리 (반영 완료, 2026-07-31)

- P1/P2/P3: `prediction_capture_hook.capture_from_committee()`(+ 신규 helper `_evidence_from_committee()`)
  + `decision_center.committee_packet()`(`thesis` 필드 재배선) + `investment_committee.build_committee_packet()`
  (`limitations` 병합 순서 교정) — 전부 기존 필드 재배선/순서 수정, 신규 구조 없음. **완료, 신규 capture부터 적용.**
- P4: `jarvis.paper.deploy.first_deployment_of()`(신규 함수, 기존 `deployment_of()` 옆에 추가) +
  `forward_learning._first_deployment()`(신규, `_deployment()`와 별개) → `paper_start_date` 만 최초 배포
  행 기준으로 수정. 실측 검증: `futures_tsmom`/`futures_tsmom_32mkt` 모두 `2026-07-03T03:28:01Z` 로 정상화
  (이전엔 호출할 때마다 "지금"으로 밀림). **완료.** 쓰기측 이상현상(중복 append 원인)은 여전히 미확정 —
  범위 밖으로 유지.
- P5: 위 신규 발견 — **코드 수정 없음, 사람 결정 대기.**
- 회귀 확인: `pytest tests/ -q` 2033 passed(수정 전과 동일 카운트) · `governance.validate_all()` 5개 domain
  전부 `passed=true` · `npx tsc --noEmit` clean · `npm run build` clean · 브라우저로 5개 탭 전부 실데이터
  로딩 확인(콘솔 에러 없음).

### P6. Monthly Decision Loop(5-C) 추가 중 architectural separation 자체회귀 발견·즉시수정 (CONFIRMED, FIXED)

- 5-C용 `jarvis/investment_os/monthly_review.py` 신규 작성 중 `jarvis.execution_risk.ledger.read_events()`
  를 risk_changes 필드 채움용으로 import했다가, `jarvis.investment_os.separation.validate_separation()`
  의 `no_execution_defs_or_brokers` invariant가 `false`로 회귀(`separated: true` → `false`, 대시보드
  "SEPARATED" 배지 → "REVIEW"로 변경) 확인.
- 근본원인: `separation.py`의 `_BROKER_PREFIX`에 `"jarvis.execution"` 이 포함돼 있고,
  `"jarvis.execution_risk".startswith("jarvis.execution")` 가 `True` — `jarvis.execution_risk`는
  실행/브로커 모듈이 아니라 읽기전용 리스크 감사 원장(기존에 `console_api.py` `/risk` 라우트에서
  이미 직접 사용 중)이지만, investment_os 패키지 *안에서* 이 모듈을 import한 파일이 지금까지 없었기
  때문에 이번에 처음 걸림. `validate_separation()` 직접 호출로 정확한 violation 문구 확인:
  `"investment::monthly_review.py imports broker 'jarvis.execution_risk.ledger'"`.
- 수정: separation checker(`_BROKER_PREFIX`)는 건드리지 않음(Phase 5 — 기존 안전장치 약화 금지 원칙).
  대신 `monthly_review.py`에서 해당 import·`recent_execution_risk_events` 필드를 제거(5-C 스펙의
  "Risk Changes" 단계는 이미 `forward_learning`에서 가져오는 `invalidation_condition`으로 충족 —
  execution_risk 이벤트 카운트는 필수 아니었음). 프론트 `MonthlyReviewStrategy.risk_changes` 타입에서도
  동일 필드 제거(`lib/console-api.ts`).
- 재검증: `validate_separation()` → `separated: True, violations: []` · API 재기동 후
  `/console/investment-os` curl로 `separated: true` 확인 · 브라우저 스크린샷으로 "SEPARATED" 초록 배지
  복귀 확인(2026-07-31) · `pytest tests/ -q` 2033 passed(동일) · `governance.validate_all()` passed=true
  재확인.
