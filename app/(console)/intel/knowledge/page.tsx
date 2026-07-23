"use client";
import { getKnowledge } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

export default function KnowledgeGraph() {
  const { data, err, loading } = useConsole(getKnowledge);
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Knowledge Graph"
        right={<Badge tone={data?.built ? "pos" : "warn"}>{data?.built ? "BUILT" : "NOT BUILT"}</Badge>} />
      <div className="p-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err}>
          <Panel grid hud className="overflow-hidden min-h-[420px] flex items-center justify-center">
            {!data?.built ? (
              <div className="text-center px-6 py-16">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="mx-auto mb-5 opacity-60">
                  <circle cx="36" cy="16" r="6" stroke="var(--c-hud)" strokeWidth="1.2" />
                  <circle cx="16" cy="48" r="6" stroke="var(--c-hud)" strokeWidth="1.2" />
                  <circle cx="56" cy="48" r="6" stroke="var(--c-hud)" strokeWidth="1.2" />
                  <circle cx="36" cy="60" r="4" stroke="var(--c-text-3)" strokeWidth="1" />
                  <path d="M36 22 20 44M36 22 52 44M18 53l16 5M54 53 38 58" stroke="var(--c-border-2)" strokeWidth="1" />
                </svg>
                <div className="text-[14px] text-[var(--c-text-1)] tracking-wide">시장의 기억 그래프</div>
                <div className="mt-2 text-[11.5px] text-[var(--c-text-2)] max-w-md mx-auto leading-relaxed">
                  전략·팩터·레짐·실패 패턴 간의 관계를 저장하는 지식 그래프입니다. 아직 프로젝션 DB가 구축되지 않았습니다.
                </div>
                <div className="mt-4 inline-block c-num text-[10.5px] text-[var(--c-hud)] px-3 py-1.5 border border-[color-mix(in_srgb,var(--c-hud)_30%,transparent)]">
                  python -m jarvis.knowledge build
                </div>
              </div>
            ) : (
              <div className="w-full p-5">
                <PanelHead kicker="GRAPH" title={`Failed Strategies (${data.failed_strategies.length})`} />
                <pre className="text-[11px] c-num text-[var(--c-text-2)] mt-3 overflow-x-auto">{JSON.stringify(data.failed_strategies, null, 2)}</pre>
              </div>
            )}
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
