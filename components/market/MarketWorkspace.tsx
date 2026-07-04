"use client";

import { useEffect, useState } from "react";
import { WatchlistSidebar } from "@/components/market/WatchlistSidebar";
import { ChartTab } from "@/components/market/ChartTab";
import { ComparisonTab } from "@/components/market/ComparisonTab";
import { SearchTab } from "@/components/market/SearchTab";
import { TradeTab } from "@/components/market/TradeTab";
import { AlertTab } from "@/components/market/AlertTab";
import { IndicatorTab } from "@/components/market/IndicatorTab";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  DEFAULT_SYMBOLS,
} from "@/lib/watchlist-storage";
import { DEFAULT_INDICATORS, activeIndicatorCount, type IndicatorState } from "@/lib/indicators";

type Tab = "chart" | "compare" | "search";
type Side = "trade" | "alert" | "indicators";

const TABS: { id: Tab; label: string }[] = [
  { id: "search",  label: "검색" },
  { id: "chart",   label: "Chart" },
  { id: "compare", label: "Compare" },
];

export function MarketWorkspace({ initialSymbol }: { initialSymbol?: string }) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_SYMBOLS);
  const [activeSymbol, setActiveSymbol] = useState(initialSymbol ?? DEFAULT_SYMBOLS[0]);
  const [activeTab, setActiveTab] = useState<Tab>("chart");
  const [side, setSide] = useState<Side>("trade");
  const [sideOpen, setSideOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);

  useEffect(() => {
    const list = getWatchlist();
    if (initialSymbol) {
      if (!list.includes(initialSymbol)) {
        addToWatchlist(initialSymbol);
        setWatchlist(getWatchlist());
      } else {
        setWatchlist(list);
      }
      setActiveSymbol(initialSymbol);
    } else {
      setWatchlist(list);
      setActiveSymbol(list[0] ?? DEFAULT_SYMBOLS[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSymbolSelect(symbol: string) {
    setActiveSymbol(symbol);
    setActiveTab("chart");
  }

  function handleAdd(symbol: string) {
    addToWatchlist(symbol);
    setWatchlist(getWatchlist());
  }

  function handleGoToChart(symbol: string) {
    addToWatchlist(symbol);
    setWatchlist(getWatchlist());
    setActiveSymbol(symbol);
    setActiveTab("chart");
  }

  function handleRemove(symbol: string) {
    removeFromWatchlist(symbol);
    const updated = getWatchlist();
    setWatchlist(updated);
    if (activeSymbol === symbol) {
      setActiveSymbol(updated[0] ?? DEFAULT_SYMBOLS[0]);
    }
  }

  return (
    <div className="flex h-[calc(100vh-96px)] overflow-hidden">
      {/* Left: Watchlist sidebar (열었다 닫기) */}
      {sideOpen && (
        <WatchlistSidebar
          symbols={watchlist}
          activeSymbol={activeSymbol}
          onSymbolSelect={handleSymbolSelect}
          onCompare={() => setActiveTab("compare")}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      )}

      {/* Right: Tab header + content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Tab navigation */}
        <div className="flex items-center border-b border-border px-4 bg-panel shrink-0">
          <button onClick={() => setSideOpen(o => !o)} title={sideOpen ? "워치리스트 접기" : "워치리스트 열기"}
            className="mr-2 w-7 h-7 flex items-center justify-center rounded text-text-3 hover:text-text-1 bg-transparent border-0 cursor-pointer">
            {sideOpen ? "◀" : "▶"}
          </button>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
                activeTab === tab.id
                  ? "border-accent text-accent": "border-transparent text-text-3 hover:text-text-1"}`}
            >
              {tab.label}
            </button>
          ))}
          {activeTab === "chart" && (
            <span className="ml-auto text-text-3 text-xs font-data">{activeSymbol}</span>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-bg">
          {activeTab === "search"&& <SearchTab onGoToChart={handleGoToChart} />}
          {activeTab === "chart"&& (
            <div className="flex h-full">
              {/* 차트 */}
              <div className="flex-1 overflow-y-auto min-w-0">
                <ChartTab
                  symbol={activeSymbol}
                  indicators={indicators}
                  setIndicators={setIndicators}
                  onAddToWatchlist={handleAdd}
                  isInWatchlist={watchlist.includes(activeSymbol)}
                />
              </div>
              {/* 우측: 매매 / 알림 (차트에서 바로, 접었다 펴기) */}
              {rightOpen ? (
                <div className="w-[340px] border-l border-border flex flex-col shrink-0">
                  <div className="flex items-center border-b border-border shrink-0">
                    {([["trade", " 매매"], ["alert", " 알림"], ["indicators", " 지표"]] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setSide(v)}
                        className={`flex-1 py-2.5 text-xs border-b-2 bg-transparent cursor-pointer transition-colors ${
                          side === v ? "border-accent text-accent" : "border-transparent text-text-3 hover:text-text-1"}`}>
                        {label}{v === "indicators" && activeIndicatorCount(indicators) > 0 ? ` ${activeIndicatorCount(indicators)}` : ""}
                      </button>
                    ))}
                    <button onClick={() => setRightOpen(false)} title="패널 접기"className="w-7 h-9 flex items-center justify-center text-text-3 hover:text-text-1 bg-transparent border-0 cursor-pointer shrink-0">▶</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {side === "trade" && <TradeTab symbol={activeSymbol} />}
                    {side === "alert" && <AlertTab symbol={activeSymbol} />}
                    {side === "indicators" && <IndicatorTab indicators={indicators} setIndicators={setIndicators} />}
                  </div>
                </div>
              ) : (
                <button onClick={() => setRightOpen(true)} title="패널 열기"className="w-10 border-l border-border shrink-0 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 bg-panel-2 cursor-pointer border-y-0 border-r-0">
                  <span className="text-sm">◀</span>
                  <span className="text-[11px]" style={{ writingMode: "vertical-rl" }}> 매매 ·  알림 ·  지표</span>
                </button>
              )}
            </div>
          )}
          {activeTab === "compare" && <ComparisonTab symbols={watchlist} />}
        </div>
      </div>
    </div>
  );
}
