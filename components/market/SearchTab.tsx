"use client";

import { useRef, useState } from "react";
import {
  ApiError, searchKR, searchUS,
  type KRSearchResult, type USSearchResult,
} from "@/lib/api";

interface SearchTabProps {
  onGoToChart: (instrumentId: string) => void;
}

type Venue = "KR" | "US";

function krToInstrumentId(code: string): string {
  const bare = code.replace(/\.\w+$/, "");
  return `${bare}.XKRX`;
}

function usToInstrumentId(symbol: string, exchange: string): string {
  const ex = exchange.toUpperCase();
  const venueMap: Record<string, string> = {
    NASDAQ: "NASDAQ", NYSE: "NYSE", ARCA: "ARCA", BATS: "BATS",
  };
  return `${symbol.toUpperCase()}.${venueMap[ex] ?? ex}`;
}

export function SearchTab({ onGoToChart }: SearchTabProps) {
  const [venue, setVenue]           = useState<Venue>("KR");
  const [query, setQuery]           = useState("");
  const [krResults, setKrResults]   = useState<KRSearchResult[]>([]);
  const [usResults, setUsResults]   = useState<USSearchResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [searched, setSearched]     = useState(false);
  const abortRef                    = useRef<AbortController | null>(null);

  async function run(q = query) {
    if (!q.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null); setSearched(false);
    try {
      if (venue === "KR") {
        const res = await searchKR(q.trim(), ctrl.signal);
        setKrResults(res.results);
        setUsResults([]);
      } else {
        const res = await searchUS(q.trim(), ctrl.signal);
        setUsResults(res.results);
        setKrResults([]);
      }
      setSearched(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") run();
  }

  const hasResults = krResults.length > 0 || usResults.length > 0;

  return (
    <div className="p-4 flex flex-col gap-3 h-full overflow-y-auto">
      {/* Search bar */}
      <div className="flex gap-2 items-center">
        {/* KR / US toggle */}
        <div className="flex border border-border rounded overflow-hidden shrink-0">
          {(["KR", "US"] as Venue[]).map(v => (
            <button
              key={v}
              onClick={() => { setVenue(v); setKrResults([]); setUsResults([]); setSearched(false); }}
              className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border-0 transition-colors ${
                venue === v ? "bg-accent text-black" : "bg-panel text-text-3 hover:text-text-1"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder={venue === "KR" ? "종목명 또는 코드 (삼성, 005930)" : "Symbol or name (AAPL, Apple)"}
          className="flex-1 h-8 px-3 text-sm bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
          autoFocus
        />

        <button
          onClick={() => run()}
          disabled={loading || !query.trim()}
          className="h-8 px-4 text-xs font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-50 shrink-0"
        >
          {loading ? "…" : "검색"}
        </button>
      </div>

      {error && <p className="text-neg text-xs">{error}</p>}

      {/* Results */}
      {!hasResults && !loading && !searched && (
        <div className="text-center py-12 text-text-3 text-sm">
          종목명이나 코드를 입력하고 검색하세요
        </div>
      )}
      {!hasResults && searched && !loading && (
        <div className="text-center py-12 text-text-3 text-sm">검색 결과 없음</div>
      )}

      {/* KR results */}
      {krResults.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-panel-2 border-b border-border text-[10px] uppercase tracking-wider text-text-3">
            한국 종목 · {krResults.length}건
          </div>
          <div className="divide-y divide-border/40">
            {krResults.map(r => {
              const instrId = krToInstrumentId(r.code);
              return (
                <div key={r.code} className="flex items-center px-3 py-2 hover:bg-panel-2 group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-1 font-medium truncate block">{r.name}</span>
                    <span className="text-[11px] text-text-3 font-data">{r.code} · {r.market}</span>
                  </div>
                  <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-text-3 self-center font-data">{instrId}</span>
                    <button
                      onClick={() => onGoToChart(instrId)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0 shrink-0"
                    >
                      차트 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* US results */}
      {usResults.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-panel-2 border-b border-border text-[10px] uppercase tracking-wider text-text-3">
            미국 종목 · {usResults.length}건
          </div>
          <div className="divide-y divide-border/40">
            {usResults.map(r => {
              const instrId = usToInstrumentId(r.symbol, r.exchange);
              return (
                <div key={`${r.symbol}-${r.exchange}`} className="flex items-center px-3 py-2 hover:bg-panel-2 group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-1 font-medium truncate block">{r.name}</span>
                    <span className="text-[11px] text-text-3 font-data">{r.symbol} · {r.exchange} · {r.sec_type}</span>
                  </div>
                  <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-text-3 self-center font-data">{instrId}</span>
                    <button
                      onClick={() => onGoToChart(instrId)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0 shrink-0"
                    >
                      차트 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
