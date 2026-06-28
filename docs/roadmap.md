# Nautilus Dashboard — Roadmap

**마지막 업데이트:** 2026-06-28  
**HEAD:** fe67f27  
**테스트:** 141/141 통과  
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
