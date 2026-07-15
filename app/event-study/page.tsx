"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  getBars, getKSDDividend, getKSDRightsSchedule, getFREDCatalog, getFREDSeries,
  ApiError, type FREDCatalogItem,
} from "@/lib/api";
import { computeEventStudy, type EventInput, type EventStudyResult } from "@/lib/event-study-utils";
import { EventReturnChart } from "@/components/event-study/EventReturnChart";
import { Panel, PanelHeader } from "@/components/ui/Panel";

type EventSource = "ksd_dividend" | "ksd_rights" | "fred" | "custom";

const WINDOW_OPTIONS = [3, 5, 10, 20] as const;
const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";
const DEFAULT_INSTRUMENT = "005930.XKRX";

function pct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

export default function EventStudyPage() {
  const [instrumentId, setInstrumentId] = useState(DEFAULT_INSTRUMENT);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [source, setSource] = useState<EventSource>("ksd_dividend");
  const [windowDays, setWindowDays] = useState<number>(5);
  const [fredCatalog, setFredCatalog] = useState<FREDCatalogItem[]>([]);
  const [fredSeriesId, setFredSeriesId] = useState("");
  const [customDates, setCustomDates] = useState("2022-02-24\n2022-09-30\n2023-03-10");
  const [result, setResult] = useState<EventStudyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Unmount cleanup
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Load FRED catalog when source switches to "fred"
  useEffect(() => {
    if (source !== "fred" || fredCatalog.length > 0) return;
    const ctrl = new AbortController();
    getFREDCatalog(ctrl.signal).then(items => {
      setFredCatalog(items);
      if (items.length > 0 && !fredSeriesId) setFredSeriesId(items[0].series_id);
    }).catch(() => {});
    return () => ctrl.abort();
  }, [source, fredCatalog.length]);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Fetch bars
      const barsRes = await getBars(instrumentId, start, end, undefined, ctrl.signal);

      // Fetch events
      let events: EventInput[] = [];
      const ticker = instrumentId.split(".")[0];

      if (source === "ksd_dividend") {
        const res = await getKSDDividend(ticker, start, end, ctrl.signal);
        events = res.rows
          .filter(r => r.dvdn_bas_dt)
          .map(r => ({ date: r.dvdn_bas_dt!, label: `Div ${r.stck_genr_cash_dvdn_rt ?? ""}` }));
      } else if (source === "ksd_rights") {
        const res = await getKSDRightsSchedule(undefined, start, end, undefined, ctrl.signal);
        events = res.rows
          .filter(r => r.rgt_exert_sttg_dt)
          .map(r => ({ date: r.rgt_exert_sttg_dt!, label: r.stck_issu_rcd_nm ?? "Rights" }));
      } else if (source === "fred") {
        if (!fredSeriesId) throw new Error("Select a FRED series");
        const res = await getFREDSeries(fredSeriesId, start, end, ctrl.signal);
        events = res.observations
          .filter(o => o.value !== null)
          .map(o => ({ date: o.date, label: `${fredSeriesId} ${o.value?.toFixed(2) ?? ""}` }));
      } else {
        // custom
        events = customDates
          .split("\n")
          .map(l => l.trim())
          .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l))
          .map(date => ({ date, label: date }));
        if (events.length === 0) throw new Error("Enter at least one valid date (YYYY-MM-DD)");
      }

      if (events.length === 0) {
        setError("No events found in the selected date range");
        return;
      }
      setResult(computeEventStudy(barsRes.bars, events, windowDays));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, start, end, source, windowDays, fredSeriesId, customDates]);

  const sourceOptions: { value: EventSource; label: string }[] = [
    { value: "ksd_dividend", label: "KSD Dividend" },
    { value: "ksd_rights", label: "KSD Rights" },
    { value: "fred", label: "FRED Series" },
    { value: "custom", label: "Custom Dates" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Event Study</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Windowed return analysis around market events. Measures performance −N to +N days from each event.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        {/* Instrument + dates */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              placeholder="005930.XKRX"className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data w-40"/>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input
              type="date"value={start}
              onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"/>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input
              type="date"value={end}
              onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"/>
          </div>
        </div>

        {/* Event source tabs */}
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Event Source</label>
          <div className="flex gap-1 flex-wrap">
            {sourceOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                  source === opt.value
                    ? "border-accent text-accent bg-accent/10": "border-border text-text-3 bg-transparent hover:text-text-2"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional source sub-controls */}
        {source === "fred" && (
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">FRED Series</label>
            <select
              value={fredSeriesId}
              onChange={e => setFredSeriesId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent">
              {fredCatalog.length === 0 && <option value="">Loading...</option>}
              {fredCatalog.map(item => (
                <option key={item.series_id} value={item.series_id}>
                  {item.label} ({item.series_id})
                </option>
              ))}
            </select>
          </div>
        )}
        {source === "custom" && (
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Custom Dates (one YYYY-MM-DD per line)</label>
            <textarea
              rows={4}
              value={customDates}
              onChange={e => setCustomDates(e.target.value)}
              placeholder="2022-02-24&#10;2022-09-30"className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-data"/>
          </div>
        )}

        {/* Window + Run */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Window</label>
            <div className="flex gap-1">
              {WINDOW_OPTIONS.map(w => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    windowDays === w
                      ? "border-accent text-accent bg-accent/10": "border-border text-text-3 bg-transparent hover:text-text-2"}`}
                >
                  ±{w}d
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <div className="flex gap-6 flex-wrap text-xs">
            <div className="text-text-3">
              Events: <span className="text-text-2 font-data">{result.stats.eventCount}</span>
            </div>
            <div className="text-text-3">
              Hit Rate:{" "}
              <span className={`px-1 font-bold font-data ${result.stats.hitRate === null ? "text-text-2" : result.stats.hitRate >= 0.5 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {result.stats.hitRate !== null ? `${(result.stats.hitRate * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="text-text-3">
              Avg Return (+{result.stats.windowDays}d):{" "}
              <span className={`px-1 font-bold font-data ${result.stats.avgReturns[result.stats.windowDays * 2] === null ? "text-text-2" : (result.stats.avgReturns[result.stats.windowDays * 2] ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {pct(result.stats.avgReturns[result.stats.windowDays * 2])}
              </span>
            </div>
            <div className="text-text-3">
              Max: <span className="text-pos font-data">{pct(result.stats.maxReturn)}</span>
            </div>
            <div className="text-text-3">
              Min: <span className="text-neg font-data">{pct(result.stats.minReturn)}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[10px] text-text-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#6B7280] opacity-50 shrink-0" />
              Individual events
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-accent shrink-0" />
              Average
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-info shrink-0 opacity-80" style={{backgroundImage: "repeating-linear-gradient(to right, var(--color-info) 0px, var(--color-info) 5px, transparent 5px, transparent 8px)"}} />
              Median
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-0.5 h-3 bg-accent opacity-70 shrink-0" />
              Event day (0)
            </div>
          </div>

          {/* Chart */}
          <div className="bg-bg border border-border rounded-lg p-4 overflow-hidden">
            <EventReturnChart result={result} height={300} />
          </div>

          {/* Events table */}
          <Panel>
            <PanelHeader>Individual Events ({result.windows.length})</PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">Label</th>
                    {result.dayLabels.map(dl => (
                      <th key={dl} className="px-2 py-2 text-right text-text-3 font-normal text-[10px] font-data">
                        {dl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.windows.map((w, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-1.5 text-text-2 font-data">{w.eventDate}</td>
                      <td className="px-4 py-1.5 text-text-3 max-w-[120px] truncate">{w.label}</td>
                      {w.returns.map((r, k) => (
                        <td
                          key={k}
                          className={`px-2 py-1.5 text-right font-data ${
                            r === null ? "text-text-3" : r > 0 ? "font-bold bg-pos/20 text-pos" : r < 0 ? "font-bold bg-neg/20 text-neg" : "text-text-2"}`}
                        >
                          {r === null ? "—" : `${(r * 100).toFixed(2)}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure event source and click Run to analyze windowed returns.
        </div>
      )}
    </div>
  );
}
