# Institutional Quant Terminal — Phased Upgrade Roadmap

> 전체 로드맵. 각 Phase는 독립 실행 가능한 계획 문서로 분리됨.

---

## Phase 현황

| Phase | 내용 | S-Codes | 상태 |
|---|---|---|---|
| **1. Dashboard Foundation** | 홈 화면, 5개 위젯 | — | ✅ 완료 |
| **2. Market Discovery Workspace** | Watchlist, 비교 차트, KSD 이벤트 | — | ✅ 완료 |
| **3. Experiment Lab** | 백테스트 → 체계적 연구 플랫폼 | S-1, S-3, S-8 | 대기 |
| **4. Research Workspace** | Quant 페이지 재설계 + 전략 관리 | S-2, S-6 | 대기 |
| **5. Visualization Library** | 공유 차트 컴포넌트, 네트워크 그래프 | S-11 | 대기 |
| **6. Event Study + Universe Builder** | 이벤트 분석, 유니버스 구성 | S-4, S-5 | 대기 |
| **7. Factor Lab + Rolling Analytics** | Factor 연구, 시계열 지표 | S-10, S-12 | 대기 |
| **8. Trade Replay** | 백테스트 재생, 포지션 시각화 | S-7 | 대기 |
| **9. Portfolio Lab + Attribution** | 포트폴리오 워크스페이스, 수익 귀인 | S-9 | 대기 |
| **10. Bot Infrastructure** | Bots 페이지 업그레이드 | — | 대기 |
| **11. Data Quality Center + Report Builder** | 데이터 품질, 리포트 자동생성 | S-13, S-14 | 대기 |
| **12. Workflow Automation** | 전체 Research → Deploy 워크플로우 | S-15 | 대기 |

---

## Feature 상세

### S-1. Experiment Manager ⭐⭐⭐⭐⭐ → Phase 3

백테스트 실행 시 Experiment 자동 저장.

**저장 항목:**
- Strategy, Parameters, Dataset, Date range, Universe, Benchmark, Commission, Slippage, Notes

**자동 계산 (백엔드 이미 반환):**
- Sharpe, CAGR, Sortino, Max Drawdown, Win Rate, Turnover

**기능:**
- 실험 목록 (검색, 정렬, 필터)
- 실험 간 나란히 비교 (diff view)
- localStorage → 향후 백엔드 persistence

---

### S-2. Strategy Repository ⭐⭐⭐⭐⭐ → Phase 4

전략을 Git처럼 관리.

**기능:**
- Save / Clone / Fork / Archive
- Compare (전략 A vs B 파라미터 diff)
- Tag / Favorite
- Version History (localStorage timestamp 기반)
- Rollback (이전 버전 복원)

**저장:** localStorage, key `nautilus:strategies`

---

### S-3. Parameter Heatmap ⭐⭐⭐⭐⭐ → Phase 3

Fast EMA (5–50) × Slow EMA (20–200) 격자 전체 백테스트.

**구현:**
- N×M backtest 호출 (Promise.all, concurrency limit)
- 결과를 2D grid로 저장
- lightweight-charts 또는 canvas 기반 heatmap 렌더링
- 메트릭 선택: Sharpe / PnL / Max DD / Win Rate

**목적:** 전략이 특정 파라미터에만 의존하는지 즉시 확인.

---

### S-4. Event Study ⭐⭐⭐⭐⭐ → Phase 6

이벤트 전후 성과 분석.

**지원 이벤트:**
- FOMC, CPI, PPI, Payroll (FRED API)
- Earnings, Dividend, Split (KSD/EDGAR)
- 사용자 정의 날짜 목록

**분석:**
- 이벤트 -N일 ~ +N일 수익률
- 평균, 중앙값, 분산, Hit Ratio
- 이벤트별 수익률 분포 차트

---

### S-5. Universe Builder ⭐⭐⭐⭐⭐ → Phase 6

투자 유니버스 필터 트리.

**필터 순서:**
Country → Exchange → Market Cap → Sector → Industry → Liquidity → Volume → Result

**활용:**
- Research, Backtest, Portfolio, Bot 모든 곳에서 Universe 선택

**데이터 소스:**
- KRX (국내), EDGAR/NASDAQ (미국) — 백엔드 엔드포인트 확인 필요

---

### S-6. Research Notebook ⭐⭐⭐⭐⭐ → Phase 4

각 연구를 Notebook 형태로 저장.

**Notebook 블록 타입:**
- Chart (chart spec JSON 저장 → 재렌더링)
- Table (JSON 데이터)
- Metric (숫자 + 레이블)
- Comment (Markdown 텍스트)
- Image (base64 또는 URL)

**연결:**
- Experiment ID로 Notebook ↔ Experiment 링크

**저장:** localStorage, key `nautilus:notebooks`

---

### S-7. Trade Replay ⭐⭐⭐⭐⭐ → Phase 8

백테스트 결과를 시간순으로 재생.

**컨트롤:**
- Play / Pause / Next Trade / Previous Trade
- Speed (0.5× / 1× / 2× / 4×)
- Trade Highlight (매수 = 초록, 매도 = 빨강)

**차트 업데이트:**
- 프레임마다 bar 추가 (lightweight-charts `series.update()`)
- PnL 누적 line 동시 업데이트
- 현재 포지션 표시

---

### S-8. Scenario Analysis ⭐⭐⭐⭐⭐ → Phase 3

사전 정의 기간 프리셋.

**시나리오:**
- 2008 Financial Crisis (2007-10-01 ~ 2009-03-31)
- COVID Crash (2020-02-01 ~ 2020-04-30)
- Dot-com Bubble (2000-03-01 ~ 2002-10-31)
- Ukraine War (2022-02-01 ~ 2022-06-30)
- Inflation Cycle (2021-03-01 ~ 2023-06-30)
- High Rate Period (2022-03-01 ~ 2024-01-01)
- Bull Market 2017 (2017-01-01 ~ 2017-12-31)
- Bear Market 2022 (2022-01-01 ~ 2022-12-31)

**구현:**
- Backtest 페이지 날짜 프리셋 드롭다운
- 선택 즉시 start/end 자동 채움

---

### S-9. Portfolio Attribution ⭐⭐⭐⭐⭐ → Phase 9

수익이 어디서 발생했는지 분석.

**분해 항목:**
- Selection (종목 선택 효과)
- Allocation (섹터/자산 배분 효과)
- Timing (진입/청산 타이밍)
- Currency (환율 효과)
- Sector / Factor / Contribution

**시각화:**
- Waterfall Chart (각 요소별 기여도)
- Stacked bar (기간별)

---

### S-10. Factor Lab ⭐⭐⭐⭐⭐ → Phase 7

Factor 연구 공간.

**지원 Factor:**
Momentum, Quality, Value, Growth, Volatility, Liquidity, Carry, Size

**분석:**
- Factor IC (Information Coefficient)
- Factor Return (기간별)
- Factor Correlation (Factor 간)
- Factor Decay (정보 감쇠)
- Factor Ranking (종목 정렬)
- Factor Combination (Linear / Rank combination)

---

### S-11. Correlation Network ⭐⭐⭐⭐☆ → Phase 5

Correlation Matrix → Network Graph.

**구현:**
- 상관계수 threshold 이상: Edge 생성
- Cluster: Sector 색상 구분
- 라이브러리: D3.js force simulation (새 dependency 추가 필요)
- 기존 correlation_analysis 백엔드 엔드포인트 활용

---

### S-12. Rolling Analytics ⭐⭐⭐⭐⭐ → Phase 7

시간에 따른 지표 변화.

**지원:**
- Rolling Sharpe, Rolling Sortino
- Rolling Alpha, Rolling Beta
- Rolling Volatility, Rolling Correlation
- Rolling Drawdown

**구현:**
- 백엔드 `/rolling-beta` 이미 존재 → 확장
- 윈도우 크기 선택 (30d / 60d / 90d / 252d)
- lightweight-charts LineSeries 멀티 라인

---

### S-13. Data Quality Center ⭐⭐⭐⭐⭐ → Phase 11

각 데이터 소스 메타데이터 대시보드.

**표시 항목:**
- Source (KRX / KSD / FRED / ECOS / EDGAR)
- Coverage (날짜 범위, 종목 수)
- Update Frequency
- Missing Data (결측 비율)
- Corporate Action 적용 여부
- Version / Adjustment

---

### S-14. Report Builder ⭐⭐⭐⭐☆ → Phase 11

연구 결과 → 리포트 자동생성.

**출력 형식:**
- Markdown (즉시 구현 가능)
- HTML (Markdown → HTML 변환)
- PDF (브라우저 print API)
- Excel (향후, xlsx 라이브러리 필요)

**자동 포함:**
- Chart (screenshot 또는 SVG), Metric, Table, Comment, Strategy, Parameter

---

### S-15. Workflow Automation ⭐⭐⭐⭐⭐ → Phase 12

Research → Deploy 전체 워크플로우.

**흐름:**
Universe → Factor 분석 → Strategy → Backtest → Parameter Opt. → Portfolio → Paper Trading → Bot 배포 → Monitoring

**구현:**
- Workflow 상태 머신 (현재 단계 표시)
- 각 단계 완료 시 다음 단계로 CTA 자동 안내
- 단계 간 데이터 전달 (Universe → Backtest에 자동 주입 등)

---

## 구현 원칙 (모든 Phase 공통)

1. 연구 생산성이 높아지는가?
2. 데이터를 더 신뢰할 수 있는가?
3. 결과를 다시 재현할 수 있는가?
4. 전략을 더 쉽게 비교할 수 있는가?
5. 실제 기관 퀀트가 매일 사용할 기능인가?

---

## 기술 스택 (변경 없음)

- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS 4, lightweight-charts 5
- **Backend:** FastAPI (seokminal-multi-venue) — 기존 엔드포인트 최대 활용
- **신규 dependency 검토 필요:** D3.js (S-11 Correlation Network)
- **제외:** AI/LLM 기능 일체

## 디자인 제약 (모든 Phase 공통)

- 색상: CSS 토큰만 — hex 하드코딩 금지
- Accent(`#FF9F1C`): 주요 액션 버튼, active 탭에만
- 인라인 스타일: 금지
- API 호출: `lib/api.ts` 함수만
