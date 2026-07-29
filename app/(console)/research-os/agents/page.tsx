"use client";
// P121-130 — Research Agents Workspace. Director→Analyst→Strategy→Critic→Writer. Analysis only.
// /console/agent-workspace. READ ONLY · 분석 전용 에이전트 · 자동 거래·집행·투자결정 없음.
import { useCallback, useEffect, useState } from "react";
import { getAgentWorkspace, type AgentWorkspaceResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const ROLE_TONE: Record<string, string> = {
  director: "var(--c-hud)", specialist: "var(--c-blue)", critic: "var(--c-warn)", report: "var(--c-emerald)",
};
const VERDICT_TONE: Record<string, "pos" | "warn" | "neg"> = { PASS: "pos", WARN: "warn", BLOCK: "neg" };

export default function ResearchAgents() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<AgentWorkspaceResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (objective: string) => {
    setLoading(true); setErr(null);
    try { setData(await getAgentWorkspace(objective)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { run(""); }, [run]);

  const ar = data?.active_research;
  const cf = data?.critic_feedback;
  const rep = data?.generated_reports?.[0];
  return (
    <div className="min-h-full">
      <PageHeader kicker="P121-130" title="Research Agents"
        right={cf && <Badge tone={VERDICT_TONE[cf.verdict] ?? "mute"}>{cf.verdict}</Badge>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 목표를 입력… (예: momentum in KR equities under high volatility)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer disabled:opacity-40">{loading ? "…" : "Research"}</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* Active Research — pipeline */}
            <Panel>
              <PanelHead kicker="Active Research" title={ar?.objective || "—"}
                right={data.is_demo ? <span className="text-[9px] text-[var(--c-text-3)] uppercase">demo</span> : null} />
              <div className="p-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(ar?.pipeline ?? []).map((stage, i) => (
                    <div key={stage} className="flex items-center gap-1.5">
                      <span className="text-[11px] px-2.5 py-1 border border-[var(--c-border)] text-[var(--c-text-1)] c-panel-2">{stage}</span>
                      {i < (ar?.pipeline.length ?? 0) - 1 && <span className="text-[var(--c-text-3)]">→</span>}
                    </div>
                  ))}
                </div>
                {ar?.director_plan?.hypothesis && <div className="mt-3 text-[11px] text-[var(--c-text-2)]"><span className="text-[var(--c-hud)] uppercase text-[9px] tracking-[0.15em] mr-2">Hypothesis</span>{ar.director_plan.hypothesis}</div>}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Agent Status */}
              <Panel>
                <PanelHead kicker="Agent Status" title="Organization" right={<Badge tone="hud">{data.agents.length}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {data.agents.map((a) => {
                    const done = data.agent_status.some((s) => s.agent === a.agent && s.ok);
                    return (
                      <div key={a.agent} className="c-panel-2 p-2.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: done ? "var(--c-pos)" : "var(--c-text-3)", boxShadow: done ? "0 0 6px var(--c-pos)" : "none" }} />
                        <span className="text-[11.5px] text-[var(--c-text-1)] w-40 truncate">{a.agent}</span>
                        <span className="text-[9px] uppercase c-num" style={{ color: ROLE_TONE[a.role] ?? "var(--c-text-3)" }}>{a.role}</span>
                        <span className="text-[9px] text-[var(--c-text-3)] flex-1 truncate text-right">{a.used_engines.slice(0, 2).join(", ")}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* Critic Feedback */}
              <Panel>
                <PanelHead kicker="Critic Feedback" title="Research Review" right={cf && <Badge tone={VERDICT_TONE[cf.verdict] ?? "mute"}>{cf.verdict}</Badge>} />
                <div className="p-4 space-y-2">
                  {cf?.quality?.grade && <div className="flex gap-3"><StatTile label="Quality" value={`Grade ${cf.quality.grade}`} tone={cf.quality.grade === "A" || cf.quality.grade === "B" ? "pos" : "warn"} /><StatTile label="Verdict" value={cf.verdict} tone={VERDICT_TONE[cf.verdict] === "neg" ? "neg" : VERDICT_TONE[cf.verdict] === "warn" ? "warn" : "pos"} /></div>}
                  <div className="space-y-1 pt-1">
                    {Object.entries(cf?.dimensions ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[10.5px]">
                        <span className="text-[var(--c-text-2)]">{k}</span>
                        <span className="c-num text-[var(--c-text-3)]">{Array.isArray(v) ? (v.length ? v.join(", ") : "—") : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Current Tasks */}
            <Panel>
              <PanelHead kicker="Current Tasks" title="Specialist Assignments" right={<Badge tone="hud">{data.current_tasks.length}</Badge>} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {data.current_tasks.map((t, i) => (
                  <div key={i} className="c-panel-2 p-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[var(--c-text-1)] w-36 truncate">{t.agent}</span>
                    <span className="text-[10px] text-[var(--c-text-3)] flex-1 truncate">{t.task}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Generated Report + Human Review Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel>
                <PanelHead kicker="Generated Report" title="Research Report" right={rep && <Badge tone={rep.confidence === "HIGH" ? "pos" : rep.confidence === "MEDIUM" ? "hud" : "warn"}>{rep.confidence}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {(rep?.sections ?? []).map((s) => <div key={s} className="text-[10.5px] text-[var(--c-text-2)]">· {s.replace(/_/g, " ")}</div>)}
                  {(rep?.limitations ?? []).length > 0 && <div className="pt-2"><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">Limitations</div>{rep?.limitations.map((l, i) => <div key={i} className="text-[10px] text-[var(--c-text-3)]">· {l}</div>)}</div>}
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Human Review Queue" title="Actions Required" right={<Badge tone={data.human_review_queue.length ? "warn" : "pos"}>{data.human_review_queue.length}</Badge>} />
                <div className="p-4 space-y-2">
                  {data.human_review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토 대기 항목 없음.</div>}
                  {data.human_review_queue.map((h, i) => (
                    <div key={i} className="c-panel-2 p-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--c-text-1)] truncate">{h.objective}</span>
                      <div className="flex gap-1.5 shrink-0"><Badge tone={VERDICT_TONE[h.verdict] ?? "mute"}>{h.verdict}</Badge><Badge tone="mute">{h.confidence}</Badge></div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
