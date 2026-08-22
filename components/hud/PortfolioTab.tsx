"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  listAgents, getAgentPerformance, getBuybackBot, getExecutionConsole, getLabTasks, getDashboardPnlAll,
  type TradingAgent, type AgentPerformance, type BuybackBot, type ExecutionConsole, type LabTask, type DashboardPnlAll,
} from "@/lib/api";
import { LivePulse, AnimatedNumber } from "@/components/Jarvis";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui";

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
/** 배분·잔고처럼 부호가 의미 없는 금액 (손익이 아님) */
function amt(n: number | null | undefined): string {
  return typeof n === "number" ? Math.round(n).toLocaleString() : "—";
}

// KRW와 USD를 그냥 더하면 의미 없는 숫자가 나옴 → 통화별로 집계를 쪼갠다.
function currencyOf(market: TradingAgent["market"]): "₩" | "$" {
  return market === "KR" ? "₩" : "$";
}
const ALLOC_COLORS = ["bg-accent/70", "bg-info/70", "bg-pos/70", "bg-warn/70", "bg-neg/60"];

export default function PortfolioTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [bot, setBot] = useState<BuybackBot | null>(null);
  const [exec, setExec] = useState<ExecutionConsole | null>(null);
  const [paperTasks, setPaperTasks] = useState<LabTask[] | null>(null);
  const [pnlAll, setPnlAll] = useState<DashboardPnlAll | null>(null);
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
      getDashboardPnlAll(ctrl.signal).then(d => { if (mounted) setPnlAll(d); }).catch(() => {});
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

  const running = rows?.filter(r => r.agent.status === "running").length ?? 0;

  // 통화별 집계 — 각 통화 안에서만 합산/수익률 계산
  const groups = (() => {
    const m = new Map<string, { cur: string; alloc: number; pnl: number; rows: Row[] }>();
    for (const r of rows ?? []) {
      const cur = currencyOf(r.agent.market);
      const g = m.get(cur) ?? { cur, alloc: 0, pnl: 0, rows: [] };
      g.alloc += r.perf?.alloc ?? r.agent.account_alloc ?? 0;
      g.pnl += r.perf?.total_pnl ?? 0;
      g.rows.push(r);
      m.set(cur, g);
    }
    return [...m.values()].sort((a, b) => b.alloc - a.alloc);
  })();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text-1 tracking-wide">총 포트폴리오</h1>
        <LivePulse tone={running > 0 ? "pos" : "text-3"} label={running > 0 ? `${running} 가동` : "대기"} />
      </div>

      {/* 총괄 요약 — 통화별로 따로. KRW+USD 합산은 의미 없는 숫자라 만들지 않음 */}
      {groups.map(g => {
        const ret = g.alloc > 0 ? (g.pnl / g.alloc) * 100 : 0;
        return (
          <div key={g.cur} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Summary label={`총 배분 (${g.cur})`} num={g.alloc} decimals={0} prefix={g.cur} />
            <Summary label="총 손익" num={g.pnl} decimals={0} prefix={g.cur} signed pos={g.pnl >= 0} />
            <Summary label="총 수익률" num={ret} decimals={2} suffix="%" signed pos={ret >= 0} />
            <Summary label="AI" val={`${g.rows.filter(r => r.agent.status === "running").length} / ${g.rows.length} 가동`} />
          </div>
        );
      })}

      {/* 연구 트랙 — 페이퍼 돈길 (라이브 배분과 별개, 실캐피탈 0) */}
      {bot && (
        <Link href="/lab/execution"
          className="hud-frame flex items-center gap-3 bg-panel border border-accent/25 rounded-lg px-4 py-2.5 no-underline hover:bg-accent/5 transition-colors flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-text-3 shrink-0">연구 트랙 (페이퍼)</span>
          <span className="text-[11px] font-data text-text-1">buyback {bot.version}</span>
          <span className="text-[11px] font-data text-text-3">보유 {bot.open} · 청산 {bot.closed}</span>
          {bot.cum_paper_pnl != null && (
            <span className={`text-[11px] font-data px-1 font-bold ${bot.cum_paper_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
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

      {!rows && !err && <LoadingState message="포트폴리오 로딩 중…" hint="에이전트별 손익 집계 — 5~10초 걸립니다" />}
      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">오류: {err}</div>}
      {rows && rows.length === 0 && (
        <div className="bg-panel border border-border rounded-lg p-6 text-center text-text-3 text-sm">
          운용 중인 AI 없음 — <Link href="/agents" className="text-accent no-underline">에이전트</Link>에서 생성.
        </div>
      )}

      {/* 배분 막대 — 색만 있고 이름이 없으면 못 읽으므로 범례 동반 */}
      {groups.some(g => g.alloc > 0) && (
        <Panel>
          <PanelHeader>AI별 자본 배분</PanelHeader>
          <div className="p-3 space-y-3">
            {groups.filter(g => g.alloc > 0).map(g => (
              <div key={g.cur} className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-3">{g.cur} · {amt(g.alloc)}</div>
                <div className="flex h-4 rounded overflow-hidden border border-border">
                  {g.rows.map((r, i) => {
                    const w = ((r.perf?.alloc ?? r.agent.account_alloc ?? 0) / g.alloc) * 100;
                    return <div key={r.agent.id} className={`${ALLOC_COLORS[i % ALLOC_COLORS.length]} ${widthClass(w)}`}
                      title={`${r.agent.name} ${w.toFixed(1)}%`} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {g.rows.map((r, i) => {
                    const w = ((r.perf?.alloc ?? r.agent.account_alloc ?? 0) / g.alloc) * 100;
                    return (
                      <span key={r.agent.id} className="flex items-center gap-1.5 text-[11px] text-text-3">
                        <span className={`inline-block w-2 h-2 rounded-sm ${ALLOC_COLORS[i % ALLOC_COLORS.length]}`} />
                        <span className="text-text-2">{r.agent.name}</span>
                        <span className="font-data tabular-nums">{w.toFixed(1)}%</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 독립봇 실현손익 — council 에이전트와 별개 자본(dart/vrp/polymarket/sharp_wallet/copytrade) */}
      {pnlAll && (
        <Panel>
          <PanelHeader>독립봇 실현손익</PanelHeader>
          <div className="p-3 space-y-1.5">
            {pnlAll.bots.map(b => (
              <div key={b.id} className="flex items-center justify-between text-xs">
                <span className="text-text-2">{b.name}{b.note && <span className="text-text-3"> ({b.note})</span>}</span>
                <span className={`font-data px-1 font-bold ${b.realized_pnl === null ? "text-text-3" : b.realized_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                  {b.realized_pnl === null ? "—" : `${b.realized_pnl >= 0 ? "+" : "-"}$${amt(Math.abs(b.realized_pnl))}`}
                </span>
              </div>
            ))}
            {/* 서버의 grand_total은 KRW 에이전트 손익까지 더해서(=통화 혼합) 의미가 없어 쓰지 않음 */}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
              <span className="text-text-1 font-semibold">독립봇 합계 ($)</span>
              <span className={`font-data px-1 font-bold ${pnlAll.bots_totals.realized_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {pnlAll.bots_totals.realized_pnl >= 0 ? "+" : "-"}${amt(Math.abs(pnlAll.bots_totals.realized_pnl))}
              </span>
            </div>
          </div>
        </Panel>
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
                  <div className="text-[11px] text-text-3">배분 {currencyOf(r.agent.market)}{amt(p?.alloc ?? r.agent.account_alloc)} · 자율 Lv{r.agent.autonomy}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-data px-1 font-bold inline-block ${(p?.return_pct ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{pct(p?.return_pct)}</div>
                  <div className="text-[11px] text-text-3 font-data">{won(p?.total_pnl)} · {p?.trades?.length ?? 0}건</div>
                </div>
                <span className={`text-text-3 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
              </button>

              {open && p && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Kv k="현금" v={`${currencyOf(r.agent.market)}${amt(p.cash)}`} />
                    <Kv k="투자중" v={`${currencyOf(r.agent.market)}${amt(p.invested)}`} />
                    <Kv k="실현손익" v={won(p.realized_pnl)} pos={p.realized_pnl >= 0} />
                    <Kv k="평가손익" v={won(p.unrealized_pnl)} pos={p.unrealized_pnl >= 0} />
                  </div>

                  {p.open_positions.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1">보유 포지션</div>
                      {p.open_positions.map((o, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] font-data py-0.5">
                          <span className="text-accent no-underline">{o.symbol}</span>
                          <span className="text-text-3">{o.qty}주 @ {o.avg_price}</span>
                          <span className={`px-1 font-bold ${(o.unrealized_pnl ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{won(o.unrealized_pnl)}</span>
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
                          <span className={`w-8 shrink-0 px-1 font-bold ${t.side === "buy" ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{t.side === "buy" ? "매수" : "매도"}</span>
                          <span className="text-accent no-underline w-14 shrink-0 truncate">{t.symbol}</span>
                          <span className="text-text-3">{t.qty}@{t.price}</span>
                          {t.realized_pnl !== null && <span className={`ml-auto px-1 font-bold ${t.realized_pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{won(t.realized_pnl)}</span>}
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

function Summary({ label, val, num, decimals = 0, prefix = "", suffix = "", signed = false, pos }:
  { label: string; val?: string; num?: number; decimals?: number; prefix?: string; suffix?: string; signed?: boolean; pos?: boolean }) {
  const c = pos === undefined ? "text-text-1" : pos ? "text-pos" : "text-neg";
  return (
    <div className="hud-frame bg-panel border border-border rounded-lg px-3 py-2.5 text-center">
      <div className={`text-lg font-semibold font-data ${c}`}>
        {typeof num === "number"
          ? <AnimatedNumber value={num} decimals={decimals} prefix={prefix} suffix={suffix} signed={signed} />
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
