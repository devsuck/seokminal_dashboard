# Phase 5-F — Prediction Registry Integrity Resolution & Operation Freeze

목적: Phase 5(5-A/5-D) audit에서 발견된 P5 — committee-source prediction 5건의 capture 오염 상태를
정리한다. 신규 기능 개발 아님. 과거 기록은 보존하고(삭제/수정 금지), 향후 validation/score 체계가
오염되지 않도록 registry 상태만 명확히 한다.

## Step 1 — P5 Prediction Audit

대상 5건 (전부 `source=committee`, `captured_at=2026-07-29T00:00:00Z`, 동일 배치 캡처):

| prediction_id | strategy_id | strategy_family | confidence | current_status | snapshot_hash |
|---|---|---|---|---|---|
| PRED:d17ece54b5fe | futures_tsmom | momentum | LOW | PENDING | sha256:2788fe1b723ae9b9 |
| PRED:ce0a7a459782 | futures_tsmom_32mkt | momentum | LOW | PENDING | sha256:6e567ea1da6be521 |
| PRED:00bf96d464d7 | kr_dart_buyback_drift_v1 | event | LOW | PENDING | sha256:6451e93248fc2c06 |
| PRED:6328bf9b3222 | kr_turn_of_month_v1_PORTFOLIO | event | LOW | PENDING | sha256:bbc293ab47ff835d |
| PRED:335afd93851e | kr_earnings_surprise_pead_v1 | event | LOW | PENDING | sha256:20b75f0ec5e9d327 |

각 항목 확인 결과 (5건 전부 동일한 3가지 증상 — 단일 근본원인):

- **source 존재 여부**: OK — `committee`, `SOURCES`에 유효.
- **capture 규칙 충족 여부**: FAIL — `thesis` 필드가 실제 연구 근거가 아니라 committee 라우팅 라벨
  그대로 저장됨 (`"CONFLICT — HUMAN REVIEW REQUIRED"` / `"PROCEED TO VALIDATION (human-gated)"` /
  `"INSUFFICIENT BASIS — form hypothesis / run experiment first"`). `invalidation_condition` 은
  문자열 리터럴 `"return"` (실제 무효화 조건 아님). `evidence_used` 는 `["evidence","arguments",
  "bull_case"]` — 실제 근거 텍스트가 아니라 `supporting_evidence` dict의 **key 이름 그대로**.
  이 3개 필드 모두 당시 `capture_from_committee()` 버그(Phase 5 P1-P3, 이미 수정됨 — 신규
  capture부터 정상)의 산출물.
- **framework 자동 매핑 여부**: OK — `strategy_family`에서 결정적으로 유도됨(`derive_framework()`은
  thesis와 무관하게 동작하므로 이 버그의 영향을 받지 않음). `evaluation_framework`/`success_rule`
  둘 다 정상.
- **snapshot integrity**: OK(형식적) — `snapshot_hash`는 저장된 core 필드에 대해 올바르게 계산됨.
  단, 그 core 필드 자체(thesis/invalidation_condition/evidence_used)가 위 사유로 오염된 내용이므로
  "해시가 유효하다"는 "내용이 신뢰 가능하다"를 보장하지 않음.
- **evaluation 가능 여부**: 기술적으로는 가능(success_rule이 온전하므로 `evaluate()` 호출 자체는
  동작함) — 그러나 thesis/invalidation_condition이 실제 연구 판단을 반영하지 않으므로, 이 상태로
  채점하면 "무엇을 왜 예측했는지" 감사 불가능한 채로 RIGHT/WRONG이 매겨짐.

## Step 2 — 상태 결정: 전부 INVALIDATED (capture_integrity_failure)

RECAPTURED를 검토했으나 채택하지 않음: RECAPTURED는 "thesis는 유지, capture만 문제"인 경우에만
해당. 이 5건은 thesis 필드 자체가 원 committee 판단을 담고 있지 않아 **원래 thesis를 그대로
복원할 방법이 없다** — `committee_packet()`/`build_committee_packet()`은 저장된 스냅샷이 아니라
호출 시점 현재 상태를 읽는 라이브 계산이므로, 지금 재실행해서 만든 thesis는 2026-07-29 당시
committee의 실제 판단이 아니라 사후에 새로 계산한 값이 된다. 이를 RECAPTURED로 등록하면
사전등록 무결성 원칙(사후 편향 차단)을 이번 정리 작업 스스로가 위반하게 됨. 따라서 5건 전부:

```json
{
  "status": "INVALIDATED",
  "invalidation_reason": "capture_integrity_failure",
  "score_eligible": false
}
```

INVALIDATED ≠ WRONG — 예측 실패가 아니라 기록 품질 문제. 원 prediction row(5건)는 필드 그대로
보존, snapshot_hash 불변. `prediction_registry.set_integrity_status()`(신규, append-only)로
별도 원장(`impact=prediction_integrity`, 기존 rmi_lessons.jsonl 재사용)에 상태만 추가 — 원본
행은 절대 수정하지 않음.

## Step 3 — Score Eligibility Gate

`prediction_registry.graded_predictions()`가 기본적으로 `score_eligible=false`(LEGACY_CAPTURE/
INVALIDATED/RECAPTURED) 예측을 채점 집계에서 제외하도록 수정. 제외 이유는
`prediction_integrity` 원장에 append-only로 남음(감사 가능, 삭제 아님). `registry_status()`에
`by_integrity`/`excluded_from_score_capture_integrity` 필드 추가.

현재 이 5건은 모두 `state=PENDING`(아직 `evaluate()` 안 됨)이라 오늘 시점 `scorable_right_wrong`
숫자에는 영향 없음 — 게이트는 향후 이 5건이 evaluate()될 때 채점 집계에서 제외되도록 하는
선제 조치.

## Step 4 — Dashboard 반영

Monthly Decision Loop(Investment OS Overview 탭)에 Prediction Integrity 카운트 표시 추가:
Valid / Legacy / Invalidated / Recapture Required. `GET /console/monthly-review` 응답에
`prediction_integrity` 필드 추가(`prediction_registry.registry_status()`의 `by_integrity` 그대로
재사용, 신규 계산 없음).

## Step 5 — 운영 Freeze

Prediction Registry 상태 흐름 확정:

```
CAPTURE → ACTIVE → EVALUATED → LEARNED
CAPTURE → INVALIDATED
```

Integrity 축(직교, append-only): `(미분류=VALID) | LEGACY_CAPTURE | INVALIDATED | RECAPTURED`.
이번 작업에서 만들지 않은 것: 새 prediction engine·scoring engine·auto generator·AI researcher·
새 ledger/DB·새 dashboard architecture. `prediction_registry.py`에 함수 2개(`set_integrity_status`,
`_latest_integrity`) 추가 + `graded_predictions()`/`registry_status()` 기존 함수에 게이트 배선만.

## 검증

- Data Integrity: 5건 `snapshot_hash` 변경 전/후 동일 확인 (byte-identical). 원본 row 필드 무수정.
- Governance: `jarvis.research_workflow.governance.validate_all()` → `passed: true`.
- Regression: `pytest tests/ -q` — 수정 전 카운트 대비 신규 테스트만 추가, 기존 테스트 전부 PASS.
- Dashboard: Prediction Integrity 카운트 표시(Valid 0 / Legacy 0 / Invalidated 5 / Recapture 0),
  Monthly Decision Loop 정상, 기존 5 Strategy 상태 유지 — 브라우저로 확인.
