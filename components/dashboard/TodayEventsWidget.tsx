"use client";

import { useEffect, useState } from "react";
import { getKSDRightsSchedule, getEconomicCalendar, type KSDRightsRow, type EconomicEvent } from "@/lib/api";

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

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTodayOrFuture(iso: string): boolean {
  try { return iso.slice(0, 10) >= todayKey(); } catch { return false; }
}

function fmtEconTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return ""; }
}

function fmtEconDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  } catch { return ""; }
}

export function TodayEventsWidget() {
  const [rights, setRights] = useState<KSDRightsRow[]>([]);
  const [econEvents, setEconEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      const { begin, end } = getWindow();
      Promise.allSettled([
        getKSDRightsSchedule(undefined, begin, end),
        getEconomicCalendar("this"),
      ]).then(([rightsRes, econRes]) => {
        if (rightsRes.status === "fulfilled") {
          const seen = new Set<string>();
          const deduped = rightsRes.value.rows.filter(r => {
            const key = r.stck_issu_cmpy_nm ?? r.crno ?? "";
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setRights(deduped.slice(0, 6));
        }
        if (econRes.status === "fulfilled") {
          const upcomingHigh = econRes.value
            .filter(e => (e.impact === "High" || e.impact === "Medium") && isTodayOrFuture(e.date))
            .slice(0, 5);
          setEconEvents(upcomingHigh);
        }
      }).finally(() => setLoading(false));
    };

    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
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

        {/* Economic Calendar — ForexFactory */}
        <section>
          <span className="text-[10px] text-text-3 uppercase tracking-wide">Economic Calendar</span>
          {loading ? (
            <p className="text-text-3 text-xs mt-1.5">Loading…</p>
          ) : econEvents.length === 0 ? (
            <p className="text-[10px] text-text-3 mt-1 italic">No upcoming High/Medium events</p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {econEvents.map((ev, i) => {
                const isHigh = ev.impact === "High";
                const dateStr = ev.date.slice(0, 10) === todayKey() ? fmtEconTime(ev.date) : fmtEconDate(ev.date);
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isHigh ? "bg-neg" : "bg-warn"}`} />
                    <span className="text-text-2 text-xs truncate flex-1">{ev.title}</span>
                    <span className="text-text-3 text-[10px] font-data shrink-0">{dateStr}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stubs */}
        {[
          { label: "Earnings Calendar" },
          { label: "Dividends" },
        ].map(stub => (
          <section key={stub.label}>
            <span className="text-[10px] text-text-3 uppercase tracking-wide">{stub.label}</span>
            <p className="text-[10px] text-text-3 mt-1 italic">No feed</p>
          </section>
        ))}
      </div>
    </div>
  );
}
