"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBars } from "@/lib/api";
import { getSymbolName } from "@/lib/symbol-names";

interface SymbolPrice {
  close: number | null;
  changePct: number | null;
  loading: boolean;
}

interface WatchlistSidebarProps {
  symbols: string[];
  activeSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  onCompare: () => void;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function getRecentWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function WatchlistSidebar({
  symbols, activeSymbol, onSymbolSelect, onCompare, onAdd, onRemove,
}: WatchlistSidebarProps) {
  const [prices, setPrices] = useState<Record<string, SymbolPrice>>({});

  useEffect(() => {
    if (symbols.length === 0) return;
    let alive = true;
    const { start, end } = getRecentWindow();

    let toFetch: string[] = [];

    setPrices(prev => {
      const next: Record<string, SymbolPrice> = {};
      toFetch = [];
      for (const s of symbols) {
        if (prev[s] && !prev[s].loading) {
          next[s] = prev[s]; // already resolved — keep existing price
        } else {
          next[s] = { close: null, changePct: null, loading: true }; // new or pending — mark loading
          toFetch.push(s);
        }
      }
      return next;
    });

    queueMicrotask(() => {
      if (!alive) return;
      toFetch.forEach(async symbol => {
        try {
          const { bars } = await getBars(symbol, start, end);
          if (!alive) return;
          const last = bars[bars.length - 1] ?? null;
          const prevBar = bars[bars.length - 2] ?? null;
          const changePct = last && prevBar
            ? ((last.close - prevBar.close) / prevBar.close) * 100
            : null;
          setPrices(p => ({ ...p, [symbol]: { close: last?.close ?? null, changePct, loading: false } }));
        } catch {
          if (!alive) return;
          setPrices(p => ({ ...p, [symbol]: { close: null, changePct: null, loading: false } }));
        }
      });
    });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols]);

  return (
    <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-panel h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">Watchlist</span>
        <button
          onClick={onCompare}
          className="text-[10px] text-text-3 hover:text-text-1 transition-colors px-1.5 py-0.5 border border-border rounded bg-transparent cursor-pointer">
          Compare
        </button>
      </div>

      {/* Symbol list */}
      <div className="flex-1 overflow-y-auto">
        {symbols.map(symbol => {
          const price = prices[symbol];
          const isActive = symbol === activeSymbol;
          const pos = price?.changePct != null ? price.changePct >= 0 : null;
          return (
            <div
              key={symbol}
              className={`px-3 py-2 border-b border-border/40 cursor-pointer group ${
                isActive ? "bg-panel-2" : "hover:bg-panel-2/50"}`}
              onClick={() => onSymbolSelect(symbol)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-semibold truncate max-w-[110px] ${isActive ? "text-text-1" : "text-text-2"}`}>
                  {getSymbolName(symbol) ?? symbol.split(".")[0]}
                  <span className="text-text-3 font-normal text-[9px] ml-1">{symbol.split(".")[1]}</span>
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(symbol); }}
                  className="text-text-3 hover:text-neg text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer p-0 leading-none">
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-3 font-data">
                  {price?.loading ? "…" : price?.close != null ? price.close.toFixed(2) : "—"}
                </span>
                {price?.changePct != null && (
                  <span className={`text-[10px] font-data ${pos ? "text-pos" : "text-neg"}`}>
                    {pos ? "+" : ""}{price.changePct.toFixed(2)}%
                  </span>
                )}
              </div>
              {/* Cross-nav CTAs */}
              <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href="/backtest"onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors">
                  Backtest
                </Link>
                <Link
                  href="/quant"onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors">
                  Research
                </Link>
              </div>
            </div>
          );
        })}
      </div>

    </aside>
  );
}
