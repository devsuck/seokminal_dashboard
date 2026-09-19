"use client";
// Investment OS — Research OS 와 완전 분리된 계층. 연구=생산, 투자=소비.
// 모두 추천/시뮬레이션 · AUTO_EXECUTION 영구 비활성 · 사람 승인 필수 · Risk/Compliance/Portfolio/Kill 우회 불가 · 실행 없음.
// /console/investment-os. READ ONLY.
//
// STEP4-D: 21+개 console 화면을 5-tab consolidation shell로 통합(docs/step4/dashboard_migration_map.md,
// docs/step4/five_tab_source_of_truth.md). 병합 섹션은 전부 기존 lib/console-api.ts 함수를 그대로 재사용
// — 신규 API 없음, 신규 계산 없음. write action이 있는 페이지(research-os/workflow의 세션 제어,
// research-os/committee의 memo 생성 등)는 병합하지 않고 "↗" 링크로만 참조(기능 유실 방지).
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  getInvestmentOs, advanceLadder, getForwardLearning, getDataConnection, getResearchAccountability,
  getResearchOrganization, getAllocation, getPositions,
  getValidationLoop, getValidation,
  getMarketCockpit, getInstitutionalIntelligence, getFinancialsLive,
  getRisk, getProductionReadiness, getAgents, getConsoleCouncil, getLogs,
  getMonitor, getOrders, getLiveIntelligence, getMonthlyReview,
  type InvestmentOsResp, type LadderAdvanceResp, type ForwardLearningResp, type ForwardLearningRecord,
  type MonthlyReviewResp,
  type DataConnectionResp, type ResearchAccountabilityResp,
  type ResearchOrganizationResp, type AllocationResp, type PositionsResp,
  type ValidationLoopResp, type ValidationResp,
  type MarketCockpitResp, type InstitutionalIntelligenceResp, type FinancialsLiveResp,
  type RiskResp, type ProductionReadinessResp, type AgentsResp, type ConsoleCouncil, type LogsResp,
  type MonitorResp, type OrdersResp, type LiveIntelligenceResp,
} from "@/lib/console-api";
import { PageHeader, AgentTree } from "@/components/console/widgets";
import { ApPanel, ApPanelHead, ApDot, ApStatTile, ApBadge, ApSkeleton, ApSkeletonStatTile, ApSkeletonLines, ApMeter, ApBottomSheet, ApLightHero, ApGateStep } from "@/components/ui/ApPrimitives";

const RUNG_LABEL: Record<string, string> = {
  PAPER: "페이퍼", SHADOW: "섀도우", SMALL_CAPITAL: "스몰 캐피탈",
  PRODUCTION_CANDIDATE: "프로덕션 후보", AUTO_EXECUTION: "자동 실행",
};
const RUNGS = ["PAPER", "SHADOW", "SMALL_CAPITAL", "PRODUCTION_CANDIDATE", "AUTO_EXECUTION"];
interface ApprovalEntry { from: string; to: string; approved: boolean; advanced: boolean; reason: string | null; ts: string }

// 전략 생애주기 — jarvis/registry/lifecycle.py Status (16종)
const STATUS_LABEL: Record<string, string> = {
  draft: "초안", data_audit_passed: "데이터 감사 통과", blocked_by_data: "데이터 문제로 차단",
  sanity_check_only: "정합성 점검만 완료", backtested: "백테스트 완료", watchlist: "워치리스트",
  rejected: "반려됨", paper_candidate: "페이퍼 후보",
  paper_candidate_forward_test_required: "페이퍼 후보 · 포워드 테스트 필요",
  paper_active: "페이퍼 운용중", paper_failed: "페이퍼 실패", paper_retired: "페이퍼 은퇴",
  live_candidate: "실거래 후보", micro_live: "소액 실거래", constrained_live: "제한적 실거래",
  retired: "은퇴",
};
// 지식/전략 헬스 등급 — jarvis/research_workflow/knowledge_quality.py
const GRADE_LABEL: Record<string, string> = {
  EMPTY: "데이터 없음", HEALTHY: "양호", FAIR: "보통", DEGRADED: "저하됨",
};
// Edge/Validation Score 상태 — jarvis/research_workflow/research_validation_score.py
const SCORE_STATUS_LABEL: Record<string, string> = {
  PROVISIONAL: "미확정", SCORED: "계산됨",
};
// 포트폴리오 가중 방식 — jarvis/investment_os/portfolio_construction.py (기본값 evidence_weighted, 그 외는 동일가중 폴백)
const PORTFOLIO_METHOD_LABEL: Record<string, string> = {
  evidence_weighted: "근거등급 가중",
};
// data_health 상태 — jarvis/research_workflow/data_quality.py (system_health와 별개 도메인)
const DATA_HEALTH_LABEL: Record<string, string> = {
  ok: "정상", DEGRADED: "저하됨", LIMITED: "제한됨",
};
// 페이퍼 포지션 필드 — jarvis/paper_execution/models.py PaperPosition (dataclass, asdict 순서 고정)
const POSITION_FIELD_LABEL: Record<string, string> = {
  strategy_id: "전략 ID", quantity: "수량", average_price: "평균단가",
  market_value: "평가금액", unrealized_pnl: "미실현 손익", realized_pnl: "실현 손익",
};
// 리스크 한도 필드 — jarvis/risk/governor.py RiskLimits
const RISK_LIMIT_LABEL: Record<string, string> = {
  max_notional: "최대 명목가치", max_order_qty: "최대 주문수량", max_leverage: "최대 레버리지",
  kill_switch: "킬스위치", require_human_approval: "사람 승인 필수",
};
// 재무제표 필드 — api_server/console_api.py financials-live (Finnhub/DART 매핑)
const FINANCIALS_FIELD_LABEL: Record<string, string> = {
  year: "회계연도", pe_ttm: "PER(TTM)", roe_ttm: "ROE(TTM)", debt_to_equity: "부채비율",
  current_ratio: "유동비율", net_margin_ttm: "순이익률(TTM)", revenue_growth_yoy: "매출성장률(YoY)",
};
// 예측 캡처 출처 — jarvis/research_workflow/prediction_registry.py SOURCES(고정 enum)
const PREDICTION_SOURCE_LABEL: Record<string, string> = {
  committee: "위원회", agent: "에이전트", human_hypothesis: "사람 가설", automatic_discovery: "자동 발견",
};
// 실험 상태값 — research/agents/experiment_registry.py 에 자유 문자열로 기록(폐쇄 enum 아님, 관측된 값 기준)
const EXPERIMENT_STATUS_LABEL: Record<string, string> = {
  rejected: "반려됨", watchlist: "워치리스트", underpowered: "검정력 부족", candidate: "후보",
  weak: "약함", v2_shadow: "v2 섀도우", no_effect: "효과 없음", analysis: "분석중",
};
// 검증 게이트 — api_server/console_api.py /validation 고정 목록
const GATE_LABEL: Record<string, string> = {
  walk_forward: "워크포워드", monte_carlo: "몬테카를로", bh_fdr: "BH-FDR", cost_stress: "비용 스트레스", redteam: "레드팀",
};

// STEP4-B 원칙: 단순 ranking/숫자 스코어 금지 — Evidence Quality + Validation Status + Forward Progress + Risk State
function evidenceQuality(r: ForwardLearningRecord): { label: string; tone: "pos" | "warn" | "neg" | "mute" } {
  const ev = r.evidence_used ?? [];
  if (ev.length === 0) return { label: "증거 없음", tone: "neg" };
  const latest = ev[ev.length - 1];
  if (latest.cost_robust && latest.wf_second_sharpe !== undefined && latest.wf_second_sharpe !== null) {
    return { label: "Robust · WF+cost-검증", tone: "pos" };
  }
  if (latest.wf_first_sharpe !== undefined || latest.wf_second_sharpe !== undefined) {
    return { label: "Partial · WF만", tone: "warn" };
  }
  return { label: "Weak · 백테스트만", tone: "warn" };
}
function forwardProgress(r: ForwardLearningRecord): { label: string; tone: "pos" | "warn" | "neg" | "mute" } {
  if (!r.expected_behavior) return { label: "Forward 데이터 없음", tone: "mute" };
  const dev = r.current_behavior?.envelope_deviation;
  if (dev === undefined || dev === null) return { label: "Envelope 내 진행 중", tone: "pos" };
  return { label: "편차 감지 — 확인 필요", tone: "warn" };
}
function riskState(r: ForwardLearningRecord): { label: string; tone: "pos" | "warn" | "neg" | "mute" } {
  if (!r.invalidation_condition) return { label: "Invalidation 조건 미등록", tone: "warn" };
  return { label: "모니터링됨", tone: "pos" };
}

const DECISION_TONE: Record<string, "pos" | "warn" | "neg" | "mute"> = {
  KEEP: "pos", WATCH: "mute", PAUSE: "warn", REJECT: "neg",
};

// ── 탭 최초 활성화 시 1회만 fetch, 이후 캐시(동시 다건 로드 방지) ──────
// SWR로 교체 — 탭 재방문 시 자동 재검증(stale-while-revalidate), 창 포커스 복귀 시 갱신,
// 실패 시 재시도. key는 훅 인스턴스별 고유(useId)라 인스턴스 간 충돌 없음 — 탭별 fetcher
// 호출부(211-226행)는 시그니처 그대로라 변경 없음.
function useTabFetch<T>(active: boolean, fetcher: (signal: AbortSignal) => Promise<T>) {
  const id = useId();
  const ctrlRef = useRef<AbortController | null>(null);
  const { data, error, isLoading } = useSWR<T>(active ? id : null, () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return fetcher(ctrl.signal);
  });
  useEffect(() => () => ctrlRef.current?.abort(), []);
  return { data: data ?? null, err: error ? (error as Error).message : null, loading: isLoading };
}

type TabKey = "overview" | "strategy" | "research" | "risk" | "ops";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "strategy", label: "전략 인텔리전스" },
  { key: "research", label: "리서치 근거" },
  { key: "risk", label: "리스크 & 거버넌스" },
  { key: "ops", label: "운영" },
];

function TabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[11px] text-[var(--c-hud)] hover:underline no-underline whitespace-nowrap">
      {label} ↗
    </Link>
  );
}

function InvestmentOsInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<InvestmentOsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>(
    TABS.some(t => t.key === searchParams.get("tab")) ? (searchParams.get("tab") as TabKey) : "overview"
  );
  useEffect(() => {
    const t = searchParams.get("tab");
    if (TABS.some(x => x.key === t)) setTab(t as TabKey);
  }, [searchParams]);
  // 승인 워크플로 상태
  const [currentRung, setCurrentRung] = useState("PAPER");
  const [reviewed, setReviewed] = useState(false);
  const [advResult, setAdvResult] = useState<LadderAdvanceResp | null>(null);
  const [history, setHistory] = useState<ApprovalEntry[]>([]);
  const [busy, setBusy] = useState(false);
  // STEP4 — Forward Learning + Validation Score (전부 읽기전용 projection)
  const [fwd, setFwd] = useState<ForwardLearningResp | null>(null);
  const [conn, setConn] = useState<DataConnectionResp | null>(null);
  const [acct, setAcct] = useState<ResearchAccountabilityResp | null>(null);
  const [sideLoading, setSideLoading] = useState(true);
  // 모바일 리스크 탭 — 상세 지표는 기본 접힘(정보 최소화)
  const [showDetail, setShowDetail] = useState(false);
  // 재무제표 실측 조회 패널 (financials_live 직접 배선) — 사용자 입력 트리거, 탭 활성화와 무관
  const [finQuery, setFinQuery] = useState("");
  const [finData, setFinData] = useState<FinancialsLiveResp | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finErr, setFinErr] = useState<string | null>(null);
  const finAbortRef = useRef<AbortController | null>(null);
  const runFinLookup = useCallback(async () => {
    const q = finQuery.trim();
    if (!q) return;
    finAbortRef.current?.abort();
    const ctrl = new AbortController();
    finAbortRef.current = ctrl;
    setFinLoading(true); setFinErr(null);
    try {
      const params = /^\d{6}$/.test(q) ? { code: q } : { symbol: q.toUpperCase() };
      const r = await getFinancialsLive(params, ctrl.signal);
      if (!ctrl.signal.aborted) setFinData(r);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) { setFinErr((e as Error).message); setFinData(null); }
    } finally {
      if (!ctrl.signal.aborted) setFinLoading(false);
    }
  }, [finQuery]);
  useEffect(() => () => finAbortRef.current?.abort(), []);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    try {
      const r = await getInvestmentOs(1_000_000, ctrl.signal);
      if (!ctrl.signal.aborted) setData(r);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const sideAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    sideAbortRef.current?.abort();
    const ctrl = new AbortController();
    sideAbortRef.current = ctrl;
    setSideLoading(true);
    Promise.allSettled([
      getForwardLearning(ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setFwd(r); }),
      getDataConnection(ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setConn(r); }),
      getResearchAccountability(ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setAcct(r); }),
    ]).finally(() => { if (!ctrl.signal.aborted) setSideLoading(false); });
    return () => ctrl.abort();
  }, []);

  // STEP4-D 병합 섹션 — 탭 활성화 시 lazy fetch, 기존 API 그대로 재사용
  const monthly = useTabFetch<MonthlyReviewResp>(tab === "overview", (sig) => getMonthlyReview(sig));
  const org = useTabFetch<ResearchOrganizationResp>(tab === "overview", (sig) => getResearchOrganization("", sig));
  const alloc = useTabFetch<AllocationResp>(tab === "overview", (sig) => getAllocation(sig));
  const positions = useTabFetch<PositionsResp>(tab === "overview", (sig) => getPositions(sig));
  const valLoop = useTabFetch<ValidationLoopResp>(tab === "strategy", (sig) => getValidationLoop("", sig));
  const val = useTabFetch<ValidationResp>(tab === "strategy", (sig) => getValidation(sig));
  const market = useTabFetch<MarketCockpitResp>(tab === "research", (sig) => getMarketCockpit(sig));
  const inst = useTabFetch<InstitutionalIntelligenceResp>(tab === "research", (sig) => getInstitutionalIntelligence("", "semiconductor", "TSMC", sig));
  const riskGov = useTabFetch<RiskResp>(tab === "risk", (sig) => getRisk(sig));
  const prod = useTabFetch<ProductionReadinessResp>(tab === "risk", (sig) => getProductionReadiness("", sig));
  const agents = useTabFetch<AgentsResp>(tab === "risk", (sig) => getAgents(sig));
  const council = useTabFetch<ConsoleCouncil>(tab === "risk", (sig) => getConsoleCouncil(40, sig));
  const logs = useTabFetch<LogsResp>(tab === "risk", (sig) => getLogs(80, sig));
  const monitor = useTabFetch<MonitorResp>(tab === "ops", (sig) => getMonitor(sig));
  const orders = useTabFetch<OrdersResp>(tab === "ops", (sig) => getOrders(sig));
  const live = useTabFetch<LiveIntelligenceResp>(tab === "ops", (sig) => getLiveIntelligence(sig));

  const nextRung = RUNGS[Math.min(RUNGS.indexOf(currentRung) + 1, RUNGS.length - 1)];
  const nextIsAuto = nextRung === "AUTO_EXECUTION";

  const approveAndAdvance = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const r = await advanceLadder(currentRung, true);
      setAdvResult(r);
      setHistory((h) => [{ from: currentRung, to: r.new_rung, approved: true, advanced: r.advanced,
        reason: r.blocked_reason, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 8));
      if (r.advanced) { setCurrentRung(r.new_rung); setReviewed(false); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [currentRung]);

  const resetLadder = useCallback(() => {
    setCurrentRung("PAPER"); setReviewed(false); setAdvResult(null);
  }, []);

  const sep = data?.separation;
  const ladder = data?.execution_ladder;
  const weights = data?.portfolio.weights ?? {};
  const sizes = data?.position_sizing ?? {};

  return (
    <>
    <div className="hidden md:block min-h-full">
      <PageHeader kicker="Investment OS · 분리 계층" title="Investment OS"
        right={<div className="flex gap-1.5">
          {sep && <ApBadge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</ApBadge>}
          <ApBadge tone="neg">AUTO-EXEC OFF</ApBadge>
        </div>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[13px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {/* Safety banner — 미션 핵심, 탭과 무관하게 항상 표시 */}
        <div className="bg-[var(--c-panel-2)] p-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">보장 사항</span>
          <ApBadge tone="pos">연구=생산 · 투자=소비</ApBadge>
          <ApBadge tone="pos">Research OS 무변경</ApBadge>
          <ApBadge tone="neg">AUTO_EXECUTION 영구 OFF</ApBadge>
          <ApBadge tone="warn">사람 승인 필수</ApBadge>
          <ApBadge tone="warn">Risk/Compliance/Portfolio/Kill 우회 불가</ApBadge>
          <ApBadge tone="mute">모두 추천/시뮬레이션 · 실행 없음</ApBadge>
        </div>

        {!data && !err && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
            </div>
            <div className="flex flex-wrap gap-1 border-b border-[var(--c-border)]">
              {TABS.map((t) => (
                <div key={t.key} className="px-3.5 h-9 flex items-center">
                  <ApSkeleton className="h-2.5 w-16" />
                </div>
              ))}
            </div>
            <ApPanel>
              <div className="px-4 h-10 border-b border-[var(--c-border)] flex items-center">
                <ApSkeleton className="h-2.5 w-40" />
              </div>
              <div className="p-4"><ApSkeletonLines rows={4} /></div>
            </ApPanel>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ApStatTile label="소비된 리서치" value={String(data.knowledge.consumed_candidates)} sub={`리서치 원본 변경: ${data.knowledge.research_os_modified ? "있음" : "없음"}`} tone="hud" />
              <ApStatTile label="포트폴리오 포지션" value={String(Object.keys(weights).length)} sub={PORTFOLIO_METHOD_LABEL[data.portfolio.method] ?? data.portfolio.method} tone="pos" />
              <ApStatTile label="컴플라이언스" value={data.compliance.compliant ? "통과" : "실패"} sub={`사람 개입: ${data.compliance.human_can_override ? "가능" : "불가"}`} tone={data.compliance.compliant ? "pos" : "neg"} />
              <ApStatTile label="필수 게이트" value={data.gates.passed ? "통과" : "차단"} sub={`우회: ${data.gates.bypass_possible ? "가능" : "불가"}`} tone={data.gates.passed ? "pos" : "warn"} />
            </div>

            {/* Tab bar — STEP4-D 5-view consolidation */}
            <div className="flex flex-wrap gap-1 border-b border-[var(--c-border)]">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3.5 h-9 text-[11px] font-semibold tracking-wide uppercase border-0 border-b-2 cursor-pointer bg-transparent transition-colors ${
                    tab === t.key ? "text-[var(--c-hud)] border-[var(--c-hud)]" : "text-[var(--c-text-3)] border-transparent hover:text-[var(--c-text-2)]"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══════════════ Tab 1 · Overview ══════════════ */}
            {tab === "overview" && (
              <div className="space-y-4">
                <div className="flex justify-end"><TabLink href="/research-os/cockpit" label="리서치 홈" /></div>

                <ApPanel>
                  <ApPanelHead kicker="월간 리뷰" title="월간 의사결정 루프"
                    right={<ApBadge tone="mute">제안 라벨 — 자동 결정 아님, 사람이 최종 선택</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {monthly.loading && <ApSkeletonLines rows={3} />}
                    {monthly.data && monthly.data.strategies.length === 0 && (
                      <div className="text-[11px] text-[var(--c-text-3)]">추적 대상 전략 없음.</div>
                    )}
                    {(monthly.data?.strategies ?? []).map((s) => {
                      const dr = s.decision_required ?? {};
                      const tone = DECISION_TONE[dr.suggested_label ?? ""] ?? "mute";
                      return (
                        <div key={s.strategy_id} className="bg-[var(--c-panel-2)] p-2.5 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-[11px] text-[var(--c-text-1)] font-semibold">{s.strategy_id}</div>
                            <div className="text-[11px] text-[var(--c-text-3)] truncate">{dr.reason}</div>
                          </div>
                          <ApBadge tone={tone}>{dr.suggested_label ?? "—"}</ApBadge>
                        </div>
                      );
                    })}
                    {monthly.data?.prediction_integrity && (
                      <div className="pt-2">
                        <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1.5">
                          예측 무결성
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <ApStatTile label="유효" value={String(monthly.data.prediction_integrity.valid)} tone="pos" />
                          <ApStatTile label="레거시" value={String(monthly.data.prediction_integrity.legacy_capture)} tone="ink-1" />
                          <ApStatTile label="무효화" value={String(monthly.data.prediction_integrity.invalidated)} tone="neg" />
                          <ApStatTile label="재포착 필요" value={String(monthly.data.prediction_integrity.recapture_required)} tone="warn" />
                        </div>
                      </div>
                    )}
                    {monthly.data && (
                      <div className="text-[9px] text-[var(--c-text-3)] pt-1">
                        현재 포지션({monthly.data.current_positions.count}) → 전략 상태 →
                        Forward 진행 → 검증 변경 → 리스크 변경 → 의사결정 필요 순서로 확인.
                        {monthly.data.note}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="연구 조직 현황" title="시스템 헬스" />
                  {org.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {org.err && <div className="p-4 text-[11px] text-[var(--c-neg)]">{org.err}</div>}
                  {org.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ApBadge tone={org.data.operational_status.operational ? "pos" : "warn"}>{org.data.operational_status.operational ? "가동 중" : "검토 필요"}</ApBadge>
                        <ApBadge tone="mute" title={org.data.knowledge_health.grade}>지식 헬스: {GRADE_LABEL[org.data.knowledge_health.grade] ?? org.data.knowledge_health.grade}</ApBadge>
                        {org.data.strategy_health.review_needed_count > 0 && <ApBadge tone="warn">review 필요 {org.data.strategy_health.review_needed_count}</ApBadge>}
                      </div>
                      {org.data.strategy_health.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--c-text-1)]">{s.strategy}</span>
                          <span className="flex items-center gap-2">
                            <span className="c-num text-[var(--c-text-2)]">{s.health_score}</span>
                            <ApBadge tone={s.review_needed ? "warn" : "pos"} title={s.grade}>{GRADE_LABEL[s.grade] ?? s.grade}</ApBadge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ApPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ApPanel>
                    <ApPanelHead kicker="포트폴리오 구성" title="추천 비중"
                      right={<div className="flex items-center gap-2">
                        <ApBadge tone="mute">추천 · 실배분 아님</ApBadge>
                        <TabLink href="/investment-os/ai-portfolio" label="AI 추천 보기" />
                        <TabLink href="/investment-os/capital-claims" label="자본 청구" />
                      </div>} />
                    <div className="p-4 space-y-1.5">
                      {Object.entries(weights).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">소비할 연구 후보 없음 — 지식 축적 필요.</div>}
                      {Object.entries(weights).map(([sid, w]) => (
                        <div key={sid} className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--c-text-1)] w-52 truncate">{sid}</span>
                          <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w * 100}%`, background: "var(--c-hud)" }} /></div>
                          <span className="text-[11px] c-num text-[var(--c-text-3)] w-12 text-right">{(w * 100).toFixed(1)}%</span>
                          <span className="text-[9px] c-num text-[var(--c-text-3)] w-24 text-right">{(sizes[sid] ?? 0).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="text-[9px] text-[var(--c-text-3)] pt-1">우측 금액 = 포지션 사이징 추천(명목가치 100만 기준). 자본 배분/집행 아님.</div>
                      {alloc.data && (alloc.data.derived_proposal?.length ?? 0) > 0 && (
                        <div className="pt-2 border-t border-[var(--c-border)] space-y-1">
                          <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">배분 파생 제안</div>
                          {alloc.data.derived_proposal!.map((a) => (
                            <div key={a.strategy_id} className="flex items-center justify-between text-[11px]">
                              <span className="text-[var(--c-text-2)]">{a.name} · {a.factor}</span>
                              <span className="c-num text-[var(--c-text-3)]">{(a.target_weight * 100).toFixed(1)}% · <span title={a.status}>{STATUS_LABEL[a.status] ?? a.status}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ApPanel>

                  <ApPanel>
                    <ApPanelHead kicker="보유 포지션" title="포지션" right={positions.data && <ApBadge tone="mute">{positions.data.count}건</ApBadge>} />
                    <div className="p-4 space-y-1.5">
                      {positions.loading && <ApSkeletonLines rows={4} />}
                      {positions.data && positions.data.count === 0 && <div className="text-[11px] text-[var(--c-text-3)]">{positions.data.note}</div>}
                      {positions.data && positions.data.positions.slice(0, 8).map((p, i) => (
                        <div key={i} className="flex flex-wrap gap-x-3 text-[11px] c-num text-[var(--c-text-2)] border-b border-[var(--c-border)] last:border-0 py-1">
                          {Object.entries(p).slice(0, 5).map(([k, v]) => <span key={k}>{POSITION_FIELD_LABEL[k] ?? k}: {String(v)}</span>)}
                        </div>
                      ))}
                    </div>
                  </ApPanel>
                </div>
              </div>
            )}

            {/* ══════════════ Tab 2 · Strategy Intelligence ══════════════ */}
            {tab === "strategy" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/research-os/strategy-lab" label="전략 랩" />
                  <TabLink href="/research-os/committee" label="투자 위원회" />
                  <TabLink href="/research-os/validation" label="리서치 검증 루프 (전체)" />
                  <TabLink href="/quant/validation" label="전략 검증 리포트 (전체)" />
                </div>

                {/* Forward Learning + Validation — STEP4. "왜 믿는가 · 어디까지 검증됐는가 · 실제가 thesis와 맞는가 · 다음 판단·승인자" */}
                <ApPanel>
                  <ApPanelHead kicker="포워드 러닝 검증" title="전략별 검증 상태"
                    right={<ApBadge tone="mute">registry+experiment_registry+prediction_registry+paper.deploy 조인 · 새 원장 없음</ApBadge>} />
                  <div className="p-4 space-y-3">
                    {sideLoading && <ApSkeletonLines rows={4} />}
                    {!sideLoading && acct && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">엣지 스코어</span>
                        {acct.edge_score.status === "PROVISIONAL"
                          ? <ApBadge tone="mute" title="PROVISIONAL">미확정 — {acct.edge_score.graded_scorable ?? 0}/{acct.edge_score.needed ?? 20} 채점됨 (표본 부족, 랭킹 아님)</ApBadge>
                          : <ApBadge tone="pos" title="SCORED">계산됨 — {acct.edge_score.graded_scorable ?? 0} 채점됨</ApBadge>}
                        {conn && (
                          <ApBadge tone={conn.validation_score.status === "PROVISIONAL" ? "mute" : "pos"} title={conn.validation_score.status}>
                            검증 스코어: {SCORE_STATUS_LABEL[conn.validation_score.status ?? ""] ?? conn.validation_score.status}
                          </ApBadge>
                        )}
                      </div>
                    )}
                    {fwd && fwd.count === 0 && <div className="text-[11px] text-[var(--c-text-3)]">추적 대상(paper_active/watchlist/paper_candidate) 전략 없음.</div>}
                    {(fwd?.records ?? []).map((r) => {
                      const eq = evidenceQuality(r); const fp = forwardProgress(r); const rs = riskState(r);
                      return (
                        <div key={r.strategy_id} className="bg-[var(--c-panel-2)] p-3 space-y-1.5">
                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                            <span className="text-[11px] text-[var(--c-text-1)] font-semibold">{r.strategy_id}</span>
                            <ApBadge tone="hud">{STATUS_LABEL[r.validation_status ?? ""] ?? r.validation_status ?? "—"}</ApBadge>
                          </div>
                          {r.thesis && <div className="text-[11px] text-[var(--c-text-2)]">{r.thesis}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            <ApBadge tone={eq.tone}>근거: {eq.label}</ApBadge>
                            <ApBadge tone={fp.tone}>포워드: {fp.label}</ApBadge>
                            <ApBadge tone={rs.tone}>리스크: {rs.label}</ApBadge>
                            {!r.prediction_captured && <ApBadge tone="warn" title="P201 미기록">가설 사전등록 안 됨</ApBadge>}
                          </div>
                          {(r.next_possible?.length ?? 0) > 0 && (
                            <div className="text-[11px] text-[var(--c-text-3)]">
                              다음 가능 상태: {r.next_possible!.map((s) => STATUS_LABEL[s] ?? s).join(", ")}
                              {(r.human_approval_required_next?.length ?? 0) > 0 &&
                                <span className="text-[var(--c-warn)]"> · 사람 승인 필요: {r.human_approval_required_next!.map((s) => STATUS_LABEL[s] ?? s).join(", ")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {fwd && (
                      <div className="text-[11px] text-[var(--c-text-3)] pt-1">
                        커버리지 갭: 가설 없음 {fwd.coverage_gaps.missing_thesis} ·
                        가설 사전등록 안 됨 {fwd.coverage_gaps.missing_prediction_capture} ·
                        포워드 데이터 없음 {fwd.coverage_gaps.missing_forward_data} / {fwd.count}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="검증 루프" title="라이프사이클 보드"
                    right={valLoop.data && <ApBadge tone={valLoop.data.loop_status.release_ready ? "pos" : "mute"}>{valLoop.data.loop_status.release_ready ? "출시 준비 완료" : "진행 중"}</ApBadge>} />
                  {valLoop.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {valLoop.data && (
                    <div className="p-4 space-y-1.5">
                      {valLoop.data.lifecycle_board.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--c-text-1)]">{s.strategy}</span>
                          <ApBadge tone="hud">{s.current_state}</ApBadge>
                        </div>
                      ))}
                      <div className="pt-1.5 flex items-center gap-2 text-[11px] text-[var(--c-text-3)]">
                        <span>품질: {valLoop.data.quality_panel.quality_score ?? "—"} ({valLoop.data.quality_panel.grade})</span>
                        {valLoop.data.validation_panel.divergence_detected && <ApBadge tone="warn">편차 감지됨</ApBadge>}
                      </div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="검증" title="검증 게이트" />
                  {val.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {val.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{val.data.gates.map((g) => <ApBadge key={g} tone="mute">{GATE_LABEL[g] ?? g}</ApBadge>)}</div>
                      <div className="text-[11px] text-[var(--c-text-3)]">레드팀 n={val.data.redteam.n} · 사람 동의={val.data.redteam.human_redteam_agree ?? "—"}</div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-[var(--c-text-2)]">
                        {Object.entries(val.data.experiment_status).map(([k, v]) => <span key={k} className="c-num">{EXPERIMENT_STATUS_LABEL[k] ?? k}: {v}</span>)}
                      </div>
                    </div>
                  )}
                </ApPanel>
              </div>
            )}

            {/* ══════════════ Tab 3 · Research Evidence ══════════════ */}
            {tab === "research" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/research-os/discovery" label="자율 탐색 루프" />
                  <TabLink href="/research-os/brain" label="리서치 브레인" />
                  <TabLink href="/research-os/agents" label="리서치 에이전트" />
                  <TabLink href="/research-os/workflow" label="리서치 워크플로" />
                  <TabLink href="/research-os/explain" label="설명 가능성" />
                  <TabLink href="/research-os/graph" label="지식 그래프" />
                  <TabLink href="/research-os/timeline" label="리서치 타임라인" />
                  <TabLink href="/research-os/chat" label="리서치 챗" />
                </div>

                <ApPanel>
                  <ApPanelHead kicker="시장 현황" title="마켓 / 리서치 인텔리전스"
                    right={market.data && <ApBadge tone="hud">{market.data.market_state.regime}</ApBadge>} />
                  {market.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {market.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{market.data.market_state.labels.map((l) => <ApBadge key={l} tone="mute">{l}</ApBadge>)}</div>
                      {market.data.top_opportunities.map((o, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--c-text-1)]">{o.name} <span className="text-[var(--c-text-3)]">· {o.kind}</span></span>
                          <span className="c-num text-[var(--c-text-3)]">{o.confidence} · 기대값 {o.expected_value}</span>
                        </div>
                      ))}
                      <div className="text-[11px] text-[var(--c-text-3)]">헬스 스코어 {market.data.health_score} · 상위 리스크 {market.data.risk.top_category ?? "—"}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="기관 데이터" title="기관 인텔리전스"
                    right={inst.data && <ApBadge tone="mute">{inst.data.data_production_health.overall_status}</ApBadge>} />
                  {inst.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {inst.data && (
                    <div className="p-4 space-y-1.5 text-[11px] text-[var(--c-text-2)]">
                      <div>데이터 품질 평균: <span className="c-num text-[var(--c-text-1)]">{inst.data.data_production_health.average_quality}</span></div>
                      <div>섹터: {inst.data.sector_intelligence.sector} — {inst.data.sector_intelligence.key_entities.join(", ")}</div>
                      <div>매크로 상태: {inst.data.macro_context.macro_state}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="예측 데이터 연결" title="예측 커버리지" />
                  {sideLoading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {!sideLoading && conn && (
                    <div className="p-4 space-y-1.5 text-[11px] text-[var(--c-text-2)]">
                      <div>총 예측 수: <span className="c-num text-[var(--c-text-1)]">{conn.prediction_coverage.total ?? 0}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(conn.prediction_coverage.by_source ?? {}).map(([k, v]) => <ApBadge key={k} tone="mute">{PREDICTION_SOURCE_LABEL[k] ?? k}: {v}</ApBadge>)}
                      </div>
                      <div>무효화 조건 누락: {conn.prediction_coverage.missing_invalidation_pct ?? "—"}% · 기간(호라이즌) 누락: {conn.prediction_coverage.missing_horizon_pct ?? "—"}%</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="실시간 재무제표" title="재무제표 실측 조회" />
                  <div className="p-4 space-y-3">
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(e) => { e.preventDefault(); runFinLookup(); }}
                    >
                      <input
                        className="bg-bg border border-border text-text-1 text-[11px] px-2 py-1.5 rounded"
                        placeholder="종목코드 (예: AAPL, 005930)"
                        value={finQuery}
                        onChange={(e) => setFinQuery(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={finLoading || !finQuery.trim()}
                        className="bg-accent text-black text-[11px] px-3 py-1.5 rounded disabled:opacity-50"
                      >
                        {finLoading ? "조회 중…" : "조회"}
                      </button>
                    </form>
                    {finErr && <div className="text-[11px] text-neg">조회 실패: {finErr}</div>}
                    {finLoading && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
                      </div>
                    )}
                    {finData && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(finData)
                          .filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined)
                          .map(([k, v]) => (
                            <ApStatTile key={k} label={FINANCIALS_FIELD_LABEL[k] ?? k} value={typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)} tone="hud" />
                          ))}
                      </div>
                    )}
                    {finData && Object.entries(finData).filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined).length === 0 && (
                      <div className="text-[11px] text-text-3">데이터 없음</div>
                    )}
                  </div>
                </ApPanel>
              </div>
            )}

            {/* ══════════════ Tab 4 · Risk & Governance ══════════════ */}
            {tab === "risk" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/research-os/committee" label="투자 위원회" />
                  <TabLink href="/research-os/production" label="위원회 & 프로덕션 (전체)" />
                </div>

                <ApPanel>
                  <ApPanelHead kicker="리스크 & 시나리오" title="예산 · 스트레스" right={data?.risk_budget && <ApBadge tone={data.risk_budget.within_budget ? "pos" : "warn"}>{data.risk_budget.within_budget ? "예산 내" : "한도 초과"}</ApBadge>} />
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[var(--c-panel-2)] p-2"><div className="text-[9px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">최대 비중</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{((data.exposure.max_weight ?? 0) * 100).toFixed(0)}%</div></div>
                      <div className="bg-[var(--c-panel-2)] p-2"><div className="text-[9px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">포지션</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{data.exposure.n_positions ?? 0}</div></div>
                      <div className="bg-[var(--c-panel-2)] p-2"><div className="text-[9px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">쏠림 지수(HHI)</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{(data.exposure.herfindahl ?? 0).toFixed(2)}</div></div>
                    </div>
                    <div className="bg-[var(--c-panel-2)] p-2.5">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-0.5">최악 시나리오</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--c-text-1)]">{data.scenarios.scenario ?? "—"}</span>
                        <span className="text-[11px] c-num text-[var(--c-neg)]">{((data.scenarios.portfolio_impact_pct ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-[9px] c-num text-[var(--c-text-3)]">예상 PnL {(data.scenarios.estimated_pnl ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="text-[9px] text-[var(--c-text-3)]">{data.risk_budget.summary}</div>
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="리스크 한도 (기존 API)" title="리스크 거버너" right={riskGov.data && <ApBadge tone="mute">{riskGov.data.governor}</ApBadge>} />
                  {riskGov.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {riskGov.data && (
                    <div className="p-4 space-y-1.5 text-[11px] text-[var(--c-text-2)]">
                      <div>실행 리스크 이벤트: <span className="c-num text-[var(--c-text-1)]">{riskGov.data.execution_risk_events}</span></div>
                      <div>자율성 레벨 {riskGov.data.autonomy.level} · 라이브 집행 활성화: {riskGov.data.autonomy.live_execution_enabled ? "켜짐" : "꺼짐"}</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(riskGov.data.limits).map(([k, v]) => <ApBadge key={k} tone="mute">{RISK_LIMIT_LABEL[k] ?? k}: {String(v)}</ApBadge>)}
                      </div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="프로덕션 준비도 (기존 API)" title="거버넌스"
                    right={prod.data && <ApBadge tone={prod.data.governance_status.passed ? "pos" : "neg"}>{prod.data.governance_status.governance}</ApBadge>} />
                  {prod.loading && <div className="p-4"><ApSkeletonLines rows={4} /></div>}
                  {prod.data && (
                    <div className="p-4 space-y-1.5">
                      {prod.data.governance_status.checks.map((c) => (
                        <div key={c.check} className="flex items-center gap-1.5 text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                          <span className="text-[var(--c-text-1)]">{c.check}</span>
                          <span className="text-[var(--c-text-3)]">{c.detail}</span>
                        </div>
                      ))}
                      <div className="text-[11px] text-[var(--c-text-3)] pt-1">프로덕션 헬스: {prod.data.production_health.overall_severity}</div>
                    </div>
                  )}
                </ApPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ApPanel>
                    <ApPanelHead kicker="에이전트 협의회 (기존 API)" title="협의회 / 승인" right={agents.data && <ApBadge tone="neg">라이브 집행: {agents.data.live_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                    <div className="p-4 space-y-2">
                      {agents.loading && <ApSkeletonLines rows={3} />}
                      {agents.data && <AgentTree node={agents.data.council} />}
                      {council.data && (
                        <div className="pt-2 border-t border-[var(--c-border)] space-y-1">
                          <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">최근 결정</div>
                          {council.data.decisions.slice(0, 5).map((d, i) => (
                            <div key={i} className="text-[11px] c-num text-[var(--c-text-3)] truncate">{JSON.stringify(d)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ApPanel>

                  <ApPanel>
                    <ApPanelHead kicker="시스템 로그 (기존 API)" title="감사 로그" right={logs.data && <ApBadge tone="mute">{logs.data.count}건</ApBadge>} />
                    <div className="p-4 space-y-1">
                      {logs.loading && <ApSkeletonLines rows={5} />}
                      {logs.data && logs.data.logs.slice(0, 10).map((l, i) => (
                        <div key={i} className="text-[11px] c-num text-[var(--c-text-3)] truncate border-b border-[var(--c-border)] last:border-0 py-0.5">{JSON.stringify(l)}</div>
                      ))}
                    </div>
                  </ApPanel>
                </div>

                {/* Separation invariants — 미션 핵심 */}
                <ApPanel>
                  <ApPanelHead kicker="아키텍처 분리" title="Research OS ⟂ Investment OS ⟂ Execution"
                    right={sep && <ApBadge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</ApBadge>} />
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                    {(sep?.invariants ?? []).map((i) => (
                      <div key={i.check} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: i.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                        <span className="text-[11px] text-[var(--c-text-1)]">{i.check}</span>
                      </div>
                    ))}
                  </div>
                </ApPanel>
              </div>
            )}

            {/* ══════════════ Tab 5 · Operations ══════════════ */}
            {tab === "ops" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/investment-os/live-agents" label="라이브 에이전트 (실시간 판단)" />
                  <TabLink href="/research-os/console" label="운영 콘솔" />
                  <TabLink href="/research-os/workflow" label="리서치 워크플로 (세션 제어)" />
                </div>

                {/* Execution ladder — 인터랙티브 승인 워크플로 */}
                <ApPanel>
                  <ApPanelHead kicker="실행 레이어 · 승인 워크플로" title="준비도 사다리"
                    right={<ApBadge tone="neg">자동 실행: {ladder?.auto_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    <div className="text-[11px] text-[var(--c-text-3)] leading-relaxed bg-[var(--c-panel-2)] px-3 py-2">
                      전략 개별이 아니라 <b>포트폴리오 전체</b>가 다음 준비도 단계로 넘어가도 되는지 보여주는 자문용 시뮬레이션입니다.
                      승인해도 새로고침하면 PAPER로 리셋되고, 실제로 바뀌는 건 없습니다(AUTO_EXECUTION은 영구 비활성).
                      특정 전략을 실제 페이퍼 운용으로 올리는 "승격"은 여기가 아니라 <Link href="/auto-research" className="text-[var(--c-hud)] hover:underline">Auto-Research</Link>의 "🚀 페이퍼로 올리기" 버튼입니다.
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {RUNGS.map((r, i) => {
                        const isAuto = r === "AUTO_EXECUTION";
                        const isCurrent = r === currentRung;
                        const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                        return (
                          <div key={r} className="flex items-center">
                            <span className={`text-[11px] px-2.5 py-1.5 border ${
                              isAuto ? "border-[var(--c-neg)] text-[var(--c-neg)] bg-[color-mix(in_srgb,var(--c-neg)_10%,transparent)] line-through"
                              : isCurrent ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_14%,transparent)] font-semibold"
                              : isPast ? "border-[color-mix(in_srgb,var(--c-pos)_40%,transparent)] text-[var(--c-pos)]"
                              : "border-[var(--c-border)] text-[var(--c-text-3)]"}`}>
                              {isAuto && "🔒 "}{isCurrent && "▶ "}{RUNG_LABEL[r] ?? r}
                            </span>
                            {i < RUNGS.length - 1 && <span className="text-[var(--c-text-3)] mx-1">›</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-[var(--c-panel-2)] p-3">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1.5">필수 게이트 (우회 불가)</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {(advResult?.gates ?? []).length > 0
                          ? advResult!.gates.map((g) => (
                            <div key={g.gate} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: g.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                              <span className="text-[11px] text-[var(--c-text-1)]">{g.gate}</span>
                            </div>))
                          : ["risk", "compliance", "portfolio", "kill_switch"].map((g) => (
                            <div key={g} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: data.gates.passed ? "var(--c-pos)" : "var(--c-warn)" }} />
                              <span className="text-[11px] text-[var(--c-text-1)]">{g}</span>
                            </div>))}
                      </div>
                    </div>

                    <div className="bg-[var(--c-panel-2)] p-3 space-y-2.5">
                      {nextIsAuto ? (
                        <div className="text-[11px] text-[var(--c-neg)] flex items-center gap-2">
                          🔒 <span>다음 단계는 <b>AUTO_EXECUTION</b> — 영구 비활성. 승인·게이트와 무관하게 전진 불가.</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-[11px] text-[var(--c-text-2)]">
                            현재 <span className="text-[var(--c-hud)] font-semibold">{RUNG_LABEL[currentRung]}</span> → 다음 <span className="text-[var(--c-text-1)] font-semibold">{RUNG_LABEL[nextRung]}</span>. 승인은 실행이 아니라 준비도 상태 전이(자문).
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}
                              className="accent-[var(--c-hud)] w-3.5 h-3.5" />
                            <span className="text-[11px] text-[var(--c-text-2)]">Risk·Compliance·Portfolio 게이트와 시나리오를 검토했으며, 이 전진을 승인합니다.</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={approveAndAdvance} disabled={!reviewed || busy}
                              className={`px-4 h-9 text-[11px] font-semibold uppercase border cursor-pointer transition-colors ${
                                reviewed && !busy ? "text-[var(--c-pos)] border-[color-mix(in_srgb,var(--c-pos)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-pos)_12%,transparent)]"
                                : "text-[var(--c-text-3)] border-[var(--c-border)] cursor-not-allowed opacity-50"}`}>
                              {busy ? "검증 중…" : `승인 & 전진 → ${RUNG_LABEL[nextRung]}`}
                            </button>
                            <button onClick={resetLadder} className="px-3 h-9 text-[11px] uppercase text-[var(--c-text-3)] border border-[var(--c-border)] cursor-pointer">페이퍼로 리셋</button>
                          </div>
                        </>
                      )}
                      {advResult && (
                        <div className={`text-[11px] ${advResult.advanced ? "text-[var(--c-pos)]" : "text-[var(--c-warn)]"}`}>
                          {advResult.advanced ? `✓ 승인됨 — ${RUNG_LABEL[advResult.new_rung]} 로 전진(게이트 통과 + 사람 승인).`
                            : `✗ 차단됨 — ${advResult.blocked_reason}`}
                        </div>
                      )}
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">승인 로그 (이번 세션)</div>
                        {history.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] c-num text-[var(--c-text-3)]">
                            <span className="w-16">{h.ts}</span>
                            <ApBadge tone={h.advanced ? "pos" : "neg"}>{h.advanced ? "전진함" : "차단됨"}</ApBadge>
                            <span>{RUNG_LABEL[h.from]} → {RUNG_LABEL[h.to]}</span>
                            {!h.advanced && <span className="text-[var(--c-warn)] truncate">{h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-[var(--c-text-3)]">
                      각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-[var(--c-neg)]">AUTO_EXECUTION 은 영구 비활성 — 승인·게이트와 무관하게 차단.</span> 승인은 주문/실행이 아니라 준비도 상태 전이(자문). Kill switch 시 전부 페이퍼 강제.
                    </div>
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="파이프라인 상태" title="파이프라인 모니터" />
                  {monitor.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                  {monitor.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {monitor.data.stages.map((s) => (
                          <div key={s.key} className="bg-[var(--c-panel-2)] p-2">
                            <div className="text-[9px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">{s.label}</div>
                            <div className="text-[13px] c-num text-[var(--c-text-1)]">{s.count}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-[var(--c-text-3)]">제안 {monitor.data.proposals} · 승인 {monitor.data.approvals} · 익스포저 {monitor.data.capital.exposure_pct}%</div>
                    </div>
                  )}
                </ApPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ApPanel>
                    <ApPanelHead kicker="주문 내역" title="주문" />
                    {orders.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                    {orders.data && (
                      <div className="p-4 space-y-1 text-[11px] text-[var(--c-text-2)]">
                        <div>라이프사이클 이벤트: <span className="c-num text-[var(--c-text-1)]">{orders.data.lifecycle_events}</span></div>
                        <div>요청 {orders.data.requests.length} · 응답 {orders.data.responses.length}</div>
                        <div className="text-[11px] text-[var(--c-text-3)]">{orders.data.note}</div>
                      </div>
                    )}
                  </ApPanel>

                  <ApPanel>
                    <ApPanelHead kicker="라이브 데이터" title="라이브 데이터 소스"
                      right={live.data && <ApBadge tone={live.data.data_health.overall_status === "ok" ? "pos" : "warn"} title={live.data.data_health.overall_status}>{DATA_HEALTH_LABEL[live.data.data_health.overall_status] ?? live.data.data_health.overall_status}</ApBadge>} />
                    {live.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                    {live.data && (
                      <div className="p-4 space-y-1 text-[11px] text-[var(--c-text-2)]">
                        <div>소스 {live.data.data_sources.available_count}/{live.data.data_sources.count}개 사용 가능</div>
                        <div>이슈: {live.data.data_health.issue_count}</div>
                      </div>
                    )}
                  </ApPanel>
                </div>
              </div>
            )}

            <div className="text-[11px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>

    <div className="md:hidden min-h-full bg-ap-bg">
      <div className="sticky top-0 z-10 bg-ap-bg/90 backdrop-blur border-b border-ap-line px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ap-ink-1">Investment OS</span>
        <div className="flex gap-1.5">
          {sep && <ApBadge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</ApBadge>}
          <ApBadge tone="neg">AUTO-EXEC OFF</ApBadge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          <ApBadge tone="pos">연구=생산 · 투자=소비</ApBadge>
          <ApBadge tone="pos">Research OS 무변경</ApBadge>
          <ApBadge tone="neg">AUTO_EXECUTION 영구 OFF</ApBadge>
          <ApBadge tone="warn">사람 승인 필수</ApBadge>
          <ApBadge tone="warn">Risk/Compliance/Portfolio/Kill 우회 불가</ApBadge>
          <ApBadge tone="mute">모두 추천/시뮬레이션 · 실행 없음</ApBadge>
        </div>

        {!data && !err && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
            </div>
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
              {TABS.map((t) => (
                <div key={t.key} className="shrink-0 px-3 h-8 rounded-ap-md border border-ap-line flex items-center">
                  <ApSkeleton className="h-2.5 w-14" />
                </div>
              ))}
            </div>
            <ApPanel>
              <div className="px-4 h-10 border-b border-ap-line flex items-center"><ApSkeleton className="h-2.5 w-32" /></div>
              <div className="p-4"><ApSkeletonLines rows={4} /></div>
            </ApPanel>
          </div>
        )}

        {data && (
          <>
            {tab !== "risk" && (
              <div className="grid grid-cols-2 gap-3">
                <ApStatTile label="소비된 리서치" value={String(data.knowledge.consumed_candidates)} sub={`리서치 원본 변경: ${data.knowledge.research_os_modified ? "있음" : "없음"}`} tone="hud" />
                <ApStatTile label="포트폴리오 포지션" value={String(Object.keys(weights).length)} sub={PORTFOLIO_METHOD_LABEL[data.portfolio.method] ?? data.portfolio.method} tone="pos" />
                <ApStatTile label="컴플라이언스" value={data.compliance.compliant ? "통과" : "실패"} sub={`사람 개입: ${data.compliance.human_can_override ? "가능" : "불가"}`} tone={data.compliance.compliant ? "pos" : "neg"} />
                <ApStatTile label="필수 게이트" value={data.gates.passed ? "통과" : "차단"} sub={`우회: ${data.gates.bypass_possible ? "가능" : "불가"}`} tone={data.gates.passed ? "pos" : "warn"} />
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`shrink-0 px-3 h-11 rounded-ap-md text-xs font-semibold whitespace-nowrap border transition-colors ${
                    tab === t.key ? "bg-ap-brand text-white border-ap-brand" : "bg-ap-surface text-ap-ink-2 border-ap-line"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="월간 리뷰" title="월간 의사결정 루프" right={<ApBadge tone="mute">제안 라벨</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {monthly.loading && <ApSkeletonLines rows={3} />}
                    {monthly.data && monthly.data.strategies.length === 0 && (
                      <div className="text-xs text-ap-ink-3">추적 대상 전략 없음.</div>
                    )}
                    {(monthly.data?.strategies ?? []).map((s) => {
                      const dr = s.decision_required ?? {};
                      const tone = DECISION_TONE[dr.suggested_label ?? ""] ?? "mute";
                      return (
                        <div key={s.strategy_id} className="bg-ap-bg rounded-ap-md p-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-ap-ink-1 font-semibold truncate">{s.strategy_id}</div>
                            <div className="text-xs text-ap-ink-3 truncate">{dr.reason}</div>
                          </div>
                          <ApBadge tone={tone}>{dr.suggested_label ?? "—"}</ApBadge>
                        </div>
                      );
                    })}
                    {monthly.data?.prediction_integrity && (
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <ApStatTile label="유효" value={String(monthly.data.prediction_integrity.valid)} tone="pos" />
                        <ApStatTile label="레거시" value={String(monthly.data.prediction_integrity.legacy_capture)} tone="ink-1" />
                        <ApStatTile label="무효화" value={String(monthly.data.prediction_integrity.invalidated)} tone="neg" />
                        <ApStatTile label="재포착 필요" value={String(monthly.data.prediction_integrity.recapture_required)} tone="warn" />
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="연구 조직 현황" title="시스템 헬스" />
                  {org.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {org.err && <div className="p-4 text-xs text-ap-down">{org.err}</div>}
                  {org.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ApBadge tone={org.data.operational_status.operational ? "pos" : "warn"}>{org.data.operational_status.operational ? "가동 중" : "검토 필요"}</ApBadge>
                        <ApBadge tone="mute">지식 헬스: {GRADE_LABEL[org.data.knowledge_health.grade] ?? org.data.knowledge_health.grade}</ApBadge>
                        {org.data.strategy_health.review_needed_count > 0 && <ApBadge tone="warn">review 필요 {org.data.strategy_health.review_needed_count}</ApBadge>}
                      </div>
                      {org.data.strategy_health.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-xs">
                          <span className="text-ap-ink-1">{s.strategy}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-data text-ap-ink-2">{s.health_score}</span>
                            <ApBadge tone={s.review_needed ? "warn" : "pos"}>{GRADE_LABEL[s.grade] ?? s.grade}</ApBadge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="포트폴리오 구성" title="추천 비중" right={<ApBadge tone="mute">추천 · 실배분 아님</ApBadge>} />
                  <div className="p-4 space-y-2">
                    {Object.entries(weights).length === 0 && <div className="text-xs text-ap-ink-3">소비할 연구 후보 없음 — 지식 축적 필요.</div>}
                    {Object.entries(weights).map(([sid, w]) => (
                      <div key={sid} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ap-ink-1 truncate">{sid}</span>
                          <span className="font-data text-ap-ink-3">{(w * 100).toFixed(1)}% · {(sizes[sid] ?? 0).toLocaleString()}</span>
                        </div>
                        <ApMeter value={w} tone="hud" />
                      </div>
                    ))}
                    <div className="text-[11px] text-ap-ink-3 pt-1">우측 수치 = 포지션 사이징 추천(명목가치 100만 기준). 자본 배분/집행 아님.</div>
                    {alloc.data && (alloc.data.derived_proposal?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-ap-line space-y-1">
                        <div className="text-[11px] tracking-[0.2em] text-ap-ink-3 uppercase">배분 파생 제안</div>
                        {alloc.data.derived_proposal!.map((a) => (
                          <div key={a.strategy_id} className="flex items-center justify-between text-xs">
                            <span className="text-ap-ink-2 truncate">{a.name} · {a.factor}</span>
                            <span className="font-data text-ap-ink-3">{(a.target_weight * 100).toFixed(1)}% · {STATUS_LABEL[a.status] ?? a.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="보유 포지션" title="포지션" right={positions.data && <ApBadge tone="mute">{positions.data.count}건</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {positions.loading && <ApSkeletonLines rows={4} />}
                    {positions.data && positions.data.count === 0 && <div className="text-xs text-ap-ink-3">{positions.data.note}</div>}
                    {positions.data && positions.data.positions.slice(0, 8).map((p, i) => (
                      <div key={i} className="text-xs font-data text-ap-ink-2 border-b border-ap-line last:border-0 py-1.5 space-y-0.5">
                        {Object.entries(p).slice(0, 5).map(([k, v]) => <div key={k}>{POSITION_FIELD_LABEL[k] ?? k}: {String(v)}</div>)}
                      </div>
                    ))}
                  </div>
                </ApPanel>
              </div>
            )}

            {tab === "strategy" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="포워드 러닝 검증" title="전략별 검증 상태" right={<ApBadge tone="mute">조인 · 새 원장 없음</ApBadge>} />
                  <div className="p-4 space-y-3">
                    {sideLoading && <ApSkeletonLines rows={4} />}
                    {!sideLoading && acct && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[11px] tracking-[0.2em] text-ap-brand uppercase">엣지 스코어</span>
                        {acct.edge_score.status === "PROVISIONAL"
                          ? <ApBadge tone="mute">미확정 — {acct.edge_score.graded_scorable ?? 0}/{acct.edge_score.needed ?? 20} 채점됨</ApBadge>
                          : <ApBadge tone="pos">계산됨 — {acct.edge_score.graded_scorable ?? 0} 채점됨</ApBadge>}
                        {conn && (
                          <ApBadge tone={conn.validation_score.status === "PROVISIONAL" ? "mute" : "pos"}>
                            검증 스코어: {SCORE_STATUS_LABEL[conn.validation_score.status ?? ""] ?? conn.validation_score.status}
                          </ApBadge>
                        )}
                      </div>
                    )}
                    {fwd && fwd.count === 0 && <div className="text-xs text-ap-ink-3">추적 대상(paper_active/watchlist/paper_candidate) 전략 없음.</div>}
                    {(fwd?.records ?? []).map((r) => {
                      const eq = evidenceQuality(r); const fp = forwardProgress(r); const rs = riskState(r);
                      return (
                        <div key={r.strategy_id} className="bg-ap-bg rounded-ap-md p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs text-ap-ink-1 font-semibold">{r.strategy_id}</span>
                            <ApBadge tone="hud">{STATUS_LABEL[r.validation_status ?? ""] ?? r.validation_status ?? "—"}</ApBadge>
                          </div>
                          {r.thesis && <div className="text-xs text-ap-ink-2">{r.thesis}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            <ApBadge tone={eq.tone}>근거: {eq.label}</ApBadge>
                            <ApBadge tone={fp.tone}>포워드: {fp.label}</ApBadge>
                            <ApBadge tone={rs.tone}>리스크: {rs.label}</ApBadge>
                            {!r.prediction_captured && <ApBadge tone="warn">가설 사전등록 안 됨</ApBadge>}
                          </div>
                          {(r.next_possible?.length ?? 0) > 0 && (
                            <div className="text-xs text-ap-ink-3">
                              다음 가능 상태: {r.next_possible!.map((s) => STATUS_LABEL[s] ?? s).join(", ")}
                              {(r.human_approval_required_next?.length ?? 0) > 0 &&
                                <span className="text-ap-caution"> · 사람 승인 필요: {r.human_approval_required_next!.map((s) => STATUS_LABEL[s] ?? s).join(", ")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {fwd && (
                      <div className="text-xs text-ap-ink-3 pt-1">
                        커버리지 갭: 가설 없음 {fwd.coverage_gaps.missing_thesis} ·
                        가설 사전등록 안 됨 {fwd.coverage_gaps.missing_prediction_capture} ·
                        포워드 데이터 없음 {fwd.coverage_gaps.missing_forward_data} / {fwd.count}
                      </div>
                    )}
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="검증 루프" title="라이프사이클 보드"
                    right={valLoop.data && <ApBadge tone={valLoop.data.loop_status.release_ready ? "pos" : "mute"}>{valLoop.data.loop_status.release_ready ? "출시 준비 완료" : "진행 중"}</ApBadge>} />
                  {valLoop.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {valLoop.data && (
                    <div className="p-4 space-y-1.5">
                      {valLoop.data.lifecycle_board.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-xs">
                          <span className="text-ap-ink-1">{s.strategy}</span>
                          <ApBadge tone="hud">{s.current_state}</ApBadge>
                        </div>
                      ))}
                      <div className="pt-1.5 flex items-center gap-2 text-xs text-ap-ink-3">
                        <span>품질: {valLoop.data.quality_panel.quality_score ?? "—"} ({valLoop.data.quality_panel.grade})</span>
                        {valLoop.data.validation_panel.divergence_detected && <ApBadge tone="warn">편차 감지됨</ApBadge>}
                      </div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="검증" title="검증 게이트" />
                  {val.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {val.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{val.data.gates.map((g) => <ApBadge key={g} tone="mute">{GATE_LABEL[g] ?? g}</ApBadge>)}</div>
                      <div className="text-xs text-ap-ink-3">레드팀 n={val.data.redteam.n} · 사람 동의={val.data.redteam.human_redteam_agree ?? "—"}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-ap-ink-2">
                        {Object.entries(val.data.experiment_status).map(([k, v]) => <span key={k} className="font-data">{EXPERIMENT_STATUS_LABEL[k] ?? k}: {v}</span>)}
                      </div>
                    </div>
                  )}
                </ApPanel>
              </div>
            )}

            {tab === "research" && (
              <div className="space-y-4">
                <ApPanel>
                  <ApPanelHead kicker="시장 현황" title="마켓 / 리서치 인텔리전스" right={market.data && <ApBadge tone="hud">{market.data.market_state.regime}</ApBadge>} />
                  {market.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {market.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{market.data.market_state.labels.map((l) => <ApBadge key={l} tone="mute">{l}</ApBadge>)}</div>
                      {market.data.top_opportunities.map((o, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ap-ink-1 truncate">{o.name} <span className="text-ap-ink-3">· {o.kind}</span></span>
                          <span className="font-data text-ap-ink-3 shrink-0">{o.confidence} · 기대값 {o.expected_value}</span>
                        </div>
                      ))}
                      <div className="text-xs text-ap-ink-3">헬스 스코어 {market.data.health_score} · 상위 리스크 {market.data.risk.top_category ?? "—"}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="기관 데이터" title="기관 인텔리전스" right={inst.data && <ApBadge tone="mute">{inst.data.data_production_health.overall_status}</ApBadge>} />
                  {inst.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {inst.data && (
                    <div className="p-4 space-y-1.5 text-xs text-ap-ink-2">
                      <div>데이터 품질 평균: <span className="font-data text-ap-ink-1">{inst.data.data_production_health.average_quality}</span></div>
                      <div>섹터: {inst.data.sector_intelligence.sector} — {inst.data.sector_intelligence.key_entities.join(", ")}</div>
                      <div>매크로 상태: {inst.data.macro_context.macro_state}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="예측 데이터 연결" title="예측 커버리지" />
                  {sideLoading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {!sideLoading && conn && (
                    <div className="p-4 space-y-1.5 text-xs text-ap-ink-2">
                      <div>총 예측 수: <span className="font-data text-ap-ink-1">{conn.prediction_coverage.total ?? 0}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(conn.prediction_coverage.by_source ?? {}).map(([k, v]) => <ApBadge key={k} tone="mute">{PREDICTION_SOURCE_LABEL[k] ?? k}: {v}</ApBadge>)}
                      </div>
                      <div>무효화 조건 누락: {conn.prediction_coverage.missing_invalidation_pct ?? "—"}% · 기간(호라이즌) 누락: {conn.prediction_coverage.missing_horizon_pct ?? "—"}%</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="실시간 재무제표" title="재무제표 실측 조회" />
                  <div className="p-4 space-y-3">
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runFinLookup(); }}>
                      <input
                        className="flex-1 min-w-0 bg-ap-bg border border-ap-line text-ap-ink-1 text-[13px] px-3 py-2 rounded-ap-md"
                        placeholder="종목코드 (예: AAPL, 005930)"
                        value={finQuery}
                        onChange={(e) => setFinQuery(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={finLoading || !finQuery.trim()}
                        className="bg-ap-brand text-white text-[13px] font-semibold px-4 py-2 rounded-ap-md disabled:opacity-50 shrink-0"
                      >
                        {finLoading ? "조회 중…" : "조회"}
                      </button>
                    </form>
                    {finErr && <div className="text-xs text-ap-down">조회 실패: {finErr}</div>}
                    {finLoading && (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}
                      </div>
                    )}
                    {finData && (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(finData)
                          .filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined)
                          .map(([k, v]) => (
                            <ApStatTile key={k} label={FINANCIALS_FIELD_LABEL[k] ?? k} value={typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)} tone="hud" />
                          ))}
                      </div>
                    )}
                    {finData && Object.entries(finData).filter(([k, v]) => !["symbol", "code"].includes(k) && v !== null && v !== undefined).length === 0 && (
                      <div className="text-xs text-ap-ink-3">데이터 없음</div>
                    )}
                  </div>
                </ApPanel>
              </div>
            )}

            {tab === "risk" && (() => {
              const liveOn = agents.data?.live_execution_enabled ?? false;
              const govFail = prod.data && !prod.data.governance_status.passed;
              const budgetOver = data.risk_budget && !data.risk_budget.within_budget;
              const sepBroken = sep && !sep.separated;
              const hasWarning = govFail || budgetOver || sepBroken;
              return (
                <div className="space-y-5">
                  <ApLightHero
                    label="집행 상태"
                    value={agents.data ? (liveOn ? "라이브 집행 중" : "집행 대기") : "—"}
                    valueCls={liveOn ? "text-ap-up" : "text-ap-ink-3"}
                    sub={`게이트 ${data.gates.passed ? "통과" : "차단"} · 컴플라이언스 ${data.compliance.compliant ? "통과" : "실패"}`}
                  />

                  {hasWarning && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-ap-lg border border-ap-down/50 bg-ap-down/10">
                      <span className="w-2 h-2 mt-1 rounded-full bg-ap-down shrink-0" />
                      <div className="text-xs text-ap-down space-y-0.5">
                        {govFail && <div>거버넌스 실패: {prod.data!.governance_status.checks.filter(c => !c.ok).map(c => c.check).join(", ")}</div>}
                        {budgetOver && <div>리스크 예산 한도 초과 — {data.risk_budget.summary}</div>}
                        {sepBroken && <div>아키텍처 분리 위반 — 검토 필요</div>}
                      </div>
                    </div>
                  )}

                  <ApPanel>
                    <ApPanelHead kicker="에이전트 협의회" title="협의회" />
                    <div className="p-4">
                      {agents.loading && <ApSkeletonLines rows={3} />}
                      {agents.data && <AgentTree node={agents.data.council} tone="ap" />}
                    </div>
                  </ApPanel>

                  <button onClick={() => setShowDetail(true)}
                    className="w-full flex items-center justify-between py-2 border-0 bg-transparent active:opacity-60">
                    <span className="text-xs text-ap-ink-3">상세 지표 보기</span>
                    <span className="text-ap-ink-3">›</span>
                  </button>

                  <ApBottomSheet open={showDetail} onClose={() => setShowDetail(false)} title="상세 지표">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <ApStatTile label="최대비중" value={`${((data.exposure.max_weight ?? 0) * 100).toFixed(0)}%`} />
                        <ApStatTile label="포지션" value={data.exposure.n_positions ?? 0} />
                        <ApStatTile label="쏠림 지수(HHI)" value={(data.exposure.herfindahl ?? 0).toFixed(2)} />
                      </div>
                      {riskGov.data && (
                        <div className="text-xs text-ap-ink-2">자율성 레벨 {riskGov.data.autonomy.level} · 실행 리스크 이벤트 {riskGov.data.execution_risk_events}</div>
                      )}
                      {prod.data && (
                        <div className="space-y-1.5">
                          {prod.data.governance_status.checks.map((c) => (
                            <div key={c.check} className="flex items-center gap-1.5 text-xs">
                              <ApDot tone={c.ok ? "pos" : "neg"} />
                              <span className="text-ap-ink-1">{c.check}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ApBottomSheet>
                </div>
              );
            })()}

            {tab === "ops" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Link href="/investment-os/live-agents" className="text-xs text-ap-brand hover:underline">
                    라이브 에이전트 (실시간 판단) →
                  </Link>
                </div>
                <ApPanel>
                  <ApPanelHead kicker="실행 레이어 · 승인 워크플로" title="준비도 사다리" right={<ApBadge tone="neg">자동 실행: {ladder?.auto_execution_enabled ? "켜짐" : "꺼짐"}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    <p className="text-[10px] text-ap-ink-3">포트폴리오 시뮬레이션(자문용) — 새로고침하면 리셋, 실제 상태 아님</p>
                    <div className="text-xs text-ap-ink-2 leading-relaxed bg-ap-bg rounded-ap-md px-3 py-2">
                      전략 개별이 아니라 <b>포트폴리오 전체</b>가 다음 준비도 단계로 넘어가도 되는지 보여주는 자문용 시뮬레이션입니다.
                      승인해도 새로고침하면 PAPER로 리셋되고, 실제로 바뀌는 건 없습니다(AUTO_EXECUTION은 영구 비활성).
                      특정 전략을 실제 페이퍼 운용으로 올리는 "승격"은 여기가 아니라 <span className="text-ap-ink-1 font-semibold">Auto-Research</span>의 "🚀 페이퍼로 올리기" 버튼입니다.
                    </div>
                    <div className="flex">
                      {RUNGS.map((r) => {
                        const isAuto = r === "AUTO_EXECUTION";
                        const isCurrent = r === currentRung;
                        const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                        return (
                          <ApGateStep key={r} label={RUNG_LABEL[r] ?? r}
                            value={isAuto ? "🔒 잠김" : isCurrent ? "▶ 현재" : isPast ? "완료" : "대기"}
                            state={isAuto ? "blocked" : isCurrent ? "current" : isPast ? "done" : "pending"} />
                        );
                      })}
                    </div>

                    <div className="bg-ap-bg rounded-ap-md p-3">
                      <div className="text-[11px] tracking-[0.2em] text-ap-brand uppercase mb-1.5">필수 게이트 (우회 불가)</div>
                      <div className="grid grid-cols-2 gap-2">
                        {(advResult?.gates ?? []).length > 0
                          ? advResult!.gates.map((g) => (
                            <div key={g.gate} className="flex items-center gap-1.5">
                              <ApDot tone={g.ok ? "pos" : "neg"} />
                              <span className="text-xs text-ap-ink-1">{g.gate}</span>
                            </div>))
                          : ["risk", "compliance", "portfolio", "kill_switch"].map((g) => (
                            <div key={g} className="flex items-center gap-1.5">
                              <ApDot tone={data.gates.passed ? "pos" : "warn"} />
                              <span className="text-xs text-ap-ink-1">{g}</span>
                            </div>))}
                      </div>
                    </div>

                    <div className="bg-ap-bg rounded-ap-md p-3 space-y-2.5">
                      {nextIsAuto ? (
                        <div className="text-xs text-ap-down flex items-center gap-2">
                          🔒 <span>다음 단계는 <b>AUTO_EXECUTION</b> — 영구 비활성. 승인·게이트와 무관하게 전진 불가.</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-ap-ink-2">
                            현재 <span className="text-ap-brand font-semibold">{RUNG_LABEL[currentRung]}</span> → 다음 <span className="text-ap-ink-1 font-semibold">{RUNG_LABEL[nextRung]}</span>. 승인은 실행이 아니라 준비도 상태 전이(자문).
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="accent-ap-brand w-4 h-4" />
                            <span className="text-xs text-ap-ink-2">Risk·Compliance·Portfolio 게이트와 시나리오를 검토했으며, 이 전진을 승인합니다.</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={approveAndAdvance} disabled={!reviewed || busy}
                              className={`px-4 h-11 rounded-ap-md text-xs font-semibold uppercase border ${
                                reviewed && !busy ? "text-ap-up border-ap-up bg-ap-up/10" : "text-ap-ink-3 border-ap-line opacity-50"}`}>
                              {busy ? "검증 중…" : `승인 & 전진 → ${RUNG_LABEL[nextRung]}`}
                            </button>
                            <button onClick={resetLadder} className="px-3 h-11 rounded-ap-md text-xs uppercase text-ap-ink-3 border border-ap-line">페이퍼로 리셋</button>
                          </div>
                        </>
                      )}
                      {advResult && (
                        <div className={`text-xs ${advResult.advanced ? "text-ap-up" : "text-ap-caution"}`}>
                          {advResult.advanced ? `✓ 승인됨 — ${RUNG_LABEL[advResult.new_rung]} 로 전진(게이트 통과 + 사람 승인).`
                            : `✗ 차단됨 — ${advResult.blocked_reason}`}
                        </div>
                      )}
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] tracking-[0.2em] text-ap-ink-3 uppercase">승인 로그 (이번 세션)</div>
                        {history.map((h, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 text-xs font-data text-ap-ink-3">
                            <span>{h.ts}</span>
                            <ApBadge tone={h.advanced ? "pos" : "neg"}>{h.advanced ? "전진함" : "차단됨"}</ApBadge>
                            <span>{RUNG_LABEL[h.from]} → {RUNG_LABEL[h.to]}</span>
                            {!h.advanced && <span className="text-ap-caution truncate">{h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-ap-ink-3">
                      각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-ap-down">AUTO_EXECUTION 은 영구 비활성.</span> Kill switch 시 전부 페이퍼 강제.
                    </div>
                  </div>
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="파이프라인 상태" title="파이프라인 모니터" />
                  {monitor.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                  {monitor.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        {monitor.data.stages.map((s) => (
                          <div key={s.key} className="bg-ap-bg rounded-ap-md p-2">
                            <div className="text-[11px] tracking-[0.15em] text-ap-ink-3 uppercase">{s.label}</div>
                            <div className="text-[13px] font-data text-ap-ink-1">{s.count}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-ap-ink-3">제안 {monitor.data.proposals} · 승인 {monitor.data.approvals} · 익스포저 {monitor.data.capital.exposure_pct}%</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="주문 내역" title="주문" />
                  {orders.loading && <div className="p-4"><ApSkeletonLines rows={3} /></div>}
                  {orders.data && (
                    <div className="p-4 space-y-1 text-xs text-ap-ink-2">
                      <div>라이프사이클 이벤트: <span className="font-data text-ap-ink-1">{orders.data.lifecycle_events}</span></div>
                      <div>요청 {orders.data.requests.length} · 응답 {orders.data.responses.length}</div>
                      <div className="text-ap-ink-3">{orders.data.note}</div>
                    </div>
                  )}
                </ApPanel>

                <ApPanel>
                  <ApPanelHead kicker="라이브 데이터" title="라이브 데이터 소스" right={live.data && <ApBadge tone={live.data.data_health.overall_status === "ok" ? "pos" : "warn"}>{DATA_HEALTH_LABEL[live.data.data_health.overall_status] ?? live.data.data_health.overall_status}</ApBadge>} />
                  {live.loading && <div className="p-4"><ApSkeletonLines rows={2} /></div>}
                  {live.data && (
                    <div className="p-4 space-y-1 text-xs text-ap-ink-2">
                      <div>소스 {live.data.data_sources.available_count}/{live.data.data_sources.count}개 사용 가능</div>
                      <div>이슈: {live.data.data_health.issue_count}</div>
                    </div>
                  )}
                </ApPanel>
              </div>
            )}

            <div className="text-xs text-ap-ink-3 leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
    </>
  );
}

export default function InvestmentOs() {
  return <Suspense><InvestmentOsInner /></Suspense>;
}
