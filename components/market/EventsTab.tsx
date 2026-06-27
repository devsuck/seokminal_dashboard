"use client";

import { useEffect, useState } from "react";
import {
  getKSDRightsSchedule, getKSDBorrowRank,
  type KSDRightsRow, type KSDBorrowRow,
} from "@/lib/api";

function toKsdDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function fmtKsdDate(s: string | null): string {
  if (!s || s.length < 8) return "—";
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}

export function EventsTab() {
  const [rights, setRights] = useState<KSDRightsRow[]>([]);
  const [borrows, setBorrows] = useState<KSDBorrowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const today = toKsdDate(0);
    const future = toKsdDate(30);

    Promise.all([
      getKSDRightsSchedule(undefined, today, future).catch(() => ({ rows: [] as KSDRightsRow[] })),
      getKSDBorrowRank(today, 20).catch(() => ({ bas_dt: today, rows: [] as KSDBorrowRow[] })),
    ]).then(([rightsRes, borrowRes]) => {
      if (!alive) return;
      setRights(rightsRes.rows.slice(0, 10));
      setBorrows(borrowRes.rows.slice(0, 10));
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  return (
    <div className="p-4 space-y-6 max-w-[900px]">

      {/* Rights Schedule */}
      <section>
        <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-3">
          Rights Events (30d)
        </h3>
        {loading ? (
          <p className="text-text-3 text-xs">Loading…</p>
        ) : rights.length === 0 ? (
          <p className="text-text-3 text-xs">No upcoming rights events</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Company</th>
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Type</th>
                  <th className="text-right px-3 py-2 text-text-3 font-normal">Record Date</th>
                </tr>
              </thead>
              <tbody>
                {rights.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-panel-2/50">
                    <td className="px-3 py-2 text-text-2 truncate max-w-[200px]">
                      {r.stck_issu_cmpy_nm ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-3">{r.rgt_exert_rcd_nm ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-data text-text-2">
                      {fmtKsdDate(r.rgt_exert_rcd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Short Interest / Borrow Rank */}
      <section>
        <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-3">
          Top Short Interest (KSD Borrow Rank)
        </h3>
        {loading ? (
          <p className="text-text-3 text-xs">Loading…</p>
        ) : borrows.length === 0 ? (
          <p className="text-text-3 text-xs">No borrow data for today</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-panel-2 border-b border-border">
                  <th className="text-left px-3 py-2 text-text-3 font-normal">#</th>
                  <th className="text-left px-3 py-2 text-text-3 font-normal">Symbol</th>
                  <th className="text-right px-3 py-2 text-text-3 font-normal">Borrow Balance</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map((b, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-panel-2/50">
                    <td className="px-3 py-2 text-text-3 font-data">{b.rank ?? i + 1}</td>
                    <td className="px-3 py-2 text-text-2">{b.isin_cd_nm ?? b.isin_cd ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-data text-text-2">{b.lnb_bal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stubs */}
      {[{ label: "Earnings Calendar" }, { label: "News Feed" }].map(stub => (
        <section key={stub.label}>
          <h3 className="text-text-3 text-[11px] uppercase tracking-wider mb-1">{stub.label}</h3>
          <p className="text-text-3 text-[10px] italic">No feed — data source needed</p>
        </section>
      ))}
    </div>
  );
}
