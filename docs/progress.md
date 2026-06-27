# Nautilus Dashboard — 진행 현황

**마지막 업데이트:** 2026-06-27  
**브랜치:** main  
**HEAD:** 18a675c

---

## 완료된 작업

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
