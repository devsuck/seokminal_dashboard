"use client";
// P161-170 — Committee & Production Readiness. Overview/Committee/Debate/Conviction/Portfolio/Governance/Production/Metrics/Review.
// /console/production-readiness. READ ONLY · 위원회·거버넌스·모니터링 · BUY/SELL/EXECUTE/ALLOCATE 없음.
import { useCallback, useEffect, useState } from "react";
import { getProductionReadiness, type ProductionReadinessResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const SEV_TONE: Record<string, "pos" | "warn" | "neg"> = { OK: "pos", WARNING: "warn", CRITICAL: "neg" };
const CONV_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };

export default function ProductionReadiness() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<ProductionReadinessResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    setErr(null);
    try { setData(await getProductionReadiness(query)); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); }, [run]);

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
