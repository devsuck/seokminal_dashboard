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
  getGodModeEligibility,
  promoteToGodMode,
  type TradingAgent,
  type AgentType,
  type AgentCycle,
  type AgentPerformance,
  type DistillResult,
  type AgentsOverview,
  type AccountBalances,
  type GodModeEligibility,
} from "@/lib/api";
import { ArcReactor, type HudTone } from "@/components/Hud";
import { displayLevel } from "@/lib/agent-level";
import { Balances } from "@/components/AccountBalances";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, SegmentedToggle } from "@/components/ui";
import { TOKEN, CATEGORICAL, categoricalColor } from "@/lib/chart-colors";

/** God Mode 전용 아이콘 — 왕관(3-jewel). LIVE 승급 상태를 나타내는 유일한 자리에만 쓴다. */
function IconCrown({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2,12.5 L2,6 L5,9 L8,4 L11,9 L14,6 L14,12.5 L2,12.5 Z" />
      <circle cx="2" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Style = "swing" | "daytrade" | "longterm";
type Mkt = "KR" | "US" | "CRYPTO";

const STYLE_LABEL: Record<Style, string> = { swing: "스윙", daytrade: "단타", longterm: "장투" };
const MKT_LABEL: Record<Mkt, string> = { KR: "한국주식", US: "미국주식", CRYPTO: "가상화폐" };

const LV_CFG: Record<number, { color: string; bg: string; border: string; label: string }> = {
  1: { color: TOKEN.pos, bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.5)",   label: "Lv1" },
  2: { color: TOKEN.info, bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.5)",  label: "Lv2" },
  3: { color: TOKEN.neg, bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.5)",   label: "Lv3" },
};
function lvCfg(lv: number) { return LV_CFG[lv] ?? LV_CFG[2]; }
function lvToTone(lv: number): HudTone {
  const map: Record<number, HudTone> = { 1: "pos", 2: "info", 3: "neg" };
  return map[lv] ?? "accent";
}

function LvBadge({ lv }: { lv: number }) {
  const c = lvCfg(lv);
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      {c.label}
    </span>
  );
}

function ccyOfMkt(m: Mkt): string {
  return m === "KR" ? "KRW" : m === "CRYPTO" ? "USDC" : "USD";
}

/** 기존 에이전트의 표시 통화 (type+market에서 유추). */
function agentCcy(a: TradingAgent): string {
  if (a.type === "hl_daytrade") return "USDC";
  if (a.type === "kr_daytrade" || a.type === "kr_macro" || a.market === "KR") return "KRW";
  return "USD";
}

function agentStyleLabel(a: TradingAgent): string {
  if (a.type === "condition_lv1") return "조건식";
  if (a.type === "option_lv1") return "옵션 조건식";
  if (a.type === "autonomous") return "자율학습";
  if (a.type === "kr_macro") return "KR거시";

  return a.type === "longterm" ? "장투" : a.type === "swing" ? "스윙" : "단타";
}
function agentMktLabel(a: TradingAgent): string {
  if (a.type === "hl_daytrade") return "크립토";
  if (a.type === "kr_macro" || a.type === "kr_daytrade" || a.market === "KR") return "한국";
  if (a.market === "MIXED") return "혼합";
  return "미국";
}

/** 스타일+시장 → 백엔드 (type, market). */
function toBackend(style: Style | "autonomous" | "kr_macro", m: Mkt): { type: AgentType; market: "US" | "KR" | "MIXED" } {
  if (style === "autonomous") return { type: "autonomous", market: "US" };
  if (style === "kr_macro") return { type: "kr_macro", market: "KR" };
  if (style === "daytrade") {
    if (m === "KR") return { type: "kr_daytrade", market: "KR" };
    if (m === "CRYPTO") return { type: "hl_daytrade", market: "US" };
    return { type: "daytrade", market: "US" };
  }
  const type: AgentType = style === "longterm" ? "longterm" : "swing";
  return { type, market: m === "KR" ? "KR" : "US" };
}

/** 신규 에이전트가 실제로 걸리는 브로커 venue — accounts/balances의 venue 키와 동일 기준.
    실계좌(paper=false)는 가드 대상 아님(수동 승인 전제, 여기선 페이퍼 과다배정만 막음). */
function venueBucket(type: AgentType, market: string, paper: boolean): string | null {
  if (!paper) return null;
  if (type === "hl_daytrade") return "hl_testnet";
  if (market === "KR") return "kis_mock";
  return "alpaca";
}

function ccySym(ccy: string): string {
  return ccy === "KRW" ? "₩" : ccy === "USDC" ? "" : ccy === "EUR" ? "€" : "$";
}

function moneyCcy(v: number, ccy: string, signed = false): string {
  const sign = signed && v > 0 ? "+" : "";
  const suffix = ccy === "USDC" ? " USDC" : "";
  const digits = ccy === "KRW" ? 0 : 2;
  return `${sign}${ccySym(ccy)}${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
}

function fmtMoney(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pnlColor(v: number | null | undefined): string {
  if (v == null) return "text-text-3";
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-2";
}

const DECISION_STYLE: Record<string, string> = {
  BUY: "bg-pos/15 text-pos border-pos/40",
  SELL: "bg-neg/15 text-neg border-neg/40",
  WATCH: "bg-warn/10 text-warn border-warn/30",
  HOLD: "bg-panel-2 text-text-3 border-border",
  SKIP: "bg-panel-2 text-text-3 border-border",
};
const DECISION_LABEL: Record<string, string> = {
  BUY: "매수",
  SELL: "매도",
  WATCH: "관찰",
  HOLD: "보유",
  SKIP: "건너뜀",
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
            {DECISION_LABEL[c.decision] ?? c.decision}
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
        <div className="text-[11px] text-accent font-data mb-0.5"> {c.action}</div>
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

function PortfolioPie({ perf }: { perf: AgentPerformance }) {
  // Slices: each open position (market value) + cash.
  const slices = perf.open_positions.map((p, i) => ({
    label: p.symbol,
    value: p.qty * (p.current_price ?? p.avg_price),
    color: categoricalColor(i),
  }));
  const cashNegative = perf.cash < 0;
  slices.push({ label: "현금", value: Math.max(perf.cash, 0), color: TOKEN.border });
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
        {cashNegative && (
          <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
            <span className="w-2 h-2 rounded-sm shrink-0 bg-neg" />
            <span className="text-neg font-data truncate flex-1">현금 마이너스</span>
            <span className="text-neg font-data font-bold">{fmtMoney(perf.cash)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ perf, ccy = "USD" }: { perf: AgentPerformance | null; ccy?: string }) {
  if (!perf) return <p className="text-text-3 text-xs">성과 데이터 로딩 중…</p>;
  const sym = ccySym(ccy);
  const digits = ccy === "KRW" ? 0 : 2;
  const fmt = (v: number) => `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${ccy === "USDC" ? " USDC" : ""}`;
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
        <StatCard label="배정 자본" value={fmt(perf.alloc)} />
        <StatCard label="현금" value={fmt(perf.cash)} />
        <StatCard label="투자 중" value={fmt(perf.invested)} />
      </div>

      {/* Portfolio composition pie (positions + cash) */}
      {(perf.open_positions.length > 0 || perf.cash > 0) && <PortfolioPie perf={perf} />}

      {/* Open positions */}
      <Panel>
        <PanelHeader>보유 포지션 ({perf.open_positions.length})</PanelHeader>
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
                  <td className="px-3 py-1.5 text-right">
                    <span className={`px-1 font-bold ${
                      p.unrealized_pnl == null ? "text-text-2" :
                      p.unrealized_pnl > 0 ? "bg-pos/20 text-pos" : p.unrealized_pnl < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                      {p.unrealized_pnl != null ? fmtMoney(p.unrealized_pnl) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Trade log with reasons */}
      <Panel>
        <PanelHeader>매매 기록 ({perf.trades.length}) — 매수/매도 이유 포함</PanelHeader>
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
                    <span className={`text-[11px] font-data px-1 font-bold ${
                      t.realized_pnl > 0 ? "bg-pos/20 text-pos" : t.realized_pnl < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                      {fmtMoney(t.realized_pnl)}
                    </span>
                  )}
                </div>
                {t.reason && <p className="text-text-2 text-[11px] mt-1 leading-snug"> {t.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Lv3 에이전트의 God Mode 승급 패널 — 최근 실적 3조건 심사 + 사람 확인 클릭. */
function GodModePanel({ agent, onPromoted }: { agent: TradingAgent; onPromoted: () => void }) {
  const [check, setCheck] = useState<GodModeEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getGodModeEligibility(agent.id)
      .then(r => { if (live) setCheck(r); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [agent.id]);

  if (agent.god_mode) {
    return (
      <div className="bg-panel border rounded-lg p-3 flex items-center gap-1.5 animate-pulse-glow-purple"
        style={{ borderColor: "rgba(168,85,247,0.4)" }}>
        <IconCrown className="purple-glow-lg" />
        <span className="text-[11px] font-semibold" style={{ color: CATEGORICAL[0] }}>God Mode 승급됨 — LIVE 집행 중</span>
      </div>
    );
  }

  async function handlePromote() {
    if (!confirm("God Mode 승급 — 이 에이전트가 실제 자금으로 LIVE 거래를 시작합니다. 되돌릴 수 없습니다. 계속?")) return;
    setPromoting(true); setError(null);
    try {
      await promoteToGodMode(agent.id);
      onPromoted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(false);
    }
  }

  return (
    <Panel>
      <PanelHeader right={
        <button onClick={handlePromote} disabled={!check?.eligible || promoting}
          className="text-[11px] px-3 py-1.5 rounded font-medium disabled:opacity-40"
          style={{ background: check?.eligible ? CATEGORICAL[0] : undefined, color: check?.eligible ? TOKEN.bg : undefined }}>
          {promoting ? "승급 중…" : "God Mode 승급 (LIVE 전환)"}
        </button>
      }>
        <IconCrown size={12} className="inline mr-1 -mt-0.5" />God Mode 승급 심사
      </PanelHeader>
      <div className="p-3 space-y-2">
        <p className="text-text-3 text-[10px]">최근 {check?.window_days ?? 30}일 실적 3조건 — 전부 통과해야 승급 가능</p>
        {loading && <p className="text-text-3 text-[10px]">심사 중…</p>}
        {error && <p className="text-neg text-[10px]">{error}</p>}
        {check && (
          <div className="space-y-1 border-t border-border pt-2">
            {check.conditions.map(c => (
              <div key={c.key} className="flex items-center gap-2 text-[11px]">
                <span className={c.passed ? "text-pos" : "text-text-3"}>{c.passed ? "✓" : "✗"}</span>
                <span className={c.passed ? "text-text-1" : "text-text-3"}>{c.label}</span>
                <span className="text-text-3 text-[10px] ml-auto font-data">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
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
              <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${a.paper ? "text-text-3" : "bg-neg/15 text-neg"}`}>{a.paper ? "P" : "L"}</span>
              <div className="flex-1 h-2.5 bg-panel-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pos ? "bg-pos" : "bg-neg"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`w-20 text-right text-[10px] font-data shrink-0 px-1 font-bold ${
                a.realized_pnl > 0 ? "bg-pos/20 text-pos" : a.realized_pnl < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>{fmtMoney(a.realized_pnl)}</span>
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
  const [confirmDel, setConfirmDel] = useState<TradingAgent | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [cycles, setCycles] = useState<AgentCycle[]>([]);
  const [perf, setPerf] = useState<AgentPerformance | null>(null);
  const [tab, setTab] = useState<"dashboard" | "cycles">("dashboard");
  const [distilling, setDistilling] = useState(false);
  const [distill, setDistill] = useState<DistillResult | null>(null);
  const [overview, setOverview] = useState<AgentsOverview | null>(null);
  const [balances, setBalances] = useState<AccountBalances | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form — 스타일(스윙/단타/장투/자율형/KR거시/인프라헤지) × 시장(한국/미국/가상화폐) 두 축.
  const [name, setName] = useState("");
  const [style, setStyle] = useState<Style | "autonomous" | "kr_macro">("daytrade");
  const [mkt, setMkt] = useState<Mkt>("US");
  const [alloc, setAlloc] = useState("");
  const [paper, setPaper] = useState(true);
  const [autonomy, setAutonomy] = useState(2);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // 스타일별 허용 시장 (스윙·장투는 크립토 미지원, 인프라헤지는 KR 고정).
  const allowedMkts: Mkt[] = style === "daytrade" ? ["KR", "US", "CRYPTO"] : ["KR", "US"];
  useEffect(() => {
    if (!allowedMkts.includes(mkt)) setMkt("US");
    // 단타 선택 시 기본 Lv3(자가학습, 페이퍼 전용으로 뚫어줌)
    if (style === "daytrade") setAutonomy(3);
    else if (style !== "autonomous" && style !== "kr_macro") setAutonomy(2);
    /* eslint-disable-next-line */
  }, [style]);

  // 자율형/KR거시는 Lv3(자가학습) 고정.
  const isDeterministic = false;
  const isLv3Style = style === "autonomous" || style === "kr_macro";
  const ccy = ccyOfMkt(mkt);

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
    const amt = parseFloat(alloc);
    if (!amt || amt <= 0) { setError(`배정 금액 입력 (${ccy})`); return; }
    if (!paper && !confirm("⚠ LIVE 모드 — 실제 자금이 집행됩니다. 계속?")) return;
    const { type, market } = toBackend(style, mkt);
    const bucket = venueBucket(type, market, paper);
    const row = bucket ? balances?.accounts.find(a => a.venue === bucket) : null;
    if (row && row.balance != null && row.allocated + amt > row.balance) {
      setError(
        `배정 초과: ${row.label} 실제 잔고 ${moneyCcy(row.balance, row.ccy)}, ` +
        `기존 봇 배정 합계 ${moneyCcy(row.allocated, row.ccy)} + 신규 ${moneyCcy(amt, row.ccy)} ` +
        `= ${moneyCcy(row.allocated + amt, row.ccy)} — 실제 보유 금액보다 많이 배정할 수 없음`,
      );
      return;
    }
    setCreating(true); setError(null);
    try {
      const effectiveAutonomy = isLv3Style ? 3 : autonomy;
      await createAgent(name.trim(), type, amt, paper, effectiveAutonomy, market);
      setName(""); setAlloc("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  function isLive(a: TradingAgent) {
    return a.session_live ?? (a.status === "running");
  }

  async function toggle(a: TradingAgent) {
    try {
      if (isLive(a)) await stopAgent(a.id);
      else await startAgent(a.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(a: TradingAgent, confirm?: string) {
    try { await deleteAgent(a.id, confirm); if (selected === a.id) setSelected(null); setConfirmDel(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function onDelete(a: TradingAgent) {
    if (a.protected) { setConfirmDel(a); setConfirmName(""); }  // 잠금 → 이름 확인 모달
    else remove(a);                                             // 일반 → 즉시
  }

  return (
    <div className="p-6 space-y-4">
      <div className="mb-4">
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">자율형 AI 에이전트</h1>
        <p className="text-text-3 text-sm mt-0.5">여러 AI 트레이딩 에이전트를 봇처럼 생성·관리합니다. 스윙(중장기)/데이트레이딩 타입, 각 사이클은 구조화 카드로 표시됩니다.</p>
      </div>
      {error && <div className="text-neg text-xs bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>}

      {overview && overview.agents.length > 0 && (
        <Overview ov={overview} onSelect={setSelected} />
      )}

      {balances && <Balances bal={balances} />}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Left: agent list + create */}
        <div className="space-y-3">
          <button onClick={() => setShowCreate(v => !v)}
            className={`w-full text-xs py-2 rounded border transition-colors ${
              showCreate ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 hover:border-text-3"}`}>
            {showCreate ? "− 생성 폼 닫기" : "+ 새 에이전트"}
          </button>
          {showCreate && (
          <Panel>
            <PanelHeader>새 에이전트</PanelHeader>
            <div className="p-3 space-y-2">
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="이름 (예: 모멘텀 단타봇)"className="w-full bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm outline-none focus:border-accent"/>
            {/* 투자 스타일 */}
            <div className="space-y-1">
              <p className="text-text-3 text-[10px] uppercase tracking-wider">투자 스타일</p>
              <SegmentedToggle
                value={style}
                onChange={setStyle}
                options={(["daytrade", "swing", "longterm"] as Style[]).map(s => ({ value: s, label: STYLE_LABEL[s] }))}
              />
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([
                  { k: "autonomous", label: "자율학습 AI",   color: TOKEN.neg, dot: "🔴" },
                  { k: "kr_macro",   label: "KR 거시전략",   color: TOKEN.neg, dot: "🔴" },
                ] as { k: "autonomous" | "kr_macro"; label: string; color: string; dot: string }[]).map(({ k, label, color, dot }) => (
                  <button key={k} onClick={() => setStyle(k)}
                    className={`text-xs py-1.5 rounded border transition-colors ${style === k ? "" : "border-border text-text-3 hover:text-text-2"}`}
                    style={style === k ? { borderColor: color, color, background: `${color}1a` } : {}}>
                    {style === k && `${dot} `}{label}
                  </button>
                ))}
              </div>
            </div>
            {/* 시장 */}
            <div className="space-y-1">
              <p className="text-text-3 text-[10px] uppercase tracking-wider">시장</p>
              <div className="grid grid-cols-3 gap-2">
                {(["KR", "US", "CRYPTO"] as Mkt[]).map(m => {
                  const ok = allowedMkts.includes(m);
                  return (
                    <button key={m} disabled={!ok} onClick={() => setMkt(m)}
                      className={`text-xs py-1.5 rounded border ${
                        !ok ? "border-border/50 text-text-3/40 cursor-not-allowed": mkt === m ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2"}`}>
                      {MKT_LABEL[m]}
                    </button>
                  );
                })}
              </div>
              {style !== "daytrade" && (
                <p className="text-text-3 text-[10px] leading-snug">스윙·장투는 주식만 (크립토는 단타).</p>
              )}
            </div>
            {/* 배정 금액 (시장 통화 자동) */}
            <div className="space-y-1">
              <p className="text-text-3 text-[10px] uppercase tracking-wider">배정 금액 · {ccy}</p>
              <div className="relative">
                {ccySym(ccy) && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data pointer-events-none">{ccySym(ccy)}</span>
                )}
                <input
                  value={alloc} onChange={e => setAlloc(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal"placeholder={mkt === "KR" ? "1000000" : mkt === "CRYPTO" ? "1000" : "10000"}
                  className={`w-full bg-panel-2 border border-border rounded ${ccySym(ccy) ? "pl-8" : "pl-2.5"} pr-14 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 text-[10px] font-data pointer-events-none">{ccy}</span>
              </div>
            </div>
            {/* Paper / Live toggle */}
            <SegmentedToggle
              value={paper}
              onChange={setPaper}
              options={[
                { value: true, label: "PAPER 모의", activeClass: "border-pos text-pos bg-pos/10" },
                { value: false, label: "LIVE 실거래", activeClass: "border-neg text-neg bg-neg/10" },
              ]}
            />
            {!paper && (
              <p className="text-neg text-[10px] leading-snug">⚠ 실제 자금 집행. 되돌릴 수 없음.</p>
            )}
            {mkt === "CRYPTO" && paper && (
              <p className="text-text-3 text-[10px] leading-snug">
                ℹ 페이퍼는 크립토만 (테스트넷 TradFi 무거래). 주식·금·지수는 LIVE 필요.
              </p>
            )}
            {/* Autonomy level (Lv1 조건식은 백테스트 페이지의 "승격" 버튼 전용 — 여기선 생성 불가) */}
            {isLv3Style ? (
              <div className="text-[10px] leading-snug px-2 py-1.5 rounded border" style={{ borderColor: TOKEN.neg, color: TOKEN.neg, background: "rgba(255,50,50,0.07)" }}>
                🔴 Lv3 고정 — 뉴스·공시·ML 자가학습 풀 피처. 페이퍼로 시작(승급은 실적으로 별도 심사).
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-text-3 text-[10px] uppercase tracking-wider">자율성 레벨</p>
                {[
                  { v: 2, label: "Lv2 · AI 전략가", desc: "백테스트 검증 후 매매 (추천)" },
                  { v: 3, label: "Lv3 · 자가학습", desc: "실적 분석 후 전략 자동 재편성 (페이퍼로 시작)" },
                ].map(o => {
                  const c = lvCfg(o.v);
                  const sel = autonomy === o.v;
                  return (
                    <button key={o.v} onClick={() => setAutonomy(o.v)}
                      className="w-full text-left text-[11px] px-2 py-1.5 rounded border transition-colors"
                      style={sel ? { borderColor: c.border, color: c.color, background: c.bg } : undefined}>
                      <span className={sel ? "" : "text-text-3"}>
                        {o.label} <span className="opacity-60">— {o.desc}</span>
                      </span>
                    </button>
                  );
                })}
                {autonomy === 3 && (
                  <p className="text-[10px] leading-snug" style={{ color: TOKEN.neg }}>
                    🔴 Lv3: {style === "daytrade" ? "Claude AI 에이전틱 자가학습 — 10사이클마다 실적 분석 후 전략·유니버스 자동 재편성. 페이퍼로 시작." : "뉴스·공시·ML 자가학습 모두 활성화. 페이퍼 전용 샌드박스 권장."} 최근 실적이 3조건을 통과하면 God Mode 승급(live) 가능.
                  </p>
                )}
              </div>
            )}
            <Button variant={paper ? "primary" : "sell"} onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "생성 중…" : paper ? "에이전트 생성 (모의)" : "에이전트 생성 (실거래)"}
            </Button>
            </div>
          </Panel>
          )}

          <div className="space-y-2">
            {agents.length === 0 && <p className="text-text-3 text-xs px-1">에이전트 없음. 위의 &ldquo;+ 새 에이전트&rdquo;로 생성하세요.</p>}
            {agents.map(a => {
              const lv = displayLevel(a);
              const cfg = lvCfg(lv);
              const tone = lvToTone(lv);
              const isHighLv = lv >= 3; // Lv3(자가학습) shows orb
              const live = isLive(a);
              return (
              <div key={a.id}
                onClick={() => setSelected(a.id)}
                className={`bg-panel border rounded-lg p-3 cursor-pointer transition-colors ${selected === a.id ? "border-accent/50" : "border-border hover:border-text-3"}`}
                style={selected === a.id ? { borderColor: cfg.color + "80" } : undefined}>
                {isHighLv && (
                  <div className="flex items-center gap-3 mb-2">
                    <ArcReactor size={84} active={live} tone={tone} label={cfg.label} />
                    <div className="min-w-0 flex-1">
                      <div className="text-text-1 text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[10px] mt-0.5 font-semibold" style={{ color: cfg.color }}>
                        {cfg.label} · {agentStyleLabel(a)}
                      </div>
                      {a.type === "kr_macro" && (
                        <div className="text-[9px] text-text-3 mt-0.5">
                          상황 → 영향 → 포트폴리오
                        </div>
                      )}
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] shrink-0 ${live ? "text-pos" : "text-text-3"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                      {live ? "가동" : "정지"}
                    </span>
                  </div>
                )}
                {!isHighLv && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-1 text-sm font-medium truncate min-w-0">{a.name}</span>
                    <span className={`flex items-center gap-1 text-[10px] shrink-0 ${live ? "text-pos" : "text-text-3"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                      {live ? "가동" : "정지"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-panel-2 text-text-2 border border-border">
                    {agentStyleLabel(a)} · {agentMktLabel(a)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${a.paper ? "bg-pos/10 text-pos border-pos/30" : "bg-neg/15 text-neg border-neg/40"}`}>
                    {a.paper ? "PAPER" : "● LIVE"}
                  </span>
                  {a.validated === false && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-warn/40 text-warn bg-warn/10"
                      title={`${a.validation_reason ?? "registry 미등록"} — live 요청해도 페이퍼로 강제됨`}>
                      미검증
                    </span>
                  )}
                  <LvBadge lv={lv} />
                  {a.god_mode && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold inline-flex items-center gap-0.5 animate-pulse-glow-purple"
                      style={{ color: CATEGORICAL[0], background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.5)" }}
                      title="God Mode 승급됨 — 최근 실적 3조건 심사 통과 후 LIVE 집행 중">
                      <IconCrown size={9} className="purple-glow-lg" />GOD
                    </span>
                  )}
                  {a.protected && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10" title="잠금 — 삭제하려면 이름 확인 필요"> 잠금</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-text-3 text-[10px] font-data">배정 {moneyCcy(a.account_alloc, agentCcy(a))}</span>
                  <div className="flex gap-1.5">
                    <button onClick={e => { e.stopPropagation(); toggle(a); }}
                      className={`text-[10px] px-2 py-0.5 rounded border ${live ? "border-warn/40 text-warn bg-warn/10" : "border-pos/40 text-pos bg-pos/10"}`}>
                      {live ? "정지" : "시작"}
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(a); }}
                      className={`text-[10px] px-2 py-0.5 rounded border ${a.protected ? "border-border text-text-3/60 hover:text-neg" : "border-border text-text-3 hover:text-neg hover:border-neg/40"}`}>
                      {a.protected ? " 삭제" : "삭제"}
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
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
                  <Dashboard perf={perf} ccy={agentCcy(agents.find(a => a.id === selected)!)} />

                  {(() => {
                    const agent = agents.find(a => a.id === selected)!;
                    if (displayLevel(agent) !== 3) return null;
                    return <GodModePanel agent={agent} onPromoted={refresh} />;
                  })()}

                  {/* Strategy distillation — Lv3 자유탐색 → 검증된 규칙 전략 */}
                  <Panel>
                    <PanelHeader right={
                      <button onClick={handleDistill} disabled={distilling}
                        className="text-[11px] px-3 py-1.5 rounded font-medium disabled:opacity-40">
                        {distilling ? "증류 중… (~1분)" : "증류 실행"}
                      </button>
                    }>
                      전략 증류
                    </PanelHeader>
                    <div className="p-3 space-y-2">
                      <p className="text-text-3 text-[10px]">거래로그 → 규칙 전략으로 증류 → 백테스트 검증</p>
                      {distill && (
                        <div className="border-t border-border pt-2.5 space-y-1.5">
                          <div className={`text-xs px-1 inline-block font-bold ${distill.validated ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                            {distill.validated ? " " : "⚠ "}{distill.verdict}
                          </div>
                          <div className="text-[11px] font-data text-text-2 space-y-0.5">
                            <div>전략: {distill.proposal.strategy} · {distill.proposal.instrument_id}</div>
                            <div>파라미터: {JSON.stringify(distill.proposal.params)}</div>
                            <div className="flex gap-3">
                              <span className={`px-1 font-bold ${
                                distill.backtest.sharpe_ratio == null ? "text-text-2" :
                                distill.backtest.sharpe_ratio > 0 ? "bg-pos/20 text-pos" : distill.backtest.sharpe_ratio < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                                Sharpe {distill.backtest.sharpe_ratio?.toFixed(2) ?? "—"}
                              </span>
                              <span className={`px-1 font-bold ${
                                distill.backtest.total_pnl_pct == null ? "text-text-2" :
                                distill.backtest.total_pnl_pct > 0 ? "bg-pos/20 text-pos" : distill.backtest.total_pnl_pct < 0 ? "bg-neg/20 text-neg" : "text-text-2"}`}>
                                수익 {distill.backtest.total_pnl_pct?.toFixed(2) ?? "—"}%
                              </span>
                              <span className="text-text-3">승률 {distill.backtest.win_rate != null ? (distill.backtest.win_rate * 100).toFixed(0) + "%" : "—"}</span>
                            </div>
                          </div>
                          {distill.proposal.rationale && <p className="text-text-3 text-[10px] leading-snug"> {distill.proposal.rationale}</p>}
                          <p className="text-text-3 text-[9px]">거래 {distill.trades_analyzed}건 분석</p>
                        </div>
                      )}
                    </div>
                  </Panel>
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

      {/* 잠긴 에이전트 삭제 확인 (이름 타이핑) */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDel(null)}>
          <div className="bg-panel border border-border rounded-lg p-5 w-[360px] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-text-1 font-semibold"> 잠긴 에이전트 삭제</h3>
            <p className="text-text-2 text-sm leading-snug">
              <span className="text-neg font-medium">{confirmDel.name}</span> 은(는) 잠금 상태입니다. 실수 방지를 위해 이름을 정확히 입력해야 삭제됩니다.
            </p>
            <input value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={confirmDel.name} autoFocus
              className="w-full bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm outline-none focus:border-accent" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmDel(null)}>취소</Button>
              <Button variant="sell" onClick={() => remove(confirmDel, confirmName)} disabled={confirmName !== confirmDel.name}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
