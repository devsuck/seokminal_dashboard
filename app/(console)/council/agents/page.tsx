"use client";
import { getAgents } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, AgentTree } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

export default function CouncilAgents() {
  const { data, err, loading } = useConsole(getAgents);
  return (
    <div className="min-h-full">
      <PageHeader kicker="AI 협의회" title="에이전트 지휘 구조"
        right={<Badge tone={data?.live_execution_enabled ? "pos" : "warn"}>{data?.live_execution_enabled ? "실전" : "제안 전용"}</Badge>} />
      <div className="p-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5">
            <Panel grid className="overflow-hidden">
              <PanelHead kicker="조직" title="협의회 계층구조" />
              <div className="p-5">{data && <AgentTree node={data.council} />}</div>
            </Panel>
            <Panel>
              <PanelHead kicker="트레이더" title="에이전트 유형" right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.archetypes.length ?? 0}</span>} />
              <div className="p-4 flex flex-wrap gap-2">
                {(data?.archetypes ?? []).map((a) => (
                  <span key={a} className="c-num text-[11px] px-2 py-1 border border-[var(--c-border)] text-[var(--c-text-2)]">{a}</span>
                ))}
              </div>
              <div className="px-4 pb-4 text-[10.5px] text-[var(--c-text-3)] leading-relaxed">
                조직도는 실제 jarvis 서브시스템 상태(거버넌스·리서치·리스크·집행)로 구성됩니다. 각 노드 상태는 실 시스템을 반영합니다.
              </div>
            </Panel>
          </div>
        </StateBlock>
      </div>
    </div>
  );
}
