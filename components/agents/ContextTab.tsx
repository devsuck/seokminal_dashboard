"use client";

import { useEffect, useRef, useState } from "react";
import {
  getEconomicCalendar, getInsiderKRRecent, getFREDSeries,
  type EconomicEvent, type InsiderTrade, type FREDObservation,
} from "@/lib/api";
import { NewsPanel } from "@/components/news/NewsPanel";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui";

// ponytail: 전역 피드만 노출, 에이전트별 티커 필터 없음 — 필요해지면 agentId/symbol prop 추가
export default function ContextTab() {
  const [calendar, setCalendar] = useState<EconomicEvent[] | null>(null);
  const [insider, setInsider] = useState<InsiderTrade[] | null>(null);
  const [fred, setFred] = useState<FREDObservation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    (async () => {
      try {
        const [cal, ins] = await Promise.all([
          getEconomicCalendar("this", ctrl.signal),
          getInsiderKRRecent(7, 20, ctrl.signal),
        ]);
        if (!ctrl.signal.aborted) { setCalendar(cal); setInsider(ins); setErr(null); }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (!ctrl.signal.aborted) setErr(e instanceof Error ? e.message : String(e));
      }
      try {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
        const f = await getFREDSeries("DGS10", start, end, ctrl.signal);
        if (!ctrl.signal.aborted) setFred(f.observations);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) { /* 매크로는 보조 정보 — 실패해도 나머지는 표시 */ }
      }
    })();
    return () => { abortRef.current?.abort(); };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel>
        <PanelHeader>이번주 경제캘린더</PanelHeader>
        {!calendar && !err && <LoadingState message="로딩 중…" />}
        {err && <div className="text-xs text-neg px-3 py-2">연결 오류: {err}</div>}
        <div className="divide-y divide-border">
          {(calendar ?? []).slice(0, 12).map((e, i) => (
            <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
              <span className="text-text-2">{e.title}</span>
              <span className="text-text-3 font-data">{e.date}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelHeader>KR 최근 내부자거래</PanelHeader>
        {!insider && !err && <LoadingState message="로딩 중…" />}
        <div className="divide-y divide-border">
          {(insider ?? []).slice(0, 12).map((t, i) => (
            <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
              <span className="text-text-2">{t.corp_name ?? t.ticker}</span>
              <span className="text-text-3 font-data">{t.trade_date ?? ""}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="lg:col-span-2">
        <PanelHeader>매크로(US 10Y) 최근값</PanelHeader>
        <div className="px-3 py-2 text-xs text-text-2 font-data">
          {fred && fred.length > 0 ? `${fred[fred.length - 1].date}: ${fred[fred.length - 1].value}` : "—"}
        </div>
      </Panel>
      <div className="lg:col-span-2">
        <NewsPanel />
      </div>
    </div>
  );
}
