"use client";
import { getLogs } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";

export default function CouncilLogs() {
  const { data, err, loading } = useConsole((s) => getLogs(80, s));
  const rows = data?.logs ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="AI 협의회" title="거버넌스 감사 로그" />
      <div className="p-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err} empty={!rows.length}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="감사" title="추가 전용 로그" right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.count ?? 0}</span>} />
            <div className="p-3 font-data text-[11px] leading-relaxed max-h-[70vh] overflow-y-auto">
              {[...rows].reverse().map((r, i) => (
                <div key={i} className="flex gap-3 py-1 border-b border-[var(--c-border)] last:border-0">
                  <span className="text-[var(--c-text-3)] shrink-0">{String(r.timestamp ?? r.ts ?? "")}</span>
                  <span className="text-[var(--c-hud)] shrink-0">{String(r.action ?? r.layer ?? r.event ?? "")}</span>
                  <span className="text-[var(--c-text-2)] truncate">{JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !["timestamp","ts","action","layer"].includes(k))))}</span>
                </div>
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
