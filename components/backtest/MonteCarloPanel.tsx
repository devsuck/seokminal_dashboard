"use client";

import { useRef, useState } from "react";
import { ApiError, getMonteCarlo, type MonteCarloResponse } from "@/lib/api";

interface Props {
  instrumentId: string;
  start: string;
  end: string;
}

const CW = 600, CH = 180, PX = 24, PY = 12;

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function SvgFan({ result }: { result: MonteCarloResponse }) {
  const { paths, day_indices, horizon_days } = result;
  const allVals = [...paths.p5, ...paths.p95];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const hDays = horizon_days || 1;

  function pts(series: number[]) {
    return series
      .map((v, i) => {
        const x = PX + (day_indices[i] / hDays) * (CW - PX * 2);
        const y = PY + ((maxV - v) / range) * (CH - PY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function band(a: number[], b: number[]) {
    const fwd = a.map((v, i) => {
      const x = PX + (day_indices[i] / hDays) * (CW - PX * 2);
      const y = PY + ((maxV - v) / range) * (CH - PY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const rev = b.slice().reverse().map((v, j) => {
      const i = b.length - 1 - j;
      const x = PX + (day_indices[i] / hDays) * (CW - PX * 2);
      const y = PY + ((maxV - v) / range) * (CH - PY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${[...fwd, ...rev].join(" L ")} Z`;
  }

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: "180px" }}>
      {/* Bands */}
      <path d={band(paths.p5, paths.p95)} fill="rgba(99,102,241,0.08)" />
      <path d={band(paths.p25, paths.p75)} fill="rgba(99,102,241,0.15)" />
      {/* Baseline (1.0) */}
      {(() => {
        const y = PY + ((maxV - 1) / range) * (CH - PY * 2);
        return <line x1={PX} y1={y} x2={CW - PX} y2={y} stroke="rgba(255,255,255,0.12)" strokeDasharray="4,4" />;
      })()}
      {/* P5 / P95 */}
      <polyline points={pts(paths.p5)} fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.2" />
      <polyline points={pts(paths.p95)} fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="1.2" />
      {/* Median */}
      <polyline points={pts(paths.p50)} fill="none" stroke="rgba(99,102,241,0.9)" strokeWidth="1.8" />
      {/* Labels */}
      <text x={CW - PX + 3} y={PY + ((maxV - paths.p95[paths.p95.length - 1]) / range) * (CH - PY * 2) + 4}
        fontSize="9" fill="rgba(34,197,94,0.8)">P95</text>
      <text x={CW - PX + 3} y={PY + ((maxV - paths.p50[paths.p50.length - 1]) / range) * (CH - PY * 2) + 4}
        fontSize="9" fill="rgba(99,102,241,0.9)">P50</text>
      <text x={CW - PX + 3} y={PY + ((maxV - paths.p5[paths.p5.length - 1]) / range) * (CH - PY * 2) + 4}
        fontSize="9" fill="rgba(239,68,68,0.7)">P5</text>
    </svg>
  );
}

export function MonteCarloPanel({ instrumentId, start, end }: Props) {
  const [horizon, setHorizon] = useState(252);
  const [nSim, setNSim] = useState(500);
  const [result, setResult] = useState<MonteCarloResponse | null>(null);
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
      const res = await getMonteCarlo(instrumentId, start, end, horizon, nSim, ctrl.signal);
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(err instanceof ApiError ? err.message : "Monte Carlo 실패");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-1 text-sm font-medium">Monte Carlo 시뮬레이션</p>
          <p className="text-text-3 text-xs mt-0.5">
            역사적 수익률 분포로 미래 N일간 수천 개의 경로를 시뮬레이션합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-text-3 text-xs">기간(일)</label>
          <input
            type="number"value={horizon}
            min={20}
            max={1260}
            onChange={e => setHorizon(Math.max(20, Math.min(1260, Number(e.target.value))))}
            className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs font-data w-16"/>
          <label className="text-text-3 text-xs">시뮬</label>
          <select
            value={nSim}
            onChange={e => setNSim(Number(e.target.value))}
            className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs">
            {[200, 500, 1000, 2000].map(n => (
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
          {/* Fan chart */}
          <div className="bg-bg rounded border border-border overflow-hidden">
            <SvgFan result={result} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "수익 확률", val: `${(result.prob_profit * 100).toFixed(1)}%`, color: result.prob_profit > 0.5 ? "text-pos" : "text-neg" },
              { label: "20% 손실 확률", val: `${(result.prob_loss_20pct * 100).toFixed(1)}%`, color: "text-neg" },
              { label: "중앙값 (최종)", val: result.terminal_median.toFixed(3), color: result.terminal_median >= 1 ? "text-pos" : "text-neg" },
              { label: "연환산 수익(평균)", val: pct(result.ann_return_mean), color: result.ann_return_mean >= 0 ? "text-pos" : "text-neg" },
              { label: "최대손실(평균)", val: pct(result.max_dd_mean), color: "text-warn" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-bg rounded p-2 border border-border">
                <p className="text-text-3 text-[10px] uppercase tracking-wider">{label}</p>
                <p className={`text-sm font-medium font-data mt-0.5 ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Percentile row */}
          <div className="flex gap-6 text-xs">
            <div>
              <span className="text-text-3">P5:</span>
              <span className="text-neg font-data ml-1">{result.terminal_p5.toFixed(3)}×</span>
            </div>
            <div>
              <span className="text-text-3">P95:</span>
              <span className="text-pos font-data ml-1">{result.terminal_p95.toFixed(3)}×</span>
            </div>
            <div>
              <span className="text-text-3">DD P95:</span>
              <span className="text-neg font-data ml-1">{pct(result.max_dd_p95)}</span>
            </div>
            <div>
              <span className="text-text-3">시뮬 수:</span>
              <span className="text-text-2 font-data ml-1">{result.n_simulations.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
