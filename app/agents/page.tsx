"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listAgents,
  createAgent,
  startAgent,
  stopAgent,
  deleteAgent,
  getAgentCycles,
  getAgentPerformance,
  distillAgent,
  getAgentsOverview,
  getAccountBalances,
  type TradingAgent,
  type AgentType,
  type AgentCycle,
  type AgentPerformance,
  type DistillResult,
  type AgentsOverview,
  type AccountBalances,
} from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";

function pnlColor(v: number | null | undefined): string {
  if (v == null) return "text-text-3";
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-2";
}

function fmtMoney(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const DECISION_STYLE: Record<string, string> = {
  BUY: "bg-pos/15 text-pos border-pos/40",
  SELL: "bg-neg/15 text-neg border-neg/40",
  WATCH: "bg-warn/10 text-warn border-warn/30",
  HOLD: "bg-panel-2 text-text-3 border-border",
  SKIP: "bg-panel-2 text-text-3 border-border",
};

function CycleCard({ c }: { c: AgentCycle }) {
  const pct = c.score != null && c.max_score ? Math.round((c.score / c.max_score) * 100) : null;
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[10px] font-data">#{c.cycle}</span>
          {c.symbol && <span className="text-text-1 text-xs font-data font-semibold">{c.symbol}</span>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-data ${DECISION_STYLE[c.decision] ?? DECISION_STYLE.SKIP}`}>
            {c.decision}
          </span>
        </div>
        <span className="text-text-3 text-[9px] font-data">{new Date(c.ts).toLocaleTimeString("ko-KR")}</span>
      </div>
      {pct != null && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-1 flex-1 bg-panel-2 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-text-2 text-[10px] font-data">{c.score}/{c.max_score}</span>
        </div>
      )}
      {c.action && c.action !== "none" && (
        <div className="text-[11px] text-accent font-data mb-0.5">⚡ {c.action}</div>
      )}
      {c.note && <p className="text-text-2 text-[11px] leading-snug">{c.note}</p>}
      <div className="flex items-center justify-between mt-1.5 text-[9px] text-text-3">
        {c.next_trigger && <span>트리거: {c.next_trigger}</span>}
        {c.cash_pct != null && <span className="font-data">현금 {c.cash_pct}%</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="text-text-3 text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`text-base font-data mt-1 ${cls ?? "text-text-1"}`}>{value}</div>
    </div>
  );
}

const PIE_COLORS = ["#4488ff", "#00cc44", "#ff8c00", "#a855f7", "#14b8a6", "#ff3333", "#eab308", "#ec4899"];

function PortfolioPie({ perf }: { perf: AgentPerformance }) {
  // Slices: each open position (market value) + cash.
  const slices = perf.open_positions.map((p, i) => ({
    label: p.symbol,
    value: p.qty * (p.current_price ?? p.avg_price),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  slices.push({ label: "현금", value: Math.max(perf.cash, 0), color: "#3a3f4b" });
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;

  let acc = 0;
  const stops = slices.map(s => {
    const start = (acc / total) * 360;
    acc += s.value;
    const end = (acc / total) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(", ");

  return (
    <div className="bg-panel border border-border rounded-lg p-3 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: "96px", height: "96px" }}>
        <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${stops})` }} />
        <div className="absolute rounded-full bg-panel" style={{ inset: "26px" }} />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-text-3 text-[10px] uppercase tracking-wider mb-1">포트폴리오 구성</p>
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-text-2 font-data truncate flex-1">{s.label}</span>
            <span className="text-text-3 font-data">{((s.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ perf }: { perf: AgentPerformance | null }) {
  if (!perf) return <p className="text-text-3 text-xs">성과 데이터 로딩 중…</p>;
  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="총 손익" value={fmtMoney(perf.total_pnl)} cls={pnlColor(perf.total_pnl)} />
        <StatCard label="수익률" value={`${perf.return_pct > 0 ? "+" : ""}${perf.return_pct.toFixed(2)}%`} cls={pnlColor(perf.return_pct)} />
        <StatCard label="실현" value={fmtMoney(perf.realized_pnl)} cls={pnlColor(perf.realized_pnl)} />
        <StatCard label="미실현 (실시간)" value={fmtMoney(perf.unrealized_pnl)} cls={pnlColor(perf.unrealized_pnl)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="배정 자본" value={`$${perf.alloc.toLocaleString()}`} />
        <StatCard label="현금" value={`$${perf.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <StatCard label="투자 중" value={`$${perf.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      {/* Portfolio composition pie (positions + cash) */}
      {(perf.open_positions.length > 0 || perf.cash > 0) && <PortfolioPie perf={perf} />}

      {/* Open positions */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
          보유 포지션 ({perf.open_positions.length})
        </div>
        {perf.open_positions.length === 0 ? (
          <p className="text-text-3 text-xs px-3 py-3">포지션 없음</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-3 text-[10px] uppercase">
                <th className="text-left font-medium px-3 py-1.5">종목</th>
                <th className="text-right font-medium px-3 py-1.5">수량</th>
                <th className="text-right font-medium px-3 py-1.5">평단</th>
                <th className="text-right font-medium px-3 py-1.5">현재가</th>
                <th className="text-right font-medium px-3 py-1.5">미실현</th>
              </tr>
            </thead>
            <tbody>
              {perf.open_positions.map(p => (
                <tr key={p.symbol} className="border-t border-border/40 font-data">
                  <td className="px-3 py-1.5 text-text-1">{p.symbol}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{p.qty}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">${p.avg_price.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{p.current_price != null ? `$${p.current_price.toFixed(2)}` : "—"}</td>
                  <td className={`px-3 py-1.5 text-right ${pnlColor(p.unrealized_pnl)}`}>
                    {p.unrealized_pnl != null ? fmtMoney(p.unrealized_pnl) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Trade log with reasons */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
          매매 기록 ({perf.trades.length}) — 매수/매도 이유 포함
        </div>
        {perf.trades.length === 0 ? (
          <p className="text-text-3 text-xs px-3 py-3">거래 없음</p>
        ) : (
          <div className="divide-y divide-border/40">
            {perf.trades.map((t, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-data ${t.side === "buy" ? "bg-pos/15 text-pos border-pos/40" : "bg-neg/15 text-neg border-neg/40"}`}>
                      {t.side === "buy" ? "매수" : "매도"}
                    </span>
                    <span className="text-text-1 text-xs font-data">{t.symbol}</span>
                    <span className="text-text-3 text-[10px] font-data">{t.qty}주 @ ${t.price.toFixed(2)}</span>
                  </div>
                  {t.realized_pnl != null && (
                    <span className={`text-[11px] font-data ${pnlColor(t.realized_pnl)}`}>{fmtMoney(t.realized_pnl)}</span>
                  )}
                </div>
                {t.reason && <p className="text-text-2 text-[11px] mt-1 leading-snug">💡 {t.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function money(n: number, ccy: string): string {
  const sym = ccy === "KRW" ? "₩" : ccy === "USDC" ? "" : "$";
  const suffix = ccy === "USDC" ? " USDC" : "";
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: ccy === "KRW" ? 0 : 2 })}${suffix}`;
}

function BalanceCard({ acc }: { acc: import("@/lib/api").AccountRow }) {
  const remaining = acc.balance != null ? acc.balance - acc.allocated : null;
  const over = remaining != null && remaining < 0;
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-text-2 text-xs font-semibold">{acc.label}</span>
        {acc.mode && <span className={`text-[9px] px-1.5 py-0.5 rounded border ${acc.mode === "live" ? "bg-neg/15 text-neg border-neg/40" : "bg-pos/10 text-pos border-pos/30"}`}>{acc.mode === "live" ? "● LIVE" : "PAPER"}</span>}
      </div>
      {acc.error ? (
        <div className="text-text-3 text-[10px] mt-1.5">연결 불가 ({acc.error.slice(0, 30)})</div>
      ) : (
        <>
          <div className="text-base font-data text-text-1 mt-1">{acc.balance != null ? money(acc.balance, acc.ccy) : "—"}</div>
          <div className="flex justify-between text-[10px] font-data mt-1">
            <span className="text-text-3">배정 {money(acc.allocated, acc.ccy)}</span>
            <span className={over ? "text-neg" : "text-text-2"}>
              잔여 {remaining != null ? money(remaining, acc.ccy) : "—"}{over && " ⚠️초과"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Balances({ bal }: { bal: AccountBalances }) {
  return (
    <div className="space-y-2">
      <p className="text-text-3 text-[10px] uppercase tracking-wider">계좌 잔액 & 배정 (배정 정할 때 참고)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {bal.accounts.map(a => <BalanceCard key={a.venue} acc={a} />)}
      </div>
    </div>
  );
}

function Overview({ ov, onSelect }: { ov: AgentsOverview; onSelect: (id: string) => void }) {
  const maxAbs = Math.max(1, ...ov.agents.map(a => Math.abs(a.realized_pnl)));
  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="에이전트" value={`${ov.totals.count} (${ov.totals.running} 가동)`} />
        <StatCard label="총 배정" value={`$${ov.totals.alloc.toLocaleString()}`} />
        <StatCard label="총 실현손익" value={fmtMoney(ov.totals.realized_pnl)} cls={pnlColor(ov.totals.realized_pnl)} />
        <StatCard label="종합 수익률" value={`${ov.totals.return_pct > 0 ? "+" : ""}${ov.totals.return_pct.toFixed(2)}%`} cls={pnlColor(ov.totals.return_pct)} />
      </div>
      {/* Per-agent realized PnL bars */}
      <div className="space-y-1">
        <p className="text-text-3 text-[10px] uppercase tracking-wider">에이전트별 실현손익</p>
        {ov.agents.length === 0 && <p className="text-text-3 text-xs">에이전트 없음</p>}
        {ov.agents.map(a => {
          const pct = Math.round((Math.abs(a.realized_pnl) / maxAbs) * 100);
          const pos = a.realized_pnl >= 0;
          return (
            <button key={a.id} onClick={() => onSelect(a.id)}
              className="w-full flex items-center gap-2 text-left hover:bg-panel-2 rounded px-1 py-0.5">
              <span className="w-24 truncate text-[11px] text-text-2 shrink-0">{a.name}</span>
              <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${a.paper ? "text-text-3" : "text-neg"}`}>{a.paper ? "P" : "L"}</span>
              <div className="flex-1 h-2.5 bg-panel-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pos ? "bg-pos" : "bg-neg"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`w-20 text-right text-[10px] font-data shrink-0 ${pnlColor(a.realized_pnl)}`}>{fmtMoney(a.realized_pnl)}</span>
              <span className="w-14 text-right text-[9px] text-text-3 font-data shrink-0">{a.trades}건</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<TradingAgent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cycles, setCycles] = useState<AgentCycle[]>([]);
  const [perf, setPerf] = useState<AgentPerformance | null>(null);
  const [tab, setTab] = useState<"dashboard" | "cycles">("dashboard");
  const [distilling, setDistilling] = useState(false);
  const [distill, setDistill] = useState<DistillResult | null>(null);
  const [overview, setOverview] = useState<AgentsOverview | null>(null);
  const [balances, setBalances] = useState<AccountBalances | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [type, setType] = useState<AgentType>("swing");
  const [alloc, setAlloc] = useState("100000");
  const [paper, setPaper] = useState(true);
  const [autonomy, setAutonomy] = useState(2);
  const [market, setMarket] = useState<"US" | "KR" | "MIXED">("US");
  const [creating, setCreating] = useState(false);

  // Autonomy only applies to the LLM swing agent; day-trade is always rules-based.
  const isDeterministic = type === "daytrade" || type === "hl_daytrade" || type === "kr_daytrade";

  const cyclePollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const perfPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { agents } = await listAgents();
      setAgents(agents);
      setSelected(prev => prev ?? (agents[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { refresh(); const iv = setInterval(refresh, 15_000); return () => clearInterval(iv); }, [refresh]);

  // Poll the all-agents overview for the top dashboard.
  useEffect(() => {
    const load = () => getAgentsOverview().then(setOverview).catch(() => {});
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, []);

  // Account balances (always shown — needed to size allocations even at 0 agents).
  useEffect(() => {
    const load = () => getAccountBalances().then(setBalances).catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Poll cycles for the selected agent.
  useEffect(() => {
    if (!selected) { setCycles([]); return; }
    let live = true;
    async function poll() {
      try {
        const { cycles } = await getAgentCycles(selected!, 30);
        if (live) setCycles(cycles);
      } catch { /* ignore */ }
      cyclePollRef.current = setTimeout(poll, 5000);
    }
    poll();
    return () => { live = false; if (cyclePollRef.current) clearTimeout(cyclePollRef.current); };
  }, [selected]);

  // Poll performance (real-time PnL) for the selected agent.
  useEffect(() => {
    setDistill(null);  // clear stale distillation when switching agents
    if (!selected) { setPerf(null); return; }
    let live = true;
    async function poll() {
      try {
        const p = await getAgentPerformance(selected!);
        if (live) setPerf(p);
      } catch { /* ignore */ }
      perfPollRef.current = setTimeout(poll, 5000);
    }
    poll();
    return () => { live = false; if (perfPollRef.current) clearTimeout(perfPollRef.current); };
  }, [selected]);

  async function handleDistill() {
    if (!selected) return;
    setDistilling(true); setDistill(null); setError(null);
    try {
      const res = await distillAgent(selected);
      setDistill(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDistilling(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) { setError("이름 입력"); return; }
    if (!paper && !confirm("⚠️ LIVE 모드 — 실제 자금이 집행됩니다. 계속?")) return;
    setCreating(true); setError(null);
    try {
      await createAgent(name.trim(), type, parseFloat(alloc) || 100000, paper, isDeterministic ? 1 : autonomy, type === "swing" ? market : "US");
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function toggle(a: TradingAgent) {
    try {
      if (a.status === "running") await stopAgent(a.id);
      else await startAgent(a.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(a: TradingAgent) {
    try { await deleteAgent(a.id); if (selected === a.id) setSelected(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="p-6 space-y-4">
      <PageBanner pageKey="agents" />
      {error && <div className="text-neg text-xs bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>}

      {balances && <Balances bal={balances} />}

      {overview && overview.agents.length > 0 && (
        <Overview ov={overview} onSelect={setSelected} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Left: agent list + create */}
        <div className="space-y-3">
          <div className="bg-panel border border-border rounded-lg p-3 space-y-2">
            <h2 className="text-text-2 text-xs uppercase tracking-wider font-semibold">새 에이전트</h2>
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="이름 (예: 모멘텀 단타봇)"
              className="w-full bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm outline-none focus:border-accent"
            />
            <div className="grid grid-cols-2 gap-2">
              {(["swing", "daytrade", "kr_daytrade", "hl_daytrade"] as AgentType[]).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`text-[11px] py-1.5 rounded border ${type === t ? "border-accent text-accent bg-accent/10" : "border-border text-text-3"}`}>
                  {t === "swing" ? "스윙" : t === "daytrade" ? "단타(미국)" : t === "kr_daytrade" ? "단타(한국)" : "단타(HL)"}
                </button>
              ))}
            </div>
            {/* Market scope (swing only) */}
            {type === "swing" && (
              <div className="space-y-1">
                <p className="text-text-3 text-[10px] uppercase tracking-wider">시장 범위</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["US", "KR", "MIXED"] as const).map(m => (
                    <button key={m} onClick={() => setMarket(m)}
                      className={`text-[11px] py-1.5 rounded border ${market === m ? "border-accent text-accent bg-accent/10" : "border-border text-text-3"}`}>
                      {m === "US" ? "미국" : m === "KR" ? "한국" : "혼합"}
                    </button>
                  ))}
                </div>
                {market !== "US" && (
                  <p className="text-text-3 text-[10px] leading-snug">
                    {market === "KR" ? "한국주식(KIS 모의). 대형주 스크리닝." : "미국(Alpaca)+한국(KIS) 동시 운용. 각 장 시간에 거래."}
                  </p>
                )}
              </div>
            )}
            <input
              value={alloc} onChange={e => setAlloc(e.target.value)} placeholder="배정 자본 ($)"
              className="w-full bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent"
            />
            {/* Paper / Live toggle */}
            <div className="flex gap-2">
              {[true, false].map(p => (
                <button key={String(p)} onClick={() => setPaper(p)}
                  className={`flex-1 text-xs py-1.5 rounded border ${
                    paper === p
                      ? p ? "border-pos text-pos bg-pos/10" : "border-neg text-neg bg-neg/10"
                      : "border-border text-text-3"
                  }`}>
                  {p ? "PAPER 모의" : "LIVE 실거래"}
                </button>
              ))}
            </div>
            {!paper && (
              <p className="text-neg text-[10px] leading-snug">⚠️ 실제 자금 집행. 되돌릴 수 없음.</p>
            )}
            {type === "hl_daytrade" && paper && (
              <p className="text-text-3 text-[10px] leading-snug">
                ℹ️ 페이퍼는 크립토만 (테스트넷 TradFi 무거래). 주식·금·지수는 LIVE 필요.
              </p>
            )}
            {/* Autonomy level (LLM swing only; day-trade is rules-based) */}
            {isDeterministic ? (
              <p className="text-text-3 text-[10px] leading-snug">
                ⚙️ 단타는 규칙 기반(레벨1 고정) — LLM 미사용, 토큰 0.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-text-3 text-[10px] uppercase tracking-wider">자율성 레벨</p>
                {[
                  { v: 1, label: "레벨1 · 고정 규칙", desc: "정해진 임계값대로만" },
                  { v: 2, label: "레벨2 · AI 전략가", desc: "백테스트 검증 후 매매 (추천)" },
                  { v: 3, label: "레벨3 · 완전 자율", desc: "AI 재량 (엣지 검증 약함)" },
                ].map(o => (
                  <button key={o.v} onClick={() => setAutonomy(o.v)}
                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded border ${
                      autonomy === o.v ? "border-accent text-accent bg-accent/10" : "border-border text-text-3"
                    }`}>
                    {o.label} <span className="text-text-3">— {o.desc}</span>
                  </button>
                ))}
                {autonomy === 3 && (
                  <p className="text-warn text-[10px] leading-snug">⚠️ 완전 자율은 엣지 검증이 약함. 리스크 한도는 항상 적용됨.</p>
                )}
              </div>
            )}
            <button onClick={handleCreate} disabled={creating}
              className={`w-full text-sm font-medium rounded py-1.5 disabled:opacity-40 ${paper ? "bg-accent text-black" : "bg-neg text-black"}`}>
              {creating ? "생성 중…" : paper ? "에이전트 생성 (모의)" : "에이전트 생성 (실거래)"}
            </button>
          </div>

          <div className="space-y-2">
            {agents.length === 0 && <p className="text-text-3 text-xs px-1">에이전트 없음. 위에서 생성하세요.</p>}
            {agents.map(a => (
              <div key={a.id}
                onClick={() => setSelected(a.id)}
                className={`bg-panel border rounded-lg p-3 cursor-pointer transition-colors ${selected === a.id ? "border-accent/50" : "border-border hover:border-text-3"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-text-1 text-sm font-medium">{a.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-panel-2 text-text-3 border border-border">
                      {a.type === "swing" ? "스윙" : a.type === "hl_daytrade" ? "단타·HL" : a.type === "kr_daytrade" ? "단타·KR" : "단타"}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${a.paper ? "bg-pos/10 text-pos border-pos/30" : "bg-neg/15 text-neg border-neg/40"}`}>
                      {a.paper ? "PAPER" : "● LIVE"}
                    </span>
                    {a.type === "swing" && (
                      <>
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-text-3">
                          Lv{a.autonomy}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-text-3">
                          {a.market === "KR" ? "한국" : a.market === "MIXED" ? "혼합" : "미국"}
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-[10px] ${a.status === "running" ? "text-pos" : "text-text-3"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === "running" ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                    {a.status === "running" ? "가동" : "정지"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-text-3 text-[10px] font-data">자본 ${a.account_alloc.toLocaleString()}</span>
                  <div className="flex gap-1.5">
                    <button onClick={e => { e.stopPropagation(); toggle(a); }}
                      className={`text-[10px] px-2 py-0.5 rounded border ${a.status === "running" ? "border-warn/40 text-warn" : "border-pos/40 text-pos"}`}>
                      {a.status === "running" ? "정지" : "시작"}
                    </button>
                    <button onClick={e => { e.stopPropagation(); remove(a); }}
                      className="text-[10px] px-2 py-0.5 rounded border border-border text-text-3 hover:text-neg hover:border-neg/40">
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: selected agent dashboard / cycles */}
        <div className="space-y-3">
          {!selected ? (
            <p className="text-text-3 text-xs">에이전트를 선택하세요.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex rounded overflow-hidden border border-border w-fit">
                  {(["dashboard", "cycles"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-1.5 text-xs font-medium ${tab === t ? "border-accent text-accent bg-accent/10" : "bg-panel-2 text-text-3 hover:bg-panel"}`}>
                      {t === "dashboard" ? "대시보드" : "사이클"}
                    </button>
                  ))}
                </div>
                <span className="text-text-3 text-[10px] font-data">
                  {agents.find(a => a.id === selected)?.name} · 5초 실시간
                </span>
              </div>

              {tab === "dashboard" && (
                <div className="space-y-3">
                  <Dashboard perf={perf} />

                  {/* Strategy distillation — Lv3 자유탐색 → 검증된 규칙 전략 */}
                  <div className="bg-panel border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-text-2 text-xs font-semibold">🧪 전략 증류</span>
                        <p className="text-text-3 text-[10px] mt-0.5">거래로그 → 규칙 전략으로 증류 → 백테스트 검증</p>
                      </div>
                      <button onClick={handleDistill} disabled={distilling}
                        className="text-[11px] px-3 py-1.5 rounded bg-accent text-black font-medium disabled:opacity-40">
                        {distilling ? "증류 중… (~1분)" : "증류 실행"}
                      </button>
                    </div>
                    {distill && (
                      <div className="mt-3 border-t border-border pt-2.5 space-y-1.5">
                        <div className={`text-xs font-semibold ${distill.validated ? "text-pos" : "text-neg"}`}>
                          {distill.validated ? "✅ " : "⚠️ "}{distill.verdict}
                        </div>
                        <div className="text-[11px] font-data text-text-2 space-y-0.5">
                          <div>전략: {distill.proposal.strategy} · {distill.proposal.instrument_id}</div>
                          <div>파라미터: {JSON.stringify(distill.proposal.params)}</div>
                          <div className="flex gap-3">
                            <span className={pnlColor(distill.backtest.sharpe_ratio ?? null)}>Sharpe {distill.backtest.sharpe_ratio?.toFixed(2) ?? "—"}</span>
                            <span className={pnlColor(distill.backtest.total_pnl_pct ?? null)}>수익 {distill.backtest.total_pnl_pct?.toFixed(2) ?? "—"}%</span>
                            <span className="text-text-3">승률 {distill.backtest.win_rate != null ? (distill.backtest.win_rate * 100).toFixed(0) + "%" : "—"}</span>
                          </div>
                        </div>
                        {distill.proposal.rationale && <p className="text-text-3 text-[10px] leading-snug">💡 {distill.proposal.rationale}</p>}
                        <p className="text-text-3 text-[9px]">거래 {distill.trades_analyzed}건 분석</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "cycles" && (
                <div>
                  {cycles.length === 0 && (
                    <p className="text-text-3 text-xs">아직 사이클 기록 없음. 에이전트 시작 후 첫 사이클을 기다리세요.</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[...cycles].reverse().map((c, i) => <CycleCard key={`${c.cycle}-${i}`} c={c} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
