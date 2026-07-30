"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getEconomicCalendar, type EconomicEvent } from "@/lib/api";
import { GroqSummaryPanel } from "@/components/GroqSummaryPanel";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedToggle } from "@/components/ui";

type Week = "this" | "next";
type ImpactFilter = "all" | "High" | "Medium" | "Low";

const IMPACT_CONFIG = {
  High:   { dot: "bg-neg",  badge: "bg-neg/15 text-neg border-neg/25",   label: "높음" },
  Medium: { dot: "bg-warn", badge: "bg-warn/15 text-warn border-warn/25", label: "보통" },
  Low:    { dot: "bg-text-3 opacity-50", badge: "bg-panel-2 text-text-3 border-border", label: "낮음" },
} as const;

const COUNTRY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CNY: "🇨🇳", AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭",
  NZD: "🇳🇿", KRW: "🇰🇷",
};

function formatDate(iso: string): { day: string; time: string; weekday: string } {
  try {
    const d = new Date(iso);
    return {
      day:     d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
      weekday: d.toLocaleDateString("ko-KR", { weekday: "short" }),
      time:    d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  } catch {
    return { day: "—", weekday: "", time: "—" };
  }
}

function dayKey(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return iso; }
}

function ImpactBadge({ impact }: { impact: string }) {
  const cfg = IMPACT_CONFIG[impact as keyof typeof IMPACT_CONFIG];
  if (!cfg) return <span className="text-text-3 text-[10px]">{impact}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
      {cfg.label}
    </span>
  );
}

function ValueCell({ val, prev, forecast }: { val: string | null; prev: string | null; forecast: string | null }) {
  const hasActual = val != null && val !== "";
  if (!hasActual) {
    return <span className="text-text-3 font-data text-xs">{forecast ?? "—"}</span>;
  }
  // Compare actual vs forecast to color-code
  const actNum = parseFloat(val.replace(/[^0-9.-]/g, ""));
  const foreNum = parseFloat((forecast ?? "").replace(/[^0-9.-]/g, ""));
  let color = "text-text-1";
  if (!isNaN(actNum) && !isNaN(foreNum)) {
    color = actNum >= foreNum ? "px-1 bg-pos/20 text-pos" : "px-1 bg-neg/20 text-neg";
  }
  return <span className={`font-data font-semibold text-xs ${color}`}>{val}</span>;
}

export default function CalendarPage() {
  const [week, setWeek] = useState<Week>("this");
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    setEvents([]);

    const load = () =>
      getEconomicCalendar(week, ctrl.signal)
        .then(data => { if (!ctrl.signal.aborted) setEvents(data); })
        .catch(err => {
          if (err instanceof Error && err.name === "AbortError") return;
          if (!ctrl.signal.aborted)
            setError(err instanceof ApiError ? err.message : "캘린더 로드 실패");
        })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    load();
    const timer = setInterval(load, 60_000);
    return () => { ctrl.abort(); clearInterval(timer); };
  }, [week]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  // Available countries
  const countries = ["all", ...Array.from(new Set(events.map(e => e.country))).sort()];

  const filtered = events.filter(e => {
    if (impactFilter !== "all" && e.impact !== impactFilter) return false;
    if (countryFilter !== "all" && e.country !== countryFilter) return false;
    return true;
  });

  // Group by day
  const byDay = filtered.reduce<Record<string, EconomicEvent[]>>((acc, ev) => {
    const k = dayKey(ev.date);
    (acc[k] ??= []).push(ev);
    return acc;
  }, {});

  const highCount   = filtered.filter(e => e.impact === "High").length;
  const mediumCount = filtered.filter(e => e.impact === "Medium").length;

  function getCalendarContent(): string {
    return filtered
      .filter(e => e.impact === "High" || e.impact === "Medium")
      .map(e => `[${e.impact}] ${e.country} ${e.date} ${e.title} 이전:${e.previous ?? "?"} 예측:${e.forecast ?? "?"} 실제:${e.actual ?? "미발표"}`)
      .join("\n");
  }

  return (
    <div className="p-4 max-w-[1300px]">
      <div className="flex gap-4 items-start">
      {/* Left: calendar */}
      <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-text-1 text-lg font-semibold">경제 캘린더</h1>
        <p className="text-text-3 text-xs mt-0.5">
          ForexFactory 경제지표 일정 · 미국 동부 시간 기준 · 60초 캐시
        </p>
      </div>

      {/* Controls */}
      <Panel className="flex flex-wrap gap-2 items-center px-4 py-3">

        {/* Week toggle */}
        <div className="mr-2">
          <SegmentedToggle
            size="sm"
            value={week}
            onChange={setWeek}
            options={(["this", "next"] as Week[]).map(w => ({
              value: w,
              label: w === "this" ? "이번 주" : "다음 주",
              activeClass: "bg-accent text-black",
            }))}
          />
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Impact filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-xs">중요도:</span>
          {(["all", "High", "Medium", "Low"] as ImpactFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setImpactFilter(f)}
              className={`px-2.5 py-0.5 text-[11px] rounded border font-medium transition-colors ${
                impactFilter === f
                  ? f === "High"? "bg-neg/20 text-neg border-neg/30": f === "Medium" ? "bg-warn/20 text-warn border-warn/30": f === "Low"? "bg-panel-2 text-text-2 border-border": "border-accent text-accent bg-accent/10": "text-text-3 hover:text-text-1 border-transparent"}`}
            >
              {f === "all" ? "전체" : IMPACT_CONFIG[f].label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Country filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-xs">통화:</span>
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs">
            {countries.map(c => (
              <option key={c} value={c}>
                {c === "all" ? "전체" : `${COUNTRY_FLAGS[c] ?? ""} ${c}`}
              </option>
            ))}
          </select>
        </div>

        {/* Counts */}
        {!loading && filtered.length > 0 && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <span className="text-neg text-[11px]">높음 {highCount}</span>
            <span className="text-warn text-[11px]">보통 {mediumCount}</span>
            <span className="text-text-3 text-[11px]">총 {filtered.length}건</span>
          </>
        )}
      </Panel>

      {error && <p className="text-neg text-sm">{error}</p>}
      {loading && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center text-text-3 text-sm">
          로딩 중…
        </div>
      )}

      {/* Calendar body — grouped by day */}
      {!loading && Object.keys(byDay).length === 0 && !error && (
        <div className="bg-panel border border-border rounded-lg p-8 text-center text-text-3 text-sm">
          데이터 없음
        </div>
      )}

      {!loading && Object.entries(byDay).map(([dateKey, dayEvents]) => {
        const { day, weekday } = formatDate(dayEvents[0].date);
        const hasHigh = dayEvents.some(e => e.impact === "High");
        return (
          <Panel key={dateKey}>
            {/* Day header */}
            <PanelHeader right={hasHigh && (
              <span className="flex items-center gap-1 text-neg">
                <span className="w-1.5 h-1.5 rounded-full bg-neg" />
                고중요도 일정
              </span>
            )}>
              {day} · {weekday}
            </PanelHeader>

            {/* Events table */}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="px-4 py-1.5 text-left w-14">시간</th>
                  <th className="px-3 py-1.5 text-left w-14">통화</th>
                  <th className="px-3 py-1.5 text-center w-20">중요도</th>
                  <th className="px-3 py-1.5 text-left">이벤트</th>
                  <th className="px-3 py-1.5 text-right w-20">이전</th>
                  <th className="px-3 py-1.5 text-right w-20">예측</th>
                  <th className="px-3 py-1.5 text-right w-20">실제</th>
                </tr>
              </thead>
              <tbody>
                {dayEvents.map((ev, i) => {
                  const { time } = formatDate(ev.date);
                  const flag = COUNTRY_FLAGS[ev.country] ?? "";
                  const rowBg =
                    ev.impact === "High"? "hover:bg-neg/5" :
                    ev.impact === "Medium" ? "hover:bg-warn/5" :
                    "hover:bg-panel-2";
                  return (
                    <tr key={i} className={`border-t border-border transition-colors ${rowBg}`}>
                      <td className="px-4 py-2 text-text-3 font-data whitespace-nowrap">{time}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1 text-text-2 font-medium whitespace-nowrap">
                          {flag} {ev.country}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ImpactBadge impact={ev.impact} />
                      </td>
                      <td className="px-3 py-2 text-text-1">{ev.title}</td>
                      <td className="px-3 py-2 text-right text-text-3 font-data">{ev.previous ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-text-3 font-data">{ev.forecast ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <ValueCell val={ev.actual} prev={ev.previous} forecast={ev.forecast} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        );
      })}
      </div>{/* end left */}

      {/* Right: Groq summary */}
      <div className="pt-9">
        <GroqSummaryPanel mode="calendar" getContent={getCalendarContent} />
      </div>
      </div>{/* end flex row */}
    </div>
  );
}
