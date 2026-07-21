"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge, getAccountBalances, getTriggeredAlerts, getVrpBotStatus,
  restartCollector, getLabHealth,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
  type AccountBalances, type TriggeredAlert, type VrpBotStatus, type CollectorKey,
  type LabHealth,
} from "@/lib/api";
import { Balances } from "@/components/AccountBalances";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { displayLevel } from "@/lib/agent-level";
import { toast } from "@/lib/toast";

/* HUD 홈 — 미니멀 재설계.
   질문 하나에 답하는 페이지: "지금 뭐가 돌고 있고, 문제 없나?"
   1) 상단 스트립: 시스템 상태 + ARM 판정 + 시계
   2) 유닛 로스터(메인): N/M 가동 + 유닛별 가동/정지 카드
   3) 계좌 잔액 + 돈길 핵심 3줄
   상세 수치는 각 전용 페이지(/lab, /auto-research, /lab/execution)로 위임. */

type Tone = "pos" | "accent" | "info" | "neg" | "text-3";
const TONE: Record<Tone, { solid: string; text: string }> = {
  pos:      { solid: "bg-pos",    text: "text-pos" },
  accent:   { solid: "bg-accent", text: "text-accent" },
  info:     { solid: "bg-info",   text: "text-info" },
  neg:      { solid: "bg-neg",    text: "text-neg" },
  "text-3": { solid: "bg-text-3", text: "text-text-3" },
};

function StatusDot({ tone, label }: { tone: Tone; label?: string }) {
  const c = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${c.solid}`} />
      {label && <span className={`text-[11px] font-data ${c.text}`}>{label}</span>}
    </span>
  );
}

const WORLD_CITIES: { label: string; tz: string }[] = [
  { label: "SEOUL", tz: "Asia/Seoul" },
  { label: "NEW YORK", tz: "America/New_York" },
  { label: "LONDON", tz: "Europe/London" },
  { label: "TOKYO", tz: "Asia/Tokyo" },
];

function WorldClock({ now }: { now: Date }) {
  return (
    <div className="grid grid-cols-4 divide-x divide-border">
      {WORLD_CITIES.map(c => (
        <div key={c.tz} className="px-2 py-1 text-center">
          <p className="text-text-3 text-[8px] uppercase tracking-widest">{c.label}</p>
          <p className="text-text-1 text-xs font-data tabular-nums">
            {now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour12: false })}
          </p>
        </div>
      ))}
    </div>
  );
}

interface Feed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null; alerts: TriggeredAlert[] | null;
  vrp: VrpBotStatus | null; health: LabHealth | null;
}

interface Unit {
  kind: "AI" | "BOT"; name: string; running: boolean; detail: string; href: string;
  collectorKey?: CollectorKey;
}

function formatAge(ageSec: number | null): string {
  if (ageSec == null) return "데이터 없음";
  if (ageSec < 60) return `${ageSec}s 전`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}분 전`;
  return `${Math.floor(ageSec / 3600)}시간 전`;
}

function UnitCard({ u, onRestart, restarting }: {
  u: Unit; onRestart?: (key: CollectorKey) => void; restarting?: boolean;
}) {
  const deadCollector = !!u.collectorKey && !u.running;
  return (
    <div className={`flex items-center gap-2 border-b border-border px-2 py-1 transition-colors ${
      u.running ? "bg-pos/5" : deadCollector ? "bg-neg/10" : ""}`}>
      <Link href={u.href} className="flex items-center gap-2 flex-1 min-w-0 no-underline hover:opacity-80">
        <StatusDot tone={u.running ? "pos" : deadCollector ? "neg" : "text-3"} />
        <span className="text-[11px] font-data text-text-1 truncate flex-1">{u.name}</span>
        <span className="text-[10px] font-data text-text-3 truncate">{u.detail}</span>
      </Link>
      <span className={`text-[8px] px-1 border font-data shrink-0 ${
        u.kind === "AI" ? "border-accent/40 text-accent" : "border-border text-text-3"}`}>{u.kind}</span>
      <span className={`text-[9px] font-data font-bold w-9 text-center shrink-0 ${
        u.running ? "bg-pos/20 text-pos" : deadCollector ? "bg-neg/15 text-neg animate-blink" : "bg-neg/10 text-text-3"}`}>
        {u.running ? "ON" : "OFF"}
      </span>
      {deadCollector && (
        <button
          onClick={() => onRestart?.(u.collectorKey!)}
          disabled={restarting}
          className="text-[9px] px-1.5 py-0.5 border border-neg/50 text-neg bg-neg/15 font-data font-bold shrink-0 hover:bg-neg/25 disabled:opacity-40"
        >
          {restarting ? "재시작중" : "재시작"}
        </button>
      )}
    </div>
  );
}

export default function HudPage() {
  const [f, setF] = useState<Feed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null, alerts: null, vrp: null, health: null });
  const [bal, setBal] = useState<AccountBalances | null>(null);
  const [now, setNow] = useState(new Date());
  const [restarting, setRestarting] = useState<Partial<Record<CollectorKey, boolean>>>({});
  const abortRef = useRef<AbortController | null>(null);

  async function handleRestart(key: CollectorKey) {
    setRestarting((r) => ({ ...r, [key]: true }));
    try {
      await restartCollector(key);
      toast.show(`${key} 재시작 완료`, "success");
      const sys = await getLabStatus().catch(() => null);
      if (sys) setF((prev) => ({ ...prev, sys }));
    } catch (e) {
      toast.show(`${key} 재시작 실패: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRestarting((r) => ({ ...r, [key]: false }));
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const c = new AbortController();
      abortRef.current = c;
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge, alerts, vrp, health] = await Promise.all([
        getLabState(c.signal).catch(() => null),
        getJarvisStatus(c.signal).catch(() => null),
        getAutoResearch(c.signal).catch(() => null),
        getBuybackBot(c.signal).catch(() => null),
        listAgents(c.signal).catch(() => null),
        getLabStatus(c.signal).catch(() => null),
        getExecutionConsole(c.signal).catch(() => null),
        getExecutionEdge(c.signal).catch(() => null),  // read_only 캐시 — 서버 계산 없음
        getTriggeredAlerts(c.signal).catch(() => null),
        getVrpBotStatus(c.signal).catch(() => null),
        getLabHealth(c.signal).catch(() => null),  // 봇·에이전트 정합성 불변식
      ]);
      if (mounted && !c.signal.aborted) setF({ lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge, alerts, vrp, health });
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  // 계좌 잔액은 KIS/IB 등 외부 브로커 API를 직접 호출해 5~30초씩 걸릴 수 있음 —
  // 4초 주기 메인 피드 루프에 섞으면 abort-then-check 경합으로 상태 갱신 자체가 막힘.
  // 별도의 느린 주기로 독립 폴링.
  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    async function loadBal() {
      if (inFlight) return;
      inFlight = true;
      try {
        const b = await getAccountBalances();
        if (mounted) setBal(b);
      } catch { /* 이전 값 유지 */ }
      finally { inFlight = false; }
    }
    loadBal();
    const iv = setInterval(loadBal, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, vrp, health } = f;
  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);

  // 돈길 상태 — 시스템의 №1 신호
  const arm = exec?.arm_decision ?? null;
  const paperMo = exec?.arm_gate?.paper_months ?? 0;
  const paperMin = exec?.arm_gate?.min_paper_months ?? 6;
  const edgeLabel = edge?.status === "confirmed" ? "생존 확인" : edge?.status === "drifting" ? "이탈 경고"
    : edge?.status === "accumulating" ? "누적 중" : edge?.status === "no_oos_yet" ? "OOS 대기" : "워밍 중";
  const edgeTone = edge?.status === "confirmed" ? "text-pos" : edge?.status === "drifting" ? "text-neg"
    : edge?.status === "accumulating" ? "text-accent" : "text-info";

  // 전 유닛 로스터 — 트레이딩 AI + 시스템 봇
  const units: Unit[] = [];
  (agents ?? []).forEach(a => units.push({
    kind: "AI", name: a.name, running: a.status === "running",
    detail: `${a.market} · ${a.paper ? "페이퍼" : "라이브"} · Lv${displayLevel(a)}`,
    href: "/overview",
  }));
  units.push({ kind: "BOT", name: "AI LAB 엔진", running: active, detail: `stage ${lab?.stage ?? "—"}`, href: "/lab" });
  units.push({ kind: "BOT", name: "Auto-Research", running: busy, detail: `검증 ${ar?.n_tested ?? 0} · 후보 ${ar?.n_candidates ?? 0}`, href: "/auto-research" });
  units.push({ kind: "BOT", name: "Buyback 봇", running: (bot?.open ?? 0) > 0, detail: `보유 ${bot?.open ?? 0}`, href: "/lab/tasks" });
  if (sys?.dart_bot) units.push({ kind: "BOT", name: "DART 자동매매", running: !!sys.dart_bot.running, detail: sys.dart_bot.enabled ? "enabled" : "off", href: "/dart-auto" });
  if (sys?.research_service) units.push({ kind: "BOT", name: "리서치 서비스", running: !!sys.research_service.running, detail: `${sys.research_service.ticks ?? 0} tick`, href: "/lab" });
  if (sys?.processes?.polymarket_tick) units.push({
    kind: "BOT", name: "폴리마켓 틱 수집기", running: sys.processes.polymarket_tick.running,
    detail: formatAge(sys.processes.polymarket_tick.age_sec), href: "/lab", collectorKey: "polymarket_tick",
  });
  if (sys?.processes?.polymarket_arb) units.push({
    kind: "BOT", name: "폴리마켓 arb 스캐너", running: sys.processes.polymarket_arb.running,
    detail: formatAge(sys.processes.polymarket_arb.age_sec), href: "/lab", collectorKey: "polymarket_arb",
  });
  if (sys?.processes?.hl_orderflow_tick) units.push({
    kind: "BOT", name: "HL 오더플로우 틱 수집기", running: sys.processes.hl_orderflow_tick.running,
    detail: formatAge(sys.processes.hl_orderflow_tick.age_sec), href: "/orderflow", collectorKey: "hl_orderflow_tick",
  });
  if (sys?.processes?.cross_venue_skew_tick) units.push({
    kind: "BOT", name: "크로스벤뉴 스큐 수집기", running: sys.processes.cross_venue_skew_tick.running,
    detail: formatAge(sys.processes.cross_venue_skew_tick.age_sec), href: "/orderflow", collectorKey: "cross_venue_skew_tick",
  });
  if (sys?.processes?.polymarket_whale_tick) units.push({
    kind: "BOT", name: "폴리마켓 고래 체결 수집기", running: sys.processes.polymarket_whale_tick.running,
    detail: formatAge(sys.processes.polymarket_whale_tick.age_sec), href: "/orderflow", collectorKey: "polymarket_whale_tick",
  });
  if (sys?.processes?.polymarket_sharp_wallet_tick) units.push({
    kind: "BOT", name: "폴리마켓 샤프월렛 수집기", running: sys.processes.polymarket_sharp_wallet_tick.running,
    detail: formatAge(sys.processes.polymarket_sharp_wallet_tick.age_sec), href: "/orderflow", collectorKey: "polymarket_sharp_wallet_tick",
  });
  if (sys?.processes?.polymarket_updown_arb) units.push({
    kind: "BOT", name: "폴리마켓 초단기 up/down 차익 스캐너", running: sys.processes.polymarket_updown_arb.running,
    detail: formatAge(sys.processes.polymarket_updown_arb.age_sec), href: "/lab", collectorKey: "polymarket_updown_arb",
  });
  if (vrp) {
    const lastLog = vrp.log?.[0];
    // log는 실패/진입/청산 등 이벤트가 있을 때만 기록됨 — 조용히 성공한(포지션 미진입) tick은
    // 로그를 안 남기므로, log[0]가 last_run보다 훨씬 과거(다른 tick)면 이미 해소된 옛 에러임.
    const lastLogIsCurrent = !!(lastLog?.ts && vrp.last_run &&
      Math.abs(new Date(vrp.last_run).getTime() - new Date(lastLog.ts).getTime()) < 90_000);
    const vrpDetail = lastLog?.kind === "scan_fail" && lastLogIsCurrent ? `⚠ ${String(lastLog.msg ?? "실패")}`
      : vrp.last_run ? `마지막 스캔 ${vrp.last_run.slice(11, 19)}` : "스캔 대기";
    units.push({ kind: "BOT", name: "VRP 아이언콘도어", running: vrp.enabled, detail: vrpDetail, href: "/vrp" });
  }

  const nRunning = units.filter(u => u.running).length;
  const wd = sys?.research_service?.watchdog;

  return (
    <div className="min-h-screen p-1 sm:p-1.5 font-data">
      {/* 월드 클락 스트립 */}
      <Panel className="mb-1">
        <WorldClock now={now} />
      </Panel>

      {/* 상단 상태 스트립 */}
      <Panel className="mb-1">
        <PanelHeader>시스템 상태</PanelHeader>
        <div className="flex items-center gap-3 px-2 py-1">
          <StatusDot tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "PROCESSING" : active ? "ONLINE" : "STANDBY"} />
          {arm && (
            <Link href="/lab/execution"
              className={`no-underline text-[11px] px-2 py-0.5 border font-data font-bold tracking-wider ${
                arm.decision === "GO" ? "border-pos/50 text-pos bg-pos/15" :
                arm.decision === "KILL" ? "border-neg/50 text-neg bg-neg/15 animate-blink" :
                "border-info/40 text-info bg-info/15"}`}>
              ARM {arm.decision}
            </Link>
          )}
          {wd?.critical && (
            <span className="text-[9px] px-1.5 py-0.5 border border-neg/50 text-neg bg-neg/15 animate-blink font-data font-bold">감시견 경보</span>
          )}
          {(health?.n_errors ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 border border-neg/50 text-neg bg-neg/15 animate-blink font-data font-bold">정합성 오류 {health!.n_errors}</span>
          )}
        </div>
      </Panel>

      {/* 유닛 로스터 — 메인. 뭐가 돌고 있는지 한 눈에 */}
      <Panel className="mb-1">
        <PanelHeader right={<span className="tabular-nums">{nRunning}/{units.length} 가동</span>}>
          유닛 로스터
        </PanelHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {units.map((u, i) => (
            <UnitCard
              key={`${u.name}-${i}`}
              u={u}
              onRestart={handleRestart}
              restarting={u.collectorKey ? !!restarting[u.collectorKey] : false}
            />
          ))}
        </div>
      </Panel>

      {/* 정합성 감시 — 봇·에이전트 회계 불변식(조용한 돈 버그 감지). /lab/health */}
      <Panel className="mb-1">
        <PanelHeader right={
          <span className={`tabular-nums ${(health?.n_errors ?? 0) > 0 ? "text-neg" : health ? "text-pos" : "text-text-3"}`}>
            {health ? (health.ok ? "이상 없음" : `${health.n_errors} 오류 · ${health.n_violations} 위반`) : "…"}
          </span>
        }>
          정합성 감시
        </PanelHeader>
        {health && health.violations.length === 0 && (
          <div className="px-2 py-1.5">
            <StatusDot tone="pos" label="봇·에이전트 회계 정합성 정상" />
          </div>
        )}
        {health && health.violations.length > 0 && (
          <div className="max-h-56 overflow-y-auto">
            {health.violations.map((v, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-2 py-0.5 text-[10px]">
                <StatusDot tone={v.severity === "error" ? "neg" : "accent"} />
                <span className="text-text-3 shrink-0 w-32 truncate">{v.entity}</span>
                <span className={`shrink-0 w-40 truncate font-bold font-data ${v.severity === "error" ? "text-neg" : "text-warn"}`}>{v.code}</span>
                <span className="text-text-2 truncate flex-1">{v.detail}</span>
              </div>
            ))}
          </div>
        )}
        {!health && (
          <div className="px-2 py-1.5 text-text-3 text-[11px]">정합성 상태 로딩 중…</div>
        )}
      </Panel>

      {/* 계좌 + 돈길 핵심 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 items-start">
        {bal ? <Balances bal={bal} /> : (
          <div className="bg-panel border border-border p-2 text-text-3 text-[11px]">계좌 정보 로딩 중…</div>
        )}
        <Panel>
          <PanelHeader right={<Link href="/lab/execution" className="no-underline uppercase tracking-wider hover:underline">집행 콘솔 →</Link>}>
            돈길
          </PanelHeader>
          <div className="grid grid-cols-3 text-center divide-x divide-border">
            <div className="p-1.5">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-0.5">엣지</p>
              <p className={`font-data text-xs font-bold ${edgeTone}`}>{edgeLabel}</p>
            </div>
            <div className="p-1.5">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-0.5">페이퍼 기간</p>
              <p className={`font-data text-xs font-bold ${paperMo >= paperMin ? "text-pos" : "text-info"}`}>{paperMo}/{paperMin}mo</p>
            </div>
            <div className="p-1.5">
              <p className="text-text-3 text-[9px] uppercase tracking-wider mb-0.5">Live 집행</p>
              <p className={`font-data text-xs font-bold ${jarvis?.live_execution === "blocked" ? "text-neg" : "text-pos"}`}>
                {jarvis?.live_execution ?? "—"}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* 로그 + 최근 체결 + 알림 — 빈 공간 없이 실시간 활동 채움 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 items-start mt-1">
        <Panel>
          <PanelHeader right={<span className="tabular-nums">{alerts?.length ?? 0}건</span>}>
            최근 알림
          </PanelHeader>
          <div className="max-h-64 overflow-y-auto">
            {(alerts ?? []).slice(0, 14).map((a, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-2 py-0.5 text-[10px]">
                <span className="text-text-3 shrink-0 w-16 truncate">{a.triggered_at?.slice(11, 19) ?? "--:--:--"}</span>
                <span className="text-warn truncate flex-1">{a.rule_label}</span>
                <span className="text-text-2 shrink-0 truncate max-w-[40%]">{a.detail}</span>
              </div>
            ))}
            {(alerts?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-text-3 text-[11px]">알림 없음</div>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader right={<span className="tabular-nums">{lab?.log?.length ?? 0}줄</span>}>
            AI LAB 로그
          </PanelHeader>
          <div className="max-h-64 overflow-y-auto">
            {(lab?.log ?? []).slice(-14).reverse().map((l, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-2 py-0.5 text-[10px]">
                <span className="text-text-3 shrink-0 w-16 truncate">{l.ts?.slice(11, 19) ?? "--:--:--"}</span>
                <span className={`shrink-0 w-12 truncate ${
                  l.level === "error" ? "text-neg" : l.level === "warn" ? "text-warn" : "text-text-3"}`}>{l.stage}</span>
                <span className="text-text-2 truncate flex-1">{l.msg}</span>
              </div>
            ))}
            {(lab?.log?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-text-3 text-[11px]">로그 없음</div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader right={<span className="tabular-nums">{exec?.paper?.recent_closed?.length ?? 0}건</span>}>
            최근 페이퍼 체결
          </PanelHeader>
          <div className="max-h-64 overflow-y-auto">
            {(exec?.paper?.recent_closed ?? []).slice(0, 14).map((t, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-2 py-0.5 text-[10px]">
                <span className="text-text-1 truncate flex-1">{t.corp}</span>
                <span className="text-text-3 shrink-0 w-20 truncate">{t.entry_date}</span>
                <span className="text-text-3 shrink-0 w-20 truncate">{t.exit_date ?? "보유중"}</span>
                <span className={`shrink-0 w-14 text-right px-1 font-bold ${
                  (t.pnl_pct ?? 0) > 0 ? "bg-pos/20 text-pos" : (t.pnl_pct ?? 0) < 0 ? "bg-neg/20 text-neg" : "text-text-3"}`}>
                  {t.pnl_pct != null ? `${t.pnl_pct.toFixed(2)}%` : "—"}
                </span>
              </div>
            ))}
            {(exec?.paper?.recent_closed?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-text-3 text-[11px]">체결 없음</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
