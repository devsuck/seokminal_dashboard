import { MarketOverviewWidget }    from "@/components/dashboard/MarketOverviewWidget";
import { SystemStatusWidget }      from "@/components/dashboard/SystemStatusWidget";
import { TodayEventsWidget }       from "@/components/dashboard/TodayEventsWidget";
import { ResearchActivityWidget }  from "@/components/dashboard/ResearchActivityWidget";
import { PortfolioSnapshotWidget } from "@/components/dashboard/PortfolioSnapshotWidget";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-text-3 text-sm mt-0.5">Institutional Quant Research Terminal</p>
      </div>

      {/* Row 1: Market Overview + System Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MarketOverviewWidget />
        </div>
        <SystemStatusWidget />
      </div>

      {/* Row 2: Today's Events + Research Activity + Portfolio Snapshot */}
      <div className="grid grid-cols-3 gap-4">
        <TodayEventsWidget />
        <ResearchActivityWidget />
        <PortfolioSnapshotWidget />
      </div>
    </div>
  );
}
