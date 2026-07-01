## Phase 75 — 계좌 잔액 연동 버그 진단·수정 (2026-07-01) ✅ SHIPPED

잔액 패널에서 자산이 안 뜬다는 사용자 지적 → 라이브 진단으로 원인별 분리.

### 완료된 작업 (코드 버그)
- `hyperliquid/trader.py get_positions` — spot USDC 조회가 `if not paper`로 **테스트넷에선 스킵**됨 → 파우셋(spot) 998 USDC가 0으로 표시. 가드 제거(양 네트워크 spot 포함, try/except). **검증: 테스트넷 998.97 USDC 정상 표시**
- `backends/ib/client.py get_account_summary` — `reqAccountSummaryAsync()`가 간헐적 **0행 반환**(→$0) 확인. 비면 `reqAccountUpdatesAsync`+`accountValues(acct)` 폴백 추가 (라이브 검증은 샌드박스 IB 연결 행으로 미완, 코드/테스트는 통과)

### 진단 결과 (계좌/설정 이슈 — 코드 아님)
- **HL 테스트넷**: 파우셋 spot USDC가 0x71DC에 있었음(998) → 위 spot 버그였음 ✅ 수정
- **HL 메인넷**: 127.2 USDC 정상. 패널 "—"는 서버 stale → 재시작 필요
- **IB**: managed account U20595794 인식, reqAccountSummaryAsync 0행 → 폴백. 입금 정산/TWS 확인 병행
- **KIS 모의**: `INVALID_CHECK_ACNO` 지속. 토큰은 통과(키 유효) → 계좌번호만 거부 = CANO가 이 모의 앱에 미등록/비활성(KIS 포털 측). CANO 형식은 정상(8자리+PRDT 01)

### 검증
- IB+HL 테스트 18 passed. HL 테스트넷 잔액 라이브 998 확인

---

## Phase 74 — 뉴스 요약 정확도: summary 블러브 AI 전달 (2026-07-01) ✅ SHIPPED

사용자 지적: AI가 **헤드라인만** 받아 요약 → 실내용과 다르게 해석 위험. Finnhub는 본문 없음(URL 링크), yahoo도 본문 없음.

### 완료된 작업
- `components/news/NewsPanel.tsx` — `onHeadlinesLoaded`가 헤드라인만 보내던 것 → **`헤드라인 — summary` 블러브 결합** 전달 (Finnhub summary 필드 활용, 화면엔 이미 표시하던 것)
- `api_server/main.py` groq 뉴스 프롬프트 — "헤드라인과 요약을 보고 … 제목만으로 속단 금지" 문구 추가

### 미해결(선택) — 본문 전문
- Finnhub/yahoo 둘 다 본문 안 줌. 진짜 본문 원하면 Jina Reader(`r.jina.ai`) 등 스크레이핑 필요 → 지연·파싱 리스크로 보류. 매크로 요약엔 headline+summary로 충분

### 검증
- FE tsc OK / 백엔드 import OK

---

## Phase 73 — 외환 페이지 IB IDEALPRO 실데이터 (2026-07-01) ✅ SHIPPED

외환 페이지가 계산기(forward/carry/curve)+yfinance 그리드였음 → **IB IDEALPRO 실시간 캔들** 추가. 사용자 IDEALPRO FX 구독 보유(무료).

### 완료된 작업
- `app/forex/page.tsx` LiveRatesTab에 `ForexChart` 추가:
  - `getIBBars({asset_type:"forex"})` — 기존 `/ib/bars` forex 라우팅 재사용(`get_daily_bars_forex`, IDEALPRO)
  - bar-size 선택(5m/15m/1h/4h/1d), 페어별 duration 매핑
  - `toIbForexSymbol` "EUR/USD"→"EURUSD", `ibBarToBarOut` 매핑
  - 그리드 카드 클릭 → 차트 페어 선택(선택 카드 border-accent)
  - 공용 `EmptyState`/`LoadingState` 사용 (미연결 시 "IB TWS 연결 필요")

### 검증
- FE tsc/빌드/190 tests OK. 백엔드 변경 없음(기존 엔드포인트 재사용)

---

## Phase 72 — US 라이브 단타 IB 데이터 통일 + 실체결가 (2026-07-01) ✅ SHIPPED

문제: US 라이브 단타가 **Alpaca(IEX) 데이터로 판단 → IB로 실행**, 기록 체결가는 Alpaca 신호가(추정). 슬리피지·실 P&L 부정확. 사용자 IB 주식 구독 보유 → **라이브는 IB 데이터+실행 통일**.

### 완료된 작업
- `backends/ib/order_client.py`:
  - `place_order(..., wait_fill=False)` — wait_fill 시 체결 대기(`_await_fill`, 6초 폴링) 후 실 avg 반환
  - `_to_dict`에 **`avg_fill_price`** 추가 (UNSET_DOUBLE/0 → None)
  - `get_intraday_bars(symbol, "5 mins", "2 D")` — 같은 IB 연결 재사용, intraday_score 형태 dict 반환
- `api_server/router_autopilot.py` US 분기 리팩터:
  - **paper=Alpaca**(5분봉 데이터+실행, 무료 IEX) / **live=IB**(5분봉 데이터+실행)
  - live: IB 분봉으로 채점 → 판단 소스=체결 브로커 일치(괴리 제거)
  - 진입/청산 `wait_fill=True`, **실 avg_fill_price로 fill 기록** (없으면 신호가 폴백 "IB est" 표기)
- 테스트: `test_ib_order_client.py` +2 (wait_fill 체결가 캡처, get_intraday_bars 형태). FakeOrderStatus avgFillPrice/FillingIB/FakeBar stub 추가

### 데이터 경로 최종 정리
- paper US = Alpaca IEX 5분봉 (무료, 대형주 OK / 소형주 거래량 왜곡)
- live US = IB 5분봉 + 실행 + 실체결가 (구독 필요, 정확)
- KR = yfinance 5분봉 + KIS / 크립토 = HL 5분봉

### 검증
- 백엔드 429 passed / 4 pre-existing. import OK

---

## Phase 71 — quote 캐시 + 장중 게이팅 (2026-07-01) ✅ SHIPPED

Finnhub 무료 60 calls/분 한도 보호. 폴링 5초 유지(분봉엔 충분).

### 완료된 작업
- **#2 백엔드 캐시:** `/quote` 3초 TTL 캐시(`_quote_cache`) — 여러 컴포넌트/클라가 같은 심볼 요청해도 Finnhub 호출 1회로 dedup
- **#3 장중 게이팅:** `lib/market-hours.ts` `isUSMarketOpen()`(평일 09:30–16:00 ET, Intl로 DST 자동). ChartTab·TradeTab 폴링이 마감+최신가 확보 후엔 fetch 스킵 → 개장 시 자동 재개
- `tests/lib/market-hours.test.ts` (신규, 6 케이스: EDT/EST/주말/경계)

### Finnhub 무료 한계 (사용자 확인)
- `/quote` US 실시간 무료 ✅ / 과거 intraday 캔들 유료 ❌ (안 씀)
- **진짜 실시간 분봉/옵션/선물 원하면 IB 필요** — reqHistoricalData 1분봉+keepUpToDate, 옵션체인·그릭스·OPRA, 선물 term structure. 데이터+실행 통합 이득. → IB 마켓데이터 구독은 유지가 맞음

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드/190 tests OK

---

## Phase 70 — UI 일관성: 로딩/색상 토큰화 (2026-07-01) ✅ SHIPPED

사용자 요청 "전반적 UI 구린 포인트 수정" 중 택2: 빈상태/로딩 통일 + 하드코딩 색상 토큰화.

### 완료된 작업
- **공용 로딩:** `components/ui/LoadingState.tsx` 신규 — `LoadingState`(스피너+문구, EmptyState 레이아웃 일치) + `Spinner`(인라인). index.ts export
- **로딩 문구 통일:** 독립 로딩 패널 "Loading…"/"로딩 중..." → **"로딩 중…"** 9개 파일 (bots/crypto×3/PortfolioSnapshot/EventsTab×2/FearGreed/TodayEvents×2/KRMarkets). 버튼 라벨(`loading?"Loading…":"Run"`)은 영문 동사와 짝이라 유지
- **색상 토큰화(정확 일치만):** `bg-[#FF9F1C]`→`bg-accent`, `bg-[#3B82F6]`→`bg-info`, `text-[#000]`→`text-black` — event-study/ChartPanel/EfficientFrontierChart/quant. 토큰 없는 viz 팔레트(#8B5CF6/#06B6D4/퍼센타일 ramp)는 유지

### 검증
- FE tsc/빌드/184 tests OK

---

## Phase 69 — 매매 UI 업그레이드 (2026-07-01) ✅ SHIPPED

TradeTab 기본형 → 실사용 개선. 기존 토큰만 사용.

### 완료된 작업
- `components/market/TradeTab.tsx` 재작성:
  - 헤더 실시간 현재가(US=getQuote 5초 폴링, 상승/하락 색상)
  - 매수/매도 풀폭 세그먼트
  - 수량 스테퍼(−/+) + 프리셋(1/5/10/50/100)
  - **예상 주문금액**(수량×현재가/지정가, ₩/$ 통화)
  - 지정가 "현재가" 채우기 버튼
  - 확인 모달: 계좌·예상금액 추가, 실계좌 시 ⚠️ 경고

### 검증
- FE tsc/빌드 OK

---

## Phase 68 — 차트 실시간 갱신 (무료) (2026-07-01) ✅ SHIPPED

주식 차트가 정적 일봉이었음 → 마지막 봉을 실시간 최신가로 갱신. **IB 마켓데이터 구독 불필요** (Finnhub 무료 quote 재사용).

### 완료된 작업
- `api_server/main.py` — `GET /quote?symbol=` (Finnhub `/quote` 무료 실시간, QuoteResponse{symbol,price,ts}). 라이브 검증 AAPL $289
- `lib/api.ts` — `Quote` 인터페이스 + `getQuote()`
- `components/market/ChartTab.tsx` — 실시간 배선: **US=Finnhub 5초 폴링, KR=기존 KIS `/ws/live/{code}` ws**. `applyLivePrice`로 마지막 봉 close/high/low 갱신. 헤더에 현재가 + 실시간/대기 뱃지(pos dot pulse)

### 소싱 정리 (사용자 질문)
- 시장 차트 = catalog(파케이) 우선 → 없으면 US=IB / KR=KIS 폴백 (평소 IB 안 씀)
- IB 페이지 = IB reqHistoricalData 단독 (분봉, TRADES). IB 마켓데이터 구독은 차트엔 불필요; IB 계좌는 **US 실전 주문 실행**용으로만 필요 (paper=Alpaca)
- 옵션/외환/선물 페이지 = 현재 계산기(BS/carry). 암호화폐만 라이브(HL)

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드 OK

---

## Phase 67 — 미국 연방 정부계약/지출 (USASpending) 추가 (2026-07-01) ✅ SHIPPED

"트럼프 정부계약/지출" 프록시 — 대형 연방계약 낙찰(방산·테크 상장사) = 주가 시그널. USASpending.gov 무료 API(키 불필요).

### 완료된 작업
- `insider/gov_spending_client.py` (신규) — `get_recent_contracts(days, limit)`, USASpending `spending_by_award` POST, 계약(A~D)만 금액순. 정규화(수주기업/금액/발주기관/내용/시작일/계약ID)
- `api_server/main.py` — `GET /insider/gov-contracts` (days 1~180, limit 10~100), GovContract 모델
- `lib/api.ts` — GovContract + getGovContracts
- `app/insider/page.tsx` — 🏦 정부계약 마켓 탭 + GovTable(시작일/수주기업/발주기관/내용/계약금액, fmtB). gov/congress 시 회사검색행·us/kr결과 숨김, govCtrl abort cleanup

### 검증 (라이브)
- `/insider/gov-contracts?limit=10` 정상: UT-Battelle DOE $42B 등 대형 계약
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드 OK

---

## Phase 66 — 미국 의회 매매 (Congress trading) 추가 (2026-07-01) ✅ SHIPPED

의원(펠로시/매코널 등) 주식 매매 = STOCK Act 공시. FMP stable API로 가져옴. (트럼프 개인/정부기관은 체계적 피드 없어 미지원)

### 완료된 작업
- 데이터소스 조사: senate-stock-watcher S3(403 죽음), FMP 레거시(차단) → **FMP `stable/senate-latest`·`house-latest` 무료 키로 작동**
- `.env` — FINANCIAL_MODELING_PREP_API_KEY 메인 .env에 추가
- `insider/congress_client.py` (신규) — 상·하원 최근 신고 병합, 정규화(의원/원/티커/매수매도/금액범위/원문링크)
- `api_server/main.py` — `GET /insider/congress`, CongressTrade 모델
- `lib/api.ts` — CongressTrade + getInsiderCongress
- `app/insider/page.tsx` — 🏛 의회 마켓 탭 + CongressTable(신고일/거래일/의원/상하원/티커/매수매도/금액/원문). 의회 시 회사검색행 숨김

### 검증 (라이브)
- `/insider/congress` 정상: McConnell WFC 매수, McCormick GS 매수, Cleo Fields MSFT 매수 등 상·하원 100+건
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK

---

## Phase 65 — UX 정리: 뉴스 버그·insider·네비·요약패널 (2026-07-01) ✅ SHIPPED

사용자 5개 지적 처리.

### #4 뉴스 안 뜸 🐞
- `/news/market`이 빈값 캐시 오염으로 [] 반환 (finnhub 직접은 100건). **빈 결과는 캐시 안 하도록** 수정 → 30건 정상. GroqSummaryPanel: **28h 초과 캐시 자동삭제**(어제 것까지만), sticky 유지(스크롤 따라옴)
### #1 insider 페이지 정리
- 기간(days) 필터 제거(의미없음, 30일 고정), KR 테이블 중복/빈 컬럼 제거
### #2 KR insider 컬럼 적응
- 기업행위 전용이므로 보고자·증감주식수·보유비율(전부 —) 제거 → 접수일/종목/회사명/구분/공시명/원문. BUYBACK(자사주매수)/DISPOSAL(자사주처분) 뱃지 추가
### #3 발굴>종목검색 제거
- /search 네비 제거 (시장 페이지 검색 탭과 중복). 페이지는 보존
### #5 시장 vs IB 정리
- 네비 market 그룹에서 crypto/forex/options/futures 제거 (이미 시장 페이지 탭에 통합됨). market(자산군 탭 통합) + ib(IB 히스토리컬 바, 별도 데이터소스)만

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK
- 라이브: 뉴스 30건 복구, KR insider 기업행위만

---

## Phase 64 — US 모의=Alpaca / 실전=IB 라우팅 (2026-07-01) ✅ SHIPPED

TWS는 페이퍼/실전 동시로그인 불가 → US 모의는 Alpaca(무제한·무TWS), 실전은 IB(TWS 실계좌).

### 완료된 작업
- `backends/ib/order_client.py` — `get_positions()` (IB 보유), connectAsync timeout=4
- `api_server/router_autopilot.py daytrade-tick US 분기` — 데이터는 항상 Alpaca(무료), **실행/포지션: paper→Alpaca, live→IB(7496, asyncio 단일세션으로 포지션+청산+진입)**
- `api_server/main.py /orders/us` — `USOrderRequest.paper`: paper→Alpaca(place_order 재사용), live→IB(7496). 실전 IB_PORT 하드코딩 7496
- `lib/api.ts` — US/KROrderRequest.paper
- `components/market/TradeTab.tsx` — 모의/실계좌 토글(venue별 라벨: Alpaca페이퍼/IB실계좌, KIS모의/실계좌)

### 검증
- 백엔드 427 passed / 4 pre-existing. 회귀 2건 수정(FakeIB connectAsync timeout, us order test paper=false)
- FE tsc/184/빌드 OK

### 구조 정리
- **US**: 모의=Alpaca, 실전=IB(TWS 7496). **KR**: 모의/실전=KIS(mock 플래그). **HL**: testnet/mainnet
- 데이터(스코어)는 US 항상 Alpaca IEX(무료), 실행만 venue 전환

---

## Phase 63 — 매매·알림 시장 페이지 통합 (2026-07-01) ✅ SHIPPED

### #5 매매 → 시장 페이지
- `components/market/TradeTab.tsx` (신규) — 선택 종목 매매(매수/매도, 시장/지정가, 확인모달). 심볼 접미사로 라우팅(.XKRX→KIS, else→Alpaca/US). placeKROrder/placeUSOrder 재사용
### #4 알림 → 시장 페이지
- `lib/price-alert-storage.ts` (신규) — 심볼 가격알림 localStorage CRUD
- `components/market/AlertTab.tsx` (신규) — 종목 가격알림(이상/이하) 추가·삭제, 30초 폴링(getBars/getKRBars 최근가)→크로스 시 toast. 봇기반 /alerts와 달리 심볼-가격 기반
- `MarketWorkspace.tsx` — 💵매매 / 🔔알림 탭 추가 (activeSymbol 대상)
- `NavBar.tsx`·`Sidebar.tsx` — /orders·/alerts 메뉴 제거 (페이지는 보존: HL 수동거래·봇 P&L·봇알림 기능 유지)

### 검증
- FE tsc clean, 184/184, 빌드 OK

### 참고
- /orders(HL·봇P&L)·/alerts(봇알림) 페이지는 URL로 접근 가능하게 보존(기능 손실 방지). 네비만 정리
- 시장 매매 확인모달 있으나 서버 리스크가드는 주문 엔드포인트에서 강제됨

---

## Phase 62 — 잔액정리·포트폴리오원그래프·내부자거래 수정 (2026-07-01) ✅ SHIPPED

사용자 7개 요청 중 5개 처리 (#4·#5 시장페이지 통합은 다음 청크).

### #2 잔액패널 정리
- IB 페이퍼 제거(US 모의=Alpaca) + **한투 실계좌(kis_live)** 추가. KISOrderClient(mock=False)로 실계좌 잔액. IB는 실계좌만 표시
### #3 단타 레벨 미설정 (확인 완료)
- daytrade/kr_daytrade/hl_daytrade는 isDeterministic → 자율성 레벨 선택기 숨김("규칙 기반" 안내). 이미 구현됨
### #6 US 내부자 거래 수정 🐞
- EDGAR FTS 응답 필드 `accession_no`→**`adsh`** + 아카이브 경로 `{acc}-index.json`→**`index.json`** 두 버그. 이제 실데이터(HALLADOR BUY 5000@16.9 등 20건)
### #7 DART 기업행위만 (보유자보고 제외)
- `dart_client.get_recent_kr_corporate_actions` — list.json을 report_nm으로 필터: 유상증자(PAID_IN)/무상증자(RIGHTS_ISSUE)/자기주식취득(BUYBACK)/소각(CANCELLATION)/처분·해지(DISPOSAL). `/insider/kr/recent`가 이걸 사용 (소유상황보고 제거). 라이브 확인(유상증자결정·자기주식취득신탁 등)
### #1 포트폴리오 원그래프
- `/agents` 대시보드에 도넛(conic-gradient): 포지션별 시가+현금 비중 + 범례. 보유 포지션 테이블(포지션별 미실현 PnL)은 유지

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK
- 라이브: US insider 20건, KR 기업행위 4건, 한투 실계좌 잔액 연동

### 남은 요청 (다음 청크 — 큰 작업)
- **#4 알림설정 → 시장 페이지 통합** (별도 /alerts 제거, 시장 섹션별 알림)
- **#5 주문 → 시장 페이지 통합** (별도 /orders 제거, 시장 섹션별 매매)

---

## Phase 61 — KR 단타 + daytrade-tick 버그 수정 (2026-07-01) ✅ SHIPPED

### KR 단타 (한국주식 데이트레이딩)
- `intraday_score.py` — `market` 파라미터(US/KR): KST 세션 필터(`session_bars(tz)`), KR은 ToD 감점 없음
- `backends/kis/order_client.py` — `get_holdings()` (inquire-balance output1: 코드/수량/평단/현재가)
- `router_autopilot.py` — `_fetch_kr_intraday_bars`(yfinance .KS 5분봉), daytrade-tick **KR venue 브랜치**: yfinance 분봉→score(market=KR, 롱온리)→stop_exits/decide_exits→KIS 매수/청산. 보유·평단·현재가는 KIS inquire-balance
- `agent_store.py` — `kr_daytrade` 프로파일(venue KR, KIS 모의, tp3%/sl2%, EOD청산), `_DAYTRADE_UNIVERSE["KR"]`(KOSPI 대형주 10 .KS)
- `agent_loop.sh` — kr_daytrade 결정론 분기(5분)
- 프론트 — 단타(한국) 타입 + 뱃지

### 🐞 중대 버그 수정
- **daytrade-tick의 `budget = ...compute_performance(cycles)` — `cycles` 미정의(NameError)** → Phase 55(자본분배)부터 **모든 daytrade tick(US/HL/KR)이 500 에러로 깨져있었음**. `_cycles` fetch 추가로 복구. 회귀 테스트 `test_daytrade_tick.py` 추가
- ⚠️ 실행 중이던 HL 단타 에이전트도 이 버그로 매 사이클 실패 중이었음 → **재시작 필요**

### 검증 (라이브)
- KR daytrade-tick 200: yfinance 10개 KR 종목 분봉+KST 세션 스코어링 정상(삼성 005930 등), SKIP(롱온리+전부 SELL/WATCH)
- 백엔드 426 passed / 4 pre-existing (+KR session, daytrade-tick regression). FE tsc/184/빌드 OK

---

## Phase 60 — 자동 익절/손절 + KR 실투자 지원 (2026-07-01) ✅ SHIPPED

### #2 자동 익절/손절 (하드룰)
- `api_server/daytrade_logic.py` — `stop_exits(positions, tp_pct, sl_pct)`: 보유 포지션 진입가 대비 실현 움직임이 TP/SL 넘으면 청산(롱/숏 대응). AI 재량 아닌 강제
- `agent_store.py` 프로파일 — daytrade tp4%/sl2%, hl_daytrade tp5%/sl3%
- `router_autopilot.py daytrade-tick` — 양 venue(HL/US)에서 **stop_exits 먼저(하드 TP/SL) → decide_exits(신호 반전)** 순으로 청산. HL은 entryPx+현재가(스코어), Alpaca는 avg_entry+current_price
- 테스트 +5 (stop_exits 롱익절/손절/숏/밴드내/무가격)

### #3 KR 실투자 지원 (왜 미구현이었나 → 해결)
- 원인: KISOrderClient가 모의 전용 하드코딩(base_url=openapivts, TR=V*)
- `backends/kis/order_client.py` — `mock` 플래그: base_url(모의/실) + TR prefix(V→T) 자동. get_balance도 real 대응
- `api_server/main.py /orders/kr` — `KROrderRequest.paper`로 모의(KIS_MOCK)/실전(KIS) 키·서버 라우팅
- 안전: kr_order.sh(AI)는 모의 기본. 실전 KR은 `paper=false`+실키로 활성(엔드포인트 지원)

### #1 KR 단타 — 데이터 확인, 다음 청크
- yfinance KR 5분봉 됨(삼성 311 bars) → 가능. 단 intraday 엔진이 ET 세션 기준 → **KST 세션 처리 추가 필요**. 별도 작업으로 안전하게 (신규 venue: yfinance 분봉 + KIS 실행 + kr_daytrade 프로파일)

### 검증
- 백엔드 425 passed / 4 pre-existing (+5 stop_exits). FE tsc/184/빌드 OK

---

## Phase 59 — 스윙 KR/US/혼합 시장 스코프 (2026-07-01) ✅ SHIPPED

스윙 에이전트가 미국만 → 한국/미국/혼합 선택. 혼합 = 한 에이전트가 Alpaca(US)+KIS(KR) 둘 다.

### 완료된 작업
- `api_server/agent_store.py` — `agents.market` 컬럼(US/KR/MIXED, 마이그레이션+검증), create_agent(market)
- `api_server/router_autopilot.py` — AgentCreate.market, create 전달, start_agent가 `agent_loop.sh <id> <type> <autonomy> <market>` 전달
- `autopilot/tools/kr_order.sh` (신규) — KIS 주문(buy/sell/limit, 6자리 코드) via `/orders/kr`
- `autopilot/agent_loop.sh` — `MARKET=$4`, 스윙 유니버스 분기: US=screen_stocks, KR=KOSPI 대형주 12(.KS), MIXED=둘 다 score_stock. 실행 라우팅: US→order.sh, KR→kr_order.sh(코드), MIXED=티커로 구분
- `lib/api.ts` — TradingAgent.market, createAgent(market)
- `app/agents/page.tsx` — 스윙 생성 시 시장 범위 선택(미국/한국/혼합) + 리스트 시장 뱃지

### 동작
- **US**: Alpaca 미국주식 (기존)
- **KR**: KIS 모의, KOSPI 대형주(삼성전자/SK하이닉스/현대차…) 스크리닝, kr_order.sh 실행
- **MIXED**: US+KR 후보 동시 스코어, AI가 각 장 시간에 해당 시장 거래 (티커로 라우팅)

### 검증
- 백엔드 420 passed / 4 pre-existing (+2 market). yfinance KR(.KS) 스코어링 확인(삼성전자 ₩317k)
- 쉘 zsh -n 통과, FE tsc clean, 184/184, 빌드 OK

### 한계
- KR 포지션 익절/손절 자동감지 미완(POSITION_CHECK는 Alpaca만) — KR은 AI 메모리 기반
- KR 실계좌(실투자) 미구현 — KIS 모의만. 단타 KR은 분봉 데이터 별도 필요(스윙만 KR 지원)

---

## Phase 58 — IB·KIS 잔액 추가 (전 계좌 통합) (2026-07-01) ✅ SHIPPED

잔액 패널에 IB(페이퍼/실), 한투(모의) 추가 → 6개 계좌 통합 표시.

### 완료된 작업
- `backends/kis/order_client.py` — `get_balance()` (inquire-balance VTTC8434R): 예수금/총평가/순자산
- `backends/ib/client.py` — `get_account_summary()` (reqAccountSummaryAsync, connect timeout): net_liq/cash/BP
- `api_server/router_autopilot.py` `/agents/accounts/balances` — KIS 모의 + IB 페이퍼(7497)/실(7496) 폴트-톨러런트 추가, **정규화 `accounts` 리스트**(venue/label/ccy/mode/balance/allocated/error) 반환
- `lib/api.ts` — AccountRow/AccountBalances(accounts)
- `app/agents/page.tsx` — Balances 제네릭 렌더(통화별 ₩/$/USDC 포맷), 계좌별 잔액/배정/잔여/에러

### 검증 (라이브)
- Alpaca $100k · **한투 모의 ₩10,000,000** · IB 페이퍼 연결($0) · IB 실계좌 미연결(정상) · HL testnet $0 · HL mainnet $127.2
- FE tsc clean, 184/184, 빌드 OK

### 남은 것 (다음)
- **KR/US/혼합 마켓 스코프** — 에이전트가 아직 미국(Alpaca)만. 한국장(KIS 실행 + KR 유니버스/스코어링) 추가 + 생성 시 스코프 선택. **별도 큰 작업**(설계 확정 후)
- KIS 실계좌 잔액(TTTC8434R + 실 base_url) 미구현

---

## Phase 57 — 실계좌 잔액 표시 (배정 참고) (2026-07-01) ✅ SHIPPED

에이전트 0개면 오버뷰가 사라져 실계좌 잔액을 못 봄 → 배정액 정하기 어려움. 잔액 패널 상시 표시.

### 완료된 작업
- `api_server/router_autopilot.py` — `GET /agents/accounts/balances`: 폴트-톨러런트 집계. Alpaca(equity/cash/BP), HL 테스트넷/메인넷 account_value, 그리고 **에이전트 배정 합계를 venue별 분리**(us_alpaca / hl_testnet / hl_mainnet)
- `lib/api.ts` — AccountBalances + `getAccountBalances()`
- `app/agents/page.tsx` — **상단 상시 잔액 패널**(에이전트 0개여도 표시): Alpaca/HL테스트넷/HL메인넷별 잔액 + 배정액 + 잔여(초과 시 ⚠️경고), 30초 폴링

### 검증
- 라이브: Alpaca 페이퍼 $100k, HL 메인넷 실USDC $127.2, HL testnet $0 확인
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 56 — 사이트 기능 감사 + 네비 정리 (2026-07-01) ✅ SHIPPED

전체 사이트 중복/dead 기능 감사 → 리다이렉트 스텁이 네비에 남아있던 문제 정리.

### 감사 결과
- **리다이렉트 스텁 7개가 NavBar에 중복 노출**: factor/correlation/rolling→quant, experiments/strategies→notebooks, screener→search, replay→backtest. 통합 후 옛 메뉴가 안 지워짐
- quant(2412줄)=팩터+상관관계+롤링 흡수, notebooks=실험+전략 흡수 (정상)
- 자산군 페이지(market/crypto/forex/futures/options/ib) 중복 아님

### 완료된 작업
- `components/NavBar.tsx` — 리다이렉트 7개 메뉴 제거 (발굴:스크리너 / 분석:상관관계·롤링·팩터 / 전략:전략·실험 / 백테스트:리플레이). 리다이렉트 페이지 자체는 보존(옛 URL 대응)
- `app/workflow/page.tsx` — 스텝 링크 더블리다이렉트 수정: factor→`/quant`, strategies→`/notebooks`

### 검증
- 네비/워크플로우 잔여 리다이렉트 참조 0, tsc clean, 184/184, 빌드 OK

### 남은 판단거리 (사용자 결정)
- `spawner`(전략 검증기) — 백테스트/에이전트와 역할 겹칠 소지. 실사용 여부 확인 후 정리 가능
- 리다이렉트 스텁 페이지 파일들(factor/correlation/rolling/replay/experiments/screener/strategies) — 옛 북마크 없으면 삭제 가능

---

## Phase 55 — 에이전트별 자본 분배 + 전체 오버뷰 대시보드 (2026-07-01) ✅ SHIPPED

Alpaca 단일 계좌를 AI별로 나누고, 여러 에이전트를 한눈에.

### 자본 분배 (실질 적용)
- 기존 `account_alloc`은 저장만 되고 사이징은 실계좌 전체 equity를 씀 → 분배 안 지켜짐
- `daytrade-tick` 사이징을 **에이전트 예산 기준**으로: `budget = account_alloc − 자기 invested`(자기 원장). 여러 에이전트가 한 계좌에서 각자 슬라이스 안에서만 거래 (US/HL 양쪽)

### 전체 오버뷰
- `GET /agents/overview/all` — 전 에이전트 집계(실현손익 기준, 가격조회 없이 빠름): 에이전트별 alloc/realized/return/invested/cash/포지션수/거래수 + 총합(count/alloc/realized/return/running)
- `lib/api.ts` — AgentsOverview + `getAgentsOverview()`
- `app/agents/page.tsx` — 상단 **오버뷰 섹션**: 총합 카드(에이전트수·총배정·총실현손익·종합수익률) + **에이전트별 실현손익 가로 바 그래프**(클릭 시 해당 에이전트 선택), 10초 폴링

### 검증
- 백엔드 418 passed / 4 pre-existing (+3). overview 집계 정확(총 alloc 1500, realized 100, return 10%)
- FE tsc clean, 184/184, 빌드 OK
- 라이브: overview가 실제 다중 에이전트 집계 확인

---

## Phase 54 — 전략 증류 (Lv3 자유탐색 → 검증된 규칙 전략) (2026-07-01) ✅ SHIPPED

"Lv3가 잘 나오면 그 전략 라이브로?" → Lv3는 고정 전략 없음(즉흥). 그래서 거래로그를 **백테스트 가능한 규칙 전략으로 증류**하는 브릿지.

### 완료된 작업
- `api_server/router_autopilot.py` — `POST /agents/{id}/distill`: 에이전트 체결로그(agent_perf.trades) → claude로 macd/rsi/ema_cross 규칙+파라미터 증류 → `/backtest`로 1년 검증 → {proposal, backtest(sharpe/pnl/승률), validated(Sharpe≥1), verdict} 반환. json/urllib import 누락 버그 수정
- `lib/api.ts` — DistillResult + `distillAgent()`
- `app/agents/page.tsx` — 대시보드에 "🧪 전략 증류" 버튼 + 결과(전략/파라미터/Sharpe/수익/승률/근거/검증판정)

### 흐름
```
Lv3 자유 탐색 → 거래로그 → AI 증류(규칙+파라미터) → 백테스트 검증 → Sharpe≥1이면 라이브 후보
```

### 검증 (라이브 e2e)
- 4건 체결 주입 → distill → **MACD(AAPL, 12/26/9) 증류 → 백테스트 Sharpe 1.69 → validated=true** 확인
- 체결<3 → 422, 없는 에이전트 → 404
- 백엔드 415 passed / 4 pre-existing (+2 distill). FE tsc clean, 184/184, 빌드 OK

### 의미
- Lv3 = 아이디어 발굴기, 증류 = 검증 가능한 전략으로 굳힘. "AI vibes로 번 것"을 재현·검증 가능한 엣지로 전환

---

## Phase 53 — 에이전트 자율성 레벨 선택 (2026-07-01) ✅ SHIPPED

생성 시 AI 자율성 레벨(1/2/3) 선택. "AI가 알아서 매매" 요청 → 안전하게 단계화.

### 레벨
- **1 고정 규칙**: 정해진 임계값(macro≥5 AND score≥threshold)대로만
- **2 AI 전략가 (기본·추천)**: 지표·뉴스로 가설 → **backtest.sh로 검증** → 엣지 확인 시만 매매
- **3 완전 자율**: AI 재량(고정 임계값 없음). 엣지 검증 약함 경고. **하드 리스크가드는 항상 강제**

### 완료된 작업
- `api_server/agent_store.py` — `agents.autonomy` 컬럼(+마이그레이션, 1~3 검증), `create_agent(..., autonomy=2)`
- `api_server/router_autopilot.py` — `AgentCreate.autonomy`, create 전달, start_agent가 `agent_loop.sh <id> <type> <autonomy>` 전달
- `autopilot/agent_loop.sh` — `AUTONOMY=$3`, 스윙 STRATEGY_RULES를 레벨별 분기(1 고정 / 2 백테스트검증 / 3 자율). 공통 실행규칙 + "리스크 한도는 서버 강제"
- `lib/api.ts` — TradingAgent.autonomy, createAgent(autonomy)
- `app/agents/page.tsx` — 자율성 레벨 선택기(스윙만; 단타는 레벨1 고정 안내), 레벨3 경고, 리스트 Lv 뱃지

### 안전
- 단타(결정론)는 레벨1 고정 (LLM 없음)
- 레벨 무관 **하드 리스크가드(주문크기·일일손실·킬스위치, Phase 43)는 코드 강제** — AI가 못 끔

### 검증
- 백엔드 415 passed / 4 pre-existing (+2 autonomy)
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 52 — AI에게 백테스트+사이트 도구 쥐어주기 (2026-07-01) ✅ SHIPPED

퀀트 수동 흐름(짜기→백테스트→페이퍼/실매매)은 유지. AI(스윙, LLM)가 사이트 기능을 도구로 사용:

### 완료된 작업
- `autopilot/tools/backtest.sh` (신규) — `backtest.sh INSTRUMENT STRATEGY [DAYS]` → `/backtest` 호출, Sharpe/Sortino/수익률/승률/MDD 반환. **AI가 진입 전 전략 검증**
- `autopilot/agent_loop.sh` 스윙 프롬프트 — **도구 카탈로그** 주입: backtest.sh(전략검증), quant.sh(지표), news.sh(뉴스), portfolio.sh(계좌), screen_stocks.py(스크리닝), 사이트 API 직접 curl(risk/factor/portfolio/insider/calendar 등). "판단 애매하면 backtest.sh로 검증 후 결정"

### 동작
- 스윙 AI(LLM, bypassPermissions로 Bash 가능)가 매 사이클 필요시 백테스트·퀀트·뉴스·리스크 등 사이트 기능 호출해 근거 보강 후 매매
- 결정론 단타는 LLM 없어 도구판단 불가 → 스윙 전용 (의도된 것)

### 검증
- 라이브: `backtest.sh AAPL.NASDAQ macd/rsi` 정상 (Sharpe 0.71, 승률 0.6)
- 쉘 zsh -n 통과

### 참고
- 퀀트 수동 파이프라인(/backtest·/strategies·/bots)은 그대로 유지 (사용자 요청)

---

## Phase 51 — 에이전트 페이퍼/라이브 선택 (2026-07-01) ✅ SHIPPED

AI 생성 시 모의(paper)/실거래(live) 선택. TradFi는 페이퍼 제외(테스트넷 무거래) → 크립토만.

### 완료된 작업
- `api_server/agent_store.py` — `agents.paper` 컬럼(+기존 DB 마이그레이션 ALTER), `create_agent(..., paper=True)`, bool 정규화
- `api_server/router_autopilot.py` — `AgentCreate.paper`, create 엔드포인트 전달, daytrade-tick이 `agent.paper` 사용(프로파일 아님). **HL+paper → xyz(TradFi) 제외 크립토만** 필터
- `lib/api.ts` — TradingAgent.paper, createAgent(paper)
- `app/agents/page.tsx` — PAPER/LIVE 토글(라이브 적색+confirm 경고), hl_daytrade+paper 안내(TradFi는 LIVE 필요), 리스트 PAPER/LIVE 뱃지

### 동작
- **PAPER**: 테스트넷/모의. HL 단타는 크립토만(BTC/ETH/SOL/HYPE/DOGE)
- **LIVE**: 메인넷 실USDC. HL 단타는 크립토+xyz TradFi 전체(주식/금/원유/지수/외환). 생성 시 confirm 경고

### 검증
- 백엔드 413 passed / 4 pre-existing. 신규 +5 (paper flag, dex routing)
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 50 — HL 멀티에셋 (주식·원자재·지수·외환) 유니버스 (2026-07-01) ✅ SHIPPED

"수익 최우선 + 넓은 유니버스" — HL 빌더 perp DEX로 코인 외 자산까지. **담보 화폐(USDC) 필터가 핵심**.

### 조사 결과 (라이브 확인)
- HL 표준 perp = 230개 전부 크립토(+PAXG). 미국주식/한국주식/지수/원자재는 **HIP-3 빌더 DEX**에 있음
- **USDC 담보로 거래 가능한 건 딱 2곳**: 표준 크립토 DEX(USDC) + **xyz DEX(USDC, 84 라이브)**. cash=USDT0, hyna=USDE, flx/vntl=USDH, mkts=delisted → USDC로 불가
- xyz(메인넷): TSLA $416, GOLD $3999, SP500 등 실가격+거래량 ✅. 테스트넷 xyz는 마켓만 있고 **캔들 0(무거래)** → TradFi 데모 불가, 실거래는 메인넷 실USDC

### 완료된 작업
- `hyperliquid/trader.py` — **dex 인식**: `_dex_of`/`_perp_dexs`, `xyz:TSLA` → `Info/Exchange(perp_dexs=["xyz"])` 라우팅. get_candles/place_order/set_leverage/close_position 전부 dex-prefixed 이름 처리
- `api_server/router_autopilot.py` `_DAYTRADE_UNIVERSE["HL"]` — 사용자 워치리스트 기반: 크립토 5개(BTC/ETH/SOL/HYPE/DOGE, 사용자 지정만) + xyz TradFi 42개(SKHX/XYZ100/SP500/SPCX/SILVER/CL/BRENTOIL/GOLD/NVDA/SMSN/TSLA/… + 유동성 추가 MU/SNDK/INTC/MSTR/AMD/EWY/AMZN/COIN/PLTR/TSM/COPPER/PLATINUM/JP225/KR200/BABA…)

### 검증
- 백엔드 411 passed / 4 pre-existing. 신규 +3 (hl_dex_routing)
- 라이브: dex-aware 캔들 mainnet 정상 (xyz:TSLA/GOLD + BTC), 파싱 테스트 통과

### 남은 것 (실거래 관련)
- **TradFi 실거래 = 메인넷 실USDC 필요** (테스트넷 무거래). hl_daytrade 프로파일은 paper=true → TradFi는 SKIP만. 실매매하려면 mainnet 프로파일 + 실USDC (사용자 결정)
- **크로스-DEX 포지션 조회**: get_positions는 표준 DEX user_state → xyz 포지션은 별도 조회 필요 (진입은 되나 xyz 보유 자동청산 감지 미완)
- xyz 주문 라우팅은 데이터/구조 검증됨, 실주문은 메인넷에서 최종 확인 필요

---

## Phase 49 — 단타 결정론적 전환 + 스윙 뉴스 강화 (2026-07-01) ✅ SHIPPED

토큰 비용 문제: 단타가 5분마다 claude 호출(SKIP만 해도) → 낭비. 단타=규칙기반이어야, 스윙=뉴스/LLM 값어치.

### 단타 결정론적 (LLM 제거, 토큰 0)
- `api_server/daytrade_logic.py` (신규) — 순수 규칙: `decide_entry`(최고 conviction 액션 시그널, US는 롱만/HL은 롱숏), `decide_exits`(신호 반전/AVOID·WATCH 소멸 시 청산), `position_size`(equity×pct×leverage/entry)
- `api_server/router_autopilot.py` — `POST /agents/{id}/daytrade-tick`: 스코어→청산→진입→사이클기록 전부 서버측 결정론(LLM 없음). US(Alpaca)/HL 양 venue
- `autopilot/agent_loop.sh` — daytrade/hl_daytrade는 claude 대신 `daytrade-tick` curl (스윙만 LLM 유지)
- `autopilot/tools/post_cycle.py` (신규) — heredoc+파이프 stdin 충돌 버그 수정 (JSON이 파이썬코드로 파싱되던 문제)

### 스윙 뉴스 심층 분석 (TradingAgents-lite)
- `agent_loop.sh` 스윙 브랜치 — 상위 3후보 `tools/news.sh`로 실뉴스 프리페치 → 프롬프트 주입, bull/bear를 뉴스+펀더+기술로 저울질하는 규칙. 8h 주기라 단일 LLM콜 감당됨

### 검증 (라이브)
- 백엔드 408 passed / 4 pre-existing. 신규 +10 (daytrade_logic)
- HL 단타 에이전트 결정론 루프 실가동: `결정론적 틱 (LLM 없음)` → SKIP 기록 (BTC/ETH/SOL AVOID, testnet 저유동성) → **claude 호출 0, <1초**
- `daytrade-tick` 직접호출 정상, 스윙 뉴스 word-split/엔드포인트 OK

### 비용 구조 정리
- 단타(5분): 토큰 0 (결정론) — 24/7 무료 가동
- 스윙(8h): 뉴스+LLM, 저빈도라 저비용

---

## Phase 48 — Mac 24/7 운영 + Hyperliquid 레버리지 단타 에이전트 (2026-07-01) ✅ SHIPPED

### Mac 24/7 (deploy/mac/)
- `com.seokminal.backend.plist` — launchd 유저 에이전트 (RunAtLoad + KeepAlive 자동재시작)
- `start-backend.sh` — `caffeinate -i -s`로 잠자기 방지 + uvicorn :8000, 부팅 후 에이전트 재개 트리거
- `resume-agents.sh` — status=running인데 tmux 세션 죽은 에이전트 자동 재시작 (urllib, idempotent)
- `install.sh` (설치/제거), `README.md` (한계 고지: 맥 상시 켜둬야, claude CLI 사용량 주의)

### Hyperliquid 레버리지 단타 에이전트
- `hyperliquid/trader.py` — `set_leverage(coin,leverage,is_cross,paper)`, `get_candles(coin,interval,lookback_min,paper)` (HL candles_snapshot → intraday 바)
- `api_server/intraday_score.py` — `crypto=True` 모드: 24/7(세션/ToD 리셋 없음, 롤링 VWAP)
- `api_server/main.py` — `POST /hl/leverage`(Field ge1 le50), `GET /hl/intraday/scores?coins=&paper=` (HL 분봉 → crypto 스코어링)
- `api_server/agent_store.py` — `hl_daytrade` 프로파일 (venue HL, leverage 3, position_pct 10%, paper testnet, 24/7)
- `autopilot/agent_loop.sh` — `hl_daytrade` 분기: HL 분봉 스코어, 레버리지 설정, 비중×레버리지 사이징, ATR 손절, 24/7(시장시간 무시), `tools/hl_order.sh`(leverage/buy/sell/close/positions, testnet)
- `app/agents/page.tsx` + `lib/api.ts` — 생성폼 3타입(스윙/단타(주식)/단타(HL)), 리스트 뱃지

### 검증
- 백엔드 398 passed / 4 pre-existing. 신규 +14
- 쉘 zsh -n 통과, plist plutil OK / FE tsc clean, 184/184, 빌드 OK

### HL testnet 양방향 라이브 검증 완료 (2026-07-01) ✅
- **testnet/mainnet 키 분리** 구현: `trader.py` `_private_key(paper)`/`_account_address(paper)` — paper면 `HL_TESTNET_*` 우선, 없으면 mainnet 폴백
- **롱/숏 실체결 확인**: ETH 롱(0.01@1575.6, 0.02@1575.7) + 숏(0.01@1576.2, 0.02@1576.2) 전부 filled (oid 반환). 청산(market_close) 정상
- **핵심 발견 — API 지갑 패턴**: `HL_TESTNET_PRIVATE_KEY`(agent 0xea88, 서명) ≠ `HL_TESTNET_ACCOUNT_ADDRESS`. 자금·포지션은 **마스터 계좌(메타마스크 0x71DC)**에 있음 → ACCOUNT_ADDRESS는 agent가 아니라 **마스터 주소**여야 조회됨. .env 수정 완료 (0xea88→0x71DC)
- 마스터 0x71DC testnet: 파우셋 10.5 USDC, 숏 -0.02 포지션 정상 조회됨
- 참고: 체결 직후 accountValue/positions 조회가 간헐적으로 빈값 → HL 테스트넷 eventual-consistency(코드 아님). 최종 flat 확인(잔여 포지션 없음)

### (초기 진단 로그)
- ✅ 읽기전용: `/hl/intraday/scores` testnet 캔들 → VWAP/ORB/EMA/ATR/방향 정상 (testnet 저유동성이라 RVOL~0 → AVOID = 올바른 거름)
- ✅ `/hl/positions` 정상 (accountValue $0)
- 🐞 **버그 수정**: `market_open()`에 `reduce_only` 인자 없음 → 롱/숏 주문 크래시. trader.py에서 market 주문 시 reduce_only 제거(청산은 market_close가 담당), limit은 유지
- ✅ 수정 후 롱/숏 **양방향 동일하게 HL 도달** 확인 (서명·제출 경로 정상)
- ⛔ **블로커(사용자 작업)**: testnet 지갑 미온보딩/무자금 → `wallet 0x0d8c… does not exist`. 또 `.env` **주소 불일치**: HL_ACCOUNT_ADDRESS=0x71DC… vs 개인키 파생 0x0d8c…
  - 필요: testnet 파우셋 입금 + 키/주소 일치(또는 API 지갑 승인) 후 실주문 가능

---

## Phase 47 — 데이트레이딩 분봉 전략 분리 (프로급) (2026-07-01) ✅ SHIPPED

swing/daytrade가 동일 일봉 멀티팩터 쓰던 문제 → daytrade 전용 **분봉 일중 전략** 분리.

### 완료된 작업
- `api_server/intraday_score.py` (신규) — 프로급 일중 스코어링 순수함수(0~100 + 방향 + ATR 손절/익절):
  - **VWAP**(기관 앵커) + EMA9/20 스택 → regime/방향 (25점)
  - **ORB**(개장 30분 레인지 돌파) → 진입 트리거 (25점)
  - **RVOL**(상대거래량) → 가짜돌파 거름 (20점)
  - 미세 모멘텀 정렬 (15점), **ATR 변동성 게이트**(죽은종목 AVOID, 15점)
  - **RSI(7) 과열 추격 패널티**(-20), **time-of-day**(점심 횡보 ×0.7)
  - signal: STRONG_BUY/SELL≥70, BUY/SELL≥55, WATCH≥40, AVOID. entry/stop/target = ATR 1.5R
- `api_server/router_autopilot.py` — `GET /alpaca/intraday/score/{symbol}`, `GET /alpaca/intraday/scores?symbols=` (Alpaca 5분봉 → 스코어링)
- `autopilot/agent_loop.sh` — **프로파일 분기**: daytrade는 분봉 엔드포인트 호출 + 고유동성 고정 유니버스(SPY/QQQ/NVDA/TSLA…) + conviction≥55 + ATR 손절 준수 + EOD 강제청산 프롬프트. swing은 기존 일봉 멀티팩터 유지

### 검증
- 백엔드 394 passed / 4 pre-existing. 신규 +11 (intraday_score 9, intraday_endpoint 2)
- 실서버 스모크: `/alpaca/intraday/score/AAPL` 정상 응답 (장마감이라 insufficient data→AVOID, 올바른 동작)

### 남은 작업
- 장중 5분 사이클 실가동 e2e (실제 시장 시간에 분봉 흐름 확인) — Task 7 최종

---

## Phase 46 — ai-trader 제거 (채팅 불필요) (2026-07-01) ✅ SHIPPED

자율 에이전트면 채팅 입력 불필요(긴급개입은 시작/정지+킬스위치+리스크가드로 커버) → ai-trader 중복 제거, `/agents`가 정식 AI 트레이딩 허브.

### 삭제/정리
- `app/ai-trader/page.tsx` 삭제 (610줄 tmux 덤프 페이지)
- `components/NavBar.tsx`, `components/Sidebar.tsx` — `/ai-trader` 링크 제거, Sidebar는 `/agents`로 교체
- `lib/i18n-utils.ts` — nav.ai-trader, page.ai-trader.title/desc 제거
- `lib/api.ts` — 미사용(0 소비처) 함수 제거: sendChatMessage/getChatPane/ChatPaneResult, startAutopilotTerminal/getTerminalStatus, getClaudeUsage/ClaudeUsage*
- `api_server/router_autopilot.py` — chat 브리지 제거: `POST /alpaca/chat/send`, `GET /alpaca/chat/pane`, ChatMessage, _pane_baseline (`_tmux_capture`는 shutdown/status가 써서 유지)
- 보존: autopilot 루프/tmux, shutdown 엔드포인트(1곳 사용)

### 검증
- 백엔드 383 passed / 4 pre-existing, import OK
- 프론트 tsc clean(.next/types 재생성), 184/184, 빌드 OK(ai-trader 라우트 제거, /agents 유지)
- 잔여 ai-trader 참조 0

---

## Phase 45 — 에이전트 대시보드 (포트폴리오·매매기록·실시간 PnL) (2026-07-01) ✅ SHIPPED

`/agents` 페이지 우측 공간에 per-agent 대시보드. "기존 ai-trader는 중복" → /agents가 정식 허브, ai-trader는 추후 제거 검토(현재 유지).

### 완료된 작업
- `api_server/agent_perf.py` (신규) — 사이클 fill 기반 **FIFO 원장 순수함수** `compute_performance(cycles)` → 매매기록(이유 포함)/실현손익/보유포지션(평단). per-agent 격리 (Alpaca 1계좌여도 에이전트 자기 fill만 집계)
- `api_server/router_autopilot.py` — `GET /agents/{id}/performance`: 원장 + 현재가(`_latest_price`)로 미실현손익 보강 → {alloc, cash, invested, realized/unrealized/total_pnl, return_pct, open_positions[], trades[]}. `CyclePayload.fill` 필드 추가
- `autopilot/agent_loop.sh` — JSON 출력에 `fill:{side,qty,price}`(주문 집행 시) + note=매매이유
- `lib/api.ts` — AgentPerformance/AgentTrade/AgentOpenPosition + `getAgentPerformance()`
- `app/agents/page.tsx` — 우측 **대시보드/사이클 탭**. 대시보드: 총손익·수익률·실현·미실현 카드, 배정자본·현금·투자중, 보유포지션 테이블(실시간 미실현), 매매기록(매수/매도 이유 💡 + 실현손익). **5초 폴링 실시간 PnL**

### 검증
- 백엔드: 383 passed / 4 pre-existing. 신규 +10 (agent_perf 7, agent_performance_api 3)
- 프론트: tsc clean, 184/184, 빌드 OK
- ⚠️ 실행 중 서버는 재시작해야 신규 엔드포인트 반영됨

### 참고
- 기존 Task 5(client_order_id 태깅) 대신 **사이클 fill 원장**으로 per-agent 격리 달성 (더 단순·견고). Alpaca 실주문 태깅은 불필요해짐
- 데이트레이딩 5분 e2e 실가동 검증은 여전히 남음(Task 7)

---

## Phase 44 — 멀티 AI 트레이딩 에이전트 + UX 구조화 (2026-07-01) ✅ SHIPPED (Task 1~4,6)

계획: `docs/superpowers/plans/2026-07-01-multi-agent-trading.md`

### 진단 (확정)
- 매매 경로(order.sh→`/alpaca/order`) **정상**: 실서버에서 AAPL 1주 place→accept→cancel 검증 완료. Alpaca 안 변한 이유 = 에이전트 게이트(`macro≥5 AND STRONG_BUY`)가 한 번도 안 열림 + 유니버스 AAPL만.
- UX 문제 = `claude --print` 원본 stdout을 tmux 페인 통째 폴링/덤프. "한 문장만" 무시됨.

### 완료된 작업
- `api_server/agent_store.py` (신규) — SQLite 에이전트 레지스트리 + 구조화 사이클 스토어. `AGENT_PROFILES`(swing 8h/score≥18, daytrade 5m/score≥22/EOD청산), CRUD, `record_cycle`(decision enum 검증)/`read_cycles`. AGENT_DB_PATH env(기본 data/agents.db)
- `api_server/router_autopilot.py` — `agents_router`: `GET/POST /agents`, `GET/DELETE /agents/{id}`, `POST /agents/{id}/start|stop`(tmux 세션 `seokminal-agent-{id}` 생성/킬), `GET/POST /agents/{id}/cycles`
- `api_server/main.py` — agents_router 등록
- `autopilot/agent_loop.sh` — **파라미터화**(`agent_loop.sh <id> <profile>`), 프로파일별 cadence/유니버스/게이트, Claude가 **JSON 한 줄** 출력→파싱→`POST /agents/{id}/cycles` 기록, 유니버스 확장(top 8~15), 게이트 재조정(score≥threshold)
- `lib/api.ts` — TradingAgent/AgentCycle 인터페이스 + listAgents/createAgent/start/stop/delete/getAgentCycles
- `app/agents/page.tsx` (신규) — 에이전트 목록(생성폼/타입뱃지/시작·정지·삭제) + 선택 에이전트의 **구조화 사이클 카드**(decision 색상뱃지, score/40 바, action, 트리거, 현금%). 원본 stdout 덤프 없음
- `components/NavBar.tsx` + `lib/i18n-utils.ts` — "AI 에이전트" 메뉴 + page.agents i18n

### 검증
- 백엔드: 373 passed / 4 pre-existing. 신규 +17 (agent_store 11, agents_api 6)
- 실서버 e2e: 에이전트 생성→BUY 사이클 기록→구조화 조회→삭제 전부 정상
- 프론트: tsc clean, 184/184, 빌드 성공 (`/agents` 라우트 생성)

### 남은 작업 (다음 세션)
- **Task 5 가상 계좌 분리**: 주문에 `client_order_id=agent_{id}_{cycle}` 태깅 → agent별 주문/포지션 필터, `GET /agents/{id}/account`. (현재 order.sh는 태깅 안 함 — agent_loop.sh order 호출에 태그 전달 + alpaca place_order에 client_order_id 지원 필요)
- **Task 7 데이트레이딩 e2e 검증**: 5분 사이클 실제 가동 + EOD 청산 로직 확인
- ai-trader 기존 페이지(610줄, tmux 덤프)는 유지됨 — 추후 /agents로 완전 대체 검토

---

## Phase 43 — 실매매 안전화 (Live Trading Hardening) (2026-07-01) ✅ SHIPPED

계획: `docs/superpowers/plans/2026-07-01-live-trading-hardening.md`. 감사에서 나온 CRITICAL 4 + IMPORTANT + UPGRADE 구현.

### 완료된 작업 (Backend)
- `live_engine/risk_guard.py` (신규) — 공통 pre-trade 리스크 가드: `RiskConfig`(env: MAX_ORDER_QTY/MAX_ORDER_NOTIONAL/MAX_POSITION_QTY/DAILY_LOSS_LIMIT/TRADING_KILL_SWITCH), `validate_order()`(수량>0·최대수량·notional·일일손실·킬스위치, 포지션 축소는 캡 면제), `DailyPnLTracker`
- `api_server/main.py` — `_check_risk()` 헬퍼를 US/KR/HL 주문 전 호출(위반 시 422), `quantity/size: Field(gt=0)`, `GET /trading/mode`(paper/live + 리스크 스냅샷), `GET /orders/audit`
- `api_server/order_audit.py` (신규) — append-only JSONL 주문 감사 로그(`record_order`/`read_recent`), 모든 주문 경로에서 기록
- `live_engine/engine.py` — **포지션 desync 버그 수정(#1):** `_target_units`/`_order_for_target` 순수 헬퍼 — 반전 시 2×trade_size 주문(청산+신규)으로 엔진 포지션이 실제와 일치, 체결가(`avg_fill_price`) 우선 PnL(#4), 시작 시 `_reconcile_position`으로 브로커 실포지션 시드(#6)
- `live_engine/broker_interface.py` — `OrderResult.avg_fill_price`, `BrokerInterface.get_position`(기본 None)
- `live_engine/ib_broker.py` — `get_position` IB `positions()` 기반 구현

### 완료된 작업 (Frontend)
- `lib/api.ts` — `TradingMode` 인터페이스 + `getTradingMode()`
- `app/orders/page.tsx` — paper/live 모드 배지 + 킬스위치 표시, **KR/US 주문 확인 모달(#5)** (live는 적색 경고), `requestPlaceOrder`(검증→모달)→`handlePlaceOrder`(실행)

### 검증
- 백엔드: 356 passed / 4 pre-existing (test_auth ×3, test_backtest_happy_path). 신규 테스트 +33 (risk_guard 12, order_risk 5, order_audit 4, trading_mode 3, live_engine_orders 9)
- 실서버 스모크: `/trading/mode` 정상, 과대 주문 → HTTP 422 "risk check failed" (브로커 도달 전 차단)
- 프론트: tsc clean, 184/184, 빌드 성공

### 남은 한계 (정직 고지)
- `avg_fill_price`: 브로커가 아직 체결 미포착 → None 반환, 엔진은 tick.price로 폴백 (실 체결가 반영하려면 IBOrderClient에 fill 대기 로직 추가 필요)
- KIS `get_position` 미구현(기본 None) → KR 봇은 reconciliation 없이 flat 시작
- IB 주문 매 요청 connect→disconnect(#8) 미해결 — 레이턴시/멱등성(#7)은 후속

---

## Phase 42 — IB WebSocket 실시간 (2026-07-01) ✅ SHIPPED

### 완료된 작업
- `backends/ib/client.py` — `stream_trades(symbol, connect_timeout=4.0)`: connectAsync에 timeout 전달 (TWS 미연결 시 무한 대기 방지)
- `api_server/main.py` — `@app.websocket("/ws/ib/live/{symbol}")`: KIS WS 패턴 미러, `_serialize_ib_tick()` (TickByTickAllLast → JSON), 랜덤 client_id(900~999)로 동시 구독, `errorEvent` 후킹하여 fatal IB 코드(354/162/200/504/10167/10168/10197)를 클라이언트로 릴레이 (시세 구독 없으면 틱 안 와서 무한 대기하던 문제 해결), asyncio.wait로 tick/error 레이스
- `lib/api.ts` — `IBTick` 인터페이스 + `WS_URL` export (API_URL → ws:// 변환)
- `lib/i18n-utils.ts` — `ib.live.connected/connecting/offline/waiting_tick` 키 추가
- `components/live/IbRealtimeWidget.tsx` — 플레이스홀더 → 실제 WS: AAPL/SPY/QQQ 종목별 WS 연결, 가격 ▲/▼ 색상, 체결량 표시, 동적 상태 배지(실시간/연결 중/오프라인), unmount 시 소켓 정리
- `tests/test_ib_client.py` — FakeIB.connectAsync에 timeout kwarg 추가
- `tests/lib/i18n.test.ts` — stale `nav.research` → `nav.market` (pre-existing 실패 수정)

### 검증
- 실제 TWS(127.0.0.1:7497) 연결 확인 → 0.6초 만에 Error 354(시세 미구독) 릴레이 후 close (무한 대기 없음)
- 백엔드: 323 passed / 4 pre-existing 실패 (test_auth ×3, test_backtest_happy_path)
- 프론트: tsc clean, 184/184 통과, 프로덕션 빌드 성공

### 참고 (별개 작업)
- `TradingAgents/` — Groq/Gemini 무료 전환 시도 → Groq 무료 TPM 6000 한도로 멀티에이전트 불가 확인 → OpenRouter(deepseek)로 원복. 로드맵 "미해결 이슈" 3개(CorrelationNetwork D3, ai-trader 플레이스홀더, quant 레거시 스타일)는 검증 결과 전부 stale(이미 해결/위반없음)

---

## Phase 41 — Groq 요약 + UX 정비 (2026-06-30) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `POST /groq/summarize` (mode=news|calendar), 매크로 전략가 프롬프트(· 항목 형식, 마크다운 금지), `STOCKS: TICKER↑/↓` 라인 파싱 → `picks[]` 반환
- `components/GroqSummaryPanel.tsx` (신규) — AI 분석 버튼, 상승/하락 키워드 색상, localStorage 캐시(mode별, 페이지 이동해도 유지), 종목 카드(차트 바로가기 `/market?symbol=X.NASDAQ`)
- `lib/api.ts` — `getGroqSummary()`, GroqStockPick/GroqSummaryResult
- `app/news/page.tsx` + `app/calendar/page.tsx` — 2컬럼 레이아웃 + 우측 요약 패널
- `components/news/NewsPanel.tsx` — `onHeadlinesLoaded` 콜백
- `app/forex/page.tsx` — Live Rates 탭(12쌍 히트맵, 60초 갱신, `/forex/overview`)
- `app/crypto/page.tsx` — 주식 페이지식 재구성: 검색/워크스페이스(차트+북)/통계 탭, 워치리스트 사이드바(localStorage), Markets/Chart/Book 탭 제거
- `app/insider/page.tsx` — US 자동 Recent 로드, KR 기업행위(무상/유상/소각) 분류 + DART 원문 링크
- `app/market/page.tsx` + `MarketWorkspace.tsx` — p-6 제거, 높이 100vh-96px (꽉 찬 레이아웃)
- `app/workflow/page.tsx` — 가로 진행 스테퍼 + 진행률 바 + 세로 타임라인 커넥터
- `autopilot/agent_loop.sh` — sleep 30분→4시간(장중)/2시간(장외), Claude 출력 한 문장 강제(헤더/표/이모지 금지)

### 미완료 (외부 의존성/거대 범위)
- IB WebSocket 실시간 (TWS 게이트웨이 필요)
- LangGraph 멀티에이전트 자율주문 (새 백엔드 인프라)

---

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
