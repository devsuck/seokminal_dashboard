"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  listAgents, getAgentPerformance, getBuybackBot, getExecutionConsole, getLabTasks,
  type TradingAgent, type AgentPerformance, type BuybackBot, type ExecutionConsole, type LabTask,
} from "@/lib/api";
import { LivePulse, AnimatedNumber } from "@/components/Jarvis";

/* 총 포트폴리오 — 지금 얼마가 어떤 AI에 가있는지 + 각 AI 수익률·매매기록.
   + 연구 트랙(페이퍼 돈길) 스트립: 라이브 배분 0이어도 진짜 돈길은 여기서 보이게. */

interface Row { agent: TradingAgent; perf: AgentPerformance | null; }

// 막대 폭: style={{}} 금지 → 리터럴 폭 클래스(5% 스텝)
const WIDTHS: Record<number, string> = {
  0: "w-0", 5: "w-[5%]", 10: "w-[10%]", 15: "w-[15%]", 20: "w-[20%]", 25: "w-[25%]", 30: "w-[30%]",
  35: "w-[35%]", 40: "w-[40%]", 45: "w-[45%]", 50: "w-[50%]", 55: "w-[55%]", 60: "w-[60%]", 65: "w-[65%]",
  70: "w-[70%]", 75: "w-[75%]", 80: "w-[80%]", 85: "w-[85%]", 90: "w-[90%]", 95: "w-[95%]", 100: "w-full",
};
function widthClass(p: number): string { return WIDTHS[Math.max(0, Math.min(100, Math.round(p / 5) * 5))] ?? "w-0"; }

function pct(n: number | null | undefined, d = 2): string {
  return typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}%` : "—";
}
function won(n: number | null | undefined): string {
  return typeof n === "number" ? `${n >= 0 ? "+" : ""}${Math.round(n).toLocaleString()}` : "—";
}

export default function OverviewPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bot, setBot] = useState<BuybackBot | null>(null);
  const [exec, setExec] = useState<ExecutionConsole | null>(null);
  const [paperTasks, setPaperTasks] = useState<LabTask[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getBuybackBot(ctrl.signal).then(b => { if (mounted) setBot(b); }).catch(() => {});
      getExecutionConsole(ctrl.signal).then(e => { if (mounted) setExec(e); }).catch(() => {});
      getLabTasks(ctrl.signal).then(t => { if (mounted) setPaperTasks(t.tasks); }).catch(() => {});
      try {
        const { agents } = await listAgents(ctrl.signal);
        const perfs = await Promise.all(agents.map(a =>
          getAgentPerformance(a.id, ctrl.signal).catch(() => null)));
        if (mounted && !ctrl.signal.aborted) {
          setRows(agents.map((a, i) => ({ agent: a, perf: perfs[i] })));
          setErr(null);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  const totalAlloc = rows?.reduce((s, r) => s + (r.perf?.alloc ?? r.agent.account_alloc ?? 0), 0) ?? 0;
  const totalPnl = rows?.reduce((s, r) => s + (r.perf?.total_pnl ?? 0), 0) ?? 0;
  const totalReturn = totalAlloc > 0 ? (totalPnl / totalAlloc) * 100 : 0;
  const running = rows?.filter(r => r.agent.status === "running").length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text-1 tracking-wide">총 포트폴리오</h1>
        <LivePulse tone={running > 0 ? "pos" : "text-3"} label={running > 0 ? `${running} 가동` : "대기"} />
      </div>

      {/* 총괄 요약 — 이 페이지의 답: 얼마가, 어디에, 성과는 */}
      {rows && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Summary label="총 배분" num={totalAlloc} decimals={0} />
          <Summary label="총 손익" num={totalPnl} decimals={0} prefix={totalPnl >= 0 ? "+" : ""} pos={totalPnl >= 0} />
          <Summary label="총 수익률" num={totalReturn} decimals={2} prefix={totalReturn >= 0 ? "+" : ""} suffix="%" pos={totalReturn >= 0} />
          <Summary label="가동 AI" val={`${running} / ${rows.length}`} />
        </div>
      )}

      {/* 연구 트랙 — 페이퍼 돈길 (라이브 배분과 별개, 실캐피탈 0) */}
      {bot && (
        <Link href="/lab/execution"
          className="hud-frame flex items-center gap-3 bg-panel border border-accent/25 rounded-lg px-4 py-2.5 no-underline hover:bg-accent/5 transition-colors flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-text-3 shrink-0">연구 트랙 (페이퍼)</span>
          <span className="text-[11px] font-data text-text-1">buyback {bot.version}</span>
          <span className="text-[11px] font-data text-text-3">보유 {bot.open} · 청산 {bot.closed}</span>
          {bot.cum_paper_pnl != null && (
            <span className={`text-[11px] font-data ${bot.cum_paper_pnl >= 0 ? "text-pos" : "text-neg"}`}>
              누적 {bot.cum_paper_pnl >= 0 ? "+" : ""}{bot.cum_paper_pnl.toFixed(2)}%
            </span>
          )}
          {exec?.arm_decision && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-data ${
              exec.arm_decision.decision === "GO" ? "border-pos/50 text-pos bg-pos/10" :
              exec.arm_decision.decision === "KILL" ? "border-neg/50 text-neg bg-neg/10 animate-blink" :
              "border-info/40 text-info bg-info/10"}`}>
              ARM {exec.arm_decision.decision}
            </span>
          )}
          {paperTasks && paperTasks.length > 0 && (
            <span className="text-[11px] font-data text-text-3">
              페이퍼 전략 {paperTasks.length} · {paperTasks.map(t => t.strategy_id.replace(/^futures_|^kr_dart_/, "")).join(" · ")}
            </span>
          )}
          <span className="ml-auto text-[11px] text-accent shrink-0">집행 콘솔 →</span>
        </Link>
      )}

      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">오류: {err}</div>}
      {rows && rows.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-6 text-center text-text-3 text-sm">
          운용 중인 AI 없음 — <Link href="/agents" className="text-accent no-underline">에이전트</Link>에서 생성.
        </div>
      )}

      {/* 배분 막대 */}
      {rows && rows.length > 0 && totalAlloc > 0 && (
        <div className="bg-panel border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5">AI별 자본 배분</div>
          <div className="flex h-4 rounded overflow-hidden border border-border">
            {rows.map((r, i) => {
              const w = ((r.perf?.alloc ?? r.agent.account_alloc ?? 0) / totalAlloc) * 100;
              const colors = ["bg-accent/70", "bg-info/70", "bg-pos/70", "bg-warn/70", "bg-neg/60"];
              return <div key={r.agent.id} className={`${colors[i % colors.length]} ${widthClass(w)}`} title={`${r.agent.name} ${w.toFixed(0)}%`} />;
            })}
          </div>
        </div>
      )}

      {/* AI별 카드 */}
      <div className="space-y-2">
        {rows?.map(r => {
          const p = r.perf;
          const open = openId === r.agent.id;
          return (
            <div key={r.agent.id} className="bg-panel border border-border rounded-lg">
              <button onClick={() => setOpenId(open ? null : r.agent.id)}
                className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer bg-transparent border-0 text-left">
                <LivePulse tone={r.agent.status === "running" ? "pos" : "text-3"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-1 truncate">{r.agent.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-3">{r.agent.market}</span>
                    {r.agent.paper && <span className="text-[10px] px-1.5 py-0.5 rounded border border-info/40 text-info">페이퍼</span>}
                    {r.agent.validated === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-warn/40 text-warn bg-warn/10"
                        title={r.agent.validation_reason ?? "registry 미등록 전략"}>미검증</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-3">배분 {won(p?.alloc ?? r.agent.account_alloc)} · 자율 Lv{r.agent.autonomy}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-data ${(p?.return_pct ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{pct(p?.return_pct)}</div>
                  <div className="text-[11px] text-text-3 font-data">{won(p?.total_pnl)} · {p?.trades?.length ?? 0}건</div>
                </div>
                <span className={`text-text-3 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
              </button>

              {open && p && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Kv k="현금" v={won(p.cash)} />
                    <Kv k="투자중" v={won(p.invested)} />
                    <Kv k="실현손익" v={won(p.realized_pnl)} pos={p.realized_pnl >= 0} />
                    <Kv k="평가손익" v={won(p.unrealized_pnl)} pos={p.unrealized_pnl >= 0} />
                  </div>

                  {p.open_positions.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">보유 포지션</div>
                      {p.open_positions.map((o, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] font-data py-0.5">
                          <Link href={`/market?symbol=${encodeURIComponent(o.symbol)}`} className="text-accent no-underline">{o.symbol}</Link>
                          <span className="text-text-3">{o.qty}주 @ {o.avg_price}</span>
                          <span className={(o.unrealized_pnl ?? 0) >= 0 ? "text-pos" : "text-neg"}>{won(o.unrealized_pnl)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">최근 매매기록 ({p.trades.length})</div>
                    <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                      {p.trades.slice(-15).reverse().map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] font-data">
                          <span className="text-text-3 w-24 shrink-0 truncate">{t.ts?.slice(5, 16) ?? "—"}</span>
                          <span className={`w-8 shrink-0 ${t.side === "buy" ? "text-pos" : "text-neg"}`}>{t.side === "buy" ? "매수" : "매도"}</span>
                          <Link href={`/market?symbol=${encodeURIComponent(t.symbol)}`} className="text-accent no-underline w-14 shrink-0 truncate">{t.symbol}</Link>
                          <span className="text-text-3">{t.qty}@{t.price}</span>
                          {t.realized_pnl !== null && <span className={`ml-auto ${t.realized_pnl >= 0 ? "text-pos" : "text-neg"}`}>{won(t.realized_pnl)}</span>}
                        </div>
                      ))}
                      {p.trades.length === 0 && <div className="text-[11px] text-text-3">아직 매매 없음</div>}
                    </div>
                  </div>
                  <Link href={`/agents`} className="inline-block text-xs text-accent border border-accent/30 rounded px-2.5 py-1 no-underline hover:bg-accent/10">
                    에이전트 상세 →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Summary({ label, val, num, decimals = 0, prefix = "", suffix = "", pos }:
  { label: string; val?: string; num?: number; decimals?: number; prefix?: string; suffix?: string; pos?: boolean }) {
  const c = pos === undefined ? "text-text-1" : pos ? "text-pos" : "text-neg";
  return (
    <div className="hud-frame bg-panel border border-border rounded-lg px-3 py-2.5 text-center">
      <div className={`text-lg font-semibold font-data ${c}`}>
        {typeof num === "number"
          ? <AnimatedNumber value={num} decimals={decimals} prefix={prefix} suffix={suffix} />
          : val}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-text-3">{label}</div>
    </div>
  );
}
function Kv({ k, v, pos }: { k: string; v: string; pos?: boolean }) {
  const c = pos === undefined ? "text-text-1" : pos ? "text-pos" : "text-neg";
  return (
    <div className="bg-panel-2 border border-border rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-3">{k}</div>
      <div className={`text-sm font-data ${c}`}>{v}</div>
    </div>
  );
}
