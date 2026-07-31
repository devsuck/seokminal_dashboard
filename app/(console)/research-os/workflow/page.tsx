"use client";
// P68 — Research OS Workflow. 워크플로 단계·사람승인 상태·세션·큐. 세션 관리(create/pause/resume/archive)만 변경,
// 나머지는 READ ONLY. Human Decision 은 사람만 · 자동 거래·집행 없음.
import { useState, useEffect, useCallback } from "react";
import { getResearchWorkflow, sessionAction, type ResearchWorkflowResp } from "@/lib/console-api";
import { PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "var(--c-pos)", BLOCKED: "var(--c-warn)", PENDING: "var(--c-hud)",
  SKIPPED: "var(--c-text-3)", CANCELLED: "var(--c-neg)", FAILED: "var(--c-neg)",
};

function StagePipeline({ stages, log }: { stages: string[]; log: ResearchWorkflowResp["runs"][0]["execution_log"] }) {
  const statusOf = (st: string) => {
    const evs = log.filter((e) => e.stage === st);
    if (!evs.length) return "";
    return evs[evs.length - 1].status;
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {stages.map((st) => {
        const status = statusOf(st);
        const c = STATUS_TONE[status] ?? "var(--c-panel-3)";
        return (
          <div key={st} className="flex items-center gap-1.5 px-2 py-1"
            style={{ border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
            title={`${st}: ${status || "대기중"}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
            <span className="text-[9.5px] font-semibold tracking-wide uppercase" style={{ color: status ? c : "var(--c-text-3)" }}>
              {st.replace("_", " ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function WorkflowPage() {
  const [data, setData] = useState<ResearchWorkflowResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [goal, setGoal] = useState("");

  const load = useCallback(async () => {
    try { setData(await getResearchWorkflow()); setErr(null); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string, sessionId = "", g = "") => {
    setBusy(sessionId || action);
    try { await sessionAction(action, sessionId, g); await load(); if (action === "create") setGoal(""); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  };

  return (
    <div className="min-h-full">
      <PageHeader kicker="P68" title="리서치 워크플로"
        right={data && <Badge tone="warn">사람 승인 대기 {data.counts.awaiting_human}건</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
        <div className="p-5 space-y-5">
          {/* KPI band — what's happening, at a glance */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="워크플로 실행" value={data.counts.runs} accent="hud" />
            <StatTile label="사람 대기" value={data.counts.awaiting_human} accent="warn" tone="warn" sub="사람 결정 게이트" />
            <StatTile label="활성 세션" value={data.counts.active_sessions} accent="pos" sub={`총 ${data.counts.sessions}건`} />
            <StatTile label="큐 제안" value={data.counts.proposals} accent="info" />
          </div>

          {/* LEFT session control / CENTER pipeline workspace / RIGHT queue + action */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4 items-start">
            {/* LEFT — session control */}
            <Panel>
              <PanelHead kicker="P66" title="세션" right={<Badge tone="info">{data.sessions.length}</Badge>} />
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-[9.5px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase mb-1.5">새 세션 시작</div>
                  <div className="flex gap-2">
                    <input value={goal} onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && goal.trim()) act("create", "", goal); }}
                      placeholder="예: 고변동성 국면 모멘텀 리서치"
                      className="flex-1 min-w-0 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-2.5 h-8 text-[11.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
                    <button onClick={() => goal.trim() && act("create", "", goal)} disabled={!goal.trim() || busy === "create"}
                      className="shrink-0 px-3 h-8 text-[10.5px] font-semibold tracking-wide uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-hud)_16%,transparent)] disabled:opacity-40 cursor-pointer transition-colors">
                      {busy === "create" ? "생성 중…" : "생성"}
                    </button>
                  </div>
                </div>
                {data.sessions.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">세션 없음.</div>}
                {data.sessions.map((s) => (
                  <div key={s.session_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-[var(--c-text-1)] truncate">{s.goal}</span>
                      <Badge tone={s.state === "ACTIVE" ? "pos" : s.state === "PAUSED" ? "warn" : "mute"}>{s.state}</Badge>
                    </div>
                    <div className="text-[10px] text-[var(--c-text-3)] mt-1">
                      {s.pending_work.length}건 대기 · {s.completed_experiments.length}건 완료 · {s.lessons_learned.length}건 교훈
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {s.state !== "ARCHIVED" && s.state === "ACTIVE" && (
                        <SBtn label="일시정지" onClick={() => act("pause", s.session_id)} busy={busy === s.session_id} />
                      )}
                      {s.state === "PAUSED" && (
                        <SBtn label="재개" onClick={() => act("resume", s.session_id)} busy={busy === s.session_id} tone="pos" />
                      )}
                      {s.state !== "ARCHIVED" && (
                        <SBtn label="보관" onClick={() => act("archive", s.session_id)} busy={busy === s.session_id} tone="mute" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* CENTER — pipeline workspace: what's happening */}
            <Panel>
              <PanelHead kicker="오케스트레이션" title="활성 리서치 워크플로" />
              <div className="p-4 space-y-3">
                {data.runs.length === 0 && (
                  <div className="text-[11px] text-[var(--c-text-3)]">
                    진행 중 워크플로 없음. 백엔드 CLI <span className="c-num text-[var(--c-text-2)]">python -m jarvis.research_workflow run --request &quot;…&quot; --commit</span> 로 시작할 수 있습니다.
                  </div>
                )}
                {data.runs.map((r) => (
                  <div key={r.run_id} className="c-panel-2 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-[var(--c-text-1)] truncate">{r.request}</span>
                      <div className="flex gap-1.5 shrink-0">
                        {r.cancelled && <Badge tone="neg">취소됨</Badge>}
                        {r.blocked_stage && <Badge tone="warn">차단됨 · {r.blocked_stage}</Badge>}
                        {r.requires_human_decision && <Badge tone="hud">사람 결정 필요</Badge>}
                      </div>
                    </div>
                    <StagePipeline stages={data.stages} log={r.execution_log} />
                    <div className="text-[10px] c-num text-[var(--c-text-3)]">{r.completed_stages.length}/{data.stages.length} 단계 · {r.run_id}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* RIGHT — action + forward-looking queue */}
            <div className="space-y-4">
              {data.counts.awaiting_human > 0 && (
                <Panel className="relative overflow-hidden">
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-warn)]" />
                  <div className="p-3">
                    <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-warn)] uppercase">조치 필요</div>
                    <div className="mt-1.5 text-[12px] text-[var(--c-text-1)] leading-snug">
                      {data.counts.awaiting_human}건이 사람 결정 대기 중입니다. 위 파이프라인에서 <span className="text-[var(--c-hud)]">사람 결정 필요</span> 배지를 확인하세요.
                    </div>
                  </div>
                </Panel>
              )}
              <Panel>
                <PanelHead kicker="P58" title="리서치 큐" right={<Badge tone="pos">{data.queue.proposal_count}</Badge>} />
                <div className="p-4 space-y-2">
                  {(data.queue.proposals ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">메모리가 채워지면 후보가 제안됩니다.</div>}
                  {(data.queue.proposals ?? []).map((p) => (
                    <div key={p.proposal_id} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{p.name}</span>
                        <Badge tone="info">{p.kind}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">{p.reason}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <div className="text-[10px] text-[var(--c-text-3)]">{data.disclaimer}</div>
        </div>
        )}
      </StateBlock>
    </div>
  );
}

function SBtn({ label, onClick, busy, tone = "hud" }: { label: string; onClick: () => void; busy: boolean; tone?: string }) {
  const c = tone === "pos" ? "var(--c-pos)" : tone === "mute" ? "var(--c-text-3)" : "var(--c-hud)";
  return (
    <button onClick={onClick} disabled={busy}
      className="px-2 py-1 text-[9.5px] font-semibold tracking-wide uppercase disabled:opacity-40 cursor-pointer transition-colors"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}>
      {busy ? "…" : label}
    </button>
  );
}
