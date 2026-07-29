"use client";
import { getResearch } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

export default function Research() {
  const { data, err, loading } = useConsole(getResearch);
  const gaps = data?.coverage_gaps ?? [];
  const cov = Object.entries(data?.factor_coverage ?? {}).sort((a,b)=>b[1].total-a[1].total);
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="AI Research · Coverage Planner"
        right={<Badge tone={gaps.length?"warn":"pos"}>{gaps.length} coverage gaps</Badge>} />
      <div className="p-5 space-y-5 max-w-[1150px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Planner Proposals" value={data?.count ?? 0} tone="hud" accent="hud" />
            <StatTile label="Coverage Gaps" value={gaps.length} tone="warn" accent="warn" />
            <StatTile label="Factors Tracked" value={cov.length} accent="info" />
            <StatTile label="High Severity" value={gaps.filter(g=>g.severity==="high").length} tone="neg" accent="neg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel className="overflow-hidden">
              <PanelHead kicker="GAPS" title="Coverage Gaps (no active strategy)" />
              <div className="p-3 space-y-2">
                {gaps.length===0 && <div className="text-[11px] text-[var(--c-text-3)] p-3">모든 팩터에 활성 전략 존재</div>}
                {gaps.map((g) => (
                  <div key={g.factor} className="flex items-center gap-3 border-l-2 pl-3 py-1.5" style={{borderColor: g.severity==="high"?"var(--c-neg)":"var(--c-warn)"}}>
                    <span className="text-[12px] text-[var(--c-text-1)] flex-1">{g.factor}</span>
                    <span className="c-num text-[10.5px] text-[var(--c-text-3)]">{g.active}/{g.total} active</span>
                    <StatusPill status={g.severity==="high"?"rejected":"underpowered"} />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="overflow-hidden">
              <PanelHead kicker="COVERAGE" title="Factor Coverage Map" />
              <div className="p-4 space-y-2">
                {cov.map(([f, c]) => (
                  <div key={f} className="flex items-center gap-3">
                    <span className="text-[11.5px] text-[var(--c-text-1)] w-28 shrink-0">{f}</span>
                    <div className="flex-1 h-1.5 bg-[var(--c-panel-3)] overflow-hidden flex">
                      <div style={{width:`${c.total?c.active/c.total*100:0}%`, background:"var(--c-pos)"}} />
                    </div>
                    <span className="c-num text-[10.5px] text-[var(--c-text-2)] w-16 text-right">{c.active}/{c.total}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </StateBlock>
      </div>
    </div>
  );
}
