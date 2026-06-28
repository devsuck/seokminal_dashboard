# Nautilus Dashboard — Roadmap

**마지막 업데이트:** 2026-06-28  
**HEAD:** 214107e  
**테스트:** 127/127 통과  
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

---

## 향후 계획 — Asset Class 확장 (Phase 14~16)

각 Phase는 백엔드(nautilus-multi-venue) + 프론트엔드(nautilus-dashboard) 동시 작업 필요.

### Phase 14: Futures (선물)
- **백엔드:** 롤오버 처리, 연속 계약(Continuous Contract) 데이터 파이프라인
- **프론트엔드:** 계약 달력(Contract Calendar), 롤오버 차트
- **Nav:** Market 그룹 또는 Assets▾

### Phase 15: Forex
- **백엔드:** FX 환율 데이터 (ECOS 또는 외부 API 연동)
- **프론트엔드:** Currency Pair 선택기, Cross-rate Matrix, FX 차트
- **Nav:** Market 그룹 또는 Assets▾

### Phase 16: Crypto (가상화폐)
- **백엔드:** Binance/Upbit WebSocket + REST 연동
- **프론트엔드:** 24h 가격 대시보드, 거래량 프로파일, 호가창(Order Book)
- **Nav:** Market 그룹 또는 Assets▾

> **Nav 설계 결정 (각 Phase 시작 전):** 현재 Market은 단독 항목. Asset class 추가 시 Market을 드롭다운으로 전환하거나, 별도 `Assets▾` 그룹 추가. `NAV_GROUPS` 배열만 수정하면 됨 (`components/NavBar.tsx`).

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
