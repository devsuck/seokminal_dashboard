"use client";
// P121-130 — Research Agents Workspace. Director→Analyst→Strategy→Critic→Writer. Analysis only.
// /console/agent-workspace. READ ONLY · 분석 전용 에이전트 · 자동 거래·집행·투자결정 없음.
import { useCallback, useEffect, useState } from "react";
import { getAgentWorkspace, type AgentWorkspaceResp } from "@/lib/console-api";
import { PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const ROLE_TONE: Record<string, string> = {
  director: "var(--c-hud)", specialist: "var(--c-blue)", critic: "var(--c-warn)", report: "var(--c-emerald)",
};
const VERDICT_TONE: Record<string, "pos" | "warn" | "neg"> = { PASS: "pos", WARN: "warn", BLOCK: "neg" };
const EXAMPLES = [
  "고변동성 상황에서 한국 주식의 모멘텀",
  "비트코인 펀딩비 역전 시 숏 스퀴즈 가능성",
  "실적 발표 전후 옵션 내재변동성 왜곡",
];

function Caption({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-2.5 text-[10.5px] text-[var(--c-text-3)] leading-relaxed">{children}</div>;
}

export default function ResearchAgents() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<AgentWorkspaceResp | null>(null);
  const [loading, setLoading] = useState(true);
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
  const submit = (text: string) => { setQ(text); run(text); };

  return (
    <div className="min-h-full">
      <PageHeader kicker="P121-130" title="리서치 에이전트"
        right={cf && <Badge tone={VERDICT_TONE[cf.verdict] ?? "mute"}>{cf.verdict}</Badge>} />
      <div className="p-5 space-y-5 max-w-[1400px]">
        {/* ── 목표 입력 히어로 ── */}
        <Panel hud className="p-5">
          <div className="text-[13px] font-semibold text-[var(--c-text-1)]">무엇을 연구할까요?</div>
          <div className="mt-1 text-[11px] text-[var(--c-text-3)] leading-relaxed">
            연구 목표를 입력하면 Director → Analyst → Strategy → Critic → Writer 순으로 다중 에이전트가 분석합니다. 결과는 분석 자료일 뿐, 자동 거래·집행·투자결정은 없습니다.
          </div>
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 고변동성 상황에서 한국 주식의 모멘텀"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3.5 h-11 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 h-11 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--c-bg)] bg-[var(--c-hud)] cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {loading && <span className="h-3 w-3 rounded-full border-2 border-[color-mix(in_srgb,var(--c-bg)_40%,transparent)] border-t-[var(--c-bg)] animate-spin" />}
              {loading ? "분석 중…" : "리서치 실행"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[9.5px] text-[var(--c-text-3)] uppercase tracking-[0.14em] mr-1 self-center">예시</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => submit(ex)} disabled={loading}
                className="px-2.5 py-1 text-[10.5px] text-[var(--c-text-2)] border border-[var(--c-border)] c-panel-2 hover:border-[var(--c-hud)] hover:text-[var(--c-hud)] transition-colors disabled:opacity-40 cursor-pointer">
                {ex}
              </button>
            ))}
          </div>
        </Panel>

        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        <StateBlock loading={loading && !data} err={null}>
          {data && (
            <div className="space-y-4">
              {/* Active Research — pipeline */}
              <Panel>
                <PanelHead kicker="활성 리서치" title={ar?.objective || "—"}
                  right={data.is_demo ? <Badge tone="mute">데모 목표</Badge> : <Badge tone="hud">사용자 목표</Badge>} />
                <Caption>연구 목표가 어떤 순서로, 누구에게 배정돼 처리됐는지 보여줍니다.</Caption>
                <div className="p-4 pt-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(ar?.pipeline ?? []).map((stage, i) => (
                      <div key={stage} className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 border border-[var(--c-pos)]/40 text-[var(--c-text-1)] c-panel-2">
                          <span className="text-[var(--c-pos)]">✓</span>{stage}
                        </span>
                        {i < (ar?.pipeline.length ?? 0) - 1 && <span className="text-[var(--c-text-3)]">→</span>}
                      </div>
                    ))}
                  </div>
                  {ar?.director_plan?.hypothesis && (
                    <div className="mt-3 border-l-2 border-[var(--c-hud)] pl-3 py-1">
                      <div className="text-[9px] tracking-[0.15em] text-[var(--c-hud)] uppercase mb-1">가설</div>
                      <div className="text-[12px] text-[var(--c-text-1)] leading-relaxed">{ar.director_plan.hypothesis}</div>
                    </div>
                  )}
                </div>
              </Panel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Agent Status */}
                <Panel>
                  <PanelHead kicker="에이전트 상태" title="참여 에이전트" right={<Badge tone="hud">{data.agents.length}</Badge>} />
                  <Caption>이 리서치를 처리한 전문 에이전트 목록입니다.</Caption>
                  <div className="p-4 pt-3 space-y-1.5">
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
                  <PanelHead kicker="비평 피드백" title="리서치 리뷰" right={cf && <Badge tone={VERDICT_TONE[cf.verdict] ?? "mute"}>{cf.verdict}</Badge>} />
                  <Caption>Critic 에이전트가 위 결과의 품질을 자동 검수한 결과입니다.</Caption>
                  <div className="p-4 pt-3 space-y-2">
                    {cf?.quality?.grade && <div className="flex gap-3"><StatTile label="품질" value={`등급 ${cf.quality.grade}`} tone={cf.quality.grade === "A" || cf.quality.grade === "B" ? "pos" : "warn"} /><StatTile label="판정" value={cf.verdict} tone={VERDICT_TONE[cf.verdict] === "neg" ? "neg" : VERDICT_TONE[cf.verdict] === "warn" ? "warn" : "pos"} /></div>}
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
                <PanelHead kicker="현재 작업" title="전문가 배정" right={<Badge tone="hud">{data.current_tasks.length}</Badge>} />
                <Caption>각 에이전트에게 할당된 세부 작업입니다.</Caption>
                <div className="p-4 pt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
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
                  <PanelHead kicker="생성된 보고서" title="리서치 보고서" right={rep && <Badge tone={rep.confidence === "HIGH" ? "pos" : rep.confidence === "MEDIUM" ? "hud" : "warn"}>{rep.confidence}</Badge>} />
                  <Caption>Writer 에이전트가 작성한 보고서 섹션입니다.</Caption>
                  <div className="p-4 pt-3 space-y-1.5">
                    {(rep?.sections ?? []).map((s) => <div key={s} className="text-[10.5px] text-[var(--c-text-2)]">· {s.replace(/_/g, " ")}</div>)}
                    {(rep?.limitations ?? []).length > 0 && <div className="pt-2"><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">한계</div>{rep?.limitations.map((l, i) => <div key={i} className="text-[10px] text-[var(--c-text-3)]">· {l}</div>)}</div>}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="사람 검토 큐" title="조치 필요" right={<Badge tone={data.human_review_queue.length ? "warn" : "pos"}>{data.human_review_queue.length}</Badge>} />
                  <Caption>사람의 최종 승인 없이는 어떤 결정도 실행되지 않습니다.</Caption>
                  <div className="p-4 pt-3 space-y-2">
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
            </div>
          )}
        </StateBlock>
      </div>
    </div>
  );
}
