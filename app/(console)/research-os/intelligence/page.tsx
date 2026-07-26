"use client";
// P151-160 — Institutional Intelligence. Data Health / Market / Sector / Macro / Company / Knowledge / Quality.
// /console/institutional-intelligence. READ ONLY · 컨텍스트 전용 · 예측/랭킹/배분 없음 · 자동 거래·집행 없음.
import { useEffect, useState } from "react";
import { getInstitutionalIntelligence, type InstitutionalIntelligenceResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const HEALTH_TONE: Record<string, "pos" | "warn" | "neg" | "mute"> = {
  HEALTHY: "pos", DEGRADED: "warn", LIMITED: "neg", FAIR: "warn", EMPTY: "mute",
};
const CONF_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };

export default function InstitutionalIntelligence() {
  const [data, setData] = useState<InstitutionalIntelligenceResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getInstitutionalIntelligence("", "semiconductor", "TSMC", ac.signal).then(setData).catch((e) => setErr((e as Error).message));
    return () => ac.abort();
  }, []);

  const dp = data?.data_production_health;
  const sec = data?.sector_intelligence;
  const mac = data?.macro_context;
  const co = data?.company_intelligence;
  const q = data?.quality_scores;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P151-160" title="Institutional Intelligence"
        right={data && <Badge tone={data.validation.validated ? "pos" : "warn"}>{data.validation.validated ? "VALIDATED" : "—"}</Badge>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {data && <div className="flex flex-wrap gap-1.5">{data.validation.capabilities.map((c) => <Badge key={c} tone="hud">{c}</Badge>)}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Data Health" value={dp?.overall_status ?? "—"} sub={`${dp?.available_count ?? 0}/${dp?.count ?? 0} providers`} tone={HEALTH_TONE[dp?.overall_status ?? ""] === "neg" ? "neg" : HEALTH_TONE[dp?.overall_status ?? ""] === "warn" ? "warn" : "pos"} />
              <StatTile label="Regime" value={data.market_intelligence.regime} sub="market" tone="hud" />
              <StatTile label="Macro State" value={mac?.macro_state ?? "—"} sub={`uncertainty ${mac?.uncertainty ?? "—"}`} tone="hud" />
              <StatTile label="Info Confidence" value={q?.confidence ?? "—"} sub={`reliability ${q?.reliability ?? 0}`} tone={CONF_TONE[q?.confidence ?? ""] === "warn" ? "warn" : "pos"} />
            </div>

            {/* 1. Data Production Health */}
            <Panel>
              <PanelHead kicker="1 · Data Production" title="Provider Health"
                right={<Badge tone={HEALTH_TONE[dp?.overall_status ?? ""] ?? "mute"}>{dp?.overall_status}</Badge>} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {(dp?.reports ?? []).map((r) => (
                  <div key={r.provider} className="c-panel-2 p-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: r.availability === "available" ? "var(--c-pos)" : "var(--c-text-3)" }} />
                    <span className="text-[11px] text-[var(--c-text-1)] w-28 truncate">{r.provider}</span>
                    <span className="text-[9px] uppercase c-num text-[var(--c-text-3)] flex-1">{r.category}</span>
                    <span className="text-[9px] text-[var(--c-text-3)]">{r.freshness}</span>
                    <span className="text-[10px] c-num" style={{ color: r.quality_score >= 0.6 ? "var(--c-pos)" : "var(--c-warn)" }}>{r.quality_score.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 3. Sector Intelligence */}
              <Panel>
                <PanelHead kicker="3 · Sector" title={sec?.sector || "—"} right={<Badge tone="hud">{sec?.key_entities.length ?? 0}</Badge>} />
                <div className="p-4 space-y-2">
                  <div className="flex flex-wrap gap-1">{(sec?.key_entities ?? []).map((e) => <span key={e} className="text-[9px] c-num text-[var(--c-text-2)] px-1.5 py-0.5 border border-[var(--c-border)]">{e}</span>)}</div>
                  {(sec?.risk_factors ?? []).length > 0 && <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">Risk Factors</div>{sec?.risk_factors.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {r}</div>)}</div>}
                  {(sec?.research_questions ?? []).length > 0 && <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">Research Questions</div>{sec?.research_questions.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {r}</div>)}</div>}
                </div>
              </Panel>

              {/* 4. Macro Context */}
              <Panel>
                <PanelHead kicker="4 · Macro" title={mac?.macro_state || "—"} right={<Badge tone={mac?.uncertainty === "LOW" ? "pos" : mac?.uncertainty === "MEDIUM" ? "hud" : "warn"}>{mac?.uncertainty} uncertainty</Badge>} />
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(mac?.indicators ?? {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[10.5px]"><span className="text-[var(--c-text-2)]">{k}</span><span className="c-num" style={{ color: v.state === "UNKNOWN" ? "var(--c-text-3)" : "var(--c-text-1)" }}>{v.value ?? "—"} <span className="text-[9px] text-[var(--c-text-3)]">{v.state}</span></span></div>
                    ))}
                  </div>
                  {(mac?.affected_assets ?? []).length > 0 && <div className="pt-1"><div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1">Affected Assets</div>{mac?.affected_assets.map((a, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)]">· {a.asset_class} <span className="text-[var(--c-text-3)]">({a.sensitivity}, {a.direction})</span></div>)}</div>}
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 5. Company Intelligence */}
              <Panel>
                <PanelHead kicker="5 · Company" title={co?.entity || "—"} right={<Badge tone="blue">graph</Badge>} />
                <div className="p-4 space-y-2">
                  {(["suppliers", "customers", "competitors", "related_sectors"] as const).map((k) => (
                    <div key={k} className="flex items-start gap-2"><span className="text-[9px] uppercase c-num text-[var(--c-text-3)] w-24 shrink-0 pt-0.5">{k}</span><span className="text-[10.5px] text-[var(--c-text-2)] flex-1">{(co?.relationships?.[k] ?? []).join(", ") || "—"}</span></div>
                  ))}
                  {(co?.risks ?? []).length > 0 && <div className="pt-1"><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">Risks</div>{co?.risks.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {r}</div>)}</div>}
                </div>
              </Panel>

              {/* 7. Quality Scores + Knowledge */}
              <Panel>
                <PanelHead kicker="7 · Quality" title="Information Quality" right={q && <Badge tone={CONF_TONE[q.confidence] ?? "mute"}>{q.confidence}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(q?.dimensions ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-2)] w-40">{k}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v as number) * 100}%`, background: k === "conflict_level" || k === "uncertainty" ? ((v as number) > 0.5 ? "var(--c-neg)" : "var(--c-warn)") : ((v as number) >= 0.5 ? "var(--c-pos)" : "var(--c-warn)") }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-3)] w-8 text-right">{(v as number).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 text-[10.5px]"><span className="text-[var(--c-text-3)]">Knowledge Health</span><Badge tone={HEALTH_TONE[data.knowledge_context.grade] ?? "mute"}>{data.knowledge_context.grade} {data.knowledge_context.health_score ?? ""}</Badge></div>
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
