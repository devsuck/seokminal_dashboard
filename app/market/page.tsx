"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MarketWorkspace } from "@/components/market/MarketWorkspace";
import CryptoPage from "../crypto/page";
import ForexPage from "../forex/page";
import FuturesPage from "../futures/page";
import OptionsPage from "../options/page";
import SearchPage from "../search/page";
import NewsPage from "../news/page";
import CalendarPage from "../calendar/page";

type Venue = "주식" | "암호화폐" | "외환" | "선물" | "옵션" | "탐색" | "뉴스" | "캘린더";
const VENUES: Venue[] = ["주식", "암호화폐", "외환", "선물", "옵션", "탐색", "뉴스", "캘린더"];

export default function MarketPage() {
  return <Suspense><MarketPageInner /></Suspense>;
}

function MarketPageInner() {
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol") ?? undefined;
  const [venue, setVenue] = useState<Venue>("주식");

  return (
    <div className="flex flex-col min-h-full">
      {/* Venue tab bar */}
      <div className="border-b border-border bg-panel flex px-6 gap-0 shrink-0">
        {VENUES.map(v => (
          <button
            key={v}
            onClick={() => setVenue(v)}
            className={`px-5 py-2.5 text-sm bg-transparent border-0 cursor-pointer transition-colors ${
              venue === v
                ? "border-b-2 border-accent text-accent font-medium": "text-text-3 hover:text-text-1"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Content */}
      {venue === "주식"&& <MarketWorkspace initialSymbol={initialSymbol} />}
      {venue === "암호화폐" && <CryptoPage />}
      {venue === "외환"&& <ForexPage />}
      {venue === "선물"&& <FuturesPage />}
      {venue === "옵션"&& <OptionsPage />}
      {venue === "탐색"&& <SearchPage />}
      {venue === "뉴스" && <NewsPage />}
      {venue === "캘린더" && <CalendarPage />}
    </div>
  );
}
