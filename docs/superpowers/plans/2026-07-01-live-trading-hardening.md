# 실매매 안전화 (Live Trading Hardening) Implementation Plan

**Goal:** 페이퍼→실계좌 전환 가능한 수준으로 주문 경로를 안전화. 봇 포지션 정확성, 공통 리스크 가드, 체결가 반영, 감사 로그, 확인 UI.

**Architecture:** 모든 주문 경로(수동 US/KR, 봇, HL)가 단일 `risk_guard`를 통과. 봇 엔진은 실제 브로커 포지션/체결가로 동작. 주문은 영속 audit log에 기록.

**Tech Stack:** FastAPI, ib_async, pydantic, vitest(FE), pytest(BE, asyncio_mode=auto)

## Global Constraints
- `@pytest.mark.asyncio` 금지 (asyncio_mode=auto)
- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- pre-existing 실패 무시: test_auth ×3, test_backtest_happy_path
- FE: 디자인 토큰만, raw fetch 금지(lib/api.ts), style={{}} 금지

---

## Task 1: risk_guard 모듈 (#2 리스크 가드 + #3 수량 검증)
- Create: `seokminal-multi-venue/live_engine/risk_guard.py`
- Test: `seokminal-multi-venue/tests/test_risk_guard.py`
- `RiskConfig` (env 로딩): MAX_ORDER_QTY, MAX_ORDER_NOTIONAL, MAX_POSITION_QTY, DAILY_LOSS_LIMIT, TRADING_KILL_SWITCH
- `RiskViolation(Exception)`
- `validate_order(side, quantity, price_estimate, current_position_qty, day_realized_pnl, config)` — 위반 시 raise
- `DailyPnLTracker` — 일자별 실현손익 누적(인메모리 + 리셋)

## Task 2: 주문 엔드포인트에 risk_guard + Field 제약 (#3, #5-backend)
- Modify: `api_server/main.py` US/KR/HL 주문 엔드포인트
- `quantity: int = Field(gt=0)`, `MARKET`일 때 가격추정은 최근가/limit_price
- 위반 시 HTTP 422

## Task 3: 봇 엔진 포지션/체결가 정확성 (#1, #4, #6)
- Modify: `live_engine/broker_interface.py` — OrderResult에 `avg_fill_price: float|None`, BrokerInterface에 `get_position(instrument_id)`
- Modify: `live_engine/ib_broker.py`, `live_engine/kis_broker.py` — fill price 채우기, get_position 구현
- Modify: `live_engine/engine.py` — 반전 시 올바른 수량(청산+신규), 실제 fill price로 PnL, 시작 시 reconcile
- Test: `tests/test_live_engine.py` 보강

## Task 4: KR/US 확인 모달 (#5-frontend)
- Modify: `app/orders/page.tsx` — HL confirm 패턴을 KR/US로 확장

## Task 5: 주문 audit log 영속화 (upgrade)
- Create: `api_server/order_audit.py` — append-only JSONL
- Modify: 주문 엔드포인트에서 기록

## Task 6: paper/live 모드 배지 (upgrade)
- Modify: `api_server/main.py` — `GET /trading/mode` (IB_PORT/KIS_MOCK/ALPACA_PAPER 기반)
- Modify: `lib/api.ts`, `app/orders/page.tsx` — 모드 배지 + live 경고
