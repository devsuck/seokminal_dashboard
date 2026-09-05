"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getPerformance, type PerfSummary } from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";

const PERIODS = ["1W", "1M", "3M", "1A"] as const;
const PERIOD_LABEL: Record<string, string> = { "1W": "1주", "1M": "1개월", "3M": "3개월", "1A": "1년" };

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-ap-surface border border-ap-line rounded-ap-lg shadow-ap-sm p-3">
      <div className="text-ap-ink-3 text-[11px] uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-data font-bold mt-1 ${cls ?? "text-ap-ink-1"}`}>{value}</div>
    </div>
  );
}

function pnlCls(v: number | null | undefined) {
  if (v == null) return "text-ap-ink-1";
  return v > 0 ? "text-ap-up" : v < 0 ? "text-ap-down" : "text-ap-ink-2";
}

// 의존성 없는 SVG 라인차트 (전략 vs 벤치마크)
function EquityChart({ data }: { data: PerfSummary }) {
  const W = 900, H = 300, P = 36;
  const pts = data.points;
  const eqs = pts.map(p => p.equity);
  const bens = pts.map(p => p.benchmark).filter((v): v is number => v != null);
  const lo = Math.min(...eqs, ...(bens.length ? bens : eqs));
  const hi = Math.max(...eqs, ...(bens.length ? bens : eqs));
  const pad = (hi - lo) * 0.08 || hi * 0.02 || 1;
  const yMin = lo - pad, yMax = hi + pad;
  const x = (i: number) => P + (i / Math.max(pts.length - 1, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - yMin) / (yMax - yMin || 1)) * (H - 2 * P);
  const line = (vals: (number | null | undefined)[]) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "300px" }}>
      {/* baseline (시작 equity) */}
      <line x1={P} x2={W - P} y1={y(eqs[0])} y2={y(eqs[0])} stroke="var(--color-ap-line)" strokeDasharray="3 3" />
      {/* benchmark */}
      {bens.length > 0 && (
        <polyline points={line(pts.map(p => p.benchmark))} fill="none" stroke="var(--color-ap-ink-3)" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* strategy */}
      <polyline points={line(eqs)} fill="none" stroke="var(--color-ap-brand)" strokeWidth="2" />
      {/* y labels */}
      <text x={4} y={y(yMax) + 4} fill="var(--color-ap-ink-3)" fontSize="10">{Math.round(yMax).toLocaleString()}</text>
      <text x={4} y={y(yMin) + 4} fill="var(--color-ap-ink-3)" fontSize="10">{Math.round(yMin).toLocaleString()}</text>
      {/* x labels (start/end) */}
      <text x={P} y={H - 8} fill="var(--color-ap-ink-3)" fontSize="10">{pts[0].date}</text>
      <text x={W - P} y={H - 8} fill="var(--color-ap-ink-3)" fontSize="10" textAnchor="end">{pts[pts.length - 1].date}</text>
    </svg>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<PerfSummary | null>(null);
  const [period, setPeriod] = useState("1M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    setLoading(true); setError(null);
    getPerformance(period, c.signal)
      .then(d => { if (!c.signal.aborted) { setData(d); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
    return () => c.abort();
  }, [period]);

  return (
    <div className="p-6 space-y-4 bg-ap-bg min-h-full">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-ap-ink-1 text-lg font-semibold">성과 추적</h1>
          <p className="text-ap-ink-3 text-sm mt-0.5">
            페이퍼 계좌(Alpaca) equity 곡선 · 수익률/MDD/Sharpe · <span className="text-ap-ink-2">SPY 매수보유</span> 벤치마크 대비. 전략이 그냥 지수 든 것보다 나은지 판단.
          </p>
        </div>
        <div className="flex rounded overflow-hidden border border-ap-line">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs ${period === p ? "bg-ap-brand/15 text-ap-brand" : "bg-ap-bg text-ap-ink-3 hover:text-ap-ink-2"}`}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {error ? <EmptyState message="성과 로드 실패" hint={error} textClass="text-ap-ink-3" />
        : loading ? <LoadingState message="성과 계산 중…" textClass="text-ap-ink-3" />
        : !data ? <EmptyState message="데이터 없음" textClass="text-ap-ink-3" />
        : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="수익률" value={`${data.return_pct > 0 ? "+" : ""}${data.return_pct}%`} cls={pnlCls(data.return_pct)} />
              <Metric label="최대낙폭 (MDD)" value={`${data.mdd_pct}%`} cls="text-ap-down" />
              <Metric label="Sharpe" value={`${data.sharpe}`} cls={data.sharpe >= 1 ? "text-ap-up" : "text-ap-ink-1"} />
              <Metric label="vs SPY (초과)"value={data.excess_pct != null ? `${data.excess_pct > 0 ? "+" : ""}${data.excess_pct}%` : "—"}
                cls={pnlCls(data.excess_pct)} />
            </div>

            <div className="bg-ap-surface border border-ap-line rounded-ap-lg shadow-ap-sm p-4">
              <div className="flex items-center gap-4 mb-2 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-ap-brand inline-block" /> 내 전략</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-ap-ink-3 inline-block" style={{ borderTop: "1px dashed" }} /> SPY 매수보유</span>
                <span className="ml-auto text-ap-ink-3 font-data">
                  ${data.start_equity.toLocaleString()} → ${data.end_equity.toLocaleString()}
                </span>
              </div>
              {data.points.length < 2 ? (
                <EmptyState message="거래 이력 부족" hint="페이퍼 매매 후 곡선이 그려집니다" textClass="text-ap-ink-3" />
              ) : <EquityChart data={data} />}
            </div>

            <p className="text-ap-ink-3 text-[11px]">
              ※ Sharpe ≥ 1 이면 위험대비 수익 양호. 초과수익(vs SPY)이 (-)면 그냥 지수 드는 게 나음 — 전략 재검토 신호.
            </p>
          </>
        )}
    </div>
  );
}
