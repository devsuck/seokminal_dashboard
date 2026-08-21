"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, useConsole, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";
import {
  getResearchWorkflow, sessionAction, type ResearchWorkflowResp, type SessionLite,
  getAutonomousResearch, type AutonomousResearchResp,
  getResearchStrategyGeneration, type ResearchStrategyGenerationResp,
  getStrategyLab, type StrategyLabResp,
  getAgentWorkspace, type AgentWorkspaceResp, type AgentRow,
  getResearchBrain, type ResearchBrainResp, type BrainNode, type BrainEdge,
  getCockpit, type CockpitResp,
  getOperatingConsole, type OperatingConsoleResp,
} from "@/lib/console-api";

type TabKey = "workflow" | "discovery" | "strategy-generation" | "strategy-lab" | "agents" | "brain" | "cockpit" | "console";
const TABS: { key: TabKey; label: string }[] = [
  { key: "workflow", label: "워크플로우" },
  { key: "discovery", label: "자율 발굴" },
  { key: "strategy-generation", label: "전략 후보 생성" },
  { key: "strategy-lab", label: "전략 랩" },
  { key: "agents", label: "리서치 에이전트" },
  { key: "brain", label: "리서치 브레인" },
  { key: "cockpit", label: "경영진 콕핏" },
  { key: "console", label: "운영 콘솔" },
];

function num(n: number | undefined | null, d = 0) {
  return typeof n === "number" && !Number.isNaN(n) ? n : d;
}

function PipelineInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "workflow";
  const setTab = (k: TabKey) => router.push(`/research-os/pipeline?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "workflow" && <WorkflowTab />}
      {tab === "discovery" && <DiscoveryTab />}
      {tab === "strategy-generation" && <StrategyGenerationTab />}
      {tab === "strategy-lab" && <StrategyLabTab />}
      {tab === "agents" && <AgentsTab />}
      {tab === "brain" && <BrainTab />}
      {tab === "cockpit" && <CockpitTab />}
      {tab === "console" && <ConsoleTab />}
    </div>
  );
}

export default function Pipeline() {
  return (
    <Suspense fallback={null}>
      <PipelineInner />
    </Suspense>
  );
}

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

function WorkflowTab() {
  const [data, setData] = useState<ResearchWorkflowResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [goal, setGoal] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try { const d = await getResearchWorkflow(ctrl.signal); if (!ctrl.signal.aborted) { setData(d); setErr(null); } }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

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
const LIFECYCLE = ["CREATED", "OBSERVING", "DISCOVERING", "GENERATING", "PRIORITIZING",
  "WAITING_HUMAN", "EXTERNAL_VALIDATION", "ANALYZING", "LEARNING", "COMPLETED"];
const DISCOVERY_EXAMPLES = [
  "Does momentum work in KR equities?",
  "한국 소형주에서 유동성 계절성이 있는가?",
  "암호화폐 오더플로우로 단기 방향성을 예측할 수 있는가?",
];

function DiscoveryTab() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<AutonomousResearchResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getAutonomousResearch(query, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); return () => abortRef.current?.abort(); }, [run]);
  const submit = (text: string) => { setQ(text); run(text); };

  const cyc = data?.cycle_status;
  const rel = data?.release;
  const lv = data?.loop_validation;
  const pa = data?.production_audit;
  const curIdx = cyc ? LIFECYCLE.indexOf(cyc.state) : -1;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P181-200 · Autonomous Research OS v3.0" title="자율 탐색 루프"
        right={rel && <div className="flex gap-1.5">
          <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>
          <Badge tone="neg">실행 {rel.execution}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        <Panel hud className="p-5">
          <div className="text-[13px] font-semibold text-[var(--c-text-1)]">어떤 질문으로 자율 탐색 사이클을 돌려볼까요?</div>
          <div className="mt-1 text-[11px] text-[var(--c-text-3)] leading-relaxed">
            연구 질문을 입력하면 기회 탐색 → 가설 생성 → 우선순위화 사이클을 실행합니다. WAITING_HUMAN 체크포인트에서 항상 멈추며, 사람 승인 없이는 자동 백테스트·실행으로 진행되지 않습니다.
          </div>
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 한국 소형주에서 유동성 계절성이 있는가?"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3.5 h-11 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 h-11 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--c-bg)] bg-[var(--c-hud)] cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {loading && <span className="h-3 w-3 rounded-full border-2 border-[color-mix(in_srgb,var(--c-bg)_40%,transparent)] border-t-[var(--c-bg)] animate-spin" />}
              {loading ? "실행 중…" : "사이클 실행"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[9.5px] text-[var(--c-text-3)] uppercase tracking-[0.14em] mr-1 self-center">예시</span>
            {DISCOVERY_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => submit(ex)} disabled={loading}
                className="px-2.5 py-1 text-[10.5px] text-[var(--c-text-2)] border border-[var(--c-border)] c-panel-2 hover:border-[var(--c-hud)] hover:text-[var(--c-hud)] transition-colors disabled:opacity-40 cursor-pointer">
                {ex}
              </button>
            ))}
          </div>
        </Panel>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {loading && !data && (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--c-text-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
            <span className="text-[11px] tracking-wider">로딩 중…</span>
          </div>
        )}

        {data && (
          <>
            {/* Cycle lifecycle rail */}
            <Panel>
              <PanelHead kicker="P181 · 리서치 사이클" title="라이프사이클 상태"
                right={cyc && <Badge tone={cyc.human_checkpoint_pending ? "warn" : "hud"}>{cyc.state}</Badge>} />
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1">
                  {LIFECYCLE.map((s, i) => (
                    <div key={s} className="flex items-center">
                      <span className={`text-[9px] px-2 py-1 border ${i === curIdx ? "border-[var(--c-warn)] text-[var(--c-warn)] bg-[color-mix(in_srgb,var(--c-warn)_10%,transparent)]" : i < curIdx ? "border-[color-mix(in_srgb,var(--c-pos)_40%,transparent)] text-[var(--c-pos)]" : "border-[var(--c-border)] text-[var(--c-text-3)]"}`}>{s}</span>
                      {i < LIFECYCLE.length - 1 && <span className="text-[var(--c-text-3)] mx-0.5">›</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-[var(--c-text-3)]">
                  auto_backtest: <span className="text-[var(--c-neg)]">{String(cyc?.auto_backtest)}</span> · WAITING_HUMAN 체크포인트에서 정지 — 사람 승인 없이 외부 검증 진입 불가.
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="기회" value={String(data.opportunities.count)} sub={`${Object.keys(data.opportunities.by_type).length}개 유형`} tone="hud" />
              <StatTile label="가설" value={String(data.hypotheses.count)} sub={`${data.hypotheses.with_why_different}건 차별점`} tone="pos" />
              <StatTile label="검토 큐" value={String(data.experiment_queue.queue_size)} sub="사람 체크포인트" tone="warn" />
              <StatTile label="루프/감사" value={lv?.validated && pa?.audited ? "통과" : "검토 필요"} sub={`원장 ${pa?.ledger_count ?? "—"} · 중복 ${pa?.duplicate_logic.length ?? 0}`} tone={lv?.validated && pa?.audited ? "pos" : "warn"} />
            </div>

            {/* Opportunities (P182) */}
            <Panel>
              <PanelHead kicker="P182 · 기회 탐색" title="리서치 기회 (신호 아님)"
                right={<Badge tone="hud">{data.opportunities.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.opportunities.items.map((o) => (
                  <div key={o.opportunity_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{o.observation}</span>
                      <div className="flex gap-1"><Badge tone="mute">{o.type}</Badge><Badge tone="neg">신호 아님</Badge></div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {o.possible_questions.map((qq, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)]">? {qq}</div>)}
                    </div>
                    <div className="text-[9px] c-num text-[var(--c-text-3)] mt-1">신뢰도 {o.confidence.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Hypothesis board (P183) */}
            <Panel>
              <PanelHead kicker="P183 · 가설 보드 (회상 우선)" title="리서치 가설"
                right={<Badge tone="hud">{data.hypotheses.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.hypotheses.items.map((h) => (
                  <div key={h.hypothesis_id} className="c-panel-2 p-3">
                    <div className="text-[11.5px] text-[var(--c-text-1)]">{h.question}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>참신성 {h.novelty.toFixed(2)}</span>
                      <span>신뢰도 {h.confidence.toFixed(2)}</span>
                      <span className={h.past_failures > 0 ? "text-[var(--c-warn)]" : ""}>과거 실패 {h.past_failures}</span>
                    </div>
                    <div className="text-[9.5px] text-[var(--c-text-3)] mt-0.5">왜 지금: {h.why_now}</div>
                    {h.why_different_this_time && <div className="text-[9.5px] text-[var(--c-warn)] mt-0.5">왜 다른가: {h.why_different_this_time}</div>}
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Experiment queue + Human review (P186) */}
              <Panel>
                <PanelHead kicker="P186 · 사람 리서치 게이트" title="실험 큐"
                  right={<Badge tone="warn">{data.experiment_queue.queue_size}</Badge>} />
                <div className="p-4 space-y-1.5">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {data.experiment_queue.available_actions.map((a) => <Badge key={a} tone="pos">{a}</Badge>)}
                    <Badge tone="neg">실행 불가</Badge><Badge tone="neg">백테스트 실행 불가</Badge>
                  </div>
                  {data.experiment_queue.requests.map((r) => (
                    <div key={r.request_id} className="c-panel-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-[var(--c-text-1)] truncate">{r.question}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{typeof r.priority_score === "number" ? r.priority_score.toFixed(3) : r.priority_score}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">APPROVE = 외부 테스트 요청 허용, 실행 아님.</div>
                </div>
              </Panel>

              {/* Research ranking (P185) */}
              <Panel>
                <PanelHead kicker="P185 · 리서치 랭킹" title="우선순위 큐" />
                <div className="p-4 space-y-1.5">
                  {data.research_ranking.queue.map((r) => (
                    <div key={r.rank} className="c-panel-2 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] c-num text-[var(--c-text-3)] w-4">{r.rank}</span>
                        <span className="text-[10.5px] text-[var(--c-text-1)] flex-1 truncate">{r.question}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{r.priority_score.toFixed(3)}</span>
                      </div>
                      <div className="text-[9px] text-[var(--c-text-3)] mt-0.5 pl-6 truncate">{r.why_important}</div>
                    </div>
                  ))}
                  <div className="text-[8.5px] text-[var(--c-text-3)] pt-1 c-num">{data.research_ranking.formula}</div>
                </div>
              </Panel>
            </div>

            {/* Metrics (P196) */}
            <Panel>
              <PanelHead kicker="P196 · 리서치 인텔리전스 지표" title="자율성 지표" />
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                {Object.entries(data.metrics).map(([k, v]) => (
                  <div key={k} className="c-panel-2 p-2">
                    <div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase truncate">{k}</div>
                    <div className="text-[12px] c-num text-[var(--c-text-1)]">{String(v ?? "—")}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Release + capabilities (P200) */}
            <Panel>
              <PanelHead kicker="P200 · 릴리스 v3.0" title={rel?.version || "Autonomous Research OS v3.0"}
                right={rel && <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1.5">Jarvis가 할 수 있는 것</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.can ?? []).map((c) => <Badge key={c} tone="pos">{c}</Badge>)}</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-neg)] uppercase mb-1.5">Jarvis가 할 수 없는 것</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.cannot ?? []).map((c) => <Badge key={c} tone="neg">✗ {c}</Badge>)}</div>
                  <div className="mt-2 text-[10px] text-[var(--c-text-3)] space-y-0.5">
                    <div>리서치 자동화: <span className="text-[var(--c-pos)]">{rel?.research_automation}</span></div>
                    <div>실행: <span className="text-[var(--c-neg)]">{rel?.execution}</span></div>
                    <div>결정 권한: <span className="text-[var(--c-hud)]">{rel?.decision_authority}</span></div>
                  </div>
                </div>
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
const STATE_TONE: Record<string, "hud" | "pos" | "warn" | "mute"> = {
  PROPOSED: "hud", ANALYZED: "hud", NOVELTY_CHECKED: "warn", REVIEWED: "pos", ARCHIVED: "mute",
};

function StrategyGenerationTab() {
  const [data, setData] = useState<ResearchStrategyGenerationResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getResearchStrategyGeneration(ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const s = data?.summary;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P29 · Research Strategy Generation" title="전략 후보 생성 원장"
        right={<button onClick={() => run()} disabled={loading}
          className="px-3.5 h-9 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-text-1)] border border-[var(--c-border)] hover:border-[var(--c-hud)] disabled:opacity-50 cursor-pointer">
          {loading ? "새로고침 중…" : "새로고침"}
        </button>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {loading && !data && (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--c-text-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
            <span className="text-[11px] tracking-wider">로딩 중…</span>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="세션" value={String(s?.session_count ?? 0)} sub={`이벤트 ${s?.session_event_count ?? 0}`} tone="hud" />
              <StatTile label="후보" value={String(s?.candidate_count ?? 0)} sub={`이벤트 ${s?.candidate_event_count ?? 0}`} tone="pos" />
              <StatTile label="가설" value={String(s?.hypothesis_count ?? 0)} sub={`신규성 ${s?.novelty_count ?? 0}`} tone="hud" />
              <StatTile label="증거/리포트" value={String(s?.evidence_count ?? 0)} sub={`리포트 ${s?.report_count ?? 0}`} tone="text-1" />
            </div>

            <Panel>
              <PanelHead kicker="rsg_candidates" title="전략 후보 (최신 상태)"
                right={<Badge tone="hud">{data.candidates.length}</Badge>} />
              <div className="p-4 space-y-2">
                {data.candidates.length === 0 && (
                  <div className="text-[11px] text-[var(--c-text-3)] py-6 text-center">
                    아직 생성된 후보 없음 — historical_candidate_bridge가 호출되면 여기 쌓임.
                  </div>
                )}
                {data.candidates.map((c) => (
                  <div key={c.candidate_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{c.statement}</span>
                      <div className="flex gap-1 shrink-0">
                        <Badge tone="mute">{c.category}</Badge>
                        <Badge tone={STATE_TONE[c.state] ?? "mute"}>{c.state}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>세션 {c.session_id}</span>
                      <span>{c.occurred_at}</span>
                      {c.source_refs.length > 0 && <span>근거 {c.source_refs.length}건</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
function StrategyLabTab() {
  const [q, setQ] = useState("momentum");
  const [data, setData] = useState<StrategyLabResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true); setErr(null);
    try { setData(await getStrategyLab(name)); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  const dna = data?.dna;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P91" title="전략 랩" right={data?.type && <Badge tone="hud">{data.type}</Badge>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전략명으로 DNA 조회… (예: momentum)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer disabled:opacity-40">{loading ? "…" : "DNA 시퀀싱"}</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {data && dna && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel>
              <PanelHead kicker="전략 DNA" title={data.strategy ?? ""} />
              <div className="p-4 space-y-1.5">
                <KV k="팩터" v={(dna.factors ?? []).join(", ") || "—"} />
                <KV k="유니버스" v={dna.universe || "—"} />
                <KV k="투자 기간" v={dna.time_horizon || "—"} />
                <KV k="진입 로직" v={dna.entry_logic || "—"} />
                <KV k="청산 로직" v={dna.exit_logic || "—"} />
                <KV k="검증" v={Array.isArray(dna.validation_method) ? `${(dna.validation_method as unknown[]).length}개 항목` : String(dna.validation_method)} />
              </div>
            </Panel>
            <div className="space-y-4">
              <Panel>
                <PanelHead kicker="리스크 모델" title="취약점" />
                <div className="p-4 space-y-1.5">
                  <KV k="주요 리스크" v={String((dna.risk_model as Record<string, unknown>)?.main_risk ?? "—")} />
                  <KV k="약점" v={String((dna.risk_model as Record<string, unknown>)?.weakness ?? "—")} mono={false} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(((dna.risk_model as Record<string, unknown>)?.category_flags ?? {}) as Record<string, string>).map(([c, sev]) => (
                      <Badge key={c} tone={sev === "HIGH" ? "neg" : sev === "MEDIUM" ? "warn" : "mute"}>{c} {sev}</Badge>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="히스토리" title="실패 & 국면"
                  right={data.repeated_mistakes?.made_this_mistake && <Badge tone="warn">반복 위험</Badge>} />
                <div className="p-4 space-y-2">
                  <KV k="실패 횟수" v={dna.failure_history?.count ?? 0} />
                  {data.repeated_mistakes?.headline && <div className="text-[10.5px] text-[var(--c-warn)]">{data.repeated_mistakes.headline}</div>}
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mt-2 mb-1">성공 국면</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(dna.successful_regimes ?? []).map((r) => <Badge key={r} tone="pos">{r}</Badge>)}
                    {(dna.successful_regimes ?? []).length === 0 && <span className="text-[10px] text-[var(--c-text-3)]">—</span>}
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}
        {data?.note && !dna && <div className="c-panel p-6 text-center text-[12px] text-[var(--c-text-3)]">{data.note}</div>}
      </div>
    </div>
  );
}
const ROLE_TONE: Record<string, string> = {
  director: "var(--c-hud)", specialist: "var(--c-blue)", critic: "var(--c-warn)", report: "var(--c-emerald)",
};
const VERDICT_TONE: Record<string, "pos" | "warn" | "neg"> = { PASS: "pos", WARN: "warn", BLOCK: "neg" };
const AGENTS_EXAMPLES = [
  "고변동성 상황에서 한국 주식의 모멘텀",
  "비트코인 펀딩비 역전 시 숏 스퀴즈 가능성",
  "실적 발표 전후 옵션 내재변동성 왜곡",
];

function Caption({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-2.5 text-[10.5px] text-[var(--c-text-3)] leading-relaxed">{children}</div>;
}

function AgentsTab() {
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
            {AGENTS_EXAMPLES.map((ex) => (
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
const HEALTH_TONE: Record<string, "pos" | "warn" | "neg" | "mute"> = {
  HEALTHY: "pos", FAIR: "warn", DEGRADED: "neg", EMPTY: "mute",
};
// research-chain column order for the graph layout
const COL: Record<string, number> = {
  Question: 0, Hypothesis: 1, Experiment: 2, Strategy: 2, Failure: 3, Risk: 3, Lesson: 4,
  Sector: 3, MacroEvent: 3, DecisionMemo: 4,
};
const BRAIN_TYPE_TONE: Record<string, string> = {
  Question: "var(--c-hud)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-emerald)",
  Strategy: "var(--c-emerald)", Failure: "var(--c-neg)", Risk: "var(--c-warn)",
  Lesson: "var(--c-pos)", Sector: "var(--c-blue)", MacroEvent: "var(--c-warn)", DecisionMemo: "var(--c-text-2)",
};

function BrainTab() {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<ResearchBrainResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (t: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    try { const d = await getResearchBrain(t, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
  }, []);
  useEffect(() => { run(""); return () => abortRef.current?.abort(); }, [run]);

  const kh = data?.knowledge_health;
  const layout = useMemo(() => {
    const nodes = data?.knowledge_graph.nodes ?? [];
    const colY: Record<number, number> = {};
    const pos: Record<string, { x: number; y: number; n: BrainNode }> = {};
    for (const n of nodes) {
      const c = COL[n.type] ?? 4;
      colY[c] = (colY[c] ?? 0) + 1;
      pos[n.id] = { x: 70 + c * 200, y: 40 + (colY[c] - 1) * 46, n };
    }
    return pos;
  }, [data]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P131-140" title="리서치 브레인"
        right={kh && <Badge tone={HEALTH_TONE[kh.grade] ?? "mute"}>{kh.grade} {kh.health_score ?? ""}</Badge>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(topic); }} className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제 필터 (예: 모멘텀, TSMC)…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">조회</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="그래프 노드" value={data.knowledge_graph.node_count} sub="지식" tone="hud" />
              <StatTile label="교훈" value={data.lessons.length} sub="누적됨" tone="pos" />
              <StatTile label="충돌" value={data.conflicts.length} sub="모순" tone={data.conflicts.length ? "warn" : "pos"} />
              <StatTile label="지식 헬스" value={kh?.grade ?? "—"} sub={`${kh?.health_score ?? 0} / 100`} tone={HEALTH_TONE[kh?.grade ?? ""] === "neg" ? "neg" : HEALTH_TONE[kh?.grade ?? ""] === "warn" ? "warn" : "pos"} />
            </div>

            {/* Knowledge Graph */}
            <Panel>
              <PanelHead kicker="지식 그래프" title="질문 → 가설 → 실험 → 결과 → 교훈"
                right={<div className="flex gap-1.5 flex-wrap">{data.knowledge_graph.research_chain.map((c) => <span key={c} className="text-[9px] uppercase c-num text-[var(--c-text-3)]">{c}</span>)}</div>} />
              <div className="p-4 overflow-x-auto">
                {data.knowledge_graph.node_count === 0 ? (
                  <div className="text-[11px] text-[var(--c-text-3)]">연구가 축적되면 질문→가설→실험→결과→교훈 지식 그래프가 나타납니다(기존 원장 파생).</div>
                ) : (
                  <svg width={1080} height={Math.max(260, 60 + Math.max(...Object.values(layout).map((p) => p.y), 0))} className="min-w-[1080px]">
                    {data.knowledge_graph.edges.map((e, i) => {
                      const a = layout[e.source], b = layout[e.target];
                      if (!a || !b) return null;
                      return <line key={i} x1={a.x + 60} y1={a.y + 10} x2={b.x} y2={b.y + 10} stroke="var(--c-border)" strokeWidth="1" />;
                    })}
                    {Object.values(layout).map(({ x, y, n }) => (
                      <g key={n.id}>
                        <rect x={x} y={y} width={120} height={20} rx={3} fill="var(--c-panel-2)" stroke={BRAIN_TYPE_TONE[n.type] ?? "var(--c-border)"} strokeWidth="1" />
                        <text x={x + 6} y={y + 14} fontSize="9.5" fill="var(--c-text-1)" className="c-num">{n.label.slice(0, 16)}</text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Failure Patterns */}
              <Panel>
                <PanelHead kicker="실패 패턴" title="실패 원인" right={<Badge tone={data.failure_patterns.total_failures ? "neg" : "pos"}>{data.failure_patterns.total_failures}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.keys(data.failure_patterns.by_category).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">실패가 기록되면 분류별 패턴이 나타납니다.</div>}
                  {Object.entries(data.failure_patterns.by_category).map(([k, n]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-2)] w-48">{k}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[var(--c-neg)]" style={{ width: `${Math.min(100, (n as number) * 20)}%` }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-3)] w-6 text-right">{n}</span>
                    </div>
                  ))}
                  {data.failure_patterns.top_category && <div className="text-[10px] text-[var(--c-warn)] pt-1">최다: {data.failure_patterns.top_category}</div>}
                </div>
              </Panel>

              {/* Conflicts */}
              <Panel>
                <PanelHead kicker="충돌" title="상반된 결론" right={<Badge tone={data.conflicts.length ? "warn" : "pos"}>{data.conflicts.length}</Badge>} />
                <div className="p-4 space-y-2">
                  {data.conflicts.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">같은 주제에서 유효 vs 실패 모순이 감지되면 여기에 표시됩니다.</div>}
                  {data.conflicts.map((c, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="flex items-center gap-2"><span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{c.topic}</span></div>
                      <div className="flex gap-2 mt-1"><Badge tone="pos">A: {c.study_a.conclusion}</Badge><Badge tone="neg">B: {c.study_b.conclusion}</Badge>{c.period && <span className="text-[9px] c-num text-[var(--c-text-3)]">{c.period}</span>}</div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">{c.possible_explanation}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Strategy + Company Memory + Lessons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MemoryList title="전략 메모리" kicker="전략" nodes={data.strategy_memory} tone="var(--c-emerald)" />
              <MemoryList title="기업 메모리" kicker="기업" nodes={data.company_memory} tone="var(--c-blue)" />
              <MemoryList title="교훈" kicker="학습됨" nodes={data.lessons} tone="var(--c-pos)" />
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryList({ title, kicker, nodes, tone }: { title: string; kicker: string; nodes: BrainNode[]; tone: string }) {
  return (
    <Panel>
      <PanelHead kicker={kicker} title={title} right={<Badge tone="hud">{nodes.length}</Badge>} />
      <div className="p-4 space-y-1">
        {nodes.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">—</div>}
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full shrink-0" style={{ background: tone }} />
            <span className="text-[10.5px] text-[var(--c-text-2)] truncate">{n.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
const CONF: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const bandTone = (b?: string) => (b === "HEALTHY" ? "pos" : b === "FAIR" ? "hud" : "warn");
const STAGE_TONE: Record<string, string> = {
  Idea: "var(--c-text-3)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-hud)",
  Backtest: "var(--c-hud)", Validation: "var(--c-pos)", Failure: "var(--c-neg)",
  Lesson: "var(--c-emerald)", "Portfolio Effect": "var(--c-blue)", "Decision Memo": "var(--c-warn)",
  "Human Review": "var(--c-warn)", Archive: "var(--c-text-3)", Risk: "var(--c-neg)", Paper: "var(--c-blue)",
};

function CockpitTab() {
  const { data, err, loading } = useConsole<CockpitResp>((s) => getCockpit(s), [], 60000);
  return (
    <div className="min-h-full">
      <PageHeader title="리서치 콕핏"
        right={data && <Badge tone={bandTone(data.research_health?.health_band)}>헬스 {num(data.health_score, 1)}</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
          <div className="p-5 space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatTile label="리서치 레코드" value={num(data.research?.total_records)}
                sub={`${num(data.research?.experiment_runs)}건 실행`} />
              <StatTile label="헬스 점수" value={num(data.health_score, 1)} accent={bandTone(data.research_health?.health_band)}
                tone={bandTone(data.research_health?.health_band) === "pos" ? "pos" : "warn"} sub={data.research_health?.health_band} />
              <StatTile label="검토 대기" value={data.human_review_queue?.length ?? 0} accent="warn" tone="warn" />
              <StatTile label="지식" value={num(data.knowledge_growth?.total)}
                sub={`${num(data.knowledge_graph?.node_count)}개 그래프 노드`} />
              <StatTile label="기회" value={data.top_opportunities?.length ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Current Loop */}
              <Panel>
                <PanelHead title="현재 루프"
                  right={data.current_loop?.requires_human_checkpoint && <Badge tone="hud">체크포인트</Badge>} />
                <div className="p-4">
                  {!data.current_loop?.loop_id && <div className="text-[11px] text-[var(--c-text-3)]">진행 중 자율 루프 없음.</div>}
                  {data.current_loop?.loop_id && (
                    <>
                      <div className="text-[12px] font-medium text-[var(--c-text-1)]">{data.current_loop.idea}</div>
                      <KV k="현재 단계" v={data.current_loop.current_stage} />
                      {data.current_loop.blocked_stage && <KV k="차단" v={data.current_loop.blocked_stage} />}
                      <KV k="완료" v={`${data.current_loop.completed?.length ?? 0}/9`} />
                    </>
                  )}
                </div>
              </Panel>
              {/* Health coverage */}
              <Panel>
                <PanelHead title="리서치 헬스" right={<Badge tone={bandTone(data.research_health?.health_band)}>{data.research_health?.trend}</Badge>} />
                <div className="p-4 space-y-2">
                  {Object.entries(data.research_health?.coverage ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-[10.5px] mb-1">
                        <span className="text-[var(--c-text-2)]">{k} 커버리지</span>
                        <span className="c-num text-[var(--c-text-3)]">{Math.round((v as number) * 100)}%</span>
                      </div>
                      <Meter value={v as number} tone="hud" />
                    </div>
                  ))}
                  <KV k="속도" v={data.research_health?.research_velocity} />
                  <KV k="미완료" v={data.research_health?.incomplete_research} />
                </div>
              </Panel>
              {/* Highest risks */}
              <Panel>
                <PanelHead title="최고 리스크" right={<Badge tone="warn">{data.highest_risks?.top_category ?? "—"}</Badge>} />
                <div className="p-4 space-y-2">
                  {Object.entries(data.highest_risks?.by_category ?? {}).slice(0, 6).map(([c, n]) => {
                    const max = Math.max(1, ...Object.values(data.highest_risks?.by_category ?? { x: 1 }));
                    return (
                      <div key={c}>
                        <div className="flex justify-between text-[10.5px] mb-1"><span className="text-[var(--c-text-2)]">{c}</span><span className="c-num text-[var(--c-text-3)]">{n}</span></div>
                        <Meter value={(n as number) / max} tone="warn" />
                      </div>
                    );
                  })}
                  {!data.highest_risks?.total_failures && <div className="text-[11px] text-[var(--c-text-3)]">기록된 실패 없음.</div>}
                </div>
              </Panel>
            </div>

            {/* Timeline */}
            <Panel className="opacity-70">
              <PanelHead title="리서치 타임라인" right={<Badge tone="mute">{data.timeline?.length ?? 0}</Badge>} />
              <div className="p-4">
                {(!data.timeline || data.timeline.length === 0) && <div className="text-[11px] text-[var(--c-text-3)]">원장에서 재구성할 이벤트 없음(연구가 기록되면 채워집니다).</div>}
                <div className="flex flex-wrap gap-1.5">
                  {(data.timeline ?? []).map((e, i) => {
                    const c = STAGE_TONE[e.stage] ?? "var(--c-text-3)";
                    return (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1" title={`${e.stage}: ${e.label}`}
                        style={{ border: `1px solid color-mix(in srgb, ${c} 35%, transparent)`, background: `color-mix(in srgb, ${c} 7%, transparent)` }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                        <span className="text-[9.5px] font-semibold uppercase" style={{ color: c }}>{e.stage}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-text-3)] truncate max-w-[120px]">{e.ref}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Opportunities */}
              <Panel>
                <PanelHead title="상위 기회" right={<Badge tone="mute">{data.top_opportunities?.length ?? 0}</Badge>} />
                <div className="p-4 space-y-2">
                  {(data.top_opportunities ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">메모리가 채워지면 후보가 제안됩니다.</div>}
                  {(data.top_opportunities ?? []).map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 c-panel-2 p-2.5">
                      <span className="text-[11.5px] text-[var(--c-text-1)] truncate">{o.name}</span>
                      <div className="flex gap-1.5 shrink-0"><Badge tone={CONF[o.expected_value] ?? "mute"}>기대값 {o.expected_value}</Badge><Badge tone={CONF[o.confidence] ?? "mute"}>{o.confidence}</Badge></div>
                    </div>
                  ))}
                </div>
              </Panel>
              {/* Human review + quick resume + exposure */}
              <div className="space-y-4">
                <Panel>
                  <PanelHead title="사람 검토 큐" right={<Badge tone="warn">{data.human_review_queue?.length ?? 0}</Badge>} />
                  <div className="p-4 space-y-1.5">
                    {(data.human_review_queue ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">검토 대기 없음.</div>}
                    {(data.human_review_queue ?? []).map((h) => (
                      <div key={h.run_id} className="text-[11px] text-[var(--c-text-2)] truncate">· {h.request}</div>
                    ))}
                  </div>
                </Panel>
                <Panel className="opacity-70">
                  <PanelHead title="빠른 재개" />
                  <div className="p-4 space-y-1.5">
                    {(data.quick_resume ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">재개할 세션 없음.</div>}
                    {(data.quick_resume ?? []).map((s) => (
                      <div key={s.session_id} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--c-text-1)] truncate">{s.goal}</span>
                        <Badge tone={s.state === "ACTIVE" ? "pos" : "warn"}>{s.state}</Badge>
                      </div>
                    ))}
                  </div>
                </Panel>
                <div className="grid grid-cols-3 gap-3">
                  <StatTile label="페이퍼 자본" value={`$${num(data.portfolio_exposure?.capital)}`} />
                  <StatTile label="노출" value={`$${num(data.portfolio_exposure?.gross_exposure)}`} />
                  <StatTile label="포지션" value={data.portfolio_exposure?.n_positions ?? 0} />
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </div>
        )}
      </StateBlock>
    </div>
  );
}
const CONF_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };

function ConsoleTab() {
  const { data, err, loading } = useConsole<OperatingConsoleResp>((s) => getOperatingConsole(s), [], 60000);
  return (
    <div className="min-h-full">
      <PageHeader title="운영 콘솔"
        right={data && <Badge tone="hud">{data.date}</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
          <div className="p-5 space-y-5">
            {/* 상단 KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="리서치 레코드" value={num(data.research.total_records)}
                sub={`${num(data.research.experiment_runs)}건 실행 · ${num(data.research.active_sources)}개 소스`} />
              <StatTile label="기회" value={data.opportunities.length} accent="pos"
                sub="오늘의 리서치 큐" tone="pos" />
              <StatTile label="열린 리스크" value={num(data.risks.total_failures)} accent="warn"
                tone="warn" sub={`상위: ${data.risks.top_category ?? "—"}`} />
              <StatTile label="활성 세션" value={data.sessions.active}
                sub={`총 ${data.sessions.count}건`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 오늘의 기회 */}
              <Panel>
                <PanelHead title="오늘의 기회" right={<Badge tone="mute">{data.opportunities.length}</Badge>} />
                <div className="p-4 space-y-2">
                  {data.opportunities.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">축적 메모리가 채워지면 연구 후보가 제안됩니다.</div>}
                  {data.opportunities.map((o, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--c-text-1)]">{o.name}</span>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge tone={CONF_TONE[o.expected_value] ?? "mute"}>기대값 {o.expected_value}</Badge>
                          <Badge tone={CONF_TONE[o.confidence] ?? "mute"}>{o.confidence}</Badge>
                        </div>
                      </div>
                      <div className="text-[10.5px] text-[var(--c-text-3)] mt-1">{o.reason}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* 오늘의 리스크 */}
              <Panel>
                <PanelHead title="오늘의 리스크" right={<Badge tone="warn">{data.risks.top_category ?? "—"}</Badge>} />
                <div className="p-4 space-y-3">
                  {Object.entries(data.risks.by_category ?? {}).slice(0, 6).map(([cat, n]) => {
                    const max = Math.max(1, ...Object.values(data.risks.by_category ?? { x: 1 }));
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-[10.5px] mb-1">
                          <span className="text-[var(--c-text-2)]">{cat}</span>
                          <span className="c-num text-[var(--c-text-3)]">{n}</span>
                        </div>
                        <Meter value={(n as number) / max} tone="warn" />
                      </div>
                    );
                  })}
                  {(data.risks.lessons ?? []).slice(0, 3).map((l, i) => (
                    <div key={i} className="text-[10px] text-[var(--c-text-3)] leading-snug">· {l}</div>
                  ))}
                  {!data.risks.total_failures && <div className="text-[11px] text-[var(--c-text-3)]">기록된 실패 없음.</div>}
                </div>
              </Panel>

              {/* 포트폴리오 노출 + 페이퍼 */}
              <Panel>
                <PanelHead title="노출 & 페이퍼 트레이딩" />
                <div className="p-4 space-y-2">
                  <KV k="페이퍼 자본" v={`$${num(data.exposure.capital)}`} />
                  <KV k="총 노출" v={`$${num(data.exposure.gross_exposure)} (${num(data.exposure.exposure_pct, 1)}%)`} />
                  <KV k="열린 포지션" v={data.exposure.n_positions ?? 0} />
                  <KV k="포트폴리오 가치" v={`$${num(data.paper.portfolio_value, 2)}`} />
                  <div className="mt-2"><Meter value={(data.exposure.exposure_pct ?? 0) / 100} tone="hud" /></div>
                  <div className="text-[10px] text-[var(--c-text-3)] mt-1">페이퍼 전용 — 라이브 브로커·집행·자본배분 없음.</div>
                </div>
              </Panel>

              {/* 이벤트 + 추천 */}
              <Panel>
                <PanelHead title="이벤트 & 추천" />
                <div className="p-4 space-y-3">
                  <KV k="공급망 맵" v={`${data.events.node_count ?? 0}개 노드 · ${data.events.edge_count ?? 0}개 엣지`} />
                  {data.recommendations.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">추천할 상위 기회 없음.</div>}
                  {data.recommendations.map((r, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="text-[11px] font-medium text-[var(--c-text-1)]">{r.topic}</div>
                      <div className="text-[10.5px] text-[var(--c-hud)] mt-1">{r.recommendation}</div>
                      {r.conflicts > 0 && <div className="text-[10px] text-[var(--c-warn)] mt-0.5">관점 상충 {r.conflicts}건 — 사람 검토</div>}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* 세션 */}
            <Panel className="opacity-70">
              <PanelHead title="활성 세션" right={<Badge tone="mute">활성 {data.sessions.active}</Badge>} />
              <div className="p-4">
                {data.sessions.items.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">활성 세션 없음 — 워크플로 탭에서 세션을 시작하세요.</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.sessions.items.map((s) => (
                    <div key={s.session_id} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-[var(--c-text-1)] truncate">{s.goal}</span>
                        <Badge tone={s.state === "ACTIVE" ? "pos" : s.state === "PAUSED" ? "warn" : "mute"}>{s.state}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">
                        {s.pending_work.length}건 대기 · {s.completed_experiments.length}건 완료 · {s.open_questions.length}건 열린 질문
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </div>
        )}
      </StateBlock>
    </div>
  );
}
