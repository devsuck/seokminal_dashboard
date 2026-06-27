"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBars } from "@/lib/api";

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
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (symbols.length === 0) return;
    let alive = true;
    const { start, end } = getRecentWindow();

    setPrices(prev => {
      const init: Record<string, SymbolPrice> = {};
      for (const s of symbols) init[s] = prev[s] ?? { close: null, changePct: null, loading: true };
      return init;
    });

    symbols.forEach(async symbol => {
      try {
        const { bars } = await getBars(symbol, start, end);
        if (!alive) return;
        const last = bars[bars.length - 1] ?? null;
        const prev = bars[bars.length - 2] ?? null;
        const changePct = last && prev
          ? ((last.close - prev.close) / prev.close) * 100
          : null;
        setPrices(p => ({ ...p, [symbol]: { close: last?.close ?? null, changePct, loading: false } }));
      } catch {
        if (!alive) return;
        setPrices(p => ({ ...p, [symbol]: { close: null, changePct: null, loading: false } }));
      }
    });

    return () => { alive = false; };
  }, [symbols]);

  function handleAdd() {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (!/^[A-Z0-9]+\.[A-Z]+$/.test(sym)) {
      setAddError("Format: SYMBOL.VENUE");
      return;
    }
    onAdd(sym);
    setAddInput("");
    setAddError(null);
  }

  return (
    <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-panel h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">Watchlist</span>
        <button
          onClick={onCompare}
          className="text-[10px] text-text-3 hover:text-text-1 transition-colors px-1.5 py-0.5 border border-border rounded bg-transparent cursor-pointer"
        >
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
                isActive ? "bg-panel-2" : "hover:bg-panel-2/50"
              }`}
              onClick={() => onSymbolSelect(symbol)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-semibold truncate max-w-[110px] ${isActive ? "text-text-1" : "text-text-2"}`}>
                  {symbol.split(".")[0]}
                  <span className="text-text-3 font-normal text-[9px] ml-1">{symbol.split(".")[1]}</span>
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(symbol); }}
                  className="text-text-3 hover:text-neg text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer p-0 leading-none"
                >
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
                  href="/backtest"
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors"
                >
                  Backtest
                </Link>
                <Link
                  href="/quant"
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-text-3 hover:text-accent border border-border/60 rounded px-1.5 py-0.5 no-underline transition-colors"
                >
                  Research
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add symbol input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-1">
          <input
            type="text"
            value={addInput}
            onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(null); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="AAPL.NASDAQ"
            className="flex-1 h-7 text-[11px] px-2 bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            className="h-7 px-2.5 text-sm bg-accent text-black font-bold rounded-md hover:brightness-110 border-0 cursor-pointer"
          >
            +
          </button>
        </div>
        {addError && <p className="text-neg text-[10px] mt-1">{addError}</p>}
      </div>
    </aside>
  );
}
