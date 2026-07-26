"use client";
// P141-150 — Research Organization. Market / Company / Strategy Health / Agents / Knowledge / Reports / Review.
// /console/research-organization. READ ONLY · 자문 전용 · 자동 거래·집행·자본배분 없음.
import { useEffect, useState } from "react";
import { getResearchOrganization, type ResearchOrganizationResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const HEALTH_TONE: Record<string, "pos" | "warn" | "neg" | "mute"> = {
  HEALTHY: "pos", FAIR: "warn", DEGRADED: "neg", EMPTY: "mute",
};
const PRIORITY_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "warn", MEDIUM: "hud", LOW: "pos" };

export default function ResearchOrganization() {
  const [data, setData] = useState<ResearchOrganizationResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getResearchOrganization("", ac.signal).then(setData).catch((e) => setErr((e as Error).message));
    return () => ac.abort();
  }, []);

  const mo = data?.market_overview;
  const cm = data?.company_monitoring;
  const sh = data?.strategy_health;
  const kh = data?.knowledge_health;
  const os = data?.operational_status;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P141-150" title="Research Organization"
        right={os && <Badge tone={os.operational ? "pos" : "warn"}>{os.operational ? "v1.5 OPERATIONAL" : "v1.5"}</Badge>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {os && <div className="flex flex-wrap gap-1.5">{os.capabilities.map((c) => <Badge key={c} tone="hud">{c}</Badge>)}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Regime" value={mo?.regime?.regime ?? "—"} sub={`brief conf ${mo?.confidence ?? "—"}`} tone="hud" />
              <StatTile label="Company Priority" value={cm?.research_priority ?? "—"} sub={cm?.company ?? ""} tone={PRIORITY_TONE[cm?.research_priority ?? ""] === "warn" ? "warn" : "pos"} />
              <StatTile label="Strategies" value={sh?.strategies.length ?? 0} sub={`${sh?.review_needed_count ?? 0} need review`} tone={sh?.review_needed_count ? "warn" : "pos"} />
              <StatTile label="Knowledge" value={kh?.grade ?? "—"} sub={`${kh?.health_score ?? 0}/100`} tone={HEALTH_TONE[kh?.grade ?? ""] === "neg" ? "neg" : HEALTH_TONE[kh?.grade ?? ""] === "warn" ? "warn" : "pos"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Market Overview */}
              <Panel>
                <PanelHead kicker="Market Overview" title="Regime & Opportunities" right={<Badge tone="hud">{mo?.confidence}</Badge>} />
                <div className="p-4 space-y-2">
                  <div className="flex flex-wrap gap-1.5">{(mo?.regime?.labels ?? []).map((l) => <Badge key={l} tone="hud">{l}</Badge>)}{(mo?.regime?.labels ?? []).length === 0 && <span className="text-[11px] text-[var(--c-text-3)]">시장 지표 미연결 — {mo?.regime?.regime}</span>}</div>
                  {(mo?.opportunities ?? []).length > 0 && <div className="pt-1"><div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1">Opportunities</div>{mo?.opportunities.map((o, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {o.title} <span className="text-[var(--c-text-3)]">({o.confidence})</span></div>)}</div>}
                  {(mo?.risk_factors ?? []).length > 0 && <div className="pt-1"><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">Risk Factors</div>{mo?.risk_factors.map((r, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {r}</div>)}</div>}
                </div>
              </Panel>

              {/* Company Monitoring */}
              <Panel>
                <PanelHead kicker="Company Monitoring" title={cm?.company || "—"} right={cm && <Badge tone={PRIORITY_TONE[cm.research_priority] ?? "mute"}>{cm.research_priority}</Badge>} />
                <div className="p-4 space-y-1.5">
                  <div className="text-[10.5px] text-[var(--c-text-2)]">Impact: <span style={{ color: cm?.impact?.direction === "POSITIVE" ? "var(--c-pos)" : cm?.impact?.direction === "NEGATIVE" ? "var(--c-neg)" : "var(--c-text-2)" }}>{cm?.impact?.direction}</span></div>
                  {(cm?.events ?? []).map((e, i) => (
                    <div key={i} className="c-panel-2 p-2.5 flex items-center gap-2">
                      <span className="text-[9px] uppercase c-num text-[var(--c-blue)] w-16 shrink-0">{e.kind}</span>
                      <span className="text-[11px] text-[var(--c-text-1)] flex-1 truncate">{e.label}</span>
                      <span className="text-[9px] text-[var(--c-text-3)]">{e.detail}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Strategy Health */}
              <Panel>
                <PanelHead kicker="Strategy Health" title="Monitored Strategies" right={<Badge tone={sh?.review_needed_count ? "warn" : "pos"}>{sh?.review_needed_count ?? 0} review</Badge>} />
                <div className="p-4 space-y-1.5">
                  {(sh?.strategies ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">연구된 전략이 축적되면 건강 점수가 나타납니다.</div>}
                  {(sh?.strategies ?? []).map((s) => (
                    <div key={s.strategy} className="c-panel-2 p-2.5 flex items-center gap-2">
                      <span className="text-[11px] text-[var(--c-text-1)] w-36 truncate">{s.strategy}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.health_score}%`, background: s.health_score >= 65 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-2)] w-8 text-right">{s.health_score}</span>
                      {s.review_needed && <Badge tone="warn">review</Badge>}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Agent Status */}
              <Panel>
                <PanelHead kicker="Agent Status" title="Effectiveness" right={data.agent_status.overall_effectiveness != null && <Badge tone="hud">{data.agent_status.overall_effectiveness.toFixed(2)}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(data.agent_status.agents).map(([k, a]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-1)] w-40 truncate">{k}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${a.score * 100}%`, background: a.score >= 0.5 ? "var(--c-pos)" : "var(--c-warn)" }} /></div>
                      <span className="text-[9px] c-num text-[var(--c-text-3)] w-24 text-right truncate">{a.metric}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Reports + Review Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel>
                <PanelHead kicker="Research Reports" title="Agent Outputs" right={<Badge tone="hud">{data.research_reports.length}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {data.research_reports.map((r, i) => (
                    <div key={i} className="c-panel-2 p-2.5"><div className="flex items-center gap-2"><span className="text-[11px] font-medium text-[var(--c-text-1)]">{r.agent}</span><span className="text-[9px] uppercase c-num text-[var(--c-text-3)]">{r.role}</span></div><div className="text-[10px] text-[var(--c-text-3)] mt-0.5 truncate">{r.output}</div></div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Review Queue" title="Human Actions" right={<Badge tone={data.review_queue.length ? "warn" : "pos"}>{data.review_queue.length}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {data.review_queue.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">사람 검토 대기 항목 없음.</div>}
                  {data.review_queue.map((e, i) => (
                    <div key={i} className="c-panel-2 p-2.5 flex items-center justify-between gap-2"><span className="text-[11px] text-[var(--c-text-1)] truncate">{e.label || e.source}</span><Badge tone="warn">{e.event_type}</Badge></div>
                  ))}
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
