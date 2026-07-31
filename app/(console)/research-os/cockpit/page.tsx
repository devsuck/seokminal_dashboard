"use client";
// P85 — Executive Research Cockpit. 모든 역량의 통합 홈. /console/cockpit 실데이터.
// READ ONLY · 분석/요약/추천만, 자동 거래·집행·자본배분 없음. 사람이 모든 결정을 한다.
import { getCockpit, type CockpitResp } from "@/lib/console-api";
import { PageHeader, useConsole, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";

const CONF: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const num = (n: number | undefined | null, d = 0) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d }));
const bandTone = (b?: string) => (b === "HEALTHY" ? "pos" : b === "FAIR" ? "hud" : "warn");
const STAGE_TONE: Record<string, string> = {
  Idea: "var(--c-text-3)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-hud)",
  Backtest: "var(--c-hud)", Validation: "var(--c-pos)", Failure: "var(--c-neg)",
  Lesson: "var(--c-emerald)", "Portfolio Effect": "var(--c-blue)", "Decision Memo": "var(--c-warn)",
  "Human Review": "var(--c-warn)", Archive: "var(--c-text-3)", Risk: "var(--c-neg)", Paper: "var(--c-blue)",
};

export default function Cockpit() {
  const { data, err, loading } = useConsole<CockpitResp>((s) => getCockpit(s), [], 60000);
  return (
    <div className="min-h-full">
      <PageHeader kicker="P85" title="리서치 콕핏"
        right={data && <Badge tone={bandTone(data.research_health?.health_band)}>헬스 {num(data.health_score, 1)}</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
          <div className="p-5 space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatTile label="리서치 레코드" value={num(data.research?.total_records)} accent="hud"
                sub={`${num(data.research?.experiment_runs)}건 실행`} />
              <StatTile label="헬스 점수" value={num(data.health_score, 1)} accent={bandTone(data.research_health?.health_band)}
                tone={bandTone(data.research_health?.health_band) === "pos" ? "pos" : "warn"} sub={data.research_health?.health_band} />
              <StatTile label="검토 대기" value={data.human_review_queue?.length ?? 0} accent="warn" tone="warn" />
              <StatTile label="지식" value={num(data.knowledge_growth?.total)} accent="pos"
                sub={`${num(data.knowledge_graph?.node_count)}개 그래프 노드`} />
              <StatTile label="기회" value={data.top_opportunities?.length ?? 0} accent="info" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Current Loop */}
              <Panel>
                <PanelHead kicker="P72" title="현재 루프"
                  right={data.current_loop?.requires_human_checkpoint && <Badge tone="hud">체크포인트</Badge>} />
                <div className="p-4">
                  {!data.current_loop?.loop_id && <div className="text-[11px] text-[var(--c-text-3)]">진행 중 자율 루프 없음.</div>}
                  {data.current_loop?.loop_id && (
                    <>
                      <div className="text-[12px] font-medium text-[var(--c-text-1)]">{data.current_loop.idea}</div>
                      <KV k="현재 단계" v={data.current_loop.current_stage} />
                      {data.current_loop.blocked_stage && <KV k="차단" v={data.current_loop.blocked_stage} />}
                      <KV k="완료" v={`${data.current_loop.completed?.length ?? 0}/9`} />
                    </>
                  )}
                </div>
              </Panel>
              {/* Health coverage */}
              <Panel>
                <PanelHead kicker="P81" title="리서치 헬스" right={<Badge tone={bandTone(data.research_health?.health_band)}>{data.research_health?.trend}</Badge>} />
                <div className="p-4 space-y-2">
                  {Object.entries(data.research_health?.coverage ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-[10.5px] mb-1">
                        <span className="text-[var(--c-text-2)]">{k} 커버리지</span>
                        <span className="c-num text-[var(--c-text-3)]">{Math.round((v as number) * 100)}%</span>
                      </div>
                      <Meter value={v as number} tone="hud" />
                    </div>
                  ))}
                  <KV k="속도" v={data.research_health?.research_velocity} />
                  <KV k="미완료" v={data.research_health?.incomplete_research} />
                </div>
              </Panel>
              {/* Highest risks */}
              <Panel>
                <PanelHead kicker="P62" title="최고 리스크" right={<Badge tone="warn">{data.highest_risks?.top_category ?? "—"}</Badge>} />
                <div className="p-4 space-y-2">
                  {Object.entries(data.highest_risks?.by_category ?? {}).slice(0, 6).map(([c, n]) => {
                    const max = Math.max(1, ...Object.values(data.highest_risks?.by_category ?? { x: 1 }));
                    return (
                      <div key={c}>
                        <div className="flex justify-between text-[10.5px] mb-1"><span className="text-[var(--c-text-2)]">{c}</span><span className="c-num text-[var(--c-text-3)]">{n}</span></div>
                        <Meter value={(n as number) / max} tone="warn" />
                      </div>
                    );
                  })}
                  {!data.highest_risks?.total_failures && <div className="text-[11px] text-[var(--c-text-3)]">기록된 실패 없음.</div>}
                </div>
              </Panel>
            </div>

            {/* Timeline */}
            <Panel>
              <PanelHead kicker="P78" title="리서치 타임라인" right={<Badge tone="mute">{data.timeline?.length ?? 0}</Badge>} />
              <div className="p-4">
                {(!data.timeline || data.timeline.length === 0) && <div className="text-[11px] text-[var(--c-text-3)]">원장에서 재구성할 이벤트 없음(연구가 기록되면 채워집니다).</div>}
                <div className="flex flex-wrap gap-1.5">
                  {(data.timeline ?? []).map((e, i) => {
                    const c = STAGE_TONE[e.stage] ?? "var(--c-text-3)";
                    return (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1" title={`${e.stage}: ${e.label}`}
                        style={{ border: `1px solid color-mix(in srgb, ${c} 35%, transparent)`, background: `color-mix(in srgb, ${c} 7%, transparent)` }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                        <span className="text-[9.5px] font-semibold uppercase" style={{ color: c }}>{e.stage}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-text-3)] truncate max-w-[120px]">{e.ref}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Opportunities */}
              <Panel>
                <PanelHead kicker="P58" title="상위 기회" right={<Badge tone="pos">{data.top_opportunities?.length ?? 0}</Badge>} />
                <div className="p-4 space-y-2">
                  {(data.top_opportunities ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">메모리가 채워지면 후보가 제안됩니다.</div>}
                  {(data.top_opportunities ?? []).map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 c-panel-2 p-2.5">
                      <span className="text-[11.5px] text-[var(--c-text-1)] truncate">{o.name}</span>
                      <div className="flex gap-1.5 shrink-0"><Badge tone={CONF[o.expected_value] ?? "mute"}>기대값 {o.expected_value}</Badge><Badge tone={CONF[o.confidence] ?? "mute"}>{o.confidence}</Badge></div>
                    </div>
                  ))}
                </div>
              </Panel>
              {/* Human review + quick resume + exposure */}
              <div className="space-y-4">
                <Panel>
                  <PanelHead kicker="사람" title="사람 검토 큐" right={<Badge tone="warn">{data.human_review_queue?.length ?? 0}</Badge>} />
                  <div className="p-4 space-y-1.5">
                    {(data.human_review_queue ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">검토 대기 없음.</div>}
                    {(data.human_review_queue ?? []).map((h) => (
                      <div key={h.run_id} className="text-[11px] text-[var(--c-text-2)] truncate">· {h.request}</div>
                    ))}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="P66" title="빠른 재개" />
                  <div className="p-4 space-y-1.5">
                    {(data.quick_resume ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">재개할 세션 없음.</div>}
                    {(data.quick_resume ?? []).map((s) => (
                      <div key={s.session_id} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--c-text-1)] truncate">{s.goal}</span>
                        <Badge tone={s.state === "ACTIVE" ? "pos" : "warn"}>{s.state}</Badge>
                      </div>
                    ))}
                  </div>
                </Panel>
                <div className="grid grid-cols-3 gap-3">
                  <StatTile label="페이퍼 자본" value={`$${num(data.portfolio_exposure?.capital)}`} />
                  <StatTile label="노출" value={`$${num(data.portfolio_exposure?.gross_exposure)}`} />
                  <StatTile label="포지션" value={data.portfolio_exposure?.n_positions ?? 0} />
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </div>
        )}
      </StateBlock>
    </div>
  );
}
