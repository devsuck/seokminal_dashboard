"use client";

import { useRef, useState } from "react";
import { ApiError, runScreener, type ScreenerResult } from "@/lib/api";

const EMA_SIGNAL_OPTS = [
  { value: "", label: "전체" },
  { value: "bullish_cross", label: "골든크로스 (EMA12↑EMA26)" },
  { value: "bearish_cross", label: "데드크로스 (EMA12↓EMA26)" },
  { value: "above", label: "EMA12 > EMA26" },
  { value: "below", label: "EMA12 < EMA26" },
];

const EMA_BADGE: Record<string, { label: string; cls: string }> = {
  bullish_cross: { label: "골든크로스", cls: "text-pos bg-pos/15 border-pos/25" },
  bearish_cross: { label: "데드크로스", cls: "text-neg bg-neg/15 border-neg/25" },
  above:         { label: "EMA↑",       cls: "text-pos bg-pos/10 border-pos/20" },
  below:         { label: "EMA↓",       cls: "text-neg bg-neg/10 border-neg/20" },
  neutral:       { label: "중립",        cls: "text-text-3 bg-panel-2 border-border" },
};

const PRESET_UNIVERSES = [
  { label: "미국 대형주", value: "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,BRK.B,JPM,JNJ" },
  { label: "한국 대형주", value: "005930.KRX,000660.KRX,035420.KRX,005380.KRX,051910.KRX" },
  { label: "ETF", value: "SPY,QQQ,IWM,GLD,TLT,VNQ" },
];

export default function ScreenerPage() {
  const [instruments, setInstruments] = useState("");
  const [rsiMin, setRsiMin] = useState("");
  const [rsiMax, setRsiMax] = useState("");
  const [emaSignal, setEmaSignal] = useState("");
  const [days, setDays] = useState(60);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  async function handleRun() {
    const ids = instruments.trim();
    if (!ids) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await runScreener({
        instruments: ids,
        rsi_min: rsiMin ? Number(rsiMin) : undefined,
        rsi_max: rsiMax ? Number(rsiMax) : undefined,
        ema_signal: emaSignal || undefined,
        days,
      }, ctrl.signal);
      if (!ctrl.signal.aborted) setResults(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(e instanceof ApiError ? e.message : "스크리너 실패");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-[900px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">Screener</h1>
        <p className="text-text-3 text-xs mt-0.5">RSI + EMA 조건으로 종목 필터링 · 기존 bar 데이터 사용</p>
      </div>

      {/* Filter panel */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
        {/* Instrument input */}
        <div>
          <label className="text-text-3 text-xs block mb-1.5">종목 목록 (쉼표 구분, 최대 30개)</label>
          <textarea
            value={instruments}
            onChange={e => setInstruments(e.target.value)}
            placeholder="AAPL,MSFT,GOOGL,NVDA…"
            rows={2}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-text-1 text-xs font-data resize-none focus:border-accent outline-none"
          />
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {PRESET_UNIVERSES.map(p => (
              <button
                key={p.label}
                onClick={() => setInstruments(p.value)}
                className="text-[10px] text-text-3 hover:text-accent border border-border rounded px-2 py-0.5 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="text-text-3 text-xs block mb-1">RSI 최솟값</label>
            <input
              type="number" value={rsiMin} onChange={e => setRsiMin(e.target.value)}
              placeholder="0"
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs font-data focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="text-text-3 text-xs block mb-1">RSI 최댓값</label>
            <input
              type="number" value={rsiMax} onChange={e => setRsiMax(e.target.value)}
              placeholder="100"
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs font-data focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="text-text-3 text-xs block mb-1">EMA 시그널</label>
            <select
              value={emaSignal} onChange={e => setEmaSignal(e.target.value)}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs focus:border-accent outline-none"
            >
              {EMA_SIGNAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-text-3 text-xs block mb-1">기간 (일)</label>
            <select
              value={days} onChange={e => setDays(Number(e.target.value))}
              className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs focus:border-accent outline-none"
            >
              {[20, 30, 60, 90, 120, 180, 365].map(d => (
                <option key={d} value={d}>{d}일</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={loading || !instruments.trim()}
          className="bg-accent text-black text-sm px-6 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "스크리닝 중…" : "Run Screener"}
        </button>
      </div>

      {error && <p className="text-neg text-sm">{error}</p>}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            {results.length}개 종목 조건 충족
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-3 text-[10px] uppercase border-b border-border">
                <th className="px-4 py-2 text-left">종목</th>
                <th className="px-3 py-2 text-right">가격</th>
                <th className="px-3 py-2 text-right">변동</th>
                <th className="px-3 py-2 text-right">RSI(14)</th>
                <th className="px-3 py-2 text-right">EMA12</th>
                <th className="px-3 py-2 text-right">EMA26</th>
                <th className="px-3 py-2 text-center">신호</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const chgPos = (r.change_pct ?? 0) >= 0;
                const badge = EMA_BADGE[r.ema_signal] ?? EMA_BADGE.neutral;
                return (
                  <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
                    <td className="px-4 py-2 font-data font-semibold text-accent">{r.instrument_id}</td>
                    <td className="px-3 py-2 text-right font-data text-text-1">{r.last_price.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right font-data ${chgPos ? "text-pos" : "text-neg"}`}>
                      {r.change_pct != null ? `${chgPos ? "+" : ""}${r.change_pct.toFixed(2)}%` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-data font-medium ${
                      r.rsi14 == null ? "text-text-3"
                      : r.rsi14 < 30 ? "text-pos"
                      : r.rsi14 > 70 ? "text-neg"
                      : "text-text-1"
                    }`}>
                      {r.rsi14 != null ? r.rsi14.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-data text-text-2">
                      {r.ema12 != null ? r.ema12.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-data text-text-2">
                      {r.ema26 != null ? r.ema26.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && results.length === 0 && instruments && !error && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center text-text-3 text-sm">
          조건에 맞는 종목 없음
        </div>
      )}
    </div>
  );
}
