"use client";

import { useRef, useState } from "react";
import {
  ApiError,
  getWalkForward,
  type WalkForwardResponse,
  type WalkForwardWindow,
} from "@/lib/api";

interface Props {
  instrumentId: string;
  start: string;
  end: string;
  strategy: string;
  strategyParams: Record<string, string>;
}

function fmt(v: number | null, digits = 2, suffix = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(digits)}${suffix}`;
}

function WindowRow({ w, best }: { w: WalkForwardWindow; best: boolean }) {
  const pnlColor =
    w.total_pnl_pct == null
      ? "text-text-3": w.total_pnl_pct > 0
      ? "text-pos": "text-neg";
  const shColor =
    w.sharpe_ratio == null
      ? "text-text-3": w.sharpe_ratio > 1
      ? "text-pos": w.sharpe_ratio < 0
      ? "text-neg": "text-text-1";

  return (
    <tr
      className={`border-t border-border transition-colors ${
        best ? "bg-pos/5 border-l-2 border-l-pos" : "hover:bg-panel-2"}`}
    >
      <td className="px-3 py-2 text-text-3 text-xs font-data">{w.window_start}</td>
      <td className="px-3 py-2 text-text-3 text-xs font-data">{w.window_end}</td>
      <td className={`px-3 py-2 text-right text-xs font-data ${shColor}`}>
        {fmt(w.sharpe_ratio)}
      </td>
      <td className={`px-3 py-2 text-right text-xs font-data ${pnlColor}`}>
        {fmt(w.total_pnl_pct, 2, "%")}
      </td>
      <td className="px-3 py-2 text-right text-xs font-data text-text-2">
        {fmt(w.win_rate != null ? w.win_rate * 100 : null, 1, "%")}
      </td>
      <td className="px-3 py-2 text-right text-xs font-data text-neg">
        {fmt(w.max_drawdown != null ? w.max_drawdown * 100 : null, 2, "%")}
      </td>
      <td className="px-3 py-2 text-right text-xs font-data text-text-3">
        {w.num_trades}
      </td>
    </tr>
  );
}

export function WalkForwardPanel({
  instrumentId,
  start,
  end,
  strategy,
  strategyParams,
}: Props) {
  const [nWindows, setNWindows] = useState(5);
  const [result, setResult] = useState<WalkForwardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  async function run() {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await getWalkForward(instrumentId, start, end, strategy, strategyParams, nWindows, ctrl.signal);
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(err instanceof ApiError ? err.message : "Walk-forward failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const bestIdx =
    result
      ? result.windows.reduce(
          (bi, w, i) =>
            w.sharpe_ratio != null &&
            (result.windows[bi].sharpe_ratio == null ||
              w.sharpe_ratio > (result.windows[bi].sharpe_ratio ?? -Infinity))
              ? i
              : bi,
          0,
        )
      : -1;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-1 text-sm font-medium">Walk-Forward 분석</p>
          <p className="text-text-3 text-xs mt-0.5">
            전체 기간을 N개 윈도우로 분할해 각 구간 성과를 측정합니다. 오버피팅 진단에 사용합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-text-3 text-xs">윈도우 수</label>
          <select
            value={nWindows}
            onChange={e => setNWindows(Number(e.target.value))}
            className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs">
            {[3, 4, 5, 6, 8, 10].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={loading}
            className="bg-accent text-black text-xs px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? "실행 중…" : "실행"}
          </button>
        </div>
      </div>

      {error && <p className="text-neg text-xs">{error}</p>}

      {result && (
        <>
          {/* Summary row */}
          <div className="flex gap-6 border-b border-border pb-3">
            <div>
              <p className="text-text-3 text-[10px] uppercase tracking-wider">평균 Sharpe</p>
              <p className={`text-sm font-medium font-data ${
                result.summary.avg_sharpe == null ? "text-text-3" :
                result.summary.avg_sharpe > 1 ? "text-pos" :
                result.summary.avg_sharpe < 0 ? "text-neg" : "text-text-1"}`}>
                {fmt(result.summary.avg_sharpe)}
              </p>
            </div>
            <div>
              <p className="text-text-3 text-[10px] uppercase tracking-wider">평균 PnL</p>
              <p className={`text-sm font-medium font-data ${
                result.summary.avg_pnl_pct == null ? "text-text-3" :
                result.summary.avg_pnl_pct > 0 ? "text-pos" : "text-neg"}`}>
                {fmt(result.summary.avg_pnl_pct, 2, "%")}
              </p>
            </div>
            <div>
              <p className="text-text-3 text-[10px] uppercase tracking-wider">수익 구간</p>
              <p className="text-sm font-medium font-data text-text-1">
                {result.summary.profitable_windows} / {result.summary.total_windows}
              </p>
            </div>
            <div>
              <p className="text-text-3 text-[10px] uppercase tracking-wider">평균 Max DD</p>
              <p className="text-sm font-medium font-data text-neg">
                {fmt(result.summary.avg_max_drawdown != null ? result.summary.avg_max_drawdown * 100 : null, 2, "%")}
              </p>
            </div>
          </div>

          {/* Window table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">시작</th>
                  <th className="text-left px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">종료</th>
                  <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">Sharpe</th>
                  <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">PnL %</th>
                  <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">승률</th>
                  <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">Max DD</th>
                  <th className="text-right px-3 py-1.5 text-text-3 text-[10px] uppercase tracking-wider">거래수</th>
                </tr>
              </thead>
              <tbody>
                {result.windows.map((w, i) => (
                  <WindowRow key={i} w={w} best={i === bestIdx} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
