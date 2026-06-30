# Phase 29: i18n + Page Descriptions + IB Live Placeholder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Korean/English/German language switching, educational page description banners on all active pages, and an IB real-time placeholder widget on the dashboard.

**Architecture:** A React context (`LanguageContext`) holds the current language (persisted to localStorage, default `"ko"`). A `useLanguage()` hook provides `{ lang, setLang, t }` where `t(key)` returns translated string. `PageBanner` reads the current pathname and looks up title+description from the translation map. The IB widget is a static placeholder component on the dashboard.

**Tech Stack:** Next.js 14, React context, Vitest for unit tests

## Global Constraints

- Design tokens only: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black` for primary action buttons only
- Active tab: `border-accent text-accent bg-accent/10`
- No `style={{}}` (exception: `style={{ height: "Npx" }}` for chart containers)
- No hex color classNames (exception: D3 `.attr()`, legend swatch `style={{ backgroundColor }}`)
- No raw `fetch` — use `lib/api.ts` functions
- `"use client"` on all components using hooks/context
- Working directory: `seokminal-dashboard/`
- Tests: `vitest` in `tests/` directory
- Commit to `main` directly

---

### Task 1: i18n context + LanguageSwitcher + NavBar integration

**Files:**
- Create: `lib/i18n.tsx`
- Create: `components/LanguageSwitcher.tsx`
- Modify: `components/NavBar.tsx`
- Modify: `app/layout.tsx`
- Create: `tests/lib/i18n.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = "ko" | "en" | "de"`
  - `type Translations = Record<string, Record<Lang, string>>`
  - `function useLanguage(): { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }`
  - `<LanguageProvider>` wraps the app in layout.tsx
  - `<LanguageSwitcher />` renders 3 buttons: 한 / EN / DE

- [ ] **Step 1: Write failing tests**

Create `tests/lib/i18n.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { getLangFromStorage, saveLangToStorage, getTranslation, TRANSLATIONS } from "../../lib/i18n";

beforeEach(() => localStorageMock.clear());

describe("getLangFromStorage", () => {
  it("returns ko when nothing stored", () => {
    expect(getLangFromStorage()).toBe("ko");
  });
  it("returns stored lang", () => {
    localStorageMock.setItem("seokminal_lang", "en");
    expect(getLangFromStorage()).toBe("en");
  });
  it("returns ko for unknown stored value", () => {
    localStorageMock.setItem("seokminal_lang", "fr");
    expect(getLangFromStorage()).toBe("ko");
  });
});

describe("saveLangToStorage", () => {
  it("saves lang to localStorage", () => {
    saveLangToStorage("de");
    expect(localStorageMock.getItem("seokminal_lang")).toBe("de");
  });
});

describe("getTranslation", () => {
  it("returns ko string for known key", () => {
    expect(getTranslation("nav.dashboard", "ko")).toBe(TRANSLATIONS["nav.dashboard"]["ko"]);
  });
  it("returns en string for known key", () => {
    expect(getTranslation("nav.research", "en")).toBe(TRANSLATIONS["nav.research"]["en"]);
  });
  it("returns key itself when key missing", () => {
    expect(getTranslation("nonexistent.key", "ko")).toBe("nonexistent.key");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- tests/lib/i18n.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `lib/i18n.tsx`**

```typescript
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Lang = "ko" | "en" | "de";
const VALID_LANGS: Lang[] = ["ko", "en", "de"];
const STORAGE_KEY = "seokminal_lang";

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

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ko",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    setLangState(getLangFromStorage());
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    saveLangToStorage(l);
  }

  const t = (key: string) => getTranslation(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/lib/i18n.test.ts
```
Expected: PASS (3 describe blocks, 7 tests)

- [ ] **Step 5: Create `components/LanguageSwitcher.tsx`**

```tsx
"use client";

import { useLanguage, type Lang } from "@/lib/i18n";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-0.5">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors duration-150 bg-transparent border-0 cursor-pointer ${
            lang === code
              ? "text-accent bg-accent/10"
              : "text-text-3 hover:text-text-1"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add LanguageProvider to `app/layout.tsx`**

Replace the current layout with:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NAUTILUS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg text-text-1 font-ui antialiased m-0">
        <LanguageProvider>
          <header className="h-12 border-b border-border bg-panel flex items-center px-6 gap-6 shrink-0">
            <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">
              NAUTILUS
            </span>
            <NavBar />
            <div className="ml-auto flex items-center gap-4">
              <LanguageSwitcher />
              <span className="text-xs text-text-3 font-data">
                {new Date().toISOString().slice(0, 10)}
              </span>
            </div>
          </header>
          <main className="min-h-[calc(100vh-48px)]">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/i18n.tsx components/LanguageSwitcher.tsx app/layout.tsx tests/lib/i18n.test.ts
git commit -m "feat: add i18n context (KO/EN/DE) and language switcher"
```

---

### Task 2: PageBanner component + add to all active pages

**Files:**
- Create: `components/PageBanner.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/market/page.tsx`
- Modify: `app/backtest/page.tsx`
- Modify: `app/backtest/compare/page.tsx`
- Modify: `app/backtest/heatmap/page.tsx`
- Modify: `app/risk/page.tsx`
- Modify: `app/orders/page.tsx`
- Modify: `app/bots/page.tsx`
- Modify: `app/alerts/page.tsx`
- Modify: `app/ai-trader/page.tsx`
- Modify: `app/ib/page.tsx`
- Modify: `app/correlation/page.tsx`
- Modify: `app/portfolio/page.tsx`
- Modify: `app/crypto/page.tsx`
- Modify: `app/options/page.tsx`
- Modify: `app/futures/page.tsx`
- Modify: `app/forex/page.tsx`
- Modify: `app/search/page.tsx`
- Modify: `app/spawner/page.tsx`
- Modify: `app/rolling/page.tsx`
- Modify: `app/experiments/page.tsx`

**Interfaces:**
- Consumes: `useLanguage()` from `lib/i18n`
- Produces: `<PageBanner pageKey="dashboard" />` — renders title + description in current language

The `pageKey` maps to `page.{pageKey}.title` and `page.{pageKey}.desc` in TRANSLATIONS.

- [ ] **Step 1: Create `components/PageBanner.tsx`**

```tsx
"use client";

import { useLanguage } from "@/lib/i18n";

interface PageBannerProps {
  pageKey: string;
}

export function PageBanner({ pageKey }: PageBannerProps) {
  const { t } = useLanguage();
  const title = t(`page.${pageKey}.title`);
  const desc = t(`page.${pageKey}.desc`);

  // If no translation found, render nothing
  if (title === `page.${pageKey}.title`) return null;

  return (
    <div className="mb-4">
      <h1 className="text-text-1 text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-text-3 text-sm mt-0.5">{desc}</p>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/dashboard/page.tsx`**

Replace the hard-coded title block with `<PageBanner pageKey="dashboard" />`:

```tsx
"use client";

import { MarketOverviewWidget }    from "@/components/dashboard/MarketOverviewWidget";
import { SystemStatusWidget }      from "@/components/dashboard/SystemStatusWidget";
import { TodayEventsWidget }       from "@/components/dashboard/TodayEventsWidget";
import { ResearchActivityWidget }  from "@/components/dashboard/ResearchActivityWidget";
import { PortfolioSnapshotWidget } from "@/components/dashboard/PortfolioSnapshotWidget";
import { PageBanner } from "@/components/PageBanner";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <PageBanner pageKey="dashboard" />

      {/* Row 1: Market Overview + System Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MarketOverviewWidget />
        </div>
        <SystemStatusWidget />
      </div>

      {/* Row 2: Today's Events + Research Activity + Portfolio Snapshot */}
      <div className="grid grid-cols-3 gap-4">
        <TodayEventsWidget />
        <ResearchActivityWidget />
        <PortfolioSnapshotWidget />
      </div>
    </div>
  );
}
```

Note: dashboard/page.tsx is currently a server component. Adding `"use client"` is required because `PageBanner` uses `useLanguage()`.

- [ ] **Step 3: Add `<PageBanner>` to remaining pages**

For each page listed below, add `import { PageBanner } from "@/components/PageBanner";` and insert `<PageBanner pageKey="..." />` as the first child of the top-level container div (before any existing `<h1>` or title elements — remove existing title divs to avoid duplication).

Pages and their `pageKey` values:
- `app/market/page.tsx` → `pageKey="market"`
- `app/backtest/page.tsx` → `pageKey="backtest"` (insert before the first `<div>` content block)
- `app/backtest/compare/page.tsx` → `pageKey="compare"`
- `app/backtest/heatmap/page.tsx` → `pageKey="heatmap"`
- `app/risk/page.tsx` → `pageKey="risk"`
- `app/orders/page.tsx` → `pageKey="orders"`
- `app/bots/page.tsx` → `pageKey="bots"`
- `app/alerts/page.tsx` → `pageKey="alerts"`
- `app/ai-trader/page.tsx` → `pageKey="ai-trader"`
- `app/ib/page.tsx` → `pageKey="ib"`
- `app/correlation/page.tsx` → `pageKey="correlation"`
- `app/portfolio/page.tsx` → `pageKey="portfolio"`
- `app/crypto/page.tsx` → `pageKey="crypto"`
- `app/options/page.tsx` → `pageKey="options"`
- `app/futures/page.tsx` → `pageKey="futures"`
- `app/forex/page.tsx` → `pageKey="forex"`
- `app/search/page.tsx` → `pageKey="search"`
- `app/spawner/page.tsx` → `pageKey="spawner"`
- `app/rolling/page.tsx` → `pageKey="rolling"`
- `app/experiments/page.tsx` → `pageKey="experiments"`

For each page that is already `"use client"`, just add the import and component. For any server components (no `"use client"` at top), add `"use client"` directive first.

After reading each page, find the outermost container (typically `<div className="p-6 ...">` or similar) and insert `<PageBanner pageKey="..." />` as its first child. Remove any existing `<h1>` + `<p>` title block to avoid duplication.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Run frontend tests**

```bash
npm test
```
Expected: all existing tests still pass (177+)

- [ ] **Step 6: Commit**

```bash
git add components/PageBanner.tsx app/dashboard/page.tsx app/market/page.tsx app/backtest/page.tsx app/backtest/compare/page.tsx app/backtest/heatmap/page.tsx app/risk/page.tsx app/orders/page.tsx app/bots/page.tsx app/alerts/page.tsx app/ai-trader/page.tsx app/ib/page.tsx app/correlation/page.tsx app/portfolio/page.tsx app/crypto/page.tsx app/options/page.tsx app/futures/page.tsx app/forex/page.tsx app/search/page.tsx app/spawner/page.tsx app/rolling/page.tsx app/experiments/page.tsx
git commit -m "feat: add PageBanner with translated descriptions to all active pages"
```

---

### Task 3: IB Real-time placeholder widget on dashboard

**Files:**
- Create: `components/live/IbRealtimeWidget.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useLanguage()` from `lib/i18n` (for `ib.live.*` keys)
- Produces: `<IbRealtimeWidget />` — static placeholder, no props

- [ ] **Step 1: Create `components/live/IbRealtimeWidget.tsx`**

```tsx
"use client";

import { useLanguage } from "@/lib/i18n";

export function IbRealtimeWidget() {
  const { t } = useLanguage();

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          {t("ib.live.title")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse shrink-0" />
          <span className="text-warn text-[11px] font-data">{t("ib.live.status")}</span>
        </div>
      </div>

      <p className="text-text-3 text-xs mb-4">{t("ib.live.desc")}</p>

      {/* Placeholder ticker row */}
      <div className="space-y-2 mb-4">
        {["AAPL", "SPY", "QQQ"].map(ticker => (
          <div key={ticker} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <span className="text-text-2 text-xs font-data">{ticker}</span>
            <div className="flex items-center gap-3">
              <div className="w-16 h-3 bg-panel-2 rounded animate-pulse" />
              <div className="w-10 h-3 bg-panel-2 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder mini chart */}
      <div className="w-full bg-panel-2 rounded flex items-center justify-center" style={{ height: "64px" }}>
        <span className="text-text-3 text-[11px]">{t("ib.live.coming_soon")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `IbRealtimeWidget` to `app/dashboard/page.tsx` between Row 1 and Row 2**

```tsx
"use client";

import { MarketOverviewWidget }    from "@/components/dashboard/MarketOverviewWidget";
import { SystemStatusWidget }      from "@/components/dashboard/SystemStatusWidget";
import { TodayEventsWidget }       from "@/components/dashboard/TodayEventsWidget";
import { ResearchActivityWidget }  from "@/components/dashboard/ResearchActivityWidget";
import { PortfolioSnapshotWidget } from "@/components/dashboard/PortfolioSnapshotWidget";
import { IbRealtimeWidget }        from "@/components/live/IbRealtimeWidget";
import { PageBanner }              from "@/components/PageBanner";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <PageBanner pageKey="dashboard" />

      {/* Row 1: Market Overview + System Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MarketOverviewWidget />
        </div>
        <SystemStatusWidget />
      </div>

      {/* IB Real-time placeholder */}
      <IbRealtimeWidget />

      {/* Row 2: Today's Events + Research Activity + Portfolio Snapshot */}
      <div className="grid grid-cols-3 gap-4">
        <TodayEventsWidget />
        <ResearchActivityWidget />
        <PortfolioSnapshotWidget />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add components/live/IbRealtimeWidget.tsx app/dashboard/page.tsx
git commit -m "feat: add IB real-time placeholder widget to dashboard"
```
