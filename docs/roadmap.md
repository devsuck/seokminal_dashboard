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
| 40 | Hyperliquid Trading UI | `hyperliquid/trader.py`, `/hl/*` 엔드포인트, orders 페이지 HL 탭 | — |
| 41 | Groq 요약 + UX 정비 | `POST /groq/summarize`, GroqSummaryPanel, forex/crypto/insider/news/calendar 재정비 | — |
| 42 | IB WebSocket 실시간 | `/ws/ib/live/{symbol}`, IbRealtimeWidget 실연결, connect timeout + errorEvent 릴레이 | — |
| 43 | 실매매 안전화 | `risk_guard.py`(공통 pre-trade 가드), order_audit JSONL, 봇 포지션 desync 수정, `/trading/mode`, KR/US 확인 모달 | — |
| 44 | 멀티 AI 에이전트 + UX 구조화 | `agent_store.py`(레지스트리+사이클), `/agents/*` API, agent_loop 파라미터화+JSON출력, `/agents` 페이지(카드 UX) | — |
| 45 | 에이전트 대시보드 | `agent_perf.py`(FIFO 원장), `/agents/{id}/performance`, 대시보드 탭(포트폴리오·매매기록+이유·실시간 PnL 5초 폴링) | — |
| 46 | ai-trader 제거 | 채팅 불필요(자율) → ai-trader 페이지/링크/chat 엔드포인트 삭제, `/agents`가 정식 허브 | — |
| 47 | 데이트레이딩 분봉 전략 | `intraday_score.py`(VWAP/ORB/RVOL/EMA/ATR 프로급), `/alpaca/intraday/scores`, agent_loop daytrade 분기(고유동성 유니버스+ATR손절+EOD청산) | — |
| 48 | Mac 24/7 + HL 레버리지 단타 | `deploy/mac/`(launchd+caffeinate+resume), HL set_leverage/get_candles, intraday crypto모드, `/hl/leverage`·`/hl/intraday/scores`, hl_daytrade 프로파일+루프+hl_order.sh | — |
| 49 | 단타 결정론적 + 스윙 뉴스강화 | `daytrade_logic.py`(순수규칙), `/agents/{id}/daytrade-tick`(LLM 0), post_cycle.py 버그수정, 스윙 뉴스 프리페치 bull/bear | — |
| 50 | HL 멀티에셋 유니버스 | dex-aware trader(xyz 빌더DEX), 크립토5+xyz TradFi42(주식·금·은·원유·지수·외환, 전부 USDC), _DAYTRADE_UNIVERSE 확장 | — |
| 51 | 에이전트 페이퍼/라이브 선택 | agents.paper 컬럼, 생성 시 PAPER/LIVE 토글(경고), HL+paper=크립토만/live=TradFi 포함 | — |
| 52 | AI 도구 접근 | `tools/backtest.sh`(AI 전략검증), 스윙 프롬프트 도구 카탈로그(backtest/quant/news/portfolio/screener/사이트API) | — |
| 53 | 에이전트 자율성 레벨 | agents.autonomy(1 고정/2 AI전략가·백테스트검증/3 완전자율), 생성 시 선택, 리스크가드 상시 강제 | — |
| 54 | 전략 증류 | `POST /agents/{id}/distill`(거래로그→규칙전략 증류→백테스트 검증), 대시보드 증류 버튼. Lv3 탐색→검증된 전략 브릿지 | — |
| 55 | 자본분배 + 전체 오버뷰 | 에이전트 예산 기준 사이징(account_alloc−invested), `/agents/overview/all`, 상단 오버뷰(총합 카드 + 에이전트별 PnL 바 그래프) | — |
| 56 | 기능 감사 + 네비 정리 | 리다이렉트 스텁 7개 네비 제거(factor/correlation/rolling/replay/experiments/screener/strategies), workflow 링크 수정 | — |
| 57 | 실계좌 잔액 표시 | `/agents/accounts/balances`(Alpaca+HL testnet/mainnet + venue별 배정합계), 상단 상시 잔액 패널(잔여/초과경고) | — |
| 58 | IB·KIS 잔액 추가 | KIS get_balance(모의), IB get_account_summary(페이퍼/실), 정규화 accounts 리스트, 6계좌 통합 패널 | — |
| 59 | 스윙 KR/US/혼합 스코프 | agents.market, kr_order.sh(KIS), agent_loop 시장별 유니버스+실행 라우팅, 생성 시 시장 선택. 혼합=한 에이전트 US+KR | — |
| 60 | 자동 익절/손절 + KR 실투자 | `stop_exits`(하드 TP/SL, 프로파일별), daytrade-tick 배선, KISOrderClient mock/real 토글 + `/orders/kr` paper 라우팅 | — |

---

| 61 | KR 단타 + tick 버그수정 | intraday KST 세션, KIS get_holdings, kr_daytrade venue(yfinance 분봉+KIS 실행), daytrade-tick NameError(budget/cycles) 복구 | — |

| 62 | 잔액정리·원그래프·insider수정 | IB페이퍼 제거+한투실계좌, US insider 버그수정(adsh/index.json), DART 기업행위 필터, 포트폴리오 도넛 | — |

| 63 | 매매·알림 시장통합 | TradeTab(시장 매매, 심볼→KIS/Alpaca 라우팅), AlertTab(심볼 가격알림 localStorage+폴링), /orders·/alerts 네비 제거 | — |

| 64 | US 모의=Alpaca/실전=IB | daytrade-tick US 분기(paper→Alpaca/live→IB), /orders/us paper 라우팅, IB get_positions, TradeTab 모의/실계좌 토글 | — |
| 65 | UX 정리 | 뉴스 빈캐시 버그, insider 기간필터 제거·KR 컬럼 적응, /search 네비 제거, 시장/IB 네비 정리, Groq 요약 sticky/자동삭제 | — |
| 66 | 미국 의회 매매 | `insider/congress_client.py`(FMP stable senate/house), `/insider/congress`, 🏛 의회 탭 CongressTable | — |
| 67 | 미국 연방 정부계약 | `insider/gov_spending_client.py`(USASpending), `/insider/gov-contracts`, 🏦 정부계약 탭 GovTable | — |
| 68 | 차트 실시간 갱신(무료) | `/quote`(Finnhub), ChartTab US 5초 폴링 + KR KIS ws로 마지막 봉 갱신, 실시간/대기 뱃지 | — |
| 69 | 매매 UI 업그레이드 | TradeTab 실시간 현재가·수량 스테퍼/프리셋·예상금액·현재가 채우기·실계좌 경고 | — |
| 70 | UI 일관성 | 공용 `LoadingState`/`Spinner`, 로딩문구 "로딩 중…" 통일(9파일), 하드코딩 hex→토큰(accent/info) | — |
| 71 | quote 캐시+장중 게이팅 | `/quote` 3초 캐시(60/분 한도 보호), `lib/market-hours.ts` isUSMarketOpen, 마감 시 폴링 스킵 | — |
| 72 | US 라이브 단타 IB 통일 | IBOrderClient `get_intraday_bars`+`wait_fill`/`avg_fill_price`, 라이브=IB 데이터+실행+실체결가 | — |
| 73 | 외환 IB IDEALPRO | forex 페이지 `ForexChart`(getIBBars forex), bar-size 선택, 카드 클릭 페어 선택 | — |
| 74 | 뉴스 요약 정확도 | NewsPanel headline+summary AI 전달, groq "제목만 속단 금지" | — |
| 75 | 계좌 잔액 6/6 연동 | HL testnet spot 버그, IB accountValues(EUR), KIS CANO교정·재시도, quote캐시 | — |
| 76 | 에이전트 폼 재설계 | 스타일(단타/스윙/장투)×시장(한/미/크립토), 통화 자동(₩/$/USDC), 카드 정리 | — |
| 77 | 스윙-KR 라우팅/통화 | daytrade_tick venue=agent.market, agent_loop.sh 배정자본×비중 사이징($20k버그) | — |
| 78 | 카피트레이드(페이퍼) | /copytrade signals·mirror·positions (의회+내부자 매수 미러, Alpaca 페이퍼) | — |
| 79 | 카피 트레이더 카드 | /copytrade/traders 인물별 수익률(거래일 종가 진입), Autopilot 스타일 카드 | — |
| 80 | DART 기업행위 오토파일럿 | /dart signals(자사주=매수/증자=회피)·mirror(KIS모의)·positions, /dart-auto | — |
| 81 | 서버측 DART 봇 | dart_autobot(asyncio 루프, 브라우저 무관), 봇로그·config·장중게이팅 | — |
| 82 | DART 봇 비중 | action_weight 소각1.5/취득1.0/신탁0.6× | — |
| 83 | 차트 매매/알림 인라인 | MarketWorkspace 차트 우측 매매/알림 패널, Events/KR 탭 제거 | — |
| 84 | 성과 추적 (발전#1) | /performance/portfolio equity곡선·MDD·Sharpe·SPY벤치마크, /performance | — |
| 85 | 현실 백테스트 (발전#2) | simple_runner cost_bps(슬리피지+수수료), /backtest cost_bps + 워크포워드 | — |
| 86 | 스마트 시그널 (발전#3) | /signal/smart 레짐(HMM)+모멘텀+Kelly, /signal | — |
| 87 | 리스크 강화 (발전#4) | risk_state 킬스위치+MDD자동차단, /risk-guard | — |
| 88 | 사이징 CVaR+리스크패리티 | 스마트시그널 비중=min(Kelly×레짐×변동성타게팅, CVaR캡, 25%) | — |
| 89 | 페어 트레이딩(시장중립) | /pairs/backtest 공적분게이트+스프레드백테스트, /pairs | — |
| 90 | 스윙 페이퍼 검증 + 잠금봇 | 스윙검증-US 봇 가동, protected 에이전트(이름확인 삭제) | — |
| 91 | 차트 타임프레임+워치접기 | 1분/15분/1시간/4시간/하루/1달, 워치리스트 ◀▶, 크립토 인터벌 | — |
| 92 | 패널접기+버그수정 | 매매/알림 접기, 1분 IB안내. **#3 지표통합 미완** | ⏳ |

## 다음 세션 최우선 (채팅 리셋 인수인계)
1. **[⏳ 진행중] #3 지표를 오른쪽 패널로 통합** — 매매/알림/**지표** 3탭. ChartTab 지표상태 12개(SMA/EMA/BB/RSI/MACD/Stoch/CCI/%R/ADX/ATR/거래량/OBV) → MarketWorkspace로 리프트 → 우측 "📊 지표" 탭에서 추가/삭제·파라미터. tsc/빌드/방문검증 필수 (차트·실시간오버레이·서브차트 안 깨지게). 상세 progress.md Phase 92
2. **스윙 페이퍼 검증 지속** — 봇 `스윙검증-US`(id 7591f352, 잠금됨) 가동중. 노트북 켤 때 tmux 살아있는지 확인, 죽었으면 /agents에서 재시작. 며칠~몇주 후 성과페이지 SPY 초과수익 확인
3. KR 단타 실투자(KIS 실계좌) / IB(TWS) 실계좌 라이브 검증
4. 차트 US 분봉 = IB(TWS) 필요 (무료 대체 없음). 하루봉만 catalog
5. 뉴스 본문 전문(선택): Jina Reader 스크레이핑

## 현재 상태 요약 (인수인계)
- **전략 3축**: 방향성(단타·스윙·장투·스마트시그널) / 이벤트(카피트레이드·DART봇) / 시장중립(페어)
- **발전 4/4 완료**: 성과추적·현실백테스트·스마트시그널·리스크강화. 사이징=Kelly+변동성+CVaR
- **검증 인프라**: 성과페이지(SPY 초과수익)·비용백테스트·페어 공적분게이트
- **계좌**: Alpaca페이퍼 / KIS모의(1천만)·실계좌 / IB(€100) / HL testnet·mainnet — 6/6 연동
- **인증 없음** → 클라우드 배포 전 로그인/토큰 인증 선행 필수 (지금 로컬 전용)
- 배포: 로컬만. 24/7은 나중 클라우드(리눅스 VPS+claude CLI API키). 데스크탑 배포는 접음(반납 예정)

## 보류 (비용+난이도 — 학습 후 결정)
> 사용자 결정(2026-07-01): 옵션/선물은 **추가 구독비 + 난이도** 높아 당장 안 함. 공부하며 알아두고 나중에.

**옵션 (자동매매 부적합, 학습·헤지용):**
- 데이터: IB **OPRA** 구독 필요 (~$1.5~5/월 Non-Pro). 현재 미구독 → 옵션 페이지는 계산기(BS 그릭스/IV)만
- 난이도: 그릭스(델타/감마/세타/베가) 다차원 리스크, IV 표면, 만기·행사가 → 현재 방향성 분봉 엔진(intraday_score)으론 부적합. 옵션 전용 엔진 필요
- 개인 리스크: 세타(시간가치 소멸)로 방치 시 손실, 레버리지·스프레드 큼. 시작 시 커버드콜/현금확보풋/정의된-리스크 스프레드부터

**선물 (방향성 → 현재 엔진 재활용 가능, 중난이도):**
- 데이터: IB **CME/CBOT/NYMEX** 등 거래소별 구독 (~$5~15/월 each). 현재 미구독 → 선물 페이지는 계산기(cost-of-carry)만
- 적합성: 방향성 상품이라 현 분봉 점수 엔진(VWAP/ORB/EMA) **재활용 가능**, 크립토 단타와 구조 유사 → AI 단타 확장 자연스러움
- 시작 시: **마이크로 선물(MES/MNQ)** 소액 — 레버리지 통제. 유동성 큰 ES/NQ 미니 계열
- 배선 계획(나중): CME 마이크로 구독 → daytrade-tick에 FUT venue 추가 (HL 크립토 분기와 유사 코드)

**IB 마켓데이터 현황(2026-07-01, Non-Pro, 전부 Fee Waived $0):**
- US Real-Time Non Consolidated Streaming Quotes(주식·비통합), Korea Exchange Stocks, IDEALPRO FX, US Mutual Funds, EU Equities, Bond Quotes
- 없음: OPRA(옵션), CME 등 선물 → 옵션/선물 실데이터 시 이것들 추가 구독 (구독=안 써도 정액 월과금, US주식 번들은 월커미션 $30↑ 시 면제)
- **스냅샷 온디맨드 대안**: 월정액 구독 없이 요청당 과금으로 시세 조회 가능(US주식 $0.01, 그외 $0.03/건, 월 첫 $1 무료). 옵션/선물 "가끔만" 볼 땐 구독보다 이게 쌈
- 옵션/선물 add-on 전제조건 = `US Securities Snapshot & Futures Value Bundle`($10, 커미션 $30↑ 면제). 실거래 본격화 시 이것부터
- 나중 선물 단타: **CME Real-Time L1**($1.55, 커미션 $20↑ 면제) 하나면 MES/MNQ 커버

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

- (2026-07-01 검증 완료: 아래 3개 전부 해소 — 로드맵 stale)
  - ~~CorrelationNetwork D3 타입 오류 / 빌드 실패~~ → `npm run build` 통과 확인
  - ~~quant 레거시 인라인 스타일~~ → 전부 문서화된 예외(차트 설정/data-driven/범례 스와치), className 헥스 0개
  - ~~ai-trader 플레이스홀더~~ → 610줄 완전 구현됨 (Claude Haiku advisor + xgb)

---

## 다음 Phase 후보

### 멀티 에이전트 잔여 (계획: 2026-07-01-multi-agent-trading.md)
| 작업 | 내용 | 범위 | 우선도 |
|---|---|---|---|
| ~~Task 5~~ | ~~가상 계좌 분리~~ → Phase 45에서 **사이클 fill 원장**으로 해결 (client_order_id 태깅 불필요) | — | ✅ |
| Task 7 | 데이트레이딩 — 분봉 전략 분리 ✅ Phase 47. 남은 것: 장중 5분 사이클 실가동 e2e | Backend | 中 |
| — | ai-trader(610줄 tmux 덤프) → `/agents` 완전 대체 (사용자 확인 후) | Frontend | 中 |

### 실매매 안전화 후속 (Phase 43 한계 — 실계좌 전환 전 권장)
| 내용 | 범위 | 우선도 |
|---|---|---|
| ~~실 체결가 캡처 — IBOrderClient fill 대기 → `avg_fill_price` 실제값~~ ✅ Phase 72 (wait_fill + US 라이브 IB 데이터 통일) | Backend | ✅ |
| KIS `get_position` 구현 — KR 봇 reconciliation (현재 flat 시작) | Backend | 中 |
| 주문 멱등성 + IB 연결 풀링 (매 요청 connect/disconnect 제거) | Backend | 中 |
| OMS 레이어 — 상태머신 + 부분체결 추적, `/orders/audit` UI 연결 | Backend+Frontend | 中 |
| 실시간 포지션·PnL 대시보드 — 슬리피지/수수료 반영 실현 PnL | Backend+Frontend | 中 |

### 기타
| 내용 | 비고 |
|---|---|
| LangGraph Multi-Agent (TradingAgents) | **보류** — 무료 TPM 한도로 멀티에이전트 불가, OpenRouter 유료 필요 |
