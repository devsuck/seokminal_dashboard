export type Lang = "ko" | "en" | "de";
const VALID_LANGS: Lang[] = ["ko", "en", "de"];
export const STORAGE_KEY = "seokminal_lang";

export type Translations = Record<string, Record<Lang, string>>;

export const TRANSLATIONS: Translations = {
  // Nav groups
  "nav.dashboard":  { ko: "대시보드",   en: "Dashboard",  de: "Dashboard" },
  "nav.market":     { ko: "시장",       en: "Market",     de: "Markt" },
  "nav.workflow":   { ko: "워크플로우", en: "Workflow",   de: "Workflow" },
  "nav.research":   { ko: "리서치",     en: "Research",   de: "Forschung" },
  "nav.analyze":    { ko: "분석",       en: "Analyze",    de: "Analyse" },
  "nav.trade":      { ko: "트레이딩",   en: "Trade",      de: "Handel" },
  "nav.live":       { ko: "라이브",     en: "Live",       de: "Live" },

  // Nav items
  "nav.search":       { ko: "종목 검색",   en: "Search",      de: "Suche" },
  "nav.notebooks":    { ko: "노트북",      en: "Notebooks",   de: "Notizbücher" },
  "nav.strategies":   { ko: "전략",        en: "Strategies",  de: "Strategien" },
  "nav.experiments":  { ko: "실험",        en: "Experiments", de: "Experimente" },
  "nav.quant":        { ko: "퀀트",        en: "Quant",       de: "Quant" },
  "nav.options":      { ko: "옵션",        en: "Options",     de: "Optionen" },
  "nav.futures":      { ko: "선물",        en: "Futures",     de: "Futures" },
  "nav.forex":        { ko: "외환",        en: "Forex",       de: "Devisen" },
  "nav.crypto":       { ko: "암호화폐",    en: "Crypto",      de: "Krypto" },
  "nav.ib":           { ko: "IB 데이터",   en: "IB Data",     de: "IB Daten" },
  "nav.report":       { ko: "리포트",      en: "Report",      de: "Bericht" },
  "nav.correlation":  { ko: "상관관계",    en: "Correlation", de: "Korrelation" },
  "nav.event-study":  { ko: "이벤트 분석", en: "Event Study", de: "Ereignisstudie" },
  "nav.rolling":      { ko: "롤링",        en: "Rolling",     de: "Rollend" },
  "nav.factor":       { ko: "팩터",        en: "Factor",      de: "Faktor" },
  "nav.insider":      { ko: "내부자 거래", en: "Insider",     de: "Insider" },
  "nav.risk":         { ko: "리스크",      en: "Risk",        de: "Risiko" },
  "nav.data-quality": { ko: "데이터 품질", en: "Data Quality",de: "Datenqualität" },
  "nav.backtest":     { ko: "백테스트",    en: "Backtest",    de: "Backtest" },
  "nav.compare":      { ko: "결과 비교",   en: "Compare",     de: "Vergleich" },
  "nav.replay":       { ko: "리플레이",    en: "Replay",      de: "Wiedergabe" },
  "nav.portfolio":    { ko: "포트폴리오",  en: "Portfolio",   de: "Portfolio" },
  "nav.universe":     { ko: "유니버스",    en: "Universe",    de: "Universum" },
  "nav.spawner":      { ko: "스포너",      en: "Spawner",     de: "Spawner" },
  "nav.bots":         { ko: "봇",          en: "Bots",        de: "Bots" },
  "nav.orders":       { ko: "주문",        en: "Orders",      de: "Aufträge" },
  "nav.alerts":       { ko: "알림",        en: "Alerts",      de: "Alarme" },
  "nav.ai-trader":    { ko: "AI 트레이더", en: "AI Trader",   de: "KI-Händler" },

  // Page banners — title
  "page.dashboard.title":       { ko: "대시보드",       en: "Dashboard",       de: "Dashboard" },
  "page.market.title":          { ko: "시장 데이터",    en: "Market Data",     de: "Marktdaten" },
  "page.backtest.title":        { ko: "백테스트",       en: "Backtest",        de: "Backtest" },
  "page.compare.title":         { ko: "결과 비교",      en: "Compare Results", de: "Ergebnisse vergleichen" },
  "page.heatmap.title":         { ko: "히트맵",         en: "Heatmap",         de: "Heatmap" },
  "page.risk.title":            { ko: "리스크 관리",    en: "Risk",            de: "Risiko" },
  "page.orders.title":          { ko: "주문 관리",      en: "Orders",          de: "Aufträge" },
  "page.bots.title":            { ko: "트레이딩 봇",    en: "Bots",            de: "Bots" },
  "page.alerts.title":          { ko: "알림 설정",      en: "Alerts",          de: "Alarme" },
  "page.ai-trader.title":       { ko: "AI 전략 추천",   en: "AI Trader",       de: "KI-Händler" },
  "page.ib.title":              { ko: "IB 시장 데이터", en: "IB Market Data",  de: "IB Marktdaten" },
  "page.correlation.title":     { ko: "상관관계 분석",  en: "Correlation",     de: "Korrelation" },
  "page.portfolio.title":       { ko: "포트폴리오 최적화", en: "Portfolio",    de: "Portfolio" },
  "page.crypto.title":          { ko: "암호화폐",       en: "Crypto",          de: "Krypto" },
  "page.options.title":         { ko: "옵션 체인",      en: "Options",         de: "Optionen" },
  "page.futures.title":         { ko: "선물",           en: "Futures",         de: "Futures" },
  "page.forex.title":           { ko: "외환",           en: "Forex",           de: "Devisen" },
  "page.search.title":          { ko: "종목 검색",      en: "Search",          de: "Suche" },
  "page.spawner.title":         { ko: "전략 검증기",    en: "Spawner",         de: "Spawner" },
  "page.rolling.title":         { ko: "롤링 분석",      en: "Rolling",         de: "Rollend" },
  "page.experiments.title":     { ko: "실험실",         en: "Experiments",     de: "Experimente" },

  // Page banners — description
  "page.dashboard.desc": {
    ko: "시장 현황, 시스템 상태, 포트폴리오 스냅샷을 한눈에 확인합니다.",
    en: "Overview of market conditions, system health, and portfolio snapshot.",
    de: "Übersicht über Marktbedingungen, Systemstatus und Portfolio-Snapshot.",
  },
  "page.market.desc": {
    ko: "주식·ETF·지수의 실시간 및 일별 시세를 조회합니다.",
    en: "Browse real-time and daily price data for stocks, ETFs, and indices.",
    de: "Echtzeit- und Tagespreisdaten für Aktien, ETFs und Indizes.",
  },
  "page.backtest.desc": {
    ko: "과거 데이터로 트레이딩 전략을 시뮬레이션하여 성과를 검증합니다. EMA 크로스오버, MACD, RSI 전략을 지원합니다.",
    en: "Simulate a trading strategy on historical data to evaluate performance. Supports EMA crossover, MACD, and RSI strategies.",
    de: "Simulieren Sie eine Handelsstrategie auf historischen Daten. Unterstützt EMA-Crossover, MACD und RSI.",
  },
  "page.compare.desc": {
    ko: "저장된 백테스트 결과들을 나란히 비교하여 최적 전략을 선택합니다.",
    en: "Compare saved backtest results side by side to pick the best strategy.",
    de: "Vergleichen Sie gespeicherte Backtest-Ergebnisse nebeneinander.",
  },
  "page.heatmap.desc": {
    ko: "전략별 수익률을 파라미터 조합 히트맵으로 시각화합니다.",
    en: "Visualize strategy returns across parameter combinations as a heatmap.",
    de: "Visualisieren Sie Strategie-Renditen über Parameterkombinationen.",
  },
  "page.risk.desc": {
    ko: "포트폴리오의 VaR, 최대 낙폭, 샤프 비율 등 리스크 지표를 분석합니다.",
    en: "Analyze portfolio risk metrics: VaR, maximum drawdown, Sharpe ratio, and more.",
    de: "Analysieren Sie Portfolio-Risikokennzahlen: VaR, maximaler Drawdown, Sharpe-Ratio.",
  },
  "page.orders.desc": {
    ko: "한국투자증권(KIS)과 IB를 통해 실제 주문을 제출하고 관리합니다.",
    en: "Submit and manage live orders via KIS (Korea Investment) and Interactive Brokers.",
    de: "Übermitteln und verwalten Sie Live-Orders über KIS und Interactive Brokers.",
  },
  "page.bots.desc": {
    ko: "자동화된 트레이딩 봇의 상태를 모니터링하고 시작·중지합니다.",
    en: "Monitor automated trading bots, start or stop them, and track their P&L.",
    de: "Überwachen Sie automatisierte Handelsbots, starten oder stoppen Sie diese.",
  },
  "page.alerts.desc": {
    ko: "가격·기술적 지표 기반 알림 규칙을 설정하면 조건 충족 시 알림을 받습니다.",
    en: "Set alert rules based on price or technical indicators and receive notifications when triggered.",
    de: "Legen Sie Alarmregeln basierend auf Preis oder technischen Indikatoren fest.",
  },
  "page.ai-trader.desc": {
    ko: "AI(Groq LLM)가 시장 데이터를 분석하여 최적 트레이딩 전략과 파라미터를 추천합니다.",
    en: "AI (Groq LLM) analyzes market data and recommends the best trading strategy and parameters.",
    de: "KI (Groq LLM) analysiert Marktdaten und empfiehlt die beste Handelsstrategie.",
  },
  "page.ib.desc": {
    ko: "Interactive Brokers TWS를 통해 주식·선물·옵션의 히스토리컬 바 데이터를 조회합니다.",
    en: "Fetch historical bar data for stocks, futures, and options via Interactive Brokers TWS.",
    de: "Abrufen historischer Balkendaten für Aktien, Futures und Optionen über Interactive Brokers.",
  },
  "page.correlation.desc": {
    ko: "여러 자산 간의 수익률 상관계수를 계산하여 포트폴리오 분산 효과를 확인합니다.",
    en: "Calculate return correlations between assets to assess portfolio diversification.",
    de: "Berechnen Sie Renditekorrelationen zwischen Assets zur Portfolio-Diversifikation.",
  },
  "page.portfolio.desc": {
    ko: "평균-분산 최적화(마코위츠)로 최적 포트폴리오 가중치를 도출합니다.",
    en: "Derive optimal portfolio weights using mean-variance optimization (Markowitz).",
    de: "Ermitteln Sie optimale Portfolio-Gewichtungen mit Mittelwert-Varianz-Optimierung.",
  },
  "page.crypto.desc": {
    ko: "Hyperliquid 거래소의 암호화폐 자산 가격 및 오더북 데이터를 조회합니다.",
    en: "Browse crypto asset prices and order book data from the Hyperliquid exchange.",
    de: "Krypto-Asset-Preise und Orderbuchdaten von der Hyperliquid-Börse.",
  },
  "page.options.desc": {
    ko: "옵션 체인, 내재변동성 서피스, 그릭스(델타·감마·세타·베가)를 분석합니다.",
    en: "Analyze options chains, implied volatility surface, and Greeks (delta, gamma, theta, vega).",
    de: "Analysieren Sie Options-Chains, implizite Volatilitätsoberfläche und Greeks.",
  },
  "page.futures.desc": {
    ko: "선물 만기 캘린더, 롤 전략, 일별 정산가를 조회합니다.",
    en: "Browse futures expiry calendars, roll strategies, and daily settlement prices.",
    de: "Futures-Verfallskalender, Roll-Strategien und tägliche Abrechnungspreise.",
  },
  "page.forex.desc": {
    ko: "주요 통화쌍의 현물·선물환율, 이자율 차이를 분석합니다.",
    en: "Analyze spot and forward FX rates and interest rate differentials for major currency pairs.",
    de: "Analysieren Sie Spot- und Terminwechselkurse sowie Zinsdifferenzen.",
  },
  "page.search.desc": {
    ko: "종목 코드나 이름으로 국내외 주식을 검색합니다.",
    en: "Search domestic and international stocks by ticker or name.",
    de: "Suchen Sie in- und ausländische Aktien nach Ticker oder Name.",
  },
  "page.spawner.desc": {
    ko: "트레이딩 전략 코드를 검증하고 봇으로 배포하기 전 시뮬레이션합니다.",
    en: "Validate trading strategy code and simulate it before deploying as a bot.",
    de: "Validieren Sie Handelsstrategie-Code und simulieren Sie ihn vor dem Bot-Einsatz.",
  },
  "page.rolling.desc": {
    ko: "롤링 윈도우로 베타, 샤프 비율 등 시계열 지표의 변화를 추적합니다.",
    en: "Track how time-series metrics like beta and Sharpe ratio change over rolling windows.",
    de: "Verfolgen Sie, wie sich Zeitreihenkennzahlen wie Beta und Sharpe-Ratio in rollierenden Fenstern ändern.",
  },
  "page.experiments.desc": {
    ko: "전략 파라미터 실험을 기록하고 결과를 비교·관리합니다.",
    en: "Log strategy parameter experiments and compare results.",
    de: "Protokollieren Sie Strategie-Parameter-Experimente und vergleichen Sie Ergebnisse.",
  },

  // Insider trading
  "page.insider.title":         { ko: "내부자 거래 모니터",  en: "Insider Trades",  de: "Insiderhandel" },
  "page.insider.desc": {
    ko: "미국(SEC EDGAR Form 4)과 한국(OpenDART) 임원·주요주주의 공개시장 매수/매도 내역을 조회합니다. 내부자 거래는 합법적이며, 공시 의무가 있는 정보입니다.",
    en: "Track open-market buy/sell disclosures by corporate insiders for US (SEC EDGAR Form 4) and Korea (OpenDART). Insider trades are legal and publicly disclosed.",
    de: "Verfolgen Sie offizielle Kauf-/Verkaufsmeldungen von Unternehmensinsidern für US (SEC EDGAR) und Korea (OpenDART).",
  },

  // IB live widget
  "ib.live.title":       { ko: "IB 실시간",          en: "IB Live",          de: "IB Live" },
  "ib.live.status":      { ko: "연결 대기중",         en: "Awaiting Connection", de: "Verbindung ausstehend" },
  "ib.live.coming_soon": { ko: "준비 중 — 추후 활성화", en: "Coming soon — activate later", de: "Demnächst — später aktivieren" },
  "ib.live.desc":        { ko: "IB TWS 연결 시 실시간 호가·체결 스트림이 여기에 표시됩니다.", en: "When IB TWS is connected, real-time quotes and trade stream will appear here.", de: "Bei IB TWS-Verbindung werden hier Echtzeit-Kurse und Handels-Stream angezeigt." },
};

export function getLangFromStorage(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (VALID_LANGS as string[]).includes(v)) return v as Lang;
  } catch { /* SSR */ }
  return "ko";
}

export function saveLangToStorage(lang: Lang): void {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* SSR */ }
}

export function getTranslation(key: string, lang: Lang): string {
  return TRANSLATIONS[key]?.[lang] ?? key;
}
