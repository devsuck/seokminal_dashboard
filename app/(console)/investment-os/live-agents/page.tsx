"use client";
// 라이브 사이클링 에이전트(autopilot agent_loop.sh, tmux 세션) 실시간 판단 화면.
// /agents/*. jarvis 오프라인 리서치 파이프라인(council)과는 별도 — 여기는 실제 매 사이클 판단+체결.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLiveAgents, getLiveAgentCycles, getLiveAgentPerformance, getGodModeEligibility, promoteGodMode,
  getGodModeCandidates,
  type LiveAgent, type AgentCycle, type AgentPerformance, type GodModeEligibility,
  type GodModeCandidatesResp,
} from "@/lib/console-api";
import { ApBadge, ApSkeletonLines, ApDot, ApBottomSheet, ApButton } from "@/components/ui/ApPrimitives";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

type AgentFilter = "all" | "live" | "paper";

const DECISION_TONE: Record<string, "pos" | "neg" | "warn" | "mute" | "info"> = {
  BUY: "pos", SELL: "neg", HOLD: "mute", WATCH: "info", SKIP: "mute",
};

function fmtCycleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

export default function LiveAgentsPage() {
  const [agents, setAgents] = useState<LiveAgent[] | null>(null);
  const [perfMap, setPerfMap] = useState<Record<string, AgentPerformance>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgentFilter>("all");
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const r = await getLiveAgents(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setAgents(r.agents);
      setLoading(false);
      const perfs = await Promise.all(
        r.agents.map((a) => getLiveAgentPerformance(a.id, ctrl.signal).catch(() => null)),
      );
      if (ctrl.signal.aborted) return;
      const map: Record<string, AgentPerformance> = {};
      r.agents.forEach((a, i) => { const p = perfs[i]; if (p) map[a.id] = p; });
      setPerfMap(map);
    } catch (ex) {
      if (!(ex instanceof DOMException && ex.name === "AbortError")) setErr((ex as Error).message);
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  return (
    <div className="min-h-full p-4 space-y-3 bg-ap-bg-page">
      <div>
        <div className="text-ap-micro font-semibold tracking-[0.24em] uppercase text-ap-ink-3">
          /agents · autopilot 사이클 · 실시간 판단
        </div>
        <div className="text-ap-title font-semibold text-ap-ink-1">라이브 에이전트</div>
      </div>

      {!loading && err && <div className="text-ap-body text-ap-down">백엔드 연결 실패: {err}</div>}

      <ApprovalFeed onActed={run} />

      <div className="flex items-center justify-between gap-2 px-1 pt-1 flex-wrap">
        <div className="text-ap-body font-semibold text-ap-ink-3">
          에이전트{agents ? ` · ${agents.length}` : ""}
        </div>
        {agents && agents.length > 0 && (
          <SegmentedToggle
            size="sm"
            value={filter}
            onChange={setFilter}
            variant="ap-pill"
            options={[
              { value: "all", label: `전체 ${agents.length}` },
              { value: "live", label: `라이브 ${agents.filter(a => !a.paper).length}` },
              { value: "paper", label: `페이퍼 ${agents.filter(a => a.paper).length}` },
            ]}
          />
        )}
      </div>

      {loading && (
        <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <ApSkeletonLines rows={3} />
        </div>
      )}
      {!loading && agents?.length === 0 && (
        <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4 text-ap-body text-ap-ink-3">
          등록된 에이전트 없음.
        </div>
      )}
      <div className="space-y-2">
        {!loading && agents
          ?.filter((a) => filter === "all" || (filter === "live" ? !a.paper : a.paper))
          .map((a) => (
          <AgentCard
            key={a.id}
            agent={a}
            perf={perfMap[a.id]}
            expanded={expanded === a.id}
            onToggle={() => setExpanded((prev) => (prev === a.id ? null : a.id))}
            onPromoted={run}
          />
        ))}
      </div>
    </div>
  );
}

function ApprovalFeed({ onActed }: { onActed: () => void }) {
  const [god, setGod] = useState<GodModeCandidatesResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const g = await getGodModeCandidates(ctrl.signal);
      if (!ctrl.signal.aborted) setGod(g);
    } catch (ex) {
      if (!(ex instanceof DOMException && ex.name === "AbortError")) setErr((ex as Error).message);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const promote = async (agentId: string) => {
    setBusy(agentId);
    try {
      await promoteGodMode(agentId);
      await run();
      onActed();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const promotable = god?.promotable ?? [];
  const reverted = god?.reverted ?? [];
  const total = promotable.length + reverted.length;
  if (!total && !err) return null;

  return (
    <div className="space-y-2">
      <div className="px-1"><ApBadge tone="warn">승인 대기 · {total}</ApBadge></div>
      {err && <div className="text-ap-body text-ap-down px-1">{err}</div>}

      {promotable.map((c) => (
        <div key={c.agent_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <div className="text-ap-caption font-semibold text-ap-brand uppercase tracking-wide mb-1">god_mode · 승급 후보</div>
          <div className="text-ap-title font-bold text-ap-ink-1 mb-1">{c.name} → live 전환?</div>
          <div className="text-ap-body text-ap-ink-3 mb-3">승급 조건 충족 (최근 {c.window_days}일)</div>
          <div className="flex gap-1.5">
            <ApButton onClick={() => promote(c.agent_id)} loading={busy === c.agent_id} className="flex-1">
              승인
            </ApButton>
            <ApButton variant="secondary" className="flex-1">
              보류
            </ApButton>
          </div>
        </div>
      ))}

      {reverted.map((r) => (
        <div key={r.agent_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <div className="text-ap-caption font-semibold text-ap-caution uppercase tracking-wide mb-1">god_mode → paper 강제복귀</div>
          <div className="text-ap-title font-bold text-ap-ink-1 mb-1">{r.name}</div>
          <div className="text-ap-body text-ap-ink-3">{r.reason} · {r.at}</div>
        </div>
      ))}
    </div>
  );
}

function AgentCard({
  agent, perf, expanded, onToggle, onPromoted,
}: { agent: LiveAgent; perf?: AgentPerformance; expanded: boolean; onToggle: () => void; onPromoted: () => void }) {
  const deltaCls = !perf ? "text-ap-ink-3" : perf.return_pct >= 0 ? "text-ap-up" : "text-ap-down";
  return (
    <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm overflow-hidden">
      <button onClick={onToggle}
        className="w-full text-left p-4 flex items-center gap-2 flex-wrap border-0 bg-transparent cursor-pointer">
        <span className="text-ap-ink-3 text-ap-body w-3">{expanded ? "▾" : "▸"}</span>
        <ApDot tone={agent.session_live ? "pos" : "mute"} pulse={agent.session_live} />
        <span className="text-ap-title font-semibold text-ap-ink-1">{agent.name}</span>
        {agent.god_mode && <ApBadge tone="pos">GOD MODE</ApBadge>}
        {!agent.god_mode && !agent.paper && <ApBadge tone="warn">LIVE</ApBadge>}
        {!agent.validated && <ApBadge tone="warn" title={agent.validation_reason}>미검증</ApBadge>}
        <span className={`ml-auto font-data font-extrabold text-ap-title ${deltaCls}`}>
          {perf ? `${perf.return_pct >= 0 ? "+" : ""}${perf.return_pct.toFixed(2)}%` : "—"}
        </span>
        {perf && (
          <span className="w-full text-ap-body text-ap-ink-3 pl-5 font-data">
            배정 {perf.alloc.toLocaleString()} → 현재 {(perf.cash + perf.invested).toLocaleString()} · 포지션 {perf.open_positions.length}
          </span>
        )}
      </button>
      {expanded && <AgentCardBody agentId={agent.id} perf={perf} onPromoted={onPromoted} />}
    </div>
  );
}

function AgentCardBody({
  agentId, perf, onPromoted,
}: { agentId: string; perf?: AgentPerformance; onPromoted: () => void }) {
  const [cycles, setCycles] = useState<AgentCycle[] | null>(null);
  const [god, setGod] = useState<GodModeEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const [c, g] = await Promise.all([
        getLiveAgentCycles(agentId, 50, ctrl.signal),
        getGodModeEligibility(agentId, ctrl.signal).catch(() => null),
      ]);
      if (!ctrl.signal.aborted) { setCycles(c.cycles); setGod(g); }
    } catch (ex) {
      if (!(ex instanceof DOMException && ex.name === "AbortError")) setErr((ex as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [agentId]);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const promote = async () => {
    setBusy(true);
    try {
      await promoteGodMode(agentId);
      await run();
      onPromoted();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recentCycles = cycles ? [...cycles].reverse() : [];
  const previewCycles = recentCycles.slice(0, 3);

  return (
    <div className="border-t border-ap-line p-4 space-y-4">
      {loading && <ApSkeletonLines rows={3} />}
      {!loading && err && <div className="text-ap-body text-ap-down">{err}</div>}

      {!loading && perf && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-ap-caption text-ap-ink-3">실현 손익</div>
            <div className={`font-data text-ap-title font-semibold ${perf.realized_pnl >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {perf.realized_pnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-ap-caption text-ap-ink-3">미실현 손익</div>
            <div className={`font-data text-ap-title font-semibold ${perf.unrealized_pnl >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {perf.unrealized_pnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-ap-caption text-ap-ink-3">현금</div>
            <div className="font-data text-ap-title font-semibold text-ap-ink-1">{perf.cash.toLocaleString()}</div>
          </div>
        </div>
      )}

      {!loading && perf && perf.open_positions.length > 0 && (
        <div>
          <div className="text-ap-caption font-semibold text-ap-ink-3 uppercase tracking-wide mb-1.5">보유 포지션</div>
          <div className="space-y-1">
            {perf.open_positions.map((p) => (
              <div key={p.symbol} className="flex items-center justify-between text-ap-body font-data text-ap-ink-2">
                <span className="text-ap-ink-1 font-semibold">{p.symbol}</span>
                <span>{p.qty} @ {p.avg_price.toLocaleString()}</span>
                <span className={p.unrealized_pnl != null && p.unrealized_pnl >= 0 ? "text-ap-up" : "text-ap-down"}>
                  {p.unrealized_pnl != null ? p.unrealized_pnl.toLocaleString() : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && god && !god.eligible && (
        <div className="text-ap-body text-ap-ink-3">god_mode 승급 미충족 (최근 {god.window_days}일)</div>
      )}
      {!loading && god?.eligible && (
        <div>
          <div className="text-ap-caption font-semibold text-ap-ink-3 uppercase tracking-wide mb-1.5">
            승급 심사 충족 (최근 {god.window_days}일)
          </div>
          <ApButton onClick={promote} loading={busy} className="w-full">God Mode 승급 (사람 최종 확인)</ApButton>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-ap-caption font-semibold text-ap-ink-3 uppercase tracking-wide">최근 사이클</div>
          {recentCycles.length > 3 && (
            <button onClick={() => setHistoryOpen(true)}
              className="text-ap-body text-ap-brand border-0 bg-transparent cursor-pointer">
              전체 이력 보기 ({recentCycles.length})
            </button>
          )}
        </div>
        {!loading && previewCycles.length === 0 && (
          <div className="text-ap-body text-ap-ink-3">기록된 사이클 없음.</div>
        )}
        <div className="space-y-1">
          {!loading && previewCycles.map((c) => (
            <div key={c.cycle} className="flex items-center gap-2 text-ap-body">
              <span className="text-ap-ink-3 font-data w-9 shrink-0">{fmtCycleTime(c.ts)}</span>
              <ApBadge tone={DECISION_TONE[c.decision] ?? "mute"}>{c.decision}</ApBadge>
              {c.symbol && <span className="text-ap-ink-1 font-semibold shrink-0">{c.symbol}</span>}
            </div>
          ))}
        </div>
      </div>

      <ApBottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="전체 사이클 이력">
        <div className="space-y-1.5">
          {recentCycles.map((c) => (
            <div key={c.cycle} className="flex items-center gap-2 text-ap-body">
              <span className="text-ap-ink-3 font-data w-9 shrink-0">{fmtCycleTime(c.ts)}</span>
              <ApBadge tone={DECISION_TONE[c.decision] ?? "mute"}>{c.decision}</ApBadge>
              {c.symbol && <span className="text-ap-ink-1 font-semibold shrink-0">{c.symbol}</span>}
              {c.note && <span className="text-ap-ink-2 truncate" title={c.note}>{c.note}</span>}
            </div>
          ))}
        </div>
      </ApBottomSheet>
    </div>
  );
}
