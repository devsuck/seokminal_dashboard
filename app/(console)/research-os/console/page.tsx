"use client";
// P70 — Hedge Fund Operating Console. 오늘의 연구·기회·리스크·이벤트·노출·페이퍼·세션·추천을 한 화면에.
// /console/operating-console 실데이터. READ ONLY · 분석/요약/추천만, 자동 거래·집행·자본배분 없음.
import { getOperatingConsole, type OperatingConsoleResp } from "@/lib/console-api";
import { PageHeader, useConsole, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";

const CONF_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const num = (n: number | undefined | null, d = 0) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d }));

export default function OperatingConsole() {
  const { data, err, loading } = useConsole<OperatingConsoleResp>((s) => getOperatingConsole(s), [], 60000);
  return (
    <div className="min-h-full">
      <PageHeader kicker="P70" title="운영 콘솔"
        right={data && <Badge tone="hud">{data.date}</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
          <div className="p-5 space-y-5">
            {/* 상단 KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="리서치 레코드" value={num(data.research.total_records)} accent="hud"
                sub={`${num(data.research.experiment_runs)}건 실행 · ${num(data.research.active_sources)}개 소스`} />
              <StatTile label="기회" value={data.opportunities.length} accent="pos"
                sub="오늘의 리서치 큐" tone="pos" />
              <StatTile label="열린 리스크" value={num(data.risks.total_failures)} accent="warn"
                tone="warn" sub={`상위: ${data.risks.top_category ?? "—"}`} />
              <StatTile label="활성 세션" value={data.sessions.active} accent="info"
                sub={`총 ${data.sessions.count}건`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 오늘의 기회 */}
              <Panel>
                <PanelHead kicker="P58" title="오늘의 기회" right={<Badge tone="pos">{data.opportunities.length}</Badge>} />
                <div className="p-4 space-y-2">
                  {data.opportunities.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">축적 메모리가 채워지면 연구 후보가 제안됩니다.</div>}
                  {data.opportunities.map((o, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--c-text-1)]">{o.name}</span>
                        <div className="flex gap-1.5 shrink-0">
                          <Badge tone={CONF_TONE[o.expected_value] ?? "mute"}>기대값 {o.expected_value}</Badge>
                          <Badge tone={CONF_TONE[o.confidence] ?? "mute"}>{o.confidence}</Badge>
                        </div>
                      </div>
                      <div className="text-[10.5px] text-[var(--c-text-3)] mt-1">{o.reason}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* 오늘의 리스크 */}
              <Panel>
                <PanelHead kicker="P62" title="오늘의 리스크" right={<Badge tone="warn">{data.risks.top_category ?? "—"}</Badge>} />
                <div className="p-4 space-y-3">
                  {Object.entries(data.risks.by_category ?? {}).slice(0, 6).map(([cat, n]) => {
                    const max = Math.max(1, ...Object.values(data.risks.by_category ?? { x: 1 }));
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-[10.5px] mb-1">
                          <span className="text-[var(--c-text-2)]">{cat}</span>
                          <span className="c-num text-[var(--c-text-3)]">{n}</span>
                        </div>
                        <Meter value={(n as number) / max} tone="warn" />
                      </div>
                    );
                  })}
                  {(data.risks.lessons ?? []).slice(0, 3).map((l, i) => (
                    <div key={i} className="text-[10px] text-[var(--c-text-3)] leading-snug">· {l}</div>
                  ))}
                  {!data.risks.total_failures && <div className="text-[11px] text-[var(--c-text-3)]">기록된 실패 없음.</div>}
                </div>
              </Panel>

              {/* 포트폴리오 노출 + 페이퍼 */}
              <Panel>
                <PanelHead kicker="P61·P63" title="노출 & 페이퍼 트레이딩" />
                <div className="p-4 space-y-2">
                  <KV k="페이퍼 자본" v={`$${num(data.exposure.capital)}`} />
                  <KV k="총 노출" v={`$${num(data.exposure.gross_exposure)} (${num(data.exposure.exposure_pct, 1)}%)`} />
                  <KV k="열린 포지션" v={data.exposure.n_positions ?? 0} />
                  <KV k="포트폴리오 가치" v={`$${num(data.paper.portfolio_value, 2)}`} />
                  <div className="mt-2"><Meter value={(data.exposure.exposure_pct ?? 0) / 100} tone="hud" /></div>
                  <div className="text-[10px] text-[var(--c-text-3)] mt-1">페이퍼 전용 — 라이브 브로커·집행·자본배분 없음.</div>
                </div>
              </Panel>

              {/* 이벤트 + 추천 */}
              <Panel>
                <PanelHead kicker="P60·P59" title="이벤트 & 추천" />
                <div className="p-4 space-y-3">
                  <KV k="공급망 맵" v={`${data.events.node_count ?? 0}개 노드 · ${data.events.edge_count ?? 0}개 엣지`} />
                  {data.recommendations.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">추천할 상위 기회 없음.</div>}
                  {data.recommendations.map((r, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="text-[11px] font-medium text-[var(--c-text-1)]">{r.topic}</div>
                      <div className="text-[10.5px] text-[var(--c-hud)] mt-1">{r.recommendation}</div>
                      {r.conflicts > 0 && <div className="text-[10px] text-[var(--c-warn)] mt-0.5">관점 상충 {r.conflicts}건 — 사람 검토</div>}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* 세션 */}
            <Panel>
              <PanelHead kicker="P66" title="활성 세션" right={<Badge tone="info">활성 {data.sessions.active}</Badge>} />
              <div className="p-4">
                {data.sessions.items.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">활성 세션 없음 — 워크플로 탭에서 세션을 시작하세요.</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.sessions.items.map((s) => (
                    <div key={s.session_id} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-[var(--c-text-1)] truncate">{s.goal}</span>
                        <Badge tone={s.state === "ACTIVE" ? "pos" : s.state === "PAUSED" ? "warn" : "mute"}>{s.state}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">
                        {s.pending_work.length}건 대기 · {s.completed_experiments.length}건 완료 · {s.open_questions.length}건 열린 질문
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </div>
        )}
      </StateBlock>
    </div>
  );
}
