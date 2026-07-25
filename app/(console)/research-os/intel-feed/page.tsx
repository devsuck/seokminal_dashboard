"use client";
// P96-100 — Market Intelligence Workspace. Live Event Feed / Impact Map / Opportunities / Market Context.
// /console/market-intel-feed. READ ONLY · DATA→EVENT→연구컨텍스트→사람검토. 자동 거래·집행·신호 없음.
import { useState, useCallback, useEffect } from "react";
import { getMarketIntelFeed, type MarketIntelFeedResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const REL_TONE: Record<string, string> = { HIGH: "var(--c-pos)", MEDIUM: "var(--c-hud)", LOW: "var(--c-text-3)" };
const CAT_TONE: Record<string, string> = { supplier: "var(--c-hud)", customer: "var(--c-blue)", competitor: "var(--c-neg)", sector: "var(--c-emerald)", related: "var(--c-text-3)", location: "var(--c-text-3)", peer: "var(--c-warn)", macro: "var(--c-blue)" };
const PRESETS = ["TSMC production issue", "NVIDIA supplier expands production", "Taiwan earthquake disrupts chip supply"];

export default function IntelFeed() {
  const [q, setQ] = useState("TSMC production issue");
  const [entity, setEntity] = useState("TSMC");
  const [data, setData] = useState<MarketIntelFeedResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (query: string, ent: string) => {
    setLoading(true); setErr(null);
    try { setData(await getMarketIntelFeed(query, ent)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { run("TSMC production issue", "TSMC"); }, [run]);

  const impact = data?.impact_map;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P96-100" title="Market Intelligence"
        right={data && <Badge tone={data.market_context?.regime === "UNKNOWN" ? "mute" : "hud"}>{data.market_context?.regime}</Badge>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q, entity); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이벤트/헤드라인…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="개체(선택)"
            className="w-40 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer disabled:opacity-40">{loading ? "…" : "Observe"}</button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p} onClick={() => { setQ(p); setEntity(""); run(p, ""); }} className="px-2.5 py-1 text-[10px] text-[var(--c-text-2)] border border-[var(--c-border)] hover:border-[var(--c-hud)] hover:text-[var(--c-hud)] bg-transparent cursor-pointer transition-colors">{p}</button>)}
        </div>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Live Event Feed */}
              <Panel>
                <PanelHead kicker="1 · Live Feed" title="Market Events" right={<Badge tone="hud">{data.adapters.length} adapters</Badge>} />
                <div className="p-4 space-y-2">
                  {data.live_event_feed.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">데이터 소스 연결 시 시장/뉴스/내부자/실적 이벤트가 스트리밍됩니다. 위에 이벤트를 입력해 데모.</div>}
                  {data.live_event_feed.map((e, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] text-[var(--c-text-1)] truncate">{e.label}</span>
                        <div className="flex gap-1.5 shrink-0"><Badge tone="blue">{e.event_type}</Badge><Badge tone={e.relevance === "HIGH" ? "pos" : e.relevance === "MEDIUM" ? "hud" : "mute"}>{e.relevance}</Badge></div>
                      </div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">affected: {e.affected.join(", ") || "—"}</div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1 pt-1">{data.adapters.map((a) => <span key={a} className="text-[9px] c-num text-[var(--c-text-3)] px-1.5 py-0.5 border border-[var(--c-border)]">{a}</span>)}</div>
                </div>
              </Panel>

              {/* 4. Market Context */}
              <Panel>
                <PanelHead kicker="4 · Context" title="Market State" right={<Badge tone={data.market_context?.regime === "UNKNOWN" ? "mute" : "hud"}>{data.market_context?.regime}</Badge>} />
                <div className="p-4 space-y-2">
                  <div className="flex flex-wrap gap-1.5">{(data.market_context?.labels ?? []).map((l) => <Badge key={l} tone="hud">{l}</Badge>)}{(data.market_context?.labels ?? []).length === 0 && <span className="text-[11px] text-[var(--c-text-3)]">시장 지표 미연결 — UNKNOWN(정직)</span>}</div>
                  {(data.market_context?.recommended_research ?? []).length > 0 && <><div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mt-2">Recommended</div>{data.market_context.recommended_research.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {r}</div>)}</>}
                  {(data.market_context?.avoid ?? []).length > 0 && <><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mt-2">Avoid</div>{data.market_context.avoid.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {r}</div>)}</>}
                </div>
              </Panel>
            </div>

            {/* 2. Impact Map */}
            <Panel>
              <PanelHead kicker="2 · Impact Map" title={impact?.origin ? `${impact.origin} → Companies → Sectors` : "Event → Companies → Sectors"}
                right={impact?.origin && <Badge tone="hud">{impact.affected_entities?.length ?? 0}</Badge>} />
              <div className="p-4">
                {!impact?.origin && <div className="text-[11px] text-[var(--c-text-3)]">이벤트 개체를 인식하면 공급망 전파 경로가 나타납니다.</div>}
                <div className="flex flex-wrap gap-2">
                  {(impact?.affected_entities ?? []).map((a, i) => {
                    const c = CAT_TONE[a.category] ?? "var(--c-text-3)";
                    return (
                      <div key={i} className="c-panel-2 p-2.5" style={{ borderLeft: `2px solid ${c}` }} title={a.relationship_path.join(" → ")}>
                        <div className="flex items-center gap-2"><span className="text-[11px] font-medium text-[var(--c-text-1)]">{a.entity}</span><span className="text-[9px] uppercase c-num" style={{ color: c }}>{a.category}</span></div>
                        <div className="text-[9px] text-[var(--c-text-3)] mt-0.5">{a.relationship_path.join(" → ")} · d{a.distance} · {a.uncertainty} uncertainty</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>

            {/* 3. Research Opportunities */}
            <Panel>
              <PanelHead kicker="3 · Opportunities" title="Detected Research Ideas" right={<Badge tone="pos">{data.research_opportunities.length}</Badge>} />
              <div className="p-4 space-y-2">
                {data.research_opportunities.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">이상 신호가 감지되면 연구 아이디어가 나타납니다(트레이드 신호 아님).</div>}
                {data.research_opportunities.map((o, i) => (
                  <div key={i} className="c-panel-2 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{o.title}</span><Badge tone={o.confidence === "HIGH" ? "pos" : o.confidence === "MEDIUM" ? "hud" : "warn"}>{o.confidence}</Badge></div><div className="text-[10px] text-[var(--c-text-3)] mt-1">{o.suggested_hypothesis}</div></div>
                ))}
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
