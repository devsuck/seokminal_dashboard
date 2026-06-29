# Seokminal Dashboard — Roadmap

**마지막 업데이트:** 2026-06-29  
**스택:** Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts v5, D3 v7

---

## 완료된 Phase

| Phase | 내용 | 주요 파일 | 커밋 범위 |
|---|---|---|---|
| 1 | Dashboard Foundation | `app/dashboard/page.tsx`, 5개 위젯 | 초기 |
| 2 | Market Discovery Workspace | `app/market/page.tsx`, WatchlistSidebar, ChartTab, ComparisonChart, EventsTab | — |
| 3 | Experiment Lab | `lib/experiment-storage.ts`, Heatmap, ExperimentTable, ExperimentCompare | — |
| 4 | Research Workspace | `lib/strategy-storage.ts`, `lib/notebook-storage.ts`, Strategies, Notebooks | — |
| 5 | Correlation Network | `components/network/CorrelationNetwork.tsx`, D3 force-directed graph | — |
| 6 | Event Study + Universe Builder | `app/event-study/page.tsx`, `app/universe/page.tsx` | — |
| 7 | Factor Lab + Rolling Analytics | `lib/factor-utils.ts`, `lib/rolling-analytics-utils.ts`, `/factor`, `/rolling` | 1960bf7..c3c6c5f |
| 8 | Trade Replay | `lib/replay-utils.ts`, `components/replay/ReplayChart.tsx`, `/replay` | c3c6c5f..cd586a8 |
| 9 | Portfolio Lab + Attribution | `lib/portfolio-utils.ts`, `EfficientFrontierChart.tsx`, `/portfolio` | cd586a8..9b5a70a |
| 10 | Bot Infrastructure | `app/bots/page.tsx` 디자인 토큰 마이그레이션 | 9b5a70a..0102869 |
| Nav | Grouped Dropdown Nav | `components/NavBar.tsx` — 16개 → 6그룹 | 0102869..ea8f478 |
| 11 | Data Quality Center + Report Builder | `app/data-quality/page.tsx`, `app/report/page.tsx`, `lib/report-utils.ts` | — |
| 12 | Workflow Automation | `app/workflow/page.tsx`, `lib/workflow-storage.ts` | — |
| Cleanup | D3 타입 에러 수정 + 디자인 토큰 전면 적용 + ai-trader 플레이스홀더 | `CorrelationNetwork.tsx`, `app/quant/page.tsx`, `app/ai-trader/page.tsx` | 5cee8ae..a60fea1 |
| 13 | Options Analytics | `options/pricer.py`, `app/options/page.tsx`, IV Surface heatmap | — |
| 14 | Futures Analytics | `futures/pricer.py`, `app/futures/page.tsx`, term structure curve | — |
| 15 | Forex Analytics | `forex/pricer.py`, `app/forex/page.tsx`, forward curve | — |
| 16 | Crypto Analytics | `hyperliquid/client.py`, `app/crypto/page.tsx`, order book depth | — |
| 17 | IB Market Data | `backends/ib/client.py`, `app/ib/page.tsx`, 5 contract types | — |
| 18 | Universal Search + Real-time Streaming | KR/US 종목 검색, 온디맨드 OHLCV, KIS WS → FastAPI WS → 실시간 차트 | 3e96923..369f5d0 |
| 19 | Strategy Spawner UI | 조건 규칙 빌더, 스폰 규칙 CRUD, 활성 전략 모니터 | 5d78d4f..1263c94 |
| 20 | Live Order Dashboard | IB/KIS 주문 실행, 포지션 모니터, P&L 추적 | 1b36e97..fe67f27 |
| 21 | Orders Complete | IB 주문, cancel/status UI, Bot P&L 표시 | 73331ee..0704e0b |
| 22 | Notifications + Alert System | `lib/alert-storage.ts`, `lib/api.ts` alert 함수, `/alerts` 페이지, threading.Lock dedup | 826e248..e792843 (FE) / c6ed03c..6a7515a (BE) |
| 23 | Risk Dashboard | `components/risk/DrawdownChart.tsx`, `app/risk/page.tsx`, D3 drawdown + Rolling Beta chart | f3fb048..e557c62 (FE) |
| 24 | Backtesting UI v2 | `lib/backtest-result-storage.ts`, Save Result button, `/backtest/compare` 비교 페이지 | 5db769f..9c50b70 (FE) |
| 25 | Live Strategy Monitor | `app/bots/[id]/page.tsx`, Trade Log/Equity Curve/Signal Log 3탭, 5초 폴링 | — |
| 26 | Backtest v3 MACD/RSI | `backtest_runner/simple_runner.py`, MACD/RSI 전략, `/backtest/optimize` | — |
| 27 | Portfolio Backtest | `GET /backtest/portfolio`, per-instrument + 포트폴리오 equity curve | — |
| 28 | AI Trader MVP | `ai_strategy/advisor.py`, Claude Haiku 전략 추천, `/ai-trader` 페이지 | — |
| 29 | i18n + PageBanner | `lib/i18n.tsx`, KO/EN/DE, PageBanner 21개 페이지, IB 실시간 플레이스홀더 | — |
| 30 | XGBoost ML Strategy | `xgb_strategy/`, XGBClassifier, HOLD train window, `/backtest` xgb 탭 | — |
| 31 | Workflow Pipeline | ai-trader → backtest URL params 연결, backtest → updateWorkflow() | — |
| 32 | KRX Market Tab | `KRMarketsTab.tsx`, KOSPI/KOSDAQ/KRX 지수, Suspense build fix | — |
| 33 | Multi-Strategy Compare | `StrategyComparePanel.tsx`, 4전략 Promise.allSettled, Sharpe 정렬 | — |
| 34 | AI Advisor XGBoost | advisor.py xgb 추가, trend_strength/volatility_pct 분석 | — |
| 35 | Walk-Forward Backtest | `GET /backtest/walk-forward`, N window 분할, `WalkForwardPanel.tsx` | — |
| 36 | Position Sizing + MC + Analytics | Kelly/Half-Kelly, Monte Carlo SVG fan, Trade Analytics 히스토그램 | — |
| 37 | Insider Trading UI | EDGAR Form4 + OpenDART, openinsider 스타일 필터/테이블, `/insider` | — |
| 38 | Economic Calendar | ForexFactory JSON, `GET /calendar/economic`, `/calendar` 페이지 | — |
| 39 | Toast + Alert Poller | `lib/toast.ts`, `ToastContainer`, `AlertPoller` 30초 폴링 전역 | — |

---

## 새 세션 시작 방법

```
1. docs/progress.md 읽기 (완료 내용 파악)
2. docs/roadmap.md 읽기 (이 파일, 남은 작업 파악)
3. "Phase 11부터 진행해줘" → Phase 11 계획 작성 후 SDD 실행
```

### 작업 컨벤션 (반드시 유지)

- **SDD 파이프라인:** implementer subagent → task reviewer → fix (Critical/Important만) → re-review → final branch review
- **계획 파일:** `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
- **브랜치:** main 직접 커밋 (feature branch 미사용)
- **테스트:** vitest (`npm test`), 각 Task 후 전체 suite 통과 확인
- **API 호출:** 반드시 `lib/api.ts` 함수 사용 (raw `fetch` 금지)
- **AbortController 패턴:** abort→create→run→catch AbortError silently→finally guard→unmount cleanup
- **디자인 토큰:** `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- **`bg-accent text-black`:** 주요 액션 버튼만 (Run/Save/Create/Optimize)
- **Active 탭/필터:** `border-accent text-accent bg-accent/10`
- **인라인 style={}:** 금지 (예외: chart lib config, data-driven `width: ${pct}%`, `style={{ height }}` chart container)
- **헥스 코드 className:** 금지 (예외: D3 `.attr()`, 범례 색상 스와치)

### 주요 기술 메모

- lightweight-charts v5: `createSeriesMarkers(series, markers[])` (NOT `series.setMarkers()`)
- `ts_ns` (nanoseconds) → `Math.floor(ts_ns / 1e9) as UTCTimestamp`
- D3: `select(svgRef.current)` → `svg.selectAll("*").remove()` → append inside useEffect
- `tradesRef` 패턴: `tradesRef.current = trades` at render top (stale closure 방지)
- NavBar: `components/NavBar.tsx` — 그룹 추가 시 `NAV_GROUPS` 배열 수정

### 알려진 미해결 이슈 (비블로킹)

- `components/network/CorrelationNetwork.tsx:120` — D3 타입 오류 (`BaseType | SVGCircleElement` 불일치), `npm run build` 실패. 기능은 정상 동작. 수정 시 D3 selection 타입 캐스팅 필요.
- `app/quant/page.tsx` — 아직 레거시 인라인 스타일 (디자인 토큰 미적용)
- `app/ai-trader/page.tsx` — 개발 예정 플레이스홀더

---

## 다음 Phase 후보

| Phase | 내용 | 범위 |
|---|---|---|
| 40 | IB WebSocket 실시간 | IbRealtimeWidget 실제 연결 (TWS → WS → 대시보드) | Backend + Frontend |
| 41 | 워크플로우 시각적 개선 | `/workflow` 페이지 스텝 UI 개선 | Frontend |
| 42 | LangGraph Multi-Agent | 자율 주문 실행 AI | Backend |
