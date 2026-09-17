"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, TabBar, useAbortableRun } from "@/components/console/widgets";
import {
  ApPanel, ApPanelHead, ApBadge, ApStatTile,
  ApSkeleton, ApSkeletonStatTile, ApSkeletonLines,
} from "@/components/ui/ApPrimitives";
import {
  getValidationLoop, type ValidationLoopResp,
  getProductionReadiness, type ProductionReadinessResp,
  getResearchIntelligence, type ResearchIntelligenceResp,
} from "@/lib/console-api";

type TabKey = "validation" | "production" | "intelligence-plus";
const TABS: { key: TabKey; label: string }[] = [
  { key: "validation", label: "검증 루프" },
  { key: "production", label: "위원회·프로덕션" },
  { key: "intelligence-plus", label: "인텔리전스+" },
];

function ValidationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "validation";
  const setTab = (k: TabKey) => router.push(`/research-os/validation?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="hidden md:block">
        <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      </div>
      <div className="md:hidden sticky top-0 z-10 bg-ap-bg/90 backdrop-blur border-b border-ap-line px-4 py-3">
        <span className="text-[13px] font-semibold text-ap-ink-1">리서치 검증</span>
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 mt-2 pb-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 h-11 rounded-ap-md text-xs font-semibold whitespace-nowrap border transition-colors ${
                tab === t.key ? "bg-ap-brand text-white border-ap-brand" : "bg-ap-surface text-ap-ink-2 border-ap-line"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "validation" && <ValidationTab />}
      {tab === "production" && <ProductionTab />}
      {tab === "intelligence-plus" && <IntelligencePlusTab />}
    </div>
  );
}

export default function ValidationShell() {
  return (
    <Suspense fallback={null}>
      <ValidationInner />
    </Suspense>
  );
}

// ---- validation/page.tsx (P101-110 — Research Validation Dashboard. Lifecycle Board / Validation / Quality / Review Queue.) ----
// /console/validation-loop. READ ONLY · Market Event→Trigger→…→Validation→Memory. 자동 거래·집행 없음.

const STATE_TONE: Record<string, string> = {
  DISCOVERED: "var(--c-text-3)", HYPOTHESIS: "var(--c-blue)", EXPERIMENT: "var(--c-hud)",
  BACKTEST: "var(--c-emerald)", PAPER: "var(--c-warn)", REVIEW: "var(--c-warn)", ARCHIVED: "var(--c-text-3)",
};
const STATE_LABEL: Record<string, string> = {
  DISCOVERED: "발견됨", HYPOTHESIS: "가설", EXPERIMENT: "실험", BACKTEST: "백테스트",
  PAPER: "페이퍼", REVIEW: "검토", ARCHIVED: "보관",
};
const EV_TONE: Record<string, "pos" | "hud" | "neg" | "warn" | "blue" | "mute"> = {
  NEW_HYPOTHESIS: "blue", BACKTEST_COMPLETED: "hud", VALIDATION_FAILED: "neg",
  PAPER_DIVERGENCE: "warn", HUMAN_REVIEW_REQUIRED: "warn",
};
const EV_LABEL: Record<string, string> = {
  NEW_HYPOTHESIS: "새 가설", BACKTEST_COMPLETED: "백테스트 완료", VALIDATION_FAILED: "검증 실패",
  PAPER_DIVERGENCE: "페이퍼 괴리", HUMAN_REVIEW_REQUIRED: "사람 검토 필요",
};
// jarvis/research_workflow/paper_validation.py
const VP_STATUS_LABEL: Record<string, string> = {
  BACKTEST_SUCCESS_PAPER_FAILURE: "백테스트 성공 · 페이퍼 실패", DIVERGENCE: "괴리 감지",
  CONSISTENT: "일치", INSUFFICIENT_DATA: "데이터 부족",
};
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

function ValidationTab() {
  const [data, setData] = useState<ValidationLoopResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getValidationLoop("", ac.signal).then(setData).catch((e) => setErr((e as Error).message));
    return () => ac.abort();
  }, []);

  const vp = data?.validation_panel;
  const qp = data?.quality_panel;
  const ls = data?.loop_status;
  return (
    <>
      <div className="hidden md:block min-h-full">
        <PageHeader kicker="P101-110" title="리서치 검증 루프"
          right={ls && <div className="flex gap-1.5">
            <ApBadge tone={ls.loop_complete ? "pos" : "mute"}>{ls.loop_complete ? "루프 완료" : "루프"}</ApBadge>
            <ApBadge tone={ls.safe ? "pos" : "neg"}>{ls.safe ? "안전" : "위험"}</ApBadge>
            <ApBadge tone={ls.release_ready ? "pos" : "warn"}>v2.0 {ls.release_ready ? "준비완료" : "대기중"}</ApBadge>
          </div>} />
        <div className="p-5 space-y-5">
          {err && <div className="c-panel p-4 text-[13px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
          {ls && <div className="flex flex-wrap gap-1.5">{ls.capabilities.map((c) => <ApBadge key={c} tone="hud">{c}</ApBadge>)}</div>}

          {data && (
            <>
              {/* 1. Strategy Lifecycle Board */}
              <ApPanel>
                <ApPanelHead kicker="1 · 라이프사이클" title="전략 라이프사이클 보드"
                  right={<ApBadge tone="hud">전략 {data.lifecycle_board.count}개</ApBadge>} />
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {data.lifecycle_board.lifecycle.map((s) => (
                      <span key={s} className="text-[9px] uppercase c-num px-1.5 py-0.5 border border-[var(--c-border)]"
                        style={{ color: STATE_TONE[s] ?? "var(--c-text-3)" }} title={s}>{STATE_LABEL[s] ?? s}</span>
                    ))}
                  </div>
                  {data.lifecycle_board.strategies.length === 0 && (
                    <div className="text-[11px] text-[var(--c-text-3)]">연구가 원장에 기록되면 전략별 생애주기가 나타납니다(기존 원장 파생).</div>
                  )}
                  <div className="space-y-1.5">
                    {data.lifecycle_board.strategies.map((row) => (
                      <div key={row.strategy} className="bg-[var(--c-panel-2)] p-2.5 flex items-center gap-3">
                        <span className="text-[13px] font-medium text-[var(--c-text-1)] w-40 truncate">{row.strategy}</span>
                        <div className="flex items-center gap-1 flex-1 flex-wrap">
                          {row.checklist.map((c) => (
                            <span key={c.state} title={c.state}
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: c.current ? 22 : 14,
                                background: c.done ? (STATE_TONE[c.state] ?? "var(--c-hud)") : "var(--c-border)",
                                boxShadow: c.current ? `0 0 6px ${STATE_TONE[c.state] ?? "var(--c-hud)"}` : "none" }} />
                          ))}
                        </div>
                        <ApBadge tone="hud" title={row.current_state}>{STATE_LABEL[row.current_state] ?? row.current_state}</ApBadge>
                      </div>
                    ))}
                  </div>
                </div>
              </ApPanel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 2. Validation ApPanel */}
                <ApPanel>
                  <ApPanelHead kicker="2 · 검증" title="백테스트 vs 페이퍼"
                    right={vp && <ApBadge tone={vp.divergence_detected ? "neg" : "pos"} title={vp.status}>{VP_STATUS_LABEL[vp.status] ?? vp.status}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    {vp?.is_demo && <div className="text-[11px] text-[var(--c-text-3)] uppercase tracking-[0.15em]">데모 · 데이터 소스 연결 시 실데이터</div>}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="text-[9px] text-[var(--c-text-3)] uppercase">지표</div>
                      <div className="text-[9px] text-[var(--c-text-3)] uppercase">백테스트</div>
                      <div className="text-[9px] text-[var(--c-text-3)] uppercase">페이퍼</div>
                      {Object.entries(vp?.tracked_metrics ?? {}).map(([k, m]) => (
                        <div key={k} className="contents">
                          <div className="text-[11px] text-[var(--c-text-2)] text-left">{k}</div>
                          <div className="text-[11px] c-num text-[var(--c-text-1)]">{fmt(m.expected)}</div>
                          <div className="text-[11px] c-num" style={{ color: (m.gap ?? 0) < 0 ? "var(--c-neg)" : "var(--c-text-1)" }}>{fmt(m.actual)}</div>
                        </div>
                      ))}
                    </div>
                    {vp?.possible_causes && vp.possible_causes.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">가능한 원인</div>
                        {vp.possible_causes.map((c, i) => (
                          <div key={i} className="text-[11px] text-[var(--c-text-2)]">· <span className="text-[var(--c-warn)]">{c.cause}</span> — {c.why}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </ApPanel>

                {/* 3. Quality ApPanel */}
                <ApPanel>
                  <ApPanelHead kicker="3 · 품질" title="리서치 품질"
                    right={qp && <ApBadge tone={qp.grade === "A" || qp.grade === "B" ? "pos" : "warn"}>등급 {qp.grade}</ApBadge>} />
                  <div className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <ApStatTile label="품질 점수" value={fmt(qp?.quality_score)} tone={((qp?.quality_score ?? 0) >= 65) ? "pos" : "warn"} />
                      <ApStatTile label="게이트" value={qp?.gate === "ACCEPT" ? "ACCEPT" : "증거 필요"} tone={qp?.gate === "ACCEPT" ? "pos" : "warn"} />
                    </div>
                    <div className="space-y-1">
                      {Object.entries(qp?.core_dimensions ?? {}).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--c-text-2)] w-40">{k}</span>
                          <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((v as number) * 100)}%`,
                              background: (v as number) >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} />
                          </div>
                          <span className="text-[11px] c-num text-[var(--c-text-3)] w-8 text-right">{(v as number).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {qp?.weaknesses && qp.weaknesses.length > 0 && (
                      <div className="text-[11px] text-[var(--c-warn)]">약점: {qp.weaknesses.join(", ")}</div>
                    )}
                    {qp?.missing_validations && qp.missing_validations.length > 0 && (
                      <div className="text-[11px] text-[var(--c-text-3)]">누락된 증거: {qp.missing_validations.join(", ")}</div>
                    )}
                  </div>
                </ApPanel>
              </div>

              {/* 4. Review Queue */}
              <ApPanel>
                <ApPanelHead kicker="4 · 검토 대기열" title="필요한 사람 조치"
                  right={<ApBadge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {data.review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토가 필요한 운영 이벤트가 없습니다(원장 파생). 검증 실패·페이퍼 괴리·결정 대기 시 여기에 표시됩니다.</div>}
                  {data.review_queue.map((e, i) => (
                    <div key={i} className="bg-[var(--c-panel-2)] p-2.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--c-text-1)] truncate">{e.label || e.ref}</span>
                      <div className="flex gap-1.5 shrink-0"><ApBadge tone={EV_TONE[e.event_type] ?? "mute"} title={e.event_type}>{EV_LABEL[e.event_type] ?? e.event_type}</ApBadge><span className="text-[9px] c-num text-[var(--c-text-3)]">{e.source}</span></div>
                    </div>
                  ))}
                  {Object.keys(data.ops_by_type).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">{Object.entries(data.ops_by_type).map(([k, n]) => <span key={k} className="text-[9px] c-num text-[var(--c-text-3)] px-1.5 py-0.5 border border-[var(--c-border)]">{k}: {n}</span>)}</div>
                  )}
                </div>
              </ApPanel>
              <div className="text-[11px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
            </>
          )}
        </div>
      </div>

      <div className="md:hidden min-h-full">
        <div className="p-4 space-y-4">
          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}
          {ls && <div className="flex flex-wrap gap-1.5">
            <ApBadge tone={ls.loop_complete ? "pos" : "mute"}>{ls.loop_complete ? "루프 완료" : "루프"}</ApBadge>
            <ApBadge tone={ls.safe ? "pos" : "neg"}>{ls.safe ? "안전" : "위험"}</ApBadge>
            <ApBadge tone={ls.release_ready ? "pos" : "warn"}>v2.0 {ls.release_ready ? "준비완료" : "대기중"}</ApBadge>
          </div>}

          {!data && !err && (
            <div className="space-y-4">
              <ApPanel>
                <div className="px-4 h-10 border-b border-ap-line flex items-center"><ApSkeleton className="h-2.5 w-32" /></div>
                <div className="p-4"><ApSkeletonLines rows={4} /></div>
              </ApPanel>
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 2 }).map((_, i) => <ApSkeletonStatTile key={i} />)}</div>
            </div>
          )}

          {data && (
            <>
              {/* 1. Strategy Lifecycle Board */}
              <ApPanel>
                <ApPanelHead kicker="1 · 라이프사이클" title="전략 라이프사이클"
                  right={<ApBadge tone="hud">전략 {data.lifecycle_board.count}개</ApBadge>} />
                <div className="p-4 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {data.lifecycle_board.lifecycle.map((s) => (
                      <span key={s} className="text-[11px] uppercase font-data px-1.5 py-0.5 rounded-ap-sm border border-ap-line"
                        style={{ color: STATE_TONE[s] ?? "var(--c-text-3)" }} title={s}>{STATE_LABEL[s] ?? s}</span>
                    ))}
                  </div>
                  {data.lifecycle_board.strategies.length === 0 && (
                    <div className="text-xs text-ap-ink-3">연구가 원장에 기록되면 전략별 생애주기가 나타납니다(기존 원장 파생).</div>
                  )}
                  {data.lifecycle_board.strategies.map((row) => (
                    <div key={row.strategy} className="bg-ap-bg rounded-ap-md p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[13px] font-medium text-ap-ink-1 truncate">{row.strategy}</span>
                        <ApBadge tone="hud" title={row.current_state}>{STATE_LABEL[row.current_state] ?? row.current_state}</ApBadge>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {row.checklist.map((c) => (
                          <span key={c.state} title={c.state}
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: c.current ? 22 : 14,
                              background: c.done ? (STATE_TONE[c.state] ?? "var(--c-hud)") : "var(--c-border)",
                              boxShadow: c.current ? `0 0 6px ${STATE_TONE[c.state] ?? "var(--c-hud)"}` : "none" }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ApPanel>

              {/* 2. Validation ApPanel */}
              <ApPanel>
                <ApPanelHead kicker="2 · 검증" title="백테스트 vs 페이퍼"
                  right={vp && <ApBadge tone={vp.divergence_detected ? "neg" : "pos"} title={vp.status}>{VP_STATUS_LABEL[vp.status] ?? vp.status}</ApBadge>} />
                <div className="p-4 space-y-3">
                  {vp?.is_demo && <div className="text-[11px] text-ap-ink-3 uppercase tracking-[0.15em]">데모 · 데이터 소스 연결 시 실데이터</div>}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="text-[11px] text-ap-ink-3 uppercase">지표</div>
                    <div className="text-[11px] text-ap-ink-3 uppercase">백테스트</div>
                    <div className="text-[11px] text-ap-ink-3 uppercase">페이퍼</div>
                    {Object.entries(vp?.tracked_metrics ?? {}).map(([k, m]) => (
                      <div key={k} className="contents">
                        <div className="text-xs text-ap-ink-2 text-left">{k}</div>
                        <div className="text-xs font-data text-ap-ink-1">{fmt(m.expected)}</div>
                        <div className="text-xs font-data" style={{ color: (m.gap ?? 0) < 0 ? "var(--c-neg)" : "var(--c-text-1)" }}>{fmt(m.actual)}</div>
                      </div>
                    ))}
                  </div>
                  {vp?.possible_causes && vp.possible_causes.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[11px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">가능한 원인</div>
                      {vp.possible_causes.map((c, i) => (
                        <div key={i} className="text-xs text-ap-ink-2">· <span className="text-[var(--c-warn)]">{c.cause}</span> — {c.why}</div>
                      ))}
                    </div>
                  )}
                </div>
              </ApPanel>

              {/* 3. Quality ApPanel */}
              <ApPanel>
                <ApPanelHead kicker="3 · 품질" title="리서치 품질"
                  right={qp && <ApBadge tone={qp.grade === "A" || qp.grade === "B" ? "pos" : "warn"}>등급 {qp.grade}</ApBadge>} />
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <ApStatTile label="품질 점수" value={fmt(qp?.quality_score)} tone={((qp?.quality_score ?? 0) >= 65) ? "pos" : "warn"} />
                    <ApStatTile label="게이트" value={qp?.gate === "ACCEPT" ? "ACCEPT" : "증거 필요"} tone={qp?.gate === "ACCEPT" ? "pos" : "warn"} />
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(qp?.core_dimensions ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-xs text-ap-ink-2 w-32 truncate">{k}</span>
                        <div className="flex-1 h-1.5 bg-ap-line rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((v as number) * 100)}%`,
                            background: (v as number) >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} />
                        </div>
                        <span className="text-xs font-data text-ap-ink-3 w-8 text-right">{(v as number).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {qp?.weaknesses && qp.weaknesses.length > 0 && (
                    <div className="text-xs text-[var(--c-warn)]">약점: {qp.weaknesses.join(", ")}</div>
                  )}
                  {qp?.missing_validations && qp.missing_validations.length > 0 && (
                    <div className="text-xs text-ap-ink-3">누락된 증거: {qp.missing_validations.join(", ")}</div>
                  )}
                </div>
              </ApPanel>

              {/* 4. Review Queue */}
              <ApPanel>
                <ApPanelHead kicker="4 · 검토 대기열" title="필요한 사람 조치"
                  right={<ApBadge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {data.review_queue.length === 0 && <div className="text-xs text-ap-ink-3">사람 검토가 필요한 운영 이벤트가 없습니다(원장 파생). 검증 실패·페이퍼 괴리·결정 대기 시 여기에 표시됩니다.</div>}
                  {data.review_queue.map((e, i) => (
                    <div key={i} className="bg-ap-bg rounded-ap-md p-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-ap-ink-1 truncate">{e.label || e.ref}</span>
                      <div className="flex gap-1.5 shrink-0"><ApBadge tone={EV_TONE[e.event_type] ?? "mute"} title={e.event_type}>{EV_LABEL[e.event_type] ?? e.event_type}</ApBadge><span className="text-[11px] font-data text-ap-ink-3">{e.source}</span></div>
                    </div>
                  ))}
                  {Object.keys(data.ops_by_type).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">{Object.entries(data.ops_by_type).map(([k, n]) => <span key={k} className="text-[11px] font-data text-ap-ink-3 px-1.5 py-0.5 rounded-ap-sm border border-ap-line">{k}: {n}</span>)}</div>
                  )}
                </div>
              </ApPanel>
              <div className="text-xs text-ap-ink-3 leading-relaxed">{data.disclaimer}</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---- production/page.tsx (P161-170 — Committee & Production Readiness. Overview/Committee/Debate/Conviction/Portfolio/Governance/Production/Metrics/Review.) ----
// /console/production-readiness. READ ONLY · 위원회·거버넌스·모니터링 · BUY/SELL/EXECUTE/ALLOCATE 없음.

const SEV_TONE: Record<string, "pos" | "warn" | "neg"> = { OK: "pos", WARNING: "warn", CRITICAL: "neg" };
const CONV_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const CONV_LABEL: Record<string, string> = { HIGH: "높음", MEDIUM: "중간", LOW: "낮음" };
// bull/bear_case.evidence: string 또는 {text|finding} 객체 혼재 (jarvis/research_workflow/debate_engine.py)
const evidenceText = (e: unknown): string =>
  typeof e === "string" ? e : (e as { text?: string; finding?: string })?.text ?? (e as { text?: string; finding?: string })?.finding ?? String(e);

function ProductionTab() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const { data, err, run } = useAbortableRun(getProductionReadiness, "Does momentum work in KR equities?");

  const ov = data?.institutional_overview;
  const cp = data?.committee_packet;
  const cv = data?.conviction;
  const gov = data?.governance_status;
  const prod = data?.production_health;
  return (
    <>
      <div className="hidden md:block min-h-full">
        <PageHeader kicker="P161-170 · v2.0" title="위원회 & 프로덕션"
          right={ov && <div className="flex gap-1.5">
            <ApBadge tone={ov.release_ready ? "pos" : "warn"}>{ov.release_ready ? "릴리스 준비완료" : "v2.0"}</ApBadge>
            {ov.architecture_frozen && <ApBadge tone="hud">고정됨</ApBadge>}
          </div>} />
        <div className="p-5 space-y-5">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">소집</button>
          </form>
          {err && <div className="c-panel p-4 text-[13px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

          {data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ApStatTile label="v2.0 릴리스" value={ov?.release_ready ? "준비완료" : "대기중"} sub={ov?.architecture_frozen ? "아키텍처 고정됨" : ""} tone={ov?.release_ready ? "pos" : "warn"} />
                <ApStatTile label="확신도" value={cv?.level ? (CONV_LABEL[cv.level] ?? cv.level) : "—"} sub={`점수 ${cv?.score ?? 0}`} tone={CONV_TONE[cv?.level ?? ""] === "warn" ? "warn" : "pos"} />
                <ApStatTile label="거버넌스" value={gov?.governance ?? "—"} sub={`${gov?.checks.filter((c) => c.ok).length ?? 0}/${gov?.checks.length ?? 0} 항목`} tone={gov?.passed ? "pos" : "warn"} />
                <ApStatTile label="프로덕션" value={prod?.overall_severity ?? "—"} sub={`${prod?.counts?.OK ?? 0} OK · ${prod?.counts?.WARNING ?? 0} 경고`} tone={SEV_TONE[prod?.overall_severity ?? ""] ?? "warn"} />
              </div>
              {ov && <div className="flex flex-wrap gap-1.5">{ov.capabilities.map((c) => <ApBadge key={c} tone="hud">{c}</ApBadge>)}</div>}

              {/* Committee Packet */}
              <ApPanel>
                <ApPanelHead kicker="위원회 패킷" title={cp?.research_summary?.slice(0, 70) || "—"} right={<ApBadge tone={CONV_TONE[cp?.confidence ?? ""] ?? "mute"} title={cp?.confidence}>확신 {cp?.confidence ? (CONV_LABEL[cp.confidence] ?? cp.confidence) : "—"}</ApBadge>} />
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">사람에게 질문</div>
                    {(cp?.questions_for_human ?? []).map((qq, i) => <div key={i} className="text-[11px] text-[var(--c-text-2)]">· {qq}</div>)}
                  </div>
                  <div>
                    <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">제한사항</div>
                    {(cp?.limitations ?? []).map((l, i) => <div key={i} className="text-[11px] text-[var(--c-text-3)]">· {l}</div>)}
                  </div>
                </div>
              </ApPanel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Debate */}
                <ApPanel>
                  <ApPanelHead kicker="토론 패널" title="강세 / 약세 / 리스크" />
                  <div className="p-4 space-y-2">
                    <div className="bg-[var(--c-panel-2)] p-2.5"><ApBadge tone="pos">강세</ApBadge><div className="text-[11px] text-[var(--c-text-2)] mt-1">{(data.debate.bull_case.evidence ?? []).slice(0, 2).map(evidenceText).join("; ") || "—"}</div></div>
                    <div className="bg-[var(--c-panel-2)] p-2.5"><ApBadge tone="neg">약세</ApBadge><div className="text-[11px] text-[var(--c-text-2)] mt-1">{(data.debate.bear_case.evidence ?? []).slice(0, 3).map(evidenceText).join("; ") || "—"}</div></div>
                    {data.debate.historical_counterexamples.length > 0 && <div className="bg-[var(--c-panel-2)] p-2.5"><ApBadge tone="warn">반례</ApBadge>{data.debate.historical_counterexamples.map((c, i) => <div key={i} className="text-[11px] text-[var(--c-text-3)] mt-1">{c.topic}: {c.study_a} vs {c.study_b} — {c.explanation}</div>)}</div>}
                  </div>
                </ApPanel>

                {/* Conviction factors */}
                <ApPanel>
                  <ApPanelHead kicker="확신도" title="연구 확신도" right={cv && <ApBadge tone={CONV_TONE[cv.level] ?? "mute"} title={cv.level}>{CONV_LABEL[cv.level] ?? cv.level}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {Object.entries(cv?.factors ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--c-text-2)] w-44">{k}</span>
                        <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: v >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                        <span className="text-[11px] c-num text-[var(--c-text-3)] w-8 text-right">{v.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="text-[9px] text-[var(--c-text-3)] pt-1">연구 확신도 — 투자 등급 아님.</div>
                  </div>
                </ApPanel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Governance */}
                <ApPanel>
                  <ApPanelHead kicker="거버넌스" title="컴플라이언스" right={gov && <ApBadge tone={gov.passed ? "pos" : "warn"}>{gov.governance}</ApBadge>} />
                  <div className="p-4 space-y-1">
                    {(gov?.checks ?? []).map((c) => (
                      <div key={c.check} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                        <span className="text-[11px] text-[var(--c-text-1)] w-44">{c.check}</span>
                        <span className="text-[9px] text-[var(--c-text-3)] flex-1 truncate">{c.detail}</span>
                      </div>
                    ))}
                  </div>
                </ApPanel>

                {/* Production Health */}
                <ApPanel>
                  <ApPanelHead kicker="프로덕션 헬스" title="컴포넌트" right={prod && <ApBadge tone={SEV_TONE[prod.overall_severity] ?? "mute"}>{prod.overall_severity}</ApBadge>} />
                  <div className="p-4 space-y-1">
                    {(prod?.components ?? []).map((c) => (
                      <div key={c.component} className="flex items-center gap-2">
                        <ApBadge tone={SEV_TONE[c.severity] ?? "mute"}>{c.severity}</ApBadge>
                        <span className="text-[11px] text-[var(--c-text-1)] w-40">{c.component}</span>
                        <span className="text-[9px] text-[var(--c-text-3)] flex-1 truncate">{c.detail}</span>
                      </div>
                    ))}
                  </div>
                </ApPanel>
              </div>

              {/* Portfolio Research + Review Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ApPanel>
                  <ApPanelHead kicker="포트폴리오 리서치" title="전략 헬스" right={<ApBadge tone="hud">{data.portfolio_research.strategy_health.length}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {data.portfolio_research.strategy_health.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">전략이 축적되면 노출·중첩·상관 뷰가 나타납니다(배분 아님).</div>}
                    {data.portfolio_research.strategy_health.map((s) => (
                      <div key={s.strategy} className="flex items-center gap-2"><span className="text-[11px] text-[var(--c-text-1)] w-36 truncate">{s.strategy}</span><div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.health_score}%`, background: s.health_score >= 65 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>{s.review_needed && <ApBadge tone="warn">검토</ApBadge>}</div>
                    ))}
                    <div className="text-[9px] text-[var(--c-text-3)] pt-1">배분 제안 아님 — 연구 관점.</div>
                  </div>
                </ApPanel>
                <ApPanel>
                  <ApPanelHead kicker="검토 대기열" title="휴먼 액션" right={<ApBadge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {data.review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토 대기 항목 없음.</div>}
                    {data.review_queue.map((r, i) => <div key={i} className="bg-[var(--c-panel-2)] p-2.5 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--c-text-1)] truncate">{r.task}</span><span className="text-[9px] c-num text-[var(--c-text-3)]">{r.source}</span></div>)}
                  </div>
                </ApPanel>
              </div>
              <div className="text-[11px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
            </>
          )}
        </div>
      </div>

      <div className="md:hidden min-h-full">
        <div className="p-4 space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
              className="flex-1 bg-ap-surface border border-ap-line rounded-ap-md px-3 h-11 text-sm text-ap-ink-1 outline-none focus:border-ap-brand" />
            <button type="submit" className="px-4 h-11 rounded-ap-md text-xs font-semibold uppercase text-white bg-ap-brand cursor-pointer shrink-0">소집</button>
          </form>
          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {!data && !err && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}</div>
              <ApPanel>
                <div className="px-4 h-10 border-b border-ap-line flex items-center"><ApSkeleton className="h-2.5 w-32" /></div>
                <div className="p-4"><ApSkeletonLines rows={4} /></div>
              </ApPanel>
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ApStatTile label="v2.0 릴리스" value={ov?.release_ready ? "준비완료" : "대기중"} sub={ov?.architecture_frozen ? "아키텍처 고정됨" : ""} tone={ov?.release_ready ? "pos" : "warn"} />
                <ApStatTile label="확신도" value={cv?.level ? (CONV_LABEL[cv.level] ?? cv.level) : "—"} sub={`점수 ${cv?.score ?? 0}`} tone={CONV_TONE[cv?.level ?? ""] === "warn" ? "warn" : "pos"} />
                <ApStatTile label="거버넌스" value={gov?.governance ?? "—"} sub={`${gov?.checks.filter((c) => c.ok).length ?? 0}/${gov?.checks.length ?? 0} 항목`} tone={gov?.passed ? "pos" : "warn"} />
                <ApStatTile label="프로덕션" value={prod?.overall_severity ?? "—"} sub={`${prod?.counts?.OK ?? 0} OK · ${prod?.counts?.WARNING ?? 0} 경고`} tone={SEV_TONE[prod?.overall_severity ?? ""] ?? "warn"} />
              </div>
              {ov && <div className="flex flex-wrap gap-1.5">{ov.capabilities.map((c) => <ApBadge key={c} tone="hud">{c}</ApBadge>)}</div>}

              {/* Committee Packet */}
              <ApPanel>
                <ApPanelHead kicker="위원회 패킷" title={cp?.research_summary?.slice(0, 40) || "—"} right={<ApBadge tone={CONV_TONE[cp?.confidence ?? ""] ?? "mute"} title={cp?.confidence}>확신 {cp?.confidence ? (CONV_LABEL[cp.confidence] ?? cp.confidence) : "—"}</ApBadge>} />
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-[11px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">사람에게 질문</div>
                    {(cp?.questions_for_human ?? []).map((qq, i) => <div key={i} className="text-xs text-ap-ink-2">· {qq}</div>)}
                  </div>
                  <div>
                    <div className="text-[11px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">제한사항</div>
                    {(cp?.limitations ?? []).map((l, i) => <div key={i} className="text-xs text-ap-ink-3">· {l}</div>)}
                  </div>
                </div>
              </ApPanel>

              {/* Debate */}
              <ApPanel>
                <ApPanelHead kicker="토론 패널" title="강세 / 약세 / 리스크" />
                <div className="p-4 space-y-2">
                  <div className="bg-ap-bg rounded-ap-md p-2.5"><ApBadge tone="pos">강세</ApBadge><div className="text-xs text-ap-ink-2 mt-1">{(data.debate.bull_case.evidence ?? []).slice(0, 2).map(evidenceText).join("; ") || "—"}</div></div>
                  <div className="bg-ap-bg rounded-ap-md p-2.5"><ApBadge tone="neg">약세</ApBadge><div className="text-xs text-ap-ink-2 mt-1">{(data.debate.bear_case.evidence ?? []).slice(0, 3).map(evidenceText).join("; ") || "—"}</div></div>
                  {data.debate.historical_counterexamples.length > 0 && <div className="bg-ap-bg rounded-ap-md p-2.5"><ApBadge tone="warn">반례</ApBadge>{data.debate.historical_counterexamples.map((c, i) => <div key={i} className="text-xs text-ap-ink-3 mt-1">{c.topic}: {c.study_a} vs {c.study_b} — {c.explanation}</div>)}</div>}
                </div>
              </ApPanel>

              {/* Conviction factors */}
              <ApPanel>
                <ApPanelHead kicker="확신도" title="연구 확신도" right={cv && <ApBadge tone={CONV_TONE[cv.level] ?? "mute"} title={cv.level}>{CONV_LABEL[cv.level] ?? cv.level}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(cv?.factors ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs text-ap-ink-2 w-32 truncate">{k}</span>
                      <div className="flex-1 h-1.5 bg-ap-line rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: v >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                      <span className="text-xs font-data text-ap-ink-3 w-8 text-right">{v.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="text-[11px] text-ap-ink-3 pt-1">연구 확신도 — 투자 등급 아님.</div>
                </div>
              </ApPanel>

              {/* Governance */}
              <ApPanel>
                <ApPanelHead kicker="거버넌스" title="컴플라이언스" right={gov && <ApBadge tone={gov.passed ? "pos" : "warn"}>{gov.governance}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {(gov?.checks ?? []).map((c) => (
                    <div key={c.check} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                      <span className="text-xs text-ap-ink-1 flex-1 truncate">{c.check}</span>
                    </div>
                  ))}
                  {(gov?.checks ?? []).some((c) => c.detail) && (
                    <div className="pt-1 space-y-1">
                      {(gov?.checks ?? []).filter((c) => c.detail).map((c) => (
                        <div key={c.check} className="text-[11px] text-ap-ink-3 truncate">{c.check}: {c.detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              </ApPanel>

              {/* Production Health */}
              <ApPanel>
                <ApPanelHead kicker="프로덕션 헬스" title="컴포넌트" right={prod && <ApBadge tone={SEV_TONE[prod.overall_severity] ?? "mute"}>{prod.overall_severity}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {(prod?.components ?? []).map((c) => (
                    <div key={c.component} className="flex items-center gap-2">
                      <ApBadge tone={SEV_TONE[c.severity] ?? "mute"}>{c.severity}</ApBadge>
                      <span className="text-xs text-ap-ink-1 flex-1 truncate">{c.component}</span>
                    </div>
                  ))}
                  {(prod?.components ?? []).some((c) => c.detail) && (
                    <div className="pt-1 space-y-1">
                      {(prod?.components ?? []).filter((c) => c.detail).map((c) => (
                        <div key={c.component} className="text-[11px] text-ap-ink-3 truncate">{c.component}: {c.detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              </ApPanel>

              {/* Portfolio Research */}
              <ApPanel>
                <ApPanelHead kicker="포트폴리오 리서치" title="전략 헬스" right={<ApBadge tone="hud">{data.portfolio_research.strategy_health.length}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {data.portfolio_research.strategy_health.length === 0 && <div className="text-xs text-ap-ink-3">전략이 축적되면 노출·중첩·상관 뷰가 나타납니다(배분 아님).</div>}
                  {data.portfolio_research.strategy_health.map((s) => (
                    <div key={s.strategy} className="flex items-center gap-2">
                      <span className="text-xs text-ap-ink-1 w-24 truncate">{s.strategy}</span>
                      <div className="flex-1 h-1.5 bg-ap-line rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.health_score}%`, background: s.health_score >= 65 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                      {s.review_needed && <ApBadge tone="warn">검토</ApBadge>}
                    </div>
                  ))}
                  <div className="text-[11px] text-ap-ink-3 pt-1">배분 제안 아님 — 연구 관점.</div>
                </div>
              </ApPanel>

              {/* Review Queue */}
              <ApPanel>
                <ApPanelHead kicker="검토 대기열" title="휴먼 액션" right={<ApBadge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {data.review_queue.length === 0 && <div className="text-xs text-ap-ink-3">사람 검토 대기 항목 없음.</div>}
                  {data.review_queue.map((r, i) => <div key={i} className="bg-ap-bg rounded-ap-md p-2.5 flex items-center justify-between gap-2"><span className="text-xs text-ap-ink-1 truncate">{r.task}</span><span className="text-[11px] font-data text-ap-ink-3">{r.source}</span></div>)}
                </div>
              </ApPanel>
              <div className="text-xs text-ap-ink-3 leading-relaxed">{data.disclaimer}</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---- intelligence-plus/page.tsx (P171-180 — Autonomous Research Intelligence Enhancement.) ----
// Creative hypotheses · search tree · continuous queue · prioritization · planning · productivity · reflection · autonomy validation.
// /console/research-intelligence. READ ONLY · 연구 자동 실행 없음 · 자율 승인 없음 · BUY/SELL/EXECUTE/ALLOCATE 없음.

const PRIO_TONE: Record<string, "pos" | "warn" | "neg"> = { LOW: "pos", MEDIUM: "warn", HIGH: "neg" };

function IntelligencePlusTab() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const { data, err, run } = useAbortableRun(getResearchIntelligence, "Does momentum work in KR equities?");

  const ch = data?.creative_hypotheses;
  const cq = data?.continuous_queue;
  const ep = data?.experiment_prioritization;
  const av = data?.autonomy_validation;
  const cov = ep?.coverage_context;
  return (
    <>
      <div className="hidden md:block min-h-full">
        <PageHeader kicker="P171-180 · 인텔리전스 강화" title="자율 연구 인텔리전스"
          right={av && <div className="flex gap-1.5">
            <ApBadge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</ApBadge>
            <ApBadge tone="hud">재사용 {av.reuse_count}</ApBadge>
          </div>} />
        <div className="p-5 space-y-5">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">탐색</button>
          </form>
          {err && <div className="c-panel p-4 text-[13px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

          {data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ApStatTile label="창의적 가설" value={String(ch?.count ?? 0)} sub={`소스 ${(ch?.diversity?.sources ?? []).length}개`} tone="hud" />
                <ApStatTile label="리서치 큐" value={String(cq?.queue_size ?? 0)} sub="상시 백로그" tone="pos" />
                <ApStatTile label="지식 커버리지" value={cov?.research_coverage != null ? `${Math.round(cov.research_coverage * 100)}%` : "—"} sub={`공백 ${cov?.knowledge_gap != null ? Math.round(cov.knowledge_gap * 100) : 0}%`} tone="warn" />
                <ApStatTile label="자율성 감사" value={av?.validated ? "통과" : "검토 필요"} sub={`중복 ${av?.duplicated_logic.length ?? 0} · 재사용 ${av?.reuse_count ?? 0}`} tone={av?.validated ? "pos" : "warn"} />
              </div>
              <div className="text-[11px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>

              {/* Creative hypotheses (P171) */}
              <ApPanel>
                <ApPanelHead kicker="P171 · 창의적 가설 발굴" title="다중 소스 가설"
                  right={ch && <ApBadge tone="hud">{ch.count}</ApBadge>} />
                <div className="p-4 space-y-2">
                  {(ch?.hypotheses ?? []).slice(0, 6).map((h) => (
                    <div key={h.hypothesis_id} className="bg-[var(--c-panel-2)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] text-[var(--c-text-1)]">{h.statement}</span>
                        <ApBadge tone="mute">{h.source}</ApBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] c-num text-[var(--c-text-3)]">
                        <span>참신성 {h.novelty_score.toFixed(2)}</span>
                        <span>불확실성 {h.uncertainty.toFixed(2)}</span>
                        <span>신뢰도 {h.confidence}</span>
                        <span>과거 연구 {h.similar_historical_research.prior_research_count}</span>
                        {h.similar_historical_research.tried_before && <span className="text-[var(--c-warn)]">이전 시도됨</span>}
                        <span>상충 {h.conflicting_evidence.count}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {h.required_validation.slice(0, 5).map((v) => <span key={v} className="text-[9px] px-1.5 py-0.5 border border-[var(--c-border)] text-[var(--c-text-3)]">{v}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </ApPanel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Continuous queue (P173) */}
                <ApPanel>
                  <ApPanelHead kicker="P173 · 상시 리서치 큐" title="우선순위 백로그"
                    right={cq && <ApBadge tone="pos">{cq.queue_size}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {Object.entries(cq?.by_source ?? {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {Object.entries(cq?.by_source ?? {}).map(([s, n]) => <ApBadge key={s} tone="mute">{s} {n}</ApBadge>)}
                      </div>
                    )}
                    {(cq?.backlog ?? []).slice(0, 8).map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[9px] c-num text-[var(--c-text-3)] w-5">{b.rank ?? i + 1}</span>
                        <span className="text-[11px] text-[var(--c-text-1)] flex-1 truncate">{b.statement}</span>
                        <span className="text-[9px] c-num text-[var(--c-hud)]">{typeof b.score === "number" ? b.score.toFixed(3) : ""}</span>
                      </div>
                    ))}
                  </div>
                </ApPanel>

                {/* Experiment prioritization (P174) */}
                <ApPanel>
                  <ApPanelHead kicker="P174 · 실험 우선순위화" title="다음 추천"
                    right={<ApBadge tone="hud">{ep?.recommendations.length ?? 0}</ApBadge>} />
                  <div className="p-4 space-y-1.5">
                    {(ep?.recommendations ?? []).slice(0, 6).map((r, i) => (
                      <div key={i} className="bg-[var(--c-panel-2)] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[var(--c-text-1)] truncate">{r.statement}</span>
                          <span className="text-[11px] c-num text-[var(--c-hud)]">{r.composite_score.toFixed(3)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="text-[9px] text-[var(--c-text-3)] pt-1">추천만 — 사람이 다음 실험을 결정.</div>
                  </div>
                </ApPanel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Planning (P177) */}
                <ApPanel>
                  <ApPanelHead kicker="P177 · 기관 차원 계획" title="의제 & 로드맵" />
                  <div className="p-4 space-y-2">
                    {Object.entries(data.research_planning ?? {}).map(([horizon, plan]) => (
                      <div key={horizon} className="bg-[var(--c-panel-2)] p-2.5">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">{horizon}</div>
                        {(plan.agenda ?? []).slice(0, 3).map((a, i) => <div key={i} className="text-[11px] text-[var(--c-text-2)] truncate">· {a.item}</div>)}
                        {(plan.roadmap ?? []).map((r, i) => <div key={i} className="text-[11px] text-[var(--c-text-2)] truncate">Q{r.quarter_slot}: {r.theme}</div>)}
                      </div>
                    ))}
                  </div>
                </ApPanel>

                {/* Productivity (P179) + Reflection (P176) */}
                <ApPanel>
                  <ApPanelHead kicker="P179 · 생산성 + P176 · 회고" title="지표 & 교훈" />
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(data.productivity?.metrics ?? {}).slice(0, 6).map(([k, m]) => (
                        <div key={k} className="bg-[var(--c-panel-2)] p-2">
                          <div className="text-[9px] tracking-[0.15em] text-[var(--c-text-3)] uppercase truncate">{k}</div>
                          <div className="text-[13px] c-num text-[var(--c-text-1)]">{String(m.value ?? "—")}</div>
                        </div>
                      ))}
                    </div>
                    {(data.productivity?.recommendations ?? []).slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <ApBadge tone={PRIO_TONE[r.priority] ?? "mute"}>{r.priority}</ApBadge>
                        <span className="text-[11px] text-[var(--c-text-2)] flex-1 truncate">{r.recommendation}</span>
                      </div>
                    ))}
                    {(data.self_reflection?.test_next ?? []).slice(0, 2).map((t, i) => (
                      <div key={`r${i}`} className="text-[11px] text-[var(--c-text-3)]">↳ 다음: {t}</div>
                    ))}
                  </div>
                </ApPanel>
              </div>

              {/* Autonomy validation (P180) */}
              <ApPanel>
                <ApPanelHead kicker="P180 · 자율성 검증" title="안전성 & 재사용 감사"
                  right={av && <ApBadge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</ApBadge>} />
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                  {(av?.checks ?? []).map((c) => (
                    <div key={c.check} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                      <span className="text-[11px] text-[var(--c-text-1)] flex-1">{c.check}</span>
                      <span className="text-[9px] text-[var(--c-text-3)]">{c.detail ?? ""}</span>
                    </div>
                  ))}
                </div>
                {(av?.remaining_limitations ?? []).length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">남은 제약사항</div>
                    {(av?.remaining_limitations ?? []).map((l, i) => <div key={i} className="text-[11px] text-[var(--c-text-3)]">· {l}</div>)}
                  </div>
                )}
              </ApPanel>
            </>
          )}
        </div>
      </div>

      <div className="md:hidden min-h-full">
        <div className="p-4 space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
              className="flex-1 bg-ap-surface border border-ap-line rounded-ap-md px-3 h-11 text-sm text-ap-ink-1 outline-none focus:border-ap-brand" />
            <button type="submit" className="px-4 h-11 rounded-ap-md text-xs font-semibold uppercase text-white bg-ap-brand cursor-pointer shrink-0">탐색</button>
          </form>
          {err && <ApPanel className="p-4 text-[13px] text-ap-down">백엔드 연결 실패: {err}</ApPanel>}

          {!data && !err && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <ApSkeletonStatTile key={i} />)}</div>
              <ApPanel>
                <div className="px-4 h-10 border-b border-ap-line flex items-center"><ApSkeleton className="h-2.5 w-32" /></div>
                <div className="p-4"><ApSkeletonLines rows={4} /></div>
              </ApPanel>
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ApStatTile label="창의적 가설" value={String(ch?.count ?? 0)} sub={`소스 ${(ch?.diversity?.sources ?? []).length}개`} tone="hud" />
                <ApStatTile label="리서치 큐" value={String(cq?.queue_size ?? 0)} sub="상시 백로그" tone="pos" />
                <ApStatTile label="지식 커버리지" value={cov?.research_coverage != null ? `${Math.round(cov.research_coverage * 100)}%` : "—"} sub={`공백 ${cov?.knowledge_gap != null ? Math.round(cov.knowledge_gap * 100) : 0}%`} tone="warn" />
                <ApStatTile label="자율성 감사" value={av?.validated ? "통과" : "검토 필요"} sub={`중복 ${av?.duplicated_logic.length ?? 0} · 재사용 ${av?.reuse_count ?? 0}`} tone={av?.validated ? "pos" : "warn"} />
              </div>
              <div className="text-xs text-ap-ink-3 leading-relaxed">{data.disclaimer}</div>

              {/* Creative hypotheses (P171) */}
              <ApPanel>
                <ApPanelHead kicker="P171 · 창의적 가설 발굴" title="다중 소스 가설"
                  right={ch && <ApBadge tone="hud">{ch.count}</ApBadge>} />
                <div className="p-4 space-y-2">
                  {(ch?.hypotheses ?? []).slice(0, 6).map((h) => (
                    <div key={h.hypothesis_id} className="bg-ap-bg rounded-ap-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] text-ap-ink-1">{h.statement}</span>
                        <ApBadge tone="mute">{h.source}</ApBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] font-data text-ap-ink-3">
                        <span>참신성 {h.novelty_score.toFixed(2)}</span>
                        <span>불확실성 {h.uncertainty.toFixed(2)}</span>
                        <span>신뢰도 {h.confidence}</span>
                        <span>과거 연구 {h.similar_historical_research.prior_research_count}</span>
                        {h.similar_historical_research.tried_before && <span className="text-[var(--c-warn)]">이전 시도됨</span>}
                        <span>상충 {h.conflicting_evidence.count}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {h.required_validation.slice(0, 5).map((v) => <span key={v} className="text-[11px] px-1.5 py-0.5 rounded-ap-sm border border-ap-line text-ap-ink-3">{v}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </ApPanel>

              {/* Continuous queue (P173) */}
              <ApPanel>
                <ApPanelHead kicker="P173 · 상시 리서치 큐" title="우선순위 백로그"
                  right={cq && <ApBadge tone="pos">{cq.queue_size}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(cq?.by_source ?? {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(cq?.by_source ?? {}).map(([s, n]) => <ApBadge key={s} tone="mute">{s} {n}</ApBadge>)}
                    </div>
                  )}
                  {(cq?.backlog ?? []).slice(0, 8).map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] font-data text-ap-ink-3 w-5">{b.rank ?? i + 1}</span>
                      <span className="text-xs text-ap-ink-1 flex-1 truncate">{b.statement}</span>
                      <span className="text-[11px] font-data text-ap-brand">{typeof b.score === "number" ? b.score.toFixed(3) : ""}</span>
                    </div>
                  ))}
                </div>
              </ApPanel>

              {/* Experiment prioritization (P174) */}
              <ApPanel>
                <ApPanelHead kicker="P174 · 실험 우선순위화" title="다음 추천"
                  right={<ApBadge tone="hud">{ep?.recommendations.length ?? 0}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {(ep?.recommendations ?? []).slice(0, 6).map((r, i) => (
                    <div key={i} className="bg-ap-bg rounded-ap-md p-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-ap-ink-1 truncate">{r.statement}</span>
                      <span className="text-[11px] font-data text-ap-brand">{r.composite_score.toFixed(3)}</span>
                    </div>
                  ))}
                  <div className="text-[11px] text-ap-ink-3 pt-1">추천만 — 사람이 다음 실험을 결정.</div>
                </div>
              </ApPanel>

              {/* Planning (P177) */}
              <ApPanel>
                <ApPanelHead kicker="P177 · 기관 차원 계획" title="의제 & 로드맵" />
                <div className="p-4 space-y-2">
                  {Object.entries(data.research_planning ?? {}).map(([horizon, plan]) => (
                    <div key={horizon} className="bg-ap-bg rounded-ap-md p-2.5">
                      <div className="text-[11px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">{horizon}</div>
                      {(plan.agenda ?? []).slice(0, 3).map((a, i) => <div key={i} className="text-xs text-ap-ink-2 truncate">· {a.item}</div>)}
                      {(plan.roadmap ?? []).map((r, i) => <div key={i} className="text-xs text-ap-ink-2 truncate">Q{r.quarter_slot}: {r.theme}</div>)}
                    </div>
                  ))}
                </div>
              </ApPanel>

              {/* Productivity (P179) + Reflection (P176) */}
              <ApPanel>
                <ApPanelHead kicker="P179 · 생산성 + P176 · 회고" title="지표 & 교훈" />
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.productivity?.metrics ?? {}).slice(0, 6).map(([k, m]) => (
                      <div key={k} className="bg-ap-bg rounded-ap-md p-2">
                        <div className="text-[11px] tracking-[0.15em] text-ap-ink-3 uppercase truncate">{k}</div>
                        <div className="text-[13px] font-data text-ap-ink-1">{String(m.value ?? "—")}</div>
                      </div>
                    ))}
                  </div>
                  {(data.productivity?.recommendations ?? []).slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <ApBadge tone={PRIO_TONE[r.priority] ?? "mute"}>{r.priority}</ApBadge>
                      <span className="text-xs text-ap-ink-2 flex-1 truncate">{r.recommendation}</span>
                    </div>
                  ))}
                  {(data.self_reflection?.test_next ?? []).slice(0, 2).map((t, i) => (
                    <div key={`r${i}`} className="text-xs text-ap-ink-3">↳ 다음: {t}</div>
                  ))}
                </div>
              </ApPanel>

              {/* Autonomy validation (P180) */}
              <ApPanel>
                <ApPanelHead kicker="P180 · 자율성 검증" title="안전성 & 재사용 감사"
                  right={av && <ApBadge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</ApBadge>} />
                <div className="p-4 space-y-1.5">
                  {(av?.checks ?? []).map((c) => (
                    <div key={c.check} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                      <span className="text-xs text-ap-ink-1 flex-1">{c.check}</span>
                    </div>
                  ))}
                </div>
                {(av?.remaining_limitations ?? []).length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="text-[11px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">남은 제약사항</div>
                    {(av?.remaining_limitations ?? []).map((l, i) => <div key={i} className="text-xs text-ap-ink-3">· {l}</div>)}
                  </div>
                )}
              </ApPanel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
