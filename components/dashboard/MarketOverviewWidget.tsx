"use client";

import { useEffect, useState } from "react";
import { getKRXIndex, type KRXIndexRow } from "@/lib/api";

interface MarketRow {
  label: string;
  value: string;
  changePct: string;
  positive: boolean | null;
  noFeed: boolean;
}

function todayKrx(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function krxToRow(label: string, row: KRXIndexRow | undefined): MarketRow {
  if (!row || row.clpr == null) {
    return { label, value: "—", changePct: "—", positive: null, noFeed: false };
  }
  const pos = (row.vs ?? 0) >= 0;
  return {
    label,
    value: row.clpr.toLocaleString("ko-KR"),
    changePct: row.flt_rt != null ? `${pos ? "+" : ""}${row.flt_rt.toFixed(2)}%` : "—",
    positive: pos,
    noFeed: false,
  };
}

const STUB_ROWS: MarketRow[] = [
  { label: "S&P 500",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "NASDAQ",   value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "USD/KRW",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "BTC/USD",  value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "VIX",      value: "—", changePct: "No feed", positive: null, noFeed: true },
  { label: "Gold",     value: "—", changePct: "No feed", positive: null, noFeed: true },
];

const LOADING_ROWS: MarketRow[] = [
  { label: "KOSPI",  value: "…", changePct: "—", positive: null, noFeed: false },
  { label: "KOSDAQ", value: "…", changePct: "—", positive: null, noFeed: false },
  ...STUB_ROWS,
];

export function MarketOverviewWidget() {
  const [rows, setRows] = useState<MarketRow[]>(LOADING_ROWS);

  useEffect(() => {
    const basDd = todayKrx();
    Promise.all([
      getKRXIndex(basDd, "KOSPI").catch(() => null),
      getKRXIndex(basDd, "KOSDAQ").catch(() => null),
    ]).then(([kospi, kosdaq]) => {
      setRows([
        krxToRow("KOSPI",  kospi?.rows[0]),
        krxToRow("KOSDAQ", kosdaq?.rows[0]),
        ...STUB_ROWS,
      ]);
    });
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Market Overview
      </span>

      <div className="grid grid-cols-2 gap-x-8 gap-y-0">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
            <span className="text-text-2 text-xs">{row.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-text-1 text-xs font-data">{row.value}</span>
              <span className={`text-[11px] font-data w-[72px] text-right ${
                row.noFeed     ? "text-text-3 italic" :
                row.positive === null ? "text-text-3" :
                row.positive   ? "text-pos" : "text-neg"
              }`}>
                {row.changePct}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
