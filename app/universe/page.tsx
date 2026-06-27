"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getKRXStockBase, ApiError, type KRXStockBaseRow } from "@/lib/api";
import { addToWatchlist, getWatchlist } from "@/lib/watchlist-storage";

type Market = "KOSPI" | "KOSDAQ";

function formatMktcap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}T`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}B`;
  return `${v.toFixed(0)}M`;
}

export default function UniversePage() {
  const router = useRouter();
  const [market, setMarket] = useState<Market>("KOSPI");
  const [rows, setRows] = useState<KRXStockBaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [maxCap, setMaxCap] = useState<number>(0);   // 0 = no filter
  const [mktcapMax, setMktcapMax] = useState<number>(10_000_000);  // slider ceiling
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Load watchlist
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  const load = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setRows([]);
    setMaxCap(0);
    try {
      const res = await getKRXStockBase(market, ctrl.signal);
      const validRows = res.rows.filter(r => r.isu_cd && r.isu_nm);
      setRows(validRows);
      const caps = validRows.map(r => r.mktcap ?? 0).filter(v => v > 0);
      if (caps.length > 0) {
        const ceiling = Math.max(...caps);
        setMktcapMax(ceiling);
        setMaxCap(ceiling);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to load universe");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r =>
        (r.isu_nm ?? "").toLowerCase().includes(q) ||
        (r.isu_cd ?? "").toLowerCase().includes(q)
      );
    }
    if (maxCap > 0 && maxCap < mktcapMax) {
      out = out.filter(r => (r.mktcap ?? 0) <= maxCap);
    }
    return out;
  }, [rows, search, maxCap, mktcapMax]);

  const inWatchlist = useMemo(() => {
    const wSet = new Set(watchlist);
    return (isu_cd: string) => wSet.has(`${isu_cd}.XKRX`) || addedSet.has(isu_cd);
  }, [watchlist, addedSet]);

  const handleAddWatchlist = (isu_cd: string) => {
    const id = `${isu_cd}.XKRX`;
    addToWatchlist(id);
    setAddedSet(prev => new Set(prev).add(isu_cd));
  };

  const handleBacktest = (_isu_cd: string) => {
    router.push("/backtest");
  };

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      {/* Header */}
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Universe Builder</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Browse KRX-listed instruments. Filter by market cap. Add to Watchlist or open in Backtest.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Market + Load */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Market</label>
            <div className="flex gap-1">
              {(["KOSPI", "KOSDAQ"] as Market[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`px-4 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                    market === m
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 bg-transparent hover:text-text-2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {rows.length > 0 && (
            <span className="text-text-3 text-xs">
              {rows.length} instruments loaded
            </span>
          )}
        </div>

        {/* Filters (only shown after load) */}
        {rows.length > 0 && (
          <>
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Search</label>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name or ticker..."
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent w-64"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">
                Max Market Cap
              </label>
              <input
                type="range"
                min={0}
                max={mktcapMax}
                step={mktcapMax / 100}
                value={maxCap}
                onChange={e => setMaxCap(parseFloat(e.target.value))}
                className="flex-1 accent-[#FF9F1C]"
              />
              <span className="text-text-2 text-xs font-data w-16 text-right">
                {formatMktcap(maxCap || null)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {filtered.length} instruments
              {search || maxCap < mktcapMax ? ` (filtered from ${rows.length})` : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Code", "Market", "Mkt Cap", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => {
                  const isu_cd = row.isu_cd ?? "";
                  const inWl = inWatchlist(isu_cd);
                  return (
                    <tr key={i} className="border-b border-border/40 hover:bg-panel-2 transition-colors">
                      <td className="px-4 py-1.5 text-text-1">{row.isu_nm ?? "—"}</td>
                      <td className="px-4 py-1.5 text-text-3 font-data">{isu_cd}</td>
                      <td className="px-4 py-1.5 text-text-3">{row.mkt_nm ?? "—"}</td>
                      <td className="px-4 py-1.5 text-text-2 font-data text-right">
                        {formatMktcap(row.mktcap)}
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddWatchlist(isu_cd)}
                            disabled={inWl}
                            className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer transition-colors ${
                              inWl
                                ? "border-border text-text-3 cursor-default"
                                : "border-border text-text-3 hover:border-accent hover:text-accent"
                            }`}
                          >
                            {inWl ? "✓ Watchlist" : "+ Watchlist"}
                          </button>
                          <button
                            onClick={() => handleBacktest(isu_cd)}
                            className="px-2 py-0.5 text-[10px] rounded border border-border text-text-3 hover:border-accent hover:text-accent cursor-pointer transition-colors"
                          >
                            {"→ Backtest"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="px-4 py-2 text-text-3 text-xs border-t border-border">
                Showing first 200 of {filtered.length} results. Narrow your search to see more.
              </div>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-text-3 text-sm">No instruments match the current filters.</div>
      )}

      {rows.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Select a market and click Load to browse the universe.
        </div>
      )}
    </div>
  );
}
