"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRiskStatus, setKillSwitch, type RiskStatus } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";

function won(n: number) { return `₩${n.toLocaleString()}`; }

export default function RiskGuardPage() {
  const [data, setData] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    getRiskStatus(c.signal)
      .then(d => { if (!c.signal.aborted) { setData(d); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  async function toggleKill() {
    if (!data) return;
    const next = !data.kill_engaged;
    if (next && !confirm("⚠ 킬스위치 ON — 모든 자동봇/주문 즉시 차단. 계속?")) return;
    setBusy(true);
    try { await setKillSwitch(next, "manual"); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const dd = data?.current_drawdown_pct ?? null;
  const limit = data?.max_drawdown_limit_pct ?? 15;
  const ddFrac = dd != null ? Math.min(Math.abs(dd) / limit, 1) : 0;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">리스크 관리</h1>
        <p className="text-text-3 text-sm mt-0.5">
          킬스위치 · 최대낙폭(MDD) 자동차단 · 주문 한도. 낙폭이 한도 초과하면 <span className="text-neg">자동으로 킬</span>되고 모든 자동봇 주문이 멈춥니다.
        </p>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="리스크 상태 로딩 중…" />
        : !data ? <EmptyState message="데이터 없음" />
        : (
          <>
            {/* 킬스위치 */}
            <div className={`border rounded-lg p-4 flex items-center justify-between ${data.kill_engaged ? "border-neg/50 bg-neg/10" : "border-border bg-panel"}`}>
              <div>
                <div className={`text-sm font-semibold ${data.kill_engaged ? "text-neg" : "text-text-1"}`}>
                  킬스위치 {data.kill_engaged ? " ON — 거래 차단됨" : " OFF — 정상"}
                </div>
                <div className="text-text-3 text-xs mt-0.5">
                  {data.kill_engaged ? `사유: ${data.kill_reason || "manual"}` : "모든 자동봇/주문 즉시 중단 스위치"}
                </div>
              </div>
              <button onClick={toggleKill} disabled={busy}
                className={`text-sm font-medium px-4 py-2 rounded border disabled:opacity-40 ${
                  data.kill_engaged ? "border-pos/50 text-pos hover:bg-pos/10" : "border-neg/50 text-neg hover:bg-neg/10"}`}>
                {data.kill_engaged ? "해제" : "긴급 정지"}
              </button>
            </div>

            {/* MDD 게이지 */}
            <Panel>
              <PanelHeader right={
                <span className={data.drawdown_breached ? "text-neg" : dd != null && dd < 0 ? "text-warn" : ""}>
                  {dd != null ? `${dd}%` : "—"} / 한도 -{limit}%
                </span>
              }>
                최대낙폭 (peak 대비)
              </PanelHeader>
              <div className="p-4">
                <div className="h-2.5 bg-panel-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${data.drawdown_breached ? "bg-neg" : ddFrac > 0.6 ? "bg-warn" : "bg-pos"}`}
                    style={{ width: `${Math.round(ddFrac * 100)}%` }} />
                </div>
                {data.drawdown_breached && (
                  <p className="text-neg text-xs mt-2">⚠ 낙폭 한도 초과 — 자동 킬 발동됨. 원인 점검 후 수동 해제.</p>
                )}
              </div>
            </Panel>

            {/* 주문 한도 */}
            <Panel>
              <PanelHeader>주문 한도 (서버 강제)</PanelHeader>
              <div className="divide-y divide-border/50 text-sm">
                {[
                  ["1회 주문 최대 수량", data.limits.max_order_qty.toLocaleString()],
                  ["1회 주문 최대 금액", won(data.limits.max_order_notional)],
                  ["종목당 최대 보유수량", data.limits.max_position_qty.toLocaleString()],
                  ["일일 손실 한도", won(data.limits.daily_loss_limit)],
                ].map(([k, v]) => (
                  <div key={k} className="px-4 py-2 flex justify-between">
                    <span className="text-text-3">{k}</span>
                    <span className="font-data text-text-1">{v}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 text-text-3 text-[11px]">※ 한도는 .env(MAX_ORDER_*, DAILY_LOSS_LIMIT, MAX_DRAWDOWN_PCT)에서 조정.</div>
            </Panel>
          </>
        )}
    </div>
  );
}
