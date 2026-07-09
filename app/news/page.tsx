"use client";

import { useRef, useState } from "react";
import { NewsPanel } from "@/components/news/NewsPanel";
import { GroqSummaryPanel } from "@/components/GroqSummaryPanel";
import { Panel } from "@/components/ui/Panel";

const CATEGORIES = ["general", "forex", "crypto", "merger"] as const;

export default function NewsPage() {
  const [category, setCategory] = useState<string>("general");
  const [tickerInput, setTickerInput] = useState("");
  const [activeTicker, setActiveTicker] = useState<string | undefined>();
  const headlinesRef = useRef<string[]>([]);

  function handleTickerSearch() {
    const t = tickerInput.trim().toUpperCase();
    setActiveTicker(t || undefined);
  }

  function getContent(): string {
    return headlinesRef.current.join("\n");
  }

  return (
    <div className="p-4 max-w-[1200px]">
      <div className="flex gap-4 items-start">
        {/* Left: news */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="text-text-1 text-lg font-semibold">Market News</h1>
            <p className="text-text-3 text-xs mt-0.5">Finnhub · 15분 캐시 · 무료 티어 (60 req/min)</p>
          </div>

          {/* Controls */}
          <Panel className="flex flex-wrap gap-2 items-center px-4 py-3">
            <div className="flex gap-0.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setActiveTicker(undefined); setTickerInput(""); }}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    !activeTicker && category === c
                      ? "bg-accent text-black": "text-text-3 hover:text-text-1 border border-border"}`}
                >
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            <div className="flex gap-1.5 items-center">
              <input
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleTickerSearch()}
                placeholder="종목 뉴스: AAPL…"className="bg-bg border border-border rounded px-3 py-1 text-text-1 text-xs w-32 focus:border-accent outline-none"/>
              <button
                onClick={handleTickerSearch}
                className="bg-accent text-black text-xs px-3 py-1 rounded font-medium hover:opacity-90">
                조회
              </button>
              {activeTicker && (
                <button
                  onClick={() => { setActiveTicker(undefined); setTickerInput(""); }}
                  className="text-text-3 text-xs hover:text-text-1">
                  ✕ 전체
                </button>
              )}
            </div>
          </Panel>

          {/* News list */}
          <Panel className="p-4 min-h-[400px]">
            <NewsPanel
              key={activeTicker ?? category}
              ticker={activeTicker}
              maxItems={30}
              onHeadlinesLoaded={(headlines) => { headlinesRef.current = headlines; }}
            />
          </Panel>
        </div>

        {/* Right: Groq summary */}
        <div className="pt-9">
          <GroqSummaryPanel mode="news" getContent={getContent} />
        </div>
      </div>
    </div>
  );
}
