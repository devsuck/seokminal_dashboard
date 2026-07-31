"use client";
import { getMonitor } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Dot, StatTile } from "@/components/console/primitives";

const stageTone = (by: Record<string, number>, n: number) => {
  if (n === 0) return "mute" as const;
  const k = Object.keys(by);
  if (k.some((x) => ["FAILED", "BLOCKED", "REJECTED"].includes(x))) return "neg" as const;
  if (k.some((x) => ["WARNING", "CLOSED"].includes(x))) return "warn" as const;
  return "pos" as const;
};

export default function ExecMonitor() {
  const { data, err, loading } = useConsole(getMonitor, [], 10000);
  return (
    <div className="min-h-full">
      <PageHeader kicker="집행" title="파이프라인 모니터"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.proposals ?? 0} 제안 · {data?.approvals ?? 0} 승인</span>} />
      <div className="p-5 space-y-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatTile label="자본" value={data?.capital.capital != null ? `$${(data.capital.capital / 1e6).toFixed(1)}M` : "—"} tone="hud" accent="hud" />
            <StatTile label="노출도" value={(data?.capital.exposure_pct ?? 0).toFixed(1)} unit="%" accent="info" />
            <StatTile label="포지션" value={data?.capital.n_positions ?? 0} accent="warn" />
          </div>
          <Panel grid className="overflow-hidden">
            <PanelHead kicker="P8" title="집행 파이프라인 (7.4 → 8.7)" />
            <div className="p-3">
              {(data?.stages ?? []).map((s, i) => {
                const tone = stageTone(s.by_status, s.count);
                return (
                  <div key={s.key} className="flex items-center gap-3 py-2.5 px-1 border-b border-[var(--c-border)] last:border-0">
                    <span className="c-num text-[10px] text-[var(--c-text-3)] w-5">{String(i + 1).padStart(2, "0")}</span>
                    <Dot tone={tone} />
                    <span className="text-[12px] text-[var(--c-text-1)] flex-1">{s.label}</span>
                    <span className="c-num text-[10.5px] text-[var(--c-text-3)]">{Object.entries(s.by_status).map(([k, v]) => `${k}:${v}`).join(" ") || "유휴"}</span>
                    <span className="c-num text-[14px] font-semibold text-[var(--c-text-1)] w-8 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-4 pb-4 text-[10px] text-[var(--c-text-3)]">{data?.note}</div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
