## Phase 40 — Hyperliquid Trading UI (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `seokminal-multi-venue/hyperliquid/trader.py` — importlib 기반 SDK 로딩 (로컬 패키지 섀도 우회), get_positions/place_order/cancel_order/close_position
- `api_server/main.py` — `GET /hl/positions`, `POST /hl/order`, `POST /hl/order/cancel`, `POST /hl/order/close` 엔드포인트
- `lib/api.ts` — HLAssetPosition/HLMarginSummary/HLOpenOrder/HLPositionsResponse 인터페이스 + 4개 API 함수
- `app/orders/page.tsx` — HL 탭 추가 (Venue="KR"|"US"|"HL"), HL 주문 폼 (코인/매수·매도/수량/시장·지정가/감소전용), 포지션 테이블 (크기/진입가/미실현PnL/청산가/Close 버튼), 미체결 주문 테이블 (Cancel 버튼)
- `.env` — `HL_PRIVATE_KEY=` placeholder 추가

### 변경된 파일
- `seokminal-multi-venue/hyperliquid/trader.py` (신규)
- `seokminal-multi-venue/api_server/main.py`
- `seokminal-multi-venue/.env`
- `seokminal-dashboard/lib/api.ts`
- `seokminal-dashboard/app/orders/page.tsx`

### 다음 할 일
- `.env`에 `HL_PRIVATE_KEY=<실제 키>` 설정 후 Hyperliquid 거래 테스트
- 필요시 거래소 페이지 별도 분리 (`/hl` 페이지)

---

## Phase 39 — Economic Calendar (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `GET /calendar/economic?week=this|next` (ForexFactory JSON 파싱, 10분 인메모리 캐시)
- `lib/api.ts` — `EconomicEvent` 인터페이스 + `getEconomicCalendar()` 함수
- `app/calendar/page.tsx` — 날짜별 그룹화, Impact/통화 필터, 실제값 색상 코딩 (예측 대비 good/bad)
- `components/dashboard/TodayEventsWidget.tsx` — Economic Calendar 섹션 실데이터 연결 (High/Medium upcoming)
- `lib/i18n-utils.ts` + `components/NavBar.tsx` — "경제 캘린더" 메뉴 추가

---

## Phase 38 — Toast + Alert Poller (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `lib/toast.ts` — 모듈 수준 pub/sub 토스트 스토어 (show/dismiss/subscribe)
- `components/ui/ToastContainer.tsx` — 우하단 고정 토스트 스택 (info/success/warn/error 색상)
- `components/AlertPoller.tsx` — 30초 폴링, 신규 alert 발생 시 `toast.show()` 트리거 (최초 로드 무시)
- `app/layout.tsx` — `<AlertPoller />` + `<ToastContainer />` 전역 추가

---

## Phase 37 — Insider Trading UI (openinsider 스타일) (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `insider/edgar_client.py` — `get_recent_form4_feed()` (EDGAR 전문 검색 + ThreadPoolExecutor XML 파싱)
- `insider/dart_client.py` — `get_recent_kr_insider_feed()` (OpenDART list.json + 병렬 elestock)
- `insider/__init__.py` — exports 업데이트
- `api_server/main.py` — `GET /insider/us/recent`, `GET /insider/kr/recent` 엔드포인트
- `lib/api.ts` — `getInsiderUSRecent()`, `getInsiderKRRecent()` 추가
- `app/insider/page.tsx` — 완전 재작성: 필터 바(기간/구분/최소금액/텍스트), US/KR 컬러코딩 테이블, 요약 바

---

## Phase 36 — Monte Carlo + Trade Analytics + Position Sizing (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/backtest/MonteCarloPanel.tsx` — SVG fan chart (P5/P25/P50/P75/P95), 5개 통계 카드
- `components/backtest/PositionSizingPanel.tsx` — Kelly/Half-Kelly/Fixed 사이즈 비교 테이블
- `components/backtest/TradeAnalyticsPanel.tsx` — PnL 히스토그램, 연속 승/패, 월별 PnL
- `app/backtest/page.tsx` — 3개 패널 single 모드 결과 후 렌더링

---

## Phase 35 — Walk-Forward Backtest (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `ns_to_date()` 헬퍼, `WalkForwardWindow/Summary/Response` 모델, `GET /backtest/walk-forward` (macd/rsi/xgb/ema_cross 지원)
- `tests/test_walk_forward.py` — 6개 테스트
- `lib/api.ts` — `WalkForwardWindow/Summary/Response` 인터페이스 + `getWalkForward()` 함수
- `components/backtest/WalkForwardPanel.tsx` — 윈도우 수 선택, 요약 통계, 최고 Sharpe 행 하이라이트

---

## Phase 34 — AI Advisor XGBoost Support (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `ai_strategy/advisor.py` — XGBoost 추천 전략 추가; trend_strength, volatility_pct 분석
- `app/ai-trader/page.tsx` — `STRATEGY_LABELS["xgb"]`, `STRATEGY_PARAMS_LABELS["xgb"]` 추가

---

## Phase 33 — Multi-Strategy Compare Panel (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/backtest/StrategyComparePanel.tsx` — 4전략 동시 실행 (Promise.allSettled), Sharpe 정렬
- `app/backtest/page.tsx` — single 모드 비교 패널 렌더링

---

## Phase 32 — KRX Market Tab + Build Fix (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/market/KRMarketsTab.tsx` — KOSPI/KOSDAQ/KRX 지수 일별 데이터 테이블
- `components/market/MarketWorkspace.tsx` — "KR" 탭 추가
- `app/backtest/page.tsx` — `useSearchParams()` Suspense 래핑 (프로덕션 빌드 fix)

---

## Phase 31 — Workflow Pipeline Connection (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `app/ai-trader/page.tsx` — `buildBacktestUrl()` 헬퍼, "Open Backtest →" URL 파라미터 전달
- `app/backtest/page.tsx` — URL 쿼리 파라미터로 폼 자동 채움, 백테스트 후 `updateWorkflow()` 호출

---

## Phase 30 — XGBoost ML Strategy (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `xgb_strategy/features.py` — RSI14, MACD diff, EMA12/26 ratio, mom5/10 피처 엔지니어링
- `xgb_strategy/model.py` — XGBClassifier 학습 (train_ratio 분할)
- `xgb_strategy/runner.py` — `generate_xgb_signals()`, 학습 구간은 HOLD
- `backtest_runner/simple_runner.py` — xgb 전략 dispatch 추가
- `api_server/main.py` — xgb 전략 + 파라미터 4개 추가
- `tests/test_xgb_strategy.py` — 8개 테스트

---

## Phase 29 — i18n + PageBanner + IB Placeholder (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `lib/i18n-utils.ts` — KO/EN/DE 번역 (nav 34개 + page 21개 title/desc)
- `lib/i18n.tsx` — LanguageProvider, useLanguage() 훅
- `components/LanguageSwitcher.tsx` — 한/EN/DE 버튼
- `components/PageBanner.tsx` — 페이지별 교육용 설명 배너 (21개 페이지)
- `components/live/IbRealtimeWidget.tsx` — IB 실시간 플레이스홀더

---

## Phase 28 — AI Trader MVP (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `ai_strategy/advisor.py` — Claude Haiku 기반 `recommend_strategy()`
- `api_server/main.py` — `GET /ai/strategy-recommend`
- `app/ai-trader/page.tsx` — AI Strategy Advisor UI

---

## [이전 Phase 27~1 — progress.md 이전 버전 참조]

Phase 27 이전 내용: 위에 있던 progress.md 하단 참조 (Portfolio Backtest, Backtest v3, Live Strategy Monitor, Orders, Alerts, Risk, Backtesting v2 등 Phase 20~27 모두 완료됨)

---

## 다음 할 일

- IB WebSocket 실시간 연결 (IbRealtimeWidget 실제 구현)
- 워크플로우 페이지 시각적 개선
- progress.md 주기적 업데이트
