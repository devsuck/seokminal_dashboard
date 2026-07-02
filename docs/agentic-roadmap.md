# Agentic AI Trading System Roadmap — Rule Bot → Autonomous Research → (먼 미래) Trading Firm

**작성:** 2026-07-02 · **톤:** 차갑고 회의적. 수익 주장 없음. "구조는 알파가 아니다."

> 핵심 원칙 3줄:
> - **연구 자유 ≫ 실행 자유.** AI는 리서치에서 자유롭고, 자본 실행에선 거의 무권한.
> - **random 분포를 못 이기면 폐기.** 단일 랜덤 아님, 500회 시드고정 분포.
> - **검증된 엣지 하나 나오기 전엔 Lv3 자율루프·Lv4/5 코드 안 짓는다.**

---

## 현재 위치 (냉정, 2026-07-02 갱신)

- **검증된 엣지: 0개** (10개 가설 검증: 주식6 + 크립토 funding4). `research/reports/VALIDATION_SUMMARY.md`.
- **전략 결정: 알파 사냥 중단.** 포지셔닝을 **"AI 트레이딩 봇" → "Strategy Validation Terminal"** 로 전환(1+3 혼합). 실투자=패시브/저빈도. 고급 알파원(이벤트/온체인/옵션)=학습·제품기능 한정.
- **Lv2(검증 플랫폼) 완성 = 이게 핵심 자산.** `research/validation/*` + funding_backtester + 데이터저장소 + registry.
- **Lv3/4/5 = 보류.** 검증 엣지 0개 상태에선 자율루프 = 비싼 REJECT 기계. 엣지 하나라도 나오면 그때 재개.

---

## Level 정의

| Lv | 이름 | 한 줄 | 자본 실행 권한 |
|---|---|---|---|
| 1 | 룰 실행봇 | 사람이 만든 고정 룰만 실행 | (기존 봇 인프라) |
| 2 | 체계적 검증 플랫폼 | 사람이 전략 정의 → 시스템이 검증·베이스라인·리포트 | 없음 |
| 3 | 자율 리서치 에이전트 | AI가 가설 생성→검증→폐기→paper후보 등록 | **없음(하드 경계)** |
| 4 | 포트폴리오 운영자 | 검증된 전략 다수 모니터·배분·감쇠감지·리스크예산 | 제안만, 승인 필요 |
| 5 | 자율 트레이딩 펌 | 데이터·리서치·포트폴리오·실행모니터·리스크까지 | 하드 컨트롤 하에서만 |

**Lv3 정직한 정의:** AI 창의적 알파발견 ❌. **인간이 만든 전략 DSL 위의 파라미터/조합 탐색 + 검증 파이프라인** ⭕. 탐색공간이 유계라 리크·과적합 표면이 작은 게 장점. "AI가 알파 발견"으로 포장 금지.

---

## 안전 모델 (non-negotiable, 나중 실돈의 생명줄)

AI 에이전트가 **읽기 가능:** `data/ reports/ backtests/ paper_trading/ research/`
AI 에이전트가 **쓰기 가능:** `research/` 하위, `tests/research/`
AI 에이전트가 **접근 금지(읽기·쓰기·호출 전부):**
```
execution/ broker/ live/ risk_limits/ account/ credentials/ config/live/ models/live_registry/
브로커 API · 주문 엔드포인트 · 킬스위치 설정 · 라이브 모델 레지스트리
```
- 에이전트는 **paper 후보를 제안**할 수 있으나 **자동 승격·실행 불가.**
- **자동 live 상태 없음.** live 진입은 언제나 사람 승인.
- 검증 임계값 낮추기·나쁜 결과 숨기기·라이브 모델 덮어쓰기 금지.

**퍼미션 가드**(`research/agents/permissions.yaml` + 쓰기 전 강제 검사)는 자율루프 전이라도 지금 지음(싸고, 수동 단계에서도 안전벨트).

---

## 검증 표준 (모든 레벨 공통, 절대 완화 금지)

- **비용:** `effective_cost_bps = cost + slippage + spread/2`. gross·net 둘 다 보고. 비용 전만 되면 invalid.
- **random 베이스라인 = 분포:** N=500, 시드고정, **동일 opportunity set**(같은 종목·세션·거래창·거래수·holding·비용). empirical p = `(1+beating)/(N+1)`.
- **샘플가드:** 정상 리포트 100거래 선호 / 최소 50 / 서브그룹 30 / 워크포워드 3폴드+. 미달 시 `underpowered` 플래그, paper 승격 금지.
- **리크 통제:** 전체 데이터로 임계값 최적화 금지. 미래봉 피처 금지. 라벨/진입/청산/비용 lookahead 금지. random은 반드시 동일 opportunity set.
- **다중검정:** 여러 종목/변형 동시 검정 시 BH-FDR 보정. 30개 중 1~2개 p<0.05는 노이즈(우연 1+ ≈ 78.5%).

**승격 기준(paper 후보):** net expectancy(비용후) 양수 · random 95pct 초과 · empirical p<0.05 · 거래수 충분 · walk-forward OOS 양수 · 리크 없음 · underpowered 아님. **paper 후보 ≠ 라이브 승인.**

---

## LLM 역할 (트레이더 아님)

허용: 가설 생성 보조 · 실험 계획 · **제한된 DSL/스키마 채우기** · 리포트 요약 · 실패 분석 · 뉴스/이벤트 범주화(이진 플래그).
금지: 매수/매도 직접 결정 · 가짜 numeric score(`risk_score: 72`). 캘린더 사실은 캘린더 데이터에서(LLM 추측 아님).

**LLM은 코드를 쓰지 않고 DSL 스펙을 채운다 → 결정론 컴파일러가 실행.** 리크 표면 최소화:
```json
{ "strategy_type": "orb_continuation", "opening_range_minutes": 30,
  "entry_window_minutes": [30,90], "rvol_threshold": 1.5,
  "requires_above_vwap": true, "stop": "1_ATR", "target": "2R", "time_stop_bars": 8 }
```

---

## 단계별 로드맵 (현 상태 기준 재정렬)

### Phase 1 — ORB 전체 30종목 판정 완료 ⏳ (진행중)
- 데이터 수집 완료 → `run_orb_universe` 로 pooled·95pct수·BH-FDR·OOS.
- **성공/실패 무관 = 진전.** universe pooled가 비용 후 random 못 이기면 일반 ORB 폐기.
- 언락: 판정 나옴(엣지/노이즈 확정).

### Phase 2 — 수동 가설 3~5개 추가 검증
- 기존 하네스로 손으로. 새 프레임워크 0. 고정 파라미터·random 분포·비용·walk-forward·샘플가드.
- 백로그: ① VWAP 평균회귀 ② ORB 실패돌파 반전 ③ 섹터상대 모멘텀 ④ 갭 페이드/지속 ⑤ ATR 압축 돌파.
- 목적: **엣지 공간에 뭐라도 깜빡이나.** 못 넘으면 폐기.
- 언락: 최소 1개 생존 → Phase 4 자동화 정당화 / 전부 REJECT → 데이터·자산군·타임프레임·실행환경 재검(Lv3 아님).

### Phase 3 — Lv3 안전 뼈대 (지금 지어도 됨, 싸고 유용)
자율루프 아님. **연구 장부 + 안전벨트.** 수동 실험에도 필요.
1. **permission guard** — `permissions.yaml` + 쓰기 강제.
2. **hypothesis schema** — 구조화 JSON(market_logic·required_data·entry/exit·baseline·kill_criteria·promotion_criteria·status). 모호한 가설("AI로 좋은 거래 찾기") 거부.
3. **experiment_registry.jsonl** — 돌린 가설·**data_version·param/code version**·성과·폐기이유 기록. 제안 전 registry 조회 → 같은 실패 반복 방지.
4. rejected는 삭제 금지, `research/candidates/rejected/` 보관.
- 언락: 뼈대 존재 + Phase 2에서 엣지 후보 ≥1.

### Phase 4 — 제한적 Lv3 루프 (조건부 진입)
**진입 조건(하드): Phase 2/3에서 최소 1개 전략이 net>0 · random 95pct초과 · p<0.05 · WF OOS 유지 · 거래충분.** 없으면 진입 안 함.
- 그 생존 전략 **주변만** 탐색(DSL 변형). LLM은 DSL 채우기, 결정론 컴파일러 실행.
- ⚠️ **과적합 가드:** 생존자의 **원본 OOS는 성역(튜닝 금지).** 변형은 held-out + 더 엄격한 FDR. **kill budget**(런당 실험 상한, 예: 3) + 폐기 편향(수정보다 폐기 선호) — 검정 남발 = 데이터 스누핑.
- critic/실패분석 + paper-candidate registry. **라이브 무권한.**
- 언락: 에이전트가 사람 개입 없이 제안·검증·폐기·paper후보 등록. live 무접근.

### Phase 5 — Paper Trading 자동화
- paper 후보 자동 배포 → paper 성과 모니터 → backtest 대비 drift 감지 → 감쇠하면 폐기.
- paper = 실자본 없는 forward-test 필터. 언락: paper가 라이브 고려 전 필터로 작동.

### Phase 6 — Lv4 포트폴리오 운영자 (검증 전략 다수 생긴 뒤)
- 다전략 모니터·배분 제안·상관·포트 drawdown·감쇠·리스크예산. **제안만, 라이브 배분 자동변경 금지.**
- 전제: 검증된 전략 여러 개(지금 0개 → 한참 멀었음).

### Phase 7 — 통제된 라이브 자율 (사람 승인 + 소액)
- 사람 승인 live 후보, 소액만, 결정론 리스크 게이트웨이, 하드 킬스위치, 일/주 최대손실·최대주문·최대배분, 모니터·롤백.
- 언락: AI가 리스크 컨트롤 우회 불가한 채로 제한 라이브 실행.

### Phase 8 — Lv5 자율 트레이딩 펌 (장기·먼 미래)
- 자율 데이터소스 확장·신자산군 리서치·멀티에이전트 팀·포트 배분·실행품질·규제/운영 모니터·사람 에스컬레이션.
- **로드맵 문서로만 존재. 지금 코드 0.**

---

## 지금 짓지 말 것 (알파 전 아키텍처 대성당)
- Lv3 풀 자율생성기(엣지 0개 상태 = 비싼 REJECT 기계)
- LLM 자유 코드 작성(리크 공장) — DSL만
- LLM numeric risk score
- 레짐 분해·풀 ablation·승격 엔진(엣지 깜빡이기 전)
- Lv4/5 코드(검증 전략 다수 전제)

## 즉시 다음 (brutally practical)
**ORB 전체 30종목 판정 마무리 → 수동 가설 3~5개 → 안전 뼈대(가드·스키마·registry).** 엣지 하나라도 깜빡인 뒤에만 Lv3 루프. 안 깜빡이면 데이터/자산군/타임프레임 재검.

> Architecture is not alpha. Agent freedom ≠ execution freedom. Random baseline distribution is mandatory. No live autonomy before validation and paper evidence.
