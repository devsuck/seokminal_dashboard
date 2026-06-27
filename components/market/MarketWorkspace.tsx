"use client";

import { useEffect, useState } from "react";
import { WatchlistSidebar } from "@/components/market/WatchlistSidebar";
import { ChartTab } from "@/components/market/ChartTab";
import { ComparisonTab } from "@/components/market/ComparisonTab";
import { EventsTab } from "@/components/market/EventsTab";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  DEFAULT_SYMBOLS,
} from "@/lib/watchlist-storage";

type Tab = "chart" | "compare" | "events";

const TABS: { id: Tab; label: string }[] = [
  { id: "chart",   label: "Chart" },
  { id: "compare", label: "Compare" },
  { id: "events",  label: "Events" },
];

export function MarketWorkspace() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_SYMBOLS);
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOLS[0]);
  const [activeTab, setActiveTab] = useState<Tab>("chart");

  useEffect(() => {
    const list = getWatchlist();
    setWatchlist(list);
    setActiveSymbol(list[0] ?? DEFAULT_SYMBOLS[0]);
  }, []);

  function handleSymbolSelect(symbol: string) {
    setActiveSymbol(symbol);
    setActiveTab("chart");
  }

  function handleAdd(symbol: string) {
    addToWatchlist(symbol);
    setWatchlist(getWatchlist());
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
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Left: Watchlist sidebar */}
      <WatchlistSidebar
        symbols={watchlist}
        activeSymbol={activeSymbol}
        onSymbolSelect={handleSymbolSelect}
        onCompare={() => setActiveTab("compare")}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />

      {/* Right: Tab header + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab navigation */}
        <div className="flex items-center border-b border-border px-4 bg-panel shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-text-3 hover:text-text-1"
              }`}
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
          {activeTab === "chart"   && <ChartTab symbol={activeSymbol} />}
          {activeTab === "compare" && <ComparisonTab symbols={watchlist} />}
          {activeTab === "events"  && <EventsTab />}
        </div>
      </div>
    </div>
  );
}
