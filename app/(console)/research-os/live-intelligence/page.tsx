"use client";
// P111-120 — Live Intelligence. Data Sources / Market Feed / Research Queue / Data Health.
// /console/live-intelligence. READ ONLY · External Data→Provider→정규화→Event→Research Queue. 자동 거래 없음.
import { useEffect, useState } from "react";
import { getLiveIntelligence, type LiveIntelligenceResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const CAT_TONE: Record<string, string> = {
  market: "var(--c-hud)", news: "var(--c-blue)", fundamental: "var(--c-emerald)",
  earnings: "var(--c-emerald)", insider: "var(--c-warn)", ownership: "var(--c-warn)",
  macro: "var(--c-blue)", alt: "var(--c-text-3)",
};
const HEALTH_TONE: Record<string, "pos" | "warn" | "neg"> = {
  HEALTHY: "pos", DEGRADED: "warn", LIMITED: "neg",
};

export default function LiveIntelligence() {
  const [data, setData] = useState<LiveIntelligenceResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getLiveIntelligence(ac.signal).then(setData).catch((e) => setErr((e as Error).message));
    return () => ac.abort();
  }, []);

  const ds = data?.data_sources;
  const dh = data?.data_health;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P111-120" title="라이브 인텔리전스"
        right={dh && <Badge tone={HEALTH_TONE[dh.overall_status] ?? "mute"}>{dh.overall_status}</Badge>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="제공자" value={ds?.count ?? 0} sub={`${ds?.available_count ?? 0}개 사용 가능`} tone="hud" />
              <StatTile label="시장 피드" value={data.market_feed.length} sub="이벤트" />
              <StatTile label="리서치 큐" value={data.research_queue_count} sub="후보" tone="pos" />
              <StatTile label="데이터 헬스" value={dh?.overall_status ?? "—"}
                sub={`${dh?.api_availability?.available ?? 0}/${dh?.api_availability?.total ?? 0} APIs · ${dh?.issue_count ?? 0}개 이슈`}
                tone={HEALTH_TONE[dh?.overall_status ?? ""] === "neg" ? "neg" : HEALTH_TONE[dh?.overall_status ?? ""] === "warn" ? "warn" : "pos"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Data Sources */}
              <Panel>
                <PanelHead kicker="1 · 데이터 소스" title="제공자 상태"
                  right={<Badge tone="hud">{ds?.available_count}/{ds?.count}</Badge>} />
                <div className="p-4 space-y-1.5 max-h-[440px] overflow-y-auto">
                  {(ds?.providers ?? []).map((p) => (
                    <div key={p.name} className="c-panel-2 p-2.5 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.available ? "var(--c-pos)" : "var(--c-text-3)", boxShadow: p.available ? "0 0 6px var(--c-pos)" : "none" }} />
                      <span className="text-[11.5px] text-[var(--c-text-1)] w-28 truncate">{p.name}</span>
                      <span className="text-[9px] uppercase c-num shrink-0" style={{ color: CAT_TONE[p.category] ?? "var(--c-text-3)" }}>{p.category}</span>
                      <span className="text-[10px] text-[var(--c-text-3)] flex-1 truncate">{p.available_data}</span>
                      <Badge tone={p.available ? "pos" : "mute"}>{p.status === "available" ? "정상" : "설정 필요"}</Badge>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* 4. Data Health */}
              <Panel>
                <PanelHead kicker="4 · 데이터 헬스" title="API / 데이터 품질"
                  right={dh && <Badge tone={HEALTH_TONE[dh.overall_status] ?? "mute"}>{dh.overall_status}</Badge>} />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[var(--c-border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((dh?.api_availability?.ratio ?? 0) * 100)}%`, background: "var(--c-pos)" }} />
                    </div>
                    <span className="text-[10px] c-num text-[var(--c-text-2)]">{dh?.api_availability?.available}/{dh?.api_availability?.total} APIs</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">{(dh?.checks ?? []).map((c) => <span key={c} className="text-[9px] c-num text-[var(--c-text-3)] px-1.5 py-0.5 border border-[var(--c-border)]">{c}</span>)}</div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {Object.entries(ds?.by_category ?? {}).map(([k, n]) => (
                      <div key={k} className="flex items-center justify-between text-[10.5px]">
                        <span className="uppercase" style={{ color: CAT_TONE[k] ?? "var(--c-text-3)" }}>{k}</span>
                        <span className="c-num text-[var(--c-text-2)]">{n}</span>
                      </div>
                    ))}
                  </div>
                  {(dh?.api_availability?.unavailable ?? []).length > 0 && (
                    <div className="text-[10px] text-[var(--c-text-3)]">설정되지 않음: {dh?.api_availability?.unavailable.join(", ")}</div>
                  )}
                </div>
              </Panel>
            </div>

            {/* 2. Market Feed */}
            <Panel>
              <PanelHead kicker="2 · 시장 피드" title="이벤트 · 뉴스 · 실적"
                right={<>{data.is_demo && <span className="text-[9px] text-[var(--c-text-3)] uppercase mr-2">데모</span>}<Badge tone="hud">{data.market_feed.length}</Badge></>} />
              <div className="p-4 space-y-1.5">
                {data.market_feed.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">데이터 소스 연결 시 시장·뉴스·실적 이벤트가 스트리밍됩니다(정직한 빈 피드).</div>}
                {data.market_feed.map((e, i) => (
                  <div key={i} className="c-panel-2 p-2.5 flex items-center gap-2">
                    <span className="text-[9px] uppercase c-num w-20 shrink-0" style={{ color: CAT_TONE[e.category] ?? "var(--c-text-3)" }}>{e.category}</span>
                    <span className="text-[11.5px] text-[var(--c-text-1)] flex-1 truncate">{e.label}</span>
                    {e.event_type && <Badge tone="blue">{e.event_type}</Badge>}
                    <span className="text-[9px] text-[var(--c-text-3)] truncate max-w-[160px]">{e.affected.join(", ")}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* 3. Research Queue */}
            <Panel>
              <PanelHead kicker="3 · 리서치 큐" title="생성된 후보"
                right={<Badge tone="pos">{data.research_queue_count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.research_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">피드에서 이상 신호가 감지되면 연구 후보가 나타납니다(트레이드 신호 아님).</div>}
                {data.research_queue.map((o, i) => (
                  <div key={i} className="c-panel-2 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{o.title}</span><Badge tone={o.confidence === "HIGH" ? "pos" : o.confidence === "MEDIUM" ? "hud" : "warn"}>{o.confidence}</Badge></div><div className="text-[10px] text-[var(--c-text-3)] mt-1">{o.suggested_hypothesis}</div></div>
                ))}
                {data.dropped_duplicates > 0 && <div className="text-[9px] text-[var(--c-text-3)]">중복 방지: {data.dropped_duplicates}건 제외됨</div>}
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
