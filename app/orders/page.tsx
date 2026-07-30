"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getOmsOrders, type OmsOrder } from "@/lib/api";
import { LoadingState, EmptyState, SegmentedToggle } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

const VENUES = ["ALL", "KR", "US", "US_OPTIONS"] as const;
const STATUSES = ["ALL", "OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED"] as const;

const VENUE_LABEL: Record<string, string> = { ALL: "전체" };
const STATUS_LABEL: Record<string, string> = {
  ALL: "전체",
  OPEN: "미체결",
  PARTIALLY_FILLED: "부분체결",
  FILLED: "체결완료",
  CANCELLED: "취소",
  REJECTED: "거부",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "text-info bg-info/10 border-info/30",
  PARTIALLY_FILLED: "text-warn bg-warn/10 border-warn/30",
  FILLED: "text-pos bg-pos/10 border-pos/30",
  CANCELLED: "text-text-3 bg-panel-2 border-border",
  REJECTED: "text-neg bg-neg/10 border-neg/30",
};

function fmtTs(ts: string) {
  return ts.replace("T", " ").slice(0, 19);
}

export default function OrdersOmsPage() {
  const [orders, setOrders] = useState<OmsOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<(typeof VENUES)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    getOmsOrders(
      { venue: venue === "ALL" ? undefined : venue, status: status === "ALL" ? undefined : status },
      c.signal,
    )
      .then(d => { if (!c.signal.aborted) { setOrders(d.orders); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, [venue, status]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">주문 현황 (OMS)</h1>
        <p className="text-text-3 text-sm mt-0.5">
          제출된 주문의 실시간 상태 · 부분체결 진행. 서버 프로세스 재시작 시 초기화됨(영구 기록은 <span className="font-data">/orders/audit</span>).
        </p>
      </div>

      <div className="flex gap-2 text-xs">
        <SegmentedToggle
          value={venue}
          onChange={setVenue}
          size="sm"
          options={VENUES.map(v => ({ value: v, label: VENUE_LABEL[v] ?? v }))}
        />
        <div className="w-px bg-border" />
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded border ${status === s ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-1"}`}>
              {STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="주문 상태 로딩 중…" />
        : !orders || orders.length === 0 ? <EmptyState message="추적 중인 주문 없음" />
        : (
          <Panel>
            <PanelHeader right={<span className="text-text-3">{orders.length}건</span>}>주문 목록</PanelHeader>
            <div className="divide-y divide-border/50 text-sm">
              {orders.map(o => {
                const key = `${o.venue}:${o.order_id}`;
                const total = o.filled + o.remaining;
                const pct = total > 0 ? Math.round((o.filled / total) * 100) : 0;
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpanded(expanded === key ? null : key)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-panel-2"
                    >
                      <span className="text-text-3 w-24 shrink-0 font-data">{o.venue}</span>
                      <span className="text-text-1 w-28 shrink-0 font-data truncate">{o.order_id}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[o.status] ?? ""}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <div className="flex-1 h-1.5 bg-panel-2 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-text-3 font-data w-28 text-right shrink-0">
                        {o.filled}/{total} ({pct}%)
                      </span>
                      <span className="text-text-3 font-data w-40 text-right shrink-0">{fmtTs(o.updated_ts)}</span>
                    </button>
                    {expanded === key && (
                      <div className="px-4 pb-3 pl-[7.5rem]">
                        <div className="text-text-3 text-[11px] mb-1">체결 이력 ({o.history.length}건)</div>
                        <div className="space-y-1">
                          {o.history.map((h, i) => (
                            <div key={i} className="flex gap-3 font-data text-[11px] text-text-3">
                              <span className="w-40 shrink-0">{fmtTs(h.ts)}</span>
                              <span className={`w-28 shrink-0 ${STATUS_STYLE[h.status]?.split(" ")[0] ?? ""}`}>{STATUS_LABEL[h.status] ?? h.status}</span>
                              <span>{h.filled}/{h.filled + h.remaining}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
    </div>
  );
}
