"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
} from "@/lib/api";
import { ArcReactor, RadialGauge } from "@/components/Hud";
import { LivePulse } from "@/components/Jarvis";

/* HUD 커맨드 센터 — 집행 전환(Phase 132) 이후의 №1 상태 = 돈길.
   arm 판정(GO/WAIT/KILL) · OOS 카운트다운 · 엣지 생존을 아크리액터 중심으로,
   사냥 인프라(LAB·Auto-Research)는 보조 패널/로스터로 강등. */

interface Feed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null;
}

interface Unit { kind: "AI" | "BOT"; name: string; running: boolean; detail: string; metric: string; href: string; }

function Hex({ on }: { on?: boolean }) {
  return (
    <svg viewBox="0 0 20 22" className={`w-3 h-3 ${on ? "hud-glow" : ""}`} aria-hidden>
      <polygon points="10,1 19,6 19,16 10,21 1,16 1,6" fill="none"
        stroke="var(--color-hud)" strokeOpacity={on ? 0.9 : 0.3} strokeWidth="1.2" />
    </svg>
  );
}

function HudPanel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="hud-frame bg-panel/60 border border-hud/20 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-hud/80">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function UnitCard({ u }: { u: Unit }) {
  return (
    <Link href={u.href}
      className={`hud-frame block rounded-lg border p-2.5 no-underline transition-colors ${
        u.running ? "border-pos/40 bg-pos/5 hover:bg-pos/10" : "border-border bg-panel-2/40 hover:bg-panel-2"}`}>
      <div className="flex items-center gap-2">
        <LivePulse tone={u.running ? "pos" : "text-3"} />
        <span className="text-[11px] font-semibold text-text-1 truncate flex-1">{u.name}</span>
        <span className={`text-[8px] px-1 py-0.5 rounded border font-data ${
          u.kind === "AI" ? "border-accent/40 text-accent" : "border-hud/40 text-hud"}`}>{u.kind}</span>
      </div>
      <div className="mt-1 flex items-center justify-between font-data text-[10px]">
        <span className="text-text-3 truncate">{u.detail}</span>
        <span className={u.running ? "text-pos" : "text-text-3"}>{u.metric}</span>
      </div>
    </Link>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" | "hud" | "accent" }) {
  const c = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "hud" ? "text-hud"
    : tone === "accent" ? "text-accent" : "text-text-1";
  return (
    <div className="flex items-center justify-between font-data text-[11px] py-0.5">
      <span className="text-text-3">{k}</span>
      <span className={c}>{v}</span>
    </div>
  );
}

export default function HudPage() {
  const [f, setF] = useState<Feed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null });
  const [clock, setClock] = useState("--:--:--");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const c = new AbortController();
      abortRef.current = c;
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge] = await Promise.all([
        getLabState(c.signal).catch(() => null),
        getJarvisStatus(c.signal).catch(() => null),
        getAutoResearch(c.signal).catch(() => null),
        getBuybackBot(c.signal).catch(() => null),
        listAgents(c.signal).catch(() => null),
        getLabStatus(c.signal).catch(() => null),
        getExecutionConsole(c.signal).catch(() => null),
        getExecutionEdge(c.signal).catch(() => null),  // read_only 캐시 — 서버 계산 없음
      ]);
      if (mounted && !c.signal.aborted) setF({ lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge });
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(t);
  }, []);

  const { lab, jarvis, ar, bot, agents, sys, exec, edge } = f;
  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);

  // 돈길 상태 — 시스템의 №1 신호
  const arm = exec?.arm_decision ?? null;
  const armTone = arm?.decision === "GO" ? "pos" : arm?.decision === "KILL" ? "neg" : "info";
  const paperMo = exec?.arm_gate?.paper_months ?? 0;
  const paperMin = exec?.arm_gate?.min_paper_months ?? 6;
  const edgeWarming = !edge || edge.status === "warming";
  const edgeLabel = edge?.status === "confirmed" ? "생존 확인" : edge?.status === "drifting" ? "이탈 경고"
    : edge?.status === "accumulating" ? "누적 중" : edge?.status === "no_oos_yet" ? "OOS 대기" : "워밍 중";
  const edgeTone = edge?.status === "confirmed" ? "pos" : edge?.status === "drifting" ? "neg"
    : edge?.status === "accumulating" ? "accent" : "hud";

  // 전 유닛 로스터 — 트레이딩 AI + 시스템 봇
  const units: Unit[] = [];
  (agents ?? []).forEach(a => units.push({
    kind: "AI", name: a.name, running: a.status === "running",
    detail: `${a.market} · ${a.paper ? "페이퍼" : "라이브"} · Lv${a.autonomy}`,
    metric: `배분 ${Math.round(a.account_alloc).toLocaleString()}`, href: "/overview",
  }));
  units.push({ kind: "BOT", name: "AI LAB 엔진", running: active, detail: `stage ${lab?.stage ?? "—"}`, metric: `${lab?.stats?.processed ?? 0} 처리`, href: "/lab" });
  units.push({ kind: "BOT", name: "Auto-Research", running: busy, detail: `검증 ${ar?.n_tested ?? 0}`, metric: `후보 ${ar?.n_candidates ?? 0}`, href: "/auto-research" });
  units.push({ kind: "BOT", name: "Buyback 봇", running: (bot?.open ?? 0) > 0, detail: bot?.version ?? "—", metric: `보유 ${bot?.open ?? 0}`, href: "/lab/tasks" });
  if (sys?.dart_bot) units.push({ kind: "BOT", name: "DART 자동매매", running: !!sys.dart_bot.running, detail: sys.dart_bot.enabled ? "enabled" : "off", metric: `체결 ${sys.dart_bot.acted ?? 0}`, href: "/dart-auto" });
  if (sys?.research_service) units.push({ kind: "BOT", name: "리서치 서비스", running: !!sys.research_service.running, detail: `${sys.research_service.ticks ?? 0} tick`, metric: `처리 ${sys.research_service.processed_total ?? 0}`, href: "/lab" });

  // 페이퍼 봇 목록 (AI LAB tasks 기반) — 항상 paper_active = 가동 중
  const paperBots = [
    { id: "buyback", name: "Buyback 봇", running: true, metric: `보유 ${bot?.open ?? 0}` },
    { id: "tsmom", name: "TSMOM 32mkt", running: true, metric: "월 리밸런스" },
  ];
  const botRunning = paperBots.some(b => b.running);
  const nRunning = units.filter(u => u.running).length;
  const wd = sys?.research_service?.watchdog;
  const wdMsgs = (wd?.events ?? []).map(e => `[감시견${e.severity === "critical" ? " ⚠" : ""}] ${e.msg}`);
  const marquee = [...wdMsgs, ...(lab?.log ?? []).slice(0, 10).map(l => `[${l.stage}] ${l.msg}`)].join("   ·   ")
    || "집행 전환 · 페이퍼 OOS 누적 중 · arm/kill은 사전등록 기준(arm_criteria_v1) · live 집행은 사람만";

  return (
    <div className="hud-bg tech-grid min-h-screen p-4 sm:p-6">
      {/* 상단 커맨드 스트립 */}
      <div className="hud-frame flex items-center justify-between gap-3 border border-hud/25 rounded-lg px-4 py-2 mb-4 scanline-host">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">{[0, 1, 2, 3].map(i => <Hex key={i} on={active && i < 3} />)}</div>
          <span className="font-data text-sm uppercase tracking-[0.3em] text-text-1">Command Center</span>
          <LivePulse tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "PROCESSING" : active ? "ONLINE" : "STANDBY"} />
          {arm && (
            <Link href="/lab/execution"
              className={`no-underline text-[11px] px-2 py-0.5 rounded border font-data tracking-wider ${
                arm.decision === "GO" ? "border-pos/50 text-pos bg-pos/10" :
                arm.decision === "KILL" ? "border-neg/50 text-neg bg-neg/10 animate-blink" :
                "border-info/40 text-info bg-info/10"}`}>
              ARM {arm.decision}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-data text-lg text-hud tabular-nums tracking-widest hud-glow">{clock}</span>
          <Link href="/lab" className="font-data text-[10px] text-text-3 hover:text-hud no-underline uppercase tracking-wider">exit →</Link>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* 좌측 패널 */}
        <div className="space-y-4 order-2 lg:order-1">
          <HudPanel title="AI LAB" right={<LivePulse tone={busy ? "accent" : "pos"} />}>
            <Row k="스테이지" v={lab?.stage ?? "—"} tone="hud" />
            <Row k="처리" v={String(lab?.stats?.processed ?? 0)} />
            <Row k="엣지" v={String(lab?.stats?.edges ?? 0)} tone="pos" />
            <Row k="기각" v={String(lab?.stats?.rejects ?? 0)} tone="neg" />
            <Row k="큐 대기" v={String(lab?.queue?.length ?? 0)} />
          </HudPanel>
          <HudPanel title="돈길 — 엣지 생존"
            right={<LivePulse tone={edgeTone === "hud" ? "text-3" : edgeTone} label={edgeLabel} />}>
            <Row k="OOS 월(동결후)" v={edgeWarming ? "…" : `${edge!.oos_months} / ${edge!.need_months}`}
              tone={edge && edge.oos_months >= edge.need_months ? "pos" : "hud"} />
            <Row k="envelope 내" v={edgeWarming ? "…" : `${edge!.oos_in_envelope}/${edge!.oos_months}`}
              tone={edge && edge.oos_months > 0 ? (edge.oos_in_envelope * 2 >= edge.oos_months ? "pos" : "neg") : undefined} />
            <Row k="이벤트 레벨 OOS" v={edgeWarming || !edge?.event_level ? "…" : `${edge.event_level.n_oos}/${edge.event_level.min_events}건`}
              tone={edge?.event_level?.p_worse != null && edge.event_level.p_worse < 0.05 ? "neg" : undefined} />
            <Row k="기대 중앙값" v={exec ? `${exec.edge.net_median >= 0 ? "+" : ""}${(exec.edge.net_median * 100).toFixed(2)}%` : "—"}
              tone={exec && exec.edge.net_median >= 0 ? "pos" : "neg"} />
            <Row k="TSMOM 최신월" v={sys?.research_service?.tsmom_last_month
                ? `${sys.research_service.tsmom_last_month} ${sys.research_service.tsmom_in_envelope ? "envelope 내" : "이탈"}` : "—"}
              tone={sys?.research_service?.tsmom_in_envelope === false ? "neg" : sys?.research_service?.tsmom_in_envelope ? "pos" : undefined} />
            <div className="mt-1.5 flex items-center justify-between">
              <Link href="/lab/execution" className="font-data text-[10px] text-accent no-underline uppercase tracking-wider hover:underline">
                집행 콘솔 →
              </Link>
              {wd?.critical && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-neg/50 text-neg bg-neg/10 animate-blink font-data">감시견 경보</span>
              )}
            </div>
          </HudPanel>
        </div>

        {/* 중앙 아크리액터 */}
        <div className="flex flex-col items-center gap-4 order-1 lg:order-2 py-2">
          {/* AI 오브 */}
          <ArcReactor size={160} active={active} label={arm ? arm.decision : busy ? "SCAN" : "IDLE"} sub="money path" />
          {/* 봇 오브 — AI와 분리. 페이퍼 봇 가동 여부 */}
          <div className="flex flex-col items-center gap-1">
            <ArcReactor size={84} active={botRunning} label={botRunning ? "BOT" : "IDLE"} sub="paper" />
            <div className="flex gap-2 mt-0.5">
              {paperBots.map(b => (
                <div key={b.id} className="flex items-center gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${b.running ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                  <span className="font-data text-[9px] text-text-3 uppercase tracking-wider">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 sm:gap-4">
            <RadialGauge size={72} pct={edge ? Math.min(100, (edge.oos_months / Math.max(1, edge.need_months)) * 100) : 0}
              value={edge ? `${edge.oos_months}/${edge.need_months}` : "—"} label="OOS 월" tone={edge && edge.oos_months >= edge.need_months ? "pos" : "hud"} />
            <RadialGauge size={72} pct={Math.min(100, (paperMo / paperMin) * 100)}
              value={`${paperMo}mo`} label={`페이퍼/${paperMin}`} tone="accent" />
            <RadialGauge size={72} pct={((jarvis?.autonomy_level ?? 0) / 6) * 100} value={`Lv${jarvis?.autonomy_level ?? 0}`} label="자율" />
          </div>
          <div className="font-data text-[10px] text-text-3 uppercase tracking-[0.25em]">
            live: {jarvis?.live_execution ?? "blocked"} · $0 paper
          </div>
        </div>

        {/* 우측 패널 */}
        <div className="space-y-4 order-3">
          <HudPanel title="Jarvis 거버넌스">
            <Row k="자율 레벨" v={`Lv${jarvis?.autonomy_level ?? 0} ${jarvis?.autonomy_name ?? ""}`} tone="accent" />
            <Row k="전략 레지스트리" v={String(jarvis?.registry_total ?? 0)} />
            <Row k="리스크 거버너" v={jarvis?.risk_governor ?? "—"} tone="hud" />
            <Row k="live 집행" v={jarvis?.live_execution ?? "—"} tone="neg" />
          </HudPanel>
          <HudPanel title="페이퍼 봇" right={<LivePulse tone={botRunning ? "pos" : "text-3"} label={botRunning ? "가동" : "대기"} />}>
            <div className="space-y-1 mb-2">
              {paperBots.map(b => (
                <div key={b.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.running ? "bg-pos animate-pulse" : "bg-text-3"}`} />
                    <span className="font-data text-[10px] text-text-2">{b.name}</span>
                  </div>
                  <span className="font-data text-[10px] text-text-3">{b.metric}</span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-border/50">
              <Row k="Buyback 보유" v={String(bot?.open ?? 0)} tone={(bot?.open ?? 0) > 0 ? "pos" : undefined} />
              <Row k="누적 P&L" v={bot?.cum_paper_pnl != null ? `${bot.cum_paper_pnl >= 0 ? "+" : ""}${bot.cum_paper_pnl.toFixed(2)}%` : "—"}
                tone={(bot?.cum_paper_pnl ?? 0) >= 0 ? "pos" : "neg"} />
            </div>
            <Link href="/lab/tasks" className="font-data text-[10px] text-accent no-underline uppercase tracking-wider hover:underline block mt-1.5">
              봇 상세 →
            </Link>
          </HudPanel>
        </div>
      </div>

      {/* 유닛 로스터 — 돌아가는 모든 AI + 봇 */}
      <div className="hud-frame mt-4 border border-hud/20 rounded-lg p-3 bg-panel/40 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-hud/80">유닛 로스터 — AI · 봇</span>
          <LivePulse tone={nRunning > 0 ? "pos" : "text-3"} label={`${nRunning}/${units.length} 가동`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {units.map((u, i) => <UnitCard key={`${u.name}-${i}`} u={u} />)}
        </div>
      </div>

      {/* 하단 로그 티커 마퀴 */}
      <div className="hud-frame mt-4 border border-hud/20 rounded-lg overflow-hidden scanline-host">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="font-data text-[10px] text-hud uppercase tracking-widest shrink-0">► feed</span>
          <div className="relative flex-1 overflow-hidden">
            <div className="flex whitespace-nowrap animate-[ticker_28s_linear_infinite] font-data text-[11px] text-text-2">
              <span className="pr-8">{marquee}</span>
              <span className="pr-8" aria-hidden>{marquee}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
