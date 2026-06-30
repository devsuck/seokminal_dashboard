"use client";

import { useEffect, useState } from "react";
import { getKRXIndex, getMarketOverview, type KRXIndexRow } from "@/lib/api";

interface MarketRow {
  label: string;
  value: string;
  changePct: string;
  positive: boolean | null;
  noFeed: boolean;
}

function recentTradingDays(n: number): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
    }
  }
  return days;
}

function krxToRow(label: string, row: KRXIndexRow | undefined): MarketRow {
  if (!row || row.clpr == null) {
    return { label, value: "—", changePct: "—", positive: null, noFeed: false };
  }
  const pos = row.vs == null ? null : row.vs >= 0;
  return {
    label,
    value: row.clpr.toLocaleString("ko-KR"),
    changePct: row.flt_rt != null ? `${pos ? "+" : ""}${row.flt_rt.toFixed(2)}%` : "—",
    positive: pos,
    noFeed: false,
  };
}

function overviewToRow(
  label: string,
  data: { value: number | null; change_pct: number | null } | undefined,
  fmt: (v: number) => string,
): MarketRow {
  if (!data || data.value == null) {
    return { label, value: "—", changePct: "No feed", positive: null, noFeed: true };
  }
  const pos = data.change_pct == null ? null : data.change_pct >= 0;
  return {
    label,
    value: fmt(data.value),
    changePct: data.change_pct != null ? `${pos ? "+" : ""}${data.change_pct.toFixed(2)}%` : "—",
    positive: pos,
    noFeed: false,
  };
}

const LOADING_ROW = (label: string): MarketRow =>
  ({ label, value: "…", changePct: "—", positive: null, noFeed: false });

export function MarketOverviewWidget() {
  const [rows, setRows] = useState<MarketRow[]>([
    LOADING_ROW("KOSPI"), LOADING_ROW("KOSDAQ"),
    LOADING_ROW("S&P 500"), LOADING_ROW("NASDAQ"),
    LOADING_ROW("USD/KRW"), LOADING_ROW("BTC/USD"),
    LOADING_ROW("VIX"), LOADING_ROW("Gold"),
  ]);

  useEffect(() => {
    const fallbackDays = recentTradingDays(5);

    async function fetchKRX(name: "KOSPI" | "KOSDAQ"): Promise<KRXIndexRow | undefined> {
      for (const dd of fallbackDays) {
        try {
          const res = await getKRXIndex(dd, name);
          const row = res.rows.find(r => r.clpr != null);
          if (row) return row;
        } catch { /* try next */ }
      }
      return undefined;
    }

    Promise.all([
      fetchKRX("KOSPI"),
      fetchKRX("KOSDAQ"),
      getMarketOverview().catch(() => null),
    ]).then(([kospi, kosdaq, ov]) => {
      setRows([
        krxToRow("KOSPI",  kospi),
        krxToRow("KOSDAQ", kosdaq),
        overviewToRow("S&P 500", ov?.sp500,  v => v.toLocaleString("en", { maximumFractionDigits: 0 })),
        overviewToRow("NASDAQ",  ov?.nasdaq, v => v.toLocaleString("en", { maximumFractionDigits: 0 })),
        overviewToRow("USD/KRW", ov?.usdkrw, v => v.toFixed(2)),
        overviewToRow("BTC/USD", ov?.btcusd, v => `$${v.toLocaleString("en", { maximumFractionDigits: 0 })}`),
        overviewToRow("VIX",     ov?.vix,    v => v.toFixed(2)),
        overviewToRow("Gold",    ov?.gold,   v => `$${v.toLocaleString("en", { maximumFractionDigits: 0 })}`),
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
                row.noFeed        ? "text-text-3 italic" :
                row.positive === null ? "text-text-3" :
                row.positive      ? "text-pos" : "text-neg"
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
