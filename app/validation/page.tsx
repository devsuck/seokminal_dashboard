"use client";

import { useEffect, useRef, useState } from "react";
import {
  getExperiments, getTsmomForward,
  type Experiment, type ExperimentsResponse, type TsmomForward,
} from "@/lib/api";

function statusStyle(s: string): string {
  if (s.startsWith("paper_candidate")) return "border-pos/40 text-pos bg-pos/10";
  if (s === "candidate") return "border-accent/40 text-accent bg-accent/10";
  if (s.startsWith("blocked")) return "border-warn/40 text-warn bg-warn/10";
  return "border-neg/30 text-neg bg-neg/5"; // rejected 등
}

function metricOf(e: Experiment): string {
  if (typeof e.sharpe === "number") return `Sharpe ${e.sharpe}`;
  if (typeof e.net_pnl === "number") return `net ${e.net_pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return "—";
}

function fmt(n: number | null | undefined, d = 3): string {
  return typeof n === "number" ? n.toFixed(d) : "—";
}

export default function ValidationPage() {
  const [exp, setExp] = useState<ExperimentsResponse | null>(null);
  const [tsmom, setTsmom] = useState<TsmomForward | null>(null);
  const [tsmomErr, setTsmomErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    (async () => {
      try {
        const e = await getExperiments(ctrl.signal);
        if (!ctrl.signal.aborted) setExp(e);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
      // TSMOM은 백테스트 도느라 느릴 수 있어 별도(실패해도 실험표는 뜨게)
      try {
        const t = await getTsmomForward(ctrl.signal);
        if (!ctrl.signal.aborted) setTsmom(t);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTsmomErr(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => ctrl.abort();
  }, []);

  const counts = exp?.counts ?? {};

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-1">Strategy Validation Terminal</h1>
        <p className="text-text-3 text-sm mt-1">
          당신의 전략이 진짜 엣지인지, 랜덤인지, 비용 후 죽는지 검증한다. — 알파 주장 아님, 검증 결과.
        </p>
      </div>

      {/* 상태 요약 */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className={`px-2.5 py-1 text-xs rounded border ${statusStyle(s)}`}>
            {s}: {n}
          </span>
        ))}
        <span className="px-2.5 py-1 text-xs rounded border border-border text-text-3">
          검증 live 엣지 0 · paper_candidate {counts["paper_candidate_forward_test_required"] ?? 0}
        </span>
      </div>

      {error && <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded px-4 py-2.5">
        백엔드 연결 실패: {error}</div>}
      {loading && <div className="text-text-3 text-sm">로딩 중…</div>}

      {/* 실험 테이블 */}
      {exp && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 text-text-2 text-sm font-medium">
            검증 실험 ({exp.total})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-data">
              <thead>
                <tr className="text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">가설</th>
                  <th className="px-3 py-2 text-left font-medium">상태</th>
                  <th className="px-3 py-2 text-right font-medium">지표</th>
                  <th className="px-4 py-2 text-left font-medium">판정</th>
                </tr>
              </thead>
              <tbody>
                {exp.experiments.map(e => (
                  <tr key={e.hypothesis_id} className="border-t border-border/50 hover:bg-panel-2">
                    <td className="px-4 py-2 text-text-1 font-medium">{e.hypothesis_id}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${statusStyle(e.status)}`}>{e.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-text-2">{metricOf(e)}</td>
                    <td className="px-4 py-2 text-text-3">{e.verdict ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TSMOM paper_candidate 상세 */}
      {tsmomErr && <div className="text-warn text-xs bg-warn/10 border border-warn/20 rounded px-4 py-2.5">
        TSMOM forward-test 데이터 없음(선물 데이터 pull 필요): {tsmomErr}</div>}
      {tsmom && <TsmomPanel t={tsmom} />}
    </div>
  );
}

function TsmomPanel({ t }: { t: TsmomForward }) {
  const env = t.backtest_envelope;
  const sleeves = Object.entries(t.sleeve_contribution).sort((a, b) => (b[1].sharpe ?? 0) - (a[1].sharpe ?? 0));
  const maxAbs = Math.max(...sleeves.map(([, v]) => Math.abs(v.sharpe ?? 0)), 0.1);
  const fwd = Object.entries(t.forward_months).sort();

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-2">
        <span className="text-text-1 text-sm font-medium">📈 {t.version}</span>
        <span className="px-2 py-0.5 rounded border border-pos/40 text-pos bg-pos/10 text-[10px]">{t.status}</span>
        <span className="ml-auto text-text-3 text-xs">as of {t.as_of} · ⚠️ PAPER, NO LIVE</span>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Backtest Sharpe" value={fmt(env.sharpe, 2)} tone="pos" />
        <Metric label="Max Drawdown" value={fmt(env.max_drawdown, 3)} tone="neg" />
        <Metric label="월수익 P10 / P90" value={`${fmt(env.monthly_p10, 3)} / ${fmt(env.monthly_p90, 3)}`} />
        <Metric label="Trend Regime" value={`${fmt(t.trend_regime.regime_score, 2)} (${fmt((t.trend_regime.trending_frac ?? 0) * 100, 0)}%)`} />
        <Metric label="Cost base / 20bps" value={`${fmt(t.cost.base_sharpe, 2)} / ${fmt(t.cost.stress_sharpe, 2)}`} />
        <Metric label="Avg Turnover" value={fmt(env.avg_turnover, 2)} />
        <Metric label="Universe" value={`${t.config_frozen.universe_n} 시장`} />
        <Metric label="Rebalance" value={`${t.config_frozen.rebalance_days}d`} />
      </div>

      {/* Sleeve contribution */}
      <div className="px-4 pb-4">
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">자산군 기여 (Sharpe)</p>
        <div className="space-y-1">
          {sleeves.map(([cls, v]) => {
            const sh = v.sharpe ?? 0;
            const pct = (Math.abs(sh) / maxAbs) * 100;
            return (
              <div key={cls} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-text-2">{cls}</span>
                <div className="flex-1 h-3 bg-panel-2 rounded overflow-hidden">
                  <div className={`h-full ${sh >= 0 ? "bg-pos" : "bg-neg"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`w-12 text-right font-data ${sh >= 0 ? "text-pos" : "text-neg"}`}>{fmt(sh, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forward months */}
      <div className="px-4 pb-4 border-t border-border pt-3">
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">Forward 월 (envelope 이탈)</p>
        {fwd.length === 0
          ? <p className="text-text-3 text-xs">아직 forward 월 없음 — 월마다 최신 선물 데이터 pull 후 재실행</p>
          : <div className="flex flex-wrap gap-1.5">
              {fwd.map(([m, v]) => {
                const dev = t.envelope_deviation[m];
                const tone = dev === "in_envelope" ? "text-text-2 border-border"
                  : dev === "ABOVE_P90" ? "text-pos border-pos/40" : "text-neg border-neg/40";
                return <span key={m} className={`px-2 py-0.5 rounded border text-[11px] font-data ${tone}`}>
                  {m}: {(v * 100).toFixed(1)}%</span>;
              })}
            </div>}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="bg-panel-2 border border-border rounded p-2.5">
      <p className="text-[10px] text-text-3 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-data mt-0.5 ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-text-1"}`}>{value}</p>
    </div>
  );
}
