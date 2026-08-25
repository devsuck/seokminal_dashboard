# Agentic AI Trading System Roadmap — Rule Bot → Autonomous Research → (먼 미래) Trading Firm

**작성:** 2026-07-02 · **톤:** 차갑고 회의적. 수익 주장 없음. "구조는 알파가 아니다."

> ⚠️ **"현재 위치" 섹션은 07-02 스냅샷 그대로 방치돼 있던 걸 2026-08-25에 stale로 확인·갱신함.**
> 아래 원칙·Level 정의·검증표준·안전모델은 여전히 유효(계속 지켜지고 있음) — stale했던 건 "지금 어디까지 왔나"라는 사실 서술뿐.

> 핵심 원칙 3줄:
> - **연구 자유 ≫ 실행 자유.** AI는 리서치에서 자유롭고, 자본 실행에선 거의 무권한.
> - **random 분포를 못 이기면 폐기.** 단일 랜덤 아님, 500회 시드고정 분포.
> - **검증된 엣지 하나 나오기 전엔 Lv3 자율루프·Lv4/5 코드 안 짓는다.**

---

## 현재 위치 (2026-08-25 갱신)

- **검증된 엣지: 더 이상 0개 아님.** KR turn-of-month 포트폴리오가 포트레벨 재검(p=0.002) 통과 후 `paper_active` 승격, forward 자동배선(매월 코호트 누적 중, 3~12개월 관찰 후 WF 후반 감쇠 재현여부로 KILL/유지 판단). buyback v2(레짐필터) shadow도 in-sample 개선 확인, forward 대기 중. 상세: `seokminal-multi-venue/docs/roadmap.md` "완료된 Phase"/"진행 중".
- **Lv3 경계가 이미 실무상 넘어감.** `jarvis/execution/arm_criteria.py`가 결정론적으로 GO/WAIT/KILL 판정을 내고(`research/lab/service.py::_warm_edge`가 6h마다 재평가, 변화 시 텔레그램 알림), 대시보드 "전략 증류"(Phase 54, 거래로그→규칙전략 증류)도 가동 중. 다만 **실계좌 자동집행은 없음** — arm 판정은 여전히 "사람이 arm 여부를 참고해 수동 판단"에 그침, DB 에이전트 전량(`agents.db`) `paper=1`.
- ⚠️ **혼동 주의: `agents.autonomy` 컬럼(1/2/3, 대시보드 Phase 53) ≠ 이 문서의 Lv1~5 스케일.** 전자는 "AI가 얼마나 알아서 판단하나"(1=고정룰/2=AI전략가/3=완전자율)를 뜻하는 개별 에이전트 설정값이고, 후자는 플랫폼 전체의 진화 단계(연구자유 vs 실행권한) 개념. `agent.autonomy=3`(완전자율) 에이전트가 있다고 플랫폼이 Lv3라는 뜻은 아님 — 이 문서 기준 Lv 판단은 "실행권한이 실제로 얼마나 넘어갔나"로만.
- **Lv4/5 = 여전히 코드 없음.** 포트폴리오 자동배분·라이브 자율실행 전부 미착수. 다음 마일스톤은 사람이 arm하는 소액 실계좌 트랙(문서 Phase 7과 동일 방향).
- **옵션/IB는 액티브 스코프 밖(제품 결정, 코드 플래그 아님).** 옵션 분석(`options/pricer.py`)·IB venue(`backends/ib/`) 코드는 존재하지만 유저가 확장 대상에서 제외하기로 결정(2026-08-25). 완전성 판단·다음작업 제안에서 카운트 금지.
- **Polymarket은 코드베이스에서 완전삭제됨(2026-08-25)** — 한국 IP 지오블록(HTTP 451) + 유저 장기 한국상주 확정. 아래 본문 중 Polymarket을 알파원으로 언급하는 부분은 역사적 기록이지 현재 방향 아님.

---

## 돈 버는 구조 (목표 재정의)

목표 = **돈 벌기.** 그러면 "AI 에이전틱 트레이딩"은 목적 아니라 도구. 돈 버는 경로 3개: ①시장 베타 ②리스크 프리미엄 ③진짜 알파. 우리가 한 건 ③ 시도 → 교과서 단기 알파 10개 전부 실패. 그래서 구조를 이렇게 잡음:

| 레이어 | 자본 | 역할 | AI 용도 |
|---|---|---|---|
| **Core** (장기투자) | **80~90%** | ETF/현금/채권 저빈도 리밸런싱 = 베이스 성장(망할 확률 최저) | 리밸런싱 알림·밸류/금리/환율 모니터·리스크한도·세금·수수료 체크 |
| **Satellite** (검증 퀀트) | **5~10%** | 검증 통과 전략만 소액. 전략당 1~3% | paper→소액 live, 리스크 모니터 |
| **고위험 실험** (선물/코인) | **0~5%** | 레버리지·고변동 소액 실험 | 검증·모니터 |
| **Research** (AI 에이전트) | — | 가설생성·백테스트·random비교·실패정리·paper후보·리스크모니터 | Lv3는 엣지 나온 뒤 |

**하드 운영 원칙 (non-negotiable):**
- **검증된 엣지 0개일 때 실전 자동매매 0원.**
- paper 3개월 생존 전 live 금지. live는 아주 작게 시작. 손실 한도 넘으면 자동 정지.
- AI에게 절대 금지: 실계좌 직접 주문 / 손실 후 자기튜닝 / 리스크한도 변경 / 통과기준 완화.
- **하지 말 것:** 15m 차트패턴 계속 튜닝 · TSLA만 살리기 · weekly funding 조건 계속 바꾸기 · LLM에 매수매도 위임 · 레버리지로 빨리 복구 · 검증 전 실계좌 투입.
- ⚠️ 리스크 고지(SEC/FINRA): 데이트레이딩 초기 큰 손실 흔함, 마진/공매도/선물 레버리지 = 원금 이상 손실 가능. **자동매매를 메인 수입원으로 두지 말 것.**

## 다음 알파 리서치 우선순위 (하나씩, 대성당 금지)

15m 주식 단타·단순 funding은 사망. 더 그럴듯한 순서:

1. **선물 multi-asset time-series momentum (TSMOM)** — 학술적으로 제일 견고(AQR). 일/주봉, 3~12개월 모멘텀 + volatility targeting, trend break/월 리밸런스. 베이스라인=random same-freq + buy&hold + cash.
   - ⚠️ **데이터 게이트:** IB 선물은 CME 등 거래소별 구독 필요(미구독). 일봉 선물 데이터 확보 가능여부 먼저 audit. TSMOM도 2010 이후 감쇠 + 무상관 시장 다수 필요.
2. **코인 시장구조** — 단순 funding(사망) 말고 funding+OI변화 / funding+basis / funding regime shift / liquidation / cross-exchange spread. 차트 아니라 구조 데이터.
3. **이벤트 기반 저빈도** — 실적 전후 반응·가이던스·공시·ETF 리밸런싱·한/미/독 정보 비대칭. 사용자 강점(언어/정보정리)과 궁합. 데이터 지저분 = 오히려 엣지 가능성. **단 정식 캘린더/surprise 데이터 필요**(LLM 뉴스읽기 아님).

각 트랙 = 기존 검증 하네스 재사용(random 분포·비용·walk-forward·BH·underpowered). 판정 못 넘으면 폐기.

## 제품 트랙 (Week 2+, 급하지 않음) — Strategy Validation Terminal UI

검증 하네스를 기존 대시보드(`/backtest`·`/performance`)에 얹어 UI화. **개인 도구 우선, 제품화는 그다음.** 최소로(대성당 금지).
- 기능: 전략 입력 → 백테스트 → random 분포 비교 → 비용 반영 → walk-forward → 리포트 + 실패사유 설명
- 메시지: "당신의 전략이 진짜 엣지인지, 랜덤인지, 비용 후 죽는지 검증한다."
- ❌ "이 전략 돈 벌어요" (알파 주장 금지) ⭕ "랜덤보다 나은지·비용 후 살아남는지 검증"

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
