"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type CollectorKey } from "@/lib/api";
import { deriveAttentionItems } from "@/lib/attention";
import { ApPanel, ApPanelHead, ApGateStep } from "@/components/ui/ApPrimitives";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { FreshnessBar } from "@/components/ui/FreshnessBar";
import { collectorMeta, VERDICT_LABEL, VERDICT_TONE, type Verdict } from "@/lib/collectors";
import { displayLevel } from "@/lib/agent-level";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortfolioTab from "@/components/hud/PortfolioTab";
import ExecutionTab from "@/components/hud/ExecutionTab";
import TasksTab from "@/components/hud/TasksTab";
import { useHudFeed } from "@/components/hud/useHudFeed";
import { StatusDot } from "@/components/hud/StatusDot";

/* AI LAB 통제판(구 /lab, /research-os/pipeline)은 read-only 리뉴얼(2026-08-25)에서 삭제 —
   집행콘솔·페이퍼모니터는 "운영" 한 탭 안에서 토글로 묶어 HOME 상단 탭 수를 줄임. */
type TabKey = "home" | "portfolio" | "ops";
const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "HOME" },
  { key: "portfolio", label: "자산" },
  { key: "ops", label: "운영" },
];

function OpsTab() {
  const [view, setView] = useState<"execution" | "tasks">("execution");
  return (
    <div>
      <div className="px-4 sm:px-6 pt-4">
        <SegmentedToggle
          size="sm"
          value={view}
          onChange={setView}
          inactiveClass="border-ap-line text-ap-ink-3 hover:text-ap-ink-2"
          options={[
            { value: "execution", label: "집행 콘솔", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
            { value: "tasks", label: "페이퍼 모니터", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
          ]}
        />
      </div>
      {view === "execution" ? <ExecutionTab /> : <TasksTab />}
    </div>
  );
}

function HudInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "home";
  const setTab = (k: TabKey) => router.push(k === "home" ? "/hud" : `/hud?tab=${k}`);

  return (
    <div className="min-h-full bg-ap-bg">
      <div className="flex gap-1 border-b border-ap-line px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-ap-body font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
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
      {tab === "ops" && <OpsTab />}
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
   상세 수치는 각 전용 페이지(/auto-research, /hud?tab=ops)로 위임. */

const WORLD_CITIES: { label: string; tz: string }[] = [
  { label: "서울", tz: "Asia/Seoul" },
  { label: "뉴욕", tz: "America/New_York" },
  { label: "런던", tz: "Europe/London" },
  { label: "도쿄", tz: "Asia/Tokyo" },
];

/** 참고 정보라 한 줄로 눌러둠 — 상단 픽셀은 조치가 필요한 상태 표시에 양보. */
function WorldClock({ now }: { now: Date }) {
  return (
    <div className="hidden sm:flex items-center justify-end gap-4 px-2 py-0.5">
      {WORLD_CITIES.map(c => (
        <span key={c.tz} className="inline-flex items-baseline gap-1">
          <span className="text-ap-ink-3 text-ap-micro uppercase tracking-widest">{c.label}</span>
          {/* SSR 시각과 클라이언트 시각은 1초 차이로 어긋남 — 시계는 하이드레이션 비교 대상 아님 */}
          <span className="text-ap-ink-2 text-ap-body font-data tabular-nums" suppressHydrationWarning>
            {now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour12: false })}
          </span>
        </span>
      ))}
    </div>
  );
}

interface Unit {
  kind: "AI" | "BOT" | "수집기"; name: string; running: boolean; detail: string; href?: string;
  collectorKey?: CollectorKey;
  /** 수집기 전용 — 신선도 정도. running 이진만으로는 "45초 전"과 "55분 전"이 구분 안 됨. */
  fleet?: { verdict: Verdict; ageSec: number | null; staleAfterS: number; reason: string };
}

function formatAge(ageSec: number | null): string {
  if (ageSec == null) return "데이터 없음";
  if (ageSec < 60) return `${ageSec}s 전`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}분 전`;
  return `${Math.floor(ageSec / 3600)}시간 전`;
}

function UnitCard({ u }: { u: Unit }) {
  const v = u.fleet?.verdict;
  const broken = v === "dead" || v === "stuck" || (!!u.collectorKey && !u.fleet && !u.running);
  const tone = v ? VERDICT_TONE[v] : null;
  const statusText = v ? VERDICT_LABEL[v] : u.running ? "가동" : "정지";
  const statusCls = tone
    ? `${tone.bg} ${tone.text}${v === "dead" || v === "stuck" ? " animate-blink" : ""}`
    : u.running ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/10 text-ap-ink-3";
  const inner = (
    <>
      <StatusDot tone={v ? (v === "fresh" ? "pos" : v === "stale" ? "warn" : "neg") : u.running ? "pos" : "text-3"} />
      <span className="text-ap-body font-data text-ap-ink-1 truncate flex-1">{u.name}</span>
      {u.fleet && (
        <span className="hidden sm:block">
          <FreshnessBar ageSec={u.fleet.ageSec} staleAfterS={u.fleet.staleAfterS} verdict={u.fleet.verdict} />
        </span>
      )}
      <span className={`text-ap-body font-data text-ap-ink-3 truncate text-right ${u.fleet ? "w-14 sm:w-20" : "max-w-[30%] sm:max-w-[45%]"}`}>{u.detail}</span>
    </>
  );
  return (
    <div className={`flex flex-col border-b border-ap-line px-2 py-1 transition-colors ${
      broken ? "bg-ap-down/10" : v === "stale" ? "bg-ap-caution/5" : u.running ? "bg-ap-up/5" : ""}`}>
      <div className="flex items-center gap-2">
        {u.href ? (
          <Link href={u.href} className="flex items-center gap-2 flex-1 min-w-0 no-underline hover:opacity-80">
            {inner}
          </Link>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">{inner}</div>
        )}
        <span className={`hidden sm:inline-flex text-ap-micro px-1 border font-data shrink-0 ${
          u.kind === "AI" ? "border-ap-brand/40 text-ap-brand" : "border-ap-line text-ap-ink-3"}`}>{u.kind}</span>
        <span className={`text-ap-micro font-data font-bold w-9 text-center shrink-0 ${statusCls}`}>
          {statusText}
        </span>
      </div>
      {broken && u.fleet?.reason && (
        <div className="pl-6 pb-0.5 text-ap-micro text-ap-down truncate">{u.fleet.reason}</div>
      )}
    </div>
  );
}

function HomeTab() {
  const { feed: f } = useHudFeed();
  const [now, setNow] = useState(new Date());
  const [activityView, setActivityView] = useState<"alerts" | "log" | "trades">("alerts");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { lab, jarvis, ar, bot, agents, sys, exec, edge, alerts, health, fleet, pipeline, risk, ios } = f;
  const homeAlerts = (alerts ?? []).filter((a) => a.condition_type !== "insider_convergence");
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
  const armLabel = arm?.decision === "GO" ? "진입 가능" : arm?.decision === "KILL" ? "중단" : arm?.decision === "WAIT" ? "대기" : "—";
  const liveLabel = jarvis?.live_execution === "enabled" ? "가동" : jarvis?.live_execution === "disabled" ? "비활성" : "—";

  // 전 유닛 로스터 — 트레이딩 AI(라이브만) + 시스템 봇. 페이퍼 에이전트는 실계좌 아니라 홈에서 제외 — 전체는 /investment-os/live-agents
  const liveAgents = (agents ?? []).filter(a => !a.paper);
  const paperAgentCount = (agents ?? []).length - liveAgents.length;
  const units: Unit[] = [];
  liveAgents.forEach(a => units.push({
    kind: "AI", name: a.name, running: a.status === "running",
    detail: `${a.market} · Lv${displayLevel(a)}`,
    href: "/overview",
  }));
  units.push({ kind: "BOT", name: "AI LAB 엔진", running: active, detail: `stage ${lab?.stage ?? "—"}`, href: "/investment-os" });
  units.push({ kind: "BOT", name: "Auto-Research", running: busy, detail: `검증 ${ar?.n_tested ?? 0} · 후보 ${ar?.n_candidates ?? 0}`, href: "/investment-os/research-candidates" });
  units.push({ kind: "BOT", name: "Buyback 봇", running: (bot?.open ?? 0) > 0, detail: `보유 ${bot?.open ?? 0}`, href: "/portfolio" });
  if (sys?.dart_bot) units.push({ kind: "BOT", name: "DART 자동매매", running: !!sys.dart_bot.running, detail: sys.dart_bot.enabled ? "사용" : "꺼짐", href: "/portfolio" });
  if (sys?.research_service) units.push({ kind: "BOT", name: "리서치 서비스", running: !!sys.research_service.running, detail: `${sys.research_service.ticks ?? 0} 틱`, href: "/investment-os" });
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
  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
    godCandidates: f.godCandidates ? { promotable: f.godCandidates.promotable, reverted: f.godCandidates.reverted } : null,
    claimCandidates: f.claimCandidates ? { candidates: f.claimCandidates.candidates } : null,
  });

  const nRunning = units.filter(u => u.running).length;
  const nHealthy = collectorUnits.filter(u => u.fleet?.verdict === "fresh").length;
  const nDegraded = collectorUnits.length - nHealthy;
  const wd = sys?.research_service?.watchdog;

  return (
    <div className="min-h-screen p-3 sm:p-4 space-y-3">
      {/* 상태 히어로 — "지금 안전한가?"에 한 눈에 답함. 평소엔 조용, 이상 있을 때만 커짐 */}
      <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap p-4">
          <div>
            <div className="text-ap-micro uppercase tracking-wide text-ap-ink-3">시스템 판정</div>
            <div className={`text-ap-hero font-bold font-data mt-0.5 ${
              arm?.decision === "GO" ? "text-ap-up" : arm?.decision === "KILL" ? "text-ap-down" : "text-ap-note"}`}>
              {armLabel}
            </div>
            <div className="text-ap-body text-ap-ink-3 mt-0.5">
              <StatusDot tone={busy ? "accent" : active ? "pos" : "text-3"} label={busy ? "처리 중" : active ? "가동 중" : "대기"} />
            </div>
          </div>
          <WorldClock now={now} />
        </div>
        {wd?.critical && (
          <div className="px-4 py-2 text-ap-body font-semibold text-ap-down bg-ap-down/15 animate-blink">감시견 경보 — 확인 필요</div>
        )}
        <div className={`px-4 py-2 text-ap-body border-t border-ap-line ${(health?.n_errors ?? 0) > 0 ? "text-ap-down" : "text-ap-ink-3"}`}>
          {health ? (health.ok ? "정합성 이상 없음" : `정합성 오류 ${health.n_errors} · 위반 ${health.n_violations}`) : "정합성 로딩 중…"}
        </div>
        {health && health.violations.length > 0 && (
          <div className="max-h-56 overflow-y-auto border-t border-ap-line">
            {health.violations.map((v, i) => (
              <Link
                key={i}
                href="/portfolio"
                className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 border-b border-ap-line px-4 py-2 text-ap-body hover:bg-ap-bg-page transition-colors last:border-0">
                <span className="flex items-center gap-2 min-w-0">
                  <StatusDot tone={v.severity === "error" ? "neg" : "accent"} />
                  <span className="text-ap-ink-3 truncate sm:shrink-0 sm:w-32">{v.entity}</span>
                  <span className={`truncate sm:shrink-0 sm:w-40 font-bold font-data ${v.severity === "error" ? "text-ap-down" : "text-ap-caution"}`}>{v.code}</span>
                </span>
                <span className="text-ap-ink-2 truncate sm:flex-1 pl-4 sm:pl-0">{v.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 판단 필요 — 사람 결정 걸리는 것만. 0건이면 한 줄로 접힘 */}
      <ApPanel>
        <ApPanelHead title="판단 필요" right={<span className="tabular-nums font-data">{attentionItems.length}건</span>} />
        {attentionItems.length === 0 ? (
          <div className="px-2 py-1.5">
            <StatusDot tone="pos" label="판단 대기 항목 없음" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {attentionItems.map((it) => (
              <Link key={it.id} href={it.href} className="flex items-center gap-2 border-b border-ap-line px-2 py-1 no-underline hover:opacity-80">
                <StatusDot tone={it.tone === "neg" ? "neg" : it.tone === "warn" ? "warn" : "info"} />
                <span className="text-ap-body font-data text-ap-ink-1 truncate flex-1">{it.label}</span>
                <span className="text-ap-body font-data text-ap-ink-3 truncate">{it.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </ApPanel>

      {/* 인프라상태 — 전략(AI·봇)과 데이터 수집기 통합. 고장 의미가 달라서 절 구분은 유지 */}
      <ApPanel>
        <ApPanelHead title="인프라상태" right={
          <span className="tabular-nums font-data">
            {nRunning}/{units.length} 가동 · 수집 {collectorUnits.length > 0 ? `${nHealthy}/${collectorUnits.length}` : "…"}
          </span>
        } />
        <details className="group">
          <summary className="flex items-center px-2 py-1.5 text-ap-body text-ap-ink-3 cursor-pointer list-none border-b border-ap-line">
            <span className="group-open:hidden">전략 상세 ▾</span>
            <span className="hidden group-open:inline">전략 상세 ▴</span>
          </summary>
          <div className="px-2 pt-1.5 pb-0.5 text-ap-micro uppercase tracking-wider text-ap-ink-3">
            전략 · 라이브만
            {paperAgentCount > 0 && (
              <Link href="/investment-os/live-agents" className="ml-1 text-ap-ink-3 hover:text-ap-brand no-underline">(페이퍼 {paperAgentCount}건 →)</Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {units.map((u, i) => (
              <UnitCard key={`${u.name}-${i}`} u={u} />
            ))}
          </div>
          <div className="px-2 pt-1.5 pb-0.5 text-ap-micro uppercase tracking-wider text-ap-ink-3 border-t border-ap-line">
            수집기 {collectorUnits.length === 0 ? "로딩 중…" : `${nHealthy}/${collectorUnits.length} 정상`}
            {nDegraded > 0 && <span className="text-ap-caution"> · 이상 {nDegraded}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {collectorUnits.map((u, i) => (
              <UnitCard key={`${u.name}-${i}`} u={u} />
            ))}
          </div>
        </details>
      </ApPanel>

      {/* 돈길 — 계좌 잔액은 /portfolio에 있어서 중복 제거, 라이브 전환 게이트만 유지 */}
      <ApPanel>
        <ApPanelHead title="돈길" right={<Link href="/hud?tab=ops" className="no-underline uppercase tracking-wider hover:underline">집행 콘솔 →</Link>} />
        <p className="px-2 pt-1 text-ap-caption text-ap-ink-3">시스템 실제 상태 — 라이브 전환 게이트</p>
        {/* 엣지 → 페이퍼 → ARM → LIVE 순서. 앞 관문이 안 끝나면 뒤는 pending으로 흐림 */}
        <div className="flex pt-1">
          <ApGateStep label="1 엣지" value={edgeLabel}
            state={edge?.status === "confirmed" ? "done" : edge?.status === "drifting" ? "blocked" : "current"} />
          <ApGateStep label="2 페이퍼" value={`${paperMo}/${paperMin}mo`}
            state={paperMo >= paperMin ? "done" : edge?.status === "confirmed" ? "current" : "pending"} />
          <ApGateStep label="3 ARM" value={armLabel} title={arm?.decision}
            state={arm?.decision === "GO" ? "done" : arm?.decision === "KILL" ? "blocked"
              : paperMo >= paperMin ? "current" : "pending"} />
          <ApGateStep label="4 LIVE" value={liveLabel} title={jarvis?.live_execution}
            state={jarvis?.live_execution === "disabled" ? "blocked"
              : jarvis?.live_execution === "enabled" ? "done" : "pending"} />
        </div>
      </ApPanel>

      {/* 최근활동 — 알림/LAB 로그/페이퍼 체결을 토글 1카드로 통합 */}
      {/* insider_convergence(컨버전스 하락/상승)는 너무 빈번해 액션 가치 없음 — 홈 알림에서 제외, 필요하면 설정>알림 규칙에서 직접 확인 */}
      <ApPanel>
        <ApPanelHead title="최근활동" right={
          <span className="tabular-nums font-data">
            {activityView === "alerts" ? `${homeAlerts.length}건`
              : activityView === "log" ? `${lab?.log?.length ?? 0}줄`
              : `${exec?.paper?.recent_closed?.length ?? 0}건`}
          </span>
        } />
        <div className="px-2 pt-2">
          <SegmentedToggle
            size="sm"
            value={activityView}
            onChange={setActivityView}
            inactiveClass="border-ap-line text-ap-ink-3 hover:text-ap-ink-2"
            options={[
              { value: "alerts", label: "알림", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
              { value: "log", label: "LAB 로그", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
              { value: "trades", label: "페이퍼 체결", activeClass: "border-ap-brand text-ap-brand bg-ap-brand/10" },
            ]}
          />
        </div>
        <div className="max-h-64 overflow-y-auto mt-1">
          {activityView === "alerts" && (
            <>
              {homeAlerts.slice(0, 14).map((a, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-ap-body">
                  <span className="text-ap-ink-3 shrink-0 w-16 truncate">{a.triggered_at?.slice(11, 19) ?? "--:--:--"}</span>
                  <span className="text-ap-caution truncate flex-1">{a.rule_label}</span>
                  <span className="text-ap-ink-2 shrink-0 truncate max-w-[40%]">{a.detail}</span>
                </div>
              ))}
              {homeAlerts.length === 0 && (
                <div className="px-2 py-3 text-ap-ink-3 text-ap-body">알림 없음</div>
              )}
            </>
          )}
          {activityView === "log" && (
            <>
              {(lab?.log ?? []).slice(-14).reverse().map((l, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-ap-body">
                  <span className="text-ap-ink-3 shrink-0 w-16 truncate">{l.ts?.slice(11, 19) ?? "--:--:--"}</span>
                  <span className={`shrink-0 w-12 truncate ${
                    l.level === "error" ? "text-ap-down" : l.level === "warn" ? "text-ap-caution" : "text-ap-ink-3"}`}>{l.stage}</span>
                  <span className="text-ap-ink-2 truncate flex-1">{l.msg}</span>
                </div>
              ))}
              {(lab?.log?.length ?? 0) === 0 && (
                <div className="px-2 py-3 text-ap-ink-3 text-ap-body">로그 없음</div>
              )}
            </>
          )}
          {activityView === "trades" && (
            <>
              {(exec?.paper?.recent_closed ?? []).slice(0, 14).map((t, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-ap-line px-2 py-0.5 text-ap-body">
                  <span className="text-ap-ink-1 truncate flex-1">{t.corp}</span>
                  <span className="text-ap-ink-3 shrink-0 w-20 truncate">{t.entry_date}</span>
                  <span className="hidden sm:block text-ap-ink-3 shrink-0 w-20 truncate">{t.exit_date ?? "보유중"}</span>
                  <span className={`shrink-0 w-14 text-right px-1 font-bold ${
                    (t.pnl_pct ?? 0) > 0 ? "bg-ap-up/20 text-ap-up" : (t.pnl_pct ?? 0) < 0 ? "bg-ap-down/20 text-ap-down" : "text-ap-ink-3"}`}>
                    {t.pnl_pct != null ? `${t.pnl_pct.toFixed(2)}%` : "—"}
                  </span>
                </div>
              ))}
              {(exec?.paper?.recent_closed?.length ?? 0) === 0 && (
                <div className="px-2 py-3 text-ap-ink-3 text-ap-body">체결 없음</div>
              )}
            </>
          )}
        </div>
      </ApPanel>
    </div>
  );
}
