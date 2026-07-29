"use client";
import { getKnowledge } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";
import { GraphView } from "@/components/console/GraphView";

const STATUS_COLOR: Record<string,string> = { paper_active:"#22D3EE", candidate:"#22D3EE", rejected:"#FF4D4D", blocked_by_data:"#F5B301", underpowered:"#F5B301", weak:"#F5B301", draft:"#4E5A68", watchlist:"#3B82F6", analysis:"#3B82F6" };

export default function KnowledgeGraph() {
  const { data, err, loading } = useConsole(getKnowledge);
  const statuses = Object.entries(data?.statuses ?? {}).sort((a,b)=>b[1]-a[1]);
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Knowledge Graph"
        right={<Badge tone="hud">{data?.nodes.length ?? 0} nodes · {data?.edges.length ?? 0} edges</Badge>} />
      <div className="p-5 max-w-[1300px]">
        <StateBlock loading={loading} err={err} empty={!data?.nodes.length}>
          <Panel grid hud className="overflow-hidden">
            <PanelHead kicker="MARKET MEMORY" title="Strategy · Factor Relation Graph"
              right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.note}</span>} />
            <div className="p-3">{data && <GraphView nodes={data.nodes} edges={data.edges} />}</div>
            <div className="flex flex-wrap gap-2.5 px-4 pb-4 border-t border-[var(--c-border)] pt-3">
              {statuses.map(([s,n]) => (
                <span key={s} className="flex items-center gap-1.5 text-[10px] c-num text-[var(--c-text-2)]">
                  <span className="h-2 w-2 rounded-full" style={{background: STATUS_COLOR[s] ?? "#4E5A68"}} />{s} · {n}
                </span>
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
