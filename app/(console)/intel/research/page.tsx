"use client";
import { getResearch } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";

export default function Research() {
  const { data, err, loading } = useConsole(getResearch);
  const rows = data?.proposals ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="AI Research · Coverage Planner" />
      <div className="p-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err} empty={!rows.length} emptyNote={data?.note ?? "planner가 리서치 갭을 분석하면 제안이 여기에 표시됩니다. (python -m jarvis.planner analyze)"}>
          <Panel>
            <PanelHead kicker="PLANNER" title="Research Proposals" right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{rows.length}</span>} />
            <ul className="p-3 space-y-2">
              {rows.map((p, i) => (
                <li key={i} className="border-l-2 border-[var(--c-hud)] pl-3 py-1">
                  <div className="text-[12px] text-[var(--c-text-1)]">{String((p as Record<string, unknown>).title ?? (p as Record<string, unknown>).category ?? "proposal")}</div>
                  <div className="text-[10px] c-num text-[var(--c-text-3)] mt-0.5 truncate">{JSON.stringify(p).slice(0, 140)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
