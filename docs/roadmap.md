# Nautilus Dashboard — Roadmap

**마지막 업데이트:** 2026-06-28  
**HEAD:** ea8f478  
**테스트:** 98/98 통과  
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

---

## 남은 Phase

### Phase 11: Data Quality Center + Report Builder (S-13 + S-14)

**목표:** 데이터 신뢰성 대시보드 + 리서치 결과 리포트 자동생성

#### S-13. Data Quality Center
- `app/data-quality/page.tsx`
- 데이터 소스별 메타데이터 테이블: Source (KRX/KSD/FRED/ECOS/EDGAR), Coverage (날짜 범위, 종목 수), Update Frequency, Missing Data 비율, Corporate Action 적용 여부
- `/bars` 엔드포인트로 종목별 데이터 커버리지 체크
- 결측 비율 시각화 (div-based bar)
- Nav: Analyze 그룹 추가

#### S-14. Report Builder
- `lib/report-utils.ts` — Experiment/Strategy/Notebook → Markdown 문자열 생성
- `tests/lib/report-utils.test.ts`
- `app/report/page.tsx` — 소스 선택 (Experiment ID / Strategy / Notebook), 프리뷰 패널, 출력 (Markdown 텍스트 복사, HTML, 브라우저 print → PDF)
- Nav: Research 그룹 추가
- 신규 dependency 없음 (브라우저 `window.print()` 사용)

**예상 Task 구성:**
1. `lib/report-utils.ts` + tests
2. `app/report/page.tsx` + nav
3. `app/data-quality/page.tsx` + nav + docs

---

### Phase 12: Workflow Automation (S-15)

**목표:** Universe → Factor → Strategy → Backtest → Portfolio → Bot 전체 플로우 연결

- `app/workflow/page.tsx` — 단계별 상태 머신 UI
- 단계: Universe 선택 → Factor 분석 → Strategy 선택 → Backtest 실행 → Portfolio 최적화 → Bot 배포
- 각 단계 완료 시 다음 단계로 CTA 버튼 자동 안내
- 단계 간 파라미터 전달: Universe instrument_ids → Backtest 자동 주입, Portfolio → Bot config 자동 주입
- `lib/workflow-storage.ts` — 현재 워크플로우 상태 localStorage 저장
- Nav: 별도 최상위 항목 또는 Live 그룹 추가

**예상 Task 구성:**
1. `lib/workflow-storage.ts` + tests
2. `app/workflow/page.tsx` — 상태 머신 + 단계 UI
3. 각 기존 페이지에 "→ 다음 단계" CTA 연결 + docs

---

## 향후 추가 예정 (Asset Class 확장)

다음 Asset Class를 추가할 계획이 있음. Phase 계획 미수립 상태.

### 옵션 (Options)
- 필요 백엔드: Greeks (Delta/Gamma/Theta/Vega), IV Surface
- 필요 UI: Options Chain 테이블, IV Surface 3D 차트 (D3 또는 Three.js)
- Nav: Market 그룹 또는 별도 그룹

### 선물 (Futures)
- 필요 백엔드: 롤오버 처리, 연속 계약 데이터
- 필요 UI: 계약 달력, 롤오버 차트
- Nav: Market 그룹

### Forex
- 필요 백엔드: FX 환율 데이터 (ECOS 또는 외부 API)
- 필요 UI: Currency Pair 선택기, Cross-rate Matrix
- Nav: Market 그룹

### 가상화폐 (Crypto)
- 필요 백엔드: Binance/Upbit 연동
- 필요 UI: 24h 가격, 거래량 프로파일
- Nav: Market 그룹

> **Nav 설계 참고:** 현재 Market은 단독 항목. Asset class 확장 시 Market을 드롭다운으로 전환하거나, 별도 `Assets▾` 그룹 추가 권장.

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
