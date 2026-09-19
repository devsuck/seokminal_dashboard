"use client";
// 라이브 사이클링 에이전트(autopilot agent_loop.sh, tmux 세션) 실시간 판단 화면.
// /agents/*. jarvis 오프라인 리서치 파이프라인(council)과는 별도 — 여기는 실제 매 사이클 판단+체결.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getLiveAgents, getLiveAgentCycles, getLiveAgentPerformance, getGodModeEligibility, promoteGodMode,
  getGodModeCandidates, getCapitalClaimCandidates, submitCapitalClaim,
  type LiveAgent, type AgentCycle, type AgentPerformance, type GodModeEligibility,
  type GodModeCandidatesResp, type CapitalClaimCandidatesResp,
} from "@/lib/console-api";
import { ApBadge, ApSkeletonLines, ApDot } from "@/components/ui/ApPrimitives";

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[9px] font-semibold tracking-[0.24em] uppercase text-ap-ink-3">
            /agents · autopilot 사이클 · 실시간 판단
          </div>
          <div className="text-[13px] font-semibold text-ap-ink-1">라이브 에이전트</div>
        </div>
        <Link href="/investment-os" className="text-[11px] text-ap-brand hover:underline no-underline">
          ← Investment OS
        </Link>
      </div>

      {!loading && err && <div className="text-[11px] text-ap-down">백엔드 연결 실패: {err}</div>}

      <ApprovalFeed onActed={run} />

      <div className="text-[11px] font-semibold text-ap-ink-3 px-1 pt-1">
        에이전트{agents ? ` · ${agents.length}` : ""}
      </div>

      {loading && (
        <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <ApSkeletonLines rows={3} />
        </div>
      )}
      {!loading && agents?.length === 0 && (
        <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4 text-[11px] text-ap-ink-3">
          등록된 에이전트 없음.
        </div>
      )}
      <div className="space-y-2">
        {!loading && agents?.map((a) => (
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
  const [claims, setClaims] = useState<CapitalClaimCandidatesResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const [g, c] = await Promise.all([
        getGodModeCandidates(ctrl.signal),
        getCapitalClaimCandidates(ctrl.signal),
      ]);
      if (!ctrl.signal.aborted) { setGod(g); setClaims(c); }
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

  const claim = async (strategyId: string, amount?: number) => {
    setBusy(strategyId);
    try {
      await submitCapitalClaim(strategyId, amount);
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
  const candidates = claims?.candidates ?? [];
  const total = promotable.length + reverted.length + candidates.length;
  if (!total && !err) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-ap-ink-3 px-1">승인 대기 · {total}</div>
      {err && <div className="text-[11px] text-ap-down px-1">{err}</div>}

      {promotable.map((c) => (
        <div key={c.agent_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <div className="text-[10px] font-semibold text-ap-brand uppercase tracking-wide mb-1">god_mode · 승급 후보</div>
          <div className="text-[13px] font-bold text-ap-ink-1 mb-1">{c.name} → live 전환?</div>
          <div className="text-[11px] text-ap-ink-3 mb-3">승급 조건 충족 (최근 {c.window_days}일)</div>
          <div className="flex gap-1.5">
            <button onClick={() => promote(c.agent_id)} disabled={busy === c.agent_id}
              className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
              {busy === c.agent_id ? "승급 중…" : "승인"}
            </button>
            <button className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer bg-ap-bg text-ap-ink-1">
              보류
            </button>
          </div>
        </div>
      ))}

      {reverted.map((r) => (
        <div key={r.agent_id} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
          <div className="text-[10px] font-semibold text-ap-caution uppercase tracking-wide mb-1">god_mode → paper 강제복귀</div>
          <div className="text-[13px] font-bold text-ap-ink-1 mb-1">{r.name}</div>
          <div className="text-[11px] text-ap-ink-3">{r.reason} · {r.at}</div>
        </div>
      ))}

      {candidates.map((c) => {
        const sid = c.strategy_id;
        const isManual = manualMode[sid];
        return (
          <div key={sid} className="rounded-ap-xl bg-ap-surface shadow-ap-sm p-4">
            <div className="text-[10px] font-semibold text-ap-brand uppercase tracking-wide mb-1">자본배정 대기 · {sid}</div>
            {!isManual && c.suggested_amount != null && (
              <div className="text-[16px] font-extrabold text-ap-ink-1 mb-3">
                제안 {c.suggested_amount.toLocaleString()}원{c.stale ? " (오래됨)" : ""}
              </div>
            )}
            {!isManual && c.suggested_amount == null && (
              <div className="text-[13px] text-ap-ink-3 mb-3">제안 없음</div>
            )}

            {!isManual && (
              <div className="flex gap-1.5">
                {c.suggested_amount != null && (
                  <button onClick={() => claim(sid, c.suggested_amount ?? undefined)} disabled={busy === sid}
                    className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
                    예
                  </button>
                )}
                <button onClick={() => claim(sid, 0)} disabled={busy === sid}
                  className="flex-1 h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-bg text-ap-ink-1">
                  아니오
                </button>
                <button onClick={() => setManualMode((prev) => ({ ...prev, [sid]: true }))} disabled={busy === sid}
                  className="flex-[1.3] h-9 rounded-ap-md text-[11px] font-medium border-0 cursor-pointer disabled:opacity-50 bg-transparent text-ap-ink-2">
                  내가 마음대로 주기
                </button>
              </div>
            )}

            {isManual && (
              <div className="flex gap-1.5">
                <input type="number" placeholder="배정액(원)" value={amounts[sid] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [sid]: e.target.value }))}
                  className="flex-1 h-9 px-3 text-[12px] rounded-ap-md border border-ap-line text-ap-ink-1" />
                <button onClick={() => claim(sid, amounts[sid] ? Number(amounts[sid]) : undefined)} disabled={busy === sid}
                  className="h-9 px-4 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
                  {busy === sid ? "제출 중…" : "제출"}
                </button>
              </div>
            )}
          </div>
        );
      })}
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
        <span className="text-ap-ink-3 text-[11px] w-3">{expanded ? "▾" : "▸"}</span>
        <ApDot tone={agent.session_live ? "pos" : "mute"} pulse={agent.session_live} />
        <span className="text-[13px] font-semibold text-ap-ink-1">{agent.name}</span>
        {agent.god_mode && <ApBadge tone="pos">GOD MODE</ApBadge>}
        {!agent.god_mode && !agent.paper && <ApBadge tone="warn">LIVE</ApBadge>}
        {!agent.validated && <ApBadge tone="warn" title={agent.validation_reason}>미검증</ApBadge>}
        <span className={`ml-auto font-data font-extrabold text-[14px] ${deltaCls}`}>
          {perf ? `${perf.return_pct >= 0 ? "+" : ""}${perf.return_pct.toFixed(2)}%` : "—"}
        </span>
        {perf && (
          <span className="w-full text-[11px] text-ap-ink-3 pl-5">
            포지션 {perf.open_positions.length} · 배정 {perf.alloc.toLocaleString()}
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
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const [c, g] = await Promise.all([
        getLiveAgentCycles(agentId, 8, ctrl.signal),
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

  return (
    <div className="border-t border-ap-line p-4 space-y-4">
      {loading && <ApSkeletonLines rows={3} />}
      {!loading && err && <div className="text-[11px] text-ap-down">{err}</div>}

      {!loading && perf && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-ap-ink-3">실현 손익</div>
            <div className={`font-data text-[13px] font-semibold ${perf.realized_pnl >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {perf.realized_pnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-ap-ink-3">미실현 손익</div>
            <div className={`font-data text-[13px] font-semibold ${perf.unrealized_pnl >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {perf.unrealized_pnl.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-ap-ink-3">현금</div>
            <div className="font-data text-[13px] font-semibold text-ap-ink-1">{perf.cash.toLocaleString()}</div>
          </div>
        </div>
      )}

      {!loading && perf && perf.open_positions.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-ap-ink-3 uppercase tracking-wide mb-1.5">보유 포지션</div>
          <div className="space-y-1">
            {perf.open_positions.map((p) => (
              <div key={p.symbol} className="flex items-center justify-between text-[11px] font-data text-ap-ink-2">
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
        <div className="text-[11px] text-ap-ink-3">god_mode 승급 미충족 (최근 {god.window_days}일)</div>
      )}
      {!loading && god?.eligible && (
        <div>
          <div className="text-[10px] font-semibold text-ap-ink-3 uppercase tracking-wide mb-1.5">
            승급 심사 충족 (최근 {god.window_days}일)
          </div>
          <button onClick={promote} disabled={busy}
            className="w-full h-9 rounded-ap-md text-[12px] font-semibold border-0 cursor-pointer disabled:opacity-50 bg-ap-brand text-white">
            {busy ? "승급 중…" : "God Mode 승급 (사람 최종 확인)"}
          </button>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold text-ap-ink-3 uppercase tracking-wide mb-1.5">최근 사이클</div>
        {!loading && recentCycles.length === 0 && (
          <div className="text-[11px] text-ap-ink-3">기록된 사이클 없음.</div>
        )}
        <div className="space-y-1">
          {!loading && recentCycles.map((c) => (
            <div key={c.cycle} className="flex items-center gap-2 text-[11px]">
              <span className="text-ap-ink-3 font-data w-9 shrink-0">{fmtCycleTime(c.ts)}</span>
              <ApBadge tone={DECISION_TONE[c.decision] ?? "mute"}>{c.decision}</ApBadge>
              {c.symbol && <span className="text-ap-ink-1 font-semibold shrink-0">{c.symbol}</span>}
              {c.note && <span className="text-ap-ink-2 truncate" title={c.note}>{c.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
