"use client";

import { MarketWorkspace } from "@/components/market/MarketWorkspace";
import { PageBanner } from "@/components/PageBanner";

export default function MarketPage() {
  return (
    <div>
      <PageBanner pageKey="market" />
      <MarketWorkspace />
    </div>
  );
}
