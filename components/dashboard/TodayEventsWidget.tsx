"use client";

import { useEffect, useState } from "react";
import { getKSDRightsSchedule, type KSDRightsRow } from "@/lib/api";

function getWindow(): { begin: string; end: string } {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { begin: fmt(today), end: fmt(future) };
}

function formatKsdDate(s: string | null): string {
  if (!s || s.length < 8) return "—";
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

export function TodayEventsWidget() {
  const [rights, setRights] = useState<KSDRightsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { begin, end } = getWindow();
    getKSDRightsSchedule(undefined, begin, end)
      .then(res => setRights(res.rows.slice(0, 6)))
      .catch(() => setRights([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Today's Events
      </span>

      <div className="space-y-4">
        {/* Rights Schedule — real KSD data */}
        <section>
          <span className="text-[10px] text-text-3 uppercase tracking-wide">Rights Events (14d)</span>
          {loading ? (
            <p className="text-text-3 text-xs mt-1.5">Loading…</p>
          ) : rights.length === 0 ? (
            <p className="text-text-3 text-xs mt-1.5">No upcoming rights events</p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {rights.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text-2 text-xs truncate max-w-[160px]">
                    {r.stck_issu_cmpy_nm ?? r.crno ?? "—"}
                  </span>
                  <span className="text-text-3 text-[10px] font-data shrink-0 ml-2">
                    {formatKsdDate(r.rgt_exert_rcd)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stubs — honest about missing data sources */}
        {[
          { label: "Earnings Calendar" },
          { label: "Economic Calendar" },
          { label: "Dividends" },
        ].map(stub => (
          <section key={stub.label}>
            <span className="text-[10px] text-text-3 uppercase tracking-wide">{stub.label}</span>
            <p className="text-[10px] text-text-3 mt-1 italic">No feed — data source needed</p>
          </section>
        ))}
      </div>
    </div>
  );
}
