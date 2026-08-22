"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge, getAccountBalances, getTriggeredAlerts, getVrpBotStatus,
  restartCollector, getLabHealth, getFleet,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
  type AccountBalances, type TriggeredAlert, type VrpBotStatus, type CollectorKey,
  type LabHealth, type FleetResponse,
} from "@/lib/api";
import {
  getConsolePipeline, getRisk, getInvestmentOs,
  type ConsolePipeline, type RiskResp, type InvestmentOsResp,
} from "@/lib/console-api";
import { deriveAttentionItems } from "@/lib/attention";
import { Balances } from "@/components/AccountBalances";
import { Card, CardHeader } from "@/components/ui/Card";
import { FreshnessBar } from "@/components/ui/FreshnessBar";
import { collectorMeta, VERDICT_LABEL, VERDICT_TONE, type Verdict } from "@/lib/collectors";
import { displayLevel } from "@/lib/agent-level";
import { toast } from "@/lib/toast";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortfolioTab from "@/components/hud/PortfolioTab";
import LabTab from "@/components/hud/LabTab";
import ExecutionTab from "@/components/hud/ExecutionTab";
import TasksTab from "@/components/hud/TasksTab";

type TabKey = "home" | "portfolio" | "lab" | "execution" | "tasks";
const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "HOME" },
  { key: "portfolio", label: "AI 자본" },
  { key: "lab", label: "AI LAB" },
  { key: "execution", label: "집행 콘솔" },
  { key: "tasks", label: "페이퍼 모니터" },
];

function HudInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "home";
  const setTab = (k: TabKey) => router.push(k === "home" ? "/hud" : `/hud?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-ap-line px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-ap-brand text-ap-brand bg-ap-brand/10"
                : "border-transparent text-ap-ink-2 hover:text-ap-ink-1"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "home" && <HomeTab />}
      {tab === "portfolio" && <PortfolioTab />}
      {tab === "lab" && <LabTab />}
      {tab === "execution" && <ExecutionTab />}
      {tab === "tasks" && <TasksTab />}
    </div>
  );
}

export default function HudShell() {
  return (
    <Suspense fallback={null}>
      <HudInner />
    </Suspense>
  );
}

/* HUD 홈 — 미니멀 재설계.
   질문 하나에 답하는 페이지: "지금 뭐가 돌고 있고, 문제 없나?"
   1) 상단 스트립: 시스템 상태 + ARM 판정 + 시계
   2) 유닛 로스터(메인): N/M 가동 + 유닛별 가동/정지 카드
   3) 계좌 잔액 + 돈길 핵심 3줄
   상세 수치는 각 전용 페이지(/lab, /auto-research, /lab/execution)로 위임. */

type Tone = "pos" | "accent" | "info" | "neg" | "warn" | "text-3";
const TONE: Record<Tone, { solid: string; text: string }> = {
  pos:      { solid: "bg-ap-up",    text: "text-ap-up" },
  accent:   { solid: "bg-ap-brand", text: "text-ap-brand" },
  info:     { solid: "bg-ap-note",   text: "text-ap-note" },
  neg:      { solid: "bg-ap-down",    text: "text-ap-down" },
  warn:     { solid: "bg-ap-caution",   text: "text-ap-caution" },
  "text-3": { solid: "bg-ap-ink-3", text: "text-ap-ink-3" },
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
  { label: "서울", tz: "Asia/Seoul" },
  { label: "뉴욕", tz: "America/New_York" },
  { label: "런던", tz: "Europe/London" },
  { label: "도쿄", tz: "Asia/Tokyo" },
];

/** 참고 정보라 한 줄로 눌러둠 — 상단 픽셀은 조치가 필요한 상태 표시에 양보. */
function WorldClock({ now }: { now: Date }) {
  return (
    <div className="flex items-center justify-end gap-4 px-2 py-0.5">
      {WORLD_CITIES.map(c => (
        <span key={c.tz} className="inline-flex items-baseline gap-1">
          <span className="text-ap-ink-3 text-[8px] uppercase tracking-widest">{c.label}</span>
          {/* SSR 시각과 클라이언트 시각은 1초 차이로 어긋남 — 시계는 하이드레이션 비교 대상 아님 */}
          <span className="text-ap-ink-2 text-[10px] font-data tabular-nums" suppressHydrationWarning>
            {now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour12: false })}
          </span>
        </span>
      ))}
    </div>
  );
}

/** 돈길 = 순서 있는 관문. 텍스트 3칸으로는 "어디까지 왔나"가 안 보여서 스테퍼로. */
function LadderStep({ label, value, state }: {
  label: string; value: string; state: "done" | "current" | "blocked" | "pending";
}) {
  const tone = state === "done" ? "text-ap-up" : state === "blocked" ? "text-ap-down"
    : state === "current" ? "text-ap-brand" : "text-ap-ink-3";
  const bar = state === "done" ? "bg-ap-up" : state === "blocked" ? "bg-ap-down"
    : state === "current" ? "bg-ap-brand" : "bg-ap-line";
  return (
    <div className="flex-1 min-w-0 px-1.5 pb-1.5">
      <div className={`h-0.5 mb-1 ${bar}`} />
      <p className="text-ap-ink-3 text-[9px] uppercase tracking-wider truncate">{label}</p>
      <p className={`font-data text-xs font-bold truncate ${tone}`}>{value}</p>
    </div>
  );
}

interface Feed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null; alerts: TriggeredAlert[] | null;
  vrp: VrpBotStatus | null; health: LabHealth | null; fleet: FleetResponse | null;
  pipeline: ConsolePipeline | null; risk: RiskResp | null; ios: InvestmentOsResp | null;
}

interface Unit {
  kind: "AI" | "BOT" | "수집기"; name: string; running: boolean; detail: string; href: string;
  collectorKey?: CollectorKey;
  /** 수집기 전용 — 신선도 정도. running 이진만으로는 "45초 전"과 "55분 전"이 구분 안 됨. */
  fleet?: { verdict: Verdict; ageSec: number | null; staleAfterS: number; reason: string };
}

/** 정합성 위반 엔티티 → 조사할 페이지. 모르는 엔티티는 랩 개요로. */
function violationHref(entity: string): string {
  if (entity.startsWith("agent:")) return "/agents";
  if (entity.includes("polymarket")) return "/polymarket";
  if (entity.includes("copytrade")) return "/copytrade";
  if (entity.includes("dart")) return "/dart-auto";
  return "/lab";
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
  const v = u.fleet?.verdict;
  // 재시작 버튼은 프로세스가 실제로 문제일 때만(멈춤·죽음). 지연은 임계 문제일 수 있어 제외.
  const broken = v === "dead" || v === "stuck" || (!!u.collectorKey && !u.fleet && !u.running);
  const tone = v ? VERDICT_TONE[v] : null;
  const statusText = v ? VERDICT_LABEL[v] : u.running ? "가동" : "정지";
  const statusCls = tone
    ? `${tone.bg} ${tone.text}${v === "dead" || v === "stuck" ? " animate-blink" : ""}`
    : u.running ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/10 text-ap-ink-3";
  return (
    <div className={`flex items-center gap-2 border-b border-ap-line px-2 py-1 transition-colors ${
      broken ? "bg-ap-down/10" : v === "stale" ? "bg-ap-caution/5" : u.running ? "bg-ap-up/5" : ""}`}>
      <Link href={u.href} className="flex items-center gap-2 flex-1 min-w-0 no-underline hover:opacity-80"
        title={u.fleet?.reason ?? undefined}>
        <StatusDot tone={v ? (v === "fresh" ? "pos" : v === "stale" ? "warn" : "neg") : u.running ? "pos" : "text-3"} />
        <span className="text-[11px] font-data text-ap-ink-1 truncate flex-1">{u.name}</span>
        {u.fleet && (
          <FreshnessBar ageSec={u.fleet.ageSec} staleAfterS={u.fleet.staleAfterS} verdict={u.fleet.verdict} />
        )}
        <span className={`text-[10px] font-data text-ap-ink-3 truncate text-right ${u.fleet ? "w-20" : "max-w-[45%]"}`}>{u.detail}</span>
      </Link>
      <span className={`text-[8px] px-1 border font-data shrink-0 ${
        u.kind === "AI" ? "border-ap-brand/40 text-ap-brand" : "border-ap-line text-ap-ink-3"}`}>{u.kind}</span>
      <span className={`text-[9px] font-data font-bold w-9 text-center shrink-0 ${statusCls}`}>
        {statusText}
      </span>
      {broken && u.collectorKey && (
        <button
          onClick={() => onRestart?.(u.collectorKey!)}
          disabled={restarting}
          className="text-[9px] px-1.5 py-0.5 border border-ap-down/50 text-ap-down bg-ap-down/15 font-data font-bold shrink-0 hover:bg-ap-down/25 disabled:opacity-40"
        >
          {restarting ? "재시작중" : "재시작"}
        </button>
      )}
    </div>
  );
}

function HomeTab() {
  const [f, setF] = useState<Feed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null, alerts: null, vrp: null, health: null, fleet: null, pipeline: null, risk: null, ios: null });
  const [bal, setBal] = useState<AccountBalances | null>(null);
  const [now, setNow] = useState(new Date());
  const [restarting, setRestarting] = useState<Partial<Record<CollectorKey, boolean>>>({});
  const abortRef = useRef<AbortController | null>(null);

  async function handleRestart(key: CollectorKey) {
    setRestarting((r) => ({ ...r, [key]: true }));
    try {
      await restartCollector(key);
      toast.show(`${key} 재시작 완료`, "success");
      const [sys, fleet] = await Promise.all([
        getLabStatus().catch(() => null),
        getFleet().catch(() => null),
      ]);
      setF((prev) => ({ ...prev, sys: sys ?? prev.sys, fleet: fleet ?? prev.fleet }));
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
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge, alerts, vrp, health, fleet] = await Promise.all([
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
        getFleet(c.signal).catch(() => null),      // 수집기 신선도 판정(fresh/stale/stuck/dead)
      ]);
      if (mounted && !c.signal.aborted) setF((prev) => ({ ...prev, lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge, alerts, vrp, health, fleet }));
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  // 계좌 잔액은 KIS/IB 등 외부 브로커 API를 직접 호출해 5~30초씩 걸릴 수 있음 —
  // 4초 주기 메인 피드 루프에 섞으면 abort-then-check 경합으로 상태 갱신 자체가 막힘.
  // 별도의 느린 주기로 독립 폴링.
  // pipeline/risk/investment-os도 여기서 같이 폴링 — getInvestmentOs는 validate_separation()이
  // 매 요청마다 ast.parse로 소스 트리를 재파싱해 200ms+ 걸림. 판단 필요 신호는 초단위 신선도가
  // 필요 없으므로(30초면 충분) 4초 메인 루프에 두면 상시 열려있는 홈페이지에서 CPU를 계속 태움.
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
      const [pipeline, risk, ios] = await Promise.all([
        getConsolePipeline().catch(() => null),
        getRisk().catch(() => null),
        getInvestmentOs(1_000_000).catch(() => null),
      ]);
      if (mounted) setF((prev) => ({ ...prev, pipeline, risk, ios }));
      inFlight = false;
    }
    loadBal();
    const iv = setInterval(loadBal, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, vrp, health, fleet, pipeline, risk, ios } = f;
  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);

  // 돈길 상태 — 시스템의 №1 신호
  const arm = exec?.arm_decision ?? null;
  const paperMo = exec?.arm_gate?.paper_months ?? 0;
  const paperMin = exec?.arm_gate?.min_paper_months ?? 6;
  const edgeLabel = edge?.status === "confirmed" ? "생존 확인" : edge?.status === "drifting" ? "이탈 경고"
    : edge?.status === "accumulating" ? "누적 중" : edge?.status === "no_oos_yet" ? "OOS 대기" : "워밍 중";
  const edgeTone = edge?.status === "confirmed" ? "text-ap-up" : edge?.status === "drifting" ? "text-ap-down"
    : edge?.status === "accumulating" ? "text-ap-brand" : "text-ap-note";

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
  if (sys?.dart_bot) units.push({ kind: "BOT", name: "DART 자동매매", running: !!sys.dart_bot.running, detail: sys.dart_bot.enabled ? "사용" : "꺼짐", href: "/dart-auto" });
  if (sys?.research_service) units.push({ kind: "BOT", name: "리서치 서비스", running: !!sys.research_service.running, detail: `${sys.research_service.ticks ?? 0} 틱`, href: "/lab" });
  // 수집기는 /lab/fleet이 단일 출처 — 서버에 수집기가 추가되면 여기 손 안 대도 자동 반영.
  const collectorUnits: Unit[] = (fleet?.collectors ?? []).map(c => {
    const meta = collectorMeta(c.key);
    return {
      kind: "수집기" as const, name: meta.label, href: meta.href,
      running: c.running, detail: formatAge(c.age_sec),
      collectorKey: c.key as CollectorKey,
      fleet: { verdict: c.verdict, ageSec: c.age_sec, staleAfterS: c.stale_after_s, reason: c.reason },
    };
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

  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
  });

  const nRunning = units.filter(u => u.running).length;
  const nHealthy = collectorUnits.filter(u => u.fleet?.verdict === "fresh").length;
  const nDegraded = collectorUnits.length - nHealthy;
  const wd = sys?.research_service?.watchdog;

  return (
    <div className="min-h-screen p-1 sm:p-1.5 font-data">
      {/* 상단 상태 스트립 — 시계는 우측에 얹어 한 줄 절약 */}
      <Card className="mb-1">
        <CardHeader right={<WorldClock now={now} />}>시스템 상태</CardHeader>
        <div className="flex items-center gap-3 px-2 py-1">
          <StatusDot tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "처리 중" : active ? "가동 중" : "대기"} />
          {arm && (
            <Link href="/lab/execution"
              className={`no-underline text-[11px] px-2 py-0.5 border font-data font-bold tracking-wider ${
                arm.decision === "GO" ? "border-ap-up/50 text-ap-up bg-ap-up/15" :
                arm.decision === "KILL" ? "border-ap-down/50 text-ap-down bg-ap-down/15 animate-blink" :
                "border-ap-note/40 text-ap-note bg-ap-note/15"}`}>
              ARM {arm.decision}
            </Link>
          )}
          {wd?.critical && (
            <span className="text-[9px] px-1.5 py-0.5 border border-ap-down/50 text-ap-down bg-ap-down/15 animate-blink font-data font-bold">감시견 경보</span>
          )}
          {(health?.n_errors ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 border border-ap-down/50 text-ap-down bg-ap-down/15 animate-blink font-data font-bold">정합성 오류 {health!.n_errors}</span>
          )}
        </div>
      </Card>

      {/* 판단 필요 — 사람 결정 걸리는 것만. 0건이면 한 줄로 접힘 */}
      <Card className="mb-1">
        <CardHeader right={<span className="tabular-nums">{attentionItems.length}건</span>}>
          판단 필요
        </CardHeader>
        {attentionItems.length === 0 ? (
          <div className="px-2 py-1.5">
            <StatusDot tone="pos" label="판단 대기 항목 없음" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {attentionItems.map((it) => (
              <Link key={it.id} href={it.href} className="flex items-center gap-2 border-b border-ap-line px-2 py-1 no-underline hover:opacity-80">
                <StatusDot tone={it.tone === "neg" ? "neg" : it.tone === "warn" ? "warn" : "info"} />
                <span className="text-[11px] font-data text-ap-ink-1 truncate flex-1">{it.label}</span>
                <span className="text-[10px] font-data text-ap-ink-3 truncate">{it.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* 유닛 로스터 — 전략(AI·봇)과 데이터 수집기는 고장 의미가 달라서 분리 */}
      <Card className="mb-1">
        <CardHeader right={<span className="tabular-nums">{nRunning}/{units.length} 가동</span>}>
          유닛 로스터 · 전략
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {units.map((u, i) => (
            <UnitCard key={`${u.name}-${i}`} u={u} />
          ))}
        </div>
      </Card>

      {/* 수집기 함대 — 신선도 정도(바)까지 표시. 가동/정지 이진으로는 지연을 못 잡음 */}
      <Card className="mb-1">
        <CardHeader right={
          <span className={`tabular-nums ${nDegraded > 0 ? "text-ap-caution" : "text-ap-up"}`}>
            {collectorUnits.length > 0 ? `정상 ${nHealthy}/${collectorUnits.length}` : "…"}
            {nDegraded > 0 ? ` · 이상 ${nDegraded}` : ""}
          </span>
        }>
          수집기 함대
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {collectorUnits.map((u, i) => (
            <UnitCard
              key={`${u.name}-${i}`}
              u={u}
              onRestart={handleRestart}
              restarting={u.collectorKey ? !!restarting[u.collectorKey] : false}
            />
          ))}
        </div>
        {collectorUnits.length === 0 && (
          <div className="px-2 py-1.5 text-ap-ink-3 text-[11px]">수집기 상태 로딩 중…</div>
        )}
      </Card>

      {/* 정합성 감시 — 봇·에이전트 회계 불변식(조용한 돈 버그 감지). /lab/health */}
      <Card className="mb-1">
        <CardHeader right={
          <span className={`tabular-nums ${(health?.n_errors ?? 0) > 0 ? "text-ap-down" : health ? "text-ap-up" : "text-ap-ink-3"}`}>
            {health ? (health.ok ? "이상 없음" : `${health.n_errors} 오류 · ${health.n_violations} 위반`) : "…"}
          </span>
        }>
          정합성 감시
        </CardHeader>
        {health && health.violations.length === 0 && (
          <div className="px-2 py-1.5">
            <StatusDot tone="pos" label="봇·에이전트 회계 정합성 정상" />
          </div>
        )}
        {health && health.violations.length > 0 && (
          <div className="max-h-56 overflow-y-auto">
            {health.violations.map((v, i) => (
              <Link
                key={i}
                href={violationHref(v.entity)}
                className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px] hover:bg-ap-bg transition-colors">
                <StatusDot tone={v.severity === "error" ? "neg" : "accent"} />
                <span className="text-ap-ink-3 shrink-0 w-32 truncate">{v.entity}</span>
                <span className={`shrink-0 w-40 truncate font-bold font-data ${v.severity === "error" ? "text-ap-down" : "text-ap-caution"}`}>{v.code}</span>
                <span className="text-ap-ink-2 truncate flex-1">{v.detail}</span>
                <span className="text-ap-ink-3 shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
        {!health && (
          <div className="px-2 py-1.5 text-ap-ink-3 text-[11px]">정합성 상태 로딩 중…</div>
        )}
      </Card>

      {/* 계좌 + 돈길 핵심 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 items-start">
        {bal ? <Balances bal={bal} /> : (
          <div className="bg-ap-surface border border-ap-line p-2 text-ap-ink-3 text-[11px]">계좌 정보 로딩 중… (IB Gateway 응답 대기, 6~8초 정상)</div>
        )}
        <Card>
          <CardHeader right={<Link href="/lab/execution" className="no-underline uppercase tracking-wider hover:underline">집행 콘솔 →</Link>}>
            돈길
          </CardHeader>
          {/* 엣지 → 페이퍼 → ARM → LIVE 순서. 앞 관문이 안 끝나면 뒤는 pending으로 흐림 */}
          <div className="flex pt-1">
            <LadderStep label="1 엣지" value={edgeLabel}
              state={edge?.status === "confirmed" ? "done" : edge?.status === "drifting" ? "blocked" : "current"} />
            <LadderStep label="2 페이퍼" value={`${paperMo}/${paperMin}mo`}
              state={paperMo >= paperMin ? "done" : edge?.status === "confirmed" ? "current" : "pending"} />
            <LadderStep label="3 ARM" value={arm?.decision ?? "—"}
              state={arm?.decision === "GO" ? "done" : arm?.decision === "KILL" ? "blocked"
                : paperMo >= paperMin ? "current" : "pending"} />
            <LadderStep label="4 LIVE" value={jarvis?.live_execution ?? "—"}
              state={jarvis?.live_execution === "blocked" ? "blocked"
                : jarvis?.live_execution === "enabled" ? "done" : "pending"} />
          </div>
        </Card>
      </div>

      {/* 로그 + 최근 체결 + 알림 — 빈 공간 없이 실시간 활동 채움 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 items-start mt-1">
        <Card>
          <CardHeader right={<span className="tabular-nums">{alerts?.length ?? 0}건</span>}>
            최근 알림
          </CardHeader>
          <div className="max-h-64 overflow-y-auto">
            {(alerts ?? []).slice(0, 14).map((a, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
                <span className="text-ap-ink-3 shrink-0 w-16 truncate">{a.triggered_at?.slice(11, 19) ?? "--:--:--"}</span>
                <span className="text-ap-caution truncate flex-1">{a.rule_label}</span>
                <span className="text-ap-ink-2 shrink-0 truncate max-w-[40%]">{a.detail}</span>
              </div>
            ))}
            {(alerts?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-ap-ink-3 text-[11px]">알림 없음</div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader right={<span className="tabular-nums">{lab?.log?.length ?? 0}줄</span>}>
            AI LAB 로그
          </CardHeader>
          <div className="max-h-64 overflow-y-auto">
            {(lab?.log ?? []).slice(-14).reverse().map((l, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
                <span className="text-ap-ink-3 shrink-0 w-16 truncate">{l.ts?.slice(11, 19) ?? "--:--:--"}</span>
                <span className={`shrink-0 w-12 truncate ${
                  l.level === "error" ? "text-ap-down" : l.level === "warn" ? "text-ap-caution" : "text-ap-ink-3"}`}>{l.stage}</span>
                <span className="text-ap-ink-2 truncate flex-1">{l.msg}</span>
              </div>
            ))}
            {(lab?.log?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-ap-ink-3 text-[11px]">로그 없음</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader right={<span className="tabular-nums">{exec?.paper?.recent_closed?.length ?? 0}건</span>}>
            최근 페이퍼 체결
          </CardHeader>
          <div className="max-h-64 overflow-y-auto">
            {(exec?.paper?.recent_closed ?? []).slice(0, 14).map((t, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-[10px]">
                <span className="text-ap-ink-1 truncate flex-1">{t.corp}</span>
                <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.entry_date}</span>
                <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.exit_date ?? "보유중"}</span>
                <span className={`shrink-0 w-14 text-right px-1 font-bold ${
                  (t.pnl_pct ?? 0) > 0 ? "bg-ap-up/20 text-ap-up" : (t.pnl_pct ?? 0) < 0 ? "bg-ap-down/20 text-ap-down" : "text-ap-ink-3"}`}>
                  {t.pnl_pct != null ? `${t.pnl_pct.toFixed(2)}%` : "—"}
                </span>
              </div>
            ))}
            {(exec?.paper?.recent_closed?.length ?? 0) === 0 && (
              <div className="px-2 py-3 text-ap-ink-3 text-[11px]">체결 없음</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
