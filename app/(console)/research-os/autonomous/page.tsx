"use client";
// P77 — Autonomous Runtime Dashboard. 자율 연구 루프 + 가설/비판/우선순위 미리보기.
// /console/autonomous-runtime 실데이터. READ ONLY · 제안·비판·우선순위·학습만, 실행/결정 없음. 사람 체크포인트.
import { useState, useCallback, useEffect } from "react";
import { getAutonomousRuntime, type AutonomousRuntimeResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const SEV: Record<string, string> = { PASS: "var(--c-pos)", WARN: "var(--c-warn)", BLOCK: "var(--c-neg)" };
const LOOP_TONE: Record<string, string> = { COMPLETED: "var(--c-pos)", BLOCKED: "var(--c-warn)", PENDING: "var(--c-hud)", PAUSED: "var(--c-warn)", CANCELLED: "var(--c-neg)" };

function LoopPipeline({ stages, trail }: { stages: string[]; trail: { stage: string; status: string }[] }) {
  const st = (s: string) => { const e = trail.filter((x) => x.stage === s); return e.length ? e[e.length - 1].status : ""; };
  return (
    <div className="flex flex-wrap gap-1">
      {stages.map((s) => {
        const status = st(s); const c = LOOP_TONE[status] ?? "var(--c-panel-3)";
        return (
          <div key={s} className="flex items-center gap-1 px-1.5 py-0.5" title={`${s}: ${status || "pending"}`}
            style={{ border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`, background: `color-mix(in srgb, ${c} 7%, transparent)` }}>
            <span className="h-1 w-1 rounded-full" style={{ background: c }} />
            <span className="text-[8.5px] font-semibold uppercase" style={{ color: status ? c : "var(--c-text-3)" }}>{s.replace(/_/g, " ")}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AutonomousRuntime() {
  const [q, setQ] = useState("momentum");
  const [data, setData] = useState<AutonomousRuntimeResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (topic: string) => {
    setLoading(true); setErr(null);
    try { setData(await getAutonomousRuntime(topic)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { run("momentum"); }, [run]);

  const crit = data?.preview?.critique;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P77" title="Autonomous Runtime"
        right={data && <Badge tone="warn">{data.counts.awaiting_checkpoint} checkpoints</Badge>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 주제로 자율 런타임 미리보기…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold tracking-wide uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-hud)_18%,transparent)] disabled:opacity-40 cursor-pointer transition-colors">{loading ? "…" : "Preview"}</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* 실행 중 루프 */}
            <Panel>
              <PanelHead kicker="P72" title="Active Loops" right={<Badge tone="hud">{data.counts.loops}</Badge>} />
              <div className="p-4 space-y-3">
                {data.loops.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">진행 중 루프 없음. CLI <span className="c-num text-[var(--c-text-2)]">python -m jarvis.research_workflow</span> 또는 백엔드에서 루프 시작 시 표시됩니다.</div>}
                {data.loops.map((lp) => (
                  <div key={lp.loop_id} className="c-panel-2 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-[var(--c-text-1)] truncate">{lp.idea}</span>
                      <div className="flex gap-1.5 shrink-0">
                        {lp.paused && <Badge tone="warn">PAUSED</Badge>}
                        {lp.blocked_stage && <Badge tone="warn">{lp.blocked_stage}</Badge>}
                        {lp.requires_human_checkpoint && <Badge tone="hud">CHECKPOINT</Badge>}
                      </div>
                    </div>
                    <LoopPipeline stages={data.loop_stages} trail={lp.audit_trail} />
                  </div>
                ))}
              </div>
            </Panel>

            {/* 미리보기: 가설 → 스펙 → 비판 → 우선순위 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel>
                <PanelHead kicker="P73·P76" title="Ranked Hypotheses" />
                <div className="p-4 space-y-2">
                  {(data.preview?.ranked?.items ?? []).slice(0, 5).map((it) => (
                    <div key={it.hypothesis_id} className="c-panel-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--c-text-1)]">#{it.rank} {it.statement.slice(0, 40)}</span>
                        <span className="text-[10px] c-num text-[var(--c-hud)]">{it.score}</span>
                      </div>
                      <div className="text-[9.5px] text-[var(--c-text-3)] mt-0.5">{it.source}</div>
                    </div>
                  ))}
                  {(data.preview?.hypotheses ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">메모리가 채워지면 가설이 생성됩니다.</div>}
                </div>
              </Panel>

              <Panel>
                <PanelHead kicker="P74" title="Recommended Experiment" />
                <div className="p-4 space-y-1.5">
                  {data.preview?.recommended_spec && Object.entries(data.preview.recommended_spec).filter(([k]) => ["strategy_name", "universe", "timeframe", "rebalance", "labels"].includes(k)).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[10.5px] py-1 border-b border-[var(--c-border)] last:border-0">
                      <span className="text-[var(--c-text-3)]">{k}</span><span className="c-num text-[var(--c-text-1)]">{String(v)}</span>
                    </div>
                  ))}
                  {!data.preview?.recommended_spec && <div className="text-[11px] text-[var(--c-text-3)]">가설 선택 후 스펙 생성.</div>}
                </div>
              </Panel>

              <Panel>
                <PanelHead kicker="P75" title="Critic"
                  right={crit && <Badge tone={crit.verdict === "BLOCK" ? "neg" : crit.verdict === "WARN" ? "warn" : "pos"}>{crit.verdict}</Badge>} />
                <div className="p-4 space-y-1">
                  {(crit?.critiques ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SEV[c.severity] }} />
                      <span className="text-[var(--c-text-2)]">{c.dimension.replace(/_/g, " ")}</span>
                      <span className="ml-auto c-num" style={{ color: SEV[c.severity] }}>{c.severity}</span>
                    </div>
                  ))}
                  {!crit && <div className="text-[11px] text-[var(--c-text-3)]">스펙 생성 후 자동 비판.</div>}
                </div>
              </Panel>
            </div>
            <div className="text-[10px] text-[var(--c-text-3)]">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
