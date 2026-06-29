"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { getCorrelation, ApiError, type CorrelationPair } from "@/lib/api";
import { CorrelationNetwork } from "@/components/network/CorrelationNetwork";
import { PageBanner } from "@/components/PageBanner";

const DEFAULT_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
  "035420.XKRX",
].join(", ");

const DEFAULT_START = "2024-01-01";
const DEFAULT_END = "2026-01-01";

export default function CorrelationPage() {
  const [instrumentsText, setInstrumentsText] = useState(DEFAULT_INSTRUMENTS);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [threshold, setThreshold] = useState(0.5);
  const [pairs, setPairs] = useState<CorrelationPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async () => {
    const ids = instrumentsText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length < 2) {
      setError("Enter at least 2 instrument IDs (comma-separated)");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setPairs([]);
    try {
      const res = await getCorrelation(ids, start, end, ctrl.signal);
      setPairs(res.pairs);
      setRan(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch correlation data");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentsText, start, end]);

  const positiveCount = pairs.filter(p => p.correlation >= threshold).length;
  const negativeCount = pairs.filter(p => p.correlation <= -threshold).length;
  const hiddenCount = pairs.filter(p => Math.abs(p.correlation) < threshold).length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <PageBanner pageKey="correlation" />
      {/* Header */}
      <div className="flex justify-end mb-2">
        <Link
          href="/quant"
          className="text-text-3 hover:text-accent text-xs no-underline transition-colors"
        >
          ← Research
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Instruments */}
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">
            Instruments (comma-separated)
          </label>
          <textarea
            rows={2}
            value={instrumentsText}
            onChange={e => setInstrumentsText(e.target.value)}
            placeholder="AAPL.NASDAQ, MSFT.NASDAQ, 005930.XKRX, ..."
            className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data"
          />
        </div>

        {/* Date range */}
        <div className="flex gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Computing…" : "Run"}
            </button>
          </div>
        </div>

        {/* Threshold slider */}
        <div className="flex items-center gap-3">
          <label className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">
            Min |correlation|
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="flex-1 accent-[#FF9F1C]"
          />
          <span className="text-text-2 text-xs font-data w-8 text-right">
            {threshold.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Stats */}
      {ran && pairs.length > 0 && (
        <div className="flex gap-4 flex-wrap text-xs">
          <span className="text-text-3 font-data">
            <span className="text-text-2">{pairs.length}</span> total pairs
          </span>
          <span className="text-text-3 font-data">
            <span className="text-pos">{positiveCount}</span> positive ≥ {threshold.toFixed(2)}
          </span>
          <span className="text-text-3 font-data">
            <span className="text-neg">{negativeCount}</span> negative ≤ −{threshold.toFixed(2)}
          </span>
          {hiddenCount > 0 && (
            <span className="text-text-3 font-data">
              <span className="text-text-3">{hiddenCount}</span> hidden (below threshold)
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      {ran && (
        <div className="flex gap-4 flex-wrap text-[10px] text-text-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#FF9F1C] shrink-0" />
            Korean (XKRX)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#3B82F6] shrink-0" />
            US (NASDAQ/NYSE)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-[#6B7280] shrink-0" />
            Other
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-[#22C55E] shrink-0" />
            Positive correlation
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-[#EF4444] shrink-0" />
            Negative correlation
          </div>
        </div>
      )}

      {/* Network */}
      {ran && (
        <div className="bg-bg border border-border rounded-lg overflow-hidden">
          <CorrelationNetwork pairs={pairs} threshold={threshold} height={560} />
        </div>
      )}

      {/* Correlation table */}
      {ran && pairs.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              All Pairs ({pairs.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Instrument A", "Instrument B", "Correlation"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-text-3 font-normal uppercase tracking-wider text-[10px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pairs]
                  .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
                  .map((p, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-1.5 text-text-2 font-data">{p.a}</td>
                      <td className="px-4 py-1.5 text-text-2 font-data">{p.b}</td>
                      <td
                        className={`px-4 py-1.5 font-data font-semibold ${
                          p.correlation >= threshold
                            ? "text-pos"
                            : p.correlation <= -threshold
                            ? "text-neg"
                            : "text-text-2"
                        }`}
                      >
                        {p.correlation.toFixed(4)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!ran && !loading && (
        <div className="text-center py-12 text-text-3 text-sm">
          Enter instruments and click Run to generate the correlation network.
        </div>
      )}
    </div>
  );
}
