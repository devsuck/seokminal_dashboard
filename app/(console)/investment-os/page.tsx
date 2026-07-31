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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getInvestmentOs, advanceLadder, getForwardLearning, getDataConnection, getResearchAccountability,
  getResearchOrganization, getAllocation, getPositions,
  getValidationLoop, getValidation,
  getMarketCockpit, getInstitutionalIntelligence,
  getRisk, getProductionReadiness, getAgents, getConsoleCouncil, getLogs,
  getMonitor, getOrders, getLiveIntelligence, getMonthlyReview,
  type InvestmentOsResp, type LadderAdvanceResp, type ForwardLearningResp, type ForwardLearningRecord,
  type MonthlyReviewResp,
  type DataConnectionResp, type ResearchAccountabilityResp,
  type ResearchOrganizationResp, type AllocationResp, type PositionsResp,
  type ValidationLoopResp, type ValidationResp,
  type MarketCockpitResp, type InstitutionalIntelligenceResp,
  type RiskResp, type ProductionReadinessResp, type AgentsResp, type ConsoleCouncil, type LogsResp,
  type MonitorResp, type OrdersResp, type LiveIntelligenceResp,
} from "@/lib/console-api";
import { PageHeader, AgentTree } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const RUNG_LABEL: Record<string, string> = {
  PAPER: "페이퍼", SHADOW: "섀도우", SMALL_CAPITAL: "스몰 캐피탈",
  PRODUCTION_CANDIDATE: "프로덕션 후보", AUTO_EXECUTION: "자동 실행",
};
const RUNGS = ["PAPER", "SHADOW", "SMALL_CAPITAL", "PRODUCTION_CANDIDATE", "AUTO_EXECUTION"];
interface ApprovalEntry { from: string; to: string; approved: boolean; advanced: boolean; reason: string | null; ts: string }

const STATUS_LABEL: Record<string, string> = {
  paper_active: "페이퍼 운용중", paper_candidate: "페이퍼 후보",
  paper_candidate_forward_test_required: "페이퍼 후보 · Forward 테스트 필요", watchlist: "워치리스트",
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
function useTabFetch<T>(active: boolean, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetcher().then(setData).catch((e) => setErr((e as Error).message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { data, err, loading };
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
    <Link href={href} className="text-[10px] text-[var(--c-hud)] hover:underline no-underline whitespace-nowrap">
      {label} ↗
    </Link>
  );
}

export default function InvestmentOs() {
  const [data, setData] = useState<InvestmentOsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
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

  const run = useCallback(async () => {
    setErr(null);
    try { setData(await getInvestmentOs()); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run(); }, [run]);
  useEffect(() => {
    getForwardLearning().then(setFwd).catch(() => {});
    getDataConnection().then(setConn).catch(() => {});
    getResearchAccountability().then(setAcct).catch(() => {});
  }, []);

  // STEP4-D 병합 섹션 — 탭 활성화 시 lazy fetch, 기존 API 그대로 재사용
  const monthly = useTabFetch<MonthlyReviewResp>(tab === "overview", () => getMonthlyReview());
  const org = useTabFetch<ResearchOrganizationResp>(tab === "overview", () => getResearchOrganization());
  const alloc = useTabFetch<AllocationResp>(tab === "overview", () => getAllocation());
  const positions = useTabFetch<PositionsResp>(tab === "overview", () => getPositions());
  const valLoop = useTabFetch<ValidationLoopResp>(tab === "strategy", () => getValidationLoop());
  const val = useTabFetch<ValidationResp>(tab === "strategy", () => getValidation());
  const market = useTabFetch<MarketCockpitResp>(tab === "research", () => getMarketCockpit());
  const inst = useTabFetch<InstitutionalIntelligenceResp>(tab === "research", () => getInstitutionalIntelligence());
  const riskGov = useTabFetch<RiskResp>(tab === "risk", () => getRisk());
  const prod = useTabFetch<ProductionReadinessResp>(tab === "risk", () => getProductionReadiness());
  const agents = useTabFetch<AgentsResp>(tab === "risk", () => getAgents());
  const council = useTabFetch<ConsoleCouncil>(tab === "risk", () => getConsoleCouncil(40));
  const logs = useTabFetch<LogsResp>(tab === "risk", () => getLogs(80));
  const monitor = useTabFetch<MonitorResp>(tab === "ops", () => getMonitor());
  const orders = useTabFetch<OrdersResp>(tab === "ops", () => getOrders());
  const live = useTabFetch<LiveIntelligenceResp>(tab === "ops", () => getLiveIntelligence());

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
    <div className="min-h-full">
      <PageHeader kicker="Investment OS · 분리 계층" title="Investment OS"
        right={<div className="flex gap-1.5">
          {sep && <Badge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</Badge>}
          <Badge tone="neg">AUTO-EXEC OFF</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {/* Safety banner — 미션 핵심, 탭과 무관하게 항상 표시 */}
        <div className="c-panel-2 p-3 flex flex-wrap items-center gap-2 text-[10.5px]">
          <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">보장 사항</span>
          <Badge tone="pos">연구=생산 · 투자=소비</Badge>
          <Badge tone="pos">Research OS 무변경</Badge>
          <Badge tone="neg">AUTO_EXECUTION 영구 OFF</Badge>
          <Badge tone="warn">사람 승인 필수</Badge>
          <Badge tone="warn">Risk/Compliance/Portfolio/Kill 우회 불가</Badge>
          <Badge tone="mute">모두 추천/시뮬레이션 · 실행 없음</Badge>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="소비된 리서치" value={String(data.knowledge.consumed_candidates)} sub={`research 무변경: ${!data.knowledge.research_os_modified}`} tone="hud" />
              <StatTile label="포트폴리오 포지션" value={String(Object.keys(weights).length)} sub={data.portfolio.method} tone="pos" />
              <StatTile label="컴플라이언스" value={data.compliance.compliant ? "통과" : "실패"} sub={`override 불가: ${!data.compliance.human_can_override}`} tone={data.compliance.compliant ? "pos" : "neg"} />
              <StatTile label="필수 게이트" value={data.gates.passed ? "통과" : "차단"} sub={`bypass: ${data.gates.bypass_possible}`} tone={data.gates.passed ? "pos" : "warn"} />
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

                <Panel>
                  <PanelHead kicker="monthly-review · Phase 5-C (READ ONLY, 새 원장 없음)" title="월간 의사결정 루프"
                    right={<Badge tone="mute">제안 라벨 — 자동 결정 아님, 사람이 최종 선택</Badge>} />
                  <div className="p-4 space-y-2">
                    {monthly.loading && <div className="text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                    {monthly.data && monthly.data.strategies.length === 0 && (
                      <div className="text-[11px] text-[var(--c-text-3)]">추적 대상 전략 없음.</div>
                    )}
                    {(monthly.data?.strategies ?? []).map((s) => {
                      const dr = s.decision_required ?? {};
                      const tone = DECISION_TONE[dr.suggested_label ?? ""] ?? "mute";
                      return (
                        <div key={s.strategy_id} className="c-panel-2 p-2.5 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-[10.5px] text-[var(--c-text-1)] font-semibold">{s.strategy_id}</div>
                            <div className="text-[9.5px] text-[var(--c-text-3)] truncate">{dr.reason}</div>
                          </div>
                          <Badge tone={tone}>{dr.suggested_label ?? "—"}</Badge>
                        </div>
                      );
                    })}
                    {monthly.data?.prediction_integrity && (
                      <div className="pt-2">
                        <div className="text-[9.5px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1.5">
                          예측 무결성
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <StatTile label="유효" value={String(monthly.data.prediction_integrity.valid)} tone="pos" />
                          <StatTile label="레거시" value={String(monthly.data.prediction_integrity.legacy_capture)} tone="text-1" />
                          <StatTile label="무효화" value={String(monthly.data.prediction_integrity.invalidated)} tone="neg" />
                          <StatTile label="재포착 필요" value={String(monthly.data.prediction_integrity.recapture_required)} tone="warn" />
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
                </Panel>

                <Panel>
                  <PanelHead kicker="research-organization (기존 API)" title="시스템 헬스" />
                  {org.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {org.err && <div className="p-4 text-[11px] text-[var(--c-neg)]">{org.err}</div>}
                  {org.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={org.data.operational_status.operational ? "pos" : "warn"}>{org.data.operational_status.operational ? "가동 중" : "검토 필요"}</Badge>
                        <Badge tone="mute">지식 헬스: {org.data.knowledge_health.grade}</Badge>
                        {org.data.strategy_health.review_needed_count > 0 && <Badge tone="warn">review 필요 {org.data.strategy_health.review_needed_count}</Badge>}
                      </div>
                      {org.data.strategy_health.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[10.5px]">
                          <span className="text-[var(--c-text-1)]">{s.strategy}</span>
                          <span className="flex items-center gap-2">
                            <span className="c-num text-[var(--c-text-2)]">{s.health_score}</span>
                            <Badge tone={s.review_needed ? "warn" : "pos"}>{s.grade}</Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Panel>
                    <PanelHead kicker="포트폴리오 구성" title="추천 비중" right={<Badge tone="mute">추천 · 실배분 아님</Badge>} />
                    <div className="p-4 space-y-1.5">
                      {Object.entries(weights).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">소비할 연구 후보 없음 — 지식 축적 필요.</div>}
                      {Object.entries(weights).map(([sid, w]) => (
                        <div key={sid} className="flex items-center gap-2">
                          <span className="text-[10.5px] text-[var(--c-text-1)] w-52 truncate">{sid}</span>
                          <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w * 100}%`, background: "var(--c-hud)" }} /></div>
                          <span className="text-[10px] c-num text-[var(--c-text-3)] w-12 text-right">{(w * 100).toFixed(1)}%</span>
                          <span className="text-[9px] c-num text-[var(--c-text-3)] w-24 text-right">{(sizes[sid] ?? 0).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="text-[9px] text-[var(--c-text-3)] pt-1">우측 금액 = position sizing 추천(notional 1M 기준). 자본 배분/집행 아님.</div>
                      {alloc.data && (alloc.data.derived_proposal?.length ?? 0) > 0 && (
                        <div className="pt-2 border-t border-[var(--c-border)] space-y-1">
                          <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">배분 파생 제안</div>
                          {alloc.data.derived_proposal!.map((a) => (
                            <div key={a.strategy_id} className="flex items-center justify-between text-[10px]">
                              <span className="text-[var(--c-text-2)]">{a.name} · {a.factor}</span>
                              <span className="c-num text-[var(--c-text-3)]">{(a.target_weight * 100).toFixed(1)}% · {a.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <PanelHead kicker="/console/positions (기존 API)" title="포지션" right={positions.data && <Badge tone="mute">{positions.data.count}건</Badge>} />
                    <div className="p-4 space-y-1.5">
                      {positions.loading && <div className="text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                      {positions.data && positions.data.count === 0 && <div className="text-[11px] text-[var(--c-text-3)]">{positions.data.note}</div>}
                      {positions.data && positions.data.positions.slice(0, 8).map((p, i) => (
                        <div key={i} className="flex flex-wrap gap-x-3 text-[10px] c-num text-[var(--c-text-2)] border-b border-[var(--c-border)] last:border-0 py-1">
                          {Object.entries(p).slice(0, 5).map(([k, v]) => <span key={k}>{k}: {String(v)}</span>)}
                        </div>
                      ))}
                    </div>
                  </Panel>
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
                <Panel>
                  <PanelHead kicker="Forward Learning · STEP4 (READ ONLY, 파생 데이터)" title="전략별 검증 상태"
                    right={<Badge tone="mute">registry+experiment_registry+prediction_registry+paper.deploy 조인 · 새 원장 없음</Badge>} />
                  <div className="p-4 space-y-3">
                    {acct && (
                      <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                        <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">Edge Score</span>
                        {acct.edge_score.status === "PROVISIONAL"
                          ? <Badge tone="mute">PROVISIONAL — {acct.edge_score.graded_scorable ?? 0}/{acct.edge_score.needed ?? 20} 채점됨 (표본 부족, 랭킹 아님)</Badge>
                          : <Badge tone="pos">계산됨 — {acct.edge_score.graded_scorable ?? 0} 채점됨</Badge>}
                        {conn && (
                          <Badge tone={conn.validation_score.status === "PROVISIONAL" ? "mute" : "pos"}>
                            Validation Score: {conn.validation_score.status === "PROVISIONAL" ? "PROVISIONAL" : "계산됨"}
                          </Badge>
                        )}
                      </div>
                    )}
                    {fwd && fwd.count === 0 && <div className="text-[11px] text-[var(--c-text-3)]">추적 대상(paper_active/watchlist/paper_candidate) 전략 없음.</div>}
                    {(fwd?.records ?? []).map((r) => {
                      const eq = evidenceQuality(r); const fp = forwardProgress(r); const rs = riskState(r);
                      return (
                        <div key={r.strategy_id} className="c-panel-2 p-3 space-y-1.5">
                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                            <span className="text-[11px] text-[var(--c-text-1)] font-semibold">{r.strategy_id}</span>
                            <Badge tone="hud">{STATUS_LABEL[r.validation_status ?? ""] ?? r.validation_status ?? "—"}</Badge>
                          </div>
                          {r.thesis && <div className="text-[10.5px] text-[var(--c-text-2)]">{r.thesis}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={eq.tone}>근거: {eq.label}</Badge>
                            <Badge tone={fp.tone}>Forward: {fp.label}</Badge>
                            <Badge tone={rs.tone}>리스크: {rs.label}</Badge>
                            {!r.prediction_captured && <Badge tone="warn">Thesis 사전등록 안 됨(P201 미기록)</Badge>}
                          </div>
                          {(r.next_possible?.length ?? 0) > 0 && (
                            <div className="text-[9.5px] text-[var(--c-text-3)]">
                              다음 가능 상태: {r.next_possible!.join(", ")}
                              {(r.human_approval_required_next?.length ?? 0) > 0 &&
                                <span className="text-[var(--c-warn)]"> · 사람 승인 필요: {r.human_approval_required_next!.join(", ")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {fwd && (
                      <div className="text-[9.5px] text-[var(--c-text-3)] pt-1">
                        커버리지 갭(STEP4-C, 숨기지 않음): thesis 없음 {fwd.coverage_gaps.missing_thesis} ·
                        thesis 사전등록 안 됨 {fwd.coverage_gaps.missing_prediction_capture} ·
                        forward 데이터 없음 {fwd.coverage_gaps.missing_forward_data} / {fwd.count}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel>
                  <PanelHead kicker="validation-loop (기존 API)" title="라이프사이클 보드"
                    right={valLoop.data && <Badge tone={valLoop.data.loop_status.release_ready ? "pos" : "mute"}>{valLoop.data.loop_status.release_ready ? "출시 준비 완료" : "진행 중"}</Badge>} />
                  {valLoop.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {valLoop.data && (
                    <div className="p-4 space-y-1.5">
                      {valLoop.data.lifecycle_board.strategies.map((s) => (
                        <div key={s.strategy} className="flex items-center justify-between text-[10.5px]">
                          <span className="text-[var(--c-text-1)]">{s.strategy}</span>
                          <Badge tone="hud">{s.current_state}</Badge>
                        </div>
                      ))}
                      <div className="pt-1.5 flex items-center gap-2 text-[10px] text-[var(--c-text-3)]">
                        <span>품질: {valLoop.data.quality_panel.quality_score ?? "—"} ({valLoop.data.quality_panel.grade})</span>
                        {valLoop.data.validation_panel.divergence_detected && <Badge tone="warn">편차 감지됨</Badge>}
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead kicker="validation (기존 API)" title="검증 게이트" />
                  {val.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {val.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{val.data.gates.map((g) => <Badge key={g} tone="mute">{g}</Badge>)}</div>
                      <div className="text-[10px] text-[var(--c-text-3)]">레드팀 n={val.data.redteam.n} · 사람 동의={val.data.redteam.human_redteam_agree ?? "—"}</div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-[var(--c-text-2)]">
                        {Object.entries(val.data.experiment_status).map(([k, v]) => <span key={k} className="c-num">{k}: {v}</span>)}
                      </div>
                    </div>
                  )}
                </Panel>
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

                <Panel>
                  <PanelHead kicker="market-cockpit (기존 API)" title="마켓 / 리서치 인텔리전스"
                    right={market.data && <Badge tone="hud">{market.data.market_state.regime}</Badge>} />
                  {market.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {market.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">{market.data.market_state.labels.map((l) => <Badge key={l} tone="mute">{l}</Badge>)}</div>
                      {market.data.top_opportunities.map((o, i) => (
                        <div key={i} className="flex items-center justify-between text-[10.5px]">
                          <span className="text-[var(--c-text-1)]">{o.name} <span className="text-[var(--c-text-3)]">· {o.kind}</span></span>
                          <span className="c-num text-[var(--c-text-3)]">{o.confidence} · EV {o.expected_value}</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-[var(--c-text-3)]">헬스 스코어 {market.data.health_score} · 상위 리스크 {market.data.risk.top_category ?? "—"}</div>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead kicker="institutional-intelligence (기존 API)" title="기관 인텔리전스"
                    right={inst.data && <Badge tone="mute">{inst.data.data_production_health.overall_status}</Badge>} />
                  {inst.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {inst.data && (
                    <div className="p-4 space-y-1.5 text-[10.5px] text-[var(--c-text-2)]">
                      <div>데이터 품질 평균: <span className="c-num text-[var(--c-text-1)]">{inst.data.data_production_health.average_quality}</span></div>
                      <div>섹터: {inst.data.sector_intelligence.sector} — {inst.data.sector_intelligence.key_entities.join(", ")}</div>
                      <div>매크로 상태: {inst.data.macro_context.macro_state}</div>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead kicker="data-connection (기존 API, 재사용)" title="예측 커버리지" />
                  {conn && (
                    <div className="p-4 space-y-1.5 text-[10.5px] text-[var(--c-text-2)]">
                      <div>총 예측 수: <span className="c-num text-[var(--c-text-1)]">{conn.prediction_coverage.total ?? 0}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(conn.prediction_coverage.by_source ?? {}).map(([k, v]) => <Badge key={k} tone="mute">{k}: {v}</Badge>)}
                      </div>
                      <div>Invalidation 누락: {conn.prediction_coverage.missing_invalidation_pct ?? "—"}% · Horizon 누락: {conn.prediction_coverage.missing_horizon_pct ?? "—"}%</div>
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {/* ══════════════ Tab 4 · Risk & Governance ══════════════ */}
            {tab === "risk" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/research-os/committee" label="투자 위원회" />
                  <TabLink href="/research-os/production" label="위원회 & 프로덕션 (전체)" />
                </div>

                <Panel>
                  <PanelHead kicker="리스크 & 시나리오" title="예산 · 스트레스" right={data?.risk_budget && <Badge tone={data.risk_budget.within_budget ? "pos" : "warn"}>{data.risk_budget.within_budget ? "예산 내" : "한도 초과"}</Badge>} />
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">최대 비중</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{((data.exposure.max_weight ?? 0) * 100).toFixed(0)}%</div></div>
                      <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">포지션</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{data.exposure.n_positions ?? 0}</div></div>
                      <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">HHI</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{(data.exposure.herfindahl ?? 0).toFixed(2)}</div></div>
                    </div>
                    <div className="c-panel-2 p-2.5">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-0.5">최악 시나리오</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--c-text-1)]">{data.scenarios.scenario ?? "—"}</span>
                        <span className="text-[11px] c-num text-[var(--c-neg)]">{((data.scenarios.portfolio_impact_pct ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-[9px] c-num text-[var(--c-text-3)]">예상 PnL {(data.scenarios.estimated_pnl ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="text-[9px] text-[var(--c-text-3)]">{data.risk_budget.summary}</div>
                  </div>
                </Panel>

                <Panel>
                  <PanelHead kicker="risk (기존 API)" title="리스크 거버너" right={riskGov.data && <Badge tone="mute">{riskGov.data.governor}</Badge>} />
                  {riskGov.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {riskGov.data && (
                    <div className="p-4 space-y-1.5 text-[10.5px] text-[var(--c-text-2)]">
                      <div>실행 리스크 이벤트: <span className="c-num text-[var(--c-text-1)]">{riskGov.data.execution_risk_events}</span></div>
                      <div>자율성 레벨 {riskGov.data.autonomy.level} · 라이브 집행 활성화: {String(riskGov.data.autonomy.live_execution_enabled)}</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(riskGov.data.limits).map(([k, v]) => <Badge key={k} tone="mute">{k}: {String(v)}</Badge>)}
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelHead kicker="production-readiness (기존 API)" title="거버넌스"
                    right={prod.data && <Badge tone={prod.data.governance_status.passed ? "pos" : "neg"}>{prod.data.governance_status.governance}</Badge>} />
                  {prod.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {prod.data && (
                    <div className="p-4 space-y-1.5">
                      {prod.data.governance_status.checks.map((c) => (
                        <div key={c.check} className="flex items-center gap-1.5 text-[10.5px]">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                          <span className="text-[var(--c-text-1)]">{c.check}</span>
                          <span className="text-[var(--c-text-3)]">{c.detail}</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-[var(--c-text-3)] pt-1">프로덕션 헬스: {prod.data.production_health.overall_severity}</div>
                    </div>
                  )}
                </Panel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Panel>
                    <PanelHead kicker="agents + council (기존 API)" title="협의회 / 승인" right={agents.data && <Badge tone="neg">라이브 집행: {String(agents.data.live_execution_enabled)}</Badge>} />
                    <div className="p-4 space-y-2">
                      {agents.loading && <div className="text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                      {agents.data && <AgentTree node={agents.data.council} />}
                      {council.data && (
                        <div className="pt-2 border-t border-[var(--c-border)] space-y-1">
                          <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">최근 결정</div>
                          {council.data.decisions.slice(0, 5).map((d, i) => (
                            <div key={i} className="text-[10px] c-num text-[var(--c-text-3)] truncate">{JSON.stringify(d)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <PanelHead kicker="logs (기존 API)" title="감사 로그" right={logs.data && <Badge tone="mute">{logs.data.count}건</Badge>} />
                    <div className="p-4 space-y-1">
                      {logs.loading && <div className="text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                      {logs.data && logs.data.logs.slice(0, 10).map((l, i) => (
                        <div key={i} className="text-[10px] c-num text-[var(--c-text-3)] truncate border-b border-[var(--c-border)] last:border-0 py-0.5">{JSON.stringify(l)}</div>
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* Separation invariants — 미션 핵심 */}
                <Panel>
                  <PanelHead kicker="아키텍처 분리" title="Research OS ⟂ Investment OS ⟂ Execution"
                    right={sep && <Badge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "분리됨" : "검토 필요"}</Badge>} />
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                    {(sep?.invariants ?? []).map((i) => (
                      <div key={i.check} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: i.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                        <span className="text-[10.5px] text-[var(--c-text-1)]">{i.check}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {/* ══════════════ Tab 5 · Operations ══════════════ */}
            {tab === "ops" && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <TabLink href="/research-os/console" label="운영 콘솔" />
                  <TabLink href="/research-os/workflow" label="리서치 워크플로 (세션 제어)" />
                </div>

                {/* Execution ladder — 인터랙티브 승인 워크플로 */}
                <Panel>
                  <PanelHead kicker="실행 레이어 · 승인 워크플로" title="준비도 사다리"
                    right={<Badge tone="neg">auto_execution: {String(ladder?.auto_execution_enabled)}</Badge>} />
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {RUNGS.map((r, i) => {
                        const isAuto = r === "AUTO_EXECUTION";
                        const isCurrent = r === currentRung;
                        const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                        return (
                          <div key={r} className="flex items-center">
                            <span className={`text-[10px] px-2.5 py-1.5 border ${
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

                    <div className="c-panel-2 p-3">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1.5">필수 게이트 (우회 불가)</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {(advResult?.gates ?? []).length > 0
                          ? advResult!.gates.map((g) => (
                            <div key={g.gate} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: g.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                              <span className="text-[10px] text-[var(--c-text-1)]">{g.gate}</span>
                            </div>))
                          : ["risk", "compliance", "portfolio", "kill_switch"].map((g) => (
                            <div key={g} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: data.gates.passed ? "var(--c-pos)" : "var(--c-warn)" }} />
                              <span className="text-[10px] text-[var(--c-text-1)]">{g}</span>
                            </div>))}
                      </div>
                    </div>

                    <div className="c-panel-2 p-3 space-y-2.5">
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
                            <span className="text-[10.5px] text-[var(--c-text-2)]">Risk·Compliance·Portfolio 게이트와 시나리오를 검토했으며, 이 전진을 승인합니다.</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={approveAndAdvance} disabled={!reviewed || busy}
                              className={`px-4 h-9 text-[11px] font-semibold uppercase border cursor-pointer transition-colors ${
                                reviewed && !busy ? "text-[var(--c-pos)] border-[color-mix(in_srgb,var(--c-pos)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-pos)_12%,transparent)]"
                                : "text-[var(--c-text-3)] border-[var(--c-border)] cursor-not-allowed opacity-50"}`}>
                              {busy ? "검증 중…" : `승인 & 전진 → ${RUNG_LABEL[nextRung]}`}
                            </button>
                            <button onClick={resetLadder} className="px-3 h-9 text-[10px] uppercase text-[var(--c-text-3)] border border-[var(--c-border)] cursor-pointer">페이퍼로 리셋</button>
                          </div>
                        </>
                      )}
                      {advResult && (
                        <div className={`text-[10.5px] ${advResult.advanced ? "text-[var(--c-pos)]" : "text-[var(--c-warn)]"}`}>
                          {advResult.advanced ? `✓ 승인됨 — ${RUNG_LABEL[advResult.new_rung]} 로 전진(게이트 통과 + 사람 승인).`
                            : `✗ 차단됨 — ${advResult.blocked_reason}`}
                        </div>
                      )}
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-0.5">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">승인 로그 (이번 세션)</div>
                        {history.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-[9.5px] c-num text-[var(--c-text-3)]">
                            <span className="w-16">{h.ts}</span>
                            <Badge tone={h.advanced ? "pos" : "neg"}>{h.advanced ? "전진함" : "차단됨"}</Badge>
                            <span>{RUNG_LABEL[h.from]} → {RUNG_LABEL[h.to]}</span>
                            {!h.advanced && <span className="text-[var(--c-warn)] truncate">{h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-[var(--c-text-3)]">
                      각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-[var(--c-neg)]">AUTO_EXECUTION 은 영구 비활성 — 승인·게이트와 무관하게 차단.</span> 승인은 주문/실행이 아니라 준비도 상태 전이(자문). Kill switch 시 전부 페이퍼 강제.
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <PanelHead kicker="monitor (기존 API)" title="파이프라인 모니터" />
                  {monitor.loading && <div className="p-4 text-[11px] text-[var(--c-text-3)]">로딩…</div>}
                  {monitor.data && (
                    <div className="p-4 space-y-1.5">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {monitor.data.stages.map((s) => (
                          <div key={s.key} className="c-panel-2 p-2">
                            <div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">{s.label}</div>
                            <div className="text-[13px] c-num text-[var(--c-text-1)]">{s.count}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-[var(--c-text-3)]">제안 {monitor.data.proposals} · 승인 {monitor.data.approvals} · 익스포저 {monitor.data.capital.exposure_pct}%</div>
                    </div>
                  )}
                </Panel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Panel>
                    <PanelHead kicker="orders (기존 API)" title="주문" />
                    {orders.data && (
                      <div className="p-4 space-y-1 text-[10.5px] text-[var(--c-text-2)]">
                        <div>라이프사이클 이벤트: <span className="c-num text-[var(--c-text-1)]">{orders.data.lifecycle_events}</span></div>
                        <div>요청 {orders.data.requests.length} · 응답 {orders.data.responses.length}</div>
                        <div className="text-[9.5px] text-[var(--c-text-3)]">{orders.data.note}</div>
                      </div>
                    )}
                  </Panel>

                  <Panel>
                    <PanelHead kicker="live-intelligence (기존 API)" title="라이브 데이터 소스"
                      right={live.data && <Badge tone={live.data.data_health.overall_status === "ok" ? "pos" : "warn"}>{live.data.data_health.overall_status}</Badge>} />
                    {live.data && (
                      <div className="p-4 space-y-1 text-[10.5px] text-[var(--c-text-2)]">
                        <div>소스 {live.data.data_sources.available_count}/{live.data.data_sources.count}개 사용 가능</div>
                        <div>이슈: {live.data.data_health.issue_count}</div>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
