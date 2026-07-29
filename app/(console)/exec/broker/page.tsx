"use client";
import { getBroker } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, Dot } from "@/components/console/primitives";

export default function Broker() {
  const { data, err, loading } = useConsole(getBroker);
  const section = (title: string, obj: Record<string, Record<string, unknown>>) => (
    <Panel className="overflow-hidden">
      <PanelHead kicker="ADAPTERS" title={title} />
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(obj).map(([name, h]) => {
          const ok = (h.connected as boolean) || (h.enabled as boolean);
          return (
            <div key={name} className="border border-[var(--c-border)] p-3">
              <div className="flex items-center gap-2 mb-2"><Dot tone={ok ? "pos" : "warn"} /><span className="text-[12px] font-medium text-[var(--c-text-1)] uppercase">{name}</span></div>
              {Object.entries(h).map(([k, v]) => <KV key={k} k={k} v={typeof v === "boolean" ? (v ? "true" : "false") : String(v ?? "—")} />)}
            </div>
          );
        })}
      </div>
    </Panel>
  );
  return (
    <div className="min-h-full">
      <PageHeader kicker="EXECUTION" title="Broker Connectivity" />
      <div className="p-5 space-y-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err}>
          {data && section("Read-Only (market/account)", data.read_only)}
          {data && section("Execution Adapters (write)", data.execution_adapters)}
        </StateBlock>
      </div>
    </div>
  );
}
