"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEdges, refreshEdgeValidation, getFleet,
  type EdgesResponse, type EdgeMetaRow, type EdgeTrajPoint,
  type FleetResponse, type FleetCollector,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

// ── 상태 색(예약 status 색만 사용) ──────────────────────────────────────────────
function edgeStatusStyle(s: string): string {
  switch (s) {
    case "significant": return "border-pos/40 text-pos bg-pos/10";
    case "no_data": return "border-warn/40 text-warn bg-warn/10";
    case "warming": return "border-accent/40 text-accent bg-accent/10";
    case "error": return "border-neg/40 text-neg bg-neg/10";
    default: return "border-text-3/30 text-text-3 bg-text-3/5"; // not_significant / pending
  }
}
function edgeStatusLabel(s: string): string {
  return ({ significant: "유의(FDR생존)", not_significant: "미유의", no_data: "데이터없음",
    warming: "계산중", pending: "대기(맥조립)", error: "오류" } as Record<string, string>)[s] ?? s;
}
function fleetStyle(v: string): string {
  if (v === "fresh") return "border-pos/40 text-pos bg-pos/10";
  if (v === "stale") return "border-warn/40 text-warn bg-warn/10";
  return "border-neg/40 text-neg bg-neg/10"; // dead
}
function fmtP(p: number | null | undefined): string {
  return typeof p === "number" ? p.toFixed(4) : "—";
}
function fmtAge(s: number | null | undefined): string {
  if (typeof s !== "number") return "—";
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

// ── p-value 감쇠 스파크라인(인라인 SVG, 저비용). y=낮을수록 좋음 → 위로 반전 ──────
function Sparkline({ traj, dir }: { traj: EdgeTrajPoint[]; dir: string }) {
  const pts = traj.map((r) => r.min_p_value).filter((v): v is number => typeof v === "number");
  if (pts.length < 2) return <span className="text-text-3 text-xs">—</span>;
  const w = 88, h = 24, pad = 2;
  const max = Math.max(...pts), min = Math.min(...pts);
  const span = max - min || 1;
  const stroke = dir === "improving" ? "var(--color-pos)" : dir === "decaying" ? "var(--color-neg)" : "var(--color-text-3)";
  const d = pts.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (pts.length - 1);
    const y = pad + ((v - min) / span) * (h - 2 * pad); // p 낮음=위(좋음)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label={`p-value 추세 ${dir}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

// ── p-value 크기 바(작을수록 강함 → 바 길이 = 1-p) ──────────────────────────────
function PBar({ p }: { p: number | null }) {
  if (typeof p !== "number") return <span className="text-text-3 text-xs">—</span>;
  const frac = Math.max(0, Math.min(1, 1 - p));
  const strong = p <= 0.05;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-text-3/20 overflow-hidden">
        <div className={strong ? "h-full bg-pos" : "h-full bg-text-3"} style={{ width: `${frac * 100}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${strong ? "text-pos" : "text-text-2"}`}>{fmtP(p)}</span>
    </div>
  );
}

function Tile({ label, value, tone = "text-text-1" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border border-text-3/20 px-3 py-2">
      <div className="text-text-3 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-xl tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export default function EdgesPage() {
  const [edges, setEdges] = useState<EdgesResponse | null>(null);
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fleetErr, setFleetErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try { setEdges(await getEdges(ac.signal)); setErr(null); }
    catch (e) { if (!ac.signal.aborted) setErr(String(e)); }
    try { setFleet(await getFleet(ac.signal)); setFleetErr(null); }
    catch (e) { if (!ac.signal.aborted) setFleetErr(String(e)); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // 함대 신선도 갱신
    return () => { clearInterval(t); abortRef.current?.abort(); };
  }, [load]);

  const pf = edges?.portfolio;

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg text-text-1">엣지 포트폴리오</h1>
          <p className="text-text-3 text-xs">
            전 가설 검증 상태(FDR 생존/최소 p-value/표본) + 감쇠 궤적. 스크리닝 결과일 뿐 실집행 근거 아님.
          </p>
        </div>
        <button
          onClick={() => { refreshEdgeValidation().then(load); }}
          className="border border-accent/40 text-accent bg-accent/10 px-3 py-1 text-xs hover:bg-accent/20"
        >검증 재계산</button>
      </div>

      {/* 포트폴리오 요약 */}
      {pf && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="유의(FDR)" value={pf.n_significant} tone="text-pos" />
          <Tile label="검증가능" value={pf.n_warmable} />
          <Tile label="대기(맥)" value={pf.n_pending} tone="text-text-2" />
          <Tile label="전체 가설" value={pf.n_total} />
        </div>
      )}

      {/* 수집기 함대 헬스 */}
      <Panel>
        <PanelHeader right={fleet && (
          <span className={`text-xs px-2 py-0.5 border ${fleetStyle(fleet.worst_verdict)}`}>
            {fleet.ok ? "정상" : `주의: ${fleet.worst_verdict}`}
          </span>
        )}>수집기 함대 헬스</PanelHeader>
        {fleetErr && <div className="text-neg text-xs px-3 py-2">함대 조회 실패(백엔드 미기동?): {fleetErr}</div>}
        {fleet && (
          <div className="px-3 pb-3">
            <div className="text-text-3 text-xs mb-2">
              fresh {fleet.counts.fresh} · stale {fleet.counts.stale} · dead {fleet.counts.dead} / {fleet.n_total}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {fleet.collectors.map((c: FleetCollector) => (
                <div key={c.key} className="flex items-center justify-between border border-text-3/15 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-1.5 py-0.5 border shrink-0 ${fleetStyle(c.verdict)}`}>{c.verdict}</span>
                    <span className="text-text-2 text-xs truncate">{c.key}</span>
                  </div>
                  <span className="text-text-3 text-xs tabular-nums shrink-0" title={c.reason}>
                    {fmtAge(c.age_sec)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* 엣지 테이블 */}
      <Panel>
        <PanelHeader right={edges && (
          <span className="text-text-3 text-xs">
            {edges.warming ? "계산중…" : edges.age_sec != null ? `${fmtAge(edges.age_sec)} 전` : ""}
          </span>
        )}>가설별 검증</PanelHeader>
        {err && <div className="text-neg text-xs px-3 py-2">엣지 조회 실패(백엔드 미기동?): {err}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-3 text-xs text-left border-b border-text-3/20">
                <th className="px-3 py-2 font-normal">가설</th>
                <th className="px-3 py-2 font-normal">상태</th>
                <th className="px-3 py-2 font-normal">최소 p-value</th>
                <th className="px-3 py-2 font-normal">FDR 생존</th>
                <th className="px-3 py-2 font-normal">표본</th>
                <th className="px-3 py-2 font-normal">감쇠</th>
              </tr>
            </thead>
            <tbody>
              {edges?.edges.map((e: EdgeMetaRow) => (
                <tr key={e.key} className="border-b border-text-3/10 align-middle">
                  <td className="px-3 py-2">
                    <div className="text-text-1">{e.title}</div>
                    <div className="text-text-3 text-xs">{e.category} · {e.data_source}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 border whitespace-nowrap ${edgeStatusStyle(e.status)}`}>
                      {edgeStatusLabel(e.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2"><PBar p={e.summary?.min_p_value ?? null} /></td>
                  <td className="px-3 py-2 text-text-2 text-xs tabular-nums">
                    {e.summary ? `${e.summary.n_survivors}/${e.summary.n_tested}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-text-2 text-xs tabular-nums">
                    {e.summary ? e.summary.n_events.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2"><Sparkline traj={e.trajectory} dir={e.trend.direction} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
