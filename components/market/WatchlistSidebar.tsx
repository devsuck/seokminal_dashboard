"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
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

const REFRESH_MS = 60_000;

export function WatchlistSidebar({
  symbols, activeSymbol, onSymbolSelect, onCompare, onAdd, onRemove,
}: WatchlistSidebarProps) {
  const [prices, setPrices] = useState<Record<string, SymbolPrice>>({});
  const ctrlRef = useRef<AbortController | null>(null);

  // venue별(HL/XKRX/IB) 라이브 엔드포인트로 라우팅하는 fetchBarsForSymbol 재사용 —
  // 예전엔 getBars(/bars, parquet 카탈로그)를 직접 썼는데 이 카탈로그는 최초 적재 이후
  // 갱신 로직이 없어 KR종목 등이 몇달째 고정가로 표시되는 버그가 있었음.
  const refresh = useCallback((syms: string[]) => {
    if (syms.length === 0) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setPrices(prev => {
      const next: Record<string, SymbolPrice> = {};
      for (const s of syms) next[s] = prev[s] ?? { close: null, changePct: null, loading: true };
      return next;
    });

    syms.forEach(async symbol => {
      try {
        const bars = await fetchBarsForSymbol(symbol, "1d", ctrl.signal);
        if (ctrl.signal.aborted) return;
        const last = bars[bars.length - 1] ?? null;
        const prevBar = bars[bars.length - 2] ?? null;
        const changePct = last && prevBar
          ? ((last.close - prevBar.close) / prevBar.close) * 100
          : null;
        setPrices(p => ({ ...p, [symbol]: { close: last?.close ?? null, changePct, loading: false } }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (ctrl.signal.aborted) return;
        setPrices(p => ({ ...p, [symbol]: { close: null, changePct: null, loading: false } }));
      }
    });
  }, []);

  useEffect(() => {
    refresh(symbols);
    const iv = setInterval(() => refresh(symbols), REFRESH_MS);
    return () => { clearInterval(iv); ctrlRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, refresh]);

  return (
    <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-panel h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">워치리스트</span>
        <button
          onClick={onCompare}
          className="text-[10px] text-text-3 hover:text-text-1 transition-colors px-1.5 py-0.5 border border-border rounded bg-transparent cursor-pointer">
          비교
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
                  백테스트
                </Link>
              </div>
            </div>
          );
        })}
      </div>

    </aside>
  );
}
