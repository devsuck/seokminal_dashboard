"use client";
import { getOrders } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

export default function Orders() {
  const { data, err, loading } = useConsole(getOrders);
  return (
    <div className="min-h-full">
      <PageHeader kicker="EXECUTION" title="Orders (OMS)" right={<Badge tone="warn">LIVE CAPITAL CLOSED</Badge>} />
      <div className="p-5 space-y-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Requests" value={data?.requests.length ?? 0} tone="hud" accent="hud" />
            <StatTile label="Responses" value={data?.responses.length ?? 0} accent="info" />
            <StatTile label="Lifecycle Events" value={data?.lifecycle_events ?? 0} accent="warn" />
          </div>
          <Panel className="p-10 text-center">
            <div className="text-[12px] text-[var(--c-text-2)]">라이브 주문 없음</div>
            <div className="mt-1.5 text-[10.5px] text-[var(--c-text-3)] max-w-lg mx-auto leading-relaxed">
              {data?.note ?? "자본 경계 CLOSED"} — 라이브 집행은 [READY 인증서 + 사람 ARM + autonomy≥L6 + 브로커 자격증명] 4중 게이트를 모두 통과해야 열립니다.
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
