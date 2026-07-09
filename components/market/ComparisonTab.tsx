"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ComparisonChart, SERIES_CONFIG } from "@/components/market/ComparisonChart";
import { ApiError, getBars, type BarOut } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

interface ComparisonTabProps {
  symbols: string[];
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ComparisonTab({ symbols }: ComparisonTabProps) {
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<Record<string, BarOut[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadData() {
    if (symbols.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);

    try {
      const results = await Promise.all(
        symbols.map(s =>
          getBars(s, start, end, undefined, ctrl.signal)
            .then(r => [s, r.bars] as const)
            .catch(() => [s, [] as BarOut[]] as const)
        )
      );
      if (ctrl.signal.aborted) return;
      const newData: Record<string, BarOut[]> = {};
      for (const [s, bars] of results) newData[s] = bars;
      setData(newData);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to load comparison data");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols]);

  const chartSymbols = useMemo(
    () => symbols.filter(s => (data[s]?.length ?? 0) > 0),
    [data, symbols]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button
          onClick={loadData}
          disabled={loading || symbols.length === 0}
          className="px-4 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? "Loading…" : "Compare"}
        </button>
      </div>

      {/* Legend */}
      {symbols.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {symbols.map((s, i) => {
            const cfg = SERIES_CONFIG[i % SERIES_CONFIG.length];
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-4 h-0.5 inline-block rounded ${cfg.bgClass}`} />
                <span className="text-text-2 text-xs font-data">{s.split(".")[0]}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {symbols.length === 0 ? (
        <div className="bg-panel border border-border rounded-lg h-[480px] flex items-center justify-center">
          <p className="text-text-3 text-sm">Add symbols to your watchlist to compare</p>
        </div>
      ) : (
        <Panel>
          <PanelHeader>Normalized Return (%)</PanelHeader>
          <ComparisonChart data={data} symbols={chartSymbols} />
        </Panel>
      )}
    </div>
  );
}
