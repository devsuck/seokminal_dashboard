# 멀티 AI 트레이딩 에이전트 + UX 구조화 Implementation Plan

**Goal:** 단일 하드코딩 tmux 에이전트를 봇처럼 여러 개 생성·관리 가능한 멀티 에이전트로. 각 에이전트는 구조화 JSON 사이클을 출력해 프론트가 컴팩트 카드로 표시. 데이트레이딩 타입 추가. 에이전트별 가상 계좌 분리.

**진단 (2026-07-01 확인):**
- 매매 경로(order.sh→`/alpaca/order`): **정상 작동** (place→accept→cancel 검증). Alpaca 안 변한 이유는 게이트(`macro≥5 AND STRONG_BUY`)가 한 번도 안 열려서 + 유니버스가 AAPL만.
- UX 문제: `claude --print` 원본 stdout을 tmux 페인에서 통째로 폴링→덤프. "한 문장만" 무시됨.

**Architecture:** 에이전트 레지스트리(JSON store) + 프로파일(swing/daytrade) + 에이전트별 tmux 세션 + 구조화 사이클 로그(JSONL). Alpaca 페이퍼 1계좌 → `client_order_id`에 agent_id 태깅 + 가상 자본 슬롯 원장으로 분리. 프론트는 에이전트 목록(생성/시작/정지) + 사이클 카드.

**Tech Stack:** FastAPI, tmux, Alpaca, Next.js, pytest(asyncio_mode=auto), vitest

## Global Constraints
- `@pytest.mark.asyncio` 금지
- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- pre-existing 실패 무시: test_auth ×3, test_backtest_happy_path
- FE: 디자인 토큰, raw fetch 금지(lib/api.ts), style={{}} 금지
- 페이퍼 트레이딩 전제 (실계좌 아님)

---

## Task 1: 구조화 사이클 스키마 + 스토어 (키스톤)
- Create: `autopilot/tools/cycle_log.py` — `record_cycle(agent_id, payload)` append JSONL, `read_cycles(agent_id, limit)`
- 스키마: `{agent_id, cycle, ts, markets:{US,KR}, decision: WATCH|BUY|SELL|SKIP|HOLD, symbol, score, max_score, action, next_trigger, cash_pct, note}`
- Test: `tests/test_cycle_log.py`

## Task 2: 에이전트 레지스트리 + 프로파일
- Create: `autopilot/agent_registry.py` — JSON store, `Agent{id,name,type,profile,account_alloc,status,created}`, CRUD
- 프로파일: swing(8h, value+tech gate), daytrade(5m, momentum gate, 강제 EOD 청산)
- Test: `tests/test_agent_registry.py`

## Task 3: 에이전트 API
- Modify: `api_server/router_autopilot.py` — `GET /agents`, `POST /agents`, `POST /agents/{id}/start`, `POST /agents/{id}/stop`, `GET /agents/{id}/cycles`
- tmux 세션명 `seokminal-agent-{id}`, agent_loop를 프로파일 인자로 실행
- Test: endpoint 테스트

## Task 4: agent_loop 파라미터화 + 구조화 출력
- Modify: `autopilot/agent_loop.sh` → `agent_loop.sh <agent_id> <profile>` 인자, Claude에 JSON 한 줄 출력 강제 후 `cycle_log.py record`
- 게이트 재조정: 유니버스 확장(스크리닝 top 10), swing 게이트 완화(score≥18 매수 검토), daytrade 별도 게이트
- 주문에 `client_order_id=agent_{id}_{cycle}` 태깅

## Task 5: 가상 계좌 분리
- Modify: `router_autopilot.py` — agent별 client_order_id 태그로 주문/포지션 필터, 가상 자본 원장
- `GET /agents/{id}/account` — 해당 에이전트 할당 자본/포지션/PnL

## Task 6: 프론트 — 에이전트 목록 + 카드 UX
- Modify: `app/ai-trader/page.tsx` — 에이전트 목록(생성/시작/정지/타입 뱃지), 선택 시 구조화 사이클 카드(원본 stdout 덤프 제거)
- `lib/api.ts` — Agent/Cycle 인터페이스 + 함수

## Task 7: 데이트레이딩 에이전트 검증
- daytrade 프로파일 e2e: 5분 사이클, 모멘텀 게이트, EOD 청산 로직
