### Nav Refactor (2026-06-28)

**GroupedDropdown Navigation:**
- `components/NavBar.tsx` (NEW) — `"use client"` 컴포넌트, hover 드롭다운, `usePathname` 기반 active 그룹 하이라이트
- `app/layout.tsx` — 16개 flat nav → 6개 그룹으로 압축 (`NavBar` 컴포넌트 교체)
- 그룹 구조: Dashboard | Market | Research▾ | Analyze▾ | Trade▾ | Live▾
- **HEAD:** ea8f478

---

### Bot Infrastructure (2026-06-28)

**Phase 10 — Bots Page Upgrade:**
- `app/bots/page.tsx` — migrated from terminal inline styles to design token system
  - Removed `const S` style object, `statusColor()`, `pnlColor()` helpers
  - Applied: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `font-data`
  - `bg-accent text-black`: Create button, Run Preview button
  - Bot status: `text-pos` (running), `text-neg` (error), `text-text-3` (stopped)
  - Start/Stop: `border-pos text-pos` / `border-neg text-neg` (destructive vs positive)
  - All functionality preserved: bot list, create form, start/stop toggle, live status polling, WebSocket price, backtest preview, candlestick chart, trade log
**Tests:** 98 passing (no new tests)

---

### Portfolio Lab (2026-06-28)

**S-9 Portfolio Lab:**
- `lib/portfolio-utils.ts` — `computeAttribution()` (6 tests)
- `components/portfolio/EfficientFrontierChart.tsx` — D3 scatter chart for efficient frontier
- `app/portfolio/page.tsx` — Optimizer tab (Markowitz + frontier chart + weight bars) + Attribution tab (weight input + contribution bar chart)

**Nav additions:** Portfolio (between Replay and Rolling)
**Tests:** 98 passing (92 existing + 6 portfolio-utils)

---

### Trade Replay (2026-06-28)

**S-7 Trade Replay:**
- `lib/replay-utils.ts` — `computeRunningStats()` (7 tests)
- `components/replay/ReplayChart.tsx` — candlestick chart with entry/exit markers via `createSeriesMarkers` (lightweight-charts v5)
- `app/replay/page.tsx` — instrument/strategy config, run controls, step/play/pause playback, trade list panel, running P&L stats

**Nav additions:** Replay (between Universe and Rolling)
**Tests:** 92 passing (85 existing + 7 replay-utils)

---

# Nautilus Dashboard — 진행 현황

**마지막 업데이트:** 2026-06-28  
**브랜치:** main  
**HEAD:** (see git log)

---

### Factor Lab + Rolling Analytics (2026-06-28)

**S-12 Rolling Analytics:**
- `lib/rolling-analytics-utils.ts` — `computeRollingVolatility()`, `zipRollingPoints()` (7 tests)
- `components/rolling/RollingChart.tsx` — lightweight-charts multi-metric line chart
- `app/rolling/page.tsx` — instrument + benchmark + window selector; 5 metrics: Sharpe, Beta, Correlation, Drawdown, Volatility

**S-10 Factor Lab:**
- `lib/factor-utils.ts` — `computeFactor()` with momentum/volatility + Spearman IC (5 tests)
- `app/factor/page.tsx` — instrument list, factor/lookback/horizon selectors, ranked bar chart + IC display; concurrent getBars fetching (max 5)

**Nav additions:** Rolling, Factor (between Universe and Bots)
**Tests:** 85 passing (73 existing + 7 rolling-utils + 5 factor-utils)

---

### Event Study + Universe Builder (2026-06-28)

**S-4 Event Study:**
- `lib/event-study-utils.ts` — `computeEventStudy()`: windowed return analysis (6 tests)
- `components/event-study/EventReturnChart.tsx` — D3 line chart (avg/median/individual lines)
- `app/event-study/page.tsx` — instrument + date range + event source (KSD Dividend, KSD Rights, FRED Series, Custom) + window selector + results chart + events table

**S-5 Universe Builder:**
- `app/universe/page.tsx` — KRX listing browser (KOSPI/KOSDAQ) with market cap slider, name search, watchlist add, backtest CTA

**Nav additions:** Event Study, Universe (between Correlation and Bots)
**Tests:** 73 passing (67 existing + 6 event-study-utils)

---

## 완료된 작업

### Correlation Network (2026-06-28)

- `lib/api.ts` — added `getCorrelation`, `CorrelationPair`, `CorrelationResponse` (5 tests)
- `components/network/CorrelationNetwork.tsx` — D3.js force-directed graph with draggable nodes
- `app/correlation/page.tsx` — instrument input, date range, threshold slider, network + table
- `app/layout.tsx` — Correlation nav item added between Research and Bots
- **New dependency:** `d3@7.x` + `@types/d3`
- **Tests:** 67 passing (62 existing + 5 getCorrelation)

**Features:**
- Nodes colored by venue: orange (XKRX), blue (NASDAQ/NYSE), gray (other)
- Edges: green = positive correlation, red = negative; opacity/width = |correlation|
- Threshold slider filters edges in real-time (no re-fetch)
- Pair table sorted by |correlation| descending, text-pos/text-neg color coding
- Drag nodes to rearrange; simulation re-heats on drag

---

### Research Workspace (2026-06-28)

**S-2 Strategy Repository:**
- `lib/strategy-storage.ts` — Strategy CRUD, version history, clone, rollback (11 tests)
- `components/strategies/StrategyCard.tsx` — card with favorite, archive, clone, run, delete
- `components/strategies/StrategyCompare.tsx` — side-by-side param diff + EMA numeric delta
- `components/strategies/SaveStrategyForm.tsx` — inline save form (name, description, tags)
- `app/backtest/page.tsx` — "Save Strategy" button + SaveStrategyForm panel
- `app/strategies/page.tsx` — browser with search, filter (all/favorites/archived), version history panel, rollback

**S-6 Research Notebook:**
- `lib/notebook-storage.ts` — Notebook CRUD + block CRUD (add/update/remove/move) (13 tests)
- `components/notebooks/NoteBlockRenderer.tsx` — 5 block types: comment/metric/table/chart/image
- `components/notebooks/NoteBlockEditor.tsx` — create/edit any block type with validation
- `components/notebooks/NotebookEditor.tsx` — full editor with inline title/tags/experiment linking
- `app/notebooks/page.tsx` — left sidebar list + right editor panel

**Nav additions:** Strategies, Notebooks (between Experiments and Research)
**Tests:** 62 passing (37 existing + 11 strategy + 13 notebook + 1 sanity)

---

### Experiment Lab (2026-06-27)

- `lib/experiment-storage.ts` — Experiment CRUD (localStorage, max 200), extractMetrics, makeExperimentLabel (10 tests)
- `lib/scenario-presets.ts` — 8 crisis date range presets: GFC, COVID, Dot-com, Ukraine, Inflation, High Rate, Bull 2017, Bear 2022 (7 tests)
- `components/backtest/ScenarioSelect.tsx` — preset dropdown, fires onStartChange/onEndChange
- `app/backtest/page.tsx` — ScenarioSelect added, auto-save experiment on run, nav links to Experiments + Heatmap
- `app/backtest/heatmap/page.tsx` — Parameter Heatmap: N×M EMA sweep, concurrent pool (max 5), color-coded grid
- `components/experiments/ExperimentTable.tsx` — list with search, sort by 5 keys, inline notes edit, checkbox compare select, delete
- `components/experiments/ExperimentCompare.tsx` — side-by-side metric diff with Δ column (green/red)
- `app/experiments/page.tsx` — experiment browser, compare panel, clear all
- `app/layout.tsx` — "Experiments" added to nav

Tests: 37 passing (10 experiment + 7 scenario + 8 watchlist + 6 dashboard-storage + 4 system-status-utils + 2 sanity)

---

### Dashboard Foundation (2026-06-27)

Dashboard 홈 스크린 + 5개 위젯 구성 완료.

**9개 커밋 (e57a8e3 → 18a675c):**

| 커밋 | 내용 |
|---|---|
| acc7f45 | vitest + jsdom 테스트 인프라 추가 |
| acfc47d | `lib/dashboard-storage.ts` — Research Activity localStorage |
| e819dba | `lib/system-status-utils.ts` + SystemStatusWidget (API health 30s poll) |
| a040ff9 | ResearchActivityWidget — localStorage 활동 로그 표시 |
| 43e670b | MarketOverviewWidget — KOSPI/KOSDAQ 실데이터 + 나머지 "No feed" |
| 8080b6d | TodayEventsWidget — KSD rights schedule 14일 윈도우 |
| bc05568 | PortfolioSnapshotWidget — stub (Phase 6에서 구현 예정) |
| 7f75993 | `app/dashboard/page.tsx` — 5개 위젯 grid 조합 |
| 18a675c | 라우팅 재구성 — `/` → `/dashboard` redirect, Market → `/market`, nav 6개 항목 |

**구현된 위젯:**
- **MarketOverview**: KOSPI/KOSDAQ KRX 실데이터, S&P/NASDAQ/FX/Crypto/VIX는 "No feed" stub
- **SystemStatus**: API Server/KRX/FRED/Bot Engine 헬스체크, 30초 자동 갱신
- **TodayEvents**: KSD 권리일정 14일 윈도우 실데이터, 나머지(어닝/경제캘린더/배당)는 stub
- **ResearchActivity**: localStorage `nautilus:research_activity` 최근 8개 표시
- **PortfolioSnapshot**: Phase 6 Portfolio Lab 구현 전까지 stub

**추가된 라이브러리/파일:**
- `vitest` + `jsdom` (devDependencies)
- `lib/dashboard-storage.ts` — ActivityType, ResearchActivity, logActivity/getRecentActivity/clearActivity
- `lib/system-status-utils.ts` — StatusState, statusColor, formatLatency
- `components/dashboard/` 디렉토리 (5개 위젯)
- `tests/lib/dashboard-storage.test.ts` (6개 테스트)
- `tests/lib/system-status-utils.test.ts` (4개 테스트)

**라우팅 변경:**
- `/` → redirect to `/dashboard` (새 홈)
- `/market` — 기존 Market 가격 차트 (이전 `/`)
- Nav: Dashboard | Market | Backtest | Research | Bots | AI Trader

---

### Market Discovery Workspace (2026-06-27)

Market Discovery Workspace 완성. Watchlist localStorage + 3개 탭 (Chart/Compare/Events) 구현.

- `app/market/page.tsx` → thin Server Component rendering `<MarketWorkspace />`
- `lib/watchlist-storage.ts` — localStorage watchlist CRUD (8 tests)
- `components/market/WatchlistSidebar.tsx` — symbol list + price fetch + add/remove + Backtest/Research CTAs
- `components/market/ChartTab.tsx` — single-symbol candlestick chart
- `components/market/ComparisonChart.tsx` — lightweight-charts multi-line normalized % return
- `components/market/ComparisonTab.tsx` — date range + ComparisonChart + legend + logActivity
- `components/market/EventsTab.tsx` — KSD rights schedule (30d), borrow rank, stub sections
- `components/market/MarketWorkspace.tsx` — 2-panel layout (WatchlistSidebar + Chart/Compare/Events tabs)

**테스트 통과:** 20/20 (8 watchlist + 6 dashboard-storage + 4 system-status-utils + 2 sanity)

---

### UI/UX 리디자인 (2026-06-27)

Market + Backtest 페이지, 공통 레이아웃 전체 리디자인 완료.

**13개 커밋 (a034973 → e57a8e3):**

| 커밋 | 내용 |
|---|---|
| 8dba054 | Design token system — globals.css `@theme {}` 전체 재작성 |
| 0941919 | Inter + JetBrains Mono 폰트 로딩, nav 헤더 리디자인 |
| 1afc98d | `lib/backtest-types.ts` — backtest 타입/상수/헬퍼 분리 |
| 118af9e | MetricCard, EmptyState, JsonPreview UI 프리미티브 생성 |
| 3e942c0 | StrategyModeTabs, StrategyControlPanel, SingleStrategyForm |
| 890a464 | ConditionRow (IndSelect, IndParams 포함) |
| b7b0232 | RuleCard, CompositeStrategyBuilder |
| 60b5ab6 | ChartPanel 래퍼 생성, CandlestickChart 색상 토큰 업데이트 |
| 8e7abd1 | MetricGrid (KPI 카드 12개), TradeLogTable |
| d54017f | `components/ui/index.ts` 배럴 export |
| 7af03e3 | Backtest 페이지 조립 — top-control + bottom-analytics 레이아웃 |
| 366f460 | Market 페이지, InstrumentSelect, DateRangePicker polish |
| e57a8e3 | 최종 리뷰 수정: orange 제약 위반 2건, pnlClass 중복, use client, 이중 보더 |

**적용된 디자인 시스템:**
- 색상 팔레트: `#080A0F` 베이스, `#0F131A` 패널, 12개 CSS 토큰
- Orange accent(`#FF9F1C`): active 탭, RUN/Load 버튼, active TF 버튼 3곳만 사용
- 타이포그래피: Inter(UI 텍스트), JetBrains Mono(숫자 데이터)
- 레이아웃: Backtest — top-control + bottom-analytics 2-column grid

**미적용 범위 (구 터미널 스타일 그대로):**
- `app/quant/page.tsx` — 9개 탭, 인라인 스타일, Courier New
- `app/bots/page.tsx` — 봇 관리, 인라인 스타일, Courier New
- `app/ai-trader/page.tsx` — 개발 예정 플레이스홀더 (단순하므로 우선순위 낮음)

---

## 변경된 파일

**신규:**
- `lib/backtest-types.ts`
- `components/ui/MetricCard.tsx`
- `components/ui/EmptyState.tsx`
- `components/ui/JsonPreview.tsx`
- `components/ui/StrategyModeTabs.tsx`
- `components/ui/StrategyControlPanel.tsx`
- `components/ui/SingleStrategyForm.tsx`
- `components/ui/ConditionRow.tsx`
- `components/ui/RuleCard.tsx`
- `components/ui/CompositeStrategyBuilder.tsx`
- `components/ui/ChartPanel.tsx`
- `components/ui/MetricGrid.tsx`
- `components/ui/TradeLogTable.tsx`
- `components/ui/index.ts`
- `docs/superpowers/specs/2026-06-27-ui-redesign-design.md`
- `docs/superpowers/plans/2026-06-27-ui-redesign.md`

**수정:**
- `app/globals.css` — 전체 재작성 (Tailwind v4 @theme)
- `app/layout.tsx` — 폰트 + 네비게이션
- `app/page.tsx` — Market 페이지
- `app/backtest/page.tsx` — Backtest 페이지 (550줄 → 78줄)
- `components/CandlestickChart.tsx` — 색상 + 높이 업데이트
- `components/InstrumentSelect.tsx` — 인라인 스타일 제거
- `components/DateRangePicker.tsx` — 인라인 스타일 제거

---

## 다음 할 일

### Institutional Upgrade 로드맵 (전체 Phase)

전체 로드맵: `docs/superpowers/plans/2026-06-27-institutional-upgrade-roadmap.md`

| Phase | 내용 | 상태 |
|---|---|---|
| 1. Dashboard Foundation | 홈 스크린, 5개 위젯 | ✅ 완료 |
| 2. Market Discovery Workspace | Upgrade 2 — Watchlist, Movers, Heatmap | 대기 |
| 3. Research Workspace | Upgrade 3 — Quant 페이지 분리/업그레이드 | 대기 |
| 4. Advanced Backtesting | Upgrade 4 — Validation Platform | 대기 |
| 5. Visualization Library | Upgrade 5 — 공유 차트 컴포넌트 | 대기 |
| 6. Portfolio Lab | Upgrade 6 | 대기 |
| 7. Alpha Research | Upgrade 9 | 대기 |
| 8. Event Study + Universe Builder | Upgrades 7+8 | 대기 |
| 9. Bot Infrastructure | Upgrade 10 — Bots 페이지 업그레이드 | 대기 |
| 10. Data Catalog + Reporting | Upgrades 12+13 | 대기 |
| 11. Workflow Integration | Upgrade 11 — 전체 연결 | 대기 |

### 우선순위 높음 (Phase 2 시작 전 선결)

1. **ResearchActivity 로깅 연결** — Backtest 실행 시 `logActivity()` 호출 추가
   - `app/backtest/page.tsx` run() 함수에 `logActivity({ type: "backtest", label: "...", href: "/backtest" })` 추가
   - Dashboard ResearchActivity 위젯이 실제 데이터 표시 가능

2. **remote push** — `git push -u origin main` (Claude Code auto-mode가 main 직접 push 차단. 터미널에서 직접 실행)

### Phase 2: Market Discovery Workspace 준비사항

- Watchlist (localStorage 기반)
- Market Movers (KRX API 활용)
- Sector Heatmap (KRX 섹터 데이터 필요 — 백엔드 엔드포인트 확인 필요)
- Multi-symbol Comparison (기존 getBars API로 구현 가능)

---

## 막힌 부분 / 결정사항

- **git push 권한**: Claude Code auto-mode가 main 브랜치 직접 push를 차단. 사용자가 터미널에서 `git push -u origin main` 직접 실행 필요, 또는 Claude Code 설정에서 push 권한 허용.

- **Quant 페이지 파일 분리 방식**: 현재 단일 1600줄 파일. 리디자인 시 탭별로 파일 분리할지(`components/quant/RiskTab.tsx` 등), 또는 단일 파일 유지할지 결정 필요.
