"use client";

import { useMemo } from "react";
import type { ClosedTrade } from "@/lib/api";

interface Props {
  trades: ClosedTrade[];
  weeks?: number;
}

function dayKey(tsNs: number): string {
  return new Date(Math.floor(tsNs / 1e6)).toISOString().slice(0, 10);
}

function fmtDate(key: string): string {
  const d = new Date(key);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function PnlCalendar({ trades, weeks = 12 }: Props) {
  const { cellMap, minPnl, maxPnl } = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of trades) {
      if (t.entry_ts_ns == null) continue;
      const k = dayKey(t.entry_ts_ns);
      map[k] = (map[k] ?? 0) + (t.pnl ?? 0);
    }
    const vals = Object.values(map);
    return {
      cellMap: map,
      minPnl: vals.length ? Math.min(...vals) : 0,
      maxPnl: vals.length ? Math.max(...vals) : 0,
    };
  }, [trades]);

  // Build grid: last `weeks` weeks, Mon-Sun
  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - weeks * 7 + 1);

    const days: { key: string; weekday: number }[] = [];
    const cur = new Date(startDay);
    while (cur <= today) {
      days.push({
        key: cur.toISOString().slice(0, 10),
        weekday: cur.getDay(), // 0=Sun
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [weeks]);

  function cellColor(key: string): string {
    const v = cellMap[key];
    if (v == null) return "bg-panel-2";
    if (v === 0) return "bg-panel-2";
    if (v > 0) {
      const intensity = maxPnl > 0 ? v / maxPnl : 0;
      if (intensity > 0.66) return "bg-pos opacity-90";
      if (intensity > 0.33) return "bg-pos/50";
      return "bg-pos/25";
    } else {
      const intensity = minPnl < 0 ? v / minPnl : 0;
      if (intensity > 0.66) return "bg-neg opacity-90";
      if (intensity > 0.33) return "bg-neg/50";
      return "bg-neg/25";
    }
  }

  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // Pad to start on Sunday
  const firstDay = cells[0]?.weekday ?? 0;
  const padded = Array(firstDay).fill(null).concat(cells);

  const totalPnl = Object.values(cellMap).reduce((s, v) => s + v, 0);
  const tradeDays = Object.keys(cellMap).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          P&amp;L Calendar ({weeks}w)
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-text-3">{tradeDays}일 거래</span>
          <span className={totalPnl >= 0 ? "text-pos font-data" : "text-neg font-data"}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[3px] mb-1">
        {DAYS.map(d => (
          <span key={d} className="text-center text-[9px] text-text-3">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[3px]">
        {padded.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />;
          const v = cellMap[cell.key];
          return (
            <div
              key={cell.key}
              title={v != null ? `${fmtDate(cell.key)}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}` : fmtDate(cell.key)}
              className={`aspect-square rounded-sm cursor-default transition-opacity hover:opacity-70 ${cellColor(cell.key)}`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[9px] text-text-3">손실</span>
        <div className="w-3 h-3 rounded-sm bg-neg/25" />
        <div className="w-3 h-3 rounded-sm bg-neg/50" />
        <div className="w-3 h-3 rounded-sm bg-neg opacity-90" />
        <div className="w-3 h-3 rounded-sm bg-panel-2 border border-border" />
        <div className="w-3 h-3 rounded-sm bg-pos/25" />
        <div className="w-3 h-3 rounded-sm bg-pos/50" />
        <div className="w-3 h-3 rounded-sm bg-pos opacity-90" />
        <span className="text-[9px] text-text-3">이익</span>
      </div>
    </div>
  );
}
