"use client";

import { MarketOverviewWidget }    from "@/components/dashboard/MarketOverviewWidget";
import { SystemStatusWidget }      from "@/components/dashboard/SystemStatusWidget";
import { TodayEventsWidget }       from "@/components/dashboard/TodayEventsWidget";
import { ResearchActivityWidget }  from "@/components/dashboard/ResearchActivityWidget";
import { PortfolioSnapshotWidget } from "@/components/dashboard/PortfolioSnapshotWidget";
import { FearGreedWidget }         from "@/components/dashboard/FearGreedWidget";
import { NewsPanel }               from "@/components/news/NewsPanel";
import { PageBanner }              from "@/components/PageBanner";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <PageBanner pageKey="dashboard" />

      {/* Row 1: Market Overview + System Status + Fear & Greed */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2">
          <MarketOverviewWidget />
        </div>
        <SystemStatusWidget />
        <FearGreedWidget />
      </div>

      {/* Row 2: Today's Events + Research Activity + Portfolio Snapshot */}
      <div className="grid grid-cols-3 gap-4">
        <TodayEventsWidget />
        <ResearchActivityWidget />
        <PortfolioSnapshotWidget />
      </div>

      {/* Row 3: Market News */}
      <div className="bg-panel border border-border rounded-lg p-4" style={{ minHeight: "280px" }}>
        <NewsPanel maxItems={10} />
      </div>
    </div>
  );
}
