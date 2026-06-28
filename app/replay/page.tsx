"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getBars, getBacktest, ApiError, type TradeRecord, type BarOut } from "@/lib/api";
import { computeRunningStats } from "@/lib/replay-utils";
import { ReplayChart } from "@/components/replay/ReplayChart";

type SpeedMs = 1000 | 500 | 250;
const SPEED_OPTIONS: { label: string; ms: SpeedMs }[] = [
  { label: "1x", ms: 1000 },
  { label: "2x", ms: 500 },
  { label: "4x", ms: 250 },
];

export default function ReplayPage() {
  const [instrumentId, setInstrumentId] = useState("005930.XKRX");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const [strategy, setStrategy] = useState("ema_cross");
  const [fastEma, setFastEma] = useState("10");
  const [slowEma, setSlowEma] = useState("30");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMs>(1000);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradesRef = useRef<TradeRecord[]>([]);
  tradesRef.current = trades;

  useEffect(() => () => {
    abortRef.current?.abort();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setBars([]);
    setTrades([]);
    setCurrentIndex(-1);
    try {
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, undefined, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, { fast_ema: fastEma, slow_ema: slowEma }, undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setTrades(btRes.trades);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to run backtest");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, start, end, strategy, fastEma, slowEma]);

  function stopPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }

  function startPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); }
    setCurrentIndex(prev => prev >= tradesRef.current.length - 1 ? -1 : prev);
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= tradesRef.current.length - 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
  }

  const goFirst = () => { stopPlayback(); setCurrentIndex(-1); };
  const goPrev = () => setCurrentIndex(i => Math.max(-1, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(trades.length - 1, i + 1));
  const goLast = () => { stopPlayback(); setCurrentIndex(trades.length - 1); };

  const stats = useMemo(() => computeRunningStats(trades, currentIndex), [trades, currentIndex]);

  const hasTrades = trades.length > 0;
  const tradeLabel = hasTrades
    ? currentIndex < 0
      ? `— / ${trades.length}`
      : `Trade ${currentIndex + 1} / ${trades.length}`
    : "No trades";

  function fmtPnl(v: number): string {
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  }

  function fmtPct(v: number | null): string {
    return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Trade Replay</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Step through backtest trades on a live candlestick chart.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input value={instrumentId} onChange={e => setInstrumentId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-36" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Strategy</label>
            <input value={strategy} onChange={e => setStrategy(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-28" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Fast EMA</label>
            <input type="number" value={fastEma} onChange={e => setFastEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Slow EMA</label>
            <input type="number" value={slowEma} onChange={e => setSlowEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <button onClick={run} disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{error}</div>
      )}

      {hasTrades && (
        <>
          {/* Running stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Trades Shown", value: `${stats.totalTrades}/${trades.length}`, colored: false, val: 0 },
              { label: "Completed", value: String(stats.completedTrades), colored: false, val: 0 },
              { label: "Running P&L", value: fmtPnl(stats.runningPnl), colored: true, val: stats.runningPnl },
              { label: "Win Rate", value: fmtPct(stats.winRate), colored: false, val: 0 },
            ].map(s => (
              <div key={s.label} className="bg-panel border border-border rounded-lg px-4 py-3">
                <div className="text-text-3 text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className={`text-sm font-data mt-1 ${s.colored ? (s.val >= 0 ? "text-pos" : "text-neg") : "text-text-1"}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + trade list */}
          <div className="flex gap-4">
            {/* Chart column */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">{instrumentId} — {tradeLabel}</span>
                </div>
                <div className="p-2">
                  <ReplayChart bars={bars} trades={trades} currentIndex={currentIndex} height={360} />
                </div>
              </div>

              {/* Playback controls */}
              <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  <button onClick={goFirst} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    |◀
                  </button>
                  <button onClick={goPrev} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ◀
                  </button>
                  <button
                    onClick={isPlaying ? stopPlayback : startPlayback}
                    disabled={trades.length === 0}
                    className="px-3 py-1 text-xs bg-accent text-black font-semibold rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-40">
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button onClick={goNext} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶
                  </button>
                  <button onClick={goLast} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶|
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-text-3 text-xs">Speed:</span>
                  {SPEED_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => setSpeed(opt.ms)}
                      className={`px-2 py-0.5 text-xs rounded border cursor-pointer transition-colors ${
                        speed === opt.ms ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <span className="text-text-3 text-xs ml-auto font-data">{tradeLabel}</span>
              </div>
            </div>

            {/* Trade list panel */}
            <div className="w-56 shrink-0">
              <div className="bg-panel border border-border rounded-lg overflow-hidden h-full">
                <div className="px-3 py-2 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Trades</span>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {trades.map((t, i) => {
                    const isActive = i === currentIndex;
                    const isCompleted = t.pnl !== null;
                    const isWin = t.pnl !== null && t.pnl > 0;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`w-full px-3 py-2 text-left border-b border-border/40 transition-colors cursor-pointer ${
                          isActive ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-panel-2 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-text-3 text-[10px]">#{i + 1}</span>
                          <span className={`text-[10px] font-semibold ${t.side === "LONG" || t.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {t.side}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-text-3 text-[10px] font-data">{t.entry_price.toFixed(2)}</span>
                          {isCompleted ? (
                            <span className={`text-[10px] font-data font-semibold ${isWin ? "text-pos" : "text-neg"}`}>
                              {fmtPnl(t.pnl!)}
                            </span>
                          ) : (
                            <span className="text-text-3 text-[10px]">open</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!hasTrades && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure instrument and click Run to start trade replay.
        </div>
      )}
    </div>
  );
}
