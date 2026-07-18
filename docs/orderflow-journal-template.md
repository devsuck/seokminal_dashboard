# 오더플로우 재량매매 저널 템플릿

목적: 오더플로우 레이어는 harness 미검증 — 진입 태그 쌓아서 나중에 표본 기반 검증(랜덤베이스라인/WF) 가능하게. 매 진입마다 1행 채울 것.

## 필드

| 필드 | 값 예시 |
|---|---|
| 일시 | 2026-07-18 14:32 UTC |
| 심볼 | BTC.HL |
| 방향 | long / short |
| ICT 컨텍스트 | killzone(런던/NY) / liquidity target(equal highs·lows) / order block / FVG / MSS·CHoCH / premium·discount |
| 오더플로우 트리거 | imbalance / absorption / stop-run / divergence / iceberg / large-trade / gex-wall / liq-cluster (해당 전부 기입) |
| 레벨 근거 | POC/VA / cVA / VWAP±σ / 세션고저 / GEX감마월 / 청산클러스터 (어떤 레벨에서 나온 신호인지) |
| 진입가 | |
| 스탑 | |
| 목표가 | |
| 리스크(R) | |
| 결과(R배수) | |
| 메모 | 왜 들어갔는지 1줄. 실제로 흡수/스탑런이 맞았는지 나중에 캔들 다시 보고 검증 |

## CSV 헤더 (스프레드시트용)

```csv
datetime,symbol,direction,ict_context,of_trigger,level_basis,entry,stop,target,risk_r,result_r,note
```

## 예시 행

```csv
2026-07-18T14:32:00Z,BTC.HL,long,liquidity_sweep_session_low,stop-run+absorption,session_low+VWAP-1sigma,64200,64050,64700,1,+2.1,"세션저 이탈 스탑런 뜬 직후 흡수 마커, VWAP-1σ 지지 확인 후 롱"
```

## 규칙
- ICT 컨텍스트 없이 오더플로우 트리거만으론 진입 안 함 (반대도 동일) — 두 프레임 겹칠 때만 기록·진입
- 최소 30건 쌓이기 전까진 이 패턴을 "엣지"라 부르지 말 것 — 그냥 재량 기록
- 30건 이상 쌓이면 win rate 아니라 **기대값(R 평균)**으로 판단 — [[feedback_kr_validation_lessons]]와 동일 원칙(win rate 아닌 expectancy)
