"use client";
import { getAllocation } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile } from "@/components/console/primitives";

export default function Allocation() {
  const { data, err, loading } = useConsole(getAllocation);
  const empty = !(data?.allocations.length || data?.decisions.length || data?.rebalances.length);
  return (
    <div className="min-h-full">
      <PageHeader kicker="PORTFOLIO OS" title="Allocation" />
      <div className="p-5 space-y-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Proposals" value={data?.allocations.length ?? 0} tone="hud" accent="hud" />
            <StatTile label="Decisions" value={data?.decisions.length ?? 0} accent="info" />
            <StatTile label="Rebalances" value={data?.rebalances.length ?? 0} accent="warn" />
          </div>
          {empty ? (
            <Panel className="p-10 text-center">
              <div className="text-[12px] text-[var(--c-text-2)]">배분 제안 없음</div>
              <div className="mt-1.5 text-[10.5px] text-[var(--c-text-3)]">{data?.note ?? "포트폴리오 오케스트레이터(Meta Portfolio)가 제안을 생성하면 여기에 표시됩니다. 현재는 제안 전용 · 미실행."}</div>
            </Panel>
          ) : (
            <Panel><PanelHead kicker="LEDGER" title="Allocation Proposals" />
              <pre className="p-4 text-[11px] c-num text-[var(--c-text-2)] overflow-x-auto">{JSON.stringify(data?.allocations, null, 2)}</pre>
            </Panel>
          )}
        </StateBlock>
      </div>
    </div>
  );
}
