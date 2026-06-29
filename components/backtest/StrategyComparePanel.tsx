"use client";

import { useRef, useState } from "react";
import { getBacktest, type BacktestResponse } from "@/lib/api";

interface StrategyComparePanelProps {
  instrumentId: string;
  start: string;
  end: string;
}

const STRATEGIES = [
  { label: "EMA Cross", strategy: "ema_cross", params: { fast: "10", slow: "20" } },
  { label: "MACD",      strategy: "macd",      params: { fast: "12", slow: "26", signal_period: "9" } },
  { label: "RSI",       strategy: "rsi",       params: { period: "14", oversold: "30", overbought: "70" } },
  { label: "XGBoost",   strategy: "xgb",       params: { xgb_train_ratio: "0.7", xgb_n_estimators: "100", xgb_max_depth: "4", xgb_learning_rate: "0.1" } },
] as const;

type CompareResult = (BacktestResponse & { label: string; strategy: string }) | null;

export function StrategyComparePanel({ instrumentId, start, end }: StrategyComparePanelProps) {
  const [results, setResults] = useState<CompareResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const settled = await Promise.allSettled(
        STRATEGIES.map((s) =>
          getBacktest(instrumentId, start, end, s.strategy, s.params as Record<string, string>, undefined, ctrl.signal)
        )
      );

      if (ctrl.signal.aborted) return;

      const mapped: CompareResult[] = settled.map((outcome, i) => {
        if (outcome.status === "fulfilled") {
          return { ...outcome.value, label: STRATEGIES[i].label, strategy: STRATEGIES[i].strategy };
        }
        return null;
      });

      // Sort by sharpe_ratio descending, nulls last
      const sorted = [...mapped].sort((a, b) => {
        const sa = a?.sharpe_ratio ?? null;
        const sb = b?.sharpe_ratio ?? null;
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      });

      setResults(sorted);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("전략 비교 실행 중 오류가 발생했습니다.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const bestSharpe = results.reduce<number | null>((best, r) => {
    if (r === null || r.sharpe_ratio === null) return best;
    if (best === null || r.sharpe_ratio > best) return r.sharpe_ratio;
    return best;
  }, null);

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">전략 비교</span>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-accent text-black font-semibold rounded hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "실행 중..." : "모든 전략 비교"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 text-neg text-xs">{error}</div>
      )}

      {!error && results.length === 0 && !loading && (
        <div className="px-4 py-4 text-text-3 text-xs text-center">
          4개 전략을 동시에 실행하려면 위 버튼을 클릭하세요.
        </div>
      )}

      {loading && (
        <div className="px-4 py-4 text-text-3 text-xs text-center">전략 실행 중...</div>
      )}

      {results.length > 0 && !loading && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-text-3 uppercase tracking-wider text-[10px] px-3 py-2 text-left">전략</th>
              <th className="text-text-3 uppercase tracking-wider text-[10px] px-3 py-2 text-right">Sharpe</th>
              <th className="text-text-3 uppercase tracking-wider text-[10px] px-3 py-2 text-right">PnL %</th>
              <th className="text-text-3 uppercase tracking-wider text-[10px] px-3 py-2 text-right">Max DD</th>
              <th className="text-text-3 uppercase tracking-wider text-[10px] px-3 py-2 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, i) => {
              const isBest =
                result !== null &&
                result.sharpe_ratio !== null &&
                bestSharpe !== null &&
                result.sharpe_ratio === bestSharpe;
              return (
                <tr
                  key={i}
                  className={
                    "border-t border-border" +
                    (isBest ? " bg-pos/5 border-l-2 border-l-pos" : "")
                  }
                >
                  <td className="px-3 py-2 text-text-1 font-medium">
                    {result?.label ?? STRATEGIES[i]?.label ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-data text-right text-text-2">
                    {result?.sharpe_ratio != null ? result.sharpe_ratio.toFixed(2) : "—"}
                  </td>
                  <td
                    className={
                      "px-3 py-2 font-data text-right " +
                      (result?.total_pnl_pct != null
                        ? result.total_pnl_pct > 0
                          ? "text-pos"
                          : "text-neg"
                        : "text-text-2")
                    }
                  >
                    {result?.total_pnl_pct != null
                      ? `${result.total_pnl_pct > 0 ? "+" : ""}${(result.total_pnl_pct * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-data text-right text-neg">
                    {result?.max_drawdown != null
                      ? `-${Math.abs(result.max_drawdown * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-data text-right text-text-2">
                    {result?.win_rate != null
                      ? `${(result.win_rate * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
