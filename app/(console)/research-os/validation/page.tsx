"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
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
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
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
const EV_TONE: Record<string, "pos" | "hud" | "neg" | "warn" | "blue" | "mute"> = {
  NEW_HYPOTHESIS: "blue", BACKTEST_COMPLETED: "hud", VALIDATION_FAILED: "neg",
  PAPER_DIVERGENCE: "warn", HUMAN_REVIEW_REQUIRED: "warn",
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
    <div className="min-h-full">
      <PageHeader kicker="P101-110" title="리서치 검증 루프"
        right={ls && <div className="flex gap-1.5">
          <Badge tone={ls.loop_complete ? "pos" : "mute"}>{ls.loop_complete ? "루프 완료" : "루프"}</Badge>
          <Badge tone={ls.safe ? "pos" : "neg"}>{ls.safe ? "안전" : "위험"}</Badge>
          <Badge tone={ls.release_ready ? "pos" : "warn"}>v2.0 {ls.release_ready ? "준비완료" : "대기중"}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {ls && <div className="flex flex-wrap gap-1.5">{ls.capabilities.map((c) => <Badge key={c} tone="hud">{c}</Badge>)}</div>}

        {data && (
          <>
            {/* 1. Strategy Lifecycle Board */}
            <Panel>
              <PanelHead kicker="1 · 라이프사이클" title="전략 라이프사이클 보드"
                right={<Badge tone="hud">전략 {data.lifecycle_board.count}개</Badge>} />
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {data.lifecycle_board.lifecycle.map((s) => (
                    <span key={s} className="text-[9px] uppercase c-num px-1.5 py-0.5 border border-[var(--c-border)]"
                      style={{ color: STATE_TONE[s] ?? "var(--c-text-3)" }}>{s}</span>
                  ))}
                </div>
                {data.lifecycle_board.strategies.length === 0 && (
                  <div className="text-[11px] text-[var(--c-text-3)]">연구가 원장에 기록되면 전략별 생애주기가 나타납니다(기존 원장 파생).</div>
                )}
                <div className="space-y-1.5">
                  {data.lifecycle_board.strategies.map((row) => (
                    <div key={row.strategy} className="c-panel-2 p-2.5 flex items-center gap-3">
                      <span className="text-[11.5px] font-medium text-[var(--c-text-1)] w-40 truncate">{row.strategy}</span>
                      <div className="flex items-center gap-1 flex-1 flex-wrap">
                        {row.checklist.map((c) => (
                          <span key={c.state} title={c.state}
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: c.current ? 22 : 14,
                              background: c.done ? (STATE_TONE[c.state] ?? "var(--c-hud)") : "var(--c-border)",
                              boxShadow: c.current ? `0 0 6px ${STATE_TONE[c.state] ?? "var(--c-hud)"}` : "none" }} />
                        ))}
                      </div>
                      <Badge tone="hud">{row.current_state}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 2. Validation Panel */}
              <Panel>
                <PanelHead kicker="2 · 검증" title="백테스트 vs 페이퍼"
                  right={vp && <Badge tone={vp.divergence_detected ? "neg" : "pos"}>{vp.status}</Badge>} />
                <div className="p-4 space-y-3">
                  {vp?.is_demo && <div className="text-[9.5px] text-[var(--c-text-3)] uppercase tracking-[0.15em]">데모 · 데이터 소스 연결 시 실데이터</div>}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="text-[9px] text-[var(--c-text-3)] uppercase">지표</div>
                    <div className="text-[9px] text-[var(--c-text-3)] uppercase">백테스트</div>
                    <div className="text-[9px] text-[var(--c-text-3)] uppercase">페이퍼</div>
                    {Object.entries(vp?.tracked_metrics ?? {}).map(([k, m]) => (
                      <div key={k} className="contents">
                        <div className="text-[10.5px] text-[var(--c-text-2)] text-left">{k}</div>
                        <div className="text-[10.5px] c-num text-[var(--c-text-1)]">{fmt(m.expected)}</div>
                        <div className="text-[10.5px] c-num" style={{ color: (m.gap ?? 0) < 0 ? "var(--c-neg)" : "var(--c-text-1)" }}>{fmt(m.actual)}</div>
                      </div>
                    ))}
                  </div>
                  {vp?.possible_causes && vp.possible_causes.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">가능한 원인</div>
                      {vp.possible_causes.map((c, i) => (
                        <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· <span className="text-[var(--c-warn)]">{c.cause}</span> — {c.why}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>

              {/* 3. Quality Panel */}
              <Panel>
                <PanelHead kicker="3 · 품질" title="리서치 품질"
                  right={qp && <Badge tone={qp.grade === "A" || qp.grade === "B" ? "pos" : "warn"}>등급 {qp.grade}</Badge>} />
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <StatTile label="품질 점수" value={fmt(qp?.quality_score)} tone={((qp?.quality_score ?? 0) >= 65) ? "pos" : "warn"} />
                    <StatTile label="게이트" value={qp?.gate === "ACCEPT" ? "ACCEPT" : "증거 필요"} tone={qp?.gate === "ACCEPT" ? "pos" : "warn"} />
                  </div>
                  <div className="space-y-1">
                    {Object.entries(qp?.core_dimensions ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[10.5px] text-[var(--c-text-2)] w-40">{k}</span>
                        <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((v as number) * 100)}%`,
                            background: (v as number) >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} />
                        </div>
                        <span className="text-[10px] c-num text-[var(--c-text-3)] w-8 text-right">{(v as number).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {qp?.weaknesses && qp.weaknesses.length > 0 && (
                    <div className="text-[10px] text-[var(--c-warn)]">약점: {qp.weaknesses.join(", ")}</div>
                  )}
                  {qp?.missing_validations && qp.missing_validations.length > 0 && (
                    <div className="text-[10px] text-[var(--c-text-3)]">누락된 증거: {qp.missing_validations.join(", ")}</div>
                  )}
                </div>
              </Panel>
            </div>

            {/* 4. Review Queue */}
            <Panel>
              <PanelHead kicker="4 · 검토 대기열" title="필요한 사람 조치"
                right={<Badge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</Badge>} />
              <div className="p-4 space-y-1.5">
                {data.review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토가 필요한 운영 이벤트가 없습니다(원장 파생). 검증 실패·페이퍼 괴리·결정 대기 시 여기에 표시됩니다.</div>}
                {data.review_queue.map((e, i) => (
                  <div key={i} className="c-panel-2 p-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--c-text-1)] truncate">{e.label || e.ref}</span>
                    <div className="flex gap-1.5 shrink-0"><Badge tone={EV_TONE[e.event_type] ?? "mute"}>{e.event_type}</Badge><span className="text-[9px] c-num text-[var(--c-text-3)]">{e.source}</span></div>
                  </div>
                ))}
                {Object.keys(data.ops_by_type).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">{Object.entries(data.ops_by_type).map(([k, n]) => <span key={k} className="text-[9px] c-num text-[var(--c-text-3)] px-1.5 py-0.5 border border-[var(--c-border)]">{k}: {n}</span>)}</div>
                )}
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- production/page.tsx (P161-170 — Committee & Production Readiness. Overview/Committee/Debate/Conviction/Portfolio/Governance/Production/Metrics/Review.) ----
// /console/production-readiness. READ ONLY · 위원회·거버넌스·모니터링 · BUY/SELL/EXECUTE/ALLOCATE 없음.

const SEV_TONE: Record<string, "pos" | "warn" | "neg"> = { OK: "pos", WARNING: "warn", CRITICAL: "neg" };
const CONV_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };

function ProductionTab() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<ProductionReadinessResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    try { const d = await getProductionReadiness(query, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); return () => abortRef.current?.abort(); }, [run]);

  const ov = data?.institutional_overview;
  const cp = data?.committee_packet;
  const cv = data?.conviction;
  const gov = data?.governance_status;
  const prod = data?.production_health;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P161-170 · v2.0" title="위원회 & 프로덕션"
        right={ov && <div className="flex gap-1.5">
          <Badge tone={ov.release_ready ? "pos" : "warn"}>{ov.release_ready ? "릴리스 준비완료" : "v2.0"}</Badge>
          {ov.architecture_frozen && <Badge tone="hud">고정됨</Badge>}
        </div>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">소집</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="v2.0 릴리스" value={ov?.release_ready ? "준비완료" : "대기중"} sub={ov?.architecture_frozen ? "아키텍처 고정됨" : ""} tone={ov?.release_ready ? "pos" : "warn"} />
              <StatTile label="확신도" value={cv?.level ?? "—"} sub={`점수 ${cv?.score ?? 0}`} tone={CONV_TONE[cv?.level ?? ""] === "warn" ? "warn" : "pos"} />
              <StatTile label="거버넌스" value={gov?.governance ?? "—"} sub={`${gov?.checks.filter((c) => c.ok).length ?? 0}/${gov?.checks.length ?? 0} 항목`} tone={gov?.passed ? "pos" : "warn"} />
              <StatTile label="프로덕션" value={prod?.overall_severity ?? "—"} sub={`${prod?.counts?.OK ?? 0} OK · ${prod?.counts?.WARNING ?? 0} 경고`} tone={SEV_TONE[prod?.overall_severity ?? ""] ?? "warn"} />
            </div>
            {ov && <div className="flex flex-wrap gap-1.5">{ov.capabilities.map((c) => <Badge key={c} tone="hud">{c}</Badge>)}</div>}

            {/* Committee Packet */}
            <Panel>
              <PanelHead kicker="위원회 패킷" title={cp?.research_summary?.slice(0, 70) || "—"} right={<Badge tone={CONV_TONE[cp?.confidence ?? ""] ?? "mute"}>확신 {cp?.confidence}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">사람에게 질문</div>
                  {(cp?.questions_for_human ?? []).map((qq, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {qq}</div>)}
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">제한사항</div>
                  {(cp?.limitations ?? []).map((l, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-3)]">· {l}</div>)}
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Debate */}
              <Panel>
                <PanelHead kicker="토론 패널" title="강세 / 약세 / 리스크" />
                <div className="p-4 space-y-2">
                  <div className="c-panel-2 p-2.5"><Badge tone="pos">강세</Badge><div className="text-[10.5px] text-[var(--c-text-2)] mt-1">{(data.debate.bull_case.evidence ?? []).slice(0, 2).map((e) => String(e)).join("; ") || "—"}</div></div>
                  <div className="c-panel-2 p-2.5"><Badge tone="neg">약세</Badge><div className="text-[10.5px] text-[var(--c-text-2)] mt-1">{(data.debate.bear_case.evidence ?? []).slice(0, 3).map((e) => String(e)).join("; ") || "—"}</div></div>
                  {data.debate.historical_counterexamples.length > 0 && <div className="c-panel-2 p-2.5"><Badge tone="warn">반례</Badge>{data.debate.historical_counterexamples.map((c, i) => <div key={i} className="text-[10px] text-[var(--c-text-3)] mt-1">{c.topic}: {c.study_a} vs {c.study_b} — {c.explanation}</div>)}</div>}
                </div>
              </Panel>

              {/* Conviction factors */}
              <Panel>
                <PanelHead kicker="확신도" title="연구 확신도" right={cv && <Badge tone={CONV_TONE[cv.level] ?? "mute"}>{cv.level}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(cv?.factors ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-2)] w-44">{k}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: v >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-3)] w-8 text-right">{v.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">연구 확신도 — 투자 등급 아님.</div>
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Governance */}
              <Panel>
                <PanelHead kicker="거버넌스" title="컴플라이언스" right={gov && <Badge tone={gov.passed ? "pos" : "warn"}>{gov.governance}</Badge>} />
                <div className="p-4 space-y-1">
                  {(gov?.checks ?? []).map((c) => (
                    <div key={c.check} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                      <span className="text-[10.5px] text-[var(--c-text-1)] w-44">{c.check}</span>
                      <span className="text-[9px] text-[var(--c-text-3)] flex-1 truncate">{c.detail}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Production Health */}
              <Panel>
                <PanelHead kicker="프로덕션 헬스" title="컴포넌트" right={prod && <Badge tone={SEV_TONE[prod.overall_severity] ?? "mute"}>{prod.overall_severity}</Badge>} />
                <div className="p-4 space-y-1">
                  {(prod?.components ?? []).map((c) => (
                    <div key={c.component} className="flex items-center gap-2">
                      <Badge tone={SEV_TONE[c.severity] ?? "mute"}>{c.severity}</Badge>
                      <span className="text-[10.5px] text-[var(--c-text-1)] w-40">{c.component}</span>
                      <span className="text-[9px] text-[var(--c-text-3)] flex-1 truncate">{c.detail}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Portfolio Research + Review Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel>
                <PanelHead kicker="포트폴리오 리서치" title="전략 헬스" right={<Badge tone="hud">{data.portfolio_research.strategy_health.length}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {data.portfolio_research.strategy_health.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">전략이 축적되면 노출·중첩·상관 뷰가 나타납니다(배분 아님).</div>}
                  {data.portfolio_research.strategy_health.map((s) => (
                    <div key={s.strategy} className="flex items-center gap-2"><span className="text-[10.5px] text-[var(--c-text-1)] w-36 truncate">{s.strategy}</span><div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.health_score}%`, background: s.health_score >= 65 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>{s.review_needed && <Badge tone="warn">검토</Badge>}</div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">배분 제안 아님 — 연구 관점.</div>
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="검토 대기열" title="휴먼 액션" right={<Badge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {data.review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토 대기 항목 없음.</div>}
                  {data.review_queue.map((r, i) => <div key={i} className="c-panel-2 p-2.5 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--c-text-1)] truncate">{r.task}</span><span className="text-[9px] c-num text-[var(--c-text-3)]">{r.source}</span></div>)}
                </div>
              </Panel>
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- intelligence-plus/page.tsx (P171-180 — Autonomous Research Intelligence Enhancement.) ----
// Creative hypotheses · search tree · continuous queue · prioritization · planning · productivity · reflection · autonomy validation.
// /console/research-intelligence. READ ONLY · 연구 자동 실행 없음 · 자율 승인 없음 · BUY/SELL/EXECUTE/ALLOCATE 없음.

const PRIO_TONE: Record<string, "pos" | "warn" | "neg"> = { LOW: "pos", MEDIUM: "warn", HIGH: "neg" };

function IntelligencePlusTab() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<ResearchIntelligenceResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    try { const d = await getResearchIntelligence(query, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); return () => abortRef.current?.abort(); }, [run]);

  const ch = data?.creative_hypotheses;
  const cq = data?.continuous_queue;
  const ep = data?.experiment_prioritization;
  const av = data?.autonomy_validation;
  const cov = ep?.coverage_context;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P171-180 · 인텔리전스 강화" title="자율 연구 인텔리전스"
        right={av && <div className="flex gap-1.5">
          <Badge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</Badge>
          <Badge tone="hud">재사용 {av.reuse_count}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">탐색</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="창의적 가설" value={String(ch?.count ?? 0)} sub={`소스 ${(ch?.diversity?.sources ?? []).length}개`} tone="hud" />
              <StatTile label="리서치 큐" value={String(cq?.queue_size ?? 0)} sub="상시 백로그" tone="pos" />
              <StatTile label="지식 커버리지" value={cov?.research_coverage != null ? `${Math.round(cov.research_coverage * 100)}%` : "—"} sub={`공백 ${cov?.knowledge_gap != null ? Math.round(cov.knowledge_gap * 100) : 0}%`} tone="warn" />
              <StatTile label="자율성 감사" value={av?.validated ? "통과" : "검토 필요"} sub={`중복 ${av?.duplicated_logic.length ?? 0} · 재사용 ${av?.reuse_count ?? 0}`} tone={av?.validated ? "pos" : "warn"} />
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>

            {/* Creative hypotheses (P171) */}
            <Panel>
              <PanelHead kicker="P171 · 창의적 가설 발굴" title="다중 소스 가설"
                right={ch && <Badge tone="hud">{ch.count}</Badge>} />
              <div className="p-4 space-y-2">
                {(ch?.hypotheses ?? []).slice(0, 6).map((h) => (
                  <div key={h.hypothesis_id} className="c-panel-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{h.statement}</span>
                      <Badge tone="mute">{h.source}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>참신성 {h.novelty_score.toFixed(2)}</span>
                      <span>불확실성 {h.uncertainty.toFixed(2)}</span>
                      <span>신뢰도 {h.confidence}</span>
                      <span>과거 연구 {h.similar_historical_research.prior_research_count}</span>
                      {h.similar_historical_research.tried_before && <span className="text-[var(--c-warn)]">이전 시도됨</span>}
                      <span>상충 {h.conflicting_evidence.count}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.required_validation.slice(0, 5).map((v) => <span key={v} className="text-[8.5px] px-1.5 py-0.5 border border-[var(--c-border)] text-[var(--c-text-3)]">{v}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Continuous queue (P173) */}
              <Panel>
                <PanelHead kicker="P173 · 상시 리서치 큐" title="우선순위 백로그"
                  right={cq && <Badge tone="pos">{cq.queue_size}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(cq?.by_source ?? {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(cq?.by_source ?? {}).map(([s, n]) => <Badge key={s} tone="mute">{s} {n}</Badge>)}
                    </div>
                  )}
                  {(cq?.backlog ?? []).slice(0, 8).map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] c-num text-[var(--c-text-3)] w-5">{b.rank ?? i + 1}</span>
                      <span className="text-[10.5px] text-[var(--c-text-1)] flex-1 truncate">{b.statement}</span>
                      <span className="text-[9px] c-num text-[var(--c-hud)]">{typeof b.score === "number" ? b.score.toFixed(3) : ""}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Experiment prioritization (P174) */}
              <Panel>
                <PanelHead kicker="P174 · 실험 우선순위화" title="다음 추천"
                  right={<Badge tone="hud">{ep?.recommendations.length ?? 0}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {(ep?.recommendations ?? []).slice(0, 6).map((r, i) => (
                    <div key={i} className="c-panel-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-[var(--c-text-1)] truncate">{r.statement}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{r.composite_score.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">추천만 — 사람이 다음 실험을 결정.</div>
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Planning (P177) */}
              <Panel>
                <PanelHead kicker="P177 · 기관 차원 계획" title="의제 & 로드맵" />
                <div className="p-4 space-y-2">
                  {Object.entries(data.research_planning ?? {}).map(([horizon, plan]) => (
                    <div key={horizon} className="c-panel-2 p-2.5">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">{horizon}</div>
                      {(plan.agenda ?? []).slice(0, 3).map((a, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)] truncate">· {a.item}</div>)}
                      {(plan.roadmap ?? []).map((r, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)] truncate">Q{r.quarter_slot}: {r.theme}</div>)}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Productivity (P179) + Reflection (P176) */}
              <Panel>
                <PanelHead kicker="P179 · 생산성 + P176 · 회고" title="지표 & 교훈" />
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.productivity?.metrics ?? {}).slice(0, 6).map(([k, m]) => (
                      <div key={k} className="c-panel-2 p-2">
                        <div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase truncate">{k}</div>
                        <div className="text-[12px] c-num text-[var(--c-text-1)]">{String(m.value ?? "—")}</div>
                      </div>
                    ))}
                  </div>
                  {(data.productivity?.recommendations ?? []).slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge tone={PRIO_TONE[r.priority] ?? "mute"}>{r.priority}</Badge>
                      <span className="text-[10px] text-[var(--c-text-2)] flex-1 truncate">{r.recommendation}</span>
                    </div>
                  ))}
                  {(data.self_reflection?.test_next ?? []).slice(0, 2).map((t, i) => (
                    <div key={`r${i}`} className="text-[10px] text-[var(--c-text-3)]">↳ 다음: {t}</div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Autonomy validation (P180) */}
            <Panel>
              <PanelHead kicker="P180 · 자율성 검증" title="안전성 & 재사용 감사"
                right={av && <Badge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                {(av?.checks ?? []).map((c) => (
                  <div key={c.check} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                    <span className="text-[10.5px] text-[var(--c-text-1)] flex-1">{c.check}</span>
                    <span className="text-[9px] text-[var(--c-text-3)]">{c.detail ?? ""}</span>
                  </div>
                ))}
              </div>
              {(av?.remaining_limitations ?? []).length > 0 && (
                <div className="px-4 pb-4">
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">남은 제약사항</div>
                  {(av?.remaining_limitations ?? []).map((l, i) => <div key={i} className="text-[10px] text-[var(--c-text-3)]">· {l}</div>)}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
