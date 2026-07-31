"use client";
// P101-110 — Research Validation Dashboard. Lifecycle Board / Validation / Quality / Review Queue.
// /console/validation-loop. READ ONLY · Market Event→Trigger→…→Validation→Memory. 자동 거래·집행 없음.
import { useEffect, useState } from "react";
import { getValidationLoop, type ValidationLoopResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const STATE_TONE: Record<string, string> = {
  DISCOVERED: "var(--c-text-3)", HYPOTHESIS: "var(--c-blue)", EXPERIMENT: "var(--c-hud)",
  BACKTEST: "var(--c-emerald)", PAPER: "var(--c-warn)", REVIEW: "var(--c-warn)", ARCHIVED: "var(--c-text-3)",
};
const EV_TONE: Record<string, "pos" | "hud" | "neg" | "warn" | "blue" | "mute"> = {
  NEW_HYPOTHESIS: "blue", BACKTEST_COMPLETED: "hud", VALIDATION_FAILED: "neg",
  PAPER_DIVERGENCE: "warn", HUMAN_REVIEW_REQUIRED: "warn",
};
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

export default function ValidationLoop() {
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
