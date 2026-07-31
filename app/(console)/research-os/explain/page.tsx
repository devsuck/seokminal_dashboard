"use client";
// P71 — Explainability Visualization. 증거 사슬(Experiment→…→Recommendation) 인터랙티브 그래프 + 신뢰도 분해.
// /console/explainability 실데이터. 블랙박스 아님 · READ ONLY · 결정은 사람.
import { useState, useCallback } from "react";
import { getExplainability, type ExplainabilityResp, type EvidenceNode } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const CONF_C = (c?: string) => (c === "HIGH" ? "var(--c-pos)" : c === "LOW" ? "var(--c-warn)" : "var(--c-hud)");

export default function ExplainViz() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<ExplainabilityResp | null>(null);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (topic: string) => {
    if (!topic.trim()) return;
    setLoading(true); setErr(null);
    try { const d = await getExplainability(topic); setData(d); setSel(d.chain.length - 1); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const node: EvidenceNode | undefined = data?.chain[sel];
  return (
    <div className="min-h-full">
      <PageHeader kicker="P71" title="설명 가능성"
        right={data?.confidence && <Badge tone={data.confidence === "HIGH" ? "pos" : data.confidence === "LOW" ? "warn" : "hud"}>신뢰도 {data.confidence}</Badge>} />
      <div className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="결론을 설명할 주제… (예: momentum)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading || !q.trim()}
            className="px-4 h-10 text-[11px] font-semibold tracking-wide uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-hud)_18%,transparent)] disabled:opacity-40 cursor-pointer transition-colors">
            {loading ? "…" : "설명"}
          </button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && data.chain.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 증거 사슬 그래프 */}
            <div className="lg:col-span-2">
              <Panel>
                <PanelHead kicker="증거 사슬" title="질문 → 권고" />
                <div className="p-4">
                  {data.chain.map((n, i) => {
                    const active = i === sel;
                    const isLast = i === data.chain.length - 1;
                    const c = isLast ? CONF_C(data.confidence) : "var(--c-hud)";
                    return (
                      <div key={i} className="relative">
                        <button onClick={() => setSel(i)}
                          className={`w-full text-left flex items-start gap-3 p-2.5 transition-colors cursor-pointer border ${active ? "" : "border-transparent hover:bg-[var(--c-panel-2)]"}`}
                          style={active ? { borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` } : undefined}>
                          <span className="mt-0.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: active ? `0 0 8px ${c}` : "none" }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold" style={{ color: active ? c : "var(--c-text-1)" }}>{n.stage}</div>
                            <div className="text-[10px] text-[var(--c-text-3)] truncate">{n.label}</div>
                          </div>
                        </button>
                        {!isLast && <div className="ml-[13px] h-3 w-px bg-[var(--c-border)]" />}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* 노드 상세 + 신뢰도 분해 + 반증 */}
            <div className="lg:col-span-3 space-y-4">
              {node && (
                <Panel>
                  <PanelHead kicker={`노드 ${sel + 1}/${data.chain.length}`} title={node.stage} />
                  <div className="p-4 space-y-2">
                    <div className="text-[12px] text-[var(--c-text-1)]">{node.label}</div>
                    {(node.refs ?? []).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1">참조</div>
                        {node.refs!.map((r, i) => <span key={i} className="inline-block mr-1.5 mb-1 text-[10px] c-num text-[var(--c-hud)]">{r}</span>)}
                      </div>
                    )}
                  </div>
                </Panel>
              )}

              {/* 신뢰도 분해 */}
              <Panel>
                <PanelHead kicker="신뢰도" title="분해"
                  right={<Badge tone={data.confidence === "HIGH" ? "pos" : data.confidence === "LOW" ? "warn" : "hud"}>{data.confidence}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(data.confidence_breakdown ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-[var(--c-border)] last:border-0">
                      <span className="text-[10.5px] text-[var(--c-text-3)]">{k.replace(/_/g, " ")}</span>
                      <span className="text-[10.5px] c-num text-[var(--c-text-1)]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* 왜 이 결론 / 왜 틀릴 수 있나 / 대안 / 누락 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel>
                  <PanelHead kicker="이유" title="이 결론인 이유" />
                  <div className="p-4 text-[10.5px] text-[var(--c-text-2)] leading-relaxed">{data.why_this_conclusion}</div>
                </Panel>
                <Panel>
                  <PanelHead kicker="이유" title="틀릴 수 있는 이유" />
                  <div className="p-4 space-y-1">
                    {(data.why_it_may_be_wrong ?? []).map((w, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {w}</div>)}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="대안" title="대안적 관점" />
                  <div className="p-4 space-y-1">
                    {(data.alternative_interpretations ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {a}</div>)}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="공백" title="누락된 증거" />
                  <div className="p-4 space-y-1">
                    {(data.missing_evidence ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">—</div>}
                    {(data.missing_evidence ?? []).map((m, i) => <div key={i} className="text-[10.5px] text-[var(--c-neg)]">· {m}</div>)}
                  </div>
                </Panel>
              </div>
              <div className="text-[10px] text-[var(--c-text-3)]">증거 사슬 — 블랙박스 결정이 아니라 추적 가능한 근거. 최종 결정은 사람.</div>
            </div>
          </div>
        )}
        {!data && !loading && (
          <div className="c-panel p-8 text-center text-[12px] text-[var(--c-text-3)]">
            주제를 입력하면 Experiment → Validation → Failure → Memory → Council → Portfolio → Risk → Recommendation 증거 사슬을 시각화합니다.
          </div>
        )}
      </div>
    </div>
  );
}
