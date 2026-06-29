"use client";

import { MarketWorkspace } from "@/components/market/MarketWorkspace";
import { PageBanner } from "@/components/PageBanner";

export default function MarketPage() {
  return (
    <div className="p-6">
      <PageBanner pageKey="market" />
      <MarketWorkspace />
    </div>
  );
}
